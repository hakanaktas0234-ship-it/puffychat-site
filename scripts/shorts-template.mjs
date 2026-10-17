export const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function coverUrl(value){
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&
  (u.hostname==='rjdddbwotczhagdulwco.supabase.co'||u.hostname.endsWith('.cloudflarestream.com')||u.hostname==='videodelivery.net'||u.hostname==='imagedelivery.net')&&
  !/\.(mp4|webm|m3u8)(?:$|\?)/i.test(u.pathname)?u.href:null;}catch{return null;}
}
export function render(item=null){
 if(item&&!UUID.test(item.id))throw Error('INVALID_ID');
 const title=item?`${item.nickname || 'Puffy'} · Puffy Shorts`:'Puffy Shorts';
 const caption=item?.caption||'Bu anı Puffy’de izle.';
 const cover=coverUrl(item?.cover);
 const canonical=item?`https://puffychat.com/shorts/${item.id}`:'https://puffychat.com/shorts/';
 return `<!doctype html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="robots" content="noindex"><meta name="description" content="${esc(caption)}">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Puffy">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(caption)}"><meta property="og:url" content="${canonical}">
${cover?`<meta property="og:image" content="${esc(cover)}"><meta property="og:image:alt" content="${esc(item.nickname)} · video kapağı">`:''}
<meta name="twitter:card" content="${cover?'summary_large_image':'summary'}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="stylesheet" href="/shorts/share.css"><script type="module" src="/shorts/share.js"></script>
</head><body class="short-share">
<header class="share-header"><a href="/" aria-label="Puffy ana sayfa" class="wordmark">Puffy<span>.</span></a><span class="edition">SHORTS</span><a href="/destek/" class="help">Destek</a></header>
<main class="share-main"><section class="poster" aria-label="Video kapağı"><img id="cover" alt="Video kapağı" hidden><div class="poster-empty" id="cover-empty"><span class="poster-word">Puffy.</span><span>HER ANIN BİR HİKÂYESİ VAR</span></div><span class="poster-label">PUFFY SHORTS</span><div class="poster-shade"></div><div class="poster-caption"><span class="play-mark" aria-hidden="true">▷</span><p>Bir an.<br><em>Birlikte daha güzel.</em></p></div></section>
<section class="share-info"><p class="eyebrow">SENİNLE PAYLAŞILDI</p><h1 id="share-title">Bir Puffy anı<br>seni bekliyor.</h1><p id="share-caption" class="share-caption" aria-live="polite">Video bilgisi kontrol ediliyor…</p><a id="open-app" class="primary" hidden>Puffy’de izle <span aria-hidden="true">↗</span></a><button id="retry" class="secondary" hidden>Tekrar dene</button><a id="download" class="secondary" href="https://play.google.com/store/apps/details?id=com.drgdijital.puffy">Google Play’den indir</a><p class="hint" id="share-hint">Videoyu Puffy uygulamasında izleyebilirsin.</p></section></main>
<footer class="share-footer"><span>Senin insanların. Senin anların.</span><nav><a href="/gizlilik/">Gizlilik</a><a href="/kullanim-sartlari/">Koşullar</a></nav></footer></body></html>`;
}
