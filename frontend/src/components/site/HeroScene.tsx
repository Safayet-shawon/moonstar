"use client";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

/**
 * Decorative "power grid" scene: a drifting lattice of nodes with energy pulses travelling along links.
 * three.js is imported lazily after the page is idle, only on larger screens, and only when
 * motion is allowed. It pauses when scrolled out of view or when the tab is hidden.
 */
export default function HeroScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stop = () => {};
    let cancelled = false;

    const start = async () => {
      const THREE = await import("three");
      if (cancelled || !host.current) return;
      const narrow = el.clientWidth < 700;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
      camera.position.set(0, 0, narrow ? 17 : 16);

      const COLS = narrow ? 7 : 11, ROWS = narrow ? 9 : 6, GAP = narrow ? 1.9 : 2.3;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < COLS; i++)
        for (let j = 0; j < ROWS; j++)
          pts.push(new THREE.Vector3((i - (COLS - 1) / 2) * GAP + (Math.random() - 0.5) * 0.8, (j - (ROWS - 1) / 2) * GAP + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 3));

      const links: [number, number][] = [];
      for (let a = 0; a < pts.length; a++)
        for (let b = a + 1; b < pts.length; b++) if (pts[a].distanceTo(pts[b]) < GAP * 1.35) links.push([a, b]);

      const linePos = new Float32Array(links.length * 6);
      links.forEach(([a, b], i) => {
        pts[a].toArray(linePos, i * 6);
        pts[b].toArray(linePos, i * 6 + 3);
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
      const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x4fbf7f, transparent: true, opacity: 0.3 }));

      const ng = new THREE.BufferGeometry().setFromPoints(pts);
      const nodes = new THREE.Points(ng, new THREE.PointsMaterial({ color: 0xc9f5da, size: 0.11, transparent: true, opacity: 0.9 }));

      const PULSES = 26;
      const pulseState = Array.from({ length: PULSES }, () => ({ link: Math.floor(Math.random() * links.length), t: Math.random(), speed: 0.12 + Math.random() * 0.25 }));
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PULSES * 3), 3));
      const pulses = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x3ccf78, size: 0.3, transparent: true, opacity: 0.95, depthWrite: false }));

      const group = new THREE.Group();
      group.add(lines, nodes, pulses);
      scene.add(group);

      let raf = 0, last = performance.now(), running = true, visible = true;
      const mouse = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (!running || !visible) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        group.rotation.y += (mouse.x * 0.18 - group.rotation.y) * 0.03;
        group.rotation.x += (mouse.y * 0.1 - group.rotation.x) * 0.03;
        const arr = pg.attributes.position.array as Float32Array;
        pulseState.forEach((p, i) => {
          p.t += p.speed * dt;
          if (p.t >= 1) {
            p.t = 0;
            p.link = Math.floor(Math.random() * links.length);
          }
          const [a, b] = links[p.link];
          arr[i * 3] = pts[a].x + (pts[b].x - pts[a].x) * p.t;
          arr[i * 3 + 1] = pts[a].y + (pts[b].y - pts[a].y) * p.t;
          arr[i * 3 + 2] = pts[a].z + (pts[b].z - pts[a].z) * p.t;
        });
        pg.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
      io.observe(el);
      const onVis = () => (running = !document.hidden);
      document.addEventListener("visibilitychange", onVis);
      const onResize = () => {
        const nw = el.clientWidth, nh = el.clientHeight;
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);

      stop = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onMove);
        [lg, ng, pg].forEach((g) => g.dispose());
        [lines.material, nodes.material, pulses.material].forEach((m) => (m as THREE.Material).dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => start(), { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => {
      cancelled = true;
      if (!idle) clearTimeout(handle as number);
      stop();
    };
  }, []);

  return <div ref={host} aria-hidden className="pointer-events-none absolute inset-0 opacity-80" />;
}
