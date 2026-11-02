import { BasePage } from "./BasePage";

// One of the User's Lists.
export class ListPage extends BasePage<[listId: number]> {
  path(listId: number) {
    return `/lists/${listId}`;
  }

  // The List's films, a list named after the List.
  items(listName: string) {
    return this.page.getByRole("list", { name: listName }).getByRole("listitem");
  }
}
