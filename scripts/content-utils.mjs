import fs from 'fs';
import path from 'path';

const POSTS_DIR = 'posts';
const SKIP_FILES = new Set(['README.md', 'STRUCTURE.md', 'TEMPLATE.md', '_template.md']);

function normalizeLineEndings(input = '') {
  return String(input).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitInlineArray(raw = '') {
  const items = [];
  let current = '';
  let quote = '';

  for (const ch of raw) {
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote ? '' : ch;
      current += ch;
      continue;
    }

    if (ch === ',' && !quote) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) items.push(current.trim());
  return items.map(parseScalar).filter((item) => item !== '');
}

function parseScalar(raw = '') {
  const value = String(raw).trim();
  if (!value) return '';

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  const inlineArray = value.match(/^\[(.*)\]$/);
  if (inlineArray) {
    return splitInlineArray(inlineArray[1]);
  }

  return value;
}

function parseFrontMatterBlock(block = '') {
  const data = {};
  const lines = normalizeLineEndings(block).split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const [, key, restRaw = ''] = match;
    const rest = restRaw.trim();

    if (rest) {
      data[key] = parseScalar(rest);
      continue;
    }

    const items = [];
    let nextIndex = i + 1;
    while (nextIndex < lines.length) {
      const bullet = lines[nextIndex].match(/^\s*-\s+(.*)$/);
      if (!bullet) break;
      items.push(parseScalar(bullet[1]));
      nextIndex += 1;
    }

    if (items.length) {
      data[key] = items;
      i = nextIndex - 1;
    } else {
      data[key] = '';
    }
  }

  return data;
}

export function stripFrontMatter(raw = '') {
  const normalized = normalizeLineEndings(raw);
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  if (!match) {
    return {
      data: {},
      content: normalized,
      hasFrontMatter: false,
    };
  }

  return {
    data: parseFrontMatterBlock(match[1]),
    content: normalized.slice(match[0].length),
    hasFrontMatter: true,
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return false;
}

function firstHeading(markdown = '') {
  const match = normalizeLineEndings(markdown).match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function comparePosts(a, b) {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }

  return a.slug.localeCompare(b.slug, 'zh-CN');
}

function toRecord(post) {
  const record = {
    title: post.title,
    slug: post.slug,
    date: post.date,
    tags: post.tags,
  };

  if (post.type) record.type = post.type;
  if (post.url) record.url = post.url;
  if (post.summary) record.summary = post.summary;

  return record;
}

export function collectPosts(rootDir) {
  const postsDir = path.join(rootDir, POSTS_DIR);
  const files = fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const posts = [];
  const errors = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/i, '');
    const absolutePath = path.join(postsDir, file);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const { data, content, hasFrontMatter } = stripFrontMatter(source);

    if (!hasFrontMatter) {
      continue;
    }

    const draft = pickBoolean(data.draft, data.publish === false ? true : undefined);
    if (draft) continue;

    const title = pickString(data.title, firstHeading(content));
    const date = pickString(data.date);
    const tags = normalizeTags(data.tags);
    const typeValue = pickString(data.type);
    const type = typeValue || undefined;
    const url = pickString(data.url) || (type === 'webslides' ? `./${slug}.html` : undefined);
    const summary = pickString(data.summary) || undefined;
    const fileErrors = [];

    if (!title) {
      fileErrors.push(`${file}: missing title (use front matter title or a first-level heading)`);
    }

    if (!date) {
      fileErrors.push(`${file}: missing date (add front matter date: YYYY-MM-DD)`);
    }

    if (fileErrors.length) {
      errors.push(...fileErrors);
      continue;
    }

    posts.push({
      title,
      slug,
      date,
      tags,
      type,
      url,
      summary,
      sourcePath: absolutePath,
      fileName: file,
      content,
    });
  }

  posts.sort(comparePosts);
  return {
    posts,
    errors,
  };
}

export function postsToJson(posts) {
  return `${JSON.stringify(posts.map(toRecord), null, 2)}\n`;
}

export function writePostsJson(targetFile, posts) {
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, postsToJson(posts), 'utf8');
}
