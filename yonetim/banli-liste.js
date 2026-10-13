/* Account bans: names and server-side search behind existing admin/MFA/lease. */
(()=>{
 'use strict';let context=null,serial=0,query='',status='aktif',page=0,hash='';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const phase=window.PuffyPhase1,open=phase.open,close=phase.close,route=phase.route;
 function stop(){serial++;context=null;document.querySelector('#banli-liste-nav')?.remove();document.querySelector('#s-banli-liste')?.remove();query='';page=0;}
 phase.open=function(c){open.call(this,c);stop();if(!c.caps?.admin)return;context=c;
  const nav=document.createElement('div');nav.id='banli-liste-nav';nav.innerHTML='<div class="nav-caption">Yaptırımlar</div><a class="menu" href="#banli-kullanicilar">Banlanan kullanıcılar</a>';
  const host=document.querySelector('#uyg nav');host.insertBefore(nav,host.querySelector('.alt'));
  const root=document.createElement('section');root.id='s-banli-liste';root.className='hidden';document.querySelector('.workspace').append(root);
 };
 phase.close=function(){stop();return close.call(this);};
 phase.route=function(value){if(value.split('?')[0]!=='banli-kullanicilar')return route.call(this,value);
  if(!context?.caps.admin){location.hash='ozet';return true;}hash=value;page=0;load();return true;
 };
 async function load(){const c=context,n=++serial,root=document.querySelector('#s-banli-liste');if(!c||!root)return;
  const valid=()=>context===c&&n===serial&&location.hash.slice(1)===hash;
  document.querySelectorAll('.workspace > [id^="s-"]').forEach(x=>x.classList.toggle('hidden',x!==root));
  document.querySelector('#route-name').textContent='Banlanan kullanıcılar';document.querySelector('#uyg nav').classList.remove('open');
  root.innerHTML='<div class="page-title"><div><div class="eyebrow">YAPTIRIM DENETİMİ</div><h1>Banlanan kullanıcılar</h1><p>İsme veya kullanıcı ID’sine göre bul.</p></div></div><form class="filters" data-ban-search><label>İsim veya ID<input name="query" maxlength="100" autocomplete="off" placeholder="Kullanıcı adı, özel ID veya ID" value="'+esc(query)+'"></label><label>Durum<select name="status"><option value="aktif" '+(status==='aktif'?'selected':'')+'>Aktif hesap banları</option><option value="suresi_biten" '+(status==='suresi_biten'?'selected':'')+'>Süresi biten kayıtlar</option></select></label><button type="submit">Ara</button><button type="button" data-clear>Temizle</button></form><section class="panel" data-ban-results><div class="skeleton" role="status">Yükleniyor</div></section>';
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);query=String(f.get('query')||'').trim();status=String(f.get('status'));page=0;load();};
  root.querySelector('[data-clear]').onclick=()=>{query='';status='aktif';page=0;load();};
  try{const r=await c.sb.rpc('yonetim_banli_kullanicilar',{p_arama:query,p_durum:status,p_limit:25,p_offset:page*25});if(!valid())return;if(r.error)throw r.error;
   const d=r.data;if(!d||!Array.isArray(d.rows))throw new Error('Liste yanıtı geçersiz.');
   const rows=d.rows.map(x=>'<tr><td data-label="Kullanıcı"><a href="#kullanici/'+esc(x.user_id)+'">'+esc(x.nickname||'Silinmiş kullanıcı')+'</a><small> ID '+esc(x.display_id||'—')+(x.vanity_id?' · '+esc(x.vanity_id):'')+'</small></td><td data-label="Banı veren">'+esc(x.actor_name||'Sistem')+(x.actor_display_id?'<small>ID '+esc(x.actor_display_id)+'</small>':'')+'</td><td data-label="Sebep">'+esc(x.reason||'Kaydedilmemiş')+'</td><td data-label="Başlangıç">'+esc(new Date(x.created_at).toLocaleString('tr-TR'))+'</td><td data-label="Bitiş">'+esc(x.expires_at?new Date(x.expires_at).toLocaleString('tr-TR'):'Süresiz')+'</td></tr>').join('');
   root.querySelector('[data-ban-results]').innerHTML=(rows?'<div class="table-wrap"><table class="data-table responsive"><thead><tr><th>Kullanıcı</th><th>Banı veren</th><th>Sebep</th><th>Başlangıç</th><th>Bitiş</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="empty-state">Aramaya uygun ban kaydı yok.</p>')+'<div class="pager"><span>'+esc(d.total)+' kayıt</span><button data-prev '+(!page?'disabled':'')+'>Önceki</button><button data-next '+((page+1)*25>=d.total?'disabled':'')+'>Sonraki</button></div><p class="note">Bu ekran hesap banlarını listeler. Silinmiş eski banlar geçmiş olarak gösterilmez.</p>';
   root.querySelector('[data-prev]').onclick=()=>{page--;load();};root.querySelector('[data-next]').onclick=()=>{page++;load();};
  }catch(e){if(valid()){root.querySelector('[data-ban-results]').textContent=e.code==='PGRST202'?'Ban listesi sunucu güncellemesi bekleniyor.':String(e.message||e);}}
 }
})();
