"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { D, DT, Money, Notice } from "./ui";

export type Product = {
  id: string; sku: string; name: string; category_id: number; category_name: string; brand: string | null; model: string | null; unit: string; price: string; cost?: string | null;
  capacity_kva: string | null; capacity_kvar: string | null; active: boolean; public_visible: boolean; public_summary: string | null; notes: string | null; specs: Record<string, unknown>; price_effective_from: string;
};
type Hist = { id: number; price: string; cost: string | null; effective_from: string; reason: string | null; by_name: string | null; created_at: string };

export default function ProductManager({ rows, categories, perms, showCost }: { rows: Product[]; categories: { id: number; name: string }[]; perms: string[]; showCost: boolean }) {
  const router = useRouter();
  const can = (p: string) => perms.includes(p);
  const [edit, setEdit] = useState<Product | "new" | null>(null);
  const [hist, setHist] = useState<{ p: Product; rows: Hist[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canPrice = can("price.manage");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = {
      sku: g("sku"), name: g("name"), categoryId: Number(g("categoryId")), brand: g("brand") || null, model: g("model") || null, unit: g("unit") || "nos", price: g("price"), cost: g("cost"),
      capacityKva: g("capacityKva"), capacityKvar: g("capacityKvar"), specs: g("specs"), notes: g("notes"), publicVisible: f.get("publicVisible") === "on", publicSummary: g("publicSummary") || null,
      active: f.get("active") === "on", effectiveFrom: g("effectiveFrom") || null, reason: g("reason") || null,
    };
    setBusy(true); setErr("");
    try {
      if (edit === "new") await api.post("/portal/products", body);
      else if (edit) await api.put(`/portal/products/${edit.id}`, body);
      setEdit(null);
      router.refresh();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  async function showHist(p: Product) {
    setErr("");
    try { setHist({ p, rows: (await api.get<{ history: Hist[] }>(`/portal/products/${p.id}/history`)).history }); } catch (x) { setErr(errMsg(x)); }
  }

  const p = edit && edit !== "new" ? edit : null;
  return (
    <div className="space-y-4">
      {can("product.manage") && !edit && <Button variant="clay" onClick={() => setEdit("new")}><Plus className="size-4" />Add product</Button>}
      {err && <Notice tone="bad">{err}</Notice>}

      {edit && (
        <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <h2 className="font-bold text-forest-900 sm:col-span-2 lg:col-span-4">{edit === "new" ? "New product" : `Edit ${edit.sku}`}</h2>
          <div><label className="label" htmlFor="pr-sku">SKU / code *</label><input id="pr-sku" name="sku" required className="field" defaultValue={p?.sku} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pr-name">Name *</label><input id="pr-name" name="name" required className="field" defaultValue={p?.name} /></div>
          <div><label className="label" htmlFor="pr-cat">Category *</label><select id="pr-cat" name="categoryId" required className="field" defaultValue={p?.category_id}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="pr-brand">Brand</label><input id="pr-brand" name="brand" className="field" defaultValue={p?.brand ?? ""} /></div>
          <div><label className="label" htmlFor="pr-model">Model</label><input id="pr-model" name="model" className="field" defaultValue={p?.model ?? ""} /></div>
          <div><label className="label" htmlFor="pr-unit">Unit</label><input id="pr-unit" name="unit" className="field" defaultValue={p?.unit ?? "nos"} /></div>
          <div><label className="label" htmlFor="pr-kva">Capacity (kVA)</label><input id="pr-kva" name="capacityKva" inputMode="decimal" className="field" defaultValue={p?.capacity_kva ? Number(p.capacity_kva) : ""} /></div>
          <div><label className="label" htmlFor="pr-kvar">Capacity (kVAR)</label><input id="pr-kvar" name="capacityKvar" inputMode="decimal" className="field" defaultValue={p?.capacity_kvar ? Number(p.capacity_kvar) : ""} /></div>
          <div><label className="label" htmlFor="pr-price">Selling price (BDT) *</label><input id="pr-price" name="price" required inputMode="decimal" className="field" defaultValue={p?.price ?? ""} readOnly={!canPrice} /></div>
          {showCost && <div><label className="label" htmlFor="pr-cost">Internal cost (BDT)</label><input id="pr-cost" name="cost" inputMode="decimal" className="field" defaultValue={p?.cost ?? ""} readOnly={!canPrice} /></div>}
          {canPrice && <div><label className="label" htmlFor="pr-eff">Price effective from</label><input id="pr-eff" name="effectiveFrom" type="datetime-local" className="field" /><p className="mt-1 text-xs text-steel-500">Blank = now. Future dates are scheduled.</p></div>}
          {canPrice && <div className="sm:col-span-2"><label className="label" htmlFor="pr-reason">Reason for price change</label><input id="pr-reason" name="reason" className="field" /></div>}
          <div className="sm:col-span-2 lg:col-span-4"><label className="label" htmlFor="pr-specs">Technical specifications (JSON object or plain text)</label><textarea id="pr-specs" name="specs" className="field" defaultValue={p && Object.keys(p.specs ?? {}).length ? JSON.stringify(p.specs, null, 2) : ""} placeholder='{"Voltage ratio":"11/0.4 kV","Cooling":"ONAN"}' /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pr-notes">Internal notes</label><input id="pr-notes" name="notes" className="field" defaultValue={p?.notes ?? ""} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pr-ps">Public summary (shown on website, no prices)</label><input id="pr-ps" name="publicSummary" className="field" defaultValue={p?.public_summary ?? ""} /></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" className="size-4 accent-brand-500" defaultChecked={p?.active ?? true} />Active (quotable)</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="publicVisible" className="size-4 accent-brand-500" defaultChecked={p?.public_visible ?? false} />Show on public catalogue</label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button type="submit" variant="clay" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </form>
      )}

      {hist && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-forest-900">Price history · {hist.p.sku}</h2><button className="text-sm font-bold text-brand-600" onClick={() => setHist(null)}>Close</button></div>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Changed</th><th className="num">Price</th>{showCost && <th className="num">Cost</th>}<th>Effective from</th><th>By</th><th>Reason</th></tr></thead><tbody>
            {hist.rows.map((h) => <tr key={h.id}><td><DT v={h.created_at} /></td><td className="num"><Money v={h.price} /></td>{showCost && <td className="num"><Money v={h.cost} /></td>}<td><DT v={h.effective_from} /></td><td>{h.by_name ?? "system"}</td><td>{h.reason}</td></tr>)}
          </tbody></table></div>
        </div>
      )}

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th className="num">Rating</th><th className="num">Selling price</th>{showCost && <th className="num">Cost</th>}<th>Price from</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                <td className="font-mono text-xs">{r.sku}</td><td className="font-semibold text-forest-900">{r.name}</td><td>{r.category_name}</td>
                <td className="num">{r.capacity_kva ? `${Number(r.capacity_kva)} kVA` : r.capacity_kvar ? `${Number(r.capacity_kvar)} kVAR` : "—"}</td>
                <td className="num font-semibold"><Money v={r.price} /></td>{showCost && <td className="num"><Money v={r.cost} /></td>}
                <td><D v={r.price_effective_from} /></td>
                <td>{r.active ? <span className="badge badge-accepted">Active</span> : <span className="badge badge-draft">Inactive</span>}{r.public_visible && <span className="badge badge-sent ml-1">Public</span>}</td>
                <td className="whitespace-nowrap">
                  {(can("product.manage") || canPrice) && <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Edit ${r.sku}`}><Pencil className="size-3.5" /></button>}
                  {(can("price.audit") || can("product.manage")) && <button className="btn btn-ghost btn-sm ml-1" onClick={() => showHist(r)} aria-label={`History ${r.sku}`}><History className="size-3.5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
