/* ONION SHOP — витрина.
   Каталог: data/catalog.js (обновляется сам из Telegram-канала).
   Аккаунты, токены, рулетка и номера заказов: Google Таблица через assets/api.js
   (в предпросмотре — демо в браузере). Корзина, избранное и недавние — в браузере. */
(function () {
  'use strict';

  var SHOP = {
    manager: 'OnionShop_Support',
    managerUrl: 'https://t.me/OnionShop_Support',
    whatsapp: '79852300088',
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
  PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ утилиты
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function coin(cls) { return '<i class="coin' + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'; }
  var NF = new Intl.NumberFormat('ru-RU');
  function num(n) { return NF.format(n); }
  function rub(n) { return NF.format(Math.round(n)) + ' ₽'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, a, b, c) { n = Math.abs(n); var m10 = n % 10, m100 = n % 100; return (m10 === 1 && m100 !== 11) ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? b : c; }
  function tokWord(n) { return plural(n, 'токен', 'токена', 'токенов'); }
  function thumb(id) { return 'img/thumb/' + id + '.jpg'; }
  function full(id) { return 'img/full/' + id + '.jpg'; }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function initials(name) { var p = String(name || '?').trim().split(/\s+/); return (p[0].charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('onion.shop.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('onion.shop.' + k, JSON.stringify(v)); } catch (e) { /* нет хранилища */ } }
  };

  // ------------------------------------------------------------ время (Москва)
  var WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
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
    set('footer-date', 'Сегодня ' + WD_LONG[t.wd] + ', ' + t.d + ' ' + MONTHS[t.mo - 1] + ' ' + t.y + ' · ' + time + ' МСК');
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
    if (!hx.length) return 'background:conic-gradient(#e85d75,#f2c230,#4f8a5b,#2f72ff,#7b4fc4,#e85d75)';
    if (hx.length === 1) return 'background:' + hx[0];
    if (striped) return 'background:repeating-linear-gradient(135deg,' + hx[0] + ' 0 4px,' + hx[1] + ' 4px 8px)';
    return 'background:linear-gradient(135deg,' + hx[0] + ' 50%,' + hx[1] + ' 50%)';
  }

  // ------------------------------------------------------------ состояние
  var cart = store.get('cart', []);
  var localOrders = store.get('orders', []);
  var favs = store.get('favs', []);
  var recent = store.get('recent', []);
  var acct = { user: null, ready: false };
  var returnTo = null;
  var current = 'home';

  function saveCart() { store.set('cart', cart); updateCounts(true); }
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
    if (on) maybeTask('fav');
    if (current === 'favorites' && !on) renderFavorites();
  }
  function pushRecent(id) { recent = [String(id)].concat(recent.filter(function (x) { return x !== String(id); })).slice(0, 12); store.set('recent', recent); }

  // ------------------------------------------------------------ уведомления, окна, анимации
  function toast(msg, action, kind) {
    var root = $('#toasts'), el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    var ic = kind === 'reward' ? coin('spin') : icon(kind === 'warn' ? 'alert' : 'check-circle');
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
  function escClose(e) { if (e.key === 'Escape') { closeModal(); closeLightbox(); } }
  function closeModal() {
    var root = $('#modal-root'); if (!root.innerHTML) return;
    root.innerHTML = '';
    document.removeEventListener('keydown', escClose);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* */ }
  }
  function confirmBox(o) {
    var md = openModal('<div class="modal-head"><h2>' + esc(o.title) + '</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon('x') + '</button></div>' +
      (o.text ? '<p class="muted">' + esc(o.text) + '</p>' : '') +
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
      toast(ok ? okMsg : 'Выделите текст и скопируйте вручную', null, ok ? '' : 'warn');
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function bump(el) { if (!el || REDUCED) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function visibleEl(sel) { return $$(sel).filter(function (e) { return e.offsetParent !== null && e.getBoundingClientRect().width > 0; })[0]; }
  function flyToCart(img) {
    var target = visibleEl('.hdr .cart-btn') || visibleEl('.tabbar .mid .bub');
    if (!img || !target || REDUCED || !img.animate) return;
    var r1 = img.getBoundingClientRect(), r2 = target.getBoundingClientRect();
    var size = Math.min(r1.width, r1.height, 220);
    var f = document.createElement('img');
    f.src = img.currentSrc || img.src; f.className = 'fly'; f.alt = '';
    var x0 = r1.left + r1.width / 2 - size / 2, y0 = r1.top + r1.height / 2 - size / 2;
    f.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px;width:' + size + 'px;height:' + size + 'px';
    document.body.appendChild(f);
    var dx = r2.left + r2.width / 2 - (x0 + size / 2), dy = r2.top + r2.height / 2 - (y0 + size / 2);
    f.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.45 + 'px,' + (Math.min(dy, 0) - 90) + 'px) scale(.55) rotate(-8deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.06) rotate(12deg)', opacity: 0.4 }
    ], { duration: 850, easing: 'cubic-bezier(.45,0,.7,.4)' }).onfinish = function () { f.remove(); bump(target); };
  }
  function confetti(power) {
    if (REDUCED) return;
    var c = document.createElement('canvas'); c.className = 'confetti';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var colors = ['#17cdf7', '#2f72ff', '#ffd76a', '#f5b21b', '#7fe3b0', '#ff7a8d', '#ffffff'];
    var P = [], n = power || 140;
    for (var i = 0; i < n; i++) P.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * 0.38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, c: colors[i % colors.length], round: Math.random() < .3 });
    var t0 = performance.now();
    (function frame(t) {
      var el = t - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(function (p) { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - el / 2600); ctx.fillStyle = p.c; if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (el < 2600) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  // ------------------------------------------------------------ аккаунт
  function setUser(u) {
    acct.user = u || null;
    updateAcctUI();
    if (current === 'account') renderAccount();
    else if (current === 'roulette') updateRoulBalance();
  }
  function refreshMe() {
    if (!API.enabled || !API.getSession()) { acct.ready = true; updateAcctUI(); return Promise.resolve(); }
    return API.call('me').then(function (r) {
      acct.ready = true;
      if (r.ok) setUser(r.user);
      else { if (r.error === 'auth') API.setSession(''); setUser(null); }
      if (acct.user && !acct.user.checkedToday) {
        setTimeout(function () { toast('Заберите ' + RULES.reward.checkin + ' ' + tokWord(RULES.reward.checkin) + ' за сегодняшний вход', { label: 'Забрать', run: doCheckin }); }, 1200);
      }
    });
  }
  function updateAcctUI() {
    $$('[data-needs-api]').forEach(function (el) { el.hidden = !API.enabled; });
    var chip = $('#acct-chip'), tab = $('#tab-acct');
    if (!API.enabled) {
      chip.hidden = true;
      tab.href = '#orders'; tab.setAttribute('data-route', 'orders'); tab.innerHTML = icon('receipt') + '<span>Заказы</span>';
      return;
    }
    chip.hidden = false;
    var u = acct.user;
    if (u) {
      chip.className = 'acct-chip';
      chip.innerHTML = '<span class="ava f-' + esc(u.frame) + '">' + esc(initials(u.name)) + '</span><span class="tok">' + coin() + num(u.balance) + '</span>';
      chip.setAttribute('aria-label', 'Кабинет, ' + u.balance + ' ' + tokWord(u.balance));
      tab.innerHTML = '<span class="ava f-' + esc(u.frame) + '" style="width:24px;height:24px;font-size:10px">' + esc(initials(u.name)) + '</span><span>' + num(u.balance) + '</span>';
    } else {
      chip.className = 'acct-chip guest';
      chip.innerHTML = icon('user') + '<span>Войти</span>';
      tab.innerHTML = icon('user') + '<span>Кабинет</span>';
    }
  }
  function requireAuth(back) { returnTo = back || current; go('account'); toast('Войдите или создайте аккаунт — за регистрацию ' + RULES.reward.register + ' токенов'); }
  var taskBusy = {};
  function maybeTask(key) {
    var u = acct.user;
    if (!u || u.tasksDone.indexOf(key) >= 0 || taskBusy[key]) return;
    taskBusy[key] = true;
    API.call('task', { task: key }).then(function (r) {
      taskBusy[key] = false;
      if (r.ok && r.got > 0) { setUser(r.user); reward('+' + r.got + ' ' + tokWord(r.got) + ' · задание «' + r.title + '»'); }
    });
  }
  function doCheckin(btn) {
    if (!acct.user) return requireAuth('account');
    if (btn && btn.disabled !== undefined) btn.disabled = true;
    API.call('checkin').then(function (r) {
      if (!r.ok) { toast(r.error, null, 'warn'); if (btn) btn.disabled = false; return; }
      setUser(r.user);
      reward('+' + r.got + ' ' + tokWord(r.got) + ' за вход' + (r.extra.length ? ' · ' + r.extra.join(', ') : ''));
      if (r.extra.length) confetti(90);
    });
  }

  // ------------------------------------------------------------ карточка товара
  function badge(p) { return p.status === 'preorder' ? '<span class="badge badge-pre">Предзаказ</span>' : '<span class="badge badge-stock">В наличии</span>'; }
  function discount(p) { return p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0; }
  function card(p, i) {
    var a = p.photos[0], b = p.photos[1], d = discount(p), id = esc(p.id);
    var sw = p.colors.length > 1 ? '<div class="sw-row">' + p.colors.slice(0, 5).map(function (c) { return '<i class="sw" style="' + swatch(c) + '" title="' + esc(c) + '"></i>'; }).join('') + (p.colors.length > 5 ? '<small>+' + (p.colors.length - 5) + '</small>' : '') + '</div>' : '';
    return '<article class="pcard" style="--i:' + (i || 0) + '">' +
      '<a class="ph" href="#p-' + id + '" tabindex="-1" aria-hidden="true"><img class="a" src="' + thumb(a.id) + '" alt="" loading="lazy" decoding="async">' +
      (b ? '<img class="b" src="' + thumb(b.id) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<div class="tags">' + badge(p) + (d >= 3 ? '<span class="badge badge-sale">−' + d + '%</span>' : '') + '</div>' +
      (p.photos.length > 1 ? '<span class="cnt-ph">' + icon('camera') + p.photos.length + '</span>' : '') + '</a>' +
      '<button class="fav" type="button" data-fav="' + id + '" aria-pressed="' + isFav(p.id) + '" aria-label="Избранное: ' + esc(p.title) + '">' + icon('heart') + '</button>' +
      '<a class="body" href="#p-' + id + '"><span class="brand-l">' + esc(p.brand || p.categoryLabel) + '</span><span class="t">' + esc(p.title) + '</span>' + sw +
      (p.sizes.length ? '<div class="sz">' + p.sizes.slice(0, 5).map(function (s) { return '<span>' + esc(s.length > 6 ? 'one size' : s) + '</span>'; }).join('') + (p.sizes.length > 5 ? '<span>+' + (p.sizes.length - 5) + '</span>' : '') + '</div>' : '') +
      '<div class="prices"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span>' : '') + '</div></a></article>';
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
    return '<div class="card icard"><h3><span class="ic">' + icon('truck') + '</span>Доставка по России</h3><ul><li>СДЭК</li><li>Почта России</li><li>Яндекс Маркет</li><li>Авито Доставка</li><li>Курьер Яндекс <small>· по Москве</small></li><li>Личная встреча <small>· Москва</small></li></ul><p class="small">Способ и стоимость доставки согласуете с менеджером после оформления.</p></div>';
  }
  function paymentCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('card') + '</span>Оплата</h3><ul><li>Банковский перевод: Сбербанк, Т-Банк, Альфа-Банк</li><li>Система быстрых платежей (СБП)</li><li>Наличными <small>· при личной встрече в Москве</small></li>' +
      (API.enabled ? '<li>До 15% заказа — токенами <small>· 1 токен = 0,4 ₽</small></li>' : '') + '</ul><p class="small">На сайте оплаты нет: менеджер подтвердит наличие и пришлёт реквизиты.</p></div>';
  }
  function contactsCard() {
    var s = openState();
    return '<div class="card icard"><h3><span class="ic">' + icon('pin') + '</span>Магазин и связь</h3>' +
      '<span class="open-state ' + (s.open ? 'on' : 'off') + '" data-open-state>' + esc(s.text) + '</span>' +
      '<div class="hours"><div data-today-row="0"><span>Пн–Пт</span><span class="num">08:30–21:00</span></div><div data-today-row="1"><span>Сб–Вс</span><span class="num">10:00–20:00</span></div></div>' +
      '<div class="contacts">' +
      '<a class="contact" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('send') + '<span><small>Менеджер в Telegram</small><b>@' + SHOP.manager + '</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<div class="contact"><span class="l">' + icon('phone') + '<span><small>Телефон, WhatsApp</small><b class="num">' + SHOP.phone + '</b></span></span><button class="btn btn-soft btn-sm" type="button" data-copy="' + esc(SHOP.phone) + '" aria-label="Скопировать номер">' + icon('copy') + '<span class="t">Копировать</span></button></div>' +
      '<a class="contact" href="' + SHOP.mapUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('pin') + '<span><small>Адрес</small><b>' + esc(SHOP.address) + '</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '</div></div>';
  }
  function socialCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('megaphone') + '</span>Мы в соцсетях</h3><p class="muted">Новинки сначала выходят в Telegram-канале — сайт подхватывает их сам.</p><div class="contacts">' +
      '<a class="contact" href="' + SHOP.channelUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('megaphone') + '<span><small>Канал магазина</small><b>@ONION_SHOP_OFFICIAL</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<a class="contact" href="' + SHOP.reviewsUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('star') + '<span><small>Отзывы и отправки</small><b>@ONION_SHOP_FEEDBACK</b></span></span>' + icon('arrow-up-right') + '</a>' +
      '<a class="contact" href="' + SHOP.tiktokUrl + '" target="_blank" rel="noopener"><span class="l">' + icon('play') + '<span><small>TikTok</small><b>@onion_shop</b></span></span>' + icon('arrow-up-right') + '</a></div></div>';
  }
  function preorderBanner() {
    return '<div class="banner"><span class="ic">' + icon('plane') + '</span><div><h3>Что такое предзаказ</h3><p>Выкупаем товар у поставщика в Китае после вашего заказа, проверяем на складе и отправляем самолётом или фурой. Доставка из Китая оплачивается отдельно по весу.</p></div>' +
      '<a class="btn btn-ghost" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Условия и сроки' + icon('arrow-up-right') + '</a></div>';
  }
  function stepsBlock() {
    var st = [['Выберите товар', 'В наличии — отправим сразу. Предзаказ — выкупим в Китае под вас.'], ['Размер и цвет', 'Отметьте размер, цвет и фото нужного варианта, добавьте в корзину.'],
      ['Анкета и токены', API.enabled ? 'Контакты, способ получения и до 15% суммы токенами.' : 'Контакты и способ получения. Сайт соберёт текст заказа.'],
      ['Заказ у менеджера', API.enabled ? 'Заказ сам уходит менеджеру. Оплата — после подтверждения.' : 'Отправьте текст в Telegram или WhatsApp. Оплата — после подтверждения.']];
    return '<div class="steps">' + st.map(function (s, i) { return '<div class="step"><span class="n">' + String(i + 1).padStart(2, '0') + ' / ЭТАП</span><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div>'; }).join('') + '</div>';
  }
  function tokensBand() {
    if (!API.enabled) return '';
    var u = acct.user;
    return '<div class="sec" id="tok-band"><div class="tokens-band"><div><h2>' + coin('lg') + 'Токены ONION SHOP</h2>' +
      '<div class="perks"><span>' + icon('gift') + '+' + RULES.reward.register + ' за регистрацию</span><span>' + icon('check-circle') + 'задания каждый день</span><span>' + icon('sparkles') + 'рулетка призов</span><span>' + icon('percent') + 'до 15% заказа токенами</span><span>' + icon('users') + '+' + RULES.reward.referrer + ' за друга</span></div></div>' +
      (u ? '<div class="acts"><a class="btn btn-gold" href="#roulette">' + icon('sparkles') + 'Рулетка</a><a class="btn btn-ghost" href="#account">' + coin() + num(u.balance) + ' ' + tokWord(u.balance) + '</a></div>'
        : '<div class="acts"><a class="btn btn-gold" href="#account">' + icon('gift') + 'Забрать ' + RULES.reward.register + ' токенов</a></div>') + '</div></div>';
  }

  // ------------------------------------------------------------ главная
  function renderHome() {
    var stock = PRODUCTS.filter(function (p) { return p.status === 'stock'; }).length, pre = PRODUCTS.length - stock;
    var brands = {}; PRODUCTS.forEach(function (p) { if (p.brand) brands[norm(p.brand)] = 1; });
    var nb = Object.keys(brands).length, cats = categories(PRODUCTS).slice(0, 4);
    var rec = recent.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    var v = $('#v-home');
    v.innerHTML =
      '<div class="hero"><div class="stars"></div><div class="hero-grid"><div>' +
      '<span class="eyebrow">ONION SHOP · с ' + SHOP.since + ' года</span>' +
      '<h1>Одежда, обувь и аксессуары — <em>в наличии и под заказ из Китая</em></h1>' +
      '<p class="lead">Выберите размер и цвет, спишите токены — заказ сам уйдёт менеджеру. Оплата после подтверждения.</p>' +
      '<form class="hero-search" id="hero-search" role="search"><label class="sr" for="hero-q">Поиск по каталогу</label><input id="hero-q" type="search" placeholder="Hollister, футболка, кроссовки…" autocomplete="off"><button class="btn" type="submit">' + icon('search') + 'Найти</button></form>' +
      '<div class="quick"><a href="#stock">В наличии <span class="n">' + stock + '</span></a><a href="#preorder">Предзаказ <span class="n">' + pre + '</span></a>' +
      cats.map(function (c) { return '<a href="#catalog" data-cat="' + c.key + '">' + esc(c.label) + ' <span class="n">' + c.n + '</span></a>'; }).join('') + '</div>' +
      '</div><div class="hero-art" aria-hidden="true"><img src="assets/logo.png" alt=""></div></div></div>' +
      '<div class="stats">' +
      '<a class="stat" href="#stock"><b>' + stock + '</b><span><i class="dot" style="background:var(--ok)"></i>' + plural(stock, 'товар', 'товара', 'товаров') + ' в наличии</span></a>' +
      '<a class="stat" href="#preorder"><b>' + pre + '</b><span><i class="dot" style="background:var(--pre)"></i>по предзаказу</span></a>' +
      '<a class="stat" href="#catalog"><b>' + nb + '</b><span>' + plural(nb, 'бренд', 'бренда', 'брендов') + ' в каталоге</span></a>' +
      '<a class="stat" href="#info"><b>' + ageText() + '</b><span>работаем с марта ' + SHOP.since + '</span></a></div>' +
      tokensBand() +
      '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Новое в канале</span><h2>Последние поступления</h2></div><a class="btn btn-ghost btn-sm" href="#catalog">Весь каталог' + icon('arrow-right') + '</a></div>' + grid(PRODUCTS.slice(0, 8), 'home-grid') + '</div>' +
      (rec.length ? '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Для вас</span><h2>Вы смотрели</h2></div></div><div class="hscroll">' + rec.map(card).join('') + '</div></div>' : '') +
      '<div class="sec"><div class="sec-head"><div><span class="eyebrow">Как заказать</span><h2>Четыре шага до заказа</h2></div></div>' + stepsBlock() + '</div>' +
      '<div class="sec">' + preorderBanner() + '</div>' +
      '<div class="sec info-grid">' + deliveryCard() + paymentCard() + '</div>' +
      '<div class="sec info-grid" style="margin-top:16px">' + contactsCard() + socialCard() + '</div>';
    $('#hero-search', v).addEventListener('submit', function (e) { e.preventDefault(); filter = newFilter(); filter.q = $('#hero-q').value.trim(); go('catalog'); });
    $$('.quick a[data-cat]', v).forEach(function (a) { a.addEventListener('click', function () { filter = newFilter(); filter.cat = a.getAttribute('data-cat'); }); });
  }

  // ------------------------------------------------------------ каталог
  function newFilter() { return { tab: 'all', cat: 'all', brand: 'all', q: '', sort: 'new', price: 'all', sale: false }; }
  var filter = newFilter();
  var PRICE = { lt2: [0, 2000, 'До 2 000 ₽'], mid: [2000, 5000, '2–5 тыс. ₽'], gt5: [5000, 1e9, 'От 5 000 ₽'] };
  function matches(p, f, skip) {
    if (skip !== 'tab' && f.tab !== 'all' && p.status !== f.tab) return false;
    if (skip !== 'cat' && f.cat !== 'all' && p.category !== f.cat) return false;
    if (f.brand !== 'all' && norm(p.brand) !== f.brand) return false;
    if (f.price !== 'all') { var r = PRICE[f.price]; if (p.price < r[0] || p.price >= r[1]) return false; }
    if (f.sale && !p.oldPrice) return false;
    if (f.q) { var hay = norm([p.title, p.subtitle, p.brand, p.categoryLabel, p.colors.join(' '), p.sizes.join(' ')].join(' ')); if (!norm(f.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false; }
    return true;
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
    q.addEventListener('input', function () { filter.q = q.value.trim(); $('#cat-clear').hidden = !q.value; clearTimeout(qt); qt = setTimeout(updateCatalog, 120); });
    $('#cat-clear', v).addEventListener('click', function () { q.value = ''; filter.q = ''; this.hidden = true; q.focus(); updateCatalog(); });
    $('#cat-brand', v).addEventListener('change', function () { filter.brand = this.value; updateCatalog(); });
    $('#cat-sort', v).addEventListener('change', function () { filter.sort = this.value; updateCatalog(); });
    $('#cat-reset', v).addEventListener('click', function () { var t = filter.tab; filter = newFilter(); filter.tab = t; renderCatalog(); });
    updateCatalog();
  }
  function updateCatalog() {
    var f = filter, base = PRODUCTS.filter(function (p) { return matches(p, f, 'tab'); });
    var tabs = [['all', 'Все', base.length], ['stock', 'В наличии', base.filter(function (p) { return p.status === 'stock'; }).length], ['preorder', 'Предзаказ', base.filter(function (p) { return p.status === 'preorder'; }).length]];
    var tEl = $('#cat-tabs');
    tEl.innerHTML = tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (f.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '<span class="n">' + t[2] + '</span></button>'; }).join('');
    $$('button', tEl).forEach(function (b) { b.addEventListener('click', function () { filter.tab = b.getAttribute('data-tab'); silentHash(filter.tab === 'all' ? 'catalog' : filter.tab); updateCatalog(); setNav(location.hash.slice(1)); }); });
    var forCats = PRODUCTS.filter(function (p) { return matches(p, f, 'cat'); }), cats = categories(forCats);
    var cEl = $('#cat-cats');
    cEl.innerHTML = '<button type="button" aria-pressed="' + (f.cat === 'all') + '" data-cat="all">Все категории <span class="n">' + forCats.length + '</span></button>' + cats.map(function (c) { return '<button type="button" aria-pressed="' + (f.cat === c.key) + '" data-cat="' + c.key + '">' + esc(c.label) + ' <span class="n">' + c.n + '</span></button>'; }).join('');
    $$('button', cEl).forEach(function (b) { b.addEventListener('click', function () { filter.cat = b.getAttribute('data-cat'); updateCatalog(); }); });
    var pEl = $('#cat-price');
    pEl.innerHTML = Object.keys(PRICE).map(function (k) { return '<button type="button" aria-pressed="' + (f.price === k) + '" data-price="' + k + '">' + PRICE[k][2] + '</button>'; }).join('') + '<span class="sep"></span><button type="button" aria-pressed="' + f.sale + '" data-sale="1">' + icon('percent') + 'Со скидкой</button>';
    $$('[data-price]', pEl).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-price'); filter.price = filter.price === k ? 'all' : k; updateCatalog(); }); });
    $('[data-sale]', pEl).addEventListener('click', function () { filter.sale = !filter.sale; updateCatalog(); });
    var list = PRODUCTS.filter(function (p) { return matches(p, f); });
    if (f.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
    else if (f.sort === 'exp') list.sort(function (a, b) { return b.price - a.price; });
    else if (f.sort === 'sale') list.sort(function (a, b) { return discount(b) - discount(a) || (+b.id - +a.id); });
    $('#cat-title').textContent = f.tab === 'stock' ? 'В наличии' : f.tab === 'preorder' ? 'Предзаказ из Китая' : 'Все товары';
    $('#cat-sub').textContent = f.tab === 'preorder' ? 'Выкупаем у поставщика после заказа. Доставка из Китая оплачивается отдельно.' : f.tab === 'stock' ? 'Товары уже у нас — можно забрать или отправить сразу.' : 'Одежда, обувь и аксессуары из Telegram-канала магазина.';
    $('#cat-count').textContent = 'Найдено: ' + list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров');
    $('#cat-reset').hidden = !(f.cat !== 'all' || f.brand !== 'all' || f.q || f.price !== 'all' || f.sale);
    $('#cat-grid').innerHTML = list.length ? grid(list) :
      '<div class="empty"><span class="ico">' + icon('search') + '</span><h3>Ничего не нашлось</h3><p>Попробуйте другое слово или сбросьте фильтры. Нужной вещи нет — напишите менеджеру, подберём под заказ.</p><div class="acts" style="justify-content:center"><button class="btn btn-ghost btn-sm" type="button" id="empty-reset">Сбросить фильтры</button><a class="btn btn-sm" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">' + icon('send') + 'Написать менеджеру</a></div></div>';
    var er = $('#empty-reset'); if (er) er.addEventListener('click', function () { filter = newFilter(); silentHash('catalog'); renderCatalog(); setNav('catalog'); });
  }

  // ------------------------------------------------------------ лайтбокс
  function openLightbox(p, start) {
    closeLightbox();
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
    if (v.ids.length >= 3) maybeTask('view3');
  }
  function shareProduct(p) {
    var url = location.href.split('#')[0].split('?')[0] + '#p-' + p.id;
    var done = function () { maybeTask('share'); };
    try {
      if (navigator.share) { navigator.share({ title: p.title, text: p.title + ' — ' + rub(p.price), url: url }).then(done, function () { copyText(url, 'Ссылка на товар скопирована'); done(); }); return; }
    } catch (e) { /* нет Web Share */ }
    copyText(url, 'Ссылка на товар скопирована'); done();
  }
  function renderProduct(id) {
    var p = BY_ID[id], v = $('#v-product');
    if (!p) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('box') + '</span><h3>Товар больше не продаётся</h3><p>Возможно, его уже купили. Посмотрите похожие вещи в каталоге или спросите менеджера.</p><a class="btn" href="#catalog">Открыть каталог</a></div>'; return; }
    pushRecent(p.id); trackViews(p.id);
    var sel = { size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null, photo: null, qty: 1 };
    var many = p.photos.length > 1, d = discount(p);
    var maxTokRub = Math.floor(p.price * RULES.maxShare);
    var measures = p.details.filter(function (r) { return /(груд|плеч|рукав|длин|ширин|обхват|талия|бедр)/i.test(r[0]); });
    var specs = p.details.filter(function (r) { return measures.indexOf(r) < 0; });
    var related = PRODUCTS.filter(function (x) { return x.id !== p.id && x.category === p.category; });
    if (related.length < 4) related = related.concat(PRODUCTS.filter(function (x) { return x.id !== p.id && x.category !== p.category && x.status === p.status; }));
    related = related.slice(0, 4);
    var rec = recent.filter(function (x) { return x !== p.id && BY_ID[x]; }).slice(0, 8).map(function (x) { return BY_ID[x]; });

    v.innerHTML =
      '<nav class="crumbs" aria-label="Навигация"><a href="#catalog">Каталог</a>' + icon('chevron-right') + '<a href="#' + (p.status === 'preorder' ? 'preorder' : 'stock') + '">' + (p.status === 'preorder' ? 'Предзаказ' : 'В наличии') + '</a>' + icon('chevron-right') + '<span>' + esc(p.categoryLabel) + '</span></nav>' +
      '<div class="product">' +
      '<div class="gallery' + (many ? '' : ' single') + '">' +
      (many ? '<div class="thumbs" id="thumbs">' + p.photos.map(function (ph, i) { return '<button type="button" data-i="' + i + '" aria-label="Фото ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '><img src="' + thumb(ph.id) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') +
      '<div class="stage"><div class="slides" id="slides" tabindex="0" aria-label="Фотографии товара. Нажмите, чтобы увеличить">' +
      p.photos.map(function (ph, i) { return '<figure data-i="' + i + '"><img src="' + full(ph.id) + '" alt="' + esc(p.title) + ', фото ' + (i + 1) + '" ' + (i ? 'loading="lazy" ' : '') + 'decoding="async" width="' + ph.w + '" height="' + ph.ht + '"></figure>'; }).join('') + '</div>' +
      (many ? '<button class="nav-b prev" type="button" aria-label="Предыдущее фото">' + icon('chevron-right') + '</button><button class="nav-b next" type="button" aria-label="Следующее фото">' + icon('chevron-right') + '</button><span class="gal-count" id="gal-count">1 / ' + p.photos.length + '</span>' : '') +
      '<button class="zoom" type="button" id="zoom-btn" aria-label="Увеличить фото">' + icon('expand') + '</button>' +
      (many ? '<div class="dots" id="dots">' + p.photos.map(function (x, i) { return '<i' + (i === 0 ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' : '') + '</div></div>' +
      '<div class="info"><div class="card info-card">' +
      '<div class="top">' + badge(p) + (d >= 3 ? '<span class="badge badge-sale">−' + d + '%</span>' : '') + (p.brand ? '<span class="chip">' + esc(p.brand) + '</span>' : '') + '<span class="sp"></span>' +
      '<button class="icon-btn" type="button" id="share-btn" aria-label="Поделиться">' + icon('share') + '</button>' +
      '<button class="icon-btn fav-big" type="button" data-fav="' + esc(p.id) + '" aria-pressed="' + isFav(p.id) + '" aria-label="В избранное">' + icon('heart') + '</button></div>' +
      '<div><h1>' + esc(p.title) + '</h1>' + (p.subtitle ? '<p class="sub">' + esc(cap(p.subtitle)) + '</p>' : '') + '</div>' +
      '<div class="price-box"><div class="price-row"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span><span class="badge badge-sale">выгода ' + rub(p.oldPrice - p.price) + '</span>' : '') + '</div>' +
      (API.enabled ? '<span class="tok-hint">' + coin() + 'Можно оплатить токенами до <b>' + rub(maxTokRub) + '</b> · ' + num(Math.floor(maxTokRub / RULES.tokenRub)) + ' ' + tokWord(Math.floor(maxTokRub / RULES.tokenRub)) + '</span>' : '') + '</div>' +
      (p.status === 'preorder'
        ? '<div class="notice notice-pre">' + icon('plane') + '<div><b>Предзаказ из Китая.</b> Выкупим у поставщика после заказа, проверим на складе и отправим. Доставка из Китая — отдельно по весу. <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Как это работает</a></div></div>'
        : '<div class="notice notice-info">' + icon('box') + '<div><b>В наличии в Москве.</b> Самовывоз, курьер или отправка в другой город через Авито.</div></div>') +
      (p.sizes.length ? '<div class="opt" id="opt-size"><div class="opt-head"><b>Размер' + (p.sizes.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val"><span id="size-val">' + (sel.size ? esc(sel.size) : 'не выбран') + '</span>' + (measures.length ? ' · <button class="link-btn" type="button" id="measure-btn">Замеры</button>' : '') + '</span></div><div class="choices">' +
        p.sizes.map(function (s) { return '<button class="choice" type="button" data-size="' + esc(s) + '" aria-pressed="' + (sel.size === s) + '">' + esc(s) + '</button>'; }).join('') + '</div><span class="msg" hidden>Выберите размер</span></div>' : '') +
      (p.colors.length ? '<div class="opt" id="opt-color"><div class="opt-head"><b>Цвет' + (p.colors.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val" id="color-val">' + (sel.color ? esc(cap(sel.color)) : 'не выбран') + '</span></div><div class="choices">' +
        p.colors.map(function (c) { return '<button class="choice color" type="button" data-color="' + esc(c) + '" aria-pressed="' + (sel.color === c) + '"><i class="sw" style="' + swatch(c) + '"></i>' + esc(cap(c)) + '</button>'; }).join('') + '</div><span class="msg" hidden>Выберите цвет</span></div>' : '') +
      (many && p.colors.length > 1 ? '<div class="opt" id="opt-photo"><div class="opt-head"><b>Вариант по фото <span class="small">· по желанию</span></b><span class="val" id="photo-val">не отмечен</span></div><div class="photo-pick">' +
        p.photos.map(function (ph, i) { return '<button type="button" data-photo="' + ph.id + '" data-i="' + i + '" aria-pressed="false" aria-label="Отметить фото ' + (i + 1) + '"><img src="' + thumb(ph.id) + '" alt="" loading="lazy"><span class="no">' + (i + 1) + '</span></button>'; }).join('') + '</div></div>' : '') +
      '<div class="opt"><label for="p-note"><b style="font-size:14.5px">' + (p.status === 'preorder' ? 'Пожелания к товару' : 'Комментарий') + '</b> <span class="small">· по желанию</span></label><textarea id="p-note" maxlength="300" placeholder="' + (p.status === 'preorder' ? 'Например: посадка oversize, проверить швы, фото бирки' : 'Например: хочу примерить перед покупкой') + '"></textarea></div>' +
      '<div class="buy"><div class="qty" aria-label="Количество"><button type="button" id="q-minus" aria-label="Меньше" disabled>' + icon('minus') + '</button><output id="q-val">1</output><button type="button" id="q-plus" aria-label="Больше">' + icon('plus') + '</button></div>' +
      '<button class="btn" type="button" id="add-btn">' + icon('bag') + '<span id="add-lbl">В корзину · ' + rub(p.price) + '</span></button></div>' +
      '<button class="btn btn-ghost" type="button" id="buy-now">Оформить сразу' + icon('arrow-right') + '</button>' +
      '<div class="acc">' +
      ((specs.length || p.notes.length) ? '<details open><summary>Характеристики' + icon('chevron-down') + '</summary><div class="acc-body">' + (specs.length ? '<dl class="specs">' + specs.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + (p.notes.length ? '<div class="notes">' + p.notes.map(function (n) { return '<span>' + icon('check') + esc(n) + '</span>'; }).join('') + '</div>' : '') + '</div></details>' : '') +
      (measures.length ? '<details' + (specs.length ? '' : ' open') + '><summary>Замеры изделия' + icon('chevron-down') + '</summary><div class="acc-body"><dl class="specs">' + measures.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></div></details>' : '') +
      '<details><summary>Доставка и оплата' + icon('chevron-down') + '</summary><div class="acc-body"><p>' + (p.status === 'preorder' ? 'Из Китая: самолёт — 5–9 дней до Москвы от склада, фура — 18–32 дня по России. По России — СДЭК, Авито или личная встреча.' : 'Самовывоз: ' + esc(SHOP.address) + '. Курьер по Москве или отправка через Авито Доставку.') + '</p><p>Оплата переводом (Сбербанк, Т-Банк, Альфа-Банк, СБП) или наличными при встрече — после подтверждения менеджером.' + (API.enabled ? ' До 15% суммы можно оплатить токенами.' : '') + '</p></div></details>' +
      '</div>' +
      '<a class="tg-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + icon('send') + 'Пост с этим товаром в канале · №' + esc(p.id) + '</a>' +
      '</div></div></div>' +
      (related.length ? '<div class="sec"><div class="sec-head"><h2>Похожие товары</h2><a class="btn btn-ghost btn-sm" href="#catalog">В каталог' + icon('arrow-right') + '</a></div>' + grid(related, 'home-grid') + '</div>' : '') +
      (rec.length ? '<div class="sec"><div class="sec-head"><h2>Вы смотрели</h2></div><div class="hscroll">' + rec.map(card).join('') + '</div></div>' : '');

    // галерея
    var slides = $('#slides', v), thumbs = $('#thumbs', v), count = $('#gal-count', v), dots = $('#dots', v), cur = 0;
    function goTo(i, smooth) { i = Math.max(0, Math.min(p.photos.length - 1, i)); slides.scrollTo({ left: i * slides.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' }); }
    function setCur(i) {
      if (i === cur) return; cur = i;
      if (count) count.textContent = (i + 1) + ' / ' + p.photos.length;
      if (thumbs) $$('button', thumbs).forEach(function (b, j) { b.setAttribute('aria-current', String(j === i)); if (j === i) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
      if (dots) $$('i', dots).forEach(function (d2, j) { d2.classList.toggle('on', j === i); });
    }
    var st;
    slides.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { setCur(Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth))); }, 50); }, { passive: true });
    if (thumbs) $$('button', thumbs).forEach(function (b) { b.addEventListener('click', function () { goTo(+b.getAttribute('data-i')); }); });
    var prev = $('.prev', v), next = $('.next', v);
    if (prev) prev.addEventListener('click', function () { goTo(cur - 1); });
    if (next) next.addEventListener('click', function () { goTo(cur + 1); });
    slides.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(cur + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1); } if (e.key === 'Enter') openLightbox(p, cur); });
    $$('figure', slides).forEach(function (f) { f.addEventListener('click', function () { openLightbox(p, +f.getAttribute('data-i')); }); });
    $('#zoom-btn', v).addEventListener('click', function () { openLightbox(p, cur); });
    $('#share-btn', v).addEventListener('click', function () { shareProduct(p); });
    var mb = $('#measure-btn', v);
    if (mb) mb.addEventListener('click', function () { openModal('<div class="modal-head"><h2>Замеры: ' + esc(p.title) + '</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon('x') + '</button></div><dl class="specs">' + measures.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p class="small">Замеры сделаны по изделию, без растяжения. Сомневаетесь с размером — спросите менеджера.</p>', { cls: 'sm' }); });

    // параметры
    function clearErr(oid) { var o = $('#' + oid); if (o) { o.classList.remove('err'); var m = $('.msg', o); if (m) m.hidden = true; } }
    $$('[data-size]', v).forEach(function (b) { b.addEventListener('click', function () { sel.size = b.getAttribute('data-size'); $$('[data-size]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#size-val').textContent = sel.size; clearErr('opt-size'); }); });
    $$('[data-color]', v).forEach(function (b) { b.addEventListener('click', function () { sel.color = b.getAttribute('data-color'); $$('[data-color]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#color-val').textContent = cap(sel.color); clearErr('opt-color'); }); });
    $$('[data-photo]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        var pid = +b.getAttribute('data-photo'); sel.photo = sel.photo === pid ? null : pid;
        $$('[data-photo]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(+x.getAttribute('data-photo') === sel.photo)); });
        $('#photo-val').textContent = sel.photo ? 'фото №' + (+b.getAttribute('data-i') + 1) : 'не отмечен';
        if (sel.photo) goTo(+b.getAttribute('data-i'));
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
    $('#buy-now', v).addEventListener('click', function () { if (add()) setTimeout(function () { go('cart'); }, REDUCED ? 0 : 500); });

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

  // ------------------------------------------------------------ корзина, анкета, токены
  var form = Object.assign({ name: '', phone: '', tg: '', recv: '', recvCity: '', recvAddr: '', ship: '', city: '', preRecv: '', comment: '' }, store.get('form', {}));
  var ack = null, tokUse = 0, tokPromo = '';
  function saveForm() { store.set('form', form); }
  function optionText(l, p) {
    var o = [];
    if (l.size) o.push('Размер: ' + l.size);
    if (l.color) o.push('Цвет: ' + l.color);
    if (l.photo) { var i = p.photos.findIndex(function (x) { return x.id === l.photo; }); if (i >= 0) o.push('фото №' + (i + 1)); }
    return o.join(' · ');
  }
  function radio(name, value, cur, title, sub) { return '<label class="radio"><input type="radio" name="' + name + '" value="' + value + '"' + (cur === value ? ' checked' : '') + '><span class="mark"></span><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</label>'; }
  function totals(lines) {
    var t = { total: 0, old: 0, cnt: 0, pre: false, stock: false };
    lines.forEach(function (l) { var p = BY_ID[l.id]; t.total += p.price * l.qty; t.old += (p.oldPrice || p.price) * l.qty; t.cnt += l.qty; if (p.status === 'preorder') t.pre = true; else t.stock = true; });
    var u = acct.user;
    t.maxTok = u ? Math.min(u.balance, Math.floor(t.total * RULES.maxShare / RULES.tokenRub)) : 0;
    t.tok = Math.max(0, Math.min(tokUse, t.maxTok));
    t.tokRub = CORE.tokensToRub(t.tok);
    var pr = u && tokPromo ? u.promos.filter(function (x) { return x.code === tokPromo; })[0] : null;
    t.promo = pr ? pr.code : ''; t.promoRub = pr ? Math.round(t.total * pr.pct / 100) : 0;
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
        (gone.length ? '<div class="notice notice-info" style="margin-bottom:16px">' + icon('alert') + '<div>Часть товаров уже продана и убрана из корзины.</div></div>' : '') +
        '<div class="empty"><span class="ico">' + icon('bag') + '</span><h3>Здесь появятся выбранные вещи</h3><p>Откройте каталог, выберите размер и цвет и нажмите «В корзину».</p><div class="acts" style="justify-content:center"><a class="btn" href="#catalog">' + icon('tag') + 'Перейти в каталог</a>' + (favs.length ? '<a class="btn btn-ghost" href="#favorites">' + icon('heart') + 'Избранное</a>' : '') + '</div></div>';
      return;
    }
    var u = acct.user;
    if (u) { // подставляем данные из профиля
      if (!form.name) form.name = u.name; if (!form.phone) form.phone = u.phone; if (!form.tg) form.tg = u.tg;
      if (tokPromo && !u.promos.some(function (x) { return x.code === tokPromo; })) tokPromo = '';
    }
    var t = totals(lines), n = 0;
    v.innerHTML =
      '<div class="stepper" aria-label="Этапы"><span class="on"><i>1</i>Корзина</span><span class="ln"></span><span class="on"><i>2</i>Анкета</span><span class="ln"></span><span><i>3</i>Номер заказа</span></div>' +
      '<div class="view-head"><div><span class="eyebrow">Оформление заказа</span><h1>Корзина и анкета</h1><p class="muted">' + (API.enabled ? 'Заполните анкету — заказ с номером сам уйдёт менеджеру.' : 'Заполните анкету — сайт соберёт текст заказа для менеджера.') + '</p></div></div>' +
      (gone.length ? '<div class="notice notice-info" style="margin-bottom:16px">' + icon('alert') + '<div>Проданные товары убраны из корзины: ' + gone.length + '.</div></div>' : '') +
      '<form class="checkout" id="checkout" novalidate><div style="display:grid;gap:16px;min-width:0">' +
      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Товары · ' + t.cnt + ' шт.</h2><button class="link-btn" type="button" id="cart-clear">Очистить</button></div><div class="lines">' +
      lines.map(function (l, i) {
        var p = BY_ID[l.id], ph = p.photos.find(function (x) { return x.id === l.photo; }) || p.photos[0];
        return '<div class="line" data-k="' + i + '" style="animation-delay:' + (i * 40) + 'ms"><a class="ph" href="#p-' + esc(p.id) + '"><img src="' + thumb(ph.id) + '" alt="" loading="lazy"></a>' +
          '<div style="min-width:0"><a class="t" href="#p-' + esc(p.id) + '">' + esc(p.title) + '</a><div class="meta">' + badge(p) + (optionText(l, p) ? ' &nbsp;' + esc(optionText(l, p)) : '') + '</div>' +
          (l.note ? '<div class="meta">Пожелания: ' + esc(l.note) + '</div>' : '') +
          '<div class="row"><div class="qty sm"><button type="button" data-q="-1" aria-label="Меньше"' + (l.qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button><output>' + l.qty + '</output><button type="button" data-q="1" aria-label="Больше"' + (l.qty >= 10 ? ' disabled' : '') + '>' + icon('plus') + '</button></div><span class="small">' + rub(p.price) + ' за шт.</span></div></div>' +
          '<div class="right"><span class="price">' + rub(p.price * l.qty) + '</span><button class="icon-btn" type="button" data-del aria-label="Убрать из корзины">' + icon('trash') + '</button></div></div>';
      }).join('') + '</div></div>' +

      (API.enabled ? '<div class="card panel tokpanel" id="tokpanel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Токены и промокоды</h2>' + (u ? '<a class="link-btn" href="#account">Кабинет</a>' : '') + '</div>' +
        (u ? '<div class="bal">' + coin('lg') + '<div><b class="num">' + num(u.balance) + '</b> <span class="muted">' + tokWord(u.balance) + ' на балансе · ≈ ' + rub(u.balanceRub) + '</span><p class="small">Можно списать до 15% суммы заказа: максимум ' + num(t.maxTok) + ' ' + tokWord(t.maxTok) + ' = ' + rub(CORE.tokensToRub(t.maxTok)) + '</p></div></div>' +
          (t.maxTok > 0 ? '<div class="tokrow"><span class="tokout">Списать: <b id="tok-n">' + num(t.tok) + '</b> ' + '<span id="tok-w">' + tokWord(t.tok) + '</span> = <b id="tok-rub">−' + rub(t.tokRub) + '</b></span><span class="q"><button type="button" data-tq="0">0</button><button type="button" data-tq="0.5">Половину</button><button type="button" data-tq="1">Максимум</button></span></div>' +
            '<label class="sr" for="tok-range">Сколько токенов списать</label><input class="range" id="tok-range" type="range" min="0" max="' + t.maxTok + '" step="1" value="' + t.tok + '">'
            : '<p class="small">Пока нечего списывать. Отметьтесь в кабинете, выполните задания или крутите рулетку — токены пригодятся в следующем заказе.</p>') +
          (u.promos.length ? '<div class="opt"><b style="font-size:14.5px">Ваши промокоды</b><div class="promos">' + u.promos.map(function (pr) { return '<button type="button" class="ticket" data-promo="' + esc(pr.code) + '" aria-pressed="' + (tokPromo === pr.code) + '"><code>' + esc(pr.code) + '</code><span class="pct">−' + pr.pct + '%</span><span class="small">' + esc(pr.from) + '</span></button>'; }).join('') + '</div></div>' : '')
          : '<div class="guest-box">' + coin('lg') + '<div><b>Войдите — и спишем до 15% суммы токенами</b><p class="small">За регистрацию — ' + RULES.reward.register + ' токенов. Корзина сохранится.</p></div></div><div class="acts"><button class="btn btn-gold btn-sm" type="button" id="go-auth">' + icon('user') + 'Войти или создать аккаунт</button></div>') +
        '</div>' : '') +

      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Контакты</h2>' + (u ? '<span class="small">из профиля</span>' : '') + '</div><div class="fgrid">' +
      '<div class="f" data-f="name"><label for="f-name">Имя</label><input class="input" id="f-name" autocomplete="name" placeholder="Как к вам обращаться" value="' + esc(form.name) + '"><span class="err-msg" hidden></span></div>' +
      '<div class="f" data-f="phone"><label for="f-phone">Телефон</label><input class="input" id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"><span class="err-msg" hidden></span></div>' +
      '<div class="f full" data-f="tg"><label for="f-tg">Username в Telegram</label><div class="prefix"><span>@</span><input class="input" id="f-tg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="username" value="' + esc(form.tg) + '"></div><span class="hint">Менеджер напишет вам сюда. Найти можно в Telegram: Настройки → Имя пользователя.</span><span class="err-msg" hidden></span></div>' +
      '</div></div>' +

      (t.stock ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Получение' + (t.pre ? ' товаров в наличии' : '') + '</h2></div>' +
        '<div class="f" data-f="recv"><span class="lbl sr">Способ получения</span><div class="radios">' +
        radio('recv', 'pickup', form.recv, 'Самовывоз', esc(SHOP.address) + '. Время согласуйте с менеджером.') + radio('recv', 'courier', form.recv, 'Курьер по Москве', 'Яндекс Курьер, по тарифу службы.') + radio('recv', 'city', form.recv, 'Доставка в другой город', 'Оформляем через Авито Доставку.') +
        '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvCity"' + (form.recv === 'city' ? '' : ' hidden') + '><label for="f-recv-city">Город</label><input class="input" id="f-recv-city" autocomplete="address-level2" placeholder="Например, Казань" value="' + esc(form.recvCity) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvAddr"' + (form.recv === 'courier' ? '' : ' hidden') + '><label for="f-recv-addr">Адрес или район <span class="opt-l">· по желанию</span></label><input class="input" id="f-recv-addr" autocomplete="street-address" placeholder="Можно уточнить с менеджером" value="' + esc(form.recvAddr) + '"></div></div>' : '') +

      (t.pre ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Предзаказ из Китая</h2><a class="link-btn" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Условия</a></div>' +
        '<div class="f" data-f="ship"><span class="lbl">Отправка со склада в Китае</span><div class="radios cols">' + radio('ship', 'air', form.ship, 'Самолёт', 'Быстрее: 5–9 дней до Москвы от склада') + radio('ship', 'truck', form.ship, 'Фура', 'Дешевле: 18–32 дня по России от склада') + '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="city"><label for="f-city">Город, куда привезти</label><input class="input" id="f-city" autocomplete="address-level2" placeholder="Например, Москва" value="' + esc(form.city) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="preRecv"><span class="lbl">Способ получения</span><div class="radios cols">' + radio('preRecv', 'avito', form.preRecv, 'Авито Доставка', '') + radio('preRecv', 'cdek', form.preRecv, 'СДЭК', 'До пункта выдачи') + radio('preRecv', 'meet', form.preRecv, 'Личная встреча', 'В Москве') + '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="ack"><div class="ack" id="ack"><div class="q"><span class="checkbox" id="ack-box" role="img" aria-label="Не подтверждено">' + icon('check') + '</span><div><b>Я прочитал(а) условия доставки и оформления заказа по предзаказу</b><p class="small" style="margin-top:4px">Сроки, оплата доставки по весу и что не зависит от магазина — на <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">странице о предзаказе</a>.</p></div></div>' +
        '<div class="ack-opts"><button type="button" class="yes" data-ack="yes" aria-pressed="' + (ack === 'yes') + '">Да, ознакомился(-ась)</button><button type="button" class="no" data-ack="no" aria-pressed="' + (ack === 'no') + '">Нет, ещё не успел(а)</button><button type="button" class="cancel" data-ack="cancel">Отказаться от оформления</button></div>' +
        '<div id="ack-hint"' + (ack === 'no' ? '' : ' hidden') + ' style="font-size:14px">Без подтверждения заказ по предзаказу не оформить. <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener"><b>Открыть условия</b></a> — это пара минут, корзина сохранится.</div></div><span class="err-msg" hidden></span></div></div>' : '') +

      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Комментарий <span class="small" style="font-family:var(--f-body);font-weight:400">· по желанию</span></h2></div><div class="f"><label class="sr" for="f-comment">Комментарий к заказу</label><textarea id="f-comment" maxlength="500" placeholder="Удобное время связи, вопросы по размеру…">' + esc(form.comment) + '</textarea></div></div>' +
      '</div>' +

      '<aside class="sumcard"><h2>Ваш заказ</h2>' +
      '<div class="sumrow"><span>Товаров</span><b>' + t.cnt + ' шт.</b></div>' +
      '<div class="sumrow"><span>Сумма</span><b>' + rub(t.total) + '</b></div>' +
      (t.old > t.total ? '<div class="sumrow good"><span>Скидки на товары</span><b>учтены · −' + rub(t.old - t.total) + '</b></div>' : '') +
      '<div class="sumrow gold" id="sum-tok"' + (t.tok ? '' : ' hidden') + '><span>Токены</span><b>−' + rub(t.tokRub) + '</b></div>' +
      '<div class="sumrow good" id="sum-promo"' + (t.promoRub ? '' : ' hidden') + '><span>Промокод</span><b>−' + rub(t.promoRub) + '</b></div>' +
      '<div class="sumtotal"><span>К оплате</span><b id="sum-pay">' + rub(t.toPay) + '</b></div>' +
      (t.pre ? '<p class="small">Доставка из Китая оплачивается отдельно по весу посылки.</p>' : '') +
      '<button class="btn btn-block" type="submit" id="submit-btn">' + icon('receipt') + '<span>' + (API.enabled ? 'Оформить заказ' : 'Сформировать заказ') + '</span></button>' +
      '<p class="small">Оплаты на сайте нет. Менеджер подтвердит наличие и пришлёт реквизиты.</p></aside></form>';

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

    // токены
    var ga = $('#go-auth', v); if (ga) ga.addEventListener('click', function () { requireAuth('cart'); });
    var range = $('#tok-range', v);
    function updSum() {
      var tt = totals(lines);
      if (range) { range.style.setProperty('--p', (tt.maxTok ? tt.tok / tt.maxTok * 100 : 0) + '%'); $('#tok-n').textContent = num(tt.tok); $('#tok-w').textContent = tokWord(tt.tok); $('#tok-rub').textContent = '−' + rub(tt.tokRub); }
      var st = $('#sum-tok'); st.hidden = !tt.tok; $('b', st).textContent = '−' + rub(tt.tokRub);
      var sp = $('#sum-promo'); sp.hidden = !tt.promoRub; $('b', sp).textContent = '−' + rub(tt.promoRub);
      var pay = $('#sum-pay'); pay.textContent = rub(tt.toPay); bump(pay);
    }
    if (range) {
      range.addEventListener('input', function () { tokUse = +range.value; updSum(); });
      $$('[data-tq]', v).forEach(function (b) { b.addEventListener('click', function () { var tt = totals(lines); tokUse = Math.floor(tt.maxTok * +b.getAttribute('data-tq')); range.value = tokUse; updSum(); }); });
      range.style.setProperty('--p', (t.maxTok ? t.tok / t.maxTok * 100 : 0) + '%');
    }
    $$('[data-promo]', v).forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-promo'); tokPromo = tokPromo === c ? '' : c; $$('[data-promo]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-promo') === tokPromo)); }); updSum(); }); });

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
      ack = val;
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

    $('#checkout', v).addEventListener('submit', function (e) {
      e.preventDefault();
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
    var t = CORE.cleanTg(form.tg); if (!/^[A-Za-z0-9_]{4,32}$/.test(t)) e.push(['tg', t ? 'Username — латиница, цифры и «_», от 4 символов' : 'Укажите username в Telegram']);
    if (hasStock) { if (!form.recv) e.push(['recv', 'Выберите способ получения']); else if (form.recv === 'city' && form.recvCity.trim().length < 2) e.push(['recvCity', 'Укажите город']); }
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
      order.notified = !!opt.notified; order.offline = !!opt.offline;
      localOrders = [order].concat(localOrders.filter(function (o) { return o.no !== order.no; })).slice(0, 50);
      store.set('orders', localOrders);
      cart = []; ack = null; tokUse = 0; tokPromo = ''; saveCart();
      form.comment = ''; saveForm();
      renderCart();
      showReceipt(order, { fresh: true });
      if (!REDUCED) confetti(120);
    };
    if (!API.enabled) { finish(offlineOrder(lines, tt), { offline: true }); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Отправляем…</span>';
    API.call('order', { items: itemsPayload(lines), form: Object.assign({}, form, { ack: ack === 'yes' }), useTokens: tt.tok, promo: tt.promo }).then(function (r) {
      if (r.ok) { if (r.user) setUser(r.user); finish(r.order, { notified: r.notified }); return; }
      btn.disabled = false; btn.innerHTML = icon('receipt') + '<span>Оформить заказ</span>';
      if (r.network) {
        confirmBox({ title: 'Сервер не отвечает', text: 'Можно оформить заказ без токенов: сайт соберёт текст, а вы отправите его менеджеру сами.', actions: [{ label: 'Попробовать ещё', cls: 'btn-ghost' }, { label: 'Оформить без токенов', cls: 'btn', run: function () { finish(offlineOrder(lines, totals(lines)), { offline: true }); } }] });
        return;
      }
      toast(r.error || 'Не получилось оформить заказ', null, 'warn');
    });
  }

  // ------------------------------------------------------------ чек с номером заказа
  function barcode(no) {
    var bars = [], x = 0, s = String(no);
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var b = 0; b < 6; b++) { var w = ((c >> b) & 1) ? 3 : 1.4; if (b % 2 === 0) bars.push('<rect x="' + x.toFixed(1) + '" y="0" width="' + w + '" height="36"/>'); x += w + 1.6; } }
    return '<svg viewBox="0 0 ' + Math.ceil(x) + ' 36" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">' + bars.join('') + '</svg>';
  }
  function receiptHtml(o) {
    var thumbs = (o.items || []).map(function (it) { var id = it.thumb || it.photo; return id ? '<img src="' + thumb(id) + '" alt="" loading="lazy">' : ''; }).join('');
    var status = o.notified ? '<div class="rc-status ok">' + icon('check-circle') + '<span>Заказ уже у менеджера. Он напишет вам в Telegram.</span></div>'
      : '<div class="rc-status todo">' + icon('send') + '<span>Отправьте текст заказа менеджеру — кнопки ниже.</span></div>';
    return '<div class="receipt"><div class="rc-top"><div class="rc-brand"><img src="assets/logo.png" alt="">ONION SHOP<span>' + icon('check') + 'оформлен</span></div>' +
      '<span class="rc-label">Номер заказа</span><div class="rc-no"><b>' + esc(o.no) + '</b><button type="button" data-copy="' + esc(o.no) + '">' + icon('copy') + 'Копировать</button></div><span class="rc-date">' + esc(fmtAt(o.at)) + '</span></div>' +
      '<div class="rc-perf"><i></i><i></i></div>' + (thumbs ? '<div class="rc-thumbs">' + thumbs + '</div>' : '') +
      '<div class="rc-body"><div class="rc-row"><span>Товары · ' + (o.count || 0) + ' шт.</span><b>' + rub(o.total || 0) + '</b></div>' +
      (o.tokens ? '<div class="rc-row gold"><span>Токены · ' + num(o.tokens) + '</span><b>−' + rub(o.tokenRub) + '</b></div>' : '') +
      (o.promoRub ? '<div class="rc-row"><span>Промокод ' + esc(o.promo) + '</span><b>−' + rub(o.promoRub) + '</b></div>' : '') +
      '<div class="rc-row total"><span>К оплате</span><b>' + rub(o.toPay != null ? o.toPay : o.total) + '</b></div></div>' + status +
      '<div class="rc-bars">' + barcode(o.no) + '</div></div>';
  }
  function showReceipt(o, opt) {
    opt = opt || {};
    $('#toasts').innerHTML = '';
    var md = openModal('<div class="modal-head"><h2>' + (opt.fresh ? 'Готово!' : 'Заказ') + '</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon('x') + '</button></div>' +
      receiptHtml(o) +
      '<details class="acc" style="border:0"><summary style="padding:4px 2px">Текст заказа' + icon('chevron-down') + '</summary><pre class="otext">' + esc(o.text) + '</pre></details>' +
      '<div class="send-row"><a class="btn' + (o.notified ? ' btn-ghost' : '') + '" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener" data-send-tg>' + icon('send') + (o.notified ? 'Написать менеджеру' : 'Скопировать и открыть Telegram') + '</a>' +
      '<a class="btn btn-ghost" href="https://wa.me/' + SHOP.whatsapp + '?text=' + encodeURIComponent(o.text) + '" target="_blank" rel="noopener">' + icon('chat') + 'WhatsApp</a></div>' +
      '<button class="btn btn-soft" type="button" data-copy-order>' + icon('copy') + 'Скопировать текст заказа</button>', { cls: 'receipt-modal' });
    $$('[data-send-tg]', md).forEach(function (a) { a.addEventListener('click', function () { if (!o.notified) copyText(o.text, 'Текст скопирован — вставьте его в чат с менеджером'); }); });
    $$('[data-copy-order]', md).forEach(function (b) { b.addEventListener('click', function () { copyText(o.text, 'Текст заказа скопирован'); }); });
  }

  // ------------------------------------------------------------ мои заказы
  function allOrders() {
    var list = [];
    if (acct.user) list = acct.user.orders.map(function (o) { return Object.assign({ server: true, notified: true }, o); });
    localOrders.forEach(function (o) { if (!list.some(function (x) { return x.no === o.no; })) list.push(o); });
    return list;
  }
  function renderOrders() {
    var v = $('#v-orders'), list = allOrders();
    var head = '<div class="view-head"><div><span class="eyebrow">История</span><h1>Мои заказы</h1><p class="muted">' + (acct.user ? 'Заказы аккаунта ' + esc(acct.user.login) + ' и этого устройства.' : 'Хранятся в этом браузере.' + (API.enabled ? ' Войдите, чтобы видеть их на любом устройстве.' : '')) + '</p></div>' + (API.enabled && !acct.user ? '<a class="btn btn-ghost" href="#account">' + icon('user') + 'Войти</a>' : '') + '</div>';
    if (!list.length) { v.innerHTML = head + '<div class="empty"><span class="ico">' + icon('receipt') + '</span><h3>Заказов пока нет</h3><p>Здесь будут номера заказов, размеры, цвета и суммы.</p><a class="btn" href="#catalog">' + icon('tag') + 'Перейти в каталог</a></div>'; return; }
    v.innerHTML = head + '<div class="orders">' + list.map(function (o, i) {
      return '<article class="card order" data-o="' + i + '" style="animation-delay:' + Math.min(i, 8) * 50 + 'ms"><div class="order-top"><div><span class="order-no">№ ' + esc(o.no) + '</span><p class="date">' + esc(fmtAt(o.at)) + ' · ' + (o.count || 0) + ' шт.' + (o.tokens ? ' · ' + num(o.tokens) + ' ' + tokWord(o.tokens) : '') + '</p></div><span class="sum">' + rub(o.toPay != null ? o.toPay : o.total) + '</span></div>' +
        '<div class="order-items">' + (o.items || []).map(function (it) { var id = it.thumb || it.photo; return '<a class="oi" href="#p-' + esc(it.id) + '" title="' + esc(it.title) + '">' + (id ? '<img src="' + thumb(id) + '" alt="' + esc(it.title) + '" loading="lazy">' : '') + (it.qty > 1 ? '<i>×' + it.qty + '</i>' : '') + '</a>'; }).join('') + '</div>' +
        '<div class="acts"><button class="btn btn-sm" type="button" data-open>' + icon('receipt') + 'Чек и текст</button><button class="btn btn-ghost btn-sm" type="button" data-repeat>' + icon('refresh') + 'Повторить</button>' + (o.server ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-remove>' + icon('trash') + 'Удалить</button>') + '</div></article>';
    }).join('') + '</div>';
    $$('.order', v).forEach(function (el) {
      var o = list[+el.getAttribute('data-o')];
      $('[data-open]', el).addEventListener('click', function () { showReceipt(o); });
      $('[data-repeat]', el).addEventListener('click', function () {
        var added = 0, missing = 0;
        (o.items || []).forEach(function (it) { if (BY_ID[it.id]) { addToCart({ id: it.id, size: it.size || null, color: it.color || null, photo: it.photo || null, qty: it.qty, note: '' }); added++; } else missing++; });
        if (added) { toast(missing ? 'Добавлено. Уже проданы: ' + missing : 'Товары снова в корзине'); go('cart'); } else toast('Этих товаров уже нет в продаже', null, 'warn');
      });
      var rm = $('[data-remove]', el);
      if (rm) rm.addEventListener('click', function () { confirmBox({ title: 'Удалить заказ из истории?', text: 'Он пропадёт только с этого устройства.', actions: [{ label: 'Оставить', cls: 'btn-ghost' }, { label: 'Удалить', cls: 'btn-danger', run: function () { localOrders = localOrders.filter(function (x) { return x.no !== o.no; }); store.set('orders', localOrders); renderOrders(); } }] }); });
    });
  }

  // ------------------------------------------------------------ избранное
  function renderFavorites() {
    var v = $('#v-favorites'), list = favs.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    v.innerHTML = '<div class="view-head"><div><span class="eyebrow">Избранное</span><h1>Отложенные вещи</h1><p class="muted">Нажимайте ♡ на товарах, чтобы вернуться к ним позже.</p></div></div>' +
      (list.length ? grid(list) : '<div class="empty"><span class="ico">' + icon('heart') + '</span><h3>Пока пусто</h3><p>Отмечайте понравившиеся вещи сердечком' + (API.enabled ? ' — за первое добавление в день начислим токен' : '') + '.</p><a class="btn" href="#catalog">' + icon('tag') + 'Перейти в каталог</a></div>');
  }

  // ------------------------------------------------------------ кабинет
  var authTab = 'register';
  function renderAccount() {
    var v = $('#v-account');
    if (!API.enabled) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('user') + '</span><h3>Личный кабинет скоро появится</h3><p>Пока заказы хранятся в браузере.</p><a class="btn" href="#orders">Мои заказы</a></div>'; return; }
    if (!acct.ready) { v.innerHTML = '<div class="empty"><span class="ico"><span class="spinner" style="width:24px;height:24px;border-radius:50%;border:3px solid currentColor;border-right-color:transparent;animation:rot .7s linear infinite"></span></span><h3>Загружаем кабинет…</h3></div>'; return; }
    if (!acct.user) return renderAuth(v);
    renderDash(v);
  }
  function renderAuth(v) {
    var ref = store.get('ref', '');
    var R = RULES.reward;
    v.innerHTML = '<div class="view-head"><div><span class="eyebrow">Личный кабинет</span><h1>' + (authTab === 'login' ? 'Вход в аккаунт' : 'Создайте аккаунт') + '</h1></div></div>' +
      '<div class="auth"><div class="card auth-card"><div class="auth-tabs" role="tablist"><button type="button" role="tab" data-t="register" aria-selected="' + (authTab === 'register') + '">Регистрация</button><button type="button" role="tab" data-t="login" aria-selected="' + (authTab === 'login') + '">Вход</button></div>' +
      '<form id="auth-form" novalidate style="display:grid;gap:14px">' +
      (authTab === 'register'
        ? '<div class="fgrid"><div class="f"><label for="a-name">Имя</label><input class="input" id="a-name" autocomplete="name" placeholder="Как к вам обращаться" value="' + esc(form.name) + '"></div>' +
          '<div class="f"><label for="a-login">Логин</label><input class="input" id="a-login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="латиница, от 3 символов"></div>' +
          '<div class="f"><label for="a-phone">Телефон</label><input class="input" id="a-phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"></div>' +
          '<div class="f"><label for="a-tg">Telegram</label><div class="prefix"><span>@</span><input class="input" id="a-tg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="username" value="' + esc(form.tg) + '"></div></div>' +
          '<div class="f full"><label for="a-pass">Пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="new-password" placeholder="не короче 6 символов"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
          '<div class="f full"><label for="a-ref">Код друга <span class="opt-l">· по желанию, +' + R.refFriend + ' токенов</span></label><input class="input" id="a-ref" autocapitalize="characters" spellcheck="false" placeholder="Например, K7Q2MX" value="' + esc(ref) + '"></div></div>'
        : '<div class="f"><label for="a-login">Логин</label><input class="input" id="a-login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="ваш логин"></div>' +
          '<div class="f"><label for="a-pass">Пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="current-password" placeholder="пароль"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
          '<p class="small">Забыли пароль? Напишите менеджеру <a href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">@' + SHOP.manager + '</a> — поможем восстановить доступ.</p>') +
      '<div class="form-err" id="auth-err" hidden></div>' +
      '<button class="btn btn-block" type="submit" id="auth-btn">' + (authTab === 'register' ? icon('gift') + 'Создать аккаунт и получить ' + R.register + ' токенов' : icon('key') + 'Войти') + '</button></form></div>' +
      '<div class="auth-side"><div class="stars"></div><h2>Что даёт аккаунт</h2><ul>' +
      '<li>' + coin('lg') + '<span><b>+' + R.register + ' токенов</b> сразу за регистрацию</span></li>' +
      '<li>' + coin('lg') + '<span>Токенами можно оплатить <b>до 15%</b> заказа · 1 токен = 0,4 ₽</span></li>' +
      '<li>' + coin('lg') + '<span><b>Ежедневные задания</b> и серия входов: +' + R.streak7 + ' за 7 дней подряд</span></li>' +
      '<li>' + coin('lg') + '<span><b>Рулетка</b>: токены, промокоды, рамки, XP к уровню</span></li>' +
      '<li>' + coin('lg') + '<span><b>Уровни</b> от Новичка до Иконы стиля — со скидками на упаковку</span></li>' +
      '<li>' + coin('lg') + '<span><b>+' + R.referrer + ' токенов</b> за каждого приглашённого друга</span></li>' +
      '</ul><p class="small" style="color:var(--night-ink-2)">Пароль хранится в зашифрованном виде. Номера заказов и история — в кабинете на любом устройстве.</p></div></div>';
    $$('[data-t]', v).forEach(function (b) { b.addEventListener('click', function () { authTab = b.getAttribute('data-t'); renderAuth(v); }); });
    $$('[data-eye]', v).forEach(function (b) { b.addEventListener('click', function () { var i = b.previousElementSibling; var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eye-off' : 'eye'); }); });
    $('#auth-form', v).addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#auth-btn', v), err = $('#auth-err', v), val = function (id) { var el = $('#' + id, v); return el ? el.value.trim() : ''; };
      var payload = authTab === 'register' ? { name: val('a-name'), login: val('a-login'), phone: val('a-phone'), tg: val('a-tg'), password: $('#a-pass', v).value, ref: val('a-ref') } : { login: val('a-login'), password: $('#a-pass', v).value };
      err.hidden = true; btn.disabled = true; var old = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>Секунду…';
      API.call(authTab, payload).then(function (r) {
        btn.disabled = false; btn.innerHTML = old;
        if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
        API.setSession(r.session);
        if (authTab === 'register') { store.set('ref', ''); confetti(150); reward('Добро пожаловать! +' + r.welcome + ' ' + tokWord(r.welcome) + (API.mode === 'demo' ? ' (и демо-токены для проверки)' : '')); }
        else toast('С возвращением, ' + r.user.name + '!');
        setUser(r.user);
        var back = returnTo; returnTo = null;
        if (back && back !== 'account') go(back);
      });
    });
  }
  function renderDash(v) {
    var u = acct.user, L = u.level, R = RULES.reward;
    var pct = L.next ? Math.min(100, Math.round((u.xp - L.min) / (L.next.min - L.min) * 100)) : 100;
    var tasks = RULES.tasks.map(function (t) { var done = u.tasksDone.indexOf(t.key) >= 0; var rw = t.reward + (L.index >= 1 ? 1 : 0); return '<div class="task' + (done ? ' done' : '') + '"><span class="ck">' + icon('check') + '</span><span><b>' + esc(t.title) + '</b><small>' + (done ? 'Выполнено сегодня' : esc(t.hint)) + '</small></span><span class="rw">+' + rw + coin() + '</span></div>'; }).join('');
    var inWeek = u.streak ? ((u.streak - 1) % 7) + 1 : 0, streakDays = [];
    for (var i = 1; i <= 7; i++) streakDays.push('<span class="' + (i <= inWeek ? 'on' : '') + (i === 7 ? ' gift' : '') + '" style="animation-delay:' + i * 50 + 'ms">' + (i === 7 ? '+' + R.streak7 : i) + '</span>');
    var refLink = location.href.split('#')[0].split('?')[0] + '?ref=' + u.refCode;
    var since = typeof u.createdAt === 'number' ? fmtAt(u.createdAt).split(',')[0] : String(u.createdAt || '').split(' ')[0];
    v.innerHTML =
      '<div class="dash">' +
      '<div class="profile c12"><div class="stars"></div><span class="ava lg f-' + esc(u.frame) + '">' + esc(initials(u.name)) + '</span><div><span class="lvl-badge">' + icon('crown') + esc(L.name) + '</span><h1 style="margin-top:8px">' + esc(u.name) + '</h1>' +
      '<div class="meta"><span>@' + esc(u.login) + '</span><button type="button" data-copy="' + esc(u.code) + '">ID ' + esc(u.code) + icon('copy') + '</button><span>с нами с ' + esc(since) + '</span></div></div>' +
      '<div class="p-acts acts"><a class="btn btn-gold" href="#roulette">' + icon('sparkles') + 'Рулетка' + (u.freeSpins ? ' · ' + u.freeSpins + ' бесплатн.' : '') + '</a><button class="btn btn-ghost" type="button" id="logout">' + icon('logout') + 'Выйти</button></div></div>' +

      '<div class="card tile bal-tile c4"><h3>' + icon('wallet') + 'Баланс токенов</h3><div class="big">' + coin('lg') + '<span id="bal-num">' + num(u.balance) + '</span></div><p class="small">≈ ' + rub(u.balanceRub) + ' скидки · до 15% заказа</p><div class="acts"><a class="btn btn-sm" href="#cart">' + icon('bag') + 'Потратить</a><a class="btn btn-ghost btn-sm" href="#roulette">Крутить за ' + RULES.spinCost + '</a></div></div>' +
      '<div class="card tile c4"><h3>' + icon('trophy') + 'Уровень за ' + MONTHS_NOM[msk().mo - 1] + '</h3><div class="big" style="font-size:1.6rem">' + esc(L.name) + '</div>' +
      '<div class="progress"><i id="lvl-bar" data-w="' + pct + '%"></i></div><p class="small">' + (L.next ? 'Ещё ' + rub(L.next.left) + ' покупок до уровня «' + esc(L.next.name) + '»' : 'Максимальный уровень в этом месяце') + ' · XP: ' + num(u.xp) + '</p>' +
      '<div class="lvl-track">' + RULES.levels.map(function (l, j) { return '<span class="' + (j <= L.index ? 'on' : '') + '"><i></i>' + esc(l.name.split(' ')[0]) + '</span>'; }).join('') + '</div></div>' +
      '<div class="card tile c4"><h3>' + icon('flame') + 'Серия входов: ' + u.streak + ' ' + plural(u.streak, 'день', 'дня', 'дней') + '</h3><div class="streak">' + streakDays.join('') + '</div>' +
      (u.checkedToday ? '<p class="small">Сегодня отмечено. Заходите завтра — не прерывайте серию.</p>' : '<button class="btn btn-gold btn-sm" type="button" id="checkin-btn">' + icon('gift') + 'Отметиться · +' + (R.checkin + (L.index >= 1 ? 1 : 0)) + '</button>') + '</div>' +

      '<div class="card tile c7"><h3>' + icon('target') + 'Задания на сегодня</h3><div class="tasks">' + tasks + '</div><p class="small">Задания обновляются в 00:00 по Москве.' + (L.index >= 1 ? ' Уровень «' + esc(L.name) + '» даёт +1 токен за каждое.' : '') + '</p></div>' +
      '<div class="card tile c5"><h3>' + icon('star') + 'Бонусы уровня</h3><ul class="perks">' + L.perks.map(function (p) { return '<li>' + icon('check') + esc(p) + '</li>'; }).join('') + '</ul>' + (L.next ? '<p class="small">Следующий уровень «' + esc(L.next.name) + '» откроет: ' + esc(RULES.levels[L.index + 1].perks.join(', ').toLowerCase()) + '.</p>' : '') + '<p class="small">Уровень считается по покупкам за текущий месяц и обнуляется 1-го числа.</p></div>' +

      '<div class="card tile c6"><h3>' + icon('ticket') + 'Промокоды</h3>' + (u.promos.length ? '<div class="promos">' + u.promos.map(function (p) { return '<span class="ticket"><code>' + esc(p.code) + '</code><span class="pct">−' + p.pct + '%</span><span class="small">' + esc(p.from) + '</span></span>'; }).join('') + '</div><p class="small">Выберите промокод в корзине при оформлении. Каждый — на один заказ.</p>' : '<p class="small">Промокоды выпадают в рулетке, а на уровне «Икона стиля» — по 3 каждый месяц.</p>') + '</div>' +
      '<div class="card tile c6"><h3>' + icon('users') + 'Пригласите друзей</h3><p class="small">Друг получает +' + R.refFriend + ' токенов при регистрации по вашему коду, а вы — +' + R.referrer + ' после его первого заказа от ' + rub(RULES.refMinOrder) + '. До ' + RULES.refMaxPerMonth + ' друзей в месяц.</p>' +
      '<div class="ref-box"><code>' + esc(u.refCode) + '</code><button class="btn btn-soft btn-sm" type="button" data-copy="' + esc(refLink) + '">' + icon('link') + 'Ссылка</button><button class="btn btn-soft btn-sm" type="button" data-copy="' + esc(u.refCode) + '">' + icon('copy') + 'Код</button></div><p class="small">Друзей привели: <b>' + u.refCount + '</b></p></div>' +

      '<div class="card tile c12"><div class="sec-head" style="margin:0"><h3>' + icon('receipt') + 'Последние заказы</h3><a class="btn btn-ghost btn-sm" href="#orders">Все заказы</a></div>' +
      (u.orders.length ? '<div class="orders">' + u.orders.slice(0, 3).map(function (o, j) { return '<div class="order" style="padding:0;border:0"><div class="order-top"><div><span class="order-no">№ ' + esc(o.no) + '</span><p class="date">' + esc(fmtAt(o.at)) + ' · ' + o.count + ' шт.</p></div><span class="sum">' + rub(o.toPay) + '</span></div><div class="acts"><button class="btn btn-ghost btn-sm" type="button" data-receipt="' + j + '">' + icon('receipt') + 'Чек</button></div></div>'; }).join('<hr style="border:0;border-top:1px solid var(--line);margin:4px 0">') + '</div>' : '<p class="small">Здесь появятся заказы с номерами. <a href="#catalog">Перейти в каталог</a></p>') + '</div>' +

      '<div class="card tile c6"><h3>' + icon('edit') + 'Профиль</h3><form id="prof-form" class="fgrid" novalidate>' +
      '<div class="f full"><label for="p-name">Имя</label><input class="input" id="p-name" value="' + esc(u.name) + '"></div>' +
      '<div class="f"><label for="p-phone">Телефон</label><input class="input" id="p-phone" type="tel" value="' + esc(u.phone) + '"></div>' +
      '<div class="f"><label for="p-tg">Telegram</label><div class="prefix"><span>@</span><input class="input" id="p-tg" value="' + esc(u.tg) + '"></div></div>' +
      '<div class="f full"><button class="btn btn-ghost btn-sm" type="submit" style="justify-self:start">Сохранить</button></div></form></div>' +
      '<div class="card tile c6"><h3>' + icon('gift') + 'День рождения и рамка</h3>' +
      (u.birthday ? '<p class="small">День рождения: <b>' + esc(u.birthday.split('-').reverse().join('.')) + '</b>. В этот день при входе — +' + R.birthday + ' токенов.</p>'
        : '<div class="f"><label for="p-bday">День рождения <span class="opt-l">· можно указать один раз</span></label><div class="acts"><input class="input" id="p-bday" type="date" style="max-width:220px"><button class="btn btn-ghost btn-sm" type="button" id="bday-btn">Сохранить</button></div><span class="hint">В этот день при входе начислим +' + R.birthday + ' токенов.</span></div>') +
      '<b style="font-size:14px">Рамка аватара</b><div class="frames">' + RULES.frames.map(function (f) { var own = u.frames.indexOf(f.id) >= 0; return '<button type="button" data-frame="' + f.id + '" aria-pressed="' + (u.frame === f.id) + '"' + (own ? '' : ' disabled title="Выпадает в рулетке"') + '><span class="ava f-' + f.id + '">' + esc(initials(u.name)) + '</span>' + esc(f.name) + (own ? '' : ' ' + icon('lock')) + '</button>'; }).join('') + '</div></div>' +
      '</div>';
    requestAnimationFrame(function () { var b = $('#lvl-bar', v); if (b) b.style.width = b.getAttribute('data-w'); });
    $('#logout', v).addEventListener('click', function () { API.call('logout'); API.setSession(''); setUser(null); toast('Вы вышли из аккаунта'); });
    var cb = $('#checkin-btn', v); if (cb) cb.addEventListener('click', function () { doCheckin(cb); });
    $$('[data-receipt]', v).forEach(function (b) { b.addEventListener('click', function () { showReceipt(Object.assign({ notified: true }, u.orders[+b.getAttribute('data-receipt')])); }); });
    $('#prof-form', v).addEventListener('submit', function (e) {
      e.preventDefault();
      API.call('profile', { name: $('#p-name').value, phone: $('#p-phone').value, tg: $('#p-tg').value }).then(function (r) { if (r.ok) { setUser(r.user); toast('Профиль сохранён'); } else toast(r.error, null, 'warn'); });
    });
    var bb = $('#bday-btn', v);
    if (bb) bb.addEventListener('click', function () { var val = $('#p-bday').value; if (!val) { toast('Выберите дату', null, 'warn'); return; } API.call('profile', { birthday: val.slice(5) }).then(function (r) { if (r.ok) { setUser(r.user); toast('Дата сохранена'); } else toast(r.error, null, 'warn'); }); });
    $$('[data-frame]', v).forEach(function (b) { b.addEventListener('click', function () { API.call('profile', { frame: b.getAttribute('data-frame') }).then(function (r) { if (r.ok) { setUser(r.user); toast('Рамка надета'); } else toast(r.error, null, 'warn'); }); }); });
  }

  // ------------------------------------------------------------ рулетка
  var spinning = false, spinHistory = [];
  function tileClass(id) { return { none: 'r-none', t50: 'r-tok', t100: 'r-tok', t200: 'r-big', t500: 'r-big', jackpot: 'r-jack', xp: 'r-xp', frame: 'r-frame', promo: 'r-promo', re1: 'r-re', re2: 'r-re' }[id] || ''; }
  function tileHtml(w) { return '<div class="reel-tile ' + tileClass(w.id) + '"><b>' + esc(w.label) + '</b><small>' + esc(w.sub) + '</small></div>'; }
  function randomTile() { var W = RULES.wheel, tot = 0, r; W.forEach(function (w) { tot += Math.sqrt(w.w); }); r = Math.random() * tot; for (var i = 0; i < W.length; i++) { r -= Math.sqrt(W[i].w); if (r <= 0) return W[i]; } return W[0]; }
  function updateRoulBalance() {
    var u = acct.user, b = $('#roul-bal'); if (!b || !u) return;
    b.innerHTML = coin('lg') + '<span>' + num(u.balance) + ' ' + tokWord(u.balance) + '</span>';
    var fb = $('#spin-free'); if (fb) { fb.hidden = !u.freeSpins; fb.innerHTML = icon('gift') + 'Бесплатно · ' + u.freeSpins; }
    var pb = $('#spin-paid'); if (pb) pb.disabled = spinning || u.balance < RULES.spinCost;
  }
  function renderRoulette() {
    var v = $('#v-roulette');
    if (!API.enabled) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('gift') + '</span><h3>Рулетка скоро появится</h3><a class="btn" href="#catalog">В каталог</a></div>'; return; }
    var u = acct.user, tiles = []; for (var i = 0; i < 14; i++) tiles.push(randomTile());
    v.innerHTML = '<div class="roul"><div class="stars"></div><div class="roul-head"><div><span class="eyebrow" style="color:#7fd3ff">Рулетка ONION SHOP</span><h1>Крутите ленту — забирайте призы</h1></div>' +
      (u ? '<span class="roul-bal" id="roul-bal"></span>' : '<a class="btn btn-gold" href="#account">' + icon('gift') + 'Войти и получить ' + RULES.reward.register + ' токенов</a>') + '</div>' +
      '<div class="reel" id="reel"><div class="reel-pin"></div><div class="reel-strip" id="strip">' + tiles.map(tileHtml).join('') + '</div></div>' +
      '<div class="roul-acts">' + (u ? '<button class="btn btn-gold" type="button" id="spin-paid">' + icon('sparkles') + 'Крутить за ' + RULES.spinCost + ' ' + tokWord(RULES.spinCost) + '</button><button class="btn" type="button" id="spin-free" hidden></button>' : '<button class="btn btn-gold" type="button" id="spin-guest">' + icon('sparkles') + 'Крутить</button>') + '</div>' +
      '<div><p class="small" style="color:var(--night-ink-2);margin-bottom:8px">Шансы выпадения. Результат определяет сервер, поэтому подкрутить его нельзя.</p><div class="chances">' + RULES.wheel.map(function (w) { return '<div><span>' + esc(w.label) + ' <small style="color:var(--night-ink-2)">' + esc(w.sub) + '</small></span><b>' + w.w + '%</b></div>'; }).join('') + '</div></div>' +
      '<div id="spin-hist"></div></div>' +
      '<div class="sec info-grid"><div class="card icard"><h3><span class="ic">' + icon('info') + '</span>Как это работает</h3><ul><li>Прокрут стоит ' + RULES.spinCost + ' токенов. Бесплатные прокруты дают «Перекрут» и уровень «Профи».</li><li>Токены из рулетки сразу на балансе: ими можно оплатить до 15% заказа.</li><li>Промокод из рулетки — скидка 3% на один заказ, выбирается в корзине.</li><li>XP повышают уровень месяца, рамки меняют вид аватара.</li></ul></div>' +
      '<div class="card icard"><h3><span class="ic">' + icon('gift') + '</span>Где взять токены</h3><ul><li>+' + RULES.reward.register + ' за регистрацию</li><li>+' + RULES.reward.checkin + ' за вход каждый день и +' + RULES.reward.streak7 + ' за 7 дней подряд</li><li>Задания дня: товары, избранное, «Поделиться»</li><li>+' + RULES.reward.referrer + ' за друга и +' + RULES.reward.birthday + ' в день рождения</li></ul></div></div>';
    updateRoulBalance();
    var g = $('#spin-guest', v); if (g) g.addEventListener('click', function () { requireAuth('roulette'); });
    var pb = $('#spin-paid', v); if (pb) pb.addEventListener('click', function () { spin(false); });
    var fb = $('#spin-free', v); if (fb) fb.addEventListener('click', function () { spin(true); });
    renderSpinHistory();
  }
  function renderSpinHistory() {
    var h = $('#spin-hist'); if (!h) return;
    h.innerHTML = spinHistory.length ? '<p class="small" style="color:var(--night-ink-2);margin-bottom:8px">Ваши прокруты в этот раз</p><div class="acts">' + spinHistory.slice(0, 10).map(function (p) { return '<span class="chip" style="background:rgba(255,255,255,.06);border-color:var(--night-line);color:var(--night-ink)">' + esc(p.label) + ' ' + esc(p.sub || '') + '</span>'; }).join('') + '</div>' : '';
  }
  function spin(free) {
    if (spinning || !acct.user) return;
    var u = acct.user;
    if (!free && u.balance < RULES.spinCost) { toast('Нужно ' + RULES.spinCost + ' токенов. Выполните задания или отметьтесь в кабинете', null, 'warn'); return; }
    spinning = true;
    $$('#spin-paid,#spin-free').forEach(function (b) { b.disabled = true; });
    API.call('spin', { free: free }).then(function (r) {
      if (!r.ok) { spinning = false; updateRoulBalance(); $$('#spin-paid,#spin-free').forEach(function (b) { b.disabled = false; }); toast(r.error, null, 'warn'); return; }
      // во время прокрута показываем баланс уже со списанием
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
    var visual = p.tokens ? coin('xl spin') : p.frameId ? '<span class="ava lg f-' + esc(p.frameId) + '">' + esc(initials(acct.user && acct.user.name)) + '</span>' : '<span style="font-size:48px">' + (p.id === 'none' ? '🌀' : p.promo || p.code ? '🏷' : p.xp ? '⚡' : p.spins ? '🔁' : '🎁') + '</span>';
    var title = p.id === 'none' ? 'Пусто' : p.tokens ? '+' + num(p.tokens) + ' ' + tokWord(p.tokens) : p.code ? 'Промокод −' + p.pct + '%' : p.xp ? '+' + p.xp + ' XP' : p.spins ? 'Перекрут ×' + p.spins : p.frameName ? 'Рамка «' + p.frameName + '»' : p.label;
    var sub = p.id === 'none' ? 'В этот раз не повезло. Следующий прокрут может принести джекпот.' : p.code ? 'Код ' + p.code + ' уже в кабинете. Выберите его в корзине.' : p.xp ? 'Опыт засчитан в уровень этого месяца.' : p.spins ? 'Бесплатные прокруты добавлены.' : p.frameName ? 'Новая рамка открыта — наденьте её в кабинете.' : p.id === 'jackpot' ? 'Джекпот! Токены уже на балансе.' : 'Токены уже на балансе.';
    var md = openModal('<div class="prize-pop"><div class="burst">' + visual + '</div><span class="eyebrow">' + (win ? 'Ваш приз' : 'Результат') + '</span><h2>' + esc(title) + '</h2><p class="muted">' + esc(sub) + '</p>' +
      '<div class="send-row" style="width:100%">' + (p.spins ? '<button class="btn btn-gold" type="button" id="again-free">' + icon('sparkles') + 'Крутить бесплатно</button>' : '<button class="btn btn-gold" type="button" id="again">' + icon('sparkles') + 'Ещё раз</button>') +
      (p.frameId ? '<button class="btn btn-ghost" type="button" id="wear">Надеть рамку</button>' : '<button class="btn btn-ghost" type="button" data-close>Закрыть</button>') + '</div></div>', { cls: 'sm' });
    if (win && !REDUCED) confetti(p.id === 'jackpot' ? 260 : 110);
    var a = $('#again', md); if (a) a.addEventListener('click', function () { closeModal(); spin(false); });
    var af = $('#again-free', md); if (af) af.addEventListener('click', function () { closeModal(); spin(true); });
    var w = $('#wear', md); if (w) w.addEventListener('click', function () { API.call('profile', { frame: p.frameId }).then(function (r) { if (r.ok) { setUser(r.user); toast('Рамка надета'); } closeModal(); }); });
  }

  // ------------------------------------------------------------ информация
  function renderInfo() {
    $('#v-info').innerHTML = '<div class="view-head"><div><span class="eyebrow">Информация</span><h1>Как заказать, доставка и оплата</h1></div></div>' + stepsBlock() +
      '<div class="sec">' + preorderBanner() + '</div>' +
      (API.enabled ? '<div class="sec info-grid"><div class="card icard"><h3><span class="ic">' + icon('coin') + '</span>Токены</h3><ul><li>1 токен = 0,4 ₽ скидки, до 15% суммы заказа</li><li>+' + RULES.reward.register + ' за регистрацию, +' + RULES.reward.checkin + ' за вход каждый день, +' + RULES.reward.streak7 + ' за 7 дней подряд</li><li>Задания дня, рулетка, +' + RULES.reward.referrer + ' за друга, +' + RULES.reward.birthday + ' в день рождения</li><li>Токены не сгорают и не переводятся другим людям</li></ul><a class="btn btn-ghost btn-sm" href="#account" style="justify-self:start">Мой кабинет</a></div>' +
        '<div class="card icard"><h3><span class="ic">' + icon('trophy') + '</span>Уровни месяца</h3><div style="overflow-x:auto"><table class="lvl-table"><tr><th>Уровень</th><th>Покупки</th><th>Бонус</th></tr>' + RULES.levels.map(function (l) { return '<tr><td><b>' + esc(l.name) + '</b></td><td>от ' + rub(l.min) + '</td><td>' + esc(l.perks.join('; ')) + '</td></tr>'; }).join('') + '</table></div><p class="small">Уровень считается по покупкам за месяц и обнуляется 1-го числа.</p></div></div>' : '') +
      '<div class="sec info-grid">' + deliveryCard() + paymentCard() + contactsCard() +
      '<div class="card icard"><h3><span class="ic">' + icon('shield') + '</span>Перед заказом</h3><ul><li>Наличие и размеры менеджер подтвердит перед оплатой.</li><li>По предзаказу: выкуп у поставщика в течение 12 часов, проверка на брак и фотоотчёт на складе в Китае.</li><li>Доп. фото на складе — 15 ¥ за позицию (тариф логиста).</li><li>Нужной вещи нет в каталоге — напишите менеджеру, подберём под заказ.</li></ul><a class="btn btn-ghost btn-sm" href="' + SHOP.infoUrl + '" target="_blank" rel="noopener" style="justify-self:start">Подробно о предзаказе' + icon('arrow-up-right') + '</a></div></div>';
  }

  // ------------------------------------------------------------ маршруты
  var skipHash = null;
  function silentHash(h) { if (location.hash.slice(1) === h) return; skipHash = h; location.hash = h; }
  function go(h) { if (location.hash.slice(1) === h || (!h && !location.hash)) route(); else location.hash = h; }
  function setNav(h) {
    var key = h === '' ? 'home' : /^p-/.test(h) || h === 'stock' ? 'catalog' : h;
    $$('[data-route]').forEach(function (a) {
      var r = a.getAttribute('data-route'), on = r === key || (r === 'catalog' && key === 'preorder' && a.closest('.tabbar'));
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
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (skipHash !== null && h === skipHash) { skipHash = null; return; }
    skipHash = null;
    closeModal(); closeLightbox(); hideBuybar();
    if (!h || h === 'home') { renderHome(); show('home'); }
    else if (h === 'catalog' || h === 'stock' || h === 'preorder') { filter.tab = h === 'catalog' ? 'all' : h; renderCatalog(); show('catalog'); }
    else if (/^p-\d+$/.test(h)) { renderProduct(h.slice(2)); show('product'); }
    else if (h === 'cart') { renderCart(); show('cart'); }
    else if (h === 'orders') { renderOrders(); show('orders'); }
    else if (h === 'favorites') { renderFavorites(); show('favorites'); }
    else if (h === 'account') { renderAccount(); show('account'); }
    else if (h === 'roulette') { renderRoulette(); show('roulette'); }
    else if (h === 'info') { renderInfo(); show('info'); }
    else { renderHome(); show('home'); }
    setNav(h);
    window.scrollTo(0, 0);
    tickClock();
  }

  // после загрузки аккаунта обновляем только то, что от него зависит (без прокрутки наверх)
  function refreshView() {
    if (current === 'home') { var b = $('#tok-band'); if (b) b.outerHTML = tokensBand(); }
    else if (current === 'account') renderAccount();
    else if (current === 'roulette') renderRoulette();
    else if (current === 'cart') renderCart();
    else if (current === 'orders') renderOrders();
  }

  // ------------------------------------------------------------ тема
  function themeIcon() {
    var a = document.documentElement.getAttribute('data-theme');
    var dark = a === 'dark' || (!a && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var b = $('#theme-btn'); b.innerHTML = icon(dark ? 'sun' : 'moon'); b.setAttribute('aria-label', dark ? 'Светлая тема' : 'Тёмная тема');
    return dark;
  }

  // ------------------------------------------------------------ запуск
  function init() {
    try { var ref = new URLSearchParams(location.search).get('ref'); if (ref) store.set('ref', ref.toUpperCase().slice(0, 12)); } catch (e) { /* */ }
    updateCounts(); updateAcctUI(); startClock(); themeIcon();
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
      var c = e.target.closest('[data-copy]');
      if (c) { e.preventDefault(); copyText(c.getAttribute('data-copy'), 'Скопировано: ' + c.getAttribute('data-copy')); return; }
      var f = e.target.closest('[data-fav]');
      if (f) { e.preventDefault(); toggleFav(f.getAttribute('data-fav'), f); }
    });
    var upd = $('#catalog-updated');
    if (upd && CATALOG.updatedAt) { var t = msk(new Date(CATALOG.updatedAt)); upd.textContent = 'Каталог обновлён ' + String(t.d).padStart(2, '0') + '.' + String(t.mo).padStart(2, '0') + '.' + t.y + ' в ' + t.hh + ':' + t.mm + ' (МСК) из Telegram-канала.'; }
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', function (e) { if (e.key === 'onion.shop.cart') { cart = store.get('cart', []); updateCounts(); if (current === 'cart') renderCart(); } });
    route();
    refreshMe().then(refreshView);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
