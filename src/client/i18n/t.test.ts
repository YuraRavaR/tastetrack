import { describe, expect, it } from "vitest";
import { t } from "./t";

describe("Ukrainian plurals", () => {
  it.each([
    [0, "0 фільмів"],
    [1, "1 фільм"],
    [2, "2 фільми"],
    [5, "5 фільмів"],
    [11, "11 фільмів"],
    [21, "21 фільм"],
    [22, "22 фільми"],
    [25, "25 фільмів"],
  ])("%i → %s", (count, expected) => {
    expect(t("films.count", { count })).toBe(expected);
  });
});
