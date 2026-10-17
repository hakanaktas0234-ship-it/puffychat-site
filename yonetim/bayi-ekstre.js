(() => {
  'use strict';
  const number = v => Number(v).toLocaleString('tr-TR', {minimumFractionDigits:2,maximumFractionDigits:2});
  const date = v => new Date(v).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
  const labels = {limit:'Limit tanımı',stok:'Borç karşılığı stok',tahsilat:'Tahsilat'};
  function movement(row) {
    const delta=Number(row.borc_farki_usd);
    const usd=row.tur==='limit'?'—':number(Math.abs(delta))+' USD';
    const quote=row.teklif;
    const rate=row.para_birimi==='TRY'&&row.tur==='tahsilat'&&delta<0
      ?quote?.try_kur>0?number(quote.try_kur)+' TL/USD · '+quote.try_kur_tarih+' · '+quote.try_kur_kaynak
      :number(Number(row.tutar)/Math.abs(delta))+' TL/USD (efektif)':'—';
    return [date(row.created_at),labels[row.tur]||row.tur,number(row.tutar)+' '+row.para_birimi,usd,rate,Number(row.coin).toLocaleString('tr-TR'),number(row.sonraki_borc_usd)+' USD',row.reference];
  }
  function mount({box,rpc,dealer,dealerLabel,valid}) {
    const boundDealer = String(dealer);
    let documentFile = null;
    const section=document.createElement('section');section.className='bayi-action';
    section.innerHTML='<h4>Bayiye gönderilecek cari hesap ekstresi</h4><div class="filters"><label>Başlangıç<input type="date" data-from></label><label>Bitiş<input type="date" data-to></label><button type="button" data-preview>Ekstre oluştur</button><button type="button" data-download disabled>PDF indir</button><button type="button" data-share disabled>PDF paylaş</button><button type="button" data-print disabled>Yazdır</button></div><p role="status" data-status></p><div data-output></div>';
    box.append(section);
    const button=section.querySelector('[data-preview]'),print=section.querySelector('[data-print]'),status=section.querySelector('[data-status]'),output=section.querySelector('[data-output]');
    const from=section.querySelector('[data-from]'),to=section.querySelector('[data-to]');
    const download=section.querySelector('[data-download]'),share=section.querySelector('[data-share]');
    function invalidate(){documentFile=null;download.disabled=share.disabled=print.disabled=true;}
    let generation=0;
    for(const input of [from,to])input.oninput=()=>{generation++;output.replaceChildren();invalidate();status.textContent='Tarih aralığı değişti; ekstreyi yeniden oluşturun.';};
    button.onclick=async()=>{
      const run=++generation, start=from.value, end=to.value;
      const current=()=>valid()&&run===generation;
      output.replaceChildren();invalidate();
      if(from.value&&to.value&&from.value>to.value){status.textContent='Başlangıç tarihi bitişten sonra olamaz.';return;}
      button.disabled=true;status.textContent='Tüm cari hareketler okunuyor…';
      try{
        const snapshot=await rpc('yonetim_bayi_hesap_ekstresi',{p_bayi:boundDealer});
        if(!current())return;
        if(snapshot?.dealer_id!==boundDealer||snapshot?.profile?.id!==boundDealer)throw new Error('Bayi kimliği doğrulanamadı.');
        if(!Array.isArray(snapshot.rows)||!Array.isArray(snapshot.prepaid_stock)||!Array.isArray(snapshot.payments))throw new Error('Eksik ekstre verisi.');
        const profile=snapshot.profile,displayId=profile.display_id||dealerLabel,dealerName=profile.nickname||'Bayi';
        const lines=[];
        const day=r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created_at));
        const inPeriod=r=>(!start||day(r)>=start)&&(!end||day(r)<=end);
        const totals=window.PuffyStatementCore.summarize(snapshot.rows,snapshot,start,end);
        const selected=totals.selected;
        const prepaid=snapshot.prepaid_stock.filter(inPeriod);
        const payments=snapshot.payments.filter(r=>inPeriod(r)&&r.manual_confirmed===true&&['TRY','USD'].includes(r.currency)&&Number(r.amount)>0);
        const paidTotals={TRY:0,USD:0};
        for(const row of payments){const n=Number(row.amount);if(!Number.isFinite(n))throw new Error('Geçersiz tahsilat.');paidTotals[row.currency]+=Math.round(n*100);}
        let prepaidIn=0,prepaidOut=0;
        for(const row of prepaid){const n=Number(row.miktar);if(!Number.isSafeInteger(n)||n<0||!['gonder','geri_cek'].includes(row.yon))throw new Error('Geçersiz stok hareketi.');if(row.yon==='gonder')prepaidIn+=n;else prepaidOut+=n;}
        const heading=document.createElement('h3');heading.textContent='PUFFY · Bayi cari hesap ekstresi';output.append(heading);
        function line(text){lines.push(text);const p=document.createElement('p');p.textContent=text;output.append(p);}
        line('Bayi: '+dealerName+' · Bayi ID: '+displayId+' · Düzenlenme: '+date(new Date())+' · Saat dilimi: Europe/Istanbul');
        line('Hesap kimliği: '+boundDealer);
        line('Dönem: '+(from.value||'İlk hareket')+' — '+(to.value||'Bugün'));
        line('Güncel limit: '+number(snapshot.limit_usd)+' USD · Güncel borç: '+number(snapshot.borc_usd)+' USD · Kullanılabilir limit: '+number(snapshot.kullanilabilir_usd)+' USD');
        line('Dönem başı borç: '+number(totals.opening)+' USD');
        line('TOPLAM YÜKLENEN COIN: '+(totals.coin+prepaidIn).toLocaleString('tr-TR')+' · Geri çekilen: '+prepaidOut.toLocaleString('tr-TR'));
        line('KAYITLI TOPLAM ÖDEMELER: '+number(paidTotals.TRY/100)+' TL + '+number(paidTotals.USD/100)+' USD');
        line('Toplam borç karşılığı stok bedeli: '+number(totals.stock)+' USD');
        line('Onaylı ödemeler: '+number(totals.paid.TRY)+' TL + '+number(totals.paid.USD)+' USD');
        line('Ödemelerin borçtan düşülen toplamı: '+number(totals.payment)+' USD');
        line('DÖNEM SONU KALAN BORÇ: '+number(totals.closing)+' USD');
        line('AÇIK HESAP HAREKETLERİ — borç hesabı');
        const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
        for(const title of ['Tarih','İşlem','Tutar','USD karşılığı','Kur','Coin','Kalan borç','Referans']){const th=document.createElement('th');th.textContent=title;tr.append(th);}thead.append(tr);table.append(thead);
        const tbody=document.createElement('tbody');for(const row of selected){lines.push('İşlem no: '+row.request_id);lines.push(movement(row).join(' | '));const tr=document.createElement('tr');for(const value of movement(row)){const td=document.createElement('td');td.textContent=value;tr.append(td);}tbody.append(tr);}table.append(tbody);
        const wrap=document.createElement('div');wrap.style.overflowX='auto';wrap.append(table);output.append(wrap);
        line('PEŞİN STOK / DÜZELTME HAREKETLERİ — açık hesap borcunu değiştirmez');
        for(const row of prepaid)line(date(row.created_at)+' | '+(row.yon==='gonder'?'Yükleme':'Geri çekme')+' | '+Number(row.miktar).toLocaleString('tr-TR')+' coin | Kayıtlı bedel: '+(row.tutar==null?'—':number(row.tutar)+' '+(row.para_birimi||'—'))+' | İşlem: '+row.id);
        line('KAYITLI TAHSİLATLAR — cari ödemeler ikinci kez toplanmaz');
        for(const row of payments)line(date(row.created_at)+' | '+number(row.amount)+' '+row.currency+' | '+(row.operation_key.startsWith('cari-tahsilat:')?'Açık hesap ödemesi':'Tahsilat')+' | Referans: '+row.reference+' | İşlem: '+row.operation_key);
        line('Yalnız kaydedilmiş hareketleri içerir. İşlemde saklanan kur ve tarihi kullanılır. Eski kayıtta kur yoksa efektif oran ayrıca belirtilir. Kayıtsız banka ödemesi varsayılmaz. Banka dekontu veya fatura değildir.');
        const blob=await window.PuffyStatementPdf.create(lines,'Bayi ID '+displayId+' · Hesap: '+boundDealer);
        if(!current())return;
        documentFile=new File([blob],window.PuffyStatementCore.filename(boundDealer,displayId,start,end),{type:'application/pdf'});
        status.textContent=selected.length+' hareket · '+dealerName+' / ID '+displayId+' için PDF hazır.';
        download.disabled=share.disabled=print.disabled=false;
      }catch(e){if(current()){invalidate();output.replaceChildren();status.textContent=e.message||String(e);}}
      finally{if(valid())button.disabled=false;}
    };
    download.onclick=()=>{
      if(!valid()||!documentFile)return;
      const url=URL.createObjectURL(documentFile),a=document.createElement('a');
      a.href=url;a.download=documentFile.name;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    share.onclick=async()=>{
      if(!valid()||!documentFile)return;
      const file=documentFile;
      if(!navigator.canShare?.({files:[file]})){
        status.textContent='Bu tarayıcı PDF paylaşımını desteklemiyor. PDF indir düğmesiyle kaydedip WhatsApp sohbetine ekle.';return;
      }
      try{
        await navigator.share({files:[file],title:'Puffy bayi hesap ekstresi',text:'Seçilen döneme ait bayi cari hesap ekstreniz.'});
        if(valid())status.textContent='Paylaşım penceresi kapandı. Alıcı ve gönderim WhatsApp içinde sizin tarafınızdan seçilir.';
      }catch(e){if(valid())status.textContent=e.name==='AbortError'?'Paylaşım iptal edildi.': 'Paylaşım tamamlanamadı; PDF indir seçeneğini kullanın.';}
    };
    print.onclick=()=>{
      if(!valid()||print.disabled)return;
      const frame=document.createElement('iframe');frame.title='Bayi hesap ekstresi yazdırma';frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0';document.body.append(frame);
      const doc=frame.contentDocument;doc.title='Puffy bayi '+dealerLabel+' cari hesap ekstresi';
      const style=doc.createElement('style');style.textContent='body{font:12px Arial,sans-serif;color:#111;padding:24px}table{border-collapse:collapse;width:100%;font-size:10px}td,th{border-bottom:1px solid #ccc;padding:8px;text-align:left;overflow-wrap:anywhere}h3{font-size:20px}@page{size:A4 landscape;margin:12mm}';doc.head.append(style);doc.body.append(output.cloneNode(true));doc.querySelectorAll('div').forEach(x=>x.style.overflow='visible');
      frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.focus();frame.contentWindow.print();
    };
  }
  window.PuffyDealerStatement={mount,movement};
})();
