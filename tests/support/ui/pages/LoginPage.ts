import type { LoginRequest } from "@shared/api";
import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly path = "/login";
  readonly heading = this.page.getByRole("heading", { name: "Log in" });
  readonly usernameInput = this.page.getByLabel("Username");
  readonly passwordInput = this.page.getByLabel("Password");
  readonly logInButton = this.page.getByRole("button", { name: "Log in" });
  readonly errorMessage = this.page.getByRole("alert");
  readonly statusMessage = this.page.getByRole("status");
  readonly registerLink = this.page.getByRole("link", { name: "Register" });

  async logIn(credentials: LoginRequest): Promise<void> {
    await this.usernameInput.fill(credentials.username);
    await this.passwordInput.fill(credentials.password);
    await this.logInButton.click();
  }
}
