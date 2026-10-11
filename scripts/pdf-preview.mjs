// Renders page 1 of a PDF to a PNG using pdf.js inside headless Chrome. Usage: node scripts/pdf-preview.mjs shots/quotation.pdf shots/pdf.png
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const [src = "shots/quotation.pdf", out = "shots/pdf.png"] = process.argv.slice(2);
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
const b64 = fs.readFileSync(src).toString("base64");
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1200 });
await page.setContent('<body style="margin:0;background:#888"><canvas id="c"></canvas></body>');
await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" });
await page.evaluate(async (b64) => {
  // eslint-disable-next-line no-undef
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  // eslint-disable-next-line no-undef
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pg = await pdf.getPage(1);
  const vp = pg.getViewport({ scale: 1.5 });
  const c = document.getElementById("c");
  c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
}, b64);
const el = await page.$("#c");
await el.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
