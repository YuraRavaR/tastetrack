import { step } from "../../step";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScopedComponent } from "./ScopedComponent";

// What the Share Link dialog asks before it replaces the link or stops sharing.
export type ShareLinkQuestion = "Make a new link?" | "Stop sharing?";

// Sharing a List, opened from its ⋯ menu: a button that makes a Share Link, then the link to copy,
// or to send through the phone's share sheet where there is one, with ways to replace it or stop
// sharing, each asked about inside the dialog.
export class ShareLinkDialog extends ScopedComponent {
  readonly shareButton = this.root.getByRole("button", { name: "Share", exact: true });
  readonly linkField = this.root.getByRole("textbox", { name: "Share Link" });
  readonly copyButton = this.root.getByRole("button", { name: /^(Copy link|Copied)$/ });
  readonly sendLinkButton = this.root.getByRole("button", { name: "Send link" });
  // Why sharing couldn't change, such as "Couldn't change sharing. Please try again."
  readonly errorMessage = this.root.getByRole("alert");
  readonly newLinkButton = this.root.getByRole("button", { name: "New link" });
  readonly stopSharingButton = this.root.getByRole("button", { name: "Stop sharing" });
  readonly closeButton = this.root.getByRole("button", { name: "Close" });

  // The question, asked in place of the link.
  confirmation(question: ShareLinkQuestion) {
    return new ConfirmDialog(this.root.getByRole("alertdialog", { name: question }));
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
    await this.confirmation("Make a new link?").confirm("Make a new link");
  }

  @step
  async stopSharing(): Promise<void> {
    await this.stopSharingButton.click();
    await this.confirmation("Stop sharing?").confirm("Stop sharing");
  }
}
