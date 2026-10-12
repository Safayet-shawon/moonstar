"use client";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

/**
 * 3D "coin" with the company logo on both faces: slow spin, floating, follows the pointer.
 * three.js loads after the page is idle, on large screens only, with motion allowed; it pauses when off-screen or hidden.
 */
export default function LogoCoin({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stop = () => {};
    let cancelled = false;

    const start = async () => {
      const T = await import("three");
      if (cancelled || !host.current) return;
      const w = el.clientWidth, h = el.clientHeight;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.75 : 2));
      renderer.setSize(w, h);
      renderer.outputColorSpace = T.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(32, w / h, 0.1, 50);
      camera.position.set(0, 0, 6.2);

      const tex = new T.TextureLoader().load("/img/logo.png");
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 8;
      // cylinder caps use a rotated UV frame: turn the texture so the letters read upright from the front
      tex.center.set(0.5, 0.5);
      tex.rotation = Math.PI / 2;
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
      const faceMat = new T.MeshStandardMaterial({ map: tex, transparent: false, metalness: 0.15, roughness: 0.35 });
      const sideMat = new T.MeshStandardMaterial({ color: 0x019541, metalness: 0.7, roughness: 0.28 });
      // Cylinder groups: [side, top, bottom]; the PNG has transparent corners so the face is drawn on a disc of the same green
      const coin = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, 0.22, 96, 1), [sideMat, faceMat, faceMat]);
      coin.rotation.x = Math.PI / 2; // face towards the camera
      const rim = new T.Mesh(new T.TorusGeometry(1.35, 0.045, 16, 96), new T.MeshStandardMaterial({ color: 0xbff5d3, metalness: 0.9, roughness: 0.2 }));
      const rimBack = rim.clone();
      rim.position.z = 0.11; rimBack.position.z = -0.11;
      const group = new T.Group();
      group.add(coin, rim, rimBack);
      scene.add(group);

      scene.add(new T.AmbientLight(0xffffff, 0.9));
      const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
      const fill = new T.PointLight(0x3ccf78, 18, 20); fill.position.set(-4, -2, 3); scene.add(fill);

      let raf = 0, visible = true, running = true;
      const mouse = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => { mouse.x = (e.clientX / window.innerWidth - 0.5) * 2; mouse.y = (e.clientY / window.innerHeight - 0.5) * 2; }; // finger drag works too
      window.addEventListener("pointermove", onMove, { passive: true });
      const clock = new T.Clock();
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible || !running) return;
        const t = clock.getElapsedTime();
        group.rotation.y = Math.sin(t * 0.6) * 0.9 + mouse.x * 0.5; // swing so both the face and the edge catch the light
        group.rotation.x += ((mouse.y * 0.35) - group.rotation.x) * 0.06;
        group.position.y = Math.sin(t * 1.1) * 0.12;
        renderer.render(scene, camera);
      };
      tick();
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
      io.observe(el);
      const onVis = () => (running = !document.hidden);
      document.addEventListener("visibilitychange", onVis);
      const onResize = () => { const nw = el.clientWidth, nh = el.clientHeight; renderer.setSize(nw, nh); camera.aspect = nw / nh; camera.updateProjectionMatrix(); };
      window.addEventListener("resize", onResize);

      stop = () => {
        cancelAnimationFrame(raf); io.disconnect();
        document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", onMove);
        coin.geometry.dispose(); rim.geometry.dispose(); faceMat.dispose(); sideMat.dispose(); tex.dispose();
        renderer.dispose(); renderer.domElement.remove();
      };
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => start(), { timeout: 3000 }) : window.setTimeout(start, 1500);
    return () => { cancelled = true; if (!idle) clearTimeout(handle as number); stop(); };
  }, []);

  return <div ref={host} aria-hidden className={`pointer-events-none ${className}`} />;
}
