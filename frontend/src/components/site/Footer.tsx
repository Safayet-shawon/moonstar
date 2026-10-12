import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { COMPANY } from "@moonstar/shared";
import { SOLUTIONS } from "@/content/solutions";
import { Logo } from "./Header";

const Fb = () => (<svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.7V13h2.7v8h3.1z"/></svg>);
const Yt = () => (<svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>);

export default function Footer() {
  return (
    <footer className="bg-forest-950 text-steel-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{COMPANY.tagline}. Supply, installation, testing, commissioning and maintenance of electrical power equipment.</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-steel-300">{COMPANY.approval}.</p>
          <div className="mt-5 flex gap-3">
            <a href={COMPANY.facebook} aria-label="Facebook" rel="noopener noreferrer" target="_blank" className="grid size-9 place-items-center rounded-lg bg-white/10 hover:bg-brand-500"><Fb /></a>
            <a href={COMPANY.youtube} aria-label="YouTube" rel="noopener noreferrer" target="_blank" className="grid size-9 place-items-center rounded-lg bg-white/10 hover:bg-brand-500"><Yt /></a>
          </div>
        </div>
        <nav aria-label="Solutions" className="md:col-span-3">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Solutions</h2>
          <ul className="space-y-2 text-sm">
            {SOLUTIONS.map((s) => (
              <li key={s.slug}><Link className="hover:text-brand-400" href={`/solutions/${s.slug}`}>{s.title}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company" className="md:col-span-2">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Company</h2>
          <ul className="space-y-2 text-sm">
            {[["/about", "About us"], ["/projects", "Projects"], ["/certifications", "Certifications"], ["/products", "Products"], ["/resources", "Resources & FAQ"], ["/contact", "Contact"], ["/portal", "Staff portal"]].map(([h, l]) => (
              <li key={h}><Link className="hover:text-brand-400" href={h}>{l}</Link></li>
            ))}
          </ul>
        </nav>
        <address className="space-y-3 text-sm not-italic md:col-span-3">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Contact</h2>
          <a href={COMPANY.phoneHref} className="flex gap-2 hover:text-brand-400"><Phone className="mt-0.5 size-4 shrink-0 text-brand-500" />{COMPANY.phone}</a>
          <a href={`mailto:${COMPANY.email}`} className="flex gap-2 hover:text-brand-400"><Mail className="mt-0.5 size-4 shrink-0 text-brand-500" />{COMPANY.email}</a>
          <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" /><span><b className="text-white">Factory:</b> {COMPANY.factory}</span></p>
          <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" /><span><b className="text-white">Khulna office:</b> {COMPANY.khulna}</span></p>
        </address>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-steel-300">
        © {new Date().getFullYear()} {COMPANY.name}. All rights reserved. Estimates and indicative sizing are preliminary and subject to engineering review.
      </div>
    </footer>
  );
}
