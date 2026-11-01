import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

// Routes that exist only where test hooks are on (local and staging).
export class TestHooksController extends BaseController {
  fillBacklog(username: string, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.backlog(username), {
      ...options,
      data: { count },
    });
  }

  fillList(listId: number, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.listItems(listId), {
      ...options,
      data: { count },
    });
  }
}
