# Kế hoạch v2: một khung làm việc cho một người và cả đội

> Trạng thái: **đã triển khai** trong agent-work-kit 0.2. Đặc tả cuối cùng: `DESK-SPEC.md`. Cách dùng: `README.md`.

## 1. Bài toán

Hiện có hai hệ thống tách rời:

| | Bàn (agent-work-kit v1) | orca-orchestrator |
|---|---|---|
| Phạm vi | 1 agent, 1 việc | 1 lead điều phối nhiều worker |
| Lưu việc | 7 file markdown, agent tự sửa | `tasks.json` + `tasks.py` |
| Chi phí | mỗi lần cập nhật bàn: Read + Edit ≈ 300–500 token/file | 1 lệnh ≈ 50 token |
| Vòng đời | inbox → queue → now → archive | todo → running → review → done · blocked · failed · cancelled |
| Thiếu | chờ việc, huỷ, chia việc, nhiều người làm, hoàn tác | nhớ, bài học, mục tiêu; chỉ Claude; Python; khó cho người mới |

**Mục tiêu v2:** một khung duy nhất.
- Một người hay cả đội đều dùng chung một bảng việc, cùng các lệnh, cùng quy tắc an toàn.
- Người mới không phải làm gì. Dân chuyên có đủ: worker, worktree, routing model, lease, merge gate.
- Chỉ dùng native, không thư viện ngoài: Node ≥ 18 cho kit, `git` và `orca` (khi có) cho phần đội.

## 2. Quyết định đã chốt

1. Bảng việc lưu ở `.desk/desk.json`, và chỉ lệnh `desk` được ghi file này. `DESK.md` (và `desk.html`) được tự sinh để xem.
2. orca-orchestrator được viết lại bằng Node, gộp vào kit, chạy với mọi harness mà Orca hỗ trợ.
3. Tầng Đội tự bật khi việc đủ lớn. Lần đầu mở worker trong một phiên, agent phải hỏi người dùng một câu, và lệnh `dispatch` cũng chặn nếu chưa hỏi.

## 3. Mô hình dữ liệu

`.desk/desk.json` được commit cùng dự án:

```jsonc
{
  "version": 2,
  "seq": { "Q": 12, "M": 4, "L": 3, "P": 1 },     // id không bao giờ dùng lại
  "goal": ["…", "…"],                                // ≤ 5 dòng
  "items": [
    { "id": "Q-7", "kind": "task", "status": "doing", "prio": "P1", "text": "…",
      "done": "<kiểm chứng>", "next": "<bước kế>", "refs": ["src/a.swift"],
      "created": "2026-11-22", "uses": 3, "last": "2026-11-22",
      // chờ
      "on": "user | Q-3 | <bên ngoài>", "until": "2026-12-01",
      // chia việc / đội
      "parent": "Q-5", "deps": ["Q-6"], "files": ["…"], "plan": "login", "role": "engineer",
      "executor": "lead | subagent | orca", "tier": "T0..T4", "level": "L1..L4",
      "agent": "claude", "model": "…", "dispatch": "…", "terminal": "…", "worktree": "path:…",
      "baseSha": "…", "run": "…", "sha": "…", "proof": "…", "question": { "id": "…", "text": "…" },
      "history": [{ "at": "…", "status": "…", "note": "…" }]          // giữ 20 mục gần nhất
    },
    { "id": "M-2", "kind": "memory", "prio": "P1", "text": "…", "pin": true, "uses": 4, "last": "…" },
    { "id": "L-1", "kind": "lesson", "text": "…", "seen": 2, "proposal": "P-1" }
  ],
  "leases": { "simulator": { "holder": "Q-9", "at": "…", "expires": "…" } }
}
```

**Trạng thái của việc:**

```
inbox ─▶ todo ─▶ doing ─▶ (review) ─▶ done
            ▲  │   │                    
            │  ▼   ▼                    
          waiting  dropped (có lý do, undo được) · failed
```

