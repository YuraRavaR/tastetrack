import { describe, expect, it } from "vitest";
import { hasTestHooksAccess } from "./env";

describe("hasTestHooksAccess", () => {
  const staging = { TEST_HOOKS: "1", TEST_HOOKS_SECRET: "the secret" };

  it("lets in a request with the secret", () => {
    expect(hasTestHooksAccess(staging, "the secret")).toBe(true);
  });

  it("refuses a missing or wrong secret", () => {
    expect(hasTestHooksAccess(staging, undefined)).toBe(false);
    expect(hasTestHooksAccess(staging, "")).toBe(false);
    expect(hasTestHooksAccess(staging, "the secreT")).toBe(false);
    expect(hasTestHooksAccess(staging, "the secret and more")).toBe(false);
  });

  it("refuses everyone while no secret is set, even a request that sends an empty one", () => {
    expect(hasTestHooksAccess({ TEST_HOOKS: "1" }, undefined)).toBe(false);
    expect(hasTestHooksAccess({ TEST_HOOKS: "1" }, "")).toBe(false);
    expect(hasTestHooksAccess({ TEST_HOOKS: "1", TEST_HOOKS_SECRET: "" }, "")).toBe(false);
  });

  it("refuses the secret where test hooks are off", () => {
    expect(hasTestHooksAccess({ TEST_HOOKS_SECRET: "the secret" }, "the secret")).toBe(false);
  });
});
