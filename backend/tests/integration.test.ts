import { beforeAll, describe, expect, it } from "vitest";
import { getDb, query } from "../src/db/index";
import { ensureUser, seedBase, seedDemo } from "../src/db/seed";
import { loadPermissions, type Session } from "../src/lib/auth";
import { reviseQuotation, saveQuotation, transitionQuotation, nextQuotationNumber, getQuotationFull, listQuotations, quotationInput, type QuotationInput } from "../src/lib/quotes";
import { PERMISSIONS } from "@moonstar/shared";

async function sessionFor(email: string): Promise<Session> {
  const r = await query("SELECT u.*, ro.key AS role, ro.name AS role_name FROM users u JOIN roles ro ON ro.id = u.role_id WHERE lower(u.email) = $1", [email]);
  const u = r.rows[0];
  const perms = await loadPermissions(u.id, u.role);
  return {
    user: { id: u.id, email: u.email, name: u.name, phone: u.phone, designation: u.designation, role: u.role, roleName: u.role_name, isSignatory: u.is_signatory, signatoryTitle: u.signatory_title, mustChangePassword: false },
    perms,
    can: (p) => perms.has(p),
  };
}

let employee: Session, approver: Session, viewer: Session, pricing: Session, admin: Session, other: Session;
let projectId: string;
let trId: string;
let cableId: string;

const payload = (over: Partial<QuotationInput> = {}): QuotationInput =>
  quotationInput.parse({
    projectId,
    techInput: { mode: "quick", category: "residential", totalKw: 150, solutions: ["substation"] },
    items: [{ productId: trId, name: "Transformer", unit: "nos", qty: 1 }, { productId: cableId, name: "HT cable", unit: "m", qty: 20 }],
    commercial: { discountType: "none", discountValue: 0, labourCharge: "10000", transportCharge: "2000", taxPercent: 0 },
    ...over,
  });

beforeAll(async () => {
  const d = await getDb();
  await seedBase(d);
  await seedDemo(d);
  await ensureUser(d, { email: "admin@t.local", name: "Admin", password: "Passw0rd!long", role: "super_admin" });
  await ensureUser(d, { email: "other@t.local", name: "Other Employee", password: "Passw0rd!long", role: "employee" });
  employee = await sessionFor("employee@moonstar.local");
  approver = await sessionFor("approver@moonstar.local");
  viewer = await sessionFor("viewer@moonstar.local");
  pricing = await sessionFor("pricing@moonstar.local");
  admin = await sessionFor("admin@t.local");
  other = await sessionFor("other@t.local");
  projectId = (await query("SELECT id FROM projects LIMIT 1")).rows[0].id;
  trId = (await query("SELECT id FROM products WHERE sku = 'DEMO-TR-250'")).rows[0].id;
  cableId = (await query("SELECT id FROM products WHERE sku = 'DEMO-CABLE-HT'")).rows[0].id;
});

describe("permissions", () => {
  it("super admin has every permission, viewer cannot edit", () => {
    expect(admin.perms.size).toBe(PERMISSIONS.length);
    expect(viewer.can("quotation.create")).toBe(false);
    expect(viewer.can("quotation.view_all")).toBe(true);
    expect(employee.can("price.manage")).toBe(false);
    expect(employee.can("quotation.view_cost")).toBe(false);
  });
  it("per-user overrides can add and remove permissions", async () => {
    await query("INSERT INTO user_permissions(user_id, perm_key, granted) VALUES ($1,'price.manage',TRUE),($1,'quotation.create',FALSE)", [other.user.id]);
    const p = await loadPermissions(other.user.id, "employee");
    expect(p.has("price.manage")).toBe(true);
    expect(p.has("quotation.create")).toBe(false);
    await query("DELETE FROM user_permissions WHERE user_id = $1", [other.user.id]);
  });
  it("server rejects a viewer creating a quotation", async () => {
    await expect(saveQuotation(viewer, payload())).rejects.toThrow(/cannot create/i);
  });
});

describe("quotation numbering", () => {
  it("is unique under concurrent requests", async () => {
    const d = await getDb();
    const nums = await Promise.all(Array.from({ length: 12 }, () => d.tx((c) => nextQuotationNumber(c, 2099))));
    expect(new Set(nums).size).toBe(12);
    expect(nums.sort()[0]).toBe("Q-2099-001");
  });
});

