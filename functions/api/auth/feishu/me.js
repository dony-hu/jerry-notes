import { getFeishuAuthConfig, jsonResponse, readUserSession } from '../../../_lib/feishu-auth.js';

export async function onRequestGet(context) {
  const config = getFeishuAuthConfig(context.request, context.env);
  const session = config.enabled ? await readUserSession(context.request, context.env) : null;

  return jsonResponse({
    enabled: config.enabled,
    authenticated: Boolean(session),
    user: session?.user || null,
    expiresAt: session?.exp || null,
  });
}
