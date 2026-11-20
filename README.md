# Đảo Đèn Lồng (Day 12 AI SDLC) — Nguyễn Thị Dũng, 2A202603508

> Video demo: _(chưa có, sẽ thêm ở Phase 4)_
> Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md)

Game 3D góc nhìn thứ ba bằng Three.js. Mây gom đom đóm, thắp lại 5 Đèn Lồng Lớn và né Bóng Mực. Tiến độ: **Phase 1**.

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
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| F | Xung ánh sáng: choáng và đẩy Bóng Mực, tốn 1 đom đóm |
| ← → hoặc kéo chuột | Xoay camera |
| R | Chơi lại |

## Luật và điểm
- Đi gần đom đóm là tự nhặt (mang tối đa 5). Mỗi đèn cần 3 đom đóm để sáng.
- Thắng: cả 5 đèn sáng. Thua: hết 3 ngọn lửa hoặc hết 180 giây.
- Bóng Mực chạm vào Mây: mất 1 ngọn lửa, rơi nửa số đom đóm đang mang, bất tử 1.5 giây. Vùng quanh đèn đã sáng (4 m) Bóng Mực không vào được.
- Điểm: +1 mỗi đom đóm, +50 mỗi đèn sáng, +5 mỗi Bóng Mực bị choáng. Khi thắng cộng thêm 1 điểm mỗi giây còn lại và 20 điểm mỗi ngọn lửa còn lại.

Mọi giá trị nằm trong [game.contract.json](game.contract.json). Giả định: [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Cấu trúc
- `sim/` lõi mô phỏng thuần JS, dùng chung cho headless và game. `web/` giao diện Three.js. `server.mjs` server tĩnh.
- `scenarios/` + `scripts/verify.mjs`: kịch bản và kiểm chứng. `evidence/phase-1/`: bằng chứng.
- `AGENTS.md`: harness cho agent.

## Sáng tạo của tôi
Chưa có ở Phase 1 (ưu tiên đúng yêu cầu trước).

## Bằng chứng Phase 1
| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Headless đúng Test Contract (tick, event, end, exit 2, tất định) | 38 kiểm tra tự động trên scenario | [verify.log](evidence/phase-1/verify.log) | Đạt |
| Nhặt, nạp, thắp đèn, pulse, bị trúng, thắng/thua | scenario trong `scenarios/` | như trên | Đạt |
| Giao diện 3D khởi động, HUD, Mây, đèn, đom đóm, Bóng Mực | ảnh chụp Chrome headless | [game-start.png](evidence/phase-1/game-start.png) | Đạt (chỉ ảnh lúc bắt đầu) |
| Chơi trọn ván trong trình duyệt (thắng/thua, chơi lại) | — | chưa có | **Chưa kiểm chứng**: chưa tự chơi thử. Luật dùng chung lõi đã kiểm chứng |
| Nhảy, camera xoay | — | chưa có | **Chưa kiểm chứng** bằng test |
| Giá trị `tuning` mặc định / vị trí `score` | hỏi trợ giảng | chưa có | Chưa xác nhận |

## Nhật ký dùng AI (Phase 1)
Dùng Claude Code (agent) để lập kế hoạch, viết lõi, CLI, scenario và giao diện. Tôi duyệt kế hoạch trước, agent tự siết lại hai kiểm tra quá lỏng sau lần chạy đầu. Chưa ghi số token cụ thể: _cần bổ sung_.
