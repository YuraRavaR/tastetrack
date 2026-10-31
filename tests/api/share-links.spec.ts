import { type APIRequestContext, expect, request as requests, test } from "@playwright/test";
import { alien, aliens } from "../support/films";
import { createList, fillList } from "../support/lists";
import { logInNewUser } from "../support/users";

// A request context with no session: a visitor holding nothing but the link.
function visitor() {
  return requests.newContext({ baseURL: test.info().project.use.baseURL });
}

async function theList(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/lists/${id}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).list;
}

async function addToList(request: APIRequestContext, listId: number, data: object) {
  const response = await request.post(`/api/lists/${listId}/items`, { data });
  expect(response.status(), await response.text()).toBe(201);
}

// Shares one of the logged-in User's Lists: its new Share Link.
async function share(request: APIRequestContext, listId: number) {
  const response = await request.post(`/api/lists/${listId}/share-link`);
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).shareLink;
}

test("sharing a List makes its Visibility link, under a URL with a random token", async ({
  request,
  baseURL,
}) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });

  const response = await request.post(`/api/lists/${list.id}/share-link`);

  expect(response.status()).toBe(201);
  const { shareLink } = await response.json();
  expect(shareLink).toEqual({ token: expect.any(String), url: expect.any(String) });
  expect(shareLink.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  // 22 base64url characters carry 128 random bits; the List's id appears nowhere.
  expect(shareLink.url).toBe(`${baseURL}/s/${shareLink.token}`);
  const shared = await theList(request, list.id);
  expect(shared.visibility).toBe("link");
  expect(shared.shareLink).toEqual(shareLink);
  const lists = (await (await request.get("/api/lists")).json()).lists;
  expect(lists[0].visibility).toBe("link");
});

test("a List has at most one Share Link: sharing it again gives the same one", async ({
  request,
}) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });
  const first = await share(request, list.id);

  const again = await request.post(`/api/lists/${list.id}/share-link`);

  expect(again.status()).toBe(200);
  expect((await again.json()).shareLink).toEqual(first);
  const other = await createList(request, { name: "Comedy" });
  expect((await share(request, other.id)).token).not.toBe(first.token);
});

test("anyone with the link sees the List, its Notes and the owner's Display Name, without login", async ({
  request,
}) => {
  const owner = await logInNewUser(request);
  const list = await createList(request, { name: "Space horror", description: "Lights off." });
  const [first, second] = [await alien(request), await aliens(request)];
  await addToList(request, list.id, { mediaItemId: first.id, note: "Start here." });
  await addToList(request, list.id, { mediaItemId: second.id });
  const { token } = await share(request, list.id);

  const anyone = await visitor();
  const response = await anyone.get(`/api/shared-lists/${token}`);

  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
  expect(await response.json()).toEqual({
    sharedList: {
      title: "Space horror",
      description: "Lights off.",
      mediaType: "film",
      owner: { displayName: owner.username },
      items: [
        { mediaItem: first, position: 0, note: "Start here." },
        { mediaItem: second, position: 1, note: null },
      ],
    },
  });
  await anyone.dispose();
});

test("a shared List never shows the owner's Ratings or Log Entries", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Space horror" });
  const film = await alien(request);
  await addToList(request, list.id, { mediaItemId: film.id, note: "Start here." });
  const logged = await request.post("/api/log-entries", {
    data: { mediaItemId: film.id, rating: 4.5, review: "My secret review.", date: "2026-10-01" },
  });
  expect(logged.status(), await logged.text()).toBe(201);
  const { token } = await share(request, list.id);

  const anyone = await visitor();
  const body = await (await anyone.get(`/api/shared-lists/${token}`)).text();

  expect(body).toContain("Start here.");
  for (const secret of ["rating", "review", "My secret review.", "2026-10-01"]) {
    expect(body, secret).not.toContain(secret);
  }
  await anyone.dispose();
});

// What anyone gets for a Share Link: the status, and the body of a 404.
async function visit(token: string) {
  const anyone = await visitor();
  const response = await anyone.get(`/api/shared-lists/${token}`);
  const result = { status: response.status(), body: await response.text() };
  await anyone.dispose();
  return result;
}

