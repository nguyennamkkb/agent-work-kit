#!/usr/bin/env node
import { main } from '../src/cli.js';
import { selfClean, claim } from '../src/lib/selfclean.js';

claim();

const finish = (code) => {
  selfClean();
  process.exit(code);
};

main(process.argv.slice(2)).then(
  (code) => finish(code ?? 0),
  (err) => {
    console.error(`\x1b[31merror\x1b[0m ${err.message}`);
    if (process.env.AGENTKIT_DEBUG) console.error(err.stack);
    finish(1);
  },
);
