export function applyPatch(obj, patch) {
  const out = structuredClone(obj ?? {});
  if (patch.hooks) {
    out.hooks ??= {};
    for (const [event, groups] of Object.entries(patch.hooks)) {
      out.hooks[event] ??= [];
      for (const g of groups) {
        let target = out.hooks[event].find((x) => (x.matcher ?? '') === (g.matcher ?? ''));
        if (!target) {
          target = { ...(g.matcher !== undefined ? { matcher: g.matcher } : {}), hooks: [] };
          out.hooks[event].push(target);
        }
        target.hooks ??= [];
        for (const h of g.hooks) {
          if (!target.hooks.some((x) => x.command === h.command)) target.hooks.push(h);
        }
      }
    }
  }
  if (patch.permissions) {
    out.permissions ??= {};
    for (const [k, list] of Object.entries(patch.permissions)) {
      out.permissions[k] ??= [];
      for (const item of list) if (!out.permissions[k].includes(item)) out.permissions[k].push(item);
    }
  }
  if (patch.mcpServers) {
    out.mcpServers ??= {};
    for (const [name, cfg] of Object.entries(patch.mcpServers)) {
      if (!(name in out.mcpServers)) out.mcpServers[name] = cfg;
    }
  }
  return out;
}

export function revertPatch(obj, patch) {
  const out = structuredClone(obj ?? {});
  if (patch.hooks && out.hooks) {
    const cmds = new Set(Object.values(patch.hooks).flat().flatMap((g) => g.hooks.map((h) => h.command)));
    for (const event of Object.keys(out.hooks)) {
      out.hooks[event] = out.hooks[event]
        .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !cmds.has(h.command)) }))
        .filter((g) => g.hooks.length);
      if (!out.hooks[event].length) delete out.hooks[event];
    }
    if (!Object.keys(out.hooks).length) delete out.hooks;
  }
  if (patch.permissions && out.permissions) {
    for (const [k, list] of Object.entries(patch.permissions)) {
      if (!out.permissions[k]) continue;
      out.permissions[k] = out.permissions[k].filter((x) => !list.includes(x));
      if (!out.permissions[k].length) delete out.permissions[k];
    }
    if (!Object.keys(out.permissions).length) delete out.permissions;
  }
  if (patch.mcpServers && out.mcpServers) {
    for (const [name, cfg] of Object.entries(patch.mcpServers)) {
      if (JSON.stringify(out.mcpServers[name]) === JSON.stringify(cfg)) delete out.mcpServers[name];
    }
    if (!Object.keys(out.mcpServers).length) delete out.mcpServers;
  }
  return out;
}

export function isPatchApplied(obj, patch) {
  return JSON.stringify(applyPatch(obj, patch)) === JSON.stringify(obj ?? {});
}
