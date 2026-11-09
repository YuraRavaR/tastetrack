import type { ExternalReference } from "@shared/api";
import { testHooksHeaders } from "../../test-hooks-secret";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

function withSecret(options?: RequestOptions): RequestOptions {
  return { ...options, headers: { ...testHooksHeaders(), ...options?.headers } };
}

// Routes that exist only where test hooks are on (local and staging), for requests with their
// secret.
export class TestHooksController extends BaseController {
  // A User who needs no Invite Code. `passwordIterations` makes a hash below the current target.
  createSeedUser(
    seedUser: { username: string; password: string; passwordIterations?: number },
    options?: RequestOptions,
  ) {
    return this.requestContext.post(endpoints.testHooks.users, {
      ...withSecret(options),
      data: seedUser,
    });
  }

  getPasswordIterations(username: string, options?: RequestOptions) {
    return this.requestContext.get(
      endpoints.testHooks.passwordIterations(username),
      withSecret(options),
    );
  }

  // Resets the User's password as the Operator does. Every session of theirs ends.
  resetPassword(username: string, options?: RequestOptions) {
    return this.requestContext.post(
      endpoints.testHooks.passwordReset(username),
      withSecret(options),
    );
  }

  getInvitedBy(username: string, options?: RequestOptions) {
    return this.requestContext.get(endpoints.testHooks.invitedBy(username), withSecret(options));
  }

  // Of these records, those the database still holds, each kind in id order: the API shows a
  // User's records only to them.
  getStoredRecords(recordIds: Record<string, number[]>, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.records, {
      ...withSecret(options),
      data: recordIds,
    });
  }

  // Takes a Media Item's entry out of the catalog cache, as the cron does once an entry expires.
  evictFromCatalogCache(reference: ExternalReference, options?: RequestOptions) {
    return this.requestContext.delete(
      endpoints.testHooks.catalogCacheEntry(reference),
      withSecret(options),
    );
  }

  fillBacklog(username: string, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.backlog(username), {
      ...withSecret(options),
      data: { count },
    });
  }

  fillManualMediaItems(username: string, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.manualItems(username), {
      ...withSecret(options),
      data: { count },
    });
  }

  fillList(listId: number, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.listItems(listId), {
      ...withSecret(options),
      data: { count },
    });
  }
}
