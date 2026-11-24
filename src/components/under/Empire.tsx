"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { bus } from "@/lib/bus";
import { useExperience } from "../Experience";

export default function Empire() {
  const { reduced } = useExperience();
  const section = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [liquid, setLiquid] = useState(false);

  useEffect(() => {
    const ink = bus.ink;
    const sec = section.current;
    const h = title.current;
    if (!sec || !h) return;
    let alive = true;
    const build = () => {
      if (!alive || !ink) return;
      ink.setText({ el: h, clipEl: sec.nextElementSibling as HTMLElement | null });
      setLiquid(true);
    };
    if (ink) {
      document.fonts.load(`400 100px ${getComputedStyle(h).fontFamily.split(",")[0]}`).then(build, build);
    }
    const ctx = gsap.context(() => {
      if (reduced) return;
      const lines = gsap.utils.toArray<HTMLElement>(".empire-sub span");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sec,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (st) => {
            if (ink) ink.drip = st.progress * 0.95;
          },
        },
      });
      gsap.set(lines, { opacity: 0 });
      gsap.set(lines[0], { opacity: 1 });
      tl.to(lines[0], { opacity: 0, duration: 0.12 }, 0.24)
        .to(lines[1], { opacity: 1, duration: 0.12 }, 0.36)
        .to(lines[1], { opacity: 0, duration: 0.12 }, 0.6)
        .to(lines[2], { opacity: 1, duration: 0.12 }, 0.72)
        .to({}, { duration: 0.16 }, 0.84);
    }, sec);
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("orientationchange", onResize);
    return () => {
      alive = false;
      ctx.revert();
      ink?.setText(null);
      if (ink) ink.drip = 0;
      window.removeEventListener("orientationchange", onResize);
    };
  }, [reduced]);

  return (
    <section className={`empire${liquid ? " is-liquid" : ""}`} ref={section}>
      <div className="empire-pin">
        <h1 className="empire-title" ref={title}>
          <span className="row">
            <span data-line>YOUR</span> <span data-line>EMPIRE</span>
          </span>{" "}
          <span className="row">
            <span data-line>STARTS</span> <span data-line>HERE.</span>
          </span>
        </h1>
        <p className="empire-sub">
          <span>You asked to learn more. So now you know.</span>
          <span>Every quiet company. Every drop. Yours.</span>
          <span>The paperwork is on the table.</span>
        </p>
      </div>
    </section>
  );
}
