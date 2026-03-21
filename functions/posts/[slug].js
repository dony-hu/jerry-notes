import {
  canAccessPost,
  findPostBySlug,
  loadPostCatalog,
  normalizePostSlug,
  proxyStaticPost,
  unauthorizedPostResponse,
} from '../_lib/post-access.js';

export async function onRequestGet(context) {
  const slug = normalizePostSlug(context.params.slug, '.md');

  if (!slug) {
    return new Response('Post not found.', { status: 404 });
  }

  try {
    const posts = await loadPostCatalog(context);
    const post = findPostBySlug(posts, slug);

    if (!post) {
      return new Response('Post not found.', { status: 404 });
    }

    if (!(await canAccessPost(context, post))) {
      return unauthorizedPostResponse();
    }

    return proxyStaticPost(context, slug);
  } catch (error) {
    return new Response('Failed to load post.', { status: 500 });
  }
}
