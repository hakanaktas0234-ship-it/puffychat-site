#!/usr/bin/env bash
# puffychat-site 2026-10-07: yönetim paneli F01/F02/O05 (Codex tam analiz).
set -eu
cd "$(dirname "$0")"
git add -- yonetim/phase1.js yonetim/phase3.js yonetim/index.html scripts_commit_2026_10_07.sh
git commit -q -m "Yönetim: coin/VIP işlemlerinde istek kimliğiyle tekrar koruması (F01); kasa geçmişinde yapan, hedef, yön, önceki/sonraki bakiye, satış karşılığı, geri alma bağlantısı (F02); shorts ve şikayet kuyruklarında 25'lik sayfalama ve 'Daha fazla' (O05)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3" && git log --oneline -1
