import { readUserSession } from './feishu-auth.js';

function noStoreHeaders(contentType = 'text/plain; charset=utf-8') {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  };
}

async function fetchStaticAsset(context, pathname, options = {}) {
  if (!context.env?.ASSETS?.fetch) {
    return new Response('Static asset binding is unavailable.', {
      status: 500,
      headers: noStoreHeaders(),
    });
  }

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = pathname;
  assetUrl.search = options.includeSearch ? new URL(context.request.url).search : '';

  const init = {
    method: 'GET',
    headers: new Headers(options.headers || {}),
  };

  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), init));
}

export async function loadPostCatalog(context) {
  const response = await fetchStaticAsset(context, '/posts/posts.json', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`failed_to_load_catalog:${response.status}`);
  }

  return response.json();
}

export function normalizePostSlug(raw = '', extension = '') {
  const value = String(raw).trim();
  if (!value) return '';

  if (extension && value.toLowerCase().endsWith(extension.toLowerCase())) {
    return value.slice(0, -extension.length);
  }

  return value;
}

export function findPostBySlug(posts, slug) {
  return posts.find((post) => post.slug === slug) || null;
}

export function isInternalPost(post) {
  return post?.visibility === 'internal';
}

export async function canAccessPost(context, post) {
  if (!isInternalPost(post)) {
    return true;
  }

  const session = await readUserSession(context.request, context.env);
  return Boolean(session?.user);
}

export function filterCatalogForViewer(posts, isAuthenticated) {
  return posts.filter((post) => isAuthenticated || !isInternalPost(post));
}

export async function isAuthenticatedRequest(context) {
  const session = await readUserSession(context.request, context.env);
  return Boolean(session?.user);
}

export async function proxyStaticPost(context, slug) {
  return fetchStaticAsset(context, `/posts/${slug}.md`);
}

export async function proxyStaticSlide(context, slug) {
  return fetchStaticAsset(context, `/slides/${slug}.html`, { includeSearch: true });
}

export function unauthorizedPostResponse() {
  return new Response('需要登录后查看这篇内部文章。', {
    status: 401,
    headers: noStoreHeaders(),
  });
}

export function unauthorizedSlideResponse(context, slug, title = '内部幻灯片') {
  const loginUrl = `/api/auth/feishu/login?return_to=${encodeURIComponent(`/slides/${slug}.html`)}`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | 需要登录</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e6ecff; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: min(520px, 92vw); border: 1px solid #23304f; border-radius: 18px; background: #121b2e; padding: 28px; }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0 0 12px; line-height: 1.7; color: #b7c4e8; }
    .actions { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
    a { text-decoration: none; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #365081; border-radius: 999px; padding: 10px 16px; color: #fff; background: #214a86; }
    .ghost { background: transparent; border-color: #23304f; color: #b7c4e8; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>这份内容属于内部资料</h1>
      <p>当前幻灯片被标记为内部内容，只有完成飞书登录后才能查看。</p>
      <p>登录成功后会自动回到当前页。</p>
      <div class="actions">
        <a class="btn" href="${loginUrl}" target="_top" rel="noopener noreferrer">使用飞书登录</a>
        <a class="btn ghost" href="/" target="_top" rel="noopener noreferrer">返回首页</a>
      </div>
    </section>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: noStoreHeaders('text/html; charset=utf-8'),
  });
}

export function redirectToSlide(slug, search = '') {
  return new Response(null, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
      Location: `/slides/${slug}.html${search || ''}`,
    },
  });
}
