import { query } from "../db/index";
import { HttpError, type Session } from "./auth";

export type ReportFilters = { from?: string; to?: string; page?: number; pageSize?: number; q?: string };
export type ReportResult = { title: string; columns: { key: string; label: string; money?: boolean; num?: boolean }[]; rows: Record<string, unknown>[]; total: number; page: number; pages: number };

export const REPORTS: Record<string, { title: string; perm?: "price.audit" }> = {
  area: { title: "Area-wise quotations" },
  housing: { title: "Housing-wise history" },
  project: { title: "Project-wise history" },
  employee: { title: "Employee-wise activity" },
  status: { title: "Quotation status summary" },
  outcome: { title: "Accepted vs rejected" },
  workorders: { title: "Work orders received" },
  value: { title: "Quotation value over time (monthly)" },
  prices: { title: "Price changes & audit history", perm: "price.audit" },
};

export async function runReport(s: Session, name: string, f: ReportFilters, forExport = false): Promise<ReportResult> {
  const def = REPORTS[name];
  if (!def) throw new HttpError(404, "Unknown report");
  if (!s.can("report.view")) throw new HttpError(403, "You cannot view reports");
  if (def.perm && !s.can(def.perm)) throw new HttpError(403, "You cannot view this report");
  if (forExport && !s.can("report.export")) throw new HttpError(403, "You cannot export reports");

  const size = forExport ? 5000 : Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(f.page ?? 1, 1);
  const off = (page - 1) * size;

  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  const where: string[] = [];
  // reports may never bypass quotation visibility
  if (!s.can("quotation.view_all")) where.push(`q.created_by = ${p(s.user.id)}`);
  if (f.from) where.push(`q.created_at >= ${p(f.from)}::date`);
  if (f.to) where.push(`q.created_at < (${p(f.to)}::date + 1)`);
  const W = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM quotations q JOIN quotation_versions v ON v.quotation_id = q.id AND v.version = q.current_version
    JOIN projects pr ON pr.id = q.project_id JOIN areas a ON a.id = pr.area_id LEFT JOIN housings h ON h.id = pr.housing_id JOIN users u ON u.id = q.created_by`;

  const paged = async (select: string, group: string, order: string, countExpr: string) => {
    const total = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM (SELECT ${countExpr} ${base} ${W} ${group}) t`, params)).rows[0].n;
    const rows = (await query(`SELECT ${select} ${base} ${W} ${group} ORDER BY ${order} LIMIT ${size} OFFSET ${off}`, params)).rows;
    return { rows, total };
  };
  const done = (title: string, columns: ReportResult["columns"], r: { rows: Record<string, unknown>[]; total: number }): ReportResult => ({
    title, columns, rows: r.rows, total: r.total, page, pages: Math.max(Math.ceil(r.total / size), 1),
  });

  switch (name) {
    case "area":
      return done(def.title, [{ key: "area", label: "Area" }, { key: "quotations", label: "Quotations", num: true }, { key: "value", label: "Total value (BDT)", money: true }, { key: "accepted", label: "Accepted", num: true }],
        await paged(`a.name AS area, count(*)::int AS quotations, coalesce(sum(v.total),0) AS value, count(*) FILTER (WHERE q.status='accepted')::int AS accepted`, "GROUP BY a.name", "value DESC", "a.name"));
    case "housing":
      return done(def.title, [{ key: "area", label: "Area" }, { key: "housing", label: "Housing" }, { key: "quotations", label: "Quotations", num: true }, { key: "value", label: "Total value (BDT)", money: true }],
        await paged(`a.name AS area, coalesce(h.name,'—') AS housing, count(*)::int AS quotations, coalesce(sum(v.total),0) AS value`, "GROUP BY a.name, h.name", "value DESC", "a.name, h.name"));
    case "project":
      return done(def.title, [{ key: "area", label: "Area" }, { key: "housing", label: "Housing" }, { key: "project", label: "Project" }, { key: "quotations", label: "Quotations", num: true }, { key: "revisions", label: "Revisions", num: true }, { key: "value", label: "Total value (BDT)", money: true }],
        await paged(`a.name AS area, coalesce(h.name,'—') AS housing, pr.name AS project, count(*)::int AS quotations, coalesce(sum(q.current_version - 1),0)::int AS revisions, coalesce(sum(v.total),0) AS value`, "GROUP BY pr.id, pr.name, a.name, h.name", "value DESC", "pr.id"));
    case "employee":
      return done(def.title, [{ key: "employee", label: "Employee" }, { key: "quotations", label: "Quotations", num: true }, { key: "drafts", label: "Drafts", num: true }, { key: "sent", label: "Sent", num: true }, { key: "accepted", label: "Accepted", num: true }, { key: "value", label: "Total value (BDT)", money: true }],
        await paged(`u.name AS employee, count(*)::int AS quotations, count(*) FILTER (WHERE q.status='draft')::int AS drafts, count(*) FILTER (WHERE q.status='sent')::int AS sent, count(*) FILTER (WHERE q.status='accepted')::int AS accepted, coalesce(sum(v.total),0) AS value`, "GROUP BY u.id, u.name", "quotations DESC", "u.id"));
    case "status":
      return done(def.title, [{ key: "status", label: "Status" }, { key: "quotations", label: "Quotations", num: true }, { key: "value", label: "Total value (BDT)", money: true }],
        await paged(`q.status AS status, count(*)::int AS quotations, coalesce(sum(v.total),0) AS value`, "GROUP BY q.status", "quotations DESC", "q.status"));
    case "outcome":
      return done(def.title, [{ key: "status", label: "Outcome" }, { key: "quotations", label: "Quotations", num: true }, { key: "value", label: "Total value (BDT)", money: true }],
        await paged(`q.status AS status, count(*)::int AS quotations, coalesce(sum(v.total),0) AS value`, "GROUP BY q.status HAVING q.status IN ('accepted','rejected')", "status", "q.status"));
    case "value":
      return done(def.title, [{ key: "month", label: "Month" }, { key: "quotations", label: "Quotations", num: true }, { key: "value", label: "Total value (BDT)", money: true }, { key: "accepted_value", label: "Accepted value (BDT)", money: true }],
        await paged(`to_char(date_trunc('month', q.created_at), 'YYYY-MM') AS month, count(*)::int AS quotations, coalesce(sum(v.total),0) AS value, coalesce(sum(v.total) FILTER (WHERE q.status='accepted'),0) AS accepted_value`, "GROUP BY 1", "month DESC", "1"));
    case "workorders": {
      const wp: unknown[] = [];
      const wq = (v: unknown) => (wp.push(v), `$${wp.length}`);
      const ww: string[] = [];
      if (!s.can("quotation.view_all")) ww.push(`q.created_by = ${wq(s.user.id)}`);
      if (f.from) ww.push(`w.received_date >= ${wq(f.from)}::date`);
      if (f.to) ww.push(`w.received_date <= ${wq(f.to)}::date`);
      const wW = ww.length ? `WHERE ${ww.join(" AND ")}` : "";
      const from = `FROM work_orders w JOIN quotations q ON q.id = w.quotation_id JOIN projects pr ON pr.id = q.project_id JOIN areas a ON a.id = pr.area_id ${wW}`;
      const total = (await query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, wp)).rows[0].n;
      const rows = (await query(`SELECT w.wo_number, w.received_date, q.number AS quotation, pr.name AS project, a.name AS area, w.final_value ${from} ORDER BY w.received_date DESC LIMIT ${size} OFFSET ${off}`, wp)).rows;
      return done(def.title, [{ key: "wo_number", label: "WO number" }, { key: "received_date", label: "Received" }, { key: "quotation", label: "Quotation" }, { key: "project", label: "Project" }, { key: "area", label: "Area" }, { key: "final_value", label: "Final value (BDT)", money: true }], { rows, total });
    }
    case "prices": {
      const pp: unknown[] = [];
      const pq = (v: unknown) => (pp.push(v), `$${pp.length}`);
      const pw: string[] = [];
      if (f.from) pw.push(`h.created_at >= ${pq(f.from)}::date`);
      if (f.to) pw.push(`h.created_at < (${pq(f.to)}::date + 1)`);
      const pW = pw.length ? `WHERE ${pw.join(" AND ")}` : "";
      const from = `FROM price_history h JOIN products pr ON pr.id = h.product_id LEFT JOIN users u ON u.id = h.changed_by ${pW}`;
      const total = (await query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, pp)).rows[0].n;
      const rows = (await query(`SELECT h.created_at AS changed_at, pr.sku, pr.name AS product, h.price, h.effective_from, coalesce(h.reason,'') AS reason, coalesce(u.name,'system') AS by ${from} ORDER BY h.created_at DESC, h.id DESC LIMIT ${size} OFFSET ${off}`, pp)).rows;
      return done(def.title, [{ key: "changed_at", label: "Changed" }, { key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "price", label: "Price (BDT)", money: true }, { key: "effective_from", label: "Effective" }, { key: "reason", label: "Reason" }, { key: "by", label: "By" }], { rows, total });
    }
  }
  throw new HttpError(404, "Unknown report");
}

