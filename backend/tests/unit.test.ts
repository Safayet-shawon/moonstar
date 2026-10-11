import { describe, expect, it } from "vitest";
import { applyBp, divRound, formatBDT, fromMilli, fromPaisa, lineTotal, toBp, toMilli, toPaisa } from "@moonstar/shared";
import { dot, dotBig, identity, matMul, matVec, solve, transpose } from "@moonstar/shared";
import { calculateLoad, DEFAULT_RULES, rowsFromTotal } from "@moonstar/shared";
import { computeTotals } from "@moonstar/shared";
import { diffItems } from "@moonstar/shared";
import { todayIn } from "@moonstar/shared";

describe("money (decimal-safe)", () => {
  it("avoids the classic float errors", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toPaisa("0.10") + toPaisa("0.20")).toBe(toPaisa("0.30"));
    expect(fromPaisa(toPaisa("1234567.89"))).toBe("1234567.89");
  });
  it("rounds half up and handles negatives", () => {
    expect(toPaisa("10.005")).toBe(1001n);
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
    expect(fromPaisa(toPaisa("-3.5"))).toBe("-3.50");
  });
  it("rejects garbage", () => {
    expect(() => toPaisa("12abc")).toThrow();
    expect(() => toMilli("")).toThrow();
  });
  it("computes line totals and percentages exactly", () => {
    expect(lineTotal(toMilli("2.5"), toPaisa("333.33"))).toBe(toPaisa("833.33")); // 833.325 -> .33
    expect(applyBp(toPaisa("100000"), toBp("5"))).toBe(toPaisa("5000"));
    expect(fromMilli(2500n)).toBe("2.5");
    expect(fromMilli(0n)).toBe("0");
  });
  it("formats BDT with lakh/crore grouping", () => {
    expect(formatBDT("1234567.5")).toBe("৳12,34,567.50");
    expect(formatBDT("999")).toBe("৳999.00");
    expect(formatBDT("-1000")).toBe("-৳1,000.00");
  });
});

