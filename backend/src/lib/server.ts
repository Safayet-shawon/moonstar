import { ZodError } from "zod";
import { query, type Queryable } from "../db/index";
import { HttpError, type Session } from "./auth";
import { DEFAULT_RULES, DEFAULT_WORKFLOW, type EngineeringRules, type WorkflowConfig } from "@moonstar/shared";

export { todayIn } from "@moonstar/shared";

/* ---------------------------------- audit ---------------------------------- */
export async function audit(
  s: Pick<Session, "user"> | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail: Record<string, unknown> = {},
  q: Queryable | { query: typeof query } = { query },
) {
  await q.query(
    `INSERT INTO audit_logs(user_id, user_name, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
    [s?.user.id ?? null, s?.user.name ?? null, action, entity, entityId, JSON.stringify(detail, (_, v) => (typeof v === "bigint" ? v.toString() : v))],
  );
}

/* --------------------------------- settings -------------------------------- */
const cacheMap = new Map<string, { v: unknown; t: number }>();
const TTL = 30_000;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const c = cacheMap.get(key);
  if (c && Date.now() - c.t < TTL) return c.v as T;
  const r = await query<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  const v = (r.rows[0]?.value ?? fallback) as T;
  cacheMap.set(key, { v, t: Date.now() });
  return v;
}

export async function setSetting(key: string, value: unknown, userId: string | null) {
  await query(
    `INSERT INTO settings(key, value, updated_by, updated_at) VALUES ($1,$2,$3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), userId],
  );
  cacheMap.delete(key);
}

export const getWorkflow = () => getSetting<WorkflowConfig>("workflow", DEFAULT_WORKFLOW);
export const getRules = () => getSetting<EngineeringRules>("engineering_rules", DEFAULT_RULES);

export type CompanySettings = {
  name: string; tagline: string; phone: string; email: string; website: string; hours: string;
  factory: string; branch: string; khulna: string; approval: string; timezone: string; currency: string;
};
export type TemplateSettings = {
  header: string; footer: string; validityDays: number; quotePrefix: string; paymentTerms: string;
  terms: string[]; signatoryName: string; signatoryTitle: string; showSignatureBlock: boolean;
};

/* ------------------------------ error mapping ------------------------------- */
export function errorResponse(e: unknown): { status: number; body: Record<string, unknown> } {
  if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
  if (e instanceof ZodError) {
    return { status: 400, body: { error: e.issues[0] ? `${e.issues[0].path.join(".") || "input"}: ${e.issues[0].message}` : "Validation failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } };
  }
  const msg = e instanceof Error ? e.message : "Unexpected error";
  // Domain errors thrown by our own engines are user-facing validation messages.
  const known = /must be|cannot|Invalid|locked|required|not found|exceeds|Enter at least|not allowed|not permitted|permission|Only draft|Add at least|changed|belong|Enter a|Unknown|reason|duplicate key|already exists/i.test(msg);
  if (/duplicate key/i.test(msg)) return { status: 409, body: { error: "A record with the same unique value already exists." } };
  if (!known) console.error("[api]", e);
  return { status: known ? 400 : 500, body: { error: known ? msg : "Something went wrong. Please try again." } };
}

export const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => uuidRe.test(s);
