# Đặc tả: Cái bàn làm việc (bản nháp để duyệt)

Mỗi dự án có một cái bàn, và bàn chỉ phục vụ một nghề. Mọi việc và mọi điều cần nhớ đều nằm ở đúng một vùng cố định. Kit gồm ba phần: phương pháp bàn (một skill, giống nhau cho mọi nghề), gói nghề (bộ rule có ID) và hook để ép tuân thủ.

---

## 1. Cài đặt

```bash
npx agent-work-kit init --ios          # bàn cho iOS dev
npx agent-work-kit init --designer     # bàn cho designer
npx agent-work-kit init                # không truyền nghề thì kit hỏi
```

- Mỗi cờ nghề (`--ios`, `--designer`, …) ứng với một gói trong `kit/nghe/<tên>/`. Mỗi bàn chỉ có một nghề, nên truyền hai cờ nghề sẽ báo lỗi.
- Harness tự phát hiện (`.claude/`, `.cursor/`, `.codex/`). Có thể ép bằng cờ ngắn: `--claude`, `--cursor`, `--codex`.
- Đổi nghề: `npx agent-work-kit switch --designer`. Lệnh này giữ nguyên các vùng của bàn, chỉ thay gói nghề.
- Lấy gói nghề từ nguồn khác (giai đoạn sau): `--from github:team-abc/kit-ios`.

Các lệnh còn lại giữ nguyên: `update`, `doctor`, `review`, `remove`. Thêm lệnh `desk` để xem mặt bàn trong terminal.

---

## 2. Các vùng của bàn: `.desk/`

| File | Vùng | Chứa gì | Sức chứa |
|---|---|---|---|
| `goal.md` | **Mục tiêu** | Đích đến và tiêu chí thành công | ≤ 5 dòng. Chỉ đổi khi người dùng duyệt |
| `now.md` | **Đang làm** | Một việc, kèm tiêu chí "xong" và bước tiếp theo | Đúng 1 việc |
| `queue.md` | **Khay việc** | Việc chờ làm, xếp từ P0 xuống P3 | ≤ 7 việc. Thừa thì việc thấp nhất vào tủ |
| `inbox.md` | **Hộp vào** | Thứ mới phát sinh, chưa phân loại | Phải trống khi kết thúc phiên |
| `memory.md` | **Ghi nhớ** | Quyết định và sự thật của dự án | Phần trên vạch `---` (≤ 10 mục) luôn được đọc |
| `notebook.md` | **Sổ tay** | Bài học, có bộ đếm số lần gặp | Gặp từ 2 lần thì viết đề xuất |
| `review/` | **Chờ duyệt** | Đề xuất thay đổi rule và rule kit cần quyết | Chỉ người dùng duyệt |
| `archive/` | **Tủ hồ sơ** | Việc đã xong, ghi nhớ đã cũ | Không tự nạp, chỉ tìm khi cần |
| `rules.local.md` | Rule của dự án | Rule thêm, ghi đè hoặc tắt theo ID (mục 4) | Ghép vào tổng ngân sách |

Agent chỉ được ghi vào các file trên. Hook chặn mọi file lạ trong `.desk/`.

### Định dạng một mục

```markdown
- P1 Q-007 Thêm màn hình đăng nhập · +2026-11-20 · ×3 · @2026-11-22
```

Các trường lần lượt là: mức ưu tiên, id, nội dung, ngày tạo (`+`), số lần được dùng (`×`), lần dùng gần nhất (`@`). Tiền tố id theo vùng: `Q-` cho khay việc, `M-` cho ghi nhớ, `L-` cho sổ tay, `P-` cho đề xuất.

### Mức ưu tiên

| Mức | Nghĩa |
|---|---|
| **P0** | Chặn mục tiêu, hoặc sai sót đang gây hại. Làm ngay |
| **P1** | Đóng góp trực tiếp vào mục tiêu |
| **P2** | Hữu ích nhưng chờ được |
| **P3** | Có thì tốt |

Việc nào không nối được với `goal.md` thì nằm lại hộp vào, và agent hỏi người dùng. Đây là cơ chế chống chệch hướng.

---

## 3. Quy trình sắp xếp (nội dung skill `desk`)

**Đầu phiên.** Hook hiện mặt bàn gồm mục tiêu, việc đang làm, 3 việc đầu khay và các ghi nhớ trên vạch. Agent tìm trong sổ tay và ghi nhớ những gì liên quan tới việc sắp làm.

**Trong phiên.**
- Chỉ làm việc đang nằm trong `now.md`.
- Thứ mới phát sinh thì ghi vào hộp vào, không bỏ dở việc đang làm để đi làm việc khác.
- Mỗi khi dùng tới một mục ghi nhớ hay bài học, agent tăng `×` và cập nhật `@` của mục đó.

