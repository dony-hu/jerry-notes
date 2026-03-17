#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) out[k] = true;
    else {
      out[k] = v;
      i += 1;
    }
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseInline(s = '') {
  let out = escHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function stripFrontMatter(mdRaw = '') {
  const normalized = String(mdRaw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  return match ? normalized.slice(match[0].length) : normalized;
}

function mdToSimpleHtml(mdRaw = '', title = 'Article') {
  const lines = stripFrontMatter(mdRaw).split('\n');
  const html = [];
  let inUl = false;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${parseInline(para.join('<br/>'))}</p>`);
      para = [];
    }
  };
  const closeUl = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      closeUl();
      continue;
    }

    if (line.startsWith('# ')) {
      flushPara();
      closeUl();
      html.push(`<h1>${parseInline(line.slice(2).trim())}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      closeUl();
      html.push(`<h2>${parseInline(line.slice(3).trim())}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      closeUl();
      html.push(`<h3>${parseInline(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      flushPara();
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${parseInline(line.replace(/^[-*+]\s+/, ''))}</li>`);
      continue;
    }

    para.push(line);
  }

  flushPara();
  closeUl();

  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escHtml(title)}</title><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;margin:38px;color:#111;line-height:1.85}
  h1{font-size:30px;margin:0 0 20px}
  h2{font-size:23px;margin:26px 0 12px}
  h3{font-size:19px;margin:20px 0 10px}
  p,li{font-size:15px}
  code{background:#f1f3f5;padding:2px 6px;border-radius:6px}
  a{color:#0d6efd;text-decoration:none}
  ul{padding-left:20px}
</style></head><body>${html.join('\n')}</body></html>`;
}

function pickBrowser() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function run(cmd) {
  cp.execSync(cmd, { stdio: 'inherit' });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source;
  if (!source) {
    console.error('Usage: node scripts/export-pdf.js --source <md|html> [--out <pdf>] [--mode note|slides] [--title <title>]');
    process.exit(1);
  }

  const absSource = path.resolve(source);
  if (!fs.existsSync(absSource)) {
    console.error('Source not found:', absSource);
    process.exit(1);
  }

  const mode = (args.mode || 'note').toLowerCase();
  const outPdf = path.resolve(args.out || path.join('export', path.basename(absSource).replace(/\.(md|html)$/i, '.pdf')));
  ensureDir(path.dirname(outPdf));

  let htmlFile = absSource;
  const ext = path.extname(absSource).toLowerCase();

  if (ext === '.md') {
    ensureDir(path.resolve('tmp'));
    htmlFile = path.resolve('tmp', path.basename(absSource, '.md') + '.print.html');

    if (mode === 'slides') {
      const title = args.title || path.basename(absSource, '.md');
      const generator = path.resolve('scripts', 'md-to-slides.js');
      if (!fs.existsSync(generator)) {
        console.error('Missing generator:', generator);
        process.exit(1);
      }
      run(`node "${generator}" "${absSource}" "${htmlFile}" "${title}"`);
    } else {
      const md = stripFrontMatter(fs.readFileSync(absSource, 'utf8'));
      const t = (md.match(/^#\s+(.+)$/m) || [null, path.basename(absSource, '.md')])[1];
      fs.writeFileSync(htmlFile, mdToSimpleHtml(md, t), 'utf8');
    }
  }

  const browser = pickBrowser();
  if (!browser) {
    console.error('Cannot find Chrome/Edge. Please install one of them.');
    process.exit(1);
  }

  const url = 'file:///' + htmlFile.replace(/\\/g, '/');
  const cmd = `"${browser}" --headless=new --disable-gpu --no-first-run --print-to-pdf="${outPdf}" "${url}"`;
  run(cmd);

  console.log(JSON.stringify({ ok: true, source: absSource, html: htmlFile, output: outPdf, mode }, null, 2));
}

main();
