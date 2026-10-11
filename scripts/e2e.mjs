// Headless smoke test of the real UI against a running stack (frontend :3000, backend :4000).
// Usage: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e.mjs
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
const email = process.env.E2E_EMAIL ?? "employee@moonstar.local";
const password = process.env.E2E_PASSWORD ?? "Moonstar@Demo2026";
fs.mkdirSync("shots", { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

step("home");
await page.goto(BASE, { waitUntil: "networkidle2" });
await sleep(1500);
await page.screenshot({ path: "shots/home-hero.png" });
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
await sleep(800);
await page.screenshot({ path: "shots/home-full.png", fullPage: true });

step("login");
await page.goto(BASE + "/portal/login", { waitUntil: "networkidle2" });
await page.type("#email", email);
await page.type("#password", password);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("button[type=submit]")]);
if (!page.url().endsWith("/portal")) throw new Error("login failed: " + page.url());
await page.screenshot({ path: "shots/portal-dashboard.png" });

step("builder: select project");
await page.goto(BASE + "/portal/quotations/new", { waitUntil: "networkidle2" });
await page.waitForSelector('input[aria-label="Search projects"]');
await sleep(800);
await page.click("ul button");
await page.waitForSelector("#b-kw");
step("builder: enter load");
await page.focus("#b-kw");
await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
await page.type("#b-kw", "150");
await page.waitForFunction(() => /recommended transformer/i.test(document.body.innerText) && /150 kW/.test(document.body.innerText), { timeout: 15000 });
const calcText = await page.evaluate(() => document.body.innerText.match(/Recommended transformer[\s\S]{0,60}/)?.[0]);
console.log("   calc:", calcText?.replace(/\n/g, " "));
await page.screenshot({ path: "shots/builder-calc.png", fullPage: true });

step("builder: add recommended equipment");
const [addBtn] = await page.$$("xpath/.//button[contains(., 'Add recommended equipment')]");
await addBtn.click();
await page.waitForFunction(() => document.querySelectorAll("table input[aria-label^='Quantity']").length > 0, { timeout: 15000 });
await page.waitForFunction(() => /৳[\d,]+\.\d\d/.test(document.querySelector("main aside")?.innerText ?? "") && !/Total\s*—/.test(document.querySelector("main aside")?.innerText ?? ""), { timeout: 15000 });
const total = await page.evaluate(() => document.querySelector("main aside")?.innerText.replace(/\n+/g, " | "));
console.log("   summary:", total?.slice(0, 160));
await page.screenshot({ path: "shots/builder-items.png", fullPage: true });

step("save draft");
const [save] = await page.$$("xpath/.//button[contains(., 'Save as draft')]");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), save.click()]);
console.log("   url:", page.url());
await page.screenshot({ path: "shots/quotation-detail.png", fullPage: true });

step("submit for approval + PDF");
const [submit] = await page.$$("xpath/.//button[contains(., 'Submit for technical approval')]");
await submit.click();
await page.waitForFunction(() => document.body.innerText.includes("Pending technical approval"), { timeout: 15000 });
const id = page.url().split("/").pop();
const pdf = await page.evaluate(async (id) => { const r = await fetch(`/api/portal/quotations/${id}/pdf`); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, type: r.headers.get("content-type"), magic: String.fromCharCode(...b.slice(0, 5)), size: b.length }; }, id);
console.log("   pdf:", pdf);
const buf = await page.evaluate(async (id) => { const r = await fetch(`/api/portal/quotations/${id}/pdf`); return Array.from(new Uint8Array(await r.arrayBuffer())); }, id);
fs.writeFileSync("shots/quotation.pdf", Buffer.from(buf));

for (const p of ["/portal/quotations", "/portal/projects", "/portal/areas", "/portal/products", "/portal/reports", "/portal/revised", "/portal/settings"]) {
  const r = await page.goto(BASE + p, { waitUntil: "networkidle2" });
  console.log("   ", p, r.status(), (await page.title()).slice(0, 40));
}
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no browser errors");
await browser.close();
