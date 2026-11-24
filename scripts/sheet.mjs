// Contact sheets for reviewing a folder of screenshots: node scripts/sheet.mjs <dir> [perSheet] [thumbWidth]
import { webkit } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const [, , dir, per = "5", tw = "262"] = process.argv;
const files = readdirSync(dir).filter((f) => f.endsWith(".jpg") && !f.startsWith("sheet")).sort();
const browser = await webkit.launch();
const page = await browser.newPage();
for (let k = 0; k < files.length; k += +per) {
  const set = files.slice(k, k + +per);
  const html = `<body style="margin:0;background:#444;display:flex;gap:6px;align-items:flex-start">${set
    .map((f) => `<div style="font:11px monospace;color:#fff"><img src="data:image/jpeg;base64,${readFileSync(resolve(dir, f)).toString("base64")}" style="width:${tw}px;display:block">${f}</div>`)
    .join("")}</body>`;
  await page.setViewportSize({ width: set.length * (+tw + 6), height: 600 });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(dir, `sheet-${String(k / +per).padStart(2, "0")}.jpg`), type: "jpeg", quality: 80, fullPage: true });
}
await browser.close();
console.log(files.length);
