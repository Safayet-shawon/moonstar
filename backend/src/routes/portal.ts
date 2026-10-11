import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { diffItems, totalDelta, PERMISSIONS } from "@moonstar/shared";
import { route } from "../http";
import { HttpError, need, type Session } from "../lib/auth";
import { isUuid, getSetting, type CompanySettings } from "../lib/server";
import { query } from "../db/index";
import { memo } from "../lib/cache";
import {
  availableTransitions, computeTech, getQuotationFull, listQuotations, previewQuotation, quotationInput, reviseQuotation, saveQuotation, techInputSchema, transitionQuotation,
  buildQuotationWhere,
} from "../lib/quotes";
import { listProducts, priceHistory, productSchema, saveProduct } from "../lib/catalog";
import { CATEGORIES, createArea, createHousing, createProject, getProject, listAreas, listHousings, projectSchema, renameArea, renameHousing, searchProjects, updateProject } from "../lib/projects";
import { quotationPdf } from "../lib/pdf";
import { REPORTS, dashboardStats, runReport, toCsv } from "../lib/reports";
import {
  createUser, getAllSettings, getUserOverrides, listAudit, listInquiries, listRoles, listUsers, resetPassword, saveSetting, saveWorkOrder, setInquiryStatus, setRolePermissions,
  setUserOverrides, updateUser, userSchema, workOrderSchema,
} from "../lib/admin";

