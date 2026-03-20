#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/qc-table-width.mjs <posts/xxx.md>');
  process.exit(1);
}

const root = process.cwd();
const p = path.resolve(root, file);
if (!fs.existsSync(p)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);

let tableCount = 0;
let issues = [];

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
    tableCount += 1;

    const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cols = row.split('|').map((x) => x.trim());
    if (cols.length >= 6) {
      issues.push(`表${tableCount}: 列数=${cols.length}（建议拆分或减少列，移动端可读性风险）`);
    }

    const tooLong = cols.some((c) => c.length > 36);
    if (tooLong) {
      issues.push(`表${tableCount}: 表头存在超长字段（>36字符），建议简化列名`);
    }
  }
}

if (!tableCount) {
  console.log('[qc-table-width] no table found');
  process.exit(0);
}

if (issues.length) {
  console.error(`[qc-table-width] found ${issues.length} warning(s):`);
  issues.forEach((x) => console.error(`- ${x}`));
  process.exit(2);
}

console.log(`[qc-table-width] OK (${tableCount} table(s))`);
