import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

// What anyone holding a Share Link sees, without a session.
export class SharedListsController extends BaseController {
  getSharedList(token: string, options?: RequestOptions) {
    return this.requestContext.get(endpoints.sharedLists.byToken(token), options);
  }

  getSharedListPage(token: string, options?: RequestOptions) {
    return this.requestContext.get(endpoints.sharedLists.pageByToken(token), options);
  }
}
