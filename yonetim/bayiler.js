/* Dealer workspace. All authorization and accounting remain server-side. */
(()=>{'use strict';
 const phase=window.PuffyPhase1,open=phase.open,close=phase.close,route=phase.route;
 let ctx=null,epoch=0,query='',page=0,tab='satis',journal=null;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=x=>Number(x||0).toLocaleString('tr-TR');
 const usd=x=>Number(x||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:6});
 const fx=x=>Number(x||0).toLocaleString('tr-TR',{minimumFractionDigits:4,maximumFractionDigits:4});
 const date=x=>x?new Date(x).toLocaleString('tr-TR'):'—';
 const labels={pending:'Bekliyor',accepted:'Satıldı',approved:'Onaylandı',rejected:'Reddedildi',cancelled:'İptal',expired:'Süresi doldu',appointed:'Bayi atandı',revoked:'Bayilik kaldırıldı',gonder:'Stok yükleme',geri_cek:'Stok geri çekme'};
 const error=e=>({QUOTE_CHANGED:'Kur veya bonus değişti. Yeniden teklif al.',KUR_ESKI:'Kur güncel değil. Kur ayarını yenileyin.',REQUEST_ID_REQUIRED:'İşlem kimliği gerekli.',PENDING_REQUEST_CONFLICT:'Bu bayi için sonucu belirsiz bir işlem var. Önce ödeme takibinden kontrol edin.',PENDING_REQUEST_RECONCILIATION_REQUIRED:'Önce ödeme takibindeki eski isteği kontrol edin.',DEALER_HAS_PENDING:'Bekleyen işlemler sonuçlanmadan bayilik kaldırılamaz.',USER_BANNED:'Banlı bayi için stok işlemi yapılamaz.',NOT_AUTHORIZED:'Bu işlem için yetkiniz yok.'}[e?.message]||String(e?.message||e));
 async function rpc(c,name,params){const r=await c.sb.rpc(name,params);if(r.error)throw r.error;return r.data;}

 function autoQuote(form,fetch,alive=()=>true){
  let serial=0,timer=null,current=null;
  const coin=form.elements.coin,amount=form.elements.amount,currency=form.elements.currency,
   mode=form.elements.mode,direction=form.elements.direction,msg=form.querySelector('[data-stock-result]'),save=form.querySelector('[type=submit]');
  const automatic=()=>mode.value==='wholesale'&&direction.value==='gonder';
  const signature=()=>amount.value+'|'+currency.value;
  async function load(){const version=++serial,key=signature();current=null;coin.readOnly=automatic();
   if(!automatic()){save.disabled=false;msg.textContent='Gerekçeli manuel düzeltme: coin ve tutarı kontrol edin.';return;}
   coin.value='';save.disabled=true;
   const value=Number(amount.value);if(!Number.isFinite(value)||value<=0){msg.textContent='Tutarı girin; USD karşılığı ve bonus otomatik hesaplanır.';return;}
   msg.textContent='Güncel TCMB kuru ve bonus hesaplanıyor…';
   try{const q=await fetch(value,currency.value);if(!alive()||version!==serial||key!==signature()||!automatic())return;
    if(!q||!Number.isSafeInteger(q.toplam_coin)||q.toplam_coin<=0||!(q.try_kur>0))throw new Error('Geçerli güncel teklif alınamadı.');
    coin.value=q.toplam_coin;current={key,q};save.disabled=q.toplam_coin>500000000;
    msg.textContent=usd(q.tutar_usd_hesap??q.tutar_usd)+' USD karşılığı · TCMB satış '+fx(q.try_kur)+' TL/USD ('+q.try_kur_tarih+') · Toptan '+num(q.toptan_kur)+' coin/USD · Taban '+num(q.taban_coin)+' + %'+num(q.bonus_yuzde)+' bonus '+num(q.bonus_coin)+' = '+num(q.toplam_coin)+' coin'+(save.disabled?' · Tek işlem limiti aşılıyor.':'');
   }catch(e){if(alive()&&version===serial){coin.value='';save.disabled=true;msg.textContent=error(e);}}
  }
  function changed(){clearTimeout(timer);serial++;current=null;if(automatic()){coin.value='';save.disabled=true;}timer=setTimeout(load,300);}
  amount.addEventListener('input',changed);currency.addEventListener('change',changed);
  mode.addEventListener('change',changed);direction.addEventListener('change',changed);
  form.querySelector('[data-quote]').onclick=load;coin.readOnly=true;save.disabled=true;
  return {load,ready:()=>!automatic()||!!current&&current.key===signature()&&Number(coin.value)===current.q.toplam_coin,
   freeze:()=>{clearTimeout(timer);serial++;},snapshot:()=>current?.q};
 }
 window.PuffyDealerAutoQuote=autoQuote;

 function stop(){epoch++;ctx=null;journal=null;query='';page=0;document.querySelector('#bayiler-nav')?.remove();document.querySelector('#s-bayiler')?.remove();}
 phase.open=function(c){open.call(this,c);stop();if(!c.caps?.admin)return;ctx=c;journal=new window.PuffyFinans.Journal(sessionStorage,c.user.id);
 const nav=document.createElement('div');nav.id='bayiler-nav';nav.innerHTML='<div class="nav-caption">Bayi yönetimi</div><a class="menu" href="#bayiler">Bayiler</a>';const host=document.querySelector('#uyg nav');host.insertBefore(nav,host.querySelector('.alt'));
 const root=document.createElement('section');root.id='s-bayiler';root.className='hidden';document.querySelector('.workspace').append(root);};
 phase.close=function(){stop();return close.call(this);};
 phase.route=function(value){if(!/^bayiler(?:\/|$|\?)/.test(value))return route.call(this,value);if(!ctx?.caps.admin){location.hash='ozet';return true;}page=0;tab='satis';render();return true;};
 async function render(){const c=ctx,n=++epoch,hash=location.hash,root=document.querySelector('#s-bayiler');if(!c||!root)return;
 const valid=()=>ctx===c&&n===epoch&&location.hash===hash;
 document.querySelectorAll('.workspace > [id^="s-"]').forEach(x=>x.classList.toggle('hidden',x!==root));document.querySelector('#route-name').textContent='Bayiler';document.querySelector('#uyg nav').classList.remove('open');
 const id=hash.slice(1).split('/')[1];
 root.innerHTML='<div class="page-title"><div><div class="eyebrow">BAYİ YÖNETİMİ</div><h1>'+ (id?'Bayi detayı':'Bayiler')+'</h1><p>Stok, satışlar ve yükleme talepleri tek yerde.</p></div><a href="'+(id?'#bayiler':'#ayarlar')+'">'+(id?'← Bayi listesi':'Kur ve bonus ayarları →')+'</a></div><section class="panel" data-body role="status">Yükleniyor…</section>';
 try{if(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Geçersiz bayi ID’si.');const d=await rpc(c,'yonetim_bayi_detay',{p_bayi:id,p_bolum:tab,p_limit:25,p_offset:page*25});if(!valid())return;detail(d);}else{const d=await rpc(c,'yonetim_bayiler',{p_arama:query,p_limit:25,p_offset:page*25});if(!valid())return;list(d);}}catch(e){if(valid())root.querySelector('[data-body]').textContent=error(e);}
 function pager(d){return '<div class="pager"><span>'+num(d.total)+' kayıt</span><button data-prev '+(!page?'disabled':'')+'>Önceki</button><button data-next '+((page+1)*25>=d.total?'disabled':'')+'>Sonraki</button></div>';}
 function bindPager(){root.querySelector('[data-prev]').onclick=()=>{page--;render();};root.querySelector('[data-next]').onclick=()=>{page++;render();};}
 function table(head,rows){return rows.length?'<div class="table-wrap"><table class="data-table responsive"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>{let i=0;return row.replace(/<td>/g,()=>'<td data-label="'+esc(head[i++])+'">');}).join('')+'</tbody></table></div>':'<p class="empty-state">Bu bölümde kayıt yok.</p>';}
 function list(d){root.querySelector('[data-body]').innerHTML='<form data-search class="filters"><label>İsim veya ID<input name="query" maxlength="100" value="'+esc(query)+'" placeholder="Bayi adı, özel ID veya kullanıcı ID"></label><button>Ara</button><button type="button" data-clear>Temizle</button></form>'+table(['Bayi','Kullanılabilir stok','Ayrılan stok','Bekleyen yükleme'],d.rows.map(x=>'<tr><td><a href="#bayiler/'+esc(x.id)+'">'+esc(x.nickname||'İsimsiz bayi')+'</a><small>ID '+esc(x.display_id)+(x.vanity_id?' · '+esc(x.vanity_id):'')+'</small></td><td>'+num(x.balance)+' coin</td><td>'+num(x.reserved)+' coin</td><td>'+num(x.pending_topups)+'</td></tr>'))+pager(d)+'<p class="note">Yeni bayi atamak için kullanıcı detayındaki Bayi durumu bölümünü açın.</p>';bindPager();root.querySelector('[data-search]').onsubmit=e=>{e.preventDefault();query=new FormData(e.target).get('query').trim();page=0;render();};root.querySelector('[data-clear]').onclick=()=>{query='';page=0;render();};}
 function detail(d){const p=d.profile;root.querySelector('[data-body]').innerHTML='<div class="bayi-overview"><div><h2>'+esc(p.nickname||'İsimsiz bayi')+'</h2><a href="#kullanici/'+esc(p.user_id)+'">Kullanıcı profili · ID '+esc(p.display_id)+'</a><p>'+ (p.is_dealer?'Aktif bayi':'Bayilik sona ermiş')+'</p></div><div><small>Kullanılabilir stok</small><strong>'+num(d.balance)+' <small>coin</small></strong></div></div><div class="bayi-tabs" role="navigation" aria-label="Bayi bölümleri">'+Object.entries({satis:'Satışlar',yukleme:'Yükleme talepleri',stok:'Stok hareketleri',gecmis:'Bayilik geçmişi'}).map(([k,v])=>'<button data-tab="'+k+'" aria-pressed="'+(tab===k)+'">'+v+'</button>').join('')+'</div><div data-history></div>'+pager(d)+(c.caps.owner?'<details class="bayi-action"><summary>Güvenli stok işlemi</summary><p>Ödeme şifresi ve son 15 dakika içinde MFA doğrulaması gerekir. Sonucu belirsiz işlem aynı istek kimliğiyle tekrar denenir.</p><form data-stock class="filters"><label>İşlem türü<select name="mode"><option value="wholesale">Toptan alım</option><option value="adjustment">Gerekçeli manuel düzeltme</option></select></label><label>İşlem<select name="direction"><option value="gonder">Stok yükle</option><option value="geri_cek">Stok geri çek</option></select></label><label>Coin<input name="coin" type="number" min="1" max="500000000" step="1" required></label><label>Tutar<input name="amount" type="number" min="0" step="0.01" required></label><label>Para birimi<select name="currency"><option value="TRY">TL (TRY)</option><option value="USD">USD</option></select></label><label>İşlem nedeni<input name="reason" minlength="3" maxlength="300" required></label><label>Tahsilat / düzeltme referansı<input name="reference" minlength="6" maxlength="160" required></label><label><input name="confirmed" type="checkbox" required> Ödemeyi veya düzeltme belgesini kontrol ettim</label><label>Ödeme şifresi<input name="password" type="password" autocomplete="off" required></label><button type="button" data-quote>Hesabı yenile</button><button type="submit">İşlemi kaydet</button><p data-stock-result role="status"></p></form></details>':'');bindPager();root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;page=0;render();});
 if(c.caps.owner)window.PuffyDealerCredit.mount({root:root.querySelector('[data-body]'),c,dealer:id,alive:valid,journal,onChanged:render});
 const heads=tab==='satis'?['Alıcı','Coin / tutar','Durum','Tarih']:tab==='yukleme'?['Tutar','Coin','Durum','Dekont','İşlem']:tab==='stok'?['İşlem','Coin','Stok sonrası','Neden']:['İşlem','Neden','Yönetici','Tarih'];
 const rows=d.rows.map(x=>{let cells;if(tab==='satis')cells=['<a href="#kullanici/'+esc(x.buyer_id)+'">'+esc(x.buyer_name||'Kullanıcı')+'</a>',num(x.amount_coin)+' / '+num(x.price_try)+' TRY',esc(labels[x.status]||x.status)+(x.status==='pending'&&new Date(x.expires_at)<new Date()?' · İade bekliyor':''),esc(date(x.created_at))];else if(tab==='yukleme')cells=[num(x.amount_try)+' TRY',num(x.amount_coins),esc(labels[x.status]||x.status),x.receipt_path&&c.caps.owner?'<button data-receipt="'+esc(x.id)+'">Dekontu aç</button>':'Dekont yok',x.status==='pending'&&c.caps.owner?'<button data-topup="'+esc(x.id)+'">İncele</button>':esc(date(x.created_at))];else if(tab==='stok')cells=[esc(labels[x.yon]||x.yon),num(x.miktar),num(x.sonraki_bakiye),esc(x.neden)];else cells=[esc(labels[x.action]||x.action),esc(x.reason||'—'),'<a href="#kullanici/'+esc(x.admin_id)+'">Yönetici profili</a>',esc(date(x.created_at))];return '<tr>'+cells.map(v=>'<td>'+v+'</td>').join('')+'</tr>';});root.querySelector('[data-history]').innerHTML=table(heads,rows);
 root.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=async()=>{
  b.disabled=true;const info=document.createElement('p');b.after(info);info.setAttribute('role','status');
  try{const proof=await rpc(c,'yonetim_bayi_dekont_yolu',{p_request_id:b.dataset.receipt});if(!valid())return;
   if(!proof?.path||proof.bucket!=='dealer-topup-receipts')throw new Error('Dekont bulunamadı.');
   const signed=await c.sb.storage.from(proof.bucket).createSignedUrl(proof.path,300);if(signed.error)throw signed.error;if(!valid())return;
   const link=document.createElement('a');link.href=signed.data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Dekontu görüntüle (5 dakika geçerli)';info.replaceChildren(link);
  }catch(e){if(valid())info.textContent=error(e);}finally{if(valid())b.disabled=false;}
 });
 root.querySelectorAll('[data-topup]').forEach(b=>b.onclick=()=>topup(d.rows.find(x=>x.id===b.dataset.topup),b));
 const stock=root.querySelector('[data-stock]');
 if(stock){
  const pendingStock=journal.list().find(x=>!x.expired&&x.name==='bayi_stok_islemi_v2'&&x.target===id);
  let quoteControl;
  if(pendingStock){
   const mapping={mode:'p_mode',direction:'p_yon',coin:'p_coin',amount:'p_tutar',currency:'p_para_birimi',reason:'p_not',reference:'p_reference'};
   for(const [field,key]of Object.entries(mapping)){stock.elements[field].value=pendingStock.params[key]??'';stock.elements[field].disabled=true;}
   stock.querySelector('[data-quote]').disabled=true;
   stock.querySelector('[data-stock-result]').textContent='Önceki talebin sonucu belirsiz. Aynı tutar, coin ve istek kimliği korunarak tekrar gönderilecek.';
  }else{quoteControl=autoQuote(stock,(amount,currency)=>rpc(c,'platform_bayi_teklif_hesapla',{p_tutar:amount,p_para_birimi:currency}),valid);quoteControl.load();}
  rpc(c,'platform_bayi_fiyat_ozeti',{}).then(q=>{if(!valid()||!q)return;const note=document.createElement('p');note.className='note';note.textContent='USD bonus baremleri: '+q.kademeler.map(t=>num(t.min_usd)+' USD ve üzeri %'+num(t.yuzde)).join(' · ')+' · Kur: TCMB satış, '+q.try_kur_tarih;stock.before(note);}).catch(()=>{});
  stock.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,b=f.querySelector('[type=submit]'),msg=f.querySelector('[data-stock-result]');if(b.disabled)return;const data=new FormData(f);if(pendingStock){for(const [field,key]of Object.entries({mode:'p_mode',direction:'p_yon',coin:'p_coin',amount:'p_tutar',currency:'p_para_birimi',reason:'p_not',reference:'p_reference'}))data.set(field,pendingStock.params[key]??'');}let params;try{if(quoteControl&&!quoteControl.ready())throw new Error('Güncel USD ve bonus hesabını bekleyin.');if(!data.get('confirmed'))throw new Error('Ödemeyi veya belgeyi kontrol ettiğini onayla.');params=journal.prepare('bayi_stok_islemi_v2',{p_bayi:id,p_yon:data.get('direction'),p_coin:Number(data.get('coin')),p_tutar:Number(data.get('amount')),p_para_birimi:data.get('currency'),p_not:data.get('reason').trim(),p_odeme_sifresi:data.get('password'),p_reference:data.get('reference').trim(),p_mode:data.get('mode')});}catch(e){msg.textContent=error(e);return;}quoteControl?.freeze();b.disabled=true;f.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);f.elements.password.value='';try{const r=await rpc(c,'bayi_stok_islemi_v2',params);if(!valid())return;if(r?.ok!==true)throw new Error(r?.error||'İşlem tamamlanamadı.');journal.done(params.p_request_id);render();}catch(e){if(valid()){msg.textContent=error(e)+' Sonucu belirsizse aynı alanlarla tekrar dene; yeni tahsilat oluşturma.';if(e?.message==='QUOTE_CHANGED'){journal.done(params.p_request_id);quoteControl?.load();}b.disabled=false;}}finally{params.p_odeme_sifresi='';if(valid()){f.querySelectorAll('input,select,button').forEach(x=>x.disabled=false);if(pendingStock){for(const field of ['mode','direction','coin','amount','currency','reason','reference'])f.elements[field].disabled=true;f.querySelector('[data-quote]').disabled=true;}else if(quoteControl&&!quoteControl.ready())b.disabled=true;}}});
 }
 }

 async function topup(x,b){b.disabled=true;const box=document.createElement('div');box.className='bayi-review';b.closest('td').append(box);box.textContent='Güncel teklif hesaplanıyor…';let quote;
 try{quote=await rpc(c,'platform_bayi_teklif_hesapla',{p_tutar:x.amount_try,p_para_birimi:'TRY'});if(!valid())return;}catch(e){if(valid())box.textContent=error(e);}
 if(!valid())return;box.innerHTML='<p>'+ (quote?usd(quote.tutar_usd_hesap??quote.tutar_usd)+' USD · TCMB satış '+fx(quote.try_kur)+' TL/USD ('+esc(quote.try_kur_tarih)+') · Taban '+num(quote.taban_coin)+' + %'+num(quote.bonus_yuzde)+' bonus '+num(quote.bonus_coin)+' = '+num(quote.toplam_coin)+' coin':'Kur hesaplanamadı. Onay kapalı.')+'</p><label>Karar nedeni<input maxlength="300" minlength="3" data-reason required></label><label>Tahsilat referansı<input data-reference minlength="6" maxlength="160"></label><label><input data-confirmed type="checkbox"> Gerçek havaleyi kontrol ettim</label><button data-approve '+(!quote?'disabled':'')+'>Onayla</button><button data-reject>Reddet</button><p role="status" data-result></p>';
 for(const approve of [true,false])box.querySelector(approve?'[data-approve]':'[data-reject]').onclick=async()=>{const reason=box.querySelector('[data-reason]').value.trim(),msg=box.querySelector('[data-result]');if(reason.length<3){msg.textContent='En az 3 karakter karar nedeni girin.';return;}box.querySelectorAll('button').forEach(x=>x.disabled=true);try{if(approve){const ref=box.querySelector('[data-reference]').value.trim();if(ref.length<6||!box.querySelector('[data-confirmed]').checked)throw new Error('Tahsilat referansı ve ödeme kontrolü gerekli.');await rpc(c,'bayi_yukleme_onay_v2',{p_request_id:x.id,p_amount_coins:quote.toplam_coin,p_reference:ref,p_reason:reason});}else await rpc(c,'yonetim_onay_karari',{p_tur:'bayi_yukleme',p_id:x.id,p_onay:false,p_neden:reason,p_coin:null,p_kod:null});if(valid())render();}catch(e){if(valid()){msg.textContent=error(e);box.querySelector('[data-reject]').disabled=false;box.querySelector('[data-approve]').disabled=!quote;}}};
 }
 }
})();
/* Owner-only trade receivable workspace. No automatic stock/payment writes. */
(() => {
  'use strict';
  const name = 'yonetim_bayi_cari_islem';
  const labels = {limit:'Açık hesap limiti',stok:'Borç karşılığı stok ver',tahsilat:'Gerçek tahsilat kaydet'};
  const errors = {
    CREDIT_LIMIT_EXCEEDED:'Açık hesap limiti yetersiz. Önce yetkili limitini düzenleyin.',
    LIMIT_BELOW_DEBT:'Limit, kalan borcun altına indirilemez.',
    PAYMENT_EXCEEDS_DEBT:'Tahsilat kalan borçtan fazla olamaz.',
    REFERENCE_ALREADY_USED:'Bu mutabakat veya tahsilat referansı daha önce kullanıldı.',
    COLLECTION_ALREADY_USED:'Bu dekont daha önce bir tahsilata bağlandı.',
    QUOTE_CHANGED:'Kur veya bonus değişti. Sonucu kontrol edip yeni teklif alın.',
    DEALER_CREDIT_DEBT:'Açık hesap borcu kapanmadan bayilik kaldırılamaz.',
    TARGET_ACCESS_DENIED:'Bu bayinin güvenlik durumu yeni stok verilmesine izin vermiyor.',
    AMOUNT_OVER_LIMIT:'Açık hesapta tek işlem en fazla 500 milyon coin olabilir.',
    DAILY_LIMIT:'Açık hesap için 24 saatlik 500 milyon coin sınırına ulaşıldı.',
    REQUEST_CONFLICT:'Aynı istek kimliğinin bilgileri değiştirilemez.',
  };
  const money = value => Number(value || 0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const coins = value => Number(value || 0).toLocaleString('tr-TR');
  const error = e => errors[e?.message] || String(e?.message || e);

  async function mount({root,c,dealer,alive,journal,onChanged}) {
    if (!c.caps.owner) return;
    const box=document.createElement('section');box.className='panel bayi-action';
    box.setAttribute('aria-label','Bayi açık hesabı');root.append(box);
    const valid=()=>alive()&&box.isConnected;
    async function rpc(method,params){const r=await c.sb.rpc(method,params);if(r.error)throw r.error;return r.data;}
    box.innerHTML='<h3>Açık hesap · USD</h3><p data-credit-status role="status">Cari hesap okunuyor…</p>';
    let summary;
    try {summary=await rpc('yonetim_bayi_cari_ozet',{p_bayi:dealer,p_limit:25,p_offset:0});}
    catch(e){if(valid())box.querySelector('[data-credit-status]').textContent=error(e);return;}
    if(!valid())return;
    box.innerHTML='<h3>Açık hesap · USD</h3><p>Peşin tahsilattan ayrıdır. Stok verilince USD borç doğar; satış yapmak borcu kapatmaz. Yalnız gerçek tahsilat borcu düşürür.</p><div data-credit-summary class="bayi-overview"></div><details><summary>Açık hesap işlemi</summary><p>Güvenli sahip oturumu, MFA ve ödeme şifresi gerekir. Limit tanımlamak kendi başına stok yüklemez.</p><form class="filters" data-credit-form><label>İşlem<select name="kind"><option value="stok">Borç karşılığı stok ver</option><option value="limit">Açık hesap limitini değiştir</option><option value="tahsilat">Gerçek tahsilat kaydet</option></select></label><label>Tutar<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required></label><label>Para birimi<select name="currency"><option value="USD">USD</option><option value="TRY">TRY · tahsilat için</option></select></label><label>Verilecek coin<input name="coin" type="number" readonly min="0" step="1" value="0"></label><label data-credit-ref-label>Mutabakat / işlem referansı<input name="reference" minlength="6" maxlength="160" required></label><label>Gerekçe<input name="reason" minlength="3" maxlength="300" required></label><label><input type="checkbox" name="confirmed" required><span data-credit-confirm>Açık hesap borcunu ve mutabakatı kontrol ettim</span></label><label>Ödeme şifresi<input name="password" type="password" autocomplete="off" required></label><button type="button" data-credit-quote>Hesabı yenile</button><button type="submit" disabled>İşlemi kaydet</button><p data-credit-result role="status"></p></form></details><h4>Cari hareketler</h4><div data-credit-history></div><div class="pager"><button type="button" data-credit-prev>Önceki</button><span data-credit-page></span><button type="button" data-credit-next>Sonraki</button></div>';
    const status=box.querySelector('[data-credit-summary]');
    for(const [label,value] of [['Limit',summary.limit_usd],['Kalan borç',summary.borc_usd],['Kullanılabilir limit',summary.kullanilabilir_usd]]){
      const div=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');
      small.textContent=label;strong.textContent=money(value)+' USD';div.append(small,strong);status.append(div);
    }
    let page=0;
    function drawHistory(data){
      const target=box.querySelector('[data-credit-history]');target.replaceChildren();
      if(!data.rows.length)target.textContent='Henüz cari hareket yok.';
      else {
        const table=document.createElement('table'),head=document.createElement('tr');
        for(const text of ['Tarih','İşlem','Tutar','Coin','Kalan borç','Referans']){const th=document.createElement('th');th.textContent=text;head.append(th);}table.append(head);
        for(const row of data.rows){const tr=document.createElement('tr');
          for(const text of [new Date(row.created_at).toLocaleString('tr-TR'),labels[row.tur]||row.tur,money(row.tutar)+' '+row.para_birimi,coins(row.coin),money(row.sonraki_borc_usd)+' USD',row.reference]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);
        }target.append(table);
      }
      box.querySelector('[data-credit-prev]').disabled=page===0;
      box.querySelector('[data-credit-next]').disabled=(page+1)*25>=data.total;
      box.querySelector('[data-credit-page]').textContent=`${data.total} hareket · Sayfa ${page+1}`;
    }
    drawHistory(summary);
    for(const [selector,step] of [['[data-credit-prev]',-1],['[data-credit-next]',1]])box.querySelector(selector).onclick=async()=>{
      const next=page+step;if(next<0)return;box.querySelectorAll('.pager button').forEach(b=>b.disabled=true);
      try{const data=await rpc('yonetim_bayi_cari_ozet',{p_bayi:dealer,p_limit:25,p_offset:next*25});if(valid()){page=next;drawHistory(data);}}
      catch(e){if(valid()){message.textContent=error(e);drawHistory(summary);}}
    };
    const form=box.querySelector('form'),f=form.elements,message=box.querySelector('[data-credit-result]'),submit=form.querySelector('[type=submit]');
    let pending=journal.list().find(x=>!x.expired&&x.name===name&&x.target===dealer);
    const mapping={kind:'p_tur',amount:'p_tutar',currency:'p_para_birimi',coin:'p_beklenen_coin',reference:'p_reference',reason:'p_reason'};
    let serial=0,timer=null,quoteKey=null;
    const signature=()=>f.kind.value+'|'+f.amount.value+'|'+f.currency.value;
    async function quote(){
      const version=++serial;quoteKey=null;submit.disabled=true;
      const kind=f.kind.value;
      f.currency.disabled=kind!=='tahsilat';if(kind!=='tahsilat')f.currency.value='USD';
      f.amount.min=kind==='limit'?'0':'0.01';f.coin.value='0';
      box.querySelector('[data-credit-confirm]').textContent=kind==='tahsilat'?'Gerçek ödemeyi ve dekontu kontrol ettim':kind==='limit'?'Bu bayi için açık hesap limitini onaylıyorum':'USD borç kaydını ve mutabakatı onaylıyorum; peşin ödeme alınmadı';
      const amount=Number(f.amount.value),key=signature();
      if(!f.amount.value||!Number.isFinite(amount)||amount<0||amount>1000000||(kind!=='limit'&&amount===0)){message.textContent='Geçerli tutarı girin.';return;}
      if(kind!=='stok'){
        quoteKey=key;submit.disabled=false;
        message.textContent=kind==='limit'?'Yeni limit: '+money(amount)+' USD. Mevcut borç silinmez.':f.currency.value==='TRY'?'Gerçek TRY tahsilatı, işlem anındaki güncel TCMB satış kuruyla USD borçtan düşer.':'Gerçek USD tahsilatı borçtan düşer; bayi stoku değişmez.';
        return;
      }
      message.textContent='Borç karşılığı verilecek stok hesaplanıyor…';
      try{const q=await rpc('platform_bayi_teklif_hesapla',{p_tutar:amount,p_para_birimi:'USD'});
        if(!valid()||version!==serial||signature()!==key)return;
        if(!Number.isSafeInteger(q.toplam_coin)||q.toplam_coin<=0)throw new Error('Geçerli stok teklifi alınamadı.');
        f.coin.value=String(q.toplam_coin);quoteKey=key;
        submit.disabled=q.toplam_coin>500000000||amount>Number(summary.kullanilabilir_usd);
        message.textContent=money(amount)+' USD borç · '+coins(q.taban_coin)+' taban + %'+coins(q.bonus_yuzde)+' bonus = '+coins(q.toplam_coin)+' coin. Peşin tahsilat: 0 USD.'+(submit.disabled?' Limit yetersiz; önce açık hesap limitini kontrol edin.':'');
      }catch(e){if(valid()&&version===serial){message.textContent=error(e);submit.disabled=true;}}
    }
    function changed(){serial++;quoteKey=null;submit.disabled=true;clearTimeout(timer);timer=setTimeout(quote,250);}
    f.amount.addEventListener('input',changed);f.kind.addEventListener('change',changed);f.currency.addEventListener('change',changed);
    if(pending){
      for(const [field,key]of Object.entries(mapping))f[field].value=pending.params[key]??'';
      for(const field of Object.keys(mapping))f[field].disabled=true;
      box.querySelector('[data-credit-quote]').disabled=true;submit.disabled=false;
      message.textContent='Sonucu belirsiz eski istek var. Aynı bilgiler ve istek kimliğiyle tekrar kontrol edilecek.';
    }else{
      box.querySelector('[data-credit-quote]').onclick=quote;quote();
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled)return;
      if(!f.confirmed.checked){message.textContent='İşlemin türüne uygun belge veya limit onayı gerekli.';return;}
      if(!pending&&quoteKey!==signature()){message.textContent='Güncel hesabı bekleyin.';return;}
      let params;
      try{
        const data=pending?pending.params:{p_bayi:dealer,p_tur:f.kind.value,p_tutar:Number(f.amount.value),p_para_birimi:f.currency.value,p_beklenen_coin:Number(f.coin.value),p_reference:f.reference.value.trim(),p_reason:f.reason.value.trim()};
        params=journal.prepare(name,{...data,p_odeme_sifresi:f.password.value});
      }catch(e){message.textContent=error(e);return;}
      serial++;clearTimeout(timer);form.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);f.password.value='';
      let uncertain=true;
      try{
        const result=await rpc(name,params);
        if(result?.ok!==true){uncertain=false;throw new Error(result?.error||'İşlem tamamlanamadı.');}
        journal.done(params.p_request_id);if(valid())onChanged();
      }catch(e){
        const rejected=new Set(['CREDIT_LIMIT_EXCEEDED','LIMIT_BELOW_DEBT','PAYMENT_EXCEEDS_DEBT','REFERENCE_ALREADY_USED','COLLECTION_ALREADY_USED','QUOTE_CHANGED','TARGET_ACCESS_DENIED','DEALER_STOCK_DEBT','NOT_A_DEALER','KUR_ESKI','KUR_YOK','DAILY_LIMIT','HOURLY_LIMIT','AMOUNT_OVER_LIMIT','INVALID_AMOUNT','REFERENCE_REQUIRED','REASON_REQUIRED','PASSWORD_REQUIRED','MFA_REQUIRED','NOT_AUTHORIZED']);
        if(['P0001','42501'].includes(e?.code)&&rejected.has(e?.message))uncertain=false;
        if(!uncertain){journal.done(params.p_request_id);pending=null;}
        if(valid())message.textContent=error(e)+(uncertain?' Sonuç belirsizse alanları değiştirmeden aynı istekle tekrar deneyin.':' İşlem yapılmadı; bilgileri düzelterek yeniden deneyebilirsiniz.');
      }finally{
        params.p_odeme_sifresi='';
        if(valid()){
          form.querySelectorAll('input,select,button').forEach(x=>x.disabled=false);
          // Unknown outcomes retain the original request and business fields.
          if(uncertain){
            for(const field of Object.keys(mapping))f[field].disabled=true;
            box.querySelector('[data-credit-quote]').disabled=true;
          }else{
            quoteKey=null;submit.disabled=true;
            box.querySelector('[data-credit-quote]').onclick=quote;
          }
        }
      }
    });
  }
  window.PuffyDealerCredit={mount};
})();
