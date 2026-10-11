import { z } from "zod";
import { query, tx } from "../db/index";
import { DEFAULT_RULES, PERMISSIONS, STATUS_LABEL } from "@moonstar/shared";
import { HttpError, hashPassword, revokeUserSessions, validatePassword, type Session } from "./auth";
import { assertAccess } from "./quotes";
import { audit, setSetting } from "./server";

/* --------------------------------- users ---------------------------------- */
export const userSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  role: z.string().min(2).max(40),
  password: z.string().max(200).optional(),
  active: z.boolean().default(true),
  isSignatory: z.boolean().default(false),
  signatoryTitle: z.string().trim().max(120).optional().nullable(),
});
export type UserInput = z.infer<typeof userSchema>;

export async function listUsers() {
  return (
    await query(
      `SELECT u.id, u.email, u.name, u.phone, u.designation, u.active, u.is_signatory, u.signatory_title, ro.key AS role, ro.name AS role_name, u.created_at,
              (SELECT max(created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
         FROM users u JOIN roles ro ON ro.id = u.role_id ORDER BY u.active DESC, u.name`,
    )
  ).rows;
}

async function roleId(key: string) {
  const r = await query("SELECT id FROM roles WHERE key = $1", [key]);
  if (!r.rowCount) throw new Error("Unknown role");
  return r.rows[0].id as number;
}

function guardSuper(s: Session, targetRole: string) {
  if (targetRole === "super_admin" && s.user.role !== "super_admin") throw new HttpError(403, "Only a Super Admin can manage Super Admin accounts");
}

export async function createUser(s: Session, input: UserInput) {
  if (!s.can("user.manage")) throw new HttpError(403, "Not permitted");
  guardSuper(s, input.role);
  const pwErr = input.password ? validatePassword(input.password) : "Password is required";
  if (pwErr) throw new Error(pwErr);
  const rid = await roleId(input.role);
  const hash = await hashPassword(input.password!);
  const r = await query<{ id: string }>(
    `INSERT INTO users(email, name, phone, designation, password_hash, role_id, active, is_signatory, signatory_title, must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) RETURNING id`,
    [input.email, input.name, input.phone ?? null, input.designation ?? null, hash, rid, input.active, input.isSignatory, input.signatoryTitle ?? null],
  );
  await audit(s, "user.create", "user", r.rows[0].id, { email: input.email, role: input.role });
  return r.rows[0].id;
}

export async function updateUser(s: Session, id: string, input: Omit<UserInput, "password"> & { password?: string }) {
  if (!s.can("user.manage")) throw new HttpError(403, "Not permitted");
  const cur = (await query("SELECT u.*, ro.key AS role FROM users u JOIN roles ro ON ro.id = u.role_id WHERE u.id = $1", [id])).rows[0];
  if (!cur) throw new Error("User not found");
  guardSuper(s, cur.role);
  guardSuper(s, input.role);
  if (id === s.user.id && (!input.active || input.role !== cur.role)) throw new Error("You cannot deactivate or change the role of your own account");
  if (cur.role === "super_admin" && (input.role !== "super_admin" || !input.active)) {
    const n = (await query("SELECT count(*)::int AS n FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.key = 'super_admin' AND u.active")).rows[0].n;
    if (n <= 1) throw new Error("At least one active Super Admin is required");
  }
  const rid = await roleId(input.role);
  await tx(async (c) => {
    await c.query(
      `UPDATE users SET email=$2, name=$3, phone=$4, designation=$5, role_id=$6, active=$7, is_signatory=$8, signatory_title=$9, updated_at=now() WHERE id=$1`,
      [id, input.email, input.name, input.phone ?? null, input.designation ?? null, rid, input.active, input.isSignatory, input.signatoryTitle ?? null],
    );
    await audit(s, "user.update", "user", id, { email: input.email, role: input.role, active: input.active, from: { role: cur.role, active: cur.active } }, c);
  });
  if (!input.active || input.role !== cur.role) await revokeUserSessions(id);
}

