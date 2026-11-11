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

describe("a full Backlog", () => {
  it("says what it holds, in its Media Type's words", () => {
    expect(mediaWord("film", "backlogFull", { max: 1000 })).toBe(
      "Your Watchlist is full: it holds up to 1,000 films. Remove or log some to make room.",
    );
    expect(mediaWord("book", "backlogFull", { max: 1000 })).toBe(
      "Your Reading list is full: it holds up to 1,000 books. Remove or log some to make room.",
    );
  });
});

describe("a book's words", () => {
  it.each([
    ["planned", "Want to read"],
    ["backlog", "Reading list"],
    ["tab", "Books"],
    ["sortYear", "First published"],
    ["experienced", "Read"],
    ["experiencedAgain", "Read again"],
    ["revisit", "Reread"],
    ["revisitHint", "You've read it before"],
    ["history", "Readings"],
  ] as const)("%s → %s", (word, expected) => {
    expect(mediaWord("book", word)).toBe(expected);
  });

  it("count the Reading list, the books being read and the books read on Saved's tile", () => {
    expect(mediaWord("book", "tileCounts", { backlog: 8, inProgress: 2, experienced: 23 })).toBe(
      "8 to read · 2 reading · 23 read",
    );
  });

  it("count the Readings of a book in words up to twice", () => {
    expect([1, 2, 3].map((count) => mediaWord("book", "experiencedCount", { count }))).toEqual([
      "Once",
      "Twice",
      "3 times",
    ]);
  });
});

describe("a film's Revisit", () => {
  it("is a Rewatch, counted in times", () => {
    expect(mediaWord("film", "revisit")).toBe("Rewatch");
    expect(mediaWord("film", "revisitHint")).toBe("You've watched it before");
    expect([1, 2].map((count) => mediaWord("film", "experiencedCount", { count }))).toEqual([
      "Once",
      "2 times",
    ]);
  });
});
