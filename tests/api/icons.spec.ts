import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";

// The icons a browser tab, a bookmark and an iPhone home screen show: static files, so a missing
// one would fall through to the app's index.html, which browsers take for no icon at all.
const icons = [
  { path: "/favicon.ico", type: "image/vnd.microsoft.icon" },
  { path: "/favicon.svg", type: "image/svg+xml" },
  { path: "/apple-touch-icon.png", type: "image/png" },
];

for (const { path, type } of icons) {
  test(`${path} is served as a file of type ${type}, not as the app's page`, async ({
    request,
  }) => {
    const response = await request.get(path);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(type);
  });
}

// The <head> tags that name the icons and the browser bar's colour, in the order they appear.
function iconTags(html: string): string[] {
  return (
    html.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*>|<meta name="theme-color"[^>]*>/g) ?? []
  );
}

test("the app's pages link the icons and give the browser bar the header's colour, light and dark", async ({
  request,
}) => {
  const html = await (await request.get("/saved/films/watchlist")).text();

  expect(iconTags(html)).toEqual([
    '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta name="theme-color" content="#fffdf9" media="(prefers-color-scheme: light)" />',
    '<meta name="theme-color" content="#1f1915" media="(prefers-color-scheme: dark)" />',
  ]);
});

test("a Share Link's page keeps the app's icons", async ({ loggedInApi, request }) => {
  const created = await expectBody(
    loggedInApi.lists.createList({ mediaType: "film", name: "Icons" }),
    201,
  );
  const { token } = (await expectBody(loggedInApi.lists.createShareLink(created.list.id), 201))
    .shareLink;
  const appPage = await (await request.get("/")).text();

  const sharePage = await (await loggedInApi.sharedLists.getSharedListPage(token)).text();

  expect(iconTags(sharePage)).toEqual(iconTags(appPage));
  expect(iconTags(sharePage)).toHaveLength(5);
});
