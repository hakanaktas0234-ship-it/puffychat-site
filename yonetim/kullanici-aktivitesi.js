(() => {
 'use strict';
 let ctx=null, epoch=0, timer=null, page=0, query='', user=null, model=null;
 const $=s=>document.querySelector(s), date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(Date.now()+offset*86400000));
 let from=date(-6),to=date(0),auto=false;
 const duration=n=>{if(n==null)return 'Ölçülmedi';const s=Math.max(0,Math.floor(Number(n)||0));return `${Math.floor(s/3600)} sa ${Math.floor(s%3600/60)} dk ${s%60} sn`;};
 function csvCell(v){let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
 function csv(rows){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
 function stop(){epoch++;clearTimeout(timer);timer=null;model=null;$('#s-kullanici-aktivitesi')?.replaceChildren();}
 function validId(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');}
 function exportData(){
  if(!model)return;
  const rows=user?[['Gün','Uygulama önde (sn)','Oda (sn)','Mikrofon bildirimi (sn)'],...(model.daily||[]).map(x=>[x.day,x.measurement_available&&model.rows?.[0]?.app_measured?x.app_seconds:'Ölçülmedi',x.measurement_available?x.room_seconds:'Ölçülmedi',x.measurement_available&&model.rows?.[0]?.mic_measured?x.mic_seconds:'Ölçülmedi'])]
   :[['ID','İsim','Uygulama önde (sn)','Oda (sn)','Mikrofon bildirimi (sn)','Çakışmasız toplam (sn)'],...(model.rows||[]).map(x=>[x.display_id,x.nickname,x.app_measured?x.app_seconds:'Ölçülmedi',x.room_seconds,x.mic_measured?x.mic_seconds:'Ölçülmedi',x.total_seconds])];
  const url=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`puffy-aktivite-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function table(headers,rows){return `<div class="activity-table"><table><thead><tr>${headers.map(x=>`<th scope="col">${ctx.esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">Bu aralıkta kayıt yok.</td></tr>`}</tbody></table></div>`;}
 function cell(v){return `<td>${ctx.esc(v??'—')}</td>`;}
 function bind(root){
  root.querySelector('[data-filter]').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;const nextFrom=f.elements.from.value,nextTo=f.elements.to.value;const days=(Date.parse(nextTo)-Date.parse(nextFrom))/86400000;if(!Number.isFinite(days)||days<0||days>30){ctx.toast('En fazla 31 günlük geçerli bir aralık seç.');return;}query=f.elements.query.value.trim();from=nextFrom;to=nextTo;page=0;load();};
  root.querySelector('[data-refresh]').onclick=load;root.querySelector('[data-export]').onclick=exportData;
  root.querySelector('[data-auto]').onchange=e=>{auto=e.target.checked;clearTimeout(timer);schedule();};
  root.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{from=date(1-Number(b.dataset.days));to=date(0);page=0;load();});
  root.querySelector('[data-prev]')?.addEventListener('click',()=>{page--;load();});root.querySelector('[data-next]')?.addEventListener('click',()=>{page++;load();});
 }
 function schedule(){clearTimeout(timer);if(!auto||!ctx)return;timer=setTimeout(()=>{const root=$('#s-kullanici-aktivitesi');if(!document.hidden&&!root?.querySelector('form')?.contains(document.activeElement))load();else schedule();},30000);}
 async function load(){
  const c=ctx,g=++epoch;if(!c?.caps.owner)return;clearTimeout(timer);
  let root=$('#s-kullanici-aktivitesi');if(!root){root=document.createElement('section');root.id='s-kullanici-aktivitesi';$('.workspace').append(root);}
  document.querySelectorAll('.workspace > [id^="s-"]').forEach(x=>x.classList.toggle('hidden',x!==root));
  root.setAttribute('aria-busy','true');
  try{
   const d=await c.rpc('yonetim_kullanici_aktivitesi',{p_baslangic:from,p_bitis:to,p_arama:user?'':query,p_user:user,p_limit:25,p_offset:page*25});
   if(ctx!==c||g!==epoch)return;model=d;const summary=d.summary||{},person=d.rows?.[0];
   root.innerHTML=`<div class="page-title"><div><span class="eyebrow">KULLANIM / ÖLÇÜLEN SÜRELER</span><h1>Kullanıcı aktivitesi</h1></div><button data-refresh>Yenile</button></div>
    <p class="note">Ölçüm başlangıcı: ${c.esc(c.date(d.recorded_from))} · Türkiye saati. Önceki günlere geçmiş saat üretilmez. Süreler son doğrulanan sinyale kadardır; 90 saniyeyi aşan kopukluklar eklenmez.</p>
    <form data-filter class="activity-filters"><label>İsim veya Puffy ID<input name="query" maxlength="100" value="${c.esc(query)}" ${user?'disabled':''} placeholder="Örn. 290873"></label><label>Başlangıç<input type="date" name="from" required value="${c.esc(from)}"></label><label>Bitiş<input type="date" name="to" required value="${c.esc(to)}"></label><button class="primary">Uygula</button></form>
    <div class="activity-actions"><button data-days="1">Bugün</button><button data-days="7">Son 7 gün</button><button data-days="30">Son 30 gün</button><button data-export>${user?'Günlük dökümü':'Bu sayfayı'} CSV indir</button><label><input type="checkbox" data-auto ${auto?'checked':''}>30 sn’de yenile</label>${user?'<a href="#kullanici-aktivitesi">Tüm kullanıcılara dön</a>':''}</div>
    <div class="metrics">${[['Ölçülen kullanıcı',summary.users_measured??0],['Taze sinyal',summary.online??0],['Uygulama önde',duration(summary.app_seconds)],['Odada',duration(summary.room_seconds)],['Çakışmasız toplam',duration(summary.total_seconds)]].map(([k,v])=>`<div class="metric"><span>${c.esc(k)}</span><strong>${c.esc(v)}</strong></div>`).join('')}</div>
    <p class="note">Uygulama önde: ekranda açık kullanım; dokunma/konuşma kanıtı değildir. Oda süresi arka plandaki ses oturumunu da kapsayabilir. Mikrofon: uygulamanın bildirdiği yayın durumu; gerçek konuşma veya hakediş ölçümü değildir. Toplam, uygulama ve oda aralıklarının birleşimidir; aynı anda geçen süre iki kez sayılmaz. “Ölçülmedi”, yeni uygulama ölçüm sinyali henüz alınmadığını gösterir.</p>
    ${table(['Kullanıcı','Durum','Uygulama önde','Oda','Mikrofon bildirimi','Kullanım aralığı','Son sinyal','Detay'],(d.rows||[]).map(x=>`<tr>${cell(`${x.nickname||'İsimsiz'} · #${x.display_id||''}`)}${cell(x.online?'Taze sinyal':'Çevrimdışı / sinyal eski')}${cell(x.app_measured?duration(x.app_seconds):'Ölçülmedi')}${cell(duration(x.room_seconds))}${cell(x.mic_measured?duration(x.mic_seconds):'Ölçülmedi')}${cell(x.app_sessions)}${cell(x.last_signal?c.date(x.last_signal):'Ölçülmedi')}<td>${validId(x.id)?`<a href="#kullanici-aktivitesi?user=${encodeURIComponent(x.id)}">Aktivite</a> · <a href="#kullanici/${encodeURIComponent(x.id)}">Profil</a>`:''}</td></tr>`))}
    <div class="pager"><button data-prev ${page===0?'disabled':''}>Önceki</button><span>${c.esc(d.total)} kullanıcı · Sayfa ${page+1}</span><button data-next ${(page+1)*25>=d.total?'disabled':''}>Sonraki</button></div>
    ${user?`<h2>Günlük döküm</h2>${table(['Gün','Uygulama önde','Oda','Mikrofon bildirimi'],(d.daily||[]).map(x=>`<tr>${cell(x.day)}${cell(x.measurement_available&&person?.app_measured?duration(x.app_seconds):'Ölçülmedi')}${cell(x.measurement_available?duration(x.room_seconds):'Ölçülmedi')}${cell(x.measurement_available&&person?.mic_measured?duration(x.mic_seconds):'Ölçülmedi')}</tr>`))}<h2>Oda bazında</h2>${table(['Oda','Odada','Mikrofon bildirimi'],(d.rooms||[]).map(x=>`<tr>${cell(`${x.room_name||'Silinmiş oda'} · #${x.room_display_id||''}`)}${cell(duration(x.room_seconds))}${cell(duration(x.mic_seconds))}</tr>`))}<h2>Son 100 ölçüm aralığı</h2>${table(['Tür','Başlangıç','Bitiş','Süre','Oda'],(d.events||[]).map(x=>`<tr>${cell({foreground:'Uygulama önde',room:'Odada',mic_client:'Mikrofon bildirimi'}[x.kind]||x.kind)}${cell(c.date(x.started_at))}${cell(c.date(x.ended_at))}${cell(duration(x.seconds))}${cell(x.room_name)}</tr>`))}`:''}`;
   bind(root);
  }catch(e){if(ctx!==c||g!==epoch)return;model=null;const pending=/PGRST202|does not exist|schema cache/.test(String(e?.message||e));root.innerHTML=`<h1>Kullanıcı aktivitesi</h1><p class="note" role="alert">${c.esc(pending?'Aktivite ölçümü sunucuda henüz etkin değil. Migration onayından sonra oda ölçümü başlar; uygulama önde ve mikrofon bildirimi için yeni istemci gerekir.':c.errorText(e))}</p><button data-retry>Tekrar dene</button>`;root.querySelector('[data-retry]').onclick=load;
  }finally{if(ctx===c&&g===epoch){root.removeAttribute('aria-busy');schedule();}}
 }
 const old=window.PuffyKapsam;
 window.PuffyKapsam={...old,init(c){old.init(c);stop();ctx=c;$('#activity-nav')?.remove();if(c.caps.owner){const a=document.createElement('a');a.id='activity-nav';a.className='menu';a.href='#kullanici-aktivitesi';a.dataset.sayfa='kullanici-aktivitesi';a.textContent='Kullanıcı aktivitesi';$('#uyg nav')?.append(a);}},stop(){stop();ctx=null;$('#activity-nav')?.remove();old.stop();},route(hash){if(hash.split('?')[0]==='kullanici-aktivitesi'){if(!ctx?.caps.owner){location.hash='ozet';return true;}const value=new URLSearchParams(hash.split('?')[1]||'').get('user');if(value&&!validId(value)){ctx.toast('Geçerli kullanıcı seç.');return true;}user=value;page=0;$('#uyg nav')?.classList.remove('open');$('#panel-topbar .mobile-menu')?.setAttribute('aria-expanded','false');document.querySelectorAll('nav a.menu').forEach(a=>a.classList.toggle('aktif',a.dataset.sayfa==='kullanici-aktivitesi'));$('#route-name')&&( $('#route-name').textContent='Kullanıcı aktivitesi');load();return true;}stop();return old.route(hash);}};
 window.PuffyAktivite={duration,csv,validId};
})();
