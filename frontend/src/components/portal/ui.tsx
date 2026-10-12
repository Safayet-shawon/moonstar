import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { formatBDT, STATUS_LABEL, toPaisa } from "@moonstar/shared";
import { fmtDate, fmtDateTime } from "@moonstar/shared";

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900 sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-steel-600">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const badgeFor = (s: string) => (s.startsWith("pending") ? "pending" : s);
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${badgeFor(status)}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Money({ v, className }: { v: string | number | null | undefined; className?: string }) {
  if (v === null || v === undefined || v === "") return <span className={className}>—</span>;
  return <span className={`tabular-nums ${className ?? ""}`}>{formatBDT(toPaisa(v))}</span>;
}

export const D = ({ v, tz }: { v: string | Date | null | undefined; tz?: string }) => <>{fmtDate(v, tz)}</>;
export const DT = ({ v, tz }: { v: string | Date | null | undefined; tz?: string }) => <>{fmtDateTime(v, tz)}</>;

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card grid place-items-center gap-2 px-6 py-14 text-center">
      <Inbox className="size-9 text-steel-300" />
      <h3 className="font-bold text-forest-900">{title}</h3>
      {text && <p className="max-w-sm text-sm text-steel-600">{text}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "warn" | "ok" | "info" }) {
  const body = (
    <div className={`card p-5 transition-shadow ${href ? "hover:shadow-md" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-steel-500">{label}</p>
      <p className={`mt-2 font-display text-3xl font-extrabold ${tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-forest-900"}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Pagination({ page, pages, total, base, params }: { page: number; pages: number; total: number; base: string; params: Record<string, string | undefined> }) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${base}?${sp}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-steel-600" aria-label="Pagination">
      <p>{total} result{total === 1 ? "" : "s"} · page {page} of {pages}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="btn btn-ghost btn-sm"><ChevronLeft className="size-4" /> Prev</Link> : <span className="btn btn-ghost btn-sm" aria-disabled>Prev</span>}
        {page < pages ? <Link href={href(page + 1)} className="btn btn-ghost btn-sm">Next <ChevronRight className="size-4" /></Link> : <span className="btn btn-ghost btn-sm" aria-disabled>Next</span>}
      </div>
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "ok"; children: React.ReactNode }) {
  const c = { info: "bg-blue-50 text-blue-900 border-blue-200", warn: "bg-amber-50 text-amber-900 border-amber-200", bad: "bg-red-50 text-red-900 border-red-200", ok: "bg-green-50 text-green-900 border-green-200" }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
