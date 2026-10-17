(() => {
  'use strict';
  function cents(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error('Geçersiz tutar.');
    return Math.round(n * 100);
  }
  const day = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(value));
  function summarize(rows, snapshot, start, end) {
    if (start && end && start > end) throw new Error('Geçersiz tarih aralığı.');
    let debt = rows.length ? cents(rows[0].onceki_borc_usd) : cents(snapshot.borc_usd);
    const openingDebt = debt;
    const ids = new Set();
    let previousTime = -Infinity;
    for (const row of rows) {
      const time = Date.parse(row.created_at);
      if (!row.request_id || ids.has(row.request_id) || !Number.isFinite(time) || time < previousTime) {
        throw new Error('Eksik veya tekrarlanan hareket; ekstre oluşturulmadı.');
      }
      ids.add(row.request_id);
      previousTime = time;
      if (!['limit', 'stok', 'tahsilat'].includes(row.tur) ||
          !['TRY', 'USD'].includes(row.para_birimi) ||
          cents(row.onceki_borc_usd) !== debt ||
          cents(row.sonraki_borc_usd) - debt !== cents(row.borc_farki_usd)) {
        throw new Error('Hareketler birbiriyle uyuşmuyor; ekstre oluşturulmadı.');
      }
      debt = cents(row.sonraki_borc_usd);
    }
    if (debt !== cents(snapshot.borc_usd)) throw new Error('Son borç uyuşmuyor.');
    let opening = openingDebt, closing = openingDebt, stock = 0, payment = 0, coin = 0;
    const paid = { USD: 0, TRY: 0 };
    const selected = [];
    for (const row of rows) {
      const date = day(row.created_at);
      if (start && date < start) { opening = cents(row.sonraki_borc_usd); closing = opening; continue; }
      if (end && date > end) continue;
      selected.push(row);
      closing = cents(row.sonraki_borc_usd);
      if (row.tur === 'stok') {
        if (cents(row.borc_farki_usd) <= 0 || !Number.isSafeInteger(Number(row.coin)) || Number(row.coin) <= 0) throw new Error('Geçersiz stok hareketi.');
        stock += cents(row.borc_farki_usd); coin += Number(row.coin);
      }
      if (row.tur === 'tahsilat') {
        if (cents(row.borc_farki_usd) >= 0) throw new Error('Geçersiz ödeme hareketi.');
        payment -= cents(row.borc_farki_usd); paid[row.para_birimi] += cents(row.tutar);
      }
    }
    if (opening + stock - payment !== closing) throw new Error('Dönem toplamları uyuşmuyor.');
    return { selected, opening: opening / 100, closing: closing / 100,
      stock: stock / 100, payment: payment / 100, coin,
      paid: { USD: paid.USD / 100, TRY: paid.TRY / 100 } };
  }
  function filename(dealer, displayId, start, end) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(dealer)) throw new Error('Geçersiz bayi kimliği.');
    const label = String(displayId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    return `Puffy-Bayi-${label}-${dealer}-${start || 'ilk'}-${end || 'bugun'}.pdf`;
  }
  function period(kind, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const part = key => Number(parts.find(p => p.type === key).value);
    const year = part('year'), month = part('month'), today = part('day');
    const key = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
    const end = key(year, month, today);
    switch (kind) {
      case 'month': return { start: key(year, month, 1), end };
      case 'previous': return { start: key(year, month - 1, 1), end: key(year, month, 0) };
      case 'thirty': return { start: key(year, month, today - 29), end };
      case 'all': return { start: '', end };
      default: throw new Error('Geçersiz dönem.');
    }
  }
  function periodLabel(start, end) {
    const pretty = key => new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(key + 'T12:00:00Z'));
    return (start ? pretty(start) : 'İlk hareket') + ' — ' + (end ? pretty(end) : 'Bugün');
  }
  window.PuffyStatementCore = { summarize, filename, period, periodLabel };
})();
