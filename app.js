let posts = [];
let activeTag = null;
let activeMonth = null;

// 固定标签体系（最多 12 个）
const FIXED_TAGS = [
  'AI战略与转型',
  '组织与管理',
  '研发效能',
  '产品与体验',
  '数据与智能',
  '平台与架构',
  '工程实践',
  '安全与合规',
  '空间智能',
  '行业与场景',
  '项目与交付',
  '报告与盘点',
];

const TAG_ALIAS_MAP = {
  // AI 与战略
  AI专项: 'AI战略与转型',
  AI演讲: 'AI战略与转型',
  组织转型: 'AI战略与转型',
  决策智能: 'AI战略与转型',
  技术趋势: 'AI战略与转型',
  战略分析: 'AI战略与转型',
  AI工程: 'AI战略与转型',
  AI治理: 'AI战略与转型',
  丰图: 'AI战略与转型',

  // 组织与管理
  组织分析: '组织与管理',
  研发管理: '组织与管理',
  项目管理: '组织与管理',
  组织变革: '组织与管理',
  技术文化: '组织与管理',
  组织协作: '组织与管理',
  经营管理: '组织与管理',
  项目治理: '组织与管理',

  // 研发效能
  代码仓盘点: '研发效能',
  代码分析: '研发效能',
  质量体系: '研发效能',

  // 产品与体验
  地图产品: '产品与体验',
  AI体验: '产品与体验',
  场景编排: '产品与体验',
  产品战略: '产品与体验',
  产品运营: '产品与体验',
  方法论: '产品与体验',

  // 数据与智能
  数据工厂: '数据与智能',
  多模态AI: '数据与智能',
  模型应用: '数据与智能',
  数据工程: '数据与智能',
  聚合数据: '数据与智能',
  地图数据: '数据与智能',
  知识图谱: '数据与智能',
  时空数据: '数据与智能',

  // 平台与架构
  开放生态: '平台与架构',
  开放平台: '平台与架构',
  API目录: '平台与架构',
  API设计: '平台与架构',
  系统架构: '平台与架构',

  // 工程实践
  边缘计算: '工程实践',
  性能优化: '工程实践',
  实时计算: '工程实践',
  自动化: '工程实践',

  // 安全与合规
  数据安全: '安全与合规',
  私有化部署: '安全与合规',
  隐私合规: '安全与合规',

  // 空间智能
  地图智能体: '空间智能',
  天枢: '空间智能',

  // 行业与场景
  行业解决方案: '行业与场景',
  业务场景: '行业与场景',
  应用探索: '行业与场景',
  北京: '行业与场景',
  北京经开区: '行业与场景',
  产业服务: '行业与场景',
  情指: '行业与场景',
  顺丰: '行业与场景',
  招商局: '行业与场景',
  方案: '行业与场景',
  软硬件一体: '行业与场景',

  // 项目与交付
  天枢项目: '项目与交付',
  G1: '项目与交付',

  // 报告与盘点
  周报汇报: '报告与盘点',
  数据盘点: '报告与盘点',
  CSV: '报告与盘点',
  Markdown: '报告与盘点',
};

const TAG_RULES = [
  { keys: ['周报', '汇报', '目录', '盘点', 'report', 'summary', 'catalog'], tag: '报告与盘点' },
  { keys: ['repo', '代码仓', '效能', 'commit', '提交'], tag: '研发效能' },
  { keys: ['g1', '天枢', '交付', '项目'], tag: '项目与交付' },
  { keys: ['安全', '合规', '隐私', '私网'], tag: '安全与合规' },
  { keys: ['空间智能'], tag: '空间智能' },
  { keys: ['地图', '体验', '产品'], tag: '产品与体验' },
  { keys: ['平台', 'api', '架构'], tag: '平台与架构' },
  { keys: ['数据', '知识图谱', '多模态'], tag: '数据与智能' },
  { keys: ['组织', '管理', '变革'], tag: '组织与管理' },
  { keys: ['实时', '边缘', '自动化', '工程'], tag: '工程实践' },
  { keys: ['场景', '行业', '招商', '经开区'], tag: '行业与场景' },
  { keys: ['ai', '智能体'], tag: 'AI战略与转型' },
];

