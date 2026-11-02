import { BasePage } from "./BasePage";

// Where a User who logged in with a Temporary Password sets their own. Every other page sends them
// here until they do.
export class NewPasswordPage extends BasePage {
  readonly path = "/new-password";
  readonly heading = this.page.getByRole("heading", { name: "Set a new password" });
  // A way to the Lists, which this page must not offer.
  readonly listsLink = this.page.getByRole("link", { name: "Lists" });
  readonly newPasswordInput = this.page.getByLabel("New password");
  readonly setPasswordButton = this.page.getByRole("button", { name: "Set password" });
  readonly errorMessage = this.page.getByRole("alert");

  async setPassword(newPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.setPasswordButton.click();
  }
}
