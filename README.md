# Đảo Đèn Lồng (Day 12 AI SDLC) — Nguyễn Thị Dũng, 2A202603508

> Video demo: _(chưa có, sẽ thêm ở Phase 4)_
> Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md)

Game 3D góc nhìn thứ ba bằng Three.js. Mây gom đom đóm, thắp lại 5 Đèn Lồng Lớn và né Bóng Mực. Tiến độ: **Phase 3** (Ticket-03 "Đèn cạn dầu", contract v1.2).

## Cài đặt và chạy (Node.js 20+)
```bash
npm install
npm start            # mở http://localhost:8080
bash scripts/verify.sh   # kiểm chứng headless
```
Chế độ headless: `node sim/cli.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Điều khiển
| Phím | Việc |
|---|---|
| W A S D | Di chuyển (theo hướng camera) |
| Space | Nhảy (chỉ khi chạm đất) |
| Shift | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp đom đóm để thắp đèn tắt, hoặc châm dầu cho đèn đang sáng (trong 2 m) |
| F | Tỏa Sáng: choáng và đẩy Bóng Mực trong 5 m, tốn 3 đom đóm, hồi chiêu 3 s |
| ← → hoặc kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật và điểm (số chuẩn Ticket-03)
- 3 Đêm: Đảo Bến (240 s, 5 đèn), Đảo Cau (270 s, 6 đèn, cầu tre và bục nhảy), Đảo Chuông (300 s, 7 đèn, 3 tầng, dốc, gió mạnh). Ngọn Lửa hồi đầy đầu mỗi Đêm.
- **Mục tiêu: giữ đảo sáng tới bình minh.** Thắng khi còn sống lúc hết giờ và số đèn đang sáng ≥ 60% tổng (3/5, 4/6, 5/7). Thắp đủ đèn không kết thúc Đêm. Thua: hết Ngọn Lửa, hoặc hết giờ mà đèn sáng chưa đủ.
- **Đèn hao dầu:** vừa thắp có 100 dầu, hao 1/giây. Bấm E gần đèn đang sáng để châm dầu (+10 mỗi đom đóm). Hết dầu đèn tắt; thắp lại chỉ cần 5 đom đóm. Đèn dưới 30 dầu mất vùng an toàn, nhấp nháy, và Bóng Mực kéo tới hút 5 dầu/giây.
- Đom đóm: mỗi lần thắp thành công tăng sức chứa 2 (10 → tối đa 20). Tự nhặt trong 1 m. Bùa Gió (đỏ viền vàng): 10 giây chạy 7.2 m/s và lướt không hồi chiêu.
- Bóng Mực chạm: −1 Ngọn Lửa, rơi nửa số đom đóm mang, bất tử 1.5 s. Gió Lạc cướp tới 3 đom đóm nếu bạn mang ≥ 5. Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh sau 1 s.
- Điểm: +5 mỗi đom đóm nạp/châm, +100 thắp lần đầu, +40 thắp lại, +5 mỗi Bóng Mực trúng Tỏa Sáng (+15 nếu nó đang hút dầu). Bình minh (khi thắng): mỗi đèn sáng +50 + phần nguyên của dầu, mỗi Ngọn Lửa +50. Tổng điểm game là tổng các Đêm đã thắng.
- Cài đặt có "Bảng màu dễ phân biệt" (viền/mắt Bóng Mực xanh `#00B3FF`, cảnh báo trắng kèm ⚠; đèn tắt xẹp và có vết rách).