- `doing` của lead: đúng **1** việc (tâm điểm). Worker và subagent có thể có nhiều việc `doing` song song.
- `review`: worker báo xong nhưng lead chưa kiểm. Việc lead tự làm thì đi thẳng `done`, kèm bằng chứng.
- `waiting`: chờ người dùng, chờ một việc khác, chờ bên ngoài, hoặc tới một ngày. Tự quay về `todo` khi việc được chờ xong hoặc tới ngày `until`.
- Việc cha có các việc con: tự `done` khi mọi việc con xong.

**Các file khác trong `.desk/`:**

| File | Commit | Ai ghi |
|---|---|---|
| `desk.json` | ✓ | lệnh `desk` |
| `DESK.md` | ✓ | tự sinh, để người và git đọc |
| `archive/YYYY-MM.md` | ✓ | tự sinh khi việc đóng |
| `archive.jsonl` | ✓ | lệnh `desk` (việc đã đóng, dùng cho `undo` và `log`) |
| `team.json` | ✓ | lệnh `desk team`; hồ sơ dự án cho đội: build, test, tài nguyên độc quyền, file của lead, routing |
| `plans/*.md`, `plans/specs/*.md` | ✓ | agent (tài liệu) |
| `review/P-*.md`, `U-*.md` | ✓ | lệnh `desk propose` / kit |
| `rules.local.md` | ✓ | agent, phải có đề xuất đã duyệt |
| `desk.html` | ✗ | tự sinh (dashboard) |
| `.state.json`, `.journal.jsonl`, `.undo/`, `.lock` | ✗ | kit |

Bàn v1 (các file markdown) được **tự chuyển sang v2** khi chạy `update` hoặc ở phiên đầu tiên. File cũ được chuyển vào `archive/v1/`.

## 4. Lệnh `desk`

Agent gọi `node .agentkit/desk.mjs <lệnh>`, người dùng gọi `npx github:nguyennamkkb/agent-work-kit desk <lệnh>`. Mỗi lệnh in **một dòng** kết quả.

| Nhóm | Lệnh |
|---|---|
| Xem | `status` (mặc định) · `list [--all] [--status s]` · `show ID` · `log [n]` |
| Việc | `add [P0-3] "text" [--done "…"] [--now] [--files a,b] [--deps Q-1] [--parent Q-2] [--ref p]` |
| | `edit ID [--text] [--prio] [--done] [--next] [--files] [--deps] [--ref]` · `prio ID P0` |
| | `start ID` (việc đang làm cũ được cất về todo kèm `next`) · `next "bước kế"` |
| | `wait ID --on user\|Q-3\|"…" [--until ngày]` · `resume ID` |
| | `done [ID] --proof "…"` · `drop ID --why "…"` · `split ID "a" "b" …` · `undo` |
| Nhớ | `remember "…" [--pin]` · `forget ID` · `touch ID` |
| Học | `lesson "…"` (trùng thì tăng `×`) · `propose "tiêu đề" --change … --why … [--from L-1]` · `approve P-1 --quote "…"` · `reject P-1` |
| Hướng | `goal "dòng" ["dòng"…]` · `inbox "…"` · `file ID task\|memory\|lesson [P]` |
| Đội | `team [status\|allow --quote "…"\|set k v\|check]` · `plan SLUG --goal "…"` · `route ROLE` · `fleet` |
| | `dispatch ID [--spec f] [--worktree] [--role] [--prefer] [--fails n] [--terminal h] [--keep-open] [--dry-run]` |
| | `mail` (nhận báo cáo của worker) · `reply ID "…"` · `send ID --subject PAUSE\|RESUME\|REBASE <ref>\|ABORT --body …` · `sync [--apply]` |
| | `lease acquire\|release\|show [tên] --holder ID` · `wt status\|open\|park\|close\|drop\|tidy` · `gate SLUG` (kiểm trước khi merge) |
| Worker | `worker ID status\|ask\|escalate\|inbox\|done --outcome …` |

