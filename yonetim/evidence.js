/* Private evidence is fetched only when an owner opens this tab. */
(() => {
'use strict';
window.PuffyEvidence = { render(ctx) {
 const {root,profile,rpc,invoke,esc,errorText}=ctx;
 let offset=0,ticket=0;const people=new Map([[profile.id,profile]]);
 root.innerHTML='<section class="iletisim"><h2>Kanıt arşivi</h2><p class="note">Birebir mesajların 90 günlük özel arşivi. Şikâyete bağlanan kayıtlar korunabilir. Her açılış kaydedilir. Eski silinmiş içerikler burada yeniden üretilemez. Profil adları ve kullanıcı ID numaraları günceldir.</p><div data-evidence-list></div></section>';
 const box=root.querySelector('[data-evidence-list]');
 const stamp=x=>new Date(x).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});

 const person=id=>{
  if(!id)return 'Alıcı kaydı bulunamadı';
  const p=people.get(id), name=p?.nickname||'Profil adı alınamadı', display=p?.display_id;
  return '<a href="#kullanici/'+esc(id)+'" style="overflow-wrap:anywhere">'+esc(name)+' <strong>· ID '+esc(display??id)+'</strong></a>';
 };
 function parties(r){
  const recipient=r.sender_id===r.user_a?r.user_b:r.sender_id===r.user_b?r.user_a:null;
  const system=!recipient&&(r.versions||[]).some(v=>v.content?.kind==='system');
  return '<div data-message-parties style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0"><span><small>Gönderen</small><br>'+ (system?'Sistem bildirimi':person(r.sender_id))+'</span><strong aria-label="gönderdi">→</strong><span><small>Alıcı</small><br>'+(recipient?person(recipient):system?person(r.user_a)+' / '+person(r.user_b):'Alıcı kaydı bulunamadı')+'</span></div>';
 }
 const operations={backfill:'Mevcut mesaj arşive alındı',sent:'Mesaj gönderildi',before_change:'Değişiklik öncesi kayıt',deleted:'Mesaj silindi',changed:'İçerik değişti',hard_deleted:'Mesaj kalıcı kaldırıldı'};
 const kindNames={text:'Metin',image:'Görsel',gift:'Hediye',system:'Sistem bildirimi',location:'Konum'};
 function readable(r){
  const versions=r.versions||[], latest=versions.at(-1), original=[...versions].reverse().find(v=>v.content?.text);
  const c=original?.content||latest?.content||{};
  const deleted=latest?.content?.deleted_at||latest?.operation==='hard_deleted';
  return '<div style="margin:16px 0;padding:18px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04)"><p style="margin:0 0 10px;font-size:12px;color:var(--gold)">'+(deleted?'Silinmeden önceki mesaj':'Mesaj içeriği')+'</p><div data-message-text style="font-family:inherit;font-size:18px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--cream,#f4efe4)">'+esc(c.text||(c.kind==='image'?'Görsel mesajı — aşağıdaki görseli aç düğmesini kullan.':c.kind==='gift'?'Hediye mesajı':c.kind==='system'?'Sistem bildirimi':'Bu kayıtta okunabilir metin bulunmuyor.'))+'</div></div>';
 }

 async function load(){
  const t=++ticket;box.textContent='Arşiv yükleniyor…';
  try{
   const d=await rpc('yonetim_dm_kanit',{p_user:profile.id,p_limit:25,p_offset:offset});
   if(t!==ticket||!root.isConnected)return;
   const ids=[...new Set((d.rows||[]).flatMap(r=>[r.sender_id,r.user_a,r.user_b]).filter(id=>id&&!people.has(id)))];
   if(ids.length&&ctx.sb){
    const names=await ctx.sb.from('profiles').select('id,nickname,display_id').in('id',ids);
    if(!names.error)for(const p of names.data||[])people.set(p.id,p);
   }
   if(t!==ticket||!root.isConnected)return;
   box.innerHTML=(d.rows||[]).map(r=>'<article class="panel" data-id="'+esc(r.id)+'"><h3>'+esc(stamp(r.created_at))+'</h3>'+parties(r)+'<details><summary>Mesaj kimliği</summary><p>'+esc(r.id)+'</p></details><p>'+ (r.held?'Şikâyet için korunuyor':r.purging?'Saklama süresi dolmuş, temizleniyor':'Saklama sonu: '+esc(stamp(r.retain_until)))+'</p>'+readable(r)+r.versions.map(v=>'<details><summary>'+esc(operations[v.operation]||v.operation)+' — Teknik kayıt · '+esc(stamp(v.captured_at))+'</summary><p>İşlem yapan: '+esc(v.actor_id||'Sunucu / kimlik kaydedilmemiş')+'</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(v.content,null,2))+'</pre><p>Tür: '+esc(v.content.kind)+' · SHA-256: '+esc(v.sha256)+'</p></details>').join('')+(r.events||[]).map(e=>'<p>'+esc(e.table_name)+' · '+esc(e.operation)+' · '+esc(stamp(e.event_at))+' · İşlem yapan '+esc(e.actor_id||'Kaydedilmemiş / sunucu')+'</p>').join('')+r.media.map(m=>'<p>Görsel: '+esc(({ready:'Hazır',pending:'Kopyalanmayı bekliyor',copying:'Kopyalanıyor',error:'Kopyalama hatası',purging:'Saklama süresi doldu'})[m.status]||m.status)+(m.status==='ready'&&!r.purging?' <button data-media="'+esc(m.source_path)+'">Görseli 60 saniyelik erişimle aç</button>':'')+'</p>').join('')+(!r.purging?'<form data-hold><label>Şikâyet referansı / gerekçe<input name="reason" minlength="10" maxlength="1000" required></label><button>'+ (r.held?'Korumayı kaldır':'Şikâyet için koru')+'</button></form>':'')+'<div data-result></div></article>').join('')||'<p>Arşiv kaydı yok. Arşiv başlamadan önce silinmiş içerik bulunmayabilir.</p>';
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