export async function resetPassword(s: Session, id: string, password: string) {
  if (!s.can("user.manage")) throw new HttpError(403, "Not permitted");
  const target = (await query("SELECT ro.key AS role FROM users u JOIN roles ro ON ro.id = u.role_id WHERE u.id = $1", [id])).rows[0];
  if (!target) throw new Error("User not found");
  guardSuper(s, target.role);
  const err = validatePassword(password);
  if (err) throw new Error(err);
  await query("UPDATE users SET password_hash = $2, must_change_password = TRUE, updated_at = now() WHERE id = $1", [id, await hashPassword(password)]);
  await revokeUserSessions(id);
  await audit(s, "user.reset_password", "user", id, {});
}

export async function changeOwnPassword(s: Session, current: string, next: string) {
  const { verifyPassword } = await import("./auth");
  const row = (await query("SELECT password_hash FROM users WHERE id = $1", [s.user.id])).rows[0];
  if (!(await verifyPassword(current, row.password_hash))) throw new Error("Current password is incorrect");
  const err = validatePassword(next);
  if (err) throw new Error(err);
  await query("UPDATE users SET password_hash = $2, must_change_password = FALSE, updated_at = now() WHERE id = $1", [s.user.id, await hashPassword(next)]);
  await audit(s, "user.change_password", "user", s.user.id, {});
}

/* ----------------------------- roles & overrides ---------------------------- */
export async function listRoles() {
  const roles = (await query("SELECT id, key, name, description FROM roles ORDER BY id")).rows;
  const rp = (await query("SELECT r.key AS role, rp.perm_key FROM role_permissions rp JOIN roles r ON r.id = rp.role_id")).rows;
  return roles.map((r) => ({ ...r, permissions: rp.filter((x) => x.role === r.key).map((x) => x.perm_key) }));
}

export async function setRolePermissions(s: Session, roleKey: string, perms: string[]) {
  if (!s.can("role.manage")) throw new HttpError(403, "Not permitted");
  if (roleKey === "super_admin") throw new Error("Super Admin always has every permission");
  const valid = new Set(PERMISSIONS.map((p) => p[0]));
  const clean = [...new Set(perms)].filter((p) => valid.has(p as never));
  // escalation guard: you cannot grant a role permissions you do not hold yourself
  const cur = new Set((await query("SELECT rp.perm_key FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.key = $1", [roleKey])).rows.map((x) => x.perm_key));
  for (const p of clean) if (!cur.has(p) && !s.perms.has(p)) throw new HttpError(403, `You cannot grant "${p}" because you do not hold it`);
  const rid = await roleId(roleKey);
  await tx(async (c) => {
    await c.query("DELETE FROM role_permissions WHERE role_id = $1", [rid]);
    for (const p of clean) await c.query("INSERT INTO role_permissions(role_id, perm_key) VALUES ($1,$2)", [rid, p]);
    await audit(s, "role.permissions", "role", roleKey, { permissions: clean }, c);
  });
}

export async function getUserOverrides(id: string) {
  return (await query("SELECT perm_key, granted FROM user_permissions WHERE user_id = $1", [id])).rows;
}

export async function setUserOverrides(s: Session, id: string, overrides: Record<string, boolean | null>) {
  if (!s.can("role.manage")) throw new HttpError(403, "Not permitted");
  const target = (await query("SELECT ro.key AS role FROM users u JOIN roles ro ON ro.id = u.role_id WHERE u.id = $1", [id])).rows[0];
  if (!target) throw new Error("User not found");
  guardSuper(s, target.role);
  const valid = new Set(PERMISSIONS.map((p) => p[0]));
  await tx(async (c) => {
    for (const [perm, v] of Object.entries(overrides)) {
      if (!valid.has(perm as never)) continue;
      if (v === true && !s.perms.has(perm)) throw new HttpError(403, `You cannot grant "${perm}" because you do not hold it`);
      if (v === null) await c.query("DELETE FROM user_permissions WHERE user_id = $1 AND perm_key = $2", [id, perm]);
      else await c.query(`INSERT INTO user_permissions(user_id, perm_key, granted) VALUES ($1,$2,$3) ON CONFLICT (user_id, perm_key) DO UPDATE SET granted = EXCLUDED.granted`, [id, perm, v]);
    }
    await audit(s, "user.overrides", "user", id, { overrides }, c);
  });
}

