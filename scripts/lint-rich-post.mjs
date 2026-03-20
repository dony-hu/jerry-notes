#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/lint-rich-post.mjs <posts/xxx.md>');
  process.exit(1);
}

const root = process.cwd();
const file = path.resolve(root, input);
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const issues = [];

// markdown image
const mdImg = /!\[(.*?)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;
let m;
while ((m = mdImg.exec(text)) !== null) {
  const alt = (m[1] || '').trim();
  const src = (m[2] || '').trim();
  if (!alt) issues.push(`图片缺少 alt: ${src}`);
  if (!src.startsWith('http')) {
    const p = src.startsWith('./assets/') || src.startsWith('assets/')
      ? path.resolve(root, src.replace(/^\.\//, ''))
      : path.resolve(path.dirname(file), src);
    if (!fs.existsSync(p)) issues.push(`图片路径不存在: ${src}`);
  }
}

// html img
const htmlImg = /<img\b[^>]*src="([^"]+)"[^>]*>/g;
while ((m = htmlImg.exec(text)) !== null) {
  const full = m[0];
  const src = m[1].trim();
  const altMatch = full.match(/\balt="([^"]*)"/);
  if (!altMatch || !altMatch[1].trim()) issues.push(`HTML图片缺少 alt: ${src}`);
  if (!src.startsWith('http')) {
    const p = src.startsWith('./assets/') || src.startsWith('assets/')
      ? path.resolve(root, src.replace(/^\.\//, ''))
      : path.resolve(path.dirname(file), src);
    if (!fs.existsSync(p)) issues.push(`HTML图片路径不存在: ${src}`);
  }
}

// shortcode :::image
const lines = text.split(/\r?\n/);
for (let i = 0; i < lines.length; i += 1) {
  if (/^\s*:::image\s*$/.test(lines[i])) {
    const meta = {};
    i += 1;
    while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
      const kv = lines[i].match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(.+)\s*$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
      i += 1;
    }
    if (!meta.src) issues.push(':::image 缺少 src');
    if (!meta.alt) issues.push(`:::image 建议补 alt: ${meta.src || '(unknown)'}`);
    if (meta.src && !meta.src.startsWith('http')) {
      const p = meta.src.startsWith('./assets/') || meta.src.startsWith('assets/')
        ? path.resolve(root, meta.src.replace(/^\.\//, ''))
        : path.resolve(path.dirname(file), meta.src);
      if (!fs.existsSync(p)) issues.push(`:::image 路径不存在: ${meta.src}`);
    }
  }
}

if (issues.length) {
  console.error(`\n[lint-rich-post] Found ${issues.length} issue(s):`);
  issues.forEach((x) => console.error(`- ${x}`));
  process.exit(2);
}

console.log('[lint-rich-post] OK');
