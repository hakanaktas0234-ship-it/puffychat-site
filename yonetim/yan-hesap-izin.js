(() => {
 'use strict';
 const epochs=new WeakMap();
 function label(d){return d.status==='red'?'İzin kapalı / erişim reddedildi':d.status==='bekliyor'?'İnceleme bekliyor':d.status==='onay'?'İzin verildi':Number(d.manual)+Number(d.legacy)+Number(d.verified_exceptions)>0?'Cihaz istisnası mevcut':'Yan hesap istisnası yok';}
 async function mount(c,user,root){
  if(!root||!c.caps.owner)return;
  const token={};epochs.set(root,token);const alive=()=>root.isConnected&&epochs.get(root)===token;
  root.innerHTML='<section class="panel"><h2>Yan hesap izin durumu</h2><p role="status">İzin bilgisi yükleniyor…</p></section>';
  try{
   const d=await c.rpc('yonetim_yan_hesap_izin_durumu',{p_user:user});if(!alive())return;
   root.innerHTML=`<section class="panel"><div class="panel-head"><h2>Yan hesap izin durumu</h2><a href="#yan-hesap?kisi=${encodeURIComponent(user)}">Yan hesap dosyası →</a></div><p><strong>${c.esc(label(d))}</strong></p><dl class="key-values">${[['Yönetimden verilen cihaz izni',d.manual],['Eski kabul istisnası',d.legacy],['Doğrulanmış cihaz istisnası',d.verified_exceptions],['Normal ilk cihaz kaydı',d.initial],['Son karar',d.decision_at?c.date(d.decision_at):'—'],['Karar gerekçesi',d.reason||'—']].map(([k,v])=>`<div><dt>${c.esc(k)}</dt><dd>${c.esc(v)}</dd></div>`).join('')}</dl>${d.immune?'<p class="note">Bu hesap personel muafiyetiyle korunuyor; bu ekrandan izni kaldırılamaz.</p>':''}${d.can_revoke?'<details><summary>İzni kaldır</summary><p class="alert">Bu hesabın eski/yönetim istisnaları kaldırılır ve erişimi güvenlik incelemesine kapatılır. Aynı cihazdaki diğer hesaplar etkilenmez. Gerekirse yan hesap dosyasından yeniden izin verebilirsin.</p><form data-revoke><label>Gerekçe<textarea name="reason" required minlength="3" maxlength="200"></textarea></label><label><input type="checkbox" name="confirm" required> Bu hesabın erişiminin kapanacağını onaylıyorum.</label><button type="submit" class="tehlike">İzni kaldır ve erişimi kapat</button><p role="alert"></p></form></details>':''}</section>`;
   const form=root.querySelector('[data-revoke]');if(form)form.onsubmit=async e=>{
    e.preventDefault();if(!form.reportValidity()||form.dataset.busy)return;
    const reason=form.elements.reason.value.trim();if(reason.length<3)return;
    form.dataset.busy='true';const result=form.querySelector('[role=alert]');form.querySelector('button').disabled=true;result.textContent='İzin kaldırılıyor…';
    try{await c.rpc('yonetim_yan_hesap_izin_kaldir',{p_user:user,p_version:d.version,p_neden:reason});if(alive()){c.toast?.('Yan hesap izni kaldırıldı.');mount(c,user,root);}}
    catch(err){if(!alive())return;result.textContent=/REVIEW_CHANGED/.test(err.message||'')?'İzin veya karar değişti. Dosyayı yenileyip tekrar incele.':c.errorText(err);delete form.dataset.busy;form.querySelector('button').disabled=false;}
   };
  }catch(err){if(!alive())return;root.innerHTML=`<section class="panel"><h2>Yan hesap izin durumu</h2><p role="alert">${c.esc(/PGRST202|schema cache/.test(err.message||'')?'İzin yönetimi sunucuda henüz etkin değil.':c.errorText(err))}</p><button data-retry>Yeniden dene</button></section>`;root.querySelector('[data-retry]').onclick=()=>mount(c,user,root);}
 }
 window.PuffyYanHesapIzin={mount,label};
})();
