import type { ListItemEditRequest } from "@shared/api";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class ListItemsController extends BaseController {
  updateListItem(listItemId: number, changes: ListItemEditRequest, options?: RequestOptions) {
    return this.requestContext.patch(endpoints.listItems.byId(listItemId), {
      ...options,
      data: changes,
    });
  }

  deleteListItem(listItemId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.listItems.byId(listItemId), options);
  }
}
