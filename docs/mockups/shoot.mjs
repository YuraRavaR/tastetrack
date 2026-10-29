// Screenshots every static mockup in one folder of docs/mockups at phone (390) and desktop (1440)
// width, in light and dark, next to the HTML: `node docs/mockups/shoot.mjs film-page`.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const screen = process.argv[2];
if (!screen) {
  console.error("Usage: node docs/mockups/shoot.mjs <folder>");
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), screen);
const pages = readdirSync(dir).filter((file) => file.endsWith(".html"));

const browser = await chromium.launch();
for (const file of pages) {
  for (const width of [390, 1440]) {
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width, height: 800 },
        colorScheme,
        deviceScaleFactor: 2,
      });
      await page.goto(pathToFileURL(join(dir, file)).href);
      // Grow the viewport to the whole page, so sticky and fixed bars land where they end up.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height });
      const out = file.replace(/\.html$/, `-${width}-${colorScheme}.png`);
      await page.screenshot({ path: join(dir, out), fullPage: true });
      await page.close();
      console.log(out);
    }
  }
}
await browser.close();
