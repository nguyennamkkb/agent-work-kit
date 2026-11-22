#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`\x1b[31merror\x1b[0m ${err.message}`);
    if (process.env.AGENTKIT_DEBUG) console.error(err.stack);
    process.exit(1);
  },
);
