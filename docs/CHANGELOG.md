# Changelog

## Phase 3 (contract v1.2): thay đổi phá vỡ tương thích
- **Thắng:** không còn thắng sớm khi tất cả đèn sáng (`all_lit` bỏ). Thắng = còn sống tới bình minh và số đèn sáng ≥ `ceil(0.6 × tổng)`, lý do `dawn_survived`.
- **Thời gian Đêm** 300/330/360 s → **240/270/300 s**.
- **Điểm:** bỏ hoàn toàn công thức cũ. `per_mote` 10 → **5**; lần đầu thắp 100, thắp lại 40; Tỏa Sáng 5 (15 nếu Bóng Mực đang `drain`); bình minh mỗi đèn sáng `50 + floor(fuel)` và mỗi Ngọn Lửa 50; bỏ thưởng thời gian.
- **Đèn:** đèn sáng không còn "sáng mãi": có `fuel` (hao 1/s), nhận châm dầu, có thể tắt (`lantern_out`) và thắp lại (5 đom đóm nếu `ever_lit`). Đèn đã sáng giờ **nhận** tương tác (trước đây bị bỏ qua).
- **Vùng an toàn:** mất khi `fuel < 30` (trước đây luôn có khi đèn sáng).
- **Bóng Mực:** thêm trạng thái `drain` và `target_lantern_id`; `wander` đi tới đèn yếu/đèn tắt; hết choáng về `wander` (trước đây về `chase` nếu cách ≤ 12 m).
- **Sức chứa:** `10 + 2 × successful_lights`, tối đa 20 (trước đây cố định 10). Snapshot `player.capacity`.
- **Snapshot/Scenario/Event:** lantern thêm `fuel`, `ever_lit`, `relit_count`; scenario thêm `fuel`, `ever_lit`, `successful_lights`, `target_lantern_id`; event mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`.
- **Giao diện:** thanh dầu, đèn tắt xẹp 20% có vết rách, nhấp nháy khi `fuel < 30`, HUD mang/sức chứa, cài đặt "Bảng màu dễ phân biệt".

### Test cũ được sửa (lý do)
Mọi chỗ sửa trong `scripts/verify.mjs` đều có nhãn `[P3]`:
| Test | Thay đổi | Lý do |
|---|---|---|
| contract/thời gian Đêm, `time_left_s`, 3 Đêm | 300/330/360 → 240/270/300, contract 1.2 | Ticket-03 mục 3, 7 |
| điểm nạp đèn đầy | 200 → 150 | `per_mote` 5 |
| nạp vào đèn gần nhất bỏ qua đèn sáng | đổi thành: đèn sáng chưa đầy được chọn, châm dầu | Ticket-03 mục 1 |
| `win` (all_lit tick 1), điểm thắng cũ, `win-at-timeout` | viết lại cho `dawn_survived` và công thức điểm bình minh | Ticket-03 mục 3, 5 |
| hết choáng → `chase` | → `wander` | Ticket-03 mục 2 |
| hiệu năng 21.600 tick | 18.000 tick (Đêm 3 = 300 s) | Ticket-03 mục 3 |
| `lose-beats-win` (đã bỏ từ Phase 2) | không còn áp dụng | không đổi |
