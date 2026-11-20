# Đảo Đèn Lồng (Day 12 AI SDLC) — Nguyễn Thị Dũng, 2A202603508

> Video demo: _(chưa có, sẽ thêm ở Phase 4)_
> Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md)

Game 3D góc nhìn thứ ba bằng Three.js. Mây gom đom đóm, thắp lại 5 Đèn Lồng Lớn và né Bóng Mực. Tiến độ: **Phase 2** (Ticket-02, contract v1.1: 3 Đêm).

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
| E | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| F | Tỏa Sáng: choáng và đẩy Bóng Mực trong 5 m, tốn 3 đom đóm, hồi chiêu 3 s |
| ← → hoặc kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật và điểm (số chuẩn Ticket-02)
- 3 Đêm: Đảo Bến (300 s, 5 đèn), Đảo Cau (330 s, 6 đèn, cầu tre và bục nhảy), Đảo Chuông (360 s, 7 đèn, 3 tầng, dốc, gió mạnh). Ngọn Lửa hồi đầy đầu mỗi Đêm.
- Đom đóm: mang tối đa 10, mỗi đèn cần 10. Tự nhặt trong 1 m. Bùa Gió (đỏ viền vàng): 10 giây chạy 7.2 m/s và lướt không hồi chiêu.
- Bóng Mực chạm: −1 Ngọn Lửa, rơi nửa số đom đóm mang, bất tử 1.5 s. Gió Lạc cướp tới 3 đom đóm nếu bạn mang ≥ 5. Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh sau 1 s.
- Điểm: +10 mỗi đom đóm nạp, +100 mỗi đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng; khi thắng + 2 × giây còn lại + 50 × Ngọn Lửa còn lại. Tổng điểm game là tổng các Đêm đã thắng. Thắng Đêm 3 thì tới màn Bình Minh.

Mọi giá trị nằm trong [game.contract.json](game.contract.json). Giả định: [ASSUMPTIONS.md](ASSUMPTIONS.md) (Phase 1), [SPEC-PHASE2.md](SPEC-PHASE2.md) (Phase 2).

## Cấu trúc
- `sim/` lõi mô phỏng thuần JS, dùng chung cho headless và game. `web/` giao diện Three.js. `server.mjs` server tĩnh.
- `scenarios/` + `scripts/verify.mjs`: kịch bản và kiểm chứng. `evidence/phase-1/`: bằng chứng.
- `AGENTS.md`: harness cho agent.

## Sáng tạo của tôi
Gợi ý nguy hiểm chỉ ở giao diện, không đổi số chuẩn hay đầu ra headless (lõi `sim/` không biết về chúng):
- Mũi tên đỏ ở rìa màn hình chỉ tới Bóng Mực đang đuổi nằm ngoài tầm nhìn (trong 18 m); mắt Bóng Mực đỏ khi đang đuổi.
- Viền đỏ và tiếng cảnh báo khi có Bóng Mực đang đuổi trong 10 m.
- Vòng vàng mờ bán kính 5 m quanh Mây khi Tỏa Sáng dùng được và Bóng Mực đã tới gần.

Bằng chứng lõi vẫn đúng: `bash scripts/verify.sh` (145/145). Giao diện của các gợi ý mới chỉ kiểm tra là trang tải được, chưa thấy trực tiếp mũi tên và viền đỏ khi có Bóng Mực.

## Bằng chứng Phase 2
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

Phase 2: dán Ticket-02 vào Claude Code, làm theo thứ tự: spec/giả định, contract v1.1, viết lại lõi, 145 kiểm tra headless, rồi giao diện. Agent tự phát hiện hai kiểm tra vô hiệu (`|| true`) và một lỗi recoil thiếu 1 tick nhờ chạy kiểm chứng; đã sửa. Token: _cần bổ sung_.
