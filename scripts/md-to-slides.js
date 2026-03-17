#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseInline(text = '') {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/<br\s*\/?>/gi, '<br/>');
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return out;
}

function stripFrontMatter(mdRaw = '') {
  const normalized = String(mdRaw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  return match ? normalized.slice(match[0].length) : normalized;
}

function parseMd(md) {
  const chunks = md.split(/\n---\n/g).map((s) => s.trim()).filter(Boolean);
  const slides = [];

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const slide = {
      title: '',
      subtitle: '',
      tag: '',
      part: '',
      notes: '',
      emphasis: '',
      bullets: [],
      buttons: []
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith('# ')) {
        slide.title = line.slice(2).trim();
        continue;
      }
      if (line.startsWith('## ')) {
        slide.subtitle = line.slice(3).trim();
        continue;
      }

      if (line.startsWith('@tag:')) { slide.tag = line.slice(5).trim(); continue; }
      if (line.startsWith('@part:')) { slide.part = line.slice(6).trim(); continue; }
      if (line.startsWith('@subtitle:')) { slide.subtitle = line.slice(10).trim(); continue; }
      if (line.startsWith('@notes:')) { slide.notes = line.slice(7).trim(); continue; }
      if (line.startsWith('@emphasis:')) { slide.emphasis = line.slice(10).trim(); continue; }
      if (line.startsWith('@button:')) {
        const body = line.slice(8).trim();
        const [label, href, variant] = body.split('|').map((s) => (s || '').trim());
        if (label && href) slide.buttons.push({ label, href, variant: variant || 'primary' });
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        slide.bullets.push(line.replace(/^[-*+]\s+/, ''));
        continue;
      }

      if (!slide.subtitle) {
        slide.subtitle = line;
      } else {
        slide.bullets.push(line);
      }
    }

    if (!slide.title) slide.title = 'Untitled Slide';
    slides.push(slide);
  }

  return slides.map((s, i) => ({ id: i + 1, ...s }));
}

function mapHref(href = '') {
  if (href === '/') return './index.html';
  if (href === '/blackboard') return 'https://show-hub-ft.vercel.app/blackboard';
  return href;
}