Mọi thay đổi đều lưu ảnh chụp vào `.desk/.undo/` (giữ 30 bản), nên `undo` lùi lại được từng bước.

## 5. Hook: tự ghi, tự im lặng

| Hook | v2 |
|---|---|
| `session-start` | Đếm phiên, tự sắp xếp (giảm ưu tiên việc cũ, đưa memory ít dùng xuống dưới), việc chờ đã hết hạn tự về todo, in mặt bàn gọn (~80–150 token). Trong worktree của worker: chỉ in việc của worker đó. |
| `capture` | **Tự ghi** những gì chắc chắn: "nhớ…" → memory; lời sửa sai → bài học (trùng thì `×`+1); nhắc tới một việc → `×`+1, và nếu "gấp" → lên P0. Chỉ chèn gợi ý khi có tín hiệu. Câu bình thường: **0 token**. |
| `guard` | Chặn ghi thẳng vào `desk.json`, `DESK.md`, `archive/`, file của kit. Chỉ cho ghi `plans/`, `review/` và `rules.local.md` (có lint). |
| `desk-check` | Lint sau khi ghi `rules.local.md` và `review/`. |
| `stop-check` | Inbox còn việc; code đã đổi mà `desk.json` chưa đổi; worker chưa báo cáo; còn câu hỏi của worker chưa trả lời → nhắc **một lần**. |

## 6. Ba tầng làm việc

| Tầng | Khi nào | Cách |
|---|---|---|
| T0 Solo | mặc định | lead tự làm, `executor: lead` |
| T1 Trợ thủ | đọc hoặc khảo sát dài, sửa nhỏ làm phình ngữ cảnh | subagent của harness (`executor: subagent`) |
| T2 Worker | 1 module, nhiều lần build, lâu | 1 worker Orca trong checkout hiện tại hoặc worktree của plan |
| T3 Plan worktree | nhiều module, cần cổng test, chạy song song | `desk wt open` + engineer + tester (+ fixer) |
| T4 Chia lead | ≥ 2 plan cùng lúc và ngữ cảnh của lead đã nặng | một lead cho mỗi plan (phase B: lead đề xuất, supervisor dispatch) |

Giữ nguyên các quy tắc đã chạy thật của orca-orchestrator: một tên dùng ở bốn nơi (plan `plans/<slug>.md` ↔ worktree `plan-<slug>` ↔ nhánh `plan/<slug>` ↔ `--plan <slug>`), sở hữu file không chồng nhau, lease cho tài nguyên độc quyền, triage 4 loại, sau 2 vòng sửa thì dừng giao, merge gate 5 điều kiện, và không bao giờ chờ hay poll (giao việc xong thì kết thúc lượt, Orca đánh thức khi có thư).

**Routing** (`team.json` → `routing`):
- Ứng viên có dạng `agent[:model][@effort]`; model bỏ trống thì dùng model mặc định của agent.
- Mặc định được sinh từ các agent có trên máy, không ghi sẵn model riêng của ai.
- Quy tắc effort theo Orca 1.4.268: claude, codex, cursor, antigravity, grok, muse, pi dùng `--effort`; omp dùng `--model id:level`; opencode và zcode không có effort; opencode chỉ chạy trong worktree đã có.

## 7. An toàn: "yên tâm sử dụng"

1. **Không mất gì:**
   - `drop` lưu lý do vào archive;
   - `undo` lùi được 30 bước;
   - `wt drop` in sha để khôi phục;
   - bàn v1 được giữ lại trong `archive/v1/`.
2. **Hỏi trước khi làm việc lớn:**
   - worker đầu tiên trong phiên;
   - merge, push, xoá worktree chưa merge;
   - đổi luật, công cụ hay cấu trúc (qua đề xuất).
