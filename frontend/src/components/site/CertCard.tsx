import Image from "next/image";
import { Award, FileText, ShieldCheck } from "lucide-react";
import type { Certification } from "@/content/certifications";
import { ButtonLink } from "@/components/ui/Button";

const TBP = "To be provided";

/** Certificate card: image (or an honest placeholder frame), official name, authority, number, validity, view action. */
export default function CertCard({ c, compact = false }: { c: Certification; compact?: boolean }) {
  const pending = c.status === "pending";
  return (
    <article className="card flex flex-col overflow-hidden" data-reveal>
      <div className="relative aspect-4/3 bg-paper">
        {c.image ? (
          <Image src={c.image} alt={`${c.name} certificate`} fill sizes="(min-width:1024px) 30vw, 100vw" className="object-contain p-3" />
        ) : (
          <div className="absolute inset-3 grid place-items-center rounded-lg border-2 border-dashed border-steel-300 text-center">
            <div className="px-4">
              {pending ? <Award className="mx-auto size-10 text-steel-300" strokeWidth={1.4} /> : <ShieldCheck className="mx-auto size-10 text-navy-700" strokeWidth={1.4} />}
              <p className="mt-2 text-sm font-bold text-navy-800">{c.name}</p>
              <p className="mt-1 text-xs text-steel-500">Certificate image placeholder</p>
            </div>
          </div>
        )}
        {!c.image && <span className="absolute left-3 top-3 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">{pending ? "Dummy · scan pending" : "Scan pending"}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-navy-900">{c.name}</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-navy-800">Issued by</dt><dd className="text-steel-600">{c.authority}</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-navy-800">Number</dt><dd className="text-steel-600">{c.number ?? TBP}</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-navy-800">Validity</dt><dd className="text-steel-600">{c.validity ?? TBP}</dd></div>
          {!compact && <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-navy-800">Scope</dt><dd className="text-steel-600">{c.scope}</dd></div>}
        </dl>
        <div className="mt-auto pt-5">
          {c.documentUrl ? (
            <ButtonLink href={c.documentUrl} target="_blank" rel="noopener noreferrer" variant="fabric" size="sm"><FileText className="size-4" />View document</ButtonLink>
          ) : (
            <span className="btn btn-sm btn-ghost cursor-not-allowed opacity-60" aria-disabled="true"><FileText className="size-4" />View document (coming soon)</span>
          )}
        </div>
      </div>
    </article>
  );
}
