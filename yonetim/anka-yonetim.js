/* Oda Anka Hazinesi — sunucu yetkisi ve sürüm kontrolü zorunludur. */
(() => {
 'use strict';
 let ctx=null, generation=0;
 const root=()=>document.getElementById('s-anka-hazinesi');
 function stop(){generation++;ctx=null;root()?.replaceChildren();}
 async function load(){
  const c=ctx,g=++generation,r=root(); if(!c||!r)return;
  r.innerHTML='<p role="status">Anka durumu yükleniyor…</p>';
  try{
   const d=await c.rpc('yonetim_anka_durum',{});if(ctx!==c||g!==generation)return;
   r.innerHTML=`<header><span class="eyebrow">PUFFY / ODA SİSTEMİ</span><h1>Anka Hazinesi</h1><p>Oda hediyeleriyle biriken Anka havuzunun işletim kontrolü.</p></header><section class="anka-control"><div class="anka-state"><span>Sistem durumu</span><strong>${d.aktif?'Aktif':'Kapalı'}</strong><p>${d.aktif?'Yeni katkılar ve Anka patlamaları çalışır.':'Yeni katkılar ve patlamalar durduruldu.'}</p></div><p>Mevcut havuz, katkı sıralaması ve kazanılmış haklar korunur. Kapalı sürede gönderilen hediyeler Anka’ya eklenmez; sonradan biriktirilmez.</p><p>VIP ve çerçevelerin mevcut süreleri işlemeye devam eder.</p><p>Son değişiklik: ${c.esc(c.date(d.degistirilme))}</p>${d.neden?`<p>Gerekçe: ${c.esc(d.neden)}</p>`:''}<form><label>İşlem gerekçesi<textarea name="reason" minlength="3" maxlength="300" required placeholder="Bakım veya yeniden açma gerekçesi"></textarea></label><label class="anka-confirm"><input type="checkbox" required> ${d.aktif?'Tüm odalarda Anka’yı kapatmayı':'Tüm odalarda Anka’yı yeniden açmayı'} onaylıyorum.</label><button type="submit" class="${d.aktif?'danger':'primary'}">${d.aktif?'Anka’yı kapat':'Anka’yı aç'}</button><button type="button" data-refresh>Durumu yenile</button><p data-status role="status"></p></form></section>`;
   r.querySelector('[data-refresh]').onclick=load;
   r.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,reason=form.elements.reason.value.trim();if(reason.length<3||reason.length>300)return;
    form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await c.rpc('yonetim_anka_aktiflik',{p_aktif:!d.aktif,p_surum:d.surum,p_neden:reason});if(ctx===c&&g===generation){c.toast('Anka işletim durumu güncellendi.');await load();}}
    catch(err){if(ctx!==c||g!==generation)return;form.querySelector('[data-status]').textContent=err.message==='SETTING_VERSION_CONFLICT'?'Durum başka bir işlemle değişti. Durumu yenile.':c.errorText(err);form.querySelectorAll('button').forEach(b=>b.disabled=false);}
   };
  }catch(e){if(ctx===c&&g===generation){r.textContent=c.errorText(e);const b=document.createElement('button');b.textContent='Tekrar dene';b.onclick=load;r.append(b);}}
 }
 const old=window.PuffyKapsam;
 window.PuffyKapsam={...old,init(c){old.init(c);stop();ctx=c;},stop(){stop();old.stop();},route(hash){
  if(hash==='anka-hazinesi'){
   if(!ctx?.caps.owner)return false;
   let r=root();if(!r){r=document.createElement('section');r.id='s-anka-hazinesi';document.querySelector('.workspace').append(r);}
   document.querySelectorAll('.workspace > [id^="s-"]').forEach(x=>x.classList.toggle('hidden',x!==r));
   document.querySelectorAll('nav a.menu').forEach(x=>x.classList.toggle('aktif',x.dataset.sayfa===hash));
   const title=document.getElementById('route-name');if(title)title.textContent='Anka Hazinesi';
   document.querySelector('#uyg nav')?.classList.remove('open');load();return true;
  }
  generation++;return old.route(hash);
 }};
})();
