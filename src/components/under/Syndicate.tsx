"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useExperience } from "../Experience";

interface PosterDef {
  calm: string[];
  truth: string[];
  small: string;
  smallTruth: string;
  art: number;
}

const POSTERS: PosterDef[] = [
  { calm: ["HENCH", "PEOPLE", "WANTED"], truth: ["YOU WERE", "ALWAYS", "OURS"], small: "Good hours. Great dental.", smallTruth: "The hours are all of them.", art: 0 },
  { calm: ["SEE THE", "WORLD"], truth: ["IT SEES", "NOTHING"], small: "Travel. Mostly at night.", smallTruth: "We turned the lights off.", art: 1 },
  { calm: ["A LAIR OF", "ONE'S OWN"], truth: ["THE LAIR", "KEEPS", "YOU"], small: "Volcano views. Free parking.", smallTruth: "The door only opens inward.", art: 2 },
  { calm: ["QUIET HANDS", "BUILD TALL", "TOWERS"], truth: ["TALLER.", "QUIETER.", "NOW."], small: "Join the building committee.", smallTruth: "The committee is watching.", art: 3 },
  { calm: ["ASK ABOUT", "THE PENSION"], truth: ["NOBODY", "RETIRES"], small: "A career with a future.", smallTruth: "The future is also ours.", art: 4 },
  { calm: ["TOGETHER,", "CALMER"], truth: ["TOGETHER.", "OR ELSE."], small: "Bring a friend.", smallTruth: "We know which one.", art: 5 },
];

const BELT = ["No exit interviews", "Loyalty is a subscription", "Uniforms provided. Faces optional", "Every door is a trapdoor if you believe", "Your plan is our plan now"];

function Art({ n, truth }: { n: number; truth?: boolean }) {
  const ink = "var(--p-ink)";
  const acc = "var(--p-acc)";
  const bg = "var(--p-bg)";
  switch (n) {
    case 0: {
      const rays = [];
      for (let i = 0; i < 13; i++) {
        const a0 = Math.PI + (i / 13) * Math.PI;
        const a1 = a0 + (Math.PI / 13) * 0.5;
        const R = 330;
        rays.push(
          <polygon key={i} points={`150,360 ${(150 + Math.cos(a0) * R).toFixed(1)},${(360 + Math.sin(a0) * R).toFixed(1)} ${(150 + Math.cos(a1) * R).toFixed(1)},${(360 + Math.sin(a1) * R).toFixed(1)}`} fill={ink} opacity={truth ? 0.9 : 0.14} />
        );
      }
      return (
        <g>
          {rays}
          <circle cx="150" cy="360" r="58" fill={truth ? bg : acc} stroke={ink} strokeWidth="5" />
          {truth && <circle cx="150" cy="340" r="17" fill={ink} />}
        </g>
      );
    }
    case 1:
      return (
        <g fill="none" stroke={ink} strokeWidth="4">
          <circle cx="150" cy="262" r="88" fill={truth ? ink : "none"} />
          {!truth && (
            <>
              <ellipse cx="150" cy="262" rx="34" ry="88" />
              <ellipse cx="150" cy="262" rx="66" ry="88" />
              <path d="M62 262h176M74 218h152M74 306h152" />
            </>
          )}
          {truth && (
            <>
              <path d="M40 262 Q150 160 260 262 Q150 364 40 262Z" fill={bg} stroke={bg} />
              <circle cx="150" cy="262" r="44" fill={acc} stroke="none" />
              <circle cx="150" cy="262" r="19" fill={bg} stroke="none" />
            </>
          )}
        </g>
      );
    case 2:
      return (
        <g>
          <polygon points="28,372 150,196 272,372" fill={ink} />
          <polygon points="150,196 122,236 140,228 150,244 162,226 178,236" fill={acc} />
          <rect x="136" y="322" width="28" height="50" fill={truth ? acc : bg} />
          {truth &&
            [
              [104, 300],
              [196, 300],
              [150, 280],
              [84, 344],
              [216, 344],
            ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={acc} />)}
        </g>
      );
    case 3: {
      const hs = [92, 150, 118, 184, 104, 136];
      return (
        <g>
          {hs.map((h, i) => (
            <g key={i}>
              <rect x={26 + i * 42} y={380 - (truth ? h * 1.1 : h)} width="34" height={truth ? h * 1.1 : h} fill={ink} />
              {Array.from({ length: Math.floor(h / 22) }).map((_, k) => (
                <rect key={k} x={34 + i * 42} y={372 - k * 22 - 10} width="18" height="6" fill={truth ? acc : bg} opacity={truth ? 1 : k % 2 ? 0.9 : 0.25} />
              ))}
            </g>
          ))}
        </g>
      );
    }
    case 4:
      return (
        <g fill={ink}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = truth ? 240 - i * 40 - 40 : 20 + i * 40;
            return <rect key={i} x={x + (truth ? 20 : 0)} y={372 - (i + 1) * 26} width="44" height={(i + 1) * 26} />;
          })}
          <circle cx={truth ? 258 : 240} cy={truth ? 352 : 198} r="13" fill={acc} stroke={ink} strokeWidth="4" />
          {truth && <rect x="238" y="372" width="42" height="8" fill={acc} />}
        </g>
      );
    default:
      return (
        <g>
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3, 4].map((c) => {
              const gone = truth && row === 1 && c === 3;
              const x = 46 + c * 52;
              const y = 216 + row * 58;
              return (
                <g key={`${row}-${c}`} opacity={gone ? 0.12 : 1}>
                  <circle cx={x} cy={y} r="14" fill={ink} />
                  <path d={`M${x - 22} ${y + 44} q22 -40 44 0z`} fill={ink} />
                  {truth && !gone && <rect x={x - 8} y={y - 4} width="16" height="4" fill={acc} />}
                </g>
              );
            })
          )}
        </g>
      );
  }
}

