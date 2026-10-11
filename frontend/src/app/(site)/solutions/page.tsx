import type { Metadata } from "next";
import { PageHero, SolutionCard } from "@/components/site/parts";
import { SOLUTIONS } from "@/content/solutions";

export const metadata: Metadata = { title: "Solutions & Services", description: "Substations, transformers, HT/LT panels, PFI panels, diesel generators, solar, lifts and maintenance services." };

export default function Solutions() {
  return (
    <>
      <PageHero eyebrow="Solutions & services" title="Everything your building needs to stay powered" text="Choose a solution to see what we supply, the projects we serve and how to request a technical consultation." image="/img/substation.webp" />
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{SOLUTIONS.map((s, i) => <SolutionCard key={s.slug} s={s} priority={i < 4} />)}</div>
      </section>
    </>
  );
}
