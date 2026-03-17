#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

function esc(s = '') {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function stripMd(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '$1（$2）');
}

function stripFrontMatter(mdRaw = '') {
  const normalized = String(mdRaw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  return match ? normalized.slice(match[0].length) : normalized;
}

function parseMd(mdRaw = '') {
  const lines = stripFrontMatter(mdRaw).split('\n');
  const blocks = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('---')) continue;
    if (line.startsWith('@')) continue;

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: stripMd(line.slice(2).trim()) });
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: stripMd(line.slice(3).trim()) });
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: stripMd(line.slice(4).trim()) });
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      blocks.push({ type: 'li', text: stripMd(line.replace(/^[-*+]\s+/, '')) });
      continue;
    }

    blocks.push({ type: 'p', text: stripMd(line) });
  }

  return blocks;
}

function renderWechatHtml(blocks, title, sourceName) {
  const out = [];
  out.push(`<section style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f2329;line-height:1.9;font-size:16px;">`);
  out.push(`<h1 style="font-size:30px;line-height:1.35;margin:0 0 12px;color:#111;">${esc(title)}</h1>`);
  out.push(`<p style="font-size:13px;color:#8c8c8c;margin:0 0 24px;">${esc(sourceName)} · 微信公众号版</p>`);

  let liOpen = false;
  const closeLi = () => {
    if (liOpen) {
      out.push('</ul>');
      liOpen = false;
    }
  };

  for (const b of blocks) {
    if (b.type === 'h1') {
      closeLi();
      out.push(`<h2 style="font-size:24px;margin:28px 0 12px;color:#111;line-height:1.45;">${esc(b.text)}</h2>`);
    } else if (b.type === 'h2') {
      closeLi();
      out.push(`<h3 style="font-size:20px;margin:24px 0 10px;color:#111;line-height:1.5;">${esc(b.text)}</h3>`);
    } else if (b.type === 'h3') {
      closeLi();
      out.push(`<h4 style="font-size:18px;margin:20px 0 8px;color:#333;line-height:1.5;">${esc(b.text)}</h4>`);
    } else if (b.type === 'li') {
      if (!liOpen) {
        out.push('<ul style="padding-left:1.2em;margin:10px 0 16px;">');
        liOpen = true;
      }
      out.push(`<li style="margin:6px 0;">${esc(b.text)}</li>`);
    } else {
      closeLi();
      out.push(`<p style="margin:10px 0;">${esc(b.text)}</p>`);
    }
  }

  closeLi();
  out.push(`<p style="margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:13px;color:#8c8c8c;">如需原版 slides / markdown，可留言“要源稿”。</p>`);
  out.push('</section>');
  return out.join('\n');
}

function renderWechatMd(blocks, title, sourceName) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> ${sourceName} · 微信公众号版`);
  lines.push('');

  for (const b of blocks) {
    if (b.type === 'h1') lines.push(`## ${b.text}`);
    else if (b.type === 'h2') lines.push(`### ${b.text}`);
    else if (b.type === 'h3') lines.push(`#### ${b.text}`);
    else if (b.type === 'li') lines.push(`- ${b.text}`);
    else lines.push(b.text);
    lines.push('');
  }

  lines.push('---');
  lines.push('如需原版 slides / markdown，可留言“要源稿”。');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source;
  if (!source) {
    console.error('Usage: node scripts/generate-wechat-article.js --source <md> [--title <title>] [--out-html <file>] [--out-md <file>]');
    process.exit(1);
  }

  const abs = path.resolve(source);
  if (!fs.existsSync(abs)) {
    console.error('Source not found:', abs);
    process.exit(1);
  }

  const md = stripFrontMatter(fs.readFileSync(abs, 'utf8'));
  const blocks = parseMd(md);
  const h1 = (md.match(/^#\s+(.+)$/m) || [null, path.basename(abs, '.md')])[1];
  const title = args.title || h1;

  const outHtml = path.resolve(args['out-html'] || path.join('export', path.basename(abs, '.md') + '.wechat.html'));
  const outMd = path.resolve(args['out-md'] || path.join('export', path.basename(abs, '.md') + '.wechat.md'));
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.mkdirSync(path.dirname(outMd), { recursive: true });

  const html = renderWechatHtml(blocks, title, 'Jerry Notes');
  const wechatMd = renderWechatMd(blocks, title, 'Jerry Notes');
  fs.writeFileSync(outHtml, html, 'utf8');
  fs.writeFileSync(outMd, wechatMd, 'utf8');

  console.log(JSON.stringify({ ok: true, source: abs, title, html: outHtml, md: outMd }, null, 2));
}

main();
