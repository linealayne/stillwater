// Walks the whole experience and saves screenshots.
//   node scripts/shots.mjs <chromium|webkit> <width> <height> <outDir> [reduced] [url]
import { chromium, webkit } from "playwright";
import { mkdirSync } from "node:fs";

const [, , engine = "chromium", W = "1440", H = "900", out = "screenshots/desktop", reducedArg, urlArg] = process.argv;
const width = +W;
const height = +H;
const mobile = width < 700;
const reduced = reducedArg === "reduced";
const url = urlArg || "http://localhost:3210";
mkdirSync(out, { recursive: true });

const browser = await (engine === "webkit" ? webkit : chromium).launch();
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile && engine !== "firefox",
  hasTouch: mobile,
  reducedMotion: reduced ? "reduce" : "no-preference",
  userAgent: mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1" : undefined,
});
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text().slice(0, 200)));
page.on("pageerror", (e) => problems.push("pageerror: " + String(e).slice(0, 200)));

const shot = (name) => page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 78 });
const wait = (ms) => page.waitForTimeout(ms);
const scrollTo = async (y, settle = 1300) => {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await wait(settle);
};
const rectOf = (sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { top: r.top + scrollY, left: r.left, width: r.width, height: r.height };
  }, sel);
const audit = async (label) => {
  const res = await page.evaluate(() => {
    const over = document.documentElement.scrollWidth - window.innerWidth;
    const small = [...document.querySelectorAll("a, button")]
      .map((el) => ({ t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28), r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && (x.r.width < 44 || x.r.height < 44))
      .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`);
    return { over, small };
  });
  if (res.over > 0) problems.push(`${label}: horizontal overflow ${res.over}px`);
  if (mobile && res.small.length) problems.push(`${label}: small targets ${res.small.join(" | ")}`);
};

await page.goto(url, { waitUntil: "networkidle" });
await wait(1800);
if (!mobile) {
  await page.mouse.move(420, 690);
  await page.mouse.move(620, 640, { steps: 12 });
  await wait(500);
}
await shot("01-front");
await audit("front");
await scrollTo(height * 0.9);
await shot("01b-front-about");
await scrollTo(0, 900);

const btn = await page.locator("[data-venom]").boundingBox();
const bx = btn.x + btn.width / 2;
const by = btn.y + btn.height / 2;
if (!mobile) {
  await page.mouse.move(bx + 190, by - 110, { steps: 8 });
  await wait(900);
  await shot("02-venom-near");
  await page.mouse.move(bx + 30, by, { steps: 8 });
  await wait(1100);
} else await wait(1200);
await shot("02-venom-hover");

if (mobile) await page.touchscreen.tap(bx, by);
else await page.mouse.click(bx + 30, by);
const t0 = Date.now();
if (reduced) {
  await wait(700);
  await shot("03-takeover-cut");
} else {
  for (const [name, ms] of [
    ["03-takeover-1", 620],
    ["03-takeover-2", 1150],
    ["03-takeover-3", 1750],
    ["03-takeover-4", 2500],
    ["03-takeover-5", 4300],
  ]) {
    await wait(Math.max(0, ms - (Date.now() - t0)));
    await shot(name);
  }
  await wait(3200);
}
if (!mobile) {
  await page.mouse.move(width * 0.3, height * 0.3);
  await page.mouse.move(width * 0.56, height * 0.5, { steps: 14 });
  await wait(250);
}
await shot("04-empire");
await audit("under");

const sec = {};
for (const s of [".empire", ".dossiers", ".stage", ".syndicate", ".finale"]) sec[s] = await rectOf(s);
if (!reduced) {
  await scrollTo(sec[".empire"].height * 0.42);
  await shot("04b-empire-melt");
}

// dossiers
const table = await rectOf(".dossier-table");
await scrollTo(table.top - height * (mobile ? 0.3 : 0.24), 1600);
const card = await page.locator(".dossier").nth(mobile ? 0 : 1).boundingBox();
if (!mobile) {
  await page.mouse.move(card.x + card.width * 0.3, card.y + card.height * 0.2);
  await page.mouse.move(card.x + card.width * 0.55, card.y + card.height * 0.48, { steps: 12 });
  await wait(900);
} else await wait(900);
await shot("05-dossiers");
if (mobile) await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
else await page.mouse.click(card.x + card.width * 0.55, card.y + card.height * 0.48);
await wait(1300);
await shot("05b-dossier-open");

// spread + device
const st = sec[".stage"].top;
const sh = sec[".stage"].height - height;
const stage = async (f, name, settle = 1500) => {
  await scrollTo(st + sh * f, settle);
  if (!mobile) await page.mouse.move(width * 0.55, height * 0.45, { steps: 4 });
  await wait(400);
  await shot(name);
};
if (reduced) {
  await stage(0.2, "06-spread", 3500);
  await stage(0.8, "07-device");
} else {
  await stage(0.05, "06-spread-1", 4000);
  await stage(0.19, "06-spread-2");
  await stage(0.31, "06-spread-3");
  await stage(0.42, "06-spread-4");
  await stage(0.56, "07-device-1");
  await stage(0.66, "07-device-2");
  await stage(0.78, "07-device-3");
  await stage(0.97, "07-device-4");
}

// syndicate
const wall = await rectOf(".poster-wall");
await scrollTo(sec[".syndicate"].top + height * 0.05);
await shot("08-syndicate");
await scrollTo(wall.top - height * 0.12);
if (!mobile) {
  const p = await page.locator(".poster").nth(1).boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2, { steps: 6 });
  await wait(260);
  await shot("08b-poster-glitching");
  await wait(700);
}
await shot("08c-posters");

// finale
if (!reduced) {
  await scrollTo(sec[".finale"].top + height * 0.25);
  await shot("09-finale-gathering");
}
await scrollTo(sec[".finale"].top + sec[".finale"].height - height, 2600);
await shot("09b-finale");
await audit("finale");
const cta = await page.locator(".finale .venom-btn").boundingBox();
if (!mobile) {
  await page.mouse.move(cta.x + cta.width / 2, cta.y + cta.height / 2, { steps: 8 });
  await wait(1100);
  await shot("09c-finale-cta-hover");
}

// return to stillwater
const ret = page.locator(".finale-return");
if (mobile) await ret.tap();
else await ret.click();
if (reduced) {
  await wait(800);
  await shot("10-return-cut");
} else {
  await wait(1300);
  await shot("10-return-1");
  await wait(2300);
  await shot("10-return-2");
  await wait(2600);
  await shot("10-return-3");
}

console.log(JSON.stringify({ engine, width, height, reduced, sections: sec, problems }, null, 1));
await browser.close();
