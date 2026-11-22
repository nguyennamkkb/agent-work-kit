#!/usr/bin/env node
// agent-work-kit — `node .agentkit/desk.mjs <verb>`: the only way to change the desk. Kit-managed: do not edit.
import { main } from './hooks/cli.mjs';

process.exitCode = main(process.argv.slice(2));
