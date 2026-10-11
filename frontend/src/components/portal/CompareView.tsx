"use client";
import { useState } from "react";
import { formatBDT, toPaisa } from "@moonstar/shared";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

type Item = { sku?: string | null; name: string; qty: string; unit_price: string; line_total: string };
type Change = { kind: "added"; item: Item } | { kind: "removed"; item: Item } | { kind: "changed"; before: Item; after: Item; fields: string[] };
type Res = { a: { version: number; total: string }; b: { version: number; total: string }; changes: Change[]; delta: { delta: string; direction: string } };
const m = (v: string) => formatBDT(toPaisa(v));

export default function CompareView({ id, versions }: { id: string; versions: number[] }) {
  const [a, setA] = useState(String(versions[versions.length - 1]));
  const [b, setB] = useState(String(versions[0]));
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  if (versions.length < 2) return <p className="text-sm text-steel-600">Comparison becomes available once a revision exists.</p>;
  const go = async () => { setErr(""); try { setRes(await api.get<Res>(`/portal/quotations/${id}/compare?a=${a}&b=${b}`)); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="cmp-a">From</label><select id="cmp-a" className="field" value={a} onChange={(e) => setA(e.target.value)}>{versions.map((v) => <option key={v} value={v}>V{v}</option>)}</select></div>
        <div><label className="label" htmlFor="cmp-b">To</label><select id="cmp-b" className="field" value={b} onChange={(e) => setB(e.target.value)}>{versions.map((v) => <option key={v} value={v}>V{v}</option>)}</select></div>
        <Button variant="fabric" onClick={go}>Compare</Button>
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      {res && (
        <div className="space-y-2 text-sm">
          <p>Total changes from <b>{m(res.a.total)}</b> to <b>{m(res.b.total)}</b> ({res.delta.direction === "same" ? "no change" : `${res.delta.direction === "up" ? "+" : ""}${m(res.delta.delta)}`}).</p>
          {res.changes.length === 0 && <p className="text-steel-600">Line items are identical.</p>}
          <ul className="space-y-1.5">
            {res.changes.map((c, i) => (
              <li key={i} className={`rounded-lg border px-3 py-2 ${c.kind === "added" ? "border-green-200 bg-green-50" : c.kind === "removed" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                {c.kind === "added" && <>➕ Added <b>{c.item.name}</b>: {Number(c.item.qty)} × {m(c.item.unit_price)} = {m(c.item.line_total)}</>}
                {c.kind === "removed" && <>➖ Removed <b>{c.item.name}</b> ({m(c.item.line_total)})</>}
                {c.kind === "changed" && <>✏️ <b>{c.after.name}</b>: qty {Number(c.before.qty)} → {Number(c.after.qty)}, price {m(c.before.unit_price)} → {m(c.after.unit_price)}, total {m(c.before.line_total)} → {m(c.after.line_total)}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
