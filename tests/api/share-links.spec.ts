import { type MediaType, SharedListResponse, ShareLinkResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { test as base, expect } from "../support/fixtures";
import { harryPotter, hymn, tyhrolovy } from "../support/scenarios/books";
import { alien, aliens, manualFilm } from "../support/scenarios/films";

// `visitor` is a client with no session, holding nothing but the link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

// Makes a List, of films unless it says otherwise: its summary, as the Worker answers.
async function createList(
  api: ApiClient,
  data: { name: string; description?: string; mediaType?: MediaType },
) {
  return (await expectBody(api.lists.createList({ mediaType: "film", ...data }), 201)).list;
}

async function theList(api: ApiClient, id: number) {
  return (await expectBody(api.lists.getList(id))).list;
}

// Shares one of the logged-in User's Lists: its new Share Link.
async function share(api: ApiClient, listId: number) {
  return (await expectBody(api.lists.createShareLink(listId), 201)).shareLink;
}

test("sharing a List makes its Visibility link, under a URL with a random token", async ({
  loggedInApi,
  baseURL,
}) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });

  const { shareLink } = await expectBody(
    loggedInApi.lists.createShareLink(list.id),
    201,
    ShareLinkResponse,
  );

  expect(shareLink).toEqual({ token: expect.any(String), url: expect.any(String) });
  expect(shareLink.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  // 22 base64url characters carry 128 random bits; the List's id appears nowhere.
  expect(shareLink.url).toBe(`${baseURL}/s/${shareLink.token}`);
  const shared = await theList(loggedInApi, list.id);
  expect(shared.visibility).toBe("link");
  expect(shared.shareLink).toEqual(shareLink);
  const { lists } = await expectBody(loggedInApi.lists.getLists());
  expect(lists[0].visibility).toBe("link");
});

test("a List has at most one Share Link: sharing it again gives the same one", async ({
  loggedInApi,
}) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });
  const first = await share(loggedInApi, list.id);

  const again = await expectBody(loggedInApi.lists.createShareLink(list.id));

  expect(again.shareLink).toEqual(first);
  const other = await createList(loggedInApi, { name: "Comedy" });
  expect((await share(loggedInApi, other.id)).token).not.toBe(first.token);
});

test("anyone with the link sees the List, its Notes and the owner's Display Name, without login", async ({
  api,
  loggedInUser,
  visitor,
}) => {
  const list = await createList(api, { name: "Space horror", description: "Lights off." });
  const [first, second] = [await alien(api), await aliens(api)];
  await expectBody(
    api.lists.addListItem(list.id, { mediaItemId: first.id, note: "Start here." }),
    201,
  );
  await expectBody(api.lists.addListItem(list.id, { mediaItemId: second.id }), 201);
  const { token } = await share(api, list.id);

  const response = await visitor.sharedLists.getSharedList(token);

  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
  expect(await response.json()).toEqual({
    sharedList: {
      title: "Space horror",
      description: "Lights off.",
      mediaType: "film",
      owner: { displayName: loggedInUser.username },
      items: [
        { mediaItem: first, position: 0, note: "Start here." },
        { mediaItem: second, position: 1, note: null },
      ],
    },
  });
});

test("a shared List never shows the owner's Ratings or Log Entries", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Space horror" });
  const film = await alien(loggedInApi);
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: film.id, note: "Start here." }),
    201,
  );
  await expectBody(
    loggedInApi.log.createLogEntry({
      mediaItemId: film.id,
      rating: 4.5,
      review: "My secret review.",
      date: "2026-10-01",
    }),
    201,
  );
  const { token } = await share(loggedInApi, list.id);

  const body = await (await visitor.sharedLists.getSharedList(token)).text();

  expect(body).toContain("Start here.");
  for (const secret of ["rating", "review", "My secret review.", "2026-10-01"]) {
    expect(body, secret).not.toContain(secret);
  }
});

// What anyone gets for a Share Link: the status, and the body of a 404.
async function visit(visitor: ApiClient, token: string) {
  const response = await visitor.sharedLists.getSharedList(token);
  return { status: response.status(), body: await response.text() };
}

