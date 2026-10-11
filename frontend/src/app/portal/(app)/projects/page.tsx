import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import FilterBar from "@/components/portal/FilterBar";
import { D, Empty, Pagination, PageTitle } from "@/components/portal/ui";
import { apiGet, has, requirePerm } from "@/lib/api";

export const metadata = { title: "Projects" };
type Row = { id: string; name: string; area_name: string; housing_name: string | null; house_no: string | null; road_no: string | null; client_name: string | null; category: string; quotation_count: number; updated_at: string };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePerm("project.view");
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ["q", "areaId", "housingId", "page"]) if (sp[k]) qs.set(k, sp[k]!);
  const d = await apiGet<{ rows: Row[]; total: number; page: number; pages: number }>(`/portal/projects?${qs}`);
  return (
    <>
      <PageTitle title="Projects" sub="Search by area, housing, project, house no., road no., client or quotation number." actions={has(me, "project.create") && <ButtonLink href="/portal/projects/new" variant="clay"><Plus className="size-4" />New project</ButtonLink>} />
      <FilterBar placeholder="Search projects, houses, roads, quotation numbers…" />
      {d.rows.length === 0 ? <Empty title="No projects found" text="Create a project to start quoting." /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Project</th><th>Area / Housing</th><th>House / Road</th><th>Client</th><th>Category</th><th className="num">Quotations</th><th>Updated</th></tr></thead>
          <tbody>{d.rows.map((p) => (
            <tr key={p.id}>
              <td><Link className="font-bold text-navy-900 hover:text-ember-600" href={`/portal/projects/${p.id}`}>{p.name}</Link></td>
              <td>{p.area_name}{p.housing_name && <p className="text-xs text-steel-500">{p.housing_name}</p>}</td>
              <td>{[p.house_no && `H ${p.house_no}`, p.road_no && `R ${p.road_no}`].filter(Boolean).join(", ") || "—"}</td>
              <td>{p.client_name ?? "—"}</td><td className="capitalize">{p.category}</td><td className="num">{p.quotation_count}</td><td><D v={p.updated_at} /></td>
            </tr>))}</tbody>
        </table></div>
      )}
      <Pagination page={d.page} pages={d.pages} total={d.total} base="/portal/projects" params={sp} />
    </>
  );
}
