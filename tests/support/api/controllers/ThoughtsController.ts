import type { NewThoughtRequest, ThoughtEditRequest } from "@shared/api";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class ThoughtsController extends BaseController {
  createThought(mediaItemId: number, thought: NewThoughtRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.catalog.mediaItemThoughts(mediaItemId), {
      ...options,
      data: thought,
    });
  }

  updateThought(thoughtId: number, changes: ThoughtEditRequest, options?: RequestOptions) {
    return this.requestContext.patch(endpoints.thoughts.byId(thoughtId), {
      ...options,
      data: changes,
    });
  }

  deleteThought(thoughtId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.thoughts.byId(thoughtId), options);
  }
}
