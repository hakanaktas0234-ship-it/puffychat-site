/* Oyun kasası — Altın Bahçe / Hız Pisti: kasa, bugünkü ciro/ödeme, son turlar ve RİSK KORUMASI
   devreye giren turlar (2026-10-07). Salt okunur, yalnız admin. */
(()=>{'use strict';let ctx=null,serial=0;const $=s=>document.querySelector(s),num=x=>new Intl.NumberFormat('tr-TR').format(x??0);
const OYUN={meyve:{ad:'Altın Bahçe',ozel:{altin_kus:'Altın Kuş',firtina:'Fırtına'}},pist:{ad:'Hız Pisti',ozel:{altin_kus:'Damalı Bayrak',firtina:'Pit Stop'}}};
const AD={elma:'Elma',portakal:'Portakal',kiraz:'Kiraz',uzum:'Üzüm',mango:'Mango',muz:'Muz',ananas:'Ananas',karpuz:'Karpuz',simsek:'Şimşek',bora:'Bora',kasirga:'Kasırga',yildirim:'Yıldırım',kuyruklu:'Kuyruklu',tayfun:'Tayfun',meteor:'Meteor',ejder:'Ejder',anka:'Anka',kral:'Kral'};
function sonucAdi(oyun,kod,carpan){if(!kod)return '—';const o=OYUN[oyun].ozel[kod];if(o)return o;return `${AD[kod]||kod}${carpan?' ×'+carpan:''}`;}
function init(c){stop();ctx=c;const a=$('[data-sayfa="oyun-kasasi"]');if(a)a.hidden=!c.caps.admin;}
function stop(){serial++;ctx=null;$('#s-oyunlar')?.replaceChildren();}
function route(hash){const [path,q]=hash.split('?'),[type]=path.split('/');if(type!=='oyun-kasasi')return false;serial++;if(!ctx?.caps.admin){location.hash='ozet';return true;}
 const c=ctx,params=new URLSearchParams(q||''),oyun=OYUN[params.get('oyun')]?params.get('oyun'):'pist',page=Math.max(0,Number(params.get('sayfa'))||0),root=$('#s-oyunlar'),n=serial;
 document.querySelectorAll('.workspace > [id^="s-"]').forEach(el=>el.classList.toggle('hidden',el!==root));document.querySelectorAll('nav a.menu').forEach(a=>a.classList.toggle('aktif',a.dataset.sayfa==='oyun-kasasi'));$('#uyg nav')?.classList.remove('open');
 root.innerHTML=`<div class="page-title"><div><div class="eyebrow">Oyunlar</div><h1>Oyun kasası</h1><p>Kasa, bugünkü ciro/ödeme ve son turlar. Risk koruması devreye giren turlarda adil sonuç ile verilen sonuç ayrı gösterilir.</p></div></div><div class="periods">${Object.entries(OYUN).map(([k,v])=>`<button data-oyun="${k}" class="${k===oyun?'aktif':''}">${v.ad}</button>`).join('')}</div><section class="panel" id="oyun-icerik"><div class="skeleton" role="status" aria-label="Yükleniyor"></div></section>`;
 root.querySelectorAll('[data-oyun]').forEach(b=>b.onclick=()=>{location.hash=`oyun-kasasi?oyun=${b.dataset.oyun}`;});
 (async()=>{const out=$('#oyun-icerik');try{const d=await c.rpc('yonetim_oyun_turlari',{p_oyun:oyun,p_limit:25,p_offset:page*25});if(n!==serial||!out?.isConnected)return;
   const k=d.kasa||{},g=d.bugun||{},net=(g.ciro||0)-(g.odeme||0)-(g.bonus_katki||0),oran=Math.round((k.risk_koruma_oran||0)*100);
   out.innerHTML=`<div class="metrics">
     <div class="metric"><span>Kasa bakiyesi</span><strong>${num(k.bakiye)}</strong><small>başlangıç ${num(k.baslangic)}</small></div>
     <div class="metric"><span>Bugün ciro</span><strong>${num(g.ciro)}</strong><small>${num(g.tur_sayisi)} tur</small></div>
     <div class="metric"><span>Bugün ödeme</span><strong>${num(g.odeme)}</strong><small>bonus havuzu ${num(g.bonus_katki)}</small></div>
     <div class="metric"><span>Bugün net</span><strong>${net>=0?'+':''}${num(net)}</strong><small>kasaya</small></div>
     <div class="metric ${d.risk_bugun?'uyari':''}"><span>Risk koruması</span><strong>${num(d.risk_bugun)} / ${num(d.risk_toplam)}</strong><small>bugün / toplam · eşik kasanın %${oran}'ı${oran?'':' (kapalı)'}</small></div>
   </div>
   <h3>Son turlar</h3><div class="table-wrap"><table class="data-table responsive"><thead><tr><th>Tur</th><th>Kapanış</th><th>Sonuç</th><th>Ciro</th><th>Ödeme</th><th>Oyuncu</th><th>Risk koruması</th></tr></thead><tbody>
   ${(d.turlar||[]).map(t=>`<tr class="${t.risk_korumasi?'risk':''}"><td>${t.tur_no}</td><td>${c.esc(c.date(t.kapanis_at))}</td><td>${c.esc(sonucAdi(oyun,t.sonuc_kod,t.carpan))}</td><td>${num(t.ciro)}</td><td>${num(t.odeme)}</td><td>${num(t.oyuncu_sayisi)}</td><td>${t.risk_korumasi?`<span class="rozet uyari">DEVREDE</span> adil sonuç: ${c.esc(sonucAdi(oyun,t.adil_kod,t.adil_carpan))}`:'—'}</td></tr>`).join('')||'<tr><td colspan="7">Kayıt yok.</td></tr>'}
   </tbody></table></div>
   <div class="pager"><span>${num(d.toplam)} tur · Sayfa ${page+1}</span><button data-prev ${page?'':'disabled'}>Önceki</button><button data-next ${(page+1)*25>=(d.toplam||0)?'disabled':''}>Sonraki</button></div>`;
   out.querySelector('[data-prev]').onclick=()=>{location.hash=`oyun-kasasi?oyun=${oyun}&sayfa=${page-1}`;};out.querySelector('[data-next]').onclick=()=>{location.hash=`oyun-kasasi?oyun=${oyun}&sayfa=${page+1}`;};
  }catch(e){if(n===serial&&out)out.innerHTML=`<div class="empty-state">${c.esc(c.errorText(e))}</div>`;}})();
 return true;}
window.PuffyOyunlar={init,stop,route};})();
