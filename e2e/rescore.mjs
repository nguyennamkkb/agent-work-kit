#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const f of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!r.ctx) {
    console.log(`${path.basename(f)}: saved before rescoring was possible`);
    continue;
  }
  const scn = (await import(path.join(HERE, 'scenarios', r.scenario, 'scenario.mjs'))).default;
  const checks = scn.verify({ ...r.ctx, snaps: r.snaps, asked: r.asked, sessions: r.sessions, freshAnswer: r.freshAnswer });
  console.log(`${r.scenario} · ${r.harness} · ${r.model}: ${checks.filter((c) => c[1]).length}/${checks.length}`);
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? '✅' : '❌'} ${name} — ${String(detail).slice(0, 120)}`);
}
