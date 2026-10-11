import { z } from "zod";
import { query, tx } from "../db/index";
import { HttpError, type Session } from "./auth";
import { audit } from "./server";

const opt = z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null));
const numOpt = z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))).refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Must be a non-negative number");

export const CATEGORIES = ["residential", "commercial", "industrial", "mixed", "institutional", "other"] as const;

export const projectSchema = z
  .object({
    areaId: z.string().uuid(),
    housingId: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
    name: z.string().trim().min(2).max(200),
    houseNo: opt, roadNo: opt, block: opt, clientName: opt, engineerName: opt, engineerPhone: opt,
    address: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)),
    totalLoadKw: numOpt, maxDemandKw: numOpt,
    category: z.enum(CATEGORIES).default("residential"),
    notes: z.string().trim().max(4000).optional().nullable().transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    // conditional validation by project category
    if (v.category === "industrial" && !v.totalLoadKw) ctx.addIssue({ code: "custom", path: ["totalLoadKw"], message: "Industrial projects require the total connected load" });
    if ((v.category === "commercial" || v.category === "industrial") && !v.clientName) ctx.addIssue({ code: "custom", path: ["clientName"], message: "Client name is required for commercial/industrial projects" });
    if (v.engineerPhone && !/^[+\d][\d\s\-()]{6,19}$/.test(v.engineerPhone)) ctx.addIssue({ code: "custom", path: ["engineerPhone"], message: "Invalid phone number" });
    if (v.maxDemandKw !== null && v.totalLoadKw !== null && v.maxDemandKw > v.totalLoadKw) ctx.addIssue({ code: "custom", path: ["maxDemandKw"], message: "Maximum demand cannot exceed total connected load" });
  });
export type ProjectInput = z.infer<typeof projectSchema>;

export async function listAreas() {
  return (
    await query(
      `SELECT a.id, a.name, (SELECT count(*)::int FROM housings h WHERE h.area_id = a.id) AS housings,
              (SELECT count(*)::int FROM projects p WHERE p.area_id = a.id) AS projects FROM areas a ORDER BY a.name`,
    )
  ).rows;
}
export async function listHousings(areaId?: string) {
  return (
    await query(
      `SELECT h.id, h.name, h.area_id, a.name AS area_name, (SELECT count(*)::int FROM projects p WHERE p.housing_id = h.id) AS projects
         FROM housings h JOIN areas a ON a.id = h.area_id ${areaId ? "WHERE h.area_id = $1" : ""} ORDER BY a.name, h.name`,
      areaId ? [areaId] : [],
    )
  ).rows;
}

export async function createArea(s: Session, name: string) {
  if (!s.can("project.create")) throw new HttpError(403, "Not permitted");
  const n = name.trim();
  if (n.length < 2) throw new Error("Area name is required");
  const dup = await query("SELECT id FROM areas WHERE lower(name) = lower($1)", [n]);
  if (dup.rowCount) return dup.rows[0].id as string;
  const r = await query("INSERT INTO areas(name, created_by) VALUES ($1,$2) RETURNING id", [n, s.user.id]);
  await audit(s, "area.create", "area", r.rows[0].id, { name: n });
  return r.rows[0].id as string;
}

export async function createHousing(s: Session, areaId: string, name: string) {
  if (!s.can("project.create")) throw new HttpError(403, "Not permitted");
  const n = name.trim();
  if (n.length < 2) throw new Error("Housing name is required");
  const dup = await query("SELECT id FROM housings WHERE area_id = $1 AND lower(name) = lower($2)", [areaId, n]);
  if (dup.rowCount) return dup.rows[0].id as string;
  const r = await query("INSERT INTO housings(area_id, name, created_by) VALUES ($1,$2,$3) RETURNING id", [areaId, n, s.user.id]);
  await audit(s, "housing.create", "housing", r.rows[0].id, { name: n, areaId });
  return r.rows[0].id as string;
}

export async function renameArea(s: Session, id: string, name: string) {
  if (!s.can("project.edit")) throw new HttpError(403, "Not permitted");
  await query("UPDATE areas SET name = $2 WHERE id = $1", [id, name.trim()]);
  await audit(s, "area.rename", "area", id, { name });
}
export async function renameHousing(s: Session, id: string, name: string) {
  if (!s.can("project.edit")) throw new HttpError(403, "Not permitted");
  await query("UPDATE housings SET name = $2 WHERE id = $1", [id, name.trim()]);
  await audit(s, "housing.rename", "housing", id, { name });
}

