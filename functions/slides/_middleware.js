import {
  canAccessPost,
  findPostBySlug,
  loadPostCatalog,
  normalizePostSlug,
  unauthorizedSlideResponse,
} from '../_lib/post-access.js';

function extractSlideSlug(pathname = '') {
  const match = String(pathname).match(/^\/slides\/([^/]+)$/);
  if (!match) return '';
  return normalizePostSlug(match[1], '.html');
}

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  const rawName = pathname.split('/').pop() || '';

  if (!rawName || rawName === 'index.html') {
    return context.next();
  }

  const slug = extractSlideSlug(pathname);
  if (!slug) {
    return context.next();
  }

  try {
    const posts = await loadPostCatalog(context);
    const post = findPostBySlug(posts, slug);

    if (!post || post.type !== 'webslides') {
      return context.next();
    }

    if (!(await canAccessPost(context, post))) {
      return unauthorizedSlideResponse(context, slug, post.title);
    }

    return context.next();
  } catch (error) {
    return new Response('Failed to load slide.', { status: 500 });
  }
}
