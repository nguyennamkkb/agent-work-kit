import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = () => fs.readFileSync('index.html', 'utf8');

test('page is in Vietnamese and has a title', () => {
  assert.match(html(), /<html[^>]*\blang="vi"/i);
  assert.match(html(), /<title>[^<]+<\/title>/i);
});

test('all required sections exist, in order', () => {
  const ids = ['hero', 'work', 'services', 'about', 'contact'];
  const at = ids.map((id) => html().indexOf(`id="${id}"`));
  for (const [i, p] of at.entries()) assert.ok(p >= 0, `#${ids[i]} missing`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'sections out of order');
});

test('every image has alt text', () => {
  for (const img of html().match(/<img\b[^>]*>/gi) ?? []) assert.match(img, /\balt="[^"]*"/i, img);
});

test('contact uses a mailto link', () => {
  assert.match(html(), /href="mailto:[^"]+"/i);
});

test('no external resources and no motion', () => {
  const page = html().replace(/href="mailto:[^"]*"/g, '');
  assert.doesNotMatch(page, /(src|href)="https?:\/\//i, 'offline page');
  const css = fs.existsSync('assets') ? fs.readdirSync('assets', { recursive: true }).filter((f) => String(f).endsWith('.css')).map((f) => fs.readFileSync(`assets/${f}`, 'utf8')).join('\n') : '';
  assert.doesNotMatch(css + page, /@keyframes|animation-timeline|marquee/i, 'no motion, no marquee');
});
