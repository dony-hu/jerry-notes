#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// lightweight fallback: static mobile-risk scan (no browser runtime dependency)
const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/qc-mobile-snapshot.mjs <posts/xxx.md>');
  process.exit(1);
}
const p = path.resolve(process.cwd(), file);
if (!fs.existsSync(p)) {
  console.error(`[qc-mobile-snapshot] file not found: ${file}`);
  process.exit(1);
}
const s = fs.readFileSync(p, 'utf8');
const warns = [];

const tableCount = (s.match(/^\|.*\|\s*$/gm) || []).length;
if (tableCount > 24) warns.push(`表格行较多(${tableCount})，建议真机抽查滚动体验`);

const imgCount = (s.match(/!\[[^\]]*\]\([^\)]+\)/g) || []).length + (s.match(/<img\b[^>]*>/g) || []).length;
if (imgCount > 10) warns.push(`图片较多(${imgCount})，建议抽查首屏加载与滚动卡顿`);

const hasIframe = /<iframe\b/i.test(s);
if (hasIframe) warns.push('包含 iframe，建议真机验证滚动与缩放');

console.log('[qc-mobile-snapshot] PASS (static scan)');
warns.forEach((x) => console.log(`- WARN ${x}`));
