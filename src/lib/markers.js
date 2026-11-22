export const START = '<!-- agentkit:start -->';
export const END = '<!-- agentkit:end -->';
const NOTE =
  '<!-- Managed by agent-work-kit (`npx github:nguyennamkkb/agent-work-kit update`). Do not edit inside. Project notes go below the end marker; project rules go to .desk/rules.local.md. -->';

export function extractBlock(text) {
  if (text == null) return null;
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s < 0 || e < 0 || e < s) return null;
  let inner = text.slice(s + START.length, e);
  inner = inner.replace(/^\n/, '').replace(/\n$/, '');
  inner = inner.replace(/^<!-- Managed by agent-work-kit[^\n]*-->\n?/, '');
  return { before: text.slice(0, s), inner, after: text.slice(e + END.length) };
}

export function renderBlock(inner) {
  return `${START}\n${NOTE}\n${inner.trim()}\n${END}`;
}

export function upsertBlock(text, inner) {
  const block = renderBlock(inner);
  const cur = extractBlock(text);
  if (cur) return cur.before + block + cur.after;
  if (!text || !text.trim()) return block + '\n';
  return block + '\n\n' + text.replace(/^\n+/, '');
}

export function removeBlock(text) {
  const cur = extractBlock(text);
  if (!cur) return text;
  return (cur.before.replace(/\n+$/, '') + (cur.before.trim() ? '\n\n' : '') + cur.after.replace(/^\n+/, '')).replace(
    /^\n+/,
    '',
  );
}
