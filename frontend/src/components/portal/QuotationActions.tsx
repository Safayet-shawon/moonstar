"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDown, GitBranch, Loader2, Pencil } from "lucide-react";
import { Button, ButtonLink, btnClass, type Variant } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

type Transition = { to: string; label: string };

const needsNote = (to: string) => to === "draft" || to === "rejected";
const variantFor = (t: Transition): Variant => (t.to === "rejected" ? "danger" : t.to === "draft" ? "fabric-light" : "clay");

export default function QuotationActions({ id, transitions, can, versionNumber }: { id: string; transitions: Transition[]; can: { edit: boolean; revise: boolean; pdf: boolean }; versionNumber: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<Transition | null>(null);
  const [note, setNote] = useState("");
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState("");

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setErr("");
    try { await fn(); setPending(null); setNote(""); setRevising(false); setReason(""); router.refresh(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(""); }
  }
  const go = (t: Transition) => (needsNote(t.to) ? setPending(t) : run(t.to, () => api.post(`/portal/quotations/${id}/transition`, { to: t.to })));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {can.edit && <ButtonLink href={`/portal/quotations/${id}/edit`} variant="fabric"><Pencil className="size-4" />Edit draft</ButtonLink>}
        {can.pdf && <a href={`/api/portal/quotations/${id}/pdf?version=${versionNumber}`} target="_blank" rel="noopener" className={btnClass("glass-dark")}><FileDown className="size-4" />PDF (V{versionNumber})</a>}
        {can.revise && <Button variant="clay-navy" onClick={() => setRevising(true)}><GitBranch className="size-4" />Revise quotation</Button>}
        {transitions.map((t) => <Button key={t.to + t.label} variant={variantFor(t)} disabled={!!busy} onClick={() => go(t)}>{busy === t.to ? <Loader2 className="size-4 animate-spin" /> : null}{t.label}</Button>)}
      </div>
      {pending && (
        <div className="card max-w-xl space-y-2 p-4">
          <label className="label" htmlFor="tr-note">{pending.label}: note (required)</label>
          <textarea id="tr-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="flex gap-2"><Button variant={variantFor(pending)} size="sm" disabled={note.trim().length < 5 || !!busy} onClick={() => run(pending.to, () => api.post(`/portal/quotations/${id}/transition`, { to: pending.to, note }))}>Confirm</Button><Button variant="ghost" size="sm" onClick={() => setPending(null)}>Cancel</Button></div>
        </div>
      )}
      {revising && (
        <div className="card max-w-xl space-y-2 p-4">
          <label className="label" htmlFor="rv-reason">Reason for revision (recorded)</label>
          <textarea id="rv-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <p className="text-xs text-steel-500">The current version is preserved. A new draft version is created with the same items for you to change.</p>
          <div className="flex gap-2"><Button variant="clay" size="sm" disabled={reason.trim().length < 5 || !!busy} onClick={() => run("revise", async () => { await api.post(`/portal/quotations/${id}/revise`, { reason }); router.push(`/portal/quotations/${id}/edit`); })}>Create new version</Button><Button variant="ghost" size="sm" onClick={() => setRevising(false)}>Cancel</Button></div>
        </div>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  );
}

export function VersionLinks({ id, versions, current, selected, canPdf }: { id: string; versions: { version: number; quotation_date: string; total: string; reason: string | null }[]; current: number; selected: number; canPdf: boolean }) {
  return (
    <ul className="divide-y divide-steel-100 text-sm">
      {versions.map((v) => (
        <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Link href={`/portal/quotations/${id}?v=${v.version}`} className={`font-bold ${v.version === selected ? "text-brand-600" : "text-forest-900 hover:text-brand-600"}`}>V{v.version}{v.version === current && <span className="ml-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-600">current</span>}</Link>
          <span className="text-xs text-steel-500">{v.quotation_date}{v.reason ? ` · ${v.reason}` : ""}</span>
          {canPdf && <a href={`/api/portal/quotations/${id}/pdf?version=${v.version}`} target="_blank" rel="noopener" className="text-xs font-bold text-brand-600">PDF</a>}
        </li>
      ))}
    </ul>
  );
}
