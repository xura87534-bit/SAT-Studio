// Renders public/icons/icon.svg to the PNG sizes the manifest and extension need.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const [size, out] of [[192, "public/icons/icon-192.png"], [512, "public/icons/icon-512.png"], [16, "extension/icons/16.png"], [48, "extension/icons/48.png"], [128, "extension/icons/128.png"]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width=${size} height=${size}>`);
  await page.locator("img").screenshot({ path: out, omitBackground: true });
}
await browser.close();