test("revoking a Share Link stops it working and makes the List private", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });
  const { token } = await share(request, list.id);

  const response = await request.delete(`/api/lists/${list.id}/share-link`);

  expect(response.status()).toBe(204);
  expect(await visit(token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
  const revoked = await theList(request, list.id);
  expect(revoked.visibility).toBe("private");
  expect(revoked.shareLink).toBeNull();
  const again = await request.delete(`/api/lists/${list.id}/share-link`);
  expect(again.status()).toBe(404);
  expect(await again.json()).toEqual({ error: "unknown_share_link" });
  // Sharing it afresh gives a new link; the revoked one stays dead.
  expect((await share(request, list.id)).token).not.toBe(token);
  expect((await visit(token)).status).toBe(404);
});

test("regenerating a Share Link replaces it: the old link stops working, the new one works", async ({
  request,
}) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });
  const old = await share(request, list.id);

  const response = await request.post(`/api/lists/${list.id}/share-link/regenerate`);

  expect(response.status()).toBe(200);
  const { shareLink } = await response.json();
  expect(shareLink.token).not.toBe(old.token);
  expect(shareLink.url).toMatch(new RegExp(`/s/${shareLink.token}$`));
  expect(await visit(old.token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
  expect((await visit(shareLink.token)).status).toBe(200);
  const regenerated = await theList(request, list.id);
  expect(regenerated.visibility).toBe("link");
  expect(regenerated.shareLink).toEqual(shareLink);
});

test("a List that isn't shared has no link to regenerate", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });

  const response = await request.post(`/api/lists/${list.id}/share-link/regenerate`);

  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "unknown_share_link" });
  expect((await theList(request, list.id)).visibility).toBe("private");
});

test("an unknown token gets the same plain 404 as any unknown path", async () => {
  for (const token of ["q3Vb8kXo2LmN5pRt7wYz1A", "x", "x".repeat(500)]) {
    expect(await visit(token), token).toEqual({ status: 404, body: '{"error":"not_found"}' });
  }
});

async function theBacklog(request: APIRequestContext) {
  const response = await request.get("/api/backlog", { params: { mediaType: "film" } });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).backlog;
}

test('a User shares their Backlog, titled "<Display Name>\'s Watchlist"', async ({ request }) => {
  const owner = await logInNewUser(request);
  const film = await alien(request);
  const planned = await request.post("/api/backlog/items", {
    data: { mediaItemId: film.id, note: "Soon." },
  });
  expect(planned.status(), await planned.text()).toBe(201);
  const backlog = await theBacklog(request);
  expect(backlog).toMatchObject({ visibility: "private", shareLink: null });

  const shareLink = await share(request, backlog.id);

  expect(await theBacklog(request)).toMatchObject({ visibility: "link", shareLink });
  const anyone = await visitor();
  const response = await anyone.get(`/api/shared-lists/${shareLink.token}`);
  expect(await response.json()).toEqual({
    sharedList: {
      title: `${owner.username}'s Watchlist`,
      description: null,
      mediaType: "film",
      owner: { displayName: owner.username },
      items: [{ mediaItem: film, position: 0, note: "Soon." }],
    },
  });
  await anyone.dispose();
  expect((await request.delete(`/api/lists/${backlog.id}/share-link`)).status()).toBe(204);
  expect(await theBacklog(request)).toMatchObject({ visibility: "private", shareLink: null });
});

test("Manual Media Items in a shared List show their title and year", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Ukrainian classics" });
  const made = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title: "Тіні забутих предків", year: 1965 },
  });
  expect(made.status(), await made.text()).toBe(201);
  const { mediaItem } = await made.json();
  await addToList(request, list.id, { mediaItemId: mediaItem.id });
  const { token } = await share(request, list.id);

  const anyone = await visitor();
  const { sharedList } = await (await anyone.get(`/api/shared-lists/${token}`)).json();

  expect(sharedList.items).toHaveLength(1);
  expect(sharedList.items[0].mediaItem.metadata).toMatchObject({
    title: "Тіні забутих предків",
    year: 1965,
  });
  await anyone.dispose();
});

test("only the List's owner can share it, regenerate or revoke its link", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });
  const { token } = await share(request, list.id);
  const backlog = await theBacklog(request);
  const stranger = await visitor();
  await logInNewUser(stranger);

  for (const listId of [list.id, backlog.id]) {
    const shared = await stranger.post(`/api/lists/${listId}/share-link`);
    expect(shared.status()).toBe(404);
    expect(await shared.json()).toEqual({ error: "unknown_list" });
    for (const response of [
      await stranger.post(`/api/lists/${listId}/share-link/regenerate`),
      await stranger.delete(`/api/lists/${listId}/share-link`),
    ]) {
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_share_link" });
    }
  }
  await stranger.dispose();
  expect((await visit(token)).status).toBe(200);
  expect((await theBacklog(request)).visibility).toBe("private");
});

