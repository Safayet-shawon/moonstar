import FilterBar from "@/components/portal/FilterBar";
import { DT, Empty, PageTitle, Pagination } from "@/components/portal/ui";
import { apiGet, getMe, requirePerm } from "@/lib/api";

export const metadata = { title: "Audit Log" };
type Res = { rows: { id: number; at: string; user_name: string | null; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown>; ip: string | null }[]; total: number; page: number; pages: number };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("audit.view");
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ["q", "entity", "action", "page"]) if (sp[k]) qs.set(k, sp[k]!);
  const d = await apiGet<Res>(`/portal/audit?${qs}`);
  const tz = (await getMe())?.timezone;
  const entities = ["quotation", "product", "user", "role", "settings", "project", "area", "housing", "inquiry"];
  return (
    <>
      <PageTitle title="Audit Log" sub="Append-only record of price, quotation, permission and approval changes." />
      <FilterBar placeholder="Search by user or record id…" filters={[{ name: "entity", label: "Entity", type: "select", options: entities.map((e) => ({ value: e, label: e })) }]} />
      {d.rows.length === 0 ? <Empty title="No entries" /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th><th>IP</th></tr></thead><tbody>
          {d.rows.map((r) => (
            <tr key={r.id}><td className="whitespace-nowrap"><DT v={r.at} tz={tz} /></td><td>{r.user_name ?? "system"}</td><td className="font-mono text-xs">{r.action}</td><td>{r.entity}<p className="max-w-40 truncate font-mono text-[10px] text-steel-500">{r.entity_id}</p></td>
              <td className="max-w-md"><code className="line-clamp-2 break-all text-[11px] text-steel-600">{JSON.stringify(r.detail)}</code></td><td className="text-xs">{r.ip}</td></tr>
          ))}</tbody></table></div>
      )}
      <Pagination page={d.page} pages={d.pages} total={d.total} base="/portal/audit" params={sp} />
    </>
  );
}
