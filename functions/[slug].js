import {
  findPostBySlug,
  loadPostCatalog,
  normalizePostSlug,
  redirectToSlide,
} from './_lib/post-access.js';

export async function onRequestGet(context) {
  const slug = normalizePostSlug(context.params.slug, '.html');
  const raw = String(context.params.slug || '');

  if (!slug || !raw.toLowerCase().endsWith('.html')) {
    return context.next();
  }

  try {
    const posts = await loadPostCatalog(context);
    const post = findPostBySlug(posts, slug);

    if (!post || post.type !== 'webslides') {
      return context.next();
    }

    return redirectToSlide(slug, new URL(context.request.url).search);
  } catch (error) {
    return context.next();
  }
}