function normalizePostTags(post = {}) {
  const normalized = [];
  const sourceTags = Array.isArray(post.tags) ? post.tags : [];

  sourceTags.forEach((tag) => {
    if (FIXED_TAGS.includes(tag)) {
      if (!normalized.includes(tag)) normalized.push(tag);
      return;
    }
    const mapped = TAG_ALIAS_MAP[tag];
    if (mapped && !normalized.includes(mapped)) normalized.push(mapped);
  });

  const hintText = `${post.title || ''} ${post.slug || ''}`.toLowerCase();
  TAG_RULES.forEach(({ keys, tag }) => {
    const matched = keys.some((k) => hintText.includes(String(k).toLowerCase()));
    if (matched && !normalized.includes(tag)) normalized.push(tag);
  });

  if (!normalized.length) normalized.push('报告与盘点');

  // 保持固定顺序，并限制每篇最多 3 个标签
  return FIXED_TAGS.filter((t) => normalized.includes(t)).slice(0, 3);
}

function toTimestamp(value) {
  if (!value) return Number.NaN;
  const input = String(value).trim();
  if (!input) return Number.NaN;
  const normalized = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(input)
    ? input.replace(' ', 'T')
    : input;
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? Number.NaN : t;
}

function postSortTime(post = {}) {
  const candidates = [post.datetime, post.dateTime, post.publishedAt, post.published_at, post.date];
  for (const value of candidates) {
    const t = toTimestamp(value);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function comparePosts(a, b) {
  const ta = postSortTime(a);
  const tb = postSortTime(b);
  if (ta !== tb) return tb - ta;
  return b.slug.localeCompare(a.slug, 'zh-CN');
}

function normalizePosts(raw = []) {
  return (Array.isArray(raw) ? raw : [])
    .map((post) => ({
      ...post,
      tags: normalizePostTags(post),
    }))
    .sort(comparePosts);
}

const postListEl = document.getElementById('post-list');
const tagFilterEl = document.getElementById('tag-filter');
const monthFilterEl = document.getElementById('month-filter');
const resetFilterBtn = document.getElementById('reset-filter');
const filterToggleBtn = document.getElementById('filter-toggle');
const indexPanelEl = document.getElementById('index-panel');
const tagMoreBtn = document.getElementById('tag-more');

const viewer = document.getElementById('viewer');
const contentEl = document.getElementById('post-content');
const backBtn = document.getElementById('back-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const wechatBtn = document.getElementById('wechat-btn');
const summaryBtn = document.getElementById('summary-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const postsSection = document.getElementById('posts');

let currentPost = null;
let isMobileFilterOpen = false;
let showAllMobileTags = false;

function isMobileViewport() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function selectedFilterCount() {
  return Number(Boolean(activeTag)) + Number(Boolean(activeMonth));
}

function syncFilterPanelState() {
  if (!indexPanelEl || !filterToggleBtn) return;

  const count = selectedFilterCount();
  const suffix = count > 0 ? `(${count})` : '';

  if (isMobileViewport()) {
    indexPanelEl.classList.toggle('collapsed-mobile', !isMobileFilterOpen);
    filterToggleBtn.textContent = isMobileFilterOpen ? `收起${suffix}` : `筛选${suffix}`;
    filterToggleBtn.setAttribute('aria-expanded', isMobileFilterOpen ? 'true' : 'false');
  } else {
    indexPanelEl.classList.remove('collapsed-mobile');
    const collapsed = indexPanelEl.classList.contains('collapsed-desktop');
    filterToggleBtn.textContent = collapsed ? `展开${suffix}` : `收起${suffix}`;
    filterToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}

document.getElementById('year').textContent = new Date().getFullYear();

function escapeHtml(s = '') {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toMonth(dateStr = '') {
  return String(dateStr).slice(0, 7);
}

function getAllTags(list) {
  const set = new Set();
  list.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
  // 永远按固定标签顺序展示，保证数量与顺序稳定
  return FIXED_TAGS.filter((tag) => set.has(tag));
}

function getAllMonths(list) {
  const set = new Set();
  list.forEach((p) => {
    const m = toMonth(p.date);
    if (m) set.add(m);
  });
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

function filterPosts() {
  return posts.filter((p) => {
    const hitTag = !activeTag || (p.tags || []).includes(activeTag);
    const hitMonth = !activeMonth || toMonth(p.date) === activeMonth;
    return hitTag && hitMonth;
  });
}

function renderList() {
  const current = filterPosts();

  if (!current.length) {
    postListEl.innerHTML = `<li><div class="post-meta">当前筛选下暂无文章</div></li>`;
    return;
  }

  postListEl.innerHTML = current
    .map((p) => {
      const summary = p.summary ? `<div class="post-summary">${escapeHtml(p.summary)}</div>` : '';
      return `
    <li>
      <a class="post-link" href="#${p.slug}" data-slug="${p.slug}">${p.title}</a>
      ${summary}
      <div class="post-meta">${p.date || ''}</div>
    </li>
  `;
    })
    .join('');
}

function renderFilters() {
  const tags = getAllTags(posts);
  const months = getAllMonths(posts);

  const visibleTags =
    isMobileViewport() && !showAllMobileTags && !activeTag ? tags.slice(0, 6) : tags;

  tagFilterEl.innerHTML = visibleTags
    .map(
      (tag) => `<button class="chip ${activeTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>`,
    )
    .join('');

  if (tagMoreBtn) {
    const shouldShow = isMobileViewport() && tags.length > 6 && !activeTag;
    tagMoreBtn.classList.toggle('hidden', !shouldShow);
    if (shouldShow) {
      tagMoreBtn.textContent = showAllMobileTags ? '收起标签' : '展开更多标签';
    }
  }

  monthFilterEl.innerHTML = [`<option value="">全部月份</option>`]
    .concat(months.map((m) => `<option value="${m}" ${activeMonth === m ? 'selected' : ''}>${m}</option>`))
    .join('');

  syncFilterPanelState();
}

function sanitizeAttr(value = '') {
  return escapeHtml(String(value || '').trim());
}

function parseInline(text = '') {
  let out = escapeHtml(text);

  // markdown image: ![alt](src "title")
  out = out.replace(/!\[(.*?)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_m, alt, src, title) => {
    const safeSrc = String(src || '');
    if (!safeSrc || /^javascript:/i.test(safeSrc)) return '';
    const safeAlt = sanitizeAttr(alt || 'image');
    const safeTitle = sanitizeAttr(title || '');
    const caption = safeTitle || safeAlt;
    return `<figure class="md-figure"><img class="md-image" loading="lazy" decoding="async" src="${safeSrc}" alt="${safeAlt}" ${safeTitle ? `title="${safeTitle}"` : ''} data-lightbox="1"/><figcaption>${caption}</figcaption></figure>`;
  });

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/\[(.*?)\]\(([^\s)]+)\)/g, (_m, text, href) => {
    const safeHref = String(href || '');
    if (/^javascript:/i.test(safeHref)) return text;
    const isExternal = /^https?:\/\//i.test(safeHref);
    if (isExternal) {
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    return `<a href="${safeHref}">${text}</a>`;
  });

  // 允许少量安全内联换行标签（避免把 <br/> 原样显示成文本）
  out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br/>');

  return out;
}

function stripFrontMatter(mdRaw = '') {
  const normalized = mdRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  return match ? normalized.slice(match[0].length) : normalized;
}

function mdToHtml(mdRaw = '') {
  const md = stripFrontMatter(mdRaw);
  const lines = md.split('\n');
  const html = [];

  let inCode = false;
  let codeLang = '';
  let inUl = false;
  let inOl = false;
  let para = [];

  const isTableSep = (line = '') => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const splitTableRow = (line = '') => {
    let row = line.trim();
    if (row.startsWith('|')) row = row.slice(1);
    if (row.endsWith('|')) row = row.slice(0, -1);
    return row.split('|').map((c) => c.trim());
  };

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${parseInline(para.join('<br/>'))}</p>`);
      para = [];
    }
  };

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // custom shortcode block: :::image ... :::
    if (/^\s*:::image\s*$/.test(line)) {
      flushPara();
      closeLists();
      const meta = {};
      i += 1;
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        const m = lines[i].match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(.+)\s*$/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim();
        i += 1;
      }
      const src = String(meta.src || '');
      const alt = escapeHtml(meta.alt || 'image');
      const caption = escapeHtml(meta.caption || meta.alt || '');
      const width = /^\d{2,4}$/.test(String(meta.width || '')) ? Number(meta.width) : null;
      if (src && !/^javascript:/i.test(src)) {
        const style = width ? ` style="max-width:${width}px"` : '';
        html.push(`<figure class="md-figure"${style}><img class="md-image" loading="lazy" decoding="async" src="${src}" alt="${alt}" data-lightbox="1"/>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`);
      }
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushPara();
      closeLists();
      if (!inCode) {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        html.push(`<pre><code class="lang-${escapeHtml(codeLang)}">`);
      } else {
        inCode = false;
        codeLang = '';
        html.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      html.push(escapeHtml(line));
      html.push('\n');
      continue;
    }

    if (!line.trim()) {
      flushPara();
      closeLists();
      continue;
    }

    const imageOnly = line.match(/^!\[(.*?)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (imageOnly) {
      flushPara();
      closeLists();
      const alt = escapeHtml(imageOnly[1] || 'image');
      const src = String(imageOnly[2] || '');
      const ttl = escapeHtml(imageOnly[3] || '');
      if (src && !/^javascript:/i.test(src)) {
        const caption = ttl || alt;
        html.push(`<figure class="md-figure"><img class="md-image" loading="lazy" decoding="async" src="${src}" alt="${alt}" ${ttl ? `title="${ttl}"` : ''} data-lightbox="1"/><figcaption>${caption}</figcaption></figure>`);
      }
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${parseInline(heading[2])}</h${level}>`);
      continue;
    }

    // markdown table support
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      closeLists();

      const headers = splitTableRow(line);
      html.push('<div class="table-wrap"><table class="md-table"><thead><tr>');
      headers.forEach((h) => html.push(`<th>${parseInline(h)}</th>`));
      html.push('</tr></thead><tbody>');

      i += 2; // skip header + separator
      while (i < lines.length) {
        const rowLine = lines[i];
        if (!rowLine || !rowLine.includes('|') || /^\s*$/.test(rowLine)) {
          i -= 1;
          break;
        }
        const cols = splitTableRow(rowLine);
        html.push('<tr>');
        cols.forEach((c) => html.push(`<td>${parseInline(c)}</td>`));
        html.push('</tr>');
        i += 1;
      }
      html.push('</tbody></table></div>');
      continue;
    }

    // allow limited raw HTML blocks (for embedded pdf/slides)
    const raw = line.trim();
    const allowRawHtml = /^(<iframe\b[^>]*><\/iframe>|<iframe\b[^>]*>|<\/iframe>|<div\b[^>]*>|<\/div>|<figure\b[^>]*>|<\/figure>|<figcaption\b[^>]*>|<\/figcaption>|<img\b[^>]*\/?>)$/i;
    if (allowRawHtml.test(raw)) {
      flushPara();
      closeLists();
      html.push(raw);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeLists();
      html.push(`<blockquote><p>${parseInline(quote[1])}</p></blockquote>`);
      continue;
    }

    // 支持缩进列表（例如两级列表："  - item"）
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!inUl) {
        closeLists();
        inUl = true;
        html.push('<ul>');
      }
      html.push(`<li>${parseInline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (!inOl) {
        closeLists();
        inOl = true;
        html.push('<ol>');
      }
      html.push(`<li>${parseInline(ol[1])}</li>`);
      continue;
    }

    para.push(line);
  }

  flushPara();
  closeLists();

  if (inCode) html.push('</code></pre>');

  return html.join('\n');
}

function renderEmbeddedSlideDeck(slug, target) {
  const src = (target.url || `./${slug}.html`) + '?embed=1';
  contentEl.innerHTML = `
    <div class="slide-embed-wrap">
      <iframe class="slide-embed-iframe" src="${src}" title="${target.title || slug}" loading="lazy" scrolling="no"></iframe>
    </div>
  `;
}

function closePost() {
  viewer.classList.add('hidden');
  postsSection.classList.remove('hidden');
  document.body.classList.remove('viewing-post');
  currentPost = null;
}

async function openPost(slug, { updateHistory = true } = {}) {
  const target = posts.find((p) => p.slug === slug);
  if (!target) return;
  currentPost = target;

  if (target.type === 'webslides') {
    const slideUrl = target.url || `./${slug}.html`;
    try {
      const probe = await fetch(slideUrl, { method: 'HEAD' });
      const ct = (probe.headers.get('content-type') || '').toLowerCase();
      if (probe.ok && ct.includes('text/html')) {
        renderEmbeddedSlideDeck(slug, target);
      } else {
        const text = await fetch(`./posts/${slug}.md`).then((r) => r.text());
        contentEl.innerHTML = mdToHtml(text);
      }
    } catch {
      const text = await fetch(`./posts/${slug}.md`).then((r) => r.text());
      contentEl.innerHTML = mdToHtml(text);
    }
  } else {
    const text = await fetch(`./posts/${slug}.md`).then((r) => r.text());
    contentEl.innerHTML = mdToHtml(text);
  }

  viewer.classList.remove('hidden');
  postsSection.classList.add('hidden');
  document.body.classList.add('viewing-post');

  if (updateHistory) {
    history.pushState({ type: 'post', slug }, '', `#${slug}`);
  }
}

postsSection.addEventListener('click', (e) => {
  const el = e.target.closest('a[data-slug]');
  if (!el) return;
  e.preventDefault();
  openPost(el.dataset.slug);
});

if (tagFilterEl) {
  tagFilterEl.addEventListener('click', (e) => {
    const el = e.target.closest('button[data-tag]');
    if (!el) return;
    const tag = el.dataset.tag;
    activeTag = activeTag === tag ? null : tag;
    if (activeTag) showAllMobileTags = true;
    renderFilters();
    renderList();
  });
}

if (tagMoreBtn) {
  tagMoreBtn.addEventListener('click', () => {
    showAllMobileTags = !showAllMobileTags;
    renderFilters();
  });
}

if (monthFilterEl) {
  monthFilterEl.addEventListener('change', () => {
    activeMonth = monthFilterEl.value || null;
    renderFilters();
    renderList();
  });
}

if (resetFilterBtn) {
  resetFilterBtn.addEventListener('click', () => {
    activeTag = null;
    activeMonth = null;
    showAllMobileTags = false;
    renderFilters();
    renderList();
  });
}

if (filterToggleBtn) {
  filterToggleBtn.addEventListener('click', () => {
    if (isMobileViewport()) {
      isMobileFilterOpen = !isMobileFilterOpen;
    } else {
      indexPanelEl?.classList.toggle('collapsed-desktop');
    }
    syncFilterPanelState();
  });
}

window.addEventListener('resize', () => {
  if (!isMobileViewport()) {
    isMobileFilterOpen = false;
  }
  syncFilterPanelState();
  renderFilters();
});

backBtn.addEventListener('click', () => {
  // Stable return-to-list behavior, even after a hard refresh on a #slug URL.
  history.pushState({ type: 'list' }, '', `${location.pathname}${location.search}`);
  closePost();
});

window.addEventListener('popstate', () => {
  const slug = location.hash.replace('#', '');
  if (slug) {
    openPost(slug, { updateHistory: false });
  } else {
    closePost();
  }
});

if (exportPdfBtn) {
  exportPdfBtn.addEventListener('click', () => {
    if (!currentPost) return;
    const slug = currentPost.slug;
    const type = currentPost.type === 'webslides' ? 'slides' : 'note';
    const src = `./posts/${slug}.md`;
    const cmd = `node scripts/export-pdf.js --source "${src}" --mode ${type} --title "${currentPost.title || slug}" --out "export/${slug}.pdf"`;
    alert(`请在项目根目录执行:\n\n${cmd}`);
  });
}

if (wechatBtn) {
  wechatBtn.addEventListener('click', () => {
    if (!currentPost) return;
    const slug = currentPost.slug;
    const src = `./posts/${slug}.md`;
    const cmd = `node scripts/generate-wechat-article.js --source "${src}" --title "${currentPost.title || slug}"`;
    alert(`请在项目根目录执行:\n\n${cmd}`);
  });
}

if (summaryBtn) {
  summaryBtn.addEventListener('click', async () => {
    if (!currentPost) return;
    const slug = currentPost.slug;
    const src = `./posts/${slug}.md`;

    try {
      const text = stripFrontMatter(await fetch(src).then((r) => r.text()));
      const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#') && !s.startsWith('@') && !s.startsWith('---'));

      const bullets = lines
        .slice(0, 30)
        .filter((s) => !s.startsWith('!['))
        .slice(0, 3)
        .map((s, i) => `${i + 1}. ${s.replace(/^[-*+]\s+/, '')}`);

      const output = bullets.length ? bullets.join('\n') : '1. 这篇文章建议补充摘要内容。';
      navigator.clipboard?.writeText(output).catch(() => {});
      alert(`已生成3条摘要（并尝试复制到剪贴板）：\n\n${output}`);
    } catch (e) {
      alert('摘要生成失败，请稍后重试');
    }
  });
}

const THEME_KEY = 'jerry-notes-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function applyTheme(mode) {
  const real = mode === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  document.body.setAttribute('data-theme', real);
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', real === THEME_LIGHT ? '切换到黑夜主题' : '切换到白天主题');
    themeToggleBtn.setAttribute('title', real === THEME_LIGHT ? '切换到黑夜主题' : '切换到白天主题');
    const icon = themeToggleBtn.querySelector('.theme-icon');
    if (icon) icon.textContent = real === THEME_LIGHT ? '🌙' : '☀️';
  }
}

