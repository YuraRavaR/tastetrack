import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";

// The web app manifest, which lets a phone install the app on its home screen, to open full screen
// with its own icon and name. A static file, so a missing one would fall through to the app's
// index.html, which no browser takes for a manifest.

const link = '<link rel="manifest" href="/manifest.webmanifest" />';

test("/manifest.webmanifest is served as a manifest that installs TasteTrack full screen", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  expect(await response.json()).toEqual({
    id: "/",
    name: "TasteTrack",
    short_name: "TasteTrack",
    description: "Keep track of the films you want to watch and the ones you've seen.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The light --card and --background of src/client/styles.css.
    theme_color: "#fffdf9",
    background_color: "#f9f4ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
});

// A PNG's width and height, from its IHDR chunk, which every PNG starts with.
function pngSize(png: Buffer): string {
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

const icons = [
  { path: "/icon-192.png", size: "192x192" },
  { path: "/icon-512.png", size: "512x512" },
  { path: "/icon-maskable-512.png", size: "512x512" },
];

for (const { path, size } of icons) {
  test(`${path}, an icon of the manifest, is a ${size} PNG`, async ({ request }) => {
    const response = await request.get(path);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(pngSize(await response.body())).toBe(size);
  });
}

test("every page of the app links the manifest", async ({ request }) => {
  for (const path of ["/", "/saved/films/watchlist"]) {
    const html = await (await request.get(path)).text();

    expect(html, path).toContain(link);
  }
});

test("a Share Link's page keeps the manifest's link", async ({ loggedInApi }) => {
  const created = await expectBody(
    loggedInApi.lists.createList({ mediaType: "film", name: "Manifest" }),
    201,
  );
  const { token } = (await expectBody(loggedInApi.lists.createShareLink(created.list.id), 201))
    .shareLink;

  const sharePage = await (await loggedInApi.sharedLists.getSharedListPage(token)).text();

  expect(sharePage).toContain(link);
});
