import Link from "next/link";
import { STATUS_LABEL } from "@moonstar/shared";
import { ButtonLink } from "@/components/ui/Button";
import FilterBar from "@/components/portal/FilterBar";
import { D, Empty, Money, Pagination, StatusBadge } from "@/components/portal/ui";
import { apiGet, getMe } from "@/lib/api";

type Row = { id: string; number: string; status: string; current_version: number; project_name: string; client_name: string | null; area_name: string; housing_name: string | null; creator_name: string; total: string; quotation_date: string };
type Res = { rows: Row[]; total: number; page: number; pages: number };

export default async function QuotationList({ sp, revisedOnly = false, base }: { sp: Record<string, string | undefined>; revisedOnly?: boolean; base: string }) {
  const qs = new URLSearchParams();
  for (const k of ["q", "status", "from", "to", "creator", "area", "housing", "project", "page"]) if (sp[k]) qs.set(k, sp[k]!);
  if (revisedOnly) qs.set("revised", "1");
  const me = await getMe();
  const canCreate = me?.permissions.includes("quotation.create");
  const [data, users] = await Promise.all([
    apiGet<Res>(`/portal/quotations?${qs}`),
    me?.permissions.includes("quotation.view_all") ? apiGet<{ users: { id: string; name: string }[] }>("/portal/users/lookup") : Promise.resolve({ users: [] }),
  ]);
  const statuses = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
  const filters = [
    { name: "status", label: "Status", type: "select" as const, options: statuses },
    ...(users.users.length ? [{ name: "creator", label: "Employee", type: "select" as const, options: users.users.map((u) => ({ value: u.id, label: u.name })) }] : []),
    { name: "from", label: "From", type: "date" as const },
    { name: "to", label: "To", type: "date" as const },
  ];
  return (
    <>
      <FilterBar filters={filters} placeholder="Quotation no., project, client, area, housing, employee…" />
      {data.rows.length === 0 ? (
        <Empty title="No quotations found" text="Adjust the filters, or create a new quotation." action={canCreate ? <ButtonLink href="/portal/quotations/new" variant="clay" size="sm">New Quotation</ButtonLink> : undefined} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Number</th><th>Project</th><th>Area / Housing</th><th>Employee</th><th>Date</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/portal/quotations/${r.id}`} className="font-bold text-forest-900 hover:text-brand-600">{r.number}</Link>{r.current_version > 1 && <span className="ml-1.5 rounded bg-steel-100 px-1.5 py-0.5 text-[11px] font-bold text-steel-600">V{r.current_version}</span>}</td>
                  <td>{r.project_name}{r.client_name && <p className="text-xs text-steel-500">{r.client_name}</p>}</td>
                  <td>{r.area_name}{r.housing_name && <p className="text-xs text-steel-500">{r.housing_name}</p>}</td>
                  <td>{r.creator_name}</td>
                  <td><D v={r.quotation_date} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num font-semibold"><Money v={r.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page} pages={data.pages} total={data.total} base={base} params={sp} />
    </>
  );
}
