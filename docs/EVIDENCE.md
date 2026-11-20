# Bằng chứng theo phase

## Phase 4 (contract v1.3)
Log: [evidence/phase-4/verify.log](../evidence/phase-4/verify.log) (197 kiểm tra, 0 thất bại). Đo tự chạy: [bench.json](../bench.json), [soak.json](../soak.json).

| Yêu cầu Ticket-04 | Cách kiểm chứng | Kết quả |
|---|---|---|
| Benchmark: cảnh chuẩn, camera, 3 s khởi động, các trường bench.json | `sim/bench.mjs` kiểm tra bằng test (200 bóng wander, 100 đom đóm, không sinh/sát thương/hao dầu/kết thúc, camera (30,15,0) ngược chiều kim đồng hồ); chạy thật `node bench/run.mjs` | Đạt; 325.7 FPS, p1 113.4 (máy của tôi, cửa sổ thật) |
| Ngưỡng bench (≥ 60 / ≥ 30 / ≤ 10 s) | số tự đo trên máy của tôi | Đạt trên máy này; **máy chấm chưa đo** |
| Soak: 10 Đêm, 0 crash, mem_end ≤ 1.2 × mem_start | test + `soak.json` | Đạt (×1.03; 1.03–1.17 qua nhiều lần chạy); mem_start đo sau làm nóng (nêu rõ trong README) |
| Bảng xếp hạng: top 10, thứ tự, bền, tên 3–12, `--export-leaderboard` | test đơn vị + API bằng `curl` + lệnh xuất | Đạt (logic/API); **giao diện nhập tên chưa thao tác thử** |
| Trợ năng: đổi phím, phụ đề, giảm chuyển động, chữ ≥ 18 px, chữ lớn | ảnh [đổi phím](../evidence/phase-4/phase-4-ui-keys.png), [cài đặt](../evidence/phase-4/phase-4-ui-settings.png); CSS rem với gốc 18 px | Có hình; **chưa bấm thật** (đổi phím, báo trùng, phụ đề) |
| Đóng gói: README, CHANGELOG, CREDITS, LICENSE, Release | `scripts/make-release.sh`, kiểm tra zip chạy được bằng `node server.mjs` | Đạt phần chuẩn bị; **Release GitHub chưa tạo** |
| Retro, video | [docs/RETRO.md](RETRO.md), [kịch bản](demo/SCRIPT.md) | Retro có (cần điền token); **video chưa quay** |


Chạy lại toàn bộ: `bash scripts/verify.sh` (log mới nhất: `evidence/phase-4/verify.log`).

## Bằng chứng Phase 3
Chạy lại: `bash scripts/verify.sh` (log: [evidence/phase-3/verify.log](evidence/phase-3/verify.log)). 177 kiểm tra headless, 0 thất bại.

| Yêu cầu Ticket-03 | Cách kiểm chứng | Kết quả |
|---|---|---|
| Nhiên liệu: hao, châm dầu, hết dầu, thắp lại, `fuel` nguyên 1/60 | scenario `fuel-decay`, `refuel*`, `lantern-out`, `relight`, `first-light-needs-10` | Đạt |
| Bóng Mực hút dầu: `drain`, mất vùng an toàn dưới 30 (đúng 30 còn), chọn mục tiêu, cộng dồn, chuyển trạng thái, `fuel_drain` | scenario `drain*`, `zone-*`, `wander-target-*` | Đạt |
| Luật thắng mới: dawn_survived, ngưỡng 3/5 4/6 5/7, không thắng sớm, hết lửa ở tick cuối | `win-dawn`, `threshold-*`, `no-early-win`, `lose-last-tick` | Đạt |
| Sức chứa 10 + 2 × lần thắp, tối đa 20; điểm mới | `capacity-*`, `deposit-full`, `win-dawn` | Đạt |
| Contract v1.2: tuning, snapshot, scenario, event | cùng bộ kiểm tra | Đạt |
| Hồi quy Phase 1-2 | test cũ giữ nguyên; test bị luật mới làm sai đã sửa kèm lý do, nhãn `[P3]` | Đạt (xem [CHANGELOG](CHANGELOG.md)) |
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
