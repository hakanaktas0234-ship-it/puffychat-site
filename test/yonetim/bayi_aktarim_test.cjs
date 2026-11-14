const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const yonetimDir = path.join(__dirname, '../../yonetim');
const readYonetim = f => fs.readFileSync(path.join(yonetimDir, f), 'utf8');

const VOID_TAGS = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);

function parseAttrs(raw) {
  const attrs = new Map();
  const re = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs.set(m[1], m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.attributes = new Map();
    this.value = '';
    this.name = '';
    this.disabled = false;
    this.hidden = false;
    this._text = '';
    this._html = '';
    this._classSet = new Set();
    this.classList = {
      add: c => { this._classSet.add(c); },
      remove: c => { this._classSet.delete(c); },
      toggle: (c, force) => {
        const has = force === undefined ? !this._classSet.has(c) : Boolean(force);
        if (has) this._classSet.add(c); else this._classSet.delete(c);
        return has;
      },
      contains: c => this._classSet.has(c)
    };
  }
  get className() { return [...this._classSet].join(' '); }
  set className(val) { this._classSet = new Set(String(val || '').split(/\s+/).filter(Boolean)); }
  get isConnected() {
    let p = this;
    while (p.parent) p = p.parent;
    return p.tagName === 'DOCUMENT';
  }
  setAttribute(k, v) {
    const val = String(v);
    this.attributes.set(k, val);
    if (k === 'id') this.id = val;
    if (k === 'class') {
      this._classSet = new Set(val.split(/\s+/).filter(Boolean));
      this.className = val;
    }
    if (k === 'value') this.value = val;
    if (k === 'name') this.name = val;
    if (k === 'disabled') this.disabled = true;
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = val;
    }
  }
  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') { this._text += n; continue; }
      n.parent = this;
      this.children.push(n);
    }
  }
  prepend(...nodes) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (typeof n !== 'string') { n.parent = this; this.children.unshift(n); }
    }
  }
  insertBefore(node, ref) {
    const idx = ref ? this.children.indexOf(ref) : -1;
    node.parent = this;
    if (idx === -1) this.children.push(node);
    else this.children.splice(idx, 0, node);
  }
  remove() {
    if (!this.parent) return;
    const idx = this.parent.children.indexOf(this);
    if (idx !== -1) this.parent.children.splice(idx, 1);
    this.parent = null;
  }
  closest(tagSelector) {
    const target = tagSelector.toUpperCase();
    let cur = this;
    while (cur) {
      if (cur.tagName === target) return cur;
      cur = cur.parent;
    }
    return null;
  }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this._text = String(v ?? '');
  }
  get innerHTML() { return this._html; }
  set innerHTML(html) {
    this._html = String(html);
    for (const c of this.children) c.parent = null;
    this.children = [];
    this._text = '';
    const stack = [this];
    const tokenRe = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = tokenRe.exec(this._html))) {
      const top = stack[stack.length - 1];
      if (m[3]) { top._text += m[3]; continue; }
      const rawTag = m[1].toLowerCase();
      if (m[0].startsWith('</')) {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName === rawTag.toUpperCase()) { stack.length = i; break; }
        }
        continue;
      }
      const el = new FakeElement(rawTag);
      for (const [k, v] of parseAttrs(m[2] || '').entries()) el.setAttribute(k, v);
      top.append(el);
      if (!VOID_TAGS.has(rawTag) && !m[2].trim().endsWith('/')) stack.push(el);
    }
  }
  matches(sel) {
    for (const part of sel.split(',').map(s => s.trim())) {
      if (part === '#s-bayiler' && this.id === 's-bayiler') return true;
      if (part === '#bayiler-nav' && this.id === 'bayiler-nav') return true;
      if (part === '#route-name' && this.id === 'route-name') return true;
      if (part === '#uyg nav' && this.tagName === 'NAV') return true;
      if (part === '.workspace' && this.classList.contains('workspace')) return true;
      if (part === '.workspace > [id^="s-"]' && this.parent?.classList.contains('workspace') && this.id.startsWith('s-')) return true;
      if (part === '.alt' && this.classList.contains('alt')) return true;
      if (part === '.bayi-review' && this.classList.contains('bayi-review')) return true;
      if (part === '.bayi-overview a[href^="#kullanici/"]') continue;
      if (part.startsWith('[') && part.endsWith(']')) {
        const inner = part.slice(1, -1);
        const eq = inner.indexOf('=');
        if (eq === -1 && this.attributes.has(inner)) return true;
        if (eq !== -1) {
          const k = inner.slice(0, eq);
          const v = inner.slice(eq + 1).replace(/^"|"$/g, '');
          if (this.attributes.get(k) === v) return true;
        }
      }
      if (part.startsWith('#uyg nav a')) continue;
    }
    return false;
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches(sel)) return c;
      const deep = c.querySelector(sel);
      if (deep) return deep;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const c of this.children) {
      if (c.matches(sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
  }
}

function createEnv() {
  const docRoot = new FakeElement('DOCUMENT');
  const uyg = new FakeElement('section');
  uyg.setAttribute('id', 'uyg');
  const nav = new FakeElement('nav');
  const alt = new FakeElement('div');
  alt.setAttribute('class', 'alt');
  nav.append(alt);
  const routeName = new FakeElement('span');
  routeName.setAttribute('id', 'route-name');
  const workspace = new FakeElement('div');
  workspace.setAttribute('class', 'workspace');
  uyg.append(nav, routeName, workspace);
  docRoot.append(uyg);

  const document = {
    createElement: tag => new FakeElement(tag),
    querySelector: sel => docRoot.querySelector(sel),
    querySelectorAll: sel => docRoot.querySelectorAll(sel)
  };
  const window = {
    PuffyPhase1: { open() {}, close() {}, route() { return false; } },
    PuffyFinans: { Journal: class { list() { return []; } } },
    PuffyDealerCredit: { mount() {} }
  };
  const location = { hash: '' };
  class FakeObserver { observe() {} disconnect() {} }
  const sandbox = {
    window,
    document,
    location,
    sessionStorage: { getItem: () => null, setItem() {} },
    MutationObserver: FakeObserver,
    FormData: class {},
    Promise,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Date,
    Error
  };
  vm.runInNewContext(readYonetim('bayiler.js'), sandbox);
  vm.runInNewContext(readYonetim('bayi-merkezi.js'), sandbox);
  return { window, document, location };
}

test('formatStockReason ve canResolveExchange kuralları doğru çalışır', () => {
  const { window } = createEnv();
  const T = window.PuffyDealerTransfers;
  assert.equal(T.formatStockReason('exchange:abcd1234-5678-9012-3456-7890abcdef12'), 'Kazanç aktarımı · abcd1234');
  assert.equal(T.formatStockReason('sale:12345678-9012'), 'Doğrudan satış · 12345678');
  assert.equal(T.formatStockReason('offer:87654321-0000'), 'Teklifli satış · 87654321');
  assert.equal(T.formatStockReason('Manuel düzenleme'), 'Manuel düzenleme');

  for (const st of ['pending', 'payment_sent', 'disputed']) {
    assert.equal(T.canResolveExchange(st, true), true);
    assert.equal(T.canResolveExchange(st, false), false);
  }
  for (const st of ['approved', 'rejected', 'cancelled', 'expired']) {
    assert.equal(T.canResolveExchange(st, true), false);
  }
});

test('bayi-merkezi/aktarim global listeyi yükler ve sahip itirazı çözebilir', async () => {
  const { window, document, location } = createEnv();
  const calls = [];
  const exId = 'aaaaaaaa-1111-2222-3333-444444444444';
  const dealerId = 'bbbbbbbb-1111-2222-3333-444444444444';
  const senderId = 'cccccccc-1111-2222-3333-444444444444';

  const ctx = {
    user: { id: 'owner-1' },
    caps: { admin: true, owner: true, actions: { account_manage: true } },
    sb: {
      rpc: async (name, params) => {
        calls.push({ name, params });
        if (name === 'yonetim_bayi_aktarimlari') {
          return {
            data: {
              total: 1,
              open_count: 1,
              disputed_count: 1,
              rows: [{
                id: exId,
                sender_id: senderId,
                sender_name: 'Yayıncı',
                sender_display_id: 222222,
                dealer_id: dealerId,
                dealer_name: 'Dora Coins',
                dealer_display_id: 649120,
                asset: 'PUFFY',
                amount: 100000,
                cash_amount: 5.30,
                amount_coin: 114480,
                status: 'disputed',
                payment_reference: 'FAST-123456',
                last_note: 'Ödeme hesaba düşmedi',
                created_at: '2026-11-14T10:00:00Z'
              }]
            }
          };
        }
        if (name === 'yonetim_bayi_aktarim_coz') return { data: { ok: true } };
        return { data: {} };
      }
    }
  };

  window.PuffyPhase1.open(ctx);
  location.hash = '#bayi-merkezi/aktarim';
  assert.equal(window.PuffyPhase1.route('bayi-merkezi/aktarim'), true);
  await new Promise(r => setTimeout(r, 10));

  const root = document.querySelector('#s-bayiler');
  const body = root.querySelector('[data-hub-body]');
  assert.ok(body.innerHTML.includes('Ödeme hesaba düşmedi'));
  assert.ok(body.innerHTML.includes('114.480') || body.innerHTML.includes('114,480'));

  const resolveBtn = root.querySelector('[data-exchange-resolve]');
  assert.ok(resolveBtn);
  resolveBtn.onclick();

  const reviewBox = root.querySelector('.bayi-review');
  assert.ok(reviewBox);
  reviewBox.querySelector('[data-reason]').value = 'Banka dekontu kontrol edildi';
  await reviewBox.querySelector('[data-approve]').onclick();

  const cozumCall = calls.find(x => x.name === 'yonetim_bayi_aktarim_coz');
  assert.deepEqual(JSON.parse(JSON.stringify(cozumCall)), {
    name: 'yonetim_bayi_aktarim_coz',
    params: {
      p_id: exId,
      p_approve: true,
      p_reason: 'Banka dekontu kontrol edildi'
    }
  });
});

test('index.html sürüm sorguları ve CSP bütünlüğü korunur', () => {
  const html = readYonetim('index.html');
  assert.match(html, /bayiler\.css\?v=20261114aktarim1/);
  assert.match(html, /bayiler\.js\?v=20261114aktarim1/);
  assert.match(html, /bayi-merkezi\.css\?v=20261114aktarim1/);
  assert.match(html, /bayi-merkezi\.js\?v=20261114aktarim1/);
  assert.match(html, /'sha256-oZj40keJCo3Z1t2OU0r6qa9qmsFxNRlHSNVR\+yxEEF8='/);
});