describe("matrix toolkit", () => {
  it("multiplies and transposes", () => {
    const a = [[1, 2], [3, 4]];
    const b = [[0, 1], [1, 0]];
    expect(matMul(a, b)).toEqual([[2, 1], [4, 3]]);
    expect(matMul(a, identity(2))).toEqual(a);
    expect(transpose([[1, 2, 3]])).toEqual([[1], [2], [3]]);
    expect(matVec(a, [1, 1])).toEqual([3, 7]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(dotBig([2n, 3n], [5n, 7n])).toBe(31n);
  });
  it("solves a linear system", () => {
    const x = solve([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8);
    expect(x[1]).toBeCloseTo(1.4);
    expect(() => solve([[1, 2], [2, 4]], [1, 2])).toThrow();
  });
  it("rejects dimension mismatch", () => {
    expect(() => matMul([[1, 2]], [[1, 2]])).toThrow();
  });
});

describe("load calculation engine", () => {
  it("150 kW is NOT mapped to a fixed rating — depends on pf, demand and margin", () => {
    const a = calculateLoad({ rows: rowsFromTotal(150, "residential") }); // pf .85, df .6
    const b = calculateLoad({ rows: [{ name: "x", kw: 150, pf: 0.8, demandFactor: 1 }] });
    expect(a.recommendedKva).not.toBe(b.recommendedKva);
    expect(a.maxDemandKw).toBeCloseTo(90, 1);
    expect(a.apparentKva).toBeCloseTo(90 / 0.85, 1);
  });
  it("computes the full chain for a known case", () => {
    const r = calculateLoad({ rows: [{ name: "Load", kw: 120, pf: 0.8, demandFactor: 1 }], expansionPct: 20 });
    // S = 150 kVA; design = 150*1.2/0.8 = 225 -> 250 kVA
    expect(r.apparentKva).toBeCloseTo(150, 1);
    expect(r.designKva).toBeCloseTo(225, 1);
    expect(r.recommendedKva).toBe(250);
    expect(r.loadingPct).toBeCloseTo(60, 0);
    expect(r.lvCurrentA).toBeCloseTo((150000) / (Math.sqrt(3) * 400), 1);
    expect(r.pfiKvar).toBeGreaterThan(0);
    expect(r.status).toBe("preliminary");
  });
  it("PF correction reduces the apparent power and the PFI size is a multiple of the step", () => {
    const base = { rows: [{ name: "Motors", kw: 400, pf: 0.75, demandFactor: 0.9 }] };
    const un = calculateLoad(base);
    const co = calculateLoad({ ...base, includePfCorrection: true });
    expect(co.designKva).toBeLessThan(un.designKva);
    expect(un.pfiKvar! % DEFAULT_RULES.pfiStepKvar).toBe(0);
    expect(co.correctedKva).toBeLessThan(un.apparentKva);
  });
  it("uses parallel units above the largest rating", () => {
    const r = calculateLoad({ rows: [{ name: "Big", kw: 3000, pf: 0.9, demandFactor: 1 }] });
    expect(r.units).toBeGreaterThanOrEqual(2);
    expect(r.totalInstalledKva!).toBeGreaterThanOrEqual(r.designKva);
    expect(r.warnings.join(" ")).toMatch(/parallel/i);
  });
  it("reports multi-row matrix and validates inputs", () => {
    const r = calculateLoad({ rows: [{ name: "A", kw: 10, pf: 0.9, demandFactor: 0.5 }, { name: "B", kw: 20, qty: 2, pf: 0.8, demandFactor: 1 }] });
    expect(r.connectedKw).toBe(50);
    expect(r.matrix.data).toHaveLength(2);
    expect(() => calculateLoad({ rows: [{ name: "A", kw: 10, pf: 1.5, demandFactor: 1 }] })).toThrow();
    expect(calculateLoad({ rows: [] }).ok).toBe(false);
  });
});

describe("pricing engine", () => {
  const items = [
    { name: "Transformer", unit: "nos", qty: 1, unitPrice: "100000", costPrice: "90000" },
    { name: "Cable", unit: "m", qty: "12.5", unitPrice: "1800.50", costPrice: "1500" },
  ];
  it("computes exact totals with discount, charges and tax", () => {
    const t = computeTotals(items, { discountType: "percent", discountValue: 5, labourCharge: "10000", transportCharge: "5000", taxPercent: 15 });
    expect(fromPaisa(t.subtotal)).toBe("122506.25"); // 100000 + 12.5*1800.50 = 22506.25
    expect(fromPaisa(t.quotationDiscount)).toBe("6125.31"); // 5% of 122506.25 = 6125.3125
    expect(fromPaisa(t.taxable)).toBe("131380.94");
    expect(fromPaisa(t.total)).toBe(fromPaisa(t.taxable + t.tax));
  });
  it("is stable for classic float traps", () => {
    const t = computeTotals([{ name: "x", unit: "nos", qty: 3, unitPrice: "0.1" }, { name: "y", unit: "nos", qty: 3, unitPrice: "0.2" }]);
    expect(fromPaisa(t.total)).toBe("0.90");
  });
  it("price change does not alter totals computed from stored snapshot prices", () => {
    const original = computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "100000" }]);
    const afterPriceDrop = computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "95000" }]);
    expect(fromPaisa(original.total)).toBe("100000.00");
    expect(fromPaisa(afterPriceDrop.total)).toBe("95000.00");
  });
  it("flags low margin and handles fixed discounts and item discounts", () => {
    const t = computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "100000", costPrice: "98000", discountType: "fixed", discountValue: 500 }], { minMarginPercent: 8 });
    expect(fromPaisa(t.itemDiscounts)).toBe("500.00");
    expect(t.marginWarning).toBe(true);
  });
  it("caps fixed discount at the base and validates", () => {
    const t = computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "100" }], { discountType: "fixed", discountValue: 9999 });
    expect(t.total).toBe(0n);
    expect(() => computeTotals([{ name: "T", unit: "nos", qty: 0, unitPrice: "1" }])).toThrow();
    expect(() => computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "-1" }])).toThrow();
    expect(() => computeTotals([{ name: "T", unit: "nos", qty: 1, unitPrice: "1" }], { discountType: "percent", discountValue: 120 })).toThrow();
  });
});

describe("revision diff", () => {
  it("detects added, removed and changed lines", () => {
    const a = [{ sku: "A", name: "A", qty: "1", unit_price: "100", line_total: "100" }, { sku: "B", name: "B", qty: "1", unit_price: "50", line_total: "50" }];
    const b = [{ sku: "A", name: "A", qty: "2", unit_price: "100", line_total: "200" }, { sku: "C", name: "C", qty: "1", unit_price: "10", line_total: "10" }];
    const d = diffItems(a, b);
    expect(d.map((x) => x.kind).sort()).toEqual(["added", "changed", "removed"]);
  });
});

describe("timezone date", () => {
  it("uses the business timezone, not UTC", () => {
    const t = new Date("2026-03-01T20:30:00Z"); // 02:30 on 2 Mar in Dhaka (UTC+6)
    expect(todayIn("Asia/Dhaka", t)).toBe("2026-03-02");
    expect(todayIn("UTC", t)).toBe("2026-03-01");
  });
});
