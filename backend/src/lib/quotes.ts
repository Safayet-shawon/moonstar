import { z } from "zod";
import { query, tx, type Queryable, type Row } from "../db/index";
import { HttpError, type Session } from "./auth";
import { audit, getRules, getSetting, getWorkflow, todayIn, type CompanySettings, type TemplateSettings } from "./server";
import { calculateLoad, rowsFromTotal, type LoadResult } from "@moonstar/shared";
import { computeTotals, type ItemInput } from "@moonstar/shared";
import { fromBp, fromMilli, fromPaisa } from "@moonstar/shared";
import { DEFAULT_WORKFLOW } from "@moonstar/shared";

/* ------------------------------- input schema ------------------------------- */
const num = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const discType = z.enum(["none", "percent", "fixed"]).default("none");

export const itemSchema = z.object({
  productId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).nullish(),
  unit: z.string().trim().min(1).max(20).default("nos"),
  qty: num,
  unitPrice: num.optional(),
  discountType: discType,
  discountValue: num.default("0"),
  manual: z.boolean().optional(),
});

export const techInputSchema = z
  .object({
    mode: z.enum(["quick", "detailed"]).default("quick"),
    category: z.string().max(40).default("residential"),
    totalKw: z.coerce.number().min(0).max(100000).optional(),
    pf: z.coerce.number().min(0.3).max(1).optional(),
    demandFactor: z.coerce.number().min(0.05).max(1).optional(),
    rows: z
      .array(z.object({ name: z.string().max(120), kw: z.coerce.number().min(0), qty: z.coerce.number().min(0).optional(), pf: z.coerce.number().min(0.3).max(1), demandFactor: z.coerce.number().min(0.05).max(1) }))
      .max(60)
      .optional(),
    diversityFactor: z.coerce.number().min(0.05).max(1).optional(),
    expansionPct: z.coerce.number().min(0).max(200).optional(),
    targetPf: z.coerce.number().min(0.5).max(1).optional(),
    includePfCorrection: z.boolean().optional(),
    solutions: z.array(z.string()).max(12).default([]),
    systemVoltage: z.string().max(40).optional(),
    substation: z.enum(["new", "existing", "na"]).optional(),
    transformerArrangement: z.string().max(200).optional(),
    notes: z.string().max(4000).optional(),
    extras: z.record(z.string(), z.string().max(500)).optional(),
  })
  .passthrough();

export const quotationInput = z.object({
  projectId: z.string().uuid(),
  techInput: techInputSchema.default({ mode: "quick", category: "residential", solutions: [] }),
  override: z.object({ recommendedKva: z.coerce.number().positive(), units: z.coerce.number().int().min(1).max(8).default(1), reason: z.string().trim().min(10).max(1000) }).nullish(),
  items: z.array(itemSchema).min(1, "Add at least one line item").max(200),
  commercial: z
    .object({
      discountType: discType,
      discountValue: num.default("0"),
      labourCharge: num.default("0"),
      transportCharge: num.default("0"),
      otherCharge: num.default("0"),
      taxPercent: num.default("0"),
      validityDays: z.coerce.number().int().min(1).max(365).optional(),
      paymentTerms: z.string().max(2000).optional(),
      notes: z.string().max(3000).optional(),
    })
    .default({ discountType: "none", discountValue: "0", labourCharge: "0", transportCharge: "0", otherCharge: "0", taxPercent: "0" }),
  reason: z.string().trim().max(1000).optional(),
});
export type QuotationInput = z.infer<typeof quotationInput>;

/* --------------------------------- numbering -------------------------------- */
export async function nextQuotationNumber(q: Queryable, year: number, prefix = "Q") {
  const r = await q.query<{ n: number }>(
    `INSERT INTO quote_counters(year, n) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET n = quote_counters.n + 1 RETURNING n`,
    [year],
  );
  return `${prefix}-${year}-${String(r.rows[0].n).padStart(3, "0")}`;
}

/* ---------------------------------- access ---------------------------------- */
export function canSee(s: Session, createdBy: string) {
  return s.can("quotation.view_all") || (s.can("quotation.view_own") && createdBy === s.user.id);
}

export async function loadQuotationRow(id: string) {
  const r = await query(
    `SELECT q.*, p.name AS project_name, p.client_name, p.id AS pid, a.name AS area_name, h.name AS housing_name,
            u.name AS creator_name
       FROM quotations q JOIN projects p ON p.id = q.project_id JOIN areas a ON a.id = p.area_id
       LEFT JOIN housings h ON h.id = p.housing_id JOIN users u ON u.id = q.created_by WHERE q.id = $1`,
    [id],
  );
  return r.rows[0] as Row | undefined;
}

