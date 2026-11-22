# Đặc tả: Cái bàn làm việc (v2)

Đây là đặc tả kỹ thuật của agent-work-kit 0.2. Phần hướng dẫn dùng nằm ở [README.md](README.md); vì sao có v2 và kế hoạch làm ra nó nằm ở [PLAN-v2.md](PLAN-v2.md).

## 1. Cài đặt

- `npx github:nguyennamkkb/agent-work-kit init --<nghề>`: mỗi dự án một bàn, mỗi bàn một nghề. Nghề có sẵn: `--ios`, `--designer`, `--universal` (mọi việc, theo phương pháp chuyên nghiệp: UNI-001…010).
- Harness được tự phát hiện, hoặc chọn bằng cờ `--claude --codex --opencode --pi --omp --cursor`.
- Kit chỉ ghi vào thư mục dự án. Chạy qua `npx` thì kit tự dọn cache của chính nó.
- Không cài global. Không dependency. Chỉ cần Node ≥ 18. `git` nên có (commit là các mốc của bàn), và bắt buộc khi làm theo đội, cùng với `orca`.

## 2. Dữ liệu bàn

**Nguồn sự thật** là `.desk/desk.json`, có `version: 2`. Chỉ lệnh `desk` và các hook được ghi file này; mỗi lần ghi đều qua khoá thư mục (`.desk/.lock/`) và ghi atomic.

| Trường | Nội dung |
|---|---|
| `seq` | bộ đếm id theo loại (`Q` việc, `M` nhớ, `L` bài học, `P` đề xuất). Id không bao giờ dùng lại, kể cả id trong archive hay của bàn v1 |
| `goal` | ≤ 5 dòng: đích đến và cách biết đã tới |
| `items[]` | việc (`kind: task`), điều cần nhớ (`memory`), bài học (`lesson`) |
| `leases` | tài nguyên độc quyền đang được giữ: `{ holder, at, expires }` |

**Một việc** có các trường: `id`, `status`, `prio` (P0–P3), `text`, `done` (điều kiện xong), `next`, `refs`, `files` (file sở hữu), `deps`, `parent`, `on`/`until` (đang chờ ai/gì, tới ngày nào), `created`/`last`/`uses`, `proof`/`sha`/`why`, `history[]` (giữ 20 mục gần nhất). Phần đội có thêm: `plan`, `role`, `executor` (`lead` | `subagent` | `orca`), `tier`, `level`, `agent`, `model`, `dispatch`, `terminal`, `worktree`, `baseSha`, `run`, `route`, `spec`, `question`.

**Bất biến:**
1. Lead chỉ có một việc `doing`. `start` hay `add --now` sẽ cất việc cũ về `todo`, kèm `next`.
2. `done` bắt buộc có `--proof` hoặc `sha`. Việc cha chỉ đóng được khi mọi việc con đã đóng, và tự đóng khi mọi việc con xong.
3. `drop` và `fail` bắt buộc có lý do.
4. Việc `waiting` tự quay lại `todo` khi việc nó chờ (`on: Q-n`) xong, hoặc khi tới ngày `until`.
5. Hai việc đang mở không được sở hữu chung một file, trừ khi việc này phụ thuộc việc kia. File của lead (`team.json` → `leadFiles`) chỉ việc có vai trò `lead` được nhận.
6. Việc đã đóng được ghi vào `archive/YYYY-MM.md` và `archive.jsonl`. Bàn chỉ giữ 12 việc đóng gần nhất.
7. Mỗi lần thay đổi đều lưu một ảnh chụp vào `.undo/` (giữ 30 bản); `undo` khôi phục bản trước đó.

**File sinh ra từ dữ liệu:** `DESK.md` (để đọc, có commit) và `desk.html` (dashboard, không commit). Cả hai được sinh lại sau mỗi lần ghi.

**File agent được ghi trực tiếp:** `plans/**/*.md`, `review/[PU]-*.md`, `team.json` (phải là JSON hợp lệ, routing hợp lệ) và `rules.local.md` (lint; luật mới hoặc luật bị sửa phải dẫn một đề xuất đã duyệt). Mọi file khác trong `.desk/` đều bị hook chặn.

## 3. Sắp xếp tự động (hook đầu phiên)

