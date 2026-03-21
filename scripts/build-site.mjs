import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { collectPosts, writePostsJson } from './content-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');
const sourcePostsJson = path.join(rootDir, 'posts', 'posts.json');

const ROOT_FILE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.png',
  '.svg',
  '.txt',
  '.webp',
  '.xml',
]);

const ROOT_FILE_NAMES = new Set(['CNAME', '_headers', '_redirects']);

function shouldCopyRootFile(fileName) {
  if (fileName === 'package.json' || fileName === 'package-lock.json') return false;
  return ROOT_FILE_NAMES.has(fileName) || ROOT_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function copyRootStaticFiles(targetDistDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'assets') {
        fs.cpSync(path.join(rootDir, entry.name), path.join(targetDistDir, entry.name), { recursive: true });
      }
      continue;
    }

    if (!shouldCopyRootFile(entry.name)) continue;
    fs.copyFileSync(path.join(rootDir, entry.name), path.join(targetDistDir, entry.name));
  }
}

function copyPublishedPosts(targetDistDir, posts) {
  const targetPostsDir = path.join(targetDistDir, 'posts');
  fs.mkdirSync(targetPostsDir, { recursive: true });

  for (const post of posts) {
    fs.copyFileSync(post.sourcePath, path.join(targetPostsDir, post.fileName));
  }

  writePostsJson(path.join(targetPostsDir, 'posts.json'), posts);
}

function removeNoiseFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeNoiseFiles(absolutePath);
      continue;
    }

    if (entry.name === '.DS_Store') {
      fs.rmSync(absolutePath, { force: true });
    }
  }
}

function generateWebslides(targetDistDir, posts) {
  for (const post of posts) {
    if (post.type !== 'webslides') continue;

    const outputFile = path.join(targetDistDir, `${post.slug}.html`);
    execFileSync(
      process.execPath,
      [path.join(rootDir, 'scripts', 'md-to-slides.js'), post.sourcePath, outputFile, post.title],
      { cwd: rootDir, stdio: 'inherit' },
    );
  }
}

function buildOwnerSite(owner, posts) {
  const targetDistDir = path.join(distDir, owner);
  fs.mkdirSync(targetDistDir, { recursive: true });

  copyRootStaticFiles(targetDistDir);
  copyPublishedPosts(targetDistDir, posts);
  generateWebslides(targetDistDir, posts);
  removeNoiseFiles(targetDistDir);
}

const { posts, errors } = collectPosts(rootDir);

if (errors.length) {
  console.error('Content validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

writePostsJson(sourcePostsJson, posts);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const jerryPosts = posts.filter((post) => (post.owner || 'jerry') === 'jerry');
const irenePosts = posts.filter((post) => post.owner === 'irene');

buildOwnerSite('jerry', jerryPosts);
buildOwnerSite('irene', irenePosts);

// Backward compatibility: keep root dist as Jerry site for existing single-project deploy jobs.
for (const entry of fs.readdirSync(path.join(distDir, 'jerry'), { withFileTypes: true })) {
  const src = path.join(distDir, 'jerry', entry.name);
  const dest = path.join(distDir, entry.name);
  if (entry.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log(`Built Jerry posts: ${jerryPosts.length}, Irene posts: ${irenePosts.length} => ${path.relative(rootDir, distDir)}`);
