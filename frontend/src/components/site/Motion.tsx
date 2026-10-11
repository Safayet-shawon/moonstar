"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-triggered reveals with GSAP. GSAP + ScrollTrigger are loaded on demand (separate chunk)
 * and skipped entirely when the visitor prefers reduced motion.
 */
export default function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((e) => (e.style.opacity = "1"));
      return;
    }
    let ctx: { revert: () => void } | undefined;
    let cancelled = false;
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const defer = (fn: () => void) => (idle ? idle(fn, { timeout: 1000 }) : window.setTimeout(fn, 300));
    defer(async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        ScrollTrigger.batch("[data-reveal]", {
          start: "top 88%",
          once: true,
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.75, ease: "power2.out", stagger: 0.09, overwrite: true }),
        });
        // parallax on images marked data-parallax
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
        });
        // process timeline line
        const line = document.querySelector<HTMLElement>("[data-draw]");
        if (line) gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", ease: "none", scrollTrigger: { trigger: line, start: "top 85%", end: "bottom 55%", scrub: true } });
      });
      ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [pathname]);
  return null;
}