- Việc `todo` không được đụng tới trong 5 phiên thì tụt một bậc ưu tiên. Việc P3 cũ thì bị `dropped` với lý do "stale", undo được. Việc con không bị đụng tới.
- Điều cần nhớ được dùng từ 3 lần trở lên thì được ghim. Điều đã ghim mà 5 phiên không dùng thì bỏ ghim. Tối đa 10 điều được ghim.
- Đánh thức các việc đang chờ đã đủ điều kiện.
- Mức độ quan trọng (`uses`, `last`) tăng khi người dùng nhắc tới một mục (bằng id, hoặc ≥ 2 từ trùng nhau) và khi agent sửa một file nằm trong `refs` hoặc `files` của mục đó (mỗi mục một lần mỗi ngày).
- Bài học trùng nội dung thì tăng `seen`. Từ `seen ≥ 2` trở lên, agent đề xuất cách sửa tận gốc.

## 4. Hook

| Hook | Việc |
|---|---|
| `session-start` | Đếm phiên; xoá các lời nhắc cũ và quyền mở worker của phiên trước; sắp xếp tự động; in mặt bàn (~100 token). Trong terminal hay worktree của worker thì chỉ in việc của worker đó. |
| `capture` | Ghi nhật ký câu người dùng. Tự ghi: "nhớ…" (không phải câu hỏi) → memory; lời sửa → lesson; "gấp" + một việc được nhắc tới → P0. Chỉ gợi ý khi có tín hiệu: để sau, chờ, bỏ, đồng ý, chia đội. Câu bình thường không in gì. |
| `guard` (trước khi ghi) | Bảo vệ dữ liệu bàn, file của kit, vùng agentkit và manifest. Chặn ghi vào bản sao `.desk/` trong worktree. |
| `desk-check` (sau khi ghi) | Lint `rules.local.md` và `team.json`. |
| `stop-check` | Nhắc **một lần** cho mỗi tổ hợp vấn đề: hộp vào còn việc; code đổi sau lần cập nhật bàn cuối; còn báo cáo `review` chưa kiểm; còn câu hỏi của worker chưa trả lời; worker chưa báo cáo. |

## 5. Luật nghề: ba lớp, ghép theo ID

1. **Phương pháp** (`kit/method/SKILL.md`) và **gói nghề** (`kit/profession/<nghề>/rules.md`, mỗi luật `### ID · P0-3` kèm `- Why:` và `- Check:`) được ghép thành một skill, do kit sở hữu.
2. **Luật dự án** nằm ở `.desk/rules.local.md`: `### ID · override|off|P0-3`. Luật nào cũng phải dẫn một `P-` đã được duyệt.
3. **`update` so luật theo ID:**
   - luật mới thì thêm vào;
   - luật đổi hay bị bỏ thì áp dụng;
   - luật mà dự án đang ghi đè hoặc tắt thì giữ nguyên luật dự án, ghi `archive/U-<ID>-v<ver>.md`, và thêm một mục vào inbox để agent báo người dùng một lần.
4. **Đề xuất** được tạo bằng `desk propose`. `desk approve` bắt buộc có `--quote` (nguyên văn lời người dùng). Lệnh `review` dành cho người.

## 6. Đội

- **Hồ sơ** `.desk/team.json` gồm: `mainBranch`, `build`, `test {command, exclusive, scope}`, `leadFiles`, `maxWorkers` (3), `maxPlanWorktrees` (3), `plansDir` (`.desk/plans`), `notes`, và `routing {deny, roles}`. Gói nghề cung cấp giá trị mặc định (iOS: tài nguyên độc quyền `simulator`, `leadFiles` gồm `project.pbxproj`…). Thiếu `routing.roles` thì kit sinh routing từ các agent CLI có trên máy (claude → omp → pi → opencode → codex).
- **Ứng viên routing** có dạng `agent[:model][@effort]`. Thứ tự thử: `--prefer` → `use` → `fallback`; khi `--fails ≥ 2` thì `escalate` được thử trước. Giá trị `orchestrator` nghĩa là lead tự làm. Kiểm hợp lệ: agent có trong danh sách, effort đúng quy tắc của agent, một model chỉ dùng một effort, model không khớp `deny`, model có trong danh sách của omp hoặc opencode (cache 6 giờ).
- **Quy tắc effort** theo Orca 1.4.268: claude, codex, cursor, antigravity, grok, muse, pi dùng `--effort`; omp dùng `--model id:level`; opencode, zcode không có effort; opencode chỉ chọn model được trong worktree đã có sẵn.
- **`dispatch`** từ chối khi:
  - chưa có `team allow --quote` trong phiên này;
  - không có Orca;
  - việc không ở `todo`;
  - plan không có file;
  - còn phụ thuộc chưa xong, hoặc trùng file sở hữu;
  - đã đủ `maxWorkers`;
  - plan đang bị park;
  - việc mức L4.

  Nếu không bị từ chối, `dispatch`:
  1. sinh brief nếu chưa có (`plans/specs/<id>.md`) và thêm phần lệnh báo cáo (`<id>.sent.md`);
  2. gọi `orca orchestration worker-start`; khởi chạy lỗi thì loại model đó và thử ứng viên kế (tối đa 3 lần);
  3. ghi dispatch, terminal, worktree, `baseSha`, route vào việc.
