/* #17 (2026-10-11): ham JSON yerine okunur kart. Teknik JSON "Teknik ayrıntılar" altında kalır.
   Gizli olabilecek anahtarlar (token, şifre, IBAN, TC) gösterilmez. */
(function(root){
 'use strict';
 const labels={atanan:'Sorumlu',atanan_adi:'Sorumlu',son_tarih:'Hedef tarih',notlar:'Not',not:'Not',updated_at:'Son güncelleme',created_at:'Oluşturma',
  durum:'Durum',status:'Durum',karar:'Karar',neden:'Gerekçe',reason:'Gerekçe',islem:'İşlem',yonetici:'Yönetici',zaman:'Zaman',tutar:'Tutar',usd:'USD',
  amount_usd:'Tutar · USD',amount_try:'Tutar · TL',amount_try_net:'Net · TL',holder:'Hesap sahibi',bank_name:'Banka',referans:'Referans',reference:'Referans',
  odeme_referansi:'Ödeme referansı',paid_at:'Ödeme zamanı',odendi_at:'Ödeme zamanı',nickname:'Kullanıcı',display_id:'ID',actor:'İşlemi yapan',
  aktor:'İşlemi yapan',before:'Önce',after:'Sonra',onceki:'Önce',sonraki:'Sonra',gecmis:'Geçmiş',history:'Geçmiş',aciklama:'Açıklama',sebep:'Sebep',
  kaynak:'Kaynak',hedef:'Hedef',miktar:'Miktar'};
 const hidden=/(^|_)(token|secret|sifre|password|iban|tc|tckn|kimlik_no)($|_)/i;
 function value(c,v,depth){
  if(v==null||v==='')return '—';
  if(typeof v==='boolean')return v?'Evet':'Hayır';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v))return c.esc(c.date(v));
  if(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))return '<code class="uuid" title="Kopyalamak için seç">'+c.esc(v.slice(0,8))+'…</code>';
  if(typeof v!=='object')return c.esc(String(v));
  if(depth>2)return '<code>'+c.esc(JSON.stringify(v))+'</code>';
  if(Array.isArray(v))return v.length?'<ol class="case-list">'+v.slice(0,50).map(x=>'<li>'+value(c,x,depth+1)+'</li>').join('')+'</ol>'+(v.length>50?'<p class="note">+'+(v.length-50)+' kayıt daha</p>':''):'—';
  const rows=Object.entries(v).filter(([k])=>!hidden.test(k));
  if(!rows.length)return '—';
  return '<dl class="key-values">'+rows.map(([k,x])=>'<div><dt>'+c.esc(labels[k]||k.replace(/_/g,' '))+'</dt><dd>'+value(c,x,depth+1)+'</dd></div>').join('')+'</dl>';
 }
 function html(c,data){return value(c,data,0);}
 function withTechnical(c,data){return '<div class="case-readable">'+html(c,data)+'</div><details class="technical"><summary>Teknik ayrıntılar</summary><pre>'+c.esc(JSON.stringify(data,null,2))+'</pre></details>';}
 root.PuffyOkunur={html,withTechnical};
 if(typeof module!=='undefined')module.exports=root.PuffyOkunur;
})(typeof window==='undefined'?globalThis:window);
