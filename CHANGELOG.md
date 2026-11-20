# Changelog

Định dạng: mỗi phase một mục; thay đổi phá vỡ tương thích (breaking) được đánh dấu **[BREAKING]**.

## v1.0.0 (Phase 4, contract v1.3): phát hành
- **Benchmark** (`node bench/run.mjs --seed 42 --duration 30 --out bench.json`): cảnh chuẩn 200 Bóng Mực + 100 đom đóm, camera bay vòng, đo avg_fps/p1_low/p95/load/mem.
- **Soak test** (`node --expose-gc sim/soak.mjs --seed 7 --nights 10 --out soak.json`): 10 Đêm headless, kiểm tra crash và bộ nhớ.
- **Bảng xếp hạng cục bộ** (top 10, lưu `data/leaderboard.json`, `node server.mjs --export-leaderboard out.json`).
- **Trợ năng:** đổi phím (có báo trùng, khôi phục mặc định, được lưu), phụ đề/chỉ báo hình ảnh, giảm chuyển động, chữ ≥ 18 px và tùy chọn chữ lớn ×1.25.
- **Hiệu năng:** Bóng Mực và đom đóm vẽ bằng instancing.
- **Đóng gói:** README, CREDITS, LICENSE, Dockerfile, script đóng gói Release, retro.
- Contract 1.3: thêm `bench_cmd`, `soak_cmd`; `run_cmd` là `node server.mjs`. Luật và số chuẩn không đổi.

## Phase 3 (contract v1.2): Ticket-03 "Đèn cạn dầu" **[BREAKING]**- **Thắng:** không còn thắng sớm khi tất cả đèn sáng (`all_lit` bỏ). Thắng = còn sống tới bình minh và số đèn sáng ≥ `ceil(0.6 × tổng)`, lý do `dawn_survived`.
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

## Phase 2 (contract v1.1): Ticket-02 "Ba hòn đảo"
- Số chuẩn mới thay mọi giá trị tự chọn của Phase 1 **[BREAKING]**: tốc độ 6 m/s, sức chứa 10, đèn cần 10 đom đóm, Bóng Mực 4.0 m/s, 3 Ngọn Lửa; điểm chuẩn hóa.
- 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông) với bản đồ chuẩn, cầu tre, bục nhảy, 3 tầng, dốc, tháp chuông.
- Lướt, Gió Lạc (cướp đom đóm), Bùa Gió, gió mạnh (Đêm 3), rơi khỏi đảo và hồi sinh, tạm dừng, lịch sinh theo tick.
- Test Contract v1.1: snapshot thêm `night`, `wind`, `motes`, `drifters`, `charms`; trạng thái Bóng Mực đúng 5 tên; Đêm đầy đủ ≤ 30 s.
- Giao diện: menu, chuỗi 3 Đêm, HUD đầy đủ, tạm dừng, cài đặt lưu, âm thanh WebAudio, bảng màu chuẩn.

## Phase 1 (contract v1.0): PRD-0 "Đảo Đèn Lồng"
- Lõi mô phỏng tất định (60 tick/s, PRNG theo seed) dùng chung cho headless và Three.js.
- Một Đêm (Đảo Bến, 5 đèn): di chuyển, nhảy, nhặt đom đóm, nạp đèn, Bóng Mực đuổi, xung ánh sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless theo Test Contract v1.0 (JSONL: snapshot, event, end; exit 2 khi đầu vào hỏng) và bộ kiểm chứng tự động.
