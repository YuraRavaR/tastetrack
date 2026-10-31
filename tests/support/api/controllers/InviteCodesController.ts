import { endpoints } from "../endpoints";
import { BaseController, type RequestOptions } from "./BaseController";

export class InviteCodesController extends BaseController {
  issueInviteCode(options?: RequestOptions) {
    return this.requestContext.post(endpoints.inviteCodes, options);
  }

  listActiveInviteCodes(options?: RequestOptions) {
    return this.requestContext.get(endpoints.inviteCodes, options);
  }
}
