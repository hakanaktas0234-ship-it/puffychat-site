const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const siteRoot = path.join(__dirname, '../..');
const readSite = (rel) => fs.readFileSync(path.join(siteRoot, rel), 'utf8');

const ROOM_UUID = '8a7d6e64-05dd-4263-aef8-eb5614ba2c07';
const ROOM_DISPLAY_ID = '1042';
const ADMIN_GHOST_ID = 'ffffffff-f123-4123-8123-123456789012';
const USER_UID = '11111111-1111-4111-8111-111111111111';

test('LiveKit vendor paketi, SHA-256/SRI özeti, CSP connect-src ve zero-publish kuralları sağlanır', () => {
  const vendorRel = 'yonetim/vendor/livekit-client-2.11.4.umd.js';
  const vendorBytes = fs.readFileSync(path.join(siteRoot, vendorRel));
  const sha384 = 'sha384-' + crypto.createHash('sha384').update(vendorBytes).digest('base64');
  const sha256 = crypto.createHash('sha256').update(vendorBytes).digest('hex');

  const kaynakTxt = readSite('yonetim/vendor/livekit-client-2.11.4.KAYNAK.txt');
  assert.ok(kaynakTxt.includes(sha256), 'livekit-client KAYNAK.txt SHA-256 uyuşmuyor');

  const odaDinleSrc = readSite('yonetim/oda-dinle.js');
  assert.ok(odaDinleSrc.includes(`LK_SRI='${sha384}'`), 'oda-dinle.js LK_SRI güncel değil');
  assert.doesNotMatch(odaDinleSrc, /startPublishingStream|createStream|getUserMedia/);
  assert.doesNotMatch(odaDinleSrc, /\son(click|error|load)="/);

  const html = readSite('yonetim/index.html');
  const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(cspMatch, 'CSP meta etiketi eksik');
  assert.ok(cspMatch[1].includes('https://rtc.puffychat.com'), 'CSP https://rtc.puffychat.com eksik');
  assert.ok(cspMatch[1].includes('wss://rtc.puffychat.com'), 'CSP wss://rtc.puffychat.com eksik');
  assert.ok(cspMatch[1].includes('https://*.livekit.cloud'), 'CSP https://*.livekit.cloud eksik');
  assert.ok(cspMatch[1].includes('wss://*.livekit.cloud'), 'CSP wss://*.livekit.cloud eksik');
});

function createOdaDinleHarness({
  rtcMotoruValue = null,
  rtcInvokeHandler,
  zegoInvokeHandler,
} = {}) {
  const loadedScripts = [];
  const invokedFunctions = [];
  const lkConnections = [];
  const zegoLogins = [];

  const makeAudioEl = () => ({
    tag: 'audio',
    autoplay: false,
    srcObject: null,
    volume: 1,
    paused: false,
    removed: false,
    pause() {
      this.paused = true;
    },
    remove() {
      this.removed = true;
      this._parent?.removeChild?.(this);
    },
    play: async () => {},
  });

  const makeContainer = () => {
    const c = {
      children: [],
      hidden: false,
      innerHTML: '',
      textContent: '',
      scrollHeight: 100,
      scrollTop: 0,
      clientHeight: 100,
      get firstElementChild() {
        return this.children[0] || null;
      },
      append(node) {
        node._parent = this;
        this.children.push(node);
      },
      removeChild(node) {
        const idx = this.children.indexOf(node);
        if (idx >= 0) this.children.splice(idx, 1);
      },
    };
    return c;
  };

  let lastDialog = null;
  const dialogs = [];

  const createDialog = () => {
    const nodes = {
      '[data-ad]': makeContainer(),
      '[data-durum]': makeContainer(),
      '[data-kapat]': { onclick: null },
      '[data-ses]': { value: '80', oninput: null },
      '[data-koltuklar]': makeContainer(),
      '[data-sohbet]': makeContainer(),
      '[data-kisiler]': Object.assign(makeContainer(), { hidden: true }),
      '[data-kisisay]': makeContainer(),
      '[data-sesler]': Object.assign(makeContainer(), { hidden: true }),
    };
    const tabs = [
      { dataset: { sek: 'sohbet' }, classList: { toggle() {} }, onclick: null },
      { dataset: { sek: 'kisiler' }, classList: { toggle() {} }, onclick: null },
    ];
    const dlg = {
      className: '',
      open: false,
      isConnected: false,
      onclose: null,
      _innerHTML: '',
      nodes,
      set innerHTML(v) {
        this._innerHTML = v;
      },
      get innerHTML() {
        return this._innerHTML;
      },
      showModal() {
        this.open = true;
        this.isConnected = true;
      },
      close() {
        this.open = false;
      },
      remove() {
        this.isConnected = false;
      },
      querySelector(sel) {
        return nodes[sel] || makeContainer();
      },
      querySelectorAll(sel) {
        return sel === '[data-sek]' ? tabs : [];
      },
    };
    lastDialog = dlg;
    dialogs.push(dlg);
    return dlg;
  };

  const windowObj = {
    location: { href: 'https://panel.puffychat.com/yonetim/' },
    puffyPanelOturum: { active: true, epoch: 1 },
    PuffyHata: { kaydet() {} },
    addEventListener() {},
  };

  class FakeLivekitRoom {
    constructor(opts) {
      this.opts = opts;
      this.handlers = new Map();
      this.remoteParticipants = new Map();
      this.engine = { token: null };
      this.disconnected = false;
      this.connectArgs = null;
      lkConnections.push(this);
    }
    on(event, fn) {
      if (!this.handlers.has(event)) this.handlers.set(event, []);
      this.handlers.get(event).push(fn);
    }
    emit(event, ...args) {
      for (const fn of this.handlers.get(event) || []) {
        fn(...args);
      }
    }
    async connect(server, token, options) {
      this.engine.token = token;
      this.connectArgs = { server, token, options };
    }
    async disconnect() {
      this.disconnected = true;
    }
  }

  class FakeZegoEngine {
    constructor(appId, server) {
      this.appId = appId;
      this.server = server;
      this.destroyed = false;
      this.loggedOut = false;
      zegoLogins.push(this);
    }
    setDebugVerbose() {}
    setSoundLevelDelegate() {}
    on() {}
    async loginRoom(room, token, user, opts) {
      this.loginArgs = { room, token, user, opts };
      return true;
    }
    async logoutRoom() {
      this.loggedOut = true;
    }
    destroyEngine() {
      this.destroyed = true;
    }
  }

  const documentObj = {
    body: { append() {} },
    head: {
      append(scriptEl) {
        loadedScripts.push({
          src: scriptEl.src,
          integrity: scriptEl.integrity,
          crossOrigin: scriptEl.crossOrigin,
        });
        if (scriptEl.src.includes('livekit-client')) {
          windowObj.LivekitClient = { Room: FakeLivekitRoom };
        } else if (scriptEl.src.includes('zego-web')) {
          windowObj.ZegoExpressEngine = FakeZegoEngine;
        }
        queueMicrotask(() => scriptEl.onload?.());
      },
    },
    createElement(tag) {
      if (tag === 'dialog') return createDialog();
      if (tag === 'p') return { className: '', innerHTML: '', remove() {} };
      if (tag === 'audio') return makeAudioEl();
      if (tag === 'script') {
        return { src: '', integrity: '', crossOrigin: '', onload: null, onerror: null, remove() {} };
      }
      return makeContainer();
    },
    addEventListener() {},
  };

  vm.runInNewContext(readSite('yonetim/oda-dinle.js'), {
    window: windowObj,
    document: documentObj,
    location: windowObj.location,
    Date,
    URL,
    Set,
    Map,
    Promise,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Number,
    String,
    Math,
    JSON,
    RegExp,
    Error,
    Object,
    Array,
  });

  const client = {
    caps: { admin: true },
    sb: {
      rpc: async (name) => {
        if (name === 'yonetim_oda_ekran_bilgisi') {
          return {
            data: { aktif: true, name: 'Vip Oda', display_id: Number(ROOM_DISPLAY_ID), seat_count: 10 },
            error: null,
          };
        }
        if (name === 'yonetim_oda_gozlem') {
          return { data: { total: 1, rows: [] }, error: null };
        }
        if (name === 'yonetim_kisi_ozetleri') {
          return { data: {}, error: null };
        }
        return { data: {}, error: null };
      },
      from: (table) => ({
        select: () => ({
          eq: (_col, key) => ({
            maybeSingle: async () => {
              if (table === 'platform_settings' && key === 'rtc_motoru') {
                return { data: rtcMotoruValue == null ? null : { value: rtcMotoruValue }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
      functions: {
        invoke: async (fnName, opts) => {
          invokedFunctions.push({ fnName, body: opts?.body });
          if (fnName === 'yonetim-oda-dinle-rtc') {
            if (rtcInvokeHandler) return rtcInvokeHandler(opts);
            return {
              data: {
                engine: 'puffy_rtc',
                token: 'lk_jwt_token',
                user_id: ADMIN_GHOST_ID,
                room_id: ROOM_DISPLAY_ID,
                room_uuid: ROOM_UUID,
                server: 'wss://rtc.puffychat.com',
                expires_in: 120,
              },
              error: null,
            };
          }
          if (fnName === 'yonetim-oda-dinle') {
            if (zegoInvokeHandler) return zegoInvokeHandler(opts);
            return {
              data: {
                token: 'zego_token',
                user_id: ADMIN_GHOST_ID,
                room_id: ROOM_DISPLAY_ID,
                room_uuid: ROOM_UUID,
                app_id: 123456,
                server: 'wss://webliveroom123456-api.coolzcloud.com/ws',
                expires_in: 120,
              },
              error: null,
            };
          }
          throw new Error(`Unexpected function invoke: ${fnName}`);
        },
      },
    },
  };

  return {
    api: windowObj.PuffyOdaDinle,
    client,
    loadedScripts,
    invokedFunctions,
    lkConnections,
    zegoLogins,
    getLastDialog: () => lastDialog,
    makeAudioEl,
  };
}

test('varsayılan rtc_motoru boş veya zego ise PuffyOdaDinle Zego yolunu seçer', async () => {
  for (const val of [null, '', 'zego']) {
    const h = createOdaDinleHarness({ rtcMotoruValue: val });
    try {
      await h.api.ac(h.client, ROOM_UUID, 'Oda');
      assert.deepEqual(
        h.invokedFunctions.map((x) => x.fnName),
        ['yonetim-oda-dinle'],
      );
      assert.equal(h.zegoLogins.length, 1);
      assert.equal(h.lkConnections.length, 0);
    } finally {
      h.api.kapat();
    }
  }
});

test('kanarya (oda:1042) ve küresel (puffy_rtc) LiveKit UMD + SRI yükler ve autoSubscribe bağlanır', async () => {
  const odaDinleSrc = readSite('yonetim/oda-dinle.js');
  const expectedSri = odaDinleSrc.match(/LK_SRI='([^']+)'/)[1];

  for (const val of ['oda:1042', 'puffy_rtc']) {
    const h = createOdaDinleHarness({ rtcMotoruValue: val });
    try {
      await h.api.ac(h.client, ROOM_UUID, 'Oda');
      assert.deepEqual(
        h.invokedFunctions.map((x) => x.fnName),
        ['yonetim-oda-dinle-rtc'],
      );
      assert.equal(h.loadedScripts.length, 1);
      assert.equal(h.loadedScripts[0].src, 'vendor/livekit-client-2.11.4.umd.js');
      assert.equal(h.loadedScripts[0].integrity, expectedSri);
      assert.equal(h.loadedScripts[0].crossOrigin, 'anonymous');
      assert.equal(h.lkConnections.length, 1);
      assert.deepEqual(
        JSON.parse(JSON.stringify(h.lkConnections[0].connectArgs)),
        {
          server: 'wss://rtc.puffychat.com',
          token: 'lk_jwt_token',
          options: { autoSubscribe: true },
        },
      );
      assert.equal(h.zegoLogins.length, 0);
    } finally {
      h.api.kapat();
    }
  }
});

test('yonetim-oda-dinle-rtc 503 PUSH_NOT_CONFIGURED dönerse otomatik Zego yedeğine düşer', async () => {
  const h = createOdaDinleHarness({
    rtcMotoruValue: 'puffy_rtc',
    rtcInvokeHandler: async () => ({
      data: { error: 'PUSH_NOT_CONFIGURED' },
      error: { context: { status: 503, json: async () => ({ error: 'PUSH_NOT_CONFIGURED' }) } },
    }),
  });
  try {
    await h.api.ac(h.client, ROOM_UUID, 'Oda');
    assert.deepEqual(
      h.invokedFunctions.map((x) => x.fnName),
      ['yonetim-oda-dinle-rtc', 'yonetim-oda-dinle'],
    );
    assert.equal(h.zegoLogins.length, 1);
    assert.equal(h.lkConnections.length, 0);
  } finally {
    h.api.kapat();
  }
});

test('trackSubscribed <audio> ekler, ffffffff-f/puffy.music filtrelenir, kapat() tümünü temizler', async () => {
  const h = createOdaDinleHarness({ rtcMotoruValue: 'puffy_rtc' });
  await h.api.ac(h.client, ROOM_UUID, 'Oda');

  const lkRoom = h.lkConnections[0];
  const dlg = h.getLastDialog();
  const sesler = dlg.nodes['[data-sesler]'];
  const sohbet = dlg.nodes['[data-sohbet]'];
  const koltuklar = dlg.nodes['[data-koltuklar]'];

  let detached = false;
  const fakeTrack = {
    kind: 'audio',
    attach: () => h.makeAudioEl(),
    detach: () => {
      detached = true;
    },
  };

  lkRoom.emit(
    'trackSubscribed',
    fakeTrack,
    { trackName: `stream_${USER_UID}_s0`, trackSid: 'tr0', muted: false },
    { identity: USER_UID },
  );

  assert.equal(sesler.children.length, 1);
  assert.ok(koltuklar.innerHTML.includes('oe-koltuk dolu'));

  const initialChatCount = sohbet.children.length;
  // Admin ghost sender and music control topic must be ignored
  lkRoom.emit(
    'dataReceived',
    new TextEncoder().encode(JSON.stringify({ m: JSON.stringify({ t: 'chat', k: 'txt', m: 'gizli' }) })),
    { identity: ADMIN_GHOST_ID, name: 'Admin' },
    null,
    'puffy.bc',
  );
  lkRoom.emit(
    'dataReceived',
    new TextEncoder().encode(JSON.stringify({ t: 'music_prog', pos: 1000 })),
    { identity: `musicbot_${USER_UID}`, name: 'Puffy Music' },
    null,
    'puffy.music',
  );
  assert.equal(sohbet.children.length, initialChatCount);

  // Normal user broadcast renders cleanly
  lkRoom.emit(
    'dataReceived',
    new TextEncoder().encode(
      JSON.stringify({
        m: JSON.stringify({ t: 'chat', k: 'txt', name: 'Ayşe', m: 'merhaba oda' }),
        t: Date.now(),
      }),
    ),
    { identity: USER_UID, name: 'Ayşe' },
    null,
    'puffy.bc',
  );
  assert.equal(sohbet.children.length, initialChatCount + 1);
  assert.ok(sohbet.children.at(-1).innerHTML.includes('merhaba oda'));

  // kapat() cleanly detaches track, removes <audio>, and disconnects room
  h.api.kapat();
  assert.equal(detached, true);
  assert.equal(sesler.children.length, 0);
  assert.equal(lkRoom.disconnected, true);
});

test('ayarlar.js rtc_motoru alanını sunar, satır içi olay işleyicisi içermez ve index.html sürüm etiketleri günceldir', () => {
  const ayarlarSrc = readSite('yonetim/ayarlar.js');
  assert.ok(ayarlarSrc.includes("'rtc_motoru'"), 'ayarlar.js rtc_motoru alanı eksik');
  assert.doesNotMatch(ayarlarSrc, /\son(click|error|load|submit|change)="/);

  const html = readSite('yonetim/index.html');
  assert.ok(html.includes('oda-dinle.js?v=20261115rtc1'), 'oda-dinle.js sürüm etiketi güncel değil');
  assert.ok(html.includes('ayarlar.js?v=20261115rtc1'), 'ayarlar.js sürüm etiketi güncel değil');
});

test('motorSec acik ve canary:<id> ayarlarında Puffy RTC seçer, eşleşmeyen canary Zego kullanır', async () => {
  for (const val of ['acik', `canary:${ROOM_DISPLAY_ID},9999`]) {
    const h = createOdaDinleHarness({ rtcMotoruValue: val });
    try {
      await h.api.ac(h.client, ROOM_UUID, 'Canary Oda');
      assert.equal(h.lkConnections.length, 1, `${val} için Puffy RTC bağlanmalıydı`);
      assert.equal(h.zegoLogins.length, 0);
    } finally {
      h.api.kapat();
    }
  }

  const hMiss = createOdaDinleHarness({ rtcMotoruValue: 'canary:9999' });
  try {
    await hMiss.api.ac(hMiss.client, ROOM_UUID, 'Canary Hariç');
    assert.equal(hMiss.lkConnections.length, 0);
    assert.equal(hMiss.zegoLogins.length, 1);
  } finally {
    hMiss.api.kapat();
  }
});

test('trackSubscribed LiveKit 2.11.4 pub.isMuted alanını MUTE/OPEN olarak yansıtır ve bilet yenileme engine.token günceller', async () => {
  let ticketSeq = 0;
  const h = createOdaDinleHarness({
    rtcMotoruValue: 'acik',
    rtcInvokeHandler: async () => {
      ticketSeq++;
      return {
        data: {
          engine: 'puffy_rtc',
          token: `lk_jwt_${ticketSeq}`,
          user_id: ADMIN_GHOST_ID,
          room_id: ROOM_DISPLAY_ID,
          room_uuid: ROOM_UUID,
          server: 'wss://rtc.puffychat.com',
          expires_in: 31,
        },
        error: null,
      };
    },
  });

  try {
    await h.api.ac(h.client, ROOM_UUID, 'Oda');
    const lkRoom = h.lkConnections[0];
    const dlg = h.getLastDialog();
    const koltuklar = dlg.nodes['[data-koltuklar]'];

    const fakeTrack = {
      kind: 'audio',
      attach: () => h.makeAudioEl(),
      detach: () => {},
    };

    lkRoom.emit(
      'trackSubscribed',
      fakeTrack,
      { trackName: `stream_${USER_UID}_s0`, trackSid: 'tr0', isMuted: true },
      { identity: USER_UID },
    );
    assert.ok(koltuklar.innerHTML.includes('oe-mic kapali'), 'isMuted:true mikrofon kapalı göstermeliydi');

    lkRoom.emit('trackUnmuted', { trackSid: 'tr0' }, { identity: USER_UID });
    assert.ok(koltuklar.innerHTML.includes('oe-mic acik'));
    assert.equal(koltuklar.innerHTML.includes('oe-mic kapali'), false);

    assert.equal(lkRoom.engine.token, 'lk_jwt_1');
    await new Promise((r) => setTimeout(r, 1150));
    assert.ok(ticketSeq >= 2, 'Bilet yenileme zamanlayıcısı çalışmalıydı');
    assert.equal(lkRoom.engine.token, 'lk_jwt_2');
  } finally {
    h.api.kapat();
  }
});
