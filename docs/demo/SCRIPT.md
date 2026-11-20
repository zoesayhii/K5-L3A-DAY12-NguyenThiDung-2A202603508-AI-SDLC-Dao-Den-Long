# Kịch bản video demo (dưới 5 phút)

_Video chưa được quay trong môi trường làm việc (không quay màn hình được). Làm theo kịch bản này rồi lưu `docs/demo/demo.mp4` hoặc đính kèm Release `v1.0.0`._

1. **(0:00–0:20)** Giới thiệu: tên game, 3 Đêm, mục tiêu "giữ sáng tới bình minh". Mở `npm start`.
2. **(0:20–2:20)** Chơi trực tiếp Đêm 1: nhặt đom đóm, thắp đèn (E), châm dầu, Tỏa Sáng (F), lướt (Shift), thấy mũi tên đỏ/viền đỏ khi Bóng Mực tới. Cho thấy HUD, thanh dầu, đèn nhấp nháy khi < 30.
3. **(2:20–3:00)** Chuyển nhanh Đêm 2 (bục nhảy) và Đêm 3 (dốc, gió). Mở Cài đặt: đổi phím, chữ lớn, bảng màu dễ phân biệt.
4. **(3:00–3:30)** Kết thúc một Đêm, nhập tên lưu bảng xếp hạng, mở bảng xếp hạng.
5. **(3:30–4:30)** Terminal: `bash scripts/verify.sh` (197 kiểm tra), `node --expose-gc sim/soak.mjs ...`, `node bench/run.mjs ...`, mở `bench.json`/`soak.json`.
6. **(4:30–5:00)** Lướt qua `git log --oneline` và tag `phase-1..4`, README, retro.

Gợi ý nén: `ffmpeg -i in.mkv -vf scale=1280:-2 -crf 28 -preset slow demo.mp4`.
