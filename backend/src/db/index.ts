import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Database access layer.
 *  - Production / Supabase: `pg` pool using DATABASE_URL (use the Supabase *pooler* connection string).
 *  - Local development without DATABASE_URL: embedded PostgreSQL (PGlite) persisted in ./.data/pglite
 *    so the whole app is runnable with zero setup. Never used when DATABASE_URL is set.
 */
export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type QueryResult<T = Row> = { rows: T[]; rowCount: number };
export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Run a multi-statement script (no parameters). */
  exec(text: string): Promise<void>;
}
interface Driver extends Queryable {
  tx<T>(fn: (c: Queryable) => Promise<T>): Promise<T>;
  kind: "pg" | "pglite";
}

const g = globalThis as unknown as { __msptDb?: Promise<Driver> };

export const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL);

async function createPg(): Promise<Driver> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(1082, (v: string) => v); // DATE -> 'YYYY-MM-DD'
  types.setTypeParser(20, (v: string) => Number(v)); // BIGINT -> number
  const url = process.env.DATABASE_URL!;
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: local || process.env.DB_SSL === "disable" ? undefined : { rejectUnauthorized: false },
  });
  pool.on("error", (e: Error) => console.error("[db] pool error", e.message));
  return {
    kind: "pg",
    async query(text, params) {
      const r = await pool.query(text, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
    async exec(text) {
      await pool.query(text);
    },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn({
          async query(text: string, params?: unknown[]) {
            const r = await c.query(text, params);
            return { rows: r.rows, rowCount: r.rowCount ?? 0 };
          },
          async exec(text: string) {
            await c.query(text);
          },
        } as Queryable);
        await c.query("COMMIT");
        return out;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
  };
}

async function createLite(): Promise<Driver> {
  if (process.env.DEMO_MODE === "1" && process.env.DATABASE_URL) throw new Error("DEMO_MODE must never be combined with a real DATABASE_URL");
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMBEDDED_DB) {
    throw new Error("DATABASE_URL is not set. Configure your Supabase connection string (see README).");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const mem = process.env.PGLITE_DIR === "memory://";
  if (!mem) fs.mkdirSync(dir, { recursive: true });
  const lite = await PGlite.create(mem ? undefined : dir, {
    parsers: { 1082: (v: string) => v, 20: (v: string) => Number(v) },
  });
  const wrap = (c: {
    query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>;
    exec: (t: string) => Promise<unknown>;
  }): Queryable => ({
    async query(text, params) {
      const r = await c.query(text, params as unknown[]);
      return { rows: r.rows as never[], rowCount: r.rows.length || r.affectedRows || 0 };
    },
    async exec(text) {
      await c.exec(text);
    },
  });
  // PGlite is single-connection: serialise transactions.
  let chain: Promise<unknown> = Promise.resolve();
  const driver: Driver = {
    kind: "pglite",
    exec: (text) => {
      const run = chain.then(() => lite.exec(text).then(() => undefined));
      chain = run.catch(() => {});
      return run;
    },
    query: (text, params) => {
      const run = chain.then(() => wrap(lite).query(text, params));
      chain = run.catch(() => {});
      return run as never;
    },
    tx: (fn) => {
      const run = chain.then(() => lite.transaction((t) => fn(wrap(t as never))));
      chain = run.catch(() => {});
      return run as never;
    },
  };
  await runMigrations(driver);
  if (process.env.DEMO_MODE === "1") {
    // Sandbox deployment: fake data only. Never enabled together with DATABASE_URL.
    const { seedBase, seedDemo, ensureUser } = await import("./seed");
    await seedBase(driver);
    await seedDemo(driver);
    await ensureUser(driver, { email: "demo@moonstar.local", name: "Demo Admin", password: (await import("node:crypto")).randomBytes(18).toString("base64url") + "aA1", role: "super_admin", designation: "Demo administrator" });
  }
  return driver;
}

export function getDb(): Promise<Driver> {
  if (!g.__msptDb) g.__msptDb = hasDatabaseUrl() ? createPg() : createLite();
  return g.__msptDb;
}

export async function query<T = Row>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return (await getDb()).query<T>(text, params);
}

export async function tx<T>(fn: (c: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).tx(fn);
}

const here = path.dirname(fileURLToPath(import.meta.url));
/** Works from src/db (dev/tests), dist/ (bundle) and when the working directory differs (serverless). */
export const MIGRATIONS_DIR =
  [process.env.MIGRATIONS_DIR, path.join(here, "..", "..", "db", "migrations"), path.join(here, "..", "db", "migrations"), path.join(process.cwd(), "db", "migrations"), path.join(process.cwd(), "backend", "db", "migrations")]
    .filter((p): p is string => Boolean(p))
    .find((p) => fs.existsSync(p)) ?? path.join(process.cwd(), "db", "migrations");

export async function runMigrations(d: Queryable, dir = MIGRATIONS_DIR): Promise<string[]> {
  await d.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await d.query<{ name: string }>("SELECT name FROM _migrations")).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const anyD = d as unknown as { tx?: (fn: (c: Queryable) => Promise<void>) => Promise<void> };
    const apply = async (c: Queryable) => {
      await c.exec(sql);
      await c.query("INSERT INTO _migrations(name) VALUES ($1)", [f]);
    };
    if (anyD.tx) await anyD.tx(apply);
    else await apply(d);
    applied.push(f);
  }
  return applied;
}
