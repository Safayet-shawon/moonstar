/**
 * Decimal-safe money. All amounts are handled as BigInt "paisa" (1 BDT = 100 paisa).
 * Quantities are BigInt milli-units (1.000 = 1000). Percentages are basis points (5% = 500).
 * No floating point is used in any financial computation.
 */
export type Paisa = bigint;

const DEC = /^-?\d+(\.\d+)?$/;

export function toPaisa(v: string | number | bigint): Paisa {
  if (typeof v === "bigint") return v * 100n;
  const s = typeof v === "number" ? v.toFixed(2) : String(v).trim().replace(/,/g, "");
  if (!DEC.test(s)) throw new Error(`Invalid money value: ${v}`);
  const neg = s.startsWith("-");
  const [i, f = ""] = s.replace("-", "").split(".");
  const frac = (f + "00").slice(0, 2);
  // round half up on the third decimal
  const round = f.length > 2 && Number(f[2]) >= 5 ? 1n : 0n;
  const p = BigInt(i) * 100n + BigInt(frac) + round;
  return neg ? -p : p;
}

export function fromPaisa(p: Paisa): string {
  const neg = p < 0n;
  const a = neg ? -p : p;
  const s = `${a / 100n}.${(a % 100n).toString().padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

/** Parse decimal quantity string into milli-units. */
export function toMilli(v: string | number): bigint {
  const s = typeof v === "number" ? v.toFixed(3) : String(v).trim();
  if (!DEC.test(s)) throw new Error(`Invalid quantity: ${v}`);
  const neg = s.startsWith("-");
  const [i, f = ""] = s.replace("-", "").split(".");
  const m = BigInt(i) * 1000n + BigInt((f + "000").slice(0, 3));
  return neg ? -m : m;
}

export function fromMilli(m: bigint): string {
  const s = `${m / 1000n}.${(m % 1000n).toString().padStart(3, "0")}`.replace(/\.?0+$/, "");
  return s === "" ? "0" : s;
}

/** Percent string ("7.5") -> basis points (750). */
export function toBp(v: string | number): bigint {
  const s = typeof v === "number" ? v.toFixed(2) : String(v).trim();
  if (!DEC.test(s)) throw new Error(`Invalid percent: ${v}`);
  const [i, f = ""] = s.replace("-", "").split(".");
  const bp = BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
  return s.startsWith("-") ? -bp : bp;
}

export function fromBp(bp: bigint): string {
  return fromPaisa(bp);
}

/** Round-half-up integer division (for non-negative operands; sign handled). */
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("Division by zero");
  const neg = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return neg ? -q : q;
}

/** line total = qty(milli) * unit price(paisa) / 1000 */
export function lineTotal(qtyMilli: bigint, unit: Paisa): Paisa {
  return divRound(qtyMilli * unit, 1000n);
}

export function applyBp(amount: Paisa, bp: bigint): Paisa {
  return divRound(amount * bp, 10000n);
}

/** BDT display with Indian/Bangladeshi digit grouping: 12,34,567.00 */
export function formatBDT(value: string | bigint | number, symbol = "৳"): string {
  const p = typeof value === "bigint" ? value : toPaisa(value as string | number);
  const neg = p < 0n;
  const [i, d] = fromPaisa(neg ? -p : p).split(".");
  let head = i;
  if (i.length > 3) {
    const last3 = i.slice(-3);
    const rest = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    head = `${rest},${last3}`;
  }
  return `${neg ? "-" : ""}${symbol}${head}.${d}`;
}
