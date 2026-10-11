import type { Metadata } from "next";
import { PageHero } from "@/components/site/parts";
import CertCard from "@/components/site/CertCard";
import { ButtonLink } from "@/components/ui/Button";
import { CERTIFICATIONS } from "@/content/certifications";

export const metadata: Metadata = { title: "Certifications & Approvals", description: "Government approvals and certifications held by Moon Star Power & Technology." };

export default function Certifications() {
  const anyPending = CERTIFICATIONS.some((c) => c.status === "pending");
  return (
    <>
      <PageHero eyebrow="Certifications" title="Approvals and certifications" text="Government approval, BSTI and ELB-related certification information for Moon Star Power & Technology." />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{CERTIFICATIONS.map((c) => <CertCard key={c.name} c={c} />)}</div>
        {anyPending && (
          <p className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Certificate scans marked “Dummy · scan pending” are temporary placeholders. Registration numbers, validity dates and documents will be published once the originals are supplied and verified.
          </p>
        )}
        <div className="mt-10 text-center">
          <p className="text-sm text-steel-600">Need a copy of a certificate for tender or compliance purposes?</p>
          <ButtonLink href="/contact#quote" variant="clay" className="mt-3">Request certificate copies</ButtonLink>
        </div>
      </section>
    </>
  );
}
