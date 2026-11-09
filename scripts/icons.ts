// Redraws the bitmap icons from src/client/public/favicon.svg, in its light colours, and the link
// card: `pnpm exec tsx scripts/icons.ts`. favicon.ico is the mark at 32×32 on no ground, for
// browsers without SVG favicons; apple-touch-icon.png is the mark at 180×180 on the light
// --background, padded so the rounding iOS adds never cuts it. og-image.png is the 1200×630 card
// a link shows in a messenger, as docs/mockups/logo/ draws it: the logo and the slogan, always
// light. Commit them with the SVG.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "src/client/public");
const svg = readFileSync(join(publicDir, "favicon.svg"));
const svgUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;

// --background of src/client/styles.css, light theme.
const background = "#f9f4ec";

const browser = await chromium.launch();

// The mark drawn `markSize` px square in the middle of a `size` px square, on `ground`, or on
// nothing when `ground` is omitted: a PNG.
async function draw(size: number, markSize: number, ground?: string) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    colorScheme: "light",
  });
  const background = ground ?? "transparent";
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;height:${size}px;background:${background}">` +
      `<img src="${svgUrl}" width="${markSize}" height="${markSize}"></body>`,
  );
  await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  const png = await page.screenshot({ omitBackground: ground === undefined });
  await page.close();
  return png;
}

// An ICO file holding one PNG image, which every browser that reads ICO accepts.
function ico(png: Buffer, size: number) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6); // width
  header.writeUInt8(size, 7); // height
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

// The header's mark, which takes its colours from CSS variables, and the wordmark's font.
const mark = readFileSync(join(root, "src/client/assets/logo-mark.svg"), "utf8");
const sora = readFileSync(
  join(root, "node_modules/@fontsource/sora/files/sora-latin-700-normal.woff2"),
);

// The link card, with the light tokens of src/client/styles.css.
async function card() {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<style>
    @font-face {
      font-family: Sora;
      font-weight: 700;
      src: url(data:font/woff2;base64,${sora.toString("base64")}) format("woff2");
    }
    body {
      --primary: oklch(0.82 0.16 88);
      --primary-foreground: oklch(0.22 0.02 60);
      --primary-soft: oklch(0.96 0.037 87);
      box-sizing: border-box; margin: 0; width: 1200px; height: 630px; padding: 88px 96px;
      display: flex; flex-direction: column; justify-content: center; gap: 44px;
      background: oklch(0.97 0.012 80); color: oklch(0.2 0.01 50);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .lockup { display: flex; align-items: center; gap: 28px; }
    svg { width: 232px; height: 232px; }
    .wordmark {
      display: flex; flex-direction: column; font: 700 112px/0.92 Sora; letter-spacing: -0.045em;
    }
    p { margin: 0; font-size: 38px; line-height: 1.3; color: oklch(0.47 0.02 60); }
  </style>
  <div class="lockup">${mark}<div class="wordmark"><span>Taste</span><span>Track</span></div></div>
  <p>Your taste, on the record</p>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await page.close();
  return png;
}

writeFileSync(join(publicDir, "favicon.ico"), ico(await draw(32, 32), 32));
// 100 of 180: about the share of the tile the mark takes in docs/mockups/logo/logo.html.
writeFileSync(join(publicDir, "apple-touch-icon.png"), await draw(180, 100, background));
writeFileSync(join(publicDir, "og-image.png"), await card());

await browser.close();
