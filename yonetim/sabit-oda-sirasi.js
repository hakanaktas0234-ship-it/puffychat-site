(() => {
  'use strict';

  function validate(entries) {
    const rooms = new Set(), positions = new Set();
    for (const e of entries) {
      if (!/^[a-f0-9-]{36}$/i.test(e.oda) || !Number.isInteger(e.sira) || e.sira < 1 || e.sira > 100) {
        throw new Error('Her oda için 1–100 arasında tam sayı sıra seç.');
      }
      if (rooms.has(e.oda) || positions.has(e.sira)) {
        throw new Error('Aynı oda veya sıra iki kez kullanılamaz. Önce çakışan sırayı değiştir.');
      }
      rooms.add(e.oda);
      positions.add(e.sira);
    }
    return entries.length > 1 && [...positions].some((_, i) => !positions.has(i + 1));
  }

  function canonical(entries) {
    return JSON.stringify(
      [...entries]
        .map(x => ({ oda: x.oda, sira: x.sira }))
        .sort((a, b) => (a.sira - b.sira) || a.oda.localeCompare(b.oda))
    );
  }

  function slotLabel(pos) {
    if (!Number.isInteger(pos) || pos < 1 || pos > 100) return 'Geçersiz sıra (1–100)';
    const row = Math.floor((pos - 1) / 2) + 1;
    const side = pos % 2 ? 'sol' : 'sağ';
    const zone = pos <= 4 ? 'banner üstü' : 'banner altı';
    return `${pos}. kart · ${row}. satır ${side} (${zone})`;
  }

  function renderMfaPrompt(c, host, target, valid) {
    host.replaceChildren();
    target.textContent = 'Bu işlem son 15 dakika içinde doğrulama gerektiriyor. Yeni kodla doğrula, ardından Sıralamayı kaydet’e bas.';
    if (window.puffyPanelOturum?.reauth) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Güvenlik doğrulamasını yenile';
      b.onclick = () => { if (valid()) window.puffyPanelOturum.reauth(); };
      host.append(b);
      return;
    }
    const box = document.createElement('div');
    box.dataset.reauth = '';
    box.innerHTML = '<label>Authenticator kodu<input data-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" aria-label="Altı haneli doğrulama kodu"></label><button type="button" data-verify>Kodu doğrula</button><p data-mfa-status role="status"></p>';
    host.append(box);
    box.querySelector('[data-verify]').onclick = async () => {
      if (!valid()) return;
      const input = box.querySelector('[data-code]');
      const button = box.querySelector('[data-verify]');
      const mfaStatus = box.querySelector('[data-mfa-status]');
      const code = input.value.trim();
      if (!/^[0-9]{6}$/.test(code)) {
        mfaStatus.textContent = '6 haneli kodu gir.';
        return;
      }
      button.disabled = true;
      try {
        const factors = await c.sb.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        if (!valid()) return;
        const factor = (factors.data?.totp || []).find(f => f.status === 'verified');
        if (!factor) throw new Error('Doğrulayıcı bulunamadı. Panelden çıkıp yeniden giriş yap.');
        const result = await c.sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
        if (result.error) throw result.error;
        if (!valid()) return;
        input.value = '';
        box.remove();
        target.textContent = 'Doğrulama yenilendi. Bilgilerini kontrol edip Sıralamayı kaydet’e bas.';
      } catch (ex) {
        if (valid()) {
          mfaStatus.textContent = c.errorText(ex);
          input.value = '';
          button.disabled = false;
        }
      }
    };
  }

  function mount({ root, c, valid, onSaved }) {
    const section = document.createElement('section');
    section.className = 'room-cards-fixed';
    section.setAttribute('aria-label', 'Sabit oda sıralaması');
    section.innerHTML = [
      '<h2>Sabit oda sıralaması</h2>',
      '<p>Ana sayfa Popüler sekmesinde (2 sütunlu görünüm) istediğin odayı istediğin kart sırasına sabitle. 1–4. sıralar banner üstünde, 5. ve sonrası banner altında görünür.</p>',
      '<p data-fixed-status role="status">Yükleniyor…</p>',
      '<div data-picked class="fixed-picked-room" hidden></div>',
      '<div data-draft></div>',
      '<form data-find class="filters"><label>Oda adı veya ID ile bul<input name="query" required maxlength="100" placeholder="Örneğin 1989"></label><button>Odayı bul</button></form>',
      '<div data-results class="fixed-results"></div>',
      '<p data-warning role="alert"></p>',
      '<form data-save>',
      '<label>Değişiklik gerekçesi<input name="reason" minlength="3" maxlength="300" required placeholder="Örn. 5. sıra Müşteri Hizmetleri, 6. sıra Etkinlik Odası"></label>',
      '<label class="fixed-confirm"><input type="checkbox" name="confirmed" required> Önizlemeyi ve etkilenen odaları kontrol ettim.</label>',
      '<div class="fixed-save-actions"><button class="primary" disabled>Sıralamayı kaydet</button></div>',
      '</form>',
      '<div data-mfa-box></div>'
    ].join('');

    root.querySelector('header')?.after(section);
    if (!section.isConnected) root.prepend(section);
    section.querySelectorAll('button,input').forEach(x => { x.disabled = true; });

    let expected = null, draft = [], busy = false, searchRun = 0;
    const names = new Map();
    const alive = () => valid() && section.isConnected;
    const status = section.querySelector('[data-fixed-status]');
    const warning = section.querySelector('[data-warning]');
    const save = section.querySelector('[data-save]');
    const mfaBox = section.querySelector('[data-mfa-box]');
    const pickedHost = section.querySelector('[data-picked]');

    const errorText = e => ({
      SETTING_VERSION_CONFLICT: 'Sıralama başka bir işlemle değişti. Oda kartlarını yenileyip değişikliği tekrar incele.',
      CARD_VISIBILITY_CONFLICT: 'Bu oda ana sayfadan gizlendiği için sabitlenemiyor. Önce karttan görünürlüğünü aç.',
      ROOM_NOT_AVAILABLE: 'Kapalı, özel, banlı veya metin odası bu listeye eklenemez.',
      DUPLICATE_ROOM_OR_POSITION: 'Aynı oda veya sıra iki kez atanamaz.'
    }[e?.message] || c.errorText(e));

    function updateMeta() {
      const dirty = expected !== null && canonical(draft) !== canonical(expected);
      section.dataset.fixedDirty = String(dirty);
      const saveBtn = save.querySelector('button');
      try {
        const sparse = validate(draft);
        warning.textContent = sparse
          ? 'Mevcut eski APK’da aralarda boş konum bırakılarak birden fazla oda sabitlenince kartlar kayabilir. Güncel APK’da konumlar tam oturur.'
          : 'Sabitlenen odalar dinleyici sayısından bağımsız seçilen sırada kalır; boş kalsalar da gizlenmez. Diğer odalar doğal sırada listelenir.';
        saveBtn.disabled = busy || !dirty;
      } catch (e) {
        warning.textContent = e.message;
        saveBtn.disabled = true;
      }
    }

    function applyAssignment(row, sira) {
      if (!Number.isInteger(sira) || sira < 1 || sira > 100) {
        status.textContent = '1–100 arasında tam sayı sıra seç.';
        return false;
      }
      const candidate = [
        ...draft.filter(x => x.oda !== row.id),
        { oda: row.id, sira }
      ].sort((a, b) => a.sira - b.sira);
      try {
        validate(candidate);
        draft = candidate;
        names.set(row.id, row);
        save.elements.confirmed.checked = false;
        status.textContent = 'Taslak değişti; henüz kaydedilmedi.';
        draw();
        return true;
      } catch (ex) {
        status.textContent = ex.message;
        return false;
      }
    }

    function draw() {
      const host = section.querySelector('[data-draft]');
      host.replaceChildren();
      const sorted = [...draft].sort((a, b) => (a.sira - b.sira) || a.oda.localeCompare(b.oda));
      if (sorted.length) {
        const table = document.createElement('table');
        table.className = 'fixed-rooms-table';
        const head = document.createElement('tr');
        for (const label of ['Kart sırası', 'Ana sayfa yeri', 'Oda', 'İşlem']) {
          const th = document.createElement('th');
          th.textContent = label;
          head.append(th);
        }
        table.append(head);

        for (const e of sorted) {
          const tr = document.createElement('tr');
          const posInputTd = document.createElement('td');
          const posPlaceTd = document.createElement('td');
          const roomTd = document.createElement('td');
          const actionTd = document.createElement('td');

          const identity = names.get(e.oda);
          const roomLabel = identity ? `${identity.name} · #${identity.display_id}` : e.oda;

          const input = document.createElement('input');
          input.type = 'number';
          input.min = '1';
          input.max = '100';
          input.step = '1';
          input.className = 'fixed-room-inline-input';
          input.value = String(e.sira);
          input.disabled = busy;
          input.setAttribute('aria-label', `${roomLabel} kart sırası`);
          input.oninput = () => {
            const next = Number(input.value);
            e.sira = input.value.trim() !== '' && Number.isInteger(next) ? next : NaN;
            posPlaceTd.textContent = slotLabel(e.sira);
            save.elements.confirmed.checked = false;
            status.textContent = 'Taslak değişti; henüz kaydedilmedi.';
            updateMeta();
          };
          input.onchange = () => { if (!busy && alive()) draw(); };
          posInputTd.append(input);

          posPlaceTd.textContent = slotLabel(e.sira);
          roomTd.textContent = roomLabel;

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.textContent = 'Sabitlemeyi kaldır';
          remove.disabled = busy;
          remove.onclick = () => {
            draft = draft.filter(x => x.oda !== e.oda);
            save.elements.confirmed.checked = false;
            status.textContent = 'Taslak değişti; henüz kaydedilmedi.';
            draw();
          };
          actionTd.append(remove);

          tr.append(posInputTd, posPlaceTd, roomTd, actionTd);
          table.append(tr);
        }
        host.append(table);
      } else {
        const p = document.createElement('p');
        p.className = 'fixed-empty';
        p.textContent = 'Sabit oda yok; tüm odalar doğal sıralamada.';
        host.append(p);
      }
      updateMeta();
    }

    function pickRoom(row) {
      if (!row || busy || !alive()) return;
      names.set(row.id, row);
      pickedHost.replaceChildren();
      pickedHost.hidden = false;

      const form = document.createElement('form');
      form.className = 'filters';
      const title = document.createElement('strong');
      title.textContent = `Seçilen oda: ${row.name} · #${row.display_id}`;
      const label = document.createElement('label');
      label.textContent = 'Kart sırası (1–100)';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '100';
      input.step = '1';
      input.required = true;
      input.placeholder = '1–100';
      const existing = draft.find(x => x.oda === row.id);
      if (existing && Number.isInteger(existing.sira)) input.value = String(existing.sira);
      input.setAttribute('aria-label', `${row.name} kart sırası`);
      label.append(input);

      const addBtn = document.createElement('button');
      addBtn.className = 'primary';
      addBtn.textContent = existing ? 'Sırasını değiştir' : 'Taslağa ekle';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'Kapat';
      closeBtn.onclick = () => {
        pickedHost.hidden = true;
        pickedHost.replaceChildren();
      };

      form.append(title, label, addBtn, closeBtn);
      form.onsubmit = event => {
        event.preventDefault();
        if (applyAssignment(row, Number(input.value))) {
          pickedHost.hidden = true;
          pickedHost.replaceChildren();
        }
      };
      pickedHost.append(form);
      section.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      input.focus?.();
    }

    section.querySelector('[data-find]').onsubmit = async e => {
      e.preventDefault();
      if (busy || !alive()) return;
      const run = ++searchRun;
      const form = e.currentTarget;
      const query = form.elements.query.value.trim();
      const host = section.querySelector('[data-results]');
      host.textContent = 'Aranıyor…';
      try {
        const data = await c.rpc('yonetim_oda_kartlari', { p_arama: query, p_limit: 25, p_offset: 0 });
        if (!alive() || run !== searchRun) return;
        host.replaceChildren();
        for (const row of data.rows) {
          const itemForm = document.createElement('form');
          itemForm.className = 'filters';
          const title = document.createElement('span');
          const hiddenNote = row.durum?.mod === 'gizli' ? ' · Gizli (önce görünür yap)' : '';
          title.textContent = `${row.name} · #${row.display_id}${hiddenNote}`;
          const label = document.createElement('label');
          label.textContent = 'Kart sırası';
          const input = document.createElement('input');
          input.type = 'number';
          input.min = '1';
          input.max = '100';
          input.step = '1';
          input.required = true;
          input.setAttribute('aria-label', `${row.name} kart sırası`);
          const existing = draft.find(x => x.oda === row.id);
          if (existing && Number.isInteger(existing.sira)) input.value = String(existing.sira);
          label.append(input);
          const add = document.createElement('button');
          add.textContent = 'Taslağa ekle / değiştir';
          itemForm.append(title, label, add);
          host.append(itemForm);
          itemForm.onsubmit = event => {
            event.preventDefault();
            if (busy || !alive()) return;
            applyAssignment(row, Number(input.value));
          };
        }
        if (!data.rows.length) host.textContent = 'Oda bulunamadı.';
        else if (data.total > data.rows.length) {
          const p = document.createElement('p');
          p.textContent = 'İlk 25 sonuç gösteriliyor. Tam oda ID’si ile aramayı daralt.';
          host.append(p);
        }
      } catch (ex) {
        if (alive() && run === searchRun) host.textContent = errorText(ex);
      }
    };

    save.onsubmit = async e => {
      e.preventDefault();
      if (busy || !alive() || save.querySelector('button').disabled) return;
      try {
        validate(draft);
      } catch (ex) {
        status.textContent = ex.message;
        return;
      }
      mfaBox.replaceChildren();
      busy = true;
      searchRun++;
      section.querySelectorAll('button,input').forEach(x => { x.disabled = true; });
      const payload = [...draft].sort((a, b) => (a.sira - b.sira) || a.oda.localeCompare(b.oda));
      try {
        const r = await c.rpc('yonetim_sabit_oda_sirasi_kaydet', {
          p_entries: payload,
          p_expected: expected,
          p_reason: save.elements.reason.value.trim()
        });
        if (!alive()) return;
        if (r?.ok !== true) throw new Error('Kaydedilemedi.');
        c.toast('Sabit oda sıralaması kaydedildi.');
        onSaved();
      } catch (ex) {
        if (alive()) {
          if (String(ex?.message || ex).includes('MFA_REAUTH_REQUIRED')) {
            renderMfaPrompt(c, mfaBox, status, alive);
          } else {
            status.textContent = errorText(ex);
          }
        }
      } finally {
        busy = false;
        if (alive()) {
          section.querySelectorAll('button,input').forEach(x => { x.disabled = false; });
          draw();
        }
      }
    };

    c.rpc('yonetim_sabit_oda_sirasi', {}).then(data => {
      if (!alive()) return;
      validate(data.entries);
      expected = JSON.parse(JSON.stringify(data.entries));
      draft = JSON.parse(JSON.stringify(data.entries));
      for (const row of (data.rooms || [])) names.set(row.id, row);
      section.querySelectorAll('button,input').forEach(x => { x.disabled = false; });
      status.textContent = 'Mevcut sabitlemeler. Değişiklikler yalnız Kaydet ile uygulanır.';
      draw();
    }).catch(e => {
      if (alive()) status.textContent = errorText(e);
    });

    return { pickRoom };
  }

  window.PuffyFixedRoomManagement = { mount, validate };
})();
