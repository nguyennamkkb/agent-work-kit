import readline from 'node:readline/promises';

export const interactive = () => process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;

export async function ask(question, def = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`${question}${def ? ` [${def}]` : ''}: `)).trim();
    return a || def;
  } finally {
    rl.close();
  }
}

export async function confirm(question, def = true) {
  const a = (await ask(`${question} (${def ? 'Y/n' : 'y/N'})`)).toLowerCase();
  return a ? a.startsWith('y') : def;
}

export async function pick(question, options, preselected = []) {
  console.log(question);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.id}${o.label ? ` — ${o.label}` : ''}`));
  const def = preselected.join(',');
  const a = await ask('Choose (comma-separated numbers or names, empty = none)', def);
  if (!a) return [];
  return [
    ...new Set(
      a
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (/^\d+$/.test(s) ? options[Number(s) - 1]?.id : s))
        .filter((s) => options.some((o) => o.id === s)),
    ),
  ];
}
