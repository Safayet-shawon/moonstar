import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { query } from "../db/index";
import { HttpError, type Session } from "./auth";
import { assertAccess } from "./quotes";
import { getSetting, audit, type CompanySettings } from "./server";
import { formatBDT, toPaisa } from "@moonstar/shared";
import { fmtDate } from "@moonstar/shared";

const NAVY = rgb(0.043, 0.122, 0.227);
const ORANGE = rgb(0.91, 0.45, 0.1);
const GREY = rgb(0.4, 0.45, 0.5);
const LIGHT = rgb(0.94, 0.95, 0.97);
const W = 595.28, H = 841.89, M = 40;

/** Standard PDF fonts are WinAnsi-only: transliterate anything else. */
const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/²/g, "2").replace(/৳/g, "BDT ")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
const bdt = (v: string) => formatBDT(toPaisa(v), "BDT ");

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildQuotationPdf(data: {
  company: CompanySettings;
  number: string;
  version: number;
  date: string;
  status: string;
  client: Record<string, string | null>;
  preparedBy: Record<string, string | null>;
  signatory: { name: string | null; title: string | null; authorised: boolean } | null;
  terms: { header?: string; footer?: string; terms?: string[]; validityDays?: number; paymentTerms?: string; taxLabel?: string };
  commercial: Record<string, string | number | boolean | null>;
  items: { position: number; sku: string | null; name: string; description: string | null; unit: string; qty: string; unit_price: string; discount_type: string; discount_value: string; line_total: string }[];
  totals: { subtotal: string; discount_total: string; charges_total: string; tax_total: string; total: string };
  reason: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quotation ${data.number} V${data.version}`);
  pdf.setAuthor(clean(data.company.name));
  pdf.setProducer("Moon Star Quotation System");
  pdf.setCreator("Moon Star Quotation System");
  const d = new Date(`${data.date}T00:00:00Z`);
  pdf.setCreationDate(d);
  pdf.setModificationDate(d);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - M;
    return page;
  };
  const text = (t: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean; maxW?: number } = {}) => {
    const size = o.size ?? 9;
    const f = o.f ?? font;
    const s = clean(t);
    const w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: o.right ? x - w : x, y: yy, size, font: f, color: o.color ?? rgb(0.1, 0.12, 0.16) });
  };
  const para = (t: string, x: number, maxW: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; lead?: number } = {}) => {
    const size = o.size ?? 9;
    for (const l of wrap(t, o.f ?? font, size, maxW)) {
      if (y < 70) newPage();
      text(l, x, y, { size, f: o.f, color: o.color });
      y -= o.lead ?? size + 3;
    }
  };

  /* header */
  newPage();
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 82, width: W, height: 4, color: ORANGE });
  text(data.company.name, M, H - 38, { size: 18, f: bold, color: rgb(1, 1, 1) });
  text(data.company.tagline || "", M, H - 54, { size: 9, color: rgb(0.8, 0.85, 0.92) });
  text(`${data.company.phone}  |  ${data.company.email}`, M, H - 68, { size: 8, color: rgb(0.8, 0.85, 0.92) });
  text("QUOTATION", W - M, H - 40, { size: 16, f: bold, color: rgb(1, 1, 1), right: true });
  text(`No. ${data.number}  (V${data.version})`, W - M, H - 56, { size: 10, color: rgb(1, 1, 1), right: true });
  y = H - 104;
  text(`Date: ${fmtDate(data.date)}`, W - M, y, { right: true, f: bold });
  text(`Status: ${data.status === "approved" || data.status === "sent" || data.status === "accepted" ? "Approved" : "DRAFT - not approved for issue"}`, W - M, y - 12, { right: true, size: 8, color: GREY });
  if (data.terms.header) text(data.terms.header, M, y, { size: 10, f: bold, color: NAVY });
  y -= 30;

  /* client + project */
  const c = data.client;
  const box = (title: string, lines: string[], x: number, w: number) => {
    page.drawRectangle({ x, y: y - 76, width: w, height: 80, color: LIGHT });
    text(title, x + 8, y - 8, { size: 8, f: bold, color: ORANGE });
    let yy = y - 22;
    for (const l of lines.filter(Boolean)) {
      for (const w2 of wrap(l, font, 9, w - 16).slice(0, 2)) {
        text(w2, x + 8, yy, { size: 9 });
        yy -= 11;
      }
    }
  };
  box("CLIENT / PROJECT", [c.clientName ? `Client: ${c.clientName}` : "", `Project: ${c.projectName ?? ""}`, [c.houseNo && `House ${c.houseNo}`, c.roadNo && `Road ${c.roadNo}`, c.block && `Block ${c.block}`].filter(Boolean).join(", "), [c.housing, c.area].filter(Boolean).join(", ")], M, 300);
  box("PROJECT CONTACT", [c.engineerName ? `Engineer: ${c.engineerName}` : "", c.engineerPhone ? `Phone: ${c.engineerPhone}` : "", c.totalLoadKw ? `Connected load: ${c.totalLoadKw} kW` : "", c.address ?? ""], M + 310, W - 2 * M - 310);
  y -= 96;

  /* items table */
  const cols = { n: M + 4, desc: M + 24, qty: 330, unit: 372, price: 470, total: W - M - 4 };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: NAVY });
    const o = { size: 8, f: bold, color: rgb(1, 1, 1) };
    text("#", cols.n, y, o);
    text("Description", cols.desc, y, o);
    text("Qty", cols.unit - 8, y, { ...o, right: true });
    text("Unit", cols.unit, y, o);
    text("Unit price", cols.price, y, { ...o, right: true });
    text("Amount", cols.total, y, { ...o, right: true });
    y -= 20;
  };
  header();
  for (const it of data.items) {
    const lines = wrap(`${it.name}${it.sku ? ` [${it.sku}]` : ""}`, bold, 9, 290);
    const desc = it.description ? wrap(it.description, font, 8, 290) : [];
    const disc = it.discount_type !== "none" && Number(it.discount_value) > 0 ? [`Discount: ${it.discount_type === "percent" ? `${Number(it.discount_value)}%` : bdt(it.discount_value)}`] : [];
    const need = (lines.length + desc.length + disc.length) * 11 + 8;
    if (y - need < 120) {
      newPage();
      header();
    }
    text(String(it.position), cols.n, y);
    let yy = y;
    for (const l of lines) (text(l, cols.desc, yy, { f: bold }), (yy -= 11));
    for (const l of desc) (text(l, cols.desc, yy, { size: 8, color: GREY }), (yy -= 10));
    for (const l of disc) (text(l, cols.desc, yy, { size: 8, color: ORANGE }), (yy -= 10));
    text(String(Number(it.qty)), cols.unit - 8, y, { right: true });
    text(it.unit, cols.unit, y);
    text(bdt(it.unit_price), cols.price, y, { right: true });
    text(bdt(it.line_total), cols.total, y, { right: true });
    y = yy - 9;
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.4, color: rgb(0.85, 0.87, 0.9) });
  }
  y -= 6;
  if (y < 190) newPage();

  /* totals */
  const row = (label: string, val: string, strong = false) => {
    text(label, 400, y, { f: strong ? bold : font, size: strong ? 10 : 9 });
    text(val, W - M - 4, y, { right: true, f: strong ? bold : font, size: strong ? 10 : 9 });
    y -= strong ? 16 : 13;
  };
  row("Subtotal", bdt(data.totals.subtotal));
  if (toPaisa(data.totals.discount_total) > 0n) {
    const comm = data.totals;
    row("Total discounts (incl. line discounts)", `- ${bdt(comm.discount_total)}`);
  }
  if (toPaisa(data.totals.charges_total) > 0n) row("Labour / transport / other charges", bdt(data.totals.charges_total));
  if (toPaisa(data.totals.tax_total) > 0n) row(`${data.terms.taxLabel || "Tax"}${data.commercial.taxPercent ? ` (${data.commercial.taxPercent}%)` : ""}`, bdt(data.totals.tax_total));
  y -= 8;
  page.drawRectangle({ x: 396, y: y - 5, width: W - M - 396, height: 20, color: NAVY });
  text("TOTAL (BDT)", 404, y, { f: bold, size: 10, color: rgb(1, 1, 1) });
  text(bdt(data.totals.total), W - M - 8, y, { f: bold, size: 10, right: true, color: rgb(1, 1, 1) });
  y -= 34;

  /* terms */
  const sec = (title: string) => {
    if (y < 110) newPage();
    text(title, M, y, { size: 9, f: bold, color: NAVY });
    y -= 13;
  };
  if (data.reason && data.version > 1) {
    sec(`REVISION V${data.version}`);
    para(data.reason, M, W - 2 * M);
    y -= 6;
  }
  sec("VALIDITY & PAYMENT");
  para(`This quotation is valid for ${data.terms.validityDays ?? 30} days from the date of issue.`, M, W - 2 * M);
  if (data.terms.paymentTerms) para(`Payment terms: ${data.terms.paymentTerms}`, M, W - 2 * M - 12);
  y -= 6;
  if (data.commercial.notes) {
    sec("NOTES");
    para(String(data.commercial.notes), M, W - 2 * M);
    y -= 6;
  }
  if (data.terms.terms?.length) {
    sec("TERMS & CONDITIONS");
    data.terms.terms.forEach((t, i) => para(`${i + 1}. ${t}`, M, W - 2 * M, { size: 8.5 }));
    y -= 6;
  }

  /* signatures */
  if (y < 140) newPage();
  y -= 6;
  const pb = data.preparedBy;
  text("Prepared by", M, y, { size: 8, f: bold, color: ORANGE });
  text("Authorised signatory", 330, y, { size: 8, f: bold, color: ORANGE });
  y -= 14;
  text(pb.name ?? "", M, y, { f: bold });
  text([pb.designation, pb.phone].filter(Boolean).join(" | "), M, y - 11, { size: 8, color: GREY });
  text(pb.email ?? "", M, y - 21, { size: 8, color: GREY });
  page.drawLine({ start: { x: 330, y: y - 34 }, end: { x: W - M, y: y - 34 }, thickness: 0.6, color: GREY });
  if (data.signatory?.authorised && data.signatory.name) {
    text(data.signatory.name, 330, y, { f: bold });
    text(data.signatory.title ?? "", 330, y - 11, { size: 8, color: GREY });
    text(`Approval status: ${["approved", "sent", "accepted"].includes(data.status) ? "Approved" : "Pending approval"}`, 330, y - 46, { size: 8, color: GREY });
  } else {
    text("Signature pending authorisation", 330, y, { size: 8, color: GREY });
  }

  /* footer on every page */
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: rgb(0.8, 0.83, 0.87) });
    text(data.terms.footer || "", M, 32, { size: 7, color: GREY });
    text(`${data.company.factory}`, M, 22, { size: 7, color: GREY });
    text(`Page ${i + 1} of ${pages.length}`, W - M, 22, { size: 7, color: GREY, right: true });
  });
  return pdf.save();
}

export async function quotationPdf(s: Session, id: string, version?: number) {
  if (!s.can("pdf.download")) throw new HttpError(403, "You cannot download quotation PDFs");
  const q = await assertAccess(s, id);
  const v = (await query("SELECT * FROM quotation_versions WHERE quotation_id = $1 AND version = $2", [id, version ?? q.current_version])).rows[0];
  if (!v) throw new HttpError(404, "Version not found");
  const items = (await query("SELECT * FROM quotation_items WHERE version_id = $1 ORDER BY position", [v.id])).rows;
  const company = await getSetting<CompanySettings>("company", {} as CompanySettings);
  // The status printed on a version: a superseded locked version keeps "approved" semantics only if it was approved
  const status = v.version === q.current_version ? q.status : v.locked ? "sent" : "draft";
  const bytes = await buildQuotationPdf({
    company, number: q.number, version: v.version, date: v.quotation_date, status, client: v.client, preparedBy: v.prepared_by,
    signatory: v.signatory, terms: v.terms, commercial: v.commercial, items: items as never,
    totals: { subtotal: v.subtotal, discount_total: v.discount_total, charges_total: v.charges_total, tax_total: v.tax_total, total: v.total },
    reason: v.reason,
  });
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const fileName = `${q.number}-V${v.version}.pdf`;
  const known = await query("SELECT 1 FROM documents WHERE quotation_id = $1 AND version = $2 AND sha256 = $3", [id, v.version, sha]);
  if (!known.rowCount) {
    await query(`INSERT INTO documents(quotation_id, version, file_name, sha256, size_bytes, generated_by) VALUES ($1,$2,$3,$4,$5,$6)`, [id, v.version, fileName, sha, bytes.length, s.user.id]);
  }
  await audit(s, "quotation.pdf", "quotation", id, { version: v.version, sha256: sha });
  return { bytes, fileName };
}
