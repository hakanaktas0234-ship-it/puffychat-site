#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
git pull --rebase --autostash origin main
git add -- yonetim/phase1.js yonetim/index.html scripts_commit_konum_il_ilce.sh
git commit -q -m "Yönetim/Konum: il önce, ilçe parantezde (Diyarbakır (Bağlar)); konum sekmesi yalnız yönetici + MFA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
git log --oneline -1
