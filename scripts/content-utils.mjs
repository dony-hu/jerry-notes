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

function normalizeVisibility(value) {
  const raw = pickString(value).toLowerCase();
  if (!raw) return 'public';
  if (raw === 'public' || raw === 'external') return 'public';
  if (raw === 'internal' || raw === 'private') return 'internal';
  return '';
}

const LIKELY_INTERNAL_SLUG_PATTERNS = [
  { pattern: /(?:^|-)daily-plan(?:-|$)/i, reason: 'slug looks like a daily plan' },
  { pattern: /(?:^|-)daily-work-brief(?:-|$)/i, reason: 'slug looks like a work brief' },
  { pattern: /(?:^|-)meeting-minutes(?:-|$)/i, reason: 'slug looks like meeting minutes' },
  { pattern: /(?:^|-)reading-notes(?:-|$)/i, reason: 'slug looks like an internal reading-notes collection' },
  { pattern: /(?:^|-)worklogs?(?:-|$)/i, reason: 'slug looks like a work log' },
  { pattern: /(?:^|-)rd-daily(?:-|$)/i, reason: 'slug looks like an R&D daily report' },
  { pattern: /(?:^|-)learning-handbook(?:-|$)/i, reason: 'slug looks like a learning handbook' },
  { pattern: /(?:^|-)weekly-report(?:-|$)/i, reason: 'slug looks like a weekly report' },
  { pattern: /(?:^|-)special-initiative-report(?:-|$)/i, reason: 'slug looks like an initiative report' },
  { pattern: /(?:^|-)people-work-(?:summary|analysis)(?:-|$)/i, reason: 'slug looks like a people/work analysis' },
  { pattern: /(?:^|-)tianshu-status(?:-|$)/i, reason: 'slug looks like a project status summary' },
  { pattern: /(?:^|-)product-code-analysis(?:-|$)/i, reason: 'slug looks like a code analysis report' },
];

const LIKELY_INTERNAL_TITLE_PATTERNS = [
  { pattern: /工作计划|今日工作计划/, reason: 'title looks like a work plan' },
  { pattern: /工作日志/, reason: 'title looks like a work log' },
  { pattern: /会议纪要/, reason: 'title looks like meeting minutes' },
  { pattern: /学习手册/, reason: 'title looks like an internal handbook' },
  { pattern: /周汇报|周报|日报|月报/, reason: 'title looks like a report' },
  { pattern: /读后感汇总/, reason: 'title looks like a collection of employee sharing notes' },
  { pattern: /交流方案|交流思路/, reason: 'title looks like a customer/internal solution deck' },
  { pattern: /代码分析报告/, reason: 'title looks like an internal analysis report' },
  { pattern: /现状总览/, reason: 'title looks like a project status summary' },
  { pattern: /推进报告/, reason: 'title looks like an initiative progress report' },
  { pattern: /团队 AI 分享|分享建议/, reason: 'title looks like an internal team sharing material' },
  { pattern: /工作分析/, reason: 'title looks like an internal work analysis' },
];

function findLikelyInternalReasons({ slug = '', title = '' }) {
  const reasons = new Set();

  for (const { pattern, reason } of LIKELY_INTERNAL_SLUG_PATTERNS) {
    if (pattern.test(slug)) reasons.add(reason);
  }

  for (const { pattern, reason } of LIKELY_INTERNAL_TITLE_PATTERNS) {
    if (pattern.test(title)) reasons.add(reason);
  }

  return [...reasons];
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
    visibility: post.visibility,
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
    const visibility = normalizeVisibility(data.visibility || data.access || data.audience);
    const url = pickString(data.url) || (type === 'webslides' ? `./slides/${slug}.html` : undefined);
    const summary = pickString(data.summary) || undefined;
    const fileErrors = [];

    if (!title) {
      fileErrors.push(`${file}: missing title (use front matter title or a first-level heading)`);
    }

    if (!date) {
      fileErrors.push(`${file}: missing date (add front matter date: YYYY-MM-DD)`);
    }

    if (!visibility) {
      fileErrors.push(`${file}: invalid visibility (use public/external or internal/private)`);
    }

    if (visibility === 'public') {
      const likelyInternalReasons = findLikelyInternalReasons({ slug, title });
      if (likelyInternalReasons.length) {
        fileErrors.push(
          `${file}: likely internal content is marked public (${likelyInternalReasons.join('; ')}); set visibility: internal`,
        );
      }
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
      visibility,
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
