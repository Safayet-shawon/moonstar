import InquiryStatus from "@/components/portal/InquiryStatus";
import { DT, Empty, PageTitle, Pagination } from "@/components/portal/ui";
import { apiGet, getMe, requirePerm } from "@/lib/api";

export const metadata = { title: "Website Enquiries" };
type Res = { rows: { id: string; name: string; company: string | null; phone: string; email: string | null; service: string | null; message: string; status: string; created_at: string }[]; total: number; page: number; pages: number };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePerm("inquiry.view");
  const sp = await searchParams;
  const d = await apiGet<Res>(`/portal/inquiries?page=${sp.page ?? 1}`);
  const tz = (await getMe())?.timezone;
  return (
    <>
      <PageTitle title="Website Enquiries" sub="Consultation requests submitted from the public website." />
      {d.rows.length === 0 ? <Empty title="No enquiries yet" /> : (
        <div className="space-y-3">
          {d.rows.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-bold text-forest-900">{r.name}{r.company && <span className="font-normal text-steel-600"> · {r.company}</span>}</p><p className="text-sm text-steel-600"><a className="hover:text-brand-600" href={`tel:${r.phone}`}>{r.phone}</a>{r.email && <> · <a className="hover:text-brand-600" href={`mailto:${r.email}`}>{r.email}</a></>}{r.service && <> · {r.service}</>}</p></div>
                <div className="flex items-center gap-3"><time className="text-xs text-steel-500"><DT v={r.created_at} tz={tz} /></time><InquiryStatus id={r.id} status={r.status} /></div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-steel-700">{r.message}</p>
            </article>
          ))}
        </div>
      )}
      <Pagination page={d.page} pages={d.pages} total={d.total} base="/portal/inquiries" params={{}} />
    </>
  );
}
