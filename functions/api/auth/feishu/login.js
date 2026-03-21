import {
  createOauthState,
  getFeishuAuthConfig,
  getReturnToFromRequest,
  buildLoginUrl,
  jsonResponse,
  redirectResponse,
} from '../../../_lib/feishu-auth.js';

export async function onRequestGet(context) {
  const config = getFeishuAuthConfig(context.request, context.env);
  if (!config.enabled) {
    return jsonResponse(
      {
        enabled: false,
        authenticated: false,
        error: 'feishu_auth_not_configured',
      },
      503,
    );
  }

  const state = await createOauthState(context.request, context.env, getReturnToFromRequest(context.request));
  return redirectResponse(buildLoginUrl(context.request, context.env, state.nonce), [
    ['Set-Cookie', state.cookie],
  ]);
}
