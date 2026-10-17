const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const parts=location.pathname.split('/').filter(Boolean);
const candidate=parts.length===2&&['s','shorts'].includes(parts[0])?parts[1]:parts.length===1&&parts[0]==='shorts'?new URLSearchParams(location.search).get('v'):null;
const id=UUID.test(candidate??'')?candidate.toLowerCase():null;
const $=id=>document.getElementById(id);
const endpoint='https://rjdddbwotczhagdulwco.supabase.co/rest/v1/rpc/short_paylasim_onizleme';
const key='sb_publishable_TMb-Ldq66Pi3ehxPSYB8JA_aQ-zEeHd';
const play='https://play.google.com/store/apps/details?id=com.drgdijital.puffy';
function safeCover(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='rjdddbwotczhagdulwco.supabase.co'||u.hostname.endsWith('.cloudflarestream.com')||u.hostname==='videodelivery.net'||u.hostname==='imagedelivery.net')&&!/\.(mp4|webm|m3u8)$/i.test(u.pathname)?u.href:null;}catch{return null;}}
async function load(){
 $('retry').hidden=true;$('open-app').hidden=true;$('cover').hidden=true;$('cover-empty').hidden=false;
 if(!id){$('share-title').textContent='Bu bağlantı geçerli değil.';$('share-caption').textContent='Paylaşan kişiden video bağlantısını yeniden iste.';return;}
 $('share-caption').textContent='Video bilgisi kontrol ediliyor…';
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json','Content-Profile':'public','Accept-Profile':'public'},body:JSON.stringify({p_id:id}),signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)throw Error('UNAVAILABLE');const rows=await r.json();if(!Array.isArray(rows))throw Error('INVALID_RESPONSE');
  if(!rows.length){$('share-title').textContent='Bu video şu an paylaşıma açık değil.';$('share-caption').textContent='Video kaldırılmış veya görünürlüğü değiştirilmiş olabilir.';return;}
  const item=rows[0];if(item.id!==id)throw Error('INVALID_RESPONSE');
  const name=String(item.nickname||'Puffy');$('share-title').textContent=`${name} bir an paylaştı.`;
  $('share-caption').textContent=item.caption||'Bu anı Puffy’de izle.';document.title=`${name} · Puffy Shorts`;
  const cover=safeCover(item.cover);if(cover){const img=$('cover');img.alt=`${name} · video kapağı`;img.onload=()=>{img.hidden=false;$('cover-empty').hidden=true;};img.onerror=()=>{img.hidden=true;$('cover-empty').hidden=false;};img.src=cover;}
  const custom=`com.drgdijital.puffy://shorts/${id}`;
  $('open-app').href=/Android/i.test(navigator.userAgent)?`intent://shorts/${id}#Intent;scheme=com.drgdijital.puffy;package=com.drgdijital.puffy;S.browser_fallback_url=${encodeURIComponent(play)};end`:custom;
  $('open-app').hidden=false;
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent)){$('download').textContent='Android için Google Play';$('share-hint').textContent='Puffy yüklüyse “Puffy’de izle” ile devam et.';}
 }catch{$('share-title').textContent='Bu an seni bekliyor.';$('share-caption').textContent='Video bilgisi yüklenemedi. Bağlantını kontrol edip tekrar dene.';$('retry').hidden=false;}
}
$('retry')?.addEventListener('click',load);
if($('share-title'))void load();
