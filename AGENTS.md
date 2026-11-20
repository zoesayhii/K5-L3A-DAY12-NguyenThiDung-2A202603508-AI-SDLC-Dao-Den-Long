# AGENTS.md

Dự án: game 3D "Đảo Đèn Lồng" (lab Day 12). Yêu cầu: SPEC-PHASE3.md (Ticket-03, contract v1.2, thay một số luật Phase 2), SPEC-PHASE2.md, ASSUMPTIONS.md, game.contract.json. Quyết định thiết kế: docs/ADR-*.md; thay đổi phá vỡ: CHANGELOG.md.

## Quy tắc
- `sim/` là lõi mô phỏng thuần JS: không import Three.js, DOM hay `Math.random`. Dùng PRNG có seed.
- Số chuẩn (tuning) chỉ đọc từ `game.contract.json`. Hình học bản đồ ở `sim/maps.mjs`. Hằng số cấu trúc (lịch sinh, bán kính Gió Lạc...) ở đầu `sim/sim.mjs`, không rải khắp nơi.
- Thứ tự xử lý trong tick là bắt buộc (comment B1..B12 trong `sim.mjs`); đổi thứ tự phải đối chiếu Ticket-02.
- Mỗi tính năng mới cần ít nhất 1 scenario headless trong `scripts/verify.mjs`. Test cũ thay đổi vì yêu cầu đổi thì ghi lý do trong commit.
- Nhiên liệu đèn lưu bằng số nguyên đơn vị 1/60 (không dùng số thực); chỉ làm tròn khi xuất.
- Khi yêu cầu mới thay luật cũ: ghi ADR, sửa test cũ với nhãn `[P3]`-kiểu kèm lý do và thêm vào changelog, không skip âm thầm.
- Cùng seed + scenario + inputs phải cho output giống từng byte.
- Không bịa yêu cầu. Chỗ mơ hồ thì ghi vào ASSUMPTIONS.md.
- Mỗi thay đổi lõi phải chạy `scripts/verify.sh`. Không sửa output mong đợi để test qua.
- Giao diện chỉ gợi ý/hiển thị, không được đổi luật hay đầu ra headless; cảnh benchmark phải tắt mọi thứ sáng tạo thêm.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, khóa API.

## Lệnh
- Cài: `npm install`
- Chạy game: `npm start`
- Headless: `node sim/cli.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl`
- Benchmark: `node bench/run.mjs --seed 42 --duration 30 --out bench.json` (cần Chrome). Soak: `node --expose-gc sim/soak.mjs --seed 7 --nights 10 --out soak.json`. Bảng xếp hạng: `node server.mjs --export-leaderboard out.json`.
- Kiểm chứng: `scripts/verify.sh` (log vào `evidence/phase-4/`)

## Môi trường
Node cài qua nvm: `. ~/.nvm/nvm.sh` trước khi chạy `node`/`npm`.
