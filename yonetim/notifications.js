/* Yöneticiye özel, bu tarayıcıda saklanan başvuru bildirimleri. */
(() => {
  'use strict';
  let ctx, options, storageKey, preferenceKey, records=[], cursor=null, audio, lastTone=0;
  let sound=false, volume=0.45, storageOK=true, connection='Bağlanıyor', pending=0;
  let arming=false,alertCount=0,alertKey=null,lastSync=0,pushText='';
  let audioState='Ses kapalı', desktopError='', generation=0;
  const $=s=>document.querySelector(s);
  const validId=x=>typeof x==='string' && /^\d{1,20}$/.test(x);
  const permission=()=>('Notification' in window ? Notification.permission : 'unsupported');
  const cleanRef=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x)?x:null;
  const byNewest=(a,b)=>{const x=BigInt(a.id),y=BigInt(b.id);return x>y?-1:x<y?1:0;};
  const shape=r=>({id:r.id,key:r.key,at:r.at,read:r.read===true,kayit:cleanRef(r.kayit),kaynak:cleanRef(r.kaynak)});
  function read(){
    try {
      const s=JSON.parse(localStorage.getItem(storageKey)||'null');
      if(!s)return;
      cursor=validId(s.cursor)?s.cursor:null;
      sound=s.sound===true;volume=Number.isFinite(s.volume)?Math.min(1,Math.max(.1,s.volume)):.45;
      records=(Array.isArray(s.records)?s.records:[]).filter(r=>validId(r.id)&&options.allowed(r.key)&&Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)>Date.now()-30*86400000).slice(0,100).map(shape);
    } catch { storageOK=false; }
  }
  function readPreferences(){
    try {
      let p=JSON.parse(localStorage.getItem(preferenceKey)||'null');
      // Eski sürüm tercihi yetki listesine bağlıydı. Yeni bir kuyruk eklenince kaybetme.
      if(!p && typeof localStorage.key==='function'){
        const prefix='puffy_notifications_v1:'+ctx.user.id+':';
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
          try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old?.sound===true){p=old;break;}}catch{}
        }
      }
      if(p){sound=p.sound===true;volume=Number.isFinite(p.volume)?Math.min(1,Math.max(.1,p.volume)):.45;}
    }catch{storageOK=false;}
  }
  function savePreferences(){
    if(!preferenceKey)return;
    try{localStorage.setItem(preferenceKey,JSON.stringify({sound,volume}));}catch{storageOK=false;}
  }
  // #07 (2026-10-11): iki sekme aynı kaydı yazar. Yazmadan önce diskteki hâlle
  // birleştir: okundu bilgisi yalnız true yönüne gider, cursor yalnız ileri gider.
  function merge(){
    let s=null;try{s=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{return;}
    if(!s||!Array.isArray(s.records))return;
    const byId=new Map(records.map(r=>[r.id,r]));
    for(const o of s.records){
      if(!o||!validId(o.id)||!options.allowed(o.key))continue;
      const m=byId.get(o.id);
      if(m){if(o.read===true)m.read=true;if(!m.kayit&&cleanRef(o.kayit)){m.kayit=cleanRef(o.kayit);m.kaynak=cleanRef(o.kaynak);}}
      else if(Number.isFinite(Date.parse(o.at))&&Date.parse(o.at)>Date.now()-30*86400000)byId.set(o.id,shape(o));
    }
    records=[...byId.values()].sort(byNewest).slice(0,100);
    if(validId(s.cursor)&&(cursor===null||BigInt(s.cursor)>BigInt(cursor)))cursor=s.cursor;
  }
  function save(){
    if(!storageKey)return;
    try {merge();localStorage.setItem(storageKey,JSON.stringify({cursor,records,sound,volume}));storageOK=true;}
    catch {storageOK=false;}
  }
  function onStorage(e){if(!ctx||!storageKey||e.key!==storageKey)return;merge();render();}
  // #09: okundu bilgisi sunucuda da tutulur; başka bilgisayarda aynı hesapla tutarlı olur.
  function markRead(ids){
    const list=ids.filter(validId);if(!list.length)return;
    for(const r of records)if(list.includes(r.id))r.read=true;
    save();render();
    if(ctx?.rpc)Promise.resolve().then(()=>ctx.rpc('yonetim_bildirim_okundu_isaretle',{p_ids:list.map(Number)})).catch(()=>{});
  }
  async function syncRead(force=false){
    if(!ctx?.rpc||(!force&&Date.now()-lastSync<60000))return;
    lastSync=Date.now();const c=ctx,token=generation;
    try{const d=await c.rpc('yonetim_basvuru_olaylari_getir',{p_after:null});if(token!==generation||ctx!==c)return;
      const okundu=new Set((d?.rows||[]).filter(r=>r.okundu===true).map(r=>String(r.id)));
      let changed=false;for(const r of records)if(!r.read&&okundu.has(r.id)){r.read=true;changed=true;}
      if(changed){save();render();}
    }catch{}
  }
  function onFocus(){renderStatus();void syncRead();}
  function init(c,o){
    stop();ctx=c;options=o;records=[];cursor=null;sound=false;volume=.45;storageOK=true;pending=0;connection='Bağlanıyor';desktopError='';lastTone=0;alertCount=0;alertKey=null;lastSync=0;
    // Yetki kümesi değiştiğinde eski kapsamın cursor'u yeni kapsamı atlamasın.
    storageKey=c.user?.id?'puffy_notifications_v1:'+c.user.id+':'+o.keys.filter(o.allowed).sort().join(','):null;
    preferenceKey=c.user?.id?'puffy_notification_preferences_v1:'+c.user.id:null;
    if(storageKey){read();readPreferences();}else storageOK=false;
    audioState=sound?'Ses beklemede · Panelde bir kez tıkla.':'Ses kapalı';
    $('#panel-topbar').insertAdjacentHTML('beforeend',`<div id="approval-bell-wrap"><button id="approval-bell" aria-expanded="false" aria-controls="approval-events"><svg class="notice-bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg> <span class="notice-bell-label">Bildirimler</span> <b id="approval-total">0</b></button><button id="notice-audio-ready" type="button"></button><section id="approval-events" class="hidden notice-center" aria-label="Bildirim merkezi"><header class="notice-head"><div><span class="notice-eyebrow">PUFFY / YÖNETİM</span><h2>Bildirim merkezi</h2></div><button data-notice="close" aria-label="Bildirim merkezini kapat">×</button></header><div class="notice-summary"><span id="notice-unread"></span><a id="notice-pending" href="#onay/bekleyenler" data-notice="pending"></a></div><p id="notice-connection" role="status"></p><div class="notice-tools"><strong>Son başvurular</strong><button data-notice="read-all">Tümünü okundu işaretle</button></div><div id="notice-list"></div><details class="notice-settings" ${sound?'':'open'}><summary>Ses ve masaüstü ayarları</summary><label class="notice-toggle"><input type="checkbox" id="notice-sound"> Bildirim sesi</label><div class="notice-audio"><label for="notice-volume">Ses düzeyi</label><input id="notice-volume" type="range" min="10" max="100" step="5"><button data-notice="test">Sesi dene</button></div><p id="notice-audio-state" role="status"></p><div class="notice-desktop"><span id="notice-permission"></span><button data-notice="desktop">Masaüstü bildirimlerini aç</button></div><p id="notice-desktop-error" role="status"></p><div class="notice-desktop"><span id="notice-push-state">Panel kapalıyken bildirim kapalı.</span><button data-notice="push">Panel kapalıyken de bildir</button></div></details><footer id="notice-storage"></footer></section></div>`);
    $('#approval-bell').onclick=()=>toggle();
    $('#notice-audio-ready').onclick=async()=>{sound=true;$('#notice-sound').checked=true;savePreferences();save();await play(true);};
    $('#approval-events').addEventListener('click',action);
    $('#notice-sound').checked=sound;$('#notice-volume').value=volume*100;
    $('#notice-sound').onchange=async e=>{sound=e.target.checked;savePreferences();save();if(sound)await play(true);else audioState='Ses kapalı';renderStatus();};
    $('#notice-volume').oninput=e=>{volume=Number(e.target.value)/100;savePreferences();save();};
    document.addEventListener('pointerdown',armAudio);document.addEventListener('keydown',armAudio);
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
    window.addEventListener('focus',onFocus);window.addEventListener('storage',onStorage);
    render();void syncRead(true);
    if(window.PuffyPush){const token=generation;window.PuffyPush.durum().then(d=>{if(token===generation&&ctx){pushText=d.metin;$('#approval-events [data-notice="push"]').textContent=d.acik?'Bu cihazda kapat':'Panel kapalıyken de bildir';renderStatus();}}).catch(()=>{});}
  }
  function stop(){
    generation++;arming=false;document.removeEventListener('pointerdown',armAudio);document.removeEventListener('keydown',armAudio);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);window.removeEventListener('focus',onFocus);window.removeEventListener('storage',onStorage);
    if(audio){audio.close().catch(()=>{});audio=null;}
    $('#approval-bell-wrap')?.remove();$('#approval-alert')?.remove();ctx=null;storageKey=null;preferenceKey=null;records=[];cursor=null;
  }
  function toggle(force){
    const box=$('#approval-events');if(!box)return;
    const open=force===undefined?box.classList.contains('hidden'):force;
    box.classList.toggle('hidden',!open);$('#approval-bell').setAttribute('aria-expanded',String(open));
    if(open){render();box.querySelector('[data-notice="close"]').focus();}
  }
  function outside(e){if(!e.target.closest('#approval-bell-wrap'))toggle(false);}
  function keyboard(e){if(e.key==='Escape'&&!$('#approval-events')?.classList.contains('hidden')){toggle(false);$('#approval-bell')?.focus();}}
  async function action(e){
    const link=e.target.closest('[data-event]');
    if(link){const r=records.find(r=>r.id===link.dataset.event);if(r){markRead([r.id]);
      // #10: şikâyet bildirimi doğrudan o şikâyetin dosyasını açar.
      if(r.key==='sikayet'&&r.kayit&&r.kaynak&&window.PuffyModeration?.showCase)setTimeout(()=>{if(ctx)window.PuffyModeration.showCase(r.kaynak,r.kayit);},400);}
      toggle(false);render();return;}
    const button=e.target.closest('[data-notice]');if(!button)return;
    switch(button.dataset.notice){
      case 'pending':toggle(false);break;
      case 'close':toggle(false);$('#approval-bell').focus();break;
      case 'read-all':markRead(records.filter(r=>!r.read).map(r=>r.id));break;
      case 'test':await play(true);renderStatus();break;
      case 'push':{
        // #11: panel kapalıyken bu cihaza bildirim (içeriksiz; metni service worker yazar).
        if(!window.PuffyPush)break;const token=generation;button.disabled=true;
        try{const d=await window.PuffyPush.toggle(ctx);if(token===generation){pushText=d.metin;button.textContent=d.acik?'Bu cihazda kapat':'Panel kapalıyken de bildir';}}
        catch(err){if(token===generation)pushText=String(err?.message||err).includes('PERMISSION')?'Bildirim izni verilmedi.':'Açılamadı: '+(ctx?.errorText?ctx.errorText(err):String(err));}
        if(token===generation&&ctx){button.disabled=false;renderStatus();}break;
      }
      case 'desktop':{
        const token=generation;button.disabled=true;
        try{if(permission()!=='unsupported')await Notification.requestPermission();}catch{if(token===generation)desktopError='İzin isteği açılamadı. Tarayıcı site ayarlarını kontrol et.';}
        if(token===generation&&ctx){button.disabled=false;renderStatus();}break;
      }
    }
  }
  async function armAudio(e){
    if(!e.isTrusted||!sound||!ctx||arming||audio?.state==='running')return;
    const token=generation;arming=true;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)throw new Error('unsupported');
      if(!audio||audio.state==='closed'){audio=new Audio();audio.onstatechange=()=>renderStatus();}
      if(audio.state!=='running')await audio.resume();
      if(token===generation)audioState=audio.state==='running'?'Ses hazır':'Ses hazır değil · Sesi etkinleştir.';
    }catch{if(token===generation)audioState='Ses açılamadı · Sesi dene düğmesini kullan.';}
    finally{if(token===generation){arming=false;renderStatus();}}
  }
  async function play(test=false){
    const toneKey=ctx?.user?.id?'puffy_notifications_tone:'+ctx.user.id:null;
    if(!test){let shared=0;try{shared=Number(localStorage.getItem(toneKey))||0;}catch{}
      if(!sound||Date.now()-Math.max(lastTone,shared)<4000)return;}
    const token=generation;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)throw new Error('unsupported');
      if(!audio||audio.state==='closed'){audio=new Audio();audio.onstatechange=()=>renderStatus();}
      if(test&&audio.state==='suspended')await audio.resume();
      if(token!==generation||!ctx)return;
      if(audio.state!=='running'){audioState='Ses hazır değil · Sesi dene düğmesine bas.';renderStatus();return;}
      lastTone=Date.now();if(!test&&toneKey)try{localStorage.setItem(toneKey,String(lastTone));}catch{}
      for(const [offset,hz] of [[0,660],[.2,880]]){
        const osc=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+offset;
        osc.frequency.value=hz;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*.25,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+.3);
        osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(start+.32);osc.onended=()=>{osc.disconnect();gain.disconnect();};
      }
      audioState=test?'Deneme sesi çalındı. Duyduysan ses hazır.':'Ses hazır';
    }catch{if(token===generation)audioState='Ses çalınamadı. Tarayıcı ve cihaz ses ayarlarını kontrol et.';}
    if(token===generation)renderStatus();
  }
  function accept(batch){
    if(!ctx)return;
    const seen=new Set(records.map(r=>r.id)),fresh=[];
    for(const row of batch.rows||[]){const id=String(row.id);if(!validId(id)||(cursor!==null&&BigInt(id)<=BigInt(cursor))||seen.has(id)||!options.allowed(row.tur))continue;seen.add(id);fresh.push({id,key:row.tur,at:Number.isFinite(Date.parse(row.created_at))?row.created_at:new Date().toISOString(),read:row.okundu===true,kayit:cleanRef(row.kayit),kaynak:cleanRef(row.kaynak)});}
    records=[...fresh.reverse(),...records].slice(0,100);
    if(validId(String(batch.cursor))&&(cursor===null||BigInt(batch.cursor)>BigInt(cursor)))cursor=String(batch.cursor);
    save();render();
    if(batch.bootstrap===true)return;
    // #12: birikmiş olaylar birkaç sayfada gelir; tek özet uyarısı son sayfada çıkar.
    const unseen=fresh.filter(r=>!r.read);alertCount+=unseen.length;if(unseen.length&&!alertKey)alertKey=unseen[0].key;
    if(batch.more===true||!alertCount)return;
    const total=alertCount,firstKey=alertKey;alertCount=0;alertKey=null;
    const text=total===1?options.label(firstKey):total+' yeni başvuru';
    $('#approval-alert')?.remove();
    const banner=document.createElement('div');banner.id='approval-alert';banner.className='approval-alert notice-banner';banner.setAttribute('role','status');
    banner.innerHTML=`<div><strong>Yeni başvuru var</strong><span>${ctx.esc(text)} · İncelemeni bekliyor</span></div><button data-open>Bildirimleri gör →</button><button data-dismiss aria-label="Uyarıyı kapat">×</button>`;
    $('#panel-topbar').after(banner);banner.querySelector('[data-open]').onclick=()=>toggle(true);banner.querySelector('[data-dismiss]').onclick=()=>banner.remove();
    void play();
    if(permission()==='granted')try{
      const token=generation,n=new Notification('Puffy · Yeni başvuru',{body:text,tag:'puffy-approvals'});
      n.onclick=()=>{if(token===generation&&ctx){window.focus();toggle(true);}n.close();};
    }catch{desktopError='Masaüstü uyarısı gösterilemedi. Panel içi bildirimler çalışıyor.';renderStatus();}
  }
  function render(){
    if(!ctx)return;
    const unread=records.filter(r=>!r.read).length;
    $('#approval-total').textContent=pending>99?'99+':String(pending);
    $('#approval-bell').classList.toggle('has-unread',pending>0);
    $('#approval-bell').setAttribute('aria-label',pending+' karar bekliyor, '+unread+' okunmamış bildirim');
    $('#notice-unread').textContent=unread+' okunmamış';$('#notice-pending').textContent=pending+' karar bekliyor →';
    $('#notice-list').innerHTML=records.length?records.map(r=>`<a class="notice-item ${r.read?'':'is-unread'}" data-event="${r.id}" href="${options.path(r.key,r)}"><span class="notice-dot" aria-hidden="true"></span><span><strong>${ctx.esc(options.label(r.key))}</strong><small>${ctx.esc(ctx.date(r.at))} · ${r.read?'Okundu':'Yeni başvuru'}</small></span><span aria-hidden="true">↗</span></a>`).join(''):'<div class="notice-empty"><strong>Yeni bildirim yok</strong><p>Yeni başvurular burada birikir. Bekleyen işleri Onaylar bölümünden inceleyebilirsin.</p></div>';
    $('#approval-events [data-notice="read-all"]').disabled=!unread;
    document.title=(unread?'('+unread+') ':'')+'Puffy Yönetim';renderStatus();
  }
  function renderStatus(){
    if(!ctx)return;
    $('#notice-connection').textContent=connection;
    $('#notice-audio-state').textContent=audioState;
    const ready=$('#notice-audio-ready');
    ready.textContent=!sound?'Sesi aç':audio?.state==='running'?'Ses hazır':'Sesi etkinleştir';
    ready.classList.toggle('needs-action',!sound||audio?.state!=='running');
    ready.title=!sound?'Yeni başvurularda ses duymak için aç.':audio?.state==='running'?'Bildirim sesi hazır. Denemek için tıkla.':'Tarayıcı sesi başlatmak için etkileşim bekliyor. Tıklayarak etkinleştir.';
    const p=permission();$('#notice-permission').textContent={granted:'Masaüstü bildirimi açık',denied:'Bildirim izni engelli · Tarayıcı site ayarlarından aç.',default:'Masaüstü bildirimi için izin gerekli',unsupported:'Bu tarayıcı masaüstü bildirimini desteklemiyor.'}[p];
    $('#approval-events [data-notice="desktop"]').hidden=p==='granted'||p==='unsupported'||p==='denied';
    $('#notice-desktop-error').textContent=desktopError;
    if(pushText)$('#notice-push-state').textContent=pushText;
    $('#notice-storage').textContent=storageOK?'Son 100 bildirim · Bu tarayıcıda, hesabına özel · Panel kapalıyken masaüstü uyarısı gönderilmez.':'Geçmiş kaydedilemiyor. Bildirimler yalnız bu oturumda tutulacak.';
  }
  function status(text){connection=text;renderStatus();}
  function setPending(n){pending=n;render();}
  window.PuffyNotifications={init,stop,accept,status,setPending,getCursor:()=>cursor};
})();
