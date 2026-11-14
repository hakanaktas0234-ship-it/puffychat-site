const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const yonetimDir = path.join(__dirname, '../../yonetim');
const readYonetim = f => fs.readFileSync(path.join(yonetimDir, f), 'utf8');

class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.required = false;
    this.value = '';
    this.name = '';
    this.type = '';
    this._text = '';
    this._html = '';
    this.elements = {};
  }
  get isConnected() {
    let p = this;
    while (p.parent) p = p.parent;
    return p.tagName === 'ROOT';
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = String(v);
    }
    if (k === 'name') this.name = String(v);
    if (k === 'type') this.type = String(v);
  }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') {
        this._text += n;
        continue;
      }
      n.parent = this;
      this.children.push(n);
      if (this.tagName === 'FORM' && n.name) this.elements[n.name] = n;
      if (n.tagName === 'LABEL') {
        for (const c of n.children) {
          if (c.name && this.tagName === 'FORM') this.elements[c.name] = c;
        }
      }
    }
  }
  prepend(...nodes) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (typeof n !== 'string') {
        n.parent = this;
        this.children.unshift(n);
      }
    }
  }
  after(node) {
    if (!this.parent) return;
    const idx = this.parent.children.indexOf(this);
    if (idx === -1) return;
    node.parent = this.parent;
    this.parent.children.splice(idx + 1, 0, node);
  }
  replaceChildren(...nodes) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.elements = {};
    this._text = '';
    this._html = '';
    this.append(...nodes);
  }
  remove() {
    if (!this.parent) return;
    const i = this.parent.children.indexOf(this);
    if (i !== -1) this.parent.children.splice(i, 1);
    this.parent = null;
  }
  get textContent() {
    return this._text + this.children.map(c => c.textContent).join('');
  }
  set textContent(v) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this._text = String(v ?? '');
  }
  set innerHTML(html) {
    this._html = String(html);
    this.children = [];
    this.elements = {};
    const specs = [
      { tag: 'h2', attrs: {} },
      { tag: 'p', attrs: {} },
      { tag: 'p', attrs: { 'data-fixed-status': '', role: 'status' } },
      { tag: 'div', attrs: { 'data-picked': '' } },
      { tag: 'div', attrs: { 'data-draft': '' } },
      { tag: 'form', attrs: { 'data-find': '' } },
      { tag: 'div', attrs: { 'data-results': '' } },
      { tag: 'p', attrs: { 'data-warning': '', role: 'alert' } },
      { tag: 'form', attrs: { 'data-save': '' } },
      { tag: 'div', attrs: { 'data-mfa-box': '' } }
    ];
    if (this.tagName === 'SECTION') {
      for (const s of specs) {
        const el = new FakeElement(s.tag);
        for (const [k, v] of Object.entries(s.attrs)) el.setAttribute(k, v);
        if (s.tag === 'form' && 'data-find' in s.attrs) {
          const inp = new FakeElement('input');
          inp.setAttribute('name', 'query');
          const btn = new FakeElement('button');
          el.append(inp, btn);
        }
        if (s.tag === 'form' && 'data-save' in s.attrs) {
          const reason = new FakeElement('input');
          reason.setAttribute('name', 'reason');
          const conf = new FakeElement('input');
          conf.setAttribute('name', 'confirmed');
          conf.setAttribute('type', 'checkbox');
          const btn = new FakeElement('button');
          el.append(reason, conf, btn);
        }
        this.append(el);
      }
    }
  }
  get innerHTML() { return this._html; }
  matches(sel) {
    if (sel === 'button') return this.tagName === 'BUTTON';
    if (sel === 'input') return this.tagName === 'INPUT';
    if (sel === 'header') return this.tagName === 'HEADER';
    if (sel === 'button,input') return this.tagName === 'BUTTON' || this.tagName === 'INPUT';
    if (sel === '[data-fixed-status]') return this.attributes.has('data-fixed-status');
    if (sel === '[data-picked]') return this.attributes.has('data-picked');
    if (sel === '[data-draft]') return this.attributes.has('data-draft');
    if (sel === '[data-find]') return this.attributes.has('data-find');
    if (sel === '[data-results]') return this.attributes.has('data-results');
    if (sel === '[data-warning]') return this.attributes.has('data-warning');
    if (sel === '[data-save]') return this.attributes.has('data-save');
    if (sel === '[data-mfa-box]') return this.attributes.has('data-mfa-box');
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

function loadModule() {
  const window = {};
  const document = { createElement: tag => new FakeElement(tag) };
  vm.runInNewContext(readYonetim('sabit-oda-sirasi.js'), {
    window,
    document,
    Set,
    Map,
    JSON,
    Math,
    Number,
    String,
    Error,
    Promise
  });
  return window.PuffyFixedRoomManagement;
}

const M_UUID = '8a7d6e64-05dd-4263-aef8-eb5614ba2c07';
const E_UUID = 'b8f26996-6584-494b-b675-ab11f3caf173';

test('validate: geçerli sıralar, sınırlar ve çakışmaları doğru denetler', () => {
  const mod = loadModule();
  assert.equal(mod.validate([{ oda: M_UUID, sira: 5 }]), false);
  assert.equal(mod.validate([{ oda: M_UUID, sira: 1 }, { oda: E_UUID, sira: 2 }]), false);
  assert.equal(mod.validate([{ oda: M_UUID, sira: 5 }, { oda: E_UUID, sira: 6 }]), true);

  assert.throws(() => mod.validate([{ oda: M_UUID, sira: 0 }]), /1–100/);
  assert.throws(() => mod.validate([{ oda: M_UUID, sira: 101 }]), /1–100/);
  assert.throws(() => mod.validate([{ oda: M_UUID, sira: 5.5 }]), /1–100/);
  assert.throws(() => mod.validate([{ oda: 'not-a-uuid', sira: 5 }]), /1–100/);
  assert.throws(
    () => mod.validate([{ oda: M_UUID, sira: 5 }, { oda: M_UUID, sira: 6 }]),
    /iki kez/
  );
  assert.throws(
    () => mod.validate([{ oda: M_UUID, sira: 5 }, { oda: E_UUID, sira: 5 }]),
    /iki kez/
  );
});

test('mount, pickRoom ve save akışı tam p_expected/p_entries ile çalışır', async () => {
  const mod = loadModule();
  const root = new FakeElement('root');
  const header = new FakeElement('header');
  root.append(header);

  const calls = [];
  let savedCount = 0;
  let toasts = [];
  const api = mod.mount({
    root,
    valid: () => true,
    onSaved: () => { savedCount++; },
    c: {
      toast: msg => toasts.push(msg),
      errorText: e => e.message,
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (name === 'yonetim_sabit_oda_sirasi') {
          return {
            entries: [{ oda: M_UUID, sira: 5 }],
            rooms: [{ id: M_UUID, display_id: 1000, name: 'MÜŞTERİ HİZMETLERİ' }]
          };
        }
        return { ok: true };
      }
    }
  });

  await new Promise(r => setTimeout(r, 10));
  const section = root.children[1];
  assert.equal(section.dataset.fixedDirty, 'false');
  const saveForm = section.querySelector('[data-save]');
  assert.equal(saveForm.querySelector('button').disabled, true);

  // Karttan doğrudan oda seçimi -> 6. sıraya ekle
  api.pickRoom({ id: E_UUID, display_id: 1989, name: 'ETKİNLİK ODASI' });
  const picked = section.querySelector('[data-picked]');
  assert.equal(picked.hidden, false);
  const pickedForm = picked.children[0];
  const pickedInput = pickedForm.querySelector('input');
  pickedInput.value = '6';
  await pickedForm.onsubmit({ preventDefault() {}, currentTarget: pickedForm });

  assert.equal(picked.hidden, true);
  assert.equal(section.dataset.fixedDirty, 'true');
  assert.equal(saveForm.querySelector('button').disabled, false);

  saveForm.elements.reason.value = '6. sira Etkinlik Odasi sabitlemesi';
  saveForm.elements.confirmed.checked = true;
  await saveForm.onsubmit({ preventDefault() {}, currentTarget: saveForm });

  assert.equal(savedCount, 1);
  assert.deepEqual(toasts, ['Sabit oda sıralaması kaydedildi.']);
  const saveCall = calls.find(x => x.name === 'yonetim_sabit_oda_sirasi_kaydet');
  assert.ok(saveCall);
  assert.deepEqual(JSON.parse(JSON.stringify(saveCall.args.p_expected)), [{ oda: M_UUID, sira: 5 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(saveCall.args.p_entries)), [
    { oda: M_UUID, sira: 5 },
    { oda: E_UUID, sira: 6 }
  ]);
  assert.equal(saveCall.args.p_reason, '6. sira Etkinlik Odasi sabitlemesi');
});

test('oda-kartlari ve index.html sabit oda modülünü doğru sırayla bağlar', () => {
  const html = readYonetim('index.html');
  const js = readYonetim('oda-kartlari.js');
  const sIdx = html.indexOf('sabit-oda-sirasi.js');
  const oIdx = html.indexOf('oda-kartlari.js');
  assert.ok(sIdx > 0 && oIdx > sIdx, 'sabit-oda-sirasi.js oda-kartlari.js önce yüklenmeli');
  assert.match(js, /window\.PuffyFixedRoomManagement\?\.mount/);
  assert.match(js, /data-pin=/);
  assert.match(js, /fixedApi\?\.pickRoom/);
  assert.match(js, /\[data-fixed-dirty="true"\]/);
});
