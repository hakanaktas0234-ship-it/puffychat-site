/* #23 (2026-10-11): panelden sesli odayı SESSİZ dinleme.
   Kimlik sunucuda 'ffffffff-f' önekiyle verilir; uygulamalar bu kimliği tamamen yok sayar,
   odadakiler bir şey görmez. Yayın izni yoktur. Her dinleme yönetim kaydına geçer.
   Zego web SDK yalnız ilk dinlemede yüklenir (vendor/zego-web-3.12.240.js, aynı sunucudan). */
(function(root){
 'use strict';
 const SDK='vendor/zego-web-3.12.240.js';
 let sdkSoz=null,aktif=null;
 function sdk(){if(root.ZegoExpressEngine)return Promise.resolve();return sdkSoz??=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=SDK;s.onload=()=>root.ZegoExpressEngine?ok():ko(new Error('SDK_YUKLENEMEDI'));s.onerror=()=>{sdkSoz=null;ko(new Error('SDK_YUKLENEMEDI'));};document.head.append(s);});}
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 async function kapat(){const a=aktif;aktif=null;if(!a)return;try{for(const id of a.akislar.keys())a.zg.stopPlayingStream(id);}catch{}try{await a.zg.logoutRoom(a.oda);}catch{}try{a.zg.destroyEngine?.();}catch{}a.dlg?.isConnected&&a.dlg.close();}
 async function ac(c,oda,ad){
  await kapat();
  const dlg=document.createElement('dialog');dlg.className='approval-dialog';
  dlg.innerHTML='<div class="eyebrow">Sessiz dinleme</div><h2>'+esc(ad||oda)+'</h2><p class="note">Odadakiler seni görmez; konuşamazsın. Bu dinleme yönetim kaydına yazılır.</p><p data-durum role="status">Bağlanıyor…</p><label>Ses düzeyi<input data-ses type="range" min="0" max="100" value="80"></label><div data-sesler hidden></div><div class="dialog-actions"><button data-kapat class="danger">Dinlemeyi bitir</button></div>';
  document.body.append(dlg);dlg.showModal();const durum=t=>{const p=dlg.querySelector('[data-durum]');if(p)p.textContent=t;};
  dlg.querySelector('[data-kapat]').onclick=()=>kapat();dlg.onclose=()=>{kapat();dlg.remove();};
  try{
   await sdk();
   const {data,error}=await c.sb.functions.invoke('yonetim-oda-dinle',{body:{room_id:String(oda)}});
   if(error||!data?.token)throw new Error(data?.error||'TOKEN_ALINAMADI');
   const zg=new root.ZegoExpressEngine(data.app_id,data.server);
   try{zg.setLogConfig?.({logLevel:'disable',remoteLogLevel:'disable'});zg.setDebugVerbose?.(false);}catch{}
   const a={zg,oda:String(oda),akislar:new Map(),dlg};aktif=a;
   const kutu=dlg.querySelector('[data-sesler]'),ses=dlg.querySelector('[data-ses]');
   const say=()=>durum(a.akislar.size?'Dinleniyor · '+a.akislar.size+' kişi konuşuyor':'Bağlandı · Şu an mikrofonda kimse yok');
   ses.oninput=()=>{for(const el of a.akislar.values())el.volume=Number(ses.value)/100;};
   zg.on('roomStreamUpdate',async(_r,tip,liste)=>{if(aktif!==a)return;for(const s of liste){
     if(tip==='ADD'&&!a.akislar.has(s.streamID)){try{const ms=await zg.startPlayingStream(s.streamID,{video:false});const el=document.createElement('audio');el.autoplay=true;el.srcObject=ms;el.volume=Number(ses.value)/100;kutu.append(el);a.akislar.set(s.streamID,el);el.play?.().catch(()=>durum('Sesi başlatmak için pencereye bir kez tıkla.'));}catch{}}
     else if(tip==='DELETE'&&a.akislar.has(s.streamID)){try{zg.stopPlayingStream(s.streamID);}catch{}a.akislar.get(s.streamID).remove();a.akislar.delete(s.streamID);}
    }say();});
   zg.on('roomStateChanged',(_r,neden)=>{if(aktif===a&&/LOGOUT|KICKOUT|FAILED/i.test(String(neden)))durum('Bağlantı kapandı ('+neden+').');});
   const ok=await zg.loginRoom(a.oda,data.token,{userID:data.user_id,userName:'Puffy'},{userUpdate:false});
   if(!ok)throw new Error('GIRIS_BASARISIZ');if(aktif!==a)return;say();
  }catch(e){durum('Dinleme başlatılamadı: '+(c.errorText?c.errorText(e):String(e?.message||e)));}
 }
 root.PuffyOdaDinle={ac,kapat};
 root.addEventListener?.('beforeunload',()=>{kapat();});
})(window);
