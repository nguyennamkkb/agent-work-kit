# Kịch bản hiển thị — site/index.html

Nguyên tắc: **mỗi thông tin chỉ có một nơi chính.** Chỗ khác cần thì trỏ sang
(`xem mục 0X`), không viết lại. Footer recap giữ nguyên (quy ước chân trang).

## Bản đồ thông tin (fact → nơi duy nhất)

| Thông tin | Nơi chính | Nơi khác xử lý thế nào |
|---|---|---|
| Giá trị bàn (biết việc, bằng chứng) | Hero: H1 + slogan | Không lặp ở section khác |
| ~20 token / 0 thư viện / 30 hoàn tác | Hero stats | Safety chỉ nói cơ chế (`desk undo`, archive), không nhắc số |
| Lệnh cài `init --universal` | 01 terminal | Không lặp ở bước 2 (chỉ nói "khung lệnh ở trên") |
| Node 18+ (`node -v`) | 01 dòng fine + 08 FAQ (có thêm cách xử lý: cài LTS) | Không lặp ở lede |
| Chỉ ghi trong thư mục dự án | 06 ghi chú ("không ghi vào home") | 01 lede không nhắc; footer recap giữ |
| Không cần tài khoản | 01 dòng fine | 06 ghi chú không nhắc |
| Không cần cài thêm gì | Đã bỏ (hiển nhiên sau khi cài xong) | Không nhắc ở lede |
| Chữ `Ready.` cuối cùng | 01 mẫu terminal + bước 2 | Không lặp ở fine |
| Ba gói `--universal/--ios/--designer` | 08 FAQ (chi tiết) | 01 fine chỉ trỏ: "chi tiết ở Hỏi đáp" |
| Cài → việc đầu tiên (6 bước) | 01 (terminal + steps gọn + fine) | Không còn mục riêng |
| Tự làm mới 10 giây | Hero mock-foot (chữ trong sản phẩm) + 05 thẻ dashboard | 01 bước 4 không nhắc |
| Danh sách 6 harness + tin cậy Codex/Pi | 02 tiles + ghi chú | 01 bước 5 chỉ nói "mở agent bạn dùng" |
| 8 trạng thái việc | 03 legend + sơ đồ | Không có thẻ quy tắc riêng |
| Thang P0–P3 | 03 prio-strip | 04 hàng "Gấp" trỏ sang 03 |
| Ví dụ câu nói → bàn làm gì | 04 bảng (tự chứa, ngắn) | Hàng worker trỏ sang 07, không kể lại quy tắc hỏi |
| 3 cách xem bàn | 05 (1 thẻ 3 cột) | Không nhắc lại ở 01 |
| Undo / lý do drop / hỏi trước / gỡ byte-for-byte | 06 (1 thẻ 4 ô) | "Mở worker" thuộc 07, không liệt kê ở 06 |
| Worker cần đồng ý mỗi phiên | 07 panel | 04 hàng worker và 06 không nhắc lại |
| Gỡ: lệnh `remove` + `--purge-desk` | 08 FAQ (cách làm) | 06 card chỉ nói cơ chế (từng byte, giữ `.desk/`) |
| Có cần biết code không | 08 FAQ (trỏ sang 04) | 04 lede không dạy lại |

## Copy chốt từng section
- H1: `Cái bàn cho mọi việc của agent` ("bàn" màu pine, không nghiêng)
- Slogan: `Nhớ mọi việc, xong có bằng chứng.`
- CTA: `Cài trong 30 giây` → #install · `Xem cách dùng` → #say
- Stats: `~20` token/lần · `0` thư viện ngoài, chỉ Node 18+ · `30` bước hoàn tác
- Mock: 3 cột Đang làm / Đang chờ / Kế tiếp + `desk.html · tự làm mới mỗi 10 giây`

