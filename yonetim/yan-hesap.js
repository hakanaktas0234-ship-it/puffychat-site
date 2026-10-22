/* #24 (2026-10-11): yan hesap ve davet incelemesi tek dosyada.
   Aynı telefon, aynı bağlantı (IP maskeli), davet ilişkileri ve kazanç, güvenlik incelemesi, engeller.
   Dosyayı açmak yönetim kaydına geçer. */
(function(root){
 'use strict';
 let ctx=null,serial=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const t=s=>{if(!s)return '—';try{return new Date(s).toLocaleString('tr-TR');}catch{return String(s);}};
 const sayi=n=>new Intl.NumberFormat('tr-TR').format(Number(n)||0);
 function init(c){stop();ctx=c;if(!c?.caps?.admin)return;const nav=document.createElement('div');nav.id='yan-hesap-nav';nav.innerHTML='<a class="menu" href="#yan-hesap">Yan hesap incelemesi</a>';document.querySelector('#uyg nav')?.append(nav);if(!document.querySelector('#s-yan-hesap')){const s=document.createElement('section');s.id='s-yan-hesap';s.className='hidden';document.querySelector('.workspace')?.append(s);}}
 function stop(){serial++;ctx=null;document.querySelector('#yan-hesap-nav')?.remove();document.querySelector('#s-yan-hesap')?.replaceChildren();}
 function goster(){document.querySelector('#uyg nav')?.classList.remove('open');document.querySelector('#panel-topbar .mobile-menu')?.setAttribute('aria-expanded','false');const rn=document.querySelector('#route-name');if(rn)rn.textContent='Yan hesap incelemesi';document.querySelectorAll('.workspace > [id^="s-"]').forEach(e=>e.classList.toggle('hidden',e.id!=='s-yan-hesap'));}
 function route(hash){const [ad,q]=hash.split('?');if(ad!=='yan-hesap')return false;if(!ctx?.caps?.admin){location.hash='ozet';return true;}goster();const id=new URLSearchParams(q||'').get('kisi');id?dosya(id):kuyruk();return true;}
 const rpc=async(n,a)=>{const c=ctx;if(!c)throw new Error('NOT_AUTHENTICATED');const {data,error}=await c.sb.rpc(n,a).abortSignal(AbortSignal.timeout(20000));if(ctx!==c)throw new Error('STALE_SESSION');if(error)throw error;return data;};
 const hataMetni=e=>{const m=String(e?.message||e);return m.includes('ALREADY_REVIEWED')?'Bu inceleme zaten sonuçlanmış; dosyayı yenile.':m.includes('REVIEW_REASON_REQUIRED')?'3–200 karakter karar gerekçesi yaz.':m.includes('TARGET_NOT_FOUND')?'Bu ID ile kullanıcı bulunamadı.':m.includes('MFA_REQUIRED')?'Güvenlik doğrulamanı yenilemek için yeniden giriş yap.':m.includes('NOT_AUTHORIZED')?'Bu işlem için yetkin yok.':m.includes('REVIEW_CHANGED')?'Karar değişti. Dosyayı yenileyip yeniden kontrol et.':m.includes('ACTIVE_ACCOUNT_BAN')?'Bu hesapta aktif ban var. Yan hesap izni banı kaldırmaz.':m.includes('ACTIVE_DEVICE_BAN')?'Bu cihazda aktif ban var. Yan hesap izni banı kaldırmaz.':m.includes('REQUEST_NOT_FOUND')?'İzin verilecek inceleme kaydı yok. Önce hesap engellenen cihazdan giriş denemesi yapmalı.':'İşlem tamamlanamadı.';};
 function arama(){return '<form data-ara class="panel"><label>Kullanıcı ID (örn. 517468)<input name="kisi" inputmode="numeric" maxlength="40" required></label><button class="primary">Dosyayı aç</button></form>';}
 function baglaArama(r){r.querySelector('[data-ara]').onsubmit=e=>{e.preventDefault();const v=String(new FormData(e.target).get('kisi')||'').trim();if(v)location.hash='yan-hesap?kisi='+encodeURIComponent(v);};}
 async function kuyruk(){const n=++serial,r=document.querySelector('#s-yan-hesap');
  r.innerHTML='<div class="page-title"><div><div class="eyebrow">Güvenlik</div><h1>Yan hesap incelemesi</h1><p>Aynı telefon, aynı bağlantı ve davet ilişkileri tek dosyada. Kararlar senin; sistem yalnız işaretler.</p></div></div>'+arama()+'<section class="panel" data-liste><div class="skeleton"></div></section>';baglaArama(r);
  try{const rows=await rpc('yonetim_yan_hesap_kuyrugu');if(n!==serial)return;
   r.querySelector('[data-liste]').innerHTML='<h2>İncelenmesi önerilenler</h2>'+((rows||[]).length?rows.map(x=>'<a class="approval-row" href="#yan-hesap?kisi='+esc(x.display_id)+'"><span><strong>'+esc(x.nickname)+' #'+esc(x.display_id)+'</strong><small>'+esc(x.sebep)+' · '+esc(t(x.zaman))+'</small></span><span>Dosya →</span></a>').join(''):'<div class="empty-state">Şu an işaretli hesap yok.</div>');
   r.querySelectorAll('[data-liste] a').forEach(a=>a.onclick=e=>{e.preventDefault();const hash=a.getAttribute('href').slice(1);if(location.hash.slice(1)!==hash)history.pushState(null,'','#'+hash);route(hash);});
  }catch(e){if(n===serial)r.querySelector('[data-liste]').innerHTML='<p role="alert">'+esc(hataMetni(e))+'</p>';}}
 const etiket=(v,ok,no)=>v?'<span class="badge warn">'+ok+'</span>':'<span class="badge ok">'+no+'</span>';
 async function dosya(kimlik){const n=++serial,r=document.querySelector('#s-yan-hesap'),c=ctx;
  r.innerHTML='<div class="page-title"><div><div class="eyebrow">Yan hesap incelemesi</div><h1>Dosya</h1></div><div><a class="menu" href="#yan-hesap">← Liste</a></div></div>'+arama()+'<section data-dosya><div class="skeleton"></div></section>';baglaArama(r);r.querySelector('[data-ara] input').value=kimlik;
  try{const d=await rpc('yonetim_yan_hesap_dosyasi',{p_kimlik:kimlik});if(n!==serial)return;const k=d.kisi||{},g=d.guvenlik,de=d.davet_eden,dt=d.davet_ettikleri||{};
   const kazanc=Object.entries(dt.kazanc||{}).map(([a,b])=>esc(a)+': '+sayi(b)).join(' · ')||'—';
   r.querySelector('[data-dosya]').innerHTML=
    '<section class="panel"><h2>'+esc(k.nickname)+' #'+esc(k.display_id)+'</h2><dl class="key-values"><div><dt>Hesap açılışı</dt><dd>'+esc(t(k.acilis))+'</dd></div><div><dt>Bilinen cihaz</dt><dd>'+esc(k.cihaz_sayisi)+'</dd></div><div><dt>Ban</dt><dd>'+(k.ban?'Var · '+esc(k.ban.sebep||'')+' · '+esc(k.ban.bitis?t(k.ban.bitis):'süresiz'):'Yok')+'</dd></div>'+
    '<div><dt>Güvenlik incelemesi</dt><dd>'+(g?esc((g.sebep==='cihaz'?'Aynı telefon':'Aynı IP')+' · '+g.durum+' · '+t(g.tarih)):'Yok')+'</dd></div>'+
    '<div><dt>Engellenen yeni hesap denemesi</dt><dd>'+esc(d.cihaz_engelleri?.sayi||0)+(d.cihaz_engelleri?.son?' · son '+esc(t(d.cihaz_engelleri.son)):'')+'</dd></div><div><dt>Cihaz banı</dt><dd>'+((d.cihaz_banlari||[]).length?esc(d.cihaz_banlari.length)+' aktif':'Yok')+'</dd></div></dl></section>'+
    hesapKarari(g,k,c)+
    '<section class="panel"><h2>Aynı telefondaki hesaplar ('+esc((d.ayni_cihaz||[]).length)+')</h2>'+((d.ayni_cihaz||[]).length?'<table class="data-table"><thead><tr><th>Hesap</th><th>Açılış</th><th>Son görülme</th><th>İzin</th><th>Ban</th></tr></thead><tbody>'+d.ayni_cihaz.map(x=>'<tr><td><a href="#yan-hesap?kisi='+esc(x.display_id)+'">'+esc(x.ad)+' #'+esc(x.display_id)+'</a></td><td>'+esc(t(x.acilis))+'</td><td>'+esc(t(x.son_gorulme))+'</td><td>'+(x.izinli?'İzinli':'—')+'</td><td>'+(x.banli?'Banlı':'—')+'</td></tr>').join('')+'</tbody></table>':'<p>Yok.</p>')+'</section>'+
    '<section class="panel"><h2>Aynı bağlantıdan girenler</h2>'+((d.ayni_ip||[]).length?d.ayni_ip.map(x=>'<p><strong>'+esc(x.ip)+'</strong> · '+esc(x.hesap_sayisi)+' hesap<br><small>'+esc((x.hesaplar||[]).slice(0,30).join(', '))+'</small></p>').join(''):'<p>Yok.</p>')+'<p class="note">IP adresleri maskeli gösterilir.</p></section>'+
    '<section class="panel"><h2>Davet</h2><dl class="key-values"><div><dt>Davet eden</dt><dd>'+(de?esc(de.ad)+' · '+esc(t(de.tarih))+' · '+etiket(de.ayni_cihaz,'Aynı telefon','Farklı telefon')+' '+etiket(de.ayni_ag,'Aynı ağ','Farklı ağ')+(de.supheli?' · <b>Şüpheli</b>: '+esc(de.neden||'')+' · '+esc(de.inceleme||'incelenmedi'):''):'—')+'</dd></div>'+
    '<div><dt>Davet ettikleri</dt><dd>'+esc(dt.toplam||0)+' kişi · '+esc(dt.supheli||0)+' şüpheli</dd></div><div><dt>Davet kazancı</dt><dd>'+kazanc+'</dd></div></dl>'+
    (de&&de.supheli&&!de.inceleme?karar(k.user_id,'Bu davetin kazancı'):'')+
    ((dt.liste||[]).length?'<table class="data-table"><thead><tr><th>Davet edilen</th><th>Tarih</th><th>Yükleme</th><th>Pay</th><th>Durum</th><th></th></tr></thead><tbody>'+dt.liste.map(x=>'<tr><td><a href="#yan-hesap?kisi='+esc(String(x.ad).split('#').pop())+'">'+esc(x.ad)+'</a></td><td>'+esc(t(x.tarih))+'</td><td>'+sayi(x.yukleme)+'</td><td>'+sayi(x.pay)+'</td><td>'+(x.supheli?'Şüpheli'+(x.ayni_cihaz?' · aynı telefon':'')+' · '+esc(x.inceleme||'incelenmedi'):'Normal')+'</td><td>'+(x.supheli&&!x.inceleme?karar(x.user_id,'Kazanç'):'')+'</td></tr>').join('')+'</tbody></table>':'')+
    '</section>';
   if(c.caps.owner){
    const box=document.createElement('section');box.className='panel';r.querySelector('[data-dosya]').prepend(box);
    box.innerHTML='<h2>Son cihaz için hesap izni</h2><p>Kontrol ediliyor…</p>';
    try{
     const state=await rpc('yonetim_son_cihaz_durumu',{p_user:k.user_id});if(ctx!==c||n!==serial)return;
     const blocked=state.account_banned||state.device_banned||state.review!=='onay';
     box.innerHTML='<h2>Son cihaz için hesap izni</h2><p>Hesap: <strong>'+esc(k.nickname)+' #'+esc(k.display_id)+'</strong></p>'+(!state.attempt?'<p>Engellenen cihaz denemesi yok.</p>':'<p>Son engellenme: '+esc(t(state.date))+'</p><p>Bu cihazdaki diğer hesaplar: '+esc((state.accounts||[]).map(x=>x.nickname+' #'+x.display_id).join(', ')||'Yok')+'</p><p>Hesap banı: '+(state.account_banned?'Var':'Yok')+' · Cihaz banı: '+(state.device_banned?'Var':'Yok')+'</p><p><strong>'+(blocked?'Önce ban veya hesap incelemesini değerlendir.':state.allowed?'Bu hesap son cihazda izinli.':'Hesap onaylı; son cihazın izni eksik.')+'</strong></p>'+(!blocked&&!state.allowed?'<form><label>İzin gerekçesi<textarea name="neden" required minlength="3" maxlength="200"></textarea></label><p>İzin yalnız yukarıdaki hesaba ve bu cihaza aittir. Diğer hesaplar devralmaz.</p><button class="primary">Yalnız bu hesaba, bu cihazda izin ver</button><p role="alert" aria-live="polite"></p></form>':''));
     const form=box.querySelector('form');if(form)form.onsubmit=async event=>{
      event.preventDefault();if(form.dataset.busy==='true')return;const reason=String(new FormData(form).get('neden')||'').trim();if(reason.length<3||reason.length>200)return;
      form.dataset.busy='true';form.querySelector('button').disabled=true;
      try{await rpc('yonetim_son_cihaza_izin',{p_user:k.user_id,p_attempt:state.attempt,p_version:state.version,p_neden:reason});if(ctx!==c||n!==serial)return;c.toast?.('Yalnız bu hesaba son cihazda izin verildi.');dosya(kimlik);}
      catch(error){if(ctx!==c||n!==serial)return;form.querySelector('[role=alert]').textContent=hataMetni(error);form.dataset.busy='false';form.querySelector('button').disabled=false;}
     };
    }catch(error){if(ctx===c&&n===serial)box.innerHTML='<h2>Son cihaz için hesap izni</h2><p role="alert">Cihaz durumu alınamadı. Sunucu modülünü kontrol et. Mevcut hesap kararı aşağıda korunur.</p>';}
   }
   const hf=r.querySelector('[data-hesap-karar]');
   if(hf) hf.onsubmit=async e=>{
    e.preventDefault();const err=hf.querySelector('[role=alert]');
    const reason=String(new FormData(hf).get('neden')||'').trim();
    const action=e.submitter?.dataset.hesapOnay;
    if(!['true','false'].includes(action)||reason.length<3){err.textContent='Karar düğmesini seç ve en az 3 karakter gerekçe yaz.';return;}
    if(hf.dataset.busy==='true')return;
    hf.dataset.busy='true';hf.querySelectorAll('button,textarea').forEach(b=>b.disabled=true);err.textContent='Karar kaydediliyor…';
    try{
     if(g?.durum==='red'&&action==='true')await rpc('yonetim_yan_hesap_yeniden_izin',{p_user:k.user_id,p_karar_at:g.karar_at||null,p_neden:reason});
     else await rpc('yonetim_onay_karari',{p_tur:'hesap_guvenlik',p_id:k.user_id,p_onay:action==='true',p_neden:reason,p_coin:null,p_kod:null});
     if(ctx!==c||n!==serial)return;
     c.toast?.(action==='true'?'Hesap incelemesine izin verildi.':'Hesap incelemesi reddedildi.');dosya(kimlik);
    }catch(error){if(ctx!==c||n!==serial)return;err.textContent=hataMetni(error);hf.dataset.busy='false';hf.querySelectorAll('button,textarea').forEach(b=>b.disabled=false);}
   };
   r.querySelectorAll('[data-karar]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f),secim=fd.get('onay');if(secim!=='true'&&secim!=='false'){f.querySelector('[role=alert]').textContent='Önce kararı seç.';return;}
    f.querySelectorAll('button').forEach(b=>b.disabled=true);try{await rpc('yonetim_davet_karar_kayitli',{p_davet_edilen:f.dataset.karar,p_onay:secim==='true',p_neden:String(fd.get('neden')||'')});ctx.toast?.('Davet kararı kaydedildi.');dosya(kimlik);}catch(err){f.querySelector('[role=alert]').textContent=hataMetni(err);f.querySelectorAll('button').forEach(b=>b.disabled=false);}});
  }catch(e){if(n===serial)r.querySelector('[data-dosya]').innerHTML='<p role="alert">'+esc(hataMetni(e))+'</p>';}}
 function hesapKarari(g,k,c){
  if(!g)return '<section class="panel"><h2>Hesap erişim kararı</h2><p>Bu hesap için güvenlik incelemesi kaydı yok. İzin verilecek cihazı belirlemek için hesap önce engellendiği cihazdan giriş denemesi yapmalı. ID’ye genel veya sonraki hesaplara geçerli izin verilmez.</p></section>';
  const labels={bekliyor:'İnceleme bekliyor',onay:'İzin verildi',red:'Reddedildi'};
  let html='<section class="panel"><h2>Hesap erişim kararı</h2><p><strong>'+esc(labels[g.durum]||g.durum)+'</strong></p>';
  if(g.durum!=='bekliyor'&&g.durum!=='red')return html+'<dl class="key-values"><div><dt>Gerekçe</dt><dd>'+esc(g.karar_notu||'—')+'</dd></div><div><dt>Karar tarihi</dt><dd>'+esc(t(g.karar_at))+'</dd></div><div><dt>Karar veren</dt><dd>'+esc(g.karar_veren||g.karar_by||'—')+'</dd></div></dl></section>';
  if(!c.caps.owner)return html+'<p>Karar yetkisi yalnız platform sahibinde.</p></section>';
  return html+(g.durum==='red'?'<dl class="key-values"><div><dt>Önceki ret gerekçesi</dt><dd>'+esc(g.karar_notu||'—')+'</dd></div><div><dt>Önceki karar</dt><dd>'+esc(t(g.karar_at))+' · '+esc(g.karar_veren||g.karar_by||'—')+'</dd></div></dl>':'')+'<p class="note">İzin yalnız bu hesaba ve incelemedeki cihaza aittir. Yeni açılan diğer hesaplar bu izni devralmaz. İzin ver: hesap incelemesi onaylanır; mevcut hesap ve cihaz banları kaldırılmaz. Reddet: inceleme nedeniyle erişim kapalı kalır. Davet kazancı ayrı değerlendirilir.</p><form data-hesap-karar><label>Karar gerekçesi<textarea name="neden" required minlength="3" maxlength="200"></textarea></label><div class="dialog-actions"><button type="submit" class="primary" data-hesap-onay="true">'+(g.durum==='red'?'Yeniden izin ver':'İzin ver')+'</button>'+(g.durum==='bekliyor'?'<button type="submit" class="tehlike" data-hesap-onay="false">Reddet</button>':'')+'</div><p role="alert" aria-live="polite"></p></form></section>';
 }
 function karar(uid,ne){return '<form data-karar="'+esc(uid)+'" class="inline-form"><label>'+esc(ne)+'<select name="onay" required><option value="" selected disabled>Karar seç…</option><option value="true">Öde (onay)</option><option value="false">İptal et (red)</option></select></label><label>Gerekçe<input name="neden" required minlength="3" maxlength="200"></label><button class="primary">Kaydet</button><p role="alert"></p></form>';}
 root.PuffyYanHesap={init,stop,route};
})(window);
