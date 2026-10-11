"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

type Milestone = { title: string; due?: string | null; done: boolean };
export type WO = { id?: string; wo_number?: string; received_date?: string; final_value?: string; milestones?: Milestone[]; warranty?: { months?: number; notes?: string; maintenanceNotes?: string }; notes?: string | null };

export default function WorkOrderForm({ quotationId, initial, defaultValue }: { quotationId: string; initial?: WO; defaultValue: string }) {
  const router = useRouter();
  const [ms, setMs] = useState<Milestone[]>(initial?.milestones ?? []);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(""); setOk(false);
    const body = {
      woNumber: f.get("woNumber"), receivedDate: f.get("receivedDate"), finalValue: f.get("finalValue") || undefined, notes: f.get("notes"),
      milestones: ms.filter((m) => m.title.trim()), warranty: { months: f.get("months") ? Number(f.get("months")) : undefined, notes: String(f.get("wnotes") ?? ""), maintenanceNotes: String(f.get("mnotes") ?? "") },
    };
    try {
      if (initial?.id) await api.put(`/portal/quotations/${quotationId}/work-orders/${initial.id}`, body);
      else await api.post(`/portal/quotations/${quotationId}/work-orders`, body);
      setOk(true);
      router.refresh();
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
      <div><label className="label" htmlFor="wo-n">Work order number *</label><input id="wo-n" name="woNumber" required className="field" defaultValue={initial?.wo_number} /></div>
      <div><label className="label" htmlFor="wo-d">Received date *</label><input id="wo-d" name="receivedDate" type="date" required className="field" defaultValue={initial?.received_date} /></div>
      <div><label className="label" htmlFor="wo-v">Final agreed value (BDT)</label><input id="wo-v" name="finalValue" className="field" inputMode="decimal" defaultValue={initial?.final_value ?? defaultValue} /></div>
      <div className="sm:col-span-3">
        <p className="label">Delivery &amp; installation milestones</p>
        {ms.map((m, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <input aria-label="Milestone" className="field min-w-52 flex-1" placeholder="e.g. Transformer delivery" value={m.title} onChange={(e) => setMs((c) => c.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <input aria-label="Due date" type="date" className="field w-44" value={m.due ?? ""} onChange={(e) => setMs((c) => c.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-ember-500" checked={m.done} onChange={(e) => setMs((c) => c.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />Done</label>
            <button type="button" aria-label="Remove milestone" onClick={() => setMs((c) => c.filter((_, j) => j !== i))}><Trash2 className="size-4 text-bad" /></button>
          </div>
        ))}
        <Button variant="fabric-light" size="sm" onClick={() => setMs((c) => [...c, { title: "", due: "", done: false }])}><Plus className="size-4" />Add milestone</Button>
      </div>
      <div><label className="label" htmlFor="wo-m">Warranty (months)</label><input id="wo-m" name="months" type="number" min={0} className="field" defaultValue={initial?.warranty?.months} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="wo-w">Warranty / maintenance notes</label><input id="wo-w" name="wnotes" className="field" defaultValue={initial?.warranty?.notes} /></div>
      <input type="hidden" name="mnotes" defaultValue={initial?.warranty?.maintenanceNotes} />
      <div className="sm:col-span-3"><label className="label" htmlFor="wo-notes">Project notes</label><textarea id="wo-notes" name="notes" className="field" defaultValue={initial?.notes ?? ""} /></div>
      {err && <div className="sm:col-span-3"><Notice tone="bad">{err}</Notice></div>}
      {ok && <div className="sm:col-span-3"><Notice tone="ok">Work order saved.</Notice></div>}
      <div className="sm:col-span-3"><Button type="submit" variant="clay">{initial?.id ? "Update work order" : "Record work order"}</Button></div>
    </form>
  );
}
