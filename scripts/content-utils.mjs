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

function stripMarkdownInline(text = '') {
  return String(text)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
    .replace(/[#>*_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksReadableSummary(text = '') {
  if (!text || text.length < 16) return false;
  if (text.includes('|') || text.includes('<') || text.includes('>')) return false;
  if (text.includes('@part:') || text.includes('@tag:')) return false;

  const clean = text.replace(/\s+/g, '');
  const readableChars = (clean.match(/[\u4e00-\u9fffA-Za-z0-9，。！？；：“”‘’、,.!?;:()（）【】《》\-]/g) || []).length;
  const ratio = readableChars / Math.max(clean.length, 1);
  if (ratio < 0.88) return false;

  // avoid OCR garbage patterns such as sparse symbols or mixed broken fragments
  const hasCJK = /[\u4e00-\u9fff]/.test(text);
  const hasLatinWord = /[A-Za-z]{3,}/.test(text);
  return hasCJK || hasLatinWord;
}

function firstSummary(markdown = '') {
  const lines = normalizeLineEndings(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('>'))
    .filter((line) => !line.startsWith('@'))
    .filter((line) => !line.startsWith('```'))
    .filter((line) => !line.startsWith('!['))
    .filter((line) => !/^\d+\.\s/.test(line))
    .filter((line) => !/^[-*+]\s/.test(line));

  for (const line of lines.slice(0, 24)) {
    const candidate = stripMarkdownInline(line);
    if (!looksReadableSummary(candidate)) continue;
    return candidate.length > 110 ? `${candidate.slice(0, 110)}…` : candidate;
  }

  return '';
}

function fallbackSummary(title = '') {
  const t = String(title || '').trim();
  if (!t) return '这篇文章记录了一个完整主题，建议点开查看正文。';
  if (t.length <= 22) return `${t}：核心观点与关键信息已整理在正文。`;
  return `${t.slice(0, 22)}：核心观点与关键信息已整理在正文。`;
}

function toTimestamp(value) {
  if (!value) return Number.NaN;
  const input = String(value).trim();
  if (!input) return Number.NaN;

  // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" (local time)
  const normalized = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(input)
    ? input.replace(' ', 'T')
    : input;

  const t = Date.parse(normalized);
  return Number.isNaN(t) ? Number.NaN : t;
}

function resolvePostTimestamp(post) {
  const candidates = [
    post.datetime,
    post.dateTime,
    post.publishedAt,
    post.published_at,
    post.date,
  ];

  for (const value of candidates) {
    const t = toTimestamp(value);
    if (!Number.isNaN(t)) return t;
  }

  // Fallback: file modification time to keep same-day new posts in front.
  if (post.sourcePath) {
    try {
      return fs.statSync(post.sourcePath).mtimeMs;
    } catch {
      // ignore
    }
  }

  return 0;
}

function comparePosts(a, b) {
  const ta = resolvePostTimestamp(a);
  const tb = resolvePostTimestamp(b);

  if (ta !== tb) {
    return tb - ta;
  }

  return b.slug.localeCompare(a.slug, 'zh-CN');
}

function toRecord(post) {
  const record = {
    title: post.title,
    slug: post.slug,
    date: post.date,
    tags: post.tags,
  };

  if (post.datetime) record.datetime = post.datetime;
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
    const datetime = pickString(data.datetime, data.dateTime, data.publishedAt, data.published_at);
    const tags = normalizeTags(data.tags);
    const typeValue = pickString(data.type);
    const type = typeValue || undefined;
    const url = pickString(data.url) || (type === 'webslides' ? `./${slug}.html` : undefined);
    const summary = pickString(data.summary, firstSummary(content), fallbackSummary(title)) || undefined;
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
      datetime,
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
