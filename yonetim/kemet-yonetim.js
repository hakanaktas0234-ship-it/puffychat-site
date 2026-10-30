/* Firavun: owner + aal2 on every RPC. Does not enable public play. */
(() => {
  'use strict';
  const allowedBets = [100, 500, 1000, 5000, 10000, 50000];
  const terminal = e => /^(INVALID_REQUEST|INVALID_BET|SETTING_VERSION_CONFLICT|ACTIVE_FREE_BET|IDEMPOTENCY_CONFLICT)$/.test(e.message || '');
  const message = (c, e) => ({ACTIVE_FREE_BET: 'Ücretsiz hakların bağlı olduğu bahis kaldırılamaz.', SETTING_VERSION_CONFLICT: 'Ayarlar değişti. Yenileyip tekrar inceleyin.'})[e.message] || c.errorText(e);
  async function render(root, c, game, refresh) {
    if (game.kod !== 'kemet' || !c.caps.owner) return;
    const panel = document.createElement('section');
    panel.className = 'game-surface kemet-admin';
    panel.setAttribute('aria-label', 'Firavun test yönetimi');
    root.querySelector('.game-content').prepend(panel);
    panel.innerHTML = '<p role="status">Firavun test ayarları yükleniyor…</p>';
    const key = `puffy.kemet.admin.v1.${c.user.id}`;
    try {
      const state = await c.rpc('yonetim_kemet_durum');
      if (!panel.isConnected) return;
      const pending = JSON.parse(localStorage.getItem(key) || 'null');
      panel.innerHTML = `<style>.kemet-admin form{display:grid;gap:16px;margin:24px 0}.kemet-admin form>label{display:grid;gap:8px}.kemet-admin fieldset{border:1px solid var(--line,#30343b);border-radius:10px;padding:14px}.kemet-admin .game-bets label{display:flex;align-items:center;gap:8px;padding:6px}.kemet-admin input[type=checkbox]{width:18px;min-height:18px;height:18px;accent-color:var(--gold,#d9b86a)}.kemet-admin pre{white-space:pre-wrap;overflow-wrap:anywhere}.kemet-admin details{padding:12px 0;border-bottom:1px solid var(--line,#30343b)}</style><div class="eyebrow">FİRAVUN TACI · KONTROLLÜ TEST</div><h2>${state.ayar.test_modu ? 'Platform sahibi testi açık' : 'Test erişimi kapalı'}</h2><p>Genel erişim kapalıdır. Testi yalnız platform sahibi hesabı kullanabilir. Testler gerçek coin bakiyesini değiştirir.</p><p class="game-note">Ödeme modeli henüz onaylanmadı. Gözlenen ödeme oranı, teorik RTP değildir.</p>${pending ? '<aside class="game-warning" role="status">Sonucu belirsiz bir ayar işlemi var. <button type="button" data-retry>İşlemi doğrula</button></aside>' : ''}<form data-settings><label>Erişim<select name="access" ${pending ? 'disabled' : ''}><option value="closed" ${!state.ayar.test_modu ? 'selected' : ''}>Kapalı</option><option value="owner" ${state.ayar.test_modu ? 'selected' : ''}>Yalnız platform sahibi testi</option></select></label><fieldset ${pending ? 'disabled' : ''}><legend>İzin verilen bahisler · coin</legend><div class="game-bets">${allowedBets.map(b => `<label><input type="checkbox" name="bet" value="${b}" ${state.ayar.bahisler.includes(b) ? 'checked' : ''}> ${b.toLocaleString('tr-TR')}</label>`).join('')}</div></fieldset><label>Değişiklik nedeni<input name="reason" required minlength="3" maxlength="300" ${pending ? 'disabled' : ''}></label><p role="alert" data-error></p><button class="primary" ${pending ? 'disabled' : ''}>Ayarları kaydet</button></form><h3>Test kayıtları</h3><p class="game-note">Son 25 dönüş ve bonus satın alımı; test hesapları burada dahildir. Genel finans raporunun filtreleri değişmez.</p><div data-rounds></div><h3>Ayar geçmişi</h3><div data-history></div>`;
      const rounds = panel.querySelector('[data-rounds]');
      for (const row of state.test_turlari || []) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const v = row.sonuc;
        summary.textContent = `${c.date(row.created_at)} · ${row.tur === 'bonus' ? 'Bonus satın alma' : 'Dönüş'} · ${row.istek_id} · ödeme ${v.payout || 0} coin`;
        const pre = document.createElement('pre'); pre.textContent = JSON.stringify(row, null, 2);
        details.append(summary, pre); rounds.append(details);
      }
      if (!rounds.childNodes.length) rounds.textContent = 'Henüz test işlemi yok.';
      const history = panel.querySelector('[data-history]');
      for (const row of state.gecmis || []) {
        const item = document.createElement('p');
        item.textContent = `${c.date(row.created_at)} · ${row.actor} · ${row.sonraki.test_modu ? 'Test açık' : 'Kapalı'} · ${row.neden}`;
        history.append(item);
      }
      if (!history.childNodes.length) history.textContent = 'Henüz ayar değişikliği yok.';
      let busy = false;
      const send = async params => {
        if (busy || !panel.isConnected) return;
        busy = true;
        panel.querySelectorAll('button').forEach(b => b.disabled = true);
        try {
          localStorage.setItem(key, JSON.stringify(params));
          await c.rpc('yonetim_kemet_kaydet', params);
          localStorage.removeItem(key);
          if (panel.isConnected) { c.toast('Firavun test ayarları kaydedildi.'); refresh(); }
        } catch (e) {
          if (terminal(e)) localStorage.removeItem(key);
          if (panel.isConnected) {
            panel.querySelector('[data-error]').textContent = message(c, e);
            // Refresh shows the saved original UUID for an uncertain outcome.
            const retry = document.createElement('button');
            retry.type = 'button'; retry.textContent = 'Güncel durumu getir'; retry.onclick = refresh;
            panel.querySelector('[data-error]').append(retry);
          }
        } finally { busy = false; }
      };
      panel.querySelector('[data-retry]')?.addEventListener('click', () => send(pending));
      panel.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (pending || busy) return;
        const form = e.target;
        const bets = [...form.querySelectorAll('[name="bet"]:checked')].map(x => Number(x.value));
        const reason = form.elements.reason.value.trim();
        if (!bets.length || reason.length < 3) { panel.querySelector('[data-error]').textContent = 'En az bir bahis seçin ve değişiklik nedenini yazın.'; return; }
        send({p_test: form.elements.access.value === 'owner', p_bahisler: bets, p_surum: state.surum, p_neden: reason, p_request_id: crypto.randomUUID()});
      };
    } catch (e) {
      if (!panel.isConnected) return;
      panel.replaceChildren();
      const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = message(c, e); panel.append(error);
    }
  }
  window.PuffyKemetAdmin = {render};
})();
