import type { Metadata } from "next";
import { FileText, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/Button";
import { CERTIFICATIONS } from "@/content/certifications";

export const metadata: Metadata = { title: "Certifications & Approvals", description: "Government approvals and registrations held by Moon Star Power & Technology." };

export default function Certifications() {
  return (
    <>
      <PageHero eyebrow="Certifications" title="Approvals and registrations" text="We publish approvals only when the supporting document has been verified." />
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {CERTIFICATIONS.map((c) => (
            <article key={c.name} className="card p-7">
              <ShieldCheck className="size-8 text-ember-500" />
              <h2 className="mt-3 text-xl font-bold text-navy-900">{c.name}</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-navy-800">Issuing authority</dt><dd className="text-steel-600">{c.authority}</dd></div>
                {c.number && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-navy-800">Registration</dt><dd className="text-steel-600">{c.number}</dd></div>}
                {c.validity && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-navy-800">Validity</dt><dd className="text-steel-600">{c.validity}</dd></div>}
                <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-navy-800">Scope</dt><dd className="text-steel-600">{c.scope}</dd></div>
              </dl>
              {c.documentUrl ? (
                <ButtonLink href={c.documentUrl} target="_blank" rel="noopener noreferrer" variant="fabric" size="sm" className="mt-5"><FileText className="size-4" /> View document</ButtonLink>
              ) : (
                <p className="mt-5 rounded bg-steel-100 px-3 py-2 text-xs text-steel-600">A scanned copy of the certificate is available on request. Contact us to verify.</p>
              )}
            </article>
          ))}
        </div>
        <p className="mt-10 text-sm text-steel-500">Approval details are as listed by the company. To verify a certificate, please contact the issuing authority or request the document from us.</p>
      </section>
    </>
  );
}