async function assertHousingInArea(areaId: string, housingId: string | null | undefined) {
  if (!housingId) return;
  const r = await query("SELECT 1 FROM housings WHERE id = $1 AND area_id = $2", [housingId, areaId]);
  if (!r.rowCount) throw new Error("The selected housing does not belong to the selected area");
}

export async function createProject(s: Session, input: ProjectInput) {
  if (!s.can("project.create")) throw new HttpError(403, "Not permitted");
  await assertHousingInArea(input.areaId, input.housingId);
  const r = await query<{ id: string }>(
    `INSERT INTO projects(area_id, housing_id, name, house_no, road_no, block, client_name, engineer_name, engineer_phone, address, total_load_kw, max_demand_kw, category, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
    [input.areaId, input.housingId ?? null, input.name, input.houseNo, input.roadNo, input.block, input.clientName, input.engineerName, input.engineerPhone, input.address, input.totalLoadKw, input.maxDemandKw, input.category, input.notes, s.user.id],
  );
  await audit(s, "project.create", "project", r.rows[0].id, { name: input.name });
  return r.rows[0].id;
}

export async function updateProject(s: Session, id: string, input: ProjectInput) {
  if (!s.can("project.edit")) throw new HttpError(403, "Not permitted");
  await assertHousingInArea(input.areaId, input.housingId);
  await tx(async (c) => {
    await c.query(
      `UPDATE projects SET area_id=$2, housing_id=$3, name=$4, house_no=$5, road_no=$6, block=$7, client_name=$8, engineer_name=$9, engineer_phone=$10, address=$11,
         total_load_kw=$12, max_demand_kw=$13, category=$14, notes=$15, updated_by=$16, updated_at=now() WHERE id=$1`,
      [id, input.areaId, input.housingId ?? null, input.name, input.houseNo, input.roadNo, input.block, input.clientName, input.engineerName, input.engineerPhone, input.address, input.totalLoadKw, input.maxDemandKw, input.category, input.notes, s.user.id],
    );
    await audit(s, "project.update", "project", id, { name: input.name }, c);
  });
}

export async function searchProjects(q: string, opts: { areaId?: string; housingId?: string; limit?: number; page?: number } = {}) {
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  const where: string[] = [];
  if (q.trim()) {
    const ph = p(`%${q.trim().toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(lower(pr.name) LIKE ${ph} OR lower(a.name) LIKE ${ph} OR lower(coalesce(h.name,'')) LIKE ${ph} OR lower(coalesce(pr.house_no,'')) LIKE ${ph}
      OR lower(coalesce(pr.road_no,'')) LIKE ${ph} OR lower(coalesce(pr.client_name,'')) LIKE ${ph}
      OR EXISTS (SELECT 1 FROM quotations qq WHERE qq.project_id = pr.id AND lower(qq.number) LIKE ${ph}))`);
  }
  if (opts.areaId) where.push(`pr.area_id = ${p(opts.areaId)}`);
  if (opts.housingId) where.push(`pr.housing_id = ${p(opts.housingId)}`);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 20, 100);
  const page = Math.max(opts.page ?? 1, 1);
  const total = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM projects pr JOIN areas a ON a.id = pr.area_id LEFT JOIN housings h ON h.id = pr.housing_id ${w}`, params)).rows[0].n;
  const rows = (
    await query(
      `SELECT pr.*, a.name AS area_name, h.name AS housing_name,
              (SELECT count(*)::int FROM quotations qq WHERE qq.project_id = pr.id) AS quotation_count
         FROM projects pr JOIN areas a ON a.id = pr.area_id LEFT JOIN housings h ON h.id = pr.housing_id ${w}
        ORDER BY pr.updated_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    )
  ).rows;
  return { rows, total, page, pages: Math.max(Math.ceil(total / limit), 1) };
}

export async function getProject(id: string) {
  const r = await query(
    `SELECT pr.*, a.name AS area_name, h.name AS housing_name, cu.name AS created_by_name, uu.name AS updated_by_name
       FROM projects pr JOIN areas a ON a.id = pr.area_id LEFT JOIN housings h ON h.id = pr.housing_id
       LEFT JOIN users cu ON cu.id = pr.created_by LEFT JOIN users uu ON uu.id = pr.updated_by WHERE pr.id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
