# agent-work-kit

Bộ khung giúp coding agent làm việc dài hơi trong một dự án. Mỗi dự án có **một cái bàn làm việc** (`.desk/`), và bàn chỉ phục vụ **một nghề**. Mọi việc và mọi điều cần nhớ đều nằm ở đúng một vùng cố định của bàn, xếp từ quan trọng đến ít quan trọng. Nhờ vậy agent:

- luôn biết mục tiêu, việc đang làm và việc tiếp theo, kể cả khi sang phiên mới hay sau khi context bị nén;
- không chệch hướng, vì mỗi lúc chỉ làm một việc, còn việc mới phát sinh thì vào hộp vào;
- tự học điều gì quan trọng từ cách bạn làm việc với nó;
- tự cải tiến cách làm việc, nhưng mọi thay đổi về rule đều phải được bạn đồng ý.

**Bạn không phải làm gì thêm.** Cài xong, cứ làm việc với agent như bình thường. Bàn tự điền và tự sắp xếp.

---

## Cài đặt

```bash
npx agent-work-kit init --ios          # bàn cho iOS developer
npx agent-work-kit init --designer     # bàn cho product designer (Figma)
```

- Chỉ cần Node 18 trở lên. Kit không có dependency nào.
- Harness được tự phát hiện từ thư mục dự án (`.claude/`, `.codex/`, `.opencode/`, `.pi/`, `.omp/`, `.cursor/`). Nếu không tìm thấy harness nào, kit dùng Claude Code. Muốn chọn thẳng thì thêm cờ:

```bash
npx agent-work-kit init --ios --claude --codex --opencode --pi --omp --cursor
```

- Mỗi bàn chỉ có một nghề. Truyền hai cờ nghề cùng lúc sẽ báo lỗi.

### Việc cần làm một lần, tuỳ harness

Đây là bước bảo mật của chính harness, kit không làm thay được:

| Harness | Việc cần làm |
|---|---|
| Codex | Mở Codex trong dự án, chạy `/hooks` và tin cậy hook của agent-work-kit |
| Pi | Chọn tin cậy dự án khi Pi hỏi lần đầu |

Các harness còn lại không cần bước nào.

---

## Harness được hỗ trợ

Kit có bốn cơ chế: hiện mặt bàn đầu phiên, đọc câu người dùng, chặn ghi sai, nhắc trước khi dừng. Cả bốn dùng chung một bộ script trong `.agentkit/hooks/`. Mỗi harness nối vào bộ script này bằng cơ chế native của nó:

| Harness | Cách nối | Skill | Mặt bàn | Đọc câu người dùng | Chặn ghi sai | Nhắc trước khi dừng |
|---|---|---|---|---|---|---|
| Claude Code | hook trong `.claude/settings.json` | `.claude/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Codex | hook trong `.codex/hooks.json` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Pi | extension `.pi/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Oh My Pi | extension `.omp/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| OpenCode | plugin `.opencode/plugins/agentkit-desk/` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Cursor | rule `.cursor/rules/agentkit-desk.mdc` | (chính rule đó) | checklist | – | – | – |

- Mọi harness đều đọc `AGENTS.md`. Claude Code đọc qua `CLAUDE.md` có dòng `@AGENTS.md`.
- Plugin và extension chỉ dùng thư viện có sẵn của Node, không import package ngoài nào, kể cả SDK của chính harness.
- Nếu plugin gặp lỗi, harness vẫn chạy bình thường. Kit không bao giờ làm hỏng phiên làm việc.
- Cursor không có hook, nên các kiểm tra nằm dưới dạng checklist trong `AGENTS.md`. Chạy `npx agent-work-kit desk` để kiểm bàn bằng tay.

---

## Cái bàn: `.desk/`

| File | Vùng | Chứa gì | Sức chứa |
|---|---|---|---|
| `goal.md` | Mục tiêu | Đích đến và tiêu chí thành công | ≤ 5 dòng |
| `now.md` | Đang làm | Đúng một việc, kèm `done:` (tiêu chí xong) | 1 việc |
| `queue.md` | Khay việc | Việc chờ làm, xếp P0 → P3 | ≤ 7 việc |
| `inbox.md` | Hộp vào | Thứ mới phát sinh, chưa phân loại | trống khi kết thúc phiên |
| `memory.md` | Ghi nhớ | Quyết định và sự thật của dự án | ≤ 10 mục trên vạch `---`, luôn được đọc |
| `notebook.md` | Sổ tay | Bài học, kèm số lần gặp lại | gặp từ 2 lần thì viết đề xuất |
| `review/` | Chờ duyệt | Đề xuất thay đổi cách làm việc | bạn đồng ý bằng một câu trong chat |
| `archive/` | Tủ hồ sơ | Việc đã xong, ghi nhớ cũ | không tự nạp |
| `rules.local.md` | Rule dự án | Rule thêm, ghi đè hoặc tắt theo ID | mỗi rule phải có đề xuất đã duyệt |

Agent chỉ được ghi vào các file trên. Kit chặn mọi file lạ trong `.desk/`.

### Định dạng một mục

```
- P1 Q-007 Login screen · +2026-11-20 · ×3 · @2026-11-22
  - done: xcodebuild test passes
