import type { Metadata } from "next";
import Image from "next/image";
import { COMPANY } from "@moonstar/shared";
import { ButtonLink } from "@/components/ui/Button";
import { PageHero, SectionHead } from "@/components/site/parts";
import { SOLUTIONS } from "@/content/solutions";

export const metadata: Metadata = { title: "About Us", description: "Moon Star Power & Technology: electrical and power solutions provider in Bangladesh." };

export default function About() {
  return (
    <>
      <PageHero eyebrow="About us" title="A technical team building reliable power infrastructure" text={`${COMPANY.name} supplies, installs and maintains transformers, HT and LT panels, diesel generators, PFI panels, solar systems and lifts across Bangladesh.`} image="/img/substation-2.webp" />
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHead eyebrow="Company profile" title="Reliable Power, Smarter Solutions" />
          <div className="mt-6 space-y-4 leading-relaxed text-steel-600" data-reveal>
            <p>Moon Star Power &amp; Technology is a provider of electrical and power solutions in Bangladesh, founded by a technical team. We work with developers, building owners, factories and homeowners from the first consultation to commissioning and maintenance.</p>
            <p>The company is listed as an approved electrical substation manufacturer (Serial No. 94) by the Ministry of Power, Energy &amp; Mineral Resources.</p>
            <p>Our factory is in South Keranigonj, Dhaka, with a branch office at Bashundhara River View and an office in Khulna.</p>
          </div>
          <ButtonLink href="/contact#quote" variant="clay" className="mt-8">Talk to an engineer</ButtonLink>
        </div>
        <div className="relative aspect-4/3 overflow-hidden rounded-xl">
          <Image src="/img/maintenance.webp" alt="Engineers testing a transformer in a substation" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
          <p className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">Illustrative image</p>
        </div>
      </section>
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHead eyebrow="Capabilities" title="What we do" />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((s) => (
              <li key={s.slug} className="card p-5" data-reveal><h3 className="font-bold text-forest-900">{s.title}</h3><p className="mt-2 text-sm text-steel-600">{s.short}</p></li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionHead eyebrow="Locations" title="Where to find us" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[["Factory", COMPANY.factory], ["Branch office", COMPANY.branch], ["Khulna office", COMPANY.khulna]].map(([t, a]) => (
            <div key={t} className="card p-6" data-reveal><h3 className="font-bold text-forest-900">{t}</h3><p className="mt-2 text-sm text-steel-600">{a}</p></div>
          ))}
        </div>
        <ButtonLink href={COMPANY.mapUrl} target="_blank" rel="noopener noreferrer" variant="fabric-light" className="mt-8">Open in Google Maps</ButtonLink>
      </section>
    </>
  );
}
