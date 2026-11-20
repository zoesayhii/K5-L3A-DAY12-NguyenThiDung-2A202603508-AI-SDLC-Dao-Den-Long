#!/usr/bin/env bash
# Dong goi ban chay duoc cho Release v1.0.0: chi can Node (khong can npm install): node server.mjs
set -euo pipefail
cd "$(dirname "$0")/.."
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null || true
V=v1.0.0
OUT=dist/dao-den-long-$V
rm -rf dist && mkdir -p "$OUT/node_modules/three"
cp -r server.mjs server sim web game.contract.json package.json README.md CHANGELOG.md CREDITS.md LICENSE Dockerfile bench "$OUT"/
cp -r node_modules/three/build node_modules/three/package.json node_modules/three/LICENSE "$OUT/node_modules/three/" 2>/dev/null || cp -r node_modules/three/build node_modules/three/package.json "$OUT/node_modules/three/"
cat > "$OUT/CHAY.txt" <<'TXT'
Chay: node server.mjs   -> mo http://localhost:8080   (can Node.js 20+)
Headless: node sim/cli.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl
Xuat bang xep hang: node server.mjs --export-leaderboard out.json
TXT
(cd dist && zip -qr "dao-den-long-$V.zip" "dao-den-long-$V")
echo "dist/dao-den-long-$V.zip"
ls -la dist/*.zip
