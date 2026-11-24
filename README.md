# STILLWATER

Still waters run deep. A design showcase by Layne at [Linea](https://lineaautomations.com).

Live: https://stillwater-layne.vercel.app

A too-perfect corporate site with one button. Press it and the calm surface breaks: black ink floods the page and what is underneath turns out to be yours.

Next.js, GSAP ScrollTrigger, Lenis, three.js, and three hand-written WebGL layers (water, ink, stage). Everything on screen is generated in code. See `CLAUDE.md` for the architecture and the rules this project is built under.

```bash
npm install
npm run dev
```

`node scripts/shots.mjs webkit 393 852 screenshots/phone` walks the whole experience in WebKit and saves a screenshot of every chapter (needs a server on port 3210; `bash scripts/serve.sh` builds and starts one).
