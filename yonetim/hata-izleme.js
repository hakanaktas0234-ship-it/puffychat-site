/* #21 (2026-10-11): panel hataları için ortak olay numarası ve kayıt.
   Sunucuya yalnız RPC adı, hata kodu, sınıf, sayfa ve sürüm gider.
   Token, içerik, IP, kişi ya da banka bilgisi GÖNDERİLMEZ. */
(function(root){
 'use strict';
 const SURUM='20261012rapor';
 let sb=null,active=false,lastKey='',lastAt=0;
 const harfler='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 function olayNo(){const a=new Uint8Array(8);(root.crypto||{}).getRandomValues?.(a);return [...a].map(x=>harfler[x%harfler.length]).join('');}
 const kodOf=e=>{const m=String(e?.code||'')+' '+String(e?.message||e||'');const k=m.match(/\b[A-Z][A-Z0-9_]{2,60}\b/);return k?k[0]:(e?.name||'HATA');};
 const sayfa=()=>String(root.location?.hash||'').replace(/^#/,'').split('?')[0].slice(0,60);
 function goster(no){
  if(!root.document?.body)return;
  let el=document.getElementById('hata-izi');
  if(!el){el=document.createElement('div');el.id='hata-izi';el.setAttribute('role','status');el.className='hata-izi';document.body.append(el);}
  el.textContent='Hata kaydı: '+no+' · Destek için bu numarayı ilet.';el.hidden=false;
  clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true;},9000);
 }
 function kaydet({rpc='',kod='',sinif='js'}){
  if(!active||!sb||rpc==='yonetim_hata_kaydet')return null;
  const key=rpc+'|'+kod;if(key===lastKey&&Date.now()-lastAt<5000)return null;lastKey=key;lastAt=Date.now();
  const no=olayNo();goster(no);
  try{Promise.resolve(orig.call(sb,'yonetim_hata_kaydet',{p_olay_no:no,p_rpc:rpc,p_kod:kod,p_sinif:sinif,p_sayfa:sayfa(),p_surum:SURUM})).catch(()=>{});}catch{}
  return no;
 }
 let orig=null;
 // Supabase istemcisinin rpc'si sarılır: hata dönen her çağrı kayda geçer, sonuç değişmez.
 function wrap(client){
  if(!client||client.__hataSarili)return client;sb=client;orig=client.rpc;client.__hataSarili=true;
  client.rpc=function(fn,args,opts){const b=orig.call(this,fn,args,opts);if(!b||typeof b.then!=='function')return b;const then=b.then.bind(b);
   b.then=(ok,ko)=>then(r=>{if(r&&r.error)kaydet({rpc:String(fn),kod:kodOf(r.error),sinif:'rpc'});return r;},err=>{kaydet({rpc:String(fn),kod:kodOf(err),sinif:'ag'});throw err;}).then(ok,ko);return b;};
  return client;
 }
 root.addEventListener?.('error',e=>{if(e?.target&&e.target!==root)return;kaydet({rpc:'',kod:kodOf(e.error||e.message),sinif:'js'});});
 root.addEventListener?.('unhandledrejection',e=>kaydet({rpc:'',kod:kodOf(e.reason),sinif:'promise'}));
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const tarih=s=>{try{return new Date(s).toLocaleString('tr-TR');}catch{return String(s);}};
 let caps={};
 function init(c){caps=c?.caps||{};active=true;if(c?.sb)wrap(c.sb);if(!root.document)return;document.querySelector('#hata-nav')?.remove();if(!caps.admin)return;const nav=document.createElement('div');nav.id='hata-nav';nav.innerHTML='<a class="menu" href="#hatalar">Panel hata kayıtları</a>';document.querySelector('#uyg nav')?.append(nav);if(!document.querySelector('#s-hatalar')){const s=document.createElement('section');s.id='s-hatalar';s.className='hidden';document.querySelector('.workspace')?.append(s);}}
 function stop(){active=false;caps={};if(!root.document)return;document.querySelector('#hata-nav')?.remove();document.querySelector('#s-hatalar')?.replaceChildren();}
 async function liste(q){const r=document.querySelector('#s-hatalar');if(!r)return;
  r.innerHTML='<div class="page-title"><div><div class="eyebrow">İzleme</div><h1>Panel hata kayıtları</h1><p>Yöneticinin gördüğü hata numarasıyla ara. Kayıtlarda kişi, içerik ya da token bilgisi yoktur.</p></div></div><form data-ara class="panel"><label>Hata numarası<input name="no" maxlength="8" value="'+esc(q||'')+'" placeholder="Örn. AB12CD34"></label><button class="primary">Ara</button></form><section class="panel" data-liste><div class="skeleton"></div></section>';
  r.querySelector('[data-ara]').onsubmit=e=>{e.preventDefault();liste(String(new FormData(e.target).get('no')||'').trim().toUpperCase());};
  try{const {data,error}=await orig.call(sb,'yonetim_hata_listesi',{p_olay_no:q||null,p_limit:100});if(error)throw error;
   r.querySelector('[data-liste]').innerHTML=(data||[]).length?'<table class="data-table"><thead><tr><th>Zaman</th><th>No</th><th>Yönetici</th><th>Sayfa</th><th>Çağrı</th><th>Kod</th><th>Sınıf</th></tr></thead><tbody>'+data.map(x=>'<tr><td>'+esc(tarih(x.created_at))+'</td><td><code>'+esc(x.olay_no)+'</code></td><td>'+esc(x.yonetici)+'</td><td>'+esc(x.sayfa)+'</td><td>'+esc(x.rpc)+'</td><td>'+esc(x.kod)+'</td><td>'+esc(x.sinif)+'</td></tr>').join('')+'</tbody></table>':'<div class="empty-state">Kayıt yok.</div>';
  }catch(e){r.querySelector('[data-liste]').innerHTML='<p role="alert">Liste alınamadı: '+esc(kodOf(e))+'</p>';}}
 function route(hash){if(hash!=='hatalar')return false;if(!caps.admin){root.location.hash='ozet';return true;}document.querySelectorAll('.workspace > [id^="s-"]').forEach(e=>e.classList.toggle('hidden',e.id!=='s-hatalar'));liste('');return true;}
 root.PuffyHata={wrap,init,stop,route,kaydet,olayNo};
 if(typeof module!=='undefined')module.exports=root.PuffyHata;
})(typeof window==='undefined'?globalThis:window);
