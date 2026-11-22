// Build check: the page exists and is structurally sound. Exit 1 with the reasons otherwise.
import fs from 'node:fs';

const problems = [];
const html = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : null;
if (!html) problems.push('index.html is missing');
else {
  if (!/<html[^>]*\blang="vi"/i.test(html)) problems.push('<html lang="vi"> is missing');
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> is missing or empty');
  for (const id of ['hero', 'work', 'services', 'about', 'contact']) if (!new RegExp(`id="${id}"`).test(html)) problems.push(`section #${id} is missing`);
  if (/(src|href)="https?:\/\//i.test(html.replace(/href="mailto:[^"]*"/g, ''))) problems.push('external resources are not allowed (offline page)');
}
if (problems.length) {
  console.error('BUILD FAILED\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('BUILD OK');
