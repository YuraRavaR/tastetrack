import { expect, request as requests, test } from "@playwright/test";
import { runOperator } from "../support/operator";
import { createUser, uniqueUsername } from "../support/users";

// The Operator's password reset against the local D1 that the `local` Worker serves.

// The Temporary Password the reset printed.
function temporaryPasswordIn(stdout: string): string {
  const match = stdout.match(/Temporary Password: (\S+)/);
  if (!match?.[1]) throw new Error(`No Temporary Password in: ${stdout}`);
  return match[1];
}

test("the Operator resets a password: a temporary one is printed once and every session ends", async ({
  request,
  playwright,
  baseURL,
}) => {
  const user = await createUser();
  const other = await playwright.request.newContext({ baseURL });
  await request.post("/api/auth/login", { data: user });
  await other.post("/api/auth/login", { data: user });

  const result = await runOperator(["reset-password", "--env", "local"], [user.username]);

  expect(result.stderr).toBe("");
  expect(result.code).toBe(0);
  const temporaryPassword = temporaryPasswordIn(result.stdout);
  expect(result.stdout.split(temporaryPassword)).toHaveLength(2);
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(10);
  for (const device of [request, other]) {
    expect((await device.get("/api/auth/me")).status()).toBe(401);
  }
  await other.dispose();
  const withOld = await request.post("/api/auth/login", { data: user });
  expect(withOld.status()).toBe(401);
  const withTemporary = await request.post("/api/auth/login", {
    data: { username: user.username, password: temporaryPassword },
  });
  expect(withTemporary.status()).toBe(200);
  expect((await withTemporary.json()).passwordChangeRequired).toBe(true);
});

test("each reset makes a different Temporary Password", async () => {
  const user = await createUser();

  const first = await runOperator(["reset-password", "--env", "local"], [user.username]);
  const second = await runOperator(["reset-password", "--env", "local"], [user.username]);

  expect(temporaryPasswordIn(first.stdout)).not.toBe(temporaryPasswordIn(second.stdout));
});

test("the Operator finds the User in any letter case", async ({ request }) => {
  const user = await createUser();

  const result = await runOperator(
    ["reset-password", "--env", "local"],
    [user.username.toUpperCase()],
  );

  expect(result.code).toBe(0);
  const login = await request.post("/api/auth/login", {
    data: { username: user.username, password: temporaryPasswordIn(result.stdout) },
  });
  expect(login.status()).toBe(200);
});

test("the Operator can't reset the password of a User who doesn't exist", async () => {
  const result = await runOperator(["reset-password", "--env", "local"], [uniqueUsername()]);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("No User has that Username.");
  expect(result.stdout).not.toContain("Temporary Password");
});

test("a reset leaves other Users' sessions alone", async ({ request }) => {
  const user = await createUser();
  const someoneElse = await requests.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await createUser();
  await someoneElse.post("/api/auth/login", { data: other });
  await request.post("/api/auth/login", { data: user });

  await runOperator(["reset-password", "--env", "local"], [user.username]);

  expect((await someoneElse.get("/api/auth/me")).status()).toBe(200);
  await someoneElse.dispose();
});
