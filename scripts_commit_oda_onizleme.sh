#!/bin/bash
# Oda linki önizlemesi: room/<kod>/index.html (og:image = oda kapağı), 15 dk'da bir güncellenir (2026-10-07)
set -e
cd "$(dirname "$0")"
node scripts/oda_onizleme.mjs
git add scripts/oda_onizleme.mjs .github/workflows/oda-onizleme.yml room scripts_commit_oda_onizleme.sh
git commit -m "Oda linki önizlemesi: WhatsApp/Telegram'da oda adı ve kapağı görünsün (room/<kod> sayfaları, 15 dakikada bir otomatik)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
