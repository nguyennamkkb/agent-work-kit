# Bộ cài đặt làm việc dài hơi cho coding agent

Tài liệu tổng hợp nội dung đã trao đổi: kế hoạch kit cài qua `npx`, nguyên tắc harness engineering, cơ chế tự cải tiến, và ghi chú về `AGENTS.md`.

---

## 1. Tổng quan

Bộ cài đặt (kit) giúp người dùng làm việc lâu dài với coding agent theo đúng nghề (ví dụ iOS dev, Figma designer). Kit có khả năng tự tiến hoá trong dự án, nhưng mọi thay đổi quan trọng đều cần người duyệt.

Cài đặt:

```
npx <tên-kit> init
```

Các lệnh khác:
- `add <profile>`: thêm profile vào dự án đã cài.
- `update`: cập nhật kit mà không ghi đè phần người dùng đã sửa.
- `doctor`: kiểm tra cài đặt có lỗi hay không.
- `remove`: gỡ kit.

---

## 2. Trải nghiệm người dùng khi `init`

- Tự phát hiện harness đang có (`.claude/`, `.cursor/`, Codex…) và hỏi xác nhận.
- Chọn profile: lõi (luôn có), iOS, Figma.
- Chọn phạm vi cài: theo dự án hoặc global.

---

## 3. Kiến trúc: một nguồn, nhiều adapter

Nội dung được viết một lần ở dạng trung lập. Mỗi adapter chuyển nội dung sang định dạng của một harness:

```
kit/
  core/        rules, skills, commands, hooks, templates .work/
  profiles/
    ios/
    figma/
adapters/
  agents-md/   → AGENTS.md (dùng chung cho mọi harness)
  claude/      → CLAUDE.md (@AGENTS.md), .claude/skills|commands|agents, hooks
  cursor/      → .cursor/rules/*.mdc, commands
  codex/       → AGENTS.md + những gì Codex hỗ trợ
```

Nguyên tắc:
- Harness không có hook: chuyển rule bắt buộc thành rule mềm trong `AGENTS.md`. Agent được nhắc nhưng không bị ép.
- Không phá file sẵn có: kit chỉ ghi vào vùng giữa `<!-- kit:start -->` và `<!-- kit:end -->`. `settings.json` được merge, không ghi đè.
- Manifest `.agentkit.json`: lưu version, các profile đã cài và hash của từng file, để `update` biết file nào người dùng đã sửa.

---

## 4. Lõi làm việc dài hơi

Thư mục `.work/` gồm:
- `PLAN.md`: danh sách việc và trạng thái.
- `PROGRESS.md`: nhật ký từng phiên.
- `DECISIONS.md`: quyết định kèm lý do.
- `LEARNINGS.md`: bài học rút ra.
- `proposals/`: đề xuất thay đổi chờ duyệt.

Rule lõi:
- Đầu phiên: đọc `.work/` và `git log`.
- Mỗi lần chỉ làm một việc.
- Cuối phiên: cập nhật `.work/` và commit.

---

## 5. Vòng tự tiến hoá (đề xuất, người duyệt)

1. `/retro` chạy cuối phiên. Trên Claude Code, hook nhắc chạy nó.
2. Agent ghi bài học vào `LEARNINGS.md`.
3. Bài học lặp lại ít nhất 2 lần thì agent tạo đề xuất trong `.work/proposals/`, ghi rõ sửa rule nào hoặc skill nào và vì sao.
4. Người dùng duyệt bằng `/apply-proposal` hoặc `npx <kit> review`. Chỉ sau khi duyệt thì thay đổi mới được ghi vào file của harness.
5. Giới hạn kích thước rule: khi vượt ngưỡng, agent phải đề xuất gộp hoặc chuyển nội dung sang skill.
6. (Giai đoạn sau, tuỳ chọn) gửi bài học tốt ngược về repo kit dưới dạng PR.

---

## 6. Profile

- **iOS:** skill kiến trúc SwiftUI và Concurrency, `/build-test` (xcodebuild), hook SwiftLint và format, subagent reviewer.
- **Figma:** skill quy trình design system và đặt tên layer, `/audit-design`, cấu hình Figma MCP. Trong `.work/` có thêm phần lưu link frame và trạng thái màn hình.

---

## 7. Lộ trình

