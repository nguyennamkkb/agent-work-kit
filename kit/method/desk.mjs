#!/usr/bin/env node
// agent-work-kit — `node .agentkit/desk.mjs <verb>`: the only way to change the desk. Kit-managed: do not edit.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from './hooks/cli.mjs';

// The project this command belongs to: used when it is run from outside any desk (e.g. by absolute path).
// A closed pipe (e.g. `| head`) is not an error worth a stack trace.
process.stdout.on('error', (e) => e.code === 'EPIPE' ? process.exit(0) : null);
const home = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.exitCode = main(process.argv.slice(2), { home });
