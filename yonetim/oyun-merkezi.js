/* Puffy / Siyah İnci — oyun işletimi. Sunucu yetkileri her RPC'de doğrulanır. */
(() => {
  'use strict';
  let ctx = null, epoch = 0;
  const $ = s => document.querySelector(s);
  const number = n => n == null ? '—' : new Intl.NumberFormat('tr-TR', {maximumFractionDigits: 2}).format(n);
  const uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const validUserFilter = s => !s || uuid(s) || /^#?[0-9]{1,15}$/.test(s);
  async function resolveUser(c, input) {
    const value = input.trim();
    if (!validUserFilter(value)) throw new Error('INVALID_USER_ID');
    if (!value) return null;
    if (uuid(value)) return value.toLowerCase();
    const id = BigInt(value.replace(/^#/, '')).toString();
    for (let offset = 0; offset < 1000; offset += 100) {
      const data = await c.rpc('admin_kullanici_listesi', {
        p_arama: id, p_filtre: {}, p_limit: 100, p_offset: offset,
      });
      const rows = data?.rows || [];
      const matches = rows.filter(row => String(row.display_id) === id);
      if (matches.length > 1) throw new Error('AMBIGUOUS_USER_ID');
      if (matches.length === 1) {
        if (!uuid(matches[0].id)) throw new Error('INVALID_USER_RESPONSE');
        return matches[0].id;
      }
      if (!rows.length || offset + rows.length >= Number(data.total))
        throw new Error('USER_ID_NOT_FOUND');
    }
    throw new Error('USER_SEARCH_TOO_BROAD');
  }
  const error = (c, e) => ({INVALID_USER_ID: 'Puffy kullanıcı ID’si veya UUID gir.', USER_ID_NOT_FOUND: 'Bu ID ile hesap bulunamadı.', AMBIGUOUS_USER_ID: 'ID eşleşmesi belirsiz; işlem durduruldu.', INVALID_USER_RESPONSE: 'Hesap kimliği doğrulanamadı.', USER_SEARCH_TOO_BROAD: 'Arama çok geniş; kullanıcı UUID’si ile tekrar dene.', SETTING_VERSION_CONFLICT: 'Veri değişti. Ekranı yenileyip işlemi yeniden incele.', GAME_OPERATION_UNSUPPORTED: 'Bu oyunda işletim işlemi desteklenmiyor.'})[e.message] || c.errorText(e);
  const terminal = e => /SETTING_VERSION_CONFLICT|INVALID_AMOUNT|INVALID_VALUE|INVALID_REQUEST|INVALID_GAME|GAME_SCHEMA_MISSING|GAME_BANK_MISSING|GAME_OPERATION_UNSUPPORTED|IDEMPOTENCY_CONFLICT/.test(e.message || '');
  const storageKey = c => `puffy.game-operation.v2.${c.user.id}`;
  function pending(c) {
    const raw = localStorage.getItem(storageKey(c));
    return raw ? JSON.parse(raw) : null;
  }
  function stop() {
    epoch++;
    ctx = null;
    $('#s-oyun-merkezi')?.replaceChildren();
    document.querySelectorAll('dialog.game-operation').forEach(x => x.close());
  }
  function mount() {
    let root = $('#s-oyun-merkezi');
    if (!root) {
      root = document.createElement('section');
      root.id = 's-oyun-merkezi';
      root.className = 'game-center';
      $('.workspace').append(root);
    }
    document.querySelectorAll('.workspace > [id^="s-"]').forEach(x => x.classList.toggle('hidden', x !== root));
    document.querySelectorAll('nav a.menu').forEach(x => x.classList.toggle('aktif', x.dataset.sayfa === 'oyun-kasasi'));
    $('#uyg nav')?.classList.remove('open');
    $('#panel-topbar .mobile-menu')?.setAttribute('aria-expanded', 'false');
    if ($('#route-name')) $('#route-name').textContent = 'Oyunlar';
    return root;
  }
  const metric = (title, value, foot = '') => `<article class="game-metric"><span>${title}</span><strong>${number(value)}</strong><small>${foot}</small></article>`;
  function chart(c, data) {
    if (!data.length) return '<p class="game-empty">Bu dönemde finansal hareket yok.</p>';
    const max = Math.max(1, ...data.flatMap(x => [Number(x.bahis), Number(x.odeme)]));
    const points = field => data.map((r, i) => `${45 + (data.length === 1 ? 230 : i * 470 / (data.length - 1))},${145 - Number(r[field]) / max * 115}`).join(' ');
    return `<svg viewBox="0 0 560 180" role="img" aria-label="Günlük bahis ve ödeme karşılaştırması"><line x1="45" y1="145" x2="515" y2="145" stroke="currentColor" opacity=".2"/><text x="0" y="30">${c.esc(number(max))}</text><text x="20" y="145">0</text><polyline fill="none" stroke="#dec38a" stroke-width="3" points="${points('bahis')}"/><polyline fill="none" stroke="#92ddd0" stroke-width="2" points="${points('odeme')}"/><text x="45" y="172">${c.esc(data[0].gun)}</text><text x="410" y="172">${c.esc(data.at(-1).gun)}</text></svg><p class="game-legend">● Bahis <span>● Ödeme</span></p>`;
  }
  function recordId(row, game) { return String(row[game.anahtar] ?? ''); }
  function outcome(row) { return row.result || row.sonuc || row; }
  function recordTable(c, rows, game) {
    if (!rows.length) return '<p class="game-empty">Bu filtrelerde kayıt bulunamadı.</p>';
    return `<div class="game-table-wrap"><table><thead><tr><th>Zaman</th><th>İşlem / tur</th><th>Kullanıcı</th><th>Bahis</th><th>Ödeme</th><th></th></tr></thead><tbody>${rows.map((r, i) => {
      const v = outcome(r), id = recordId(r, game);
      return `<tr><td>${c.esc(c.date(r[game.zaman]))}</td><td><code title="${c.esc(id)}">${c.esc(id.length > 16 ? id.slice(0, 12) + '…' : id)}</code></td><td>${r.user_id && uuid(r.user_id) ? `<a href="#kullanici/${encodeURIComponent(r.user_id)}">${c.esc(r.user_id.slice(0, 8))}…</a>` : 'Ortak tur'}</td><td>${number(v.stake ?? (v.isFree ? 0 : v.bet) ?? r.ciro ?? r.bahis)}</td><td class="game-paid">${number(v.payout ?? r.odeme ?? r.kazanc)}</td><td><button data-record="${i}">İncele</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function detail(c, row, filter) {
    const dialog = document.createElement('dialog');
    dialog.className = 'game-operation';
    dialog.setAttribute('aria-label', 'Tur ayrıntısı');
    const v = outcome(row);
    const grid = v.grid || v.symbols || v.stages?.at(-1)?.grid;
    dialog.innerHTML = `<h2>Tur ayrıntısı</h2><dl><dt>İşlem</dt><dd><code>${c.esc(row.request_id ?? row.istek_id ?? row.id ?? row.tur_no)}</code></dd><dt>Bahis / ödeme</dt><dd>${number(v.stake ?? (v.isFree ? 0 : v.bet) ?? row.ciro)} / ${number(v.payout ?? row.odeme)} coin</dd><dt>Ücretsiz tur</dt><dd>${v.isFree == null ? '—' : v.isFree ? 'Evet' : 'Hayır'}</dd></dl>${Array.isArray(grid) ? `<div class="game-grid" aria-label="Sonuç sembolleri">${grid.map(x => `<span>${c.esc(typeof x === 'object' ? JSON.stringify(x) : x)}</span>`).join('')}</div>` : ''}<details><summary>Teknik kayıt</summary><pre>${c.esc(JSON.stringify(row, null, 2))}</pre></details><button data-ledger>Coin defteriyle karşılaştır</button><button data-close>Kapat</button>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-ledger]').onclick = () => { dialog.close(); filter(); };
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
  }
  async function operation(c, game, type, refresh, active) {
    const dialog = document.createElement('dialog');
    dialog.className = 'game-operation';
    dialog.setAttribute('aria-label', type === 'fonla' ? 'Kasaya bütçe ekle' : 'Oyunun aktifliğini değiştir');
    dialog.innerHTML = `<form><div class="eyebrow">YETKİLİ İŞLEM</div><h2>${type === 'fonla' ? 'Kasaya bütçe ekle' : active ? 'Oyunu aç' : 'Oyunu kapat'}</h2><p>${c.esc(game.ad)} · Kasa ${number(game.kasa?.bakiye)} coin</p>${type === 'fonla' ? '<label>Eklenecek coin<input name="amount" inputmode="numeric" pattern="[0-9]+" required maxlength="12"></label><p>Platform başlangıç/ek oyun bütçesi. Oyuncu cüzdanından veya başka oyun kasasından aktarım yapılmaz.</p>' : '<p>Motor ve menü görünürlüğü birlikte güncellenir. Açık bonusların durumunu kontrol et; kapatılan motor devam eden bonusları bekletebilir.</p>'}<label>Gerekçe<textarea name="reason" minlength="3" maxlength="300" required></textarea></label><label><input name="confirmed" type="checkbox" required> Eski ve yeni değerleri kontrol ettim.</label><p data-preview role="status"></p><p data-error role="alert"></p><div class="dialog-actions"><button type="button" data-close>Vazgeç</button><button class="primary" type="submit">${type === 'fonla' ? 'Bütçeyi ekle' : active ? 'Aç' : 'Kapat'}</button></div></form>`;
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    const form = dialog.querySelector('form');
    form.oninput = () => {
      const amount = Number(form.elements.amount?.value || 0);
      dialog.querySelector('[data-preview]').textContent = type === 'fonla' ? `Kasa: ${number(game.kasa?.bakiye)} → ${number(Number(game.kasa?.bakiye || 0) + amount)} coin` : `Yeni durum: ${active ? 'Açık' : 'Kapalı'}`;
    };
    let busy = false;
    form.onsubmit = async e => {
      e.preventDefault();
      if (busy || ctx !== c) return;
      const amount = type === 'fonla' ? Number(form.elements.amount.value) : null;
      const message = dialog.querySelector('[data-error]');
      try {
        if (type === 'fonla' && (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000000)) throw new Error('1–100.000.000.000 arasında tam sayı gir.');
        if (pending(c)) throw new Error('Önce sonucu beklenen eski işlemi doğrula.');
        const params = {p_oyun: game.kod, p_islem: type, p_miktar: amount, p_aktif: type === 'aktiflik' ? active : null, p_surum: game.surum, p_neden: form.elements.reason.value.trim(), p_request_id: crypto.randomUUID()};
        localStorage.setItem(storageKey(c), JSON.stringify(params)); // Failure stops before sending.
        busy = true;
        form.querySelectorAll('button').forEach(x => x.disabled = true);
        await c.rpc('yonetim_oyun_islem_v2', params);
        localStorage.removeItem(storageKey(c));
        dialog.close();
        if (ctx === c) { c.toast('İşlem kaydedildi.'); refresh(); }
      } catch (err) {
        // Keep uncertain outcomes. Replays reuse the original UUID and claims.
        busy = false;
        form.querySelectorAll('button').forEach(x => x.disabled = false);
        if (terminal(err)) localStorage.removeItem(storageKey(c));
        message.textContent = error(c, err) + (terminal(err) ? ' İşlem uygulanmadı.' : ' Sonuç bekleyen işlemi aynı kimlikle doğrulayabilirsin.');
        refresh();
      }
    };
    dialog.showModal();
  }
  async function load(params) {
    const c = ctx, ticket = ++epoch, root = mount();
    const current = () => ctx === c && epoch === ticket && root.isConnected;
    root.innerHTML = '<p role="status">Oyunlar ve kasa bilgileri yükleniyor…</p>';
    try {
      const inventory = await c.rpc('yonetim_oyun_merkezi');
      if (!current()) return;
      const games = inventory.oyunlar, code = params.get('oyun') || 'lagoon';
      const game = games.find(g => g.kod === code);
      if (!game) throw new Error('INVALID_GAME');
      const days = [1, 7, 30].includes(Number(params.get('gun'))) ? Number(params.get('gun')) : 1;
      const page = Math.max(0, Math.min(40000, Math.floor(Number(params.get('sayfa')) || 0)));
      const user = params.get('kullanici') || '', request = params.get('istek') || '';
      const resolvedUser = await resolveUser(c, user);
      if (!current()) return;
      const data = await c.rpc('yonetim_oyun_raporu_v2', {p_oyun: code, p_gun: days, p_offset: page * 25, p_user: resolvedUser, p_request: request || null});
      if (!current()) return;
      const go = next => { location.hash = 'oyun-kasasi?' + next.toString(); };
      const refresh = () => { if (ctx === c) load(new URLSearchParams(location.hash.split('?')[1] || '')); };
      const g = data.durum, m = data.metrikler || {}, saved = pending(c);
      root.innerHTML = `<header class="game-heading"><div><div class="eyebrow">PUFFY / OPERASYON</div><h1>Oyunlar</h1><p>${games.length} oyun · Kasa, sonuçlar ve işletim aynı yerde.</p></div><button data-refresh>Yenile</button></header>${saved ? '<aside class="game-warning" role="status">Sonucu beklenen bir yönetim işlemi var. Yeni işlem yapmadan doğrula. <button data-retry>Sonucu doğrula</button></aside>' : ''}<div class="game-layout"><aside class="game-selector"><label>Oyun ara<input data-search type="search" placeholder="Oyun adı"></label><div class="game-choice-list" role="navigation" aria-label="Oyun seçimi">${games.map(x => `<button data-game="${c.esc(x.kod)}" aria-pressed="${x.kod === code}" class="${x.kod === code ? 'selected' : ''}"><span>${c.esc(x.ad)}</span><small>${!x.hazir ? (['wild_west','mystical_forest'].includes(x.kod) ? 'Motor kurulumu bekleniyor' : 'Şema yok') : x.motor_aktif === false ? 'Motor kapalı' : x.gorunur == null ? 'Menü bayrağı yok' : x.gorunur ? 'Menü açık' : 'Menü kapalı'}</small></button>`).join('')}</div></aside><div class="game-content"><section class="game-surface"><div class="game-section-title"><div><span class="eyebrow">OYUN DURUMU</span><h2>${c.esc(g.ad)}</h2><p>Menü: ${g.gorunur == null ? 'Ayrı bayrak yok' : g.gorunur ? 'Açık' : 'Kapalı'} · Motor: ${g.motor_aktif == null ? 'Ayrı bayrak yok' : g.motor_aktif ? 'Açık' : 'Kapalı'}</p></div>${c.caps.owner && g.hazir && g.isletim_destegi && !saved ? `<div class="game-actions">${g.kasa ? '<button data-fund>Kasaya bütçe ekle</button>' : ''}<button data-toggle class="${(g.gorunur === true && g.motor_aktif !== false || g.gorunur == null && g.motor_aktif === true) ? 'danger' : 'primary'}">${(g.gorunur === true && g.motor_aktif !== false || g.gorunur == null && g.motor_aktif === true) ? 'Oyunu kapat' : 'Oyunu aç'}</button></div>` : ''}</div>${!g.hazir && ['wild_west','mystical_forest'].includes(g.kod) ? '<aside class="game-warning" role="status">Motor kurulumu bekleniyor. Bu oyunun kendi sunucu motoru henüz hazır değil; oyun açma, bonus ve kasa işlemleri kullanılamaz. Uygulama içindeki görsel güncellemeler için yeni uygulama sürümü gerekir.</aside>' : ''}<div class="game-metrics">${metric('Kasa', g.kasa?.bakiye, 'coin')}${metric('Ayrılan rezerv', g.rezerv_tanimli ? g.kasa.ayrilan : null, g.rezerv_tanimli ? 'Açık yükümlülük için' : 'Bu motor ayrı rezerv tutmuyor')}${metric('Kullanılabilir kasa', g.kullanilabilir, g.rezerv_tanimli ? 'Bakiye − rezerv' : 'Ödül garantisi anlamına gelmez')}${metric('Kalan ücretsiz tur', g.bonus?.ucretsiz_tur, `${number(g.bonus?.hak_sahibi)} hak sahibi`)}</div>${g.bahisler ? `<h3>Bahis uygunluğu</h3><div class="game-bets">${g.bahisler.map(x => `<span class="${x.kasa_uygun ? 'available' : 'blocked'}">${number(x.bahis)} <small>${x.kasa_uygun ? 'Kasa yeterli' : 'Kasa yetersiz'}</small></span>`).join('')}</div><p class="game-note">Yalnız şu anki kasa kontrolü. Yeni rezervler bu durumu değiştirebilir; oda ve oyuncu izinleri ayrıca uygulanır.</p>` : ''}</section><section class="game-surface"><form class="game-filters"><label>Dönem<select name="gun">${[1,7,30].map(x => `<option value="${x}" ${x === days ? 'selected' : ''}>Son ${x === 1 ? '24 saat' : x + ' gün'}</option>`).join('')}</select></label><label>Kullanıcı ID<input name="kullanici" value="${c.esc(user)}" placeholder="Örn. 141649 · isteğe bağlı"></label><label>İstek / tur kimliği<input name="istek" value="${c.esc(request)}" maxlength="80"></label><button class="primary">Filtrele</button></form><div class="game-metrics">${metric('Bahis', m.bahis, data.para_birimi === 'oyun puanı' ? 'Oyun puanı' : 'Coin defteri')}${metric('Ödeme', m.odeme, data.para_birimi === 'oyun puanı' ? 'Oyun puanı' : 'Coin defteri')}${metric('İade', m.iade, 'Coin defteri')}${metric('Coin neti', m.net, 'Kasa kârı değildir')}</div><p class="game-note">Gözlenen ödeme oranı: ${number(m.gozlenen_odeme_orani)}% · ${number(m.tur_sayisi)} kayıt${g.teorik_rtp != null ? ` · Teorik RTP: ${number(g.teorik_rtp)}%` : ''}</p>${data.mutabakat ? `<aside class="game-warning">Seçili işlem mutabakatı · Bahis farkı: ${number(data.mutabakat.bahis_farki)} · Ödeme farkı: ${number(data.mutabakat.odeme_farki)} coin. Sıfır fark, sonuç ve coin defterinin eşleştiğini gösterir.</aside>` : ''}${chart(c, data.grafik || [])}<details><summary>Grafik verileri</summary>${(data.grafik || []).map(x => `<p>${c.esc(x.gun)} · Bahis ${number(x.bahis)} · Ödeme ${number(x.odeme)}</p>`).join('') || '<p>Kayıt yok.</p>'}</details></section><section class="game-surface"><h2>Tur ve işlem kayıtları</h2>${recordTable(c, data.rows, g)}<div class="pager"><span>${number(data.total)} kayıt · Sayfa ${page + 1}</span><button data-prev ${page ? '' : 'disabled'}>Önceki</button><button data-next ${(page + 1) * 25 >= data.total ? 'disabled' : ''}>Sonraki</button></div></section><section class="game-surface"><h2>Coin defteri</h2><p class="game-note">Filtreyle eşleşen en son 50 hareket. Tur kimliği filtresiyle ödemenin kayıtlarını incele.</p><div class="game-table-wrap"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Coin</th><th>Referans</th></tr></thead><tbody>${(data.defter || []).map(x => `<tr><td>${c.esc(c.date(x.created_at))}</td><td>${c.esc(x.type)}</td><td>${number(x.amount)}</td><td><code>${c.esc(x.reference)}</code></td></tr>`).join('') || '<tr><td colspan="4">Hareket yok.</td></tr>'}</tbody></table></div></section><section class="game-surface"><h2>Yönetim işlemleri</h2>${(data.yonetim_gecmisi || []).map(x => `<article class="game-audit"><strong>${x.islem === 'fonla' ? '+' + number(x.miktar) + ' coin bütçe' : x.aktif ? 'Oyun açıldı' : 'Oyun kapatıldı'}</strong><p>${c.esc(x.neden)}</p><small>${c.esc(c.date(x.created_at))} · ${c.esc(x.actor)}</small></article>`).join('') || '<p class="game-empty">Bu modülde henüz işlem yapılmadı.</p>'}</section><footer class="game-note">Veri zamanı: ${c.esc(c.date(data.as_of))}. Finansal raporda kayıtlı test hesapları hariçtir. ${c.esc(data.not || 'Bu oyunun şeması bulunamadı.')}</footer></div></div>`;
      window.PuffyKemetAdmin?.render(root, c, g, refresh);
      root.querySelector('[data-refresh]').onclick = refresh;
      root.querySelectorAll('[data-game]').forEach(b => b.onclick = () => { const next = new URLSearchParams(params); next.set('oyun', b.dataset.game); next.delete('istek'); next.delete('sayfa'); go(next); });
      root.querySelector('[data-search]').oninput = e => root.querySelectorAll('[data-game]').forEach(b => b.hidden = !b.textContent.toLocaleLowerCase('tr').includes(e.target.value.toLocaleLowerCase('tr')));
      root.querySelector('.game-filters').onsubmit = e => {
        e.preventDefault();
        const p = new URLSearchParams(new FormData(e.target));
        if (p.get('kullanici') && !validUserFilter(p.get('kullanici').trim())) { c.toast('Puffy kullanıcı ID’si veya UUID gir.'); return; }
        p.set('kullanici', p.get('kullanici').trim());
        p.set('istek', p.get('istek').trim());
        p.set('oyun', code);
        go(p);
      };
      const changePage = n => { const p = new URLSearchParams(params); p.set('sayfa', n); go(p); };
      root.querySelector('[data-prev]').onclick = () => changePage(page - 1);
      root.querySelector('[data-next]').onclick = () => changePage(page + 1);
      root.querySelectorAll('[data-record]').forEach(b => b.onclick = () => detail(c, data.rows[Number(b.dataset.record)], () => { const row = data.rows[Number(b.dataset.record)], p = new URLSearchParams(params); p.set('oyun', code); p.set('istek', recordId(row, g)); if (row.user_id && uuid(row.user_id)) p.set('kullanici', row.user_id); p.delete('sayfa'); go(p); }));
      root.querySelector('[data-fund]')?.addEventListener('click', () => operation(c, g, 'fonla', refresh));
      root.querySelector('[data-toggle]')?.addEventListener('click', () => operation(c, g, 'aktiflik', refresh, !((g.gorunur === true && g.motor_aktif !== false || g.gorunur == null && g.motor_aktif === true))));
      root.querySelector('[data-retry]')?.addEventListener('click', async e => {
        e.target.disabled = true;
        try { await c.rpc('yonetim_oyun_islem_v2', saved); localStorage.removeItem(storageKey(c)); if (current()) refresh(); }
        catch (err) { if (current()) { if (terminal(err)) { localStorage.removeItem(storageKey(c)); refresh(); } c.toast(error(c, err)); e.target.disabled = false; } }
      });
    } catch (err) {
      if (!current()) return;
      root.innerHTML = `<div role="alert"><h2>Oyun bilgileri alınamadı</h2><p>${c.esc(error(c, err))}</p><button data-refresh>Tekrar dene</button></div>`;
      root.querySelector('[data-refresh]').onclick = () => load(params);
    }
  }
  function route(hash) {
    const [name, query] = hash.split('?');
    if (!['oyun-kasasi', 'oyun-turlari'].includes(name)) return false;
    if (!ctx?.caps.admin) { location.hash = 'ozet'; return true; }
    load(new URLSearchParams(query || ''));
    return true;
  }
  const old = window.PuffyKapsam;
  window.PuffyKapsam = {...old, init(c) { old.init(c); stop(); ctx = c; }, stop() { stop(); old.stop(); }, route(hash) { if (route(hash)) return true; epoch++; document.querySelectorAll('dialog.game-operation').forEach(x => x.close()); return old.route(hash); }};
  window.PuffyOyunMerkezi = {route, stop};
})();
