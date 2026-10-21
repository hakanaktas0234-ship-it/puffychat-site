/* Versioned content publishing. No economy RPCs. Publication and announcement approval are separate. */
(() => {
  'use strict';
  const phase = window.PuffyPhase1;
  if (!phase || window.PuffyDynamicContent) return;
  window.PuffyDynamicContent = true;
  const original = { open: phase.open, close: phase.close, route: phase.route };
  let ctx = null, epoch = 0, page = 0;
  const observers=new Set();
  const style = document.createElement('style');
  style.textContent = `
  #s-dynamic-content .dc-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:22px 0}
  #s-dynamic-content .dc-list{display:grid;gap:12px}
  #s-dynamic-content article{display:grid;grid-template-columns:1fr auto;align-items:center;gap:18px;padding:22px;border:1px solid var(--line,#34343c);border-radius:16px;background:linear-gradient(125deg,#242429,#111318 70%)}
  #s-dynamic-content .dc-controls{display:flex;flex-wrap:wrap;gap:8px}
  #s-dynamic-content article h3{margin:0 0 7px}
  #s-dynamic-content .dc-muted,.dc-editor small{color:var(--muted,#bab4a8)}
  .dc-editor{box-sizing:border-box;overflow-wrap:anywhere;width:min(1060px,94vw);max-height:92dvh;overflow:auto;color:var(--cream,#ece1c8);background:#13151b;border:1px solid #8a6e30;border-radius:22px;padding:28px}
  .dc-editor::backdrop{background:#000b;backdrop-filter:blur(6px)}
  .dc-editor .dc-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,1fr);gap:28px}
  .dc-editor .dc-layout > *{min-width:0}
  .dc-editor label{display:grid;gap:7px;margin-bottom:16px}
  .dc-editor input,.dc-editor textarea,.dc-editor select{box-sizing:border-box;width:100%;font:inherit;color:inherit;background:#1d2029;border:1px solid #46434a;border-radius:9px;padding:12px}
  .dc-editor .dc-dates{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .dc-editor .dc-preview{align-self:start;position:sticky;top:0;border:1px solid #8a6e30;border-radius:24px;padding:20px;background:radial-gradient(ellipse at top left,#393027,#0c1018 75%);min-height:340px}
  .dc-preview .dc-cover{width:100%;aspect-ratio:3;overflow:hidden;border-radius:10px;background:#24242b}
  .dc-preview .dc-cover img{display:block;width:100%;height:100%;object-fit:cover}
  .dc-preview h3{font-family:Georgia,serif;font-size:28px;color:#e4c68c;overflow-wrap:anywhere}
  .dc-preview p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
  .dc-editor footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px;margin-top:20px}
  .dc-editor footer button{min-width:0;white-space:normal}
  .dc-editor [role=alert]{color:#f0a9a9;min-height:24px}
  .dc-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}
  .dc-media-tile{min-width:0;border:1px solid #514535;border-radius:14px;padding:12px;background:linear-gradient(145deg,#27252a,#11151c)}
  .dc-media-tile .dc-thumb{aspect-ratio:3/2;display:grid;place-items:center;background:#0b1018;border-radius:9px;overflow:hidden}
  .dc-media-tile img{display:block;width:100%;height:100%;object-fit:contain}
  .dc-media-tile p{overflow-wrap:anywhere}.dc-media-tile small{display:block;color:#bab4a8}
  .dc-binding-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .dc-binding-grid fieldset{min-width:0;border:1px solid #60513d;border-radius:16px;padding:14px}
  .dc-avatar-preview{position:relative;width:260px;max-width:100%;height:260px;margin:auto;background:radial-gradient(ellipse,#30333c,#10141b 72%);overflow:hidden;border-radius:16px}
  .dc-avatar-preview .dc-avatar{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 25%,#c1b195,#5e605f);display:grid;place-items:center;color:#10141b;font-size:12px}
  .dc-avatar-preview img{position:absolute;max-width:none;pointer-events:none}
  .dc-binding-asset{max-width:100%;height:130px;object-fit:contain;display:block;margin:12px auto}
  .dc-binding-grid input[type=number]{min-width:0}
  @media(max-width:850px){.dc-binding-grid{grid-template-columns:1fr}}
  .dc-media-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:end}.dc-media-toolbar label{flex:1;min-width:160px}
  @media(max-width:700px){.dc-media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:700px){.dc-editor .dc-layout{grid-template-columns:1fr}.dc-editor .dc-preview{position:static}.dc-editor .dc-dates{grid-template-columns:1fr}#s-dynamic-content article{grid-template-columns:1fr}}
  `;
  document.head.append(style);
  function cleanup() {
    epoch++; ctx = null;
    observers.forEach(observer=>observer.disconnect());observers.clear();
    document.querySelector('#dynamic-content-nav')?.remove();
    document.querySelector('#s-dynamic-content')?.remove();
    document.querySelectorAll('.dc-editor').forEach(d => d.remove());
  }
  function contextFor(c) {
    // Real panel open receives {sb,user,caps}; tests may provide explicit helpers.
    if (c.rpc && c.esc && c.toast && c.errorText) return c;
    const value = {...c};
    value.esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    value.errorText = error => error?.message || 'İşlem tamamlanamadı.';
    value.toast = text => {
      let node=document.querySelector('#dc-status');
      if(!node){node=document.createElement('p');node.id='dc-status';node.setAttribute('role','status');document.querySelector('#s-dynamic-content')?.prepend(node);}
      node.textContent=text;
    };
    value.rpc = async (name,params) => {
      if(ctx!==value)throw Error('STALE_SESSION');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try {
        const result=await c.sb.rpc(name,params).abortSignal(controller.signal);
        if(ctx!==value)throw Error('STALE_SESSION');
        if(result.error)throw result.error;
        return result.data;
      } finally {clearTimeout(timer);}
    };
    return value;
  }
  phase.open = function(c) {
    original.open.call(this, c); cleanup();
    if (!c.caps?.owner) return;
    ctx = contextFor(c); page = 0;
    const nav = document.createElement('div'); nav.id = 'dynamic-content-nav';
    nav.innerHTML = '<a class="menu" href="#dynamic-content">Dinamik içerikler</a>';
    const host = document.querySelector('#uyg nav');
    host?.insertBefore(nav, host.querySelector('.alt'));
    const root = document.createElement('section'); root.id = 's-dynamic-content'; root.className = 'hidden';
    document.querySelector('.workspace')?.append(root);
  };
  phase.close = function() { cleanup(); return original.close.call(this); };
  phase.route = function(value) {
    if (value !== 'dynamic-content') return original.route.call(this, value);
    if (!ctx?.caps.owner) { location.hash = 'ozet'; return true; }
    void render(); return true;
  };
  const errors = {
    VERSION_CONFLICT: 'Başka bir işlem bu içeriği değiştirdi. Listeyi yenileyip tekrar aç.',
    WINDOW_ENDED: 'Bitiş zamanı geçmiş. Önce taslağın tarihini düzelt.',
    COMPETITION_WORKER_NOT_READY: 'Otomatik sonuç ve ödeme görevi kurulu değil. Katılım açılmadan teknik kurulum tamamlanmalı.',
    COMPETITION_LOCKED: 'Yarışma aşaması veya revizyon değişmiş. Ekranı yenile. Bütçe ayrılınca kurallar kilitlenir.',
    COMPETITION_RELEASE_LOCKED: 'Bu yayına fonlanmış bir yarışma bağlı. Yeni yayın yerine mevcut yarışmayı tamamla.',
    COMPETITION_NOT_ENDED: 'Yarışma henüz bitmedi; sonuç kilitlenemez.',
    FUNDING_WALLET_MISSING: 'İlk fonlayan hesabın cüzdanı bulunamadı. İade için teknik kontrol gerekli.',
    INSUFFICIENT_FUNDING_BALANCE: 'Mevcut coin bakiyen ödül bütçesine yetmiyor.',
    INVALID_PRIZES: 'Ödüller pozitif, büyükten küçüğe ve toplam en fazla 1 milyar coin olmalı.',
    INVALID_COMPETITION: 'Puanlama, ödüller ve en düşük puanı kontrol et.',
    MEDIA_NOT_READY: 'Seçilen dosya eksik veya kullanıma hazır değil. Medyayı yeniden seç.',
    INVALID_FRAME_GEOMETRY: 'Avatar açıklığı çerçeve sınırlarını aşıyor. Çap ve merkez değerlerini kontrol et.',
    INVALID_FRAME_TITLE: 'Çerçeve adını yaz.',
    NORMAL_GIFT_REQUIRED: 'Bu ekran yalnız normal hediyeler içindir.',
    INVALID_MEDIA: 'Görseli onaylı medya deposundan seç.',
    INVALID_ACTION: 'Desteklenen bir hedef seç.',
    ANNOUNCEMENT_ALREADY_EXISTS: 'Bu yayın için farklı test alıcılarıyla bir kayıt var. Gönderim durumunu incele; yeni test için yeni yayın hazırla.',
    PUBLICATION_CHANGED: 'Yayın değişmiş. Listeyi yenileyip yeni yayını seç.',
    ANNOUNCEMENT_COVER_NOT_FOUND: 'Kapak dosyası medya deposunda bulunamadı. Görseli yeniden yükleyip yayınla.',
    ANNOUNCEMENT_COVER_REQUIRED: 'DM kartı için önce kapak görseli bulunan bir yayın hazırla.',
    TEST_ACCOUNT_NOT_FOUND: 'Test ID’lerinden biri bulunamadı veya kullanılamıyor.',
    INVALID_TEST_IDS: 'En fazla 20 geçerli kullanıcı ID’si yaz.',
    TIMEZONE_REQUIRED: 'Başlangıç ve bitiş saatlerini kontrol et.',
    INVALID_WINDOW: 'Bitiş, başlangıçtan sonra olmalı.',
    MFA_REQUIRED: 'İki adımlı güvenlik doğrulamasını yenile.',
  };
  const error = (c, e) => errors[e.message] || c.errorText(e);
  const states = { draft: 'Taslak', published: 'Yayın planında', paused: 'Duraklatıldı', archived: 'Arşiv' };
  const targets = [
    ['game_package','Yeni web oyun paketi'],
    ['game_royal','Oda · Puffy Royal'],['game_lagoon','Oda · Lagoon'],
    ['game_ekspres','Oda · Altın Ekspres'],['game_lezzet','Oda · Puffy Lezzet'],
    ['game_garaj','Oda · Grand Garage'],['game_carsi','Oda · Kapalıçarşı'],
    ['game_mahzen','Oda · Altın Mahzen'],['game_cark','Oda · Mücevher Çarkı'],
    ['game_gecit','Oda · Altın Geçit'],['game_hasat','Oda · Hasat Sarayı'],
    ['game_okey','Oda · Okey'],['game_ludo','Oda · Ludo'],
    ['events','Etkinlikler'],['cp','CP'],['kedi_ligi','Kedi Ligi'],['special_gifts','Special'],
    ['pk_sampiyon','PK Ligi'],['ajans_ligi','Ajans Ligi'],['aile_ligi','Aile Ligi'],
    ['yoldas_ligi','Yoldaş Ligi'],['taraftar_ligi','Taraftar Ligi'],['ozel_id','Özel ID'],
    ['davet','Davet'],['yayinci_ol','Yayıncı başvurusu'],['ajans_kur','Ajans başvurusu'],['call_host','Call Host başvurusu'],
  ];
  async function render() {
    const c = ctx, seq = ++epoch, root = document.querySelector('#s-dynamic-content');
    if (!root || !c) return;
    document.querySelectorAll('.workspace > [id^="s-"]').forEach(e => e.classList.toggle('hidden', e !== root));
    const valid = () => ctx === c && seq === epoch && location.hash === '#dynamic-content';
    const title = document.querySelector('#route-name'); if (title) title.textContent = 'Dinamik içerikler';
    root.innerHTML = '<h1>Dinamik içerikler</h1><p>Yayın listesi yükleniyor…</p>';
    try {
      const data = await c.rpc('content_admin_list_v1', { p_limit: 30, p_offset: page * 30 });
      if (!valid()) return;
      const items = data.items || [];
      root.innerHTML = `<div class="dc-heading"><div><div class="eyebrow">İÇERİK YAYIN MERKEZİ</div><h1>Bir içerik, tek doğru hedef.</h1><p class="dc-muted">Taslağı hazırla, telefon önizlemesini kontrol et, sonra yayınla.</p></div><div class="dc-controls"><button data-bindings>Hediye / çerçeve bağla</button><button data-library>Medya kütüphanesi</button><button class="primary" data-new>+ Yeni içerik</button></div></div><div class="dc-list">${items.map((i,n) => `<article><div><h3>${c.esc(i.draft.title)}</h3><p>${c.esc(states[i.state] || i.state)} · Revizyon ${c.esc(i.revision)}</p><small class="dc-muted">${c.esc(i.id)}</small></div><div class="dc-controls"><button data-edit="${n}">Taslağı düzenle</button><button class="primary" data-publish="${n}">Yayınla</button>${i.release_id ? `<button data-announce="${n}">DM kartını hazırla</button><button data-jobs="${n}">Gönderim durumu</button>${i.draft.kind==='competition'?`<button data-competition="${n}">Yarışma ve ödül bütçesi</button>`:''}<button data-state="${n}" data-to="${i.state === 'paused' ? 'published' : 'paused'}">${i.state === 'paused' ? 'Devam ettir' : 'Duraklat'}</button>${i.releases?.findIndex(r=>r.id===i.release_id) >= 0 && i.releases?.findIndex(r=>r.id===i.release_id) < i.releases.length-1 ? `<button data-rollback="${n}">Önceki yayına dön</button>` : ''}` : ''}</div></article>`).join('') || '<p>Henüz içerik yok. Yeni içerik oluşturarak başla.</p>'}</div><div class="dc-controls" style="margin-top:20px"><button data-prev ${page===0?'disabled':''}>Önceki</button><button data-next ${items.length<30?'disabled':''}>Sonraki</button></div>`;
      root.querySelector('[data-bindings]').onclick = () => void bindings(c);
      root.querySelector('[data-library]').onclick = () => void mediaLibrary(c);
      root.querySelector('[data-new]').onclick = () => edit(c, null);
      root.querySelector('[data-prev]').onclick = () => { page--; void render(); };
      root.querySelector('[data-next]').onclick = () => { page++; void render(); };
      root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => edit(c, items[+b.dataset.edit]));
      root.querySelectorAll('[data-publish]').forEach(b => b.onclick = () => publish(c, items[+b.dataset.publish]));
      root.querySelectorAll('[data-state]').forEach(b => b.onclick = () => changeState(c, items[+b.dataset.state], b.dataset.to));
      root.querySelectorAll('[data-announce]').forEach(b => b.onclick = () => void announce(c, items[+b.dataset.announce]));
      root.querySelectorAll('[data-competition]').forEach(b=>b.onclick=()=>void competition(c,items[+b.dataset.competition]));
      root.querySelectorAll('[data-jobs]').forEach(b => b.onclick = () => void jobs(c, items[+b.dataset.jobs]));
      root.querySelectorAll('[data-rollback]').forEach(b => b.onclick = () => rollback(c, items[+b.dataset.rollback]));
    } catch (e) {
      if (valid()) root.innerHTML = `<h1>Dinamik içerikler</h1><p role="alert">${c.esc(error(c,e))}</p><p>Yeni sunucu modülü kurulmadıysa bu alan henüz kullanılamaz. Mevcut yayınlar etkilenmez.</p>`;
    }
  }
  function dialog(title) {
    const d = document.createElement('dialog'); d.className = 'dc-editor';
    const h = document.createElement('h2'); h.textContent = title; d.append(h);
    document.body.append(d); d.showModal(); d.addEventListener('close', () => d.remove());
    return d;
  }
  function localDate(value) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Istanbul', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value)).replace(' ','T');
  }
  function edit(c, item) {
    const p = item?.draft || {}, d = dialog(item ? 'İçerik taslağı' : 'Yeni içerik');
    const action = p.actions?.[0], section = p.sections?.[0];
    const form = document.createElement('form');
    form.innerHTML = `<div class="dc-layout"><div><label>Başlık<input name="title" maxlength="120" required value="${c.esc(p.title||'')}"></label><label>Açıklama<textarea name="description" maxlength="6000" rows="4" required>${c.esc(p.description||'')}</textarea></label><label>Yayın türü<select name="kind">${[['campaign','Etkinlik'],['competition','Yarışma'],['game','Oyun tanıtımı'],['gift','Hediye tanıtımı'],['cosmetic','Çerçeve tanıtımı']].map(([k,v])=>`<option value="${k}" ${p.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><input name="cover_url" type="hidden" value="${c.esc(p.cover_url||'')}"><label>Kapak görseli<small data-cover-name>${p.cover_url?'Mevcut kapak seçili':'Henüz kapak seçilmedi'}</small></label><div class="dc-controls"><button type="button" data-select-cover>Kütüphaneden seç / yükle</button><button type="button" data-clear-cover>Kapağı kaldır</button></div><div class="dc-dates"><label>Başlangıç · Türkiye UTC+03<input name="starts_at" type="datetime-local" required value="${c.esc(localDate(p.starts_at||new Date()))}"></label><label>Bitiş · Türkiye UTC+03<input name="ends_at" type="datetime-local" required value="${c.esc(localDate(p.ends_at||Date.now()+7*86400000))}"></label></div><label>Gösterilecek yer<select name="surface"><option value="home" ${!p.surfaces?.includes('games')?'selected':''}>Ana sayfa</option><option value="games" ${p.surfaces?.includes('games')&&!p.surfaces?.includes('home')?'selected':''}>Oyun konsolu</option><option value="both" ${p.surfaces?.length===2?'selected':''}>İkisi de</option></select></label><label>Bilgi başlığı<input name="heading" maxlength="120" value="${c.esc(section?.heading||'Kurallar ve ödüller')}"></label><label>Bilgi metni<textarea name="body" maxlength="4000" rows="4">${c.esc(section?.body||'')}</textarea></label><label>Düğme yazısı<input name="label" maxlength="60" value="${c.esc(action?.label||'İncele')}"></label><label>Açılacak bölüm<select name="destination"><option value="">Yalnız bilgi göster</option>${targets.map(([k,v])=>`<option value="${k}" ${action?.destination===k?'selected':''}>${v}</option>`).join('')}</select></label><small>Ödül metni tek başına ödül dağıtmaz. Katılım ve ödeme, açılan yarışmanın kendi kurallarıyla yürür.</small><label>Değişiklik sebebi<input name="reason" minlength="3" maxlength="300" required></label></div><aside class="dc-preview" aria-label="Telefon önizlemesi"><small>TELEFON ÖNİZLEMESİ</small><div data-preview></div></aside></div><p role="alert"></p><footer><button type="button" data-cancel>Vazgeç</button><button class="primary" type="submit">Taslağı kaydet</button></footer>`;
    d.append(form);
    let packagePicker;
    const read = () => {
      const f = new FormData(form), destination = String(f.get('destination'));
      const sections = [
        ...(f.get('body') ? [{heading:String(f.get('heading')), body:String(f.get('body'))}] : []),
        ...(p.sections?.slice(1) || []),
      ];
      return {
        schema_version: 1, template: 'content.detail.v1', kind: String(f.get('kind')),
        title: String(f.get('title')).trim(), description: String(f.get('description')),
        cover_url: String(f.get('cover_url')).trim() || null,
        starts_at: String(f.get('starts_at')) + ':00+03:00',
        ends_at: String(f.get('ends_at')) + ':00+03:00',
        surfaces: f.get('surface') === 'both' ? ['home','games'] : [String(f.get('surface'))],
        sections,
        ...(packagePicker?.get() ? {game_package: packagePicker.get()} : {}),
        ...(packagePicker?.engine() ? {game_engine: packagePicker.engine()} : {}),
        actions: [
          ...(destination ? [{label:String(f.get('label')).trim(),destination}] : []),
          ...(p.actions?.slice(1) || []),
        ],
      };
    };
    const update = () => {
      const v = read(), image = /^https:\/\/rjdddbwotczhagdulwco\.supabase\.co\/storage\/v1\/object\/public\/media-assets\/[A-Za-z0-9_/-]+\.(webp|png|jpg|jpeg)$/.test(v.cover_url||'') ? v.cover_url : null;
      form.querySelector('[data-preview]').innerHTML = `${image?`<div class="dc-cover"><img src="${c.esc(image)}" alt="Kapak"></div>`:''}<h3>${c.esc(v.title||'Etkinlik başlığı')}</h3><p>${c.esc(v.description||'Açıklaman burada görünecek.')}</p><strong>${c.esc(v.sections[0]?.heading||'')}</strong><p>${c.esc(v.sections[0]?.body||'')}</p>${v.actions[0]?`<span class="tag">${c.esc(v.actions[0].label)}</span>`:''}`;
    };
    form.querySelector('[data-select-cover]').onclick=()=>void mediaLibrary(c,'cover',media=>{
      if(ctx!==c||!d.isConnected)return;
      form.elements.cover_url.value=media.url;
      form.querySelector('[data-cover-name]').textContent=media.title;
      update();
    });
    form.querySelector('[data-clear-cover]').onclick=()=>{
      form.elements.cover_url.value='';form.querySelector('[data-cover-name]').textContent='Henüz kapak seçilmedi';update();
    };
    packagePicker = window.PuffyGamePackagePicker.attach(form, c, p.game_package, update, p.game_engine);
    form.addEventListener('input',update); update();
    let busy = false;
    form.querySelector('[data-cancel]').onclick = () => d.close();
    d.addEventListener('cancel', e => { if(busy)e.preventDefault(); });
    form.onsubmit = async e => {
      e.preventDefault(); if(busy || ctx!==c)return;
      const value = read(), reason = String(new FormData(form).get('reason')).trim();
      const alert = form.querySelector('[role=alert]');
      if(!value.title || !value.description || reason.length<3 || new Date(value.ends_at)<=new Date(value.starts_at)) { alert.textContent='Başlık, açıklama, tarih ve sebebi kontrol et.';return; }
      busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      try {
        await c.rpc('content_admin_save_v1',{p_id:item?.id||null,p_revision:item?.revision||null,p_draft:value,p_reason:reason});
        if(ctx!==c)return;d.close();c.toast('Taslak kaydedildi. Henüz yayına alınmadı.');void render();
      }catch(ex){if(ctx===c)alert.textContent=error(c,ex);}
      finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
  }
  function command(c, title, message, execute) {
    const d=dialog(title), form=document.createElement('form');
    const text=document.createElement('p');text.textContent=message;d.append(text);
    form.innerHTML='<label>İşlem sebebi<input name="reason" required minlength="3" maxlength="300"></label><p role="alert"></p><footer><button type="button" data-cancel>Vazgeç</button><button type="submit" class="primary">Onayla</button></footer>';
    d.append(form);let busy=false;
    form.querySelector('[data-cancel]').onclick=()=>d.close();
    d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||ctx!==c)return;
      const reason=String(new FormData(form).get('reason')).trim();if(reason.length<3)return;
      busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{await execute(reason);if(ctx!==c)return;d.close();c.toast('İşlem kaydedildi.');void render();}
      catch(ex){if(ctx===c)form.querySelector('[role=alert]').textContent=error(c,ex);}
      finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
  }
  const mediaNames={cover:'Etkinlik kapağı',icon:'Hediye ikonu',frame:'Koltuk çerçevesi · statik',animation:'Hediye animasyonu · WebP'};
  function libraryUrl(value) {
    return typeof value==='string' && /^https:\/\/rjdddbwotczhagdulwco[.]supabase[.]co\/storage\/v1\/object\/public\/media-assets\/content-library\/(cover|icon|frame|animation)\/v1\/[a-f0-9]{64}[.](png|jpg|webp)$/.test(value);
  }
  async function mediaLibrary(c, purpose=null, selected=null) {
    const d=dialog(selected?(purpose==='cover'?'Kapak seç':'Medya seç'):'Medya kütüphanesi');
    const shell=document.createElement('div');
    shell.innerHTML=`<p>Yükleme tek başına etkinlik yayınlamaz, hediye satışını açmaz veya çerçeve hakkı vermez.</p><form data-media-filter class="dc-media-toolbar"><label>Tür<select name="purpose"><option value="">Tüm medya</option>${Object.entries(mediaNames).map(([k,v])=>`<option value="${k}" ${purpose===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Ara<input name="query" maxlength="80" placeholder="Medya adı"></label><button>Ara</button></form><div data-media-list>Yükleniyor…</div><div class="dc-controls"><button data-media-prev disabled>Önceki</button><button data-media-next disabled>Sonraki</button></div><hr><h3>Yeni medya yükle</h3><form data-media-upload><div class="dc-media-toolbar"><label>Kullanım<select name="purpose">${Object.entries(mediaNames).map(([k,v])=>`<option value="${k}" ${purpose===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Ad<input name="title" maxlength="120" required></label></div><label>Dosya<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><small>Kapak: 2048×1024 / 1,2 MB. İkon: 512×512 / 300 KB. Statik çerçeve: 1024×1024 / 800 KB. Hareketli WebP: 1280×720 / 8 saniye / 6 MB. MP4 bu yükleyicide henüz desteklenmez.</small><p data-upload-status role="status"></p><p data-upload-error role="alert"></p><button class="primary" data-upload-submit>Yükle ve doğrula</button></form><footer><button data-media-close>Kapat</button></footer>`;
    d.append(shell);
    const filter=shell.querySelector('[data-media-filter]'),upload=shell.querySelector('[data-media-upload]'),list=shell.querySelector('[data-media-list]');
    if(selected){filter.elements.purpose.disabled=true;upload.elements.purpose.disabled=true;}
    let page=0,seq=0,busy=false;
    const valid=()=>ctx===c&&d.isConnected;
    const allowed=media=>libraryUrl(media.url)&&(!purpose||media.purpose===purpose)&&Object.hasOwn(mediaNames,media.purpose);
    async function load(){
      const current=++seq;list.textContent='Medya yükleniyor…';
      try{
        const data=await c.rpc('content_admin_media_list_v1',{p_purpose:purpose||filter.elements.purpose.value||null,p_query:filter.elements.query.value,p_limit:24,p_offset:page*24});
        if(!valid()||current!==seq)return;
        const rows=(data.items||[]).filter(allowed);
        list.innerHTML=rows.length?`<div class="dc-media-grid">${rows.map((m,n)=>`<div class="dc-media-tile"><div class="dc-thumb">${m.kind==='webp'?'<span>Hareketli WebP</span>':`<img src="${c.esc(m.url)}" loading="lazy" alt="${c.esc(m.title)}">`}</div><p>${c.esc(m.title)}</p><small>${c.esc(mediaNames[m.purpose])} · ${Number(m.width)}×${Number(m.height)} · ${Math.ceil(Number(m.bytes)/1000)} KB</small><button type="button" data-media-preview="${n}">Önizle</button>${selected?`<button type="button" class="primary" ${m.kind==='webp'?'':'disabled'} data-animated="${m.kind==='webp'}" data-media-use="${n}">${purpose==='cover'?'Bu kapağı seç':'Bu medyayı seç'}</button>`:''}</div>`).join('')}</div>`:'<p>Bu türde medya yok. Aşağıdan ilk dosyanı yükleyebilirsin.</p>';
        shell.querySelector('[data-media-prev]').disabled=page===0;
        shell.querySelector('[data-media-next]').disabled=(data.items||[]).length<24;
        list.querySelectorAll('.dc-media-tile').forEach(tile=>{
          const image=tile.querySelector('img'),button=tile.querySelector('[data-media-use]');
          if(!image||!button)return;
          const check=()=>{button.disabled=!image.complete||image.naturalWidth<1;};
          image.onload=check;image.onerror=check;check();
        });
        list.querySelectorAll('[data-media-use]').forEach(b=>b.onclick=()=>{const m=rows[+b.dataset.mediaUse];if(!busy&&valid()&&allowed(m)&&['image','webp'].includes(m.kind)&&!b.disabled){selected(m);d.close();}});
        list.querySelectorAll('[data-media-preview]').forEach(b=>b.onclick=()=>{
          const m=rows[+b.dataset.mediaPreview];if(!valid()||!allowed(m))return;
          const preview=dialog(m.title),image=document.createElement('img');
          image.src=m.url;image.alt=m.title;image.style.cssText='display:block;max-width:100%;max-height:65vh;object-fit:contain;margin:auto';
          const close=document.createElement('button');close.textContent='Kapat';close.onclick=()=>preview.close();preview.append(image,close);
        });
      }catch(ex){if(valid()&&current===seq)list.textContent=error(c,ex);}
    }
    filter.onsubmit=e=>{e.preventDefault();page=0;void load();};
    shell.querySelector('[data-media-prev]').onclick=()=>{page--;void load();};
    shell.querySelector('[data-media-next]').onclick=()=>{page++;void load();};
    upload.elements.file.onchange=()=>{if(!upload.elements.title.value)upload.elements.title.value=(upload.elements.file.files[0]?.name||'').replace(/\.[^.]+$/,'').slice(0,120);};
    shell.querySelector('[data-media-close]').onclick=()=>{if(!busy)d.close();};
    d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    upload.onsubmit=async e=>{
      e.preventDefault();if(busy||!valid())return;
      const file=upload.elements.file.files[0],title=upload.elements.title.value.trim(),use=purpose||upload.elements.purpose.value;
      const alert=upload.querySelector('[data-upload-error]'),status=upload.querySelector('[data-upload-status]');
      alert.textContent='';
      if(!file||!title||file.size>({cover:1200000,icon:300000,frame:800000,animation:6000000}[use])){alert.textContent='Dosya, ad ve boyut sınırını kontrol et.';return;}
      if(!c.sb?.functions){alert.textContent='Medya yükleme bağlantısı hazır değil.';return;}
      const body=new FormData();body.append('file',file);body.append('purpose',use);body.append('title',title);
      busy=true;status.textContent='Yükleniyor ve sunucuda doğrulanıyor…';
      shell.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
      try{
        const result=await c.sb.functions.invoke('content-media-upload',{body});
        if(!valid())return;
        if(result.error)throw Error('Yükleme tamamlanmadı. Dosya türünü, sınırları ve güvenli oturumu kontrol et.');
        if(!result.data?.media||!allowed(result.data.media))throw Error('Sunucu medya yanıtı doğrulanamadı.');
        status.textContent='Dosya doğrulandı ve kütüphaneye eklendi. Kullanmak için listeden seç.';
        upload.elements.file.value='';page=0;filter.elements.purpose.value=use;await load();
      }catch(ex){if(valid()){status.textContent='';alert.textContent=error(c,ex);}}
      finally{busy=false;if(valid()){shell.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);if(selected){filter.elements.purpose.disabled=true;upload.elements.purpose.disabled=true;}shell.querySelector('[data-media-prev]').disabled=page===0;list.querySelectorAll('[data-media-use]').forEach(b=>{const img=b.closest('.dc-media-tile').querySelector('img');b.disabled=b.dataset.animated==='true'?false:!img?.complete||img.naturalWidth<1;});}}
    };
    await load();
  }
  function bindingUrl(value) {
    return typeof value==='string' && /^https:\/\/rjdddbwotczhagdulwco[.]supabase[.]co\/storage\/v1\/object\/public\/(varliklar|media-assets)\/[A-Za-z0-9_/-]+[.](png|jpg|jpeg|webp|mp4)$/.test(value);
  }
  async function bindings(c) {
    const d=dialog('Hediye ve çerçeve bağlantıları'),shell=document.createElement('div');
    shell.innerHTML='<p>Medya kaydı satış veya sahiplik vermez. Kullanıma açma ayrı işlemdir.</p><form class="dc-media-toolbar"><label>Tür<select name="kind"><option value="gift">Normal hediyeler</option><option value="frame">Dinamik çerçeveler</option></select></label><label>Ara<input name="query" maxlength="80"></label><button>Ara</button><button type="button" data-new-frame>+ Yeni çerçeve</button></form><div data-binding-list></div><footer><button data-prev>Önceki</button><button data-next>Sonraki</button><button data-close>Kapat</button></footer>';
    d.append(shell);let page=0,seq=0;
    const form=shell.querySelector('form'),list=shell.querySelector('[data-binding-list]');
    async function load(){
      const current=++seq;list.textContent='Yükleniyor…';
      try{
        const kind=form.elements.kind.value;
        const data=await c.rpc('content_admin_bindings_v1',{p_kind:kind,p_query:form.elements.query.value,p_offset:page*24});
        if(ctx!==c||!d.isConnected||current!==seq)return;
        const rows=data.items||[];
        list.innerHTML=rows.map((row,n)=>`<article class="dc-media-tile" style="margin:10px 0"><strong>${c.esc(kind==='gift'?row.name:row.title)}</strong><p>${row.active?'Açık':'Kapalı'}${kind==='gift'?` · ${Number(row.price_coin).toLocaleString('tr-TR')} coin`:''}</p><button data-edit-binding="${n}">Medyayı düzenle</button>${(kind==='frame'||row.binding)?`<button data-toggle-binding="${n}">${row.active?(kind==='gift'?'Satışı kapat':'Kullanımı kapat'):(kind==='gift'?'Satışa aç':'Kullanıma aç')}</button>`:''}</article>`).join('')||'<p>Kayıt bulunamadı.</p>';
        shell.querySelector('[data-prev]').disabled=page===0;shell.querySelector('[data-next]').disabled=rows.length<24;
        list.querySelectorAll('[data-edit-binding]').forEach(b=>b.onclick=()=>{
          const row=rows[+b.dataset.editBinding];
          if(kind==='gift')giftBinding(c,row,load);else frameBinding(c,row,load);
        });
        list.querySelectorAll('[data-toggle-binding]').forEach(b=>b.onclick=()=>{
          const row=rows[+b.dataset.toggleBinding];
          command(c,row.active?'Kullanımı kapat':'Kullanıma aç',kind==='gift'?`${row.name}: fiyat korunur. Bu işlem satış durumunu değiştirir.`:'Bu işlem yalnız çizimi açar/kapatır; kimseye çerçeve hakkı vermez.',async reason=>{
            await c.rpc(kind==='gift'?'content_admin_gift_sale_v1':'content_admin_frame_visibility_v1',kind==='gift'?{
              p_gift:row.id,p_revision:row.binding.revision,p_expected_ref:row.icon_ref,p_expected_active:row.active,p_active:!row.active,p_reason:reason,
            }:{p_code:row.code,p_revision:row.revision,p_expected_active:row.active,p_active:!row.active,p_reason:reason});
            await load();
          });
        });
      }catch(ex){if(ctx===c&&d.isConnected)list.textContent=error(c,ex);}
    }
    form.onsubmit=e=>{e.preventDefault();page=0;void load();};form.elements.kind.onchange=()=>{page=0;void load();};
    shell.querySelector('[data-new-frame]').onclick=()=>frameBinding(c,null,()=>{form.elements.kind.value='frame';page=0;return load();});
    shell.querySelector('[data-prev]').onclick=()=>{page--;void load();};shell.querySelector('[data-next]').onclick=()=>{page++;void load();};shell.querySelector('[data-close]').onclick=()=>d.close();
    await load();
  }
  function giftBinding(c,row,refresh){
    const d=dialog(row.name+' · medya'),form=document.createElement('form');
    const old=row.binding;
    let icon=(row.assets||[]).find(a=>a.asset_key===old?.icon_key),animation=(row.assets||[]).find(a=>a.asset_key===old?.animation_key),mode=old?.render_mode||'none';
    form.innerHTML=`<p>Fiyat: ${Number(row.price_coin).toLocaleString('tr-TR')} coin · Satış: ${row.active?'açık':'kapalı'}. Kaydetme bu iki değeri değiştirmez.</p><div class="dc-layout"><div><div><p>Hediye ikonu</p><button type="button" data-icon>İkon seç / yükle</button><small data-icon-name></small></div><div><p>Hediye animasyonu</p><button type="button" data-animation>WebP animasyon seç / yükle</button><small data-animation-name></small></div><button type="button" data-clear-animation>Animasyonu kaldır</button><p>Mevcut MP4 bağlantısı korunabilir; yeni MP4 yükleme henüz desteklenmez.</p><label>İşlem sebebi<input name="reason" required minlength="3" maxlength="300"></label></div><aside class="dc-preview" data-gift-preview></aside></div><p role="alert"></p><footer><button type="button" data-close>Vazgeç</button><button class="primary" type="submit">Medya bağlantısını kaydet</button></footer>`;
    d.append(form);let busy=false;
    function update(){
      form.querySelector('[data-icon-name]').textContent=icon?.title||'İkon seçilmedi';form.querySelector('[data-animation-name]').textContent=animation?.title||'Animasyon yok';
      form.querySelector('[data-gift-preview]').innerHTML=`<h3>${c.esc(row.name)}</h3>${icon&&bindingUrl(icon.url)?`<img class="dc-binding-asset" src="${c.esc(icon.url)}" alt="Hediye ikonu">`:''}${animation&&bindingUrl(animation.url)?(mode==='webp'?`<img class="dc-binding-asset" src="${c.esc(animation.url)}" alt="Hediye animasyonu">`:'<p>Mevcut MP4 bağlantısı korunuyor. Alfa paket önizlemesi bu panelde oynatılmaz.</p>'):''}`;
    }
    form.querySelector('[data-icon]').onclick=()=>void mediaLibrary(c,'icon',m=>{if(ctx===c&&d.isConnected){icon=m;update();}});
    form.querySelector('[data-animation]').onclick=()=>void mediaLibrary(c,'animation',m=>{if(ctx===c&&d.isConnected){animation=m;mode='webp';update();}});
    form.querySelector('[data-clear-animation]').onclick=()=>{animation=null;mode='none';update();};
    form.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||ctx!==c)return;
      const alert=form.querySelector('[role=alert]'),reason=form.elements.reason.value.trim();
      if(!icon||!bindingUrl(icon.url)||icon.ready===false||mode!=='none'&&(!animation||!bindingUrl(animation.url)||animation.ready===false)||reason.length<3){alert.textContent='Geçerli ikon, animasyon ve işlem sebebini kontrol et.';return;}
      busy=true;form.querySelectorAll('button,input').forEach(b=>b.disabled=true);
      try{
        await c.rpc('content_admin_bind_gift_v1',{p_gift:row.id,p_revision:old?.revision??null,p_icon:icon.asset_key,p_animation:animation?.asset_key||null,p_mode:mode,p_expected_ref:row.icon_ref,p_expected_active:row.active,p_reason:reason});
        if(ctx!==c)return;d.close();await refresh();c.toast('Medya bağlandı. Fiyat ve satış durumu korundu.');
      }catch(ex){if(ctx===c)alert.textContent=error(c,ex);}
      finally{busy=false;form.querySelectorAll('button,input').forEach(b=>b.disabled=false);}
    };update();
  }
  function frameBinding(c,row,refresh){
    const d=dialog(row?'Çerçeve medyasını düzenle':'Yeni dinamik çerçeve'),form=document.createElement('form');
    const code=row?.code||'content_frame_'+crypto.randomUUID(),labels={ring:'Koltuk',compact:'Küçük avatar',full:'Profil'};
    const assets={};for(const v of Object.keys(labels))assets[v]=(row?.assets||[]).find(a=>a.asset_key===row?.variants?.[v]?.asset_key);
    form.innerHTML=`<label>Çerçeve adı<input name="title" required maxlength="120" value="${c.esc(row?.title||'')}"></label><p>Durum: ${row?.active?'Açık kalır':'Kapalı kaydedilir'}. Sahiplik ve ödül verilmez.</p><div class="dc-binding-grid">${Object.entries(labels).map(([v,label])=>`<fieldset data-variant="${v}"><legend>${label}</legend><div class="dc-avatar-preview" data-frame-preview="${v}"></div><p data-file-name></p><button type="button" data-frame-pick="${v}">Statik çerçeve seç</button>${v==='full'?'<button type="button" data-frame-motion>Hareketli profil seç</button>':''}<label>Avatar açıklığı · %<input name="${v}_diameter" type="number" min="40" max="100" step="0.1" value="${Number(row?.variants?.[v]?.diameter??.6)*100}" required></label><label>Merkez X · %<input name="${v}_x" type="number" min="0" max="100" step="0.1" value="${Number(row?.variants?.[v]?.center_x??.5)*100}" required></label><label>Merkez Y · %<input name="${v}_y" type="number" min="0" max="100" step="0.1" value="${Number(row?.variants?.[v]?.center_y??.5)*100}" required></label></fieldset>`).join('')}</div><p>Koltuk ve küçük avatar statiktir. Açıklığı çerçevenin şeffaf deliğine göre ayarla; avatar merkezi sabit kalır.</p><label>İşlem sebebi<input name="reason" required minlength="3" maxlength="300"></label><p role="alert"></p><footer><button type="button" data-close>Vazgeç</button><button class="primary" type="submit">Çerçeveyi kaydet</button></footer>`;
    d.append(form);let busy=false;
    function geometry(v){return {asset_key:assets[v]?.asset_key,diameter:form.elements[v+'_diameter'].valueAsNumber/100,center_x:form.elements[v+'_x'].valueAsNumber/100,center_y:form.elements[v+'_y'].valueAsNumber/100};}
    function valid(v,g){const a=assets[v],d=g.diameter,x=g.center_x,y=g.center_y;return a&&a.ready!==false&&bindingUrl(a.url)&&['image','webp'].includes(a.kind)&&(v==='full'||a.kind==='image'&&(a.surface==='seat'||a.purpose==='frame'))&&[d,x,y].every(Number.isFinite)&&d>=.4&&d<=1&&x-d/2>=0&&x+d/2<=1&&y-d*a.width/a.height/2>=0&&y+d*a.width/a.height/2<=1;}
    function update(){
      for(const v of Object.keys(labels)){
        const field=form.querySelector(`[data-variant="${v}"]`),preview=field.querySelector('[data-frame-preview]'),g=geometry(v),a=assets[v];
        field.querySelector('[data-file-name]').textContent=a?.title||'Dosya seçilmedi';
        const size=v==='full'?96:v==='ring'?80:48,centerX=preview.clientWidth/2,centerY=130;
        preview.innerHTML=`<div class="dc-avatar" style="width:${size}px;height:${size}px;left:${centerX-size/2}px;top:${centerY-size/2}px">Avatar</div>`;
        if(valid(v,g)){
          const image=document.createElement('img'),w=size/g.diameter,h=w*a.height/a.width;
          image.src=a.url;image.alt=labels[v]+' çerçevesi';image.style.cssText=`width:${w}px;height:${h}px;left:${centerX-w*g.center_x}px;top:${centerY-h*g.center_y}px`;
          preview.append(image);
        }
      }
    }
    form.querySelectorAll('[data-frame-pick]').forEach(b=>b.onclick=()=>void mediaLibrary(c,'frame',m=>{if(ctx===c&&d.isConnected){assets[b.dataset.framePick]=m;update();}}));
    form.querySelector('[data-frame-motion]').onclick=()=>void mediaLibrary(c,'animation',m=>{if(ctx===c&&d.isConnected){assets.full=m;update();}});
    const observer=new ResizeObserver(()=>{if(d.isConnected)update();});observer.observe(form);observers.add(observer);d.addEventListener('close',()=>{observer.disconnect();observers.delete(observer);});
    form.addEventListener('input',update);form.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||ctx!==c)return;
      const variants=Object.fromEntries(Object.keys(labels).map(v=>[v,geometry(v)])),reason=form.elements.reason.value.trim(),alert=form.querySelector('[role=alert]');
      if(!form.elements.title.value.trim()||reason.length<3||!Object.keys(labels).every(v=>valid(v,variants[v]))){alert.textContent='Üç görünümün dosyasını, açıklık ölçülerini, adı ve işlem sebebini kontrol et.';return;}
      busy=true;form.querySelectorAll('button,input').forEach(b=>b.disabled=true);
      try{
        await c.rpc('content_admin_bind_frame_v1',{p_code:code,p_revision:row?.revision??null,p_title:form.elements.title.value.trim(),p_variants:variants,p_expected_active:row?.active??false,p_reason:reason});
        if(ctx!==c)return;d.close();await refresh();c.toast('Çerçeve kaydedildi. Kullanıma açma ayrı işlemdir.');
      }catch(ex){if(ctx===c)alert.textContent=error(c,ex);}
      finally{busy=false;form.querySelectorAll('button,input').forEach(b=>b.disabled=false);}
    };update();
  }
  async function competition(c,item){
    const d=dialog('Yarışma ve ödül bütçesi'),root=document.createElement('div');d.append(root);root.textContent='Yükleniyor…';
    try{
      const data=await c.rpc('content_admin_competition_v1',{p_item:item.id});
      if(ctx!==c||!d.isConnected)return;
      const v=data.competition,editable=!v||v.state==='draft',stateNames={draft:'Taslak',funded:'Bütçe ayrıldı',active:'Katılıma açık',frozen:'Sonuçlar kilitlendi',settled:'Ödüller ödendi',cancelled:'İptal edildi'};
      const form=document.createElement('form');
      form.innerHTML=`<div class="dc-layout"><div><p>Katılım ücretsizdir. Yalnız katılımdan sonra tamamlanan ücretli normal oda hediyeleri sayılır. Çanta, DM, kendine gönderim ve yarışma dışı hesapların işlemleri puan üretmez.</p><label>Puanlama<select name="adapter" ${editable?'':'disabled'}><option value="room_normal_sent_quantity">Gönderilen normal oda hediyesi adedi</option><option value="room_normal_received_quantity" ${v?.adapter==='room_normal_received_quantity'?'selected':''}>Alınan normal oda hediyesi adedi</option></select></label><label>Sıra ödülleri · coin<input name="prizes" value="${c.esc(v?.prizes?.join(', ')||'')}" placeholder="1. sıradan başlayarak: tutar, tutar…" ${editable?'':'disabled'} required><small>En fazla 10 sıra. Virgülle ayır; büyükten küçüğe yaz.</small></label><label>Ödül için en düşük puan<input name="minimum" type="number" min="1" max="1000000000" value="${Number(v?.minimum_score||1)}" ${editable?'':'disabled'} required></label><p>Eşit puanda puana önce ulaşan öndedir. Tarihler seçili etkinlik yayınından alınır. Bütçe ayrıldıktan sonra kurallar ve yayın sürümü değiştirilemez. Yeni yarışma dönemi için yeni içerik oluştur.</p><label>İşlem sebebi<input name="reason" required minlength="3" maxlength="300"></label><p role="alert"></p>${editable?'<button class="primary" type="submit">Yarışma kurallarını kaydet</button>':''}</div><aside class="dc-preview"><small>ÖDÜL BÜTÇESİ</small><h3>${c.esc(stateNames[v?.state]||'Henüz hazırlanmadı')}</h3><p>Türkiye saati: ${c.esc(localDate(v?.starts_at||data.window.starts_at).replace('T',' '))} — ${c.esc(localDate(v?.ends_at||data.window.ends_at).replace('T',' '))}</p><p>Mevcut coin bakiyen: <strong>${Number(data.funding_balance||0).toLocaleString('tr-TR')}</strong></p><p>Gerekli bütçe: <strong data-budget>${Number(v?.budget||0).toLocaleString('tr-TR')}</strong> coin</p>${v?`<p>Ayrılan: ${Number(v.funded).toLocaleString('tr-TR')}<br>Bekleyen: ${Number(v.available).toLocaleString('tr-TR')}<br>Ödenen: ${Number(v.paid).toLocaleString('tr-TR')}<br>İade: ${Number(v.refunded).toLocaleString('tr-TR')}</p><p>Katılımcı: ${Number(data.members)||0}</p>`:''}<p>Yeni coin üretilmez. Fonlama, mevcut bakiyenden ayrı bir yarışma bütçesine aktarır.</p></aside></div>`;
      root.replaceChildren(form);
      if(data.awards?.length){
        const winners=document.createElement('div');winners.innerHTML='<h3>Kilitli sonuçlar</h3>'+data.awards.map(a=>`<article class="dc-media-tile" style="margin:8px 0"><strong>${Number(a.rank)}. sıra · ${a.display_id==null?'Hesap kapalı':'ID '+c.esc(a.display_id)}</strong><p>${Number(a.score).toLocaleString('tr-TR')} puan · ${Number(a.amount).toLocaleString('tr-TR')} coin · ${c.esc({pending:'Ödeme bekliyor',paid:'Ödendi',withheld:'Uygunluk nedeniyle ödenmedi'}[a.status]||a.status)}</p></article>`).join('');root.append(winners);
      }
      const controls=document.createElement('footer');controls.innerHTML='<button data-close>Kapat</button><button data-refresh>Yenile</button>';root.append(controls);
      const reload=()=>{d.close();return competition(c,item);};
      controls.querySelector('[data-close]').onclick=()=>d.close();controls.querySelector('[data-refresh]').onclick=()=>void reload();
      function action(label,message,execute){const b=document.createElement('button');b.textContent=label;controls.prepend(b);b.onclick=()=>command(c,label,message,async reason=>{await execute(reason);void reload();});}
      if(v?.state==='draft'){
        const request=crypto.randomUUID();
        action('Bütçeyi ayır',`${Number(v.budget).toLocaleString('tr-TR')} coin mevcut bakiyenden düşüp bu yarışmaya ayrılacak. Bu işlem yarışmayı katılıma açmaz.`,reason=>c.rpc('content_admin_competition_fund_v1',{p_id:v.id,p_revision:v.revision,p_request:request,p_reason:reason}));
      }
      if(v?.state==='funded'&&data.worker_ready)action('Katılıma aç','Ayrılan bütçe ve kilitli kurallarla katılım açılacak. Süre bitince sonuçlar kilitlenip ödüller ayrılmış bütçeden otomatik ödenir.',reason=>c.rpc('content_admin_competition_activate_v1',{p_id:v.id,p_revision:v.revision,p_reason:reason}));
      if(v?.state==='funded'&&!data.worker_ready){const note=document.createElement('p');note.textContent='Otomatik sonuç ve ödeme görevi henüz hazır değil. Katılım açılmadan teknik kurulum tamamlanmalı.';root.append(note);}
      if(v?.state==='active'||v?.state==='frozen')action(v.state==='active'?'Bitişte sonuçları kilitle':'Ödülleri öde',v.state==='active'?'Bitiş zamanı sunucuda kontrol edilir. Bu adım sonuçları sabitler; ödeme ayrı işlemdir.':'Kilitli sonuçların ödülleri ayrılmış bütçeden bir kez ödenir.',reason=>c.rpc('content_admin_competition_process_v1',{p_id:v.id,p_action:v.state==='active'?'freeze':'pay',p_reason:reason}));
      if(v&&['funded','settled'].includes(v.state)&&v.available>0){const request=crypto.randomUUID();action('Kalan bütçeyi iade et',`${Number(v.available).toLocaleString('tr-TR')} coin ilk fonlayan hesaba döner. Yarışma açılmadıysa iptal edilir.`,reason=>c.rpc('content_admin_competition_refund_v1',{p_id:v.id,p_request:request,p_reason:reason}));}
      const parsePrizes=()=>form.elements.prizes.value.split(',').map(x=>x.trim());
      form.elements.prizes.oninput=()=>{const values=parsePrizes();form.querySelector('[data-budget]').textContent=values.every(x=>/^[1-9][0-9]*$/.test(x))?values.reduce((n,x)=>n+Number(x),0).toLocaleString('tr-TR'):'—';};
      let busy=false;form.onsubmit=async e=>{
        e.preventDefault();if(busy||!editable||ctx!==c)return;
        const raw=parsePrizes(),prizes=raw.map(Number),minimum=form.elements.minimum.valueAsNumber,reason=form.elements.reason.value.trim(),alert=form.querySelector('[role=alert]');
        if(raw.length>10||raw.some(x=>!/^[1-9][0-9]*$/.test(x))||prizes.some((x,n)=>!Number.isSafeInteger(x)||n>0&&x>prizes[n-1])||prizes.reduce((a,b)=>a+b,0)>1000000000||!Number.isSafeInteger(minimum)||minimum<1||reason.length<3){alert.textContent='Ödül sırasını, puan sınırını ve işlem sebebini kontrol et.';return;}
        busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await c.rpc('content_admin_competition_save_v1',{p_item:item.id,p_release:item.release_id,p_revision:v?.revision??null,p_adapter:form.elements.adapter.value,p_prizes:prizes,p_minimum:minimum,p_reason:reason});if(ctx===c)void reload();}
        catch(ex){if(ctx===c)alert.textContent=error(c,ex);}
        finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
      };
      d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    }catch(ex){if(ctx===c&&d.isConnected){root.textContent=error(c,ex);const close=document.createElement('button');close.textContent='Kapat';close.onclick=()=>d.close();root.append(close);}}
  }
  async function announce(c, item) {
    const d = dialog('DM kartını hazırla');
    d.insertAdjacentHTML('beforeend', '<p data-loading>Yayın önizlemesi yükleniyor…</p>');
    try {
      const data = await c.rpc('content_admin_announcement_preview_v1', {p_id:item.id, p_release:item.release_id});
      if (ctx !== c || !d.isConnected) return;
      d.querySelector('[data-loading]').remove();
      const p = data.content;
      if (!p || p.release_id !== item.release_id) throw Error('PUBLICATION_CHANGED');
      const image = /^https:\/\/rjdddbwotczhagdulwco[.]supabase[.]co\/storage\/v1\/object\/public\/media-assets\/[A-Za-z0-9_/-]+[.](webp|png|jpg|jpeg)$/.test(p.cover_url || '') ? p.cover_url : null;
      const sendable = image && ['live','upcoming'].includes(p.state);
      const form = document.createElement('form');
      form.innerHTML = `<div class="dc-layout"><div><p>Ana sayfa ve DM aynı içeriği açar. Taslağın değil, seçili yayının kartı gönderilir.</p><label>Alıcılar<select name="audience"><option value="test">Önce test hesaplarına</option><option value="all">Tüm uygun hesaplara</option></select></label><label data-test-label>Test kullanıcı ID’leri<input name="test_ids" inputmode="numeric" placeholder="Örnek: 1000, 1020" autocomplete="off"><small>Virgül veya boşlukla ayır. En fazla 20 hesap.</small></label><p data-audience-note>Yalnız yazdığın hesaplara gönderilir.</p><p>Türkiye saati: ${c.esc(localDate(data.starts_at).replace('T',' '))} — ${c.esc(localDate(data.ends_at).replace('T',' '))}</p><label>İşlem sebebi<input name="reason" minlength="3" maxlength="300" required></label><p role="alert">${sendable?'':'Kapak görseli ve etkin bir yayın olmadan gönderim hazırlanamaz.'}</p></div><aside class="dc-preview" data-dm-preview>${image?`<div class="dc-cover"><img src="${c.esc(image)}" alt="DM kapak görseli"></div>`:''}<h3>${c.esc(p.title)}</h3><p>${c.esc(p.description)}</p><strong>Etkinliği İncele</strong><p class="dc-muted">Aynı yayın → aynı detay ekranı</p></aside></div><footer><button type="button" data-cancel>Vazgeç</button><button type="submit" class="primary" ${sendable?'':'disabled'}>Test gönderimini onayla</button></footer>`;
      d.append(form);
      let busy = false, imageReady = false, request = crypto.randomUUID(), fingerprint = null;
      const audience = form.elements.audience, ids = form.elements.test_ids, submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      const cover = form.querySelector('[data-dm-preview] img');
      const checkCover = () => {
        imageReady = !!cover && cover.complete && cover.naturalWidth > 0;
        submit.disabled = !sendable || !imageReady;
        if (sendable) form.querySelector('[role=alert]').textContent = imageReady ? '' : 'Kapak görseli yüklenemedi. Bağlantıyı kontrol edip önizlemeyi tekrar aç.';
      };
      if (cover) { cover.onload = checkCover; cover.onerror = checkCover; if (cover.complete) checkCover(); }
      audience.onchange = () => {
        form.querySelector('[data-test-label]').hidden = audience.value === 'all';
        form.querySelector('[data-audience-note]').textContent = audience.value === 'all'
          ? `Şu an ${Number(data.eligible_count)||0} uygun hesap var. Testte teslim edilenlere aynı yayın tekrar gönderilmez. Yeni açılan hesaplar bu gönderime eklenmez.`
          : 'Yalnız yazdığın hesaplara gönderilir.';
        submit.textContent = audience.value === 'all' ? 'Herkese gönderimi onayla' : 'Test gönderimini onayla';
      };
      form.querySelector('[data-cancel]').onclick = () => d.close();
      d.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
      form.onsubmit = async e => {
        e.preventDefault(); if (busy || ctx !== c || !sendable || !imageReady) return;
        const reason = form.elements.reason.value.trim();
        const raw = ids.value.trim().split(/[\s,;]+/).filter(Boolean);
        const testIds = audience.value === 'all' ? [] : [...new Set(raw.map(Number))];
        const alert = form.querySelector('[role=alert]');
        if (reason.length < 3 || (audience.value === 'test' && (!raw.length || raw.length > 20 || raw.some(v => !/^[1-9][0-9]{0,14}$/.test(v)) || testIds.some(v=>!Number.isSafeInteger(v))))) {
          alert.textContent = 'İşlem sebebini ve test kullanıcı ID’lerini kontrol et.'; return;
        }
        const key = JSON.stringify([audience.value,testIds,reason]);
        if (fingerprint && fingerprint !== key) request = crypto.randomUUID();
        fingerprint = key;
        busy = true; form.querySelectorAll('button, input, select').forEach(el => el.disabled = true);
        try {
          const result = await c.rpc('content_admin_announce_v1', {p_id:item.id,p_release:item.release_id,p_audience:audience.value,p_test_ids:testIds,p_request:request,p_reason:reason});
          if (ctx !== c) return;
          d.close(); c.toast(['completed','cancelled'].includes(result.status) ? 'Bu yayının önceki gönderim kaydı mevcut. Durumunu inceleyebilirsin.' : 'Gönderim kuyruğa alındı. Teslim durumunu izleyebilirsin.'); void jobs(c,item);
        } catch (ex) { if (ctx === c) alert.textContent = error(c,ex); }
        finally { busy = false; form.querySelectorAll('button, input, select').forEach(el => el.disabled = false); submit.disabled = !sendable || !imageReady; }
      };
    } catch (ex) {
      if (ctx === c && d.isConnected) {
        d.querySelector('[data-loading]')?.remove();
        const text = document.createElement('p'); text.setAttribute('role','alert');text.textContent = error(c,ex);d.append(text);
        const close = document.createElement('button');close.textContent='Kapat';close.onclick=()=>d.close();d.append(close);
      }
    }
  }
  async function jobs(c,item) {
    const d = dialog('Gönderim durumu'), body = document.createElement('div'); d.append(body);
    const names = {scheduled:'Planlandı',running:'Gönderiliyor',completed:'Tamamlandı',cancelled:'İptal edildi'};
    async function refresh() {
      body.textContent = 'Yükleniyor…';
      try {
        const data = await c.rpc('content_admin_announcement_jobs_v1',{p_id:item.id});
        if (ctx !== c || !d.isConnected) return;
        body.innerHTML = (data.items || []).map((j,n)=>`<article style="padding:14px 0;border-bottom:1px solid #46434a"><strong>${j.audience==='test'?'Test hesapları':'Tüm uygun hesaplar'} · ${c.esc(names[j.status]||j.status)}</strong><p>Teslim: ${Number(j.delivered)||0} · Atlanan: ${Number(j.skipped)||0} · Hata denemesi: ${Number(j.attempts)||0}</p><small>${c.esc(j.release_id)}</small>${j.last_error?'<p role="alert">Gönderim tekrar denenecek. Sorun sürerse teknik kontrol gerekli.</p>':''}${['scheduled','running'].includes(j.status)?`<p><button data-cancel-job="${n}">Kalan gönderimi iptal et</button></p>`:''}</article>`).join('') || '<p>Bu içerik için henüz gönderim yok.</p>';
        body.querySelectorAll('[data-cancel-job]').forEach(b=>b.onclick=()=>{
          const j=data.items[+b.dataset.cancelJob];
          command(c,'Kalan gönderimi iptal et','Teslim edilmiş mesajlar silinmez. Henüz gönderilmeyenler durdurulur.',async reason=>{
            await c.rpc('content_admin_announcement_cancel_v1',{p_job:j.id,p_reason:reason});d.close();void jobs(c,item);
          });
        });
      } catch(ex) { if(ctx===c)body.textContent=error(c,ex); }
    }
    const footer = document.createElement('footer');
    const reload = document.createElement('button');reload.textContent='Yenile';reload.onclick=()=>void refresh();
    const close = document.createElement('button');close.textContent='Kapat';close.onclick=()=>d.close();footer.append(reload,close);d.append(footer);
    await refresh();
  }
  function publish(c,item){
    const request=crypto.randomUUID();
    command(c,'İçeriği yayınla',`${item.draft.title} tarih aralığında yayınlanacak. Bu işlem DM göndermez ve ödül dağıtmaz.`,reason=>c.rpc('content_admin_publish_v1',{p_id:item.id,p_revision:item.revision,p_request:request,p_reason:reason}));
  }
  function changeState(c,item,state,release=item.release_id){
    command(c,state==='paused'?'İçeriği duraklat':'Yayını etkinleştir',item.draft.title,reason=>c.rpc('content_admin_state_v1',{p_id:item.id,p_revision:item.revision,p_state:state,p_release:release,p_reason:reason}));
  }
  function rollback(c,item){
    const index=item.releases?.findIndex(r=>r.id===item.release_id) ?? -1;
    const previous=index>=0 ? item.releases[index+1] : null;
    if(previous)changeState(c,item,'published',previous.id);
  }
})();