const S = (res: Response): Session => need(res.locals.session);
const uid = (req: Request, name = "id") => {
  const v = String(req.params[name]);
  if (!isUuid(v)) throw new HttpError(404, "Not found");
  return v;
};
const int = (v: unknown, d = 1) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function portalRoutes() {
  const r = Router();

  // everything below requires a valid server-side session
  r.use((_req, res, next) => {
    if (!res.locals.session) return void res.status(401).json({ error: "Not signed in" });
    next();
  });

  /* ------------------------------- dashboard ------------------------------- */
  r.get("/dashboard", route(async (_req, res) => {
    const s = S(res);
    res.json(await dashboardStats(s));
  }));

  /* ---------------------------- areas / housings ---------------------------- */
  r.get("/areas", route(async (_req, res) => {
    need(res.locals.session, "project.view");
    res.json({ areas: await listAreas() });
  }));
  r.post("/areas", route(async (req, res) => {
    const s = S(res);
    const { name } = z.object({ name: z.string().min(2).max(120) }).parse(req.body);
    res.json({ id: await createArea(s, name) });
  }));
  r.patch("/areas/:id", route(async (req, res) => {
    const s = S(res);
    const { name } = z.object({ name: z.string().min(2).max(120) }).parse(req.body);
    await renameArea(s, uid(req), name);
    res.json({ ok: true });
  }));
  r.get("/housings", route(async (req, res) => {
    need(res.locals.session, "project.view");
    const area = qs(req.query.areaId);
    res.json({ housings: await listHousings(area && isUuid(area) ? area : undefined) });
  }));
  r.post("/housings", route(async (req, res) => {
    const s = S(res);
    const b = z.object({ areaId: z.string().uuid(), name: z.string().min(2).max(120) }).parse(req.body);
    res.json({ id: await createHousing(s, b.areaId, b.name) });
  }));
  r.patch("/housings/:id", route(async (req, res) => {
    const s = S(res);
    const { name } = z.object({ name: z.string().min(2).max(120) }).parse(req.body);
    await renameHousing(s, uid(req), name);
    res.json({ ok: true });
  }));

  /* -------------------------------- projects -------------------------------- */
  r.get("/projects", route(async (req, res) => {
    need(res.locals.session, "project.view");
    const area = qs(req.query.areaId), housing = qs(req.query.housingId);
    res.json(await searchProjects(qs(req.query.q) ?? "", {
      areaId: area && isUuid(area) ? area : undefined, housingId: housing && isUuid(housing) ? housing : undefined, page: int(req.query.page), limit: int(req.query.limit, 20),
    }));
  }));
  r.get("/project-meta", route(async (_req, res) => {
    need(res.locals.session, "project.view");
    res.json({ categories: CATEGORIES });
  }));
  r.post("/projects", route(async (req, res) => {
    const s = S(res);
    res.json({ id: await createProject(s, projectSchema.parse(req.body)) });
  }));
  r.get("/projects/:id", route(async (req, res) => {
    const s = need(res.locals.session, "project.view");
    const id = uid(req);
    const project = await getProject(id);
    if (!project) throw new HttpError(404, "Project not found");
    const quotations = await listQuotations(s, { project: id, pageSize: 100 });
    const attachments = (await query("SELECT a.id, a.file_name, a.url, a.created_at, u.name AS by_name FROM project_attachments a LEFT JOIN users u ON u.id = a.uploaded_by WHERE project_id = $1 ORDER BY created_at DESC", [id])).rows;
    res.json({ project, quotations: quotations.rows, attachments });
  }));
  r.put("/projects/:id", route(async (req, res) => {
    const s = S(res);
    await updateProject(s, uid(req), projectSchema.parse(req.body));
    res.json({ ok: true });
  }));
  r.post("/projects/:id/attachments", route(async (req, res) => {
    const s = need(res.locals.session, "project.edit");
    const b = z.object({ fileName: z.string().trim().min(1).max(200), url: z.string().url().max(1000).refine((u) => /^https:\/\//.test(u), "Only https links are accepted") }).parse(req.body);
    await query("INSERT INTO project_attachments(project_id, file_name, url, uploaded_by) VALUES ($1,$2,$3,$4)", [uid(req), b.fileName, b.url, s.user.id]);
    res.json({ ok: true });
  }));
  r.delete("/projects/:id/attachments/:aid", route(async (req, res) => {
    need(res.locals.session, "project.edit");
    await query("DELETE FROM project_attachments WHERE id = $1 AND project_id = $2", [uid(req, "aid"), uid(req)]);
    res.json({ ok: true });
  }));

  /* -------------------------- products & price book -------------------------- */
  r.get("/categories", route(async (_req, res) => {
    need(res.locals.session, "product.view");
    res.json({ categories: (await query("SELECT id, key, name FROM product_categories ORDER BY sort_order")).rows });
  }));
  r.get("/products", route(async (req, res) => {
    const s = need(res.locals.session, "product.view");
    res.json(await listProducts(s, { q: qs(req.query.q), category: qs(req.query.category), active: qs(req.query.active), page: int(req.query.page), pageSize: int(req.query.pageSize, 25) }));
  }));
  r.post("/products", route(async (req, res) => {
    const s = need(res.locals.session, "product.manage");
    res.json({ id: await saveProduct(s, productSchema.parse(req.body)) });
  }));
  r.put("/products/:id", route(async (req, res) => {
    const s = need(res.locals.session, "product.manage", "price.manage");
    res.json({ id: await saveProduct(s, productSchema.parse(req.body), uid(req)) });
  }));
  r.get("/products/:id/history", route(async (req, res) => {
    const s = S(res);
    res.json({ history: await priceHistory(s, uid(req)) });
  }));
  r.get("/price-history", route(async (_req, res) => {
    const s = need(res.locals.session, "price.audit");
    res.json({ history: await priceHistory(s) });
  }));

  /* ---------------------- engineering + live pricing preview ---------------------- */
  r.post("/calc", route(async (req, res) => {
    need(res.locals.session, "quotation.create", "quotation.edit", "quotation.approve_technical", "quotation.view_all");
    const input = techInputSchema.parse(req.body);
    const key = `calc:${JSON.stringify(input)}`;
    const result = await memo(key, 60_000, () => computeTech(input));
    res.json({ result });
  }));
  r.post("/quote-preview", route(async (req, res) => {
    const s = S(res);
    res.json(await previewQuotation(s, quotationInput.parse(req.body)));
  }));

  /* ------------------------------- quotations ------------------------------- */
  r.get("/quotations", route(async (req, res) => {
    const s = need(res.locals.session, "quotation.view_all", "quotation.view_own");
    const q = req.query;
    const filters = {
      q: qs(q.q), status: qs(q.status), from: qs(q.from), to: qs(q.to), creator: qs(q.creator), area: qs(q.area), housing: qs(q.housing), project: qs(q.project),
      page: int(q.page), pageSize: int(q.pageSize, 20), revisedOnly: q.revised === "1",
    };
    for (const k of ["creator", "area", "housing", "project"] as const) if (filters[k] && !isUuid(filters[k]!)) throw new HttpError(400, `Invalid ${k}`);
    for (const k of ["from", "to"] as const) if (filters[k] && !/^\d{4}-\d{2}-\d{2}$/.test(filters[k]!)) throw new HttpError(400, `Invalid ${k} date`);
    buildQuotationWhere(s, filters);
    res.json(await listQuotations(s, filters));
  }));
  r.post("/quotations", route(async (req, res) => {
    const s = S(res);
    res.status(201).json(await saveQuotation(s, quotationInput.parse(req.body)));
  }));
  r.get("/quotations/:id", route(async (req, res) => {
    const s = need(res.locals.session, "quotation.view_all", "quotation.view_own");
    const full = await getQuotationFull(s, uid(req));
    const transitions = await availableTransitions(s, full.quotation.status);
    const isOwnerOrAll = s.can("quotation.view_all") || full.quotation.created_by === s.user.id;
    res.json({
      ...full,
      transitions: isOwnerOrAll ? transitions : [],
      can: {
        edit: full.quotation.status === "draft" && (s.can("quotation.edit") || s.can("quotation.create")),
        revise: s.can("quotation.revise") && !["draft", "pending_technical", "pending_commercial"].includes(full.quotation.status),
        pdf: s.can("pdf.download"),
        workOrder: s.can("workorder.manage") && full.quotation.status === "accepted",
        overrideTechnical: s.can("quotation.override_technical"),
      },
    });
  }));
  r.put("/quotations/:id", route(async (req, res) => {
    const s = S(res);
    res.json(await saveQuotation(s, quotationInput.parse(req.body), uid(req)));
  }));
  r.post("/quotations/:id/revise", route(async (req, res) => {
    const s = S(res);
    const { reason } = z.object({ reason: z.string().trim().min(5).max(1000) }).parse(req.body);
    res.json(await reviseQuotation(s, uid(req), reason));
  }));
  r.post("/quotations/:id/transition", route(async (req, res) => {
    const s = S(res);
    const b = z.object({ to: z.string().min(2).max(40), note: z.string().max(1000).optional() }).parse(req.body);
    res.json(await transitionQuotation(s, uid(req), b.to, b.note));
  }));
  r.get("/quotations/:id/pdf", route(async (req, res) => {
    const s = S(res);
    const v = req.query.version ? int(req.query.version) : undefined;
    const { bytes, fileName } = await quotationPdf(s, uid(req), v);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="${fileName}"`);
    res.setHeader("Content-Length", String(bytes.length));
    res.end(Buffer.from(bytes));
  }));
  r.get("/quotations/:id/compare", route(async (req, res) => {
    const s = need(res.locals.session, "quotation.view_all", "quotation.view_own");
    const full = await getQuotationFull(s, uid(req));
    const a = int(req.query.a), b = int(req.query.b);
    const va = full.versions.find((v) => v.version === a), vb = full.versions.find((v) => v.version === b);
    if (!va || !vb) throw new HttpError(404, "Version not found");
    const toDiff = (ver: number) => full.items.filter((i) => i.version === ver).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, unit: i.unit, unit_price: i.unit_price, line_total: i.line_total }));
    res.json({ a: { version: a, total: va.total, date: va.quotation_date, reason: va.reason }, b: { version: b, total: vb.total, date: vb.quotation_date, reason: vb.reason }, changes: diffItems(toDiff(a), toDiff(b)), delta: totalDelta(va.total, vb.total) });
  }));
  r.post("/quotations/:id/work-orders", route(async (req, res) => {
    const s = S(res);
    res.status(201).json({ id: await saveWorkOrder(s, uid(req), workOrderSchema.parse(req.body)) });
  }));
  r.put("/quotations/:id/work-orders/:wid", route(async (req, res) => {
    const s = S(res);
    await saveWorkOrder(s, uid(req), workOrderSchema.parse(req.body), uid(req, "wid"));
    res.json({ ok: true });
  }));

  /* ---------------------------------- reports ---------------------------------- */
  r.get("/reports", route(async (_req, res) => {
    const s = need(res.locals.session, "report.view");
    res.json({ reports: Object.entries(REPORTS).filter(([, d]) => !d.perm || s.can(d.perm)).map(([key, d]) => ({ key, title: d.title })), canExport: s.can("report.export") });
  }));
  r.get("/reports/:name", route(async (req, res) => {
    const s = S(res);
    const name = String(req.params.name);
    const f = { from: qs(req.query.from), to: qs(req.query.to), page: int(req.query.page), pageSize: int(req.query.pageSize, 25) };
    for (const k of ["from", "to"] as const) if (f[k] && !/^\d{4}-\d{2}-\d{2}$/.test(f[k]!)) throw new HttpError(400, `Invalid ${k} date`);
    if (req.query.format === "csv") {
      const result = await runReport(s, name, f, true);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}-report.csv"`);
      return void res.send(toCsv(result));
    }
    const result = await memo(`report:${s.user.id}:${name}:${JSON.stringify(f)}`, 15_000, () => runReport(s, name, f));
    res.json(result);
  }));

  /* ------------------------- employees, roles, settings ------------------------- */
  r.get("/users", route(async (_req, res) => {
    need(res.locals.session, "user.manage", "role.manage");
    res.json({ users: await listUsers() });
  }));
  r.get("/users/lookup", route(async (_req, res) => {
    // minimal list for filters (names only) — visible to anyone who can see all quotations
    need(res.locals.session, "quotation.view_all");
    res.json({ users: (await query("SELECT id, name FROM users WHERE active ORDER BY name")).rows });
  }));
  r.post("/users", route(async (req, res) => {
    const s = need(res.locals.session, "user.manage");
    res.status(201).json({ id: await createUser(s, userSchema.parse(req.body)) });
  }));
  r.put("/users/:id", route(async (req, res) => {
    const s = need(res.locals.session, "user.manage");
    await updateUser(s, uid(req), userSchema.omit({ password: true }).parse(req.body));
    res.json({ ok: true });
  }));
  r.post("/users/:id/reset-password", route(async (req, res) => {
    const s = S(res);
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    await resetPassword(s, uid(req), password);
    res.json({ ok: true });
  }));
  r.get("/users/:id/permissions", route(async (req, res) => {
    need(res.locals.session, "role.manage");
    res.json({ overrides: await getUserOverrides(uid(req)) });
  }));
  r.put("/users/:id/permissions", route(async (req, res) => {
    const s = S(res);
    const { overrides } = z.object({ overrides: z.record(z.string(), z.boolean().nullable()) }).parse(req.body);
    await setUserOverrides(s, uid(req), overrides);
    res.json({ ok: true });
  }));
  r.get("/roles", route(async (_req, res) => {
    need(res.locals.session, "role.manage", "user.manage");
    res.json({ roles: await listRoles(), permissions: PERMISSIONS.map(([key, group, description]) => ({ key, group, description })) });
  }));
  r.put("/roles/:key/permissions", route(async (req, res) => {
    const s = need(res.locals.session, "role.manage");
    const { permissions } = z.object({ permissions: z.array(z.string()).max(100) }).parse(req.body);
    await setRolePermissions(s, String(req.params.key), permissions);
    res.json({ ok: true });
  }));

  r.get("/settings", route(async (_req, res) => {
    need(res.locals.session, "settings.manage", "template.manage", "quotation.create");
    res.json({ settings: await getAllSettings() });
  }));
  r.put("/settings/:key", route(async (req, res) => {
    const s = S(res);
    await saveSetting(s, String(req.params.key), req.body);
    res.json({ ok: true });
  }));
  r.get("/company", route(async (_req, res) => {
    res.json({ company: await getSetting<CompanySettings>("company", {} as CompanySettings) });
  }));

  r.get("/audit", route(async (req, res) => {
    const s = S(res);
    res.json(await listAudit(s, { entity: qs(req.query.entity), action: qs(req.query.action), q: qs(req.query.q), page: int(req.query.page) }));
  }));
  r.get("/inquiries", route(async (req, res) => {
    const s = S(res);
    res.json(await listInquiries(s, int(req.query.page)));
  }));
  r.patch("/inquiries/:id", route(async (req, res) => {
    const s = S(res);
    const { status } = z.object({ status: z.string() }).parse(req.body);
    await setInquiryStatus(s, uid(req), status);
    res.json({ ok: true });
  }));

  return r;
}