- **Lead nhận thư bằng `mail`:** mỗi Run một lần `check` không chờ. Báo xong (`worker_done`) → `review` (hoặc `failed`); câu hỏi → `question`; leo thang → `waiting on lead`. `reply` và `send` nhắn qua Orca. `sync` đối chiếu với `worker-list` và chuyển trạng thái nếu có `--apply`.
- **Worker báo xong bằng `worker <id> done`:** phải có commit kể từ `baseSha`. Lệnh xét thay đổi tổng giữa `baseSha` và HEAD (bỏ qua `.desk/`): không được có file ngoài `files`, và file sở hữu không được còn thay đổi chưa commit.
- **Worktree:** `wt open|park|close|drop|tidy|status` qua `orca worktree`, với các trạng thái ACTIVE, WAITING, READY, EMPTY, DIRTY, PARKED, MERGED. `close` chỉ chạy khi plan đã merge; `drop` cần `--yes` và in ra sha để khôi phục.
- **`gate`** kiểm máy móc:
  - mọi việc của plan đã đóng, không việc nào failed;
  - có tester xanh trên HEAD;
  - nhánh chứa main;
  - worktree sạch.

  Đọc diff và xin phép merge vẫn là việc của lead.
- **Một bàn cho cả đội:** trong worktree, `deskRoot` trỏ về checkout chính qua `git --git-common-dir`. Worker gọi lệnh bàn bằng đường dẫn tuyệt đối tới `desk.mjs` của checkout chính.

## 7. Quyết định thiết kế

**Giữ từ v1:**
1. Phương pháp và luật nghề là một skill duy nhất. Luật dự án nằm riêng, không ghép vào skill.
2. Không cài global; muốn quay về bản cũ thì dùng git.
3. Người dùng không phải làm gì: mục tiêu, việc, ưu tiên và điều cần nhớ đều được suy ra; đề xuất được duyệt bằng một câu trong chat.
4. Mỗi harness nối vào bằng cơ chế native, đã xác minh trên bản cài (Codex 0.171, OpenCode 2.3.2, Pi 1.6.0, omp 18.3.2). Cách chuẩn hoá lệnh ghi file và các bridge cho Pi, omp, OpenCode giữ nguyên như v1.
5. npm loại bỏ file `.gitignore` khi đóng gói, nên mẫu được ship dưới tên `gitignore`. Khi `update`, kit bổ sung các dòng còn thiếu vào `.desk/.gitignore`.

**Mới ở v2:**
6. **Dữ liệu và bản để xem tách riêng.** Agent không còn sửa file markdown, nên không cần lint định dạng nữa, và mỗi thao tác rẻ hơn khoảng 95% token.
7. **Hook tự ghi** những gì chắc chắn, và im lặng khi không có gì đáng nói.
8. **Mở worker phải có lời đồng ý trong phiên**, và lệnh chặn thật sự chứ không chỉ là luật trên giấy.
9. **Bàn v1 tự được chuyển sang v2.** File cũ nằm ở `archive/v1/`. Id mới tiếp nối sau mọi id cũ.
10. **Manifest đổi trường `nghe` thành `profession`.** Manifest cũ vẫn đọc được.

**Giới hạn đã biết:**
- Nhận diện tín hiệu dựa trên từ khoá.
- Cursor không có hook.
- Chưa chạy end-to-end với model thật.
- Phần đội mới được kiểm với Orca giả và các lệnh chỉ đọc trên Orca thật.
- T4 phase A bị Orca chặn mặc định, vì độ sâu worker lồng nhau tối đa là 1.
