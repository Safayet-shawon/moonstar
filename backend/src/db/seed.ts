import bcrypt from "bcryptjs";
import type { Queryable } from "./index";
import { DEFAULT_WORKFLOW, PERMISSIONS, PRODUCT_CATEGORIES, ROLE_DEFS } from "@moonstar/shared";
import { DEFAULT_RULES } from "@moonstar/shared";
import { COMPANY } from "@moonstar/shared";

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  company: {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    phone: COMPANY.phone,
    email: COMPANY.email,
    website: COMPANY.website,
    hours: COMPANY.hours,
    factory: COMPANY.factory,
    branch: COMPANY.branch,
    khulna: COMPANY.khulna,
    approval: COMPANY.approval,
    timezone: "Asia/Dhaka",
    currency: "BDT",
  },
  template: {
    header: "Quotation for Electrical Power Equipment & Services",
    footer: "This quotation is computer generated. Subject to engineering review and final site conditions.",
    validityDays: 30,
    quotePrefix: "Q",
    paymentTerms: "To be agreed on acceptance. Typical structure: advance with work order, balance against delivery/commissioning.",
    terms: [
      "Prices are in Bangladeshi Taka (BDT) unless stated otherwise.",
      "This quotation is valid for the period stated above.",
      "Supply is subject to site conditions and approval by the relevant utility and authorities where applicable.",
      "Delivery, installation and commissioning schedule will be confirmed in the work order.",
      "Warranty and after-sales terms apply as agreed in writing.",
    ],
    signatoryName: "",
    signatoryTitle: "Authorised Signatory",
    showSignatureBlock: true,
  },
  workflow: DEFAULT_WORKFLOW,
  engineering_rules: DEFAULT_RULES,
  pricing: { taxPercent: 0, taxLabel: "VAT / Tax", defaultMarkupPercent: 0 },
};

