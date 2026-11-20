# AGENTS.md

Dự án: game 3D "Đảo Đèn Lồng" (lab Day 12). Yêu cầu: README.md, ASSUMPTIONS.md, game.contract.json.

## Quy tắc
- `sim/` là lõi mô phỏng thuần JS: không import Three.js, DOM hay `Math.random`. Dùng PRNG có seed.
- Giá trị tuning chỉ đọc từ `game.contract.json`, không viết cứng trong code.
- Cùng seed + scenario + inputs phải cho output giống từng byte.
- Không bịa yêu cầu. Chỗ mơ hồ thì ghi vào ASSUMPTIONS.md.
- Mỗi thay đổi lõi phải chạy `scripts/verify.sh`. Không sửa output mong đợi để test qua.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, khóa API.

## Lệnh
- Cài: `npm install`
- Chạy game: `npm start`
- Headless: `node sim/cli.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl`
- Kiểm chứng: `scripts/verify.sh`

## Môi trường
Node cài qua nvm: `. ~/.nvm/nvm.sh` trước khi chạy `node`/`npm`.
