import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('footer has id site-footer, the copyright line and a link back to the top', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const footer = /<footer\b[^>]*\bid="site-footer"[^>]*>([\s\S]*?)<\/footer>/i.exec(html);
  assert.ok(footer, '<footer id="site-footer"> missing');
  assert.match(footer[1], /© 2026 Linh Studio/, 'copyright line "© 2026 Linh Studio" missing');
  assert.match(footer[1], /href="#hero"/, 'link back to #hero missing');
});
