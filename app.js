import siteConfig from './site.config.mjs';

let posts = [];
let activeTag = null;
let activeMonth = null;

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
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userSessionEl = document.getElementById('user-session');
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const authNoteEl = document.getElementById('auth-note');
const themeIconEl = themeToggleBtn?.querySelector('.theme-icon');

let currentPost = null;
let isMobileFilterOpen = false;
let showAllMobileTags = false;
let pendingAuthMessage = '';
let mermaidLoaderPromise = null;

const MERMAID_SCRIPT_SRC = './assets/vendor/mermaid.min.js?v=202603221255';

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
  return Array.from(set);
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

function escapeAttr(s = '') {
  return escapeHtml(s).replaceAll('\n', ' ').trim();
}

function renderList() {
  const current = filterPosts();

  if (!current.length) {
    postListEl.innerHTML = `<li><div class="post-meta">当前筛选下暂无文章</div></li>`;
    return;
  }

  postListEl.innerHTML = current
    .map(
      (p) => `
    <li class="post-card ${p.visibility === 'internal' ? 'is-internal' : 'is-public'}">
      <div class="post-card-head">
        <span class="post-visibility ${p.visibility === 'internal' ? 'is-internal' : 'is-public'}">
          ${p.visibility === 'internal' ? '内部' : '公开'}
        </span>
        <span class="post-date">${p.date || ''}</span>
      </div>
      <a class="post-link" href="#${p.slug}" data-slug="${p.slug}">${p.title}</a>
      ${p.summary ? `<p class="post-summary">${escapeAttr(p.summary)}</p>` : ''}
    </li>
  `,
    )
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

function parseInline(text = '') {
  let out = escapeHtml(text);

  out = out.replace(/!\[(.*?)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_m, alt, src, title) => {
    const safeSrc = String(src || '');
    if (!safeSrc || /^javascript:/i.test(safeSrc)) return '';
    const safeAlt = escapeHtml(alt || 'image');
    const safeTitle = escapeHtml(title || '');
    const caption = safeTitle || safeAlt;
    return `<figure class="md-figure"><img class="md-image" loading="lazy" decoding="async" src="${safeSrc}" alt="${safeAlt}" ${safeTitle ? `title="${safeTitle}"` : ''} data-lightbox="1"/><figcaption>${caption}</figcaption></figure>`;
  });

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/\[(.*?)\]\(([^\s)]+)\)/g, (_m, textValue, href) => {
    const safeHref = String(href || '');
    if (/^javascript:/i.test(safeHref)) return textValue;
    const isExternal = /^https?:\/\//i.test(safeHref);
    if (isExternal) {
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${textValue}</a>`;
    }
    return `<a href="${safeHref}">${textValue}</a>`;
  });
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
  let codeLines = [];
  let inUl = false;
  let inOl = false;
  let para = [];

  const isTableSep = (line = '') => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const splitTableRow = (line = '') => {
    let row = line.trim();
    if (row.startsWith('|')) row = row.slice(1);
    if (row.endsWith('|')) row = row.slice(0, -1);
    return row.split('|').map((cell) => cell.trim());
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

    if (line.trim().startsWith('```')) {
      flushPara();
      closeLists();
      if (!inCode) {
        inCode = true;
        codeLang = line.trim().slice(3).trim().toLowerCase();
        codeLines = [];
      } else {
        const codeValue = codeLines.join('\n');
        if (codeLang === 'mermaid') {
          html.push(
            `<div class="mermaid-block"><div class="mermaid-diagram" data-mermaid-source="${escapeHtml(encodeURIComponent(codeValue))}"></div></div>`,
          );
        } else {
          html.push(`<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeValue)}</code></pre>`);
        }
        inCode = false;
        codeLang = '';
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushPara();
      closeLists();
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushPara();
      closeLists();
      html.push('<hr/>');
      continue;
    }

    const imageOnly = line.match(/^!\[(.*?)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (imageOnly) {
      flushPara();
      closeLists();
      const alt = escapeHtml(imageOnly[1] || 'image');
      const src = String(imageOnly[2] || '');
      const title = escapeHtml(imageOnly[3] || '');
      if (src && !/^javascript:/i.test(src)) {
        const caption = title || alt;
        html.push(`<figure class="md-figure"><img class="md-image" loading="lazy" decoding="async" src="${src}" alt="${alt}" ${title ? `title="${title}"` : ''} data-lightbox="1"/><figcaption>${caption}</figcaption></figure>`);
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

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      closeLists();

      const headers = splitTableRow(line);
      html.push('<div class="table-wrap"><table class="md-table"><thead><tr>');
      headers.forEach((header) => html.push(`<th>${parseInline(header)}</th>`));
      html.push('</tr></thead><tbody>');

      i += 2;
      while (i < lines.length) {
        const rowLine = lines[i];
        if (!rowLine || !rowLine.includes('|') || /^\s*$/.test(rowLine)) {
          i -= 1;
          break;
        }
        const cols = splitTableRow(rowLine);
        html.push('<tr>');
        cols.forEach((cell) => html.push(`<td>${parseInline(cell)}</td>`));
        html.push('</tr>');
        i += 1;
      }
      html.push('</tbody></table></div>');
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeLists();
      html.push(`<blockquote><p>${parseInline(quote[1])}</p></blockquote>`);
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.*)$/);
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

  if (inCode) {
    const codeValue = codeLines.join('\n');
    if (codeLang === 'mermaid') {
      html.push(
        `<div class="mermaid-block"><div class="mermaid-diagram" data-mermaid-source="${escapeHtml(encodeURIComponent(codeValue))}"></div></div>`,
      );
    } else {
      html.push(`<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeValue)}</code></pre>`);
    }
  }

  return html.join('\n');
}

function getMermaidTheme() {
  return document.body.getAttribute('data-theme') === THEME_LIGHT ? 'neutral' : 'dark';
}

function renderMermaidFallback(target, source) {
  target.classList.add('is-error');
  target.innerHTML = `<pre><code class="lang-mermaid">${escapeHtml(source)}</code></pre>`;
}

function loadMermaidLibrary() {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  if (mermaidLoaderPromise) {
    return mermaidLoaderPromise;
  }

  mermaidLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MERMAID_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      reject(new Error('Mermaid loaded without global object.'));
    };
    script.onerror = () => reject(new Error('Failed to load Mermaid bundle.'));
    document.head.appendChild(script);
  });

  return mermaidLoaderPromise;
}

async function renderMermaidDiagrams(container = contentEl) {
  if (!container?.querySelectorAll) return;

  const diagrams = Array.from(container.querySelectorAll('.mermaid-diagram[data-mermaid-source]'));
  if (!diagrams.length) return;

  let mermaid;
  try {
    mermaid = await loadMermaidLibrary();
  } catch (error) {
    console.warn('failed to load mermaid', error);
    diagrams.forEach((diagramEl) => {
      const source = decodeURIComponent(diagramEl.dataset.mermaidSource || '');
      renderMermaidFallback(diagramEl, source);
    });
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: getMermaidTheme(),
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
    },
  });

  for (let index = 0; index < diagrams.length; index += 1) {
    const diagramEl = diagrams[index];
    const source = decodeURIComponent(diagramEl.dataset.mermaidSource || '');

    if (!source) continue;

    try {
      const renderId = `mermaid-${Date.now()}-${index}`;
      const result = await mermaid.render(renderId, source);
      diagramEl.classList.remove('is-error');
      diagramEl.innerHTML = result.svg;
      if (typeof result.bindFunctions === 'function') {
        result.bindFunctions(diagramEl);
      }
    } catch (error) {
      console.warn('failed to render mermaid diagram', error);
      renderMermaidFallback(diagramEl, source);
    }
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
    if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
      close();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function renderEmbeddedSlideDeck(slug, target) {
  const src = (target.url || `./slides/${slug}.html`) + '?embed=1';
  contentEl.innerHTML = `
    <div class="slide-embed-wrap">
      <iframe class="slide-embed-iframe" src="${src}" title="${target.title || slug}" loading="lazy" scrolling="no"></iframe>
    </div>
  `;
}

function renderProtectedPostMessage() {
  contentEl.innerHTML = `
    <div class="protected-post">
      <h2>这篇内容属于内部资料</h2>
      <p>当前登录态已失效，或你还没有完成飞书登录。</p>
      <p>登录成功后再返回当前页面，就可以继续查看。</p>
      <div class="protected-post-actions">
        <a class="btn" href="${buildAuthUrl('login')}">使用飞书登录</a>
      </div>
    </div>
  `;
}

async function openPost(slug) {
  const target = posts.find((p) => p.slug === slug);
  if (!target) return;
  currentPost = target;

  if (target.type === 'webslides') {
    renderEmbeddedSlideDeck(slug, target);
  } else {
    const response = await fetch(`./posts/${slug}.md`);
    if (response.status === 401) {
      renderProtectedPostMessage();
      viewer.classList.remove('hidden');
      postsSection.classList.add('hidden');
      return;
    }

    const text = await response.text();
    contentEl.innerHTML = mdToHtml(text);
    await renderMermaidDiagrams(contentEl);
  }

  viewer.classList.remove('hidden');
  postsSection.classList.add('hidden');
}

function getCurrentReturnTo() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function buildAuthUrl(action) {
  return `/api/auth/feishu/${action}?return_to=${encodeURIComponent(getCurrentReturnTo())}`;
}

function setAuthNote(message = '') {
  if (!authNoteEl) return;

  authNoteEl.textContent = message;
  authNoteEl.classList.toggle('hidden', !message);
}

function mapAuthError(code) {
  const messages = {
    access_denied: '你取消了飞书授权，本次未登录。',
    invalid_state: '登录状态校验失败，请重新发起飞书登录。',
    login_failed: '飞书登录失败，请检查应用配置后重试。',
    tenant_not_allowed: '当前飞书企业不在允许名单内。',
  };

  return messages[code] || '飞书登录未完成，请稍后再试。';
}

function consumeAuthError() {
  const url = new URL(location.href);
  const authError = url.searchParams.get('auth_error');

  if (!authError) return;

  pendingAuthMessage = mapAuthError(authError);
  url.searchParams.delete('auth_error');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function renderAuthState(authState = {}) {
  if (!loginBtn || !userSessionEl) return;

  const enabled = Boolean(authState.enabled);
  const authenticated = Boolean(authState.authenticated && authState.user);

  loginBtn.classList.toggle('hidden', !enabled || authenticated);
  userSessionEl.classList.toggle('hidden', !enabled || !authenticated);

  if (!enabled) {
    setAuthNote('飞书登录尚未配置。请先在 Cloudflare Pages 中补齐飞书环境变量。');
    return;
  }

  if (!authenticated) {
    setAuthNote(pendingAuthMessage || '登录后可查看内部文章与工作手册。');
    pendingAuthMessage = '';
    return;
  }

  const user = authState.user || {};
  userNameEl.textContent = user.name || '飞书用户';

  if (user.avatarUrl) {
    userAvatarEl.src = user.avatarUrl;
    userAvatarEl.classList.remove('hidden');
  } else {
    userAvatarEl.removeAttribute('src');
    userAvatarEl.classList.add('hidden');
  }

  setAuthNote('');
  pendingAuthMessage = '';
}

async function loadAuthState() {
  consumeAuthError();

  if (!loginBtn || !userSessionEl) return;

  loginBtn.href = buildAuthUrl('login');

  try {
    const response = await fetch('/api/auth/feishu/me', { cache: 'no-store' });
    const authState = await response.json();
    renderAuthState(authState);
  } catch (e) {
    console.warn('failed to load auth state', e);
    setAuthNote('飞书登录状态读取失败，请稍后刷新重试。');
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
  viewer.classList.add('hidden');
  postsSection.classList.remove('hidden');
});

if (viewer) {
  viewer.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-lightbox="1"]');
    if (!img) return;
    ensureLightbox();
    const overlay = document.getElementById('lightbox-overlay');
    const big = overlay?.querySelector('.lightbox-image');
    if (!overlay || !big) return;
    big.src = img.getAttribute('src') || '';
    big.alt = img.getAttribute('alt') || 'preview';
    overlay.classList.remove('hidden');
  });
}

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

if (loginBtn) {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    location.assign(buildAuthUrl('login'));
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    location.assign(buildAuthUrl('logout'));
  });
}

const THEME_KEY = siteConfig.themeStorageKey || 'jerry-notes-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function applyTheme(mode) {
  const real = mode === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  document.body.setAttribute('data-theme', real);
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', real === THEME_LIGHT ? '切换到黑夜主题' : '切换到白天主题');
    themeToggleBtn.setAttribute('title', real === THEME_LIGHT ? '切换到黑夜主题' : '切换到白天主题');
  }
  if (themeIconEl) {
    themeIconEl.textContent = real === THEME_LIGHT ? '🌙' : '☀️';
  }
  void renderMermaidDiagrams(contentEl);
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
    posts = data;
  } catch (e) {
    console.warn('failed to load posts.json, fallback to empty list', e);
    posts = [];
  }

  initTheme();
  await loadAuthState();
  renderFilters();
  renderList();

  if (location.hash) {
    await openPost(location.hash.replace('#', ''));
  }
}

bootstrap();
