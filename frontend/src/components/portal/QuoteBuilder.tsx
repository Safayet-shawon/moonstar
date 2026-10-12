"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calculator, Check, Loader2, PackagePlus, Plus, Save, Search, Trash2 } from "lucide-react";
import { formatBDT, toPaisa, type EngineeringRules, type LoadResult } from "@moonstar/shared";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";
import ProjectForm from "./ProjectForm";

type Project = { id: string; name: string; area_name: string; housing_name: string | null; client_name: string | null; house_no: string | null; road_no: string | null; total_load_kw: string | null; category: string; engineer_name?: string | null };
type Product = { id: string; sku: string; name: string; unit: string; price: string; capacity_kva: string | null; capacity_kvar: string | null; category_key: string; category_name: string };
type Item = { key: string; productId: string | null; sku: string | null; name: string; unit: string; qty: string; unitPrice: string; catalogPrice: string | null; discountType: "none" | "percent" | "fixed"; discountValue: string; description: string; priceTouched?: boolean };
type LoadRowS = { name: string; kw: string; qty: string; pf: string; demandFactor: string };
type Preview = { lines: { lineTotal: string; unitPrice: string }[]; totals: { subtotal: string; itemDiscounts: string; quotationDiscount: string; charges: string; tax: string; total: string; marginPct: string | null; marginWarning: boolean; exceptionalDiscount: boolean } };

export type BuilderInitial = {
  project?: Project;
  techInput?: Record<string, unknown>;
  override?: { recommendedKva: number; units: number; reason: string } | null;
  items?: { productId: string | null; sku: string | null; name: string; unit: string; qty: string; unit_price: string; discount_type: string; discount_value: string; description: string | null }[];
  commercial?: Record<string, unknown>;
  catalogPrices?: Record<string, string>;
};

const SOLUTIONS = [["substation", "Substation"], ["transformer", "Transformer"], ["panels", "HT/LT panels"], ["pfi", "PFI panel"], ["generator", "Diesel generator"], ["solar", "Solar"], ["lift", "Lift"]];
const uid = () => Math.random().toString(36).slice(2);
const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
const fmt = (v: string | undefined) => (v === undefined ? "—" : formatBDT(toPaisa(v)));
const asStr = (v: unknown, d = "") => (v === undefined || v === null ? d : String(v));

