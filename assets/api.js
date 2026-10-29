/* ONION SHOP — связь сайта с сервером (Google Таблица).
   Режимы (assets/config.js):
     live — указана ссылка apiUrl: аккаунты, токены и заказы хранятся в Google Таблице;
     demo — для предпросмотра: всё то же самое, но в памяти этого браузера;
     off  — ссылки нет: кабинет и токены скрыты, заказ оформляется как раньше. */
var OnionAPI = (function () {
  'use strict';
  var cfg = window.ONION_CONFIG || {};
  var mode = cfg.mode || (cfg.apiUrl ? 'live' : 'off');
  var SKEY = 'onion.shop.session';

  // вход хранится в двух местах (память сайта и cookie на год): если браузер почистил одно, восстановим из другого
  function readCookie() { try { var m = document.cookie.match(/(?:^|; )onion_s=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }
  function writeCookie(v) { try { document.cookie = 'onion_s=' + (v ? encodeURIComponent(v) : '') + '; path=/; max-age=' + (v ? 31536000 : 0) + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) { /* нет cookie */ } }
  function getSession() {
    var v = ''; try { v = localStorage.getItem(SKEY) || ''; } catch (e) { }
    if (!v) { v = readCookie(); if (v) { try { localStorage.setItem(SKEY, v); } catch (e) { } } }
    return v;
  }
  function setSession(s) {
    try { if (s) localStorage.setItem(SKEY, s); else localStorage.removeItem(SKEY); } catch (e) { /* нет хранилища */ }
    writeCookie(s || '');
    if (s) { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { } }
  }
  // уже вошедшие клиенты: дублируем токен в cookie при загрузке
  try { var cur = localStorage.getItem(SKEY); if (cur && !readCookie()) writeCookie(cur); } catch (e) { }

  // ------------------------------------------------ демо-база в браузере
  var DKEY = 'onion.shop.demo.v2';
  function load() { try { return JSON.parse(localStorage.getItem(DKEY)) || null; } catch (e) { return null; } }
  var mem = load() || { users: [], sessions: [], orders: [], log: [], reviews: [], waits: [], tg: [], seq: { user: 1000, order: 0 } };
  function save() { try { localStorage.setItem(DKEY, JSON.stringify(mem)); } catch (e) { /* только в памяти */ } }
  function hashStr(s) {
    // FNV-1a ×2 — для демо достаточно; на сервере SHA-256
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 16777619) >>> 0; h2 ^= c + i; h2 = Math.imul(h2, 2246822519) >>> 0; }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }
  var catalog = {};
  ((window.ONION_CATALOG || {}).products || []).forEach(function (p) { catalog[p.id] = p; });
  var DemoDB = {
    registerBonus: 1400,
    now: function () { return Date.now(); },
    random: function () { return Math.random(); },
    hash: hashStr,
    token: function () { var s = ''; for (var i = 0; i < 40; i++) s += Math.floor(Math.random() * 16).toString(16); return s; },
    getUser: function (id) { return mem.users.filter(function (u) { return u.id === String(id); })[0] || null; },
    findUser: function (field, value) {
      var map = { login: 'login', tg: 'tgKey', phone: 'phoneKey', refCode: 'refCode', email: 'emailKey' }, k = map[field] || field;
      return mem.users.filter(function (u) { return String(u[k]) === String(value); })[0] || null;
    },
    createUser: function (u) { mem.seq.user += 1; u.id = String(mem.seq.user); mem.users.push(u); return u; },
    saveUser: function () { save(); },
    getSession: function (t) { return mem.sessions.filter(function (s) { return s.token === t; })[0] || null; },
    saveSession: function (s) { mem.sessions.push(s); save(); },
    renewSession: function (t, exp) { mem.sessions.forEach(function (s) { if (s.token === t) s.exp = exp; }); save(); },
    deleteSession: function (t) { mem.sessions = mem.sessions.filter(function (s) { return s.token !== t; }); save(); },
    nextOrderSeq: function () { mem.seq.order += 1; save(); return mem.seq.order; },
    saveOrder: function (o) { mem.orders.push(o); save(); },
    listOrders: function (uid, n) { return mem.orders.filter(function (o) { return o.userId === uid; }).slice(-n).reverse(); },
    log: function (e) { mem.log.push(e); if (mem.log.length > 500) mem.log.shift(); },
    catalogReady: function () { return true; },
    product: function (id) { return catalog[id] || null; },
    notify: function () { return false; },
    // демо: коды не уходят на почту, а показываются на экране
    demoCodes: true,
    codes: {},
    putCode: function (k, o) { DemoDB.codes[k] = o; },
    getCode: function (k) { return DemoDB.codes[k] || null; },
    delCode: function (k) { delete DemoDB.codes[k]; },
    mail: function () { return true; },
    deleteUser: function (u) { mem.users = mem.users.filter(function (x) { return x.id !== u.id; }); save(); },
    deleteSessionsOf: function (id) { mem.sessions = mem.sessions.filter(function (s) { return s.userId !== id; }); save(); },
    botUser: function () { return 'onion_shop_demo_bot'; },
    userNotify: function (u, text) { (mem.tg = mem.tg || []).push({ chat: u.tgChat, text: text }); save(); return true; },
    reviewKeys: function (uid) { return (mem.reviews || []).filter(function (r) { return r.userId === uid; }).map(function (r) { return r.no + '|' + r.productId; }); },
    reviewHas: function (no, pid) { return (mem.reviews || []).some(function (r) { return r.no === no && r.productId === pid; }); },
    reviewAdd: function (r) { (mem.reviews = mem.reviews || []).push(r); save(); },
    reviewsFor: function (pid) { return (mem.reviews || []).filter(function (r) { return r.productId === pid && r.status === 'опубликован'; }).reverse().map(function (r) { var d = new Date(r.at); return { name: r.name, rating: r.rating, text: r.text, at: ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() }; }); },
    waitsOf: function (uid) { return (mem.waits || []).filter(function (w) { return w.userId === uid; }); },
    waitAdd: function (w) { (mem.waits = mem.waits || []).push(w); save(); },
    waitRemove: function (uid, pid) { mem.waits = (mem.waits || []).filter(function (w) { return !(w.userId === uid && w.productId === pid); }); save(); },
    shopPromo: function (code) { return code === 'HALLOWEEN' ? { code: code, pct: 10, active: true, withTokens: true, once: true, limit: 0, until: Date.parse('2026-10-31T23:59:59+03:00') } : null; },
    promoUses: function (code) {
      var r = { total: 0, users: [], phones: [] };
      mem.orders.forEach(function (o) { if (o.promo === code) { r.total++; if (o.userId) r.users.push(o.userId); var d = String(o.phone || '').replace(/\D/g, ''); if (d.length === 11) d = d.slice(1); if (d) r.phones.push(d); } });
      return r;
    }
  };

  // ------------------------------------------------ вызов
  var pending = 0;
  function call(action, payload) {
    payload = Object.assign({ action: action, session: getSession() }, payload || {});
    if (mode === 'demo') {
      return new Promise(function (res) {
        setTimeout(function () {
          var r;
          try { r = OnionCore.handle(action, payload, DemoDB); save(); } catch (e) { r = { ok: false, error: 'Ошибка: ' + e.message }; }
          res(r);
        }, 220 + Math.random() * 180);
      });
    }
    if (mode !== 'live') return Promise.resolve({ ok: false, error: 'off' });
    if (action !== 'me') pending++;
    return fetch(cfg.apiUrl, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (action !== 'me') pending = Math.max(0, pending - 1); return r; }, function (e) { if (action !== 'me') pending = Math.max(0, pending - 1); throw e; })
      .then(function (r) { try { window.dispatchEvent(new Event('onion:netok')); } catch (e) { /* */ } return r; })
      .catch(function () { try { window.dispatchEvent(new Event('onion:neterr')); } catch (e) { /* */ } return { ok: false, error: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз', network: true }; });
  }

  return {
    mode: mode,
    enabled: mode === 'live' || mode === 'demo',
    getSession: getSession,
    setSession: setSession,
    call: call,
    busy: function () { return pending > 0; },
    resetDemo: function () { try { localStorage.removeItem(DKEY); } catch (e) { /* */ } setSession(''); }
  };
})();
