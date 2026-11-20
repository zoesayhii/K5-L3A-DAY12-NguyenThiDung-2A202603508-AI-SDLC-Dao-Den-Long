# Credits

## Thư viện
- **three.js** r187 (MIT) — https://threejs.org — dựng đồ họa 3D. Cài qua npm, không sao chép mã vào repo.

## Asset
- **Không dùng asset ngoài.** Mọi hình 3D (đảo, đèn lồng, Mây, Bóng Mực, Gió Lạc, Bùa Gió) được dựng bằng hình khối cơ bản trong mã (`web/main.mjs`).
- **Âm thanh:** nhạc nền và hiệu ứng được tổng hợp bằng Web Audio API trong mã, không có file âm thanh.
- **Phông chữ:** dùng phông hệ thống (`system-ui`), không nhúng phông.
- Ảnh trong `evidence/` là ảnh chụp màn hình do chính game tạo ra.

## Nhân vật và bối cảnh
Mây, Ông Đăng, Bóng Mực, Gió Lạc, Đảo Bến, Đảo Cau, Đảo Chuông thuộc đề bài của lab (nội dung gốc của giảng viên).

## Công cụ AI tạo nội dung
- **Claude Code** (Anthropic, model Claude Sonnet) viết phần lớn mã nguồn, kịch bản kiểm chứng và tài liệu dưới sự điều phối và duyệt của tác giả. Lời thoại giới thiệu Đêm (lời Ông Đăng) do AI viết theo gợi ý của đề bài.
- Nhật ký chi tiết, các lần AI sai và cách phát hiện: xem [docs/RETRO.md](docs/RETRO.md).