const csvCell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(r: ReportResult) {
  const head = r.columns.map((c) => csvCell(c.label)).join(",");
  const body = r.rows.map((row) => r.columns.map((c) => csvCell(row[c.key])).join(","));
  return "﻿" + [head, ...body].join("\r\n");
}

export async function dashboardStats(s: Session) {
  const scope = s.can("quotation.view_all") ? "" : "WHERE created_by = $1";
  const params = s.can("quotation.view_all") ? [] : [s.user.id];
  const r = (
    await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status='draft')::int AS draft,
              count(*) FILTER (WHERE status LIKE 'pending%')::int AS pending,
              count(*) FILTER (WHERE status='sent')::int AS sent,
              count(*) FILTER (WHERE current_version > 1)::int AS revised,
              count(*) FILTER (WHERE status='accepted')::int AS accepted FROM quotations ${scope}`,
      params,
    )
  ).rows[0];
  const wo = (
    await query(
      s.can("quotation.view_all")
        ? "SELECT count(*)::int AS n FROM work_orders"
        : "SELECT count(*)::int AS n FROM work_orders w JOIN quotations q ON q.id = w.quotation_id WHERE q.created_by = $1",
      params,
    )
  ).rows[0].n;
  const recent = s.can("audit.view") || s.can("quotation.view_all")
    ? (await query("SELECT at, user_name, action, entity, entity_id, detail FROM audit_logs ORDER BY at DESC LIMIT 8")).rows
    : (await query("SELECT at, user_name, action, entity, entity_id, detail FROM audit_logs WHERE user_id = $1 ORDER BY at DESC LIMIT 8", [s.user.id])).rows;
  const projects = s.can("project.view")
    ? (await query(`SELECT pr.id, pr.name, pr.updated_at, a.name AS area_name FROM projects pr JOIN areas a ON a.id = pr.area_id ORDER BY pr.updated_at DESC LIMIT 6`)).rows
    : [];
  return { ...r, workOrders: wo, recent, projects };
}
