"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg, ClientApiError } from "@/lib/client";
import { Notice } from "./ui";

export type Area = { id: string; name: string };
export type Housing = { id: string; name: string; area_id: string };
export type ProjectData = {
  id?: string; area_id?: string; housing_id?: string | null; name?: string; house_no?: string | null; road_no?: string | null; block?: string | null; client_name?: string | null;
  engineer_name?: string | null; engineer_phone?: string | null; address?: string | null; total_load_kw?: string | null; max_demand_kw?: string | null; category?: string; notes?: string | null;
};

const CATS = ["residential", "commercial", "industrial", "mixed", "institutional", "other"];

/** Area + housing selectors with inline creation (shared by the project form and the quotation builder). */
export function AreaHousingSelect({ areaId, housingId, onChange, canCreate, areas, setAreas, housings, setHousings }: {
  areaId: string; housingId: string; onChange: (a: string, h: string) => void; canCreate: boolean; areas: Area[]; setAreas: (a: Area[]) => void; housings: Housing[]; setHousings: (h: Housing[]) => void;
}) {
  const [err, setErr] = useState("");
  const add = async (kind: "area" | "housing") => {
    const name = window.prompt(kind === "area" ? "New area name (e.g. Mohammadpur)" : "New housing / development name");
    if (!name?.trim()) return;
    setErr("");
    try {
      if (kind === "area") {
        const { id } = await api.post<{ id: string }>("/portal/areas", { name });
        setAreas([...areas.filter((a) => a.id !== id), { id, name: name.trim() }].sort((x, y) => x.name.localeCompare(y.name)));
        onChange(id, "");
      } else {
        const { id } = await api.post<{ id: string }>("/portal/housings", { areaId, name });
        setHousings([...housings.filter((h) => h.id !== id), { id, name: name.trim(), area_id: areaId }]);
        onChange(areaId, id);
      }
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  const hs = housings.filter((h) => h.area_id === areaId);
  return (
    <>
      <div>
        <label className="label" htmlFor="ph-area">Area *</label>
        <div className="flex gap-2">
          <select id="ph-area" className="field" value={areaId} onChange={(e) => onChange(e.target.value, "")} required>
            <option value="">Select area</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {canCreate && <Button variant="fabric-light" size="sm" onClick={() => add("area")} aria-label="Add area"><Plus className="size-4" /></Button>}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ph-housing">Housing / development</label>
        <div className="flex gap-2">
          <select id="ph-housing" className="field" value={housingId} onChange={(e) => onChange(areaId, e.target.value)} disabled={!areaId}>
            <option value="">None / not applicable</option>
            {hs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {canCreate && <Button variant="fabric-light" size="sm" onClick={() => add("housing")} disabled={!areaId} aria-label="Add housing"><Plus className="size-4" /></Button>}
        </div>
      </div>
      {err && <p role="alert" className="col-span-full text-sm font-semibold text-bad">{err}</p>}
    </>
  );
}

function F({ name, label, defaultValue, type = "text", required, hint, err }: { name: string; label: string; defaultValue?: string | null; type?: string; required?: boolean; hint?: string; err?: string }) {
  return (
    <div>
      <label className="label" htmlFor={`pf-${name}`}>{label}{required && " *"}</label>
      <input id={`pf-${name}`} name={name} type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? 0 : undefined} defaultValue={defaultValue ?? ""} required={required} className="field" aria-invalid={err ? true : undefined} />
      {(err || hint) && <p className={`mt-1 text-xs ${err ? "font-semibold text-bad" : "text-steel-500"}`}>{err ?? hint}</p>}
    </div>
  );
}

export default function ProjectForm({ initial, canCreate, redirectTo, onSaved }: { initial?: ProjectData; canCreate: boolean; redirectTo?: string; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [housings, setHousings] = useState<Housing[]>([]);
  const [areaId, setAreaId] = useState(initial?.area_id ?? "");
  const [housingId, setHousingId] = useState(initial?.housing_id ?? "");
  const [category, setCategory] = useState(initial?.category ?? "residential");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<{ areas: Area[] }>("/portal/areas").then((r) => setAreas(r.areas)).catch((e) => setError(errMsg(e)));
    api.get<{ housings: Housing[] }>("/portal/housings").then((r) => setHousings(r.housings)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setFieldErr({});
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = {
      areaId, housingId: housingId || null, name: g("name"), houseNo: g("houseNo"), roadNo: g("roadNo"), block: g("block"), clientName: g("clientName"), engineerName: g("engineerName"),
      engineerPhone: g("engineerPhone"), address: g("address"), totalLoadKw: g("totalLoadKw"), maxDemandKw: g("maxDemandKw"), category, notes: g("notes"),
    };
    try {
      const id = initial?.id ? (await api.put(`/portal/projects/${initial.id}`, body), initial.id) : (await api.post<{ id: string }>("/portal/projects", body)).id;
      onSaved?.(id);
      if (redirectTo !== "") router.push(redirectTo ?? `/portal/projects/${id}`);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ClientApiError && err.issues) setFieldErr(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AreaHousingSelect areaId={areaId} housingId={housingId ?? ""} onChange={(a, h) => { setAreaId(a); setHousingId(h); }} canCreate={canCreate} areas={areas} setAreas={setAreas} housings={housings} setHousings={setHousings} />
      <div>
        <label className="label" htmlFor="pf-category">Project category *</label>
        <select id="pf-category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3"><F err={fieldErr.name} name="name" label="Project name" defaultValue={initial?.name} required /></div>
      <F err={fieldErr.houseNo} name="houseNo" label="House / building no." defaultValue={initial?.house_no} />
      <F err={fieldErr.roadNo} name="roadNo" label="Road no." defaultValue={initial?.road_no} />
      <F err={fieldErr.block} name="block" label="Block / sector" defaultValue={initial?.block} />
      <F err={fieldErr.clientName} name="clientName" label="Client / developer" defaultValue={initial?.client_name} required={category === "commercial" || category === "industrial"} />
      <F err={fieldErr.engineerName} name="engineerName" label="Project engineer" defaultValue={initial?.engineer_name} />
      <F err={fieldErr.engineerPhone} name="engineerPhone" label="Engineer phone" defaultValue={initial?.engineer_phone} type="tel" />
      <F err={fieldErr.totalLoadKw} name="totalLoadKw" label="Total connected load (kW)" defaultValue={initial?.total_load_kw} type="number" required={category === "industrial"} />
      <F err={fieldErr.maxDemandKw} name="maxDemandKw" label="Est. maximum demand (kW)" defaultValue={initial?.max_demand_kw} type="number" hint="Optional. Cannot exceed connected load." />
      <div className="sm:col-span-2 lg:col-span-3"><label className="label" htmlFor="pf-address">Project address</label><input id="pf-address" name="address" className="field" defaultValue={initial?.address ?? ""} /></div>
      <div className="sm:col-span-2 lg:col-span-3"><label className="label" htmlFor="pf-notes">Notes</label><textarea id="pf-notes" name="notes" className="field" defaultValue={initial?.notes ?? ""} /></div>
      {error && <div className="sm:col-span-2 lg:col-span-3"><Notice tone="bad">{error}</Notice></div>}
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" variant="clay" disabled={busy || !areaId}>{busy ? <><Loader2 className="size-4 animate-spin" />Saving…</> : initial?.id ? "Save changes" : "Create project"}</Button>
      </div>
    </form>
  );
}
