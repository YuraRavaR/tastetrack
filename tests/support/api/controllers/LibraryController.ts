import type { LibraryQuery } from "@shared/api";
import type { z } from "zod";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class LibraryController extends BaseController {
  getLibrary(query: z.infer<typeof LibraryQuery>, options?: RequestOptions) {
    return this.requestContext.get(endpoints.library, { ...options, params: query });
  }
}