describe("quotation lifecycle", () => {
  let id: string;
  it("creates a draft priced server-side from the catalogue", async () => {
    const r = await saveQuotation(employee, payload());
    id = r.id;
    expect(r.number).toMatch(/^Q-\d{4}-\d{3}$/);
    // 880000 + 20*1800 + 10000 + 2000
    expect(r.total).toBe("928000.00");
  });
  it("refuses a manual price override without permission", async () => {
    const p = payload();
    p.items[0].unitPrice = "1";
    await expect(saveQuotation(employee, p)).rejects.toThrow(/not permitted to change the catalogue price/);
  });
  it("employees only see their own quotations; viewers see all", async () => {
    expect((await listQuotations(employee, {})).total).toBeGreaterThan(0);
    expect((await listQuotations(other, {})).total).toBe(0);
    expect((await listQuotations(viewer, {})).total).toBeGreaterThan(0);
    await expect(getQuotationFull(other, id)).rejects.toThrow(/not found/i);
  });
  it("hides internal cost from users without view_cost", async () => {
    const f = await getQuotationFull(employee, id);
    expect(f.items.every((i) => !("cost_price" in i))).toBe(true);
    const a = await getQuotationFull(admin, id);
    expect(a.items.some((i) => i.cost_price)).toBe(true);
  });
  it("enforces the approval workflow with server-side permission checks", async () => {
    await expect(transitionQuotation(employee, id, "approved")).rejects.toThrow(/not allowed/);
    await transitionQuotation(employee, id, "pending_technical");
    await expect(transitionQuotation(employee, id, "pending_commercial")).rejects.toThrow(/permission/);
    await expect(transitionQuotation(approver, id, "draft")).rejects.toThrow(/note is required/);
    await transitionQuotation(approver, id, "draft", "Please re-check the cable length");
    await transitionQuotation(employee, id, "pending_technical");
    await transitionQuotation(approver, id, "pending_commercial");
    await expect(transitionQuotation(approver, id, "approved")).rejects.toThrow(/permission/); // approver lacks commercial approval
    await transitionQuotation(admin, id, "approved");
    const f = await getQuotationFull(admin, id);
    expect(f.quotation.status).toBe("approved");
    expect(f.approvals.length).toBe(3);
    expect(f.versions[0].locked).toBe(true);
  });
  it("locked versions are immutable at the database level", async () => {
    const f = await getQuotationFull(admin, id);
    await expect(query("UPDATE quotation_versions SET total = 1 WHERE id = $1", [f.versions[0].id])).rejects.toThrow(/locked/);
    await expect(query("UPDATE quotation_items SET qty = 99 WHERE version_id = $1", [f.versions[0].id])).rejects.toThrow(/locked/);
    await expect(query("DELETE FROM quotation_items WHERE version_id = $1", [f.versions[0].id])).rejects.toThrow(/locked/);
  });
  it("cannot edit a non-draft quotation; revising preserves V1", async () => {
    await expect(saveQuotation(employee, payload(), id)).rejects.toThrow(/Only draft/);
    await transitionQuotation(employee, id, "sent");
    await expect(reviseQuotation(employee, id, "x")).rejects.toThrow(/reason/i);
    await reviseQuotation(employee, id, "Client requested a second cable run");
    const p = payload();
    p.items[1].qty = "40";
    const r = await saveQuotation(employee, p, id);
    expect(r.version).toBe(2);
    expect(r.total).toBe("964000.00");
    const f = await getQuotationFull(admin, id);
    const v1 = f.versions.find((v) => v.version === 1)!;
    const v2 = f.versions.find((v) => v.version === 2)!;
    expect(v1.total).toBe("928000.00");
    expect(v2.total).toBe("964000.00");
    expect(f.items.filter((i) => i.version === 1).find((i) => i.sku === "DEMO-CABLE-HT")!.qty).toBe("20.000");
    expect(f.quotation.status).toBe("draft");
  });
  it("price change affects new quotations but not the preserved original", async () => {
    await query("UPDATE products SET price = 800000 WHERE id = $1", [trId]);
    const fresh = await saveQuotation(employee, payload());
    expect(fresh.total).toBe("848000.00");
    const orig = await getQuotationFull(admin, id);
    expect(orig.versions.find((v) => v.version === 1)!.total).toBe("928000.00");
    await query("UPDATE products SET price = 880000 WHERE id = $1", [trId]);
  });
  it("technical override requires permission and a reason", async () => {
    await expect(saveQuotation(employee, payload({ override: { recommendedKva: 315, units: 1, reason: "Client wants more headroom" } }))).rejects.toThrow(/authorised engineer/);
    const r = await saveQuotation(admin, payload({ override: { recommendedKva: 315, units: 1, reason: "Client wants more headroom" } }));
    const f = await getQuotationFull(admin, r.id);
    expect(f.versions[0].tech_override.reason).toMatch(/headroom/);
    expect(f.versions[0].tech_result.recommendedKva).toBeGreaterThan(0);
  });
  it("audit log is append-only", async () => {
    await expect(query("DELETE FROM audit_logs")).rejects.toThrow(/append-only/);
    const n = (await query("SELECT count(*)::int AS n FROM audit_logs WHERE entity = 'quotation'")).rows[0].n;
    expect(n).toBeGreaterThan(5);
  });
  it("pricing admin can see cost but cannot create quotations", async () => {
    expect(pricing.can("price.view_cost")).toBe(true);
    await expect(saveQuotation(pricing, payload())).rejects.toThrow(/cannot create/i);
  });
});
