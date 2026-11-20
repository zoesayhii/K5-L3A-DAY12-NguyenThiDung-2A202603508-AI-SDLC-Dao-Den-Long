# Spec Phase 2 (Ticket-02, contract v1.1)

Nguồn: Ticket-02 "Ba hòn đảo". Số chuẩn nằm trong `game.contract.json`, bản đồ trong `sim/maps.mjs`, luật trong `sim/sim.mjs`. Mỗi tiêu chí dưới đây có kiểm tra tương ứng trong `scripts/verify.mjs` (log: `evidence/phase-2/verify.log`).

## Tiêu chí nghiệm thu: Phần 3 (tính năng mới)
| Mục | Tiêu chí (làm A thì thấy B) | Trạng thái |
|---|---|---|
| Lướt | Bấm lướt: 14 m/s trong 12 tick theo hướng di chuyển (đứng yên thì hướng đang quay), hồi chiêu 1.5 s từ lúc bắt đầu, không bất tử, giữ độ cao khi ở trên không | Headless đạt |
| Gió Lạc | Mang ≥5 và ≤15 m: idle→chase. Chạm ≤1.2 m: cướp min(3, mang), flee 240 tick rồi biến mất, 1 lần/con, không mất Ngọn Lửa, bất tử không ngăn cướp. Tỏa Sáng trúng chase: flee không cướp; trúng flee đang mang: thả lại, biến mất sau 120 tick. Sinh tick 1200, 2400…, tối đa 2, id D1… | Headless đạt |
| Bùa Gió | Nhặt: 600 tick, chạy 7.2 m/s, lướt không hồi chiêu (nhấn khi đang lướt bị bỏ qua), nhặt lại làm mới, xuất hiện lại sau 2700 tick. Vị trí theo Đêm | Headless đạt |
| Gió mạnh (Đêm 3) | Mỗi 30 s một cơn 5 s, đẩy 2 m/s theo `dir_deg`, báo trước 2 s | Headless đạt (báo trước bằng lá bay/âm thanh: chưa làm) |
| Bục nhảy, tầng, dốc, tháp | Theo Phần 2: phóng đúng vận tốc, đáp đúng đảo/tầng; vách đứng chặn; dốc 30°/150° đi lên được; tháp r=2 chặn | Headless đạt |
| Rơi khỏi đảo | Y<−10 đúng 1 lần, bỏ qua bất tử, −1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh bất tử 90 tick; hết lửa thì thua ngay | Headless đạt |
| Tạm dừng | Logic dừng hoàn toàn (sim_tick, thời gian, hồi chiêu, sinh), snapshot `paused`, event paused/resumed | Headless đạt; menu tạm dừng UI: chưa làm |
| Chuỗi 3 Đêm, menu, giới thiệu, kết quả, Bình Minh | Theo Ticket | **Chưa làm** (UI) |
| Cài đặt (âm lượng, độ nhạy chuột, lưu giữa các lần mở) | Theo Ticket | **Chưa làm** (UI) |
| Âm thanh | Nhạc nền + hiệu ứng theo danh sách Ticket | **Chưa làm** (UI) |
| HUD đầy đủ | Theo Ticket | **Chưa làm** (UI) |
| Bảng màu chuẩn, ánh sáng môi trường 0.15 + 0.55 × tiến độ | Theo Ticket | **Chưa làm** (UI) |

## Sai lệch có chủ ý so với Ticket
- **Tốc độ Bóng Mực** giảm còn 2.8 m/s (Đêm 3: 3.2 m/s) thay vì 4.0 (4.5) theo yêu cầu của người làm bài, để game dễ chơi hơn. Đây là **sai lệch khỏi số chuẩn bắt buộc của Ticket**: headless của tôi sẽ không khớp bản chuẩn, có thể mất điểm test ẩn. Muốn quay lại chuẩn: đặt `shade_speed` = 4.0 và `shade_speed_night3` = 4.5 trong `game.contract.json`.

## Giả định Phase 2 (chỗ Ticket chưa nói)
- **Đêm 3 xuất phát:** (0,0,−30) trên tầng 0, vì (0,0,0) nằm trong tháp chuông. Hồi sinh sau khi rơi cũng ở điểm xuất phát của Đêm đó. Đêm 2 xuất phát (0,0,0).
- **Hướng quay ban đầu:** +Z.
- **Góc:** (x, z) = r·(cos θ, sin θ). Dùng cả cho điểm sinh, dốc, và `dir_deg` của gió.
- **`night_start`:** phát ở tick 1 (setup không phát event).
- **Bóng Mực `spawning`:** kéo dài 1 tick (tick sinh), tick sau chuyển `wander`. Wander đi ngẫu nhiên 2 m/s, đổi hướng mỗi 120 tick. Hết `recoil`/`stunned` thì về `chase` nếu cách Mây ≤12 m, không thì `wander`.
- **Điểm nạp:** +10 mỗi đom đóm được nạp (không cộng lúc nhặt). Đêm headless chỉ tính điểm Đêm đó.
- **Nhặt/chạm:** chênh cao tính giữa chân Mây và mặt đất (đom đóm) hoặc tâm−0.5 (Bóng Mực). Tương tác đèn chỉ xét khoảng cách XZ.
- **`motes[].ttl_s`:** `null` với đom đóm ngẫu nhiên. **`player.invuln`** tính bằng giây.
- **Gió Lạc:** bay ở độ cao 2 m, không bị bản đồ chặn; chỉ cướp khi ở trạng thái chase. Khi biến mất thì bị xóa khỏi snapshot. Đom đóm thả lại có TTL 480 tick.
- **Đom đóm ngẫu nhiên tại "điểm trống":** điểm chưa có đom đóm ngẫu nhiên đang tồn tại; trần 30 tính cả đom đóm rơi.
- **Bóng Mực bị đẩy lùi/choáng:** dừng khi gặp vách hoặc mép đảo (không rơi khỏi đảo).
- Vẫn chờ xác nhận với trợ giảng/giảng viên: các mục trên là suy luận của tôi.
