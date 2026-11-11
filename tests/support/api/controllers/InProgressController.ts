import type { FinishRequest, InProgressEditRequest, NewInProgressRequest } from "@shared/api";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class InProgressController extends BaseController {
  start(started: NewInProgressRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.inProgress.collection, { ...options, data: started });
  }

  updateStartDate(mediaItemId: number, changes: InProgressEditRequest, options?: RequestOptions) {
    return this.requestContext.patch(endpoints.inProgress.byMediaItem(mediaItemId), {
      ...options,
      data: changes,
    });
  }

  finish(mediaItemId: number, finished: FinishRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.inProgress.finish(mediaItemId), {
      ...options,
      data: finished,
    });
  }

  stop(mediaItemId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.inProgress.byMediaItem(mediaItemId), options);
  }
}
