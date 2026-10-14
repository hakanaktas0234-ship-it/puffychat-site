/* Room-only word policy. DM/group messages are unaffected. */
(() => {
  'use strict';
  let ctx = null, epoch = 0;
  const old = window.PuffyKapsam;
  const rootId = 's-anlar-kelime-filtresi';
  function stop() {
    epoch++;
    ctx = null;
    document.getElementById(rootId)?.replaceChildren();
    document.getElementById('anlar-filtre-menu')?.remove();
  }
  async function load() {
    const c = ctx, version = ++epoch;
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('section'); root.id = rootId;
      document.querySelector('.workspace').append(root);
    }
    document.querySelectorAll('.workspace > [id^="s-"]').forEach(x => x.classList.toggle('hidden', x !== root));
    document.querySelector('#uyg nav')?.classList.remove('open');
    document.querySelector('#panel-topbar .mobile-menu')?.setAttribute('aria-expanded', 'false');
    document.querySelectorAll('nav a.menu').forEach(x => x.classList.toggle('aktif', x.id === 'anlar-filtre-menu'));
    const current = () => ctx === c && version === epoch && location.hash.split('?')[0] === '#anlar-kelime-filtresi';
    root.innerHTML = '<p role="status">Filtre yükleniyor…</p>';
    try {
      const d = await c.rpc('yonetim_anlar_filtre_getir'); if (!current()) return;
      const e = c.esc;
      root.innerHTML = `<div class="page-title"><div><div class="eyebrow">ANLAR</div><h1>Kötü kelime filtresi</h1><p>Anlar metinlerine uygulanır. Diğer alanların ayarları bağımsızdır.</p></div><button data-refresh>Yenile</button></div><section class="panel"><h2>${d.aktif ? 'Filtre açık' : 'Filtre kapalı'}</h2><p>${d.kelimeler.length} kelime · Politika sürümü ${e(d.surum)}</p><p>Kaydedilen değişiklik bir sonraki metin kaydında geçerlidir. Önceden gösterilen mesajlar geri yazılmaz. Mevcut uygulamada kayıt sırasında sunucuda uygulanır. Video sesi ve görüntü içindeki yazılar taranmaz.</p>${c.caps.owner ? `<form data-toggle><label>Değişiklik gerekçesi<input name="reason" required minlength="3" maxlength="300"></label><button class="${d.aktif ? 'danger' : 'primary'}">${d.aktif ? 'Filtreyi kapat' : 'Filtreyi aç'}</button></form>` : ''}<p data-status role="status"></p></section><section class="panel"><h2>Kelime listesi</h2><p>Tam kelime eşleşmesi; Türkçe harf/büyük-küçük harf normalleştirilir. Harfler arasında en çok üç boşluk, nokta veya ayırıcı eşleşir. Ekli biçimler ayrı kelime olarak eklenir. Normal kelimelerin içindeki benzerlikler maskelenmez.</p>${c.caps.owner ? '<form data-add><label>Kelime<input name="word" required minlength="2" maxlength="32" placeholder="Tek kelime"></label><label>Gerekçe<input name="reason" required minlength="3" maxlength="300"></label><button class="primary">Ekle</button></form>' : ''}<label>Listede ara<input data-search type="search"></label><div data-list>${d.kelimeler.map(w => `<div data-word="${e(w)}" class="ayar-row"><strong>${e(w)}</strong>${c.caps.owner ? `<button data-remove="${e(w)}" class="danger">Çıkar</button>` : ''}</div>`).join('') || '<p>Liste boş. Önce maskelenecek kelimeleri ekle.</p>'}</div></section><section class="panel"><h2>Mesaj önizlemesi</h2><form data-preview><label>Örnek metin<textarea name="text" required maxlength="10000"></textarea></label><button>Sunucuda dene</button><p data-result role="status"></p></form><p>Önizleme mevcut açık/kapalı ayarını kullanır.</p></section><section class="panel"><h2>Son değişiklikler</h2>${d.gecmis.map(x => `<article><strong>${e(x.islem)} ${e(x.kelime || '')}</strong><p>${e(x.neden)}</p><small>${e(c.date(x.created_at))} · ${e(x.actor)}</small></article>`).join('') || '<p>Henüz değişiklik yok.</p>'}</section>`;
      document.querySelector('#route-name').textContent = 'Anlar kelime filtresi';
      root.querySelector('[data-refresh]').onclick = load;
      let busy = false;
      async function write(operation, word, active, reason) {
        if (busy || !current()) return;
        busy = true; root.querySelectorAll('button').forEach(x => x.disabled = true);
        try {
          await c.rpc('yonetim_anlar_filtre_degistir', {p_islem: operation, p_kelime: word, p_aktif: active, p_surum: d.surum, p_neden: reason.trim()});
          if (current()) { c.toast('Kaydedildi. Sonraki kaydedilen metinde geçerli.'); await load(); }
        } catch (err) {
          if (current()) {
            root.querySelector('[data-status]').textContent = `${c.errorText(err)} Veri değişmiş veya sonuç belirsizse Yenile ile kontrol et; aynı işlemi otomatik tekrarlama.`;
            root.querySelectorAll('button').forEach(x => x.disabled = false);
          }
        } finally { busy = false; }
      }
      root.querySelector('[data-toggle]')?.addEventListener('submit', ev => {ev.preventDefault(); write('aktiflik', null, !d.aktif, ev.target.elements.reason.value);});
      root.querySelector('[data-add]')?.addEventListener('submit', ev => {ev.preventDefault(); write('ekle', ev.target.elements.word.value, null, ev.target.elements.reason.value);});
      root.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
        const dlg = document.createElement('dialog'); dlg.className = 'phase2-dialog';
        dlg.innerHTML = `<form><h2>Kelimeyi çıkar</h2><p>${e(b.dataset.remove)}</p><label>Gerekçe<input name="reason" required minlength="3" maxlength="300"></label><button type="button" data-cancel>Vazgeç</button><button class="danger">Çıkar</button></form>`;
        document.body.append(dlg); dlg.onclose = () => dlg.remove(); dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
        dlg.querySelector('form').onsubmit = ev => {ev.preventDefault(); const reason = ev.target.elements.reason.value; dlg.close(); write('sil', b.dataset.remove, null, reason);}; dlg.showModal();
      });
      root.querySelector('[data-search]').oninput = ev => root.querySelectorAll('[data-word]').forEach(x => x.hidden = !x.dataset.word.includes(ev.target.value.toLocaleLowerCase('tr')));
      root.querySelector('[data-preview]').onsubmit = async ev => {
        ev.preventDefault(); const b = ev.target.querySelector('button'); b.disabled = true;
        try { const text = await c.rpc('yonetim_anlar_filtre_onizle', {p_text: ev.target.elements.text.value}); if (current()) ev.target.querySelector('[data-result]').textContent = text; }
        catch (err) { if (current()) ev.target.querySelector('[data-result]').textContent = c.errorText(err); }
        finally { b.disabled = false; }
      };
    } catch (err) { if (current()) {root.innerHTML = `<p role="alert">${c.esc(c.errorText(err))}</p><button>Tekrar dene</button>`;root.querySelector('button').onclick = load;} }
  }
  window.PuffyKapsam = {...old,
    init(c) { old.init(c); stop(); ctx = c; if (!c.caps.admin) return; const a = document.createElement('a'); a.id = 'anlar-filtre-menu'; a.className = 'menu'; a.href = '#anlar-kelime-filtresi'; a.textContent = 'Anlar kötü kelime filtresi'; document.querySelector('#uyg nav').append(a); },
    stop() { stop(); old.stop(); },
    route(hash) { if (hash.split('?')[0] !== 'anlar-kelime-filtresi') {epoch++;return old.route(hash);} if (!ctx?.caps.admin) {location.hash = 'ozet'; return true;} load(); return true; }
  };
})();