function Sec({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-forest-900"><span className="grid size-7 place-items-center rounded-full bg-forest-900 text-xs font-bold text-white">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

export default function QuoteBuilder({ mode, quotationId, initial, perms, rules, defaults }: { mode: "new" | "edit"; quotationId?: string; initial?: BuilderInitial; perms: string[]; rules: EngineeringRules; defaults: { validityDays: number; paymentTerms: string; taxPercent: string } }) {
  const router = useRouter();
  const can = (p: string) => perms.includes(p);
  const ti = (initial?.techInput ?? {}) as Record<string, unknown>;
  const ex = (ti.extras ?? {}) as Record<string, string>;
  const com = (initial?.commercial ?? {}) as Record<string, unknown>;

  /* ---------------- project ---------------- */
  const [project, setProject] = useState<Project | null>(initial?.project ?? null);
  const [pq, setPq] = useState("");
  const [pResults, setPResults] = useState<Project[]>([]);
  const [newProject, setNewProject] = useState(false);
  useEffect(() => {
    if (mode === "edit" || project) return;
    const ctl = new AbortController();
    const t = setTimeout(() => api.get<{ rows: Project[] }>(`/portal/projects?q=${encodeURIComponent(pq)}&limit=8`, ctl.signal).then((r) => setPResults(r.rows)).catch(() => {}), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [pq, project, mode]);

  /* ---------------- technical ---------------- */
  const [solutions, setSolutions] = useState<string[]>((ti.solutions as string[]) ?? ["substation"]);
  const [tmode, setTmode] = useState<"quick" | "detailed">((ti.mode as "quick" | "detailed") ?? "quick");
  const [category, setCategory] = useState(asStr(ti.category, project?.category && rules.categories[project.category] ? project.category : "residential"));
  const [totalKw, setTotalKw] = useState(asStr(ti.totalKw, project?.total_load_kw ?? ""));
  const [pf, setPf] = useState(asStr(ti.pf));
  const [df, setDf] = useState(asStr(ti.demandFactor));
  const [rows, setRows] = useState<LoadRowS[]>(((ti.rows as { name: string; kw: number; qty?: number; pf: number; demandFactor: number }[]) ?? [{ name: "Lighting & general", kw: 0, qty: 1, pf: 0.9, demandFactor: 0.7 }]).map((r) => ({ name: r.name, kw: String(r.kw || ""), qty: String(r.qty ?? 1), pf: String(r.pf), demandFactor: String(r.demandFactor) })));
  const [diversity, setDiversity] = useState(asStr(ti.diversityFactor, "1"));
  const [expansion, setExpansion] = useState(asStr(ti.expansionPct, String(rules.defaultExpansionPct)));
  const [targetPf, setTargetPf] = useState(asStr(ti.targetPf, String(rules.defaultTargetPf)));
  const [includePf, setIncludePf] = useState(Boolean(ti.includePfCorrection));
  const [voltage, setVoltage] = useState(asStr(ti.systemVoltage, "11 kV / 0.4 kV"));
  const [substation, setSubstation] = useState(asStr(ti.substation, "new"));
  const [arrangement, setArrangement] = useState(asStr(ti.transformerArrangement));
  const [techNotes, setTechNotes] = useState(asStr(ti.notes));
  const [extras, setExtras] = useState<Record<string, string>>(ex);
  const setEx = (k: string, v: string) => setExtras((e) => ({ ...e, [k]: v }));

  const techInput = useMemo(() => ({
    mode: tmode, category, totalKw: num(totalKw), pf: num(pf), demandFactor: num(df),
    rows: tmode === "detailed" ? rows.map((r) => ({ name: r.name || "Load", kw: Number(r.kw) || 0, qty: Number(r.qty) || 1, pf: Number(r.pf) || 0.9, demandFactor: Number(r.demandFactor) || 1 })) : undefined,
    diversityFactor: num(diversity), expansionPct: num(expansion), targetPf: num(targetPf), includePfCorrection: includePf,
    solutions, systemVoltage: voltage, substation: substation as "new" | "existing" | "na", transformerArrangement: arrangement, notes: techNotes, extras,
  }), [tmode, category, totalKw, pf, df, rows, diversity, expansion, targetPf, includePf, solutions, voltage, substation, arrangement, techNotes, extras]);

  const needsLoad = solutions.some((s) => ["substation", "transformer", "pfi", "panels"].includes(s));
  const hasLoad = tmode === "quick" ? Number(totalKw) > 0 : rows.some((r) => Number(r.kw) > 0);
  const calcActive = needsLoad && hasLoad;
  const [calcRaw, setCalc] = useState<LoadResult | null>(null);
  const [calcErrRaw, setCalcErr] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const calc = calcActive ? calcRaw : null; // derived: nothing to reset when inputs are cleared
  const calcErr = calcActive ? calcErrRaw : "";
  useEffect(() => {
    if (!calcActive) return;
    const t = setTimeout(() => {
      setCalcBusy(true);
      api.post<{ result: LoadResult | null }>("/portal/calc", techInput)
        .then((r) => { setCalc(r.result); setCalcErr(""); })
        .catch((e) => { setCalc(null); setCalcErr(errMsg(e)); })
        .finally(() => setCalcBusy(false));
    }, 450);
    return () => clearTimeout(t);
  }, [techInput, calcActive]);

  const [ovOn, setOvOn] = useState(Boolean(initial?.override));
  const [ovKva, setOvKva] = useState(String(initial?.override?.recommendedKva ?? ""));
  const [ovUnits, setOvUnits] = useState(String(initial?.override?.units ?? 1));
  const [ovReason, setOvReason] = useState(initial?.override?.reason ?? "");

  /* ---------------- items ---------------- */
  const [items, setItems] = useState<Item[]>(
    (initial?.items ?? []).map((i) => ({ key: uid(), productId: i.productId, sku: i.sku, name: i.name, unit: i.unit, qty: String(Number(i.qty)), unitPrice: i.unit_price, catalogPrice: i.productId ? initial?.catalogPrices?.[i.productId] ?? null : null, discountType: (i.discount_type as Item["discountType"]) ?? "none", discountValue: String(Number(i.discount_value || 0)), description: i.description ?? "" })),
  );
  const [sq, setSq] = useState("");
  const [sResults, setSResults] = useState<Product[]>([]);
  const [sOpen, setSOpen] = useState(false);
  useEffect(() => {
    if (!sOpen) return;
    const ctl = new AbortController();
    const t = setTimeout(() => api.get<{ rows: Product[] }>(`/portal/products?active=1&pageSize=10&q=${encodeURIComponent(sq)}`, ctl.signal).then((r) => setSResults(r.rows)).catch(() => {}), 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [sq, sOpen]);

  const addProduct = (p: Product, qty = "1") => setItems((cur) => {
    const ix = cur.findIndex((c) => c.productId === p.id);
    if (ix >= 0) return cur.map((c, i) => (i === ix ? { ...c, qty: String(Number(c.qty) + Number(qty)) } : c));
    return [...cur, { key: uid(), productId: p.id, sku: p.sku, name: p.name, unit: p.unit, qty, unitPrice: p.price, catalogPrice: p.price, discountType: "none", discountValue: "0", description: "" }];
  });
  const patchItem = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const [suggestMsg, setSuggestMsg] = useState("");
  async function suggest() {
    if (!calc?.recommendedKva) return;
    setSuggestMsg("");
    try {
      const kva = ovOn && Number(ovKva) > 0 ? Number(ovKva) : calc.recommendedKva;
      const units = ovOn && Number(ovUnits) > 0 ? Number(ovUnits) : calc.units;
      const tr = await api.get<{ rows: Product[] }>("/portal/products?active=1&category=transformer&pageSize=100");
      const hit = tr.rows.find((p) => Number(p.capacity_kva) === kva);
      const added: string[] = [];
      if (hit) { addProduct(hit, String(units)); added.push(`${units} × ${hit.name}`); } else setSuggestMsg(`No active ${kva} kVA transformer in the catalogue; add one in Products & Price Book or enter a custom item.`);
      if (calc.pfiKvar) {
        const pfi = await api.get<{ rows: Product[] }>("/portal/products?active=1&category=pfi_panel&pageSize=100");
        const best = pfi.rows.filter((p) => Number(p.capacity_kvar) >= calc.pfiKvar!).sort((a, b) => Number(a.capacity_kvar) - Number(b.capacity_kvar))[0];
        if (best) { addProduct(best); added.push(best.name); }
      }
      if (added.length) setSuggestMsg(`Added: ${added.join("; ")}`);
    } catch (e) { setSuggestMsg(errMsg(e)); }
  }

  /* ---------------- commercial ---------------- */
  const [discType, setDiscType] = useState(asStr(com.discountType, "none"));
  const [discVal, setDiscVal] = useState(asStr(com.discountValue, "0"));
  const [labour, setLabour] = useState(asStr(com.labourCharge, "0"));
  const [transport, setTransport] = useState(asStr(com.transportCharge, "0"));
  const [other, setOther] = useState(asStr(com.otherCharge, "0"));
  const [tax, setTax] = useState(asStr(com.taxPercent, defaults.taxPercent));
  const [validity, setValidity] = useState(asStr(com.validityDays, String(defaults.validityDays)));
  const [payment, setPayment] = useState(asStr(com.paymentTerms, defaults.paymentTerms));
  const [cnotes, setCnotes] = useState(asStr(com.notes));
  const [reason, setReason] = useState("");

  const buildPayload = useCallback(() => ({
    projectId: project?.id,
    techInput,
    override: ovOn && can("quotation.override_technical") ? { recommendedKva: Number(ovKva), units: Number(ovUnits) || 1, reason: ovReason } : null,
    items: items.map((i) => ({
      productId: i.productId, name: i.name, description: i.description || null, unit: i.unit, qty: i.qty || "0",
      ...(!i.productId || (can("quotation.manual_price") && i.priceTouched) ? { unitPrice: i.unitPrice || "0" } : {}),
      discountType: i.discountType, discountValue: i.discountValue || "0",
    })),
    commercial: { discountType: discType, discountValue: discVal || "0", labourCharge: labour || "0", transportCharge: transport || "0", otherCharge: other || "0", taxPercent: tax || "0", validityDays: Number(validity) || undefined, paymentTerms: payment, notes: cnotes },
    reason: reason || undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [project, techInput, ovOn, ovKva, ovUnits, ovReason, items, discType, discVal, labour, transport, other, tax, validity, payment, cnotes, reason]);

  const [previewRaw, setPreview] = useState<Preview | null>(null);
  const [prevErrRaw, setPrevErr] = useState("");
  const previewActive = Boolean(project) && items.length > 0;
  const preview = previewActive ? previewRaw : null;
  const prevErr = previewActive ? prevErrRaw : "";
  useEffect(() => {
    if (!previewActive) return;
    const t = setTimeout(() => {
      api.post<Preview>("/portal/quote-preview", buildPayload()).then((r) => { setPreview(r); setPrevErr(""); }).catch((e) => { setPreview(null); setPrevErr(errMsg(e)); });
    }, 500);
    return () => clearTimeout(t);
  }, [buildPayload, previewActive]);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  async function save() {
    setSaving(true); setSaveErr("");
    try {
      const r = mode === "edit" ? await api.put<{ id: string }>(`/portal/quotations/${quotationId}`, buildPayload()) : await api.post<{ id: string }>("/portal/quotations", buildPayload());
      router.push(`/portal/quotations/${r.id}`);
      router.refresh();
    } catch (e) { setSaveErr(errMsg(e)); setSaving(false); }
  }

  const toggleSolution = (k: string) => setSolutions((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const cat = rules.categories[category];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* 1 PROJECT */}
        <Sec n={1} title="Project">
          {project ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-paper p-4">
              <div>
                <p className="text-lg font-bold text-forest-900">{project.name}</p>
                <p className="text-sm text-steel-600">{project.area_name}{project.housing_name ? ` › ${project.housing_name}` : ""}{project.house_no ? ` · House ${project.house_no}` : ""}{project.road_no ? ` · Road ${project.road_no}` : ""}</p>
                <p className="text-sm text-steel-600">{project.client_name ?? "No client recorded"}{project.total_load_kw ? ` · ${Number(project.total_load_kw)} kW connected load` : ""}</p>
              </div>
              {mode === "new" && <Button variant="ghost" size="sm" onClick={() => { setProject(null); setPResults([]); }}>Change</Button>}
            </div>
          ) : newProject ? (
            <div><ProjectForm canCreate={can("project.create")} redirectTo="" onSaved={async (id) => { const d = await api.get<{ project: Project }>(`/portal/projects/${id}`); setProject(d.project); setNewProject(false); if (d.project.total_load_kw && !totalKw) setTotalKw(String(Number(d.project.total_load_kw))); }} /><Button variant="ghost" size="sm" className="mt-3" onClick={() => setNewProject(false)}>Cancel</Button></div>
          ) : (
            <div>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-steel-500" /><input className="field pl-9" placeholder="Search project, area, housing, house no., road no. or quotation no." value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Search projects" /></div>
              <ul className="mt-3 divide-y divide-steel-100 rounded-lg border border-steel-200">
                {pResults.map((p) => (
                  <li key={p.id}><button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-paper" onClick={() => { setProject(p); if (p.total_load_kw && !totalKw) setTotalKw(String(Number(p.total_load_kw))); if (rules.categories[p.category]) setCategory(p.category); }}>
                    <span><b className="text-forest-900">{p.name}</b><span className="block text-xs text-steel-500">{p.area_name}{p.housing_name ? ` › ${p.housing_name}` : ""}{p.client_name ? ` · ${p.client_name}` : ""}</span></span><Check className="size-4 text-steel-300" />
                  </button></li>
                ))}
                {pResults.length === 0 && <li className="px-4 py-3 text-sm text-steel-500">No matching projects.</li>}
              </ul>
              {can("project.create") && <Button variant="fabric-light" size="sm" className="mt-3" onClick={() => setNewProject(true)}><Plus className="size-4" />Create a new project</Button>}
            </div>
          )}
        </Sec>

        {/* 2 TECHNICAL */}
        <Sec n={2} title="Technical requirements">
          <fieldset className="mb-5"><legend className="label">Solutions required</legend>
            <div className="flex flex-wrap gap-2">{SOLUTIONS.map(([k, l]) => <button key={k} type="button" aria-pressed={solutions.includes(k)} onClick={() => toggleSolution(k)} className={`btn btn-sm ${solutions.includes(k) ? "btn-clay-navy" : "btn-ghost"}`}>{l}</button>)}</div>
          </fieldset>

          {needsLoad && (
            <div className="space-y-5">
              <div className="flex gap-2" role="tablist" aria-label="Load input mode">
                {(["quick", "detailed"] as const).map((m) => <button key={m} role="tab" aria-selected={tmode === m} onClick={() => setTmode(m)} className={`btn btn-sm ${tmode === m ? "btn-fabric" : "btn-ghost"}`}>{m === "quick" ? "Quick (total load)" : "Detailed load schedule"}</button>)}
              </div>
              {tmode === "quick" ? (
                <div className="grid gap-4 sm:grid-cols-4">
                  <div><label className="label" htmlFor="b-cat">Load category</label><select id="b-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(rules.categories).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>
                  <div><label className="label" htmlFor="b-kw">Total load (kW) *</label><input id="b-kw" className="field" inputMode="decimal" value={totalKw} onChange={(e) => setTotalKw(e.target.value)} /></div>
                  <div><label className="label" htmlFor="b-pf">Power factor</label><input id="b-pf" className="field" inputMode="decimal" value={pf} placeholder={`default ${cat?.pf ?? 0.9}`} onChange={(e) => setPf(e.target.value)} /></div>
                  <div><label className="label" htmlFor="b-df">Demand factor</label><input id="b-df" className="field" inputMode="decimal" value={df} placeholder={`default ${cat?.demandFactor ?? 1}`} onChange={(e) => setDf(e.target.value)} /></div>
                </div>
              ) : (
                <div className="table-wrap"><table className="tbl"><thead><tr><th>Load group</th><th>kW each</th><th>Qty</th><th>PF</th><th>Demand f.</th><th /></tr></thead><tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>{(["name", "kw", "qty", "pf", "demandFactor"] as const).map((f) => <td key={f}><input aria-label={f} className="field min-h-9 py-1" value={r[f]} inputMode={f === "name" ? "text" : "decimal"} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)))} /></td>)}
                      <td><button aria-label="Remove row" onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))} disabled={rows.length === 1}><Trash2 className="size-4 text-bad" /></button></td></tr>
                  ))}</tbody></table>
                  <div className="p-2"><Button variant="fabric-light" size="sm" onClick={() => setRows((c) => [...c, { name: "", kw: "", qty: "1", pf: "0.9", demandFactor: "0.8" }])}><Plus className="size-4" />Add load group</Button></div></div>
              )}
              <div className="grid gap-4 sm:grid-cols-4">
                <div><label className="label" htmlFor="b-div">Diversity factor</label><input id="b-div" className="field" value={diversity} inputMode="decimal" onChange={(e) => setDiversity(e.target.value)} /></div>
                <div><label className="label" htmlFor="b-exp">Future expansion (%)</label><input id="b-exp" className="field" value={expansion} inputMode="decimal" onChange={(e) => setExpansion(e.target.value)} /></div>
                <div><label className="label" htmlFor="b-tpf">Target power factor</label><input id="b-tpf" className="field" value={targetPf} inputMode="decimal" onChange={(e) => setTargetPf(e.target.value)} /></div>
                <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold text-forest-800"><input type="checkbox" className="size-4 accent-brand-500" checked={includePf} onChange={(e) => setIncludePf(e.target.checked)} />Size on PF-corrected kVA</label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className="label" htmlFor="b-v">System voltage</label><input id="b-v" className="field" value={voltage} onChange={(e) => setVoltage(e.target.value)} /></div>
                <div><label className="label" htmlFor="b-sub">Substation</label><select id="b-sub" className="field" value={substation} onChange={(e) => setSubstation(e.target.value)}><option value="new">New substation</option><option value="existing">Existing substation</option><option value="na">Not applicable</option></select></div>
                <div><label className="label" htmlFor="b-arr">Transformer arrangement</label><input id="b-arr" className="field" value={arrangement} placeholder="e.g. 1 × oil-filled, outdoor" onChange={(e) => setArrangement(e.target.value)} /></div>
              </div>

              {/* RESULT */}
              <div className="rounded-xl border border-forest-800/20 bg-forest-900 p-5 text-white" aria-live="polite">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><Calculator className="size-5 text-brand-400" />Engineering calculation</h3><span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">PRELIMINARY · awaiting technical approval</span></div>
                {calcBusy && !calc && <p className="flex items-center gap-2 text-sm text-steel-300"><Loader2 className="size-4 animate-spin" />Calculating…</p>}
                {calcErr && <p className="text-sm font-semibold text-red-300">{calcErr}</p>}
                {!calc && !calcBusy && !calcErr && <p className="text-sm text-steel-300">Enter the load to see the recommendation.</p>}
                {calc && calc.ok && (
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      {[["Connected load", `${calc.connectedKw} kW`], ["Max demand", `${calc.maxDemandKw} kW / ${calc.maxDemandKvar} kVAR`], ["Apparent power", `${calc.apparentKva} kVA`], ["System PF", String(calc.systemPf)], ["Design kVA", String(calc.designKva)], ["HT current", `${calc.htCurrentA} A`], ["LV current", `${calc.lvCurrentA} A`], ["LV cable (indicative)", calc.lvCable]].map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wide text-steel-300">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
                    </dl>
                    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white/10 p-4">
                      <div><p className="text-[11px] uppercase tracking-wide text-steel-300">Recommended transformer</p><p className="font-display text-3xl font-extrabold text-brand-400">{calc.recommendedKva ? `${calc.units > 1 ? `${calc.units} × ` : ""}${calc.recommendedKva} kVA` : "Custom design"}</p><p className="text-xs text-steel-300">Loading ≈ {calc.loadingPct ?? "—"}% of {calc.totalInstalledKva ?? "—"} kVA installed</p></div>
                      {calc.pfiKvar !== null && <div><p className="text-[11px] uppercase tracking-wide text-steel-300">PFI bank</p><p className="font-display text-2xl font-extrabold">{calc.pfiKvar} kVAR</p></div>}
                      <div className="ml-auto"><Button variant="clay" size="sm" onClick={suggest} disabled={!calc.recommendedKva}><PackagePlus className="size-4" />Add recommended equipment</Button></div>
                    </div>
                    {suggestMsg && <p className="text-sm text-steel-200">{suggestMsg}</p>}
                    <p className="text-xs text-steel-300"><b className="text-white">Rule applied:</b> {calc.rule}</p>
                    <details className="text-sm"><summary className="cursor-pointer font-semibold text-steel-200">Load matrix &amp; assumptions</summary>
                      <div className="mt-2 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-steel-300"><th className="py-1 pr-3">Load</th>{calc.matrix.cols.map((c) => <th key={c} className="pr-3 text-right">{c}</th>)}</tr></thead><tbody>{calc.matrix.rows.map((r, i) => <tr key={i} className="border-t border-white/10"><td className="py-1 pr-3">{r}</td>{calc.matrix.data[i].map((v, j) => <td key={j} className="pr-3 text-right tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-steel-300">{calc.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
                    <ul className="space-y-1 text-sm">{calc.warnings.map((w) => <li key={w} className="flex gap-2 text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</li>)}</ul>
                  </div>
                )}
              </div>

              {can("quotation.override_technical") && calc?.ok && (
                <div className="rounded-lg border border-steel-200 p-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-forest-900"><input type="checkbox" className="size-4 accent-brand-500" checked={ovOn} onChange={(e) => setOvOn(e.target.checked)} />Engineer override of the recommendation</label>
                  {ovOn && <div className="mt-3 grid gap-3 sm:grid-cols-4"><div><label className="label" htmlFor="ov-k">Rating (kVA)</label><input id="ov-k" className="field" inputMode="decimal" value={ovKva} onChange={(e) => setOvKva(e.target.value)} /></div><div><label className="label" htmlFor="ov-u">Units</label><input id="ov-u" className="field" inputMode="numeric" value={ovUnits} onChange={(e) => setOvUnits(e.target.value)} /></div><div className="sm:col-span-2"><label className="label" htmlFor="ov-r">Reason (recorded, min 10 chars) *</label><input id="ov-r" className="field" value={ovReason} onChange={(e) => setOvReason(e.target.value)} /></div></div>}
                </div>
              )}
            </div>
          )}

          {solutions.includes("generator") && <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><label className="label">Generator rating (kVA)</label><input className="field" value={extras.generatorKva ?? ""} onChange={(e) => setEx("generatorKva", e.target.value)} /></div><div><label className="label">ATS panel</label><select className="field" value={extras.ats ?? ""} onChange={(e) => setEx("ats", e.target.value)}><option value="">—</option><option>Required</option><option>Not required</option></select></div><div><label className="label">Duty</label><select className="field" value={extras.duty ?? ""} onChange={(e) => setEx("duty", e.target.value)}><option value="">—</option><option>Standby</option><option>Prime</option></select></div></div>}
          {solutions.includes("solar") && <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><label className="label">System size (kWp)</label><input className="field" value={extras.solarKw ?? ""} onChange={(e) => setEx("solarKw", e.target.value)} /></div><div><label className="label">Type</label><select className="field" value={extras.solarType ?? ""} onChange={(e) => setEx("solarType", e.target.value)}><option value="">—</option><option>On-grid</option><option>Off-grid</option><option>Hybrid</option></select></div><div><label className="label">Roof area (sq ft)</label><input className="field" value={extras.roofArea ?? ""} onChange={(e) => setEx("roofArea", e.target.value)} /></div></div>}
          {solutions.includes("lift") && <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><label className="label">Number of lifts</label><input className="field" value={extras.lifts ?? ""} onChange={(e) => setEx("lifts", e.target.value)} /></div><div><label className="label">Stops / floors</label><input className="field" value={extras.stops ?? ""} onChange={(e) => setEx("stops", e.target.value)} /></div><div><label className="label">Capacity (persons)</label><input className="field" value={extras.capacity ?? ""} onChange={(e) => setEx("capacity", e.target.value)} /></div></div>}
          <div className="mt-5"><label className="label" htmlFor="b-tn">Technical notes</label><textarea id="b-tn" className="field" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} /></div>
        </Sec>

        {/* 3 ITEMS */}
        <Sec n={3} title="Equipment & line items">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-steel-500" />
            <input className="field pl-9" placeholder="Search the product catalogue by name, SKU, brand…" value={sq} onFocus={() => setSOpen(true)} onChange={(e) => { setSq(e.target.value); setSOpen(true); }} aria-label="Search catalogue" />
            {sOpen && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-steel-200 bg-white shadow-xl">
                {sResults.map((p) => <button key={p.id} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper" onClick={() => { addProduct(p); setSOpen(false); setSq(""); }}><span><b className="text-forest-900">{p.name}</b><span className="block text-xs text-steel-500">{p.sku} · {p.category_name}</span></span><span className="shrink-0 font-semibold tabular-nums">{fmt(p.price)}</span></button>)}
                {sResults.length === 0 && <p className="px-4 py-3 text-sm text-steel-500">No active products match.</p>}
                <button className="w-full border-t border-steel-100 px-4 py-2 text-center text-xs font-bold text-steel-500 hover:bg-paper" onClick={() => setSOpen(false)}>Close</button>
              </div>
            )}
          </div>
          {can("quotation.manual_price") && <Button variant="fabric-light" size="sm" className="mt-3" onClick={() => setItems((c) => [...c, { key: uid(), productId: null, sku: null, name: "", unit: "nos", qty: "1", unitPrice: "", catalogPrice: null, discountType: "none", discountValue: "0", description: "" }])}><Plus className="size-4" />Add custom line</Button>}
          {items.length === 0 ? <p className="mt-4 text-sm text-steel-600">No items yet. Use the search above, or add the recommended equipment from the calculation.</p> : (
            <div className="table-wrap mt-4"><table className="tbl"><thead><tr><th>Item</th><th className="w-24">Qty</th><th className="w-36">Unit price</th>{can("quotation.discount") && <th className="w-44">Discount</th>}<th className="num w-36">Line total</th><th /></tr></thead><tbody>
              {items.map((i, ix) => (
                <tr key={i.key}>
                  <td>{i.productId ? <><b className="text-forest-900">{i.name}</b><p className="text-xs text-steel-500">{i.sku}</p></> : <input aria-label="Item name" className="field min-h-9 py-1" value={i.name} placeholder="Description" onChange={(e) => patchItem(i.key, { name: e.target.value })} />}
                    {i.productId && i.priceTouched && i.catalogPrice && i.unitPrice !== i.catalogPrice && <p className="text-xs font-semibold text-warn">Manual price (catalogue {fmt(i.catalogPrice)})</p>}</td>
                  <td><input aria-label={`Quantity for ${i.name}`} className="field min-h-9 py-1" inputMode="decimal" value={i.qty} onChange={(e) => patchItem(i.key, { qty: e.target.value })} /><p className="mt-0.5 text-xs text-steel-500">{i.unit}</p></td>
                  <td>{can("quotation.manual_price") || !i.productId ? <input aria-label="Unit price" className="field min-h-9 py-1" inputMode="decimal" value={i.unitPrice} onChange={(e) => patchItem(i.key, { unitPrice: e.target.value, priceTouched: true })} /> : <span className="tabular-nums">{fmt(preview?.lines[ix]?.unitPrice ?? i.unitPrice)}</span>}</td>
                  {can("quotation.discount") && <td><div className="flex gap-1"><select aria-label="Discount type" className="field min-h-9 w-20 px-1 py-1" value={i.discountType} onChange={(e) => patchItem(i.key, { discountType: e.target.value as Item["discountType"] })}><option value="none">None</option><option value="percent">%</option><option value="fixed">৳</option></select>{i.discountType !== "none" && <input aria-label="Discount value" className="field min-h-9 w-20 py-1" inputMode="decimal" value={i.discountValue} onChange={(e) => patchItem(i.key, { discountValue: e.target.value })} />}</div></td>}
                  <td className="num font-semibold">{preview?.lines[ix] ? fmt(preview.lines[ix].lineTotal) : "—"}</td>
                  <td><button aria-label={`Remove ${i.name}`} onClick={() => setItems((c) => c.filter((x) => x.key !== i.key))}><Trash2 className="size-4 text-bad" /></button></td>
                </tr>
              ))}</tbody></table></div>
          )}
        </Sec>

        {/* 4 COMMERCIAL */}
        <Sec n={4} title="Commercial terms">
          <div className="grid gap-4 sm:grid-cols-4">
            {can("quotation.discount") && <><div><label className="label" htmlFor="c-dt">Overall discount</label><select id="c-dt" className="field" value={discType} onChange={(e) => setDiscType(e.target.value)}><option value="none">None</option><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></div>
              {discType !== "none" && <div><label className="label" htmlFor="c-dv">{discType === "percent" ? "Percent" : "Amount (BDT)"}</label><input id="c-dv" className="field" inputMode="decimal" value={discVal} onChange={(e) => setDiscVal(e.target.value)} /></div>}</>}
            <div><label className="label" htmlFor="c-l">Labour &amp; installation</label><input id="c-l" className="field" inputMode="decimal" value={labour} onChange={(e) => setLabour(e.target.value)} /></div>
            <div><label className="label" htmlFor="c-t">Transport</label><input id="c-t" className="field" inputMode="decimal" value={transport} onChange={(e) => setTransport(e.target.value)} /></div>
            <div><label className="label" htmlFor="c-o">Other charges</label><input id="c-o" className="field" inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} /></div>
            <div><label className="label" htmlFor="c-x">Tax (%)</label><input id="c-x" className="field" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
            <div><label className="label" htmlFor="c-v">Validity (days)</label><input id="c-v" className="field" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value)} /></div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="c-p">Payment terms</label><textarea id="c-p" className="field" value={payment} onChange={(e) => setPayment(e.target.value)} /></div><div><label className="label" htmlFor="c-n">Notes on the quotation</label><textarea id="c-n" className="field" value={cnotes} onChange={(e) => setCnotes(e.target.value)} /></div></div>
          {mode === "edit" && <div className="mt-4"><label className="label" htmlFor="c-r">Reason for change (optional)</label><input id="c-r" className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
        </Sec>
      </div>

      {/* SUMMARY */}
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="card p-5">
          <h2 className="font-bold text-forest-900">Quotation summary</h2>
          <p className="mt-0.5 text-xs text-steel-500">Totals are calculated and verified on the server.</p>
          {prevErr && <div className="mt-3"><Notice tone="bad">{prevErr}</Notice></div>}
          <dl className="mt-4 space-y-2 text-sm">
            {[["Subtotal", preview?.totals.subtotal], ["Line discounts", preview?.totals.itemDiscounts], ["Overall discount", preview?.totals.quotationDiscount], ["Charges", preview?.totals.charges], ["Tax", preview?.totals.tax]].map(([k, v]) => <div key={k as string} className="flex justify-between"><dt className="text-steel-600">{k}</dt><dd className="tabular-nums">{fmt(v as string | undefined)}</dd></div>)}
            <div className="flex justify-between border-t border-steel-200 pt-3 text-base font-extrabold text-forest-900"><dt>Total</dt><dd className="tabular-nums">{fmt(preview?.totals.total)}</dd></div>
          </dl>
          {preview?.totals.marginPct && <p className="mt-3 text-xs text-steel-600">Margin on cost: <b>{preview.totals.marginPct}%</b></p>}
          {preview?.totals.marginWarning && <div className="mt-3"><Notice tone="warn">Margin is below the configured minimum. Review pricing before submitting.</Notice></div>}
          {preview?.totals.exceptionalDiscount && <div className="mt-3"><Notice tone="warn">Discount exceeds the standard threshold and will be flagged to approvers.</Notice></div>}
          {saveErr && <div className="mt-3"><Notice tone="bad">{saveErr}</Notice></div>}
          <Button variant="clay" size="lg" className="mt-5 w-full" onClick={save} disabled={saving || !project || items.length === 0}>{saving ? <><Loader2 className="size-4 animate-spin" />Saving…</> : <><Save className="size-4" />{mode === "edit" ? "Save draft" : "Save as draft"}</>}</Button>
          {!project && <p className="mt-2 text-xs text-steel-500">Select a project to continue.</p>}
          <p className="mt-3 text-xs text-steel-500">Drafts can be edited. Submit for approval from the quotation page.</p>
        </div>
      </aside>
    </div>
  );
}