3. **Giới hạn chi phí:**
   - `maxWorkers` (mặc định 3), `maxPlanWorktrees` (mặc định 3);
   - sau 2 lần thất bại thì leo thang model hoặc dừng giao;
   - chặn model có tên khớp `deny`.
4. **Minh bạch:**
   - `desk status` nói rõ: đang làm gì, đang chờ gì, cần bạn quyết gì;
   - `desk.html` hiện cả đội;
   - mọi bước đều có lịch sử.
5. **Kit chỉ ghi vào dự án** và tự dọn cache của `npx` (đã có từ v1).

## 8. Token (mục tiêu)

| | v1 | v2 |
|---|---|---|
| Cố định mỗi phiên (skill + AGENTS.md + mặt bàn) | ~3.000 | ~1.200 (skill lõi ngắn; phần đội nằm trong `.agentkit/docs/team.md`, chỉ đọc khi dùng) |
| Một lần cập nhật bàn | ~300–500 | ~50 |
| Câu gõ bình thường | ~46 | 0 |

## 9. Thay đổi trong mã nguồn

- `kit/method/hooks/_lib.mjs`: phần nền (tìm thư mục gốc, kể cả khi đứng trong worktree; khoá file; ghi atomic; normalizeWrites; tín hiệu; luật).
- `kit/method/hooks/store.mjs` (mới): mô hình bàn, các thao tác, chuyển v1 → v2, sắp xếp tự động, sinh DESK.md, archive và html.
- `kit/method/hooks/team.mjs` (mới): hồ sơ team, routing, Orca (dispatch, mail, reply, send, sync, fleet), worktree, lease, gate, phía worker.
- `kit/method/hooks/cli.mjs` (mới) + `.agentkit/desk.mjs`: lệnh `desk`.
- `kit/method/hooks/dashboard.html` (mới): dashboard tự làm mới.
- Hook: viết lại `session-start`, `capture`, `guard`, `desk-check`, `stop-check` dựa trên store.
- `kit/method/SKILL.md`: rút gọn còn phần lõi. `kit/method/docs/team.md` (mới): điều phối đội, spec worker, triage, merge gate.
- `kit/method/desk/`: mẫu mới (`desk.json` trống, `team.json`, `plans/`, `review/`, `rules.local.md`, `gitignore`).
- `kit/nghe/*/nghe.json`: mặc định `team` theo nghề (iOS: tài nguyên độc quyền `simulator`, file của lead `project.pbxproj`…).
- `src/`: `update` chuyển v1 → v2; `doctor` kiểm `desk.json`, team và routing; `desk` chuyển lệnh xuống CLI trong dự án; adapter cài thêm `.agentkit/desk.mjs` và `.agentkit/docs/`.
- Test: mô hình bàn, mọi thao tác, undo, chuyển v1, hook (tự ghi, im lặng), guard, routing, dispatch, mail, worker done, lease, worktree, gate. Orca giả dùng một script `orca` trên PATH.
- Tài liệu: viết lại `README.md` (5 phút cho người mới · cách bàn chạy · làm theo đội · an toàn · chi phí · dành cho dân chuyên · hỏi đáp), cập nhật `DESK-SPEC.md`.

## 10. Kiểm tra trước khi giao

- `npm test` pass hết.
- Cài thật bằng link GitHub vào thư mục trống: chạy `init`, các hook, các lệnh `desk`, `doctor`, `remove`. Không ghi gì ngoài dự án.
- Chuyển bàn demo v1 → v2 và giữ đúng dữ liệu.
- Đo lại token của mặt bàn, hook và lệnh.
- Phần đội: chạy với Orca giả trong test. Chạy với Orca thật thì chỉ thử những lệnh chỉ đọc (`route --check --live`, `fleet`, `wt status`); không mở worker thật khi chưa có sự đồng ý của người dùng.
