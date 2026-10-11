import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PageHero, SolutionCard } from "@/components/site/parts";
import { SOLUTIONS } from "@/content/solutions";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  return s ? { title: s.title, description: s.short } : {};
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  if (!s) notFound();
  const others = SOLUTIONS.filter((x) => x.slug !== s.slug).slice(0, 4);
  return (
    <>
      <PageHero eyebrow="Solution" title={s.title} text={s.short} />
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-2">
        <div>
          <div className="relative aspect-3/2 overflow-hidden rounded-xl bg-steel-100">
            <Image src={s.image} alt={s.imageAlt} fill priority sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
          </div>
          {s.notes && <p className="mt-2 text-xs text-steel-500">{s.notes}</p>}
        </div>
        <div>
          <p className="text-lg leading-relaxed text-steel-600">{s.intro}</p>
          <h2 className="mt-8 text-xl font-bold text-navy-900">What we provide</h2>
          <ul className="mt-3 space-y-2">{s.provide.map((p) => <li key={p} className="flex gap-2 text-steel-600"><Check className="mt-0.5 size-5 shrink-0 text-ember-500" />{p}</li>)}</ul>
          <h2 className="mt-8 text-xl font-bold text-navy-900">Projects we serve</h2>
          <ul className="mt-3 space-y-2">{s.serves.map((p) => <li key={p} className="flex gap-2 text-steel-600"><Check className="mt-0.5 size-5 shrink-0 text-navy-700" />{p}</li>)}</ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href={`/contact?service=${encodeURIComponent(s.title)}#quote`} variant="clay" size="lg">Request a technical consultation</ButtonLink>
            {s.productCategory && <ButtonLink href="/products" variant="fabric-light" size="lg">View catalogue</ButtonLink>}
          </div>
          <p className="mt-4 text-xs text-steel-500">Scope, ratings and specifications are confirmed per project after consultation. Not every item is manufactured in-house; we will confirm the source for your project.</p>
        </div>
      </section>
      <section className="bg-paper py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-2xl font-bold text-navy-900">Other solutions</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{others.map((o) => <SolutionCard key={o.slug} s={o} />)}</div>
          <p className="mt-8 text-sm"><Link href="/solutions" className="font-bold text-ember-600">All solutions →</Link></p>
        </div>
      </section>
    </>
  );
}
