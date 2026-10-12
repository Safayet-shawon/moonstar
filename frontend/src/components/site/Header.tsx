"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation } from "motion/react";
import * as m from "motion/react-m";
import { Menu, Phone, X } from "lucide-react";
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

export function Logo({ light = false, size = 44 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="Moon Star Power & Technology home">
      <Image src="/img/logo-192.webp" alt="" width={size} height={size} priority className="shrink-0 transition-transform duration-700 group-hover:rotate-[360deg]" />
      <span className={`font-display leading-tight ${light ? "text-white" : "text-forest-900"}`}>
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
    <header className={`sticky top-0 z-50 border-b transition-all duration-300 ${scrolled ? "glass-light border-white/60" : "border-transparent bg-white"}`}>
      <div id="scroll-progress" aria-hidden />
      <div className="hidden bg-forest-900 text-[12.5px] text-steel-300 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span>{COMPANY.hours} · 24/7 support line</span>
          <a href={COMPANY.phoneHref} className="flex items-center gap-1.5 font-semibold text-white hover:text-brand-400">
            <Phone className="size-3.5" /> {COMPANY.phone}
          </a>
        </div>
      </div>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`relative rounded-md px-3 py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-brand-500 after:transition-transform after:duration-300 hover:after:scale-x-100 ${path.startsWith(n.href) ? "text-brand-600 after:scale-x-100" : "text-forest-800 hover:text-brand-600"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/contact#quote" variant="clay" size="sm" className="hidden sm:inline-flex" data-magnetic>Request a Quotation</ButtonLink>
          <Link href="/portal" className="hidden text-xs font-semibold text-steel-500 hover:text-forest-900 xl:block">Staff login</Link>
          <button className="grid size-10 place-items-center rounded-lg text-forest-900 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <LazyMotion features={domAnimation}>
        <AnimatePresence>
          {open && (
            <m.nav key="mobile" aria-label="Mobile" className="overflow-hidden border-t border-steel-200 bg-white lg:hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>
              <div className="px-4 pb-5 pt-2">
                {NAV.map((n, i) => (
                  <m.div key={n.href} initial={{ x: -14, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.04 * i, duration: 0.25 }}>
                    <Link href={n.href} className="block border-b border-steel-100 py-3 text-base font-semibold text-forest-900">{n.label}</Link>
                  </m.div>
                ))}
                <div className="mt-4 flex flex-col gap-2">
                  <ButtonLink href="/contact#quote" variant="clay">Request a Quotation</ButtonLink>
                  <ButtonLink href={COMPANY.phoneHref} variant="fabric-light"><Phone className="size-4" /> {COMPANY.phone}</ButtonLink>
                  <Link href="/portal" className="py-2 text-center text-sm font-semibold text-steel-500">Staff login</Link>
                </div>
              </div>
            </m.nav>
          )}
        </AnimatePresence>
      </LazyMotion>
    </header>
  );
}
