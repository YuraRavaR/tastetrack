import type { AddCatalogItemRequest, CatalogSearchQuery } from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class CatalogController extends BaseController {
  searchCatalog(search: z.infer<typeof CatalogSearchQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.catalog.search, { ...options, params: search });
  }

  addCatalogItem(searchResult: AddCatalogItemRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.catalog.items, { ...options, data: searchResult });
  }
}
