import { matMul, matVec } from "./matrix";

/**
 * Preliminary equipment-sizing engine. Every assumption is an input or a configurable rule
 * (stored in the `settings` table, key `engineering_rules`). The output is a PRELIMINARY
 * recommendation which a qualified engineer must review before issue.
 */
export type EngineeringRules = {
  transformerRatingsKva: number[];
  pfiStepKvar: number;
  maxTransformerLoadingPct: number;
  defaultExpansionPct: number;
  defaultTargetPf: number;
  defaultDiversity: number;
  htVoltageV: number;
  lvVoltageV: number;
  maxParallelUnits: number;
  cableTable: { currentA: number; label: string }[];
  cableSafetyFactor: number;
  categories: Record<string, { label: string; demandFactor: number; pf: number }>;
};

export const DEFAULT_RULES: EngineeringRules = {
  transformerRatingsKva: [100, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500],
  pfiStepKvar: 25,
  maxTransformerLoadingPct: 80,
  defaultExpansionPct: 20,
  defaultTargetPf: 0.95,
  defaultDiversity: 1,
  htVoltageV: 11000,
  lvVoltageV: 400,
  maxParallelUnits: 4,
  cableSafetyFactor: 1.25,
  cableTable: [
    { currentA: 100, label: "35 mm² Cu (3.5C)" },
    { currentA: 160, label: "70 mm² Cu (3.5C)" },
    { currentA: 250, label: "120 mm² Cu (3.5C)" },
    { currentA: 330, label: "185 mm² Cu (3.5C)" },
    { currentA: 420, label: "300 mm² Cu (3.5C)" },
    { currentA: 600, label: "2 × 185 mm² Cu per phase" },
    { currentA: 840, label: "2 × 300 mm² Cu per phase" },
    { currentA: 1260, label: "3 × 300 mm² Cu per phase" },
    { currentA: 1680, label: "4 × 300 mm² Cu per phase" },
    { currentA: 2520, label: "6 × 300 mm² Cu per phase" },
    { currentA: 3600, label: "Busduct — design required" },
  ],
  categories: {
    residential: { label: "Residential building", demandFactor: 0.6, pf: 0.85 },
    commercial: { label: "Commercial / office", demandFactor: 0.75, pf: 0.9 },
    industrial: { label: "Industrial (motor load)", demandFactor: 0.8, pf: 0.8 },
    mixed: { label: "Mixed use", demandFactor: 0.7, pf: 0.88 },
    custom: { label: "Custom (enter manually)", demandFactor: 1, pf: 0.9 },
  },
};

export type LoadRow = { name: string; kw: number; qty?: number; pf: number; demandFactor: number };

export type LoadInput = {
  rows: LoadRow[];
  diversityFactor?: number;
  expansionPct?: number;
  targetPf?: number;
  includePfCorrection?: boolean;
};

