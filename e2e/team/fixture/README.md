# Linh Studio — landing page

Landing page một trang cho **Linh Studio**, freelancer thiết kế đồ hoạ. Nội dung tạm thời là placeholder, tiếng Việt.

## Yêu cầu

- Một file `index.html` (CSS/JS đặt trong `assets/`), không dùng tài nguyên ngoài: không CDN, không Google Fonts.
- Các khối có `id`: `hero`, `work`, `services`, `about`, `contact`.
- `<html lang="vi">`, có `<title>`; ảnh nào cũng có `alt`; liên hệ bằng link `mailto:`.
- Phong cách: tối giản, nhiều khoảng trắng, tông ấm, chữ serif lớn; không hiệu ứng chuyển động.

## Lệnh

| | |
|---|---|
| Build (kiểm cấu trúc) | `node scripts/check.mjs` |
| Test | `node --test` |

`tests/` và `package.json` là của lead: worker không sửa.