1. CLI khung (`init`, `doctor`) cùng lõi và adapter AGENTS.md + Claude Code.
2. Vòng tự tiến hoá: retro, proposals, apply.
3. Profile iOS.
4. Profile Figma.
5. Adapter Cursor/Codex và lệnh `update`.
6. Test snapshot cho từng adapter, rồi publish lên npm.

---

## 8. Câu hỏi còn mở

- Tên package npm.
- Mặc định cài theo dự án hay global.
- Rule viết bằng tiếng Việt hay tiếng Anh (tiếng Anh tốn ít token hơn).
- Có làm bước đóng góp bài học về repo kit (mục 5, bước 6) hay không.

---

## 9. Nguyên tắc harness engineering

**Context: đưa đúng thứ, đúng lúc**
- Rule luôn nạp (`AGENTS.md`/`CLAUDE.md`) chỉ giữ phần bất biến: mục tiêu dự án, lệnh build/test, quy ước cốt lõi. Giữ dưới khoảng 200 dòng.
- Kiến thức theo nghề để trong skill, chỉ nạp khi việc cần đến.
- Không tả code đang có; chỉ ghi đường dẫn để agent tự đọc.
- Viết rule dạng mệnh lệnh, kiểm chứng được. Ví dụ "chạy `xcodebuild test` trước khi báo xong" dùng được; "viết code sạch" thì không.

**Trạng thái nằm ngoài trí nhớ của agent**
- Tiến độ, quyết định, việc dở dang ghi vào `.work/` và git, không giữ trong hội thoại.
- Đầu phiên đọc trạng thái, cuối phiên ghi lại. Mỗi phiên làm một việc có tiêu chí "xong" rõ ràng.
- Commit nhỏ, thường xuyên để có điểm quay lại an toàn.

**Vòng phản hồi tự động**
- Agent tự kiểm được kết quả: test, lint, build, screenshot.
- Với designer: so frame với design token, chụp ảnh để so sánh.
- Rule bắt buộc thì ép bằng hook, không chỉ nhắc trong prompt.
- Thông báo lỗi đủ rõ để agent tự sửa.

**Chuyên môn hoá theo nghề**
- Mỗi nghề có profile riêng: skill quy trình, command hay dùng, subagent chuyên trách (reviewer, tester, design auditor).
- Ghi rõ "xong" của từng nghề. iOS: build xanh, test xanh, không có warning mới. Figma: dùng đúng component và token, đặt tên layer chuẩn.
- Kết nối công cụ thật qua MCP (Figma, Xcode, Jira) để agent không phải đoán.

**Tự tiến hoá có kiểm soát**
- Cuối phiên chạy retro: lỗi nào lặp lại, người dùng đã sửa agent ở đâu, bước nào tốn thời gian.
- Bài học ghi vào `LEARNINGS.md`. Lặp lại ít nhất 2 lần mới đề xuất nâng thành rule hoặc skill.
- Mọi thay đổi rule đều qua đề xuất kèm lý do; người duyệt mới áp dụng.
- Định kỳ dọn: gộp rule trùng, xoá rule lỗi thời, chuyển rule dài sang skill.
- Lịch sử thay đổi rule nằm trong git để rollback khi một rule làm agent tệ đi.

**An toàn và giới hạn**
- Phân quyền rõ: lệnh nào tự chạy, lệnh nào phải hỏi (xoá file, push, deploy).
- Agent không được tự sửa hook, quyền hay file cấu hình của kit.
- Đo hiệu quả bằng số lần phải can thiệp, số lần test fail và thời gian hoàn thành một việc. Rule không cải thiện các chỉ số này thì bỏ.

**Đa harness**
- `AGENTS.md` làm nguồn chung. Phần riêng của từng harness nằm trong lớp adapter.
- Harness không có hook: chuyển rule bắt buộc thành checklist trong rule mềm.

---

## 10. Cải tiến công cụ, tích luỹ kiến thức, tự cải tiến có kiểm soát

**Improve tools and workflows**
- Khi nào: thao tác thủ công lặp lại từ 2 lần trở lên, hoặc lỗi lọt qua mà máy lẽ ra bắt được.
- Làm gì: đề xuất một trong năm thứ: script, test case, lint rule, hook, command.
- Ghi vào `.work/proposals/`: vấn đề, giải pháp, thời gian ước lượng tiết kiệm, cách gỡ bỏ.
- Ưu tiên kiểm tra bằng máy (test, lint) hơn là thêm một dòng nhắc trong prompt.

