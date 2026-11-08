import type { APIRequestContext } from "@playwright/test";
import { AuthController } from "./controllers/AuthController";
import { BacklogController } from "./controllers/BacklogController";
import { CatalogController } from "./controllers/CatalogController";
import { InviteCodesController } from "./controllers/InviteCodesController";
import { LibraryController } from "./controllers/LibraryController";
import { ListItemsController } from "./controllers/ListItemsController";
import { ListsController } from "./controllers/ListsController";
import { LogController } from "./controllers/LogController";
import { MeController } from "./controllers/MeController";
import { SharedListsController } from "./controllers/SharedListsController";
import { TestHooksController } from "./controllers/TestHooksController";

// One client of the API, such as a device or a visitor. Every controller shares `requestContext`,
// and with it the client's session.
export class ApiClient {
  readonly auth: AuthController;
  readonly backlog: BacklogController;
  readonly catalog: CatalogController;
  readonly inviteCodes: InviteCodesController;
  readonly library: LibraryController;
  readonly listItems: ListItemsController;
  readonly lists: ListsController;
  readonly log: LogController;
  readonly me: MeController;
  readonly sharedLists: SharedListsController;
  readonly testHooks: TestHooksController;

  constructor(requestContext: APIRequestContext) {
    this.auth = new AuthController(requestContext);
    this.backlog = new BacklogController(requestContext);
    this.catalog = new CatalogController(requestContext);
    this.inviteCodes = new InviteCodesController(requestContext);
    this.library = new LibraryController(requestContext);
    this.listItems = new ListItemsController(requestContext);
    this.lists = new ListsController(requestContext);
    this.log = new LogController(requestContext);
    this.me = new MeController(requestContext);
    this.sharedLists = new SharedListsController(requestContext);
    this.testHooks = new TestHooksController(requestContext);
  }
}
