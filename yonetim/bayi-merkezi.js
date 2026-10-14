/* Single dealer entry point. Existing RPCs, financial journal, MFA and permissions remain authoritative. */
(() => {
  'use strict';
  const phase = window.PuffyPhase1;
  const previous = {open: phase.open, close: phase.close, route: phase.route};
  let ctx = null;
  let epoch = 0;
  let observer = null;
  let desiredTab = null;
  let pendingPage = 0;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const money = x => Number(x || 0).toLocaleString('tr-TR');
  const kinds = {liste:'Bayiler',atama:'Yeni bayi / bayilik durumu',yukleme:'Bekleyen yüklemeler',ayar:'Kur ve bonuslar'};
  const fields = [
    ['usd_to_coin_rate','Mağaza kuru · 1 USD kaç coin'],
    ['usd_to_try_rate','Dolar kuru · 1 USD kaç TRY'],
    ['dealer_wholesale_coin_per_usd','Bayi toptan kuru · 0 ise mağaza kuru'],
    ['bayiye_aktarim_bonus_oran','Kazancı bayiye aktarım bonus oranı']
  ];
  async function rpc(name, params = {}) {
    const response = await ctx.sb.rpc(name, params);
    if (response.error) throw response.error;
    return response.data;
  }
  function stop() {
    epoch++;
    observer?.disconnect();
    observer = null;
    desiredTab = null;
    ctx = null;
    pendingPage = 0;
  }
  function toolbar(root, active = 'liste') {
    if (root.querySelector('[data-dealer-hub]')) return;
    const nav = document.createElement('div');
    nav.dataset.dealerHub = '';
    nav.setAttribute('role','navigation');
    nav.className = 'dealer-hub-nav';
    nav.setAttribute('aria-label', 'Bayi merkezi');
    nav.innerHTML = Object.entries(kinds).filter(([key]) => !['yukleme','ayar'].includes(key) || ctx?.caps.owner)
      .map(([key,label]) => `<a href="${key==='liste'?'#bayiler':'#bayi-merkezi/'+key}" ${key===active?'aria-current="page"':''}>${label}</a>`).join('');
    root.prepend(nav);
  }
  function decorate() {
    const root = document.querySelector('#s-bayiler');
    if (!ctx || !root) return;
    document.querySelectorAll('#uyg nav a[href="#onay/bayi_yukleme"]').forEach(link=>{link.href='#bayi-merkezi/yukleme';});
    const settings=document.querySelector('#s-ayarlar');
    if(settings&&ctx.caps.owner){
      settings.querySelectorAll('[data-key="dealer_wholesale_coin_per_usd"],[data-key="bayiye_aktarim_bonus_oran"],form[data-bayi]').forEach(form=>{form.hidden=true;});
      const tiers=settings.querySelector('form[data-bayi]')?.closest('section');
      if(tiers&&!tiers.querySelector('[data-bayi-link]')){const a=document.createElement('a');a.dataset.bayiLink='';a.href='#bayi-merkezi/ayar';a.textContent='Kur ve bayi bonuslarını Bayi merkezinden yönet →';tiers.append(a);}
    }
    if (root.classList.contains('hidden')) return;
    const hash = location.hash.slice(1);
    if (!/^bayiler(?:\/|$)/.test(hash)) return;
    toolbar(root);
    const profileLink = root.querySelector('.bayi-overview a[href^="#kullanici/"]');
    if (profileLink && !root.querySelector('[data-dealer-status]') && ctx.caps.actions?.account_manage) {
      const button = document.createElement('button');
      button.dataset.dealerStatus = '';
      button.textContent = 'Bayilik durumunu değiştir';
      button.onclick = () => showStatus(profileLink.hash.split('/')[1], root);
      profileLink.after(button);
    }
    const note = root.querySelector('[data-body] > .note');
    if (note?.textContent.includes('Yeni bayi atamak') && !note.querySelector('a[href="#bayi-merkezi/atama"]')) {
      const link = document.createElement('a');
      link.href = '#bayi-merkezi/atama';
      link.textContent = 'Yeni bayi atamak için buraya tıkla →';
      note.replaceChildren(link);
    }
    const settingsLink = root.querySelector('.page-title a[href="#ayarlar"]');
    if (settingsLink) settingsLink.href = '#bayi-merkezi/ayar';
    const stockDetails=root.querySelector('form[data-stock]')?.closest('details');
    if(stockDetails&&!root.querySelector('[data-stock-open]')){const open=document.createElement('button');open.dataset.stockOpen='';open.className='primary';open.textContent='Stok yükle / geri çek';open.onclick=()=>{stockDetails.open=true;stockDetails.scrollIntoView({behavior:'smooth',block:'center'});stockDetails.querySelector('input[name=amount]')?.focus();};root.querySelector('.bayi-overview')?.append(open);}
    if (desiredTab && root.querySelector(`[data-tab="${desiredTab}"]`)) {
      const tab = desiredTab;
      desiredTab = null;
      root.querySelector(`[data-tab="${tab}"]`).click();
    }
  }
  phase.open = function(c) {
    previous.open.call(this,c);
    stop();
    if (!c.caps?.admin) return;
    ctx = {...c, esc, errorText:e=>String(e?.message||e), toast:message=>{const root=document.querySelector('#s-bayiler');if(!root)return;let out=root.querySelector('[data-hub-toast]');if(!out){out=document.createElement('p');out.dataset.hubToast='';out.setAttribute('role','status');root.append(out);}out.textContent=message;}};
    observer = new MutationObserver(decorate);
    observer.observe(document.querySelector('.workspace'), {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    decorate();
  };
  phase.close = function() { stop(); return previous.close.call(this); };
  phase.route = function(hash) {
    epoch++;
    if(hash==='onay/bayi_yukleme'&&ctx?.caps.owner){location.hash='bayi-merkezi/yukleme';return true;}
    const match = /^bayi-merkezi\/(atama|yukleme|ayar)(?:\?.*)?$/.exec(hash);
    if (!match) return previous.route.call(this,hash);
    if (!ctx?.caps.admin || (['yukleme','ayar'].includes(match[1]) && !ctx.caps.owner)) {
      location.hash = 'bayiler';
      return true;
    }
    render(match[1]);
    return true;
  };
  async function showStatus(id, root) {
    const c = ctx, token = epoch, hash = location.hash;
    try {
      const d = await rpc('admin_kullanici_detay',{p_user:id});
      if (ctx!==c || epoch!==token || location.hash!==hash) return;
      const result = await window.PuffyPhase3.action('dealer', {
        ...c, profile:d.profile, rpc:(name,params)=>{if(ctx!==c)throw new Error('STALE_SESSION');return rpc(name,params);},
        refresh:async()=>{ if(ctx===c&&location.hash===hash) phase.route(hash.slice(1)); }
      });
      return result;
    } catch(e) { if(ctx===c) c.toast(c.errorText(e)); }
  }
  async function render(view) {
    const c = ctx, token = ++epoch, hash = location.hash;
    const root = document.querySelector('#s-bayiler');
    const valid = () => ctx===c && epoch===token && location.hash===hash;
    document.querySelectorAll('.workspace > [id^="s-"]').forEach(el=>el.classList.toggle('hidden',el!==root));
    document.querySelector('#route-name').textContent='Bayi merkezi';
    document.querySelector('#uyg nav').classList.remove('open');
    root.innerHTML=`<div class="page-title"><div><div class="eyebrow">BAYİ MERKEZİ</div><h1>${kinds[view]}</h1><p>Bayilik, stok, satış ve ayarlar aynı çalışma alanında.</p></div></div><section class="panel" data-hub-body role="status">Yükleniyor…</section>`;
    toolbar(root,view);
    const body = root.querySelector('[data-hub-body]');
    try {
      if (view==='atama') {
        if (!c.caps.actions?.account_manage) {body.textContent='Bayilik atama yetkin yok.';return;}
        body.innerHTML='<form data-search class="filters"><label>Kullanıcı adı veya ID<input name="query" required maxlength="100"></label><button>Ara</button></form><div data-results></div><p class="note">Bayilik değişikliği mevcut hesap yönetimi onayıyla yapılır; işlem kütüğü ve sunucu kontrolleri korunur.</p>';
        let searchEpoch = 0;
        body.querySelector('form').onsubmit=async e=>{
          e.preventDefault();const search=++searchEpoch,button=e.target.querySelector('button'),out=body.querySelector('[data-results]');button.disabled=true;
          try {
            const d=await rpc('admin_kullanici_listesi',{p_arama:new FormData(e.target).get('query').trim(),p_filtre:{},p_limit:25,p_offset:0});
            if(!valid()||search!==searchEpoch)return;
            out.innerHTML=(d.rows||[]).map(p=>`<div class="dealer-hub-person"><span><b>${esc(p.nickname)}</b> · ID ${esc(p.display_id)}${p.vanity_id?' · '+esc(p.vanity_id):''}</span><button data-status="${esc(p.id)}">Bayilik durumunu aç</button></div>`).join('')||'Kullanıcı bulunamadı.';
            out.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>showStatus(b.dataset.status,root));
            if(d.total>25)out.insertAdjacentHTML('beforeend','<p class="note">İlk 25 sonuç gösteriliyor. Tam ID ile aramayı daralt.</p>');
          }catch(e){if(valid())out.textContent=c.errorText(e);}finally{if(valid())button.disabled=false;}
        };
      } else if (view==='yukleme') {
        const d=await rpc('yonetim_onay_kuyrugu_v2',{p_tur:'bayi_yukleme',p_limit:25,p_offset:pendingPage*25});
        if(!valid())return;
        const rows=Array.isArray(d)?d:(d.rows||d.requests||d.items||[]);
        body.innerHTML='<p class="note">İncele, seçili bayinin Yükleme talepleri sekmesini açar. Güncel kur, tahsilat kontrolü ve onay mevcut güvenli formda yapılır.</p>'+rows.map(x=>{
          const id=x.dealer?.id||x.user_id;
          return `<div class="dealer-hub-person"><span><b>${esc(x.dealer?.nickname||x.nickname||'Bayi')}</b> · ${money(x.amount_try)} TRY</span>${id?`<button data-topup-dealer="${esc(id)}">İncele →</button>`:'<span>Bayi kimliği yüklenemedi</span>'}</div>`;
        }).join('')+(rows.length?'':'<p>Bekleyen yükleme yok.</p>')+`<div class="pager"><button data-prev ${pendingPage===0?'disabled':''}>Önceki</button><span>Sayfa ${pendingPage+1}</span><button data-next ${(d.total??rows.length+pendingPage*25)<=(pendingPage+1)*25?'disabled':''}>Sonraki</button></div>`;
        body.querySelectorAll('[data-topup-dealer]').forEach(b=>b.onclick=()=>{desiredTab='yukleme';location.hash='bayiler/'+b.dataset.topupDealer;});
        body.querySelector('[data-prev]').onclick=()=>{pendingPage--;render(view);};
        body.querySelector('[data-next]').onclick=()=>{pendingPage++;render(view);};
      } else {
        const d=await rpc('yonetim_ayarlar_getir');if(!valid())return;
        body.innerHTML='<p class="note">Mağaza ve dolar kuru ortak ekonomi ayarlarıdır. Bayi toptan kuru ve bonuslar burada birlikte yönetilir. Her kayıt gerekçe ve güncel sürüm kontrolü ister.</p>'+fields.map(([key,label])=>`<form class="dealer-hub-setting" data-key="${key}"><label>${label}<input name="value" type="number" min="0" step="any" required value="${esc(d.platform?.[key]?.value??'')}"></label><label>Gerekçe<input name="reason" required minlength="3" maxlength="300"></label><button>Kaydet</button><p data-result role="status"></p></form>`).join('')+'<h2>Bayi bonus kademeleri</h2><form data-tiers><div data-tier-rows></div><button type="button" data-add>Kademe ekle</button><label>Gerekçe<input name="reason" minlength="3" required maxlength="300"></label><button>Kademeleri kaydet</button><p data-result role="status"></p></form>';
        const save=async(form,tur,veri)=>{
          if(!valid())return;
          const button=form.querySelector('button[type=submit]')||form.querySelector('button:not([type=button])');button.disabled=true;
          try {
            const reason=new FormData(form).get('reason').trim();
            const out=await rpc('yonetim_ayar_kaydet_v2',{p_tur:tur,p_veri:veri,p_neden:reason,p_expected:window.PuffyGuvenilirlik.settingSnapshot(d,tur,veri)});
            if(out?.ok===false)throw new Error(out.error||'İşlem reddedildi');
            if(valid()){c.toast('Kaydedildi.');render(view);}
          }catch(e){if(valid())form.querySelector('[data-result]').textContent=c.errorText(e);}finally{if(valid())button.disabled=false;}
        };
        body.querySelectorAll('[data-key]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const value=Number(form.elements.value.value);if(!Number.isFinite(value))return;save(form,'platform',{key:form.dataset.key,value});});
        const tiers=body.querySelector('[data-tiers]');
        const add=(min=0,percent=0)=>{const holder=tiers.querySelector('[data-tier-rows]');if(holder.children.length>=8)return;holder.insertAdjacentHTML('beforeend',`<div class="dealer-tier"><label>Eşik · USD<input type="number" min="0" step="1" data-min required value="${esc(min)}"></label><label>Bonus %<input type="number" min="0" max="100" step="0.5" data-percent required value="${esc(percent)}"></label><button type="button" data-remove>Sil</button></div>`);holder.lastElementChild.querySelector('[data-remove]').onclick=e=>{if(holder.children.length>1)e.target.parentElement.remove();};};
        (d.bayi_kademeleri?.length?d.bayi_kademeleri:[{min_usd:0,yuzde:0}]).forEach(r=>add(r.min_usd,r.yuzde));
        tiers.querySelector('[data-add]').onclick=()=>add();
        tiers.onsubmit=e=>{e.preventDefault();const rows=[...tiers.querySelectorAll('.dealer-tier')].map(row=>({min_usd:Number(row.querySelector('[data-min]').value),yuzde:Number(row.querySelector('[data-percent]').value)})).sort((a,b)=>a.min_usd-b.min_usd);if(new Set(rows.map(r=>r.min_usd)).size!==rows.length){tiers.querySelector('[data-result]').textContent='Aynı eşik iki kez girilemez.';return;}save(tiers,'bayi_kademe',rows);};
      }
    }catch(e){if(valid())body.textContent=c.errorText(e);}
  }
})();