export type LoadResult = {
  ok: boolean;
  connectedKw: number;
  maxDemandKw: number;
  maxDemandKvar: number;
  apparentKva: number;
  systemPf: number;
  correctedKva: number | null;
  pfiKvar: number | null;
  designKva: number;
  recommendedKva: number | null;
  units: number;
  totalInstalledKva: number | null;
  loadingPct: number | null;
  htCurrentA: number;
  lvCurrentA: number;
  lvCable: string;
  rule: string;
  assumptions: string[];
  warnings: string[];
  matrix: { rows: string[]; cols: string[]; data: number[][] };
  status: "preliminary";
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateLoad(input: LoadInput, rules: EngineeringRules = DEFAULT_RULES): LoadResult {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const rows = input.rows.filter((r) => r.kw > 0 && (r.qty ?? 1) > 0);
  if (!rows.length) return emptyResult(["Enter at least one load with kW greater than zero."]);
  for (const r of rows) {
    if (!(r.pf > 0.3 && r.pf <= 1)) throw new Error(`Power factor for "${r.name}" must be between 0.3 and 1.0`);
    if (!(r.demandFactor > 0 && r.demandFactor <= 1)) throw new Error(`Demand factor for "${r.name}" must be between 0 and 1`);
  }
  const diversity = input.diversityFactor ?? rules.defaultDiversity;
  const expansion = input.expansionPct ?? rules.defaultExpansionPct;
  const targetPf = input.targetPf ?? rules.defaultTargetPf;
  if (!(diversity > 0 && diversity <= 1)) throw new Error("Diversity factor must be between 0 and 1");
  if (expansion < 0 || expansion > 200) throw new Error("Expansion margin must be between 0% and 200%");
  if (!(targetPf > 0.5 && targetPf <= 1)) throw new Error("Target power factor must be between 0.5 and 1.0");

  // Load matrix L (n × 3): [connected kW, demand factor, tan φ]
  const L = rows.map((r) => [r.kw * (r.qty ?? 1), r.demandFactor, Math.tan(Math.acos(r.pf))]);
  // Demand matrix D (n × 2): [P_i, Q_i] = [kW·DF, kW·DF·tanφ]
  const D = L.map(([kw, df, t]) => [kw * df, kw * df * t]);
  // Column totals = 1ᵀ · D, a (1×n)·(n×2) matrix product
  const ones = [new Array(rows.length).fill(1)];
  const totals = matMul(ones, D)[0];
  const connectedKw = matMul(ones, L.map((l) => [l[0]]))[0][0];
  // Diversity applied as the operator  δ·I₂  on the totals vector
  const [P, Q] = matVec([[diversity, 0], [0, diversity]], totals);
  const S = Math.hypot(P, Q);
  const pf = S > 0 ? P / S : 1;

  assumptions.push(`Demand factors applied per load row; diversity factor ${diversity}.`);
  assumptions.push(`Expansion margin ${expansion}%; target maximum transformer loading ${rules.maxTransformerLoadingPct}%.`);
  assumptions.push(`System: ${(rules.htVoltageV / 1000).toFixed(0)} kV / ${rules.lvVoltageV} V, three-phase.`);

  let basisKva = S;
  let correctedKva: number | null = null;
  let pfiKvar: number | null = null;
  if (pf < targetPf - 1e-9) {
    const qc = P * (Math.tan(Math.acos(pf)) - Math.tan(Math.acos(targetPf)));
    pfiKvar = Math.ceil(qc / rules.pfiStepKvar) * rules.pfiStepKvar;
    correctedKva = Math.hypot(P, Math.max(Q - pfiKvar, 0));
    warnings.push(
      `Uncorrected power factor is ${pf.toFixed(3)}; a ${pfiKvar} kVAR PFI bank would raise it to about ${(P / correctedKva).toFixed(3)}.`,
    );
    if (input.includePfCorrection) {
      basisKva = correctedKva;
      assumptions.push("Transformer sized on post-PF-correction apparent power (PFI panel assumed installed).");
    } else {
      assumptions.push("Transformer sized on uncorrected apparent power. Enable PF correction to size on corrected kVA.");
    }
  }

  const designKva = (basisKva * (1 + expansion / 100)) / (rules.maxTransformerLoadingPct / 100);

  const ratings = [...rules.transformerRatingsKva].sort((a, b) => a - b);
  let recommended: number | null = null;
  let units = 1;
  let rule = `Single unit: smallest standard rating ≥ design kVA (${r2(designKva)}).`;
  const single = ratings.find((x) => x >= designKva);
  if (single) {
    recommended = single;
  } else {
    let best: { r: number; n: number; total: number } | null = null;
    for (let n = 2; n <= rules.maxParallelUnits; n++) {
      const r = ratings.find((x) => x * n >= designKva);
      if (r && (!best || r * n < best.total)) best = { r, n, total: r * n };
    }
    if (best) {
      recommended = best.r;
      units = best.n;
      rule = `No single standard unit ≥ ${r2(designKva)} kVA; ${best.n} × ${best.r} kVA selected (smallest total).`;
      warnings.push("Multiple transformer units required — confirm parallel operation and fault level with the design engineer.");
    } else {
      rule = "Beyond configured rating table.";
      warnings.push(`Design requirement ${r2(designKva)} kVA exceeds configured ratings; custom engineering design is required.`);
    }
  }
  const installed = recommended ? recommended * units : null;
  const loadingPct = installed ? r2((basisKva / installed) * 100) : null;

  const htI = (basisKva * 1000) / (Math.sqrt(3) * rules.htVoltageV);
  const lvI = (basisKva * 1000) / (Math.sqrt(3) * rules.lvVoltageV);
  const cable = rules.cableTable.find((c) => c.currentA >= lvI * rules.cableSafetyFactor);
  if (!cable) warnings.push("LV current exceeds cable table; busduct / custom design needed.");
  if (rows.every((r) => r.demandFactor === 1)) warnings.push("All demand factors are 1.0 — confirm no diversity is available; this may oversize equipment.");
  if (pf < 0.8) warnings.push(`Low power factor (${pf.toFixed(2)}) — utility penalties may apply.`);
  warnings.push("Preliminary selection only. Final design requires approval by a qualified engineer and the relevant utility's requirements.");

  return {
    ok: true,
    connectedKw: r2(connectedKw),
    maxDemandKw: r2(P),
    maxDemandKvar: r2(Q),
    apparentKva: r2(S),
    systemPf: Math.round(pf * 1000) / 1000,
    correctedKva: correctedKva === null ? null : r2(correctedKva),
    pfiKvar,
    designKva: r2(designKva),
    recommendedKva: recommended,
    units,
    totalInstalledKva: installed,
    loadingPct,
    htCurrentA: r2(htI),
    lvCurrentA: r2(lvI),
    lvCable: cable?.label ?? "Custom design",
    rule,
    assumptions,
    warnings,
    matrix: {
      rows: rows.map((r) => r.name),
      cols: ["Connected kW", "Demand factor", "tan φ", "Demand kW", "Demand kVAR"],
      data: L.map((l, i) => [r2(l[0]), l[1], Math.round(l[2] * 1000) / 1000, r2(D[i][0]), r2(D[i][1])]),
    },
    status: "preliminary",
  };
}

function emptyResult(warnings: string[]): LoadResult {
  return {
    ok: false, connectedKw: 0, maxDemandKw: 0, maxDemandKvar: 0, apparentKva: 0, systemPf: 1, correctedKva: null,
    pfiKvar: null, designKva: 0, recommendedKva: null, units: 0, totalInstalledKva: null, loadingPct: null,
    htCurrentA: 0, lvCurrentA: 0, lvCable: "—", rule: "—", assumptions: [], warnings,
    matrix: { rows: [], cols: [], data: [] }, status: "preliminary",
  };
}

/** Build a single-row load from total kW + category defaults. */
export function rowsFromTotal(totalKw: number, category: string, pf?: number, df?: number, rules = DEFAULT_RULES): LoadRow[] {
  const c = rules.categories[category] ?? rules.categories.custom;
  return [{ name: c.label, kw: totalKw, pf: pf ?? c.pf, demandFactor: df ?? c.demandFactor }];
}
