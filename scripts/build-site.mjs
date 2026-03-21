import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { collectPosts, writePostsJson } from './content-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');
const sourcePostsJson = path.join(rootDir, 'posts', 'posts.json');
const distPostsDir = path.join(distDir, 'posts');
const distSlidesDir = path.join(distDir, 'slides');

const ROOT_FILE_NAMES = new Set([
  'CNAME',
  '_headers',
  '_redirects',
  'index.html',
  'app.js',
  'styles.css',
  'slides.css',
  'MachineryAgePage.jpg',
]);

function shouldCopyRootFile(fileName) {
  return ROOT_FILE_NAMES.has(fileName);
}

function copyRootStaticFiles() {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'assets') {
        fs.cpSync(path.join(rootDir, entry.name), path.join(distDir, entry.name), { recursive: true });
      }
      continue;
    }

    if (!shouldCopyRootFile(entry.name)) continue;
    fs.copyFileSync(path.join(rootDir, entry.name), path.join(distDir, entry.name));
  }

}

function copyPublishedPosts(posts) {
  fs.mkdirSync(distPostsDir, { recursive: true });

  for (const post of posts) {
    fs.copyFileSync(post.sourcePath, path.join(distPostsDir, post.fileName));
  }

  writePostsJson(path.join(distPostsDir, 'posts.json'), posts);
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

function generateWebslides(posts) {
  fs.mkdirSync(distSlidesDir, { recursive: true });

  for (const post of posts) {
    if (post.type !== 'webslides') continue;

    const outputFile = path.join(distSlidesDir, `${post.slug}.html`);
    execFileSync(
      process.execPath,
      [path.join(rootDir, 'scripts', 'md-to-slides.js'), post.sourcePath, outputFile, post.title],
      { cwd: rootDir, stdio: 'inherit' },
    );
  }
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

copyRootStaticFiles();
copyPublishedPosts(posts);
generateWebslides(posts);
removeNoiseFiles(distDir);

console.log(`Built ${posts.length} published posts => ${path.relative(rootDir, distDir)}`);