export async function assertAccess(s: Session, id: string) {
  const q = await loadQuotationRow(id);
  if (!q || !canSee(s, q.created_by)) throw new HttpError(404, "Quotation not found");
  return q;
}

/* ------------------------------ engineering step ----------------------------- */
export async function computeTech(techInput: QuotationInput["techInput"]): Promise<LoadResult | null> {
  const rules = await getRules();
  let rows = techInput.rows?.filter((r) => r.kw > 0);
  if (techInput.mode === "quick" || !rows?.length) {
    if (!techInput.totalKw) return null;
    rows = rowsFromTotal(techInput.totalKw, techInput.category, techInput.pf, techInput.demandFactor, rules);
  }
  return calculateLoad(
    { rows: rows!, diversityFactor: techInput.diversityFactor, expansionPct: techInput.expansionPct, targetPf: techInput.targetPf, includePfCorrection: techInput.includePfCorrection },
    rules,
  );
}

/* ---------------------------- authoritative pricing --------------------------- */
async function resolveItems(s: Session, items: QuotationInput["items"]) {
  const wf = await getWorkflow();
  const ids = items.map((i) => i.productId).filter(Boolean) as string[];
  const products = ids.length
    ? (await query("SELECT * FROM products WHERE id = ANY($1::uuid[])", [ids])).rows
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const canManual = s.can("quotation.manual_price");
  const canDiscount = s.can("quotation.discount") || s.can("quotation.discount_unlimited");
  const out: (ItemInput & { sku: string | null; productId: string | null })[] = [];
  for (const it of items) {
    const p = it.productId ? byId.get(it.productId) : null;
    if (it.productId && !p) throw new Error(`Product not found for "${it.name}"`);
    if (p && !p.active) throw new Error(`Product ${p.sku} is inactive and cannot be quoted`);
    let unitPrice: string;
    let manual = false;
    if (p) {
      unitPrice = p.price;
      if (it.unitPrice !== undefined && Number(it.unitPrice) !== Number(p.price)) {
        if (!canManual) throw new Error(`You are not permitted to change the catalogue price of ${p.sku}`);
        unitPrice = it.unitPrice;
        manual = true;
      }
    } else {
      if (!canManual) throw new Error("Custom (non-catalogue) line items require the manual-price permission");
      if (it.unitPrice === undefined) throw new Error(`Enter a price for "${it.name}"`);
      unitPrice = it.unitPrice;
      manual = true;
    }
    if (it.discountType !== "none" && Number(it.discountValue) !== 0 && !canDiscount) throw new Error("You are not permitted to apply discounts");
    out.push({
      productId: p?.id ?? null, sku: p?.sku ?? null, name: it.name, description: it.description ?? null, unit: it.unit || p?.unit || "nos",
      qty: it.qty, unitPrice, costPrice: p?.cost ?? null, discountType: it.discountType, discountValue: it.discountValue, isManualPrice: manual,
    });
  }
  return { items: out, wf };
}

