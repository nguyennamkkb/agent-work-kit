const TYPE = 'agentkit-desk';
export default function agentkitDesk(pi) {
  const isOmp = Boolean(pi && pi.runtime && pi.extension);
  let root = akRoot(process.cwd());
  let surface = '';
  let reminded = false;
  const safe = (fn) => async (...a) => {
    try {
      return await fn(...a);
    } catch {
      return undefined;
    }
  };

  pi.on('session_start', safe((e, ctx) => {
    root = akRoot(ctx?.cwd || process.cwd()) ?? root;
    surface = akSessionStart(root, !e?.reason || e.reason === 'startup' || e.reason === 'new');
  }));

  pi.on('before_agent_start', safe((e) => {
    if (e?.messageType && e.messageType !== 'user') return undefined;
    reminded = false;
    const parts = [surface, akCapture(root, e?.prompt)].filter(Boolean);
    surface = '';
    if (!parts.length) return undefined;
    return { message: { customType: TYPE, content: parts.join('\n\n'), display: false } };
  }));

  pi.on('tool_call', safe((e) => {
    const reason = akGuard(root, e?.toolName, e?.input);
    return reason ? { block: true, reason } : undefined;
  }));

  pi.on('tool_result', safe((e) => {
    const problems = akAfter(root, e?.toolName, e?.input);
    if (!problems) return undefined;
    return { content: [...(Array.isArray(e.content) ? e.content : []), { type: 'text', text: problems }] };
  }));

  if (!isOmp) {
    pi.on('agent_before_settle', safe((e) => {
      if (reminded) return undefined;
      const reason = akStop(root);
      if (!reason) return undefined;
      reminded = true;
      return { entries: [...(e?.entries ?? []), { type: 'custom_message', customType: TYPE, content: reason, display: false }], continue: true };
    }));
  } else {
    pi.on('agent_end', safe(() => {
      if (reminded) return;
      const reason = akStop(root);
      if (!reason) return;
      reminded = true;
      pi.sendMessage({ customType: TYPE, content: reason, display: false }, { deliverAs: 'followUp', triggerTurn: true });
    }));
  }
}
