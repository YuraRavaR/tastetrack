import type { TestUser } from "../../users";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class AuthController extends BaseController {
  register(registration: TestUser & { inviteCode: string }, options?: RequestOptions) {
    return this.requestContext.post(endpoints.auth.register, { ...options, data: registration });
  }

  login(credentials: TestUser, options?: RequestOptions) {
    return this.requestContext.post(endpoints.auth.login, { ...options, data: credentials });
  }

  logout(options?: RequestOptions) {
    return this.requestContext.post(endpoints.auth.logout, options);
  }

  getCurrentUser(options?: RequestOptions) {
    return this.requestContext.get(endpoints.auth.currentUser, options);
  }
}
