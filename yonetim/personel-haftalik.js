/* Owner-only schedule controls. Saving never pays coins immediately. */
(()=>{'use strict';
 const phase=window.PuffyPhase1,open=phase.open,close=phase.close,route=phase.route;
 let ctx=null,epoch=0;
 const clean=()=>{epoch++;ctx=null;document.querySelector('#personel-haftalik-nav')?.remove();document.querySelector('#s-personel-haftalik')?.remove();};
 phase.open=function(c){open.call(this,c);clean();if(!c.caps?.owner)return;ctx=c;
 const nav=document.createElement('div');nav.id='personel-haftalik-nav';nav.innerHTML='<a class="menu" href="#personel-haftalik">Haftalık personel coini</a>';const host=document.querySelector('#uyg nav');host.insertBefore(nav,host.querySelector('.alt'));
 const root=document.createElement('section');root.id='s-personel-haftalik';root.className='hidden';document.querySelector('.workspace').append(root);};
 phase.close=function(){clean();return close.call(this);};
 phase.route=function(value){if(value!=='personel-haftalik')return route.call(this,value);if(!ctx?.caps.owner){location.hash='ozet';return true;}render();return true;};
 const fmt=n=>Number(n||0).toLocaleString('tr-TR');
 const date=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Henüz etkinleştirilmedi';
 const errors={wrong_password:'Ödeme şifren yanlış.',locked:'Ödeme şifren geçici olarak kilitli.',not_set:'Önce ödeme şifreni oluştur.',INVALID_AMOUNT:'Bu program Admin için haftalık 500.000 coin olarak tanımlı.',MFA_REQUIRED:'Güvenlik doğrulamanı yenile.',MFA_REAUTH_REQUIRED:'Güvenlik doğrulamanı yenile.'};
 async function render(){const c=ctx,n=++epoch,root=document.querySelector('#s-personel-haftalik');if(!root)return;
 const valid=()=>ctx===c&&n===epoch&&location.hash==='#personel-haftalik';
 document.querySelectorAll('.workspace > [id^="s-"]').forEach(x=>x.classList.toggle('hidden',x!==root));document.querySelector('#route-name').textContent='Haftalık personel coini';
 root.innerHTML='<div class="page-title"><div><h1>Haftalık personel coini</h1><p>Admin · Pazar 10.00 · Türkiye saati</p></div></div><section class="panel"><p data-status role="status">Program okunuyor…</p></section>';
 try{
 const res=await c.sb.rpc('yonetim_admin_haftalik_ozet');if(res.error)throw res.error;if(!valid())return;const d=res.data;
 root.innerHTML='<div class="page-title"><div><h1>Haftalık personel coini</h1><p>Admin · Pazar 10.00 · Türkiye saati</p></div></div><section class="panel"><p data-summary></p><p>Rolün verildiği tam saatten kaldırıldığı ana kadar, haftalık 500.000 coin oranıyla hesaplanır. Hafta içinde ayrılanın biriken hakkı korunur. Normal coin cüzdanına eklenir; satış veya yükleme sayılmaz. Bir hesap haftada tek ödeme alır. Banlı veya incelemedeki hesaplara ödeme yapılmaz. Müşteri hizmetleri bu programa dahil değildir.</p><p>Hak birikimi ilk etkinleştirme anında başlar; ilk ödeme pazar 10.00’da süreye göre yapılır. Geçmiş görev süreleri tahmin edilmez. Program kapalıyken yeni hak birikmez; önceki biriken hak korunur. Kaydetmek hemen coin dağıtmaz.</p><form class="filters"><label>Admin başına haftalık coin<input name="amount" type="number" value="500000" readonly required></label><label><input name="active" type="checkbox"> Haftalık otomatik ödemeyi etkinleştir</label><label>Ödeme şifresi<input name="password" type="password" autocomplete="off" required></label><button>Programı kaydet</button><p role="status" data-status></p></form></section><section class="panel"><h2>Son 100 personel kaydı</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Dönem</th><th>Personel</th><th>Görev süresi</th><th>Coin</th><th>Durum</th></tr></thead><tbody></tbody></table></div><p data-empty></p></section>';
 root.querySelector('[data-summary]').textContent=(d.aktif?'Açık':'Kapalı')+' · '+fmt(d.miktar)+' coin · Uygun Admin: '+fmt(d.uygun_personel)+' · İlk ödeme: '+date(d.ilk_odeme);
 const form=root.querySelector('form'),f=form.elements;f.amount.value=String(d.miktar);f.active.checked=d.aktif;
 const statuses={odendi:'Ödendi',ban:'Ban nedeniyle ödenmedi',inceleme:'İnceleme nedeniyle ödenmedi',cuzdan_yok:'Cüzdan bulunamadı',sifirdan_az:'Bir coinden az; küsurat devredildi'};
 for(const r of d.odemeler){const tr=document.createElement('tr');for(const text of [date(r.vade),(r.nickname||'Kullanıcı')+' · '+(r.display_id??'—'),(Number(r.sure_saniye)/3600).toLocaleString('tr-TR',{maximumFractionDigits:4})+' saat',fmt(r.miktar),statuses[r.durum]||r.durum]){const td=document.createElement('td');td.textContent=text;tr.append(td);}root.querySelector('tbody').append(tr);}
 if(!d.odemeler.length)root.querySelector('[data-empty]').textContent='Henüz haftalık ödeme yok.';
 form.onsubmit=async event=>{event.preventDefault();const inputs=form.querySelectorAll('input,button'),msg=form.querySelector('[data-status]');const amount=Number(f.amount.value),active=f.active.checked;
 if(!Number.isSafeInteger(amount)||amount!==500000){msg.textContent=errors.INVALID_AMOUNT;return;}
 inputs.forEach(x=>x.disabled=true);
 try{const r=await c.sb.rpc('yonetim_admin_haftalik_ayar',{p_aktif:active,p_miktar:amount,p_odeme_sifresi:f.password.value});f.password.value='';if(r.error)throw r.error;if(!r.data?.ok)throw new Error(r.data?.error||'İşlem tamamlanamadı');if(valid())render();}
 catch(e){if(valid()){msg.textContent=(errors[e.message]||e.message)+' Durumu yeniden açarak doğrulayabilirsiniz; kaydetme coin dağıtmaz.';inputs.forEach(x=>x.disabled=false);}}
 finally{f.password.value='';}};
 }catch(e){if(valid())root.querySelector('[data-status]').textContent=errors[e.message]||e.message;}
 }
})();
