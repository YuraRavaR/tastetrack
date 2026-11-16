import { ItemHistoryResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { chernobyl, manualSeries, newSeries, noPosterSeries } from "../support/scenarios/series";
import { callsRealTmdb } from "../support/scenarios/tmdb";

// Locally the Worker calls a TMDB fake that mirrors real TMDB; these are TMDB's texts as it had
// them on 2026-11-16.

// What a Media Item's page says it is about, as its Item History carries it.
async function aboutOf(api: ApiClient, mediaItemId: number) {
  const history = api.catalog.getMediaItemHistory(mediaItemId);
  return (await expectBody(history, 200, ItemHistoryResponse)).about;
}

test("a series' Item History says what it is about, in English and Ukrainian, with its creators and cast", async ({
  loggedInApi,
}) => {
  const { id } = await chernobyl(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toEqual({
    mediaType: "series",
    tagline: { en: "What is the cost of lies?", uk: "Яка ціна брехні?" },
    overview: {
      en: expect.stringMatching(/^The true story of one of the worst man-made catastrophes/),
      uk: expect.stringMatching(/^Сюжет розгортається 1986 року/),
    },
    creators: ["Craig Mazin"],
    cast: ["Jared Harris", "Stellan Skarsgård", "Emily Watson", "Paul Ritter", "Jessie Buckley"],
  });
});

test("a series with only an English overview has no Ukrainian one, and no tagline", async ({
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a series with an overview this short");
  const { id } = await noPosterSeries(loggedInApi);

  expect(await aboutOf(loggedInApi, id)).toEqual({
    mediaType: "series",
    tagline: { en: null, uk: null },
    overview: { en: "A series with no poster.", uk: null },
    creators: [],
    cast: [],
  });
});

test("a manual series has nothing to show", async ({ loggedInApi }) => {
  const { id } = await manualSeries(loggedInApi, { title: "Спіймати Кайдаша", year: 2020 });

  expect(await aboutOf(loggedInApi, id)).toBeNull();
});

test("a series TMDB has no overview or credits for has nothing to show", async ({
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a series it knows nothing about");
  const { mediaItem } = await newSeries(loggedInApi);

  expect(await aboutOf(loggedInApi, mediaItem.id)).toBeNull();
});