Mọi giá trị nằm trong [game.contract.json](game.contract.json). Spec và giả định: [ASSUMPTIONS.md](ASSUMPTIONS.md) (P1), [SPEC-PHASE2.md](SPEC-PHASE2.md), [SPEC-PHASE3.md](SPEC-PHASE3.md). Quyết định thiết kế: [docs/ADR-0003-den-nhien-lieu-va-luat-thang.md](docs/ADR-0003-den-nhien-lieu-va-luat-thang.md). Thay đổi phá vỡ: [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Cấu trúc
- `sim/` lõi mô phỏng thuần JS, dùng chung cho headless và game. `web/` giao diện Three.js. `server.mjs` server tĩnh.
- `scenarios/` + `scripts/verify.mjs`: kịch bản và kiểm chứng. `evidence/phase-1/`: bằng chứng.
- `AGENTS.md`: harness cho agent.

## Sáng tạo của tôi
Gợi ý nguy hiểm chỉ ở giao diện, không đổi số chuẩn hay đầu ra headless (lõi `sim/` không biết về chúng):
- Mũi tên đỏ ở rìa màn hình chỉ tới Bóng Mực đang đuổi nằm ngoài tầm nhìn (trong 18 m); mắt Bóng Mực đỏ khi đang đuổi.
- Viền đỏ và tiếng cảnh báo khi có Bóng Mực đang đuổi trong 10 m.
- Vòng vàng bán kính 5 m quanh Mây khi Tỏa Sáng dùng được và Bóng Mực đã tới gần (cách dưới 9 m): vòng mờ khi chưa trúng, sáng rõ khi có Bóng Mực nằm trong tầm trúng của F (cùng công thức khoảng cách 3D với lõi).

Bằng chứng lõi vẫn đúng: `bash scripts/verify.sh` (145/145). Gợi ý nguy hiểm được kiểm tra bằng cảnh cố định `http://localhost:8080/?start=1&demo=hint` (ảnh: [ui-hint.png](evidence/phase-2/ui-hint.png)): vòng sáng rõ khi Bóng Mực trong tầm F, viền đỏ, mũi tên đỏ chỉ Bóng Mực phía sau, mắt đỏ. Chưa thử khi chơi liên tục.

## Bằng chứng Phase 3
Chạy lại: `bash scripts/verify.sh` (log: [evidence/phase-3/verify.log](evidence/phase-3/verify.log)). 177 kiểm tra headless, 0 thất bại.

| Yêu cầu Ticket-03 | Cách kiểm chứng | Kết quả |
|---|---|---|
| Nhiên liệu: hao, châm dầu, hết dầu, thắp lại, `fuel` nguyên 1/60 | scenario `fuel-decay`, `refuel*`, `lantern-out`, `relight`, `first-light-needs-10` | Đạt |
| Bóng Mực hút dầu: `drain`, mất vùng an toàn dưới 30 (đúng 30 còn), chọn mục tiêu, cộng dồn, chuyển trạng thái, `fuel_drain` | scenario `drain*`, `zone-*`, `wander-target-*` | Đạt |
| Luật thắng mới: dawn_survived, ngưỡng 3/5 4/6 5/7, không thắng sớm, hết lửa ở tick cuối | `win-dawn`, `threshold-*`, `no-early-win`, `lose-last-tick` | Đạt |
| Sức chứa 10 + 2 × lần thắp, tối đa 20; điểm mới | `capacity-*`, `deposit-full`, `win-dawn` | Đạt |
| Contract v1.2: tuning, snapshot, scenario, event | cùng bộ kiểm tra | Đạt |
| Hồi quy Phase 1-2 | test cũ giữ nguyên; test bị luật mới làm sai đã sửa kèm lý do, nhãn `[P3]` | Đạt (xem [CHANGELOG](docs/CHANGELOG.md)) |
| Giao diện: thanh dầu, đèn tắt xẹp/rách, HUD mang/sức chứa, chế độ mù màu | ảnh cảnh cố định `?start=1&demo=fuel`: [thường](evidence/phase-3/phase-3-ui-fuel.png), [mù màu](evidence/phase-3/phase-3-ui-fuelcb.png) | Có hình; **chưa chơi thật**, đèn tắt/nhấp nháy chưa thấy trong ảnh |
| Chơi trọn vẹn, âm thanh, ≥ 30 FPS | — | **Chưa kiểm chứng** (như Phase 2) |

## Bằng chứng Phase 2 (tag `phase-2`; đã bị Phase 3 thay một số luật)
Chạy lại: `bash scripts/verify.sh` (log: [evidence/phase-2/verify.log](evidence/phase-2/verify.log), scenario trong `scenarios/`).

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Số chuẩn, 3 bản đồ, thứ tự tick, lướt, Tỏa Sáng, Gió Lạc, Bùa Gió, gió, bục nhảy, tầng/dốc/tháp, rơi, tạm dừng, lịch sinh | 145 kiểm tra headless (≥1 scenario cho mỗi tính năng mới) | Đạt, 0 thất bại |
| Hồi quy Phase 1 với số chuẩn | cùng bộ kiểm tra (nhặt, nạp, thắng/thua, pulse, hit) | Đạt |
| Tất định (3 Đêm), exit 2 khi đầu vào hỏng | byte-identical theo seed; 9 file đầu vào hỏng | Đạt |
| Một Đêm đầy đủ ≤ 30 s | 21.600 tick chạy hết khoảng 0.1 s | Đạt |
| Giao diện: menu, 3 bản đồ 3D, HUD, bảng màu | ảnh chụp: [menu](evidence/phase-2/ui-menu.png), [Đêm 1](evidence/phase-2/ui-n1.png), [Đêm 2](evidence/phase-2/ui-n2.png), [Đêm 3](evidence/phase-2/ui-n3.png) (chỉ khung hình đầu) | Có hình, **chưa kiểm tra bằng thao tác** |
| Chơi trọn vẹn trong trình duyệt: chuyển Đêm, tạm dừng, kết quả/Bình Minh, âm thanh, cài đặt lưu | — | **Chưa kiểm chứng**: chưa có test tự động cho giao diện; âm thanh tổng hợp bằng WebAudio chưa nghe thử |
| ≥ 30 FPS trung bình ở 1280×720 | `?debug` hiển thị FPS | **Chưa đo** trên GPU thật (chỉ chạy được bản render phần mềm) |
| Gió: báo trước bằng lá bay (có), bằng âm thanh (chưa) | — | Một phần |

Việc chưa xong ở Phase 2: xem bảng trong [SPEC-PHASE2.md](SPEC-PHASE2.md).

## Bằng chứng Phase 1 (tag `phase-1`)
Xem [evidence/phase-1/verify.log](evidence/phase-1/verify.log) và README ở tag `phase-1`.

## Nhật ký dùng AI
Dùng Claude Code (agent) để lập kế hoạch, viết lõi, CLI, scenario và giao diện. Tôi duyệt kế hoạch trước, agent tự siết lại hai kiểm tra quá lỏng sau lần chạy đầu. Chưa ghi số token cụ thể: _cần bổ sung_.

Phase 3: dán Ticket-03 (thay đổi luật cốt lõi), ghi ADR và changelog, sửa lõi, cập nhật test cũ kèm lý do, rồi giao diện. Cả 177 kiểm tra đạt ngay lần chạy đầu sau khi tôi viết test mới, nên tôi cần soát lại xem test có đủ chặt không (đã kiểm tra các giá trị cụ thể như fuel 30.0 chính xác). Token: _cần bổ sung_.

Phase 2: dán Ticket-02 vào Claude Code, làm theo thứ tự: spec/giả định, contract v1.1, viết lại lõi, 145 kiểm tra headless, rồi giao diện. Agent tự phát hiện hai kiểm tra vô hiệu (`|| true`) và một lỗi recoil thiếu 1 tick nhờ chạy kiểm chứng; đã sửa. Token: _cần bổ sung_.
