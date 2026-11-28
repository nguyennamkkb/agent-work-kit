#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
if (process.env.FAKE_PING_LOG) fs.appendFileSync(process.env.FAKE_PING_LOG, JSON.stringify(args) + '\n');
const fail = process.env.FAKE_PING_FAIL;
if (fail && args.join(' ').includes(fail)) {
  process.stderr.write(`provider.no-route: Variant unavailable for ${args.join(' ')}\n`);
  process.exit(1);
}
process.stdout.write('PONG\n');
