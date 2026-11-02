import { step } from "../../step";
import { BaseComponent } from "./BaseComponent";

// Sharing one of the User's Lists, the Watchlist included: a button that makes a Share Link, then
// the link with ways to replace it or stop sharing.
export class ShareLinkPanel extends BaseComponent {
  readonly shareButton = this.page.getByRole("button", { name: "Share" });
  readonly linkField = this.page.getByRole("textbox", { name: "Share Link" });
  readonly newLinkButton = this.page.getByRole("button", { name: "New link" });
  readonly stopSharingButton = this.page.getByRole("button", { name: "Stop sharing" });

  @step
  async share(): Promise<void> {
    await this.shareButton.click();
  }

  @step
  async readLink(): Promise<string> {
    return this.linkField.inputValue();
  }

  // Replaces the link, once confirmed: the old one stops working.
  @step
  async makeNewLink(): Promise<void> {
    await this.newLinkButton.click();
    await this.page
      .getByRole("alertdialog", { name: "Make a new link?" })
      .getByRole("button", { name: "Make a new link" })
      .click();
  }

  @step
  async stopSharing(): Promise<void> {
    await this.stopSharingButton.click();
    await this.page
      .getByRole("alertdialog", { name: "Stop sharing?" })
      .getByRole("button", { name: "Stop sharing" })
      .click();
  }
}
