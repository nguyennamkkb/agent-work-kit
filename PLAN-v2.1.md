# Kế hoạch v2.1: dashboard chuyên nghiệp và lưu trữ gọn

> Trạng thái: **đã triển khai** (agent-work-kit 0.2.1). Tiếp nối [PLAN-v2.md](PLAN-v2.md). Đặc tả: [DESK-SPEC.md](DESK-SPEC.md).

## 1. Bài toán

1. **Dashboard quá cơ bản.** Nó chưa trả lời được ba câu hỏi của người điều hành:
   - Có gì cần tôi xử lý không?
   - Đội đang làm gì, có ai bị kẹt không?
   - Tiến độ tới đâu rồi?
2. **Dữ liệu phình theo thời gian.**
   - Không giới hạn: `.journal.jsonl` (~30 MB/năm), `archive.jsonl` (lưu cả lịch sử của từng việc, và bị đọc toàn bộ khi kiểm việc phụ thuộc), `plans/specs/*.sent.md`, memory và lesson.
   - Mỗi thao tác ghi 4 file (~17 KB), kể cả khi hook chỉ tăng bộ đếm. Vì vậy `desk.json` gây nhiễu trong git.

## 2. Lưu trữ

| # | Thay đổi | Hiệu quả |
|---|---|---|
| S1 | `mutate` so dữ liệu trước và sau (bỏ qua `updated`); không đổi thì không ghi gì | bỏ hết các lần ghi thừa |
| S2 | Thao tác ghi chép (`bookkeeping`: hook tăng bộ đếm, ghi nhận file được sửa) chỉ ghi `desk.json`: không tạo undo, không vẽ lại view | ~70% số lần ghi |
| S3 | Bộ đếm "được nhắc tới" tăng tối đa một lần mỗi ngày cho mỗi mục (cả khi nhắc trong câu lẫn khi sửa file) | diff git nhỏ, ổn định |
| S4 | Journal: câu không có tín hiệu chỉ lưu thời điểm và id liên quan; quá 256 KB thì giữ nửa mới nhất | ~30 MB/năm → < 300 KB, cố định |
| S5 | Archive chia theo tháng, `archive/YYYY-MM.jsonl`, chỉ lưu bản tóm tắt (id, kind, trạng thái, prio, nội dung, bằng chứng/lý do, sha, plan, role, agent, model, thời điểm bắt đầu/đóng, số lần thất bại). Đọc từ tháng mới nhất trở về trước, dừng ngay khi thấy. `archive.jsonl` cũ tự được chuyển sang | đọc ít, file nhỏ |
| S6 | `compact` (tự chạy đầu phiên, chạy tay được): `*.sent.md` của việc đã đóng quá 30 ngày → xoá; memory không ghim mà 30 phiên không dùng → archive; lesson ×1 không có đề xuất mà 20 phiên không gặp lại → archive | `desk.json` không phình |
| S7 | `restore ID` lấy lại một việc, memory hay lesson từ archive | không mất gì |

## 3. Dashboard

Vẫn là một file HTML duy nhất: không CDN, mở thẳng bằng `file://`, biểu đồ SVG tự vẽ, sáng/tối theo hệ thống, dùng được trên điện thoại. Tự làm mới mỗi 10 giây mà vẫn giữ bộ lọc, tab, vị trí cuộn và ngăn đang mở (lưu bằng `localStorage`, có xử lý lỗi).

| Phần | Nội dung |
|---|---|
| Thanh trên | dự án · nghề · mục tiêu · đèn sức khoẻ (xanh/vàng/đỏ, kèm lý do) · Orca · worker/giới hạn · thời điểm cập nhật |
| Chỉ số | doing · queue · waiting · verify · xong trong 7 ngày · cycle time trung vị · tỉ lệ làm lại |
| Cần bạn | câu hỏi của worker, báo cáo chờ kiểm, đề xuất chờ duyệt, việc thất bại, việc đang chờ bạn, hộp vào; mỗi mục kèm sẵn lệnh |
| Đội | mỗi worker một thẻ: vai trò · agent·model·effort · việc · plan · worktree · thời gian chạy · ghi chú gần nhất · file · lease · sha · **im lặng > 15 phút** · đang hỏi. Vai trò chưa có việc thì hiện "rảnh" |
| Dòng thời gian | mỗi vai trò một làn, xem 24 giờ hoặc 7 ngày; khối màu theo trạng thái, dựng từ lịch sử |
| Plan | tiến độ, trạng thái worktree (ACTIVE · WAITING · READY · PARKED), việc mở và việc đã đóng |
| Kanban | Todo · Doing · Waiting · Review · Done; lọc theo plan, vai trò, agent; ô tìm kiếm; giới hạn số việc đang làm |
| Hoạt động | 60 sự kiện gần nhất của cả đội |
| Hiệu quả model | theo từng model: số lần giao, số lần xong, số lần thất bại, số lần leo thang, cycle time |
| Bộ nhớ · Bài học · Đề xuất · Lease | các tab |
| Ngăn chi tiết | lịch sử đầy đủ, route, brief, bằng chứng, sha, phụ thuộc, việc con |

Chỉ số được tính bằng Node (`store.metrics`) và nhúng sẵn vào trang, nên có test. Trang chỉ lo hiển thị.

## 4. Kiểm tra

- Test lưu trữ:
  - không đổi thì không ghi;
  - thao tác ghi chép không tạo undo;
  - journal xoay vòng;
  - archive theo tháng và tìm phụ thuộc trong archive;
  - `compact` và `restore`;
  - archive cũ được chuyển sang.
- Test chỉ số: cycle time, tỉ lệ làm lại, sức khoẻ, worker im lặng.
- Test dashboard: dữ liệu nhúng có team, worktree, chỉ số; trang không tải gì từ ngoài.
- Đo lại số lần ghi và dung lượng trên demo; cập nhật README và DESK-SPEC.