/* --------------------------------- save draft -------------------------------- */
export async function saveQuotation(s: Session, input: QuotationInput, quotationId?: string) {
  if (quotationId) {
    if (!s.can("quotation.edit") && !s.can("quotation.create")) throw new HttpError(403, "You cannot edit quotations");
  } else if (!s.can("quotation.create")) throw new HttpError(403, "You cannot create quotations");

  const project = (await query("SELECT * FROM projects WHERE id = $1", [input.projectId])).rows[0];
  if (!project) throw new Error("Project not found");
  if (!s.can("project.view")) throw new HttpError(403, "No access to projects");

  const { items, wf } = await resolveItems(s, input.items);
  const totals = computeTotals(items, {
    discountType: input.commercial.discountType,
    discountValue: input.commercial.discountValue,
    labourCharge: input.commercial.labourCharge,
    transportCharge: input.commercial.transportCharge,
    otherCharge: input.commercial.otherCharge,
    taxPercent: input.commercial.taxPercent,
    minMarginPercent: String(wf.minMarginPct ?? DEFAULT_WORKFLOW.minMarginPct),
  });

  const exceptionalDiscount = Number(fromBp(totals.discountRatioBp)) > (wf.discountApprovalPct ?? 10);
  if (exceptionalDiscount && !s.can("quotation.discount_unlimited") && !s.can("quotation.discount")) {
    throw new Error("Discount exceeds the permitted limit");
  }

  const tech = await computeTech(input.techInput);
  let override: Row | null = null;
  if (input.override) {
    if (!s.can("quotation.override_technical")) throw new HttpError(403, "Only an authorised engineer can override the recommendation");
    override = { ...input.override, by: s.user.name, byId: s.user.id, at: new Date().toISOString(), originalKva: tech?.recommendedKva ?? null };
  }

  const company = await getSetting<CompanySettings>("company", {} as CompanySettings);
  const template = await getSetting<TemplateSettings>("template", {} as TemplateSettings);
  const tz = company.timezone || "Asia/Dhaka";
  const date = todayIn(tz);
  const year = Number(date.slice(0, 4));

  const flags = {
    exceptionalDiscount,
    marginWarning: totals.marginWarning,
    marginPct: totals.marginBp === null ? null : fromBp(totals.marginBp),
    notes: input.commercial.notes ?? null,
  };
  const commercial = { ...input.commercial, ...flags };
  const terms = {
    header: template.header, footer: template.footer, terms: template.terms ?? [],
    validityDays: input.commercial.validityDays ?? template.validityDays ?? 30,
    paymentTerms: input.commercial.paymentTerms ?? template.paymentTerms ?? "",
    taxLabel: (await getSetting<{ taxLabel?: string }>("pricing", {})).taxLabel ?? "Tax",
  };
  const signatory = s.user.isSignatory
    ? { name: s.user.name, title: s.user.signatoryTitle || s.user.designation || template.signatoryTitle, authorised: true }
    : { name: template.signatoryName || null, title: template.signatoryTitle || "Authorised Signatory", authorised: Boolean(template.signatoryName) };
  const client = {
    area: (await query("SELECT name FROM areas WHERE id = $1", [project.area_id])).rows[0]?.name,
    housing: project.housing_id ? (await query("SELECT name FROM housings WHERE id = $1", [project.housing_id])).rows[0]?.name : null,
    projectName: project.name, clientName: project.client_name, houseNo: project.house_no, roadNo: project.road_no, block: project.block,
    address: project.address, engineerName: project.engineer_name, engineerPhone: project.engineer_phone, totalLoadKw: project.total_load_kw,
  };
  const preparedBy = { name: s.user.name, designation: s.user.designation, phone: s.user.phone, email: s.user.email };
  const chargesTotal = totals.labour + totals.transport + totals.other;
  const discountTotal = totals.itemDiscounts + totals.quotationDiscount;

  return tx(async (c) => {
    let qid = quotationId;
    let version = 1;
    let number: string;
    let versionId: string;
    if (!qid) {
      number = await nextQuotationNumber(c, year, template.quotePrefix || "Q");
      const r = await c.query<{ id: string }>(
        `INSERT INTO quotations(number, project_id, created_by, status, current_version) VALUES ($1,$2,$3,'draft',1) RETURNING id`,
        [number, input.projectId, s.user.id],
      );
      qid = r.rows[0].id;
    } else {
      const cur = (await c.query("SELECT * FROM quotations WHERE id = $1 FOR UPDATE", [qid])).rows[0];
      if (!cur || !canSee(s, cur.created_by)) throw new HttpError(404, "Quotation not found");
      if (cur.status !== "draft") throw new Error("Only draft quotations can be edited. Use Revise to create a new version.");
      if (cur.project_id !== input.projectId) throw new Error("The project of an existing quotation cannot be changed");
      number = cur.number;
      version = cur.current_version;
    }
    const vals = [
      date, s.user.id, JSON.stringify(preparedBy), input.reason ?? null, JSON.stringify(input.techInput), tech ? JSON.stringify(tech) : null,
      override ? JSON.stringify(override) : null, JSON.stringify(commercial), JSON.stringify(terms), JSON.stringify(signatory), JSON.stringify(client),
      fromPaisa(totals.subtotal), fromPaisa(discountTotal), fromPaisa(chargesTotal), fromPaisa(totals.tax), fromPaisa(totals.total),
      totals.totalCost === null ? null : fromPaisa(totals.totalCost),
    ];
    const existing = quotationId
      ? (await c.query("SELECT id FROM quotation_versions WHERE quotation_id = $1 AND version = $2", [qid, version])).rows[0]
      : null;
    if (existing) {
      versionId = existing.id;
      await c.query(
        `UPDATE quotation_versions SET quotation_date=$1, created_by=$2, prepared_by=$3, reason=$4, tech_input=$5, tech_result=$6, tech_override=$7,
           commercial=$8, terms=$9, signatory=$10, client=$11, subtotal=$12, discount_total=$13, charges_total=$14, tax_total=$15, total=$16, cost_total=$17 WHERE id=$18`,
        [...vals, versionId],
      );
      await c.query("DELETE FROM quotation_items WHERE version_id = $1", [versionId]);
    } else {
      const r = await c.query<{ id: string }>(
        `INSERT INTO quotation_versions(quotation_id, version, quotation_date, created_by, prepared_by, reason, tech_input, tech_result, tech_override,
           commercial, terms, signatory, client, subtotal, discount_total, charges_total, tax_total, total, cost_total)
         VALUES ($18,$19,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [...vals, qid, version],
      );
      versionId = r.rows[0].id;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = totals.items[i];
      await c.query(
        `INSERT INTO quotation_items(version_id, position, product_id, sku, name, description, unit, qty, unit_price, cost_price, discount_type, discount_value, line_total, is_manual)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [versionId, i + 1, it.productId, it.sku, it.name, it.description ?? null, it.unit, fromMilli(p.qtyMilli), fromPaisa(p.unit), it.costPrice ?? null,
         it.discountType ?? "none", it.discountType === "none" ? "0" : String(it.discountValue ?? "0"), fromPaisa(p.net), Boolean(it.isManualPrice)],
      );
    }
    await c.query("UPDATE quotations SET updated_at = now() WHERE id = $1", [qid]);
    await audit(s, quotationId ? "quotation.update" : "quotation.create", "quotation", qid!, { number, version, total: fromPaisa(totals.total), exceptionalDiscount }, c);
    return { id: qid!, number, version, total: fromPaisa(totals.total), warnings: { exceptionalDiscount, marginWarning: totals.marginWarning } };
  });
}

