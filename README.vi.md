<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="Logo agent-work-kit">
</p>

<h1 align="center">agent-work-kit</h1>

<p align="center">
  <strong>Phiên nào cũng bắt đầu từ chỗ đã dừng.</strong><br>
  Một cái bàn làm việc chung cho coding agent: nhớ việc, chia việc cho đội, và chỉ báo <em>xong</em> khi có bằng chứng.
</p>

<p align="center">
  <img alt="Giấy phép MIT" src="https://img.shields.io/badge/license-MIT-1B5244">
  <img alt="Node 18 trở lên" src="https://img.shields.io/badge/node-%E2%89%A518-1B5244">
  <img alt="Không thư viện phụ thuộc" src="https://img.shields.io/badge/dependencies-0-1B5244">
</p>

<p align="center">
  <a href="README.md">English</a> · Tiếng Việt
</p>

---

## Vì sao cần

Agent hay mất mạch. Phiên mới quên mục tiêu, một ý phát sinh làm lệch việc đang làm, và "xong" được báo mà không có bằng chứng.

agent-work-kit đặt một cái bàn, `.desk/`, vào dự án và nối agent với nó. Agent sẽ:

- **nhớ**: mục tiêu, việc đang làm, hàng chờ, bài học, qua mọi phiên và cả khi context bị nén;
- **giữ tập trung**: mỗi lúc một việc, ý mới thì vào hàng chờ;
- **chứng minh**: việc chỉ xong khi có bằng chứng, như lệnh kiểm đã đạt hoặc sha của commit;
- **làm theo đội**: việc lớn được chia cho các worker chạy song song qua [Orca](https://github.com/stablyai/orca), mỗi worker một git worktree riêng.

Bạn không phải học lệnh nào. Cài xong, cứ làm việc với agent như bình thường.

## Cài đặt

```bash
npx github:nguyennamkkb/agent-work-kit init --universal
```

Cần Node 18 trở lên, không cần thư viện nào khác. Kit tự nhận ra harness bạn dùng và cài cho nó; không thấy harness nào thì cài cho Claude Code.

Hai harness cần thêm một bước, vì tin cậy là bước bảo mật của chính harness:

- **Codex:** chạy `/hooks` trong dự án và tin cậy hook.
- **Pi:** chọn tin cậy dự án khi được hỏi.

## Xem nó hoạt động

Bạn nói chuyện bình thường. Hook đọc từng câu và giữ bàn luôn đúng:

```text
Bạn   làm màn hình hồ sơ
Bàn   Q-7 Màn hình hồ sơ → đang làm

Bạn   gấp, lỗi token hết hạn quan trọng hơn
Bàn   Q-4 Sửa lỗi token → P0

Bạn   à cái đổi màu nút để sau nhé
Bàn   Q-12 Đổi màu nút → hàng chờ (P2)

Bạn   chờ anh A gửi API rồi làm tiếp
Bàn   Q-6 → chờ, tự quay lại khi có điều kiện

Bạn   nhớ: luôn build bằng scheme X
Bàn   M-2 → bộ nhớ, phiên nào cũng nhớ

Bạn   sai rồi, đừng sửa file đó
Bàn   L-3 → bài học. Gặp lần hai thì thành đề xuất, chờ bạn duyệt

Bạn   chỉnh lại chữ trên nút cho gọn
Bàn   (không ghi gì, 0 token)
```

Mỗi phiên mới mở đầu bằng mặt bàn, khoảng 100 token, nên agent không bao giờ phải hỏi "mình đang làm gì nhỉ?":

```text
desk status
Mục tiêu   Xong luồng thanh toán
Đang làm   [P0] Q-4 Sửa lỗi token hết hạn
           tiếp: viết test refresh
Đang chờ   Q-6 chờ anh A gửi API, tới 01/12
Kế tiếp    [P1] Q-7 Màn hình hồ sơ
Cần nhớ    Luôn build bằng scheme X
Vừa xong   Q-3 Nút đăng nhập
```

## Đời của một việc

```
 inbox ──▶ todo ──▶ doing ──▶ (review) ──▶ done  ← cần bằng chứng
             ▲  │     │
             │  ▼     ▼
           waiting   dropped (có lý do, lấy lại được) · failed
```

- **Mỗi lúc một việc** với agent chính. Việc mới xếp hàng.
- **Không bằng chứng, không xong.** `done Q-4` bị từ chối. `done Q-4 --proof "test: 42 đạt"` được nhận.
- **Lối rẽ nào cũng có lý do.** Việc huỷ và việc thất bại đều ghi lý do, và `desk undo` lùi lại được.

Bàn cũng tự dọn, không tốn token: việc bị bỏ quên thì tụt ưu tiên, điều được nhắc ba lần thì ghim vào bộ nhớ, việc đang chờ tự quay lại khi tới hạn.

## Dashboard

Mở `.desk/desk.html` bằng trình duyệt. Một file duy nhất, không cần server, tự làm mới mỗi 10 giây.

| Phần | Cho bạn thấy |
|---|---|
| Đèn sức khoẻ | xanh, vàng hoặc đỏ, kèm lý do |
| Cần bạn | câu hỏi, báo cáo chờ kiểm, đề xuất chờ duyệt, mỗi mục kèm lệnh để chép |
| Đội | ai làm gì, bao lâu; cảnh báo khi worker im lặng |
| Model | tỉ lệ thành công và cycle time theo từng model |
| Board | kanban có bộ lọc và ô tìm kiếm |

Thích văn bản hơn? `.desk/DESK.md` là cùng cái bàn dưới dạng đọc nhanh, và `npx github:nguyennamkkb/agent-work-kit desk` in nó ngay trong terminal.

## Làm việc theo đội

Với việc lớn, agent chọn tầng rẻ nhất mà vẫn đủ, và chỉ leo tầng khi có bằng chứng (quá khoảng 3 file, 15 lần gọi công cụ, hoặc build đỏ lần thứ hai):

| Tầng | Ai làm | Dùng cho |
|---|---|---|
| T0 | agent chính | 1 đến 3 file |
| T1 | subagent của harness | đọc, khảo sát |
| T2 | một worker Orca | một module, chạy lâu |
| T3 | engineer + tester, worktree riêng | nhiều module, cần cổng test |
| T4 | mỗi plan một lead | từ 2 plan cùng lúc |

Quy trình cố định: **plan → việc → giao → kiểm → đóng.**

1. `desk plan` ghi quyết định, thứ tự các bước và tiêu chí xong.
2. Mỗi lần giao là một việc ghi rõ file nó sở hữu; hai việc đang mở không bao giờ chung một file.
3. `desk dispatch` chọn model, viết brief và mở worker. Worker đầu tiên của một phiên chỉ được mở sau khi agent hỏi bạn.
4. Agent đọc báo cáo của worker, kiểm commit và diff so với plan, rồi mới đóng việc.
5. `desk gate` chỉ cho plan merge khi mọi việc đã đóng, tester xanh trên HEAD hiện tại và nhánh đã rebase. Bạn là người đồng ý merge.

Cần [Orca](https://github.com/stablyai/orca) và `git`. Không có Orca thì mọi thứ vẫn chạy với một agent.

## Hợp với

Claude Code, Codex, OpenCode, Pi, Oh My Pi và Cursor. Tất cả dùng chung một bàn. Cursor chỉ có rule và checklist vì không có hook.

## An toàn

- **Hỏi trước** khi push, merge, deploy, thêm dependency hoặc mở worker.
- **Hoàn tác** mọi thay đổi trên bàn (`desk undo`); việc đã huỷ lấy lại được.
- **Luật chỉ đổi khi bạn đồng ý**, kèm nguyên văn lời bạn.
- **Ở lại trong dự án.** Không gửi gì ra ngoài, không cần tài khoản, và `remove` trả mọi file về đúng từng byte.

## Lệnh

`npx github:nguyennamkkb/agent-work-kit <lệnh>`

| Lệnh | Việc |
|---|---|
| `init --universal` | dựng bàn và hook |
| `update` | cập nhật kit và luật, giữ phần bạn đã ghi đè |
| `doctor` | kiểm tra cài đặt |
| `desk` | xem bàn |
| `remove` | gỡ kit (thêm `--purge-desk` để xoá cả bàn) |

## Tìm hiểu thêm

- [`DESK-SPEC.md`](DESK-SPEC.md): đặc tả kỹ thuật.
- [`kit/method/docs/team.md`](kit/method/docs/team.md): hướng dẫn đầy đủ về làm việc theo đội.

## Giới hạn

Việc nhận ra lời gấp, lời sửa và lời đồng ý dựa trên từ khoá, nên có thể sót hoặc nhầm; nhầm thì `desk undo` là xong. Mỗi harness mới được kiểm bằng cách nạp đúng file kit sinh ra, chưa chạy end-to-end với model thật.

## Giấy phép

[MIT](LICENSE)
