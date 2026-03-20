#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/qc-dom-overflow.mjs <posts/xxx.md>');
  process.exit(1);
}
const root = process.cwd();
const p = path.resolve(root, file);
if (!fs.existsSync(p)) {
  console.error(`[qc-dom-overflow] file not found: ${file}`);
  process.exit(1);
}
const text = fs.readFileSync(p, 'utf8');
const lines = text.split(/\r?\n/);
const blockers = [];
const warns = [];

lines.forEach((line, idx) => {
  const n = idx + 1;
  // super long unbroken token is high risk on mobile
  const tokens = line.split(/\s+/).filter(Boolean);
  const hasLong = tokens.some((t) => {
    if (/^https?:\/\//i.test(t)) return false;
    // focus on latin/number heavy tokens that are truly hard to wrap
    const asciiHeavy = /[A-Za-z0-9_\-]{40,}/.test(t);
    return asciiHeavy && t.length >= 90;
  });
  if (hasLong) blockers.push(`L${n}: 存在超长不可断开英文/数字串（>=90）`);

  // risky width attrs
  const widthPx = line.match(/width\s*=\s*"(\d+)"/i);
  if (widthPx && Number(widthPx[1]) > 1200) blockers.push(`L${n}: 固定宽度 ${widthPx[1]}px 过大`);

  const widthPct = line.match(/width\s*=\s*"(\d+)%"/i);
  if (widthPct && Number(widthPct[1]) > 100) blockers.push(`L${n}: 百分比宽度 ${widthPct[1]}% 非法`);

  // iframe missing responsive hints
  if (/<iframe\b/i.test(line) && !/width\s*=\s*"100%"/i.test(line)) {
    warns.push(`L${n}: iframe 未显式 width=\"100%\"`);
  }
});

if (blockers.length) {
  console.error('[qc-dom-overflow] FAIL');
  blockers.forEach((x) => console.error(`- BLOCKER ${x}`));
  warns.forEach((x) => console.error(`- WARN ${x}`));
  process.exit(2);
}

console.log('[qc-dom-overflow] PASS');
warns.forEach((x) => console.log(`- WARN ${x}`));
