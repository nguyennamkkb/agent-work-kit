
// ---- OpenCode (V2 plugin): maps host hooks onto the shared desk hooks.
export default {
  id: 'agentkit-desk',
  async setup(ctx) {
    const root = akRoot(ctx?.location?.directory || process.cwd());
    if (!root) return;
    const started = new Set();
    const reminded = new Set();
    const quiet = async (p) => {
      try {
        return await p;
      } catch {
        return undefined;
      }
    };

    await ctx.session.hook('prompt', async (e) => {
      try {
        const sid = e?.sessionID;
        reminded.delete(sid);
        const parts = [];
        if (!started.has(sid)) {
          started.add(sid);
          parts.push(akSessionStart(root, true, sid)); // a resumed session id (e.g. `opencode run -c`) is not a new session
        }
        parts.push(akCapture(root, e?.prompt?.text));
        const text = parts.filter(Boolean).join('\n\n');
        if (!text) return;
        // Durable per-session instruction entry; if this host build lacks it, carry the context with the prompt.
        let ok = false;
        try {
          await ctx.session.instructions.entry.put({ sessionID: sid, key: 'agentkit-desk', value: text });
          ok = true;
        } catch {
          /* not available in this build */
        }
        if (!ok && e.prompt) e.prompt.text = `${e.prompt.text}\n\n<agentkit-desk>\n${text}\n</agentkit-desk>`;
      } catch {
        /* fail open */
      }
    });

    await ctx.tool.hook('execute.before', (e) => {
      const reason = akGuard(root, e?.tool, e?.input);
      if (reason) throw new Error(reason);
    });

    await ctx.tool.hook('execute.after', async (e) => {
      const problems = akAfter(root, e?.tool, e?.input);
      if (problems && e?.sessionID) await quiet(ctx.session.synthetic({ sessionID: e.sessionID, text: problems }));
    });

    await quiet(
      ctx.session.hook('experimental.idle', async (e) => {
        const sid = e?.sessionID;
        if (!sid || e?.background || reminded.has(sid)) return;
        const reason = akStop(root);
        if (!reason) return;
        reminded.add(sid);
        await quiet(ctx.session.synthetic({ sessionID: sid, text: reason }));
      }),
    );
  },
};
