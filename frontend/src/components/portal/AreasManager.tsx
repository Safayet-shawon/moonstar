"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

type A = { id: string; name: string; housings: number; projects: number };
type H = { id: string; name: string; area_id: string; projects: number };

export default function AreasManager({ areas, housings, canCreate, canEdit }: { areas: A[]; housings: H[]; canCreate: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  const addArea = () => { const n = window.prompt("New area name"); if (n?.trim()) run(() => api.post("/portal/areas", { name: n })); };
  const addHousing = (areaId: string) => { const n = window.prompt("New housing / development name"); if (n?.trim()) run(() => api.post("/portal/housings", { areaId, name: n })); };
  const renameArea = (a: A) => { const n = window.prompt("Rename area", a.name); if (n?.trim() && n !== a.name) run(() => api.patch(`/portal/areas/${a.id}`, { name: n })); };
  const renameHousing = (h: H) => { const n = window.prompt("Rename housing", h.name); if (n?.trim() && n !== h.name) run(() => api.patch(`/portal/housings/${h.id}`, { name: n })); };

  return (
    <div className="space-y-4">
      {canCreate && <Button variant="clay" onClick={addArea}><Plus className="size-4" />Add area</Button>}
      {err && <Notice tone="bad">{err}</Notice>}
      {areas.length === 0 && <p className="text-sm text-steel-600">No areas yet. Add the first one to start organising projects.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {areas.map((a) => (
          <section key={a.id} className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-forest-900">{a.name}</h2>
              <div className="flex gap-1">
                {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => renameArea(a)} aria-label={`Rename ${a.name}`}><Pencil className="size-3.5" /></button>}
                {canCreate && <Button variant="fabric-light" size="sm" onClick={() => addHousing(a.id)}><Plus className="size-3.5" />Housing</Button>}
              </div>
            </div>
            <p className="text-xs text-steel-500">{a.housings} housing · {a.projects} projects</p>
            <ul className="mt-3 divide-y divide-steel-100 text-sm">
              {housings.filter((h) => h.area_id === a.id).map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <Link href={`/portal/projects?housingId=${h.id}`} className="flex items-center gap-2 font-semibold text-forest-800 hover:text-brand-600"><Building2 className="size-4 text-steel-500" />{h.name}</Link>
                  <span className="flex items-center gap-2 text-xs text-steel-500">{h.projects} projects{canEdit && <button onClick={() => renameHousing(h)} aria-label={`Rename ${h.name}`}><Pencil className="size-3" /></button>}</span>
                </li>
              ))}
              {housings.every((h) => h.area_id !== a.id) && <li className="py-2 text-steel-500">No housing recorded</li>}
            </ul>
            <Link href={`/portal/projects?areaId=${a.id}`} className="mt-3 inline-block text-xs font-bold text-brand-600">View projects →</Link>
          </section>
        ))}
      </div>
    </div>
  );
}
