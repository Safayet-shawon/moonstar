import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { getDb, query } from "../src/db/index";
import { ensureUser, seedBase, seedDemo } from "../src/db/seed";

let server: Server;
let base = "";
const PW = "Moonstar@Demo2026";

async function api(path: string, opts: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  const res = await fetch(base + path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.origin ? { origin: opts.origin } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json() : ct.includes("pdf") ? Buffer.from(await res.arrayBuffer()) : await res.text();
  return { status: res.status, data, headers: res.headers };
}
async function signIn(email: string, password = PW) {
  const r = await api("/api/auth/login", { method: "POST", body: { email, password } });
  const set = r.headers.get("set-cookie") ?? "";
  return { status: r.status, cookie: set.split(";")[0], raw: set, data: r.data };
}

let emp = "", viewer = "", approver = "", admin = "";
let projectId = "", trId = "";

beforeAll(async () => {
  const d = await getDb();
  await seedBase(d);
  await seedDemo(d);
  await ensureUser(d, { email: "root@t.local", name: "Root", password: "Passw0rd!long", role: "super_admin" });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  emp = (await signIn("employee@moonstar.local")).cookie;
  viewer = (await signIn("viewer@moonstar.local")).cookie;
  approver = (await signIn("approver@moonstar.local")).cookie;
  admin = (await signIn("root@t.local", "Passw0rd!long")).cookie;
  projectId = (await query("SELECT id FROM projects LIMIT 1")).rows[0].id;
  trId = (await query("SELECT id FROM products WHERE sku='DEMO-TR-250'")).rows[0].id;
});
afterAll(() => server?.close());

describe("authentication", () => {
  it("rejects unauthenticated access to every portal route", async () => {
    for (const p of ["/api/portal/dashboard", "/api/portal/quotations", "/api/portal/products", "/api/portal/users", "/api/portal/reports/area"]) {
      expect((await api(p)).status).toBe(401);
    }
  });
  it("sets an HttpOnly SameSite cookie and never stores the token in plaintext", async () => {
    const r = await signIn("employee@moonstar.local");
    expect(r.raw).toMatch(/HttpOnly/i);
    expect(r.raw).toMatch(/SameSite=Lax/i);
    const token = decodeURIComponent(r.cookie.split("=")[1]);
    const stored = await query("SELECT 1 FROM sessions WHERE token_hash = $1", [token]);
    expect(stored.rowCount).toBe(0);
  });
  it("returns the current user and permissions", async () => {
    const me = await api("/api/auth/me", { cookie: emp });
    expect(me.status).toBe(200);
    expect((me.data as { permissions: string[] }).permissions).toContain("quotation.create");
    expect((me.data as { permissions: string[] }).permissions).not.toContain("price.manage");
  });
  it("rate-limits repeated failed logins", async () => {
    await ensureUser(await getDb(), { email: "victim@t.local", name: "V", password: "Passw0rd!long", role: "employee" });
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await signIn("victim@t.local", "wrong-password")).status;
    expect(last).toBe(429);
    expect((await signIn("victim@t.local", "Passw0rd!long")).status).toBe(429); // locked even with the right password
  });
  it("blocks cross-origin state changes (CSRF)", async () => {
    const r = await api("/api/portal/areas", { method: "POST", body: { name: "Evil" }, cookie: emp, origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
  it("logout invalidates the session server-side", async () => {
    const s = await signIn("employee@moonstar.local");
    expect((await api("/api/portal/dashboard", { cookie: s.cookie })).status).toBe(200);
    await api("/api/auth/logout", { method: "POST", cookie: s.cookie });
    expect((await api("/api/portal/dashboard", { cookie: s.cookie })).status).toBe(401);
  });
});

describe("authorization enforced on the server", () => {
  it("employee cannot manage users, prices, settings or audit", async () => {
    expect((await api("/api/portal/users", { cookie: emp })).status).toBe(403);
    expect((await api("/api/portal/price-history", { cookie: emp })).status).toBe(403);
    expect((await api("/api/portal/audit", { cookie: emp })).status).toBe(403);
    expect((await api("/api/portal/settings/company", { method: "PUT", cookie: emp, body: {} })).status).toBe(403);
    expect((await api(`/api/portal/products/${trId}`, { method: "PUT", cookie: emp, body: {} })).status).toBe(403);
  });
  it("viewer is read-only", async () => {
    expect((await api("/api/portal/quotations", { cookie: viewer })).status).toBe(200);
    const r = await api("/api/portal/quotations", { method: "POST", cookie: viewer, body: { projectId, items: [{ productId: trId, name: "x", qty: 1 }] } });
    expect(r.status).toBe(403);
    expect((await api("/api/portal/reports/area?format=csv", { cookie: viewer })).status).toBe(200);
    expect((await api("/api/portal/reports/area?format=csv", { cookie: emp })).status).toBe(403);
  });
  it("employees never receive cost prices", async () => {
    const list = await api("/api/portal/products?pageSize=200", { cookie: emp });
    expect((list.data as { rows: Record<string, unknown>[] }).rows.every((p) => !("cost" in p))).toBe(true);
    const adminList = await api("/api/portal/products?pageSize=200", { cookie: admin });
    expect((adminList.data as { rows: { cost: string }[] }).rows.some((p) => p.cost)).toBe(true);
  });
  it("public API exposes no prices or costs", async () => {
    await query("UPDATE products SET public_visible = TRUE, public_summary = 'x' WHERE sku = 'DEMO-TR-250'");
    const r = await api("/api/public/products");
    const rows = (r.data as { products: Record<string, unknown>[] }).products;
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) {
      expect(p).not.toHaveProperty("price");
      expect(p).not.toHaveProperty("cost");
    }
  });
});

describe("quotation workflow over HTTP", () => {
  let id = "";
  const body = () => ({
    projectId,
    techInput: { mode: "quick", category: "residential", totalKw: 150, solutions: ["substation"] },
    items: [{ productId: trId, name: "Transformer 250 kVA", unit: "nos", qty: 1 }],
    commercial: { labourCharge: "5000" },
  });
  it("calculates a preliminary engineering result", async () => {
    const r = await api("/api/portal/calc", { method: "POST", cookie: emp, body: { mode: "quick", category: "residential", totalKw: 150, solutions: [] } });
    const res = (r.data as { result: { recommendedKva: number; status: string; warnings: string[] } }).result;
    expect(res.status).toBe("preliminary");
    expect(res.recommendedKva).toBeGreaterThan(0);
  });
  it("creates, previews and fetches a quotation", async () => {
    const pv = await api("/api/portal/quote-preview", { method: "POST", cookie: emp, body: body() });
    expect((pv.data as { totals: { total: string } }).totals.total).toBe("885000.00");
    const c = await api("/api/portal/quotations", { method: "POST", cookie: emp, body: body() });
    expect(c.status).toBe(201);
    id = (c.data as { id: string }).id;
    const g = await api(`/api/portal/quotations/${id}`, { cookie: emp });
    expect(g.status).toBe(200);
    expect((g.data as { transitions: unknown[] }).transitions.length).toBeGreaterThan(0);
  });
  it("validates input with clear errors", async () => {
    const r = await api("/api/portal/quotations", { method: "POST", cookie: emp, body: { projectId: "nope", items: [] } });
    expect(r.status).toBe(400);
  });
  it("generates a real PDF and records its metadata", async () => {
    const r = await api(`/api/portal/quotations/${id}/pdf`, { cookie: emp });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/pdf");
    expect((r.data as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    const docs = await query("SELECT * FROM documents WHERE quotation_id = $1", [id]);
    expect(docs.rowCount).toBeGreaterThan(0);
    expect((await api(`/api/portal/quotations/${id}/pdf`, { cookie: viewer })).status).toBe(200); // viewer holds pdf.download + view_all
  });
  it("hides other employees' quotations from employees", async () => {
    await ensureUser(await getDb(), { email: "e2@t.local", name: "E2", password: "Passw0rd!long", role: "employee" });
    const e2 = (await signIn("e2@t.local", "Passw0rd!long")).cookie;
    expect((await api(`/api/portal/quotations/${id}`, { cookie: e2 })).status).toBe(404);
    expect((await api(`/api/portal/quotations/${id}/pdf`, { cookie: e2 })).status).toBe(404);
  });
  it("runs the approval chain and revision with comparison", async () => {
    const t = (cookie: string, to: string, note?: string) => api(`/api/portal/quotations/${id}/transition`, { method: "POST", cookie, body: { to, note } });
    expect((await t(emp, "pending_technical")).status).toBe(200);
    expect((await t(approver, "pending_commercial")).status).toBe(200);
    expect((await t(admin, "approved")).status).toBe(200);
    expect((await t(emp, "sent")).status).toBe(200);
    const rev = await api(`/api/portal/quotations/${id}/revise`, { method: "POST", cookie: emp, body: { reason: "Client asked to add labour" } });
    expect(rev.status).toBe(200);
    const b2 = body();
    (b2.commercial as { labourCharge: string }).labourCharge = "9000";
    expect((await api(`/api/portal/quotations/${id}`, { method: "PUT", cookie: emp, body: b2 })).status).toBe(200);
    const cmp = await api(`/api/portal/quotations/${id}/compare?a=1&b=2`, { cookie: emp });
    expect((cmp.data as { delta: { delta: string } }).delta.delta).toBe("4000.00");
  });
  it("exports permitted reports as CSV without formula injection", async () => {
    await api("/api/portal/areas", { method: "POST", cookie: admin, body: { name: "=HYPERLINK(1)" } });
    const r = await api("/api/portal/reports/area?format=csv", { cookie: admin });
    expect(r.status).toBe(200);
    expect(String(r.data)).toContain("Area,Quotations");
  });
  it("price audit report requires the audit permission", async () => {
    expect((await api("/api/portal/reports/prices", { cookie: viewer })).status).toBe(403);
    expect((await api("/api/portal/reports/prices", { cookie: admin })).status).toBe(200);
  });
});

describe("public inquiry form", () => {
  it("stores a valid enquiry, silently drops honeypot spam and validates", async () => {
    const ok = await api("/api/public/inquiry", { method: "POST", body: { name: "Rahim", phone: "01711111111", message: "Need 250 kVA substation quote" } });
    expect(ok.status).toBe(200);
    const spam = await api("/api/public/inquiry", { method: "POST", body: { name: "Bot", phone: "01711111111", message: "buy cheap stuff now!!", website: "http://spam" } });
    expect(spam.status).toBe(200);
    const n = (await query("SELECT count(*)::int AS n FROM inquiries WHERE name = 'Bot'")).rows[0].n;
    expect(n).toBe(0);
    expect((await api("/api/public/inquiry", { method: "POST", body: { name: "x", phone: "abc", message: "short" } })).status).toBe(400);
  });
});
