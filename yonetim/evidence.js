/* Private evidence is fetched only when an owner opens this tab. */
(() => {
'use strict';
window.PuffyEvidence = { render(ctx) {
 const {root,profile,rpc,invoke,esc,errorText}=ctx;
 let offset=0,ticket=0;
 root.innerHTML='<section class="iletisim"><h2>Kanıt arşivi</h2><p class="note">Birebir mesajların 90 günlük özel arşivi. Şikâyete bağlanan kayıtlar korunabilir. Her açılış kaydedilir. Eski silinmiş içerikler burada yeniden üretilemez.</p><div data-evidence-list></div></section>';
 const box=root.querySelector('[data-evidence-list]');
 const stamp=x=>new Date(x).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
 async function load(){
  const t=++ticket;box.textContent='Arşiv yükleniyor…';
  try{
   const d=await rpc('yonetim_dm_kanit',{p_user:profile.id,p_limit:25,p_offset:offset});
   if(t!==ticket||!root.isConnected)return;
   box.innerHTML=(d.rows||[]).map(r=>'<article class="panel" data-id="'+esc(r.id)+'"><h3>'+esc(stamp(r.created_at))+'</h3><p>Mesaj '+esc(r.id)+' · Gönderen '+esc(r.sender_id)+'</p><p>'+ (r.held?'Şikâyet için korunuyor':r.purging?'Saklama süresi dolmuş, temizleniyor':'Saklama sonu: '+esc(stamp(r.retain_until)))+'</p>'+r.versions.map(v=>'<details><summary>'+esc(v.operation)+' · '+esc(stamp(v.captured_at))+'</summary><p>İşlem yapan: '+esc(v.actor_id||'Sunucu / kimlik kaydedilmemiş')+'</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(v.content,null,2))+'</pre><p>Tür: '+esc(v.content.kind)+' · SHA-256: '+esc(v.sha256)+'</p></details>').join('')+(r.events||[]).map(e=>'<p>'+esc(e.table_name)+' · '+esc(e.operation)+' · '+esc(stamp(e.event_at))+' · İşlem yapan '+esc(e.actor_id||'Kaydedilmemiş / sunucu')+'</p>').join('')+r.media.map(m=>'<p>Görsel: '+esc(m.status)+(m.status==='ready'&&!r.purging?' <button data-media="'+esc(m.source_path)+'">Görseli 60 saniyelik erişimle aç</button>':'')+'</p>').join('')+(!r.purging?'<form data-hold><label>Şikâyet referansı / gerekçe<input name="reason" minlength="10" maxlength="1000" required></label><button>'+ (r.held?'Korumayı kaldır':'Şikâyet için koru')+'</button></form>':'')+'<div data-result></div></article>').join('')||'<p>Arşiv kaydı yok. Arşiv başlamadan önce silinmiş içerik bulunmayabilir.</p>';
   box.insertAdjacentHTML('beforeend','<div class="pager"><span>'+esc(d.total)+' kayıt</span><button data-prev '+(!offset?'disabled':'')+'>Önceki</button><button data-next '+(offset+25>=d.total?'disabled':'')+'>Sonraki</button></div>');
   box.querySelector('[data-prev]').onclick=()=>{offset=Math.max(0,offset-25);load();};
   box.querySelector('[data-next]').onclick=()=>{offset+=25;load();};
   for(const row of d.rows||[]){
    const article=Array.from(box.querySelectorAll('[data-id]')).find(x=>x.dataset.id===row.id);
    article.querySelectorAll('[data-media]').forEach(b=>b.onclick=async()=>{
     b.disabled=true;const result=article.querySelector('[data-result]');
     try{const data=await invoke('dm-evidence',{action:'media',user:profile.id,message:row.id,path:b.dataset.media});
      if(!root.isConnected)return;
      const u=new URL(data.url);if(u.protocol!=='https:')throw Error('INVALID_MEDIA_URL');
      const img=document.createElement('img');img.src=u.href;img.alt='Arşiv görseli';img.style.maxWidth='100%';result.replaceChildren(img);
      setTimeout(()=>{img.removeAttribute('src');img.remove();},60000);
     }catch(e){result.textContent=errorText(e);}finally{b.disabled=false;}
    });
    const form=article.querySelector('[data-hold]');
    if(form)form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;
     try{await rpc('yonetim_dm_kanit_hold',{p_message:row.id,p_hold:!row.held,p_reason:form.elements.reason.value});if(root.isConnected)load();}
     catch(e){article.querySelector('[data-result]').textContent=errorText(e);b.disabled=false;}
    };
   }
  }catch(e){if(t===ticket&&root.isConnected){box.textContent=errorText(e);const b=document.createElement('button');b.textContent='Tekrar dene';b.onclick=load;box.append(b);}}
 }
 load();
}};
})();