/* --------------------------------- settings --------------------------------- */
const str = (max = 500) => z.string().trim().max(max);
export const settingSchemas: Record<string, { perm: "settings.manage" | "template.manage"; schema: z.ZodType }> = {
  company: {
    perm: "settings.manage",
    schema: z.object({ name: str(200).min(2), tagline: str(), phone: str(60), email: str(200), website: str(200), hours: str(200), factory: str(400), branch: str(400), khulna: str(400), approval: str(400), timezone: str(60).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Invalid timezone"), currency: str(10) }),
  },
  template: {
    perm: "template.manage",
    schema: z.object({ header: str(300), footer: str(500), validityDays: z.coerce.number().int().min(1).max(365), quotePrefix: str(10).min(1), paymentTerms: str(2000), terms: z.array(str(600)).max(30), signatoryName: str(120), signatoryTitle: str(120), showSignatureBlock: z.boolean() }),
  },
  pricing: { perm: "settings.manage", schema: z.object({ taxPercent: z.coerce.number().min(0).max(100), taxLabel: str(40), defaultMarkupPercent: z.coerce.number().min(0).max(500) }) },
  workflow: {
    perm: "settings.manage",
    schema: z.object({
      transitions: z.record(z.string(), z.array(z.object({ to: z.string(), perm: z.string().nullable(), label: str(80) }))),
      lockOn: z.array(z.string()),
      discountApprovalPct: z.coerce.number().min(0).max(100),
      minMarginPct: z.coerce.number().min(0).max(100),
    }).refine((w) => Object.values(w.transitions).flat().every((t) => t.perm === null || PERMISSIONS.some((p) => p[0] === t.perm)), "Unknown permission in workflow")
      .refine((w) => Object.keys(w.transitions).every((k) => k in STATUS_LABEL) && Object.values(w.transitions).flat().every((t) => t.to in STATUS_LABEL), "Unknown status in workflow"),
  },
  engineering_rules: {
    perm: "settings.manage",
    schema: z.object({
      transformerRatingsKva: z.array(z.number().positive()).min(1).max(40),
      pfiStepKvar: z.number().positive(), maxTransformerLoadingPct: z.number().min(30).max(100), defaultExpansionPct: z.number().min(0).max(200),
      defaultTargetPf: z.number().min(0.7).max(1), defaultDiversity: z.number().min(0.1).max(1), htVoltageV: z.number().positive(), lvVoltageV: z.number().positive(),
      maxParallelUnits: z.number().int().min(1).max(8), cableSafetyFactor: z.number().min(1).max(2),
      cableTable: z.array(z.object({ currentA: z.number().positive(), label: str(100) })).min(1),
      categories: z.record(z.string(), z.object({ label: str(80), demandFactor: z.number().min(0.05).max(1), pf: z.number().min(0.3).max(1) })),
    }),
  },
};

export async function getAllSettings() {
  const r = await query("SELECT key, value FROM settings");
  const out: Record<string, unknown> = { engineering_rules: DEFAULT_RULES };
  for (const x of r.rows) out[x.key] = x.value;
  return out;
}

export async function saveSetting(s: Session, key: string, value: unknown) {
  const def = settingSchemas[key];
  if (!def) throw new Error("Unknown setting");
  if (!s.can(def.perm)) throw new HttpError(403, "Not permitted");
  const parsed = def.schema.parse(value);
  await setSetting(key, parsed, s.user.id);
  await audit(s, "settings.update", "settings", key, { key });
}

/* ----------------------------- audit & inquiries ----------------------------- */
export async function listAudit(s: Session, f: { entity?: string; action?: string; q?: string; page?: number }) {
  if (!s.can("audit.view")) throw new HttpError(403, "Not permitted");
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  const where: string[] = [];
  if (f.entity) where.push(`entity = ${p(f.entity)}`);
  if (f.action) where.push(`action LIKE ${p(`${f.action}%`)}`);
  if (f.q) where.push(`(lower(coalesce(user_name,'')) LIKE ${p(`%${f.q.toLowerCase()}%`)} OR lower(coalesce(entity_id,'')) LIKE ${p(`%${f.q.toLowerCase()}%`)})`);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(f.page ?? 1, 1);
  const total = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_logs ${w}`, params)).rows[0].n;
  const rows = (await query(`SELECT id, at, user_name, action, entity, entity_id, detail, ip FROM audit_logs ${w} ORDER BY at DESC, id DESC LIMIT 50 OFFSET ${(page - 1) * 50}`, params)).rows;
  return { rows, total, page, pages: Math.max(Math.ceil(total / 50), 1) };
}

export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().min(6).max(30).regex(/^[+\d][\d\s\-()]+$/, "Enter a valid phone number"),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  service: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(10, "Please describe your requirement").max(3000),
  website: z.string().max(500).optional(), // honeypot: any value => bot, silently dropped
});

export async function createInquiry(input: z.infer<typeof inquirySchema>, ip: string) {
  if (input.website) return { ok: true }; // bot: silently accept
  const recent = (await query<{ n: number }>("SELECT count(*)::int AS n FROM inquiries WHERE ip = $1 AND created_at > now() - interval '1 hour'", [ip])).rows[0].n;
  if (recent >= 5) throw new HttpError(429, "Too many requests. Please call us directly.");
  await query(`INSERT INTO inquiries(name, company, phone, email, service, message, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
    input.name, input.company || null, input.phone, input.email || null, input.service || null, input.message, ip,
  ]);
  return { ok: true };
}

export async function listInquiries(s: Session, page = 1) {
  if (!s.can("inquiry.view")) throw new HttpError(403, "Not permitted");
  const total = (await query<{ n: number }>("SELECT count(*)::int AS n FROM inquiries")).rows[0].n;
  const rows = (await query(`SELECT id, name, company, phone, email, service, message, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT 30 OFFSET ${(Math.max(page, 1) - 1) * 30}`)).rows;
  return { rows, total, page, pages: Math.max(Math.ceil(total / 30), 1) };
}

export async function setInquiryStatus(s: Session, id: string, status: string) {
  if (!s.can("inquiry.view")) throw new HttpError(403, "Not permitted");
  if (!["new", "contacted", "closed"].includes(status)) throw new Error("Invalid status");
  await query("UPDATE inquiries SET status = $2 WHERE id = $1", [id, status]);
  await audit(s, "inquiry.status", "inquiry", id, { status });
}

/* -------------------------------- work orders -------------------------------- */
export const workOrderSchema = z.object({
  woNumber: z.string().trim().min(2).max(60),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid received date"),
  finalValue: z.union([z.string(), z.number()]).transform(String).refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid final value").optional(),
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(160), due: z.string().max(10).optional().nullable(), done: z.boolean().default(false) })).max(30).default([]),
  warranty: z.object({ months: z.coerce.number().int().min(0).max(240).optional(), notes: z.string().max(1000).optional(), maintenanceNotes: z.string().max(1000).optional() }).default({}),
  notes: z.string().max(3000).optional().nullable(),
});