/* ------------------------------------ revise ----------------------------------- */
export async function reviseQuotation(s: Session, id: string, reason: string) {
  if (!s.can("quotation.revise")) throw new HttpError(403, "You cannot revise quotations");
  if (reason.trim().length < 5) throw new Error("A reason for revision is required");
  const q = await assertAccess(s, id);
  if (q.status === "draft") throw new Error("This quotation is still a draft — edit it directly");
  if (q.status.startsWith("pending")) throw new Error("Wait for the approval decision or have it returned before revising");
  const company = await getSetting<CompanySettings>("company", {} as CompanySettings);
  const date = todayIn(company.timezone || "Asia/Dhaka");
  return tx(async (c) => {
    const cur = (await c.query("SELECT * FROM quotations WHERE id = $1 FOR UPDATE", [id])).rows[0];
    const prev = (await c.query("SELECT * FROM quotation_versions WHERE quotation_id = $1 AND version = $2", [id, cur.current_version])).rows[0];
    const nv = cur.current_version + 1;
    const r = await c.query<{ id: string }>(
      `INSERT INTO quotation_versions(quotation_id, version, quotation_date, created_by, prepared_by, reason, tech_input, tech_result, tech_override,
         commercial, terms, signatory, client, subtotal, discount_total, charges_total, tax_total, total, cost_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [id, nv, date, s.user.id, JSON.stringify({ name: s.user.name, designation: s.user.designation, phone: s.user.phone, email: s.user.email }), reason,
       JSON.stringify(prev.tech_input), prev.tech_result ? JSON.stringify(prev.tech_result) : null, prev.tech_override ? JSON.stringify(prev.tech_override) : null,
       JSON.stringify(prev.commercial), JSON.stringify(prev.terms), prev.signatory ? JSON.stringify(prev.signatory) : null, JSON.stringify(prev.client),
       prev.subtotal, prev.discount_total, prev.charges_total, prev.tax_total, prev.total, prev.cost_total],
    );
    await c.query(
      `INSERT INTO quotation_items(version_id, position, product_id, sku, name, description, unit, qty, unit_price, cost_price, discount_type, discount_value, line_total, is_manual)
       SELECT $1, position, product_id, sku, name, description, unit, qty, unit_price, cost_price, discount_type, discount_value, line_total, is_manual
         FROM quotation_items WHERE version_id = $2`,
      [r.rows[0].id, prev.id],
    );
    await c.query("UPDATE quotations SET current_version = $2, status = 'draft', updated_at = now() WHERE id = $1", [id, nv]);
    await audit(s, "quotation.revise", "quotation", id, { number: cur.number, from: cur.current_version, to: nv, reason }, c);
    return { id, version: nv };
  });
}

/* -------------------------------- transitions --------------------------------- */
export async function availableTransitions(s: Session, status: string) {
  const wf = await getWorkflow();
  return (wf.transitions[status] ?? []).filter((t) => !t.perm || s.can(t.perm));
}

export async function transitionQuotation(s: Session, id: string, to: string, note?: string) {
  const q = await assertAccess(s, id);
  const wf = await getWorkflow();
  const t = (wf.transitions[q.status] ?? []).find((x) => x.to === to);
  if (!t) throw new Error(`Transition ${q.status} → ${to} is not allowed`);
  if (t.perm && !s.can(t.perm)) throw new HttpError(403, "You do not have permission for this step");
  const returning = to === "draft" || to === "rejected";
  if (returning && (!note || note.trim().length < 5)) throw new Error("A note is required when returning or rejecting");
  return tx(async (c) => {
    const cur = (await c.query("SELECT * FROM quotations WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (cur.status !== q.status) throw new Error("The quotation status changed — refresh and retry");
    const v = (await c.query("SELECT id, total FROM quotation_versions WHERE quotation_id = $1 AND version = $2", [id, cur.current_version])).rows[0];
    const items = await c.query("SELECT count(*)::int AS n FROM quotation_items WHERE version_id = $1", [v.id]);
    if (cur.status === "draft" && items.rows[0].n === 0) throw new Error("Add at least one line item before submitting");
    const kind = cur.status === "pending_technical" ? "technical" : cur.status === "pending_commercial" ? "commercial" : null;
    if (kind) {
      const decision = to === "draft" ? "returned" : to === "rejected" ? "rejected" : "approved";
      await c.query(
        `INSERT INTO approvals(quotation_id, version, kind, decision, note, decided_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, cur.current_version, kind, decision, note ?? null, s.user.id],
      );
    }
    if (wf.lockOn.includes(to)) await c.query("UPDATE quotation_versions SET locked = TRUE WHERE id = $1 AND locked = FALSE", [v.id]);
    const approvedVersion = to === "approved" ? cur.current_version : cur.approved_version;
    await c.query("UPDATE quotations SET status = $2, approved_version = $3, updated_at = now() WHERE id = $1", [id, to, approvedVersion]);
    await audit(s, "quotation.status", "quotation", id, { number: cur.number, from: cur.status, to, note: note ?? null, version: cur.current_version }, c);
    return { status: to };
  });
}

