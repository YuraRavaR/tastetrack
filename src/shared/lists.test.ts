import { describe, expect, it } from "vitest";
import { isReservedListName, moved, sameListName } from "./lists";

describe("moving a List Item", () => {
  const list = ["a", "b", "c", "d"];

  it.each([
    ["c", 0, ["c", "a", "b", "d"]],
    ["a", 2, ["b", "c", "a", "d"]],
    ["b", 3, ["a", "c", "d", "b"]],
    ["b", 1, ["a", "b", "c", "d"]],
  ])("%s to place %s gives %j", (item, index, order) => {
    expect(moved(list, item, index)).toEqual(order);
  });

  it("past the end puts it last", () => {
    expect(moved(list, "a", 99)).toEqual(["b", "c", "d", "a"]);
  });

  it("that isn't in the List changes nothing", () => {
    expect(moved(list, "z", 0)).toEqual(list);
  });

  it("leaves the List it was given as it was", () => {
    moved(list, "d", 0);

    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

describe("List names", () => {
  it.each([
    ["Horror", "horror"],
    ["  Horror  ", "HORROR"],
    ["Жахи", "ЖАХИ"],
    ["Ґанок і їжак", "ґАНОК І ЇЖАК"],
    // The same letter written precomposed and as a base letter plus an accent.
    ["Amélie", "Amélie"],
    // Letters whose capitals are more than one letter, or that have more than one small form.
    ["Straße", "STRASSE"],
    ["ΟΔΟΣ", "οδοσ"],
  ])("%j is the same name as %j", (name, other) => {
    expect(sameListName(name, other)).toBe(true);
  });

  it.each([
    ["Horror", "Horrors"],
    ["Жахи", "Жах"],
    ["Watch list", "Watchlist"],
  ])("%j is not the same name as %j", (name, other) => {
    expect(sameListName(name, other)).toBe(false);
  });

  it.each(["Watchlist", "watchlist", "  WATCHLIST "])("%j is reserved", (name) => {
    expect(isReservedListName(name)).toBe(true);
  });

  it.each(["My Watchlist", "Watch list", "Horror"])("%j is not reserved", (name) => {
    expect(isReservedListName(name)).toBe(false);
  });
});
