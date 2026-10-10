#!/usr/bin/env bash
# puffychat-site: ajans dosyasında "Adı değiştir" (yönetici doğrudan değiştirir).
set -eu
cd "$(dirname "$0")"
git add -- yonetim/topluluklar.js scripts_commit_ajans_adi_yonetici.sh
git commit -q -m "Yönetim: ajans dosyasında yönetici ajans adını değiştirebilir"
git log --oneline -1
