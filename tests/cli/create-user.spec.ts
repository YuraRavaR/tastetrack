import { expect, test } from "@playwright/test";
import { runOperator } from "../support/operator";
import { uniqueUsername } from "../support/users";

// The Operator CLI against the local D1 that the `local` Worker serves.

test("the Operator creates a User who can then log in", async ({ request }) => {
  const username = uniqueUsername();
  const password = "a long enough password";

  const result = await runOperator(
    ["create-user", "--env", "local"],
    [username, password, password],
  );

  expect(result.stderr).toBe("");
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(`Created User ${username} in local.`);
  expect(result.stdout).not.toContain(password);
  const login = await request.post("/api/auth/login", { data: { username, password } });
  expect(login.status()).toBe(200);
});

test("the Operator's User has an empty film Backlog from the start", async ({ request }) => {
  const username = uniqueUsername();
  const password = "a long enough password";
  await runOperator(["create-user", "--env", "local"], [username, password, password]);
  await request.post("/api/auth/login", { data: { username, password } });

  const response = await request.get("/api/backlog", { params: { mediaType: "film" } });

  expect(response.status()).toBe(200);
  expect((await response.json()).backlog).toMatchObject({ mediaType: "film", items: [] });
});

test("the Operator can't create a Username that is taken in any case", async () => {
  const username = uniqueUsername();
  const password = "a long enough password";
  await runOperator(["create-user", "--env", "local"], [username, password, password]);

  const result = await runOperator(
    ["create-user", "--env", "local"],
    [username.toUpperCase(), password, password],
  );

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("That Username is taken.");
});

test("the Operator is held to the Username and password rules", async () => {
  const badUsername = await runOperator(["create-user", "--env", "local"], ["a b"]);
  const shortPassword = await runOperator(
    ["create-user", "--env", "local"],
    [uniqueUsername(), "too short", "too short"],
  );
  const mismatch = await runOperator(
    ["create-user", "--env", "local"],
    [uniqueUsername(), "a long enough password", "a different password"],
  );

  expect(badUsername.code).toBe(1);
  expect(badUsername.stderr).toContain("3–30 letters, digits or underscores");
  expect(shortPassword.code).toBe(1);
  expect(shortPassword.stderr).toContain("10–128 characters");
  expect(mismatch.code).toBe(1);
  expect(mismatch.stderr).toContain("The passwords don't match.");
});

test("the Operator must name an environment", async () => {
  const result = await runOperator(["create-user"], []);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("--env local|staging|production");
});
