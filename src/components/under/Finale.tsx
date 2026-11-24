"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { bus } from "@/lib/bus";
import { useExperience } from "../Experience";
import VenomButton from "../VenomButton";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function Finale() {
  const { reduced, goBack } = useExperience();
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const sec = section.current;
    if (!sec) return;
    const ink = bus.ink;
    const ctx = gsap.context(() => {
      if (reduced) return;
      gsap.set(".finale-title", { opacity: 0, scale: 0.94 });
      gsap.set(".finale-cta > *", { opacity: 0, y: 24 });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: sec,
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (st) => {
              if (!ink) return;
              const p = st.progress;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              const far = Math.hypot(vw / vh / 2, 0.5) + 0.12;
              const g = smooth(0.18, 0.62, p);
              const small = vw < 700;
              ink.ring.x = 0.5;
              ink.ring.y = small ? 0.17 : 0.2;
              ink.ring.r = far * (1 - g) * (1 - g);
              ink.ring.w = p > 0.16 ? (small ? 0.024 : 0.032) + (small ? 0.03 : 0.044) * smooth(0.5, 0.66, p) : 0;
              ink.edgeScale = (small ? 0.7 : 1) * (1 - smooth(0.2, 0.5, p));
            },
          },
        })
        .to({}, { duration: 0.58 })
        .to(".finale-title", { opacity: 1, scale: 1, duration: 0.16, ease: "power2.out" })
        .to(".finale-cta > *", { opacity: 1, y: 0, duration: 0.14, stagger: 0.04, ease: "power2.out" }, ">-0.02")
        .to({}, { duration: 0.06 });
    }, sec);
    return () => {
      ctx.revert();
      if (ink) {
        ink.ring.w = 0;
        ink.edgeScale = window.innerWidth < 700 ? 0.7 : 1;
      }
    };
  }, [reduced]);

  return (
    <section className="finale" ref={section}>
      <div className="finale-pin">
        <h2 className="finale-title">
          <span>EVERY EMPIRE</span> <span>NEEDS AN</span> <span>ARCHITECT.</span>
        </h2>
        <div className="finale-cta">
          <p>Want something like this?</p>
          <VenomButton href="https://lineaautomations.com/start" className="is-under">
            Start a project
          </VenomButton>
          <a className="finale-credit" href="https://lineaautomations.com">
            Built by Layne at Linea
          </a>
        </div>
        <button type="button" className="finale-return" onClick={(e) => goBack(e.currentTarget)}>
          Return to Stillwater
        </button>
      </div>
    </section>
  );
}
