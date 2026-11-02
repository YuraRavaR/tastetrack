import { step } from "../../step";
import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

class DisplayNameSection extends ScopedComponent {
  readonly input = this.root.getByRole("textbox", { name: "Display Name" });
  readonly saveButton = this.root.getByRole("button", { name: "Save Display Name" });
  readonly status = this.root.getByRole("status");

  // An empty Display Name makes it the Username again.
  @step
  async save(displayName: string): Promise<void> {
    await this.input.fill(displayName);
    await this.saveButton.click();
  }
}

class PasswordSection extends ScopedComponent {
  readonly currentPasswordInput = this.root.getByLabel("Current password");
  readonly newPasswordInput = this.root.getByLabel("New password");
  readonly changeButton = this.root.getByRole("button", { name: "Change password" });
  readonly status = this.root.getByRole("status");
  readonly errorMessage = this.root.getByRole("alert");

  @step
  async change(currentPassword: string, newPassword: string): Promise<void> {
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.changeButton.click();
  }
}

class DeleteUserSection extends ScopedComponent {
  readonly passwordInput = this.root.getByLabel("Your password");
  readonly deleteButton = this.root.getByRole("button", { name: "Delete account" });
  readonly errorMessage = this.root.getByRole("alert");

  @step
  async deleteUser(password: string): Promise<void> {
    await this.passwordInput.fill(password);
    await this.deleteButton.click();
  }
}

export class SettingsPage extends BasePage {
  path() {
    return "/settings";
  }

  readonly heading = this.page.getByRole("heading", { name: "Settings" });
  readonly displayNameSection = new DisplayNameSection(
    this.page.getByRole("region", { name: "Display Name" }),
  );
  readonly passwordSection = new PasswordSection(
    this.page.getByRole("region", { name: "Password" }),
  );
  readonly deleteUserSection = new DeleteUserSection(
    this.page.getByRole("region", { name: "Delete account" }),
  );
}
