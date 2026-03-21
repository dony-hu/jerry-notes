import {
  filterCatalogForViewer,
  isAuthenticatedRequest,
  loadPostCatalog,
} from '../_lib/post-access.js';
import { jsonResponse } from '../_lib/feishu-auth.js';

export async function onRequestGet(context) {
  try {
    const [posts, authenticated] = await Promise.all([
      loadPostCatalog(context),
      isAuthenticatedRequest(context),
    ]);

    return jsonResponse(filterCatalogForViewer(posts, authenticated));
  } catch (error) {
    return jsonResponse({ error: 'failed_to_load_posts' }, 500);
  }
}
