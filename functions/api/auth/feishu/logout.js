import {
  clearUserSessionCookie,
  getReturnToFromRequest,
  redirectResponse,
} from '../../../_lib/feishu-auth.js';

export async function onRequestGet(context) {
  return redirectResponse(getReturnToFromRequest(context.request), [
    ['Set-Cookie', clearUserSessionCookie(context.request)],
  ]);
}
