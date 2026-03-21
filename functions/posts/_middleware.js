import {
  canAccessPost,
  findPostBySlug,
  loadPostCatalog,
  normalizePostSlug,
  unauthorizedPostResponse,
} from '../_lib/post-access.js';

function extractMarkdownSlug(pathname = '') {
  const match = String(pathname).match(/^\/posts\/([^/]+)$/);
  if (!match) return '';
  return normalizePostSlug(match[1], '.md');
}

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;

  if (!pathname.endsWith('.md')) {
    return context.next();
  }

  const slug = extractMarkdownSlug(pathname);
  if (!slug) {
    return context.next();
  }

  try {
    const posts = await loadPostCatalog(context);
    const post = findPostBySlug(posts, slug);

    if (!post) {
      return context.next();
    }

    if (!(await canAccessPost(context, post))) {
      return unauthorizedPostResponse();
    }

    return context.next();
  } catch (error) {
    return new Response('Failed to load post.', { status: 500 });
  }
}
