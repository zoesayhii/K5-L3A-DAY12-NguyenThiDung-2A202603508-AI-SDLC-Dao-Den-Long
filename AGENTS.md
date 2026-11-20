# AGENTS.md

Dự án: game 3D "Đảo Đèn Lồng" (lab Day 12). Yêu cầu: SPEC-PHASE2.md (Ticket-02, contract v1.1), ASSUMPTIONS.md (Phase 1), game.contract.json.

## Quy tắc
- `sim/` là lõi mô phỏng thuần JS: không import Three.js, DOM hay `Math.random`. Dùng PRNG có seed.
- Số chuẩn (tuning) chỉ đọc từ `game.contract.json`. Hình học bản đồ ở `sim/maps.mjs`. Hằng số cấu trúc (lịch sinh, bán kính Gió Lạc...) ở đầu `sim/sim.mjs`, không rải khắp nơi.
- Thứ tự xử lý trong tick là bắt buộc (comment B1..B12 trong `sim.mjs`); đổi thứ tự phải đối chiếu Ticket-02.
- Mỗi tính năng mới cần ít nhất 1 scenario headless trong `scripts/verify.mjs`. Test cũ thay đổi vì yêu cầu đổi thì ghi lý do trong commit.
- Cùng seed + scenario + inputs phải cho output giống từng byte.
- Không bịa yêu cầu. Chỗ mơ hồ thì ghi vào ASSUMPTIONS.md.
- Mỗi thay đổi lõi phải chạy `scripts/verify.sh`. Không sửa output mong đợi để test qua.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, khóa API.

## Lệnh
- Cài: `npm install`
- Chạy game: `npm start`
- Headless: `node sim/cli.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl`
- Kiểm chứng: `scripts/verify.sh` (log vào `evidence/phase-2/`)

## Môi trường
Node cài qua nvm: `. ~/.nvm/nvm.sh` trước khi chạy `node`/`npm`.
