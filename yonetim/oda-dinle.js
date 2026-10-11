/* Panelden odaya GÖRÜNMEZ giriş (Codex raporu #23 + Hakan 2026-10-11 "odaya girebilmem gerekmiyor muydu").
   Kimlik sunucuda 'ffffffff-f' önekiyle verilir; uygulamalar bu kimliği tamamen yok sayar: odadakiler
   seni görmez, sayıya eklenmezsin. Yayın izni yok: konuşamaz, yazamaz, koltuğa oturamazsın.
   Her giriş yönetim kaydına yazılır. Zego web SDK ilk girişte yüklenir (vendor/, aynı sunucu).
   Koltuk: yayın kimliği 'stream_<kullanıcı>_s<koltuk>'; sohbet/hediye: Zego oda yayın mesajları. */
(function(root){
 'use strict';
 const SDK='vendor/zego-web-3.12.240.js';
 let sdkSoz=null,aktif=null,bag=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const saat=t=>{try{return new Date(t||Date.now()).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});}catch{return '';}};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function sdk(){if(root.ZegoExpressEngine)return Promise.resolve();return sdkSoz??=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=SDK;s.onload=()=>root.ZegoExpressEngine?ok():ko(new Error('SDK_YUKLENEMEDI'));s.onerror=()=>{sdkSoz=null;ko(new Error('SDK_YUKLENEMEDI'));};document.head.append(s);});}
 async function kapat(){const a=aktif;aktif=null;if(!a)return;clearInterval(a.kisiZaman);try{for(const id of a.akislar.keys())a.zg.stopPlayingStream(id);}catch{}try{await a.zg.logoutRoom(a.oda);}catch{}try{a.zg.destroyEngine?.();}catch{}if(a.dlg?.isConnected)a.dlg.close();}
 async function rpc(c,n,args){const {data,error}=await c.sb.rpc(n,args);if(error)throw error;return data;}

 async function ac(c,odaGiris,ad){
  await kapat();
  const dlg=document.createElement('dialog');dlg.className='oda-ekrani';
  dlg.innerHTML=`<header class="oe-ust"><div><div class="eyebrow">Görünmez giriş · odadakiler seni görmez</div><h2 data-ad>${esc(ad||'Oda')}</h2><small data-durum role="status">Bağlanıyor…</small></div>
   <div class="oe-araclar"><label>Ses <input data-ses type="range" min="0" max="100" value="80"></label><button data-kapat class="danger">Odadan çık</button></div></header>
   <div class="oe-govde"><section class="oe-koltuklar" data-koltuklar aria-label="Koltuklar"></section>
   <aside class="oe-yan"><div class="queue-tabs"><button data-sek="sohbet" class="primary">Sohbet</button><button data-sek="kisiler">Odadakiler <b data-kisisay></b></button></div>
   <div data-sohbet class="oe-sohbet" aria-live="polite"><p class="note">Girişinden sonraki mesajlar ve hediyeler burada akar.</p></div><div data-kisiler class="oe-kisiler" hidden></div></aside></div>
   <p class="note oe-alt">Konuşamaz, yazamaz, koltuğa oturamazsın. Bu giriş yönetim kaydına yazılır. Ses kaydı tutulmaz.</p><div data-sesler hidden></div>`;
  document.body.append(dlg);dlg.showModal();
  const $=q=>dlg.querySelector(q),durum=t=>{const p=$('[data-durum]');if(p)p.textContent=t;};
  $('[data-kapat]').onclick=()=>kapat();dlg.onclose=()=>{kapat();dlg.remove();};
  dlg.querySelectorAll('[data-sek]').forEach(b=>b.onclick=()=>{dlg.querySelectorAll('[data-sek]').forEach(x=>x.classList.toggle('primary',x===b));$('[data-sohbet]').hidden=b.dataset.sek!=='sohbet';$('[data-kisiler]').hidden=b.dataset.sek!=='kisiler';});
  try{
   await sdk();
   let bilgi=null;if(UUID.test(String(odaGiris))){try{bilgi=await rpc(c,'yonetim_oda_ekran_bilgisi',{p_room:odaGiris});}catch{}}
   if(bilgi){$('[data-ad]').textContent=bilgi.name+' · '+bilgi.display_id;}
   const {data,error}=await c.sb.functions.invoke('yonetim-oda-dinle',{body:{room_id:String(odaGiris)}});
   if(error||!data?.token)throw new Error(data?.error||'TOKEN_ALINAMADI');
   const zg=new root.ZegoExpressEngine(data.app_id,data.server);
   try{zg.setDebugVerbose?.(false);}catch{}
   const a={zg,oda:String(data.room_id||odaGiris),uuid:bilgi?.id||null,koltukSay:Math.min(Math.max(Number(bilgi?.seat_count)||10,1),20),
     akislar:new Map(),koltuk:new Map(),seviye:new Map(),susturulan:new Set(),mic:new Map(),adlar:new Map(),dlg,sonKod:null,sonHata:'',kisiZaman:null};aktif=a;
   const ses=$('[data-ses]');ses.oninput=()=>{for(const el of a.akislar.values())el.volume=Number(ses.value)/100;};

   // --- adlar: koltuktaki kullanıcıların adı/fotoğrafı (yalnız yönetici RPC'si) ---
   let adBekleyen=null;
   const adCoz=()=>{clearTimeout(adBekleyen);adBekleyen=setTimeout(async()=>{const eksik=[...a.koltuk.values()].map(k=>k.uid).filter(u=>UUID.test(u)&&!a.adlar.has(u)).slice(0,60);if(!eksik.length)return;try{const r=await rpc(c,'yonetim_kisi_ozetleri',{p_ids:eksik});for(const [k,v] of Object.entries(r||{}))a.adlar.set(k,v);if(aktif===a)ciz();}catch{}},150);};
   const ciz=()=>{const kutu=$('[data-koltuklar]');if(!kutu)return;let h='';
    for(let i=0;i<a.koltukSay;i++){const k=[...a.koltuk.values()].find(x=>x.s===i);const kisi=k&&a.adlar.get(k.uid);const lv=k?(a.seviye.get(k.sid)||0):0;
     // Mikrofon durumu: yönetici susturması > kişinin kendi kapatması > açık (ses gelmesi de "açık" sayılır).
     const ms=k?a.mic.get(k.sid):null,mod=k&&a.susturulan.has(i),kapali=!mod&&(ms==='MUTE'||ms==='CLOSE')&&lv<=8;
     const rozet=!k?'':mod?'<i class="oe-mic mod" title="Yönetici susturdu">⛔</i>':kapali?'<i class="oe-mic kapali" title="Mikrofon kapalı">🔇</i>':'<i class="oe-mic acik" title="Mikrofon açık">🎤</i>';
     const yazi=!k?'':mod?'Susturuldu':kapali?'Mikrofon kapalı':lv>8?'Konuşuyor':'Mikrofon açık';
     h+=`<div class="oe-koltuk ${k?'dolu':''} ${lv>8&&!mod?'konusuyor':''} ${kapali||mod?'sessiz':''}"><div class="oe-avatar">${k?(kisi?.avatar?`<img src="${esc(kisi.avatar)}" alt="" referrerpolicy="no-referrer">`:'<span>👤</span>'):'<span class="oe-bos">'+(i+1)+'</span>'}${rozet}</div><small>${k?(kisi?`<a href="#kullanici/${esc(k.uid)}" target="_blank" rel="noopener">${esc(kisi.ad)}</a>`:'…'):'Boş'}</small>${k?`<em class="oe-durum">${yazi}</em>`:''}</div>`;}
    kutu.innerHTML=h;};
   const say=()=>durum((a.koltuk.size?a.koltuk.size+' kişi koltukta · '+[...a.koltuk.values()].filter(k=>!(a.susturulan.has(k.s)||['MUTE','CLOSE'].includes(a.mic.get(k.sid)))).length+' mikrofon açık':'Koltuklar boş')+' · '+(a.akislar.size?'ses açık':'ses yok')+(a.sonHata?' · '+a.sonHata:''));
   const PARSE=/^stream_([0-9a-f-]{36})_s(\d{1,2})$/i;
   zg.on('roomStreamUpdate',async(_r,tip,liste)=>{if(aktif!==a)return;for(const s of liste){const m=PARSE.exec(s.streamID||'');
     if(tip==='ADD'){if(m)a.koltuk.set(s.streamID,{sid:s.streamID,uid:m[1].toLowerCase(),s:Number(m[2])});
      if(!a.akislar.has(s.streamID)){try{const ms=await zg.startPlayingStream(s.streamID,{video:false,audio:true});const el=document.createElement('audio');el.autoplay=true;el.srcObject=ms;el.volume=Number(ses.value)/100;$('[data-sesler]').append(el);a.akislar.set(s.streamID,el);el.play?.().catch(()=>{a.sonHata='ses için pencereye bir kez tıkla';say();});}catch(err){a.sonHata='oynatma: '+String(err?.msg||err?.message||err).slice(0,60);}}}
     else if(tip==='DELETE'){a.koltuk.delete(s.streamID);a.seviye.delete(s.streamID);a.mic.delete(s.streamID);if(a.akislar.has(s.streamID)){try{zg.stopPlayingStream(s.streamID);}catch{}a.akislar.get(s.streamID).remove();a.akislar.delete(s.streamID);}}
    }adCoz();ciz();say();});
   try{zg.setSoundLevelDelegate?.(true,500);}catch{}
   // Kişi mikrofonu kendisi kapatınca/açınca (uygulama muteMicrophone) Zego bildirir: OPEN / MUTE / CLOSE.
   zg.on('remoteMicStatusUpdate',(sid,st)=>{if(aktif!==a)return;a.mic.set(sid,String(st||'').toUpperCase());ciz();say();});
   zg.on('soundLevelUpdate',list=>{if(aktif!==a)return;let degisti=false;for(const x of list||[]){const v=Number(x.soundLevel)||0,eski=a.seviye.get(x.streamID)||0;if((v>8)!==(eski>8))degisti=true;a.seviye.set(x.streamID,v);}if(degisti)ciz();});

   // --- sohbet / hediye / oda olayları ---
   const sohbet=$('[data-sohbet]');
   const yaz=(html,cls='')=>{const p=document.createElement('p');p.className='oe-msj '+cls;p.innerHTML=html;sohbet.append(p);while(sohbet.children.length>200)sohbet.firstElementChild.remove();if(sohbet.scrollHeight-sohbet.scrollTop-sohbet.clientHeight<120)sohbet.scrollTop=sohbet.scrollHeight;};
   zg.on('IMRecvBroadcastMessage',(_r,liste)=>{if(aktif!==a)return;for(const x of liste||[]){const kim=x.fromUser?.userID||'';if(kim.startsWith('ffffffff-f'))continue;let m;try{m=JSON.parse(x.message);}catch{continue;}
     const ad=esc(m.name||x.fromUser?.userName||'?'),t=saat(x.sendTime);
     if(m.t==='chat'){const k=m.k||'txt';yaz(`<small>${t}</small> <b>${ad}</b>: `+(k==='img'?'🖼 fotoğraf'+(m.thumb?` <a href="${esc(m.thumb)}" target="_blank" rel="noopener">aç</a>`:''):k==='vid'?'🎬 video':k==='duyuru'?'📢 '+esc(m.m):esc(m.m)),k==='duyuru'?'duyuru':'');}
     else if(m.t==='gift'&&m.gn)yaz(`<small>${t}</small> 🎁 <b>${ad}</b> ${esc(m.e||'')} ${esc(m.gn)}${Number(m.q)>1?' ×'+esc(m.q):''}${m.c?' · '+esc(m.c)+' coin':''}`,'hediye');
     else if(m.t==='announce')yaz(`<small>${t}</small> 📢 Oda duyurusu güncellendi`,'duyuru');
     else if(m.t==='seat_mute'&&Number.isInteger(m.s)){if(m.muted)a.susturulan.add(m.s);else a.susturulan.delete(m.s);ciz();say();}
     else if(m.t==='mod'&&m.a)yaz(`<small>${t}</small> ⚙ Yönetim işlemi: ${esc(m.a)}`,'duyuru');
    }});
   // --- odadakiler (son 150 sn varlık sinyali) ---
   const kisiler=async()=>{if(!a.uuid||aktif!==a)return;try{const d=await rpc(c,'yonetim_oda_gozlem',{p_room:a.uuid,p_limit:100,p_offset:0});if(aktif!==a)return;$('[data-kisisay]').textContent='('+(d.total||0)+')';
     $('[data-kisiler]').innerHTML=(d.rows||[]).length?(d.rows||[]).map(r=>`<p class="oe-kisi"><a href="#kullanici/${esc(r.user_id)}" target="_blank" rel="noopener">${esc(r.nickname)}</a> <small>#${esc(r.display_id)}${r.role?' · '+esc(r.role):''}</small></p>`).join(''):'<p class="note">Kayıtlı varlık sinyali yok.</p>';}catch{}};
   kisiler();a.kisiZaman=setInterval(kisiler,20000);
   // --- bağlantı ---
   const kod=(r,k)=>{a.sonKod=k;if(aktif===a&&k)durum('Bağlantı hatası · Zego kodu '+k+(r?' ('+r+')':'')+'. Bu kodu ilet.');};
   zg.on('roomStateChanged',(_r,neden,k)=>{if(/FAIL|KICK|LOGOUT/i.test(String(neden)))kod(neden,k);});
   zg.on('roomStateUpdate',(_r,st,k)=>{if(k)kod(st,k);});
   ciz();
   const zaman=new Promise((_,ko)=>setTimeout(()=>ko(new Error('ZAMAN_ASIMI')),20000));let ok;
   try{ok=await Promise.race([zg.loginRoom(a.oda,data.token,{userID:data.user_id,userName:'Puffy'},{userUpdate:false}),zaman]);}
   catch(e){const k=e?.code||e?.errorCode||a.sonKod;throw new Error(e?.message==='ZAMAN_ASIMI'?'Zego sunucusuna 20 sn içinde bağlanılamadı'+(k?' (kod '+k+')':'')+'.':'Zego girişi reddedildi'+(k?' (kod '+k+')':'')+': '+(e?.msg||e?.message||e));}
   if(!ok)throw new Error('Zego girişi başarısız'+(a.sonKod?' (kod '+a.sonKod+')':''));if(aktif!==a)return;say();
  }catch(e){const m=String(e?.message||e);durum('Odaya girilemedi: '+m);try{root.PuffyHata?.kaydet({rpc:'zego_login',kod:(m.match(/kod (\d+)/)||[])[1]||'ZEGO',sinif:'zego'});}catch{}}
 }
 function init(c){bag=c;}
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sessiz-dinle]');if(!b||!bag)return;e.preventDefault();ac(bag,b.dataset.odaId,b.dataset.odaAd||'Oda');});
 root.PuffyOdaDinle={ac,kapat,init};
 root.addEventListener?.('beforeunload',()=>{kapat();});
})(window);
