#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/publish-check.mjs <posts/xxx.md>');
  process.exit(1);
}

const steps = [
  ['node', ['scripts/lint-rich-post.mjs', target]],
  ['node', ['scripts/qc-table-width.mjs', target]],
  ['node', ['scripts/qc-dom-overflow.mjs', target]],
  ['node', ['scripts/qc-mobile-snapshot.mjs', target]],
];

for (const [cmd, args] of steps) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status || 2);
  }
}

console.log('\n[publish:check] ALL PASS');
