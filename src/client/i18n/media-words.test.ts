import { describe, expect, it } from "vitest";
import { MediaType } from "../../shared/api";
import { isReservedListName, sharedListTitle } from "../../shared/lists";
import { mediaWord } from "./media-words";
import { t } from "./t";

describe("a film's words", () => {
  it.each([
    ["experienced", "Watched"],
    ["markExperienced", "Mark watched"],
    ["backlog", "Watchlist"],
    ["search", "Search films"],
    ["tab", "Films"],
    ["rowPrefix", "Film"],
  ] as const)("%s → %s", (word, expected) => {
    expect(mediaWord("film", word)).toBe(expected);
  });
});

// The Worker can't read the catalogue, so the shared rules keep the Backlog's name too.
describe.each(MediaType.options)("the %s Backlog's name", (mediaType) => {
  const backlogName = mediaWord(mediaType, "backlog");

  it("can't be taken by a List", () => {
    expect(isReservedListName(backlogName)).toBe(true);
  });

  it("is what a shared Backlog is called", () => {
    expect(sharedListTitle(null, mediaType, "Olena")).toBe(`Olena's ${backlogName}`);
  });
});

describe("a Rating with its viewings", () => {
  it.each([
    [4, 1, "4 · 1 viewing"],
    [4.5, 2, "4.5 · 2 viewings"],
  ])("%d after %i → %s", (rating, count, expected) => {
    expect(mediaWord("film", "ratingAndCount", { rating, count })).toBe(expected);
  });
});

describe("sentences naming the Backlog", () => {
  const backlogName = mediaWord("film", "backlog");

  it.each([
    [1, "See your Watchlist"],
    [2, "All 2 on your Watchlist"],
  ])("%i films on home → %s", (count, expected) => {
    expect(t("home.backlog.all", { count, backlogName })).toBe(expected);
  });

  it("read as they did for a film", () => {
    expect(t("search.inBacklog", { backlogName })).toBe("On your Watchlist");
    expect(t("home.backlog.title", { backlogName })).toBe("Next on your Watchlist");
    expect(t("backlog.title", { backlogName })).toBe("Your Watchlist");
    expect(t("backlog.loading", { backlogName })).toBe("Loading your Watchlist…");
    expect(t("backlog.empty", { backlogName })).toBe(
      "Your Watchlist is empty. Search for a film and mark it Want to watch.",
    );
    expect(t("backlog.unavailable", { backlogName })).toBe(
      "Couldn't load your Watchlist. Please try again.",
    );
    expect(t("backlog.updateFailed", { backlogName })).toBe(
      "Couldn't update your Watchlist. Please try again.",
    );
    expect(t("backlog.full", { backlogName, max: 1000 })).toBe(
      "Your Watchlist is full: it holds up to 1,000 films. Remove or log some to make room.",
    );
    expect(t("backlog.planned", { backlogName, film: "Alien" })).toBe(
      "Put Alien on your Watchlist.",
    );
    expect(t("backlog.removed", { backlogName, film: "Alien" })).toBe(
      "Removed Alien from your Watchlist.",
    );
    expect(t("backlog.takenOff", { backlogName, film: "Alien" })).toBe(
      "Took Alien off your Watchlist.",
    );
    expect(t("backlog.putBack", { backlogName, film: "Alien" })).toBe(
      "Put Alien back on your Watchlist.",
    );
  });
});
