import type { RegisterRequest } from "@shared/api";
import { step } from "../../step";
import { BasePage } from "./BasePage";

export class RegisterPage extends BasePage<[inviteCode?: string]> {
  // With an Invite Code, the page opens with it filled in.
  path(inviteCode?: string) {
    return inviteCode ? `/register?code=${inviteCode}` : "/register";
  }

  readonly heading = this.page.getByRole("heading", { name: "Register" });
  readonly inviteCodeInput = this.page.getByLabel("Invite Code");
  readonly usernameInput = this.page.getByLabel("Username");
  readonly usernameHint = this.page.getByText("3–30 characters: letters, digits and underscores");
  readonly passwordInput = this.page.getByLabel("Password");
  readonly registerButton = this.page.getByRole("button", { name: "Register" });
  readonly errorMessage = this.page.getByRole("alert");

  // Registers with the Invite Code already in its field.
  @step
  async register(account: Pick<RegisterRequest, "username" | "password">): Promise<void> {
    await this.usernameInput.fill(account.username);
    await this.passwordInput.fill(account.password);
    await this.registerButton.click();
  }
}
