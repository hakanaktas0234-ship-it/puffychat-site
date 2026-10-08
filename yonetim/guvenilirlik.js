(() => {
'use strict';
function csvCell(value){let text=String(value??'');if(typeof value!=='number'&&/^[\s\u0000-\u001f]*[=+\-@]/u.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function settingSnapshot(d,type,v){if(!d)throw Error('Ayarları yeniden yükleyin.');if(type==='platform')return d.platform?.[v.key]??null;if(type==='arama')return d.arama??null;if(type==='bayi_kademe')return {tiers:d.bayi_kademeleri,kur:d.try_kur};return d.kademe_maas.find(x=>String(x.level)===String(v.level))??null;}
function eventCounts(rows){const result={};for(const r of rows||[])result[r.tur]=(result[r.tur]||0)+1;return result;}
function teardown(doc){for(const d of doc.querySelectorAll('dialog')){d.close();d.remove();}for(const root of doc.querySelectorAll('.workspace > [id^="s-"]')){if(root.id==='s-shorts'||root.id==='s-sikayet'){root.querySelectorAll('#shorts-liste,#sikayet-liste').forEach(x=>x.replaceChildren());root.querySelectorAll('.daha').forEach(x=>x.remove());}else root.replaceChildren();root.classList.add('hidden');}for(const sel of ['#kim','#panel-topbar','#approval-nav','#pending-content','#mfa-secret','#qr'])doc.querySelector(sel)?.replaceChildren();for(const sel of ['#sifre','#kod','#kod-kur']){const input=doc.querySelector(sel);if(input)input.value='';}}
window.PuffyGuvenilirlik={csvCell,settingSnapshot,eventCounts,teardown};
})();