function initTheme() {
  const mode = localStorage.getItem(THEME_KEY) || THEME_DARK;
  applyTheme(mode);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const cur = localStorage.getItem(THEME_KEY) || THEME_DARK;
      const next = cur === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }
}

async function bootstrap() {
  try {
    const data = await fetch('./posts/posts.json').then((r) => r.json());
    posts = normalizePosts(data);
  } catch (e) {
    console.warn('failed to load posts.json, fallback to empty list', e);
    posts = [];
  }

  initTheme();
  isMobileFilterOpen = false;
  syncFilterPanelState();
  renderFilters();
  renderList();

  if (location.hash) {
    openPost(location.hash.replace('#', ''), { updateHistory: false });
  } else {
    history.replaceState({ type: 'list' }, '', location.pathname + location.search);
  }
}

function ensureLightbox() {
  if (document.getElementById('lightbox-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.className = 'lightbox-overlay hidden';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="关闭预览">×</button>
    <img class="lightbox-image" alt="preview" />
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.add('hidden');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

if (viewer) {
  viewer.addEventListener('click', (e) => {
    const img = e.target.closest('.markdown-body img');
    if (!img) return;
    // ignore tiny ui icons if any
    const w = Number(img.naturalWidth || img.clientWidth || 0);
    const h = Number(img.naturalHeight || img.clientHeight || 0);
    if (w < 80 || h < 80) return;

    ensureLightbox();
    const overlay = document.getElementById('lightbox-overlay');
    const big = overlay?.querySelector('.lightbox-image');
    if (!overlay || !big) return;
    big.src = img.getAttribute('src') || '';
    big.alt = img.getAttribute('alt') || 'preview';
    overlay.classList.remove('hidden');
  });
}

bootstrap();