```

Các trường lần lượt là:
- `P0–P3`: mức ưu tiên.
- `Q-…`: id. `Q-` là việc, `M-` là ghi nhớ, `L-` là bài học.
- Nội dung.
- `+`: ngày tạo.
- `×`: số lần được dùng.
- `@`: lần chạm gần nhất.

Các dòng con (`  - key: value`) chứa chi tiết: `done`, `next`, `ref`, `example`, `proposal`.

### Mức ưu tiên được suy ra từ cách bạn làm việc

| Mức | Khi nào |
|---|---|
| P0 | Chặn mục tiêu hoặc đang gây hại. Bạn nói "gấp", "quan trọng", hoặc nhắc lại hai lần trong một phiên |
| P1 | Đẩy mục tiêu đi tiếp. Việc bạn yêu cầu trong phiên này |
| P2 | Hữu ích nhưng chờ được. Câu bên lề ("để sau"), hoặc ý tưởng của agent |
| P3 | Có thì tốt. Nhắc một lần, đã lâu |

### Bàn tự sắp xếp

Đầu mỗi phiên, kit tự sắp lại bàn theo các luật máy móc sau:
- Khay việc xếp theo P0 → P3, rồi theo `×`. Việc không đụng tới sau 5 phiên bị hạ một bậc. Việc P3 không đụng tới thì vào tủ. Khay quá 7 việc thì việc thấp nhất vào tủ.
- Ghi nhớ dưới vạch được dùng từ 3 lần trở lên thì lên trên vạch. Ghi nhớ trên vạch không đụng tới sau 5 phiên thì xuống dưới vạch. Trên vạch quá 10 mục thì mục ít dùng nhất xuống dưới.
- `×` tự tăng khi bạn nhắc tới một mục, hoặc khi agent sửa một file nằm trong `ref:` của mục đó.

Agent chỉ lo phần cần phán đoán: gộp mục trùng, viết lại mục mơ hồ, nâng ưu tiên khi thấy bạn coi trọng một việc.

---

## Bốn cơ chế của kit

| Cơ chế | Làm gì |
|---|---|
| **Đầu phiên** | Đánh số phiên, tự sắp bàn, rồi đưa vào context: mục tiêu, việc đang làm, top khay việc, ghi nhớ trên vạch, đề xuất chờ áp dụng, rule dự án, việc cần dọn |
| **Đọc câu người dùng** | Nhận ra lời sửa, việc gấp, lời dặn "nhớ / luôn / từ giờ", lời đồng ý (tiếng Việt và tiếng Anh). Nhắc agent ghi vào đúng vùng, tăng `×` cho mục được nhắc tới, ghi nhật ký vào `.desk/.journal.jsonl` (không commit) |
| **Chặn ghi sai** | Trước khi ghi: từ chối file lạ trong `.desk/`, sai định dạng, vượt sức chứa, khay sai thứ tự, rule dự án chưa có đề xuất được duyệt. Chặn sửa file của kit và vùng giữa `agentkit:start/end`. Sau khi ghi: kiểm lại toàn bộ bàn, dùng cho trường hợp không mô phỏng được nội dung trước khi ghi |
| **Nhắc trước khi dừng** | Nhắc agent đúng một lần nếu hộp vào chưa trống, code đã đổi mà bàn chưa cập nhật, hoặc bạn đã sửa agent mà chưa có bài học nào được ghi |

Kit hiểu cách ghi file của mọi harness: `Edit`/`Write`/`MultiEdit` của Claude Code, `apply_patch` của Codex (kể cả patch sửa nhiều file hay đổi tên file), `edit`/`write` của Pi và OpenCode.

---

## Rule: ba lớp, cập nhật theo ID

1. **Phương pháp bàn** (`kit/method/SKILL.md`): giống nhau cho mọi nghề.
2. **Gói nghề** (`kit/nghe/<nghề>/rules.md`): mỗi rule có ID, mức ưu tiên, lý do và cách kiểm.

   ```markdown
   ### IOS-001 · P0
   Before reporting done, run the project's build + test command and show the summary.
   - Why: "done" without a green build is the most common false report.
   - Check: test output appears in the session before "done".
   ```

3. **Rule dự án** (`.desk/rules.local.md`): ghi đè, tắt hoặc thêm rule theo ID. Mỗi rule phải trích một đề xuất đã được duyệt.

   ```markdown
   ### IOS-001 · override
   Use `make test` instead of xcodebuild.
   - Why: P-004

   ### IOS-020 · off
   - Why: P-005

   ### LOCAL-001 · P2
   Snapshot tests live in Tests/Snapshots/.
   - Why: P-006
   ```

Thứ tự ưu tiên: rule dự án > rule nghề > phương pháp bàn.

### Tự cải tiến

1. Bạn sửa agent, hoặc một bước bị lặp lại, thì agent ghi bài học vào `notebook.md`.
2. Bài học gặp lại từ 2 lần trở lên thì agent viết đề xuất trong `review/`, kèm bằng chứng, thay đổi cụ thể, chỉ số thành công và cách gỡ lại.
3. Agent hỏi bạn đúng một câu vào lúc thích hợp. Bạn trả lời "ok" là đồng ý.
4. Agent ghi rule vào `rules.local.md`, chuyển đề xuất vào tủ và commit.

### Cập nhật kit

```bash
npx agent-work-kit update
```

Kit so rule theo ID:
- Rule mới được thêm vào.
- Rule đã đổi hoặc bị bỏ được áp dụng.
- Rule mà dự án đang ghi đè thì **rule của dự án được giữ nguyên**. Kit để lại một ghi chú trong `archive/U-…md` và agent báo bạn một lần.

Bạn không phải quyết gì. Muốn dùng rule của kit thay cho rule dự án thì chỉ cần nói với agent.

---

## Lệnh

| Lệnh | Việc |
|---|---|
| `init --<nghề>` | Dựng bàn và cài rule của nghề |
| `switch --<nghề>` | Đổi nghề, giữ nguyên bàn. Cũng dùng để thêm harness, ví dụ `switch --codex` |
| `update` | Cập nhật kit và rule nghề, so theo từng rule ID |
| `desk` | Xem mặt bàn trong terminal và kiểm tra các vùng |
| `review` | Xem và duyệt đề xuất trong terminal (`--approve P-001`, `--reject P-001`, `--drop U-…`). Không bắt buộc, vì bình thường bạn trả lời ngay trong chat |
| `doctor` | Kiểm tra cài đặt: file của kit, bàn, rule, công cụ của nghề, bước tin cậy của harness |
| `remove` | Gỡ kit và trả các file của bạn về như cũ. `.desk/` được giữ lại, thêm `--purge-desk` nếu muốn xoá |
| `list` | Liệt kê các nghề và harness |

Tuỳ chọn chung: `--dir <path>`, `-y` (không hỏi gì), `--dry-run` (chỉ xem sẽ đổi gì), `--force` (ghi đè file của kit đã bị sửa tay).

---

## Kit cài gì vào dự án

```
AGENTS.md                       vùng của kit (giữa agentkit:start/end) + phần của bạn bên dưới
CLAUDE.md                       @AGENTS.md (nếu dùng Claude Code)
.agentkit.json                  manifest: version, nghề, rule, hash từng file
.agentkit/hooks/*.mjs           bộ script dùng chung cho mọi harness
.claude/skills/desk/SKILL.md    skill duy nhất: phương pháp bàn + rule nghề
.claude/settings.json           hook và quyền "ask" (git push, rm -rf…), được merge, không ghi đè
.agents/skills/desk/SKILL.md    cùng skill đó, cho Codex, Pi, Oh My Pi và OpenCode
.codex/hooks.json               (Codex)
.pi/extensions/agentkit-desk.js (Pi)
.omp/extensions/agentkit-desk.js (Oh My Pi)
.opencode/plugins/agentkit-desk/index.js (OpenCode)
.cursor/rules/agentkit-desk.mdc (Cursor)
.mcp.json                       Figma MCP (chỉ khi cài --designer)
.desk/                          cái bàn: dữ liệu của dự án, không bao giờ bị kit ghi đè
```

**Nên commit:** tất cả các file trên. `.desk/.journal.jsonl` và `.desk/.state.json` đã được `.desk/.gitignore` loại ra.

**Kit chỉ ghi vào thư mục dự án.** Kit không ghi gì vào thư mục home hay cấu hình global của harness. Ngoài dự án chỉ có hai thứ, và cả hai đều không do kit tạo:
- bộ nhớ đệm tải package của `npx` (do npm quản lý);
- bản ghi tin cậy mà Codex và Pi lưu khi bạn đồng ý tin cậy dự án.

**Kit không phá file của bạn:**
- Trong `AGENTS.md` và `CLAUDE.md`, kit chỉ ghi vào vùng giữa hai marker `agentkit:start/end`.
- File JSON như `settings.json` và `.mcp.json` được merge, không ghi đè.
- Khi `remove`, mọi file được trả về đúng như trước khi cài.

---

## Thêm một nghề

Tạo thư mục `kit/nghe/<tên>/` với hai file:

**`nghe.json`**

```json
{
  "name": "backend",
  "title": "Backend",
  "version": "1.0.0",
  "description": "Backend services in Go",
  "checks": [{ "cmd": "go", "required": false, "hint": "install Go" }],
  "mcp": {}
}
```

**`rules.md`**

```markdown
## Profession: backend developer
- **Task** = …
- **Done** = …
- **Priority hints:** …
- **Memory worth keeping:** …

### BE-001 · P0
<một rule ra lệnh rõ ràng, kiểm chứng được>
- Why: <vì sao>
- Check: <cách kiểm>
```

Sau đó cờ `--backend` tự có. Mỗi lần sửa rule, nhớ tăng `version` để `update` báo thay đổi đúng. Test tự kiểm mọi gói nghề: ID không trùng, rule nào cũng có `Why` và `Check`, và skill ghép xong dưới 220 dòng.

---

## Phát triển

```bash
npm test                       # 32 test: engine, bàn, hook, từng harness, CLI
UPDATE_SNAPSHOTS=1 npm test    # khi cố ý đổi output của adapter
node bin/cli.js init --ios -y --dir /tmp/demo
```

Cấu trúc mã nguồn:

```
bin/cli.js            điểm vào CLI
src/commands/         init, switch, update, desk, review, doctor, remove, list
src/lib/              engine (ghi file, manifest, so rule theo ID), marker, merge JSON
src/adapters/         một adapter cho mỗi harness
kit/method/           SKILL.md (phương pháp bàn), hooks/ (script dùng chung), bridge/ (plugin cho Pi, omp, OpenCode), desk/ (mẫu .desk/)
kit/nghe/             gói nghề: ios, designer
test/                 kit.test.js, harness.test.js, __snapshots__/
```

## Giới hạn hiện tại

- Việc nhận ra lời sửa, việc gấp hay lời đồng ý dựa trên từ khoá, nên có thể bỏ sót hoặc bắt nhầm.
- Mỗi harness đã được kiểm bằng cách nạp đúng file mà kit sinh ra, với API theo hình dạng đã xác minh trên bản cài (Codex 0.171, OpenCode 2.3.2, Pi 1.6.0, omp 18.3.2). Chưa chạy end-to-end với model thật.
- Cursor không có hook, nên chỉ có checklist.

Đặc tả và lịch sử quyết định thiết kế: [DESK-SPEC.md](DESK-SPEC.md).