test("revoking a Share Link stops it working and makes the List private", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });
  const { token } = await share(loggedInApi, list.id);

  const response = await loggedInApi.lists.revokeShareLink(list.id);

  expect(response.status()).toBe(204);
  expect(await visit(visitor, token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
  const revoked = await theList(loggedInApi, list.id);
  expect(revoked.visibility).toBe("private");
  expect(revoked.shareLink).toBeNull();
  const again = await expectBody(loggedInApi.lists.revokeShareLink(list.id), 404);
  expect(again).toEqual({ error: "unknown_share_link" });
  // Sharing it afresh gives a new link; the revoked one stays dead.
  expect((await share(loggedInApi, list.id)).token).not.toBe(token);
  expect((await visit(visitor, token)).status).toBe(404);
});

test("regenerating a Share Link replaces it: the old link stops working, the new one works", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });
  const old = await share(loggedInApi, list.id);

  const { shareLink } = await expectBody(
    loggedInApi.lists.regenerateShareLink(list.id),
    200,
    ShareLinkResponse,
  );

  expect(shareLink.token).not.toBe(old.token);
  expect(shareLink.url).toMatch(new RegExp(`/s/${shareLink.token}$`));
  expect(await visit(visitor, old.token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
  expect((await visit(visitor, shareLink.token)).status).toBe(200);
  const regenerated = await theList(loggedInApi, list.id);
  expect(regenerated.visibility).toBe("link");
  expect(regenerated.shareLink).toEqual(shareLink);
});

test("a List that isn't shared has no link to regenerate", async ({ loggedInApi }) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });

  const refused = await expectBody(loggedInApi.lists.regenerateShareLink(list.id), 404);

  expect(refused).toEqual({ error: "unknown_share_link" });
  expect((await theList(loggedInApi, list.id)).visibility).toBe("private");
});

test("an unknown token gets the same plain 404 as any unknown path", async ({ visitor }) => {
  for (const token of ["q3Vb8kXo2LmN5pRt7wYz1A", "x", "x".repeat(500)]) {
    expect(await visit(visitor, token), token).toEqual({
      status: 404,
      body: '{"error":"not_found"}',
    });
  }
});

async function theBacklog(api: ApiClient) {
  return (await expectBody(api.backlog.getBacklog({ mediaType: "film" }))).backlog;
}

test('a User shares their Backlog, titled "<Display Name>\'s Watchlist"', async ({
  api,
  loggedInUser,
  visitor,
}) => {
  const film = await alien(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: film.id, note: "Soon." }), 201);
  const backlog = await theBacklog(api);
  expect(backlog).toMatchObject({ visibility: "private", shareLink: null });

  const shareLink = await share(api, backlog.id);

  expect(await theBacklog(api)).toMatchObject({ visibility: "link", shareLink });
  expect(await expectBody(visitor.sharedLists.getSharedList(shareLink.token))).toEqual({
    sharedList: {
      title: `${loggedInUser.username}'s Watchlist`,
      description: null,
      mediaType: "film",
      owner: { displayName: loggedInUser.username },
      items: [{ mediaItem: film, position: 0, note: "Soon." }],
    },
  });
  expect((await api.lists.revokeShareLink(backlog.id)).status()).toBe(204);
  expect(await theBacklog(api)).toMatchObject({ visibility: "private", shareLink: null });
});

test("Manual Media Items in a shared List show their title and year", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Ukrainian classics" });
  const { mediaItem } = await expectBody(
    loggedInApi.catalog.addManualMediaItem({
      mediaType: "film",
      title: "Тіні забутих предків",
      year: 1965,
    }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);
  const { token } = await share(loggedInApi, list.id);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(token),
    200,
    SharedListResponse,
  );

  expect(sharedList.items).toHaveLength(1);
  expect(sharedList.items[0]?.mediaItem.metadata).toMatchObject({
    title: "Тіні забутих предків",
    year: 1965,
  });
});

