import { z } from "zod";
import { query, tx, type Row } from "../db/index";
import { HttpError, type Session } from "./auth";
import { audit } from "./server";
import { toPaisa } from "@moonstar/shared";

/* Apply scheduled (future-dated) price changes whose effective date has arrived. Throttled per instance. */
let lastSync = 0;
export async function syncScheduledPrices(force = false) {
  if (!force && Date.now() - lastSync < 30_000) return;
  lastSync = Date.now();
  await query(
    `UPDATE products p SET price = h.price, cost = h.cost, price_effective_from = h.effective_from, updated_at = now()
       FROM (SELECT DISTINCT ON (product_id) product_id, price, cost, effective_from FROM price_history
              WHERE effective_from <= now() ORDER BY product_id, effective_from DESC, id DESC) h
      WHERE h.product_id = p.id AND (p.price <> h.price OR p.cost IS DISTINCT FROM h.cost) AND h.effective_from > p.price_effective_from - interval '0 seconds'`,
  );
}

const money = z.union([z.string(), z.number()]).transform((v) => String(v).trim()).refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

export const productSchema = z.object({
  sku: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(300),
  categoryId: z.coerce.number().int(),
  brand: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("nos"),
  price: money,
  cost: money.optional().or(z.literal("").transform(() => undefined)),
  capacityKva: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  capacityKvar: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  specs: z.string().max(4000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  publicVisible: z.coerce.boolean().optional(),
  publicSummary: z.string().max(600).optional().nullable(),
  active: z.coerce.boolean().default(true),
  effectiveFrom: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});
export type ProductInput = z.infer<typeof productSchema>;

export async function listProducts(s: Session, f: { q?: string; category?: string; active?: string; page?: number; pageSize?: number }) {
  await syncScheduledPrices();
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  if (f.q?.trim()) {
    const ph = p(`%${f.q.trim().toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(lower(pr.name) LIKE ${ph} OR lower(pr.sku) LIKE ${ph} OR lower(coalesce(pr.brand,'')) LIKE ${ph} OR lower(coalesce(pr.model,'')) LIKE ${ph})`);
  }
  if (f.category) where.push(`c.key = ${p(f.category)}`);
  if (f.active === "1") where.push("pr.active = TRUE");
  if (f.active === "0") where.push("pr.active = FALSE");
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const size = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(f.page ?? 1, 1);
  const total = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM products pr JOIN product_categories c ON c.id = pr.category_id ${w}`, params)).rows[0].n;
  const rows = (
    await query(
      `SELECT pr.*, c.key AS category_key, c.name AS category_name FROM products pr JOIN product_categories c ON c.id = pr.category_id ${w}
       ORDER BY c.sort_order, pr.capacity_kva NULLS LAST, pr.name LIMIT ${size} OFFSET ${(page - 1) * size}`,
      params,
    )
  ).rows;
  const showCost = s.can("price.view_cost");
  return { rows: showCost ? rows : rows.map(({ cost: _c, ...r }) => r), total, page, pageSize: size, pages: Math.max(Math.ceil(total / size), 1), showCost };
}

export async function saveProduct(s: Session, input: ProductInput, id?: string) {
  if (!s.can("product.manage") && !(id && s.can("price.manage"))) throw new HttpError(403, "You cannot manage products");
  let specs: unknown = {};
  if (input.specs?.trim()) {
    try {
      specs = JSON.parse(input.specs);
    } catch {
      specs = { text: input.specs };
    }
  }
  const effective = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
  if (Number.isNaN(+effective)) throw new Error("Invalid effective date");
  return tx(async (c) => {
    if (!id) {
      if (!s.can("price.manage")) throw new HttpError(403, "Setting an initial price needs the price permission");
      const r = await c.query<{ id: string }>(
        `INSERT INTO products(sku, name, category_id, brand, model, specs, unit, price, cost, capacity_kva, capacity_kvar, active, public_visible, public_summary, notes, created_by, updated_by, price_effective_from)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17) RETURNING id`,
        [input.sku, input.name, input.categoryId, input.brand ?? null, input.model ?? null, JSON.stringify(specs), input.unit, input.price,
         s.can("price.view_cost") ? input.cost ?? null : null, input.capacityKva ?? null, input.capacityKvar ?? null, input.active, Boolean(input.publicVisible),
         input.publicSummary ?? null, input.notes ?? null, s.user.id, effective],
      );
      await c.query(`INSERT INTO price_history(product_id, price, cost, effective_from, reason, changed_by) VALUES ($1,$2,$3,$4,'Initial price',$5)`, [r.rows[0].id, input.price, s.can("price.view_cost") ? input.cost ?? null : null, effective, s.user.id]);
      await audit(s, "product.create", "product", r.rows[0].id, { sku: input.sku, price: input.price }, c);
      return r.rows[0].id;
    }
    const cur = (await c.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw new Error("Product not found");
    const priceChanged = toPaisa(input.price) !== toPaisa(cur.price);
    const costInput = s.can("price.view_cost") ? input.cost ?? null : cur.cost;
    const costChanged = (costInput === null) !== (cur.cost === null) || (costInput !== null && toPaisa(costInput) !== toPaisa(cur.cost));
    if ((priceChanged || costChanged) && !s.can("price.manage")) throw new HttpError(403, "You are not permitted to change prices");
    const immediate = effective <= new Date();
    await c.query(
      `UPDATE products SET sku=$2, name=$3, category_id=$4, brand=$5, model=$6, specs=$7, unit=$8, capacity_kva=$9, capacity_kvar=$10, active=$11,
         public_visible=$12, public_summary=$13, notes=$14, updated_by=$15, updated_at=now() WHERE id=$1`,
      [id, input.sku, input.name, input.categoryId, input.brand ?? null, input.model ?? null, JSON.stringify(specs), input.unit, input.capacityKva ?? null,
       input.capacityKvar ?? null, input.active, Boolean(input.publicVisible), input.publicSummary ?? null, input.notes ?? null, s.user.id],
    );
    if (priceChanged || costChanged) {
      await c.query(`INSERT INTO price_history(product_id, price, cost, effective_from, reason, changed_by) VALUES ($1,$2,$3,$4,$5,$6)`, [id, input.price, costInput, effective, input.reason ?? null, s.user.id]);
      if (immediate) await c.query("UPDATE products SET price=$2, cost=$3, price_effective_from=$4 WHERE id=$1", [id, input.price, costInput, effective]);
      await audit(s, "price.change", "product", id, { sku: cur.sku, from: cur.price, to: input.price, effectiveFrom: effective.toISOString(), reason: input.reason ?? null, scheduled: !immediate }, c);
    }
    await audit(s, "product.update", "product", id, { sku: input.sku }, c);
    return id;
  });
}

export async function priceHistory(s: Session, productId?: string, limit = 200) {
  if (!s.can("price.audit") && !s.can("product.manage")) throw new HttpError(403, "Not permitted");
  const showCost = s.can("price.view_cost");
  const r = await query(
    `SELECT h.id, h.price, h.cost, h.effective_from, h.reason, h.created_at, u.name AS by_name, p.sku, p.name AS product_name
       FROM price_history h JOIN products p ON p.id = h.product_id LEFT JOIN users u ON u.id = h.changed_by
      ${productId ? "WHERE h.product_id = $1" : ""} ORDER BY h.created_at DESC, h.id DESC LIMIT ${limit}`,
    productId ? [productId] : [],
  );
  return r.rows.map((x: Row) => (showCost ? x : { ...x, cost: null }));
}

/** Public catalogue: only explicitly published products, never prices or costs. */
export async function publicProducts() {
  const r = await query(
    `SELECT pr.id, pr.sku, pr.name, pr.brand, pr.model, pr.capacity_kva, pr.capacity_kvar, pr.public_summary, pr.specs, c.key AS category_key, c.name AS category_name
       FROM products pr JOIN product_categories c ON c.id = pr.category_id WHERE pr.active AND pr.public_visible ORDER BY c.sort_order, pr.capacity_kva NULLS LAST, pr.name`,
  );
  return r.rows;
}
