// İçerik yönetimi — ana sayfa bannerları (2026-10-02, Claude).
// Sunucu: ana_banner_listesi_admin / ana_banner_kaydet / ana_banner_sil /
// ana_banner_sirala (2 adımlı doğrulama + platform yöneticisi). Görseller
// media-assets/bannerlar/ altına yüklenir; uygulama güncellemesi gerekmez.
(function(){
  'use strict';
  let ctx=null;
  const $=s=>document.querySelector(s);
  const KOD_AD={ozel_id:'Özel ID',yarisma:'Moment yarışması',pk_sampiyon:'PK Ligi şampiyonu',ajans_ligi:'Ajans ligi',aylik_yukleme:'Aylık yükleme',aile_ligi:'Aile ligi',cp:'CP haftalık',kedi_ligi:'Kedi ligi',yoldas_ligi:'Yoldaş ligi',taraftar_ligi:'Taraftar Ligi'};
  const HEDEF_AD={yok:'Dokununca bir şey olmaz',oda:'Odaya git (oda numarası)',profil:'Profile git (kullanıcı ID)',rota:'Uygulama sayfası (ör. /events)',url:'İnternet bağlantısı (https://…)'};
  const SB_URL='https://rjdddbwotczhagdulwco.supabase.co';
  const publicUrl=p=>p?SB_URL+'/storage/v1/object/public/'+p.split('/').map(encodeURIComponent).join('/'):'';
  const yerelZaman=v=>{if(!v)return '';const d=new Date(v);const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16)};
  const tarihYaz=v=>v?new Date(v).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';

  const MESAJ={INVALID_IMAGE:'Önce bir görsel yükle.',BUILTIN_CANNOT_DELETE:'Hazır bannerlar silinemez; gizleyebilirsin.',NOT_FOUND:'Banner bulunamadı; listeyi yenile.',ana_bannerlar_url:'Bağlantı https:// ile başlamalı.',ana_bannerlar_rota:'Sayfa yolu / ile başlamalı.',ana_bannerlar_tarih:'Bitiş, başlangıçtan sonra olmalı.','row-level security':'Görsel yükleme izni yok; panele yeniden giriş yap.',Payload:'Görsel çok büyük.'};
  const hata=e=>{const m=String(e&&(e.message||e.error_description)||e||'');for(const k in MESAJ)if(m.includes(k))return MESAJ[k];return ctx?ctx.errorText(e):m};
  const STIL=`.banner-liste{display:flex;flex-direction:column;gap:8px}.banner-satir{display:grid;grid-template-columns:34px 180px 1fr auto auto;gap:12px;align-items:center;padding:10px;border:1px solid var(--line,#2a2a2a);border-radius:10px;background:var(--panel,#15151a)}.banner-sira{display:flex;flex-direction:column;gap:4px}.banner-sira button{padding:2px 6px;font-size:11px}.banner-onizleme{width:180px;aspect-ratio:3/1;border-radius:8px;overflow:hidden;background:#0a0c11;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8b8b95;text-align:center}.banner-onizleme img,.banner-on img{width:100%;height:100%;object-fit:cover}.banner-bilgi{display:flex;flex-direction:column;gap:3px;min-width:0}.banner-bilgi small{color:var(--cream60,#9a9aa5)}.banner-islem{display:flex;gap:6px;flex-wrap:wrap}.tehlike{border-color:#a5463d!important;color:#ffb1a8!important}.banner-on-cerceve{margin:6px 0 12px}.banner-on{width:100%;aspect-ratio:3/1;border-radius:10px;overflow:hidden;background:#0a0c11;display:flex;align-items:center;justify-content:center;color:#8b8b95}dialog.genis{width:min(560px,94vw)}dialog form label{display:flex;flex-direction:column;gap:4px;margin:8px 0}dialog form label.satir{flex-direction:row;align-items:center;gap:8px}.iki-sutun{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tag.ok{background:#1f5c3a;color:#c9f5d9}@media(max-width:760px){.banner-satir{grid-template-columns:30px 1fr;}.banner-onizleme{width:100%}.banner-satir .tag,.banner-islem{grid-column:2}}`;
  function menu(){
    const host=$('#icerik-nav');if(!host||!ctx?.caps.admin){if(host)host.innerHTML='';return}
    host.innerHTML='<div class="nav-caption">İçerik</div><a class="menu" href="#bannerlar" data-sayfa="bannerlar"><span>Ana sayfa bannerları</span></a>';
  }
  function init(c){ctx=c;if(!document.getElementById('icerik-stil')){const st=document.createElement('style');st.id='icerik-stil';st.textContent=STIL;document.head.appendChild(st)}if(!$('#icerik-nav')){const nav=$('#approval-nav');if(nav){const d=document.createElement('div');d.id='icerik-nav';nav.after(d)}}menu()}
  function stop(){ctx=null;const h=$('#icerik-nav');if(h)h.innerHTML=''}

  function goster(){document.querySelectorAll('.workspace > [id^="s-"]').forEach(e=>e.classList.toggle('hidden',e.id!=='s-icerik'));if(!$('#s-icerik')){const d=document.createElement('div');d.id='s-icerik';$('.workspace').appendChild(d)}$('#s-icerik').classList.remove('hidden');const rn=$('#route-name');if(rn)rn.textContent='Ana sayfa bannerları'}

  async function bannerlar(){
    if(!ctx?.caps.admin){location.hash='ozet';return}
    const c=ctx;goster();const root=$('#s-icerik');
    root.innerHTML='<h1>Ana sayfa bannerları</h1><p class="note">Uygulamanın ana sayfasındaki kayan bannerlar. Sıra, görünürlük ve yeni görsel bannerlar buradan yönetilir; uygulama güncellemesi gerekmez. Değişiklikler kullanıcılara en geç 5 dakikada yansır.</p><div class="skeleton"></div>';
    try{
      const rows=await c.rpc('ana_banner_listesi_admin');if(ctx!==c||location.hash!=='#bannerlar')return;
      const simdi=Date.now();
      const durum=r=>!r.aktif?['Gizli','']:(r.baslangic&&new Date(r.baslangic).getTime()>simdi)?['Zamanı gelmedi','']:(r.bitis&&new Date(r.bitis).getTime()<=simdi)?['Süresi doldu','']:['Yayında','ok'];
      root.innerHTML=`<h1>Ana sayfa bannerları</h1><p class="note">Uygulamanın ana sayfasındaki kayan bannerlar. Sıra, görünürlük ve yeni görsel bannerlar buradan yönetilir; uygulama güncellemesi gerekmez. Değişiklikler kullanıcılara en geç 5 dakikada yansır.</p>
      <div class="panel-head"><h2>${rows.length} banner</h2><button data-yeni>+ Yeni görsel banner</button></div>
      <div class="banner-liste">${rows.map((r,i)=>{const[d,cl]=durum(r);return `<div class="banner-satir" data-id="${c.esc(r.id)}">
        <div class="banner-sira"><button data-yukari="${i}" ${i===0?'disabled':''} aria-label="Yukarı taşı">▲</button><button data-asagi="${i}" ${i===rows.length-1?'disabled':''} aria-label="Aşağı taşı">▼</button></div>
        <div class="banner-onizleme">${r.tur==='gorsel'?`<img src="${c.esc(publicUrl(r.gorsel_path))}" alt="">`:`<span>Uygulamadaki hazır banner</span>`}</div>
        <div class="banner-bilgi"><b>${c.esc(r.baslik||KOD_AD[r.kod]||'Başlıksız')}</b><small>${r.tur==='yerlesik'?'Hazır · '+c.esc(KOD_AD[r.kod]||r.kod):c.esc(HEDEF_AD[r.hedef_tur]||r.hedef_tur)+(r.hedef_deger?' → '+c.esc(r.hedef_deger):'')}</small><small>${r.baslangic||r.bitis?c.esc((tarihYaz(r.baslangic)||'şimdi')+' – '+(tarihYaz(r.bitis)||'süresiz')):'Süresiz'}</small></div>
        <span class="tag ${cl}">${d}</span>
        <div class="banner-islem"><button data-duzenle="${i}">Düzenle</button><button data-gizle="${i}">${r.aktif?'Gizle':'Göster'}</button>${r.tur==='gorsel'?`<button data-sil="${i}" class="tehlike">Sil</button>`:''}</div>
      </div>`}).join('')}</div>`;
      root.querySelector('[data-yeni]').onclick=()=>duzenle(null);
      root.querySelectorAll('[data-duzenle]').forEach(b=>b.onclick=()=>duzenle(rows[+b.dataset.duzenle]));
      root.querySelectorAll('[data-gizle]').forEach(b=>b.onclick=async()=>{const r=rows[+b.dataset.gizle];b.disabled=true;try{await c.rpc('ana_banner_kaydet',{p:Object.assign({},r,{aktif:!r.aktif})});c.toast(r.aktif?'Banner gizlendi.':'Banner yayında.');bannerlar()}catch(e){b.disabled=false;c.toast(hata(e))}});
      root.querySelectorAll('[data-sil]').forEach(b=>b.onclick=()=>sil(rows[+b.dataset.sil]));
      const tasi=async(i,j)=>{const ids=rows.map(r=>r.id);[ids[i],ids[j]]=[ids[j],ids[i]];try{await c.rpc('ana_banner_sirala',{p_idler:ids});bannerlar()}catch(e){c.toast(hata(e))}};
      root.querySelectorAll('[data-yukari]').forEach(b=>b.onclick=()=>tasi(+b.dataset.yukari,+b.dataset.yukari-1));
      root.querySelectorAll('[data-asagi]').forEach(b=>b.onclick=()=>tasi(+b.dataset.asagi,+b.dataset.asagi+1));
    }catch(e){if(ctx===c){root.innerHTML='<h1>Ana sayfa bannerları</h1><p>'+c.esc(hata(e))+'</p><button data-retry>Tekrar dene</button>';root.querySelector('[data-retry]').onclick=bannerlar}}
  }

  function sil(r){
    const c=ctx,dlg=document.createElement('dialog');
    dlg.innerHTML=`<h2>Banner silinsin mi?</h2><p>“${c.esc(r.baslik||'Başlıksız')}” ana sayfadan kaldırılır; görseli kalıcı temizlik kuyruğunda silinir. Bu işlem geri alınamaz; geçici olarak kaldırmak için “Gizle”yi kullanabilirsin.</p><div class="dialog-error" role="alert"></div><div class="dialog-actions"><button data-vazgec>Vazgeç</button><button data-onay class="tehlike">Sil</button></div>`;
    document.body.appendChild(dlg);dlg.showModal();dlg.addEventListener('close',()=>dlg.remove());
    dlg.querySelector('[data-vazgec]').onclick=()=>dlg.close();
    dlg.querySelector('[data-onay]').onclick=async()=>{dlg.querySelectorAll('button').forEach(b=>b.disabled=true);try{const out=await c.rpc('ana_banner_sil',{p_id:r.id});dlg.close();c.toast('Banner kaldırıldı. Medya temizliği kalıcı kuyruktan izlenir.');bannerlar()}catch(e){dlg.querySelector('.dialog-error').textContent=hata(e);dlg.querySelectorAll('button').forEach(b=>b.disabled=false)}};
  }

  function duzenle(r){
    const c=ctx,yeni=!r,yerlesik=r&&r.tur==='yerlesik',dlg=document.createElement('dialog');dlg.className='genis';
    let gorselPath=r?.gorsel_path||'',dosya=null;
    dlg.innerHTML=`<h2>${yeni?'Yeni görsel banner':'Banner düzenle'}</h2><form>
      ${yerlesik?`<p class="note">Bu, uygulamadaki hazır bir banner (${c.esc(KOD_AD[r.kod]||r.kod)}). Görseli ve hedefi uygulamada; burada yalnız başlığı, görünürlüğü ve tarihleri değişir.</p>`:`
      <label>Görsel <small>(önerilen 1200×400 px, 3:1 oranında, en fazla 2 MB; JPG, PNG veya WebP)</small><input type="file" name="gorsel" accept="image/jpeg,image/png,image/webp"></label>
      <div class="banner-on-cerceve"><div class="banner-on" id="bannerOn">${gorselPath?`<img src="${c.esc(publicUrl(gorselPath))}" alt="Önizleme">`:'<span>Görsel seçilmedi</span>'}</div><small id="bannerOlcu"></small></div>`}
      <label>Başlık <small>(panelde ve ekran okuyucularda görünür)</small><input name="baslik" maxlength="80" value="${c.esc(r?.baslik||'')}"></label>
      ${yerlesik?'':`<label>Dokununca<select name="hedef_tur">${Object.entries(HEDEF_AD).map(([k,v])=>`<option value="${k}" ${(r?.hedef_tur||'yok')===k?'selected':''}>${c.esc(v)}</option>`).join('')}</select></label>
      <label>Hedef <small id="hedefIpucu"></small><input name="hedef_deger" maxlength="300" value="${c.esc(r?.hedef_deger||'')}"></label>`}
      <div class="iki-sutun"><label>Başlangıç <small>(boş: hemen)</small><input type="datetime-local" name="baslangic" value="${yerelZaman(r?.baslangic)}"></label><label>Bitiş <small>(boş: süresiz)</small><input type="datetime-local" name="bitis" value="${yerelZaman(r?.bitis)}"></label></div>
      <label class="satir"><input type="checkbox" name="aktif" ${r?(r.aktif?'checked':''):'checked'}> Yayında</label>
      <div class="dialog-error" role="alert"></div>
      <div class="dialog-actions"><button type="button" data-vazgec>Vazgeç</button><button type="submit">${yeni?'Ekle':'Kaydet'}</button></div></form>`;
    document.body.appendChild(dlg);dlg.showModal();dlg.addEventListener('close',()=>dlg.remove());
    const f=dlg.querySelector('form'),err=dlg.querySelector('.dialog-error');
    dlg.querySelector('[data-vazgec]').onclick=()=>dlg.close();
    const ipucu=()=>{const t=f.hedef_tur?.value,h=dlg.querySelector('#hedefIpucu'),inp=f.hedef_deger;if(!h)return;const m={yok:['','Gerekmez'],oda:['Oda numarası, ör. 1000','1000'],profil:['Kullanıcı ID, ör. 719749','719749'],rota:['Uygulama içi yol, / ile başlar','/events'],url:['https:// ile başlayan bağlantı','https://puffychat.com']}[t]||['',''];h.textContent=m[0]?'('+m[0]+')':'';inp.placeholder=m[1];inp.disabled=t==='yok'};
    if(f.hedef_tur){f.hedef_tur.onchange=ipucu;ipucu()}
    if(f.gorsel)f.gorsel.onchange=()=>{dosya=f.gorsel.files[0]||null;err.textContent='';const on=dlg.querySelector('#bannerOn'),olcu=dlg.querySelector('#bannerOlcu');if(!dosya){return}
      if(!/^image\/(jpeg|png|webp)$/.test(dosya.type)){err.textContent='Yalnız JPG, PNG veya WebP yükleyebilirsin.';dosya=null;return}
      if(dosya.size>2*1024*1024){err.textContent='Görsel 2 MB’tan büyük; sıkıştırıp tekrar dene.';dosya=null;return}
      const url=URL.createObjectURL(dosya),im=new Image();im.onload=()=>{const oran=im.width/im.height;olcu.textContent=`${im.width}×${im.height} px`+(Math.abs(oran-3)>.15?' · Uyarı: 3:1 oranında değil, kenarlar kırpılabilir.':'')+(im.width<900?' · Uyarı: düşük çözünürlük, bulanık görünebilir.':'')};im.src=url;on.innerHTML='';const img=document.createElement('img');img.src=url;img.alt='Önizleme';on.appendChild(img)};
    f.onsubmit=async e=>{e.preventDefault();err.textContent='';const btn=f.querySelector('[type=submit]');
      const tur=f.hedef_tur?.value||'yok',deger=(f.hedef_deger?.value||'').trim();
      if(!yerlesik){
        if(!dosya&&!gorselPath){err.textContent='Bir görsel seç.';return}
        if(tur==='oda'&&!/^\d{3,9}$/.test(deger)){err.textContent='Geçerli bir oda numarası yaz.';return}
        if(tur==='profil'&&!/^\d{3,9}$/.test(deger)){err.textContent='Geçerli bir kullanıcı ID yaz.';return}
        if(tur==='rota'&&!/^\/[A-Za-z0-9/_-]*$/.test(deger)){err.textContent='Sayfa yolu / ile başlamalı (ör. /events).';return}
        if(tur==='url'&&!/^https:\/\//.test(deger)){err.textContent='Bağlantı https:// ile başlamalı.';return}
      }
      const bas=f.baslangic.value?new Date(f.baslangic.value).toISOString():'',bit=f.bitis.value?new Date(f.bitis.value).toISOString():'';
      if(bas&&bit&&bit<=bas){err.textContent='Bitiş, başlangıçtan sonra olmalı.';return}
      btn.disabled=true;let yuklenen=null;
      try{
        if(dosya){const uz={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[dosya.type];const ad=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2))+'.'+uz;const yol='bannerlar/'+ad;const up=await c.sb.storage.from('media-assets').upload(yol,dosya,{contentType:dosya.type,cacheControl:'31536000',upsert:false});if(up.error)throw up.error;yuklenen=yol;gorselPath='media-assets/'+yol}
        const p={id:r?.id||'',baslik:f.baslik.value.trim(),gorsel_path:gorselPath,hedef_tur:tur,hedef_deger:tur==='yok'?'':deger,baslangic:bas,bitis:bit,aktif:f.aktif.checked,sira:r?.sira};
        await c.rpc('ana_banner_kaydet',{p});
        if(r&&dosya&&r.gorsel_path&&r.gorsel_path!==gorselPath){c.sb.storage.from('media-assets').remove([r.gorsel_path.replace(/^media-assets\//,'')]).catch(()=>{})}
        dlg.close();c.toast(yeni?'Banner eklendi.':'Banner kaydedildi.');bannerlar();
      }catch(ex){if(yuklenen)c.sb.storage.from('media-assets').remove([yuklenen]).catch(()=>{});err.textContent=hata(ex);btn.disabled=false}
    };
  }

  function route(hash){if(hash==='bannerlar'){bannerlar();return true}return false}
  window.PuffyIcerik={init,stop,route,bannerlar};
})();
