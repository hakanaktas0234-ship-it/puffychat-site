#!/usr/bin/env bash
# puffychat-site 2026-10-09: panelde süslü Unicode adlar "NO GLYPH" kutusu yerine okunur görünsün.
set -eu
cd "$(dirname "$0")"
git add -- yonetim/style.css yonetim/index.html scripts_commit_panel_isim.sh
git commit -q -m "Yönetim: kullanıcı/aile adlarında süslü Unicode (matematik harfleri, semboller) sistem ve sembol fontlarıyla gösterilir; NO GLYPH kutuları giderildi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuxsh4fchdofj3"
git push origin main
git log --oneline -1
