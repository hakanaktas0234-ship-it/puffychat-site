#!/usr/bin/env bash
# puffychat-site: Onaylar > Ajans adı kuyruğu.
set -eu
cd "$(dirname "$0")"
git add -- yonetim/approvals.js yonetim/index.html scripts_commit_ajans_adi_panel.sh
git commit -q -m "Yönetim: Ajans adı değiştirme istekleri onay kuyruğu"
git log --oneline -1
