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
  // Not the film Backlog's name: a sentence that hard-codes it would still read right with that.
  const backlogName = "Reading List";

  it("take the name they are given", () => {
    expect(t("search.inBacklog", { backlogName })).toBe("On your Reading List");
    expect(t("logEntry.backlogHint", { backlogName })).toBe(
      "Saving takes it off your Reading List",
    );
    expect(t("backlog.updateFailed", { backlogName })).toBe(
      "Couldn't update your Reading List. Please try again.",
    );
    expect(t("backlog.full", { backlogName, max: 1000 })).toBe(
      "Your Reading List is full: it holds up to 1,000 films. Remove or log some to make room.",
    );
    expect(t("backlog.planned", { backlogName, film: "Alien" })).toBe(
      "Put Alien on your Reading List.",
    );
    expect(t("backlog.takenOff", { backlogName, film: "Alien" })).toBe(
      "Took Alien off your Reading List.",
    );
    expect(t("backlog.putBack", { backlogName, film: "Alien" })).toBe(
      "Put Alien back on your Reading List.",
    );
  });
});
