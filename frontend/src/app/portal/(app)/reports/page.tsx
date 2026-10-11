import Link from "next/link";
import { Download } from "lucide-react";
import { formatBDT, toPaisa } from "@moonstar/shared";
import FilterBar from "@/components/portal/FilterBar";
import { Empty, PageTitle, Pagination } from "@/components/portal/ui";
import { apiGet, requirePerm } from "@/lib/api";
import { btnClass } from "@/components/ui/Button";

export const metadata = { title: "Reports" };

type Result = { title: string; columns: { key: string; label: string; money?: boolean; num?: boolean }[]; rows: Record<string, unknown>[]; total: number; page: number; pages: number };

const fmtCell = (v: unknown, money?: boolean) => {
  if (v === null || v === undefined || v === "") return "—";
  if (money) return formatBDT(toPaisa(String(v)));
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
  return String(v);
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("report.view");
  const sp = await searchParams;
  const list = await apiGet<{ reports: { key: string; title: string }[]; canExport: boolean }>("/portal/reports");
  const active = list.reports.find((r) => r.key === sp.r)?.key ?? list.reports[0]?.key;
  const qs = new URLSearchParams();
  for (const k of ["from", "to", "page"]) if (sp[k]) qs.set(k, sp[k]!);
  const data = active ? await apiGet<Result>(`/portal/reports/${active}?${qs}`) : null;
  const exportQs = new URLSearchParams(); if (sp.from) exportQs.set("from", sp.from); if (sp.to) exportQs.set("to", sp.to); exportQs.set("format", "csv");
  const tab = (key: string) => { const p = new URLSearchParams(); p.set("r", key); if (sp.from) p.set("from", sp.from); if (sp.to) p.set("to", sp.to); return `/portal/reports?${p}`; };
  return (
    <>
      <PageTitle title="Reports" sub="Reports respect your quotation access: you only see data you are permitted to view." actions={list.canExport && active && <a className={btnClass("fabric")} href={`/api/portal/reports/${active}?${exportQs}`}><Download className="size-4" />Export CSV</a>} />
      <div className="mb-4 flex flex-wrap gap-2">{list.reports.map((r) => <Link key={r.key} href={tab(r.key)} className={`btn btn-sm ${r.key === active ? "btn-clay-navy" : "btn-ghost"}`}>{r.title}</Link>)}</div>
      <FilterBar hideSearch filters={[{ name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" }]} />
      {!data || data.rows.length === 0 ? <Empty title="No data for this report" text="Try a wider date range." /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr>{data.columns.map((c) => <th key={c.key} className={c.num || c.money ? "num" : ""}>{c.label}</th>)}</tr></thead><tbody>
          {data.rows.map((r, i) => <tr key={i}>{data.columns.map((c) => <td key={c.key} className={c.num || c.money ? "num" : ""}>{fmtCell(r[c.key], c.money)}</td>)}</tr>)}
        </tbody></table></div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} base="/portal/reports" params={{ ...sp, r: active }} />}
    </>
  );
}
