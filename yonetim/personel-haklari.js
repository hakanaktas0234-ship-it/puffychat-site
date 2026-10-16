/* Personel ve yetki: görev hakları ve yalnız seçilmiş personellere toplu işlem. */
(() => {
  'use strict';
  const fmt = n => new Intl.NumberFormat('tr-TR').format(n);
  const displayName = value => String(value??'').normalize('NFKC').replace(/[\p{M}\p{Cf}]/gu,'').replace(/[^\p{L}\p{N}\s._-]/gu,' ').replace(/\s+/g,' ').trim() || String(value||'İsimsiz');
  const kinds = {dm:'DM mesajı',coin_event:'Etkinlik ödülü',coin_gift:'Coin hediyesi'};
  const messages = {
    STAFF_RECIPIENT_CHANGED:'Alıcılardan birinin bilgileri veya görevi değişti. Listeyi yenileyip yeni önizleme oluştur.',
    PREVIEW_EXPIRED:'Bu önizlemenin 30 dakikalık süresi doldu. Yeni önizleme oluştur.',
    COIN_BATCH_LIMIT:'Coin gönderimi için en fazla 30 personel seç.',
    DAILY_LIMIT:'Mevcut günlük coin sınırı aşılacak. Daha düşük miktar seç.',
    STAFF_ID_BACKUP_REVIEW_REQUIRED:'Bu ID eski bir atamadan kalmış. Eski ID yedeği doğrulanmadan görev ID’sine dönüştürülemez.',
    STAFF_ID_STATE_CHANGED:'Görev ID’si başka işlemde değişmiş. Önce bu kaydı kontrol et.',
    ROLE_STATE_CHANGED:'Roller başka işlemde değişmiş. Listeyi yenileyip yeniden incele.',
    ADMIN_ROLE_REQUIRED:'1001–1999 ID için Admin rolünü seç.',
    CUSTOMER_SERVICE_ROLE_REQUIRED:'1000 ID yalnız Müşteri hizmetleri rolüyle kullanılabilir.',
    STAFF_ID_RELEASE_REQUIRED:'Önce mevcut görev ID’sini geri al.',
  };
  function error(c,e) {return Object.entries(messages).find(([key])=>String(e?.message||e).includes(key))?.[1]||c.errorText(e);}
  function dialog(c,title,html) {
    const d=document.createElement('dialog');d.className='personel-dialog';
    d.innerHTML=`<form><div class="personel-dialog-head"><div><small>PUFFY · PERSONEL</small><h2>${c.esc(title)}</h2></div><button type="button" data-close aria-label="Kapat">×</button></div>${html}<p role="alert" data-error></p></form>`;
    document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();
    const route=()=>d.close();window.addEventListener('hashchange',route);
    d.addEventListener('close',()=>{window.removeEventListener('hashchange',route);d.remove();});d.showModal();return d;
  }
  const live=(c,d)=>c.isCurrent()&&d.isConnected;
  async function render(c) {
    if(!c.caps.owner)return;
    const {root,esc}=c,selected=new Map();let offset=0,query='',generation=0;
    root.innerHTML=`<div class="personel-heading"><div><small>ERİŞİM YÖNETİMİ</small><h1>Personel ve yetki</h1><p>Görevleri yönet. Seçtiğin ekibe mesaj veya coin ödülü gönder.</p></div><button data-add class="primary">Personel görevlendir</button></div>
      <div class="personel-principles"><div><strong>VIP 4</strong><span>Admin görevi boyunca</span></div><div><strong>ID’yi sen seç</strong><span>Müşteri hizmetleri 1000 · Admin 1001–1999</span></div><div><strong>Göreve bağlı haklar</strong><span>Görev bitince özel ID geri alınır; satın alınmış VIP korunur.</span></div></div>
      <section class="panel personel-workspace"><form data-search class="personel-toolbar"><label>Personel ara<input name="query" maxlength="100" placeholder="İsim veya ID"></label><button>Ara</button><span data-count></span></form><div data-list aria-live="polite"></div><div class="pager"><button data-prev>Önceki</button><span data-page></span><button data-next>Sonraki</button></div></section>
      <section class="panel personel-bulk"><div><small>SEÇİLİ EKİP</small><h2>Mesaj ve ödül</h2><p>Alıcıları yukarıdaki listeden seç. Göndermeden önce kişi listesini ve toplamı göreceksin.</p><div data-selected></div></div><form data-bulk><label>İşlem<select name="kind"><option value="dm">DM mesajı</option><option value="coin_event">Coin · Etkinlik ödülü</option><option value="coin_gift">Coin · Hediye</option></select></label><label data-amount hidden>Kişi başına coin<input name="amount" type="number" min="1" max="50000000" step="1" inputmode="numeric"></label><label>Mesaj<textarea name="message" maxlength="3500" rows="3" required placeholder="Seçilen personellere iletilecek mesaj"></textarea></label><label>İşlem nedeni<input name="reason" minlength="3" maxlength="290" required placeholder="İşlem kütüğüne kaydedilir"></label><p data-total class="personel-total" aria-live="polite"></p><p class="note">DM: en fazla 50 kişi. Coin: en fazla 30 kişi; mevcut saatlik ve günlük kasa sınırları geçerlidir.</p><p role="alert" data-bulk-error></p><button class="primary" data-preview disabled>Alıcıları ve işlemi incele</button></form></section>
      <section class="panel"><div class="personel-toolbar"><h2>Son toplu işlemler</h2><button data-history-refresh>Yenile</button></div><div data-history></div></section><div data-pending-role></div>`;
    const $=s=>root.querySelector(s),bulk=$('[data-bulk]');
    function selection() {
      $('[data-selected]').innerHTML=selected.size?[...selected.values()].map(p=>`<button type="button" class="personel-chip" data-remove="${esc(p.user_id)}">${esc(displayName(p.nickname))} <span>#${esc(p.display_id)}</span> ×</button>`).join(''):'<p class="note">Henüz personel seçilmedi.</p>';
      $('[data-selected]').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.delete(b.dataset.remove);selection();root.querySelectorAll('[data-select]').forEach(x=>x.checked=selected.has(x.dataset.select));});
      const k=bulk.elements.kind.value,amount=Number(bulk.elements.amount.value)||0;
      $('[data-total]').textContent=k==='dm'?`${selected.size} kişiye DM mesajı`:`${selected.size} kişi × ${fmt(amount)} coin = ${fmt(selected.size*amount)} coin`;
      $('[data-preview]').disabled=!selected.size||selected.size>(k==='dm'?50:30);
    }
    bulk.elements.kind.onchange=()=>{const coin=bulk.elements.kind.value!=='dm';$('[data-amount]').hidden=!coin;bulk.elements.amount.required=coin;bulk.elements.message.required=!coin;selection();};
    bulk.elements.amount.oninput=selection;
    async function load() {
      const gen=++generation;$('[data-list]').textContent='Personeller yükleniyor…';
      try {
        const data=await c.rpc('yonetim_personel_hak_listesi',{p_query:query,p_limit:25,p_offset:offset});if(!c.isCurrent()||gen!==generation)return;
        $('[data-count]').textContent=fmt(data.total)+' personel';$('[data-page]').textContent=data.total?`${offset+1}–${Math.min(offset+25,data.total)}`:'0';$('[data-prev]').disabled=offset===0;$('[data-next]').disabled=offset+25>=data.total;
        $('[data-list]').innerHTML=data.rows.length?`<div class="personel-table-wrap"><table class="personel-table"><thead><tr><th>Seç</th><th>Personel</th><th>Roller</th><th>Görev hakları</th><th>İşlem</th></tr></thead><tbody>${data.rows.map(p=>`<tr><td><input type="checkbox" data-select="${esc(p.user_id)}" aria-label="${esc(displayName(p.nickname))} seç" ${selected.has(p.user_id)?'checked':''}></td><td><a class="personel-name" href="#kullanici/${esc(p.user_id)}">${esc(displayName(p.nickname))}</a><small class="personel-id">ID ${esc(p.display_id)}</small></td><td>${p.roles.map(r=>`<span class="tag">${esc(c.roleName(r))}</span>`).join('')||'—'}</td><td>${p.gorev_vip?'<span class="personel-vip">VIP 4 · Görev</span>':'<span class="muted">Görev VIP’si yok</span>'}${p.gorev_id?`<small class="personel-id">Görev ID ${esc(p.gorev_id)}</small>`:''}</td><td><button data-edit="${esc(p.user_id)}">Düzenle</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Eşleşen personel yok.</p>';
        $('[data-list]').querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{const p=data.rows.find(p=>p.user_id===el.dataset.select);if(el.checked){if(selected.size>=50){el.checked=false;c.toast('En fazla 50 personel seç.');return;}selected.set(p.user_id,p);}else selected.delete(p.user_id);selection();});
        $('[data-list]').querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>edit(data.rows.find(p=>p.user_id===el.dataset.edit)));
      }catch(e){if(c.isCurrent()&&gen===generation)$('[data-list]').textContent=error(c,e);}
    }
    $('[data-search]').onsubmit=e=>{e.preventDefault();query=e.target.elements.query.value.trim();offset=0;load();};$('[data-prev]').onclick=()=>{offset=Math.max(0,offset-25);load();};$('[data-next]').onclick=()=>{offset+=25;load();};
    const pendingKey='puffy-personel-role:'+c.user.id;
    function pending() {try{return JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch{return null;}}
    function pendingUI(){const p=pending();$('[data-pending-role]').innerHTML=p?'<section class="panel"><h3>Sonucu doğrulanacak rol işlemi</h3><p>Yeni bir rol işlemi açmadan önce önceki isteğin sonucunu doğrula.</p><button data-resume>İşlemi incele</button></section>':'';if(p)$('[data-resume]').onclick=()=>edit(p.person,p);}
    function edit(person,resume=null) {
      if(!resume&&pending()){c.toast('Önce bekleyen rol işlemini doğrula.');$('[data-pending-role]').scrollIntoView();return;}
      const d=dialog(c,'Görev ve haklar',`<p class="personel-name">${esc(displayName(person.nickname))} <span class="personel-id">ID ${esc(person.display_id)}</span></p><div class="personel-role-grid">${[0,1,2].map(i=>`<label>${i+1}. rol<select name="role${i}"><option value="">Rol yok</option>${c.roles.map(r=>`<option value="${esc(r)}" ${person.roles[i]===r?'selected':''}>${esc(c.roleName(r))}</option>`).join('')}</select></label>`).join('')}</div><label>Görev ID’si<input name="display_id" type="number" min="1000" max="1999" step="1" value="${esc(person.gorev_id||'')}" placeholder="İsteğe bağlı · 1000 veya 1001–1999"></label><p class="note">1000: Müşteri hizmetleri. 1001–1999: Admin. Admin rolü VIP 4 ve Admin çerçevesi verir. İlgili rol kaldırılınca görev hakları ve görev ID’si geri alınır; satın alınmış VIP devam eder.</p><label>İşlem nedeni<input name="reason" minlength="3" maxlength="300" required></label><p data-summary class="personel-total"></p><button class="primary" type="submit">Görev değişikliğini kaydet</button>`);
      const f=d.querySelector('form');let request=resume?.request||null,busy=false;
      const freeze=()=>{f.querySelectorAll('input,select').forEach(el=>el.disabled=true);f.querySelector('[type=submit]').textContent='Aynı isteğin sonucunu doğrula';};
      if(resume){[0,1,2].forEach(i=>f.elements['role'+i].value=request.p_roles[i]||'');f.elements.display_id.value=request.p_display_id||'';f.elements.reason.value=request.p_reason;freeze();}
      function summary(){const roles=[0,1,2].map(i=>f.elements['role'+i].value);const id=f.elements.display_id;if(person.gorev_id&&((person.id_rolu==='admin'&&!roles.includes('admin'))||(person.gorev_id==='1000'&&!roles.includes('customer_service'))))id.value='';d.querySelector('[data-summary]').textContent=roles.includes('admin')?'Admin görevi: VIP 4 + Admin çerçevesi aktif olacak.':'Admin görevinden gelen VIP ve çerçeve aktif olmayacak.';}
      f.querySelectorAll('select').forEach(el=>el.onchange=summary);summary();
      d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
      f.onsubmit=async e=>{e.preventDefault();if(busy||!live(c,d))return;
        const out=d.querySelector('[data-error]');out.textContent='';
        if(!request){const roles=[0,1,2].map(i=>f.elements['role'+i].value).filter(Boolean);if(new Set(roles).size!==roles.length){out.textContent='Aynı rolü iki kez seçemezsin.';return;}
          request={p_user:person.user_id,p_expected_roles:person.roles,p_roles:roles,p_display_id:f.elements.display_id.value?Number(f.elements.display_id.value):null,p_reason:f.elements.reason.value.trim(),p_request_id:crypto.randomUUID()};
          try{sessionStorage.setItem(pendingKey,JSON.stringify({person,request}));}catch{request=null;out.textContent='İşlem kurtarma kaydı saklanamadı. Tarayıcı depolamasını kontrol et.';return;}freeze();pendingUI();
        }
        busy=true;f.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await c.rpc('yonetim_personel_hak_kaydet',request);sessionStorage.removeItem(pendingKey);if(!live(c,d))return;d.close();pendingUI();c.toast('Görev ve haklar güncellendi.');selected.delete(person.user_id);selection();await load();}
        catch(ex){if(!live(c,d))return;out.textContent=error(c,ex);if(ex.code&&/^[0-9A-Z]{5}$/.test(ex.code)||ex.payload?.ok===false){sessionStorage.removeItem(pendingKey);request=null;f.querySelectorAll('input,select').forEach(el=>el.disabled=false);f.querySelector('[type=submit]').textContent='Görev değişikliğini kaydet';pendingUI();}else out.textContent+=' Sonuç belirsiz olabilir; aynı isteğin sonucunu doğrula.';}
        finally{busy=false;if(d.isConnected)f.querySelectorAll('button').forEach(b=>b.disabled=false);}
      };
    }
    $('[data-add]').onclick=()=>{const d=dialog(c,'Personel görevlendir','<label>Kullanıcının mevcut ID’si<input name="id" type="number" min="1" step="1" required></label><button class="primary">Hesabı bul</button>');d.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=d.querySelector('[class=primary]');btn.disabled=true;try{const p=await c.rpc('yonetim_personel_hak_bul',{p_display_id:Number(e.target.elements.id.value)});if(!live(c,d))return;d.close();edit(p);}catch(ex){if(live(c,d))d.querySelector('[data-error]').textContent=error(c,ex);}finally{btn.disabled=false;}};};
    async function history(){try{const rows=await c.rpc('yonetim_personel_toplu_son');if(!c.isCurrent())return;$('[data-history]').innerHTML=rows.length?rows.map((r,i)=>`<div class="personel-history"><div><strong>${esc(kinds[r.body.kind])} · ${r.recipients.length} kişi</strong><small>${esc(c.date(r.created_at))} · ${r.result?'Tamamlandı':'Önizleme / sonucu doğrulanabilir'}</small></div><button data-receipt="${i}">${r.result?'Sonucu göster':'İncele'}</button></div>`).join(''):'<p class="note">Henüz toplu işlem yok.</p>';$('[data-history]').querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>review(rows[Number(b.dataset.receipt)]));}catch(e){if(c.isCurrent())$('[data-history]').textContent=error(c,e);}}
    $('[data-history-refresh]').onclick=history;
    function review(r) {
      const coin=r.body.kind!=='dm',total=r.body.amount*r.recipients.length;
      const d=dialog(c,r.result?'İşlem tamamlandı':'Gönderim önizlemesi',`<div class="personel-review-total"><small>${esc(kinds[r.body.kind])} · ${r.recipients.length} kişi</small><strong>${coin?fmt(total)+' coin':r.recipients.length+' DM'}</strong>${coin?`<span>Kişi başına ${fmt(r.body.amount)} coin</span>`:''}</div><div class="personel-recipients">${r.recipients.map(p=>`<div><span class="personel-name">${esc(displayName(p.nickname))}</span><span>ID ${esc(p.display_id)}</span></div>`).join('')}</div><p class="personel-message">${esc(r.body.message||'Ek mesaj yok.')}</p><p>İşlem nedeni: ${esc(r.body.reason)}</p><small class="personel-request">İstek ${esc(r.request_id)}</small>${r.result?'<p class="personel-total">Bu işlem tamamlandı. Tekrar gönderilmeyecek.</p>':`${coin?'<label>Ödeme şifresi<input name="password" type="password" autocomplete="off" required></label>':''}<button type="submit" class="primary">${r.recipients.length} kişiye ${coin?'coin':'mesaj'} gönder</button>`}`);
      let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});d.querySelector('form').onsubmit=async e=>{e.preventDefault();if(r.result||busy||!live(c,d))return;busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);const pass=e.target.elements.password;
        try{const result=await c.rpc('yonetim_personel_toplu_gonder',{p_request_id:r.request_id,p_odeme_sifresi:pass?.value||null});r.result=result;if(!live(c,d))return;d.close();c.toast(`${result.count} personel için işlem tamamlandı.`);review(r);history();}
        catch(ex){if(live(c,d))d.querySelector('[data-error]').textContent=error(c,ex)+' Yeni işlem açmadan bu istek üzerinden tekrar kontrol edebilirsin.';}
        finally{if(pass)pass.value='';busy=false;if(d.isConnected)d.querySelectorAll('button').forEach(b=>b.disabled=false);}
      };
    }
    let preparing=false;
    bulk.onsubmit=async e=>{e.preventDefault();if(preparing||!c.isCurrent())return;preparing=true;$('[data-preview]').disabled=true;$('[data-bulk-error]').textContent='';
      try{const r=await c.rpc('yonetim_personel_toplu_hazirla',{p_request_id:crypto.randomUUID(),p_users:[...selected.keys()],p_kind:bulk.elements.kind.value,p_amount:bulk.elements.kind.value==='dm'?0:Number(bulk.elements.amount.value),p_message:bulk.elements.message.value.trim(),p_reason:bulk.elements.reason.value.trim()});if(!c.isCurrent())return;review(r);history();}
      catch(ex){if(c.isCurrent())$('[data-bulk-error]').textContent=error(c,ex);}
      finally{preparing=false;if(c.isCurrent())selection();}
    };
    selection();pendingUI();await Promise.all([load(),history()]);
  }
  window.PuffyPersonel={render};
})();
