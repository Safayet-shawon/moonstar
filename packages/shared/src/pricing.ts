import { applyBp, divRound, lineTotal, toBp, toMilli, toPaisa, type Paisa } from "./money";
import { dotBig } from "./matrix";

export type DiscountType = "none" | "percent" | "fixed";

export type ItemInput = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  qty: string | number;
  unitPrice: string | number;
  costPrice?: string | number | null; // internal — never serialised to PDFs / public
  discountType?: DiscountType;
  discountValue?: string | number;
  isManualPrice?: boolean;
};

export type CommercialInput = {
  discountType?: DiscountType;
  discountValue?: string | number;
  labourCharge?: string | number;
  transportCharge?: string | number;
  otherCharge?: string | number;
  taxPercent?: string | number;
  minMarginPercent?: string | number;
};

export type PricedItem = {
  qtyMilli: bigint;
  unit: Paisa;
  gross: Paisa;
  discount: Paisa;
  net: Paisa;
  cost: Paisa | null;
};

export type Totals = {
  items: PricedItem[];
  gross: Paisa;
  subtotal: Paisa;
  itemDiscounts: Paisa;
  quotationDiscount: Paisa;
  labour: Paisa;
  transport: Paisa;
  other: Paisa;
  taxable: Paisa;
  tax: Paisa;
  total: Paisa;
  totalCost: Paisa | null;
  marginBp: bigint | null;
  marginWarning: boolean;
  discountRatioBp: bigint;
};

const M = (v: string | number | undefined | null) => (v === undefined || v === null || v === "" ? 0n : toPaisa(v));

function discountOf(type: string | undefined, value: string | number | undefined, base: Paisa): Paisa {
  if (!type || type === "none" || value === undefined || value === "") return 0n;
  if (type === "percent") {
    const bp = toBp(value);
    if (bp < 0n || bp > 10000n) throw new Error("Percent discount must be between 0 and 100");
    return applyBp(base, bp);
  }
  const f = toPaisa(value);
  if (f < 0n) throw new Error("Discount cannot be negative");
  return f > base ? base : f;
}

/**
 * Authoritative server-side totals. Line gross = qty · price (milli-units × paisa / 1000, round half up).
 * The sum of exact products is cross-checked using the BigInt dot product qtyᵀ·price.
 */
export function computeTotals(items: ItemInput[], c: CommercialInput = {}): Totals {
  const priced: PricedItem[] = items.map((it) => {
    const qtyMilli = toMilli(it.qty);
    if (qtyMilli <= 0n) throw new Error(`Quantity for "${it.name}" must be positive`);
    const unit = toPaisa(it.unitPrice);
    if (unit < 0n) throw new Error(`Price for "${it.name}" cannot be negative`);
    const gross = lineTotal(qtyMilli, unit);
    const discount = discountOf(it.discountType, it.discountValue, gross);
    const cost =
      it.costPrice === undefined || it.costPrice === null || it.costPrice === ""
        ? null
        : lineTotal(qtyMilli, toPaisa(it.costPrice));
    return { qtyMilli, unit, gross, discount, net: gross - discount, cost };
  });

  const exact = divRound(dotBig(priced.map((p) => p.qtyMilli), priced.map((p) => p.unit)), 1000n);
  const gross = priced.reduce((s, p) => s + p.gross, 0n);
  const drift = exact > gross ? exact - gross : gross - exact;
  if (drift > BigInt(priced.length)) throw new Error("Internal pricing reconciliation failed");

  const subtotal = priced.reduce((s, p) => s + p.net, 0n);
  const itemDiscounts = priced.reduce((s, p) => s + p.discount, 0n);
  const quotationDiscount = discountOf(c.discountType, c.discountValue, subtotal);
  const labour = M(c.labourCharge);
  const transport = M(c.transportCharge);
  const other = M(c.otherCharge);
  if (labour < 0n || transport < 0n || other < 0n) throw new Error("Charges cannot be negative");
  const taxable = subtotal - quotationDiscount + labour + transport + other;
  const tax = applyBp(taxable, c.taxPercent ? toBp(c.taxPercent) : 0n);
  const total = taxable + tax;

  const allCost = priced.length > 0 && priced.every((p) => p.cost !== null);
  const totalCost = allCost ? priced.reduce((s, p) => s + (p.cost ?? 0n), 0n) : null;
  const marginBp = totalCost !== null && taxable > 0n ? divRound((taxable - totalCost) * 10000n, taxable) : null;
  const minBp = c.minMarginPercent ? toBp(c.minMarginPercent) : null;
  const marginWarning = marginBp !== null && minBp !== null && marginBp < minBp;
  const discountRatioBp = gross > 0n ? divRound((itemDiscounts + quotationDiscount) * 10000n, gross) : 0n;

  return {
    items: priced, gross, subtotal, itemDiscounts, quotationDiscount, labour, transport, other,
    taxable, tax, total, totalCost, marginBp, marginWarning, discountRatioBp,
  };
}

/** Resolve the price effective at a date from a price-history list. */
export function priceAt<T extends { effective_from: string | Date }>(history: T[], at: Date): T | null {
  const sorted = [...history].sort((a, b) => +new Date(b.effective_from) - +new Date(a.effective_from));
  return sorted.find((h) => +new Date(h.effective_from) <= +at) ?? null;
}
