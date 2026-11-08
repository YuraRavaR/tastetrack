import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// Sharing one of the User's Lists, opened from its ⋯ menu: a button that makes a Share Link, then
// the link to copy, with ways to replace it or stop sharing, each asked about inside the dialog.
export class ShareLinkDialog extends ScopedComponent {
  readonly shareButton = this.root.getByRole("button", { name: "Share", exact: true });
  readonly linkField = this.root.getByRole("textbox", { name: "Share Link" });
  readonly copyButton = this.root.getByRole("button", { name: /^(Copy link|Copied)$/ });
  readonly newLinkButton = this.root.getByRole("button", { name: "New link" });
  readonly stopSharingButton = this.root.getByRole("button", { name: "Stop sharing" });
  readonly closeButton = this.root.getByRole("button", { name: "Close" });

  // The question asked before the link is replaced or stopped.
  confirmation(question: "Make a new link?" | "Stop sharing?") {
    return this.root.getByRole("alertdialog", { name: question });
  }

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
    await this.confirmation("Make a new link?")
      .getByRole("button", { name: "Make a new link" })
      .click();
  }

  @step
  async stopSharing(): Promise<void> {
    await this.stopSharingButton.click();
    await this.confirmation("Stop sharing?").getByRole("button", { name: "Stop sharing" }).click();
  }
}