function Layer({ p, truth }: { p: PosterDef; truth?: boolean }) {
  const lines = truth ? p.truth : p.calm;
  const size = lines.length === 2 ? 62 : 46;
  return (
    <svg className={truth ? "poster-true" : "poster-calm"} viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="300" height="420" fill="var(--p-bg)" />
      <Art n={p.art} truth={truth} />
      {lines.map((l, i) => (
        <text key={i} x="22" y={24 + size * 0.86 + i * size * 0.98} textLength="256" lengthAdjust="spacingAndGlyphs" fontSize={size} fill="var(--p-ink)" className="poster-type">
          {l}
        </text>
      ))}
      <rect x="0" y="380" width="300" height="40" fill="var(--p-bg)" />
      {truth && <rect x="3" y="3" width="294" height="414" fill="none" stroke="var(--p-ink)" strokeWidth="3" />}
      <rect x="22" y="386" width="256" height="2" fill="var(--p-ink)" />
      <text x="22" y="408" fontSize="13" fill="var(--p-ink)" className="poster-small">
        {truth ? p.smallTruth : p.small}
      </text>
    </svg>
  );
}

export default function Syndicate() {
  const { touch, reduced } = useExperience();
  const section = useRef<HTMLElement>(null);
  const belt = useRef<HTMLDivElement>(null);
  const [turned, setTurned] = useState<boolean[]>(() => POSTERS.map(() => false));

  // phones: each poster shows its true face as it crosses the middle of the screen
  useEffect(() => {
    if (!touch || !section.current) return;
    const els = Array.from(section.current.querySelectorAll<HTMLElement>(".poster"));
    const io = new IntersectionObserver(
      (entries) => {
        setTurned((prev) => {
          const next = [...prev];
          for (const e of entries) next[els.indexOf(e.target as HTMLElement)] = e.isIntersecting;
          return next;
        });
      },
      { rootMargin: "-36% 0px -36% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [touch]);

  // the belt runs faster the harder you scroll, and rests off screen
  useEffect(() => {
    const el = belt.current;
    if (!el || reduced) return;
    const track = el.firstElementChild as HTMLElement;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-running", e.isIntersecting));
    io.observe(el);
    let rate = 1;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const want = 1 + Math.min(6, Math.abs(self.getVelocity()) / 420);
        rate += (want - rate) * 0.25;
        track.getAnimations?.().forEach((a) => (a.playbackRate = rate));
      },
      onScrubComplete: () => undefined,
    });
    const settle = window.setInterval(() => {
      if (rate > 1.02) {
        rate += (1 - rate) * 0.2;
        track.getAnimations?.().forEach((a) => (a.playbackRate = rate));
      }
    }, 120);
    return () => {
      io.disconnect();
      st.kill();
      window.clearInterval(settle);
    };
  }, [reduced]);

  return (
    <section className="syndicate" ref={section}>
      <div className="syndicate-head">
        <h2>The Syndicate is hiring.</h2>
        <p>Benefits include dental, vision and dominion.</p>
      </div>
      <div className="belt" ref={belt} aria-hidden="true">
        <div className="belt-track">
          {[0, 1].map((k) => (
            <div className="belt-set" key={k}>
              {BELT.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ul className="poster-wall">
        {POSTERS.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              className={`poster${turned[i] ? " is-true" : ""}`}
              aria-pressed={turned[i]}
              aria-label={`Recruitment poster: ${p.calm.join(" ")}. ${p.small} What it really says: ${p.truth.join(" ")} ${p.smallTruth}`}
              onClick={() => setTurned((t) => t.map((v, j) => (j === i ? !v : v)))}
            >
              <Layer p={p} />
              <Layer p={p} truth />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
