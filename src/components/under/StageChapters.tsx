"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Stage } from "@/lib/stage";
import { useExperience } from "../Experience";

const LABELS = [
  "Monologue amplifier",
  "Plausible deniability shroud",
  "Gimbal of consequences",
  "The heart. Forty millilitres of concentrated Monday.",
  "Regret-proof plating",
  "Henchman interlock",
  "Self-destruct (decorative)",
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const win = (x: number, a: number, b: number, f = 0.06) => smooth(a, a + f, x) * (1 - smooth(b - f, b, x));

/** Chapters 4 and 5 share one pinned WebGL stage: the spread, then the device. */
export default function StageChapters() {
  const { touch, reduced } = useExperience();
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let stage: Stage | null = null;
    let dead = false;
    let loading = false;
    let visible = false;
    let P = 0;
    let needsStill = true;
    const mobile = touch || window.innerWidth < 760;
    const lines = Array.from(copy.current!.children) as HTMLElement[];
    const labelEls = Array.from(labels.current!.children) as HTMLElement[];

    const born = performance.now();
    const load = () => {
      if (loading) return;
      loading = true;
      // never build the scene while the takeover is still receding
      const hold = Math.max(0, 4200 - (performance.now() - born));
      const mod = import("@/lib/stage");
      new Promise((r) => window.setTimeout(r, hold)).then(() => mod).then((m) => {
        if (dead) return;
        try {
          stage = new m.Stage(cv, mobile);
          cv.classList.add("is-ready");
        } catch (e) {
          console.warn("[stage] unavailable", e);
        }
      });
    };
    // module warms early; the scene itself builds when the chapter before it is on screen
    const warm = window.setTimeout(() => void import("@/lib/stage"), 1200);
    const ioLoad = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) load();
      },
      { rootMargin: "220% 0px" }
    );
    ioLoad.observe(el);
    const ioVis = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    ioVis.observe(el);

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        P = self.progress;
        needsStill = true;
        if (stage) stage.surge = Math.min(3, Math.abs(self.getVelocity()) / 1600);
      },
    });

    const ptr = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const onResize = () => {
      stage?.resize();
      needsStill = true;
    };
    window.addEventListener("resize", onResize);

    const tick = (_t: number, dms: number) => {
      if (!visible) return;
      let s = Math.min(1, P / 0.46);
      let d = Math.min(1, Math.max(0, (P - 0.5) / 0.5));
      const isDevice = P >= 0.485;
      if (reduced) {
        s = 0.5;
        d = 0.58;
      }
      // copy
      const sw = [win(s, 0.0, 0.3), win(s, 0.34, 0.62), win(s, 0.66, 0.93)];
      const dw = [win(d, 0.03, 0.2), win(d, 0.9, 1.2)];
      if (reduced) {
        sw[0] = isDevice ? 0 : 1;
        sw[1] = sw[2] = 0;
        dw[0] = isDevice ? 1 : 0;
        dw[1] = 0;
      }
      [...sw, ...dw].forEach((o, i) => {
        const on = i < 3 ? !isDevice : isDevice;
        const v = on ? o : 0;
        lines[i].style.opacity = v.toFixed(3);
        lines[i].style.visibility = v < 0.01 ? "hidden" : "visible";
        if (!reduced) lines[i].style.transform = `translate3d(0, ${((1 - v) * 18).toFixed(1)}px, 0)`;
      });
      if (flash.current) flash.current.style.opacity = reduced ? "0" : (smooth(0.445, 0.482, P) * (1 - smooth(0.5, 0.545, P))).toFixed(3);
      if (!stage) return;
      stage.pointer.x += (ptr.x - stage.pointer.x) * 0.08;
      stage.pointer.y += (ptr.y - stage.pointer.y) * 0.08;
      stage.spread = s;
      stage.device = d;
      stage.active = isDevice ? "device" : "spread";
      stage.surge *= 0.94;
      if (reduced) {
        if (needsStill) {
          stage.frame(0.016);
          stage.frame(0.016);
          needsStill = false;
        }
      } else stage.frame(dms / 1000);
      // labels
      const L = stage.labels;
      const vw = window.innerWidth;
      labelEls.forEach((le, i) => {
        const a = isDevice ? L[i * 3 + 2] : 0;
        le.style.opacity = a.toFixed(3);
        le.style.visibility = a < 0.01 ? "hidden" : "visible";
        if (a < 0.01) return;
        const x = L[i * 3];
        const y = L[i * 3 + 1];
        const right = i === 0 || i === 2 || i === 6;
        const col = vw / 2 + (right ? 1 : -1) * Math.min(vw * (vw < 760 ? 0.27 : 0.3), 430);
        const len = Math.max(vw < 760 ? 14 : 30, right ? col - x : x - col);
        le.classList.toggle("is-left", !right);
        le.style.setProperty("--len", `${len.toFixed(0)}px`);
        le.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
    };
    gsap.ticker.add(tick);

    return () => {
      dead = true;
      window.clearTimeout(warm);
      ioLoad.disconnect();
      ioVis.disconnect();
      st.kill();
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      stage?.dispose();
    };
  }, [touch, reduced]);

  return (
    <section className="stage" ref={wrap}>
      <div className="stage-pin">
        <canvas ref={canvas} className="stage-canvas" aria-hidden="true" />
        <div className="stage-copy" ref={copy}>
          <h2 className="is-spread">It starts in one quiet city.</h2>
          <p className="is-spread">Then the one beside it.</p>
          <p className="is-spread">By the time anyone looks up, it is already everywhere.</p>
          <h2 className="is-device">Every empire keeps something in the basement.</h2>
          <p className="is-device">It does exactly what you think it does.</p>
        </div>
        <div className="stage-labels" ref={labels} aria-hidden="true">
          {LABELS.map((l) => (
            <div className="stage-label" key={l}>
              <i />
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div className="stage-flash" ref={flash} aria-hidden="true" />
      </div>
    </section>
  );
}
