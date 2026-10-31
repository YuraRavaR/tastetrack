import type { APIRequestContext } from "@playwright/test";
import { AuthController } from "./controllers/AuthController";
import { InviteCodesController } from "./controllers/InviteCodesController";
import { ListsController } from "./controllers/ListsController";

// One client of the API, such as a device or a visitor. Every controller shares `requestContext`,
// and with it the client's session.
export class ApiClient {
  readonly auth: AuthController;
  readonly inviteCodes: InviteCodesController;
  readonly lists: ListsController;

  constructor(requestContext: APIRequestContext) {
    this.auth = new AuthController(requestContext);
    this.inviteCodes = new InviteCodesController(requestContext);
    this.lists = new ListsController(requestContext);
  }
}
