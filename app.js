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
const postsSection = document.getElementById('posts');

let currentPost = null;

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
      <div class="post-meta">${p.date || ''} · ${(p.tags || []).join(' / ')}</div>
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

function mdToHtml(mdRaw = '') {
  const md = mdRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
  const src = (target.url || `./${slug}.html`) + '?embed=1';
  contentEl.innerHTML = `
    <div class="slide-embed-wrap">
      <iframe class="slide-embed-iframe" src="${src}" title="${target.title || slug}" loading="lazy" scrolling="no"></iframe>
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
    const text = await fetch(`./posts/${slug}.md`).then((r) => r.text());
    contentEl.innerHTML = mdToHtml(text);
  }

  viewer.classList.remove('hidden');
  postsSection.classList.add('hidden');
}

postListEl.addEventListener('click', (e) => {
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

async function bootstrap() {
  try {
    const data = await fetch('./posts/posts.json').then((r) => r.json());
    posts = data;
  } catch (e) {
    console.warn('failed to load posts.json, fallback to empty list', e);
    posts = [];
  }

  renderFilters();
  renderList();

  if (location.hash) {
    openPost(location.hash.replace('#', ''));
  }
}

bootstrap();
