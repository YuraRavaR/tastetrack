import type { BacklogQuery, PlanRequest } from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class BacklogController extends BaseController {
  getBacklog(query: z.infer<typeof BacklogQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.backlog.collection, { ...options, params: query });
  }

  addBacklogItem(planned: PlanRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.backlog.items, { ...options, data: planned });
  }

  deleteBacklogItem(mediaItemId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.backlog.itemByMediaItem(mediaItemId), options);
  }
}
