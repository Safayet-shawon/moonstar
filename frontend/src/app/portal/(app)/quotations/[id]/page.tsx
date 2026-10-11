import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { STATUS_LABEL } from "@moonstar/shared";
import QuotationActions, { VersionLinks } from "@/components/portal/QuotationActions";
import CompareView from "@/components/portal/CompareView";
import WorkOrderForm, { type WO } from "@/components/portal/WorkOrderForm";
import { D, DT, Money, Notice, PageTitle, StatusBadge } from "@/components/portal/ui";
import { apiGet, getMe, requirePerm, safe } from "@/lib/api";

type Item = { id: string; version: number; position: number; sku: string | null; name: string; unit: string; qty: string; unit_price: string; discount_type: string; discount_value: string; line_total: string; cost_price?: string | null; is_manual: boolean };
type Version = {
  version: number; quotation_date: string; locked: boolean; reason: string | null; author_name: string; subtotal: string; discount_total: string; charges_total: string; tax_total: string; total: string; cost_total?: string | null;
  tech_result: { recommendedKva: number | null; units: number; apparentKva: number; designKva: number; maxDemandKw: number; pfiKvar: number | null; warnings: string[]; rule: string } | null;
  tech_override: { recommendedKva: number; units: number; reason: string; by: string; originalKva: number | null } | null;
  commercial: { exceptionalDiscount?: boolean; marginWarning?: boolean; marginPct?: string | null; notes?: string | null };
  terms: { validityDays?: number; paymentTerms?: string }; prepared_by: { name: string }; signatory: { name: string | null; authorised: boolean } | null;
};
type Detail = {
  quotation: { id: string; number: string; status: string; current_version: number; project_id: string; project_name: string; client_name: string | null; area_name: string; housing_name: string | null; creator_name: string };
  versions: Version[]; items: Item[];
  approvals: { id: number; version: number; kind: string; decision: string; note: string | null; by_name: string; decided_at: string }[];
  documents: { id: string; version: number; file_name: string; sha256: string; created_at: string; by_name: string | null }[];
  workOrders: (WO & { id: string; version: number; wo_number: string; received_date: string; final_value: string })[];
  history: { at: string; user_name: string | null; action: string; detail: Record<string, unknown> }[];
  transitions: { to: string; label: string }[]; can: { edit: boolean; revise: boolean; pdf: boolean; workOrder: boolean }; showCost: boolean;
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  await requirePerm("quotation.view_all", "quotation.view_own");
  const { id } = await params;
  const d = await safe(apiGet<Detail>(`/portal/quotations/${id}`));
  if (!d) notFound();
  const tz = (await getMe())?.timezone;
  const q = d.quotation;
  const sel = Number((await searchParams).v) || q.current_version;
  const v = d.versions.find((x) => x.version === sel) ?? d.versions[0];
  const items = d.items.filter((i) => i.version === v.version);
  const isCurrent = v.version === q.current_version;
  const techApproved = ["pending_commercial", "approved", "sent", "accepted"].includes(q.status);

  return (
    <>
      <PageTitle
        title={`${q.number}${q.current_version > 1 ? ` · V${v.version}` : ""}`}
        sub={`${q.project_name}${q.client_name ? ` · ${q.client_name}` : ""} · ${q.area_name}${q.housing_name ? ` › ${q.housing_name}` : ""}`}
        actions={<StatusBadge status={q.status} />}
      />
      <div className="mb-6">
        <QuotationActions id={q.id} transitions={isCurrent ? d.transitions : []} can={d.can} versionNumber={v.version} />
      </div>
      {!isCurrent && (
        <div className="mb-4">
          <Notice tone="warn">You are viewing superseded version V{v.version}. <Link className="font-bold underline" href={`/portal/quotations/${q.id}`}>Open the current version (V{q.current_version})</Link>.</Notice>
        </div>
      )}
      {v.commercial.exceptionalDiscount && (
        <div className="mb-4"><Notice tone="warn"><ShieldAlert className="mr-1 inline size-4" />Exceptional discount: flagged for commercial approval.</Notice></div>
      )}
      {d.showCost && v.commercial.marginWarning && (
        <div className="mb-4"><Notice tone="warn"><AlertTriangle className="mr-1 inline size-4" />Margin ({v.commercial.marginPct}%) is below the configured minimum.</Notice></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Line items</h2>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.position}</td>
                      <td>
                        <b className="text-navy-900">{i.name}</b>
                        {i.sku && <p className="text-xs text-steel-500">{i.sku}</p>}
                        {i.is_manual && <p className="text-xs font-semibold text-warn">Manual price</p>}
                        {i.discount_type !== "none" && Number(i.discount_value) > 0 && (
                          <p className="text-xs text-ember-600">Discount {i.discount_type === "percent" ? `${Number(i.discount_value)}%` : <Money v={i.discount_value} />}</p>
                        )}
                        {d.showCost && i.cost_price && <p className="text-xs text-steel-500">Cost <Money v={i.cost_price} /></p>}
                      </td>
                      <td className="num">{Number(i.qty)} {i.unit}</td>
                      <td className="num"><Money v={i.unit_price} /></td>
                      <td className="num font-semibold"><Money v={i.line_total} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-steel-600">Subtotal</dt><dd><Money v={v.subtotal} /></dd></div>
              {Number(v.discount_total) > 0 && <div className="flex justify-between"><dt className="text-steel-600">Discounts</dt><dd>− <Money v={v.discount_total} /></dd></div>}
              {Number(v.charges_total) > 0 && <div className="flex justify-between"><dt className="text-steel-600">Charges</dt><dd><Money v={v.charges_total} /></dd></div>}
              {Number(v.tax_total) > 0 && <div className="flex justify-between"><dt className="text-steel-600">Tax</dt><dd><Money v={v.tax_total} /></dd></div>}
              <div className="flex justify-between border-t border-steel-200 pt-2 text-lg font-extrabold text-navy-900"><dt>Total</dt><dd><Money v={v.total} /></dd></div>
              {d.showCost && v.cost_total && <div className="flex justify-between text-xs text-steel-500"><dt>Internal cost</dt><dd><Money v={v.cost_total} /></dd></div>}
            </dl>
            <p className="mt-4 text-xs text-steel-500">
              Version date {v.quotation_date} · prepared by {v.prepared_by.name} · valid {v.terms.validityDays ?? 30} days · signatory: {v.signatory?.authorised && v.signatory.name ? v.signatory.name : "pending authorisation"}{v.locked ? " · locked (immutable)" : ""}
            </p>
            {v.reason && <p className="mt-1 text-xs text-steel-600">Revision reason: {v.reason}</p>}
          </section>

          {v.tech_result && (
            <section className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-navy-900">Technical summary</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Preliminary · {techApproved ? "technically approved" : "technical approval pending"}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs uppercase text-steel-500">Max demand</dt><dd className="font-semibold">{v.tech_result.maxDemandKw} kW</dd></div>
                <div><dt className="text-xs uppercase text-steel-500">Apparent</dt><dd className="font-semibold">{v.tech_result.apparentKva} kVA</dd></div>
                <div><dt className="text-xs uppercase text-steel-500">Design kVA</dt><dd className="font-semibold">{v.tech_result.designKva}</dd></div>
                <div><dt className="text-xs uppercase text-steel-500">Recommended</dt><dd className="font-semibold text-ember-600">{v.tech_result.units > 1 ? `${v.tech_result.units} × ` : ""}{v.tech_result.recommendedKva ?? "custom"} kVA</dd></div>
              </dl>
              <p className="mt-2 text-xs text-steel-600">Rule: {v.tech_result.rule}</p>
              {v.tech_override && (
                <div className="mt-3">
                  <Notice tone="info"><b>Engineer override:</b> {v.tech_override.units > 1 ? `${v.tech_override.units} × ` : ""}{v.tech_override.recommendedKva} kVA (calculated {v.tech_override.originalKva ?? "—"} kVA) by {v.tech_override.by}. Reason: {v.tech_override.reason}</Notice>
                </div>
              )}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-steel-600">{v.tech_result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Compare versions</h2>
            <CompareView id={q.id} versions={d.versions.map((x) => x.version)} />
          </section>

          {(d.can.workOrder || d.workOrders.length > 0) && (
            <section className="card p-5">
              <h2 className="mb-3 font-bold text-navy-900">Work order</h2>
              {d.workOrders.map((w) => (
                <div key={w.id} className="mb-4 rounded-lg bg-paper p-4 text-sm">
                  <p><b>{w.wo_number}</b> · received <D v={w.received_date} /> · final value <Money v={w.final_value} /> · linked to V{w.version}</p>
                  {d.can.workOrder && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-bold text-ember-600">Edit work order</summary>
                      <div className="mt-3"><WorkOrderForm quotationId={q.id} initial={w} defaultValue={v.total} /></div>
                    </details>
                  )}
                </div>
              ))}
              {d.can.workOrder && d.workOrders.length === 0 && <WorkOrderForm quotationId={q.id} defaultValue={v.total} />}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-5"><h2 className="mb-2 font-bold text-navy-900">Versions</h2><VersionLinks id={q.id} versions={d.versions} current={q.current_version} selected={v.version} canPdf={d.can.pdf} /></section>
          <section className="card p-5">
            <h2 className="mb-2 font-bold text-navy-900">Approvals</h2>
            {d.approvals.length === 0 ? <p className="text-sm text-steel-600">No decisions recorded yet.</p> : (
              <ul className="space-y-3 text-sm">
                {d.approvals.map((a) => (
                  <li key={a.id}>
                    <p><b className="capitalize">{a.kind}</b> · <span className={a.decision === "approved" ? "text-ok" : a.decision === "rejected" ? "text-bad" : "text-warn"}>{a.decision}</span> (V{a.version})</p>
                    <p className="text-xs text-steel-500">{a.by_name} · <DT v={a.decided_at} tz={tz} /></p>
                    {a.note && <p className="mt-0.5 text-xs text-steel-600">“{a.note}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {d.documents.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-bold text-navy-900">Generated PDFs</h2>
              <ul className="space-y-2 text-xs text-steel-600">
                {d.documents.slice(0, 6).map((x) => <li key={x.id}>{x.file_name} · <DT v={x.created_at} tz={tz} /><br /><span className="font-mono text-[10px] text-steel-500">sha256 {x.sha256.slice(0, 16)}…</span></li>)}
              </ul>
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-2 font-bold text-navy-900">History</h2>
            <ul className="max-h-80 space-y-2 overflow-auto text-xs text-steel-600">
              {d.history.map((h, i) => (
                <li key={i}>
                  <b className="text-navy-800">{h.user_name ?? "System"}</b> {h.action.replace(/\./g, " › ")}{typeof h.detail?.to === "string" ? ` → ${STATUS_LABEL[h.detail.to] ?? h.detail.to}` : ""}
                  <br /><span className="text-steel-500"><DT v={h.at} tz={tz} /></span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
