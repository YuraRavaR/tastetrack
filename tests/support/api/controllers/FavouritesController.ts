import type { FavouritesEditRequest, FavouritesQuery, LikeRequest } from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class FavouritesController extends BaseController {
  getFavourites(query: z.infer<typeof FavouritesQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.favourites.collection, { ...options, params: query });
  }

  updateFavourites(
    query: z.infer<typeof FavouritesQuery>,
    changes: FavouritesEditRequest,
    options?: RequestOptions,
  ) {
    return this.requestContext.patch(endpoints.favourites.collection, {
      ...options,
      params: query,
      data: changes,
    });
  }

  like(like: LikeRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.favourites.items, { ...options, data: like });
  }

  unlike(mediaItemId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.favourites.itemByMediaItem(mediaItemId), options);
  }
}