test("managing Share Links needs a session", async () => {
  const anyone = await visitor();
  for (const response of [
    await anyone.post("/api/lists/1/share-link"),
    await anyone.post("/api/lists/1/share-link/regenerate"),
    await anyone.delete("/api/lists/1/share-link"),
  ]) {
    expect(response.status()).toBe(401);
  }
  await anyone.dispose();
});

test("deleting a shared List stops its link working", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Horror nights" });
  const { token } = await share(request, list.id);

  expect((await request.delete(`/api/lists/${list.id}`)).status()).toBe(204);

  expect(await visit(token)).toEqual({ status: 404, body: '{"error":"not_found"}' });
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("a shared List loads in the same number of queries for 1 film as for 1,000", async ({
  request,
}) => {
  await logInNewUser(request);
  const anyone = await visitor();
  const queriesForSharedListOf = async (films: number) => {
    const list = await createList(request, { name: `${films} films` });
    await fillList(request, list.id, films);
    const { token } = await share(request, list.id);
    const response = await anyone.get(`/api/shared-lists/${token}`);
    expect(await response.json()).toMatchObject({ sharedList: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForSharedListOf(1);
  const thousand = await queriesForSharedListOf(1000);

  await anyone.dispose();
  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});

// The page a Share Link opens, as a messenger fetching a preview sees it: the app's HTML with
// the List in its <head>.
async function sharePage(url: string) {
  const anyone = await visitor();
  const response = await anyone.get(url);
  const result = {
    status: response.status(),
    robots: response.headers()["x-robots-tag"],
    html: await response.text(),
  };
  await anyone.dispose();
  return result;
}

test("a Share Link's page names the List in its <head>, for preview cards, and is noindex", async ({
  request,
}) => {
  await logInNewUser(request);
  const list = await createList(request, {
    name: `Tom & Jerry's "best" <films>`,
    description: "Cartoons & <chaos>.",
  });
  const { url } = await share(request, list.id);

  const page = await sharePage(url);

  expect(page.status).toBe(200);
  expect(page.robots).toBe("noindex");
  const title = "Tom &amp; Jerry&#39;s &quot;best&quot; &lt;films&gt;";
  const description = "Cartoons &amp; &lt;chaos&gt;.";
  expect(page.html).toContain(`<title>${title}</title>`);
  for (const meta of [
    '<meta name="robots" content="noindex">',
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="TasteTrack">',
    `<meta property="og:url" content="${url}">`,
  ]) {
    expect(page.html).toContain(meta);
  }
  expect(page.html).not.toContain("<films>");
  expect(page.html).toContain('<div id="root"></div>');
});

test("a shared Backlog's page is titled \"<Display Name>'s Watchlist\", with no description", async ({
  request,
}) => {
  const owner = await logInNewUser(request);
  const { url } = await share(request, (await theBacklog(request)).id);

  const page = await sharePage(url);

  expect(page.html).toContain(`<title>${owner.username}&#39;s Watchlist</title>`);
  expect(page.html).toContain(
    `<meta property="og:title" content="${owner.username}&#39;s Watchlist">`,
  );
  expect(page.html).not.toContain('name="description"');
  expect(page.html).not.toContain("og:description");
});

test("a revoked, replaced or unknown Share Link's page is a plain 404", async ({
  request,
  baseURL,
}) => {
  await logInNewUser(request);
  const first = await createList(request, { name: "Revoked" });
  const revoked = await share(request, first.id);
  expect((await request.delete(`/api/lists/${first.id}/share-link`)).status()).toBe(204);
  const second = await createList(request, { name: "Replaced" });
  const replaced = await share(request, second.id);
  const regenerated = await request.post(`/api/lists/${second.id}/share-link/regenerate`);
  expect(regenerated.status()).toBe(200);

  const pages = [
    await sharePage(revoked.url),
    await sharePage(replaced.url),
    await sharePage(`${baseURL}/s/q3Vb8kXo2LmN5pRt7wYz1A`),
  ];

  for (const page of pages) {
    expect(page.status).toBe(404);
    expect(page.robots).toBe("noindex");
    expect(page.html).not.toContain("Revoked");
    expect(page.html).not.toContain("Replaced");
  }
  expect(new Set(pages.map((page) => page.html)).size).toBe(1);
});
