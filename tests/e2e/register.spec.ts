import { expectBody } from "../support/api/responses";
import { uniqueUsername } from "../support/scenarios/users";
import { expect, test } from "../support/ui/fixtures";

test("a User generates an Invite Code and a friend registers with it", { tag: "@smoke" }, async ({
  page,
  ui,
  loggedInUser: _inviter,
}) => {
  const { libraryPage, invitesPage, loginPage, registerPage } = ui;
  await libraryPage.goto();
  await libraryPage.header.accountMenu.choose("Invites");
  await invitesPage.generateButton.click();
  await expect(invitesPage.activeInviteCodes).toHaveCount(1);
  await expect(invitesPage.activeInviteCodes).toContainText(/Expires [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  const code = await invitesPage.readActiveInviteCode();
  await invitesPage.header.accountMenu.logOut();

  await loginPage.registerLink.click();
  await expect(registerPage.heading).toBeVisible();
  await registerPage.inviteCodeInput.fill(code);
  await registerPage.usernameInput.fill("no");
  await expect(registerPage.usernameInput).toHaveAttribute("aria-invalid", "true");
  await expect(registerPage.usernameHint).toBeVisible();
  const friend = uniqueUsername();
  await registerPage.usernameInput.fill(friend);
  await expect(registerPage.usernameInput).toHaveAttribute("aria-invalid", "false");
  await registerPage.passwordInput.fill("a long enough password");
  await registerPage.registerButton.click();

  await expect(page).toHaveURL(libraryPage.path());
  await expect(libraryPage.header.banner).toContainText(friend);
});

test("a used Invite Code shows why registration failed", async ({ page, ui, loggedInApi: api }) => {
  const { inviteCode } = await expectBody(api.inviteCodes.issueInviteCode(), 201);
  const code = inviteCode.code;
  await expectBody(
    api.auth.register({
      inviteCode: code,
      username: uniqueUsername(),
      password: "a long enough password",
    }),
    201,
  );
  await api.auth.logout();

  const { registerPage } = ui;
  await registerPage.goto(code);
  await expect(registerPage.inviteCodeInput).toHaveValue(code);
  await registerPage.register({
    username: uniqueUsername(),
    password: "a long enough password",
  });

  await expect(registerPage.errorMessage).toHaveText(
    "That Invite Code has already been used. Ask for a new one.",
  );
  await expect(page).toHaveURL(registerPage.path(code));
  await expect(registerPage.inviteCodeInput).toHaveAttribute("aria-invalid", "true");
  await expect(registerPage.usernameInput).toHaveAttribute("aria-invalid", "false");

  // Typing in the field at fault clears the error.
  await registerPage.inviteCodeInput.fill("ANOTHERCODE");
  await expect(registerPage.errorMessage).toHaveCount(0);
  await expect(registerPage.inviteCodeInput).toHaveAttribute("aria-invalid", "false");
});

test("a taken Username marks the Username field", async ({ ui, api, loggedInUser }) => {
  const { inviteCode } = await expectBody(api.inviteCodes.issueInviteCode(), 201);
  await api.auth.logout();
  const { registerPage } = ui;

  await registerPage.goto(inviteCode.code);
  await registerPage.register({
    username: loggedInUser.username,
    password: "a long enough password",
  });

  await expect(registerPage.errorMessage).toHaveText(
    "That Username is taken. Please choose another.",
  );
  await expect(registerPage.usernameInput).toHaveAttribute("aria-invalid", "true");
  await expect(registerPage.inviteCodeInput).toHaveAttribute("aria-invalid", "false");

  // Typing in the field at fault clears the error.
  await registerPage.usernameInput.fill(uniqueUsername());
  await expect(registerPage.errorMessage).toHaveCount(0);
  await expect(registerPage.usernameInput).toHaveAttribute("aria-invalid", "false");
});
