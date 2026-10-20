import { describe, expect, it } from "vitest";
import { moved } from "./lists";

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
