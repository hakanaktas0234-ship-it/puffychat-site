/* Only visible authorized menu links appear in search. No permission changes. */
(()=>{
 'use strict';const phase=window.PuffyPhase1,open=phase.open,close=phase.close;let dialog=null,button=null;
 const fold=s=>String(s).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
 function eligible(a){return !a.hidden&&!a.closest('[hidden]')&&!a.classList.contains('hidden')&&a.getClientRects().length&&/^#[a-z0-9/-]+(?:\?.*)?$/i.test(a.getAttribute('href')||'');}
 function render(){const results=dialog.querySelector('[data-results]'),q=fold(dialog.querySelector('input').value.trim());results.replaceChildren();
  const links=[...document.querySelectorAll('#uyg nav a.menu')].filter(eligible).filter(a=>fold(a.textContent).includes(q));const seen=new Set();
  for(const a of links){const href=a.getAttribute('href');if(seen.has(href))continue;seen.add(href);const b=document.createElement('button');b.type='button';b.textContent=a.textContent.trim();b.onclick=()=>{if(!eligible(a))return;dialog.close();location.hash=href;};results.append(b);}
  if(!seen.size)results.textContent='Eşleşen menü yok.';
 }
 function show(){if(document.querySelector('#uyg').classList.contains('hidden'))return;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='menu-arama-dialog';dialog.setAttribute('aria-label','Menüde ara');dialog.innerHTML='<h2>Menüde ara</h2><label>Bölüm adı<input type="search" maxlength="100" placeholder="Örn. ban, canlı oda, kullanıcı" autocomplete="off"></label><div data-results class="inci-results"></div><div class="dialog-actions"><button type="button" data-close>Kapat</button></div>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('input').oninput=render;dialog.querySelector('input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();dialog.querySelector('[data-results] button')?.click();}if(e.key==='ArrowDown'){e.preventDefault();dialog.querySelector('[data-results] button')?.focus();}};}
  dialog.showModal();dialog.querySelector('input').value='';render();dialog.querySelector('input').focus();
 }
 phase.open=function(c){open.call(this,c);button?.remove();button=document.createElement('button');button.type='button';button.id='menu-arama-button';button.textContent='⌕ Menüde ara';button.onclick=show;const nav=document.querySelector('#uyg nav');nav.prepend(button);};
 phase.close=function(){dialog?.remove();dialog=null;button?.remove();button=null;return close.call(this);};
})();
