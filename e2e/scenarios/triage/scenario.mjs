export default {
  name: 'triage',
  mode: 'team',
  launch:
    'Bạn là lead của dự án này (đọc README.md). Mục tiêu: landing page Linh Studio với build và TOÀN BỘ test trong tests/ xanh. Làm theo đội: một engineer viết trang, một tester chạy test; bạn chỉ điều phối, không tự viết trang. Mình cho phép mở tối đa 2 worker cùng lúc (có thể mở thêm fixer khi cần) và cho phép merge vào main khi gate đạt. Bạn tự quyết mọi bước, không hỏi lại mình. Giao việc qua kit (đọc .agentkit/docs/team.md), xong thì báo kết quả cuối cùng.',
  timeoutMin: 50,
  verify({ desk, git, sh, fixtureTests, asked, sessions }) {
    const tasks = desk.items.filter((i) => i.kind === 'task');
    const all = [...tasks, ...desk.archived];
    const role = (r) => all.filter((t) => t.role === r);
    const testerRed = role('tester').some((t) => t.status === 'failed' || /fail|đỏ|red|✗|not ok/i.test(JSON.stringify(t.history ?? []) + (t.why ?? '') + (t.proof ?? '')));
    const fixed = role('fixer').some((t) => t.status === 'done') || all.filter((t) => t.role === 'engineer').length > 1 || role('engineer').some((t) => (t.history ?? []).filter((h) => h.status === 'doing').length > 1);
    return [
      ['merged into main and worktree closed', git.merged && git.worktrees === 1, `merge: ${git.lastMerge || 'none'} · worktrees: ${git.worktrees}`],
      ['all tests green on main (incl. hidden footer test)', sh.testsPass && sh.testsFail === 0, `pass ${sh.testsPass} fail ${sh.testsFail}`],
      ['tester reported red at least once (failure surfaced)', testerRed, role('tester').map((t) => `${t.id}:${t.status}`).join(' ')],
      ['failure fixed through a worker (fixer or engineer round), not by the lead', fixed, `fixer tasks: ${role('fixer').map((t) => `${t.id}:${t.status}`).join(' ') || 'none'}`],
      ['tests/ untouched (nobody weakened the spec)', fixtureTests, fixtureTests ? 'identical to fixture' : 'tests/ changed'],
      ['lead did not ask the user back', asked === 0, `ask dialogs: ${asked}`],
      ['one lead session only (workers not counted)', sessions === 1, `sessions: ${sessions}`],
    ];
  },
};
