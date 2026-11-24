"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useExperience } from "../Experience";

type Seg = string | { r: string };
interface Op {
  code: string;
  file: string;
  rest: number;
  body: Seg[][];
  status: string;
  verdict: string;
}

const OPS: Op[] = [
  {
    code: "Quiet Tide",
    file: "SW/0417",
    rest: -3.6,
    body: [
      ["Objective: replace the water in every public fountain with ", { r: "water that is nine percent heavier" }, "."],
      ["Nobody will notice. Everybody will feel ", { r: "slightly more tired on Thursdays" }, "."],
      ["Phase two begins when ", { r: "the pigeons stop coming back" }, "."],
    ],
    status: "Sixty-one fountains converted. The rest are thirsty.",
    verdict: "Proceeding",
  },
  {
    code: "Long Lunch",
    file: "SW/0733",
    rest: 2.4,
    body: [
      ["Objective: quietly acquire ", { r: "the hour between one and two in the afternoon" }, "."],
      ["Method: ", { r: "buy every clock tower and set each one four minutes slow" }, "."],
      ["By the time the difference adds up, ", { r: "the hour already belongs to us" }, "."],
    ],
    status: "Most of the towers are ours. Nobody has asked what time it is.",
    verdict: "On schedule",
  },
  {
    code: "Soft Landing",
    file: "SW/1108",
    rest: -1.4,
    body: [
      ["Objective: lower the moon by ", { r: "eleven centimetres" }, "."],
      ["Reason: ", { r: "the tides will owe us a favour" }, "."],
      ["Risk: ", { r: "one astronomer who measures everything twice" }, ". Mitigation: ", { r: "we sent her a lovely telescope with a slightly wrong lens" }, "."],
    ],
    status: "Four centimetres down. The astronomer sends her thanks.",
    verdict: "Descending",
  },
  {
    code: "House Blend",
    file: "SW/1290",
    rest: 4.2,
    body: [
      ["Objective: ", { r: "own the smell of rain" }, "."],
      ["Method: ", { r: "a patent, pending everywhere at once" }, "."],
      ["Royalties fall due ", { r: "each time it rains on anyone, anywhere" }, ". Collections by ", { r: "the Umbrella Division" }, "."],
    ],
    status: "Granted. Step outside and you already owe us.",
    verdict: "Collecting",
  },
];

function Body({ body, cover }: { body: Seg[][]; cover?: boolean }) {
  return (
    <>
      {body.map((para, i) => (
        <p key={i}>
          {para.map((s, j) =>
            typeof s === "string" ? (
              <span key={j}>{s}</span>
            ) : (
              <span key={j} className={cover ? "bar" : "secret"}>
                {s.r}
              </span>
            )
          )}
        </p>
      ))}
    </>
  );
}

