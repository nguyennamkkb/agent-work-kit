import path from 'node:path';
import { readJson, PKG_ROOT } from './lib/util.js';
import { availableProfessions } from './lib/bundle.js';
import { HARNESSES } from './adapters/index.js';
import init from './commands/init.js';
import switchCmd from './commands/switch.js';
import update from './commands/update.js';
import doctor from './commands/doctor.js';
import remove from './commands/remove.js';
import review from './commands/review.js';
import desk from './commands/desk.js';
import list from './commands/list.js';

const COMMANDS = { init, switch: switchCmd, update, doctor, remove, review, desk, list };

const help = () => `agent-work-kit — one desk per project, one profession per desk

Usage
  npx github:nguyennamkkb/agent-work-kit init --<profession>     ${availableProfessions().map((n) => '--' + n.name).join(', ')}
  npx github:nguyennamkkb/agent-work-kit <command> [options]

Commands
  init      Set up the desk and the profession rules (asks if no profession given)
  switch    Change the profession (--designer); the desk stays
  update    Update kit + profession rules, compared rule by rule
  desk      The desk command (same as node .agentkit/desk.mjs): desk status | add | done | … | help
  review    Decide proposals and kit updates in .desk/review/
  doctor    Check the installation
  remove    Uninstall (keeps .desk/ unless --purge-desk)
  list      List professions and harnesses

Options
  --claude --codex --opencode --pi --omp --cursor   harnesses (default: detected, else Claude Code)
  --dir <path>   project directory (default: cwd)
  -y, --yes      no questions        --dry-run   show what would change
  --force        overwrite hand-edited kit files
  review: --approve P-001 | --reject P-001 | --keep U-… | --drop U-…  [--note "…"]
`;

const BOOLEAN = new Set(['force', 'dryRun', 'purgeDesk', 'verbose', 'yes', 'help']);

export function parseArgs(argv, flagNames = []) {
  const bool = new Set([...BOOLEAN, ...flagNames]);
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-y') opts.yes = true;
    else if (a === '-h') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (v !== undefined) opts[key] = v === 'false' ? false : v === 'true' ? true : v;
      else if (!bool.has(key) && argv[i + 1] && !argv[i + 1].startsWith('-')) opts[key] = argv[++i];
      else opts[key] = true;
    } else opts._.push(a);
  }
  return opts;
}

export function pickFlags(opts) {
  const profession = availableProfessions()
    .map((n) => n.name)
    .filter((n) => opts[n] === true);
  if (profession.length > 1) throw new Error(`A desk serves one profession; got ${profession.map((n) => '--' + n).join(' ')}.`);
  const harnesses = Object.keys(HARNESSES).filter((h) => opts[h] === true);
  return { profession: profession[0] ?? null, harnesses };
}

export async function main(argv) {
  if (argv[0] === 'desk') {
    const i = argv.indexOf('--dir');
    const dir = i > 0 ? argv[i + 1] : null;
    const rest = argv.slice(1).filter((_, j) => !(i > 0 && (j + 1 === i || j + 1 === i + 1)));
    const { run } = await import('../kit/method/hooks/cli.mjs');
    run(rest, { cwd: dir ? path.resolve(dir) : process.cwd() });
    return 0;
  }
  const opts = parseArgs(argv, [...availableProfessions().map((n) => n.name), ...Object.keys(HARNESSES)]);
  if (opts.version) {
    console.log(readJson(path.join(PKG_ROOT, 'package.json')).version);
    return 0;
  }
  const cmd = opts._.shift();
  if (!cmd || opts.help || !COMMANDS[cmd]) {
    console.log(help());
    return cmd && !COMMANDS[cmd] ? 1 : 0;
  }
  return COMMANDS[cmd](opts);
}
