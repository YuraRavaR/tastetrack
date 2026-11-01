import type { DisplayNameRequest, NewPasswordRequest, PasswordChangeRequest } from "@shared/api";
import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class MeController extends BaseController {
  updateDisplayName(displayName: DisplayNameRequest, options?: RequestOptions) {
    return this.requestContext.put(endpoints.me.displayName, { ...options, data: displayName });
  }

  changePassword(passwords: PasswordChangeRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.me.password, { ...options, data: passwords });
  }

  // Replaces a Temporary Password, which `changePassword` refuses.
  setNewPassword(newPassword: NewPasswordRequest, options?: RequestOptions) {
    return this.requestContext.post(endpoints.me.newPassword, { ...options, data: newPassword });
  }
}
