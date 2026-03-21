const encoder = new TextEncoder();

const SESSION_COOKIE_NAME = 'jn_feishu_session';
const STATE_COOKIE_NAME = 'jn_feishu_oauth_state';
const STATE_COOKIE_MAX_AGE = 600;
const DEFAULT_SESSION_MAX_AGE = 7200;

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodeBase64UrlText(input) {
  return new TextDecoder().decode(fromBase64Url(input));
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getEnvString(env, key) {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function normalizeCookieValue(value = '') {
  return encodeURIComponent(value);
}

function normalizeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function shouldUseSecureCookies(request) {
  const url = new URL(request.url);
  const localHosts = new Set(['localhost', '127.0.0.1']);
  return url.protocol === 'https:' && !localHosts.has(url.hostname);
}

async function signValue(value, secret, purpose) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}:${value}`));
  return toBase64Url(new Uint8Array(signature));
}

async function encodeSignedPayload(payload, secret, purpose) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(body, secret, purpose);
  return `${body}.${signature}`;
}

async function decodeSignedPayload(token, secret, purpose) {
  if (!token || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expectedSignature = await signValue(body, secret, purpose);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    return JSON.parse(decodeBase64UrlText(body));
  } catch {
    return null;
  }
}

function getCookieMap(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  return cookieHeader.split(/;\s*/).reduce((acc, item) => {
    if (!item) return acc;
    const [rawName, ...rawValueParts] = item.split('=');
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValueParts.join('=') || '');
    return acc;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${normalizeCookieValue(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

function buildResponseHeaders(extraHeaders = []) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store');

  for (const [key, value] of extraHeaders) {
    headers.append(key, value);
  }

  return headers;
}

function getSessionLifetime(env, tokenExpiresIn) {
  const configured = Number.parseInt(getEnvString(env, 'AUTH_SESSION_MAX_AGE_SEC'), 10);
  const fallback = Number.isFinite(tokenExpiresIn) && tokenExpiresIn > 0
    ? Math.min(tokenExpiresIn, DEFAULT_SESSION_MAX_AGE)
    : DEFAULT_SESSION_MAX_AGE;

  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(configured, fallback);
  }

  return fallback;
}

export function isFeishuAuthConfigured(env) {
  return Boolean(
    getEnvString(env, 'FEISHU_APP_ID')
    && getEnvString(env, 'FEISHU_APP_SECRET')
    && getEnvString(env, 'AUTH_SESSION_SECRET'),
  );
}

export function getFeishuAuthConfig(request, env) {
  return {
    enabled: isFeishuAuthConfigured(env),
    appId: getEnvString(env, 'FEISHU_APP_ID'),
    appSecret: getEnvString(env, 'FEISHU_APP_SECRET'),
    redirectUri: getEnvString(env, 'FEISHU_REDIRECT_URI') || `${new URL(request.url).origin}/api/auth/feishu/callback`,
    scope: getEnvString(env, 'FEISHU_SCOPE'),
    sessionSecret: getEnvString(env, 'AUTH_SESSION_SECRET'),
    allowedTenantKeys: getEnvString(env, 'FEISHU_ALLOWED_TENANT_KEYS')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function jsonResponse(payload, status = 200, extraHeaders = []) {
  const headers = buildResponseHeaders(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), { status, headers });
}

export function redirectResponse(location, extraHeaders = [], status = 302) {
  const headers = buildResponseHeaders(extraHeaders);
  headers.set('Location', location);
  return new Response(null, { status, headers });
}

export function appendAuthError(returnTo, authError) {
  const safeReturnTo = normalizeReturnTo(returnTo);
  const url = new URL(safeReturnTo, 'https://placeholder.local');
  url.searchParams.set('auth_error', authError);
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function createOauthState(request, env, returnTo) {
  const config = getFeishuAuthConfig(request, env);
  const payload = {
    nonce: crypto.randomUUID().replace(/-/g, ''),
    returnTo: normalizeReturnTo(returnTo),
    exp: nowInSeconds() + STATE_COOKIE_MAX_AGE,
  };

  const token = await encodeSignedPayload(payload, config.sessionSecret, 'feishu_state');
  const cookie = serializeCookie(STATE_COOKIE_NAME, token, {
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });

  return {
    nonce: payload.nonce,
    returnTo: payload.returnTo,
    cookie,
  };
}

export async function readOauthState(request, env) {
  const config = getFeishuAuthConfig(request, env);
  const token = getCookieMap(request)[STATE_COOKIE_NAME];
  if (!token) return null;

  const payload = await decodeSignedPayload(token, config.sessionSecret, 'feishu_state');
  if (!payload || !payload.nonce || !payload.exp || payload.exp < nowInSeconds()) return null;

  return {
    nonce: String(payload.nonce),
    returnTo: normalizeReturnTo(payload.returnTo),
    exp: payload.exp,
  };
}

export function clearOauthStateCookie(request) {
  return serializeCookie(STATE_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });
}

export async function createUserSession(request, env, userInfo, tokenExpiresIn) {
  const config = getFeishuAuthConfig(request, env);
  const now = nowInSeconds();
  const maxAge = getSessionLifetime(env, tokenExpiresIn);
  const payload = {
    iat: now,
    exp: now + maxAge,
    user: {
      name: userInfo.name || userInfo.en_name || '飞书用户',
      avatarUrl: userInfo.avatar_url || '',
      openId: userInfo.open_id || '',
      unionId: userInfo.union_id || '',
      tenantKey: userInfo.tenant_key || '',
    },
  };

  const token = await encodeSignedPayload(payload, config.sessionSecret, 'feishu_session');
  const cookie = serializeCookie(SESSION_COOKIE_NAME, token, {
    maxAge,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });

  return { cookie, session: payload };
}

export async function readUserSession(request, env) {
  const config = getFeishuAuthConfig(request, env);
  const token = getCookieMap(request)[SESSION_COOKIE_NAME];
  if (!token) return null;

  const payload = await decodeSignedPayload(token, config.sessionSecret, 'feishu_session');
  if (!payload || !payload.exp || payload.exp < nowInSeconds() || !payload.user) return null;
  return payload;
}

export function clearUserSessionCookie(request) {
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });
}

export function isTenantAllowed(request, env, tenantKey) {
  const config = getFeishuAuthConfig(request, env);
  if (!config.allowedTenantKeys.length) return true;
  return config.allowedTenantKeys.includes(tenantKey);
}

export async function exchangeCodeForAccessToken(request, env, code) {
  const config = getFeishuAuthConfig(request, env);
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.appId,
      client_secret: config.appSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 0 || !payload.access_token) {
    throw new Error(payload?.error_description || payload?.msg || 'failed_to_exchange_token');
  }

  return payload;
}

export async function fetchCurrentFeishuUser(accessToken) {
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 0 || !payload.data) {
    throw new Error(payload?.msg || 'failed_to_fetch_user');
  }

  return payload.data;
}

export function buildLoginUrl(request, env, stateNonce) {
  const config = getFeishuAuthConfig(request, env);
  const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', stateNonce);

  if (config.scope) {
    url.searchParams.set('scope', config.scope);
  }

  return url.toString();
}

export function getReturnToFromRequest(request) {
  const url = new URL(request.url);
  return normalizeReturnTo(url.searchParams.get('return_to'));
}
