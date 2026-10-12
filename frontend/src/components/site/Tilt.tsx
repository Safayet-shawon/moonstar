"use client";
import { useRef } from "react";
import { LazyMotion, domAnimation, useMotionValue, useSpring, useTransform } from "motion/react";
import * as m from "motion/react-m";

/**
 * 3D tilt on pointer move (spring physics) with a moving glare. Disabled for touch and reduced motion.
 * Wrap a card: <Tilt className="..."><Card/></Tilt>
 */
export default function Tilt({ children, className = "", max = 9 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 18, mass: 0.6 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18, mass: 0.6 });
  const z = useTransform(srx, (v) => Math.abs(v) * 0.6);

  const allowed = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!allowed() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * max);
    rx.set((0.5 - py) * 2 * max);
    ref.current.style.setProperty("--gx", `${px * 100}%`);
    ref.current.style.setProperty("--gy", `${py * 100}%`);
  };
  const leave = () => { rx.set(0); ry.set(0); };

  return (
    <LazyMotion features={domAnimation}>
      <div className="tilt-scene h-full">
        <m.div ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ rotateX: srx, rotateY: sry, translateZ: z }} className={`tilt relative h-full ${className}`}>
          {children}
          <span className="tilt-glare" aria-hidden />
        </m.div>
      </div>
    </LazyMotion>
  );
}
