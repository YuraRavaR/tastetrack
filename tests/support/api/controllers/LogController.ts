import type { LogEntryEditRequest, NewLogEntryRequest } from "@shared/api";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class LogController extends BaseController {
  getLogEntries(options?: RequestOptions) {
    return this.requestContext.get(endpoints.logEntries.collection, options);
  }

  createLogEntry(logEntry: NewLogEntryRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.logEntries.collection, {
      ...options,
      data: logEntry,
    });
  }

  updateLogEntry(logEntryId: number, changes: LogEntryEditRequest, options?: RequestOptions) {
    return this.requestContext.patch(endpoints.logEntries.byId(logEntryId), {
      ...options,
      data: changes,
    });
  }

  deleteLogEntry(logEntryId: number, options?: RequestOptions) {
    return this.requestContext.delete(endpoints.logEntries.byId(logEntryId), options);
  }
}
