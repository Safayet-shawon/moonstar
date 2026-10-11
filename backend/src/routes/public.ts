import { Router } from "express";
import { route, ip } from "../http";
import { publicProducts } from "../lib/catalog";
import { createInquiry, inquirySchema } from "../lib/admin";
import { memo } from "../lib/cache";
import { getSetting, type CompanySettings } from "../lib/server";

export function publicRoutes() {
  const r = Router();

  // Cached at the CDN edge and in-process. Contains no prices or costs.
  r.get("/products", route(async (_req, res) => {
    const rows = await memo("public:products", 60_000, publicProducts);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.json({ products: rows });
  }));

  r.get("/company", route(async (_req, res) => {
    const c = await getSetting<CompanySettings>("company", {} as CompanySettings);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.json({ name: c.name, phone: c.phone, email: c.email, hours: c.hours, factory: c.factory, branch: c.branch, khulna: c.khulna, approval: c.approval });
  }));

  r.post("/inquiry", route(async (req, res) => {
    const input = inquirySchema.parse(req.body);
    res.json(await createInquiry(input, ip(req)));
  }));

  return r;
}
