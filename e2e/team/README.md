# Test chế độ đội (lead điều phối worker)

Mục tiêu: kiểm chứng với **model thật** rằng một agent lead tự dùng kit để điều phối đội qua Orca:
1. xin phép người dùng;
2. lập plan, mở worktree;
3. `dispatch` một engineer và một tester;
4. nhận báo cáo bằng `desk mail`, kiểm kết quả;
5. chạy `gate`, merge khi được phép.

Mỗi lần test đều bắt đầu từ trạng thái sạch và chạy trên một harness. Thứ tự: Pi → omp → OpenCode.

## Vai trò

| Ai | Là gì | Ghi chú |
|---|---|---|
| **Người dùng** (người chạy test) | giao việc một lần lúc mở lead (đã kèm sẵn quyền); sau đó chỉ quan sát | không giúp lead, không nhắc lệnh `desk`, không trả lời hộ |
| **Lead** | agent của harness đang test, mở bằng `orca agent launch` trong thư mục dự án | chỉ điều phối; không tự viết trang |
| **Engineer** | worker do lead `dispatch` | viết `index.html` + `assets/`; chỉ build, không chạy test |
| **Tester** | worker do lead `dispatch` | giữ lease `test-runner`; chạy `node --test`; báo kết quả |

## Dự án mẫu (`fixture/`)

Landing page "Linh Studio":
- **Build:** `node scripts/check.mjs` kiểm cấu trúc trang.
- **Test:** `node --test` gồm 5 test trong `tests/` (ngôn ngữ, các khối theo đúng thứ tự, `alt` cho ảnh, `mailto`, không dùng tài nguyên ngoài và không có chuyển động).
- **Lúc bắt đầu:** chưa có trang, nên build và test đều đỏ.
- **File của lead:** `package.json`, `tests/page.test.mjs`, `scripts/check.mjs`.

**Hồ sơ đội** do `setup.sh` ghi vào `.desk/team.json`:
- build và test như trên;
- tài nguyên độc quyền `test-runner`;
- tối đa 2 worker;
- routing mọi vai trò dùng đúng harness và model đang test, mặc định `opencode-go/deepseek-v4.1-flash`.

## Chạy một lần test

```bash
e2e/team/setup.sh pi                  # dọn sạch, dựng dự án, cài kit (GitHub), cấu hình đội, đăng ký Orca
# … chạy các bước bên dưới …
e2e/team/collect.sh pi                # gom bằng chứng vào ~/Documents/dev/desk-team-results/
e2e/team/clean.sh                     # dọn sạch: terminal, worktree của plan, thư mục, git
```

`KIT=local e2e/team/setup.sh pi` cài từ repo trên máy thay vì từ GitHub. `e2e/team/setup.sh omp opencode-go/hy4-flash-free` chọn model khác; model miễn phí bị routing chặn mặc định (`*free*`), muốn test thì thêm `TEAM_DENY=`.

## Lời giao việc cho lead

**Lead tự quyết, không hỏi lại.** Lời giao việc ban đầu đã ghi sẵn quyền mở worker và quyền merge, nên lead chạy `team allow --quote` bằng chính câu đó rồi làm tới cùng. Người chạy test chỉ gửi thêm khi lead đứng yên quá lâu.

| # | Gửi lúc | Nội dung | Kỳ vọng |
|---|---|---|---|
| L1 | lúc mở lead (`--prompt`) | `Bạn là lead của dự án này (đọc README.md). Mục tiêu: landing page Linh Studio với build và test xanh. Làm theo đội: một engineer viết trang, một tester chạy test; bạn chỉ điều phối, không tự viết trang. Mình cho phép mở tối đa 2 worker và cho phép merge vào main khi gate đạt. Bạn tự quyết mọi bước, không hỏi lại mình; cần sửa file của lead thì tự sửa và ghi lý do. Giao việc qua kit (đọc .agentkit/docs/team.md), xong thì báo kết quả cuối cùng.` | đọc `team.md`; `desk plan`; thêm việc có role, files, deps; `team allow --quote "<câu trên>"`; `wt open`; `dispatch` engineer; kết thúc lượt, không ngồi chờ |
| — | Orca tự đánh thức lead khi worker báo cáo | (không gửi gì) | `desk mail`; kiểm sha và diff; `done`; `dispatch` tester; tester giữ lease rồi trả; nếu HEAD đổi thì retest; `gate`; merge `--no-ff`; `wt close`; báo kết quả |
| L5 | phiên lead **mới**, sau khi xong | `Tóm tắt: đội đã làm gì, ai làm gì, kết quả test ra sao?` | trả lời đúng từ bàn, không đoán |

Nếu lead vẫn mở hộp hỏi, hoặc đứng yên quá lâu trong khi worker đã báo cáo, thì **ghi lại như một phát hiện**: hỏi lại dù đã được trao quyền là lỗi. Sau đó mới trả lời, hoặc gửi `Kiểm tra mail của đội và làm bước tiếp theo.`

## Tiêu chí

- **Bắt buộc:**
  - lead **không hỏi lại**: dùng quyền có sẵn trong lời giao việc (`team allow --quote`);
  - worker được mở bằng `desk dispatch`, không phải gọi `orca` trực tiếp;
  - mọi worker có việc trên bàn với đúng trạng thái;
  - báo cáo của worker được áp dụng vào bàn qua `desk mail`;
  - `gate` chạy đúng;
  - build và test xanh trên `main` sau khi merge;
  - không còn rác sau `clean.sh`.
- **Ghi lại:** thời gian; số lần phải nhắc lead; lỗi của kit (sai cờ của Orca, sai dạng dữ liệu thư); worker có sửa file ngoài phạm vi không; lease có được giữ và trả đúng không.
