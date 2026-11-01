import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

// Routes that exist only where test hooks are on (local and staging).
export class TestHooksController extends BaseController {
  // Resets the User's password as the Operator does. Every session of theirs ends.
  resetPassword(username: string, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.passwordReset(username), options);
  }

  getInvitedBy(username: string, options?: RequestOptions) {
    return this.requestContext.get(endpoints.testHooks.invitedBy(username), options);
  }

  // Of these records, those the database still holds, each kind in id order: the API shows a
  // User's records only to them.
  getStoredRecords(recordIds: Record<string, number[]>, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.records, { ...options, data: recordIds });
  }

  // Takes a film out of the TMDB cache, as the cron does once an entry expires.
  evictFromTmdbCache(tmdbId: string, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.testHooks.tmdbCacheFilm(tmdbId), options);
  }

  fillBacklog(username: string, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.backlog(username), {
      ...options,
      data: { count },
    });
  }

  fillManualMediaItems(username: string, count: number, options?: RequestOptions) {
    return this.requestContext.post(endpoints.testHooks.manualItems(username), {
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
