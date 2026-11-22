import { run } from '../../kit/method/hooks/cli.mjs';
import { rootOf } from './common.js';

export default async function desk(opts) {
  const root = rootOf(opts);
  run(opts._ ?? [], { cwd: root });
  return 0;
}
