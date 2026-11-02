import { BasePage } from "./BasePage";

// What a Share Link opens, for anyone who has it.
export class SharedPage extends BasePage<[token: string]> {
  path(token: string) {
    return `/s/${token}`;
  }
}
