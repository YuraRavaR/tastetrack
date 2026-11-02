import { step } from "../../step";
import { BasePage } from "./BasePage";

// The User's Invite Codes.
export class InvitesPage extends BasePage {
  path() {
    return "/invites";
  }

  readonly generateButton = this.page.getByRole("button", { name: "Generate an Invite Code" });
  readonly activeInviteCodes = this.page
    .getByRole("list", { name: "Active Invite Codes" })
    .getByRole("listitem");

  // The code of the one active Invite Code.
  @step
  async readActiveInviteCode(): Promise<string> {
    return (await this.activeInviteCodes.getByRole("code").textContent()) ?? "";
  }
}
