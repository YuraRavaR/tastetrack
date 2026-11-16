import { ItemHistoryResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import {
  bookSearchResult,
  callsRealOpenLibrary,
  greatGatsby,
  hymn,
  kafkaOnTheShore,
  manualBook,
  nameOfTheWind,
  newBook,
  tyhrolovy,
} from "../support/scenarios/books";

// Locally the Worker calls an Open Library fake that mirrors real Open Library; these are its
// descriptions as it had them on 2026-11-16.

// What a Media Item's page says it is about, as its Item History carries it.
async function aboutOf(api: ApiClient, mediaItemId: number) {
  const history = api.catalog.getMediaItemHistory(mediaItemId);
  return (await expectBody(history, 200, ItemHistoryResponse)).about;
}

test("a book's Item History carries its description, as Open Library has it", async ({
  loggedInApi,
}) => {
  const { id } = await kafkaOnTheShore(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toEqual({
    mediaType: "book",
    description:
      "A boy trying to escape a gruesome oedipedal prophecy, a simple man who can talk to cats, " +
      "a mysterious librarian, and a woman waiting for a long-dead lover.",
  });
});

test("a description in Ukrainian is carried as it is", async ({ loggedInApi }) => {
  const { id } = await tyhrolovy(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toEqual({
    mediaType: "book",
    description: expect.stringMatching(/^Роман Івана Багряного Тигролови \(1944\)/),
  });
});

test("reference links in a description are their text, its paragraphs kept and its link list cut", async ({
  loggedInApi,
}) => {
  const { id } = await nameOfTheWind(loggedInApi);

  const about = await aboutOf(loggedInApi, id);

  expect(about?.mediaType).toBe("book");
  const description = about?.mediaType === "book" ? about.description : "";
  expect(description).toMatch(/^\*\*\*The Name of the Wind\*\*\*, also called/);
  expect(description).toContain(
    "comparisons to renowned fantasy authors such as Tad Williams, George R. R. Martin, and " +
      "Robert Jordan.\n\nFollowed by: ***The Wise Man's Fear***\n",
  );
  expect(description).toMatch(/\n\(Source: special note from the publisher\)$/);
  expect(description).not.toMatch(/\r|\[|\]|https?:/);
});

test("inline links in a description are their text", async ({ loggedInApi }) => {
  const { id } = await greatGatsby(loggedInApi);

  const about = await aboutOf(loggedInApi, id);

  expect(about).toEqual({
    mediaType: "book",
    description: expect.stringMatching(
      /^Here is a novel, glamorous, ironical, compassionate.*\n\nAlso contained in:\n\n- The Fitzgerald Reader\n- Three Novels of F\. Scott Fitzgerald$/s,
    ),
  });
  expect(JSON.stringify(about)).not.toMatch(/\\r|\[|\]|https?:/);
});

test("a book with no description has nothing to show", async ({ loggedInApi }) => {
  const { id } = await hymn(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a manual book has nothing to show", async ({ loggedInApi }) => {
  const { id } = await manualBook(loggedInApi, { title: "Доця", year: 2004 });

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a book filled from a search result alone has nothing to show", async ({ loggedInApi }) => {
  test.skip(callsRealOpenLibrary(), "Only the Open Library fake has a work without details");
  const { id, query } = newBook();
  const result = await bookSearchResult(loggedInApi, query, id);
  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(result), 201);

  expect(await aboutOf(loggedInApi, mediaItem.id)).toBeNull();
});

test("a List of books and its Share Link carry no description", async ({
  loggedInApi,
  createApiClient,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Fantasy", mediaType: "book" }),
    201,
  );
  const { id } = await nameOfTheWind(loggedInApi);
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: id }), 201);
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const own = await expectBody(loggedInApi.lists.getList(list.id));
  const shared = await expectBody(
    (await createApiClient()).sharedLists.getSharedList(shareLink.token),
  );

  for (const body of [own, shared]) {
    expect(JSON.stringify(body)).not.toMatch(/Kvothe|Tad Williams/);
  }
});
