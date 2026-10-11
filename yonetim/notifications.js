/* Yöneticiye özel, bu tarayıcıda saklanan başvuru bildirimleri. */
(() => {
  'use strict';
  let ctx, options, storageKey, records=[], cursor=null, audio, lastTone=0;
  let sound=false, volume=0.45, storageOK=true, connection='Bağlanıyor', pending=0;
  let audioState='Ses kapalı', desktopError='', generation=0;
  const $=s=>document.querySelector(s);
  const validId=x=>typeof x==='string' && /^\d{1,20}$/.test(x);
  const permission=()=>('Notification' in window ? Notification.permission : 'unsupported');
  function read(){
    try {
      const s=JSON.parse(localStorage.getItem(storageKey)||'null');
      if(!s)return;
      cursor=validId(s.cursor)?s.cursor:null;
      sound=s.sound===true;volume=Number.isFinite(s.volume)?Math.min(1,Math.max(.1,s.volume)):.45;
      records=(Array.isArray(s.records)?s.records:[]).filter(r=>validId(r.id)&&options.allowed(r.key)&&Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)>Date.now()-30*86400000).slice(0,100).map(r=>({id:r.id,key:r.key,at:r.at,read:r.read===true}));
    } catch { storageOK=false; }
  }
  function save(){
    if(!storageKey)return;
    try {localStorage.setItem(storageKey,JSON.stringify({cursor,records,sound,volume}));storageOK=true;}
    catch {storageOK=false;}
  }
  function init(c,o){
    stop();ctx=c;options=o;records=[];cursor=null;sound=false;volume=.45;storageOK=true;pending=0;connection='Bağlanıyor';desktopError='';lastTone=0;
    // Yetki kümesi değiştiğinde eski kapsamın cursor'u yeni kapsamı atlamasın.
    storageKey=c.user?.id?'puffy_notifications_v1:'+c.user.id+':'+o.keys.filter(o.allowed).sort().join(','):null;
    if(storageKey)read();else storageOK=false;
    audioState=sound?'Sesi etkinleştirmek için “Sesi dene”ye bas.':'Ses kapalı';
    $('#panel-topbar').insertAdjacentHTML('beforeend',`<div id="approval-bell-wrap"><button id="approval-bell" aria-expanded="false" aria-controls="approval-events"><span aria-hidden="true">🔔</span> <span class="notice-bell-label">Bildirimler</span> <b id="approval-total">0</b></button><section id="approval-events" class="hidden notice-center" aria-label="Bildirim merkezi"><header class="notice-head"><div><span class="notice-eyebrow">PUFFY / YÖNETİM</span><h2>Bildirim merkezi</h2></div><button data-notice="close" aria-label="Bildirim merkezini kapat">×</button></header><div class="notice-summary"><span id="notice-unread"></span><span id="notice-pending"></span></div><p id="notice-connection" role="status"></p><div class="notice-tools"><strong>Son başvurular</strong><button data-notice="read-all">Tümünü okundu işaretle</button></div><div id="notice-list"></div><details class="notice-settings" ${sound?'':'open'}><summary>Ses ve masaüstü ayarları</summary><label class="notice-toggle"><input type="checkbox" id="notice-sound"> Bildirim sesi</label><div class="notice-audio"><label for="notice-volume">Ses düzeyi</label><input id="notice-volume" type="range" min="10" max="100" step="5"><button data-notice="test">Sesi dene</button></div><p id="notice-audio-state" role="status"></p><div class="notice-desktop"><span id="notice-permission"></span><button data-notice="desktop">Masaüstü bildirimlerini aç</button></div><p id="notice-desktop-error" role="status"></p></details><footer id="notice-storage"></footer></section></div>`);
    $('#approval-bell').onclick=()=>toggle();
    $('#approval-events').addEventListener('click',action);
    $('#notice-sound').checked=sound;$('#notice-volume').value=volume*100;
    $('#notice-sound').onchange=async e=>{sound=e.target.checked;save();if(sound)await play(true);else audioState='Ses kapalı';renderStatus();};
    $('#notice-volume').oninput=e=>{volume=Number(e.target.value)/100;save();};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
    window.addEventListener('focus',renderStatus);
    render();
  }
  function stop(){
    generation++;document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);window.removeEventListener('focus',renderStatus);
    if(audio){audio.close().catch(()=>{});audio=null;}
    $('#approval-bell-wrap')?.remove();$('#approval-alert')?.remove();ctx=null;storageKey=null;records=[];cursor=null;
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
    if(link){const r=records.find(r=>r.id===link.dataset.event);if(r)r.read=true;save();toggle(false);render();return;}
    const button=e.target.closest('[data-notice]');if(!button)return;
    switch(button.dataset.notice){
      case 'close':toggle(false);$('#approval-bell').focus();break;
      case 'read-all':records.forEach(r=>r.read=true);save();render();break;
      case 'test':await play(true);renderStatus();break;
      case 'desktop':{
        const token=generation;button.disabled=true;
        try{if(permission()!=='unsupported')await Notification.requestPermission();}catch{if(token===generation)desktopError='İzin isteği açılamadı. Tarayıcı site ayarlarını kontrol et.';}
        if(token===generation&&ctx){button.disabled=false;renderStatus();}break;
      }
    }
  }
  async function play(test=false){
    if(!test&&(!sound||Date.now()-lastTone<4000))return;
    const token=generation;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)throw new Error('unsupported');
      if(!audio||audio.state==='closed')audio=new Audio();
      if(test&&audio.state==='suspended')await audio.resume();
      if(token!==generation||!ctx)return;
      if(audio.state!=='running'){audioState='Ses hazır değil · Sesi dene düğmesine bas.';renderStatus();return;}
      lastTone=Date.now();
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
    for(const row of batch.rows||[]){const id=String(row.id);if(!validId(id)||seen.has(id)||!options.allowed(row.tur))continue;seen.add(id);fresh.push({id,key:row.tur,at:Number.isFinite(Date.parse(row.created_at))?row.created_at:new Date().toISOString(),read:false});}
    records=[...fresh.reverse(),...records].slice(0,100);
    if(validId(String(batch.cursor)))cursor=String(batch.cursor);
    save();render();
    if(!fresh.length)return;
    const text=fresh.length===1?options.label(fresh[0].key):fresh.length+' yeni başvuru';
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
    $('#approval-total').textContent=unread>99?'99+':String(unread);
    $('#approval-bell').classList.toggle('has-unread',unread>0);
    $('#approval-bell').setAttribute('aria-label',unread+' okunmamış bildirim');
    $('#notice-unread').textContent=unread+' okunmamış';$('#notice-pending').textContent=pending+' karar bekliyor';
    $('#notice-list').innerHTML=records.length?records.map(r=>`<a class="notice-item ${r.read?'':'is-unread'}" data-event="${r.id}" href="${options.path(r.key)}"><span class="notice-dot" aria-hidden="true"></span><span><strong>${ctx.esc(options.label(r.key))}</strong><small>${ctx.esc(ctx.date(r.at))} · ${r.read?'Okundu':'Yeni başvuru'}</small></span><span aria-hidden="true">↗</span></a>`).join(''):'<div class="notice-empty"><strong>Yeni bildirim yok</strong><p>Yeni başvurular burada birikir. Bekleyen işleri Onaylar bölümünden inceleyebilirsin.</p></div>';
    $('#approval-events [data-notice="read-all"]').disabled=!unread;
    document.title=(unread?'('+unread+') ':'')+'Puffy Yönetim';renderStatus();
  }
  function renderStatus(){
    if(!ctx)return;
    $('#notice-connection').textContent=connection;
    $('#notice-audio-state').textContent=audioState;
    const p=permission();$('#notice-permission').textContent={granted:'Masaüstü bildirimi açık',denied:'Bildirim izni engelli · Tarayıcı site ayarlarından aç.',default:'Masaüstü bildirimi için izin gerekli',unsupported:'Bu tarayıcı masaüstü bildirimini desteklemiyor.'}[p];
    $('#approval-events [data-notice="desktop"]').hidden=p==='granted'||p==='unsupported'||p==='denied';
    $('#notice-desktop-error').textContent=desktopError;
    $('#notice-storage').textContent=storageOK?'Son 100 bildirim · Bu tarayıcıda, hesabına özel · Panel kapalıyken masaüstü uyarısı gönderilmez.':'Geçmiş kaydedilemiyor. Bildirimler yalnız bu oturumda tutulacak.';
  }
  function status(text){connection=text;renderStatus();}
  function setPending(n){pending=n;render();}
  window.PuffyNotifications={init,stop,accept,status,setPending,getCursor:()=>cursor};
})();