export default function Dossiers() {
  const { touch, reduced } = useExperience();
  const section = useRef<HTMLElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean[]>(() => OPS.map(() => false));
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const sec = section.current;
    const dk = dark.current;
    if (!sec || !dk || reduced) return;
    const cards = Array.from(sec.querySelectorAll<HTMLElement>(".dossier"));
    const inner = cards.map((c) => c.querySelector<HTMLElement>(".dossier-card")!);
    const covers = cards.map((c) => c.querySelector<HTMLElement>(".dossier-cover")!);
    const fronts = cards.map((c) => c.querySelector<HTMLElement>(".dossier-front")!);
    const backs = cards.map((c) => c.querySelector<HTMLElement>(".dossier-back")!);
    const st = cards.map(() => ({ tx: 0, ty: 0, lift: 0, flip: 0, gx: 0, gy: 0, gl: 0 }));
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "20% 0px" });
    io.observe(sec);
    const p = { x: window.innerWidth / 2, y: window.innerHeight * 0.45, has: false, down: false };
    const l = { x: p.x, y: p.y };
    let hover = -1;
    const onMove = (e: PointerEvent) => {
      if (touch && !p.down && e.type !== "pointerdown") return;
      p.x = e.clientX;
      p.y = e.clientY;
      p.has = true;
      if (e.type === "pointerdown") p.down = true;
    };
    const onUp = () => {
      p.down = false;
      if (touch) p.has = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    const enter = cards.map((c, i) => () => {
      if (!touch) hover = i;
    });
    const leave = cards.map((c, i) => () => {
      if (hover === i) hover = -1;
    });
    cards.forEach((c, i) => {
      c.addEventListener("pointerenter", enter[i]);
      c.addEventListener("pointerleave", leave[i]);
    });
    let t = 0;
    const tick = (_t: number, dms: number) => {
      if (!visible) return;
      const dt = Math.min(dms / 1000, 0.05);
      t += dt;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let gx = p.x;
      let gy = p.y;
      if (touch && !p.has) {
        gx = vw * (0.5 + 0.2 * Math.sin(t * 0.55));
        gy = vh * (0.46 + 0.08 * Math.sin(t * 0.83 + 1));
      } else if (!p.has) {
        gx = vw * 0.5;
        gy = vh * 0.5;
      }
      const k = 1 - Math.exp(-dt * (touch ? 4 : 11));
      l.x += (gx - l.x) * k;
      l.y += (gy - l.y) * k;
      dk.style.setProperty("--lx", `${l.x.toFixed(1)}px`);
      dk.style.setProperty("--ly", `${l.y.toFixed(1)}px`);
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const s = st[i];
        const isOpen = openRef.current[i];
        const hov = hover === i;
        const nx = Math.max(-1, Math.min(1, (l.x - (r.left + r.width / 2)) / (r.width / 2)));
        const ny = Math.max(-1, Math.min(1, (l.y - (r.top + r.height / 2)) / (r.height / 2)));
        s.gx = hov ? -ny * 9 : 0;
        s.gy = hov ? nx * 11 : 0;
        s.gl = hov ? 1 : 0;
        const kk = 1 - Math.exp(-dt * 9);
        s.tx += (s.gx - s.tx) * kk;
        s.ty += (s.gy - s.ty) * kk;
        s.lift += (s.gl - s.lift) * kk;
        s.flip += ((isOpen ? 180 : 0) - s.flip) * (1 - Math.exp(-dt * 6.5));
        const rest = OPS[i].rest * (1 - s.lift * 0.75);
        inner[i].style.transform = `translateZ(${(s.lift * 46).toFixed(1)}px) rotateZ(${rest.toFixed(2)}deg) rotateX(${s.tx.toFixed(2)}deg) rotateY(${(s.ty + s.flip).toFixed(2)}deg) scale(${(1 + s.lift * 0.035).toFixed(3)})`;
        c.style.zIndex = hov ? "3" : "1";
        // decide the visible face ourselves; backface-visibility is unreliable in nested 3D on WebKit
        const facing = Math.cos(((s.ty + s.flip) * Math.PI) / 180) >= 0;
        fronts[i].style.visibility = facing ? "visible" : "hidden";
        backs[i].style.visibility = facing ? "hidden" : "visible";
        const cov = covers[i];
        const cr = cov.getBoundingClientRect();
        const mx = ((l.x - cr.left) / (cr.width || 1)) * cov.offsetWidth;
        const my = ((l.y - cr.top) / (cr.height || 1)) * cov.offsetHeight;
        cov.style.setProperty("--mx", `${mx.toFixed(1)}px`);
        cov.style.setProperty("--my", `${my.toFixed(1)}px`);
      });
    };
    gsap.ticker.add(tick);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cards.forEach((c, i) => {
        c.removeEventListener("pointerenter", enter[i]);
        c.removeEventListener("pointerleave", leave[i]);
      });
    };
  }, [touch, reduced]);

  return (
    <section className="dossiers" ref={section}>
      <div className="dossiers-shade" aria-hidden="true">
        <div className="dossiers-dark" ref={dark} />
      </div>
      <div className="dossiers-head">
        <h2>Sign nothing. It&rsquo;s already signed.</h2>
      </div>
      <div className="dossier-table">
        {OPS.map((op, i) => (
          <article className={`dossier${open[i] ? " is-open" : ""}`} key={op.code} style={{ ["--rest" as string]: `${op.rest}deg` }}>
            <button
              type="button"
              className="dossier-hit"
              aria-pressed={open[i]}
              aria-label={`Operation ${op.code}. ${open[i] ? "Close the file" : "Open the file"}`}
              onClick={() => setOpen((o) => o.map((v, j) => (j === i ? !v : v)))}
            />
            <div className="dossier-card">
              <div className="dossier-face dossier-front">
                <header>
                  <span>Stillwater Holdings</span>
                  <span>{op.file}</span>
                </header>
                <h3>
                  <small>Operation</small>
                  {op.code}
                </h3>
                <div className="dossier-text">
                  <Body body={op.body} />
                  <div className="dossier-cover" aria-hidden="true">
                    <Body body={op.body} cover />
                  </div>
                </div>
                <span className="dossier-stamp" aria-hidden="true">
                  Eyes only
                </span>
              </div>
              <div className="dossier-face dossier-back" aria-hidden={!open[i]}>
                <header>
                  <span>{op.file}</span>
                  <span>Status</span>
                </header>
                <p className="dossier-status">{op.status}</p>
                <p className="dossier-verdict">{op.verdict}</p>
                <dl>
                  <dt>Authorised by</dt>
                  <dd>You</dd>
                </dl>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
