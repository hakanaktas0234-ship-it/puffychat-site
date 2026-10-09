#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
git add -- yonetim/phase1.js yonetim/index.html scripts_commit_konum_yaklasik.sh
git commit -q -m "Yönetim/Konum: şehir 'yaklaşık' olarak gösterilir, ülke ayrı satırda; mobil operatör merkezi notu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuxsh4fchdofj3"
git push origin main
git log --oneline -1
