/* puffychat.com destek formu (Codex raporu #22, 2026-10-11): talep panelde Destek kutusuna düşer. */
(function(){
 'use strict';
 var URL_='https://rjdddbwotczhagdulwco.supabase.co/rest/v1/rpc/destek_formu_gonder',KEY='sb_publishable_TMb-Ldq66Pi3ehxPSYB8JA_aQ-zEeHd';
 var f=document.getElementById('destek-formu');if(!f)return;
 var durum=f.querySelector('[data-durum]'),btn=f.querySelector('button');
 f.addEventListener('submit',function(e){e.preventDefault();
  if(f.elements.web.value){durum.textContent='Teşekkürler.';return;}
  var v={p_ad:f.elements.ad.value.trim(),p_eposta:f.elements.eposta.value.trim(),p_konu:f.elements.konu.value.trim(),p_mesaj:f.elements.mesaj.value.trim()};
  if(v.p_mesaj.length<10){durum.textContent='Mesajın en az 10 karakter olmalı.';return;}
  btn.disabled=true;durum.textContent='Gönderiliyor…';
  fetch(URL_,{method:'POST',headers:{'Content-Type':'application/json','Content-Profile':'public','apikey':KEY,'Authorization':'Bearer '+KEY},body:JSON.stringify(v)})
   .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});})
   .then(function(x){if(x.ok&&x.d&&x.d.no){f.reset();durum.textContent='Talebin alındı. Numaran: '+x.d.no+'. Yanıtı e-postana göndereceğiz (genellikle 12–72 saat).';}
     else{var m=String((x.d&&x.d.message)||'');durum.textContent=m.indexOf('HOURLY_LIMIT')>=0?'Kısa sürede çok talep gönderildi. Biraz sonra tekrar dene ya da e-posta yaz.':m.indexOf('INVALID_EMAIL')>=0?'E-posta adresini kontrol et.':'Gönderilemedi. destek@puffychat.com adresine yazabilirsin.';}
     btn.disabled=false;})
   .catch(function(){durum.textContent='Bağlantı kurulamadı. destek@puffychat.com adresine yazabilirsin.';btn.disabled=false;});
 });
})();
