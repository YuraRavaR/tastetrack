import type {
  ListEditRequest,
  ListedMediaItemsQuery,
  NewListItemRequest,
  NewListRequest,
} from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class ListsController extends BaseController {
  getLists(options?: RequestOptions) {
    return this.requestContext.get(endpoints.lists.collection, options);
  }

  getListedMediaItems(query: z.infer<typeof ListedMediaItemsQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.lists.mediaItems, { ...options, params: query });
  }

  createList(list: NewListRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.lists.collection, { ...options, data: list });
  }

  getList(listId: number, options?: RequestOptions) {
    return this.requestContext.get(endpoints.lists.byId(listId), options);
  }

  updateList(listId: number, changes: ListEditRequest, options?: RequestOptions) {
    return this.requestContext.patch(endpoints.lists.byId(listId), { ...options, data: changes });
  }

  deleteList(listId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.lists.byId(listId), options);
  }

  addListItem(listId: number, listItem: NewListItemRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.lists.items(listId), { ...options, data: listItem });
  }

  createShareLink(listId: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.lists.shareLink(listId), options);
  }

  regenerateShareLink(listId: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.lists.regenerateShareLink(listId), options);
  }

  revokeShareLink(listId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.lists.shareLink(listId), options);
  }
}
