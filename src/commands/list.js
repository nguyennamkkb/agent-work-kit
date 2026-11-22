import { availableNghe } from '../lib/bundle.js';
import { HARNESSES } from '../adapters/index.js';
import { color } from '../lib/util.js';

export default async function list() {
  console.log(color.bold('Professions'));
  for (const n of availableNghe()) console.log(`  --${n.name.padEnd(10)} ${n.description} (rules ${n.version})`);
  console.log(color.bold('\nHarnesses'));
  for (const a of Object.values(HARNESSES)) console.log(`  --${a.id.padEnd(10)} ${a.label}`);
  console.log(color.dim('  AGENTS.md is always written.'));
  return 0;
}
