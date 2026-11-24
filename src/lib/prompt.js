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

export function parseChoice(input, options) {
  const tokens = input.replace(/[\[\]()]/g, ' ').split(/[\s,;]+/).filter(Boolean);
  const ids = [];
  const unknown = [];
  for (const t of tokens) {
    const id = /^\d+$/.test(t) ? options[Number(t) - 1]?.id : options.find((o) => o.id === t.toLowerCase())?.id;
    if (!id) unknown.push(t);
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, unknown };
}

export async function pick(question, options, preselected = []) {
  console.log(question);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.id}${o.label ? ` — ${o.label}` : ''}`));
  const def = preselected.join(',');
  for (;;) {
    const a = await ask('Choose (numbers or names separated by commas, empty = none)', def);
    if (!a) return [];
    const { ids, unknown } = parseChoice(a, options);
    if (unknown.length) console.log(`Not in the list: ${unknown.join(', ')}`);
    if (ids.length || !unknown.length) return ids;
  }
}