**Knowledge compounding**
- Sau mỗi việc xong, tự hỏi điều gì nên biết từ trước để làm nhanh hơn.
- Phân loại nơi lưu: sự thật về dự án vào `DECISIONS.md`; bẫy hoặc mẹo vào `LEARNINGS.md`; quy trình lặp lại thành skill hoặc command.
- Viết tổng quát, kèm ví dụ ngắn. Không chép nguyên log hay kết quả.
- Trước khi bắt đầu việc mới, tra `LEARNINGS.md` và skill liên quan.

**Controlled self-improvement**
- Được tự làm: ghi `.work/`, `LEARNINGS.md`.
- Phải đề xuất và chờ duyệt: rule, skill, hook, cấu trúc thư mục, dependency, kiến trúc.
- Mỗi đề xuất có ba phần: bằng chứng (phiên, commit hoặc lỗi cụ thể), tác động (file nào, harness nào, rủi ro gì), cách đo thành công và cách rollback.
- Tuyệt đối không tự sửa: instructions lõi, quyền, hook an toàn, file của kit.

Bản tiếng Anh để dán vào `AGENTS.md`:

```markdown
## Self-improvement
- Tooling: when a manual step repeats ≥2× or a bug escapes that a machine could catch, propose a script/test/lint rule/hook/command in `.work/proposals/` (problem, solution, time saved, how to remove). Prefer machine checks over prompt reminders.
- Knowledge: after each task, record reusable lessons — project facts → `DECISIONS.md`, pitfalls/tips → `LEARNINGS.md`, repeated procedures → propose a skill. Generalize with a short example; never paste raw logs. Check these before starting new work.
- Control: you may edit `.work/` freely. Rules, skills, hooks, structure, dependencies and architecture change only via an approved proposal with evidence (sessions/commits/errors), impact (files, harnesses, risks), success metric and rollback. Never modify core instructions, permissions, safety hooks or kit files.
```

---

## 11. Ghi chú về `AGENTS.md`

- Từ Claude Code 2.1.277 (tháng 9/2026), Claude Code đọc `AGENTS.md` khi thư mục không có `CLAUDE.md`. Nếu có `CLAUDE.md` ở thư mục làm việc hoặc thư mục cha, `CLAUDE.md` được ưu tiên.
- Claude Code không đọc `AGENTS.local.md`, `AGENTS.override.md`, hay bất kỳ file nào trong thư mục `.agents/`.
- Có thể đổi chế độ đọc trong `/config`, mục "Project instructions". Thiết lập này chỉ nhận ở cấp user hoặc managed, không commit vào repo được.
- Ở phiên đầu tiên sau khi cài hoặc nâng cấp, Claude Code chưa đọc `AGENTS.md`; từ phiên sau mới đọc.
- Repo dùng nhiều tool: để rule chung trong `AGENTS.md`, rồi tạo `CLAUDE.md` chứa `@AGENTS.md` và phần riêng của Claude bên dưới (hoặc symlink `CLAUDE.md` trỏ tới `AGENTS.md`).
- Chỉ dùng Claude Code: `CLAUDE.md` vẫn đủ và có nhiều tính năng hơn.
- Rule luôn nạp tốn context ở mọi lượt, nên luôn giữ ngắn.

---

## 12. Ghi chú về `CLAUDE.md`

- Claude Code đọc `CLAUDE.md` lúc bắt đầu phiên và chèn vào context.
- API không lưu trạng thái giữa các lượt, nên mỗi request đều gửi lại nội dung này. Nhờ prompt caching, phần này thường tốn ít hơn token mới, nhưng vẫn chiếm chỗ trong cửa sổ context.
- `CLAUDE.md` trong thư mục con chỉ nạp khi agent làm việc với file trong thư mục đó.
- Sau `/compact`, `CLAUDE.md` được đọc lại từ đĩa, nên đây là nơi an toàn cho rule cần tồn tại qua các lần nén context.
- Khác với skill: skill chỉ nạp phần mô tả ngắn lúc đầu, nội dung đầy đủ chỉ vào khi cần.
- Gõ `/context` để xem `CLAUDE.md` và các thành phần khác chiếm bao nhiêu token.
