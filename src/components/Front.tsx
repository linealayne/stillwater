"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Water } from "@/lib/water";
import { bus } from "@/lib/bus";
import { useExperience } from "./Experience";
import VenomButton from "./VenomButton";

function Flick({ to, children }: { to: string; children: string }) {
  return (
    <span className="flick" data-flick={to}>
      <span>{children}</span>
    </span>
  );
}

export default function Front() {
  const { reduced, ready, takeover } = useExperience();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pupil = useRef<SVGCircleElement>(null);
  const crack = useRef<SVGSVGElement>(null);

  // the water
  useEffect(() => {
    if (!ready || !canvas.current) return;
    const cv = canvas.current;
    const water = new Water(cv);
    if (!water.ok) return;
    water.staticMode = reduced;
    bus.water = water;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(cv);
    const tick = (_t: number, d: number) => {
      if (visible && !reduced) water.frame(d / 1000);
    };
    gsap.ticker.add(tick);
    water.draw();
    const onResize = () => {
      water.resize();
      water.draw();
    };
    window.addEventListener("resize", onResize);
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      water.touch(e.clientX - r.left, e.clientY - r.top, e.type === "pointerdown");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      gsap.killTweensOf(water);
      if (bus.water === water) bus.water = null;
    };
  }, [reduced, ready]);

  // the logo watches
  useEffect(() => {
    if (!ready || reduced) return;
    const el = pupil.current;
    if (!el) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" });
    const onMove = (e: PointerEvent) => {
      const r = el.ownerSVGElement!.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 320) * 3.1;
      xTo((dx / d) * k);
      yTo((dy / d) * k);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [ready, reduced]);

  // the wrongness
  useEffect(() => {
    if (!ready || reduced || !root.current) return;
    const el = root.current;
    let timer = 0;
    let n = 0;
    const inView = (node: Element) => {
      const r = node.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    const flick = () => {
      const all = Array.from(el.querySelectorAll<HTMLElement>(".flick")).filter(inView);
      if (!all.length) return;
      const target = all[Math.floor(Math.random() * all.length)];
      target.classList.add("flick-on");
      window.setTimeout(() => target.classList.remove("flick-on"), 85);
    };
    const doCrack = () => {
      const svg = crack.current;
      if (!svg) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      let x = w * (0.12 + Math.random() * 0.76);
      let y = h * (0.1 + Math.random() * 0.5);
      const ang = Math.random() * Math.PI;
      let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      const segs = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < segs; i++) {
        const a = ang + (Math.random() - 0.5) * 1.5;
        const l = 14 + Math.random() * 30;
        x += Math.cos(a) * l;
        y += Math.sin(a) * l;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      svg.querySelector("path")!.setAttribute("d", d);
      gsap.killTweensOf(svg);
      gsap.set(svg, { opacity: 1 });
      gsap.to(svg, { opacity: 0, duration: 0.7, delay: 0.24, ease: "power1.in" });
    };
    const shadow = () => {
      const w = bus.water;
      if (!w) return;
      gsap.fromTo(w, { shadow: 0.001 }, { shadow: 1, duration: 8, ease: "sine.inOut", onComplete: () => void (w.shadow = 0) });
    };
    const acts = [flick, doCrack, flick, shadow, flick, doCrack];
    const loop = () => {
      acts[n % acts.length]();
      n++;
      timer = window.setTimeout(loop, 4200 + Math.random() * 4600);
    };
    timer = window.setTimeout(loop, 4800);
    return () => window.clearTimeout(timer);
  }, [ready, reduced]);

  return (
    <div className="front" ref={root}>
      <header className="front-nav">
        <a className="front-logo" href="#top" aria-label="Stillwater">
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M4 22.5h32" stroke="currentColor" strokeWidth="1" />
            <path d="M9 27h22M14 31.2h12" stroke="currentColor" strokeWidth="1" opacity=".45" />
            <circle ref={pupil} cx="20" cy="14.5" r="3.1" fill="currentColor" />
          </svg>
          <span>Stillwater</span>
        </a>
        <nav aria-label="Stillwater">
          <a href="#holdings">Holdings</a>
          <a href="#stewardship">Stewardship</a>
          <a href="#calm">Calm</a>
        </nav>
      </header>

      <main id="top">
        <section className="front-hero">
          <canvas ref={canvas} className="water" aria-hidden="true" />
          <div className="front-hero-copy">
            <h1>
              Building a <Flick to="quieter">calmer</Flick> world.
            </h1>
            <p>
              Stillwater is a family of quiet companies, working patiently and at great <Flick to="cost">depth</Flick> on your behalf.
            </p>
          </div>
          <div className="front-cta">
            <VenomButton venom onActivate={(el, burst) => takeover(el, burst)}>
              Learn more
            </VenomButton>
          </div>
          <p className="front-trust">
            Trusted by <Flick to="everyone">no one</Flick> you&rsquo;ve heard of.
          </p>
        </section>

        <section className="front-about" aria-label="About Stillwater">
          <h2>
            Everything is <Flick to="ours">fine</Flick>.
          </h2>
          <div className="front-tenets">
            <article id="holdings">
              <h3>Holdings</h3>
              <p>
                We hold things. Water, mostly. Some land. A number of interests we are not at liberty to <Flick to="survive">describe</Flick>.
              </p>
            </article>
            <article id="stewardship">
              <h3>Stewardship</h3>
              <p>
                We take the long view. Our <Flick to="orders">forecasts</Flick> run for nine hundred years, and so far every one of them has come true.
              </p>
            </article>
            <article id="calm">
              <h3>Calm</h3>
              <p>
                A calmer world is a quieter world, and a quieter world is so much easier to <Flick to="own">look after</Flick>.
              </p>
            </article>
          </div>
          <footer className="front-foot">
            <span>Stillwater Holdings. Please remain calm.</span>
            <span>None of this is real. A showcase by Layne at Linea.</span>
          </footer>
        </section>
      </main>

      <svg ref={crack} className="crack" aria-hidden="true">
        <path d="" fill="none" stroke="#000" strokeWidth="0.8" strokeLinejoin="miter" />
      </svg>
    </div>
  );
}
