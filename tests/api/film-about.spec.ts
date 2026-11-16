import { ItemHistoryResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { alien, film, manualFilm, noCountryForOldMen, tampopo } from "../support/scenarios/films";
import { callsRealTmdb } from "../support/scenarios/tmdb";

// Locally the Worker calls a TMDB fake that mirrors real TMDB; these are TMDB's texts as it had
// them on 2026-11-16.

async function aboutOf(api: ApiClient, mediaItemId: number) {
  const history = api.catalog.getMediaItemHistory(mediaItemId);
  return (await expectBody(history, 200, ItemHistoryResponse)).about;
}

test("a film's Item History says what it is about, in English and Ukrainian, with its director and cast", async ({
  loggedInApi,
}) => {
  const { id } = await alien(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toEqual({
    mediaType: "film",
    tagline: {
      en: "In space no one can hear you scream.",
      uk: "В космосі ніхто твій крик не почує.",
    },
    overview: {
      en: expect.stringMatching(/^During its return to the earth, commercial spaceship Nostromo/),
      uk: expect.stringMatching(/^У далекому майбутньому вантажний космічний корабель/),
    },
    directors: ["Ridley Scott"],
    cast: [
      "Tom Skerritt",
      "Sigourney Weaver",
      "Veronica Cartwright",
      "Harry Dean Stanton",
      "John Hurt",
    ],
  });
});

test("a film directed by two names both, in TMDB's order", async ({ loggedInApi }) => {
  const { id } = await noCountryForOldMen(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toMatchObject({ directors: ["Joel Coen", "Ethan Coen"] });
});

test("a film with only an English overview and tagline has no Ukrainian ones", async ({
  loggedInApi,
}) => {
  const { id } = await tampopo(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toMatchObject({
    tagline: { en: "The first Japanese Noodle Western.", uk: null },
    overview: {
      en: expect.stringMatching(/^In this humorous paean to the joys of food/),
      uk: null,
    },
  });
});

test("a Manual Media Item has nothing to show", async ({ loggedInApi }) => {
  const { id } = await manualFilm(loggedInApi, { title: "Olena's wedding" });

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a film filled from a search result alone has nothing to show", async ({ loggedInApi }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake can be made to fail");
  // The fake fails the details call for this film, so its entry is the search result's.
  const { id } = await film(loggedInApi, "tmdb fake details failure", "999000001");

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a film TMDB has no overview or credits for has nothing to show", async ({ loggedInApi }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film it knows nothing about");
  const { id } = await film(loggedInApi, "tmdb fake nothing known", "999000003");

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a List and its Share Link carry no About data", async ({ loggedInApi, createApiClient }) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const { id } = await alien(loggedInApi);
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: id }), 201);
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const own = await expectBody(loggedInApi.lists.getList(list.id));
  const shared = await expectBody(
    (await createApiClient()).sharedLists.getSharedList(shareLink.token),
  );

  for (const body of [own, shared]) {
    expect(JSON.stringify(body)).not.toMatch(/Nostromo|Tom Skerritt|Ridley Scott/);
  }
});
