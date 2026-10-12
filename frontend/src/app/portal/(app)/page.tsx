import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { DT, Notice, PageTitle, Stat } from "@/components/portal/ui";
import { apiGet, getMe, requireMe } from "@/lib/api";

export const metadata = { title: "Dashboard" };

type Stats = { total: number; draft: number; pending: number; sent: number; revised: number; accepted: number; workOrders: number; recent: { at: string; user_name: string | null; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown> }[]; projects: { id: string; name: string; updated_at: string; area_name: string }[] };

const label = (a: string) => a.replace(/\./g, " › ").replace(/_/g, " ");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireMe();
  const { denied } = await searchParams;
  const s = await apiGet<Stats>("/portal/dashboard");
  const tz = (await getMe())?.timezone;
  return (
    <>
      <PageTitle title={`Welcome, ${me.user.name.split(" ")[0]}`} sub="Live figures from the quotation database." actions={me.permissions.includes("quotation.create") && <ButtonLink href="/portal/quotations/new" variant="clay"><FilePlus2 className="size-4" />New Quotation</ButtonLink>} />
      {denied && <div className="mb-4"><Notice tone="warn">You do not have permission to open that page.</Notice></div>}
      {me.user.mustChangePassword && <div className="mb-4"><Notice tone="warn">Your password was set by an administrator. Please <Link className="font-bold underline" href="/portal/settings">change it in Settings</Link>.</Notice></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total quotations" value={s.total} href="/portal/quotations" />
        <Stat label="Drafts" value={s.draft} href="/portal/quotations?status=draft" />
        <Stat label="Pending approval" value={s.pending} href="/portal/quotations?status=pending_technical" tone="warn" />
        <Stat label="Sent" value={s.sent} href="/portal/quotations?status=sent" tone="info" />
        <Stat label="Revised" value={s.revised} href="/portal/revised" />
        <Stat label="Accepted" value={s.accepted} href="/portal/quotations?status=accepted" tone="ok" />
        <Stat label="Work orders received" value={s.workOrders} href="/portal/reports" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-3 font-bold text-forest-900">Recent activity</h2>
          {s.recent.length === 0 ? <p className="text-sm text-steel-600">No activity yet.</p> : (
            <ul className="divide-y divide-steel-100 text-sm">
              {s.recent.map((r, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5">
                  <span><b className="text-forest-900">{r.user_name ?? "System"}</b> <span className="text-steel-600">{label(r.action)}</span>{typeof r.detail?.number === "string" && <> · <span className="font-semibold">{r.detail.number}</span></>}</span>
                  <time className="shrink-0 text-xs text-steel-500"><DT v={r.at} tz={tz} /></time>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold text-forest-900">Recently updated projects</h2>
          {s.projects.length === 0 ? <p className="text-sm text-steel-600">No projects yet.</p> : (
            <ul className="divide-y divide-steel-100 text-sm">
              {s.projects.map((p) => (
                <li key={p.id} className="py-2.5"><Link href={`/portal/projects/${p.id}`} className="font-semibold text-forest-900 hover:text-brand-600">{p.name}</Link><p className="text-xs text-steel-500">{p.area_name} · <DT v={p.updated_at} tz={tz} /></p></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
