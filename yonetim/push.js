/* #11 (2026-10-11): panel kapalıyken bu cihaza bildirim. Abonelik bilgisi (endpoint) sunucuda,
   yöneticiye bağlı tutulur; yetki alınınca sunucu bu cihaza göndermez. */
(function(root){
 'use strict';
 const destek=()=>'serviceWorker' in navigator&&'PushManager' in root&&'Notification' in root;
 const b64=s=>{const p='='.repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));};
 async function kayit(){return navigator.serviceWorker.register('sw.js',{scope:'./'});}
 async function durum(){
  if(!destek())return {destek:false,acik:false,metin:'Bu tarayıcı panel kapalıyken bildirimi desteklemiyor.'};
  try{const reg=await navigator.serviceWorker.getRegistration('./');const sub=reg&&await reg.pushManager.getSubscription();
   if(Notification.permission==='denied')return {destek:true,acik:false,metin:'Bildirim izni engelli · Tarayıcı site ayarlarından aç.'};
   return sub?{destek:true,acik:true,metin:'Panel kapalıyken de bu cihaza bildirim gelir.'}:{destek:true,acik:false,metin:'Panel kapalıyken bildirim kapalı.'};}
  catch{return {destek:true,acik:false,metin:'Bildirim durumu okunamadı.'};}
 }
 async function ac(ctx){
  if(!destek())throw new Error('UNSUPPORTED');
  const izin=await Notification.requestPermission();if(izin!=='granted')throw new Error('PERMISSION_DENIED');
  const reg=await kayit();await navigator.serviceWorker.ready;
  const anahtar=await ctx.rpc('yonetim_push_acik_anahtar');if(!anahtar)throw new Error('PUSH_NOT_CONFIGURED');
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(anahtar)});
  const j=sub.toJSON();await ctx.rpc('yonetim_push_abone_ol',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});
 }
 async function kapat(ctx){
  const reg=await navigator.serviceWorker.getRegistration('./');const sub=reg&&await reg.pushManager.getSubscription();
  if(sub){try{await ctx.rpc('yonetim_push_birak',{p_endpoint:sub.endpoint});}catch{}await sub.unsubscribe();}
 }
 async function toggle(ctx){const d=await durum();if(d.acik)await kapat(ctx);else await ac(ctx);return durum();}
 root.PuffyPush={durum,toggle,destek};
})(window);
