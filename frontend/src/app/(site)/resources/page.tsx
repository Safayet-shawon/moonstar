import type { Metadata } from "next";
import { PageHero } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/Button";
import { FAQS } from "@/content/faqs";

export const metadata: Metadata = { title: "Technical Resources & FAQ", description: "Transformer sizing, power factor correction, commissioning and maintenance explained." };

export default function Resources() {
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <>
      <PageHero eyebrow="Technical resources" title="Frequently asked questions" text="Plain-language answers on sizing, power factor and project delivery." />
      <section className="mx-auto max-w-3xl px-4 py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group card p-5 open:border-ember-400">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-navy-900">{f.q}<span className="text-xl text-ember-600 transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 leading-relaxed text-steel-600">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center"><ButtonLink href="/contact#quote" variant="clay" size="lg">Ask an engineer</ButtonLink></div>
      </section>
    </>
  );
}
