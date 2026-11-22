import { renderSurface, lintDesk, readState } from '../../kit/method/hooks/_lib.mjs';
import { color } from '../lib/util.js';
import { rootOf } from './common.js';

/** Show the desk surface (read-only; does not count a session). */
export default async function desk(opts) {
  const root = rootOf(opts);
  console.log(renderSurface(root, { session: readState(root) }));
  const errors = lintDesk(root);
  console.log(errors.length ? color.red(`\n${errors.length} desk problem(s)`) : color.green('\nDesk is in order.'));
  return errors.length ? 1 : 0;
}
