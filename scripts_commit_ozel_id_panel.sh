#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
git add -- yonetim/phase1.js yonetim/kapsam.js yonetim/index.html scripts_commit_ozel_id_panel.sh
git commit -q -m "Yönetim: kullanıcı listesi/detayında özel ID önce gösterilir (HAKAN · 290873); Mora coinli masa denetimi (giriş/ödül/iade, coin defteri)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
git log --oneline -1
