#!/usr/bin/env bash
# puffychat-site 2026-10-09: gizlilik (IP'den yaklaşık konum) + yönetim paneli
# (Anlar, Bakım modu, Oyun turları, kullanıcı Konum sekmesi).
# Not: yonetim/kapsam.js BİLEREK dahil değil (Codex Mora v2 işi, sunucusu henüz canlı değil).
set -eu
cd "$(dirname "$0")"
git add -- gizlilik/index.html en/privacy/index.html \
  yonetim/index.html yonetim/phase1.js yonetim/oyunlar.js yonetim/anlar.js yonetim/bakim.js \
  scripts_commit_konum_gizlilik.sh
git commit -q -m "Gizlilik: güvenlik amacıyla IP'den yaklaşık konum (ülke/şehir), saklama ve aktarım bilgisi (TR/EN); yönetim: Anlar, Bakım modu, Oyun turları, kullanıcı Konum sekmesi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuxsh4fchdofj3"
git push origin main
git log --oneline -1
