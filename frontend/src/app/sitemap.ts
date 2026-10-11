import type { MetadataRoute } from "next";
import { SOLUTIONS } from "@/content/solutions";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.moonstarpower.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/about", "/solutions", "/products", "/projects", "/certifications", "/resources", "/contact"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 })),
    ...SOLUTIONS.map((s) => ({ url: `${base}/solutions/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
