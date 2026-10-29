/* ONION SHOP — витрина.
   Каталог: data/catalog.js (обновляется сам из Telegram-канала).
   Аккаунты, токены, рулетка, промокоды и номера заказов: Google Таблица через assets/api.js
   (в предпросмотре — демо в браузере). Корзина, избранное и недавние — в браузере. */
(function () {
  'use strict';

  var SHOP = {
    manager: 'OnionShop_Support',
    managerUrl: 'https://t.me/OnionShop_Support',
    phone: '+7 (985) 230-00-88',
    channelUrl: 'https://t.me/ONION_SHOP_OFFICIAL',
    reviewsUrl: 'https://t.me/ONION_SHOP_FEEDBACK',
    tiktokUrl: 'https://www.tiktok.com/@onion_shop',
    infoUrl: 'https://onion-shop.github.io/ONION-SHOP/',
    preorderUrl: 'https://onion-shop.github.io/ONION-SHOP/#how',
    address: 'Москва, Рублёвское шоссе, 16к1',
    mapUrl: 'https://yandex.ru/maps/?text=' + encodeURIComponent('Москва, Рублёвское шоссе, 16к1'),
    hours: { 0: [600, 1200], 1: [510, 1260], 2: [510, 1260], 3: [510, 1260], 4: [510, 1260], 5: [510, 1260], 6: [600, 1200] },
    since: 2025
  };
  var API = window.OnionAPI, CORE = window.OnionCore, RULES = CORE.RULES;
  var CAT_ORDER = ['shoes', 'tees', 'hoodies', 'outerwear', 'pants', 'accessories', 'other'];
  var CATALOG = window.ONION_CATALOG || { products: [] };
  var PRODUCTS = (CATALOG.products || []).slice();
  var BY_ID = {};
  /* цвет → фото (номер фото в посте, 1 — первое). Источники по старшинству:
     1) data/colors.js — ручная привязка; 2) номера в самом посте: «Цвета: красный (7), голубой (8)».
     Цвета идут в порядке фото. */
  var AUTO_COLOR_PHOTO = false; // false — цвет сам не выбирает фото (клиент отмечает фото вручную). true — вернуть автоподбор.
  var COLOR_PHOTOS = window.ONION_COLOR_PHOTOS || {};
  var PHOTO_V = {};
  function normColor(c) { return String(c || '').trim().toLowerCase().replace(/ё/g, 'е'); }
  PRODUCTS.forEach(function (p) {
    BY_ID[p.id] = p;
    (p.photos || []).forEach(function (ph) { if (ph.hash) PHOTO_V[ph.id] = ph.hash; });
    var raw = Object.assign({}, p.colorPhotos || {}, COLOR_PHOTOS[p.id] || {}), map = {};
    if (AUTO_COLOR_PHOTO && p.colors.length > 1) {
      Object.keys(raw).forEach(function (c) {
        var ph = p.photos[raw[c] - 1]; if (!ph) return;
        var own = p.colors.filter(function (x) { return normColor(x) === normColor(c); })[0];
        if (own) map[own] = ph.id;
      });
      if (Object.keys(map).length) {
        var pos = function (c) { return map[c] ? p.photos.findIndex(function (x) { return x.id === map[c]; }) : 999; };
        p.colors = p.colors.slice().sort(function (x, y) { return pos(x) - pos(y); });
        p.colorPhoto = map;
      }
    }
  });
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WHEEL_SUM = RULES.wheel.reduce(function (a, w) { return a + w.w; }, 0);

  // ------------------------------------------------------------ утилиты
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function tk(cls) { return '<svg class="tk' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-token"/></svg>'; }
  function pz(id, cls) { return '<svg class="pz' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#p-' + id + '"/></svg>'; }
  var NF = new Intl.NumberFormat('ru-RU');
  function num(n) { return NF.format(n); }
  function rub(n) { return NF.format(Math.round(n)) + ' ₽'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, a, b, c) { n = Math.abs(n); var m10 = n % 10, m100 = n % 100; return (m10 === 1 && m100 !== 11) ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? b : c; }
  function tokWord(n) { return plural(n, 'токен', 'токена', 'токенов'); }
  // ?v= — отпечаток фото: если фото в посте заменили, браузер не покажет старое из кеша
  function thumb(id) { return 'img/thumb/' + id + '.jpg' + (PHOTO_V[id] ? '?v=' + PHOTO_V[id] : ''); }
  function full(id) { return 'img/full/' + id + '.jpg' + (PHOTO_V[id] ? '?v=' + PHOTO_V[id] : ''); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function initials(name) { var p = String(name || '?').trim().split(/\s+/); return (p[0].charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function pct(w) { var v = w / WHEEL_SUM * 100; return String(v < 0.1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10).replace('.', ',') + '%'; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('onion.shop.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('onion.shop.' + k, JSON.stringify(v)); } catch (e) { /* нет хранилища */ } }
  };
  function lvlImg(key, size, cls) { return '<img class="lvl-img' + (cls ? ' ' + cls : '') + '" src="assets/lvl/' + esc(key) + '.svg?v=3" width="' + size + '" height="' + size + '" alt="" decoding="async">'; }
  function lvlByKey(k) { return RULES.levels.filter(function (l) { return l.key === k; })[0] || RULES.levels[0]; }
  function pctTxt(p) { return String(p).replace('.', ','); }
  function perkItems(list) { return list.map(function (x) { return '<li>' + icon('check') + '<span><b>' + esc(x[0]) + '</b>' + (x[1] ? '<small>' + esc(x[1]) + '</small>' : '') + '</span></li>'; }).join(''); }
  function promoLine(p) { return (p.cat ? 'только «' + esc(p.catLabel) + '»' : esc(p.from || '')) + (p.exp ? ' · до конца месяца' : ''); }
  function ava(u, cls) {
    var f = esc((u && u.frame) || 'base');
    return '<span class="ava f-' + f + (f === 'lvl-diamond' ? ' an-' + esc((u && u.frameAnim) || 'shine') : '') + (cls ? ' ' + cls : '') + '">' + (u && u.avatar ? '<img src="' + esc(u.avatar) + '" alt="">' : esc(initials(u && u.name))) + '</span>';
  }

  // ------------------------------------------------------------ время (Москва)
  var WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function msk(d) {
    var u = new Date((d ? +d : Date.now()) + 3 * 3600000);
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    return { y: u.getUTCFullYear(), mo: u.getUTCMonth() + 1, d: u.getUTCDate(), h: u.getUTCHours(), mi: u.getUTCMinutes(), wd: u.getUTCDay(), hh: p2(u.getUTCHours()), mm: p2(u.getUTCMinutes()) };
  }
  function fmtAt(at) {
    if (typeof at === 'number' || /^\d{12,}$/.test(String(at))) { var t = msk(+at); return t.d + ' ' + MONTHS[t.mo - 1] + ' ' + t.y + ', ' + t.hh + ':' + t.mm + ' МСК'; }
    var m = String(at || '').match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2})/);
    if (m) return (+m[1]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[3] + ', ' + m[4] + ' МСК';
    return String(at || '');
  }
  function hm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function ageText() {
    var t = msk(), m = (t.y - SHOP.since) * 12 + (t.mo - 3);
    if (m < 12) return Math.max(1, m) + ' мес.';
    var y = Math.floor(m / 6) / 2;
    return String(y).replace('.', ',') + ' ' + (y % 1 ? 'года' : plural(y, 'год', 'года', 'лет'));
  }
  function openState() {
    var t = msk(), now = t.h * 60 + t.mi, today = SHOP.hours[t.wd];
    if (now >= today[0] && now < today[1]) return { open: true, text: 'Открыто до ' + hm(today[1]) };
    if (now < today[0]) return { open: false, text: 'Закрыто · откроется в ' + hm(today[0]) };
    return { open: false, text: 'Закрыто · завтра с ' + hm(SHOP.hours[(t.wd + 1) % 7][0]) };
  }
  function tickClock() {
    var t = msk(), time = t.hh + ':' + t.mm;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('clock-date', WD_SHORT[t.wd] + ', ' + t.d + ' ' + MONTHS[t.mo - 1]);
    set('clock-time', time); set('clock-m-time', time); set('year', t.y);
    set('footer-date', 'Сегодня ' + WD_LONG[t.wd] + ', ' + t.d + ' ' + MONTHS[t.mo - 1] + ' · ' + time + ' МСК');
    $$('[data-open-state]').forEach(function (el) { var s = openState(); el.textContent = s.text; el.className = 'open-state ' + (s.open ? 'on' : 'off'); });
    $$('[data-today-row]').forEach(function (el) { el.classList.toggle('today', +el.getAttribute('data-today-row') === (t.wd === 0 || t.wd === 6 ? 1 : 0)); });
  }
  function startClock() {
    tickClock();
    var t = new Date();
    setTimeout(function () { tickClock(); setInterval(tickClock, 60000); }, (60 - t.getSeconds()) * 1000 - t.getMilliseconds() + 50);
  }

  // ------------------------------------------------------------ цвета
  var COLOR_HEX = { 'бел': '#f4f5f7', 'сер': '#9aa3ae', 'роз': '#f2b7c8', 'черн': '#1d1d22', 'темно-син': '#1d2b57', 'зел': '#4f8a5b', 'красн': '#c8303a', 'голуб': '#7cc4f2', 'желт': '#f2c230', 'коричн': '#7a4b2a', 'син': '#2f5bd3', 'фиолет': '#7b4fc4', 'беж': '#d9c3a0', 'бордов': '#7b1e2e', 'оранж': '#f08a24', 'хаки': '#6b6b3a', 'молочн': '#f3ead8', 'графит': '#3b3f46' };
  var COLOR_KEYS = Object.keys(COLOR_HEX).sort(function (a, b) { return b.length - a.length; });
  function hexFor(w) { w = norm(w).trim(); for (var i = 0; i < COLOR_KEYS.length; i++) if (w.indexOf(COLOR_KEYS[i]) === 0) return COLOR_HEX[COLOR_KEYS[i]]; return null; }
  function swatch(name) {
    var n = norm(name).replace(/\s+в\s+полоску/, ''), striped = /полоск/.test(norm(name));
    var parts = n.split(/[-–]\s*(?=[а-я])/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (/^(темно|светло)$/.test(parts[0] || '')) parts = [parts.slice(0, 2).join('-')].concat(parts.slice(2));
    var hx = parts.map(hexFor).filter(Boolean);
    if (!hx.length) return 'background:conic-gradient(#e85d75,#43c9e3,#4f8a5b,#2f72ff,#7b4fc4,#e85d75)';
    if (hx.length === 1) return 'background:' + hx[0];
    if (striped) return 'background:repeating-linear-gradient(135deg,' + hx[0] + ' 0 4px,' + hx[1] + ' 4px 8px)';
    return 'background:linear-gradient(135deg,' + hx[0] + ' 50%,' + hx[1] + ' 50%)';
  }

  // ------------------------------------------------------------ состояние
  var draftReady = false;
  var cart = store.get('cart', []);
  var localOrders = store.get('orders', []);
  var favs = store.get('favs', []);
  var recent = store.get('recent', []);
  var acct = { user: null, ready: false };
  var returnTo = null;
  var current = 'home';

  function saveCart() { store.set('cart', cart); updateCounts(true); if (draftReady) saveDraft(); }
  function lineKey(l) { return [l.id, l.size || '', l.color || '', l.photo || '', l.note || ''].join('|'); }
  function cartLines() { return cart.filter(function (l) { return BY_ID[l.id]; }); }
  function cartCount() { return cartLines().reduce(function (s, l) { return s + l.qty; }, 0); }
  function updateCounts(bumpIt) {
    var n = cartCount(), f = favs.filter(function (id) { return BY_ID[id]; }).length;
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; if (el.closest('.tabbar')) el.hidden = !n; if (bumpIt) bump(el); });
    $$('[data-fav-count]').forEach(function (el) { el.textContent = f; el.hidden = !f; });
  }
  function addToCart(line) {
    var key = lineKey(line), ex = cart.find(function (l) { return lineKey(l) === key; });
    if (ex) ex.qty = Math.min(10, ex.qty + line.qty); else cart.push(line);
    saveCart();
    track('cart', line.id);
  }
  function isFav(id) { return favs.indexOf(String(id)) >= 0; }
  function toggleFav(id, btn) {
    id = String(id);
    var on = !isFav(id);
    if (on) favs.unshift(id); else favs = favs.filter(function (x) { return x !== id; });
    store.set('favs', favs);
    $$('[data-fav="' + id + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(on)); });
    if (btn && on) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    updateCounts();
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного', on ? { label: 'Избранное', run: function () { go('favorites'); } } : null);
    if (on) track('fav', id);
    if (current === 'favorites' && !on) renderFavorites();
  }
  function pushRecent(id) { recent = [String(id)].concat(recent.filter(function (x) { return x !== String(id); })).slice(0, 12); store.set('recent', recent); }

  // ------------------------------------------------------------ уведомления, окна, анимации
  function toast(msg, action, kind) {
    var root = $('#toasts'), el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    var ic = kind === 'reward' ? tk() : icon(kind === 'warn' ? 'alert' : 'check-circle');
    el.innerHTML = ic + '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    var close = function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); };
    var timer = setTimeout(close, action ? 6000 : 3200);
    if (action) el.querySelector('button').addEventListener('click', function () { clearTimeout(timer); close(); action.run(); });
  }
  function reward(msg) { toast(msg, null, 'reward'); }
  var lastFocus = null;
  function openModal(html, opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    var root = $('#modal-root');
    root.innerHTML = '<div class="overlay" role="presentation"><div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true" tabindex="-1">' + html + '</div></div>';
    var ov = root.firstChild, md = ov.firstChild;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    $$('[data-close]', md).forEach(function (b) { b.addEventListener('click', closeModal); });
    document.addEventListener('keydown', escClose);
    setTimeout(function () { md.focus(); }, 10);
    return md;
  }
  function modalHead(title) { return '<div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon('x') + '</button></div>'; }
  function escClose(e) { if (e.key === 'Escape') { closeModal(); closeLightbox(); } }
  function closeModal() {
    var root = $('#modal-root'); if (!root.innerHTML) return;
    root.innerHTML = '';
    document.removeEventListener('keydown', escClose);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* */ }
  }
  function confirmBox(o) {
    var md = openModal(modalHead(o.title) + (o.text ? '<p class="muted">' + esc(o.text) + '</p>' : '') +
      '<div class="send-row">' + o.actions.map(function (a, i) { return '<button type="button" class="btn ' + (a.cls || 'btn-ghost') + '" data-a="' + i + '">' + esc(a.label) + '</button>'; }).join('') + '</div>', { cls: 'sm' });
    $$('[data-a]', md).forEach(function (b) { b.addEventListener('click', function () { var a = o.actions[+b.getAttribute('data-a')]; closeModal(); if (a.run) a.run(); }); });
  }
  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? okMsg : 'Выделите и скопируйте вручную', null, ok ? '' : 'warn');
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function bump(el) { if (!el || REDUCED) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function visibleEl(sel) { return $$(sel).filter(function (e) { return e.offsetParent !== null && e.getBoundingClientRect().width > 0; })[0]; }
  function flyToCart(img) {
    var target = visibleEl('.hdr .cart-btn') || visibleEl('.tabbar .mid .bub');
    if (!img || !target || REDUCED || !img.animate) return;
    var r1 = img.getBoundingClientRect(), r2 = target.getBoundingClientRect();
    var size = Math.min(r1.width, r1.height, 200);
    var f = document.createElement('img');
    f.src = img.currentSrc || img.src; f.className = 'fly'; f.alt = '';
    var x0 = r1.left + r1.width / 2 - size / 2, y0 = r1.top + r1.height / 2 - size / 2;
    f.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px;width:' + size + 'px;height:' + size + 'px';
    document.body.appendChild(f);
    var dx = r2.left + r2.width / 2 - (x0 + size / 2), dy = r2.top + r2.height / 2 - (y0 + size / 2);
    f.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.45 + 'px,' + (Math.min(dy, 0) - 80) + 'px) scale(.5) rotate(-6deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.06) rotate(10deg)', opacity: 0.4 }
    ], { duration: 800, easing: 'cubic-bezier(.45,0,.7,.4)' }).onfinish = function () { f.remove(); bump(target); };
  }
  function confetti(power) {
    if (REDUCED) return;
    var c = document.createElement('canvas'); c.className = 'confetti';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var colors = ['#43c9e3', '#1a86c0', '#8fe6f5', '#2f6fe0', '#0f2747', '#ffffff', '#bfe9ff'];
    var P = [], n = power || 120;
    for (var i = 0; i < n; i++) P.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * 0.38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, c: colors[i % colors.length], round: Math.random() < .3 });
    var t0 = performance.now();
    (function frame(t) {
      var el = t - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(function (p) { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - el / 2600); ctx.fillStyle = p.c; if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (el < 2600) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.disabled = true; btn.setAttribute('data-old', btn.innerHTML); btn.innerHTML = '<span class="spinner"></span>' + esc(label || 'Секунду…'); }
    else { btn.disabled = false; var o = btn.getAttribute('data-old'); if (o !== null) btn.innerHTML = o; }
  }

  // ------------------------------------------------------------ аккаунт
  function setUser(u) {
    acct.user = u || null;
    updateAcctUI();
    showNews(u);
    if (current === 'account') renderAccount();
    else if (current === 'roulette') updateRoulBalance();
    else if (current === 'cart' && !$('#checkout :focus')) renderCart();
  }
  var checkinHinted = false;
  function refreshMe() {
    if (!API.enabled || !API.getSession()) { acct.ready = true; updateAcctUI(); return Promise.resolve(); }
    return API.call('me').then(function (r) {
      acct.ready = true;
      if (r.ok) setUser(r.user);
      else { if (r.error === 'auth') API.setSession(''); setUser(null); }
      if (acct.user && !acct.user.checkedToday && !checkinHinted) {
        checkinHinted = true;
        setTimeout(function () { toast('Заберите ' + RULES.reward.checkin + ' ' + tokWord(RULES.reward.checkin) + ' за сегодняшний вход', { label: 'Забрать', run: doCheckin }); }, 1200);
      }
    });
  }
  /* Тихое обновление профиля: что поменяли в таблице (статус, токены, уровень), клиент видит
     в течение минуты и сразу при возвращении на вкладку. Экран не перерисовывается, если ничего
     не изменилось или клиент сейчас что-то вводит. */
  var silentBusy = false, lastMe = '';
  function silentRefresh() {
    if (silentBusy || !API.enabled || API.mode !== 'live' || !API.getSession() || document.hidden) return;
    silentBusy = true;
    API.call('me').then(function (r) {
      silentBusy = false;
      if (!r.ok) { if (r.error === 'auth') { API.setSession(''); setUser(null); refreshView(); } return; }
      var key = JSON.stringify(r.user);
      if (key === lastMe) return;
      lastMe = key; showNews(r.user);
      var typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (typing || $('#modal-root .modal')) { acct.user = r.user; updateAcctUI(); return; }
      acct.user = r.user; updateAcctUI();
      if (current === 'roulette') updateRoulBalance(); else refreshView(); // рулетку не перерисовываем — вдруг крутится
    }, function () { silentBusy = false; });
  }
  function updateAcctUI() {
    $$('[data-needs-api]').forEach(function (el) { el.hidden = !API.enabled; });
    var chip = $('#acct-chip'), tab = $('#tab-acct');
    if (!API.enabled) {
      chip.hidden = true;
      tab.href = '#orders'; tab.setAttribute('data-route', 'orders'); tab.innerHTML = '<span class="ic">' + icon('receipt') + '</span><span>Заказы</span>';
      return;
    }
    chip.hidden = false;
    var u = acct.user;
    if (u) {
      chip.className = 'acct-chip';
      chip.innerHTML = '<span class="tok">' + tk() + num(u.balance) + '</span>' + ava(u);
      chip.setAttribute('aria-label', 'Кабинет, ' + u.balance + ' ' + tokWord(u.balance));
      tab.innerHTML = '<span class="ic">' + ava(u) + '</span><span>' + num(u.balance) + '</span>';
    } else {
      chip.className = 'acct-chip guest';
      chip.innerHTML = icon('user') + '<span>Войти</span>';
      chip.removeAttribute('aria-label');
      tab.innerHTML = '<span class="ic">' + icon('user') + '</span><span>Кабинет</span>';
    }
  }
  function requireAuth(back) { returnTo = back || current; go('account'); toast('Войдите или создайте аккаунт — за регистрацию ' + RULES.reward.register + ' токенов'); }
  // события для заданий копим и отправляем пачкой раз в несколько секунд (каждое — один раз в день)
  var evQ = [], evSent = {}, evTimer = null, newsSeen = {};
  function track(ev, id) {
    if (!acct.user || !API.enabled) return;
    var k = ev + ':' + (id || '') + ':' + CORE.dayKey(Date.now());
    if (evSent[k]) return; evSent[k] = 1;
    evQ.push({ ev: ev, id: id ? String(id) : '' });
    clearTimeout(evTimer); evTimer = setTimeout(flushTrack, 5000);
  }
  function flushTrack() {
    clearTimeout(evTimer);
    if (!evQ.length || !acct.user) return Promise.resolve();
    var batch = evQ.splice(0, 40);
    return API.call('track', { events: batch }).then(function (r) { if (r && r.ok) setUserLite(r.user); });
  }
  function showNews(u) {
    var list = (u && u.taskNews || []).filter(function (n) { var k = n.k + '@' + n.at; if (newsSeen[k]) return false; newsSeen[k] = 1; return true; });
    if (!list.length) return;
    API.call('ackNews');
    list.slice(0, 3).forEach(function (n, i) {
      setTimeout(function () { reward('+' + n.tk + ' ' + tokWord(n.tk) + ' и +' + n.xp + ' XP · задание «' + n.title + '»'); if (n.per === 'm') confetti(80); }, i * 900);
    });
    if (list.length > 3) setTimeout(function () { reward('Ещё выполнено заданий: ' + (list.length - 3) + ' — награды уже начислены'); }, 3 * 900);
  }
  // тихое обновление пользователя после событий: без перерисовки корзины и ввода
  function setUserLite(u) { acct.user = u; updateAcctUI(); if (current === 'account') renderAccount(); showNews(u); }
  function doCheckin(btn) {
    if (!acct.user) return requireAuth('account');
    if (btn && btn.disabled !== undefined) btn.disabled = true;
    API.call('checkin').then(function (r) {
      if (!r.ok) { toast(r.error, null, 'warn'); if (btn) btn.disabled = false; return; }
      setUser(r.user);
      reward('+' + r.got + ' ' + tokWord(r.got) + (r.xp ? ' и +' + r.xp + ' XP' : '') + ' за вход' + (r.extra.length ? ' · ' + r.extra.join(', ') : ''));
      if (r.extra.length) confetti(90);
    });
  }

  // ------------------------------------------------------------ карточка товара
  function badge(p) { return p.status === 'preorder' ? '<span class="badge badge-pre">Предзаказ</span>' : p.status === 'out' ? '<span class="badge badge-out">Временно нет в наличии</span>' : '<span class="badge badge-stock">В наличии</span>'; }
  function inStockTab(p) { return p.status === 'stock' || p.status === 'out'; }
  function discount(p) { return p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0; }
  function card(p, i) {
    var a = p.photos[0], d = discount(p), id = esc(p.id);
    var sw = p.colors.length > 1 ? '<div class="sw-row">' + p.colors.slice(0, 5).map(function (c) { return '<i class="sw" style="' + swatch(c) + '" title="' + esc(c) + '"></i>'; }).join('') + (p.colors.length > 5 ? '<small>+' + (p.colors.length - 5) + '</small>' : '') + '</div>' : '';
    return '<article class="pcard" data-pid="' + id + '" style="--i:' + (i || 0) + '">' +
      '<a class="ph" href="#p-' + id + '" tabindex="-1" aria-hidden="true"><img class="a" src="' + thumb(a.id) + '" alt="" loading="lazy" decoding="async">' +
      '<div class="tags">' + badge(p) + '</div></a>' +
      '<button class="fav" type="button" data-fav="' + id + '" aria-pressed="' + isFav(p.id) + '" aria-label="Избранное: ' + esc(p.title) + '">' + icon('heart') + '</button>' +
      '<a class="body" href="#p-' + id + '"><span class="brand-l">' + esc(p.brand || p.categoryLabel) + '</span><span class="t">' + esc(p.title) + '</span>' + sw +
      '<div class="prices"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span>' + (d >= 3 ? '<span class="off">−' + d + '%</span>' : '') : '') + '</div></a></article>';
  }
  function grid(list, cls) { return '<div class="grid' + (cls ? ' ' + cls : '') + '">' + list.map(card).join('') + '</div>'; }
  function countBy(list, fn) { var m = {}; list.forEach(function (p) { var k = fn(p); m[k] = (m[k] || 0) + 1; }); return m; }
  function categories(list) {
    var c = countBy(list, function (p) { return p.category; }), labels = {};
    PRODUCTS.forEach(function (p) { labels[p.category] = p.categoryLabel; });
    return CAT_ORDER.filter(function (k) { return c[k]; }).map(function (k) { return { key: k, label: labels[k], n: c[k] }; });
  }

  // ------------------------------------------------------------ общие блоки
  function deliveryCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('truck') + '</span>Получение товаров в наличии</h3><ul>' +
      '<li><span><b>Доставка по Москве или в другой город</b> <small>· через Авито Доставку, быстрее всего</small></span></li>' +
      '<li><span><b>Курьер по Москве</b> <small>· не всегда доступен, согласуется с менеджером</small></span></li>' +
      '<li><span><b>Самовывоз</b> <small>· ' + esc(SHOP.address) + '</small></span></li></ul>' +
      '<p class="small">Предзаказ из Китая: самолёт или фура до склада, дальше Авито, СДЭК или личная встреча в Москве.</p></div>';
  }
  function paymentCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('card') + '</span>Оплата</h3><ul><li>Перевод: Сбербанк, Т-Банк, Альфа-Банк, СБП</li><li>Наличными <small>· при встрече в Москве</small></li>' +
      (API.enabled ? '<li>До 15% заказа — токенами <small>· 1 токен = 0,4 ₽</small></li><li>Промокоды <small>· вводятся при оформлении</small></li>' : '') + '</ul><p class="small">На сайте оплаты нет: менеджер подтвердит заказ и пришлёт реквизиты.</p></div>';
  }
  function contactsCard() {
    var s = openState();
    return '<div class="card icard"><h3><span class="ic">' + icon('pin') + '</span>Магазин и связь</h3>' +
      '<span class="open-state ' + (s.open ? 'on' : 'off') + '" data-open-state>' + esc(s.text) + '</span>' +
      '<div class="hours"><div data-today-row="0"><span>Пн–Пт</span><span class="num">08:30–21:00</span></div><div data-today-row="1"><span>Сб–Вс</span><span class="num">10:00–20:00</span></div></div>' +
      '<div class="contacts">' +
      '<a class="contact" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('send') + '<span><small>Менеджер в Telegram</small><b>@' + SHOP.manager + '</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<div class="contact"><span class="l">' + icon('phone') + '<span><small>Телефон, WhatsApp</small><b class="num">' + SHOP.phone + '</b></span></span><button class="btn btn-soft btn-sm" type="button" data-copy="' + esc(SHOP.phone) + '" aria-label="Скопировать номер">' + icon('copy') + '</button></div>' +
      '<a class="contact" href="' + SHOP.mapUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('pin') + '<span><small>Адрес</small><b>' + esc(SHOP.address) + '</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '</div></div>';
  }
  function socialCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('megaphone') + '</span>Мы в соцсетях</h3><p class="muted">Новинки сначала выходят в Telegram-канале, сайт подхватывает их сам.</p><div class="contacts">' +
      '<a class="contact" href="' + SHOP.channelUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('megaphone') + '<span><small>Канал магазина</small><b>@ONION_SHOP_OFFICIAL</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<a class="contact" href="' + SHOP.reviewsUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('star') + '<span><small>Отзывы и отправки</small><b>@ONION_SHOP_FEEDBACK</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<a class="contact" href="' + SHOP.tiktokUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('play') + '<span><small>TikTok</small><b>@onion_shop</b></span></span>' + icon('arrow-up-right') + '</a></div></div>';
  }
  function preorderBanner() {
    return '<div class="banner"><span class="ic">' + icon('plane') + '</span><div><h3>Что такое предзаказ</h3><p>Выкупаем товар у поставщика в Китае после вашего заказа, проверяем на складе и отправляем самолётом или фурой. Доставка из Китая оплачивается отдельно по весу.</p></div>' +
      '<a class="btn btn-ghost" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Условия и сроки' + icon('arrow-up-right') + '</a></div>';
  }
  function stepsBlock() {
    var st = [['Выберите вещь', 'В наличии — отправим сразу. Предзаказ — выкупим в Китае под вас.'], ['Размер и цвет', 'Выберите размер и цвет в карточке товара. Пожелания можно написать в комментарии.'],
      ['Токены и промокод', API.enabled ? 'Спишите до 15% суммы токенами и введите промокод.' : 'Укажите контакты и способ получения.'],
      ['Номер заказа', 'Заказ сам уходит менеджеру. Статус видно в «Моих заказах».']];
    return '<div class="steps">' + st.map(function (s, i) { return '<div class="step"><span class="n">' + (i + 1) + '</span><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div>'; }).join('') + '</div>';
  }
  function tokensStrip() {
    if (!API.enabled) return '';
    var u = acct.user;
    if (!u) return '<div class="strip" id="tok-strip"><span class="ic">' + tk() + '</span><div><h3>Токены ONION SHOP</h3><p class="small">+' + RULES.reward.register + ' за регистрацию, задания каждый день, рулетка и бонус за друга. До 15% заказа можно оплатить токенами.</p></div><div class="acts"><a class="btn btn-sm" href="#account">' + icon('gift') + 'Забрать ' + RULES.reward.register + '</a></div></div>';
    var L = u.level, p = L.next ? Math.min(100, Math.round((u.xp - L.min) / (L.next.min - L.min) * 100)) : 100;
    return '<div class="strip" id="tok-strip"><span class="ic">' + lvlImg(L.key, 44) + '</span><div><h3>' + num(u.balance) + ' ' + tokWord(u.balance) + ' · ' + esc(L.name) + ' · ' + num(u.xp) + ' XP</h3>' +
      '<div class="bar"><i data-w="' + p + '%"></i></div><p class="small" style="margin-top:6px">' + (L.next ? 'Ещё ' + num(L.next.left) + ' XP до «' + esc(L.next.name) + '»' : (L.fixed ? 'Уровень закреплён менеджером' : 'Максимальный уровень месяца')) + '</p></div>' +
      '<div class="acts"><a class="btn btn-sm" href="#roulette">' + icon('sparkles') + 'Рулетка</a><a class="btn btn-ghost btn-sm" href="#account">Кабинет</a></div></div>';
  }
  function growBars(root) { requestAnimationFrame(function () { $$('[data-w]', root).forEach(function (b) { b.style.width = b.getAttribute('data-w'); }); }); }

  // ------------------------------------------------------------ главная
  function renderHome() {
    var stock = PRODUCTS.filter(inStockTab).length, pre = PRODUCTS.length - stock;
    var brands = {}; PRODUCTS.forEach(function (p) { if (p.brand) brands[norm(p.brand)] = 1; });
    var nb = Object.keys(brands).length, cats = categories(PRODUCTS).slice(0, 4);
    var rec = recent.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    var art = PRODUCTS.slice(0, 4);
    var v = $('#v-home');
    v.innerHTML =
      '<div class="hero"><div>' +
      '<span class="eyebrow">ONION SHOP · с ' + SHOP.since + ' года</span>' +
      '<h1>Одежда, обувь и аксессуары — <em>в наличии и под заказ из Китая</em></h1>' +
      '<p class="lead">Выберите размер и цвет, спишите токены и введите промокод — заказ сам уйдёт менеджеру. Оплата после подтверждения.</p>' +
      '<form class="hero-search" id="hero-search" role="search">' + icon('search') + '<label class="sr" for="hero-q">Поиск по каталогу</label><input id="hero-q" type="search" placeholder="Hollister, футболка, кроссовки…" autocomplete="off"><button class="btn" type="submit">Найти</button></form>' +
      '<div class="quick"><a href="#stock">В наличии <span class="n">' + stock + '</span></a><a href="#preorder">Предзаказ <span class="n">' + pre + '</span></a>' +
      cats.map(function (c) { return '<a href="#catalog" data-cat="' + c.key + '">' + esc(c.label) + ' <span class="n">' + c.n + '</span></a>'; }).join('') + '</div>' +
      '</div><div class="hero-art" aria-hidden="true">' + art.map(function (p) { return '<a href="#p-' + esc(p.id) + '" tabindex="-1"><img src="' + thumb(p.photos[0].id) + '" alt="" loading="lazy"></a>'; }).join('') + '</div></div>' +
      '<div class="stats">' +
      '<a class="stat" href="#stock"><b>' + stock + '</b><span>' + plural(stock, 'товар', 'товара', 'товаров') + ' в наличии</span></a>' +
      '<a class="stat" href="#preorder"><b>' + pre + '</b><span>по предзаказу</span></a>' +
      '<a class="stat" href="#catalog"><b>' + nb + '</b><span>' + plural(nb, 'бренд', 'бренда', 'брендов') + ' в каталоге</span></a>' +
      '<a class="stat" href="#info"><b>' + ageText() + '</b><span>работаем с марта ' + SHOP.since + '</span></a></div>' +
      tokensStrip() +
      '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Новое в канале</span><h2>Последние поступления</h2></div><a class="btn btn-ghost btn-sm" href="#catalog">Весь каталог' + icon('arrow-right') + '</a></div>' + grid(PRODUCTS.slice(0, 8), 'home-grid') + '</div>' +
      (rec.length ? '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Для вас</span><h2>Вы смотрели</h2></div></div><div class="hscroll">' + rec.map(card).join('') + '</div></div>' : '') +
      '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Как заказать</span><h2>Четыре шага до заказа</h2></div></div>' + stepsBlock() + '</div>' +
      '<div class="sec">' + preorderBanner() + '</div>' +
      '<div class="sec info-grid">' + deliveryCard() + paymentCard() + contactsCard() + socialCard() + '</div>';
    $('#hero-search', v).addEventListener('submit', function (e) { e.preventDefault(); filter = newFilter(); filter.q = $('#hero-q').value.trim(); go('catalog'); });
    $$('.quick a[data-cat]', v).forEach(function (a) { a.addEventListener('click', function () { filter = newFilter(); filter.cat = a.getAttribute('data-cat'); }); });
    growBars(v);
  }

  // ------------------------------------------------------------ каталог
  function newFilter() { return { tab: 'all', cat: 'all', brand: 'all', q: '', sort: 'new', price: 'all', sale: false }; }
  var filter = newFilter();
  var PRICE = { lt2: [0, 2000, 'До 2 000 ₽'], mid: [2000, 5000, '2–5 тыс. ₽'], gt5: [5000, 1e9, 'От 5 000 ₽'] };
  function matches(p, f, skip) {
    if (skip !== 'tab' && f.tab !== 'all' && (f.tab === 'stock' ? !inStockTab(p) : p.status !== f.tab)) return false;
    if (skip !== 'cat' && f.cat !== 'all' && p.category !== f.cat) return false;
    if (f.brand !== 'all' && norm(p.brand) !== f.brand) return false;
    if (f.price !== 'all') { var r = PRICE[f.price]; if (p.price < r[0] || p.price >= r[1]) return false; }
    if (f.sale && !p.oldPrice) return false;
    if (f.q && !qMatch(p, f.q, f._fz || 0)) return false;
    return true;
  }
  // поиск: точный → с опечатками → с исправлением раскладки (куртка / regnrf)
  var LAT = "qwertyuiop[]asdfghjkl;'zxcvbnm,.", CYR = 'йцукенгшщзхъфывапролджэячсмитьбю';
  function swapLayout(t) { return t.replace(/[a-z\[\];',.]/g, function (c) { return CYR.charAt(LAT.indexOf(c)) || c; }); }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function hayOf(p) { if (!p._h) { p._h = norm([p.title, p.subtitle, p.brand, p.categoryLabel, p.colors.join(' '), p.sizes.join(' ')].join(' ')); p._w = p._h.split(/[^a-zа-я0-9]+/).filter(Boolean); } return p; }
  function tokOk(t, p, fuzzy) {
    hayOf(p); if (p._h.indexOf(t) >= 0) return true;
    if (!fuzzy || t.length < 4) return false;
    var m = t.length >= 7 ? 2 : 1;
    return p._w.some(function (w) { return lev(w, t, m) <= m || (w.length > t.length && lev(w.slice(0, t.length), t, m) <= m); });
  }
  function qMatch(p, q, mode) {
    var t = norm(q); if (mode === 2) t = swapLayout(t);
    return t.split(/\s+/).filter(Boolean).every(function (w) { return tokOk(w, p, mode > 0); });
  }
  function searchWords() {
    if (!searchWords.v) { var c = {}; PRODUCTS.forEach(function (p) { hayOf(p); p._w.forEach(function (w) { if (w.length >= 4 && !/^\d+$/.test(w)) c[w] = (c[w] || 0) + 1; }); }); searchWords.v = c; }
    return searchWords.v;
  }
  function didYouMean(q) {
    var t = norm(q).split(/\s+/).filter(Boolean)[0]; if (!t || t.length < 3) return '';
    var W = searchWords(), best = '', bd = 99;
    Object.keys(W).forEach(function (w) { var m = t.length >= 7 ? 3 : 2, d = lev(w, t, m); if (d < bd || (d === bd && W[w] > (W[best] || 0))) { bd = d; best = w; } });
    return bd <= (t.length >= 7 ? 3 : 2) && best !== t ? best : '';
  }
  function renderCatalog() {
    var v = $('#v-catalog'), brands = {};
    PRODUCTS.forEach(function (p) { if (p.brand) brands[norm(p.brand)] = p.brand; });
    var bkeys = Object.keys(brands).sort(function (a, b) { return a.localeCompare(b, 'ru'); });
    v.innerHTML =
      '<div class="view-head"><div><span class="eyebrow">Каталог</span><h1 id="cat-title">Все товары</h1><p class="muted" id="cat-sub"></p></div></div>' +
      '<div class="tabs" role="tablist" aria-label="Наличие" id="cat-tabs"></div>' +
      '<div class="filters"><div class="field-search">' + icon('search') + '<label class="sr" for="cat-q">Поиск</label><input id="cat-q" type="search" placeholder="Поиск: бренд, вещь, цвет…" autocomplete="off" value="' + esc(filter.q) + '"><button class="clear" type="button" id="cat-clear" aria-label="Очистить поиск"' + (filter.q ? '' : ' hidden') + '>' + icon('x') + '</button></div>' +
      '<label class="sr" for="cat-brand">Бренд</label><select class="select" id="cat-brand"><option value="all">Все бренды</option>' + bkeys.map(function (k) { return '<option value="' + esc(k) + '"' + (filter.brand === k ? ' selected' : '') + '>' + esc(brands[k]) + '</option>'; }).join('') + '</select>' +
      '<label class="sr" for="cat-sort">Сортировка</label><select class="select" id="cat-sort"><option value="new">Сначала новые</option><option value="cheap">Сначала дешевле</option><option value="exp">Сначала дороже</option><option value="sale">Самые большие скидки</option></select></div>' +
      '<div class="cats" id="cat-cats" aria-label="Категории"></div><div class="cats" id="cat-price" aria-label="Цена"></div>' +
      '<div class="result-line"><span id="cat-count"></span><button class="link-btn" type="button" id="cat-reset" hidden>Сбросить фильтры</button></div><div id="cat-grid"></div>';
    $('#cat-sort', v).value = filter.sort;
    var q = $('#cat-q', v), qt;
    q.addEventListener('input', function () { filter.q = q.value.trim(); if (filter.q.length >= 2) { clearTimeout(q._t); q._t = setTimeout(function () { track('search'); }, 1500); } $('#cat-clear').hidden = !q.value; clearTimeout(qt); qt = setTimeout(updateCatalog, 120); });
    $('#cat-clear', v).addEventListener('click', function () { q.value = ''; filter.q = ''; this.hidden = true; q.focus(); updateCatalog(); });
    $('#cat-brand', v).addEventListener('change', function () { filter.brand = this.value; if (this.value !== 'all') track('brand'); updateCatalog(); });
    $('#cat-sort', v).addEventListener('change', function () { filter.sort = this.value; updateCatalog(); });
    $('#cat-reset', v).addEventListener('click', function () { var t = filter.tab; filter = newFilter(); filter.tab = t; renderCatalog(); });
    updateCatalog();
  }
  function updateCatalog() {
    var f = filter;
    f._fz = 0;
    if (f.q && !PRODUCTS.some(function (p) { return matches(p, f); })) {
      f._fz = 1;
      if (!PRODUCTS.some(function (p) { return matches(p, f); })) { f._fz = 2; if (!PRODUCTS.some(function (p) { return matches(p, f); })) f._fz = 0; }
    }
    var base = PRODUCTS.filter(function (p) { return matches(p, f, 'tab'); });
    var tabs = [['all', 'Все', base.length], ['stock', 'В наличии', base.filter(inStockTab).length], ['preorder', 'Предзаказ', base.filter(function (p) { return p.status === 'preorder'; }).length]];
    var tEl = $('#cat-tabs');
    tEl.innerHTML = tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (f.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '<span class="n">' + t[2] + '</span></button>'; }).join('');
    $$('button', tEl).forEach(function (b) { b.addEventListener('click', function () { filter.tab = b.getAttribute('data-tab'); silentHash(filter.tab === 'all' ? 'catalog' : filter.tab); updateCatalog(); setNav(location.hash.slice(1)); if (filter.tab === 'preorder') track('pre'); else if (filter.tab === 'stock') track('stock'); }); });
    var forCats = PRODUCTS.filter(function (p) { return matches(p, f, 'cat'); }), cats = categories(forCats);
    var cEl = $('#cat-cats');
    cEl.innerHTML = '<button type="button" aria-pressed="' + (f.cat === 'all') + '" data-cat="all">Все категории <span class="n">' + forCats.length + '</span></button>' + cats.map(function (c) { return '<button type="button" aria-pressed="' + (f.cat === c.key) + '" data-cat="' + c.key + '">' + esc(c.label) + ' <span class="n">' + c.n + '</span></button>'; }).join('');
    $$('button', cEl).forEach(function (b) { b.addEventListener('click', function () { filter.cat = b.getAttribute('data-cat'); updateCatalog(); }); });
    var pEl = $('#cat-price');
    pEl.innerHTML = Object.keys(PRICE).map(function (k) { return '<button type="button" aria-pressed="' + (f.price === k) + '" data-price="' + k + '">' + PRICE[k][2] + '</button>'; }).join('') + '<span class="sep"></span><button type="button" aria-pressed="' + f.sale + '" data-sale="1">' + icon('percent') + 'Со скидкой</button>';
    $$('[data-price]', pEl).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-price'); filter.price = filter.price === k ? 'all' : k; if (filter.price !== 'all') track('price'); updateCatalog(); }); });
    $('[data-sale]', pEl).addEventListener('click', function () { filter.sale = !filter.sale; updateCatalog(); });
    var list = PRODUCTS.filter(function (p) { return matches(p, f); });
    if (f.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
    else if (f.sort === 'exp') list.sort(function (a, b) { return b.price - a.price; });
    else if (f.sort === 'sale') list.sort(function (a, b) { return discount(b) - discount(a) || (+b.id - +a.id); });
    list.sort(function (a, b) { return (a.status === 'out') - (b.status === 'out'); });
    $('#cat-title').textContent = f.tab === 'stock' ? 'В наличии' : f.tab === 'preorder' ? 'Предзаказ из Китая' : 'Все товары';
    $('#cat-sub').textContent = f.tab === 'preorder' ? 'Выкупаем у поставщика после заказа. Доставка из Китая оплачивается отдельно.' : f.tab === 'stock' ? 'Вещи уже в Москве — отправим сразу.' : 'Одежда, обувь и аксессуары из Telegram-канала магазина.';
    $('#cat-count').textContent = 'Найдено: ' + list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров');
    $('#cat-reset').hidden = !(f.cat !== 'all' || f.brand !== 'all' || f.q || f.price !== 'all' || f.sale);
    var fzNote = f._fz === 1 ? '<div class="notice notice-info fz-note">' + icon('search') + '<div>Точных совпадений нет — показали похожие на «' + esc(f.q) + '».</div></div>' : f._fz === 2 ? '<div class="notice notice-info fz-note">' + icon('search') + '<div>Исправили раскладку: искали «' + esc(swapLayout(norm(f.q))) + '».</div></div>' : '';
    var dym = f.q && !f._fz ? didYouMean(f.q) : '';
    $('#cat-grid').innerHTML = list.length ? fzNote + grid(list) :
      '<div class="empty"><span class="ico">' + icon('search') + '</span><h3>Ничего не нашлось</h3>' + (dym ? '<p>Возможно, вы искали <button class="link-btn" type="button" id="dym-btn">' + esc(dym) + '</button></p>' : '') + '<p>Попробуйте другое слово или сбросьте фильтры. Нужной вещи нет — напишите менеджеру, подберём под заказ.</p><div class="acts" style="justify-content:center"><button class="btn btn-ghost btn-sm" type="button" id="empty-reset">Сбросить фильтры</button><a class="btn btn-sm" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">' + icon('send') + 'Написать менеджеру</a></div></div>';
    var dy = $('#dym-btn'); if (dy) dy.addEventListener('click', function () { filter.q = dym; var qi = $('#cat-q'); if (qi) { qi.value = dym; $('#cat-clear').hidden = false; } updateCatalog(); });
    var er = $('#empty-reset'); if (er) er.addEventListener('click', function () { filter = newFilter(); silentHash('catalog'); renderCatalog(); setNav('catalog'); });
  }

  // ------------------------------------------------------------ лайтбокс
  function openLightbox(p, start) {
    closeLightbox(); track('zoom');
    var el = document.createElement('div');
    el.className = 'lightbox'; el.id = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Фото: ' + p.title);
    el.innerHTML = '<div class="lb-top"><span id="lb-count" class="num"></span><button class="icon-btn" type="button" aria-label="Закрыть">' + icon('x') + '</button></div>' +
      '<div class="lb-slides" id="lb-slides">' + p.photos.map(function (ph, i) { return '<figure><img src="' + full(ph.id) + '" alt="' + esc(p.title) + ', фото ' + (i + 1) + '"' + (Math.abs(i - start) > 1 ? ' loading="lazy"' : '') + '></figure>'; }).join('') + '</div>' +
      '<div class="lb-bottom">' + p.photos.map(function (ph, i) { return '<button type="button" data-i="' + i + '" aria-label="Фото ' + (i + 1) + '"><img src="' + thumb(ph.id) + '" alt=""></button>'; }).join('') + '</div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    var sl = $('#lb-slides', el), cnt = $('#lb-count', el);
    function set(i) { cnt.textContent = (i + 1) + ' / ' + p.photos.length; $$('.lb-bottom button', el).forEach(function (b, j) { b.setAttribute('aria-current', String(j === i)); }); }
    sl.addEventListener('scroll', function () { set(Math.round(sl.scrollLeft / Math.max(1, sl.clientWidth))); }, { passive: true });
    $$('.lb-bottom button', el).forEach(function (b) { b.addEventListener('click', function () { sl.scrollTo({ left: +b.getAttribute('data-i') * sl.clientWidth, behavior: 'smooth' }); }); });
    $('.lb-top button', el).addEventListener('click', closeLightbox);
    el.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') sl.scrollBy({ left: sl.clientWidth, behavior: 'smooth' }); if (e.key === 'ArrowLeft') sl.scrollBy({ left: -sl.clientWidth, behavior: 'smooth' }); });
    document.addEventListener('keydown', escClose);
    requestAnimationFrame(function () { sl.scrollLeft = start * sl.clientWidth; set(start); $('.lb-top button', el).focus(); });
  }
  function closeLightbox() { var el = $('#lightbox'); if (el) { el.remove(); document.body.style.overflow = ''; } }

  // ------------------------------------------------------------ страница товара
  var buyObserver = null;
  function hideBuybar() { var bb = $('#buybar'); bb.hidden = true; bb.classList.remove('show'); if (buyObserver) { buyObserver.disconnect(); buyObserver = null; } }
  function trackViews(id) {
    var d = CORE.dayKey(Date.now()), v = store.get('views', { day: d, ids: [] });
    if (v.day !== d) v = { day: d, ids: [] };
    if (v.ids.indexOf(id) < 0) v.ids.push(id);
    store.set('views', v);
    track('view', id);
  }
  function shareProduct(p) {
    var url = location.href.split('#')[0].split('?')[0] + '#p-' + p.id;
    var done = function () { track('share', p.id); };
    try {
      if (navigator.share) { navigator.share({ title: p.title, text: p.title + ' — ' + rub(p.price), url: url }).then(done, function () { /* отменили */ }); return; }
    } catch (e) { /* нет Web Share */ }
    copyText(url, 'Ссылка на товар скопирована'); done();
  }
  // цвет → фото: если фото не меньше, чем цветов, i-й цвет показан на i-м фото
  function colorPhotoMap(p) { return !!p.colorPhoto; }
  function renderProduct(id) {
    var p = BY_ID[id], v = $('#v-product');
    if (!p) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('box') + '</span><h3>Товар больше не продаётся</h3><p>Возможно, его уже купили. Посмотрите похожие вещи в каталоге или спросите менеджера.</p><a class="btn" href="#catalog">Открыть каталог</a></div>'; return; }
    pushRecent(p.id); trackViews(p.id);
    var sel = { size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null, photo: null, photoAuto: false, qty: 1 };
    var many = p.photos.length > 1, d = discount(p), mapOk = colorPhotoMap(p);
    var maxTokRub = Math.floor(p.price * RULES.maxShare);
    var measures = p.details.filter(function (r) { return /(груд|плеч|рукав|длин|ширин|обхват|талия|бедр)/i.test(r[0]); });
    var specs = p.details.filter(function (r) { return measures.indexOf(r) < 0; });
    var related = PRODUCTS.filter(function (x) { return x.id !== p.id && x.category === p.category; });
    if (related.length < 4) related = related.concat(PRODUCTS.filter(function (x) { return x.id !== p.id && x.category !== p.category && (x.status === 'preorder') === (p.status === 'preorder'); }));
    related = related.slice(0, 4);

    v.innerHTML =
      '<div class="back-row"><button class="back-btn" type="button" id="back-btn" aria-label="Назад">' + icon('arrow-right') + 'Назад</button><span class="cr">' + (p.status === 'preorder' ? 'Предзаказ' : 'В наличии') + ' · ' + esc(p.categoryLabel) + '</span></div>' +
      '<div class="product">' +
      '<div class="gallery"><div class="stage"><div class="slides" id="slides" tabindex="0" aria-label="Фотографии товара. Нажмите, чтобы увеличить">' +
      p.photos.map(function (ph, i) { return '<figure data-i="' + i + '" style="--bg:url(\'' + thumb(ph.id) + '\')"><img src="' + full(ph.id) + '" alt="' + esc(p.title) + ', фото ' + (i + 1) + '" ' + (i ? 'loading="lazy" ' : '') + 'decoding="async" width="' + ph.w + '" height="' + ph.ht + '"></figure>'; }).join('') + '</div>' +
      (many ? '<button class="nav-b prev" type="button" aria-label="Предыдущее фото">' + icon('chevron-right') + '</button><button class="nav-b next" type="button" aria-label="Следующее фото">' + icon('chevron-right') + '</button><span class="gal-count" id="gal-count">1 / ' + p.photos.length + '</span>' : '') +
      '<button class="zoom" type="button" id="zoom-btn" aria-label="Увеличить фото">' + icon('expand') + '</button></div>' +
      (many ? '<div class="thumbs" id="thumbs">' + p.photos.map(function (ph, i) { return '<button type="button" data-i="' + i + '" aria-label="Фото ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '><img src="' + thumb(ph.id) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="info"><div class="card info-card">' +
      '<div class="top">' + badge(p) + (d >= 3 ? '<span class="badge badge-sale">−' + d + '%</span>' : '') + '<span class="sp"></span>' +
      '<button class="icon-btn" type="button" id="share-btn" aria-label="Поделиться">' + icon('share') + '</button>' +
      '<button class="icon-btn fav-big" type="button" data-fav="' + esc(p.id) + '" aria-pressed="' + isFav(p.id) + '" aria-label="В избранное">' + icon('heart') + '</button></div>' +
      '<div>' + (p.brand ? '<div class="brand-top">' + esc(p.brand) + '</div>' : '') + '<h1>' + esc(p.title) + '</h1>' + (p.subtitle ? '<p class="sub">' + esc(cap(p.subtitle)) + '</p>' : '') + '</div>' +
      '<div class="price-box"><div class="price-row"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span><span class="badge badge-ok">выгода ' + rub(p.oldPrice - p.price) + '</span>' : '') + '</div>' +
      (API.enabled ? '<span class="tok-hint">' + tk() + 'Токенами можно оплатить до <b>' + rub(maxTokRub) + '</b></span>' : '') + '</div>' +
      ((p.facts && p.facts.length) ? '<ul class="facts" aria-label="Главное о товаре">' + p.facts.slice(0, 6).map(function (f) { return '<li><small>' + esc(f[0]) + '</small><b>' + esc(f[1]) + '</b></li>'; }).join('') + '</ul>' : '') +
      (p.status === 'preorder'
        ? '<div class="notice notice-pre">' + icon('plane') + '<div><b>Предзаказ из Китая.</b> Выкупим у поставщика после заказа, проверим на складе и отправим. Доставка из Китая — отдельно по весу. <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Как это работает</a></div></div>'
        : p.status === 'out' ? '<div class="notice notice-out">' + icon('clock') + '<div><b>Временно нет в наличии.</b> Заказ можно оформить — менеджер уточнит у вас срок поступления и подтвердит заказ. Оплата только после согласования.</div></div>' + (API.enabled ? '<button class="btn btn-ghost btn-sm wait-btn" type="button" id="wait-btn"></button>' : '')
        : '<div class="notice notice-info">' + icon('box') + '<div><b>В наличии в Москве.</b> Доставка по Москве и в другие города через Авито, курьер — по согласованию с менеджером, самовывоз.</div></div>') +
      (p.sizes.length ? '<div class="opt" id="opt-size"><div class="opt-head"><b>Размер' + (p.sizes.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val"><span id="size-val">' + (sel.size ? esc(sel.size) : 'не выбран') + '</span>' + (measures.length ? ' · <button class="link-btn" type="button" id="measure-btn">Замеры</button>' : '') + (p.sizes.length > 1 ? ' · <button class="link-btn" type="button" id="fit-btn">Подобрать</button>' : '') + '</span></div><div class="choices">' +
        p.sizes.map(function (s) { return '<button class="choice" type="button" data-size="' + esc(s) + '" aria-pressed="' + (sel.size === s) + '">' + esc(s) + '</button>'; }).join('') + '</div><span class="msg" hidden>Выберите размер</span></div>' : '') +
      (p.colors.length ? '<div class="opt" id="opt-color"><div class="opt-head"><b>Цвет' + (p.colors.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val" id="color-val">' + (sel.color ? esc(cap(sel.color)) : 'не выбран') + '</span></div><div class="choices">' +
        p.colors.map(function (c) { return '<button class="choice color" type="button" data-color="' + esc(c) + '" aria-pressed="' + (sel.color === c) + '"><i class="sw" style="' + swatch(c) + '"></i>' + esc(cap(c)) + '</button>'; }).join('') + '</div><span class="msg" hidden>Выберите цвет</span></div>' : '') +
      '<div class="opt"><label for="p-note"><b style="font-size:14.5px">' + (p.status === 'preorder' ? 'Пожелания к товару' : 'Комментарий') + '</b> <span class="small">· по желанию</span></label><textarea id="p-note" maxlength="300" placeholder="' + (p.status === 'preorder' ? 'Например: посадка oversize, проверить швы, фото бирки' : 'Например: хочу примерить перед покупкой') + '"></textarea></div>' +
      '<div class="buy"><div class="qty" aria-label="Количество"><button type="button" id="q-minus" aria-label="Меньше" disabled>' + icon('minus') + '</button><output id="q-val">1</output><button type="button" id="q-plus" aria-label="Больше">' + icon('plus') + '</button></div>' +
      '<button class="btn" type="button" id="add-btn">' + icon('bag') + '<span id="add-lbl">В корзину · ' + rub(p.price) + '</span></button></div>' +
      '<button class="btn btn-ghost" type="button" id="buy-now">Оформить сразу' + icon('arrow-right') + '</button>' +
      '<div class="acc">' +
      ((specs.length || p.notes.length) ? '<details open><summary>Характеристики' + icon('chevron-down') + '</summary><div class="acc-body">' + (specs.length ? '<dl class="specs">' + specs.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + (p.notes.length ? '<div class="notes">' + p.notes.map(function (n) { return '<span>' + icon('check') + esc(n) + '</span>'; }).join('') + '</div>' : '') + '</div></details>' : '') +
      (measures.length ? '<details' + (specs.length ? '' : ' open') + '><summary>Замеры изделия' + icon('chevron-down') + '</summary><div class="acc-body"><dl class="specs">' + measures.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></div></details>' : '') +
      '<details><summary>Доставка и оплата' + icon('chevron-down') + '</summary><div class="acc-body"><p>' + (p.status === 'preorder' ? 'Из Китая: самолёт — 5–9 дней до Москвы от склада, фура — 18–32 дня. По России — Авито, СДЭК или личная встреча в Москве.' : 'Доставка по Москве или в другой город через Авито — быстрее всего. Курьер по Москве — не всегда, согласуется с менеджером. Самовывоз: ' + esc(SHOP.address) + '.') + '</p><p>Оплата переводом или наличными при встрече — после подтверждения менеджером.' + (API.enabled ? ' До 15% суммы можно оплатить токенами, промокод вводится при оформлении.' : '') + '</p></div></details>' +
      (API.enabled ? '<details id="rev-det"><summary>Отзывы <span class="rev-n" id="rev-n"></span>' + icon('chevron-down') + '</summary><div class="acc-body" id="rev-body"><p class="small">Загружаем…</p></div></details>' : '') +
      '</div>' +
      '<a class="tg-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + icon('send') + 'Пост с этим товаром в канале</a>' +
      '</div></div></div>' +
      (related.length ? '<div class="sec"><div class="sec-head"><h2>Похожие товары</h2></div>' + grid(related, 'home-grid') + '</div>' : '');

    // галерея
    var slides = $('#slides', v), thumbs = $('#thumbs', v), count = $('#gal-count', v), cur = 0;
    function goTo(i, smooth) {
      i = Math.max(0, Math.min(p.photos.length - 1, i));
      if (smooth === false || REDUCED) {
        // мгновенно и надёжно: прерывает плавную прокрутку, которая могла ещё идти
        slides.style.scrollBehavior = 'auto'; slides.scrollLeft = i * slides.clientWidth; slides.style.scrollBehavior = '';
        setCur(i);
      } else slides.scrollTo({ left: i * slides.clientWidth, behavior: 'smooth' });
    }
    function setCur(i) {
      if (i === cur) return; cur = i;
      if (count) count.textContent = (i + 1) + ' / ' + p.photos.length;
      if (thumbs) $$('button', thumbs).forEach(function (b, j) { b.setAttribute('aria-current', String(j === i)); if (j === i && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    }
    var st;
    slides.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { setCur(Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth))); }, 50); }, { passive: true });
    if (thumbs) $$('button', thumbs).forEach(function (b) { b.addEventListener('click', function () { goTo(+b.getAttribute('data-i')); }); });
    var prev = $('.prev', v), next = $('.next', v);
    if (prev) prev.addEventListener('click', function () { goTo(cur - 1); });
    if (next) next.addEventListener('click', function () { goTo(cur + 1); });
    slides.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(cur + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1); } if (e.key === 'Enter') openLightbox(p, cur); });
    $$('figure', slides).forEach(function (f) { f.addEventListener('click', function () { openLightbox(p, +f.getAttribute('data-i')); }); });
    $('#back-btn', v).addEventListener('click', function () { if (routed > 1) history.back(); else go('catalog'); });
    $('#zoom-btn', v).addEventListener('click', function () { openLightbox(p, cur); });
    $('#share-btn', v).addEventListener('click', function () { shareProduct(p); });
    var mb = $('#measure-btn', v);
    if (mb) mb.addEventListener('click', function () { track('measure'); openModal(modalHead('Замеры: ' + p.title) + '<dl class="specs">' + measures.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p class="small">Замеры сделаны по изделию, без растяжения. Сомневаетесь с размером — спросите менеджера.</p>', { cls: 'sm' }); });

    var fb = $('#fit-btn', v);
    if (fb) fb.addEventListener('click', function () { track('measure'); fitModal(p, function (size) { var b = $('[data-size="' + size + '"]', v); if (b) b.click(); }); });
    var rd = $('#rev-det', v);
    if (rd) rd.addEventListener('toggle', function () { if (rd.open) loadReviews(p.id, $('#rev-body', v), $('#rev-n', v)); });
    var wb = $('#wait-btn', v);
    if (wb) {
      var isWait = function () { return !!(acct.user && (acct.user.waits || []).some(function (w) { return w.id === p.id; })); };
      var paintWait = function () { var on = isWait(); wb.classList.toggle('on', on); wb.innerHTML = icon('clock') + (on ? 'Вы ждёте этот товар · отменить' : 'Сообщить, когда появится'); };
      paintWait();
      wb.addEventListener('click', function () {
        if (!acct.user) { toast('Войдите в кабинет — тогда сообщим, когда товар появится', { label: 'Войти', run: function () { go('account'); } }, 'warn'); return; }
        var on = isWait(); busy(wb, true, 'Секунду');
        API.call('waitlist', { productId: p.id, on: !on }).then(function (r) {
          busy(wb, false);
          if (!r.ok) { toast(r.error, null, 'warn'); return; }
          acct.user = r.user; updateAcctUI(); paintWait();
          if (on) toast('Больше не следим за этим товаром');
          else if (r.user.tgOn) toast('Напишем в Telegram, когда товар появится');
          else toast('Покажем в кабинете. Чтобы получить сообщение в Telegram — подключите бота', { label: 'Подключить', run: tgModal });
        });
      });
    }

    // параметры
    function clearErr(oid) { var o = $('#' + oid); if (o) { o.classList.remove('err'); var m = $('.msg', o); if (m) m.hidden = true; } }
    function setPhoto(pid, auto) {
      sel.photo = pid; sel.photoAuto = !!auto;
      $$('[data-photo]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(+x.getAttribute('data-photo') === sel.photo)); });
      var i = p.photos.findIndex(function (x) { return x.id === pid; });
      var pv = $('#photo-val'); if (pv) pv.textContent = pid ? 'фото №' + (i + 1) + (auto ? ' · по цвету' : '') : 'не отмечен';
      if (pid && i >= 0) { goTo(i, false); setTimeout(function () { if (sel.photo === pid) goTo(i, false); }, 80); }
    }
    $$('[data-size]', v).forEach(function (b) { b.addEventListener('click', function () { sel.size = b.getAttribute('data-size'); $$('[data-size]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#size-val').textContent = sel.size; clearErr('opt-size'); }); });
    $$('[data-color]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        sel.color = b.getAttribute('data-color');
        $$('[data-color]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $('#color-val').textContent = cap(sel.color); clearErr('opt-color');
        // выбранный цвет всегда показывает своё фото (даже если до этого вручную отметили другое)
        if (mapOk && p.colorPhoto[sel.color]) setPhoto(p.colorPhoto[sel.color], true);
        else if (mapOk && sel.photo) {
          var owner = Object.keys(p.colorPhoto).filter(function (c) { return p.colorPhoto[c] === sel.photo; })[0];
          if (sel.photoAuto || (owner && owner !== sel.color)) setPhoto(null); // отмеченное фото относится к другому цвету
        }
      });
    });
    var qv = $('#q-val', v), qm = $('#q-minus', v), qp = $('#q-plus', v), lbl = $('#add-lbl', v);
    function setQty(n) { sel.qty = Math.max(1, Math.min(10, n)); qv.textContent = sel.qty; qm.disabled = sel.qty <= 1; qp.disabled = sel.qty >= 10; lbl.textContent = 'В корзину · ' + rub(p.price * sel.qty); updBuybar(); }
    qm.addEventListener('click', function () { setQty(sel.qty - 1); });
    qp.addEventListener('click', function () { setQty(sel.qty + 1); });
    function validate() {
      var bad = null;
      if (p.sizes.length > 1 && !sel.size) { var o = $('#opt-size'); o.classList.remove('err'); void o.offsetWidth; o.classList.add('err'); $('.msg', o).hidden = false; bad = bad || o; }
      if (p.colors.length > 1 && !sel.color) { var c = $('#opt-color'); c.classList.remove('err'); void c.offsetWidth; c.classList.add('err'); $('.msg', c).hidden = false; bad = bad || c; }
      if (bad) { bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); var btn = $('.choice', bad); if (btn) setTimeout(function () { btn.focus({ preventScroll: true }); }, 350); return false; }
      return true;
    }
    function add() {
      if (!validate()) return false;
      addToCart({ id: p.id, size: sel.size, color: sel.color, photo: sel.photo, qty: sel.qty, note: $('#p-note').value.trim() });
      var img = $$('figure img', slides)[cur]; flyToCart(img);
      return true;
    }
    var addBtn = $('#add-btn', v), addTimer;
    addBtn.addEventListener('click', function () {
      if (!add()) return;
      addBtn.classList.add('done'); lbl.textContent = 'Добавлено';
      clearTimeout(addTimer); addTimer = setTimeout(function () { addBtn.classList.remove('done'); lbl.textContent = 'В корзину · ' + rub(p.price * sel.qty); }, 1500);
      toast('В корзине: ' + p.title, { label: 'Оформить', run: function () { go('cart'); } });
    });
    $('#buy-now', v).addEventListener('click', function () { if (add()) setTimeout(function () { go('cart'); }, REDUCED ? 0 : 450); });

    // липкая кнопка на телефоне
    var bb = $('#buybar');
    function updBuybar() { var pr = $('.price', bb); if (pr) pr.textContent = rub(p.price * sel.qty); }
    bb.innerHTML = '<div class="bb-info"><b class="price">' + rub(p.price) + '</b><span>' + esc(p.title) + '</span></div><button class="btn" type="button" id="bb-add">' + icon('bag') + 'В корзину</button>';
    bb.hidden = false;
    $('#bb-add', bb).addEventListener('click', function () { addBtn.click(); });
    if ('IntersectionObserver' in window) {
      buyObserver = new IntersectionObserver(function (en) { bb.classList.toggle('show', !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }, { threshold: 0 });
      buyObserver.observe(addBtn);
    }
    requestAnimationFrame(function () { goTo(0, false); });
  }

  // ------------------------------------------------------------ корзина, анкета, токены, промокод
  var form = Object.assign({ name: '', phone: '', tg: '', recv: '', recvCity: '', recvAddr: '', ship: '', city: '', preRecv: '', comment: '' }, store.get('form', {}));
  var draft0 = store.get('draft', {}) || {};
  var ack = draft0.ack === 'yes' || draft0.ack === 'no' ? draft0.ack : null, tokUse = Math.max(0, +draft0.tokUse || 0), cartPromo = draft0.promo && draft0.promo.code ? draft0.promo : null; // cartPromo: {code, pct, withTokens, personal}
  draftReady = true;
  var usePack = draft0.usePack !== false;
  function saveDraft() { store.set('draft', { ack: ack, tokUse: tokUse, promo: cartPromo, usePack: usePack }); }
  function saveForm() { store.set('form', form); }
  function optionText(l, p) {
    var o = [];
    if (l.size) o.push('Размер ' + l.size);
    if (l.color) o.push(cap(l.color));
    if (l.photo) { var i = p.photos.findIndex(function (x) { return x.id === l.photo; }); if (i >= 0) o.push('фото №' + (i + 1)); }
    return o.join(' · ');
  }
  function radio(name, value, cur, title, sub, tag) { return '<label class="radio"><input type="radio" name="' + name + '" value="' + value + '"' + (cur === value ? ' checked' : '') + '><span class="mark"></span><b>' + title + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</label>'; }
  function totals(lines) {
    var t = { total: 0, old: 0, cnt: 0, pre: false, stock: false };
    lines.forEach(function (l) { var p = BY_ID[l.id]; t.total += p.price * l.qty; t.old += (p.oldPrice || p.price) * l.qty; t.cnt += l.qty; if (p.status === 'preorder') t.pre = true; else { t.stock = true; if (p.status === 'out') t.out = true; } });
    var u = acct.user, noTok = cartPromo && cartPromo.withTokens === false;
    t.maxTok = u && !noTok ? Math.min(u.balance, Math.floor(t.total * RULES.maxShare / RULES.tokenRub)) : 0;
    t.tok = Math.max(0, Math.min(tokUse, t.maxTok));
    t.tokRub = CORE.tokensToRub(t.tok);
    var pbase = t.total;
    if (cartPromo && cartPromo.cat) { var pc = (RULES.promoCats || []).filter(function (c) { return c.key === cartPromo.cat; })[0]; pbase = 0; lines.forEach(function (l) { var p = BY_ID[l.id]; if (pc && pc.cats.indexOf(p.category) >= 0) pbase += p.price * l.qty; }); }
    t.promo = cartPromo ? cartPromo.code : ''; t.promoRub = cartPromo ? Math.round(pbase * cartPromo.pct / 100) : 0; t.promoNoBase = !!(cartPromo && cartPromo.cat && !pbase);
    t.pack = u && u.pack && u.pack.available ? u.pack : null; t.packOk = !!(t.pack && (t.pack.kind === 'free' || t.pre));
    t.toPay = Math.max(0, t.total - t.tokRub - t.promoRub);
    return t;
  }
  function renderCart() {
    var v = $('#v-cart');
    var gone = cart.filter(function (l) { return !BY_ID[l.id]; });
    if (gone.length) { cart = cartLines(); saveCart(); }
    var lines = cartLines();
    if (!lines.length) {
      v.innerHTML = '<div class="view-head"><div><span class="eyebrow">Корзина</span><h1>Корзина пуста</h1></div></div>' +
        (gone.length ? '<div class="notice notice-info" style="margin-bottom:12px">' + icon('alert') + '<div>Часть товаров уже продана и убрана из корзины.</div></div>' : '') +
        '<div class="empty"><span class="ico">' + icon('bag') + '</span><h3>Здесь появятся выбранные вещи</h3><p>Откройте каталог, выберите размер и цвет и нажмите «В корзину».</p><div class="acts" style="justify-content:center"><a class="btn" href="#catalog">' + icon('grid') + 'Перейти в каталог</a>' + (favs.length ? '<a class="btn btn-ghost" href="#favorites">' + icon('heart') + 'Избранное</a>' : '') + '</div></div>';
      return;
    }
    var u = acct.user;
    if (u) {
      if (!form.name) form.name = u.name; if (!form.phone) form.phone = u.phone; if (!form.tg) form.tg = u.tg;
      if (cartPromo && cartPromo.personal) { var cp = u.promos.filter(function (x) { return x.code === cartPromo.code; })[0]; if (!cp) cartPromo = null; else { cartPromo.pct = cp.pct; cartPromo.cat = cp.cat || ''; cartPromo.catLabel = cp.catLabel || ''; } }
    }
    var t = totals(lines), n = 0; saveDraft();
    v.innerHTML =
      '<div class="view-head"><div><span class="eyebrow">Оформление заказа</span><h1>Корзина и оформление</h1><p class="muted">Черновик сохранён: можно уйти в другой раздел и вернуться к оформлению в любой момент. ' + (API.enabled ? 'Заказ с номером сам уйдёт менеджеру — копировать ничего не нужно.' : 'Заполните анкету, и мы получим заказ.') + '</p></div></div>' +
      (gone.length ? '<div class="notice notice-info" style="margin-bottom:12px">' + icon('alert') + '<div>Проданные товары убраны из корзины: ' + gone.length + '.</div></div>' : '') +
      (API.enabled && !u && acct.ready ? '<div class="notice notice-info need-acc" style="margin-bottom:12px">' + icon('user') + '<div><b>Заказ оформляется из кабинета.</b> Создайте кабинет или войдите — корзина и анкета сохранятся. Регистрация занимает минуту, и вы получите ' + RULES.reward.register + ' токенов.<div class="acts" style="margin-top:10px"><button class="btn btn-sm" type="button" id="need-acc">' + icon('user') + 'Войти или создать кабинет</button></div></div></div>' : '') +
      '<form class="checkout" id="checkout" novalidate><div class="col">' +
      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Товары · ' + t.cnt + ' шт.</h2><button class="link-btn" type="button" id="cart-clear">Очистить</button></div><div class="lines">' +
      lines.map(function (l, i) {
        var p = BY_ID[l.id], ph = p.photos.find(function (x) { return x.id === l.photo; }) || p.photos[0];
        return '<div class="line" data-k="' + i + '"><a class="ph" href="#p-' + esc(p.id) + '"><img src="' + thumb(ph.id) + '" alt="" loading="lazy"></a>' +
          '<div style="min-width:0"><a class="t" href="#p-' + esc(p.id) + '">' + esc(p.title) + '</a><div class="meta">' + badge(p) + (optionText(l, p) ? '<span>' + esc(optionText(l, p)) + '</span>' : '') + '</div>' +
          (l.note ? '<div class="meta">Пожелания: ' + esc(l.note) + '</div>' : '') + '</div>' +
          '<div class="row"><div class="qty sm"><button type="button" data-q="-1" aria-label="Меньше"' + (l.qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button><output>' + l.qty + '</output><button type="button" data-q="1" aria-label="Больше"' + (l.qty >= 10 ? ' disabled' : '') + '>' + icon('plus') + '</button></div>' +
          '<span class="price">' + rub(p.price * l.qty) + '</span><button class="icon-btn" type="button" data-del aria-label="Убрать из корзины" style="box-shadow:none;background:var(--tile)">' + icon('trash') + '</button></div></div>';
      }).join('') + '</div></div>' +

      (API.enabled ? '<div class="card panel" id="tokpanel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Токены и промокод</h2>' + (u ? '<span class="tok">' + tk() + num(u.balance) + '</span>' : '') + '</div>' +
        (u ? (t.maxTok > 0 ? '<div class="tokbox"><div class="tokrow"><span>Списать <b id="tok-n">' + num(t.tok) + '</b> <span id="tok-w">' + tokWord(t.tok) + '</span></span><b id="tok-rub">−' + rub(t.tokRub) + '</b></div>' +
            '<label class="sr" for="tok-range">Сколько токенов списать</label><input class="range" id="tok-range" type="range" min="0" max="' + t.maxTok + '" step="1" value="' + t.tok + '">' +
            '<div class="tokrow"><span class="small">До 15% заказа · максимум ' + num(t.maxTok) + ' = ' + rub(CORE.tokensToRub(t.maxTok)) + '</span><span class="tokq"><button type="button" data-tq="0">0</button><button type="button" data-tq="1">Максимум</button></span></div></div>'
            : '<p class="small">' + (cartPromo && cartPromo.withTokens === false ? 'Промокод ' + esc(cartPromo.code) + ' нельзя совмещать с токенами.' : 'Пока нечего списывать. Отмечайтесь каждый день и выполняйте задания — токены пригодятся в следующем заказе.') + '</p>') +
          (u.promos.length ? '<div class="promos">' + u.promos.map(function (pr) { return '<button type="button" class="ticket" data-promo="' + esc(pr.code) + '" aria-pressed="' + (!!cartPromo && cartPromo.code === pr.code) + '"><code>' + esc(pr.code) + '</code><span class="pct">−' + pctTxt(pr.pct) + '%</span>' + (pr.cat ? '<span class="small">на «' + esc(pr.catLabel) + '»</span>' : '') + '</button>'; }).join('') + '</div>' : '')
          : '<div class="guest-box">' + tk('lg') + '<div><b>Заказ оформляется из кабинета — войдите или создайте его</b><p class="small">За регистрацию — ' + RULES.reward.register + ' токенов. Корзина сохранится.</p></div></div><div class="acts"><button class="btn btn-sm btn-ghost" type="button" id="go-auth">' + icon('user') + 'Войти или создать аккаунт</button></div>') +
        '<div class="f"><label for="promo-in">Промокод</label><div class="promo-row"><input class="input" id="promo-in" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Например, HALLOWEEN" value="' + esc(cartPromo && !cartPromo.personal ? cartPromo.code : '') + '"><button class="btn btn-dark" type="button" id="promo-btn">' + (cartPromo && !cartPromo.personal ? 'Убрать' : 'Применить') + '</button></div><div id="promo-msg">' + (cartPromo ? (t.promoNoBase ? '<span class="promo-bad">Промокод ' + esc(cartPromo.code) + ' действует только на «' + esc(cartPromo.catLabel) + '» — таких товаров в корзине нет</span>' : '<span class="promo-ok">' + icon('check-circle') + 'Промокод ' + esc(cartPromo.code) + ': −' + pctTxt(cartPromo.pct) + '%' + (cartPromo.cat ? ' на «' + esc(cartPromo.catLabel) + '»' : '') + '</span>') : '') + '</div></div>' +
        (t.pack ? (t.packOk ? '<label class="pack-row"><input type="checkbox" id="use-pack"' + (usePack ? ' checked' : '') + '><span class="cbx">' + icon('check') + '</span><span><b>' + esc(t.pack.label) + ' — применить к этому заказу</b><small>' + esc(t.pack.note) + '. Менеджер учтёт при расчёте упаковки.</small></span></label>'
          : '<p class="small pack-note">' + icon('info') + esc(t.pack.label) + ' (привилегия ' + esc(t.pack.level) + ') действует только для заказа с предзаказом из Китая.</p>') : '') +
        '</div>' : '') +

      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Контакты</h2>' + (u ? '<span class="small">из профиля</span>' : '') + '</div><div class="fgrid">' +
      '<div class="f" data-f="name"><label for="f-name">Имя</label><input class="input" id="f-name" autocomplete="name" placeholder="Как к вам обращаться" value="' + esc(form.name) + '"><span class="err-msg" hidden></span></div>' +
      '<div class="f" data-f="phone"><label for="f-phone">Телефон</label><input class="input" id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"><span class="err-msg" hidden></span></div>' +
      '<div class="f full" data-f="tg"><label for="f-tg">Username в Telegram <span class="opt-l">· желательно</span></label><div class="prefix"><span>@</span><input class="input" id="f-tg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="username" value="' + esc(form.tg) + '"></div><span class="hint">Так менеджеру быстрее написать вам. Если username нет — оставьте пустым, свяжемся по телефону.</span><span class="err-msg" hidden></span></div>' +
      '</div></div>' +

      (t.stock ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Получение' + (t.pre ? ' товаров в наличии' : '') + '</h2></div>' +
        '<div class="f" data-f="recv"><span class="lbl sr">Способ получения</span><div class="radios">' +
        radio('recv', 'city', form.recv, 'Доставка по Москве или в другой город', 'Оформляем через Авито Доставку — так быстрее всего и так заказывают чаще всего.', 'Быстрее всего') +
        radio('recv', 'courier', form.recv, 'Курьер по Москве', 'Не всегда доступен — согласуется с менеджером отдельно.') +
        radio('recv', 'pickup', form.recv, 'Самовывоз', esc(SHOP.address) + '. Время согласуйте с менеджером.') +
        '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvCity"' + (form.recv === 'city' ? '' : ' hidden') + '><label for="f-recv-city">Город</label><input class="input" id="f-recv-city" autocomplete="address-level2" placeholder="Москва или другой город" value="' + esc(form.recvCity) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvAddr"' + (form.recv === 'courier' ? '' : ' hidden') + '><label for="f-recv-addr">Адрес или район <span class="opt-l">· по желанию</span></label><input class="input" id="f-recv-addr" autocomplete="street-address" placeholder="Уточним с менеджером" value="' + esc(form.recvAddr) + '"></div></div>' : '') +

      (t.pre ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Предзаказ из Китая</h2><a class="link-btn" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Условия</a></div>' +
        '<div class="f" data-f="ship"><span class="lbl">Отправка со склада в Китае</span><div class="radios cols">' + radio('ship', 'air', form.ship, 'Самолёт', 'Быстрее: 5–9 дней до Москвы от склада') + radio('ship', 'truck', form.ship, 'Фура', 'Дешевле: 18–32 дня от склада') + '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="city"><label for="f-city">Город, куда привезти</label><input class="input" id="f-city" autocomplete="address-level2" placeholder="Например, Москва" value="' + esc(form.city) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="preRecv"><span class="lbl">Способ получения</span><div class="radios cols">' + radio('preRecv', 'avito', form.preRecv, 'Авито Доставка', '') + radio('preRecv', 'cdek', form.preRecv, 'СДЭК', 'До пункта выдачи') + radio('preRecv', 'meet', form.preRecv, 'Личная встреча', 'В Москве') + '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="ack"><div class="ack" id="ack"><div class="q"><span class="checkbox" id="ack-box" role="img" aria-label="Не подтверждено">' + icon('check') + '</span><div><b>Я прочитал(а) условия доставки и оформления заказа по предзаказу</b><p class="small" style="margin-top:4px">Сроки, оплата доставки по весу и что не зависит от магазина — на <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">странице о предзаказе</a>.</p></div></div>' +
        '<div class="ack-opts"><button type="button" class="yes" data-ack="yes" aria-pressed="' + (ack === 'yes') + '">Да, ознакомился(-ась)</button><button type="button" class="no" data-ack="no" aria-pressed="' + (ack === 'no') + '">Нет, ещё не успел(а)</button><button type="button" class="cancel" data-ack="cancel">Отказаться от оформления</button></div>' +
        '<div id="ack-hint"' + (ack === 'no' ? '' : ' hidden') + ' style="font-size:14px">Без подтверждения заказ по предзаказу не оформить. <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener"><b>Открыть условия</b></a> — это пара минут, корзина сохранится.</div></div><span class="err-msg" hidden></span></div></div>' : '') +

      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Комментарий <span class="small" style="font-family:var(--f-b);font-weight:400">· по желанию</span></h2></div><div class="f"><label class="sr" for="f-comment">Комментарий к заказу</label><textarea id="f-comment" maxlength="500" placeholder="Удобное время связи, вопросы по размеру…">' + esc(form.comment) + '</textarea></div></div>' +
      '</div>' +

      '<aside class="card sumcard"><h2>Ваш заказ</h2>' +
      '<div class="sumrow"><span>Товары · ' + t.cnt + ' шт.</span><b>' + rub(t.total) + '</b></div>' +
      (t.old > t.total ? '<div class="sumrow good"><span>Скидки на товары</span><b>учтены · −' + rub(t.old - t.total) + '</b></div>' : '') +
      '<div class="sumrow" id="sum-tok"' + (t.tok ? '' : ' hidden') + '><span>Токены</span><b>−' + rub(t.tokRub) + '</b></div>' +
      '<div class="sumrow good" id="sum-promo"' + (t.promoRub ? '' : ' hidden') + '><span>Промокод <span id="sum-promo-code">' + esc(t.promo) + '</span></span><b>−' + rub(t.promoRub) + '</b></div>' +
      '<div class="sumtotal"><span>К оплате</span><b id="sum-pay">' + rub(t.toPay) + '</b></div>' +
      (t.pre ? '<p class="small">Доставка из Китая оплачивается отдельно по весу посылки.</p>' : '') +
      (t.out ? '<p class="small">⏳ В заказе есть товар, которого временно нет в наличии — менеджер уточнит срок поступления.</p>' : '') +
      (API.enabled && !u ? '<button class="btn btn-block" type="submit" id="submit-btn">' + icon('user') + '<span>Войти, чтобы оформить</span></button>' : '<button class="btn btn-block" type="submit" id="submit-btn">' + icon('check-circle') + '<span>Оформить заказ</span></button>') +
      '<p class="small">Оплаты на сайте нет. Менеджер подтвердит заказ и пришлёт реквизиты.</p></aside></form>';

    // строки корзины
    $$('.line', v).forEach(function (row) {
      var l = lines[+row.getAttribute('data-k')];
      $$('[data-q]', row).forEach(function (b) { b.addEventListener('click', function () { l.qty = Math.max(1, Math.min(10, l.qty + +b.getAttribute('data-q'))); saveCart(); renderCart(); }); });
      $('[data-del]', row).addEventListener('click', function () {
        var idx = cart.indexOf(l); if (idx < 0) return;
        cart.splice(idx, 1); saveCart(); renderCart();
        toast('Товар убран из корзины', { label: 'Вернуть', run: function () { cart.splice(idx, 0, l); saveCart(); if (current === 'cart') renderCart(); } });
      });
    });
    $('#cart-clear', v).addEventListener('click', function () { confirmBox({ title: 'Очистить корзину?', text: 'Все выбранные товары будут убраны.', actions: [{ label: 'Оставить', cls: 'btn-ghost' }, { label: 'Очистить', cls: 'btn-danger', run: function () { cart = []; saveCart(); renderCart(); } }] }); });

    // токены и промокоды
    var ga = $('#go-auth', v); if (ga) ga.addEventListener('click', function () { requireAuth('cart'); });
    var range = $('#tok-range', v);
    function updSum() {
      var tt = totals(lines);
      if (range) { range.style.setProperty('--p', (tt.maxTok ? tt.tok / tt.maxTok * 100 : 0) + '%'); $('#tok-n').textContent = num(tt.tok); $('#tok-w').textContent = tokWord(tt.tok); $('#tok-rub').textContent = '−' + rub(tt.tokRub); }
      var st = $('#sum-tok'); st.hidden = !tt.tok; $('b', st).textContent = '−' + rub(tt.tokRub);
      var sp = $('#sum-promo'); sp.hidden = !tt.promoRub; $('b', sp).textContent = '−' + rub(tt.promoRub); $('#sum-promo-code').textContent = tt.promo;
      saveDraft();
      var pay = $('#sum-pay'); pay.textContent = rub(tt.toPay); bump(pay);
    }
    if (range) {
      range.addEventListener('input', function () { tokUse = +range.value; updSum(); });
      $$('[data-tq]', v).forEach(function (b) { b.addEventListener('click', function () { var tt = totals(lines); tokUse = Math.floor(tt.maxTok * +b.getAttribute('data-tq')); range.value = tokUse; updSum(); }); });
      range.style.setProperty('--p', (t.maxTok ? t.tok / t.maxTok * 100 : 0) + '%');
    }
    $$('[data-promo]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-promo'), pr = u.promos.filter(function (x) { return x.code === c; })[0];
        cartPromo = cartPromo && cartPromo.code === c ? null : { code: c, pct: pr.pct, withTokens: true, personal: true, cat: pr.cat || '', catLabel: pr.catLabel || '' };
        renderCart();
      });
    });
    var pin = $('#promo-in', v), pbtn = $('#promo-btn', v);
    if (pin) {
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pbtn.click(); } });
      pbtn.addEventListener('click', function () {
        if (cartPromo && !cartPromo.personal) { cartPromo = null; renderCart(); return; }
        var code = pin.value.trim().toUpperCase();
        var msg = $('#promo-msg', v);
        if (!code) { msg.innerHTML = '<span class="promo-bad">Введите промокод</span>'; pin.focus(); return; }
        busy(pbtn, true, 'Проверяем');
        API.call('checkPromo', { promo: code, phone: form.phone, useTokens: totals(lines).tok }).then(function (r) {
          busy(pbtn, false);
          if (!r.ok) { msg.innerHTML = '<span class="promo-bad">' + esc(r.error) + '</span>'; return; }
          cartPromo = { code: r.promo.code, pct: r.promo.pct, withTokens: r.promo.withTokens !== false, personal: !!r.promo.personal, cat: r.promo.cat || '', catLabel: r.promo.catLabel || '' };
          if (!cartPromo.withTokens) tokUse = 0;
          renderCart();
          toast('Промокод ' + cartPromo.code + ' применён: −' + pctTxt(cartPromo.pct) + '%' + (cartPromo.cat ? ' на «' + cartPromo.catLabel + '»' : ''));
        });
      });
    }

    var up = $('#use-pack', v); if (up) up.addEventListener('change', function () { usePack = up.checked; saveDraft(); });
    // анкета
    function bind(id, key) { var el = $('#' + id, v); if (!el) return; el.addEventListener('input', function () { form[key] = el.value; saveForm(); clearF(key); }); }
    bind('f-name', 'name'); bind('f-phone', 'phone'); bind('f-tg', 'tg'); bind('f-recv-city', 'recvCity'); bind('f-recv-addr', 'recvAddr'); bind('f-city', 'city'); bind('f-comment', 'comment');
    var ph = $('#f-phone', v); ph.addEventListener('blur', function () { var f = CORE.fmtPhone(ph.value); if (f && CORE.digits(f).length === 11) { ph.value = f; form.phone = f; saveForm(); } });
    var tg = $('#f-tg', v); tg.addEventListener('blur', function () { var c = CORE.cleanTg(tg.value); tg.value = c; form.tg = c; saveForm(); });
    $$('input[type="radio"]', v).forEach(function (r) {
      r.addEventListener('change', function () {
        form[r.name] = r.value; saveForm(); clearF(r.name);
        if (r.name === 'recv') { var c = $('[data-f="recvCity"]', v), a = $('[data-f="recvAddr"]', v); if (c) c.hidden = r.value !== 'city'; if (a) a.hidden = r.value !== 'courier'; }
      });
    });
    function setAck(val) {
      ack = val; saveDraft();
      $$('[data-ack]', v).forEach(function (b) { if (b.getAttribute('data-ack') !== 'cancel') b.setAttribute('aria-pressed', String(b.getAttribute('data-ack') === ack)); });
      var box = $('#ack-box', v); box.classList.toggle('on', ack === 'yes'); box.setAttribute('aria-label', ack === 'yes' ? 'Подтверждено' : 'Не подтверждено');
      $('#ack-hint', v).hidden = ack !== 'no';
      if (ack === 'yes') clearF('ack');
    }
    if (t.pre) {
      $$('[data-ack]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-ack');
          if (a !== 'cancel') { setAck(a); return; }
          confirmBox({
            title: 'Отказаться от оформления?', text: 'Можно убрать из корзины товары по предзаказу или вернуться к покупкам — корзина сохранится.',
            actions: [t.stock ? { label: 'Убрать предзаказ', cls: 'btn-ghost', run: function () { cart = cart.filter(function (l) { return !BY_ID[l.id] || BY_ID[l.id].status !== 'preorder'; }); ack = null; saveCart(); renderCart(); toast('Товары по предзаказу убраны из корзины'); } }
              : { label: 'Очистить корзину', cls: 'btn-ghost', run: function () { cart = []; ack = null; saveCart(); renderCart(); } },
            { label: 'Вернуться в каталог', cls: 'btn-danger', run: function () { ack = null; go('catalog'); } }]
          });
        });
      });
    }

    var na = $('#need-acc', v); if (na) na.addEventListener('click', function () { requireAuth('cart'); });
    $('#checkout', v).addEventListener('submit', function (e) {
      e.preventDefault();
      if (API.enabled && !acct.user) { requireAuth('cart'); return; }
      var tt = totals(lines);
      var errs = validateForm(tt.stock, tt.pre);
      if (errs.length) {
        errs.forEach(function (x) { setF(x[0], x[1]); });
        var first = $('[data-f="' + errs[0][0] + '"]', v);
        if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); var inp = $('input,textarea,button', first); if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 350); }
        toast(errs.length === 1 ? errs[0][1] : 'Заполните отмеченные поля: ' + errs.length, null, 'warn');
        return;
      }
      submitOrder(lines, tt, $('#submit-btn', v));
    });
  }
  function setF(key, msg) { var f = $('[data-f="' + key + '"]'); if (!f) return; f.classList.add('err'); var m = $('.err-msg', f); if (m) { m.textContent = msg; m.hidden = false; } }
  function clearF(key) { var f = $('[data-f="' + key + '"]'); if (!f) return; f.classList.remove('err'); var m = $('.err-msg', f); if (m) m.hidden = true; }
  function validateForm(hasStock, hasPre) {
    var e = [];
    if (form.name.trim().length < 2) e.push(['name', 'Укажите имя']);
    var d = CORE.digits(form.phone); if (d.length < 10 || d.length > 15) e.push(['phone', 'Укажите телефон, например +7 900 000-00-00']);
    var t = CORE.cleanTg(form.tg); if (t && !/^[A-Za-z0-9_]{4,32}$/.test(t)) e.push(['tg', 'Username — латиница, цифры и «_», от 4 символов. Нет username — оставьте пустым']);
    if (hasStock) { if (!form.recv) e.push(['recv', 'Выберите способ получения']); else if (form.recv === 'city' && form.recvCity.trim().length < 2) e.push(['recvCity', 'Укажите город (можно Москва)']); }
    if (hasPre) {
      if (!form.ship) e.push(['ship', 'Выберите способ отправки из Китая']);
      if (form.city.trim().length < 2) e.push(['city', 'Укажите город']);
      if (!form.preRecv) e.push(['preRecv', 'Выберите способ получения']);
      if (ack !== 'yes') e.push(['ack', ack === 'no' ? 'Прочитайте условия предзаказа и подтвердите' : 'Подтвердите, что прочитали условия предзаказа']);
    }
    return e;
  }
  function itemsPayload(lines) {
    return lines.map(function (l) { var p = BY_ID[l.id]; return { id: l.id, size: l.size, color: l.color, photo: l.photo, qty: l.qty, note: l.note, title: p.title, price: p.price, status: p.status, link: p.link }; });
  }
  function offlineOrder(lines, tt) {
    var db = { product: function (id) { return BY_ID[id] || null; }, catalogReady: function () { return true; } };
    var built = CORE.buildLines(db, itemsPayload(lines));
    var no; do { no = CORE.offlineNo(Date.now(), Math.random); } while (localOrders.some(function (o) { return o.no === no; })); // eslint-disable-line no-loop-func
    var at = Date.now(), f = Object.assign({}, form, { ack: ack === 'yes' });
    var text = CORE.orderText({ no: no, at: at, f: f, lines: built.lines, total: tt.total, tokens: 0, tokenRub: 0, promo: '', promoRub: 0, toPay: tt.total, user: null });
    return { no: no, at: at, text: text, items: built.lines.map(function (l) { return { id: l.id, title: l.title, qty: l.qty, price: l.price, size: l.size, color: l.color, photo: l.photo, thumb: l.thumb }; }), count: tt.cnt, total: tt.total, tokens: 0, tokenRub: 0, promo: '', promoRub: 0, toPay: tt.total };
  }
  function submitOrder(lines, tt, btn) {
    var finish = function (order, opt) {
      order.offline = !!opt.offline;
      if (order.status && !order.stages) { order.stages = CORE.stagesFor(order.kind); order.active = true; }
      localOrders = [order].concat(localOrders.filter(function (o) { return o.no !== order.no; })).slice(0, 50);
      store.set('orders', localOrders);
      cart = []; ack = null; tokUse = 0; cartPromo = null; usePack = true; saveCart();
      form.comment = ''; saveForm();
      renderCart();
      showReceipt(order, { fresh: true });
      confetti(120);
    };
    if (!API.enabled) { finish(offlineOrder(lines, tt), { offline: true }); return; }
    busy(btn, true, 'Отправляем…');
    API.call('order', { items: itemsPayload(lines), form: Object.assign({}, form, { ack: ack === 'yes' }), useTokens: tt.tok, promo: tt.promo, usePack: usePack }).then(function (r) {
      if (r.ok) { if (r.user) setUser(r.user); finish(r.order, {}); return; }
      busy(btn, false);
      if (r.needAccount) { toast(r.error, null, 'warn'); API.setSession(''); setUser(null); requireAuth('cart'); return; }
      if (r.network) { confirmBox({ title: 'Сервер не отвечает', text: 'Проверьте интернет и нажмите «Оформить» ещё раз. Корзина сохранена. Если не получается — напишите менеджеру.', actions: [{ label: 'Хорошо', cls: 'btn' }, { label: 'Написать менеджеру', cls: 'btn-ghost', run: function () { window.open(SHOP.managerUrl, '_blank', 'noopener'); } }] }); return; }
      toast(r.error || 'Не получилось оформить заказ', null, 'warn');
      if (/промокод/i.test(r.error || '')) { cartPromo = null; renderCart(); }
    });
  }

  // ------------------------------------------------------------ чек и статусы
  function barcode(no) {
    var bars = [], x = 0, s = String(no);
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var b = 0; b < 6; b++) { var w = ((c >> b) & 1) ? 3 : 1.4; if (b % 2 === 0) bars.push('<rect x="' + x.toFixed(1) + '" y="0" width="' + w + '" height="36"/>'); x += w + 1.6; } }
    return '<svg viewBox="0 0 ' + Math.ceil(x) + ' 36" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">' + bars.join('') + '</svg>';
  }
  function stPill(o) {
    if (!o.status) return '';
    var cls = o.status === 'Получен' ? 'st-final' : o.status === 'Отменён' ? 'st-off' : o.status === 'Оформлен' ? 'st-new' : '';
    return '<span class="st-pill ' + cls + '">' + esc(o.status) + '</span>';
  }
  function timeline(o) {
    var stages = o.stages || [], at = stages.indexOf(o.status);
    if (!stages.length) return '';
    if (o.status === 'Отменён') return '<div class="notice notice-warn">' + icon('alert') + '<div>Заказ отменён. Вопросы — менеджеру <a href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">@' + SHOP.manager + '</a>.</div></div>';
    var notes = RULES.stageNotes || {};
    return '<ol class="timeline">' + stages.map(function (s, i) {
      var cls = i < at || (i === at && i === stages.length - 1) ? 'done' : i === at ? 'now' : '';
      return '<li class="' + cls + '"><span class="dotc"><span class="dot">' + icon('check') + '</span>' + (i < stages.length - 1 ? '<span class="lnk"></span>' : '') + '</span><span class="tx"><b>' + esc(s) + '</b>' + (notes[s] ? '<small>' + esc(notes[s]) + '</small>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }
  function receiptHtml(o) {
    var thumbs = (o.items || []).map(function (it) { var id = it.photo || it.thumb; return id ? '<img src="' + thumb(id) + '" alt="" loading="lazy">' : ''; }).join('');
    var status = o.offline ? '<div class="rc-status todo">' + icon('send') + '<span>Сервер недоступен: напишите менеджеру номер заказа.</span></div>'
      : '<div class="rc-status ok">' + icon('check-circle') + '<span>Заказ у менеджера. Он свяжется с вами в Telegram или по телефону.</span></div>';
    return '<div class="receipt"><div class="rc-top"><div class="rc-brand"><img src="assets/logo.png" alt="">ONION SHOP<span>' + icon('check') + 'оформлен</span></div>' +
      '<span class="rc-label">Номер заказа</span><div class="rc-no"><b>' + esc(o.no) + '</b><button type="button" data-copy="' + esc(o.no) + '">' + icon('copy') + 'Номер</button></div><span class="rc-date">' + esc(fmtAt(o.at)) + '</span></div>' +
      '<div class="rc-perf"><i></i><i></i></div>' + (thumbs ? '<div class="rc-thumbs">' + thumbs + '</div>' : '') +
      '<div class="rc-body"><div class="rc-row"><span>Товары · ' + (o.count || 0) + ' шт.</span><b>' + rub(o.total || 0) + '</b></div>' +
      (o.tokens ? '<div class="rc-row"><span>Токены · ' + num(o.tokens) + '</span><b>−' + rub(o.tokenRub) + '</b></div>' : '') +
      (o.promoRub ? '<div class="rc-row"><span>Промокод ' + esc(o.promo) + '</span><b>−' + rub(o.promoRub) + '</b></div>' : '') +
      '<div class="rc-row total"><span>К оплате</span><b>' + rub(o.toPay != null ? o.toPay : o.total) + '</b></div></div>' + status +
      '<div class="rc-bars">' + barcode(o.no) + '</div></div>';
  }
  function showReceipt(o, opt) {
    opt = opt || {};
    $('#toasts').innerHTML = '';
    var md = openModal(modalHead(opt.fresh ? 'Заказ оформлен' : 'Заказ ' + o.no) + receiptHtml(o) +
      (o.stages && o.stages.length ? '<div class="card tile"><div class="tile-h"><h3>Статус</h3>' + stPill(o) + '</div>' + timeline(o) + '</div>' : '') +
      '<div class="send-row">' + (o.offline ? '<a class="btn" href="https://t.me/share/url?url=' + encodeURIComponent(location.href.split('#')[0]) + '&text=' + encodeURIComponent(o.text || ('Заказ ' + o.no)) + '" target="_blank" rel="noopener">' + icon('send') + 'Отправить менеджеру</a>' : '<a class="btn" href="#orders" data-close>' + icon('receipt') + 'Мои заказы</a>') +
      '<a class="btn btn-ghost" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">' + icon('chat') + 'Написать менеджеру</a></div>', { cls: 'receipt-modal' });
    $$('a[data-close]', md).forEach(function (a) { a.addEventListener('click', function () { setTimeout(function () { go('orders'); }, 0); }); });
  }

  // ------------------------------------------------------------ мои заказы
  function allOrders() {
    var list = [];
    if (acct.user) list = acct.user.orders.slice();
    localOrders.forEach(function (o) { if (!list.some(function (x) { return x.no === o.no; })) list.push(o); });
    return list;
  }
  function orderCard(o, i) {
    return '<article class="card order" data-o="' + i + '"><div class="order-top"><div><span class="order-no">№ ' + esc(o.no) + '</span><p class="date">' + esc(fmtAt(o.at)) + ' · ' + (o.count || 0) + ' шт.</p></div><div style="display:grid;justify-items:end;gap:6px"><span class="sum">' + rub(o.toPay != null ? o.toPay : o.total) + '</span>' + stPill(o) + '</div></div>' +
      '<div class="order-items">' + (o.items || []).map(function (it) { var id = it.photo || it.thumb; return '<a class="oi" href="#p-' + esc(it.id) + '" title="' + esc(it.title) + '">' + (id ? '<img src="' + thumb(id) + '" alt="' + esc(it.title) + '" loading="lazy">' : '') + (it.qty > 1 ? '<i>×' + it.qty + '</i>' : '') + '</a>'; }).join('') + '</div>' +
      '<div class="acts"><button class="btn btn-sm" type="button" data-open>' + icon('receipt') + (o.stages ? 'Статус и чек' : 'Чек') + '</button><button class="btn btn-ghost btn-sm" type="button" data-repeat>' + icon('refresh') + 'Повторить</button>' + reviewBtn(o) + '</div></article>';
  }
  function bindOrders(root, list) {
    $$('.order', root).forEach(function (el) {
      var o = list[+el.getAttribute('data-o')];
      $('[data-open]', el).addEventListener('click', function () { showReceipt(o); });
      var rv = $('[data-review]', el); if (rv) rv.addEventListener('click', function () { reviewModal(o); });
      $('[data-repeat]', el).addEventListener('click', function () {
        var added = 0, missing = 0;
        (o.items || []).forEach(function (it) { if (BY_ID[it.id]) { addToCart({ id: it.id, size: it.size || null, color: it.color || null, photo: it.photo || null, qty: it.qty, note: '' }); added++; } else missing++; });
        if (added) { toast(missing ? 'Добавлено. Уже проданы: ' + missing : 'Товары снова в корзине'); go('cart'); } else toast('Этих товаров уже нет в продаже', null, 'warn');
      });
    });
  }
  function renderOrders() {
    var v = $('#v-orders'), list = allOrders();
    var head = '<div class="view-head"><div><span class="eyebrow">История</span><h1>Мои заказы</h1><p class="muted">' + (acct.user ? 'Статус меняет менеджер — обновляется сам.' : 'Хранятся в этом браузере.' + (API.enabled ? ' Войдите, чтобы видеть статусы на любом устройстве.' : '')) + '</p></div>' + (API.enabled && !acct.user ? '<a class="btn btn-ghost" href="#account">' + icon('user') + 'Войти</a>' : '') + '</div>';
    if (!list.length) { v.innerHTML = head + '<div class="empty"><span class="ico">' + icon('receipt') + '</span><h3>Заказов пока нет</h3><p>Здесь будут номера заказов, статусы и суммы.</p><a class="btn" href="#catalog">' + icon('grid') + 'Перейти в каталог</a></div>'; return; }
    var act = [], hist = [];
    list.forEach(function (o, i) { (isDoneOrder(o) ? hist : act).push(orderCard(o, i)); });
    v.innerHTML = head +
      (act.length ? '<h2 class="sec-h">Активные · ' + act.length + '</h2><div class="orders">' + act.join('') + '</div>' : '<div class="notice notice-info" style="margin-bottom:12px">' + icon('check-circle') + '<div>Активных заказов нет. Завершённые лежат в «Истории заказов» ниже — любой можно повторить в один клик.</div></div>') +
      (hist.length ? '<details class="hist"' + (act.length ? '' : ' open') + '><summary>' + icon('receipt') + '<span>История заказов</span><b>' + hist.length + '</b>' + icon('chevron-down') + '</summary><div class="orders">' + hist.join('') + '</div></details>' : '');
    bindOrders(v, list);
  }
  function isDoneOrder(o) { return RULES.finalStages.indexOf(o.status) >= 0; }

  // ------------------------------------------------------------ избранное
  function renderFavorites() {
    var v = $('#v-favorites'), list = favs.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    v.innerHTML = '<div class="view-head"><div><span class="eyebrow">Избранное</span><h1>Отложенные вещи</h1><p class="muted">Нажимайте ♡ на товарах, чтобы вернуться к ним позже.</p></div></div>' +
      (list.length ? grid(list) : '<div class="empty"><span class="ico">' + icon('heart') + '</span><h3>Пока пусто</h3><p>Отмечайте понравившиеся вещи сердечком' + (API.enabled ? ' — это одно из заданий дня' : '') + '.</p><a class="btn" href="#catalog">' + icon('grid') + 'Перейти в каталог</a></div>');
  }

  // ------------------------------------------------------------ коды на почту
  var resendAt = 0;
  function codeHint(r) { return r.demoCode ? '<div class="demo-code">Демо: письма не отправляются, ваш код <b>' + esc(r.demoCode) + '</b></div>' : ''; }
  function sendCode(purpose, email, btn, out) {
    if (Date.now() < resendAt) { toast('Повторно можно через ' + Math.ceil((resendAt - Date.now()) / 1000) + ' с', null, 'warn'); return Promise.resolve(null); }
    busy(btn, true, 'Отправляем');
    return API.call('sendCode', { purpose: purpose, email: email }).then(function (r) {
      busy(btn, false);
      if (!r.ok) { if (out) { out.innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; } else toast(r.error, null, 'warn'); return null; }
      resendAt = Date.now() + 60000;
      if (out) out.innerHTML = '<div class="form-ok">Код отправлен на ' + esc(r.email) + '. Проверьте папку «Спам», если письма нет.</div>' + codeHint(r);
      return r;
    });
  }

  // ------------------------------------------------------------ кабинет
  var authTab = 'register', regSent = false;
  function renderAccount() {
    var v = $('#v-account');
    if (!API.enabled) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('user') + '</span><h3>Личный кабинет скоро появится</h3><p>Пока заказы хранятся в браузере.</p><a class="btn" href="#orders">Мои заказы</a></div>'; return; }
    if (!acct.ready) { v.innerHTML = '<div class="empty"><span class="ico"><span class="spinner"></span></span><h3>Загружаем кабинет…</h3></div>'; return; }
    if (!acct.user) return renderAuth(v);
    renderDash(v);
  }
  function authSide() {
    var R = RULES.reward;
    return '<div class="auth-side"><h2>Что даёт аккаунт</h2><ul>' +
      '<li>' + tk('lg') + '<span><b>+' + R.register + ' токенов</b> сразу за регистрацию</span></li>' +
      '<li>' + tk('lg') + '<span>Токенами можно оплатить <b>до 15%</b> заказа · 1 токен = 0,4 ₽</span></li>' +
      '<li>' + tk('lg') + '<span><b>Задания дня</b> по 1 токену и до ' + RULES.levels[4].streak + ' за 7 дней подряд</span></li>' +
      '<li>' + tk('lg') + '<span><b>Программа лояльности</b>: Бронза → Серебро → Золото → Платина → Алмаз</span></li>' +
      '<li>' + tk('lg') + '<span><b>Рулетка</b>: токены, промокоды, рамки для аватара</span></li>' +
      '<li>' + tk('lg') + '<span><b>Статусы заказов</b> — от выкупа в Китае до получения</span></li>' +
      '<li>' + tk('lg') + '<span><b>+' + R.referrer + ' токенов</b> за друга по вашей ссылке</span></li>' +
      '</ul><p class="small" style="color:var(--navy-ink-2)">Пароль хранится в зашифрованном виде. Почта нужна, чтобы восстановить пароль.</p></div>';
  }
  function renderAuth(v) {
    var ref = store.get('ref', ''), R = RULES.reward, val = function (id) { var el = $('#' + id, v); return el ? el.value.trim() : ''; };
    var refBanner = ref ? '<div class="form-ok">' + icon('gift') + ' Вас пригласил друг: при регистрации +' + R.refFriend + ' токенов сверху.</div>' : '';
    var body;
    if (authTab === 'register') {
      body = '<form id="auth-form" novalidate style="display:grid;gap:14px">' + refBanner +
        '<div class="fgrid"><div class="f"><label for="a-name">Имя</label><input class="input" id="a-name" autocomplete="name" placeholder="Как к вам обращаться" value="' + esc(form.name) + '"></div>' +
        '<div class="f"><label for="a-login">Логин</label><input class="input" id="a-login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="латиница, от 3 символов"></div>' +
        '<div class="f full"><label for="a-email">Почта</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@mail.ru"><span class="hint">Пришлём код подтверждения. Через почту можно восстановить пароль.</span></div>' +
        '<div class="f"><label for="a-phone">Телефон</label><input class="input" id="a-phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"></div>' +
        '<div class="f"><label for="a-tg">Telegram <span class="opt-l">· желательно</span></label><div class="prefix"><span>@</span><input class="input" id="a-tg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="username" value="' + esc(form.tg) + '"></div></div>' +
        '<div class="f full"><label for="a-pass">Пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="new-password" placeholder="не короче 6 символов"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
        '<div class="f full"><label for="a-ref">Код друга <span class="opt-l">· по желанию, +' + R.refFriend + ' токенов</span></label><input class="input" id="a-ref" autocapitalize="characters" spellcheck="false" placeholder="Например, K7Q2MX" value="' + esc(ref) + '"></div>' +
        '<div class="f full" id="code-box"' + (regSent ? '' : ' hidden') + '><label for="a-code">Код из письма</label><input class="input code" id="a-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"><button class="link-btn" type="button" id="resend" style="justify-self:start">Отправить код ещё раз</button></div></div>' +
        '<div id="code-msg"></div><div class="form-err" id="auth-err" hidden></div>' +
        '<button class="btn btn-block" type="submit" id="auth-btn">' + (regSent ? icon('gift') + 'Подтвердить и получить ' + R.register + ' токенов' : icon('mail') + 'Получить код на почту') + '</button></form>';
    } else if (authTab === 'login') {
      body = '<form id="auth-form" novalidate style="display:grid;gap:14px">' +
        '<div class="f"><label for="a-login">Логин или почта</label><input class="input" id="a-login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="логин или name@mail.ru"></div>' +
        '<div class="f"><label for="a-pass">Пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="current-password" placeholder="пароль"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
        '<button class="link-btn" type="button" id="to-reset" style="justify-self:start">Забыли пароль?</button>' +
        '<div class="form-err" id="auth-err" hidden></div><button class="btn btn-block" type="submit" id="auth-btn">' + icon('key') + 'Войти</button></form>';
    } else {
      body = '<form id="auth-form" novalidate style="display:grid;gap:14px"><p class="muted">Пришлём код на почту, указанную при регистрации, и вы зададите новый пароль.</p>' +
        '<div class="f"><label for="a-email">Почта</label><div class="promo-row"><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@mail.ru" style="text-transform:none;letter-spacing:0;font-weight:500"><button class="btn btn-dark" type="button" id="send-reset">Код</button></div></div>' +
        '<div id="code-msg"></div>' +
        '<div class="f"><label for="a-code">Код из письма</label><input class="input code" id="a-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></div>' +
        '<div class="f"><label for="a-pass">Новый пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="new-password" placeholder="не короче 6 символов"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
        '<div class="form-err" id="auth-err" hidden></div><button class="btn btn-block" type="submit" id="auth-btn">' + icon('key') + 'Сохранить и войти</button><button class="link-btn" type="button" id="to-login" style="justify-self:start">Вернуться ко входу</button></form>';
    }
    v.innerHTML = '<div class="view-head"><div><span class="eyebrow">Личный кабинет</span><h1>' + (authTab === 'login' ? 'Вход в аккаунт' : authTab === 'reset' ? 'Восстановление пароля' : 'Создайте аккаунт') + '</h1></div></div>' +
      '<div class="auth"><div class="card auth-card">' + (authTab !== 'reset' ? '<div class="auth-tabs" role="tablist"><button type="button" role="tab" data-t="register" aria-selected="' + (authTab === 'register') + '">Регистрация</button><button type="button" role="tab" data-t="login" aria-selected="' + (authTab === 'login') + '">Вход</button></div>' : '') + body + '</div>' + authSide() + '</div>';
    $$('[data-t]', v).forEach(function (b) { b.addEventListener('click', function () { authTab = b.getAttribute('data-t'); renderAuth(v); }); });
    $$('[data-eye]', v).forEach(function (b) { b.addEventListener('click', function () { var i = b.previousElementSibling; var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eye-off' : 'eye'); }); });
    var toReset = $('#to-reset', v); if (toReset) toReset.addEventListener('click', function () { authTab = 'reset'; renderAuth(v); });
    var toLogin = $('#to-login', v); if (toLogin) toLogin.addEventListener('click', function () { authTab = 'login'; renderAuth(v); });
    var err = $('#auth-err', v), btn = $('#auth-btn', v), out = $('#code-msg', v);
    function fail(m) { err.textContent = m; err.hidden = false; }
    function regPayload() { return { name: val('a-name'), login: val('a-login'), email: val('a-email'), phone: val('a-phone'), tg: val('a-tg'), password: $('#a-pass', v).value, ref: val('a-ref'), code: val('a-code') }; }
    function preCheck(p) {
      if (p.name.length < 2) return 'Укажите имя';
      if (!/^[a-z0-9_.]{3,20}$/i.test(p.login)) return 'Логин: от 3 до 20 символов — латиница, цифры, точка или «_»';
      if (!CORE.validEmail(p.email.toLowerCase())) return 'Укажите почту, например name@mail.ru';
      var d = CORE.digits(p.phone); if (d.length < 10 || d.length > 15) return 'Укажите телефон';
      if (p.password.length < 6) return 'Пароль: не короче 6 символов';
      return null;
    }
    var rs = $('#resend', v); if (rs) rs.addEventListener('click', function () { var p = regPayload(); sendCode('register', p.email, rs, out); });
    var sr = $('#send-reset', v); if (sr) sr.addEventListener('click', function () { var e = val('a-email'); if (!CORE.validEmail(e.toLowerCase())) { fail('Проверьте почту'); return; } err.hidden = true; sendCode('reset', e, sr, out).then(function (r) { if (r) $('#a-code', v).focus(); }); });
    $('#auth-form', v).addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      if (authTab === 'register') {
        var p = regPayload(), bad = preCheck(p); if (bad) { fail(bad); return; }
        form.name = p.name; form.phone = p.phone; form.tg = p.tg; saveForm();
        if (!regSent) {
          sendCode('register', p.email, btn, out).then(function (r) {
            if (!r) return;
            regSent = true; $('#code-box', v).hidden = false; btn.innerHTML = icon('gift') + 'Подтвердить и получить ' + R.register + ' токенов';
            $('#a-code', v).focus();
          });
          return;
        }
        if (!/^\d{6}$/.test(p.code)) { fail('Введите 6 цифр из письма'); return; }
        busy(btn, true);
        API.call('register', p).then(function (r) {
          busy(btn, false);
          if (!r.ok) { fail(r.error); return; }
          regSent = false; store.set('ref', ''); API.setSession(r.session);
          confetti(150); reward('Добро пожаловать! +' + r.welcome + ' ' + tokWord(r.welcome) + (API.mode === 'demo' ? ' (и демо-токены для проверки)' : ''));
          setUser(r.user); var back = returnTo; returnTo = null; if (back && back !== 'account') go(back);
        });
      } else if (authTab === 'login') {
        busy(btn, true);
        API.call('login', { login: val('a-login'), password: $('#a-pass', v).value }).then(function (r) {
          busy(btn, false);
          if (!r.ok) { fail(r.error); return; }
          API.setSession(r.session); toast('С возвращением, ' + r.user.name + '!');
          setUser(r.user); var back = returnTo; returnTo = null; if (back && back !== 'account') go(back);
        });
      } else {
        var em = val('a-email'), code = val('a-code'), pass = $('#a-pass', v).value;
        if (!CORE.validEmail(em.toLowerCase())) { fail('Проверьте почту'); return; }
        if (!/^\d{6}$/.test(code)) { fail('Введите 6 цифр из письма'); return; }
        if (pass.length < 6) { fail('Новый пароль: не короче 6 символов'); return; }
        busy(btn, true);
        API.call('resetPassword', { email: em, code: code, password: pass }).then(function (r) {
          busy(btn, false);
          if (!r.ok) { fail(r.error); return; }
          API.setSession(r.session); authTab = 'login'; toast('Пароль изменён. Вы вошли в аккаунт');
          setUser(r.user);
        });
      }
    });
  }

  // аватар: обрезаем в квадрат и сжимаем, чтобы влезло в ячейку таблицы
  function pickAvatar() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) { toast('Нужна картинка: JPG или PNG', null, 'warn'); return; }
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        var out = '', sizes = [192, 160, 128, 96], q = [0.82, 0.75, 0.68, 0.6];
        for (var i = 0; i < sizes.length; i++) {
          var c = document.createElement('canvas'), s = sizes[i]; c.width = c.height = s;
          var m = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - m) / 2, sy = (img.naturalHeight - m) / 2;
          var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s); ctx.drawImage(img, sx, sy, m, m, 0, 0, s, s);
          out = c.toDataURL('image/jpeg', q[i]); if (out.length < 40000) break;
        }
        URL.revokeObjectURL(url);
        toast('Загружаем фото…');
        API.call('profile', { avatar: out }).then(function (r) { if (r.ok) { setUser(r.user); toast('Фото профиля обновлено'); } else toast(r.error, null, 'warn'); });
      };
      img.onerror = function () { toast('Не получилось открыть фото', null, 'warn'); };
      img.src = url;
    });
    inp.click();
  }
  function emailModal() {
    var md = openModal(modalHead(acct.user.email ? 'Сменить почту' : 'Добавить почту') + '<p class="muted">Пришлём код подтверждения. Через почту можно восстановить пароль.</p>' +
      '<div class="f"><label for="m-email">Почта</label><div class="promo-row"><input class="input" id="m-email" type="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="name@mail.ru" style="text-transform:none;letter-spacing:0;font-weight:500"><button class="btn btn-dark" type="button" id="m-send">Код</button></div></div><div id="m-msg"></div>' +
      '<div class="f"><label for="m-code">Код из письма</label><input class="input code" id="m-code" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
      '<button class="btn btn-block" type="button" id="m-save">Подтвердить почту</button>', { cls: 'sm' });
    $('#m-send', md).addEventListener('click', function () { var e = $('#m-email', md).value.trim(); if (!CORE.validEmail(e.toLowerCase())) { toast('Проверьте почту', null, 'warn'); return; } sendCode('email', e, this, $('#m-msg', md)); });
    $('#m-save', md).addEventListener('click', function () {
      var b = this; busy(b, true);
      API.call('setEmail', { email: $('#m-email', md).value.trim(), code: $('#m-code', md).value.trim() }).then(function (r) { busy(b, false); if (!r.ok) { $('#m-msg', md).innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; return; } closeModal(); setUser(r.user); toast('Почта подтверждена'); });
    });
  }
  function profileModal() {
    var u = acct.user;
    var md = openModal(modalHead('Имя, телефон и Telegram') + '<form id="prof-form" class="fgrid" novalidate>' +
      '<div class="f full"><label for="p-name">Имя</label><input class="input" id="p-name" value="' + esc(u.name) + '"></div>' +
      '<div class="f"><label for="p-phone">Телефон</label><input class="input" id="p-phone" type="tel" value="' + esc(u.phone) + '"></div>' +
      '<div class="f"><label for="p-tg">Telegram <span class="opt-l">· желательно</span></label><div class="prefix"><span>@</span><input class="input" id="p-tg" value="' + esc(u.tg) + '"></div></div>' +
      '<div class="f full"><button class="btn" type="submit">Сохранить</button></div></form>', { cls: 'sm' });
    $('#prof-form', md).addEventListener('submit', function (e) {
      e.preventDefault();
      API.call('profile', { name: $('#p-name', md).value, phone: $('#p-phone', md).value, tg: $('#p-tg', md).value }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Профиль сохранён'); } else toast(r.error, null, 'warn'); });
    });
  }

  // ------------------------------------------------------------ значок на экране «Домой»
  var HOME_ICONS = [['dark', 'Тёмная'], ['white', 'Белая'], ['halloween', 'Хэллоуин']];
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  function homeIcon() { var v = store.get('homeIcon', 'dark'); return HOME_ICONS.some(function (x) { return x[0] === v; }) ? v : 'dark'; }
  function applyHomeIcon(id) {
    id = id || homeIcon();
    var base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
    function set(rel, href, extra) {
      var el = document.querySelector('link[rel="' + rel + '"]' + (extra || ''));
      if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
      el.href = href; return el;
    }
    set('apple-touch-icon', 'assets/icons/' + id + '-180.png');
    var fv = set('icon', 'assets/icons/' + id + '-48.png'); fv.type = 'image/png';
    try {
      var mf = {
        name: 'Onion Shop', short_name: 'Onion Shop', lang: 'ru', start_url: base, scope: base, display: 'standalone',
        background_color: id === 'white' ? '#ffffff' : id === 'halloween' ? '#1a0a2e' : '#050a1d', theme_color: id === 'white' ? '#ffffff' : id === 'halloween' ? '#1a0a2e' : '#050a1d',
        icons: [{ src: base + 'assets/icons/' + id + '-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'assets/icons/' + id + '-512.png', sizes: '512x512', type: 'image/png' },
          { src: base + 'assets/icons/' + id + '-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
      };
      if (/^https?:/.test(base) && window.Blob && URL.createObjectURL) {
        var el = document.querySelector('link[rel="manifest"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest' }));
        if (el.dataset.blob) { try { URL.revokeObjectURL(el.dataset.blob); } catch (e) { /* */ } }
        var u = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' }));
        el.dataset.blob = u; el.href = u;
      }
    } catch (e) { /* без манифеста значок возьмётся из apple-touch-icon */ }
  }
  function homeModal() {
    var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    var cur = homeIcon();
    var steps = ios
      ? ['Откройте сайт в <b>Safari</b> (в других браузерах на iPhone кнопки нет).', 'Нажмите <b>«Поделиться»</b> — квадрат со стрелкой внизу экрана.', 'Прокрутите список и выберите <b>«На экран «Домой»»</b>.', 'Название оставьте <b>Onion Shop</b> и нажмите <b>«Добавить»</b>.']
      : /Android/.test(ua)
        ? ['Откройте сайт в <b>Chrome</b>.', 'Нажмите <b>⋮</b> (меню) в правом верхнем углу.', 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.', 'Подтвердите — значок <b>Onion Shop</b> появится среди приложений.']
        : ['В Chrome или Edge нажмите значок установки в адресной строке (справа) или меню <b>⋮ → «Установить Onion Shop»</b>.', 'На телефоне откройте сайт и повторите те же шаги там.'];
    var md = openModal(modalHead('Значок на экране «Домой»') +
      '<p class="small" style="margin:0 0 10px">Сайт откроется как приложение — без адресной строки, одним нажатием. Сначала выберите значок, потом добавьте его на экран.</p>' +
      '<div class="home-icons" role="group" aria-label="Значок">' + HOME_ICONS.map(function (x) {
        return '<button type="button" data-hi="' + x[0] + '" aria-pressed="' + (x[0] === cur) + '"><img src="assets/icons/' + x[0] + '-192.png" width="72" height="72" alt="" loading="lazy"><span>' + x[1] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="notice notice-info" style="margin-top:12px">' + icon('info') + '<div>' + (standalone ? 'Вы открыли сайт с экрана «Домой». ' : '') + 'Телефон запоминает значок в момент добавления и сам его не меняет: чтобы на рабочем столе стал другой, <b>удалите старый значок и добавьте сайт заново</b> — он возьмёт тот, что выбран здесь.</div></div>' +
      '<ol class="home-steps">' + steps.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      (installEvt ? '<button class="btn btn-block" type="button" id="hi-install">' + icon('plus') + '<span>Установить приложение</span></button>' : '') +
      '<p class="small" style="margin:10px 0 0">Название на экране: <b>Onion Shop</b>. Значок можно поменять в любой момент.</p>', { cls: 'sm' });
    $$('[data-hi]', md).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-hi'); store.set('homeIcon', id); applyHomeIcon(id);
        $$('[data-hi]', md).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var val = $('#r-home .val'); if (val) val.textContent = (HOME_ICONS.filter(function (x) { return x[0] === id; })[0] || [])[1];
      });
    });
    var ib = $('#hi-install', md);
    if (ib) ib.addEventListener('click', function () { try { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; closeModal(); }); } catch (e) { closeModal(); } });
  }

  function passModal() {
    var md = openModal(modalHead('Сменить пароль') + '<div class="f"><label for="m-old">Текущий пароль</label><input class="input" id="m-old" type="password" autocomplete="current-password"></div>' +
      '<div class="f"><label for="m-new">Новый пароль</label><input class="input" id="m-new" type="password" autocomplete="new-password" placeholder="не короче 6 символов"></div><div id="m-msg"></div>' +
      '<button class="btn btn-block" type="button" id="m-save">Сохранить</button><button class="link-btn" type="button" id="m-forgot" style="justify-self:start">Не помню текущий пароль</button>', { cls: 'sm' });
    $('#m-save', md).addEventListener('click', function () {
      var b = this; busy(b, true);
      API.call('changePassword', { old: $('#m-old', md).value, password: $('#m-new', md).value }).then(function (r) { busy(b, false); if (!r.ok) { $('#m-msg', md).innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; return; } closeModal(); toast('Пароль изменён'); });
    });
    $('#m-forgot', md).addEventListener('click', function () { closeModal(); API.call('logout'); API.setSession(''); authTab = 'reset'; setUser(null); });
  }
  function bdayModal() {
    var md = openModal(modalHead('День рождения') + '<p class="muted">Указывается один раз. В этот день при входе начислим +' + RULES.reward.birthday + ' токенов.</p><div class="f"><label for="m-bday">Дата</label><input class="input" id="m-bday" type="date"></div><button class="btn btn-block" type="button" id="m-save">Сохранить</button>', { cls: 'sm' });
    $('#m-save', md).addEventListener('click', function () { var val = $('#m-bday', md).value; if (!val) { toast('Выберите дату', null, 'warn'); return; } API.call('profile', { birthday: val.slice(5) }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Дата сохранена'); } else toast(r.error, null, 'warn'); }); });
  }
  function framesModal() {
    var u = acct.user, li = u.level.index;
    function lockText(f) {
      if (f.src === 'level') return 'Уровень «' + RULES.levels[f.lvl].name + '» и выше';
      if (f.rare) return 'Только в рулетке';
      return 'В рулетке или на «Алмазе»';
    }
    var anims = RULES.frameAnims || [];
    var md = openModal(modalHead('Рамка аватара') + '<p class="muted">Рамки выпадают в рулетке, а «Серебро», «Золото» и «Алмаз» даёт уровень — пока он у вас есть.</p><div class="frames">' + RULES.frames.map(function (f) {
      var own = u.frames.indexOf(f.id) >= 0;
      return '<button type="button" data-frame="' + f.id + '" aria-pressed="' + (u.frame === f.id) + '"' + (own ? '' : ' disabled') + '>' + ava({ name: u.name, avatar: u.avatar, frame: f.id, frameAnim: u.frameAnim }) + '<span>' + esc(f.name) + (own ? '' : ' ' + icon('lock')) + '</span>' + (own ? '' : '<small>' + esc(lockText(f)) + '</small>') + '</button>';
    }).join('') + '</div>' +
      (li >= 4 ? '<div class="f" style="margin-top:14px"><span class="lbl">Анимация рамки «Алмаз»</span><div class="choices" id="anims">' + anims.map(function (a) { return '<button class="choice" type="button" data-anim="' + a[0] + '" aria-pressed="' + ((u.frameAnim || 'shine') === a[0]) + '">' + esc(a[1]) + '</button>'; }).join('') + '</div></div>'
        : '<p class="small" style="margin-top:12px">На уровне «Алмаз» у рамки можно выбрать анимацию.</p>'), { cls: 'sm' });
    $$('[data-frame]', md).forEach(function (b) { b.addEventListener('click', function () { API.call('profile', { frame: b.getAttribute('data-frame') }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Рамка надета'); } else toast(r.error, null, 'warn'); }); }); });
    $$('[data-anim]', md).forEach(function (b) { b.addEventListener('click', function () { API.call('profile', { frameAnim: b.getAttribute('data-anim'), frame: 'lvl-diamond' }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Анимация выбрана'); } else toast(r.error, null, 'warn'); }); }); });
  }
  // все уровни программы лояльности
  function levelsModal() {
    var u = acct.user, cur = u ? u.level.index : -1;
    openModal(modalHead('Программа лояльности') +
      '<p class="muted">Уровень растёт от XP — опыта за месяц. 1-го числа XP обнуляется, и уровень начинается заново с Бронзы.</p>' +
      '<div class="xp-how"><b>Как получить XP</b><ul>' +
      '<li>' + icon('bag') + '<span>Полученный заказ — <b>1 XP за каждые 10&nbsp;₽</b>. Засчитывается, когда у заказа статус «Получен»</span></li>' +
      '<li>' + icon('gift') + '<span>Ежедневный вход — <b>+' + RULES.xpReward.checkin + ' XP</b></span></li>' +
      '<li>' + icon('check') + '<span>Задания — ежедневные <b>+2–3 XP</b>, еженедельные <b>+12–40 XP</b>, ежемесячные <b>+40–300 XP</b></span></li>' +
      '<li>' + icon('sparkles') + '<span>Рулетка — приз <b>+50 XP</b></span></li></ul></div>' +
      '<div class="lvl-list">' + RULES.levels.map(function (l, i) {
        return '<section class="lvl-card lv-' + l.key + (i === cur ? ' cur' : '') + '"><header>' + lvlImg(l.key, 56) + '<div><h3>' + esc(l.name) + (i === cur ? ' <span class="chip">ваш уровень</span>' : '') + '</h3><span class="small">' + (l.min ? 'от ' + num(l.min) + ' XP за месяц' : 'сразу после регистрации') + '</span></div></header>' +
          '<ul class="perks">' + perkItems(l.perks) + '</ul></section>';
      }).join('') + '</div>');
  }
  function deleteModal() {
    var u = acct.user;
    if (!u.canDelete) {
      var act = u.orders.filter(function (o) { return o.active; }).length;
      confirmBox({ title: 'Пока нельзя удалить', text: 'Аккаунт можно удалить, когда нет активных заказов. Сейчас активных: ' + act + '. Дождитесь получения или напишите менеджеру.', actions: [{ label: 'Понятно', cls: 'btn' }] });
      return;
    }
    var md = openModal(modalHead('Удалить аккаунт?') + '<p class="muted">Удалятся профиль, токены (' + num(u.balance) + '), промокоды и уровень. Восстановить будет нельзя.</p>' +
      '<div class="f"><label for="m-pass">Пароль для подтверждения</label><input class="input" id="m-pass" type="password" autocomplete="current-password"></div><div id="m-msg"></div>' +
      '<div class="send-row"><button class="btn btn-ghost" type="button" data-close>Оставить</button><button class="btn btn-danger" type="button" id="m-del">Удалить навсегда</button></div>', { cls: 'sm' });
    $('#m-del', md).addEventListener('click', function () {
      var b = this; busy(b, true);
      API.call('deleteAccount', { password: $('#m-pass', md).value }).then(function (r) { busy(b, false); if (!r.ok) { $('#m-msg', md).innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; return; } closeModal(); API.setSession(''); setUser(null); toast('Аккаунт удалён'); });
    });
  }
  var taskTab = 'd';
  function taskRow(t) {
    var def = RULES.tasks.filter(function (x) { return x.key === t.k; })[0]; if (!def) return '';
    var money = def.m === 'ordSum' || def.m === 'recvSum', multi = def.n > 1 && !t.d;
    var prog = money ? rub(t.p) + ' из ' + rub(def.n) : t.p + ' из ' + def.n;
    return '<div class="task' + (t.d ? ' done' : '') + '"><span class="ck">' + icon('check') + '</span><span class="tt"><b>' + esc(def.title) + '</b><small>' + (t.d ? 'Выполнено · награда начислена' : esc(def.hint)) + '</small>' +
      (multi ? '<span class="tbar"><i style="width:' + Math.round(t.p / def.n * 100) + '%"></i></span><small class="tcnt">' + prog + '</small>' : '') + '</span>' +
      '<span class="rw"><b>+' + def.tk + tk() + '</b><small>+' + def.xp + ' XP</small></span></div>';
  }
  function drawTasks(root) {
    var u = acct.user, tabs = $('#task-tabs', root), list = $('#task-list', root); if (!u || !tabs || !list) return;
    var board = u.board || { d: [], w: [], m: [] }, per = taskTab;
    tabs.innerHTML = ['d', 'w', 'm'].map(function (k) {
      var n = board[k].filter(function (t) { return t.d; }).length;
      return '<button type="button" role="tab" data-tt="' + k + '" aria-selected="' + (k === per) + '">' + esc(RULES.taskPer[k].name) + '<small>' + n + '/' + board[k].length + '</small></button>';
    }).join('');
    list.innerHTML = board[per].map(taskRow).join('');
    var all = board[per], done = all.filter(function (t) { return t.d; }).length;
    $('#task-side', root).textContent = done + ' из ' + all.length + ' · ' + RULES.taskPer[per].until;
    $('#task-note', root).textContent = per === 'd' ? 'Простые задания: токены и XP. Обновляются в 00:00 по Москве; чем выше уровень, тем их больше.'
      : per === 'w' ? 'Еженедельные сложнее и награда больше. «Оформить заказ» считается сразу при оформлении. Обновляются в понедельник.'
        : 'Ежемесячные — самые сложные и самые щедрые. Заказы засчитываются, когда статус «Получен». Обновляются 1-го числа.';
    $$('[data-tt]', tabs).forEach(function (b) { b.addEventListener('click', function () { taskTab = b.getAttribute('data-tt'); drawTasks(root); }); });
  }
  function renderDash(v) {
    var u = acct.user, L = u.level, R = RULES.reward;
    var pctL = L.next ? Math.min(100, Math.round((u.xp - L.min) / (L.next.min - L.min) * 100)) : 100;
    var inWeek = u.streak ? ((u.streak - 1) % 7) + 1 : 0, streakDays = [];
    for (var i = 1; i <= 7; i++) streakDays.push('<span class="' + (i <= inWeek ? 'on' : '') + (i === 7 ? ' gift' : '') + '" style="animation-delay:' + i * 50 + 'ms">' + (i === 7 ? '+' + L.streak : i) + '</span>');
    var refLink = location.href.split('#')[0].split('?')[0] + '#ref=' + u.refCode;
    var since = typeof u.createdAt === 'number' ? fmtAt(u.createdAt).split(',')[0] : String(u.createdAt || '').split(' ')[0];
    var active = u.orders.filter(function (o) { return o.active; });
    var dashOrders = active.length ? active.slice(0, 3) : u.orders.slice(0, 1);
    var bd = u.birthday ? u.birthday.split('-') : null;
    v.innerHTML =
      (u.email ? '' : '<div class="notice notice-warn" style="margin-bottom:12px">' + icon('mail') + '<div><b>Добавьте почту.</b> Без неё не получится восстановить пароль. <button class="link-btn" type="button" id="add-email">Добавить</button></div></div>') +
      '<div class="dash">' +
      '<div class="profile c12"><div class="who"><div class="ava-wrap">' + ava(u, 'lg') + '<button class="ava-cam" type="button" id="ava-cam" aria-label="Изменить фото профиля">' + icon('camera') + '</button></div>' +
      '<div style="min-width:0"><span class="lvl-pill">' + lvlImg(L.key, 22) + esc(L.name) + '</span><h1 style="margin-top:8px">' + esc(u.name) + '</h1>' +
      '<div class="meta"><span>@' + esc(u.login) + '</span>' + (u.email ? '<span>' + esc(u.email) + '</span>' : '') + '<button class="idb" type="button" data-copy="' + esc(u.code) + '">ID ' + esc(u.code) + icon('copy') + '</button><span>с нами с ' + esc(since) + '</span></div></div></div>' +
      '<div class="ptiles"><div class="ptile"><small>Токены</small><b>' + tk() + num(u.balance) + '</b></div><div class="ptile"><small>Это скидка до</small><b>' + rub(u.balanceRub) + '</b></div><div class="ptile"><small>Серия входов</small><b>' + u.streak + ' ' + plural(u.streak, 'день', 'дня', 'дней') + '</b></div><div class="ptile"><small>Активные заказы</small><b>' + active.length + '</b></div></div>' +
      '<div class="acts"><a class="btn btn-light" href="#roulette">' + icon('sparkles') + 'Рулетка' + (u.freeSpins ? ' · ' + u.freeSpins + ' ' + plural(u.freeSpins, 'бесплатный', 'бесплатных', 'бесплатных') : '') + '</a><a class="btn btn-glass" href="#cart">' + icon('bag') + 'Потратить токены</a></div></div>' +

      '<div class="card tile c6 loyal lv-' + L.key + '"><div class="tile-h"><h3>Программа лояльности</h3><button class="link-btn" type="button" id="all-levels">Все уровни</button></div>' +
      '<div class="loyal-top">' + lvlImg(L.key, 72) + '<div><span class="small">Ваш уровень' + (L.fixed ? ' · закреплён менеджером' : '') + '</span><b class="loyal-name">' + esc(L.name) + '</b><span class="xp-num">' + num(u.xp) + ' XP <span class="small">за месяц</span></span></div></div>' +
      (L.next ? '<div class="xp-bar"><div class="bar"><i data-w="' + pctL + '%"></i></div><div class="xp-meta"><span>' + num(u.xp) + ' / ' + num(L.next.min) + ' XP</span><span>до ' + lvlImg(L.next.key, 18) + '«' + esc(L.next.name) + '» ещё <b>' + num(L.next.left) + ' XP</b></span></div></div>' : '') +
      '<div class="lvl-steps">' + RULES.levels.map(function (l, j) { return '<span class="' + (j <= L.index ? 'on' : '') + (j === L.index ? ' cur' : '') + '">' + lvlImg(l.key, 30) + esc(l.name) + '</span>'; }).join('') + '</div>' +
      '<p class="info-line">' + (L.next ? 'XP дают полученные заказы, ежедневный вход, задания и рулетка. ' : L.fixed ? '' : 'Максимальный уровень! ') + '1-го числа XP обнуляется и уровень начинается заново.</p>' +
      '<h4 class="perks-h">Ваши привилегии</h4><ul class="perks">' + perkItems(lvlByKey(L.key).perks) + '</ul></div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Задания</h3><span class="side" id="task-side"></span></div>' +
      '<div class="streak">' + streakDays.join('') + '</div>' +
      (u.checkedToday ? '<p class="small">Сегодня отмечено. 7 дней подряд — +' + L.streak + ' токенов (уровень «' + esc(L.name) + '»).</p>' : '<button class="btn btn-sm" type="button" id="checkin-btn">' + icon('gift') + 'Отметиться · +' + R.checkin + ' и +' + RULES.xpReward.checkin + ' XP</button>') +
      '<div class="ttabs" role="tablist" aria-label="Период заданий" id="task-tabs"></div><div class="tasks" id="task-list"></div><p class="small" id="task-note"></p></div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Пригласить друга</h3><span class="side">' + u.refCount + ' ' + plural(u.refCount, 'друг', 'друга', 'друзей') + '</span></div>' +
      '<div class="ref-stats"><div><small>Друзей пришло</small><b>' + u.refCount + '</b></div><div><small>Заработано</small><b>' + tk() + num(u.refCount * R.referrer) + '</b></div><div><small>За каждого друга</small><b>+' + R.referrer + '</b></div></div>' +
      '<p class="small">Друг получит +' + R.refFriend + ' токенов при регистрации по ссылке, вы — +' + R.referrer + ' после его первого заказа от ' + rub(RULES.refMinOrder) + '.</p>' +
      '<div class="ref-row"><span class="lnk">' + esc(refLink.replace(/^https?:\/\//, '')) + '</span><button class="icon-btn" type="button" data-copy="' + esc(refLink) + '" aria-label="Скопировать ссылку">' + icon('copy') + '</button><button class="icon-btn acc" type="button" id="ref-share" aria-label="Поделиться">' + icon('share') + '</button></div>' +
      '<p class="small">Ваш код: <b>' + esc(u.refCode) + '</b></p></div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Промокоды</h3></div>' + (u.promos.length ? '<div class="promos">' + u.promos.map(function (p) { return '<span class="ticket"><code>' + esc(p.code) + '</code><span class="pct">−' + pctTxt(p.pct) + '%</span><span class="small">' + promoLine(p) + '</span></span>'; }).join('') + '</div><p class="small">Выберите промокод в корзине. Каждый — на один заказ.</p>' : '<p class="small">Личные промокоды выпадают в рулетке. С уровня «Золото» — промокод −1,5% каждый месяц, на «Алмазе» — ещё 3 по −2,5%. Промокоды магазина вводятся в корзине.</p>') + '</div>' +

      ((u.waits || []).length ? '<div class="card tile c12"><div class="tile-h"><h3>Жду появления</h3><span class="side">' + u.waits.length + '</span></div><div class="waits">' + u.waits.map(function (w) {
        return '<div class="wait-row"><a href="#p-' + esc(w.id) + '">' + esc(w.title) + '</a>' + (w.ready ? '<span class="badge badge-ok">можно заказать</span>' : '<span class="small">ждём поступления</span>') + '<button class="icon-btn" type="button" data-wx="' + esc(w.id) + '" aria-label="Больше не ждать">' + icon('x') + '</button></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="card tile c12"><div class="tile-h"><h3>Мои заказы</h3><a class="link-btn" href="#orders">Все заказы</a></div>' +
      (dashOrders.length ? '<div class="orders">' + dashOrders.map(orderCard).join('') + '</div>' + (u.orders.filter(isDoneOrder).length ? '<p class="small" style="margin-top:10px"><a href="#orders">История заказов · ' + u.orders.filter(isDoneOrder).length + '</a> — завершённые заказы, их можно повторить</p>' : '') : '<p class="small">Здесь появятся заказы с номерами и статусами. <a href="#catalog">Перейти в каталог</a></p>') + '</div>' +

      '<div class="card tile c12" style="padding-block:6px"><div class="rows">' +
      '<button class="rowl" type="button" id="r-prof"><span class="ic">' + icon('user') + '</span><span class="tx">Имя, телефон и Telegram</span><span class="val">' + esc(u.phone) + '</span>' + icon('chevron-right') + '</button>' +
      (API.enabled ? '<button class="rowl" type="button" id="r-tg"><span class="ic">' + icon('send') + '</span><span class="tx">Уведомления в Telegram</span><span class="val">' + (u.tgOn ? 'подключены' : 'не подключены') + '</span>' + icon('chevron-right') + '</button>' : '') +
      '<button class="rowl" type="button" id="r-email"><span class="ic">' + icon('mail') + '</span><span class="tx">Почта</span><span class="val">' + (u.email ? esc(u.email) : 'не указана') + '</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-pass"><span class="ic">' + icon('key') + '</span><span class="tx">Сменить пароль</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-home"><span class="ic">' + icon('phone') + '</span><span class="tx">Добавить на экран «Домой»</span><span class="val">' + esc((HOME_ICONS.filter(function (x) { return x[0] === homeIcon(); })[0] || [])[1]) + '</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-bday"' + (bd ? ' disabled' : '') + '><span class="ic">' + icon('gift') + '</span><span class="tx">День рождения</span><span class="val">' + (bd ? (+bd[1]) + ' ' + MONTHS[+bd[0] - 1] : 'указать · +' + R.birthday) + '</span>' + (bd ? '' : icon('chevron-right')) + '</button>' +
      '<button class="rowl" type="button" id="r-frame"><span class="ic">' + icon('star') + '</span><span class="tx">Рамка аватара</span><span class="val">' + esc((RULES.frames.filter(function (f) { return f.id === u.frame; })[0] || {}).name || '') + '</span>' + icon('chevron-right') + '</button>' +
      (u.avatar ? '<button class="rowl" type="button" id="r-noava"><span class="ic">' + icon('camera') + '</span><span class="tx">Убрать фото профиля</span>' + icon('chevron-right') + '</button>' : '') +
      '<button class="rowl" type="button" id="r-logout"><span class="ic">' + icon('logout') + '</span><span class="tx">Выйти</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl danger" type="button" id="r-del"><span class="ic">' + icon('trash') + '</span><span class="tx">Удалить аккаунт</span>' + icon('chevron-right') + '</button>' +
      '</div></div></div>';
    growBars(v); drawTasks(v);
    var on = function (id, fn) { var el = $('#' + id, v); if (el) el.addEventListener('click', fn); };
    on('ava-cam', pickAvatar); on('add-email', emailModal); on('r-prof', profileModal); on('r-email', emailModal); on('r-pass', passModal); on('r-home', homeModal);
    on('r-tg', tgModal); on('r-bday', bdayModal); on('r-frame', framesModal); on('r-del', deleteModal); on('all-levels', levelsModal);
    on('r-noava', function () { API.call('profile', { avatar: '' }).then(function (r) { if (r.ok) { setUser(r.user); toast('Фото убрано'); } }); });
    on('r-logout', function () { API.call('logout'); API.setSession(''); setUser(null); toast('Вы вышли из аккаунта'); });
    on('checkin-btn', function () { doCheckin($('#checkin-btn', v)); });
    on('ref-share', function () {
      var text = 'Заходи в ONION SHOP — по моей ссылке +' + R.refFriend + ' токенов при регистрации';
      try { if (navigator.share) { navigator.share({ title: 'ONION SHOP', text: text, url: refLink }).catch(function () { /* отменили */ }); return; } } catch (e) { /* */ }
      copyText(refLink, 'Ссылка-приглашение скопирована');
    });
    $$('[data-wx]', v).forEach(function (b) { b.addEventListener('click', function () { API.call('waitlist', { productId: b.getAttribute('data-wx'), on: false }).then(function (r) { if (r.ok) setUser(r.user); }); }); });
    bindOrders(v, dashOrders);
  }

  // ------------------------------------------------------------ рулетка
  var spinning = false, spinHistory = [];
  var SHORT = { none: 'Пусто', t25: '+25', t50: '+50', t100: '+100', t150: '+150', t200: '+200', t300: '+300', t500: '+500', t1000: '+1000', jackpot: '+2000', xp: '+50 XP', xp100: '+100 XP', xp150: '+150 XP', xp300: '+300 XP', xp500: '+500 XP', xp2000: '+2000 XP', frame: 'Рамка', frame2: 'Редкая рамка', promo: '−3%', promo5: '−5%', re1: '+1 прокрут', re2: '+2 прокрута' };
  function tileHtml(w) { return '<div class="reel-tile r-' + w.id + '">' + pz(w.id) + '<b>' + esc(SHORT[w.id] || w.label) + '</b></div>'; }
  function randomTile() { var W = RULES.wheel, tot = 0, r; W.forEach(function (w) { tot += Math.sqrt(w.w); }); r = Math.random() * tot; for (var i = 0; i < W.length; i++) { r -= Math.sqrt(W[i].w); if (r <= 0) return W[i]; } return W[0]; }
  function updateRoulBalance() {
    var u = acct.user, b = $('#roul-bal'); if (!b || !u) return;
    b.innerHTML = tk('lg') + '<span>' + num(u.balance) + '</span>';
    var fb = $('#spin-free'); if (fb) { fb.hidden = !u.freeSpins; fb.innerHTML = icon('gift') + 'Крутить бесплатно · ' + u.freeSpins; }
    var pbtn = $('#spin-paid'); if (pbtn) pbtn.disabled = spinning || u.balance < RULES.spinCost;
  }
  function renderRoulette() {
    var v = $('#v-roulette');
    if (!API.enabled) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('gift') + '</span><h3>Рулетка скоро появится</h3><a class="btn" href="#catalog">В каталог</a></div>'; return; }
    var u = acct.user, tiles = []; for (var i = 0; i < 14; i++) tiles.push(randomTile());
    var WW = u && u.wheel && u.wheel.length === RULES.wheel.length ? u.wheel : RULES.wheel.map(function (w) { return w.w; });
    var win = WHEEL_SUM - WW[0], boosted = WW[0] < RULES.wheel[0].w;
    v.innerHTML = '<div class="roul"><div class="pad roul-head"><div><span class="eyebrow" style="color:#8fe6f5">Рулетка ONION SHOP</span><h1>Крутите ленту — забирайте призы</h1></div>' +
      (u ? '<span class="roul-bal" id="roul-bal"></span>' : '<a class="btn btn-light" href="#account">' + icon('gift') + 'Войти и получить ' + RULES.reward.register + '</a>') + '</div>' +
      '<div class="reel" id="reel"><div class="reel-pin"></div><div class="reel-strip" id="strip">' + tiles.map(tileHtml).join('') + '</div></div>' +
      '<div class="pad roul-acts">' + (u ? '<button class="btn btn-light" type="button" id="spin-paid">' + icon('sparkles') + 'Крутить за ' + RULES.spinCost + ' ' + tokWord(RULES.spinCost) + '</button><button class="btn btn-glass" type="button" id="spin-free" hidden></button>' : '<button class="btn btn-light" type="button" id="spin-guest">' + icon('sparkles') + 'Крутить</button>') + '</div>' +
      '<p class="pad small" style="color:var(--navy-ink-2);text-align:center">Приз выпадает в ' + pct(win) + ' прокрутов' + (boosted ? ' — шансы повышены уровнем «' + esc(u.level.name) + '»' : '') + '. Каждый день — ' + (u && u.level.spins > 1 ? u.level.spins + ' бесплатных прокрута' : 'бесплатный прокрут') + '. Результат определяет сервер.</p>' +
      '<div class="pad" id="spin-hist"></div></div>' +
      '<div class="sec card tile"><div class="tile-h"><h3>Призы и шансы</h3></div><div class="chances">' + RULES.wheel.map(function (w, i) { return '<div class="c-' + w.id + '">' + pz(w.id) + '<span>' + esc(w.id === 'none' ? 'Пусто' : w.label + ' ' + w.sub) + '</span><b>' + pct(WW[i]) + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="sec info-grid"><div class="card icard"><h3><span class="ic">' + icon('info') + '</span>Как это работает</h3><ul><li>1 бесплатный прокрут каждый день на любом уровне, на «Алмазе» — 3. Не копятся: обновляются в 00:00 по Москве.</li><li>Дальше прокрут стоит ' + RULES.spinCost + ' токенов. «Ещё раз» даёт бесплатные прокруты — они не сгорают.</li><li>На «Платине» и «Алмазе» «Пусто» выпадает реже.</li><li>Токены из рулетки сразу на балансе, промокод −3% выбирается в корзине, XP идут в уровень месяца.</li></ul></div>' +
      '<div class="card icard"><h3><span class="ic">' + icon('gift') + '</span>Где взять токены</h3><ul><li>+' + RULES.reward.register + ' за регистрацию</li><li>+' + RULES.reward.checkin + ' за вход и от ' + RULES.levels[0].streak + ' до ' + RULES.levels[4].streak + ' за 7 дней подряд — зависит от уровня</li><li>Задания дня — по 1 токену, с уровнем их больше</li><li>+' + RULES.reward.referrer + ' за друга и +' + RULES.reward.birthday + ' в день рождения</li></ul></div></div>';
    updateRoulBalance();
    var g = $('#spin-guest', v); if (g) g.addEventListener('click', function () { requireAuth('roulette'); });
    var pbtn = $('#spin-paid', v); if (pbtn) pbtn.addEventListener('click', function () { spin(false); });
    var fb = $('#spin-free', v); if (fb) fb.addEventListener('click', function () { spin(true); });
    renderSpinHistory();
  }
  function renderSpinHistory() {
    var h = $('#spin-hist'); if (!h) return;
    h.innerHTML = spinHistory.length ? '<div class="acts" style="justify-content:center">' + spinHistory.slice(0, 8).map(function (p) { return '<span class="chip" style="background:rgba(255,255,255,.1);color:#fff">' + esc(SHORT[p.id] || p.label) + '</span>'; }).join('') + '</div>' : '';
  }
  function spin(free) {
    if (spinning || !acct.user) return;
    var u = acct.user;
    if (!free && u.balance < RULES.spinCost) { toast('Нужно ' + RULES.spinCost + ' токенов. Выполните задания или отметьтесь в кабинете', null, 'warn'); return; }
    spinning = true;
    $$('#spin-paid,#spin-free').forEach(function (b) { b.disabled = true; });
    API.call('spin', { free: free }).then(function (r) {
      if (!r.ok) { spinning = false; updateRoulBalance(); $$('#spin-paid,#spin-free').forEach(function (b) { b.disabled = false; }); toast(r.error, null, 'warn'); return; }
      var shown = Object.assign({}, acct.user, { balance: acct.user.balance - (free ? 0 : RULES.spinCost), freeSpins: acct.user.freeSpins - (free ? 1 : 0) });
      var real = r.user; acct.user = shown; updateRoulBalance(); updateAcctUI();
      var strip = $('#strip'), reel = $('#reel');
      if (!strip) { spinning = false; setUser(real); showPrize(r.prize); return; }
      var target = 46, tiles = [];
      for (var i = 0; i < 54; i++) tiles.push(randomTile());
      tiles[target] = RULES.wheel[r.index];
      strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
      strip.innerHTML = tiles.map(tileHtml).join('');
      void strip.offsetWidth;
      var t0 = strip.children[0], tw = t0.getBoundingClientRect().width, gap = 10;
      var center = reel.clientWidth / 2, jitter = (Math.random() - 0.5) * tw * 0.6;
      var x = center - (target * (tw + gap) + tw / 2) + jitter;
      var dur = REDUCED ? 200 : 5600;
      strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.08,.62,.12,1)';
      strip.style.transform = 'translateX(' + x + 'px)';
      setTimeout(function () {
        strip.children[target].classList.add('win');
        spinning = false;
        setUser(real); updateRoulBalance();
        spinHistory.unshift(r.prize); renderSpinHistory();
        showPrize(r.prize);
      }, dur + 150);
    });
  }
  function showPrize(p) {
    var win = p.id !== 'none';
    var visual = p.frameId ? ava({ name: acct.user && acct.user.name, avatar: acct.user && acct.user.avatar, frame: p.frameId }, 'lg') : pz(p.id);
    var title = p.id === 'none' ? 'Пусто' : p.tokens ? '+' + num(p.tokens) + ' ' + tokWord(p.tokens) : p.code ? 'Промокод −' + p.pct + '%' : p.xp ? '+' + p.xp + ' XP' : p.spins ? '+' + p.spins + ' ' + plural(p.spins, 'прокрут', 'прокрута', 'прокрутов') : p.frameName ? 'Рамка «' + p.frameName + '»' : p.label;
    var sub = p.id === 'none' ? 'В этот раз не повезло. Следующий прокрут может принести джекпот.' : p.code ? 'Код ' + p.code + ' уже в кабинете. Выберите его в корзине.' : p.xp ? 'Опыт засчитан в уровень этого месяца.' : p.spins ? 'Бесплатные прокруты добавлены.' : p.frameName ? 'Новая рамка открыта — наденьте её в кабинете.' : p.id === 'jackpot' ? 'Джекпот! Токены уже на балансе.' : 'Токены уже на балансе.';
    var md = openModal('<div class="prize-pop"><div class="burst">' + visual + '</div><span class="eyebrow">' + (win ? 'Ваш приз' : 'Результат') + '</span><h2>' + esc(title) + '</h2><p class="muted">' + esc(sub) + '</p>' +
      '<div class="send-row" style="width:100%">' + (p.spins ? '<button class="btn" type="button" id="again-free">' + icon('sparkles') + 'Крутить бесплатно</button>' : '<button class="btn" type="button" id="again">' + icon('sparkles') + 'Ещё раз</button>') +
      (p.frameId ? '<button class="btn btn-ghost" type="button" id="wear">Надеть рамку</button>' : '<button class="btn btn-ghost" type="button" data-close>Закрыть</button>') + '</div></div>', { cls: 'sm' });
    if (win) confetti(p.id === 'jackpot' ? 240 : 100);
    var a = $('#again', md); if (a) a.addEventListener('click', function () { closeModal(); spin(false); });
    var af = $('#again-free', md); if (af) af.addEventListener('click', function () { closeModal(); spin(true); });
    var w = $('#wear', md); if (w) w.addEventListener('click', function () { API.call('profile', { frame: p.frameId }).then(function (r) { if (r.ok) { setUser(r.user); toast('Рамка надета'); } closeModal(); }); });
  }

  // ------------------------------------------------------------ информация
  function renderInfo() {
    track('info');
    $('#v-info').innerHTML = '<div class="view-head"><div><span class="eyebrow">Информация</span><h1>Как заказать, доставка и оплата</h1></div></div>' + stepsBlock() +
      '<div class="sec">' + preorderBanner() + '</div>' +
      '<div class="sec info-grid">' + deliveryCard() + paymentCard() + '</div>' +
      (API.enabled ? '<div class="sec info-grid"><div class="card icard"><h3><span class="ic">' + tk() + '</span>Токены</h3><ul><li>1 токен = 0,4 ₽ скидки, до 15% суммы заказа</li><li>+' + RULES.reward.register + ' за регистрацию, +' + RULES.reward.checkin + ' за вход каждый день, за 7 дней подряд — от ' + RULES.levels[0].streak + ' до ' + RULES.levels[4].streak + ' по уровню</li><li>Задания дня по 1 токену: на Бронзе 4, на Серебре 5, с Золота 6</li><li>Рулетка, +' + RULES.reward.referrer + ' за друга, +' + RULES.reward.birthday + ' в день рождения</li><li>Токены не сгорают и не переводятся другим людям</li></ul><a class="btn btn-ghost btn-sm" href="#account" style="justify-self:start">Мой кабинет</a></div>' +
        '<div class="card icard"><h3><span class="ic">' + icon('trophy') + '</span>Программа лояльности</h3><div class="lvl-mini">' + RULES.levels.map(function (l) { return '<div>' + lvlImg(l.key, 40) + '<b>' + esc(l.name) + '</b><span class="small">' + (l.min ? 'от ' + num(l.min) + ' XP' : 'старт') + '</span></div>'; }).join('') + '</div><p class="small">Уровень растёт от XP: полученные заказы (1 XP за 10 ₽), вход, задания и рулетка. 1-го числа XP обнуляется.</p><button class="btn btn-ghost btn-sm" type="button" id="info-levels" style="justify-self:start">Все привилегии уровней</button></div></div>' : '') +
      '<div class="sec info-grid">' + contactsCard() +
      '<div class="card icard"><h3><span class="ic">' + icon('shield') + '</span>Перед заказом</h3><ul><li>Наличие и размеры менеджер подтвердит перед оплатой.</li><li>Предзаказ: выкуп у поставщика, проверка на брак и фотоотчёт на складе в Китае.</li><li>Статус заказа виден в «Моих заказах»: оформлен → выкуплен → в пути → на складе → едет к нам → едет к вам → получен.</li><li>Нужной вещи нет в каталоге — напишите менеджеру, подберём под заказ.</li></ul><a class="btn btn-ghost btn-sm" href="' + SHOP.infoUrl + '" target="_blank" rel="noopener" style="justify-self:start">Подробно о предзаказе' + icon('arrow-up-right') + '</a></div></div>';
    var il = $('#info-levels'); if (il) il.addEventListener('click', levelsModal);
  }

  // ------------------------------------------------------------ маршруты
  var skipHash = null, catBack = null, routed = 0;
  function silentHash(h) { if (location.hash.slice(1) === h) return; skipHash = h; location.hash = h; }
  function go(h) { if (location.hash.slice(1) === h || (!h && !location.hash)) route(); else location.hash = h; }
  function setNav(h) {
    var key = h === '' ? 'home' : /^p-/.test(h) || h === 'stock' || h === 'preorder' ? 'catalog' : h;
    $$('[data-route]').forEach(function (a) {
      var r = a.getAttribute('data-route'), on = r === key || (r === 'preorder' && h === 'preorder');
      if (r === 'catalog' && h === 'preorder' && !a.closest('.tabbar')) on = false;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function show(view) {
    $$('[data-view]').forEach(function (s) {
      var on = s.getAttribute('data-view') === view;
      s.hidden = !on;
      if (on && !REDUCED) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
    });
    current = view;
  }
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, '')); routed++;
    if (skipHash !== null && h === skipHash) { skipHash = null; return; }
    skipHash = null;
    var m = h.match(/^ref=([A-Za-z0-9]{4,12})$/);
    if (m) {
      store.set('ref', m[1].toUpperCase());
      if (!acct.user) { authTab = 'register'; toast('Приглашение принято: +' + RULES.reward.refFriend + ' токенов при регистрации'); }
      history.replaceState(null, '', location.pathname + location.search + '#account'); h = 'account';
    }
    closeModal(); closeLightbox(); hideBuybar();
    // запоминаем место в каталоге, когда уходим из него в товар; вернёмся к этой же карточке
    var restore = null;
    if (current === 'catalog' && /^p-\d+$/.test(h)) catBack = { y: window.scrollY, id: h.slice(2), tab: filter.tab };
    else if (current === 'product' && catBack && (h === 'catalog' || h === 'stock' || h === 'preorder')) restore = catBack;
    else if (!/^p-\d+$/.test(h)) catBack = null;
    if (!h || h === 'home') { renderHome(); show('home'); }
    else if (h === 'catalog' || h === 'stock' || h === 'preorder') {
      filter.tab = restore ? restore.tab : (h === 'catalog' ? 'all' : h);
      if (restore) { var hh = restore.tab === 'all' ? 'catalog' : restore.tab; if (hh !== h) { try { history.replaceState(null, '', location.pathname + location.search + '#' + hh); h = hh; } catch (e) { /* */ } } }
      renderCatalog(); show('catalog'); if (h === 'preorder') track('pre'); else if (h === 'stock') track('stock');
    }
    else if (/^p-\d+$/.test(h)) { renderProduct(h.slice(2)); show('product'); }
    else if (h === 'cart') { renderCart(); show('cart'); }
    else if (h === 'orders') { renderOrders(); show('orders'); }
    else if (h === 'favorites') { renderFavorites(); show('favorites'); }
    else if (h === 'account') { renderAccount(); show('account'); flushTrack(); }
    else if (h === 'roulette') { renderRoulette(); show('roulette'); }
    else if (h === 'info') { renderInfo(); show('info'); }
    else { renderHome(); show('home'); }
    setNav(h);
    if (restore) restoreCatalogSpot(restore); else window.scrollTo(0, 0);
    tickClock();
  }
  function restoreCatalogSpot(pos) {
    function place() {
      var el = pos.id && $('#cat-grid [data-pid="' + pos.id + '"]');
      if (el) { var r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - Math.max(80, (window.innerHeight - r.height) / 2))); }
      else window.scrollTo(0, pos.y || 0);
    }
    place(); requestAnimationFrame(place); setTimeout(place, 250); // картинки подгружаются и чуть двигают раскладку
  }
  // после загрузки аккаунта обновляем только то, что от него зависит (без прокрутки наверх)
  function refreshView() {
    if (current === 'home') { var b = $('#tok-strip'); if (b) { b.outerHTML = tokensStrip(); growBars($('#v-home')); } }
    else if (current === 'account') renderAccount();
    else if (current === 'roulette') renderRoulette();
    else if (current === 'cart') renderCart();
    else if (current === 'orders') renderOrders();
    if (acct.user && current === 'catalog') { if (filter.tab === 'preorder') track('pre'); else if (filter.tab === 'stock') track('stock'); }
    if (acct.user && current === 'info') track('info');
  }

  // ------------------------------------------------------------ тема
  function themeIcon() {
    var a = document.documentElement.getAttribute('data-theme');
    var dark = a === 'dark' || (!a && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var b = $('#theme-btn'); b.innerHTML = icon(dark ? 'sun' : 'moon'); b.setAttribute('aria-label', dark ? 'Светлая тема' : 'Тёмная тема');
    var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', dark ? '#08111f' : '#dfe6ef');
    return dark;
  }

  // ------------------------------------------------------------ запуск

  // ------------------------------------------------------------ Telegram, отзывы, размеры
  function stars(n) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= Math.round(n) ? 'on' : '') + '">★</i>'; return '<span class="stars" role="img" aria-label="' + n + ' из 5">' + h + '</span>'; }
  function reviewBtn(o) {
    if (!acct.user || String(o.status) !== 'Получен' || !o.reviewed) return '';
    var left = (o.items || []).filter(function (it) { return o.reviewed.indexOf(it.id) < 0; }).length;
    return left ? '<button class="btn btn-sm" type="button" data-review>' + icon('star') + 'Оставить отзыв · +' + RULES.reward.reviewText + '</button>' : '';
  }
  function reviewModal(o) {
    var R = RULES.reward, items = (o.items || []).filter(function (it) { return (o.reviewed || []).indexOf(it.id) < 0; });
    var md = openModal(modalHead('Отзыв о заказе') + '<p class="small">За оценку — +' + R.review + ' токенов, за оценку с отзывом от 20 символов — +' + R.reviewText + '. Отзыв увидят другие покупатели на странице товара.</p><div class="rv-list">' +
      items.map(function (it) {
        var id = it.photo || it.thumb;
        return '<div class="rv" data-id="' + esc(it.id) + '"><div class="rv-h">' + (id ? '<img src="' + thumb(id) + '" alt="">' : '') + '<b>' + esc(it.title) + '</b></div>' +
          '<div class="rv-pick" role="radiogroup" aria-label="Оценка">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-r="' + n + '" aria-label="' + n + '">★</button>'; }).join('') + '</div>' +
          '<textarea maxlength="600" placeholder="Как сидит, качество, совпало ли с фото"></textarea><div class="rv-act"><button class="btn btn-sm" type="button" data-send disabled>Отправить</button><span class="rv-msg small"></span></div></div>';
      }).join('') + '</div>', { cls: 'sm' });
    $$('.rv', md).forEach(function (box) {
      var rating = 0, send = $('[data-send]', box), msg = $('.rv-msg', box);
      $$('.rv-pick button', box).forEach(function (b) {
        b.addEventListener('click', function () { rating = +b.getAttribute('data-r'); $$('.rv-pick button', box).forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-r') <= rating); }); send.disabled = false; });
      });
      send.addEventListener('click', function () {
        busy(send, true, 'Отправляем');
        API.call('review', { no: o.no, productId: box.getAttribute('data-id'), rating: rating, text: $('textarea', box).value }).then(function (r) {
          busy(send, false);
          if (!r.ok) { msg.textContent = r.error; return; }
          acct.user = r.user; updateAcctUI(); revCache = {};
          box.innerHTML = '<div class="rv-done">' + icon('check-circle') + '<span>Спасибо! <b>+' + r.reward + '</b> ' + plural(r.reward, 'токен', 'токена', 'токенов') + ' на балансе</span></div>';
          reward('Спасибо за отзыв: +' + r.reward + ' токенов');
          if (!$('.rv [data-send]', md)) setTimeout(function () { closeModal(); refreshView(); }, 1300);
        });
      });
    });
  }
  var revCache = {};
  function drawReviews(r, body, n) {
    if (n) n.textContent = r.count ? '· ' + r.count : '';
    body.innerHTML = r.count
      ? '<div class="rev-sum">' + stars(r.avg) + '<b>' + String(r.avg).replace('.', ',') + '</b><span class="small">' + r.count + ' ' + plural(r.count, 'отзыв', 'отзыва', 'отзывов') + '</span></div>' +
        r.list.map(function (x) { return '<div class="rev"><div class="rev-h"><b>' + esc(x.name) + '</b>' + stars(x.rating) + '<span class="small">' + esc(x.at) + '</span></div>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div>'; }).join('')
      : '<p class="small">Отзывов пока нет. Они появляются после получения заказа — их оставляют покупатели в кабинете.</p>';
  }
  function loadReviews(pid, body, n) {
    if (revCache[pid]) { drawReviews(revCache[pid], body, n); return; }
    API.call('reviews', { productId: pid }).then(function (r) {
      if (!r.ok) { body.innerHTML = '<p class="small">Не удалось загрузить отзывы. Попробуйте позже.</p>'; return; }
      revCache[pid] = r; drawReviews(r, body, n);
    });
  }
  function tgModal() {
    if (!acct.user) return;
    var md = openModal(modalHead('Уведомления в Telegram') + '<div id="tg-body"></div>', { cls: 'sm' });
    var polls = 0;
    function draw() {
      var u = acct.user, b = $('#tg-body', md); if (!b) return;
      if (u.tgOn) {
        b.innerHTML = '<div class="notice notice-info">' + icon('check-circle') + '<div><b>Подключено</b>' + (u.tgName ? ' · ' + esc(u.tgName) : '') + '. Напишем, когда заказ меняет статус и когда товар из «Жду появления» снова в продаже.</div></div><button class="btn btn-ghost" type="button" id="tg-off" style="margin-top:12px">Отключить</button>';
        $('#tg-off', b).addEventListener('click', function () { API.call('tgUnlink').then(function (r) { if (r.ok) { setUser(r.user); draw(); toast('Уведомления отключены'); } }); });
      } else {
        b.innerHTML = '<p class="small">Бот пришлёт сообщение, когда заказ выкуплен, в пути, на складе или получен, и когда нужный товар снова в наличии. Больше он ничего не пишет.</p><button class="btn" type="button" id="tg-on">' + icon('send') + 'Подключить Telegram</button><div id="tg-out" style="margin-top:12px"></div>';
        $('#tg-on', b).addEventListener('click', function () {
          var btn = this; busy(btn, true, 'Секунду');
          API.call('tgLink').then(function (r) {
            busy(btn, false); var out = $('#tg-out', b);
            if (!r.ok) { out.innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; return; }
            if (!r.bot) { out.innerHTML = '<div class="form-err">Бот магазина ещё не подключён. Напишите менеджеру — включим.</div>'; return; }
            out.innerHTML = '<a class="btn" target="_blank" rel="noopener" href="https://t.me/' + esc(r.bot) + '?start=' + esc(r.code) + '">' + icon('send') + 'Открыть бота и нажать «Старт»</a><p class="small" style="margin-top:8px">Ждём подтверждение от бота…</p>';
            (function poll() {
              if (!document.body.contains(md) || !$('#tg-body', md) || ++polls > 45) return;
              setTimeout(function () {
                API.call('me').then(function (m) {
                  if (m.ok && m.user && m.user.tgOn) { setUser(m.user); draw(); reward('Telegram подключён'); } else poll();
                });
              }, 4000);
            })();
          });
        });
      }
    }
    draw();
  }
  var SIZE_SCALE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
  function normSize(s) { s = String(s).trim().toUpperCase().replace(/\s/g, ''); return s === '2XL' ? 'XXL' : s === 'XXXL' ? '3XL' : s === '4XL' || s === 'XXXXL' ? '4XL' : s === 'XXS' ? 'XXS' : s; }
  function fitModal(p, apply) {
    var nums = p.sizes.map(function (x) { return parseFloat(String(x).replace(',', '.')); });
    var shoe = nums.every(function (n) { return n >= 30 && n <= 50; }), letters = p.sizes.every(function (x) { return SIZE_SCALE.indexOf(normSize(x)) >= 0; });
    var saved = store.get('fit', {});
    var form = shoe
      ? '<label for="fit-foot"><b>Длина стопы, см</b></label><input class="input" id="fit-foot" type="number" inputmode="decimal" min="18" max="34" step="0.1" placeholder="например, 26,5" value="' + (saved.foot || '') + '">'
      : letters ? '<div class="fit-grid"><div><label for="fit-h"><b>Рост, см</b></label><input class="input" id="fit-h" type="number" inputmode="numeric" min="130" max="215" placeholder="170" value="' + (saved.h || '') + '"></div><div><label for="fit-w"><b>Вес, кг</b></label><input class="input" id="fit-w" type="number" inputmode="numeric" min="30" max="200" placeholder="65" value="' + (saved.w || '') + '"></div></div>' +
        '<label for="fit-s"><b>Как носите</b></label><select class="select" id="fit-s"><option value="0">По фигуре</option><option value="1"' + (saved.s === '1' ? ' selected' : '') + '>Свободно</option></select>'
      : '<p>У этого товара нестандартная сетка размеров (' + p.sizes.map(esc).join(', ') + '). Сверьтесь с замерами изделия или спросите менеджера — подскажем.</p>';
    var md = openModal(modalHead('Подобрать размер') + '<div class="fit">' + form + (shoe || letters ? '<button class="btn" type="button" id="fit-go" style="margin-top:12px">Подобрать</button><div id="fit-out" aria-live="polite"></div>' : '') +
      '<p class="small" style="margin-top:12px">Это ориентир по общей сетке. Сверьте с замерами изделия (кнопка «Замеры»), а если сомневаетесь — спросите менеджера.</p></div>', { cls: 'sm' });
    var go1 = $('#fit-go', md); if (!go1) return;
    go1.addEventListener('click', function () {
      var out = $('#fit-out', md), want, label;
      if (shoe) {
        var foot = parseFloat(String($('#fit-foot', md).value).replace(',', '.'));
        if (!(foot >= 18 && foot <= 34)) { out.innerHTML = '<div class="form-err">Введите длину стопы от 18 до 34 см</div>'; return; }
        store.set('fit', Object.assign(saved, { foot: foot }));
        want = Math.round((foot + 1.5) * 1.5); label = 'по стопе ' + String(foot).replace('.', ',') + ' см';
        var best = null; nums.forEach(function (n, i) { if (best === null || Math.abs(n - want) < Math.abs(nums[best] - want)) best = i; });
        draw(p.sizes[best], Math.abs(nums[best] - want) < 0.6, want);
      } else {
        var h = parseFloat($('#fit-h', md).value), w = parseFloat($('#fit-w', md).value), fs = $('#fit-s', md).value;
        if (!(h >= 130 && h <= 215) || !(w >= 30 && w <= 200)) { out.innerHTML = '<div class="form-err">Проверьте рост и вес</div>'; return; }
        store.set('fit', Object.assign(saved, { h: h, w: w, s: fs }));
        var idx = w < 47 ? 1 : w < 55 ? 2 : w < 64 ? 3 : w < 74 ? 4 : w < 85 ? 5 : w < 96 ? 6 : w < 108 ? 7 : 8;
        if (h >= 182) idx += 1; else if (h <= 155) idx -= 1;
        idx = Math.max(0, Math.min(SIZE_SCALE.length - 1, idx + (+fs)));
        var bestI = null; p.sizes.forEach(function (x, i) { var k = SIZE_SCALE.indexOf(normSize(x)); if (bestI === null || Math.abs(k - idx) < Math.abs(SIZE_SCALE.indexOf(normSize(p.sizes[bestI])) - idx)) bestI = i; });
        draw(p.sizes[bestI], normSize(p.sizes[bestI]) === SIZE_SCALE[idx], SIZE_SCALE[idx]);
      }
      function draw(size, exact, calc) {
        out.innerHTML = '<div class="fit-res"><small>' + (exact ? 'Вам подойдёт' : 'Ближайший в наличии') + '</small><b>' + esc(size) + '</b>' + (exact ? '' : '<span class="small">по расчёту — ' + esc(calc) + ', такого нет</span>') + '<button class="btn btn-sm" type="button" id="fit-pick">Выбрать ' + esc(size) + '</button></div>';
        $('#fit-pick', out).addEventListener('click', function () { closeModal(); apply(size); });
      }
    });
  }
  // нет связи: плашка сверху
  function netBar(show) {
    var el = $('#net-bar');
    if (!el) { el = document.createElement('div'); el.id = 'net-bar'; el.className = 'net-bar'; el.setAttribute('role', 'status'); el.hidden = true; el.innerHTML = '<span>Нет связи — каталог открыт, но войти и оформить заказ пока нельзя.</span><button type="button">Повторить</button>'; document.body.insertBefore(el, document.body.firstChild); $('button', el).addEventListener('click', function () { refreshMe().then(function () { refreshView(); }); }); }
    el.hidden = !show;
  }

  function init() {
    try { var ref = new URLSearchParams(location.search).get('ref'); if (ref) store.set('ref', ref.toUpperCase().slice(0, 12)); } catch (e) { /* */ }
    updateCounts(); updateAcctUI(); startClock(); themeIcon(); applyHomeIcon();
    $('#demo-bar').hidden = API.mode !== 'demo';
    $('#demo-reset').addEventListener('click', function () { confirmBox({ title: 'Сбросить демо?', text: 'Удалятся демо-аккаунты, токены и заказы в этом браузере.', actions: [{ label: 'Отмена', cls: 'btn-ghost' }, { label: 'Сбросить', cls: 'btn-danger', run: function () { API.resetDemo(); acct.user = null; updateAcctUI(); route(); toast('Демо сброшено'); } }] }); });
    $('#theme-btn').addEventListener('click', function () {
      var next = themeIcon() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('onion.shop.theme', next); } catch (e) { /* */ }
      themeIcon();
    });
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeIcon); } catch (e) { /* */ } }
    document.addEventListener('click', function (e) {
      var mg = e.target.closest('a[href]'); if (mg && SHOP.managerUrl && (mg.getAttribute('href') || '').indexOf(SHOP.managerUrl) === 0) track('mgr');
      var c = e.target.closest('[data-copy]');
      if (c) { e.preventDefault(); copyText(c.getAttribute('data-copy'), 'Скопировано'); return; }
      var f = e.target.closest('[data-fav]');
      if (f) { e.preventDefault(); toggleFav(f.getAttribute('data-fav'), f); }
    });
    var upd = $('#catalog-updated');
    if (upd && CATALOG.updatedAt) { var t = msk(new Date(CATALOG.updatedAt)); upd.textContent = 'Каталог обновлён ' + String(t.d).padStart(2, '0') + '.' + String(t.mo).padStart(2, '0') + '.' + t.y + ' в ' + t.hh + ':' + t.mm + ' (МСК).'; }
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', function (e) { if (e.key === 'onion.shop.cart') { cart = store.get('cart', []); updateCounts(); if (current === 'cart') renderCart(); } });
    window.addEventListener('offline', function () { netBar(true); });
    window.addEventListener('online', function () { netBar(false); silentRefresh(); });
    window.addEventListener('onion:neterr', function () { netBar(true); });
    window.addEventListener('onion:netok', function () { netBar(false); });
    if (navigator.onLine === false) netBar(true);
    route();
    window.__onionBoot = true;
    refreshMe().then(function () { lastMe = acct.user ? JSON.stringify(acct.user) : ''; refreshView(); });
    setInterval(silentRefresh, 45000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushTrack(); else silentRefresh(); });
    window.addEventListener('focus', silentRefresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
