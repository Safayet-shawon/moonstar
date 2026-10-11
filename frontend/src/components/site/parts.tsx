import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Solution } from "@/content/solutions";

export function SectionHead({ eyebrow, title, text, center = false, light = false }: { eyebrow: string; title: string; text?: string; center?: boolean; light?: boolean }) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-2xl`} data-reveal>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className={`mt-2 text-3xl font-extrabold leading-tight sm:text-4xl ${light ? "text-white" : "text-navy-900"}`}>{title}</h2>
      {text && <p className={`mt-4 text-base leading-relaxed ${light ? "text-steel-300" : "text-steel-600"}`}>{text}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, text, image }: { eyebrow: string; title: string; text?: string; image?: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-navy-900 text-white">
      {image && <Image src={image} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-30" priority />}
      <div className="grid-lines absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-navy-950 via-navy-900/90 to-navy-900/40" />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <p className="section-eyebrow" data-intro>{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl" data-intro>{title}</h1>
        {text && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-steel-300" data-intro>{text}</p>}
      </div>
    </section>
  );
}

export function SolutionCard({ s, priority = false }: { s: Solution; priority?: boolean }) {
  return (
    <Link href={`/solutions/${s.slug}`} data-reveal className="group flex flex-col overflow-hidden rounded-xl border border-steel-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-ember-400 hover:shadow-xl">
      <div className="relative aspect-3/2 overflow-hidden bg-steel-100">
        <Image src={s.image} alt={s.imageAlt} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" priority={priority} className="object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-navy-900">{s.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-steel-600">{s.short}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ember-600">
          Explore <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
