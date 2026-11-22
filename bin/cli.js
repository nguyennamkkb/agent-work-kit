#!/usr/bin/env node
import { main } from '../src/cli.js';
import { selfClean } from '../src/lib/selfclean.js';

const finish = (code) => {
  selfClean(); // run via npx: remove the kit's own npx copy and download cache; the project keeps what it needs
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
