#!/bin/bash
# indir sayfası: uygulamadan ?guncelle=<kod> ile gelince "Puffy'yi güncelle" dili (2026-10-07)
set -e
cd "$(dirname "$0")"
git add indir/index.html scripts_commit_guncelle.sh yonetim/oyunlar.js yonetim/index.html yonetim/phase1.js yonetim/style.css
git commit -m "İndir sayfası: uygulamadan gelen güncellemede 'Puffy'yi güncelle' başlığı, sürüm farkı (eski → yeni) ve güncelleme adımları; yönetim: Oyun kasası sayfası (Altın Bahçe / Hız Pisti kasa, bugünkü ciro/ödeme, son turlar, risk koruması devreye giren turlar)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
