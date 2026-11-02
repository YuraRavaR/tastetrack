import { BasePage } from "./BasePage";

// One of the User's Lists.
export class ListPage extends BasePage<[listId: number]> {
  path(listId: number) {
    return `/lists/${listId}`;
  }
}