function buildHtml({ slides, deckTitle = 'Slides', outputCss = './slides.css' }) {
  const dataJson = JSON.stringify(slides, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(deckTitle)} | Jerry Notes</title>
  <link rel="stylesheet" href="${outputCss}" />
</head>
<body class="ai-transformation-root">
  <div class="ai-deck-shell" id="deckShell">
    <div class="ai-deck-topbar">
      <a href="./index.html" class="back">← 返回 Jerry Notes</a>
      <div class="ai-deck-logo">${escapeHtml(deckTitle)}</div>
      <div class="ai-deck-shortcuts">←/→ 翻页 · Space 下一页 · N 备注 · O 总览 · F 全屏</div>
      <button id="fullscreenBtn" class="slides-fullscreen-btn" type="button">⤢ 全屏</button>
    </div>

    <div id="overview" class="ai-overview-grid hidden"></div>

    <div class="ai-deck-main">
      <div id="slideFrame" class="ai-slide-frame">
        <div class="ai-slide-inner">
          <header class="ai-slide-header">
            <div id="slideTag" class="ai-slide-tag"></div>
            <div class="ai-slide-progress">
              <span id="slideProgressText"></span>
              <div class="ai-slide-progress-bar"><div id="slideProgressFill" class="ai-slide-progress-fill"></div></div>
            </div>
          </header>

          <main id="slideMain" class="ai-slide-main"></main>

          <footer class="ai-slide-footer">
            <div id="slidePart" class="ai-slide-footer-left"></div>
            <div class="ai-slide-footer-center">Press N 查看备注</div>
            <div id="slideTagFooter" class="ai-slide-footer-right"></div>
          </footer>
        </div>
        <aside id="slideNotes" class="ai-slide-notes hidden"></aside>
      </div>
    </div>
  </div>

  <script>
    const slides = ${dataJson};
    let currentIndex = 0;
    let showNotes = false;
    let showOverview = false;

    const elMain = document.getElementById('slideMain');
    const elTag = document.getElementById('slideTag');
    const elTagFooter = document.getElementById('slideTagFooter');
    const elPart = document.getElementById('slidePart');
    const elProgressText = document.getElementById('slideProgressText');
    const elProgressFill = document.getElementById('slideProgressFill');
    const elNotes = document.getElementById('slideNotes');
    const elOverview = document.getElementById('overview');
    const elFullscreenBtn = document.getElementById('fullscreenBtn');
    const elDeckShell = document.getElementById('deckShell');

    function resolveHref(href) {
      if (href === '/') return './index.html';
      if (href === '/blackboard') return 'https://show-hub-ft.vercel.app/blackboard';
      return href;
    }

    function renderOverview() {
      elOverview.innerHTML = slides
        .map((s, i) => '<button class="ai-overview-item ' + (i === currentIndex ? 'ai-overview-item-active' : '') + '" data-i="' + i + '">' +
          '<div class="ai-overview-index">' + (i + 1) + '</div>' +
          '<div class="ai-overview-tag">' + (s.tag || '') + '</div>' +
          '<div class="ai-overview-title">' + (s.title || '') + '</div>' +
          '</button>')
        .join('');

      elOverview.querySelectorAll('button[data-i]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentIndex = Number(btn.dataset.i || 0);
          showOverview = false;
          render();
        });
      });
    }

    function render() {
      const s = slides[currentIndex];
      const total = slides.length;
      if (!s) return;

      const isTitleOnly = !s.bullets?.length && !s.buttons?.length && !s.emphasis;
      elTag.textContent = s.tag || '';
      elTagFooter.textContent = s.tag || '';
      elPart.textContent = s.part || '';
      elProgressText.textContent = (currentIndex + 1) + ' / ' + total;
      elProgressFill.style.width = (((currentIndex + 1) / total) * 100) + '%';

      function renderBullets(items) {
        if (!items?.length) return '';
        let sec = 0;
        let out = '';
        for (const raw of items) {
          const txt = raw || '';
          const isSection = /[:：]\s*$/.test(txt);
          if (isSection) {
            sec += 1;
            const title = txt.replace(/[:：]\s*$/, '');
            out += '<li class="bullet-section"><span class="bullet-index">' + sec + '.</span><strong>' + title + '</strong></li>';
          } else {
            out += '<li class="bullet-sub">' + txt + '</li>';
          }
        }
        return '<ul class="ai-slide-bullets">' + out + '</ul>';
      }

      let html = '<h1 class="ai-slide-title">' + (s.title || '') + '</h1>';
      if (s.subtitle) html += '<h2 class="ai-slide-subtitle">' + s.subtitle + '</h2>';
      if (s.bullets?.length) html += renderBullets(s.bullets);
      if (s.buttons?.length) {
        html += '<div class="ai-slide-buttons">' + s.buttons.map((b) => {
          const cls = 'ai-slide-button ' + (b.variant === 'secondary' ? 'secondary' : 'primary');
          return '<a class="' + cls + '" href="' + resolveHref(b.href) + '" target="_blank" rel="noreferrer">' + b.label + '</a>';
        }).join('') + '</div>';
      }
      if (s.emphasis) html += '<p class="ai-slide-emphasis">' + s.emphasis + '</p>';

      elMain.className = 'ai-slide-main' + (isTitleOnly ? ' ai-slide-main-title-only' : '');
      elMain.innerHTML = html;

      if (showNotes && s.notes) {
        elNotes.classList.remove('hidden');
        elNotes.innerHTML = '<div class="ai-slide-notes-label">Speaker Notes</div><p>' + s.notes + '</p>';
      } else {
        elNotes.classList.add('hidden');
        elNotes.innerHTML = '';
      }

      if (showOverview) {
        elOverview.classList.remove('hidden');
        renderOverview();
      } else {
        elOverview.classList.add('hidden');
      }
    }

    function goNext(){ if(currentIndex < slides.length - 1) currentIndex++; render(); }
    function goPrev(){ if(currentIndex > 0) currentIndex--; render(); }

    function syncFullscreenUi() {
      const isFs = !!document.fullscreenElement;
      if (isFs) {
        elDeckShell.classList.add('is-fullscreen');
        elFullscreenBtn.textContent = '⤓ 退出全屏';
      } else {
        elDeckShell.classList.remove('is-fullscreen');
        elFullscreenBtn.textContent = '⤢ 全屏';
      }
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        if (elDeckShell.requestFullscreen) elDeckShell.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    if (elFullscreenBtn) {
      elFullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    document.addEventListener('fullscreenchange', syncFullscreenUi);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); showNotes = !showNotes; render(); }
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); showOverview = !showOverview; render(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
      if (e.key === 'Escape' && !document.fullscreenElement) { e.preventDefault(); showOverview = !showOverview; render(); }
    });

    let touchStartX = 0;
    window.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    window.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) goNext(); else goPrev();
      }
    }, { passive: true });

    syncFullscreenUi();
    render();
  </script>
</body>
</html>`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/md-to-slides.js <input.md> <output.html> [deckTitle]');
    process.exit(1);
  }
  const [input, output, deckTitleArg] = args;

  const md = stripFrontMatter(fs.readFileSync(path.resolve(input), 'utf8'));
  const slides = parseMd(md).map((s) => ({
    ...s,
    title: parseInline(s.title),
    subtitle: parseInline(s.subtitle || ''),
    notes: parseInline(s.notes || ''),
    emphasis: parseInline(s.emphasis || ''),
    bullets: (s.bullets || []).map(parseInline),
    buttons: (s.buttons || []).map((b) => ({ ...b, href: mapHref(b.href) }))
  }));

  const deckTitle = deckTitleArg || (slides[0]?.title?.replace(/<[^>]+>/g, '') || 'Slides');
  const html = buildHtml({ slides, deckTitle, outputCss: './slides.css?v=202603150835' });
  fs.writeFileSync(path.resolve(output), html, 'utf8');
  console.log(`Generated ${slides.length} slides => ${output}`);
}

main();
