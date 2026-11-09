// Redraws the bitmap icons from src/client/public/favicon.svg, in its light colours:
// `pnpm exec tsx scripts/icons.ts`. favicon.ico is the mark at 32×32 on no ground, for browsers
// without SVG favicons; apple-touch-icon.png is the mark at 180×180 on the light --background,
// padded so the rounding iOS adds never cuts it. Commit both with the SVG.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../src/client/public");
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

writeFileSync(join(publicDir, "favicon.ico"), ico(await draw(32, 32), 32));
// 100 of 180: about the share of the tile the mark takes in docs/mockups/logo/logo.html.
writeFileSync(join(publicDir, "apple-touch-icon.png"), await draw(180, 100, background));

await browser.close();