export async function saveWorkOrder(s: Session, quotationId: string, input: z.infer<typeof workOrderSchema>, workOrderId?: string) {
  if (!s.can("workorder.manage")) throw new HttpError(403, "Not permitted");
  const q = await assertAccess(s, quotationId);
  if (q.status !== "accepted") throw new Error("A work order can only be linked to an accepted quotation");
  const version = q.approved_version ?? q.current_version;
  return tx(async (c) => {
    const v = (await c.query("SELECT id, total FROM quotation_versions WHERE quotation_id = $1 AND version = $2", [quotationId, version])).rows[0];
    const items = (await c.query("SELECT sku, name, unit, qty, unit_price, line_total FROM quotation_items WHERE version_id = $1 ORDER BY position", [v.id])).rows;
    const finalValue = input.finalValue ?? v.total;
    if (workOrderId) {
      await c.query(
        `UPDATE work_orders SET wo_number=$2, received_date=$3, final_value=$4, milestones=$5, warranty=$6, notes=$7, updated_at=now() WHERE id=$1 AND quotation_id=$8`,
        [workOrderId, input.woNumber, input.receivedDate, finalValue, JSON.stringify(input.milestones), JSON.stringify(input.warranty), input.notes ?? null, quotationId],
      );
      await audit(s, "workorder.update", "quotation", quotationId, { woNumber: input.woNumber }, c);
      return workOrderId;
    }
    const r = await c.query<{ id: string }>(
      `INSERT INTO work_orders(quotation_id, version, wo_number, received_date, final_value, material_list, milestones, warranty, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [quotationId, version, input.woNumber, input.receivedDate, finalValue, JSON.stringify(items), JSON.stringify(input.milestones), JSON.stringify(input.warranty), input.notes ?? null, s.user.id],
    );
    await audit(s, "workorder.create", "quotation", quotationId, { woNumber: input.woNumber, version, finalValue }, c);
    return r.rows[0].id;
  });
}
