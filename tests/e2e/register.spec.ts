import { expect, test } from "@playwright/test";
import { createUser, uniqueUsername } from "../support/users";

test("a User generates an Invite Code and a friend registers with it", { tag: "@smoke" }, async ({
  page,
}) => {
  const inviter = await createUser();
  await page.request.post("/api/auth/login", { data: inviter });

  await page.goto("/");
  await page.getByRole("link", { name: "Invites" }).click();
  await page.getByRole("button", { name: "Generate an Invite Code" }).click();
  const active = page.getByRole("list", { name: "Active Invite Codes" }).getByRole("listitem");
  await expect(active).toHaveCount(1);
  await expect(active).toContainText(/Expires \d{1,2} [A-Z][a-z]{2} \d{4}/);
  const code = await active.getByRole("code").textContent();
  await page.getByRole("button", { name: "Log out" }).click();

  await page.getByRole("link", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await page.getByLabel("Invite Code").fill(code ?? "");
  const username = page.getByLabel("Username");
  await username.fill("no");
  await expect(username).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("3–30 characters: letters, digits and underscores")).toBeVisible();
  const friend = uniqueUsername();
  await username.fill(friend);
  await expect(username).toHaveAttribute("aria-invalid", "false");
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner")).toContainText(friend);
});

test("a used Invite Code shows why registration failed", async ({ page }) => {
  const inviter = await createUser();
  const api = page.request;
  await api.post("/api/auth/login", { data: inviter });
  const code = (await (await api.post("/api/invite-codes")).json()).inviteCode.code;
  await api.post("/api/auth/register", {
    data: { inviteCode: code, username: uniqueUsername(), password: "a long enough password" },
  });
  await api.post("/api/auth/logout");

  await page.goto(`/register?code=${code}`);
  await expect(page.getByLabel("Invite Code")).toHaveValue(code);
  await page.getByLabel("Username").fill(uniqueUsername());
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "That Invite Code has already been used. Ask for a new one.",
  );
  await expect(page).toHaveURL(/\/register/);
});
