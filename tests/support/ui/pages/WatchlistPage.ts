import { ShareLinkPanel } from "../components/ShareLinkPanel";
import { BasePage } from "./BasePage";

// The User's Watchlist.
export class WatchlistPage extends BasePage {
  path() {
    return "/watchlist";
  }

  readonly shareLinkPanel = new ShareLinkPanel(this.page);
  readonly emptyMessage = this.page.getByText("Your Watchlist is empty.");
}
