import type { RegisterRequest } from "@shared/api";
import { BasePage } from "./BasePage";

export class RegisterPage extends BasePage {
  readonly path = "/register";
  readonly heading = this.page.getByRole("heading", { name: "Register" });
  readonly inviteCodeInput = this.page.getByLabel("Invite Code");
  readonly usernameInput = this.page.getByLabel("Username");
  readonly usernameHint = this.page.getByText("3–30 characters: letters, digits and underscores");
  readonly passwordInput = this.page.getByLabel("Password");
  readonly registerButton = this.page.getByRole("button", { name: "Register" });
  readonly errorMessage = this.page.getByRole("alert");

  // The page with this Invite Code filled in.
  pathWithInviteCode(inviteCode: string): string {
    return `${this.path}?code=${inviteCode}`;
  }

  async goto(inviteCode?: string): Promise<void> {
    await this.page.goto(inviteCode ? this.pathWithInviteCode(inviteCode) : this.path);
  }

  // Registers with the Invite Code already in its field.
  async register(account: Pick<RegisterRequest, "username" | "password">): Promise<void> {
    await this.usernameInput.fill(account.username);
    await this.passwordInput.fill(account.password);
    await this.registerButton.click();
  }
}
