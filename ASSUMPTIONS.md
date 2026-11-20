# Giả định Phase 1 (PRD-0)

Các giá trị dưới đây do tôi chọn vì PRD không quy định. Giá trị thật nằm trong `game.contract.json`; game và headless phải dùng đúng các giá trị đó.

## Công nghệ
- Node.js (LTS) cài qua nvm. Lõi mô phỏng `sim/` thuần JS, không import đồ họa hay DOM, dùng chung cho headless và bản Three.js.
- `build_cmd`: `npm install`. `run_cmd`: `npm start`. `headless_cmd`: `node sim/cli.mjs`.

## Tham số (đơn vị: mét, giây)
| Tham số | Giá trị | Lý do |
|---|---|---|
| player_speed | 6 | Chạy hết đảo trong vài giây, dễ kiểm chứng |
| carry_capacity | 5 | Mang đủ cho hơn một đèn |
| lantern_cost | 3 | 5 đèn cần 15 đom đóm |
| pickup_radius / interact_radius | 1.2 / 2.5 | Nhặt gần, nạp đèn xa hơn một chút |
| pulse_cost / pulse_radius | 1 / 5 | Pulse rẻ nhưng không vô hạn |
| pulse_stun_s / pulse_push_m / pulse_cooldown_s | 3 / 2 / 2 | |
| night1_duration_s | 180 | 3 phút mỗi lượt |
| flames | 3 | 3 lần trúng thì thua |
| invuln_s / hit_drop_ratio | 1.5 / 0.5 | Trúng thì rơi nửa số đom đóm đang mang (làm tròn xuống) |
| safe_radius | 4 | Quanh đèn đã sáng, Bóng Mực không vào |
| shade_speed / shade_hit_radius | 3.5 / 0.8 | Chậm hơn Mây nên né được |
| fall_enabled | false | Đảo có rào chắn, không có rơi |
| score | mote 1, lantern 50, stun 5, giây còn lại 1, flame còn lại 20 | |

## Luật chưa rõ
- Nạp đèn: mỗi lần `interact` trong `interact_radius` nạp `min(carried, lantern_cost - deposited)` vào đèn gần nhất chưa sáng. Đủ `lantern_cost` thì sáng.
- Đầy `carry_capacity` thì không nhặt thêm.
- Pulse cần `carried >= pulse_cost` và hết cooldown. Làm choáng và đẩy lùi mọi shade trong `pulse_radius`.
- Thắng: cả 5 đèn sáng (`all_lit`). Thua: hết flame (`no_flames`) hoặc hết giờ (`dawn`).
- Thứ tự trong một tick: input, di chuyển, nhặt, interact, pulse, shade, va chạm, thời gian, thắng/thua.
- `dash`: không làm ở Phase 1.
- Vị trí `score` trong `game.contract.json`: đặt trong `tuning` theo template; cần hỏi lại trợ giảng.

## Cần xác nhận với trợ giảng
- Test Contract có giá trị mặc định cho các tham số trên không, hay scenario sẽ ghi đè.
- `score` nằm trong hay ngoài `tuning`.

## Quyết định bổ sung khi viết lõi mô phỏng
- `cam_yaw_deg = 0`: `move [x,z]` ánh xạ thẳng sang trục thế giới. Yaw xoay vector này.
- Đảo tròn bán kính 20 (Mây và Bóng Mực bị giữ trong đảo). Đèn L1..L5 nằm trên vòng bán kính 12.
- `random_motes` bật: 20 đom đóm ngẫu nhiên theo seed. `random_shades` bật: 3 Bóng Mực lúc đầu (không phát event), rồi cứ 600 tick thêm một con (tối đa 5) và phát `shade_spawned`.
- Thắng được xét ngay sau khi nạp đèn, trước bước Bóng Mực. Điểm thắng = điểm đang có + `per_second_left × floor(giây còn lại)` + `per_flame_left × flames còn lại`. Thua không có điểm thưởng.
- Bị trúng: mote rơi ra thành vòng bán kính 2 quanh Mây. Pulse không đủ `carried` hoặc đang cooldown thì không phát event.
- Snapshot có thêm mảng `motes`. Event của một tick được in trước snapshot của tick đó. Không in snapshot thừa ở cuối.
- Lỗi đối số CLI: exit 1. File inputs/scenario hỏng hoặc không đọc được: exit 2.
