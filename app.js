let posts = [];
let activeTag = null;
let activeMonth = null;

const postListEl = document.getElementById('post-list');
const tagFilterEl = document.getElementById('tag-filter');
const monthFilterEl = document.getElementById('month-filter');
const resetFilterBtn = document.getElementById('reset-filter');

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
const userTenantEl = document.getElementById('user-tenant');
const authNoteEl = document.getElementById('auth-note');

let currentPost = null;
let pendingAuthMessage = '';

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

function renderList() {
  const current = filterPosts();

  if (!current.length) {
    postListEl.innerHTML = `<li><div class="post-meta">当前筛选下暂无文章</div></li>`;
    return;
  }

  postListEl.innerHTML = current
    .map(
      (p) => `
    <li>
      <a class="post-link" href="#${p.slug}" data-slug="${p.slug}">${p.title}</a>
      <div class="post-meta">
        <span>${p.date || ''}</span>
        <span class="post-visibility ${p.visibility === 'internal' ? 'is-internal' : 'is-public'}">
          ${p.visibility === 'internal' ? '内部' : '外部'}
        </span>
        <span>${(p.tags || []).join(' / ')}</span>
      </div>
    </li>
  `,
    )
    .join('');
}

function renderFilters() {
  const tags = getAllTags(posts);
  const months = getAllMonths(posts);

  tagFilterEl.innerHTML = tags
    .map(
      (tag) => `<button class="chip ${activeTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>`,
    )
    .join('');

  monthFilterEl.innerHTML = months
    .map(
      (m) => `<button class="chip ${activeMonth === m ? 'active' : ''}" data-month="${m}">${m}</button>`,
    )
    .join('');
}

function parseInline(text = '') {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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

  for (const line of lines) {
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

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${parseInline(heading[2])}</h${level}>`);
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

  if (inCode) html.push('</code></pre>');

  return html.join('\n');
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
    setAuthNote(pendingAuthMessage || '当前仅显示外部文章，登录后可查看内部内容。');
    pendingAuthMessage = '';
    return;
  }

  const user = authState.user || {};
  userNameEl.textContent = user.name || '飞书用户';
  userTenantEl.textContent = user.tenantKey ? `tenant: ${user.tenantKey}` : '已通过飞书登录';

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
    renderFilters();
    renderList();
  });
}

if (monthFilterEl) {
  monthFilterEl.addEventListener('click', (e) => {
    const el = e.target.closest('button[data-month]');
    if (!el) return;
    const month = el.dataset.month;
    activeMonth = activeMonth === month ? null : month;
    renderFilters();
    renderList();
  });
}

if (resetFilterBtn) {
  resetFilterBtn.addEventListener('click', () => {
    activeTag = null;
    activeMonth = null;
    renderFilters();
    renderList();
  });
}

backBtn.addEventListener('click', () => {
  viewer.classList.add('hidden');
  postsSection.classList.remove('hidden');
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

const THEME_KEY = 'jerry-notes-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function applyTheme(mode) {
  const real = mode === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  document.body.setAttribute('data-theme', real);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = real === THEME_LIGHT ? '主题：白天' : '主题：黑夜';
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
    openPost(location.hash.replace('#', ''));
  }
}

bootstrap();
