"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { Ink } from "@/lib/ink";
import { bus } from "@/lib/bus";
import Front from "./Front";

gsap.registerPlugin(ScrollTrigger);

export type Mode = "front" | "under";

interface Ctx {
  mode: Mode;
  reduced: boolean;
  touch: boolean;
  ready: boolean;
  takeover: (el: HTMLElement, burst?: () => void) => void;
  goBack: (el: HTMLElement) => void;
}

const ExperienceCtx = createContext<Ctx | null>(null);
export const useExperience = () => useContext(ExperienceCtx)!;

const loadUnder = () => import("./under/Under");
const Under = dynamic(loadUnder, { ssr: false });

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frames = (n = 2) =>
  new Promise<void>((res) => {
    const step = () => (n-- <= 0 ? res() : requestAnimationFrame(step));
    step();
  });

export default function Experience() {
  const [mode, setMode] = useState<Mode>("front");
  const [env, setEnv] = useState({ reduced: false, touch: false, ready: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let ink: Ink | null = null;
    let lenis: Lenis | null = null;
    let lenisTick: ((t: number) => void) | null = null;
    let cancelled = false;

    if (!reduced && canvasRef.current) {
      ink = new Ink(canvasRef.current);
      if (!ink.ok) ink = null;
    }
    bus.ink = ink;

    const tick = (_t: number, deltaMs: number) => {
      ink?.frame(deltaMs / 1000);
    };
    gsap.ticker.add(tick);

    const onMove = (e: PointerEvent) => {
      if (!ink) return;
      ink.pointer.x = e.clientX;
      ink.pointer.y = e.clientY;
      ink.pointer.active = true;
    };
    const onEnd = (e: PointerEvent) => {
      if (ink && e.pointerType !== "mouse") ink.pointer.active = false;
    };
    const onLeave = () => {
      if (ink) ink.pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onEnd, { passive: true });
    window.addEventListener("pointercancel", onEnd, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    const onResize = () => ink?.resize();
    window.addEventListener("resize", onResize);

    if (!touch && !reduced) {
      import("lenis").then(({ default: LenisCtor }) => {
        if (cancelled) return;
        lenis = new LenisCtor({ lerp: 0.11, wheelMultiplier: 1 });
        bus.lenis = lenis;
        lenis.on("scroll", ScrollTrigger.update);
        lenisTick = (t: number) => lenis!.raf(t * 1000);
        gsap.ticker.add(lenisTick);
        gsap.ticker.lagSmoothing(0);
      });
    }

    // warm the underbelly while the front sits there looking innocent
    const idle = window.setTimeout(() => void loadUnder(), 1800);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({ reduced, touch, ready: true });

    return () => {
      cancelled = true;
      window.clearTimeout(idle);
      gsap.ticker.remove(tick);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      lenis?.destroy();
      bus.lenis = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const swap = useCallback(
    (next: Mode) => {
      flushSync(() => setMode(next));
      document.documentElement.dataset.mode = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "under" ? "#000000" : "#efede6");
      if (bus.lenis) bus.lenis.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    },
    []
  );

  const takeover = useCallback(
    async (el: HTMLElement, burst?: () => void) => {
      if (busy.current) return;
      busy.current = true;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ink = bus.ink;
      const under = loadUnder();
      if (!ink) {
        await under;
        swap("under");
        busy.current = false;
        return;
      }
      const water = bus.water;
      if (water) {
        water.inkPos = { x: x / window.innerWidth, y: Math.max(y / window.innerHeight, water.horizon + 0.06) };
        gsap.to(water, { ink: 1, duration: 1.5, ease: "power1.out" });
        gsap.fromTo(water, { inkT: 0 }, { inkT: 1.7, duration: 1.7, ease: "none" });
      }
      burst?.();
      await wait(680);
      await Promise.all([ink.flood(x, y), under]);
      swap("under");
      ink.accent = 1;
      await frames(3);
      await wait(280);
      ink.recede();
      await wait(900);
      busy.current = false;
    },
    [swap]
  );

  const goBack = useCallback(
    async (el: HTMLElement) => {
      if (busy.current) return;
      busy.current = true;
      const r = el.getBoundingClientRect();
      const ink = bus.ink;
      if (!ink) {
        swap("front");
        busy.current = false;
        return;
      }
      await ink.flood(r.left + r.width / 2, r.top + r.height / 2);
      swap("front");
      ink.ring.w = 0;
      await frames(3);
      const btn = document.querySelector<HTMLElement>("[data-venom]");
      const br = btn?.getBoundingClientRect();
      const x = br ? br.left + br.width / 2 : window.innerWidth / 2;
      const y = br ? br.top + br.height / 2 : window.innerHeight * 0.7;
      const water = bus.water;
      if (water) {
        water.inkPos = { x: x / window.innerWidth, y: Math.max(y / window.innerHeight, water.horizon + 0.06) };
        water.ink = 1;
        water.inkT = 1.7;
        gsap.to(water, { ink: 0, duration: 2.6, ease: "power2.inOut", delay: 0.5 });
      }
      await wait(240);
      ink.accent = 0;
      await ink.drain(x, y);
      busy.current = false;
    },
    [swap]
  );

  const ctx = useMemo<Ctx>(() => ({ mode, ...env, takeover, goBack }), [mode, env, takeover, goBack]);

  return (
    <ExperienceCtx.Provider value={ctx}>
      <canvas ref={canvasRef} className="ink-canvas" aria-hidden="true" />
      {mode === "front" ? <Front /> : <Under />}
    </ExperienceCtx.Provider>
  );
}
