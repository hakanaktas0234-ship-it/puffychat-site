// Oda linki önizlemeleri: room/<kod>/index.html (og:title, og:image = oda kapağı).
// Zamanlanmış iş (.github/workflows/oda-onizleme.yml) her 15 dk çalıştırır; elle: node scripts/oda_onizleme.mjs
// Anahtar herkese açık "publishable" anahtardır (uygulamada da gömülü), gizli değil.
import fs from 'node:fs';
import path from 'node:path';

const URL_ = 'https://rjdddbwotczhagdulwco.supabase.co/rest/v1/rpc/oda_onizleme_listesi';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_TMb-Ldq66Pi3ehxPSYB8JA_aQ-zEeHd';
const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ODA = path.join(KOK, 'room');
const PLAY = 'https://play.google.com/store/apps/details?id=com.drgdijital.puffy';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sayfa({ kod, ad, kapak }) {
  const baslik = `${ad || 'Puffy odası'} · Puffy`;
  const aciklama = `Puffy'de "${ad || 'bir oda'}" odasına davet edildin. Oda numarası: ${kod}. Katılmak için dokun.`;
  const resim = kapak ? `<meta property="og:image" content="${esc(kapak)}">\n<meta property="og:image:alt" content="${esc(ad)} oda kapağı">\n<meta name="twitter:image" content="${esc(kapak)}">` : '';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(baslik)}</title>
<meta name="robots" content="noindex">
<meta name="description" content="${esc(aciklama)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Puffy">
<meta property="og:title" content="${esc(baslik)}">
<meta property="og:description" content="${esc(aciklama)}">
<meta property="og:url" content="https://puffychat.com/room/${esc(kod)}">
${resim}
<meta name="twitter:card" content="${kapak ? 'summary_large_image' : 'summary'}">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="ust"><div class="kabuk"><a class="marka" href="/">Puffy<span>.</span></a></div></header>
<main><div class="kabuk">
  <h1>${esc(ad || 'Bir Puffy odasına davet edildin')}</h1>
  ${kapak ? `<p><img src="${esc(kapak)}" alt="${esc(ad)} oda kapağı" style="width:100%;max-width:360px;border-radius:16px"></p>` : ''}
  <p class="ozet">Odaya girmek için Puffy uygulamasına ihtiyacın var. Uygulama yüklüyse bu link doğrudan odayı açar.</p>
  <div class="kutu vurgu"><h3>Oda numarası</h3><p class="eposta" style="font-size:22px">${esc(kod)}</p></div>
  <a class="dugme" href="${PLAY}">Google Play’den indir</a>
</div></main>
</body>
</html>
`;
}

const yanit = await fetch(URL_, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json', 'Content-Profile': 'public', 'Accept-Profile': 'public' }, body: '{}' });
if (!yanit.ok) { console.error('RPC hatası', yanit.status, await yanit.text()); process.exit(1); }
const odalar = await yanit.json();
const yazilan = new Set();
for (const o of odalar) {
  if (!/^[A-Za-z0-9_]{1,32}$/.test(String(o.kod))) continue;
  // Özel ID büyük/küçük harf duyarsız çözülür; GitHub Pages yolu duyarlı → üç yazım.
  for (const k of new Set([String(o.kod), String(o.kod).toUpperCase(), String(o.kod).toLowerCase()])) {
    const dizin = path.join(ODA, k);
    fs.mkdirSync(dizin, { recursive: true });
    fs.writeFileSync(path.join(dizin, 'index.html'), sayfa({ ...o, kod: k }));
    yazilan.add(k);
  }
}
// Kapanan odaların sayfaları kalkar (404 karşılaması devreye girer).
if (fs.existsSync(ODA)) for (const d of fs.readdirSync(ODA)) if (!yazilan.has(d)) fs.rmSync(path.join(ODA, d), { recursive: true, force: true });
console.log(`oda önizlemesi: ${yazilan.size} sayfa`);
