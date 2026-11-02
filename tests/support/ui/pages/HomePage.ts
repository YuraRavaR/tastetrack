import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  path() {
    return "/";
  }

  readonly logRegion = this.page.getByRole("region", { name: "Latest in your Log" });
  readonly watchlistRegion = this.page.getByRole("region", { name: "Next on your Watchlist" });
}
