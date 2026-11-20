#!/usr/bin/env bash
# Chay kiem chung headless va luu log bang chung.
set -o pipefail
cd "$(dirname "$0")/.."
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null
mkdir -p evidence/phase-4
node scripts/verify.mjs | tee evidence/phase-4/verify.log
