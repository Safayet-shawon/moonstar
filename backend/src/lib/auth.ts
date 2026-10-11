import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db/index";
import type { PermKey } from "@moonstar/shared";

export const SESSION_COOKIE = "mspt_session";
export const SESSION_HOURS = 10;

let dummyHash: string | null = null;
const getDummy = () => (dummyHash ??= bcrypt.hashSync("timing-equaliser", 12)); // equalises timing for unknown emails

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  designation: string | null;
  role: string;
  roleName: string;
  isSignatory: boolean;
  signatoryTitle: string | null;
  mustChangePassword: boolean;
};
export type Session = { user: SessionUser; perms: Set<string>; can: (p: PermKey) => boolean };

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

export async function loadPermissions(userId: string, roleKey: string): Promise<Set<string>> {
  if (roleKey === "super_admin") {
    const all = await query<{ key: string }>("SELECT key FROM permissions");
    return new Set(all.rows.map((r) => r.key));
  }
  const base = await query<{ perm_key: string }>(
    `SELECT rp.perm_key FROM role_permissions rp JOIN users u ON u.role_id = rp.role_id WHERE u.id = $1`,
    [userId],
  );
  const set = new Set(base.rows.map((r) => r.perm_key));
  const ov = await query<{ perm_key: string; granted: boolean }>("SELECT perm_key, granted FROM user_permissions WHERE user_id = $1", [userId]);
  for (const o of ov.rows) o.granted ? set.add(o.perm_key) : set.delete(o.perm_key);
  return set;
}

/** Resolve the signed-in user from the raw session cookie value. Server-side lookup on every request. */
export async function sessionFromToken(token?: string): Promise<Session | null> {
  if (!token || token.length < 32) return null;
  const r = await query(
    `SELECT u.id, u.email, u.name, u.phone, u.designation, u.is_signatory, u.signatory_title, u.must_change_password,
            ro.key AS role, ro.name AS role_name
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN roles ro ON ro.id = u.role_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = TRUE`,
    [sha256(token)],
  );
  const u = r.rows[0];
  if (!u) return null;
  const perms = await loadPermissions(u.id, u.role);
  return {
    user: {
      id: u.id, email: u.email, name: u.name, phone: u.phone, designation: u.designation, role: u.role,
      roleName: u.role_name, isSignatory: u.is_signatory, signatoryTitle: u.signatory_title,
      mustChangePassword: u.must_change_password,
    },
    perms,
    can: (p) => perms.has(p),
  };
}

/** Throws 401/403. Used by every protected route. */
export function need(s: Session | null | undefined, ...keys: PermKey[]): Session {
  if (!s) throw new HttpError(401, "Not signed in");
  if (keys.length && !keys.some((k) => s.can(k))) throw new HttpError(403, "You do not have permission for this action");
  return s;
}

export async function login(email: string, password: string, ip: string, ua?: string) {
  const key = email.trim().toLowerCase();
  const fails = await query<{ k: number; i: number }>(
    `SELECT count(*) FILTER (WHERE key = $1)::int AS k, count(*) FILTER (WHERE key = $2)::int AS i
       FROM login_attempts WHERE success = FALSE AND at > now() - interval '15 minutes' AND key IN ($1,$2)`,
    [`u:${key}`, `ip:${ip}`],
  );
  if (fails.rows[0].k >= 5 || fails.rows[0].i >= 25) {
    return { ok: false as const, status: 429, error: "Too many failed attempts. Please wait 15 minutes and try again." };
  }
  const r = await query("SELECT id, password_hash, active FROM users WHERE lower(email) = $1", [key]);
  const u = r.rows[0];
  const valid = await bcrypt.compare(password, u?.password_hash ?? getDummy());
  if (!u || !u.active || !valid) {
    await query("INSERT INTO login_attempts(key, success) VALUES ($1,FALSE),($2,FALSE)", [`u:${key}`, `ip:${ip}`]);
    return { ok: false as const, status: 401, error: "Invalid email or password." };
  }
  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions(token_hash, user_id, expires_at, ip, user_agent) VALUES ($1,$2, now() + ($3 || ' hours')::interval, $4, $5)`,
    [sha256(token), u.id, String(SESSION_HOURS), ip, ua?.slice(0, 250) ?? null],
  );
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query("DELETE FROM login_attempts WHERE at < now() - interval '2 days'");
  await query(
    `INSERT INTO audit_logs(user_id, user_name, action, entity, entity_id, ip) SELECT id, name, 'auth.login', 'user', id::text, $2 FROM users WHERE id = $1`,
    [u.id, ip],
  );
  return { ok: true as const, token, maxAge: SESSION_HOURS * 3600 };
}

export const isDemoMode = () => process.env.DEMO_MODE === "1";

/**
 * Passwordless sign-in for a SANDBOX deployment only (DEMO_MODE=1, fake data, no real database).
 * Signs in as the seeded demo administrator. The route that calls this returns 404 unless DEMO_MODE=1.
 */
export async function demoLogin(ip: string, ua?: string) {
  if (!isDemoMode()) throw new HttpError(404, "Not found");
  const u = (await query("SELECT id FROM users WHERE lower(email) = 'demo@moonstar.local' AND active = TRUE")).rows[0];
  if (!u) throw new HttpError(503, "Demo data is still loading. Please retry in a moment.");
  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions(token_hash, user_id, expires_at, ip, user_agent) VALUES ($1,$2, now() + ($3 || ' hours')::interval, $4, $5)`,
    [sha256(token), u.id, String(SESSION_HOURS), ip, ua?.slice(0, 250) ?? null],
  );
  await query("DELETE FROM sessions WHERE expires_at < now()");
  return { token, maxAge: SESSION_HOURS * 3600 };
}

export async function logout(token?: string) {
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

export async function revokeUserSessions(userId: string) {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Use upper-case, lower-case letters and a number.";
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