test("anyone with the link sees a List of books: covers, titles, authors and Notes", async ({
  api,
  loggedInUser,
  visitor,
}) => {
  const list = await createList(api, { name: "Ukrainian prose", mediaType: "book" });
  const [first, second] = [await tyhrolovy(api), await harryPotter(api)];
  await expectBody(
    api.lists.addListItem(list.id, { mediaItemId: first.id, note: "Start here." }),
    201,
  );
  await expectBody(api.lists.addListItem(list.id, { mediaItemId: second.id }), 201);
  const { token } = await share(api, list.id);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(token),
    200,
    SharedListResponse,
  );

  expect(sharedList).toEqual({
    title: "Ukrainian prose",
    description: null,
    mediaType: "book",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: first, position: 0, note: "Start here." },
      { mediaItem: second, position: 1, note: null },
    ],
  });
  expect(sharedList.items[1]?.mediaItem.metadata).toMatchObject({
    title: "Harry Potter and the Philosopher's Stone",
    coverUrls: { large: "https://covers.openlibrary.org/b/id/15155833-L.jpg" },
    authors: ["J. K. Rowling"],
  });
});

test("only the List's owner can share it, regenerate or revoke its link", async ({
  loggedInApi,
  otherUserClient,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });
  const { token } = await share(loggedInApi, list.id);
  const backlog = await theBacklog(loggedInApi);

  for (const listId of [list.id, backlog.id]) {
    const shared = await expectBody(otherUserClient.lists.createShareLink(listId), 404);
    expect(shared).toEqual({ error: "unknown_list" });
    for (const response of [
      await otherUserClient.lists.regenerateShareLink(listId),
      await otherUserClient.lists.revokeShareLink(listId),
    ]) {
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_share_link" });
    }
  }
  expect((await visit(visitor, token)).status).toBe(200);
  expect((await theBacklog(loggedInApi)).visibility).toBe("private");
});

test("managing Share Links needs a session", async ({ api }) => {
  for (const response of [
    await api.lists.createShareLink(1),
    await api.lists.regenerateShareLink(1),
    await api.lists.revokeShareLink(1),
  ]) {
    expect(response.status()).toBe(401);
  }
});

