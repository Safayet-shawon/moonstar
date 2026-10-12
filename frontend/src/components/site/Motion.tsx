"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Site-wide motion controller (public pages only). GSAP, ScrollTrigger and Lenis load on demand in a
 * separate chunk when the browser is idle, and are skipped entirely for visitors who prefer reduced motion.
 *   - Lenis smooth scrolling (desktop pointers), synchronised with GSAP's ticker
 *   - scroll-progress bar, staggered reveals, image parallax, process-line drawing
 *   - magnetic buttons: elements with [data-magnetic] drift toward the cursor
 */
export default function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((e) => (e.style.opacity = "1"));
      return;
    }
    let cleanup = () => {};
    let cancelled = false;
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const defer = (fn: () => void) => (idle ? idle(fn, { timeout: 1000 }) : window.setTimeout(fn, 300));

    defer(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      // ---- smooth scroll (mouse devices only; touch keeps native momentum) ----
      let lenis: import("lenis").default | undefined;
      let tick: ((t: number) => void) | undefined;
      {
        const { default: Lenis } = await import("lenis");
        if (cancelled) return;
        const l = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
        lenis = l;
        l.on("scroll", ScrollTrigger.update);
        tick = (t: number) => l.raf(t * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      }

      const ctx = gsap.context(() => {
        ScrollTrigger.batch("[data-reveal]", {
          start: "top 90%",
          once: true,
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.09, overwrite: true }),
        });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.fromTo(el, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
        });
        const line = document.querySelector<HTMLElement>("[data-draw]");
        if (line) gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", ease: "none", scrollTrigger: { trigger: line, start: "top 85%", end: "bottom 55%", scrub: true } });
        const bar = document.getElementById("scroll-progress");
        if (bar) gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.2 } });
        // floating decorative blocks
        gsap.utils.toArray<HTMLElement>("[data-float]").forEach((el, i) => gsap.to(el, { y: -14, duration: 3 + i * 0.4, ease: "sine.inOut", repeat: -1, yoyo: true }));
      });

      // ---- magnetic buttons ----
      const magnets = new Map<HTMLElement, { x: (v: number) => void; y: (v: number) => void }>();
      const quick = (el: HTMLElement) => {
        let q = magnets.get(el);
        if (!q) {
          q = { x: gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" }), y: gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" }) };
          magnets.set(el, q);
        }
        return q;
      };
      const onMove = (e: PointerEvent) => {
        const el = (e.target as HTMLElement | null)?.closest?.("[data-magnetic]") as HTMLElement | null;
        magnets.forEach((_, m) => { if (m !== el) { quick(m).x(0); quick(m).y(0); } });
        if (!el) return;
        const r = el.getBoundingClientRect();
        quick(el).x((e.clientX - (r.left + r.width / 2)) * 0.28);
        quick(el).y((e.clientY - (r.top + r.height / 2)) * 0.35);
      };
      const onLeave = () => magnets.forEach((_, m) => { quick(m).x(0); quick(m).y(0); });
      document.addEventListener("pointermove", onMove, { passive: true }); // mouse hover; on touch it follows the finger while pressed
      document.addEventListener("pointerup", onLeave);
      document.addEventListener("pointerleave", onLeave);
      ScrollTrigger.refresh();

      cleanup = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("pointerup", onLeave);
        magnets.forEach((_, m) => gsap.set(m, { clearProps: "x,y" }));
        ctx.revert();
        if (tick) gsap.ticker.remove(tick);
        lenis?.destroy();
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [pathname]);

  return null;
}