/** Idempotent. Creates permissions, roles, categories and default settings. Safe to run on every deploy. */
export async function seedBase(q: Queryable) {
  for (const [key, grp, description] of PERMISSIONS) {
    await q.query(
      `INSERT INTO permissions(key, grp, description) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET grp = EXCLUDED.grp, description = EXCLUDED.description`,
      [key, grp, description],
    );
  }
  for (const r of ROLE_DEFS) {
    const res = await q.query<{ id: number }>(
      `INSERT INTO roles(key, name, description) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description RETURNING id`,
      [r.key, r.name, r.description],
    );
    const roleId = res.rows[0].id;
    const existing = await q.query("SELECT 1 FROM role_permissions WHERE role_id = $1 LIMIT 1", [roleId]);
    // Only set defaults for a brand-new role so admin edits are never overwritten. Super admin always gets everything.
    if (!existing.rowCount || r.key === "super_admin") {
      for (const p of r.perms) {
        await q.query(`INSERT INTO role_permissions(role_id, perm_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [roleId, p]);
      }
    }
  }
  let i = 0;
  for (const [key, name] of PRODUCT_CATEGORIES) {
    await q.query(
      `INSERT INTO product_categories(key, name, sort_order) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING`,
      [key, name, i++],
    );
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await q.query(`INSERT INTO settings(key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(value)]);
  }
}

export async function ensureUser(
  q: Queryable,
  u: { email: string; name: string; password: string; role: string; designation?: string; signatory?: boolean },
) {
  const role = await q.query<{ id: number }>("SELECT id FROM roles WHERE key = $1", [u.role]);
  if (!role.rowCount) throw new Error(`Unknown role ${u.role}`);
  const hash = await bcrypt.hash(u.password, 12);
  const r = await q.query<{ id: string }>(
    `INSERT INTO users(email, name, password_hash, role_id, designation, is_signatory)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (lower(email)) DO NOTHING RETURNING id`,
    [u.email.toLowerCase(), u.name, hash, role.rows[0].id, u.designation ?? null, u.signatory ?? false],
  );
  return r.rows[0]?.id ?? null;
}

/** Demo data — development/demonstration only. Prices are placeholders, NOT real prices. */
export async function seedDemo(q: Queryable) {
  const pw = process.env.SEED_DEMO_PASSWORD ?? "Moonstar@Demo2026";
  await ensureUser(q, { email: "employee@moonstar.local", name: "Demo Employee", password: pw, role: "employee", designation: "Sales Engineer" });
  await ensureUser(q, { email: "approver@moonstar.local", name: "Demo Technical Approver", password: pw, role: "technical_approver", designation: "Engineer" });
  await ensureUser(q, { email: "pricing@moonstar.local", name: "Demo Pricing Admin", password: pw, role: "pricing_admin", designation: "Pricing" });
  await ensureUser(q, { email: "viewer@moonstar.local", name: "Demo Management", password: pw, role: "viewer", designation: "Management" });

  const cats = Object.fromEntries(
    (await q.query<{ id: number; key: string }>("SELECT id, key FROM product_categories")).rows.map((c) => [c.key, c.id]),
  );
  const demo: [string, string, string, number, string, number | null, number | null][] = [
    // sku, name, category, price, unit, kva, kvar
    ["DEMO-TR-100", "[DEMO] Distribution Transformer 100 kVA, 11/0.4 kV", "transformer", 450000, "nos", 100, null],
    ["DEMO-TR-160", "[DEMO] Distribution Transformer 160 kVA, 11/0.4 kV", "transformer", 620000, "nos", 160, null],
    ["DEMO-TR-200", "[DEMO] Distribution Transformer 200 kVA, 11/0.4 kV", "transformer", 740000, "nos", 200, null],
    ["DEMO-TR-250", "[DEMO] Distribution Transformer 250 kVA, 11/0.4 kV", "transformer", 880000, "nos", 250, null],
    ["DEMO-TR-315", "[DEMO] Distribution Transformer 315 kVA, 11/0.4 kV", "transformer", 1050000, "nos", 315, null],
    ["DEMO-TR-400", "[DEMO] Distribution Transformer 400 kVA, 11/0.4 kV", "transformer", 1250000, "nos", 400, null],
    ["DEMO-TR-500", "[DEMO] Distribution Transformer 500 kVA, 11/0.4 kV", "transformer", 1500000, "nos", 500, null],
    ["DEMO-TR-630", "[DEMO] Distribution Transformer 630 kVA, 11/0.4 kV", "transformer", 1800000, "nos", 630, null],
    ["DEMO-HT-VCB", "[DEMO] HT Panel with VCB, 11 kV", "ht_switchgear", 650000, "nos", null, null],
    ["DEMO-LT-PANEL", "[DEMO] LT Main Distribution Panel (PCC)", "lt_panel", 400000, "nos", null, null],
    ["DEMO-PFI-100", "[DEMO] PFI Panel 100 kVAR automatic", "pfi_panel", 280000, "nos", null, 100],
    ["DEMO-PFI-150", "[DEMO] PFI Panel 150 kVAR automatic", "pfi_panel", 390000, "nos", null, 150],
    ["DEMO-CABLE-HT", "[DEMO] HT Cable 11 kV, per metre", "cable", 1800, "m", null, null],
    ["DEMO-LABOUR-INST", "[DEMO] Installation Labour (lump sum)", "labour", 120000, "lot", null, null],
    ["DEMO-TRANSPORT", "[DEMO] Transport & Delivery", "transport", 40000, "lot", null, null],
    ["DEMO-TESTING", "[DEMO] Testing & Commissioning", "testing", 60000, "lot", null, null],
  ];
  for (const [sku, name, cat, price, unit, kva, kvar] of demo) {
    const cost = Math.round(price * 0.85);
    const r = await q.query<{ id: string }>(
      `INSERT INTO products(sku, name, category_id, unit, price, cost, capacity_kva, capacity_kvar, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DEMO placeholder price — replace before real use')
       ON CONFLICT (upper(sku)) DO NOTHING RETURNING id`,
      [sku, name, cats[cat], unit, price, cost, kva, kvar],
    );
    if (r.rows[0]) {
      await q.query(`INSERT INTO price_history(product_id, price, cost, effective_from, reason) VALUES ($1,$2,$3,now(),'Initial demo price')`, [r.rows[0].id, price, cost]);
    }
  }
  const area = await q.query<{ id: string }>(
    `INSERT INTO areas(name) VALUES ('Mohammadpur [DEMO]') ON CONFLICT (lower(name)) DO UPDATE SET name = areas.name RETURNING id`,
  );
  const hs = await q.query<{ id: string }>(
    `INSERT INTO housings(area_id, name) VALUES ($1,'Housing A [DEMO]') ON CONFLICT (area_id, lower(name)) DO UPDATE SET name = housings.name RETURNING id`,
    [area.rows[0].id],
  );
  const exists = await q.query("SELECT 1 FROM projects WHERE name = 'Building Project 01 [DEMO]'");
  if (!exists.rowCount) {
    await q.query(
      `INSERT INTO projects(area_id, housing_id, name, house_no, road_no, block, client_name, engineer_name, engineer_phone, address, total_load_kw, category)
       VALUES ($1,$2,'Building Project 01 [DEMO]','12','3','B','Demo Developer Ltd','Demo Engineer','01700000000','Demo address, Dhaka',150,'residential')`,
      [area.rows[0].id, hs.rows[0].id],
    );
  }
}
