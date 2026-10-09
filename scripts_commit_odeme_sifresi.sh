#!/bin/bash
# Yönetim: ödeme şifresi durumu/geçmişi + sıfırla / kilidi aç (2026-10-09)
set -e
cd "$(dirname "$0")"
git add yonetim/phase1.js yonetim/phase3.js scripts_commit_odeme_sifresi.sh
git commit -m "Yönetim: Hesap kontrolünde ödeme şifresi durumu ve son 10 olay; 'Ödeme şifresini sıfırla' (kullanıcıya güvenlik DM'i) ve 'Ödeme şifresi kilidini aç' işlemleri (super yetki + sebep, kütük kaydı)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TH7HDk97zuXSh4fcHDoFj3"
git push origin main
