import path from 'path';
import { fileURLToPath } from 'url';

import { collectPosts, writePostsJson } from './content-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const targetFile = path.join(rootDir, 'posts', 'posts.json');
const { posts, errors } = collectPosts(rootDir);

if (errors.length) {
  console.error('Content validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

writePostsJson(targetFile, posts);
console.log(`Generated ${posts.length} posts => ${path.relative(rootDir, targetFile)}`);
