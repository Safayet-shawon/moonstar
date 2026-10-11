// Runs Lighthouse (mobile emulation, default throttling) against key public pages of a running site.
// Usage: node scripts/lighthouse.mjs [baseUrl]
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const chromePath = process.env.CHROME_PATH ?? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
const pages = ["/", "/solutions", "/solutions/transformers", "/projects", "/contact", "/portal/login"];
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox"] });
const rows = [];
for (const p of pages) {
  const r = await lighthouse(base + p, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
  const c = r.lhr.categories, a = r.lhr.audits;
  rows.push({ page: p, perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c["best-practices"].score * 100), seo: Math.round(c.seo.score * 100), LCP: a["largest-contentful-paint"].displayValue, TBT: a["total-blocking-time"].displayValue, CLS: a["cumulative-layout-shift"].displayValue });
  const failed = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable").map((x) => `${x.id}(${x.score})`);
  if (failed.length) console.log(`  ${p} needs attention:`, failed.slice(0, 8).join(", "));
  fs.mkdirSync("shots", { recursive: true });
  fs.writeFileSync(`shots/lh-${p.replace(/\W+/g, "_") || "home"}.json`, r.report);
}
await chrome.kill();
console.table(rows);