**Cuối phiên.**
1. Dọn hộp vào: mỗi mục chuyển vào khay việc, ghi nhớ, sổ tay, hoặc bỏ đi.
2. Cập nhật `now.md`. Nếu việc đã xong, chuyển nó vào tủ và lấy việc đầu khay lên.
3. Sắp lại theo luật bên dưới.
4. Commit.

**Luật đưa lên và cất xuống** (agent tự làm, không cần duyệt):
- Mục được dùng từ 3 lần trở lên: lên một bậc, ví dụ từ ghi nhớ dưới vạch lên trên vạch.
- Mục không được đụng tới sau 5 phiên: xuống một bậc, cuối cùng vào tủ.
- Khay việc hoặc phần trên vạch của ghi nhớ đầy: mục thấp nhất bị đẩy xuống.

Hook đánh số phiên trong `.desk/.state.json` để luật "5 phiên" có căn cứ.

**Tự tiến hoá.** Agent được tự sắp xếp đồ trên bàn. Mọi thay đổi về rule, luật sắp xếp hay các vùng đều phải qua đề xuất ở `review/` và được người dùng duyệt.

---

## 4. Rule của nghề: ba lớp, ghép theo ID

| Lớp | Nằm ở | Ai sửa |
|---|---|---|
| Phương pháp bàn | trong kit | chỉ kit, qua `update` |
| Gói nghề (`ios`, `designer`) | trong kit, có version riêng | chỉ kit, qua `update` |
| Rule dự án | `.desk/rules.local.md` | agent, sau khi đề xuất được duyệt |

Skill agent đọc là bản ghép tự động của ba lớp. Không ai sửa trực tiếp bản ghép.

### Định dạng rule trong gói nghề

```markdown
### IOS-012 · P1
Run `xcodebuild test` and show the result before reporting done.
- Why: agents report done without building.
- Check: test output appears in the session.
```

### Rule dự án: thêm, ghi đè, tắt

```markdown
### IOS-012 · override
Use `make test` instead of xcodebuild.
- Why: P-004, approved 2026-11-20.

### IOS-020 · off
- Why: project does not use SwiftLint.

### LOCAL-001 · P2
Snapshot tests live in `Tests/Snapshots/`, regenerate with `make snap`.
```

---

## 5. Cập nhật rule nghề

```
$ npx agent-work-kit update
ios 1.2.0 → 1.3.0
  + IOS-031  rule mới                          → tự áp dụng
  ~ IOS-007  nội dung đổi                      → tự áp dụng
  ~ IOS-012  nội dung đổi, dự án đang ghi đè   → vào review/ để người dùng quyết
  - IOS-015  kit bỏ rule này                   → tự gỡ
```

- Version nghề và nội dung từng rule được lưu trong `.agentkit.json`. Muốn quay về bản cũ thì dùng `git revert` commit cập nhật, vì mọi file của kit đều nằm trong git.
- Các vùng của bàn là dữ liệu của dự án. `update` không bao giờ động vào.

---

## 6. Hook (của kit, không thuộc nghề)

| Hook | Làm gì |
|---|---|
| SessionStart | Tăng số phiên và hiện mặt bàn |
| PreToolUse (Edit/Write) | Mô phỏng nội dung sau khi ghi rồi kiểm **trước**: chặn file lạ trong `.desk/`, sai định dạng, vượt sức chứa, khay sai thứ tự, rule dự án chưa có đề xuất được duyệt. Chặn sửa file của kit |
| Stop | Nhắc nếu hộp vào chưa trống hoặc `now.md` chưa cập nhật mà code đã đổi |

Harness không có hook (Cursor, Codex) nhận các kiểm tra này dưới dạng checklist trong `AGENTS.md`.

---

## 7. Phạm vi bản đầu

**Có:** mục 1–6, hai nghề `ios` và `designer`, adapter cho Claude, Cursor và Codex, test.

**Để sau:** gói nghề từ git (`--from`), lệnh `contribute` đưa rule tốt từ dự án lên gói nghề, lệnh `lint-nghe` kiểm chất lượng gói nghề.

**Bỏ so với bản trước:** skill, agent, command và hook riêng của từng nghề; thư mục `.work/`; xung đột theo file (`.kit-new`) đối với rule.

---

## 8. Điều chỉnh khi triển khai