test("deleting a shared List stops its link working", async ({ loggedInApi, visitor }) => {
  const list = await createList(loggedInApi, { name: "Horror nights" });
  const { token } = await share(loggedInApi, list.id);

  expect((await loggedInApi.lists.deleteList(list.id)).status()).toBe(204);

  expect(await visit(visitor, token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("a shared List loads in the same number of queries for 1 film as for 1,000", async ({
  loggedInApi,
  visitor,
}) => {
  const queriesForSharedListOf = async (films: number) => {
    const list = await createList(loggedInApi, { name: `${films} films` });
    expect((await loggedInApi.testHooks.fillList(list.id, films)).status()).toBe(204);
    const { token } = await share(loggedInApi, list.id);
    const response = await visitor.sharedLists.getSharedList(token);
    expect(await response.json()).toMatchObject({ sharedList: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForSharedListOf(1);
  const thousand = await queriesForSharedListOf(1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});

test("a shared List loads in the same number of queries for 1 book as for 500, on a cold cache", async ({
  loggedInApi,
  visitor,
}) => {
  // The placeholders have no cache entry, so the page fetches what it may from Open Library.
  const queriesForSharedListOf = async (books: number) => {
    const list = await createList(loggedInApi, { name: `${books} books`, mediaType: "book" });
    expect((await loggedInApi.testHooks.fillList(list.id, books)).status()).toBe(204);
    const { token } = await share(loggedInApi, list.id);
    const response = await visitor.sharedLists.getSharedList(token);
    expect(await response.json()).toMatchObject({
      sharedList: { mediaType: "book", items: { length: books } },
    });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForSharedListOf(1);
  const fiveHundred = await queriesForSharedListOf(500);

  expect(one).toMatch(/^\d+$/);
  expect(fiveHundred).toBe(one);
});

// The page a Share Link opens, as a messenger fetching a preview sees it: the app's HTML with
// the List in its <head>.
async function sharePage(visitor: ApiClient, token: string) {
  const response = await visitor.sharedLists.getSharedListPage(token);
  return {
    status: response.status(),
    robots: response.headers()["x-robots-tag"],
    html: await response.text(),
  };
}

test("a Share Link's page names the List in its <head>, for preview cards, and is noindex", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, {
    name: `Tom & Jerry's "best" <films>`,
    description: "Cartoons & <chaos>.",
  });
  const { token, url } = await share(loggedInApi, list.id);

  const page = await sharePage(visitor, token);

  expect(page.status).toBe(200);
  expect(page.robots).toBe("noindex");
  const title = "Tom &amp; Jerry&#39;s &quot;best&quot; &lt;films&gt;";
  const description = "Cartoons &amp; &lt;chaos&gt;.";
  expect(page.html).toContain(`<title>${title} · TasteTrack</title>`);
  for (const meta of [
    '<meta name="robots" content="noindex">',
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="TasteTrack">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${new URL("/og-image.png", url).href}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="TasteTrack: Your taste, on the record">',
  ]) {
    expect(page.html).toContain(meta);
  }
  expect(page.html).not.toContain("<films>");
  expect(page.html).toContain('<div id="root"></div>');
});

// The tags of one kind in a page's <head>, such as og:image or description, whoever wrote them.
function metaTags(html: string, key: string): string[] {
  return html.match(new RegExp(`<meta (?:name|property)="${key}"[^>]*>`, "g")) ?? [];
}

test("a Share Link's card shows the List's first poster, in place of the app's own card", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Space horror" });
  const noPoster = await manualFilm(loggedInApi, { title: "Home movie", year: 2020 });
  const [first, second] = [await alien(loggedInApi), await aliens(loggedInApi)];
  for (const film of [noPoster, first, second]) {
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: film.id }), 201);
  }
  const { token } = await share(loggedInApi, list.id);
  const poster = first.metadata.posterUrls.large;
  expect(poster).toMatch(/^https:\/\//);

  const page = await sharePage(visitor, token);

  expect(metaTags(page.html, "og:image")).toEqual([
    `<meta property="og:image" content="${poster}">`,
  ]);
  expect(metaTags(page.html, "og:image:[a-z]+")).toEqual([]);
  expect(metaTags(page.html, "og:title")).toEqual([
    '<meta property="og:title" content="Space horror">',
  ]);
  expect(metaTags(page.html, "(?:og:)?description")).toEqual([]);
  expect(metaTags(page.html, "twitter:card")).toHaveLength(1);
});

test("a shared List of books shows its first cover on its card", async ({
  loggedInApi,
  visitor,
}) => {
  const list = await createList(loggedInApi, { name: "Ukrainian prose", mediaType: "book" });
  const [coverless, first] = [await hymn(loggedInApi), await harryPotter(loggedInApi)];
  for (const book of [coverless, first, await tyhrolovy(loggedInApi)]) {
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: book.id }), 201);
  }
  const { token } = await share(loggedInApi, list.id);

  const page = await sharePage(visitor, token);

  expect(metaTags(page.html, "og:image")).toEqual([
    '<meta property="og:image" content="https://covers.openlibrary.org/b/id/15155833-L.jpg">',
  ]);
  expect(metaTags(page.html, "og:title")).toEqual([
    '<meta property="og:title" content="Ukrainian prose">',
  ]);
});

test("a shared Backlog's page is titled \"<Display Name>'s Watchlist\", with no description", async ({
  api,
  loggedInUser,
  visitor,
}) => {
  const { token } = await share(api, (await theBacklog(api)).id);

  const page = await sharePage(visitor, token);

  expect(page.html).toContain(
    `<title>${loggedInUser.username}&#39;s Watchlist · TasteTrack</title>`,
  );
  expect(page.html).toContain(
    `<meta property="og:title" content="${loggedInUser.username}&#39;s Watchlist">`,
  );
  expect(page.html).not.toContain('name="description"');
  expect(page.html).not.toContain("og:description");
});

test("a revoked, replaced or unknown Share Link's page is a plain 404", async ({
  loggedInApi,
  visitor,
}) => {
  const first = await createList(loggedInApi, { name: "Revoked" });
  const revoked = await share(loggedInApi, first.id);
  expect((await loggedInApi.lists.revokeShareLink(first.id)).status()).toBe(204);
  const second = await createList(loggedInApi, { name: "Replaced" });
  const replaced = await share(loggedInApi, second.id);
  await expectBody(loggedInApi.lists.regenerateShareLink(second.id));

  const pages = [
    await sharePage(visitor, revoked.token),
    await sharePage(visitor, replaced.token),
    await sharePage(visitor, "q3Vb8kXo2LmN5pRt7wYz1A"),
  ];

  for (const page of pages) {
    expect(page.status).toBe(404);
    expect(page.robots).toBe("noindex");
    expect(page.html).not.toContain("Revoked");
    expect(page.html).not.toContain("Replaced");
  }
  expect(new Set(pages.map((page) => page.html)).size).toBe(1);
});