### 01 · Cài đặt
- H2: `Dán một dòng lệnh, rồi làm theo 6 bước` ("một dòng" pine)
- Lede: `Mỗi bước nói rõ bạn gõ gì và nhìn thấy gì.`
- Terminal: lệnh + `Chép lệnh` + trạng thái + mẫu output kết thúc `Ready.`
- Steps gọn 1 cột (số + tiêu đề + 1 câu, kết quả gộp trong câu):
  1. Mở terminal đúng thư mục (VS Code / `cd …` — dấu nhắc đúng tên thư mục)
  2. Dán và chạy lệnh cài (khung lệnh ở trên → hiện `Ready.`)
  3. Kiểm tra ba file (`.desk`: `desk.json`, `DESK.md`, `desk.html`)
  4. Mở dashboard (`open`/`start`/bấm đúp — còn trống)
  5. Mở agent bạn dùng trong thư mục dự án (xem mục 02)
  6. Nói việc đầu tiên (ví dụ ra mắt → việc vào `doing`)
- Fine: 3 gói (trỏ Hỏi đáp) · Node 18+, terminal, thư mục · không tài khoản

### 02 · Công cụ (logo thật 6 hãng)
- Lede: hầu hết 0 bước; chỉ Codex và Pi cần 1 lần
- 6 thẻ (logo + tag `0 bước` / `1 lần` vàng): Claude Code, Codex (`/hooks`), OpenCode, Pi (Trust), Oh My Pi, Cursor (checklist, không hook)
- Ghi chú: tự nhận diện tool, mặc định Claude Code

### 03 · Cái bàn
- Lede: agent tự chuyển trạng thái, bạn chỉ cần nói việc
- Sơ đồ vòng đời dựng bằng HTML: luồng chính inbox→todo→doing→review→done (ngang trên desktop, dọc trên mobile) + hàng "ngoài luồng chính" waiting/dropped/failed; mô tả 8 trạng thái nằm ngay trong nút (không còn legend riêng) + prio-strip P0–P3

### 04 · Bạn nói
- Lede: không học lệnh, nói như với đồng nghiệp
- Bảng 8 hàng; hàng "Gấp" trỏ thang 03; hàng worker trỏ mục 07
- Ghi chú: `Dòng cuối là chế độ đội, cần Orca.`

### 05 · Xem bàn (1 thẻ, 3 cột vạch ngăn)
- dashboard (mở trình duyệt, xem mỗi ngày) / DESK.md / terminal (lệnh `desk`)

### 06 · An toàn (1 thẻ, 4 ô: undo / lý do drop / hỏi trước / gỡ từng byte)
- Lede: việc lớn hỏi trước, nhầm vẫn lùi được
- Ghi chú: chỉ ghi trong thư mục dự án, không ghi vào home

### 07 · Đội (tùy chọn)
- Một agent đủ cho hầu hết việc; việc lớn chia worker, worktree riêng, kiểm trước merge
- Cần Orca; không Orca vẫn chạy đủ; **worker đầu tiên mỗi phiên cần bạn đồng ý một lần**

### 08 · Hỏi đáp (1 thẻ, 4 mục vạch ngăn)
1. Cần biết code? → Không; nói tiếng Việt như mục 04; xem bằng `desk.html`
2. Chọn nghề? → chi tiết 3 gói (universal liệt kê use-case)
3. Gỡ? → lệnh `remove` + `--purge-desk`
4. Node nào? → 18+, `node -v`, chưa có thì cài LTS rồi làm lại

### Footer
`Agent Work Kit — Một cái bàn cho mỗi dự án.` + `Node 18+ · Không thư viện · Chỉ ghi trong thư mục dự án · Trang tĩnh, không theo dõi.`

### CTA cuối trang (trước footer)
`Sẵn sàng đặt cái bàn vào dự án?` + `Một dòng lệnh, sáu bước, rồi cứ nói việc.` → #install (không thêm thông tin mới)

## Trình bày (redesign 2026-11)
- Font Be Vietnam Pro + JetBrains Mono; viền mảnh, bóng nhẹ; tự theo dark mode của máy.
- Nav dính trên cùng, gạch chân mục đang xem; hero chia đôi (chữ trái, mock bàn phải).
- Tiêu đề section căn trái: số mục + H2 bên trái, lede bên phải.
- 01: terminal dính bên trái, 6 bước dạng timeline bên phải. 07: khối tối có sơ đồ lead → worker → kiểm → merge.
