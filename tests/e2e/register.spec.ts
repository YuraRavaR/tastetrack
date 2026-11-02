import { expectBody } from "../support/api/responses";
import { uniqueUsername } from "../support/scenarios/users";
import { expect, test } from "../support/ui/fixtures";

test("a User generates an Invite Code and a friend registers with it", { tag: "@smoke" }, async ({
  page,
  ui,
  loggedInUser: _inviter,
}) => {
  const { homePage, invitesPage, loginPage, registerPage } = ui;
  await homePage.goto();
  await homePage.header.accountMenu.choose("Invites");
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

  await expect(page).toHaveURL(homePage.path);
  await expect(homePage.header.banner).toContainText(friend);
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

  await ui.registerPage.goto(code);
  await expect(ui.registerPage.inviteCodeInput).toHaveValue(code);
  await ui.registerPage.register({
    username: uniqueUsername(),
    password: "a long enough password",
  });

  await expect(ui.registerPage.errorMessage).toHaveText(
    "That Invite Code has already been used. Ask for a new one.",
  );
  await expect(page).toHaveURL(ui.registerPage.pathWithInviteCode(code));
});
