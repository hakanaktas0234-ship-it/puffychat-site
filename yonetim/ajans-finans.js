/* Ajans finans özeti: yalnız mevcut yönetici + MFA kapılı, salt okunur RPC. */
(() => {
 'use strict';
 const money = n => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'USD'}).format(n/100);
 const number = n => new Intl.NumberFormat('tr-TR').format(n);
 function cents(value) {
  if(value == null) throw Error('Eksik hakediş tutarı');
  const n=Number(value);
  if(!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*100))) throw Error('Geçersiz hakediş tutarı');
  return Math.round(n*100);
 }
 function summarize(rows,month) {
  const s={coins:0,host:0,owner:0,settled:0,pending:0,processing:0,other:0,count:0};
  for(const r of rows){
   if(month&&String(r.period_start).slice(0,7)!==month)continue;
   const coin=Number(r.total_coins_earned);
   if(!Number.isSafeInteger(coin))throw Error('Geçersiz coin tutarı');
   const host=cents(r.final_host_usd),owner=cents(r.final_owner_usd),total=host+owner;
   s.coins+=coin;s.host+=host;s.owner+=owner;s.count++;
   if(r.status==='settled')s.settled+=total;
   else if(r.status==='pending')s.pending+=total;
   else if(r.status==='processing')s.processing+=total;
   else s.other+=total;
  }
  if(Object.values(s).some(n=>!Number.isSafeInteger(n)))throw Error('Toplam güvenli sayı aralığını aşıyor');
  return s;
 }
 async function fetchRows(c,id,valid){
  const rows=[],seen=new Set();let expected=null;
  for(let offset=0;offset<=100000;offset+=100){
   if(!valid())return null;
   const page=await c.rpc('yonetim_topluluk_icerik',{p_tur:'ajans',p_id:id,p_sekme:'kazanc',p_arama:'',p_cevrimici:false,p_limit:100,p_offset:offset});
   if(!valid())return null;
   if(!Array.isArray(page.rows)||!Number.isSafeInteger(Number(page.total))||Number(page.total)<0)throw Error('Geçersiz kazanç yanıtı');
   if(expected===null)expected=Number(page.total);
   if(expected!==Number(page.total))throw Error('Kayıtlar yüklenirken değişti. Yenile ile tekrar deneyin.');
   for(const row of page.rows){if(!row.id||seen.has(row.id))throw Error('Kayıtlar yüklenirken değişti. Yenile ile tekrar deneyin.');seen.add(row.id);rows.push(row);}
   if(rows.length===expected)return rows;
   if(rows.length>expected||page.rows.length!==100)throw Error('Kazanç kayıtlarının tamamı alınamadı.');
  }
  throw Error('Kayıt sınırı aşıldı; toplam gösterilmedi.');
 }
 function mount({root,c,id,valid}){
  const anchor=root.querySelector('.org-hero');if(!anchor)return;
  const box=document.createElement('section');box.className='panel';box.setAttribute('aria-label','Ajans finans özeti');
  box.innerHTML='<h2>Ajans finans özeti</h2><p role="status">Tüm dönem kayıtları yükleniyor…</p>';anchor.after(box);
  const alive=()=>valid()&&box.isConnected;
  fetchRows(c,id,alive).then(rows=>{
   if(!rows||!alive())return;
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
   const month=parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value;
   box.innerHTML=`<h2>Ajans finans özeti</h2><form class="org-filters"><label>Hakediş ayı<input type="month" name="month" value="${month}" required></label><button type="submit">Göster</button><button type="button" data-all>Tüm dönemler</button></form><div data-finance-results aria-live="polite"></div><p class="note">Dönem başlangıcının ayına göre, bütün kayıt sayfaları üzerinden hesaplanır. Açık dönem tutarları geçicidir; yeniden maaş hesaplaması çalıştırılmaz. Komisyon, yayıncı maaşından ayrı kayıtlı ajans payıdır; sabit yüzde varsayılmaz. Bakiyeye aktarım banka ödemesi değildir. Banka ödemeleri ve çekim talepleri muhasebeden izlenir.</p>`;
   const result=box.querySelector('[data-finance-results]'),form=box.querySelector('form');
   function render(selected){
    try{
     const s=summarize(rows,selected);
     result.innerHTML=`<p><strong>${c.esc(selected||'Tüm dönemler')}</strong> · ${number(s.count)} hakediş kaydı</p><div class="metrics">${[['Toplam kazanç · coin',number(s.coins)],['Yayıncı hakedişi',money(s.host)],['Ajans komisyonu',money(s.owner)],['Toplam hakediş',money(s.host+s.owner)],['Bakiyeye aktarılan · toplam',money(s.settled)],['Bekleyen · toplam',money(s.pending)],['İşleniyor · toplam',money(s.processing)],['Diğer durumlar · toplam',money(s.other)]].map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><p class="note">Yayıncı hakedişi, ajans sahibinin varsa kendi yayıncı maaşını da kapsar; bu tutar ajans komisyonuna eklenmez. İptal/başarısız veya tanınmayan durumlar “Diğer durumlar” altında ayrıca gösterilir.</p>`;
    }catch(e){result.textContent='Özet hesaplanamadı: '+e.message;result.setAttribute('role','alert');}
   }
   form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())render(form.elements.month.value);};
   form.querySelector('[data-all]').onclick=()=>render('');render(month);
  }).catch(e=>{if(alive()){box.innerHTML='<h2>Ajans finans özeti</h2><p role="alert"></p>';box.querySelector('p').textContent='Özet alınamadı: '+c.errorText(e);}});
 }
 window.PuffyAgencyFinance={mount,summarize,fetchRows};
})();