/* ---------------------------------- queries ----------------------------------- */
export type QuotationFilters = {
  q?: string; status?: string; from?: string; to?: string; creator?: string; area?: string; housing?: string; project?: string; page?: number; pageSize?: number;
  revisedOnly?: boolean;
};

export function buildQuotationWhere(s: Session, f: QuotationFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  if (!s.can("quotation.view_all")) where.push(`q.created_by = ${p(s.user.id)}`);
  if (f.q?.trim()) {
    const like = `%${f.q.trim().toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
    const ph = p(like);
    where.push(`(lower(q.number) LIKE ${ph} OR lower(pr.name) LIKE ${ph} OR lower(coalesce(pr.client_name,'')) LIKE ${ph} OR lower(a.name) LIKE ${ph}
      OR lower(coalesce(h.name,'')) LIKE ${ph} OR lower(u.name) LIKE ${ph} OR lower(coalesce(pr.house_no,'')) LIKE ${ph} OR lower(coalesce(pr.road_no,'')) LIKE ${ph})`);
  }
  if (f.status) where.push(`q.status = ${p(f.status)}`);
  if (f.creator) where.push(`q.created_by = ${p(f.creator)}`);
  if (f.area) where.push(`pr.area_id = ${p(f.area)}`);
  if (f.housing) where.push(`pr.housing_id = ${p(f.housing)}`);
  if (f.project) where.push(`q.project_id = ${p(f.project)}`);
  if (f.from) where.push(`q.created_at >= ${p(f.from)}::date`);
  if (f.to) where.push(`q.created_at < (${p(f.to)}::date + 1)`);
  if (f.revisedOnly) where.push(`q.current_version > 1`);
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listQuotations(s: Session, f: QuotationFilters) {
  const { sql, params } = buildQuotationWhere(s, f);
  const pageSize = Math.min(f.pageSize ?? 20, 200);
  const page = Math.max(f.page ?? 1, 1);
  const from = `FROM quotations q JOIN projects pr ON pr.id = q.project_id JOIN areas a ON a.id = pr.area_id
     LEFT JOIN housings h ON h.id = pr.housing_id JOIN users u ON u.id = q.created_by
     JOIN quotation_versions v ON v.quotation_id = q.id AND v.version = q.current_version ${sql}`;
  const total = (await query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, params)).rows[0].n;
  const rows = (
    await query(
      `SELECT q.id, q.number, q.status, q.current_version, q.created_at, q.updated_at, pr.name AS project_name, pr.client_name, a.name AS area_name,
              h.name AS housing_name, u.name AS creator_name, v.total, v.quotation_date
       ${from} ORDER BY q.created_at DESC, q.number DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    )
  ).rows;
  return { rows, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getQuotationFull(s: Session, id: string) {
  const q = await assertAccess(s, id);
  const showCost = s.can("quotation.view_cost");
  const versions = (await query("SELECT v.*, u.name AS author_name FROM quotation_versions v JOIN users u ON u.id = v.created_by WHERE quotation_id = $1 ORDER BY version DESC", [id])).rows;
  const items = (await query("SELECT i.*, v.version FROM quotation_items i JOIN quotation_versions v ON v.id = i.version_id WHERE v.quotation_id = $1 ORDER BY v.version, i.position", [id])).rows;
  const approvals = (await query("SELECT a.*, u.name AS by_name FROM approvals a JOIN users u ON u.id = a.decided_by WHERE quotation_id = $1 ORDER BY decided_at DESC", [id])).rows;
  const documents = (await query("SELECT d.*, u.name AS by_name FROM documents d LEFT JOIN users u ON u.id = d.generated_by WHERE quotation_id = $1 ORDER BY d.created_at DESC", [id])).rows;
  const workOrders = (await query("SELECT * FROM work_orders WHERE quotation_id = $1 ORDER BY created_at DESC", [id])).rows;
  const history = (await query("SELECT at, user_name, action, detail FROM audit_logs WHERE entity = 'quotation' AND entity_id = $1 ORDER BY at DESC LIMIT 100", [id])).rows;
  const strip = <T extends Row>(r: T) => {
    if (showCost) return r;
    const { cost_price: _c, cost_total: _t, ...rest } = r as Row; // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest as T;
  };
  return {
    quotation: q,
    versions: versions.map((v) => {
      const sv = strip(v);
      if (!showCost && sv.commercial) sv.commercial = { ...sv.commercial, marginPct: null, marginWarning: false };
      return sv;
    }),
    items: items.map(strip),
    approvals, documents, workOrders, history,
    showCost,
  };
}

/* --------------------------------- preview ---------------------------------- */
/** Live preview used by the quote builder. Same server-side engines as save; nothing is written. */
export async function previewQuotation(s: Session, input: QuotationInput) {
  if (!s.can("quotation.create") && !s.can("quotation.edit")) throw new HttpError(403, "Not permitted");
  const { items, wf } = await resolveItems(s, input.items);
  const totals = computeTotals(items, {
    discountType: input.commercial.discountType, discountValue: input.commercial.discountValue, labourCharge: input.commercial.labourCharge,
    transportCharge: input.commercial.transportCharge, otherCharge: input.commercial.otherCharge, taxPercent: input.commercial.taxPercent,
    minMarginPercent: String(wf.minMarginPct ?? DEFAULT_WORKFLOW.minMarginPct),
  });
  const showCost = s.can("quotation.view_cost");
  return {
    lines: items.map((it, i) => ({ sku: it.sku, name: it.name, unit: it.unit, qty: fromMilli(totals.items[i].qtyMilli), unitPrice: fromPaisa(totals.items[i].unit), discount: fromPaisa(totals.items[i].discount), lineTotal: fromPaisa(totals.items[i].net), manual: Boolean(it.isManualPrice) })),
    totals: {
      subtotal: fromPaisa(totals.subtotal), itemDiscounts: fromPaisa(totals.itemDiscounts), quotationDiscount: fromPaisa(totals.quotationDiscount),
      charges: fromPaisa(totals.labour + totals.transport + totals.other), tax: fromPaisa(totals.tax), total: fromPaisa(totals.total),
      marginPct: showCost && totals.marginBp !== null ? fromBp(totals.marginBp) : null,
      marginWarning: showCost ? totals.marginWarning : false,
      exceptionalDiscount: Number(fromBp(totals.discountRatioBp)) > (wf.discountApprovalPct ?? 10),
    },
  };
}
