@AGENTS.md

# STILLWATER

Linea's second showcase site ("still waters run deep"). Not a business site. Its one job: make anyone who sees it think "this person can design and build anything", and look unforgettable in a TikTok/Instagram screen recording. Sister site: VELVET LAYNE (https://velvet-layne.vercel.app). Match its level of invention and polish; never repeat its specific effects.

- Live: https://stillwater-linea.vercel.app (Vercel project `stillwater`, auto-deploys from `main`)
- Repo: https://github.com/linealayne/stillwater

## The concept: the visitor is the villain

STILLWATER is a fake, too-perfect luxury conglomerate ("Building a calmer world."). One button ("Learn more") breaks the calm surface: black ink floods the page and reveals the evil operation underneath, which belongs to the visitor. Story order never changes: calm front → Venom takeover → the visitor's empire → CTA.

## Stack

- Next.js (App Router, TypeScript, Turbopack), Tailwind v4 imported in `globals.css` (most styling is hand-written CSS in `src/app/globals.css` and `src/app/chapters.css`)
- GSAP + ScrollTrigger for all scroll-linked work; one `gsap.ticker` drives every render loop
- Lenis smooth scroll on desktop only (`(hover: hover) and (pointer: fine)`); native scroll on touch
- three.js only in chapters 4 and 5, one shared renderer (`src/lib/stage.ts`), dynamically imported
- Fonts (Google, via `next/font`): Cormorant (front serif), Hanken Grotesk (UI), Dela Gothic One (underbelly display), Courier Prime (dossiers, labels)

## Architecture

`src/components/Experience.tsx` owns the mode (`front` | `under`), the ink engine, Lenis, and the takeover / return choreography. Engines live in the mutable singleton `src/lib/bus.ts` (imperative renderers, deliberately not React state).

Three WebGL layers, never more than two rendering at once:

| Layer | File | What |
| --- | --- | --- |
| Water | `src/lib/water.ts` | Front hero. Horizon scene, perspective water, cursor rings, ink welling beneath on takeover |
| Ink | `src/lib/ink.ts` | Fixed full-viewport overlay above everything. Low-res reaction-diffusion sim (flood / recede / edges / drain / ring), glossy composite, analytic tendrils, dripping headline text |
| Stage | `src/lib/stage.ts` | Chapters 4 + 5. Globe with spreading veins, then the reactor device |

## Chapters

1. **The front** (`Front.tsx`): bone-white corporate calm, still water, "wrongness" (one-frame word flickers, the logo pupil watches the cursor, a hairline crack that heals, a shadow passing under the water). The Venom button (`VenomButton.tsx`) grows ink tendrils.
2. **Your empire starts here** (`under/Empire.tsx`): headline rendered inside the ink shader so letters drip and get pulled by the cursor; ink lives at the screen edges.
3. **The dossiers** (`under/Dossiers.tsx`): flashlight pool, redaction bars lift under the light, 3D tilt on hover, click flips the file.
4. **The spread** (`under/StageChapters.tsx`): veins light node by node across a dark globe; camera dives into the surface.
5. **The device** (same pinned stage): reactor explodes into a labelled schematic and reassembles.
6. **The syndicate** (`under/Syndicate.tsx`): SVG recruitment posters that glitch into their true versions; a slogan belt.
7. **Finale** (`under/Finale.tsx`): ink gathers into one drop, CTA to https://lineaautomations.com/start, credit link, and "Return to Stillwater" (reverse takeover).

## Hard rules

- Original work only. No copied code, assets, fonts or images. Free licensed fonts only. Visuals are generated (CSS, SVG, shader, 3D). No stock photos, real brands, real people, fake client logos, fake testimonials or fake stats.
- Normal system cursor. Cursor *effects* (flashlight, tendrils) are fine; never replace the cursor.
- No explanatory UI: no chapter counters, labels or captions explaining effects.
- No line-drawing animations (lines that draw themselves on). Veins and hairlines switch on or fade; they are never traced.
- Never hijack scroll. Pinning is CSS `position: sticky`; nothing blocks or redirects the wheel.
- Performance: 60fps target on a mid-range laptop. Heavy chapters lazy-load and preload ahead so nothing is blank on arrival. Every loop pauses off screen. No dead stretches of scroll.
- Phones get a deliberately designed portrait version. Test in Playwright WebKit with iPhone emulation at 393×852 and 375×667 (touch). The takeover must work on tap. Use `svh`/`dvh`/`lvh`. No horizontal scroll. Tap targets at least 44px.
- `prefers-reduced-motion`: static versions; the takeover is a clean cut; the ink canvas is off.
- Accessibility basics: real headings, keyboard-reachable buttons and links, readable contrast.
- Copy: no em dashes. All "operations", slogans and component names are invented and obviously fictional.

## Working on this machine

- Low memory laptop: one browser at a time, close browser processes when done, no Lighthouse batches.
- `npm run dev` (port 3000), `npm run build`, `npm run lint`. Build and lint must be clean before pushing to `main`.
