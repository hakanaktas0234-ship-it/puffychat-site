#!/bin/bash
# Search Console doğrulama dosyası (2026-10-07) — hakanaktas0234@gmail.com için URL ön eki mülkü
set -e
cd "$(dirname "$0")"
git add googlec6c87076a3e9247b.html scripts_commit_search_console.sh
git commit -m "Search Console: HTML doğrulama dosyası (gmail mülkü)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
echo "Bitti: https://puffychat.com/googlec6c87076a3e9247b.html (GitHub Pages 1-2 dk sonra yayında)"
