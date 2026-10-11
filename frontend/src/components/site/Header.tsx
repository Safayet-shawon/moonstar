"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Phone, X, Zap } from "lucide-react";
import { COMPANY } from "@moonstar/shared";
import { ButtonLink } from "@/components/ui/Button";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/solutions", label: "Solutions" },
  { href: "/products", label: "Products" },
  { href: "/projects", label: "Projects" },
  { href: "/certifications", label: "Certifications" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Moon Star Power & Technology home">
      <span className="grid size-9 place-items-center rounded-lg bg-linear-to-br from-ember-400 to-ember-600 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,.5)]">
        <Zap className="size-5" fill="currentColor" strokeWidth={1.5} />
      </span>
      <span className={`font-display leading-tight ${light ? "text-white" : "text-navy-900"}`}>
        <span className="block text-[15px] font-extrabold tracking-tight">MOON STAR</span>
        <span className={`block text-[10px] font-semibold tracking-[0.18em] ${light ? "text-steel-300" : "text-steel-500"}`}>POWER &amp; TECHNOLOGY</span>
      </span>
    </Link>
  );
}

export default function Header() {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // the menu closes automatically on navigation
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow ${scrolled ? "border-steel-200 shadow-sm" : "border-transparent"}`}>
      <div className="hidden bg-navy-900 text-[12.5px] text-steel-300 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span>{COMPANY.hours} · 24/7 support line</span>
          <a href={COMPANY.phoneHref} className="flex items-center gap-1.5 font-semibold text-white hover:text-ember-400">
            <Phone className="size-3.5" /> {COMPANY.phone}
          </a>
        </div>
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${path.startsWith(n.href) ? "text-ember-600" : "text-navy-800 hover:text-ember-600"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/contact#quote" variant="clay" size="sm" className="hidden sm:inline-flex">Request a Quotation</ButtonLink>
          <Link href="/portal" className="hidden text-xs font-semibold text-steel-500 hover:text-navy-900 xl:block">Staff login</Link>
          <button className="grid size-10 place-items-center rounded-lg text-navy-900 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-steel-200 bg-white px-4 pb-5 pt-2 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block border-b border-steel-100 py-3 text-base font-semibold text-navy-900">{n.label}</Link>
          ))}
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink href="/contact#quote" variant="clay">Request a Quotation</ButtonLink>
            <ButtonLink href={COMPANY.phoneHref} variant="fabric-light"><Phone className="size-4" /> {COMPANY.phone}</ButtonLink>
            <Link href="/portal" className="py-2 text-center text-sm font-semibold text-steel-500">Staff login</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
