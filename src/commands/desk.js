import { run } from '../../kit/method/hooks/cli.mjs';
import { rootOf } from './common.js';

/** `agent-work-kit desk [verb …]` — the same command the agent runs (`node .agentkit/desk.mjs`). */
export default async function desk(opts) {
  const root = rootOf(opts);
  run(opts._ ?? [], { cwd: root });
  return 0;
}
