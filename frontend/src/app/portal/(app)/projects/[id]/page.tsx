import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import ProjectForm, { type ProjectData } from "@/components/portal/ProjectForm";
import AttachmentList from "@/components/portal/AttachmentList";
import { D, Money, PageTitle, StatusBadge } from "@/components/portal/ui";
import { apiGet, has, requirePerm, safe } from "@/lib/api";

type Detail = { project: ProjectData & { id: string; area_name: string; housing_name: string | null; created_by_name: string | null; updated_by_name: string | null; created_at: string; updated_at: string }; quotations: { id: string; number: string; status: string; current_version: number; total: string; quotation_date: string; creator_name: string }[]; attachments: { id: string; file_name: string; url: string; by_name: string | null }[] };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("project.view");
  const { id } = await params;
  const d = await safe(apiGet<Detail>(`/portal/projects/${id}`));
  if (!d) notFound();
  const p = d.project;
  return (
    <>
      <PageTitle title={p.name!} sub={`${p.area_name}${p.housing_name ? ` · ${p.housing_name}` : ""} · created by ${p.created_by_name ?? "—"}, last updated by ${p.updated_by_name ?? "—"}`} actions={has(me, "quotation.create") && <ButtonLink href={`/portal/quotations/new?project=${p.id}`} variant="clay"><FilePlus2 className="size-4" />New quotation</ButtonLink>} />
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Quotations for this project</h2>
        {d.quotations.length === 0 ? <p className="text-sm text-steel-600">No quotations yet.</p> : (
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Number</th><th>Date</th><th>Employee</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>{d.quotations.map((q) => (
              <tr key={q.id}><td><Link className="font-bold hover:text-ember-600" href={`/portal/quotations/${q.id}`}>{q.number}</Link> {q.current_version > 1 && <span className="text-xs text-steel-500">V{q.current_version}</span>}</td><td><D v={q.quotation_date} /></td><td>{q.creator_name}</td><td><StatusBadge status={q.status} /></td><td className="num"><Money v={q.total} /></td></tr>
            ))}</tbody></table></div>
        )}
      </section>
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Attachments</h2>
        <AttachmentList projectId={p.id} items={d.attachments} canEdit={has(me, "project.edit")} />
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-bold text-navy-900">{has(me, "project.edit") ? "Project details" : "Project details (read-only)"}</h2>
        {has(me, "project.edit") ? <ProjectForm initial={p} canCreate={has(me, "project.create")} redirectTo="" /> : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">{[["Client", p.client_name], ["Engineer", p.engineer_name], ["Engineer phone", p.engineer_phone], ["House", p.house_no], ["Road", p.road_no], ["Block", p.block], ["Connected load (kW)", p.total_load_kw], ["Max demand (kW)", p.max_demand_kw], ["Category", p.category], ["Address", p.address], ["Notes", p.notes]].map(([k, v]) => <div key={k as string}><dt className="text-xs font-bold uppercase text-steel-500">{k}</dt><dd>{(v as string) || "—"}</dd></div>)}</dl>
        )}
      </section>
    </>
  );
}
