#!/usr/bin/env bash
# puffychat-site: tarayıcı önbelleği yeni approvals/topluluklar dosyalarını alsın (sürüm etiketi).
set -eu
cd "$(dirname "$0")"
git add -- yonetim/index.html scripts_commit_panel_onbellek.sh
git commit -q -m "Yönetim: approvals/topluluklar sürüm etiketi (önbellek)"
git log --oneline -1
