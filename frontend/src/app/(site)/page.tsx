import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList, Cog, HardHat, Headset, ShieldCheck, Wrench } from "lucide-react";
import { COMPANY } from "@moonstar/shared";
import { ButtonLink } from "@/components/ui/Button";
import HeroScene from "@/components/site/HeroScene";
import ContactForm from "@/components/site/ContactForm";
import { SectionHead, SolutionCard } from "@/components/site/parts";
import { SOLUTIONS, PROCESS } from "@/content/solutions";
import { PROJECTS } from "@/content/projects";
import { FAQS } from "@/content/faqs";

const WHY = [
  { icon: Cog, title: "Engineering expertise", text: "Led by a technical team. Equipment is selected from documented load calculations, not rules of thumb." },
  { icon: ShieldCheck, title: "Safety & technical compliance", text: "Approved electrical substation manufacturer listed by the Ministry of Power, Energy & Mineral Resources." },
  { icon: BadgeCheck, title: "Quality equipment", text: "Transformers, HT/LT panels, PFI panels, generators and solar systems supplied to project specifications." },
  { icon: ClipboardList, title: "Project-specific solutions", text: "Consultation and site audit first; every proposal is itemised for your building or plant." },
  { icon: HardHat, title: "Installation & commissioning", text: "Installation, testing and commissioning handled as part of the same package." },
  { icon: Headset, title: "After-sales support", text: "24/7 support line and maintenance services for installed equipment." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-navy-950 text-white">
        <Image src="/img/hero-transformer.webp" alt="Engineer inspecting a power transformer in an outdoor substation" fill priority sizes="100vw" quality={70} className="-z-30 scale-110 object-cover" data-parallax />
        <div className="absolute inset-0 -z-20 bg-linear-to-r from-navy-950 via-navy-950/85 to-navy-900/35" />
        <div className="grid-lines absolute inset-0 -z-10 opacity-60" />
        <HeroScene />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-4 py-24 sm:min-h-[680px]">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-steel-100 backdrop-blur" data-intro>
            <ShieldCheck className="size-4 text-ember-400" />
            Approved electrical substation manufacturer · Serial No. 94 · Ministry of Power, Energy &amp; Mineral Resources
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl" data-intro>
            Powering Buildings.<br />
            <span className="text-ember-400">Engineering Reliable Energy.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-steel-200" data-intro>
            Integrated power infrastructure and electrical engineering solutions for residential, commercial and industrial projects across Bangladesh.
          </p>
          <div className="mt-9 flex flex-wrap gap-3" data-intro>
            <ButtonLink href="/contact#quote" variant="clay" size="lg">Request a Quotation <ArrowRight className="size-4" /></ButtonLink>
            <ButtonLink href="/solutions" variant="glass" size="lg">Explore Our Solutions</ButtonLink>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-b border-steel-200 bg-paper">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-navy-900 text-white"><ShieldCheck className="size-5" /></span>
            <p className="text-sm text-navy-800"><b>Government-listed manufacturer.</b> Approved electrical substation manufacturer, Serial No. 94, Ministry of Power, Energy &amp; Mineral Resources.</p>
          </div>
          <Link href="/certifications" className="text-sm font-bold text-ember-600 hover:underline">View approvals →</Link>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionHead eyebrow="Our solutions" title="Complete power infrastructure under one roof" text="From the transformer to the panel, the generator and the solar roof: one accountable team for supply, installation and maintenance." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTIONS.map((s, i) => <SolutionCard key={s.slug} s={s} priority={i < 4} />)}
        </div>
      </section>

      {/* WHY */}
      <section className="bg-navy-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHead light eyebrow="Why Moon Star" title="Engineered for reliability, backed after the handover" />
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="bg-navy-900 p-7 transition-colors hover:bg-navy-800" data-reveal>
                <w.icon className="size-7 text-ember-400" strokeWidth={1.6} />
                <h3 className="mt-4 text-lg font-bold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-steel-300">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Featured projects" title="Substations delivered across Dhaka" />
          <ButtonLink href="/projects" variant="fabric-light">All projects</ButtonLink>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.slice(0, 3).map((p) => (
            <article key={p.name} className="card p-6 transition-shadow hover:shadow-lg" data-reveal>
              <p className="font-display text-5xl font-extrabold text-navy-900">{p.capacityKva}<span className="ml-1 text-lg font-bold text-ember-600">kVA</span></p>
              <h3 className="mt-3 text-lg font-bold text-navy-900">{p.name}</h3>
              <p className="mt-1 text-sm text-steel-600">{p.location}</p>
              <p className="mt-4 inline-block rounded bg-steel-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-steel-600">{p.type}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHead eyebrow="How we work" title="From first conversation to long-term maintenance" />
          <div className="relative mt-14">
            <div className="absolute left-0 right-0 top-5 hidden h-0.5 bg-steel-200 lg:block"><div data-draw className="h-full w-full bg-ember-500" /></div>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
              {PROCESS.map((p) => (
                <li key={p.n} className="relative" data-reveal>
                  <span className="relative z-10 grid size-10 place-items-center rounded-full bg-navy-900 font-display text-sm font-bold text-white ring-4 ring-paper">{p.n}</span>
                  <h3 className="mt-4 font-bold text-navy-900">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel-600">{p.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionHead eyebrow="Technical resources" title="Questions engineers and owners ask us" text="Sizing, power factor, commissioning and maintenance: the short answers." />
          <ButtonLink href="/resources" variant="fabric" className="mt-8"><Wrench className="size-4" /> More resources</ButtonLink>
        </div>
        <div className="space-y-3 lg:col-span-3">
          {FAQS.slice(0, 4).map((f) => (
            <details key={f.q} className="group card p-5 open:border-ember-400" data-reveal>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-navy-900">
                {f.q}<span className="text-xl text-ember-600 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-steel-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="quote" className="bg-navy-900 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionHead light eyebrow="Consultation" title="Tell us about your project" text="Share your location, approximate load and the equipment you need. An engineer will respond with the next steps." />
            <dl className="mt-8 space-y-4 text-sm text-steel-200">
              <div><dt className="font-bold text-white">24/7 support line</dt><dd><a className="hover:text-ember-400" href={COMPANY.phoneHref}>{COMPANY.phone}</a></dd></div>
              <div><dt className="font-bold text-white">Email</dt><dd><a className="hover:text-ember-400" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></dd></div>
              <div><dt className="font-bold text-white">Factory</dt><dd>{COMPANY.factory}</dd></div>
              <div><dt className="font-bold text-white">Branch office</dt><dd>{COMPANY.branch}</dd></div>
              <div><dt className="font-bold text-white">Khulna office</dt><dd>{COMPANY.khulna}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl bg-white p-6 text-navy-900 sm:p-8 lg:col-span-3"><ContactForm /></div>
        </div>
      </section>
    </>
  );
}
