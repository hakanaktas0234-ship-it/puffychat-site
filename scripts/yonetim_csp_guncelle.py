#!/usr/bin/env python3
"""yonetim/index.html içindeki satır içi <script> değişince CSP özetini günceller.
Kullanım: python3 scripts/yonetim_csp_guncelle.py   (test: node --test test/yonetim/csp_test.cjs)"""
import base64, hashlib, re, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / 'yonetim' / 'index.html'
s = p.read_text(encoding='utf-8')
bloklar = re.findall(r'<script>(.*?)</script>', s, re.S)
ozetler = ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(b.encode('utf-8')).digest()).decode() + "'" for b in bloklar)
csp = ("default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net " + ozetler +
       "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; "
       "connect-src 'self' https://rjdddbwotczhagdulwco.supabase.co wss://rjdddbwotczhagdulwco.supabase.co "
       # Zego (yalnız sessiz oda dinleme): sinyal ve kayıt sunucuları
       "https://*.zego.im wss://*.zego.im https://*.zegocloud.com wss://*.zegocloud.com https://*.coolzcloud.com wss://*.coolzcloud.com "
       "https://*.coolbcloud.com wss://*.coolbcloud.com https://*.cooldcloud.com wss://*.cooldcloud.com https://*.coolfcloud.com wss://*.coolfcloud.com https://*.coolgcloud.com wss://*.coolgcloud.com; "
       "font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; worker-src 'self' blob:")
etiket = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">'
if 'http-equiv="Content-Security-Policy"' in s:
    s = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', lambda m: etiket, s, count=1)
else:
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + etiket, 1)
p.write_text(s, encoding='utf-8')
print('CSP güncellendi:', len(bloklar), 'satır içi betik')