1. **Kiểm bàn trước khi ghi, không phải sau khi ghi.** Hook PostToolUse chỉ báo lỗi được khi file đã bị ghi hỏng. Hook PreToolUse mô phỏng nội dung sau khi sửa rồi mới cho ghi, nên bàn không bao giờ ở trạng thái sai.
2. **Rule dự án không được ghép vào file skill.** Skill chỉ gồm phương pháp bàn và rule nghề, đều do kit quản lý. Rule dự án nằm riêng ở `rules.local.md`, và hook đầu phiên in ra danh sách các rule ghi đè hoặc tắt. Nhờ vậy khi dự án thêm rule thì không phải sinh lại skill, và kit không bao giờ xung đột với dự án.
3. **Rule dự án phải trích một đề xuất đã duyệt.** Hook kiểm điều này với mọi rule mới hoặc vừa sửa. Agent không thể tự thêm rule.
4. **Quay về bản cũ bằng git**, không dùng `update --to`. Gói nghề chỉ đi kèm bản hiện tại, nên lệnh `--to` không có dữ liệu để quay về.
5. **Bỏ cài global**, vì mỗi dự án có một bàn riêng.
6. **Duyệt ngay trong chat:** khi người dùng nói "duyệt P-003" trong chat, agent được ghi `Status: approved` nhưng phải trích nguyên lời người dùng vào file đề xuất. Lệnh `review` vẫn là cách chính thức.
7. **Hook Stop bỏ qua file của kit.** Nếu không, ngay sau khi cài, hook sẽ nhắc nhầm vì coi các file kit vừa tạo là "code thay đổi".
8. **Giới hạn đã biết:**
   - Trên Cursor và Codex không có hook, nên không có đếm phiên. Luật "5 phiên" chỉ chạy tự động trên Claude Code.
   - Việc đổi mục tiêu chưa bị hook chặn. Hiện chỉ có rule mềm "đổi khi người dùng đồng ý".
9. **Người dùng không phải làm gì** (theo yêu cầu sau khi duyệt đặc tả):
   - Bỏ mục `## Project TODO` trong AGENTS.md và danh sách việc "Next" sau khi cài. Agent tự tìm lệnh build/test và ghi vào Ghi nhớ.
   - Mục tiêu do agent tự suy ra từ yêu cầu của người dùng, README và git log, rồi báo lại trong một dòng.
   - Hook mới `UserPromptSubmit` (`capture.mjs`):
     - nhận ra tín hiệu trong câu người dùng gõ, bằng tiếng Việt lẫn tiếng Anh: sửa sai, việc gấp, dặn "nhớ", đồng ý;
     - tăng `×` cho mục được nhắc tới;
     - ghi nhật ký để agent làm retro.
   - Sắp xếp máy móc (khay việc, vạch ghi nhớ, đẩy vào tủ) do hook làm ở đầu phiên, không giao cho agent.
   - Sửa file nằm trong `ref:` của một mục thì mục đó tự tăng độ quan trọng.
   - Duyệt đề xuất bằng một câu trong chat. Xung đột rule khi `update` thì tự giữ rule của dự án và chỉ báo một lần.
   - Hook Stop nhắc agent ghi bài học nếu người dùng đã sửa agent trong phiên.
10. **Hỗ trợ nhiều harness bằng cơ chế native**, đã xác minh trên bản cài trong máy: Codex 0.171, OpenCode 2.3.2, Pi 1.6.0, omp 18.3.2.
   - Một bộ script chung trong `.agentkit/hooks/`. Script tự tìm gốc dự án bằng cách đi ngược lên thư mục cha.
   - Script chuẩn hoá được mọi kiểu công cụ ghi file: `Edit`/`Write`/`MultiEdit` của Claude, `apply_patch` của Codex (kể cả patch sửa nhiều file hay đổi tên file), `edit {path, edits[oldText,newText]}` của Pi, `edit {filePath, oldString, newString}` của OpenCode.
   - Hook mới `desk-check` kiểm bàn sau khi ghi, dùng khi không mô phỏng được nội dung trước khi ghi. Ví dụ: kiểu sửa file riêng của omp, hoặc patch không khớp.
   - Pi và omp dùng chung một extension. Kit phân biệt omp nhờ các trường `runtime`/`extension` mà omp truyền thêm. omp không có `agent_before_settle`, nên phần nhắc trước khi dừng chạy qua `agent_end` + `sendMessage(followUp)`.
   - OpenCode dùng plugin V2 (`{id, setup}`) với các hook `prompt`, `execute.before`/`after`, `experimental.idle`. Mặt bàn được nạp qua `session.instructions.entry.put`. Nếu bản OpenCode không có tính năng đó, kit gắn mặt bàn vào cuối prompt.
   - Những việc người dùng buộc phải làm một lần, vì là ranh giới bảo mật của harness: tin cậy hook của Codex (`/hooks`), tin cậy dự án trong Pi.
   - Chưa chạy end-to-end với model thật. Mới kiểm bằng cách nạp đúng file mà kit sinh ra với API giả lập theo hình dạng đã xác minh.
