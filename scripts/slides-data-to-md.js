#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || 'D:/Code/jerry-notes/ai-transformation-data.js';
const output = process.argv[3] || 'D:/Code/jerry-notes/posts/ai-talking.md';

const txt = fs.readFileSync(path.resolve(input), 'utf8');
const m = txt.match(/window\.AI_TALKING_SLIDES\s*=\s*(\[[\s\S]*\]);?/);
if (!m) {
  console.error('Cannot find AI_TALKING_SLIDES array in', input);
  process.exit(1);
}

const slides = JSON.parse(m[1]);
const lines = [];

if (slides[0]?.title) {
  lines.push(`# ${slides[0].title.replace(/<[^>]+>/g, '')}`);
  lines.push('');
  lines.push('> 这个文件是 AI Talking 的可维护 MD 源稿（用于本地编辑，再生成 webslides）。');
  lines.push('');
  lines.push('> 生成命令：`node scripts/md-to-slides.js posts/ai-talking.md ai-transformation.html "AI Talking"`');
  lines.push('');
}

slides.forEach((s, idx) => {
  lines.push('---');
  lines.push('');
  lines.push(`# ${s.title || `Slide ${idx + 1}`}`);
  lines.push('');
  if (s.tag) lines.push(`@tag: ${s.tag}`);
  if (s.part) lines.push(`@part: ${s.part}`);
  if (s.subtitle) lines.push(`@subtitle: ${String(s.subtitle).replace(/\n/g, ' ')}`);
  if (s.notes) lines.push(`@notes: ${String(s.notes).replace(/\n/g, ' ')}`);
  if (s.emphasis) lines.push(`@emphasis: ${String(s.emphasis).replace(/\n/g, ' ')}`);

  if (Array.isArray(s.buttons)) {
    s.buttons.forEach((b) => {
      lines.push(`@button: ${b.label} | ${b.href} | ${b.variant || 'primary'}`);
    });
  }

  if (Array.isArray(s.bullets) && s.bullets.length) {
    lines.push('');
    s.bullets.forEach((b) => lines.push(`- ${b}`));
  }

  lines.push('');
});

fs.writeFileSync(path.resolve(output), lines.join('\n'), 'utf8');
console.log(`Generated ${slides.length} slides markdown => ${output}`);
