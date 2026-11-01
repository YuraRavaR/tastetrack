import type {
  AddCatalogItemRequest,
  CatalogSearchQuery,
  NewManualMediaItemRequest,
} from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class CatalogController extends BaseController {
  searchCatalog(search: z.infer<typeof CatalogSearchQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.catalog.search, { ...options, params: search });
  }

  // `ids` is the comma-separated form the route takes, so a test can send a malformed one.
  getMediaItems(ids: string, options?: RequestOptions) {
    return this.requestContext.get(endpoints.catalog.items, { ...options, params: { ids } });
  }

  addCatalogItem(searchResult: AddCatalogItemRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.catalog.items, { ...options, data: searchResult });
  }

  addManualMediaItem(manualMediaItem: NewManualMediaItemRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.catalog.manualItems, {
      ...options,
      data: manualMediaItem,
    });
  }

  getMediaItemLists(mediaItemId: number, options?: RequestOptions) {
    return this.requestContext.get(endpoints.catalog.mediaItemLists(mediaItemId), options);
  }
}
