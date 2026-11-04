/* ONION SHOP, витрина.
   Каталог: data/catalog.js (обновляется сам из Telegram-канала).
   Аккаунты, ониксы, посылка, промокоды и номера заказов: Google Таблица через assets/api.js
   (в предпросмотре: демо в браузере). Корзина, избранное и недавние, в браузере. */
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
  var CAT_ORDER = ['shoes', 'tees', 'hoodies', 'outerwear', 'shirts', 'pants', 'suits', 'dresses', 'bags', 'headwear', 'accessories', 'jewelry', 'watches', 'perfume', 'underwear', 'other'];
  var CAT_LABELS = { shoes: 'Обувь', tees: 'Футболки и поло', hoodies: 'Худи и свитеры', outerwear: 'Куртки и пуховики', shirts: 'Рубашки', pants: 'Штаны', suits: 'Костюмы и комплекты', dresses: 'Платья и юбки', bags: 'Сумки и рюкзаки', headwear: 'Шапки и кепки', accessories: 'Аксессуары', jewelry: 'Украшения', watches: 'Часы и очки', perfume: 'Парфюм', underwear: 'Бельё и носки', other: 'Другое' };
  var CATALOG = window.ONION_CATALOG || { products: [] };
  var PRODUCTS = (CATALOG.products || []).slice();
  var BY_ID = {};
  /* цвет → фото (номер фото в посте, 1, первое). Источники по старшинству:
     1) data/colors.js: ручная привязка; 2) номера в самом посте: «Цвета: красный (7), голубой (8)».
     Цвета идут в порядке фото. */
  var AUTO_COLOR_PHOTO = false; // false: цвет сам не выбирает фото (клиент отмечает фото вручную). true: вернуть автоподбор.
  var COLOR_PHOTOS = window.ONION_COLOR_PHOTOS || {};
  var PHOTO_V = {};
  function normColor(c) { return String(c || '').trim().toLowerCase().replace(/ё/g, 'е'); }
  var MEASURE_RE = /(груд|плеч|рукав|длин|ширин|обхват|талия|бедр|высота|шаг|стопа|подошв)/i;
  var SIZE_LIKE = /^размер\s+(.+)$/i;
  // замеры по размерам: sizeTable = {S: [[подпись, значение], ...], M: [...]}; старые посты (плоский список) разбираем сами
  function buildSizeTable(p) {
    p.details = p.details || []; p.notes = p.notes || [];
    var rows = p.details.filter(function (r) { return MEASURE_RE.test(r[0]); });
    var sizeNotes = p.notes.map(function (n) { var m = String(n).match(SIZE_LIKE); return m ? m[1].trim() : null; }).filter(Boolean);
    if (!p.sizeTable && rows.length && sizeNotes.length > 1) {
      var chunks = [], cur = null;
      rows.forEach(function (r) { if (!cur || cur.some(function (x) { return x[0] === r[0]; })) { cur = []; chunks.push(cur); } cur.push(r); });
      if (chunks.length === sizeNotes.length) { p.sizeTable = {}; sizeNotes.forEach(function (sz, i) { p.sizeTable[sz] = chunks[i]; }); }
    }
    if (p.sizeTable) { p.details = p.details.filter(function (r) { return !MEASURE_RE.test(r[0]); }); }
    p.notes = p.notes.filter(function (n) { return !SIZE_LIKE.test(String(n)); });
    p.measureRows = p.sizeTable ? [] : rows;
    if (!p.sizeTable) p.details = p.details.filter(function (r) { return !MEASURE_RE.test(r[0]); });
  }
  function indexProduct(p) {
    BY_ID[p.id] = p; buildSizeTable(p);
    if (CAT_LABELS[p.category]) p.categoryLabel = CAT_LABELS[p.category];
    (p.photos || []).forEach(function (ph) { if (ph.hash) PHOTO_V[ph.id] = ph.hash + (ph.q ? 'q' + ph.q : ''); });
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
  }
  PRODUCTS.forEach(indexProduct);
  var LOGO = 'assets/logo.png';
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
  function tokWord(n) { return plural(n, 'оникс', 'оникса', 'ониксов'); }
  // ?v=: отпечаток фото: если фото в посте заменили, браузер не покажет старое из кеша
  function thumb(id) { return 'img/thumb/' + id + '.jpg' + (PHOTO_V[id] ? '?v=' + PHOTO_V[id] : ''); }
  function full(id) { return 'img/full/' + id + '.jpg' + (PHOTO_V[id] ? '?v=' + PHOTO_V[id] : ''); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function initials(name) { var p = String(name || '?').trim().split(/\s+/); return (p[0].charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function pct(w) { var v = w / WHEEL_SUM * 100; return String(v < 0.1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10).replace('.', ',') + '%'; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('onion.shop.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('onion.shop.' + k, JSON.stringify(v)); } catch (e) { /* нет хранилища */ } }
  };
  var SP_POS = [[.66, -.5, 11, 0, 5.2], [-.7, .18, 9, 2.4, 5.8], [.5, .62, 8, 4.1, 5.5], [-.45, -.6, 8, 1.2, 6.2]];
  function emblem(key, size, n) {
    var k = n || 3, h = '<span class="emb lv-' + esc(key) + '" style="width:' + size + 'px;height:' + size + 'px"><span class="sp-ring" aria-hidden="true">';
    for (var i = 0; i < k; i++) { var p = SP_POS[i]; h += '<b style="--x:' + Math.round(p[0] * size) + 'px;--y:' + Math.round(p[1] * size) + 'px;--s:' + Math.max(5, Math.round(p[2] * size / 56)) + 'px;--dl:' + p[3] + 's;--d:' + p[4] + 's' + (i % 3 === 1 ? ';--c:var(--lc)' : '') + '"></b>'; }
    return h + '</span>' + lvlImg(key, size) + '</span>';
  }
  function perkIcon(t) {
    t = t.toLowerCase();
    return /упаковк/.test(t) ? 'box' : /рамк/.test(t) ? 'frame' : /промокод/.test(t) ? 'percent' : /серию|серия/.test(t) ? 'flame' : /посылк/.test(t) ? 'gift' : /рулет|прокрут/.test(t) ? 'wheel' : /внимани|приоритет/.test(t) ? 'bolt' : /задани/.test(t) ? 'list' : /оникс|токен/.test(t) ? 'token' : 'check-circle';
  }
  function perkTiles(list) { return '<div class="perk-grid">' + list.map(function (x) { return '<div class="perk-t"><span class="perk-i">' + icon(perkIcon(x[0])) + '</span><span><b>' + esc(x[0]) + '</b>' + (x[1] ? '<small>' + esc(x[1]) + '</small>' : '') + '</span></div>'; }).join('') + '</div>'; }
  function lvlImg(key, size, cls) { return '<img class="lvl-img' + (cls ? ' ' + cls : '') + '" src="assets/lvl/' + esc(key) + '.svg?v=4" width="' + size + '" height="' + size + '" alt="" decoding="async">'; }
  function lvlByKey(k) { return RULES.levels.filter(function (l) { return l.key === k; })[0] || RULES.levels[0]; }
  function pctTxt(p) { return String(p).replace('.', ','); }
  function perkItems(list) { return list.map(function (x) { return '<li>' + icon('check') + '<span><b>' + esc(x[0]) + '</b>' + (x[1] ? '<small>' + esc(x[1]) + '</small>' : '') + '</span></li>'; }).join(''); }
  function promoLine(p) { var d = p.until ? new Date(+p.until + 3 * 3600000) : null; return (p.cat ? 'только «' + esc(p.catLabel) + '»' : esc(p.from || '')) + (p.exp ? ' · до конца месяца' : d ? ' · до ' + String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') : ''); }
  function ava(u, cls) {
    var f = esc((u && u.frame) || 'base');
    return '<span class="ava f-' + f + (f !== 'base' ? ' fx' : '') + (f === 'lvl-diamond' ? ' an-' + esc((u && u.frameAnim) || 'shine') : '') + (cls ? ' ' + cls : '') + '">' + (u && u.avatar ? '<img src="' + esc(u.avatar) + '" alt="">' : esc(initials(u && u.name))) + '</span>';
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
    if (typeof at === 'number' || /^\d{12,}$/.test(String(at))) { var t = msk(+at); return t.d + ' ' + MONTHS[t.mo - 1] + ' ' + t.y; }
    var m = String(at || '').match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2})/);
    if (m) return (+m[1]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[3];
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
    set('year', t.y);
    $$('[data-open-state]').forEach(function (el) { var s = openState(); el.textContent = s.text; el.className = 'open-state ' + (s.open ? 'on' : 'off'); });
    $$('[data-today-row]').forEach(function (el) { el.classList.toggle('today', +el.getAttribute('data-today-row') === (t.wd === 0 || t.wd === 6 ? 1 : 0)); });
  }
  function startClock() {
    tickClock();
    var t = new Date();
    setTimeout(function () { tickClock(); setInterval(tickClock, 60000); }, (60 - t.getSeconds()) * 1000 - t.getMilliseconds() + 50);
  }

  // ------------------------------------------------------------ цвета
  // цвет по названию: корни слов → реальный оттенок; «светло-/темно-» меняют яркость, «черно-красный», два цвета
  var COLOR_HEX = {
    'бел': '#f7f7f5', 'молочн': '#f3ead8', 'кремов': '#f0e4c4', 'айвори': '#f3ecd6', 'экрю': '#eadfc4', 'слоновой': '#f3ecd6',
    'беж': '#d8c3a0', 'песоч': '#d9c59c', 'бежев': '#d8c3a0', 'кэмел': '#c19a6b', 'камел': '#c19a6b', 'табач': '#9c7a4e',
    'сер': '#9aa3ae', 'графит': '#3b3f46', 'антрацит': '#2c3036', 'асфальт': '#4a5059', 'стальн': '#7f8b99', 'серебр': '#c3c7ce', 'мокр': '#6c7078',
    'черн': '#1b1b1f', 'угольн': '#25262b',
    'синий': '#2a58c9', 'синяя': '#2a58c9', 'синее': '#2a58c9', 'син': '#2a58c9', 'темно-син': '#1b2a57', 'нейви': '#1b2a57', 'индиго': '#2d3b8c', 'кобальт': '#1f4fb0', 'электрик': '#1e63e9', 'васильк': '#5b8def', 'джинс': '#4a6fa5', 'деним': '#4a6fa5',
    'голуб': '#7cc4f2', 'небесн': '#8ccdf5', 'бирюз': '#2fc4c0', 'аквамарин': '#5ad7c8', 'морской': '#2b9bb0', 'лазурн': '#3aa9e6', 'циан': '#27c4de',
    'мятн': '#a8e6cf', 'мят': '#a8e6cf', 'салат': '#9bd04a', 'лайм': '#b6e03c', 'зелен': '#3f9a5a', 'изумруд': '#1f9e6e', 'малахит': '#0f7d5a', 'бутылоч': '#17482f', 'хвойн': '#1f5a3e',
    'болот': '#5f6b3a', 'оливк': '#6b7035', 'хаки': '#78794a', 'армейск': '#5a6140', 'мох': '#6a7a3c', 'фисташ': '#c3d9a0', 'шалфе': '#a3b18a',
    'желт': '#f2c230', 'лимон': '#f7e04a', 'горчич': '#d4a017', 'золот': '#d4af37', 'солнеч': '#f6c23c', 'канар': '#f7e04a',
    'оранж': '#f08a24', 'персик': '#f7b58a', 'абрикос': '#f4b27a', 'морковн': '#e8721c', 'рыж': '#c8641c', 'тыкв': '#e0701a',
    'коралл': '#f27c68', 'лососев': '#f4977f', 'терракот': '#c1653f', 'кирпич': '#a8452c', 'ржав': '#a8522a',
    'красн': '#c8303a', 'алый': '#e0262f', 'алая': '#e0262f', 'томат': '#d93a2a', 'вишн': '#8e1b34', 'бордов': '#6e1a2c', 'винн': '#6e1a2c', 'марсал': '#7a2e3a',
    'роз': '#f2b7c8', 'пудр': '#e8c4c4', 'малин': '#c2185b', 'фукси': '#d6249f', 'неонов-роз': '#ff4fa0', 'лилов': '#c8a2d6',
    'фиолет': '#7b4fc4', 'сирен': '#b79ad8', 'лаванд': '#b7a6e0', 'пурпур': '#8e2f8a', 'баклажан': '#4a2a54', 'слив': '#6a2f5e', 'виолет': '#7b4fc4',
    'коричн': '#7a4b2a', 'шоколад': '#4b2e1e', 'кофе': '#6b4a35', 'капучин': '#b89b82', 'каштан': '#6e3b22', 'орех': '#8a5a36', 'карамел': '#c68642', 'мокко': '#5e4636', 'тауп': '#8b7d70',
    'хром': '#c3c7ce', 'мульти': null,
    'white': '#f7f7f5', 'black': '#1b1b1f', 'grey': '#9aa3ae', 'gray': '#9aa3ae', 'blue': '#2a58c9', 'navy': '#1b2a57', 'red': '#c8303a', 'green': '#3f9a5a', 'pink': '#f2b7c8', 'beige': '#d8c3a0', 'brown': '#7a4b2a', 'yellow': '#f2c230', 'orange': '#f08a24', 'purple': '#7b4fc4', 'cream': '#f0e4c4', 'khaki': '#78794a'
  };
  var COLOR_KEYS = Object.keys(COLOR_HEX).sort(function (a, b) { return b.length - a.length; });
  function mixHex(h, to, k) {
    var a = parseInt(h.slice(1), 16), b = parseInt(to.slice(1), 16), out = 0;
    for (var sh = 16; sh >= 0; sh -= 8) { var x = (a >> sh) & 255, y = (b >> sh) & 255; out |= Math.round(x + (y - x) * k) << sh; }
    return '#' + ('000000' + out.toString(16)).slice(-6);
  }
  function hexFor(w) {
    w = norm(w).replace(/ё/g, 'е').trim(); if (!w) return null;
    var mod = null, m = w.match(/^(светло|темно|ярко|нежно|пастельно|насыщенно|глубок\S*|тускл\S*|пыльн\S*|бледно)[-\s]*(.+)$/);
    if (m) { mod = m[1]; w = m[2]; }
    var m2 = w.match(/^(.+?)\s+(светл\S*|темн\S*|ярк\S*|нежн\S*|пастельн\S*|пыльн\S*|бледн\S*)$/);
    if (m2) { w = m2[1]; mod = ({ светл: 'светло', темн: 'темно', ярк: 'ярко', неж: 'нежно', паст: 'пастельно', пыль: 'пыльно', бледн: 'бледно' })[m2[2].slice(0, 4)] || ({ светл: 'светло' })[m2[2].slice(0, 5)] || 'светло'; }
    var hex = null;
    for (var i = 0; i < COLOR_KEYS.length; i++) { var k = COLOR_KEYS[i]; if (w.indexOf(k) === 0 && COLOR_HEX[k]) { hex = COLOR_HEX[k]; break; } }
    if (!hex) return null;
    if (mod === 'светло' || mod === 'бледно') hex = mixHex(hex, '#ffffff', hex === '#f7f7f5' ? 0 : 0.5);
    else if (mod === 'нежно' || mod === 'пастельно') hex = mixHex(hex, '#ffffff', 0.6);
    else if (mod === 'темно' || /^глубок/.test(mod || '')) hex = mixHex(hex, '#000000', 0.45);
    else if (/^пыльн|^тускл/.test(mod || '')) hex = mixHex(hex, '#9a9a9a', 0.45);
    return hex;
  }
  function swatch(name) {
    var full = norm(name).replace(/ё/g, 'е'), striped = /полоск/.test(full), checked = /клетк/.test(full);
    var n = full.replace(/\s+в\s+(полоску|клетку)/, '').replace(/[()]/g, ' ').trim();
    var parts = n.split(/\s*[-–\/]\s*(?=[а-яa-z])|\s+и\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (/^(темно|светло|ярко|нежно|пастельно|пыльно|бледно)$/.test(parts[0] || '')) parts = [parts.slice(0, 2).join('-')].concat(parts.slice(2));
    var hx = parts.map(hexFor).filter(Boolean);
    if (!hx.length) { var one = hexFor(n); if (one) hx = [one]; }
    if (!hx.length) return 'background:#c9ced6';
    if (hx.length === 1) return 'background:' + hx[0];
    if (striped || checked) return 'background:repeating-linear-gradient(135deg,' + hx[0] + ' 0 4px,' + hx[1] + ' 4px 8px)';
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
  // ранний доступ: первые сутки новинка доступна уровню «Золото» и выше (сервер тоже проверяет)
  function earlyLock(p) { var left = CORE.earlyLeft(p, Date.now()); if (!left) return 0; var u = acct.user; return u && u.level && u.level.index >= RULES.early.level ? 0 : left; }
  function earlyH(ms) { return Math.max(1, Math.ceil(ms / 3600000)); }
  function addToCart(line) {
    var ep = BY_ID[line.id], el = ep ? earlyLock(ep) : 0;
    if (el) { toast('Новинка откроется для всех через ' + earlyH(el) + ' ч. Первые сутки: ранний доступ для уровня «Золото» и выше', null, 'warn'); return false; }
    var key = lineKey(line), ex = cart.find(function (l) { return lineKey(l) === key; });
    if (ex) ex.qty = Math.min(10, ex.qty + line.qty); else cart.push(line);
    saveCart();
    track('cart', line.id);
  }
  function isFav(id) { return favs.indexOf(String(id)) >= 0; }
  var watchT = 0, watchSynced = false;
  function syncWatch() { clearTimeout(watchT); watchT = setTimeout(function () { if (acct.user && API.enabled) API.call('watch', { ids: favs }); }, 1500); }
  function toggleFav(id, btn) {
    id = String(id);
    var on = !isFav(id);
    if (on) favs.unshift(id); else favs = favs.filter(function (x) { return x !== id; });
    store.set('favs', favs); syncWatch();
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
    var dpr = 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var colors = ['#43c9e3', '#1a86c0', '#8fe6f5', '#2f6fe0', '#0f2747', '#ffffff', '#bfe9ff'];
    var P = [], n = Math.min(power || 120, 110);
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
    try { if (u && API.getSession()) store.set('meCache', { s: API.getSession(), u: u }); else store.set('meCache', null); } catch (e) { /* */ }
    if (u && localOrders.length) { localOrders = []; store.set('orders', []); } // старые заказы без входа не должны попадать в новый кабинет
    updateAcctUI();
    showNews(u);
    if (u && u.bdayToday) setTimeout(bdayGift, 700);
    if (u && !watchSynced && favs.length) { watchSynced = true; syncWatch(); }
    achvNews(u);
    if (current === 'account') renderAccount();
    else if (current === 'roulette') updateRoulBalance();
    else if (current === 'cart' && !$('#checkout :focus')) renderCart();
    if (u && location.hash.slice(1) === 'byer' && typeof openByer === 'function') openByer();
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
  /* Тихое обновление профиля: что поменяли в таблице (статус, ониксы, уровень), клиент видит
     в течение минуты и сразу при возвращении на вкладку. Экран не перерисовывается, если ничего
     не изменилось или клиент сейчас что-то вводит. */
  var silentBusy = false, lastMe = '';
  // каталог обновляется сам: раз в 10 минут тихо читаем data/catalog.js и, если появились новые товары, перерисовываем главную и каталог
  var lastCat = Date.now();
  function refreshCatalog() {
    lastCat = Date.now();
    if (!window.fetch || /^(file|blob):/.test(location.protocol) || /demo/.test(location.search)) return;
    fetch('data/catalog.js?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      if (!t) return;
      var m = t.match(/window\.ONION_CATALOG\s*=\s*([\s\S]*?);\s*$/); if (!m) return;
      var data = JSON.parse(m[1]);
      if (!data || !data.products || data.updatedAt === CATALOG.updatedAt || !data.products.length) return;
      CATALOG = data; PRODUCTS = data.products.slice(); BY_ID = {}; PRODUCTS.forEach(indexProduct);
      if (current === 'home') renderHome(); else if (current === 'catalog') updateCatalog();
    }).catch(function () { /* без сети, оставляем как есть */ });
  }
  function silentRefresh() {
    if (silentBusy || !API.enabled || API.mode !== 'live' || !API.getSession() || document.hidden || API.busy()) return;
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
      if (current === 'roulette') updateRoulBalance(); else if (current !== 'byer') refreshView(); // посылку не перерисовываем, вдруг крутится
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
      tab.innerHTML = '<span class="ic">' + ava(u) + '</span><span>Кабинет</span>';
    } else {
      chip.className = 'acct-chip guest';
      chip.innerHTML = icon('user') + '<span>Войти</span>';
      chip.removeAttribute('aria-label');
      tab.innerHTML = '<span class="ic">' + icon('user') + '</span><span>Кабинет</span>';
    }
  }
  function requireAuth(back) { returnTo = back || current; go('account'); toast('Войдите или создайте аккаунт, за регистрацию ' + RULES.reward.register + ' ониксов'); }
  // события для заданий копим и отправляем пачкой раз в несколько секунд (каждое: один раз в день)
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
    if (list.length > 3) setTimeout(function () { reward('Ещё выполнено заданий: ' + (list.length - 3) + ', награды уже начислены'); }, 3 * 900);
  }
  // тихое обновление пользователя после событий: без перерисовки корзины и ввода
  function setUserLite(u) { acct.user = u; updateAcctUI(); if (current === 'account') renderAccount(); showNews(u); }
  // ------------------------------------------------------------ подарок на день рождения
  /* Сцена: закрытая коробка → крышка улетает, изнутри свет → «камера» заглядывает внутрь → награды поднимаются карточками.
     Награды выдаёт сервер (bdayGift) в момент открытия; повторно не выдаются: при обновлении страницы поздравление не появится. */
  var bdayBusy = false;
  function bdayGift() {
    var u = acct.user; if (bdayBusy || !u || !u.bdayToday || $('#gb-ov')) return;
    bdayBusy = true;
    var name = esc(String(u.name || '').trim().split(/\s+/)[0] || '');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function faces(pre, list) { return list.map(function (f) { return '<i class="' + pre + ' ' + pre + '-' + f + '"></i>'; }).join(''); }
    var dust = ''; for (var i = 0; i < 14; i++) dust += '<i style="left:' + (5 + Math.random() * 90) + '%;top:' + (8 + Math.random() * 80) + '%;animation-delay:-' + (Math.random() * 6).toFixed(1) + 's;animation-duration:' + (5 + Math.random() * 5).toFixed(1) + 's"></i>';
    var spark = ''; for (var j = 0; j < 16; j++) spark += '<i style="--a:' + (j * 22.5 + Math.random() * 10) + 'deg;--d:' + (90 + Math.random() * 90) + 'px;animation-delay:' + (Math.random() * .25).toFixed(2) + 's"></i>';
    var ov = document.createElement('div'); ov.id = 'gb-ov'; ov.className = 'gb-ov' + (reduce ? ' gb-rm' : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Подарок на день рождения');
    ov.innerHTML = '<div class="gb-bg"><i class="gb-spot"></i><div class="gb-dust">' + dust + '</div></div>' +
      '<button class="gb-x" type="button" aria-label="Закрыть">' + icon('x') + '</button>' +
      '<div class="gb-head" id="gb-head"><span class="gb-eyebrow">Onion Shop</span><h2>С днём рождения' + (name ? ', ' + name : '') + '!</h2><p>Сегодня мы приготовили для тебя особенный подарок</p></div>' +
      '<div class="gb-scene" id="gb-scene"><div class="gb-cam" id="gb-cam"><div class="gb-float"><div class="gb-box" id="gb-box">' +
        '<div class="gb-body">' + faces('gb-f', ['front', 'back', 'left', 'right', 'bottom']) +
          '<i class="gb-in gb-in-back"></i><i class="gb-in gb-in-left"></i><i class="gb-in gb-in-right"></i><i class="gb-in gb-in-front"></i>' +
          '<div class="gb-floor"><i class="gb-tissue t1"></i><i class="gb-tissue t2"></i><i class="gb-tissue t3"></i>' +
            '<span class="gb-item it1">' + tk('gb-ic') + '</span><span class="gb-item it2">' + rlUse('rl-xp', 40) + '</span><span class="gb-item it3">' + rlUse('rl-ticket', 40) + '</span></div>' +
          '<i class="gb-glow"></i>' +
          '<span class="gb-seal"><img src="' + LOGO + '" alt="" width="64" height="64"></span>' +
        '</div>' +
        '<div class="gb-lid" id="gb-lid">' + faces('gb-l', ['top', 'front', 'back', 'left', 'right']) + '</div>' +
        '<div class="gb-bow" id="gb-bow"><i class="bw-l"></i><i class="bw-r"></i><i class="bw-tl"></i><i class="bw-tr"></i><i class="bw-k"></i></div>' +
      '</div></div></div><i class="gb-shadow"></i><div class="gb-spark" id="gb-spark">' + spark + '</div></div>' +
      '<div class="gb-cta" id="gb-cta"><button class="gb-open" type="button" id="gb-open">Открыть подарок</button><small>или нажмите на коробку</small></div>' +
      '<div class="gb-res" id="gb-res" hidden></div>';
    document.body.appendChild(ov); document.documentElement.classList.add('gb-lock');
    requestAnimationFrame(function () { ov.classList.add('in'); });
    var res = null, failed = null, opened = false, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, reduce ? Math.min(ms, 200) : ms)); }
    function close() { timers.forEach(clearTimeout); ov.classList.remove('in'); setTimeout(function () { ov.remove(); }, 300); document.documentElement.classList.remove('gb-lock'); bdayBusy = false; document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape' && (!opened || res || failed)) close(); }
    document.addEventListener('keydown', onKey);
    $('.gb-x', ov).addEventListener('click', function () { if (!opened || res || failed) close(); });
    function until(ms) { var d = new Date(+ms + 3 * 3600000); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
    function showRes() {
      var box = $('#gb-res', ov);
      if (failed) {
        box.innerHTML = '<div class="gb-card gb-err"><b>Не получилось открыть подарок</b><p>' + esc(failed) + '</p><button class="gb-open" type="button" id="gb-done">Закрыть</button></div>';
      } else {
        var g = {}; (res.gifts || []).forEach(function (x) { g[x.k] = x; });
        box.innerHTML = '<div class="gb-res-h"><span class="gb-eyebrow">Подарок получен</span><h2>Всё уже в кабинете</h2></div><div class="gb-cards">' +
          (g.tok ? '<div class="gb-card c1"><span class="gb-ci">' + tk('gb-ic') + '</span><span class="gb-ct"><small>Ониксы</small><b>+' + num(g.tok.n) + '</b><em>≈ ' + num(g.tok.rub) + ' ₽ скидки на заказы</em></span></div>' : '') +
          (g.xp ? '<div class="gb-card c2"><span class="gb-ci">' + rlUse('rl-xp', 46) + '</span><span class="gb-ct"><small>Опыт</small><b>+' + num(g.xp.n) + ' XP</b><em>Уровень «' + esc(res.user.level.name) + '» до конца месяца</em></span></div>' : '') +
          (g.promo ? '<div class="gb-card c3"><span class="gb-ci">' + rlUse('rl-ticket', 46) + '</span><span class="gb-ct"><small>Промокод −' + String(g.promo.pct).replace('.', ',') + '%</small><b class="gb-code">' + esc(g.promo.code) + '</b><em>Один раз, до ' + until(g.promo.until) + ', можно вместе с ониксами</em></span><button class="gb-copy" type="button" data-copy="' + esc(g.promo.code) + '" aria-label="Скопировать промокод">' + icon('copy') + '</button></div>' : '') +
          '</div><button class="gb-open" type="button" id="gb-done">Забрать подарок</button><a class="gb-link" href="#account" id="gb-acc">Открыть кабинет</a>';
        var cp = $('.gb-copy', box); if (cp) cp.addEventListener('click', function () { copyText(cp.getAttribute('data-copy'), 'Промокод скопирован'); });
        var ac = $('#gb-acc', box); if (ac) ac.addEventListener('click', function () { close(); });
      }
      box.hidden = false; ov.classList.add('done');
      $('#gb-done', box).addEventListener('click', close);
      if (!failed && !reduce) confetti(120);
    }
    function open() {
      if (opened) return; opened = true;
      ov.classList.add('opening');
      API.call('bdayGift').then(function (r) {
        if (!r.ok) { failed = r.error || 'Попробуйте ещё раз позже'; return; }
        res = r; setUser(r.user);
      }).catch(function () { failed = 'Нет связи с сервером. Подарок не пропадёт: откройте его позже сегодня'; });
      later(function () { ov.classList.add('untie'); }, 550);
      later(function () { ov.classList.add('lift'); }, 950);
      later(function () { ov.classList.add('dive'); }, 1900);
      var t0 = Date.now();
      later(function wait() {
        if (res || failed) { ov.classList.add('rise'); later(showRes, 420); return; }
        if (Date.now() - t0 > 15000) { failed = 'Сервер долго не отвечает. Подарок не пропадёт: откройте его позже сегодня'; }
        timers.push(setTimeout(wait, 200));
      }, 3100);
    }
    $('#gb-open', ov).addEventListener('click', open);
    $('#gb-box', ov).addEventListener('click', open);
  }
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
  function badge(p) { return p.status === 'preorder' ? '<span class="badge badge-pre">Предзаказ</span>' : p.status === 'sold' ? '<span class="badge badge-sold">Продано</span>' : p.status === 'out' ? '<span class="badge badge-out">Нет в наличии</span>' : '<span class="badge badge-stock">В наличии</span>'; }
  function inStockTab(p) { return p.status === 'stock' || p.status === 'out' || p.status === 'sold'; }
  function dscChip(p) { var d = discount(p); return p.oldPrice && d >= 1 ? '<span class="dsc">−' + d + '%</span>' : ''; }
  function discount(p) { return p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0; }
  // листание фото прямо в карточке (как на WB): до 5 снимков, точки под фото
  function phTrack(p) {
    var ph = p.photos.slice(0, 5);
    return '<div class="ph-t">' + ph.map(function (x, k) { return '<img' + (k ? '' : ' class="a"') + ' src="' + thumb(x.id) + '" alt="" loading="' + (k ? 'lazy' : 'lazy') + '" decoding="async" draggable="false">'; }).join('') + '</div>';
  }
  function phDots(p) {
    var n = Math.min(5, p.photos.length); if (n < 2) return '';
    var h = ''; for (var k = 0; k < n; k++) h += '<i' + (k ? '' : ' class="on"') + '></i>';
    return '<div class="ph-d" aria-hidden="true">' + h + '</div>';
  }
  (function () {
    function sync(t) {
      var ph = t.parentNode, d = ph && ph.querySelector('.ph-d'); if (!d) return;
      var k = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)), dots = d.children;
      for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('on', j === k);
    }
    document.addEventListener('scroll', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('ph-t')) sync(t); }, true);
    if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      document.addEventListener('mousemove', function (e) {
        var ph = e.target.closest && e.target.closest('.pcard .ph'); if (!ph) return;
        var t = ph.firstElementChild, n = t.children.length; if (n < 2) return;
        var r = ph.getBoundingClientRect(), k = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * n)));
        var x = k * t.clientWidth; if (Math.abs(t.scrollLeft - x) > 2) t.scrollLeft = x;
      }, { passive: true });
    }
  })();
  function earlyTag(p) {
    if (!CORE.earlyLeft(p, Date.now())) return '';
    var lk = earlyLock(p);
    return '<span class="early' + (lk ? ' lk' : '') + '">' + icon(lk ? 'lock' : 'crown') + (lk ? 'Для всех через ' + earlyH(lk) + ' ч' : 'Ранний доступ') + '</span>';
  }
  function card(p, i) {
    var a = p.photos[0], d = discount(p), id = esc(p.id);
    var sw = p.colors.length > 1 ? '<div class="sw-row">' + p.colors.slice(0, 5).map(function (c) { return '<i class="sw" style="' + swatch(c) + '" title="' + esc(c) + '"></i>'; }).join('') + (p.colors.length > 5 ? '<small>+' + (p.colors.length - 5) + '</small>' : '') + '</div>' : '';
    return '<article class="pcard" data-pid="' + id + '" style="--i:' + (i || 0) + '">' +
      '<a class="ph" href="#p-' + id + '" tabindex="-1" aria-hidden="true">' + phTrack(p) +
      '<div class="tags">' + badge(p) + '</div>' + phDots(p) + earlyTag(p) + '</a>' +
      '<button class="fav" type="button" data-fav="' + id + '" aria-pressed="' + isFav(p.id) + '" aria-label="Избранное: ' + esc(p.title) + '">' + icon('heart') + '</button>' +
      '<a class="body" href="#p-' + id + '"><span class="brand-l">' + esc(p.brand || p.categoryLabel) + '</span><span class="t">' + esc(p.title) + '</span>' + sw +
      '<div class="prices"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span>' + dscChip(p) : '') + '</div></a>' +
      (p.status === 'sold' ? '' : '<button class="qcart" type="button" data-quick="' + id + '" aria-label="В корзину: ' + esc(p.title) + '">' + icon('bag') + '</button>') + '</article>';
  }
  function grid(list, cls) { return '<div class="grid' + (cls ? ' ' + cls : '') + '">' + list.map(card).join('') + '</div>'; }
  function countBy(list, fn) { var m = {}; list.forEach(function (p) { var k = fn(p); m[k] = (m[k] || 0) + 1; }); return m; }
  function categories(list) {
    var c = countBy(list, function (p) { return p.category; });
    return CAT_ORDER.filter(function (k) { return k !== 'other' || c.other; }).map(function (k) { return { key: k, label: CAT_LABELS[k], n: c[k] || 0 }; });
  }

  // ------------------------------------------------------------ общие блоки
  function deliveryCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('truck') + '</span>Получение товаров в наличии</h3><ul>' +
      '<li><span><b>Доставка по Москве или в другой город</b> <small>· через Авито Доставку, быстрее всего</small></span></li>' +
      '<li><span><b>Курьер по Москве</b> <small>· не всегда доступен, согласуется с менеджером</small></span></li>' +
      '<li><span><b>Самовывоз</b> <small>· ' + esc(SHOP.address) + '</small></span></li></ul>' +
      '<p class="small">Предзаказ из Китая: фурой до склада, дальше Авито, СДЭК или личная встреча в Москве.</p></div>';
  }
  function paymentCard() {
    return '<div class="card icard"><h3><span class="ic">' + icon('card') + '</span>Оплата</h3><ul><li>Перевод: Сбербанк, Т-Банк, Альфа-Банк, СБП</li><li>Наличными <small>· при встрече в Москве</small></li>' +
      (API.enabled ? '<li>До 12% заказа: ониксы и промокод вместе <small>· 1 оникс = 0,3 ₽</small></li><li>Промокоды <small>· вводятся при оформлении</small></li>' : '') + '</ul><p class="small">На сайте оплаты нет: менеджер подтвердит заказ и пришлёт реквизиты.</p></div>';
  }
  function contactsCard() {
    var s = openState();
    return '<div class="card icard"><h3><span class="ic">' + icon('pin') + '</span>Магазин и связь</h3>' +
      '<span class="open-state ' + (s.open ? 'on' : 'off') + '" data-open-state>' + esc(s.text) + '</span>' +
      '<div class="hours"><div data-today-row="0"><span>Пн-Пт</span><span class="num">08:30-21:00</span></div><div data-today-row="1"><span>Сб-Вс</span><span class="num">10:00-20:00</span></div></div>' +
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
    return '<div class="banner"><span class="ic">' + icon('plane') + '</span><div><h3>Что такое предзаказ</h3><p>Выкупаем товар у поставщика в Китае после вашего заказа, проверяем на складе и отправляем фурой (самолётом: по согласованию с менеджером).  Доставка из Китая уже включена в цену.</p></div>' +
      '<a class="btn btn-ghost" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Условия и сроки' + icon('arrow-up-right') + '</a></div>';
  }
  function stepsBlock() {
    var st = [['Выберите вещь', 'В наличии: отправим сразу. Предзаказ: выкупим в Китае под вас.'], ['Размер и цвет', 'Выберите размер и цвет в карточке товара. Пожелания можно написать в комментарии.'],
      ['Ониксы и промокод', API.enabled ? 'Спишите ониксы и введите промокод: вместе до 12% суммы.' : 'Укажите контакты и способ получения.'],
      ['Номер заказа', 'Заказ сам уходит менеджеру. Статус видно в «Моих заказах».']];
    return '<div class="steps">' + st.map(function (s, i) { return '<div class="step"><span class="n">' + (i + 1) + '</span><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div>'; }).join('') + '</div>';
  }
  function tokensStrip() {
    if (!API.enabled) return '';
    var u = acct.user;
    if (!u) return '<div class="strip" id="tok-strip"><span class="ic">' + tk() + '</span><div><h3>Ониксы ONION SHOP</h3><p class="small">+' + RULES.reward.register + ' за регистрацию, задания каждый день, посылка и бонус за друга. Ониксами и промокодом можно оплатить до 12% заказа.</p></div><div class="acts"><a class="btn btn-sm" href="#account">' + icon('gift') + 'Забрать ' + RULES.reward.register + '</a></div></div>';
    var L = u.level, p = L.next ? Math.min(100, Math.round((u.xp - L.min) / (L.next.min - L.min) * 100)) : 100;
    return '<div class="strip" id="tok-strip"><span class="ic">' + lvlImg(L.key, 44) + '</span><div><h3>' + num(u.balance) + ' ' + tokWord(u.balance) + ' · ' + esc(L.name) + ' · ' + num(u.xp) + ' XP</h3>' +
      '<div class="bar"><i data-w="' + p + '%"></i></div><p class="small" style="margin-top:6px">' + (L.next ? 'Ещё ' + num(L.next.left) + ' XP до «' + esc(L.next.name) + '»' : (L.fixed ? 'Уровень закреплён менеджером' : 'Максимальный уровень месяца')) + '</p></div>' +
      '<div class="acts"><a class="btn btn-sm" href="#games">' + icon('sparkles') + 'Игры</a><a class="btn btn-ghost btn-sm" href="#account">Кабинет</a></div></div>';
  }
  function growBars(root) { requestAnimationFrame(function () { $$('[data-w]', root).forEach(function (b) { b.style.width = b.getAttribute('data-w'); }); }); }

  // ------------------------------------------------------------ главная
  var revealIO = null;
  function reveal(root) {
    return;
    if (!revealIO) revealIO = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }); }, { rootMargin: '0px 0px -6% 0px' });
    $$('.pcard:not(.rv)', root).forEach(function (el, i) { el.classList.add('rv'); el.style.setProperty('--d', (i % 4) * 60 + 'ms'); revealIO.observe(el); });
  }
  var homeTimers = [];
  function stopHomeTimers() { homeTimers.forEach(clearInterval); homeTimers = []; }
  function banner(title, sub, href, picks, cls, chips) {
    if (!picks.length) return '';
    return '<a class="bn ' + (cls || '') + '" href="' + href + '"><div class="bn-pics" style="grid-template-columns:repeat(' + picks.length + ',1fr)">' +
      '<span class="bn-big">' + picks.map(function (p, i) { return '<img class="' + (i ? '' : 'on') + '" src="' + full(p.photos[0].id) + '" alt="" loading="' + (i ? 'lazy' : 'eager') + '" decoding="async">'; }).join('') + '</span>' +
      picks.map(function (p, i) { return '<span class="bn-th' + (i ? '' : ' on') + '"><img src="' + thumb(p.photos[0].id) + '" alt="" loading="lazy" decoding="async"></span>'; }).join('') +
      '</div><div class="bn-txt"><b>' + title + '</b>' + icon('arrow-right') + '</div></a>';
  }
  var DEFAULT_PICKS = ['521', '371', '321', '532'];   // выбор магазина по умолчанию (можно отметить в редакторе)
  function shopPicks() {
    var f = PRODUCTS.filter(function (p) { return p.rec && p.status !== 'sold'; });
    if (f.length) return f;
    return DEFAULT_PICKS.map(function (id) { return BY_ID[id]; }).filter(function (p) { return p && p.status !== 'sold'; });
  }
  function isPick(p) { return shopPicks().indexOf(p) >= 0; }
  function dateRange(d1, d2) {
    var a = msk(Date.now() + d1 * 864e5), b = msk(Date.now() + d2 * 864e5);
    return a.mo === b.mo ? a.d + '-' + b.d + ' ' + MONTHS[b.mo - 1] : a.d + ' ' + MONTHS[a.mo - 1] + ' - ' + b.d + ' ' + MONTHS[b.mo - 1];
  }
  function etaBlock(p) {
    var el = CORE.earlyLeft(p, Date.now());
    if (el) { var lk = earlyLock(p); return '<div class="eta early-n">' + icon(lk ? 'lock' : 'crown') + '<div><b>' + (lk ? 'Ранний доступ: для всех через ' + earlyH(lk) + ' ч' : 'Ранний доступ для вас') + '</b><small>' + (lk ? 'Первые сутки новинку могут купить клиенты уровня «Золото» и выше.' : 'Новинка видна всем, но купить её первые сутки можете только вы и другие клиенты «Золота» и выше.') + '</small></div></div>' + etaBase(p); }
    return etaBase(p);
  }
  function etaBase(p) {
    if (p.status === 'sold') return '';
    if (p.status === 'preorder') return '<div class="eta">' + icon('truck') + '<div><b>Ориентировочно получите: ' + dateRange(24, 47) + '</b><small>Если оплатить сегодня. Выкуп до 12 часов, проверка на складе и фотоотчёт, стоимость доставки из Китая уже включена в стоимость.</small></div></div>';
    if (p.status === 'out') return '<div class="oos"><div class="oos-h"><span class="oos-ic">' + icon('hourglass') + '</span><div><b>Сейчас нет в наличии</b><small>Менеджер уточнит срок поступления' + (API.enabled ? ' и напишет вам, как только товар появится.' : '. Напишите ему: подскажет, когда ждать.') + '</small></div></div>' + (API.enabled ? '<button class="oos-btn" type="button" id="wait-btn"></button>' : '') + '</div>';
    return '<div class="eta">' + icon('truck') + '<div><b>Уже в Москве</b><small>Самовывоз, курьер или Авито Доставка, способ выберете при оформлении.</small></div></div>';
  }
  function howStrip() {
    var st = [['bag', 'Заказ', 'Корзина → менеджер пишет вам'], ['receipt', 'Выкуп до 12 ч', 'Закрепляем вещь за вами'], ['check-circle', 'Проверка', 'Склад в Китае + фотоотчёт'], ['truck', 'Доставка', 'Из Китая включена в стоимость']];
    return '<div class="how"><div class="how-h">Как мы работаем</div><div class="how-s">' + st.map(function (x, i) { return '<div class="how-i"><span class="how-n">' + (i + 1) + '</span><span class="how-ic">' + icon(x[0]) + '</span><b>' + x[1] + '</b><small>' + x[2] + '</small></div>'; }).join('') + '</div><a class="how-l" href="#info">Подробнее об этапах' + icon('arrow-right') + '</a></div>';
  }
  function heroHtml(slides) {
    if (!slides.length) return '';
    return '<section class="hero" aria-label="Рекомендации магазина"><div class="hero-sl">' + slides.map(function (s, i) {
      var p = s.p, d = discount(p);
      return '<a class="hs' + (i ? '' : ' on') + '" href="#p-' + esc(p.id) + '" data-pid="' + esc(p.id) + '"><img src="' + full(p.photos[0].id) + '" alt="" loading="' + (i ? 'lazy' : 'eager') + '" decoding="async">' +
        '<span class="hs-cap"><span class="hs-tag">' + esc(s.tag) + '</span><b>' + esc(p.title) + '</b><span class="hs-pr"><i>' + rub(p.price) + '</i>' + (p.oldPrice ? '<s>' + rub(p.oldPrice) + '</s>' : '') + dscChip(p) + '</span><span class="hs-go">Смотреть' + icon('arrow-right') + '</span></span></a>';
    }).join('') + '</div><div class="hero-dots">' + slides.map(function (s, i) { return '<button type="button" class="' + (i ? '' : 'on') + '" data-hs="' + i + '" aria-label="Слайд ' + (i + 1) + '"></button>'; }).join('') + '</div></section>';
  }
  function startHero(v) {
    var hero = $('.hero', v); if (!hero) return;
    var sl = $$('.hs', hero), dots = $$('[data-hs]', hero), i = 0, hold = false;
    function show(n) { sl[i].classList.remove('on'); dots[i].classList.remove('on'); i = (n + sl.length) % sl.length; sl[i].classList.add('on'); dots[i].classList.add('on'); }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.getAttribute('data-hs')); }); });
    var x0 = null;
    hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; hold = true; }, { passive: true });
    hero.addEventListener('touchend', function (e) { if (x0 != null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); } x0 = null; setTimeout(function () { hold = false; }, 4000); }, { passive: true });
    hero.addEventListener('mouseenter', function () { hold = true; }); hero.addEventListener('mouseleave', function () { hold = false; });
    if (!REDUCED && sl.length > 1) homeTimers.push(setInterval(function () { if (!hold && !document.hidden && current === 'home') show(i + 1); }, 4600));
  }
  function startBanners(v) {
    stopHomeTimers();
    if (REDUCED) return;
    $$('.bn', v).forEach(function (b, k) {
      var imgs = $$('.bn-big img', b), ths = $$('.bn-th', b), chips = $$('.bn-chip', b), i = 0, j = 0;
      function live() { return !document.hidden && current === 'home'; }
      if (imgs.length > 1) homeTimers.push(setInterval(function () {
        if (!live()) return;
        imgs[i].classList.remove('on'); ths[i].classList.remove('on');
        i = (i + 1) % imgs.length; imgs[i].classList.add('on'); ths[i].classList.add('on');
      }, 3800 + k * 900));
      if (chips.length > 1) homeTimers.push(setInterval(function () {
        if (!live()) return;
        chips[j].classList.remove('on'); j = (j + 1) % chips.length; chips[j].classList.add('on');
      }, 3200 + k * 600));
    });
  }
  // плашка-уведомление на главной (как на WB). Текст считается сам; data/promo.json позволяет задать свой
  var PROMO = null;
  function promoHtml() {
    var P = PROMO || {};
    if (P.off) return '';
    var pre = PRODUCTS.filter(function (p) { return p.status === 'preorder'; });
    var mx = 0; pre.forEach(function (p) { mx = Math.max(mx, discount(p)); });
    var title = P.text || '';
    if (!title) return '';
    var until = ''; if (P.until && /^\d{4}-\d{2}-\d{2}/.test(P.until)) {
      var ms = Date.parse(P.until + 'T23:59:59+03:00'); if (ms < Date.now()) return '';
      until = ', до ' + P.until.slice(8, 10) + '.' + P.until.slice(5, 7) + '.';
    }
    return '<a class="promo-strip" href="' + esc(P.link || '#preorder') + '"><span class="pi">' + icon('megaphone') + '</span><span class="pt"><b>' + esc(title) + esc(until) + '</b><small>' + esc(P.sub || 'Самое время оформить заказ') + '</small></span><span class="pa">' + icon('arrow-right') + '</span></a>';
  }
  function loadPromo() {
    try {
      fetch('data/promo.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j) return; PROMO = j; var el = $('#promo-slot'); if (el) el.innerHTML = promoHtml();
      }).catch(function () {});
    } catch (e) {}
  }
  function renderHome() {
    var cats = categories(PRODUCTS).slice(0, 10);
    var rec = recent.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    var stockL = PRODUCTS.filter(function (p) { return p.status === 'stock'; });
    var hot = stockL.slice().sort(function (x, y) { return discount(y) - discount(x); }).filter(function (p) { return discount(p) >= 3; }).slice(0, 5);
    stockL.forEach(function (p) { if (hot.length < 5 && hot.indexOf(p) < 0) hot.push(p); });
    var preL = PRODUCTS.filter(function (p) { return p.status === 'preorder'; }).slice(0, 5);
    var catTile = function (href, label, art, key) {
      return '<a class="ct" href="' + href + '"' + (key ? ' data-cat="' + key + '"' : '') + '><span class="ct-i"><img class="lt" src="assets/cat/' + art + '.svg" alt="" loading="lazy"><img class="dk" src="assets/cat/dark/' + art + '.svg" alt="" loading="lazy"></span><span class="ct-l">' + esc(label) + '</span></a>';
    };
    var tiles = catTile('#stock', 'В наличии', 'stock') + catTile('#preorder', 'Из Китая', 'china');
    categories(PRODUCTS).forEach(function (c) { if (c.key !== 'other') tiles += catTile('#catalog', c.label, c.key, c.key); });
    var picks = shopPicks();
    var slides = [];
    picks.forEach(function (p) { slides.push({ p: p, tag: 'Выбор магазина' }); });
    hot.slice(0, 3).forEach(function (p) { if (picks.indexOf(p) < 0) slides.push({ p: p, tag: 'Выгодное предложение' }); });
    preL.slice(0, 3).forEach(function (p) { if (picks.indexOf(p) < 0) slides.push({ p: p, tag: 'Из Китая' }); });
    var fresh = PRODUCTS.slice(0, 12);
    var seenB = {}, brands = [];
    PRODUCTS.forEach(function (p) { var b = (p.brand || '').trim(), k = norm(b); if (b && !seenB[k]) { seenB[k] = 1; brands.push(b); } });
    brands = brands.slice(0, 14);
    var v = $('#v-home');
    v.innerHTML =
      '<div class="cts">' + tiles + '</div>' +
      '<div id="promo-slot">' + promoHtml() + '</div>' +
      heroHtml(slides) +
      '<div class="bns">' + banner('Выбор магазина', '', '#catalog', picks.slice(0, 5), 'bn-rec') + banner('Лучшие предложения', '', '#stock', hot, 'bn-hot') + banner('Новинки из Китая', '', '#preorder', preL, 'bn-cn') + '</div>' +
      (favs.length ? '<div class="sec"><div class="sec-head"><h2>Избранное</h2><a class="btn btn-ghost btn-sm" href="#favorites">Все · ' + favs.length + '</a></div><div class="hscroll">' + favs.map(function (id) { return BY_ID[id]; }).filter(Boolean).slice(0, 10).map(card).join('') + '</div></div>' : '') +
      (rec.length ? '<div class="sec"><div class="sec-head"><h2>Вы смотрели</h2></div><div class="hscroll">' + rec.map(card).join('') + '</div></div>' : '') +
      '<div class="sec"><div class="sec-head"><h2>Новинки</h2><a class="btn btn-ghost btn-sm" href="#catalog">Весь каталог</a></div>' + grid(fresh, 'home-grid') + '</div>' +
      '<div class="sec"><a class="faq-link" href="#info">Частые вопросы' + icon('arrow-right') + '</a></div>';
    $$('.ct[data-cat]', v).forEach(function (a) { a.addEventListener('click', function () { filter = newFilter(); filter.cat = a.getAttribute('data-cat'); }); });
    startBanners(v); startHero(v); reveal(v); loadPromo();
  }

  // быстрое добавление из карточки: размер/цвет: в окне выбора
  function quickAdd(id) {
    var p = BY_ID[id]; if (!p) return;
    if (p.status === 'sold') { toast('Этот товар уже продан', null, 'warn'); return; }
    var sel = { size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null };
    function put() {
      if (addToCart({ id: p.id, size: sel.size, color: sel.color, photo: (sel.color && p.colorPhoto && p.colorPhoto[sel.color]) || null, qty: 1, note: '' }) === false) return;
      toast('В корзине: ' + p.title, { label: 'Корзина', run: function () { go('cart'); } });
    }
    if (p.sizes.length <= 1 && p.colors.length <= 1) { put(); return; }
    var md = openModal(modalHead(p.title) +
      (p.sizes.length > 1 ? '<div class="opt"><div class="opt-head"><b>Размер</b></div><div class="choices" id="qa-sizes">' + p.sizes.map(function (x) { return '<button class="choice" type="button" data-size="' + esc(x) + '" aria-pressed="false">' + esc(x) + '</button>'; }).join('') + '</div></div>' : '') +
      (p.colors.length > 1 ? '<div class="opt"><div class="opt-head"><b>Цвет</b></div><div class="choices" id="qa-colors">' + p.colors.map(function (c) { return '<button class="choice color" type="button" data-color="' + esc(c) + '" aria-pressed="false"><i class="sw" style="' + swatch(c) + '"></i>' + esc(cap(c)) + '</button>'; }).join('') + '</div></div>' : '') +
      '<span class="msg err-msg" id="qa-msg" hidden></span><button class="btn btn-block" type="button" id="qa-go">' + icon('bag') + 'В корзину · ' + rub(p.price) + '</button>', { cls: 'sm' });
    function pick(sel1, attr, key) { $$(sel1 + ' [' + attr + ']', md).forEach(function (b) { b.addEventListener('click', function () { sel[key] = b.getAttribute(attr); $$(sel1 + ' [' + attr + ']', md).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#qa-msg', md).hidden = true; }); }); }
    pick('#qa-sizes', 'data-size', 'size'); pick('#qa-colors', 'data-color', 'color');
    $('#qa-go', md).addEventListener('click', function () {
      if (p.sizes.length > 1 && !sel.size) { var m = $('#qa-msg', md); m.textContent = 'Выберите размер'; m.hidden = false; return; }
      if (p.colors.length > 1 && !sel.color) { var m2 = $('#qa-msg', md); m2.textContent = 'Выберите цвет'; m2.hidden = false; return; }
      closeModal(); put();
    });
  }

  // ------------------------------------------------------------ каталог
  function newFilter() { return { tab: 'all', cat: 'all', brand: 'all', q: '', sort: 'new', price: 'all', sale: false }; }
  var filter = newFilter();
  var PRICE = { lt2: [0, 2000, 'До 2 000 ₽'], mid: [2000, 5000, '2-5 тыс. ₽'], gt5: [5000, 1e9, 'От 5 000 ₽'] };
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
  // поиск «по смыслу»: слово из запроса подтягивает всю категорию (майка → футболки и поло, пуховик → куртки)
  var SYN = {
    tees: ['майк', 'футбол', 'поло', 'тишк', 'тенниск', 'топ'], outerwear: ['пуховик', 'куртк', 'ветровк', 'парк', 'бомбер', 'пальто', 'жилет', 'дутик'],
    hoodies: ['худи', 'толстовк', 'свитер', 'свитшот', 'кофт', 'кардиган', 'джемпер', 'пуловер', 'лонгслив', 'флис', 'зип'],
    shoes: ['кросс', 'кед', 'ботинк', 'туфл', 'обув', 'лофер', 'мокасин', 'сандал', 'сланц', 'сапог', 'башмак'],
    pants: ['штан', 'брюк', 'джинс', 'шорт', 'джоггер', 'леггинс'], shirts: ['рубашк', 'сорочк'], suits: ['костюм', 'комплект'], dresses: ['платье', 'платья', 'юбк', 'сарафан'],
    bags: ['сумк', 'рюкзак', 'шопер', 'клатч', 'портфел', 'барсетк'], headwear: ['кепк', 'шапк', 'панам', 'шляп', 'бейсболк', 'бини'],
    jewelry: ['цепь', 'цепочк', 'браслет', 'кольц', 'серьг', 'кулон', 'украшен'], watches: ['часы', 'часов', 'очки', 'очков'],
    perfume: ['духи', 'парфюм', 'одеколон', 'аромат'], underwear: ['носк', 'бель', 'трус', 'боксер'], accessories: ['галстук', 'ремен', 'ремн', 'кошел', 'шарф', 'перчатк', 'платок', 'аксессуар']
  };
  function synCat(w) {
    if (w.length < 3) return '';
    for (var k in SYN) { for (var i = 0; i < SYN[k].length; i++) { var s = SYN[k][i]; if (w.indexOf(s) === 0 || (w.length >= 4 && s.indexOf(w) === 0)) return k; } }
    return '';
  }
  function qMatch(p, q, mode) {
    var t = norm(q); if (mode === 2) t = swapLayout(t);
    return t.split(/\s+/).filter(Boolean).every(function (w) { return tokOk(w, p, mode > 0) || synCat(w) === p.category; });
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
      '<div class="view-head"><div><h1 id="cat-title">Все товары</h1><p class="muted" id="cat-sub" hidden></p></div></div>' +
      '<div class="tabs" role="tablist" aria-label="Наличие" id="cat-tabs"></div>' +
      '<div id="cat-qchip"></div>' +
      '<div class="cats" id="cat-cats" aria-label="Категории"></div>' +
      '<div class="filters">' +
      '<label class="sr" for="cat-brand">Бренд</label><select class="select" id="cat-brand"><option value="all">Все бренды</option>' + bkeys.map(function (k) { return '<option value="' + esc(k) + '"' + (filter.brand === k ? ' selected' : '') + '>' + esc(brands[k]) + '</option>'; }).join('') + '</select>' +
      '<label class="sr" for="cat-sort">Сортировка</label><select class="select" id="cat-sort"><option value="new">Сначала новые</option><option value="cheap">Сначала дешевле</option><option value="exp">Сначала дороже</option><option value="sale">Самые большие скидки</option></select></div>' +
      '<div class="cats cats-price" id="cat-price" aria-label="Цена"></div>' +
      '<div class="result-line"><span id="cat-count"></span><button class="link-btn" type="button" id="cat-reset" hidden>Сбросить фильтры</button></div><div id="cat-grid"></div>';
    $('#cat-sort', v).value = filter.sort;
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
    var tile = function (key, label, n, art) { return '<button type="button" class="ctile' + (n ? '' : ' empty') + '" aria-pressed="' + (f.cat === key) + '" data-cat="' + key + '"><span class="ctile-i">' + (art ? '<img class="lt" src="assets/cat/' + art + '.svg" alt="" loading="lazy"><img class="dk" src="assets/cat/dark/' + art + '.svg" alt="" loading="lazy">' : '<span class="ctile-all">' + icon('grid') + '</span>') + '</span><span class="ctile-l">' + esc(label) + '</span><span class="ctile-n">' + n + '</span></button>'; };
    cEl.className = 'cat-rail';
    cEl.innerHTML = tile('all', 'Все', forCats.length, '') +  cats.map(function (c) { return tile(c.key, c.label, c.n, c.key === 'other' ? 'stock' : c.key); }).join('');
    var qEl = $('#cat-qchip');
    qEl.innerHTML = f.q ? '<div class="qchip">' + icon('search') + '<span>Ищем: <b>' + esc(f.q) + '</b></span><button type="button" id="qchip-x" aria-label="Сбросить поиск">' + icon('x') + '</button></div>' : '';
    var qx = $('#qchip-x'); if (qx) qx.addEventListener('click', function () { filter.q = ''; var hq = $('#hdr-q'); if (hq) hq.value = ''; updateCatalog(); });
    $$('button[data-cat]', cEl).forEach(function (b) { b.addEventListener('click', function () { filter.cat = b.getAttribute('data-cat'); updateCatalog(); }); });
    var pEl = $('#cat-price');
    pEl.innerHTML = Object.keys(PRICE).map(function (k) { return '<button type="button" aria-pressed="' + (f.price === k) + '" data-price="' + k + '">' + PRICE[k][2] + '</button>'; }).join('') + '<span class="sep"></span><button type="button" aria-pressed="' + f.sale + '" data-sale="1">' + icon('percent') + 'Со скидкой</button>';
    $$('[data-price]', pEl).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-price'); filter.price = filter.price === k ? 'all' : k; if (filter.price !== 'all') track('price'); updateCatalog(); }); });
    $('[data-sale]', pEl).addEventListener('click', function () { filter.sale = !filter.sale; updateCatalog(); });
    var list = PRODUCTS.filter(function (p) { return matches(p, f); });
    if (f.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
    else if (f.sort === 'exp') list.sort(function (a, b) { return b.price - a.price; });
    else if (f.sort === 'sale') list.sort(function (a, b) { return discount(b) - discount(a) || (+b.id - +a.id); });
    var rk = function (p) { return p.status === 'sold' ? 2 : p.status === 'out' ? 1 : 0; };
    list.sort(function (a, b) { return rk(a) - rk(b); });
    $('#cat-title').textContent = f.tab === 'stock' ? 'В наличии' : f.tab === 'preorder' ? 'Предзаказ из Китая' : 'Все товары';
    $('#cat-count').textContent = 'Найдено: ' + list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров');
    $('#cat-reset').hidden = !(f.cat !== 'all' || f.brand !== 'all' || f.q || f.price !== 'all' || f.sale);
    var fzNote = f._fz === 1 ? '<div class="notice notice-info fz-note">' + icon('search') + '<div>Точных совпадений нет: показали похожие на «' + esc(f.q) + '».</div></div>' : f._fz === 2 ? '<div class="notice notice-info fz-note">' + icon('search') + '<div>Исправили раскладку: искали «' + esc(swapLayout(norm(f.q))) + '».</div></div>' : '';
    var dym = f.q && !f._fz ? didYouMean(f.q) : '';
    var soon = f.cat !== 'all' && !f.q && !PRODUCTS.some(function (p) { return p.category === f.cat; });
    $('#cat-grid').innerHTML = list.length ? fzNote + grid(list) :
      '<div class="empty"><span class="ico">' + icon('search') + '</span><h3>' + (soon ? 'Скоро появится' : 'Ничего не нашлось') + '</h3>' + (soon ? '<p>В категории «' + esc(CAT_LABELS[f.cat] || '') + '» пока пусто. Новинки выходят в канале, или напишите менеджеру, привезём под заказ.</p>' : '') + (dym ? '<p>Возможно, вы искали <button class="link-btn" type="button" id="dym-btn">' + esc(dym) + '</button></p>' : '') + '' + (soon ? '' : '<p>Попробуйте другое слово или сбросьте фильтры. Нужной вещи нет: напишите менеджеру, подберём под заказ.</p>') + '<div class="acts" style="justify-content:center"><button class="btn btn-ghost btn-sm" type="button" id="empty-reset">Сбросить фильтры</button><a class="btn btn-sm" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">' + icon('send') + 'Написать менеджеру</a></div></div>';
    reveal($('#cat-grid'));
    var dy = $('#dym-btn'); if (dy) dy.addEventListener('click', function () { filter.q = dym; var hq = $('#hdr-q'); if (hq) hq.value = dym; updateCatalog(); });
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
      if (navigator.share) { navigator.share({ title: p.title, text: p.title + ': ' + rub(p.price), url: url }).then(done, function () { /* отменили */ }); return; }
    } catch (e) { /* нет Web Share */ }
    copyText(url, 'Ссылка на товар скопирована'); done();
  }
  // цвет → фото: если фото не меньше, чем цветов, i-й цвет показан на i-м фото
  var MLAB = { 'грудь': 'Обхват груди', 'обхват груди': 'Обхват груди', 'ширина груди': 'Обхват груди', 'плечи': 'Ширина плеч', 'ширина плеч': 'Ширина плеч', 'плечо': 'Ширина плеч', 'рукав': 'Длина рукава', 'длина рукава': 'Длина рукава', 'длина': 'Длина изделия', 'длина изделия': 'Длина изделия', 'талия': 'Обхват талии', 'обхват талии': 'Обхват талии', 'бедра': 'Обхват бедер', 'обхват бедер': 'Обхват бедер', 'шаг': 'Длина шага', 'длина шага': 'Длина шага' };
  function mlab(l) { var k = String(l || '').trim().toLowerCase(); return MLAB[k] || cap(k); }
  function measTable(tbl, selSize) {
    var sizes = Object.keys(tbl), labels = [];
    sizes.forEach(function (z) { tbl[z].forEach(function (r) { if (labels.indexOf(mlab(r[0])) < 0) labels.push(mlab(r[0])); }); });
    return '<div class="mtbl-wrap"><table class="mtbl"><thead><tr><th></th>' + sizes.map(function (z) { return '<th data-mz="' + esc(z) + '"' + (z === selSize ? ' class="on"' : '') + '>' + esc(z) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      labels.map(function (l) { return '<tr><th scope="row">' + esc(l) + '</th>' + sizes.map(function (z) { var r = tbl[z].filter(function (x) { return mlab(x[0]) === l; })[0]; return '<td data-mz="' + esc(z) + '"' + (z === selSize ? ' class="on"' : '') + '>' + (r ? esc(String(r[1]).replace(/\s*см$/i, '')) : '·') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="small">Размеры в сантиметрах. Выберите размер: столбец подсветится.</p>';
  }
  function colorPhotoMap(p) { return !!p.colorPhoto; }
  function renderProduct(id) {
    var p = BY_ID[id], v = $('#v-product');
    if (!p) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('box') + '</span><h3>Товар больше не продаётся</h3><p>Возможно, его уже купили. Посмотрите похожие вещи в каталоге или спросите менеджера.</p><a class="btn" href="#catalog">Открыть каталог</a></div>'; return; }
    pushRecent(p.id); trackViews(p.id);
    var sel = { size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null, photo: null, photoAuto: false, qty: 1 };
    var many = p.photos.length > 1, d = discount(p), mapOk = colorPhotoMap(p);
    var maxTokRub = Math.floor(p.price * RULES.maxShare);
    var measures = p.measureRows, tbl = p.sizeTable, tblSizes = tbl ? Object.keys(tbl) : [];
    var SPEC_ORDER = ['состояние', 'материал', 'состав', 'качество', 'сезон', 'страна производства', 'подкладка'];
    var skip = {}; (p.facts || []).forEach(function (f) { skip[String(f[0]).toLowerCase()] = 1; });
    var specs = [['Бренд', p.brand], ['Категория', p.categoryLabel]].concat(p.details.slice().sort(function (a, b) {
      var x = SPEC_ORDER.indexOf(String(a[0]).toLowerCase()), y = SPEC_ORDER.indexOf(String(b[0]).toLowerCase());
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    })).filter(function (r) { return r[1] && !skip[String(r[0]).toLowerCase()] && !/^(другое)$/i.test(r[1]); }).map(function (r) { return [cap(r[0]), cap(String(r[1]))]; });
    var hasMeas = !!(tbl || (measures && measures.length));
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
      '<div class="price-box"><div class="price-row"><span class="price">' + rub(p.price) + '</span>' + (p.oldPrice ? '<span class="old">' + rub(p.oldPrice) + '</span>' + dscChip(p) + '<span class="save-t">выгода ' + rub(p.oldPrice - p.price) + '</span>' : '') + '</div>' +
      (API.enabled ? '<span class="tok-hint">' + tk() + 'Ониксами можно оплатить до <b>' + rub(maxTokRub) + '</b></span>' : '') + '</div>' +
      etaBlock(p) +
      ((p.facts && p.facts.length) ? '<ul class="facts" aria-label="Главное о товаре">' + p.facts.slice(0, 6).map(function (f) { return '<li><small>' + esc(f[0]) + '</small><b>' + esc(f[1]) + '</b></li>'; }).join('') + '</ul>' : '') +
      (p.status === 'sold' ? '<div class="notice notice-sold">' + icon('alert') + '<div><b>Продано.</b> Этот товар уже купили. Похожие: ниже, а новинки в канале.</div></div>' : p.status === 'preorder'
        ? '<div class="notice notice-pre">' + icon('plane') + '<div><b>Предзаказ из Китая.</b> Стоимость доставки из Китая уже включена в стоимость. <a href="#info">Условия</a></div></div>'
        : p.status === 'out' ? ''
        : '') +
      (p.sizes.length ? '<div class="opt" id="opt-size"><div class="opt-head"><b>Размер' + (p.sizes.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val"><span id="size-val">' + (sel.size ? esc(sel.size) : 'не выбран') + '</span>' + '</span></div><div class="choices">' +
        p.sizes.map(function (s) { return '<button class="choice" type="button" data-size="' + esc(s) + '" aria-pressed="' + (sel.size === s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' + (tbl ? '<div class="size-meas" id="size-meas" hidden></div>' : '') + '<span class="msg" hidden>Выберите размер</span></div>' : '') +
      (p.colors.length ? '<div class="opt" id="opt-color"><div class="opt-head"><b>Цвет' + (p.colors.length > 1 ? ' <span class="req">*</span>' : '') + '</b><span class="val" id="color-val">' + (sel.color ? esc(cap(sel.color)) : 'не выбран') + '</span></div><div class="choices">' +
        p.colors.map(function (c) { return '<button class="choice color" type="button" data-color="' + esc(c) + '" aria-pressed="' + (sel.color === c) + '"><i class="sw" style="' + swatch(c) + '"></i>' + esc(cap(c)) + '</button>'; }).join('') + '</div><span class="msg" hidden>Выберите цвет</span></div>' : '') +
      '<div class="opt"><label for="p-note"><b style="font-size:14.5px">' + (p.status === 'preorder' ? 'Пожелания к товару' : 'Комментарий') + '</b> <span class="small">· по желанию</span></label><textarea id="p-note" maxlength="300" placeholder="' + (p.status === 'preorder' ? 'Например: посадка oversize, проверить швы, фото бирки' : 'Например: хочу примерить перед покупкой') + '"></textarea></div>' +
      '<div class="buy"><div class="qty" aria-label="Количество"><button type="button" id="q-minus" aria-label="Меньше" disabled>' + icon('minus') + '</button><output id="q-val">1</output><button type="button" id="q-plus" aria-label="Больше">' + icon('plus') + '</button></div>' +
      '<button class="btn" type="button" id="add-btn">' + icon('bag') + '<span id="add-lbl">В корзину · ' + rub(p.price) + '</span></button></div>' +
      '<div class="acc">' +
      ((specs.length || p.notes.length) ? '<details><summary>Характеристики' + icon('chevron-down') + '</summary><div class="acc-body">' + (specs.length ? '<dl class="specs">' + specs.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + (p.notes.length ? '<div class="notes">' + p.notes.map(function (n) { return '<span>' + icon('check') + esc(n) + '</span>'; }).join('') + '</div>' : '') + '</div></details>' : '') +
      (hasMeas ? '<details id="meas-det"><summary>Замеры изделия' + icon('chevron-down') + '</summary><div class="acc-body">' + (tbl ? measTable(tbl, sel.size) : (p.sizes.length === 1 ? '<p class="small" style="margin:0 0 8px">Размер ' + esc(p.sizes[0]) + '</p>' : '') + '<dl class="specs">' + measures.map(function (r) { return '<div><dt>' + esc(mlab(r[0])) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>') + '</div></details>' : '') +
      (((p.reviews && p.reviews.length) || API.enabled) ? '<details id="rev-det"><summary>Отзывы <span class="rev-n" id="rev-n">' + ((p.reviews && p.reviews.length) ? '· ' + p.reviews.length : '') + '</span>' + icon('chevron-down') + '</summary><div class="acc-body">' + ((p.reviews && p.reviews.length) ? p.reviews.map(function (r) { return '<div class="rev"><div class="rev-h"><b>' + esc(r.name || 'Покупатель') + '</b>' + (r.stars ? stars(r.stars) : '<span class="small">Оценка не поставлена</span>') + '</div><p>' + esc(r.text) + '</p></div>'; }).join('') : '') + '<div id="rev-body" data-base="' + ((p.reviews && p.reviews.length) || 0) + '">' + (API.enabled ? '<p class="small">Загружаем…</p>' : '') + '</div><a class="small" href="https://t.me/ONION_SHOP_FEEDBACK" target="_blank" rel="noopener">Все отзывы в канале</a></div></details>' : '') +
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
    var md0 = $('#meas-det', v); if (md0) md0.addEventListener('toggle', function () { if (md0.open) track('measure'); });
    var rd = $('#rev-det', v);
    if (rd && API.enabled) rd.addEventListener('toggle', function () { if (rd.open) loadReviews(p.id, $('#rev-body', v), $('#rev-n', v)); });
    var wb = $('#wait-btn', v);
    if (wb) {
      var isWait = function () { return !!(acct.user && (acct.user.waits || []).some(function (w) { return w.id === p.id; })); };
      var paintWait = function () { var on = isWait(); wb.classList.toggle('on', on); wb.innerHTML = on ? '<span class="oos-ok">' + icon('check-circle') + '<span><b>Вы подписаны</b><small>Сообщим, когда появится</small></span></span><span class="oos-x">Отписаться</span>' : icon('bell') + '<span>Сообщить, когда появится</span>'; };
      paintWait();
      wb.addEventListener('click', function () {
        if (!acct.user) { toast('Войдите в кабинет: тогда сообщим, когда товар появится', { label: 'Войти', run: function () { go('account'); } }, 'warn'); return; }
        var on = isWait(); busy(wb, true, 'Секунду');
        API.call('waitlist', { productId: p.id, on: !on }).then(function (r) {
          busy(wb, false);
          if (!r.ok) { toast(r.error, null, 'warn'); return; }
          acct.user = r.user; updateAcctUI(); paintWait();
          if (on) toast('Больше не следим за этим товаром');
          else if (r.user.tgOn) toast('Напишем в Telegram, когда товар появится');
          else toast('Покажем в кабинете. Чтобы получить сообщение в Telegram, подключите бота', { label: 'Подключить', run: tgModal });
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
    $$('[data-size]', v).forEach(function (b) { b.addEventListener('click', function () { sel.size = b.getAttribute('data-size'); $$('[data-size]', v).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#size-val').textContent = sel.size; clearErr('opt-size'); showSizeMeas(); }); });
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
      if (addToCart({ id: p.id, size: sel.size, color: sel.color, photo: sel.photo, qty: sel.qty, note: $('#p-note').value.trim() }) === false) return false;
      var img = $$('figure img', slides)[cur]; flyToCart(img);
      return true;
    }
    function showSizeMeas() {
      var box = $('#size-meas', v); if (!box || !tbl) return;
      var rows = sel.size && tbl[sel.size];
      box.hidden = !rows;
      if (rows) box.innerHTML = '<b>Замеры · ' + esc(sel.size) + '</b>' + rows.map(function (r) { return '<span>' + esc(mlab(r[0])) + ' <i>' + esc(r[1]) + '</i></span>'; }).join('');
      $$('.mtbl [data-mz]', v).forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-mz') === sel.size); });
    }
    showSizeMeas();
    var addBtn = $('#add-btn', v), addTimer;
    if (p.status === 'sold') { addBtn.disabled = true; $('#add-lbl', v).textContent = 'Продано'; }
    addBtn.addEventListener('click', function () {
      if (!add()) return;
      addBtn.classList.add('done'); lbl.textContent = 'Добавлено';
      clearTimeout(addTimer); addTimer = setTimeout(function () { addBtn.classList.remove('done'); lbl.textContent = 'В корзину · ' + rub(p.price * sel.qty); }, 1500);
      toast('В корзине: ' + p.title, { label: 'Оформить', run: function () { go('cart'); } });
    });

    // липкая кнопка на телефоне
    var bb = $('#buybar');
    function updBuybar() { var pr = $('.price', bb); if (pr) pr.textContent = rub(p.price * sel.qty); }
    bb.innerHTML = '<div class="bb-info"><b class="price">' + rub(p.price) + '</b><span>' + esc(p.title) + '</span></div><button class="btn" type="button" id="bb-add"' + (p.status === 'sold' ? ' disabled' : '') + '>' + icon('bag') + (p.status === 'sold' ? 'Продано' : 'В корзину') + '</button>';
    bb.hidden = false;
    $('#bb-add', bb).addEventListener('click', function () { addBtn.click(); });
    if ('IntersectionObserver' in window) {
      buyObserver = new IntersectionObserver(function (en) { bb.classList.toggle('show', !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }, { threshold: 0 });
      buyObserver.observe(addBtn);
    }
    requestAnimationFrame(function () { goTo(0, false); });
  }

  // ------------------------------------------------------------ корзина, анкета, ониксы, промокод
  var form = Object.assign({ name: '', phone: '', tg: '', recv: '', recvCity: '', recvAddr: '', ship: 'truck', city: '', preRecv: '', comment: '', together: '', vip: false }, store.get('form', {}));
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
    var pbase = t.total;
    if (cartPromo && cartPromo.cat) { var pc = (RULES.promoCats || []).filter(function (c) { return c.key === cartPromo.cat; })[0]; pbase = 0; lines.forEach(function (l) { var p = BY_ID[l.id]; if (pc && pc.cats.indexOf(p.category) >= 0) pbase += p.price * l.qty; }); }
    t.promo = cartPromo ? cartPromo.code : ''; t.promoRub = cartPromo ? Math.round(pbase * cartPromo.pct / 100) : 0; t.promoNoBase = !!(cartPromo && cartPromo.cat && !pbase);
    // ониксы и промокод вместе не больше 12% суммы (то же правило проверяет сервер)
    var room = Math.max(0, Math.floor(t.total * RULES.maxShare) - t.promoRub);
    t.maxTok = u && !noTok ? Math.min(u.balance, Math.floor(room / RULES.tokenRub)) : 0;
    t.tok = Math.max(0, Math.min(tokUse, t.maxTok));
    t.tokRub = CORE.tokensToRub(t.tok);
    t.pack = u && u.pack && u.pack.available ? u.pack : null; t.packOk = !!(t.pack && t.pre);
    t.vipRub = form.vip ? RULES.vipPrice : 0;
    t.toPay = Math.max(0, t.total - t.tokRub - t.promoRub) + t.vipRub;
    return t;
  }
  var cartStep = 'list';
  function selLines() { return cartLines().filter(function (l) { return l.sel !== false; }); }
  function lineTotals(ls) { var t = { n: 0, sum: 0, old: 0 }; ls.forEach(function (l) { var q = BY_ID[l.id]; t.n += l.qty; t.sum += q.price * l.qty; t.old += (q.oldPrice || q.price) * l.qty; }); return t; }
  function goCheckout() {
    if (!selLines().length) { toast('Отметьте галочкой, что заказать', null, 'warn'); return; }
    if (API.enabled && !acct.user) { requireAuth('cart'); return; }
    cartStep = 'checkout'; renderCart(); window.scrollTo(0, 0);
  }
  function renderCartList(v, all, gone) {
    var allOn = all.every(function (l) { return l.sel !== false; }), st = lineTotals(selLines());
    var row = function (l, i) {
      var p = BY_ID[l.id], ph = p.photos.find(function (x) { return x.id === l.photo; }) || p.photos[0], d = discount(p), on = l.sel !== false;
      return '<div class="cl' + (on ? '' : ' unsel') + '" data-k="' + i + '">' +
        '<button type="button" class="cl-chk' + (on ? ' on' : '') + '" data-sel aria-pressed="' + on + '" aria-label="Выбрать товар">' + icon('check') + '</button>' +
        '<a class="cl-ph" href="#p-' + esc(p.id) + '"><img src="' + thumb(ph.id) + '" alt="" loading="lazy"></a>' +
        '<div class="cl-b"><div class="cl-pr"><b class="' + (p.oldPrice ? 'sale' : '') + '">' + rub(p.price * l.qty) + '</b>' + (p.oldPrice ? '<s>' + rub(p.oldPrice * l.qty) + '</s>' + dscChip(p) : '') + '</div>' +
        '<a class="cl-t" href="#p-' + esc(p.id) + '">' + esc(p.title) + '</a>' +
        ((l.size || l.color) ? '<div class="cl-o">' + esc([l.size, l.color ? cap(l.color) : ''].filter(Boolean).join(', ')) + '</div>' : '') +
        '<div class="cl-m">' + badge(p) + '</div>' +
        (l.note ? '<div class="cl-o">Пожелания: ' + esc(l.note) + '</div>' : '') +
        '<div class="cl-a"><div class="qty sm"><button type="button" data-q="-1" aria-label="Меньше"' + (l.qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button><output>' + l.qty + '</output><button type="button" data-q="1" aria-label="Больше"' + (l.qty >= 10 ? ' disabled' : '') + '>' + icon('plus') + '</button></div>' +
        '<button class="cl-buy" type="button" data-buy>Купить</button><button class="cl-del" type="button" data-del aria-label="Убрать из корзины">' + icon('trash') + '</button></div></div></div>';
    };
    v.innerHTML = '<div class="view-head"><div><h1>Корзина</h1><p class="muted">' + all.length + ' ' + plural(all.length, 'товар', 'товара', 'товаров') + '</p></div></div>' +
      (gone.length ? '<div class="notice notice-info" style="margin-bottom:12px">' + icon('alert') + '<div>Проданные товары убраны из корзины: ' + gone.length + '.</div></div>' : '') +
      '<div class="cl-top"><button type="button" class="cl-all" id="cl-all" aria-pressed="' + allOn + '"><span class="cl-chk' + (allOn ? ' on' : '') + '">' + icon('check') + '</span>Все</button><span class="cl-cnt">Выбрано: ' + selLines().length + '</span><button type="button" class="cl-clear" id="cl-clear" aria-label="Удалить выбранные" ' + (selLines().length ? '' : 'disabled') + '>' + icon('trash') + '</button></div>' +
      '<div class="cl-list">' + all.map(row).join('') + '</div>' +
      (API.enabled && !acct.user && acct.ready ? '<div class="notice notice-info" style="margin-top:12px">' + icon('user') + '<div><b>Заказ оформляется из кабинета.</b> Войдите, чтобы продолжить.</div></div>' : '') +
      '<div class="card panel vip-panel"><label class="vip"><span class="vip-t"><b>' + icon('bolt') + 'Приоритетный заказ · ' + rub(RULES.vipPrice) + '</b><small>Менеджер уделит вашему заказу особое внимание и займётся им в первую очередь</small></span><input type="checkbox" id="cl-vip"' + (form.vip ? ' checked' : '') + '><span class="sw-tg"></span></label></div>' +
      '<div class="cart-bar"><div class="cb-sub">' + (st.old > st.sum ? '<span class="cb-save">Скидка −' + rub(st.old - st.sum) + '</span>' : '<span></span>') + (form.vip && st.n ? '<span class="cb-vip">⚡ Приоритет +' + rub(RULES.vipPrice) + '</span>' : '') + '</div><button class="cb-go" type="button" id="cb-go"' + (st.n ? '' : ' disabled') + '><span>' + (st.n ? 'К оформлению · ' + st.n : 'Выберите товары') + '</span><b>' + (st.n ? rub(st.sum + (form.vip ? RULES.vipPrice : 0)) : '') + '</b></button></div>';
    var all2 = all;
    $$('.cl', v).forEach(function (rowEl) {
      var l = all2[+rowEl.getAttribute('data-k')];
      $('[data-sel]', rowEl).addEventListener('click', function () { l.sel = l.sel === false; saveCart(); renderCartList(v, cartLines(), []); });
      $$('[data-q]', rowEl).forEach(function (b) { b.addEventListener('click', function () { l.qty = Math.max(1, Math.min(10, l.qty + +b.getAttribute('data-q'))); saveCart(); renderCartList(v, cartLines(), []); }); });
      $('[data-buy]', rowEl).addEventListener('click', function () { cartLines().forEach(function (x) { x.sel = (x === l); }); saveCart(); goCheckout(); });
      $('[data-del]', rowEl).addEventListener('click', function () {
        var idx = cart.indexOf(l); if (idx < 0) return;
        cart.splice(idx, 1); saveCart(); renderCart();
        toast('Товар убран из корзины', { label: 'Вернуть', run: function () { cart.splice(idx, 0, l); saveCart(); if (current === 'cart') renderCart(); } });
      });
    });
    $('#cl-all', v).addEventListener('click', function () { var on = !allOn; cartLines().forEach(function (l) { l.sel = on; }); saveCart(); renderCartList(v, cartLines(), []); });
    $('#cl-clear', v).addEventListener('click', function () {
      var n = selLines().length; if (!n) return;
      confirmBox({ title: 'Удалить выбранные?', text: 'Выбранные товары (' + n + ') будут убраны из корзины.', actions: [{ label: 'Оставить', cls: 'btn-ghost' }, { label: 'Удалить', cls: 'btn-danger', run: function () { cart = cart.filter(function (l) { return l.sel === false || !BY_ID[l.id]; }); saveCart(); renderCart(); } }] });
    });
    $('#cl-vip', v).addEventListener('change', function () { form.vip = this.checked; saveForm(); renderCartList(v, cartLines(), []); });
    $('#cb-go', v).addEventListener('click', goCheckout);
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
    if (cartStep !== 'checkout' || !selLines().length) { cartStep = 'list'; renderCartList(v, cartLines(), gone); return; }
    lines = selLines();
    var u = acct.user;
    if (u) {
      if (!form.name) form.name = u.name; if (!form.phone) form.phone = u.phone; if (!form.tg) form.tg = u.tg;
      if (cartPromo && cartPromo.personal) { var cp = u.promos.filter(function (x) { return x.code === cartPromo.code; })[0]; if (!cp) cartPromo = null; else { cartPromo.pct = cp.pct; cartPromo.cat = cp.cat || ''; cartPromo.catLabel = cp.catLabel || ''; } }
    }
    var t = totals(lines), n = 0; saveDraft();
    v.innerHTML =
      '<div class="view-head"><div><button class="back-btn" id="to-list" type="button">' + icon('arrow-right') + 'К корзине</button><h1>Оформление заказа</h1><p class="muted">' + t.cnt + ' ' + plural(t.cnt, 'товар', 'товара', 'товаров') + ' · ' + rub(t.total) + '</p></div></div>' +
      (API.enabled && !u && acct.ready ? '<div class="notice notice-info need-acc" style="margin-bottom:12px">' + icon('user') + '<div><b>Заказ оформляется из кабинета.</b><div class="acts" style="margin-top:10px"><button class="btn btn-sm" type="button" id="need-acc">' + icon('user') + 'Войти или создать кабинет</button></div></div></div>' : '') +
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

      (!API.enabled ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Контакты</h2></div><div class="fgrid">' +
        '<div class="f" data-f="name"><label for="f-name">Имя</label><input class="input" id="f-name" autocomplete="name" value="' + esc(form.name) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="phone"><label for="f-phone">Телефон</label><input class="input" id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f full" data-f="tg"><label for="f-tg">Telegram</label><div class="prefix"><span>@</span><input class="input" id="f-tg" autocomplete="off" autocapitalize="off" value="' + esc(form.tg) + '"></div><span class="err-msg" hidden></span></div></div></div>' : '') +
      (u && !profileOk(u) ? '<div class="notice notice-warn need-prof" data-f="prof">' + icon('user') + '<div><b>Заполните данные в кабинете</b>: имя и телефон берутся из него.</div><a class="btn btn-sm" href="#account">В профиль</a></div>' : '') +

      (t.stock ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Получение' + (t.pre ? ' · в наличии' : '') + '</h2></div>' +
        '<div class="f" data-f="recv"><span class="lbl sr">Способ получения</span><div class="radios mini">' +
        radio('recv', 'city', form.recv, 'Авито Доставка', '') +
        radio('recv', 'courier', form.recv, 'Курьер', '') +
        radio('recv', 'pickup', form.recv, 'Самовывоз', '') +
        '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvCity"' + (form.recv === 'city' ? '' : ' hidden') + '><label for="f-recv-city">Город</label><input class="input" id="f-recv-city" autocomplete="address-level2" placeholder="Москва или другой город" value="' + esc(form.recvCity) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="recvAddr"' + (form.recv === 'courier' ? '' : ' hidden') + '><label for="f-recv-addr">Адрес или район <span class="opt-l">· по желанию</span></label><input class="input" id="f-recv-addr" autocomplete="street-address" placeholder="Уточним с менеджером" value="' + esc(form.recvAddr) + '"></div></div>' : '') +

      (t.pre ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Предзаказ из Китая</h2><a class="link-btn" href="#info">Подробнее</a></div>' +
        '<div class="f" data-f="ship"><span class="lbl">Отправка со склада в Китае</span><div class="notice">' + icon('truck') + '<div><b>Фура</b>, 18-32 дня от склада. Стоимость доставки из Китая уже включена в стоимость.</div></div></div>' +
        '<div class="f" data-f="city"><label for="f-city">Город, куда привезти</label><input class="input" id="f-city" autocomplete="address-level2" placeholder="Например, Москва" value="' + esc(form.city) + '"><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="preRecv"><span class="lbl">Способ получения</span><div class="radios mini">' + radio('preRecv', 'avito', form.preRecv, 'Авито', '') + radio('preRecv', 'cdek', form.preRecv, 'СДЭК', '') + radio('preRecv', 'meet', form.preRecv, 'Встреча', '') + '</div><span class="err-msg" hidden></span></div>' +
        '<div class="f" data-f="ack"><div class="ack" id="ack"><div class="q"><span class="checkbox" id="ack-box" role="img" aria-label="Не подтверждено">' + icon('check') + '</span><div><b>Я прочитал(а) условия предзаказа</b> <a class="small" href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Открыть</a></div></div>' +
        '<div class="ack-opts"><button type="button" class="yes" data-ack="yes" aria-pressed="' + (ack === 'yes') + '">Да, ознакомился(-ась)</button><button type="button" class="no" data-ack="no" aria-pressed="' + (ack === 'no') + '">Нет, ещё не успел(а)</button><button type="button" class="cancel" data-ack="cancel">Отказаться от оформления</button></div>' +
        '<div id="ack-hint"' + (ack === 'no' ? '' : ' hidden') + ' style="font-size:14px">Без подтверждения предзаказ не оформить. <a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener"><b>Открыть условия</b></a></div></div><span class="err-msg" hidden></span></div></div>' : '') +

      (t.stock && t.pre ? '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Как получить заказ</h2></div><div class="f" data-f="together"><div class="radios">' +
        radio('together', 'together', form.together, 'Всё вместе', 'Товар из наличия дождётся предзаказа, и вы получите всё сразу') +
        radio('together', 'separate', form.together, 'Раздельно', 'Сначала получите товары в наличии, предзаказ, когда приедет из Китая') + '</div><span class="err-msg" hidden></span></div></div>' : '') +
      '<div class="card panel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Комментарий</h2></div><div class="f"><label class="sr" for="f-comment">Комментарий к заказу</label><textarea id="f-comment" maxlength="500" placeholder="По желанию">' + esc(form.comment) + '</textarea></div></div>' +
      (API.enabled ? '<div class="card panel" id="tokpanel"><div class="panel-head"><h2><span class="n">' + (++n) + '</span>Ониксы и промокод</h2>' + (u ? '<span class="tok">' + tk() + num(u.balance) + '</span>' : '') + '</div>' +
        (u ? (t.maxTok > 0 ? '<div class="tokbox"><div class="tokrow"><span>Списать <b id="tok-n">' + num(t.tok) + '</b> <span id="tok-w">' + tokWord(t.tok) + '</span></span><b id="tok-rub">−' + rub(t.tokRub) + '</b></div>' +
            '<label class="sr" for="tok-range">Сколько ониксов списать</label><input class="range" id="tok-range" type="range" min="0" max="' + t.maxTok + '" step="1" value="' + t.tok + '">' +
            '<div class="tokrow"><span class="small">максимум ' + num(t.maxTok) + '</span><span class="tokq"><button type="button" data-tq="0">0</button><button type="button" data-tq="1">Максимум</button></span></div></div>'
            : (cartPromo && cartPromo.withTokens === false ? '<p class="small">Промокод ' + esc(cartPromo.code) + ' нельзя совмещать с ониксами.</p>' : '')) +
          (u.promos.length ? '<div class="promos">' + u.promos.map(function (pr) { return '<button type="button" class="ticket" data-promo="' + esc(pr.code) + '" aria-pressed="' + (!!cartPromo && cartPromo.code === pr.code) + '"><code>' + esc(pr.code) + '</code><span class="pct">−' + pctTxt(pr.pct) + '%</span>' + (pr.cat ? '<span class="small">на «' + esc(pr.catLabel) + '»</span>' : '') + '</button>'; }).join('') + '</div>' : '')
          : '<div class="guest-box">' + tk('lg') + '<div><b>Заказ оформляется из кабинета, войдите или создайте его</b></div></div><div class="acts"><button class="btn btn-sm btn-ghost" type="button" id="go-auth">' + icon('user') + 'Войти или создать аккаунт</button></div>') +
        '<div class="f"><label for="promo-in">Промокод</label><div class="promo-row"><input class="input" id="promo-in" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Введите промокод" value="' + esc(cartPromo && !cartPromo.personal ? cartPromo.code : '') + '"><button class="btn btn-dark" type="button" id="promo-btn">' + (cartPromo && !cartPromo.personal ? 'Убрать' : 'Применить') + '</button></div><div id="promo-msg">' + (cartPromo ? (t.promoNoBase ? '<span class="promo-bad">Промокод ' + esc(cartPromo.code) + ' действует только на «' + esc(cartPromo.catLabel) + '»: таких товаров в корзине нет</span>' : '<span class="promo-ok">' + icon('check-circle') + 'Промокод ' + esc(cartPromo.code) + ': −' + pctTxt(cartPromo.pct) + '%' + (cartPromo.cat ? ' на «' + esc(cartPromo.catLabel) + '»' : '') + '</span>') : '') + '</div></div>' +
        (t.pack ? (t.packOk ? '<label class="pack-row"><input type="checkbox" id="use-pack"' + (usePack ? ' checked' : '') + '><span class="cbx">' + icon('check') + '</span><span><b>' + esc(t.pack.label) + ', применить к этому заказу</b><small>' + esc(t.pack.note) + '. Менеджер учтёт при расчёте упаковки.</small></span></label>'
          : '<p class="small pack-note">' + icon('info') + esc(t.pack.label) + ' (привилегия ' + esc(t.pack.level) + ') действует только для заказа с предзаказом из Китая.</p>') : '') +
        '</div>' : '') +
      '</div>' +

      '<aside class="card sumcard"><h2>Ваш заказ</h2>' +
      '<div class="sumrow"><span>Товары · ' + t.cnt + ' шт.</span><b>' + rub(t.total) + '</b></div>' +
      (t.old > t.total ? '<div class="sumrow good"><span>Скидки на товары</span><b>учтены · −' + rub(t.old - t.total) + '</b></div>' : '') +
      '<div class="sumrow" id="sum-tok"' + (t.tok ? '' : ' hidden') + '><span>Ониксы</span><b>−' + rub(t.tokRub) + '</b></div>' +
      '<div class="sumrow good" id="sum-promo"' + (t.promoRub ? '' : ' hidden') + '><span>Промокод <span id="sum-promo-code">' + esc(t.promo) + '</span></span><b>−' + rub(t.promoRub) + '</b></div>' +
      '<div class="sumrow" id="sum-vip"' + (t.vipRub ? '' : ' hidden') + '><span>Приоритетный заказ</span><b>+' + rub(t.vipRub) + '</b></div>' +
      '<div class="sumtotal"><span>К оплате</span><b id="sum-pay">' + rub(t.toPay) + '</b></div>' +
      (API.enabled && !u ? '<button class="btn btn-block" type="submit" id="submit-btn">' + icon('user') + '<span>Войти, чтобы оформить</span></button>' : ((u && !u.phoneOk ? '<button class="ph-need ph-soft" type="button" id="ph-go2">' + icon('phone') + '<span>Подтвердите телефон в Telegram, чтобы получить приветственные ониксы и бонусы</span></button>' : '') + '<button class="btn btn-block" type="submit" id="submit-btn">' + icon('check-circle') + '<span>Оформить заказ</span></button>')) +
      '</aside></form>';

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

    // ониксы и промокоды
    var ga = $('#go-auth', v); if (ga) ga.addEventListener('click', function () { requireAuth('cart'); });
    var range = $('#tok-range', v);
    function updSum() {
      var tt = totals(lines);
      if (range) { range.style.setProperty('--p', (tt.maxTok ? tt.tok / tt.maxTok * 100 : 0) + '%'); $('#tok-n').textContent = num(tt.tok); $('#tok-w').textContent = tokWord(tt.tok); $('#tok-rub').textContent = '−' + rub(tt.tokRub); }
      var st = $('#sum-tok'); st.hidden = !tt.tok; $('b', st).textContent = '−' + rub(tt.tokRub);
      var sp = $('#sum-promo'); sp.hidden = !tt.promoRub; $('b', sp).textContent = '−' + rub(tt.promoRub); $('#sum-promo-code').textContent = tt.promo;
      saveDraft();
      var sv = $('#sum-vip'); if (sv) { sv.hidden = !tt.vipRub; $('b', sv).textContent = '+' + rub(tt.vipRub); }
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
    var tl = $('#to-list', v); if (tl) tl.addEventListener('click', function () { cartStep = 'list'; renderCart(); window.scrollTo(0, 0); });
    var vp = $('#f-vip', v); if (vp) vp.addEventListener('change', function () { form.vip = vp.checked; saveForm(); updSum(); });
    bind('f-name', 'name'); bind('f-phone', 'phone'); bind('f-tg', 'tg'); bind('f-recv-city', 'recvCity'); bind('f-recv-addr', 'recvAddr'); bind('f-city', 'city'); bind('f-comment', 'comment');
    var ph = $('#f-phone', v); if (ph) ph.addEventListener('blur', function () { var f = CORE.fmtPhone(ph.value); if (f && CORE.digits(f).length === 11) { ph.value = f; form.phone = f; saveForm(); } });
    var tg = $('#f-tg', v); if (tg) tg.addEventListener('blur', function () { var c = CORE.cleanTg(tg.value); tg.value = c; form.tg = c; saveForm(); });
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
            title: 'Отказаться от оформления?', text: 'Можно убрать из корзины товары по предзаказу или вернуться к покупкам, корзина сохранится.',
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
  function profileOk(u) { return !!u && String(u.name || '').trim().length >= 2 && CORE.digits(u.phone || '').length >= 10; }
  function validateForm(hasStock, hasPre) {
    var e = [];
    var u0 = acct.user;
    if (u0) { if (!profileOk(u0)) e.push(['prof', 'Заполните в кабинете имя и телефон']); }
    else {
      if (form.name.trim().length < 2) e.push(['name', 'Укажите имя']);
      var d = CORE.digits(form.phone); if (d.length < 10 || d.length > 15) e.push(['phone', 'Укажите телефон, например +7 900 000-00-00']);
      var t = CORE.cleanTg(form.tg); if (t && !/^[A-Za-z0-9_]{4,32}$/.test(t)) e.push(['tg', 'Username: латиница, цифры и «_», от 4 символов']);
    }
    if (hasStock && hasPre && !form.together) e.push(['together', 'Выберите: получить всё вместе или раздельно']);
    if (hasStock) { if (!form.recv) e.push(['recv', 'Выберите способ получения']); else if (form.recv === 'city' && form.recvCity.trim().length < 2) e.push(['recvCity', 'Укажите город (можно Москва)']); }
    if (hasPre) {
      form.ship = 'truck';
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
      cart = cart.filter(function (l) { return lines.indexOf(l) < 0; }); ack = null; tokUse = 0; cartPromo = null; usePack = true; cartStep = 'list'; saveCart();
      form.comment = ''; form.vip = false; form.together = ''; saveForm();
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
      if (r.needPhone) { phoneModal(); return; }
      if (r.network) { confirmBox({ title: 'Сервер не отвечает', text: 'Проверьте интернет и нажмите «Оформить» ещё раз. Корзина сохранена. Если не получается: напишите менеджеру.', actions: [{ label: 'Хорошо', cls: 'btn' }, { label: 'Написать менеджеру', cls: 'btn-ghost', run: function () { window.open(SHOP.managerUrl, '_blank', 'noopener'); } }] }); return; }
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
    if (o.status === 'Отменён') return '<div class="notice notice-warn">' + icon('alert') + '<div>Заказ отменён. Вопросы: менеджеру <a href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">@' + SHOP.manager + '</a>.</div></div>';
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
    return '<div class="receipt"><div class="rc-top"><div class="rc-brand"><img src="' + LOGO + '" alt="">ONION SHOP<span>' + icon('check') + 'оформлен</span></div>' +
      '<span class="rc-label">Номер заказа</span><div class="rc-no"><b>' + esc(o.no) + '</b><button type="button" data-copy="' + esc(o.no) + '">' + icon('copy') + 'Номер</button></div><span class="rc-date">' + esc(fmtAt(o.at)) + '</span></div>' +
      '<div class="rc-perf"><i></i><i></i></div>' + (thumbs ? '<div class="rc-thumbs">' + thumbs + '</div>' : '') +
      '<div class="rc-body"><div class="rc-row"><span>Товары · ' + (o.count || 0) + ' шт.</span><b>' + rub(o.total || 0) + '</b></div>' +
      (o.tokens ? '<div class="rc-row"><span>Ониксы · ' + num(o.tokens) + '</span><b>−' + rub(o.tokenRub) + '</b></div>' : '') +
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
    // вошли в кабинет, история только с сервера; заказы, сохранённые в этом браузере раньше, показываем лишь без входа
    if (acct.user) return acct.user.orders.slice();
    localOrders.forEach(function (o) { list.push(o); });
    return list;
  }
  function orderCard(o, i) {
    return '<article class="card order" data-o="' + i + '"><div class="order-top"><div><span class="order-no">№ ' + esc(o.no) + '</span><p class="date">' + esc(fmtAt(o.at)) + ' · ' + (o.count || 0) + ' шт.</p></div><div style="display:grid;justify-items:end;gap:6px"><span class="sum">' + rub(o.toPay != null ? o.toPay : o.total) + '</span>' + stPill(o) + '</div></div>' +
      '<div class="order-items">' + (o.items || []).map(function (it) { var id = it.photo || it.thumb; return '<a class="oi" href="#p-' + esc(it.id) + '" title="' + esc(it.title) + '">' + (id ? '<img src="' + thumb(id) + '" alt="' + esc(it.title) + '" loading="lazy">' : '') + (it.qty > 1 ? '<i>×' + it.qty + '</i>' : '') + '</a>'; }).join('') + '</div>' +
      ((o.photos || []).length ? '<div class="ord-photos">' + icon('camera') + '<b>Фотоотчёт</b>' + o.photos.map(function (l, k) { return '<a class="chip" href="' + esc(l) + '" target="_blank" rel="noopener">Фото ' + (k + 1) + '</a>'; }).join('') + '</div>' : '') +
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
    var head = '<div class="view-head"><div><span class="eyebrow">История</span><h1>Мои заказы</h1>' + '</div>' + (API.enabled && !acct.user ? '<a class="btn btn-ghost" href="#account">' + icon('user') + 'Войти</a>' : '') + '</div>';
    if (!list.length) { v.innerHTML = head + '<div class="empty"><span class="ico">' + icon('receipt') + '</span><h3>Заказов пока нет</h3><p>Здесь будут номера заказов, статусы и суммы.</p><a class="btn" href="#catalog">' + icon('grid') + 'Перейти в каталог</a></div>'; return; }
    var act = [], hist = [];
    list.forEach(function (o, i) { (isDoneOrder(o) ? hist : act).push(orderCard(o, i)); });
    v.innerHTML = head +
      (act.length ? '<h2 class="sec-h">Активные · ' + act.length + '</h2><div class="orders">' + act.join('') + '</div>' : '<div class="notice notice-info" style="margin-bottom:12px">' + icon('check-circle') + '<div>Активных заказов нет. Завершённые лежат в «Истории заказов» ниже, любой можно повторить в один клик.</div></div>') +
      (hist.length ? '<details class="hist"' + (act.length ? '' : ' open') + '><summary>' + icon('receipt') + '<span>История заказов</span><b>' + hist.length + '</b>' + icon('chevron-down') + '</summary><div class="orders">' + hist.join('') + '</div></details>' : '');
    bindOrders(v, list);
  }
  function isDoneOrder(o) { return RULES.finalStages.indexOf(o.status) >= 0; }

  // ------------------------------------------------------------ избранное
  function renderFavorites() {
    var v = $('#v-favorites'), list = favs.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    v.innerHTML = '<div class="view-head"><div><h1>Избранное</h1><p class="muted">' + (list.length ? list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров') + ', сохранено на потом' : 'Сохраняйте понравившееся, чтобы вернуться позже') + '</p></div></div>' +
      (list.length && acct.user ? '<div class="fav-watch">' + icon('bell') + '<span>' + (acct.user.tgOn ? 'Сообщим в Telegram, если вещь из избранного подешевеет' : 'Подключите Telegram в кабинете, сообщим, если вещь из избранного подешевеет') + '</span></div>' : '') +
      (list.length ? grid(list) : '<div class="empty fav-empty"><span class="ico">' + icon('heart') + '</span><h3>Пока пусто</h3><a class="btn" href="#catalog">Перейти в каталог</a></div>');
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
  // достижения: значки (и рамки за некоторые); новые показываем один раз
  function achvTile(u) {
    var have = u.achv || [], n = have.length;
    return '<div class="card tile c12"><div class="tile-h"><h3>Достижения</h3><span class="side">' + n + ' из ' + RULES.achv.length + '</span></div><div class="achv">' +
      RULES.achv.map(function (a) { var on = have.indexOf(a.id) >= 0; var fr = a.frame ? (RULES.frames.filter(function (f) { return f.id === a.frame; })[0] || {}).name : '';
        return '<div class="ach' + (on ? ' on' : '') + '" title="' + esc(a.d) + '"><span class="ach-i">' + icon(on ? a.ic : 'lock') + '</span><b>' + esc(a.name) + '</b><small>' + esc(a.d) + '</small>' + (fr ? '<i class="ach-fr" title="Рамка «' + esc(fr) + '»">+ рамка</i>' : '') + '</div>'; }).join('') + '</div></div>';
  }
  function achvNews(u) {
    if (!u || !u.achv) return;
    var seen = store.get('achvSeen:' + u.id, null);
    if (seen === null) { store.set('achvSeen:' + u.id, u.achv); return; }
    var fresh = u.achv.filter(function (x) { return seen.indexOf(x) < 0; });
    if (!fresh.length) return;
    store.set('achvSeen:' + u.id, u.achv);
    var a = RULES.achv.filter(function (x) { return x.id === fresh[0]; })[0];
    if (a) setTimeout(function () { reward('Новое достижение: «' + a.name + '»' + (a.frame ? ', и новая рамка для аватара' : '')); }, 1200);
  }
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
      '<li>' + tk('lg') + '<span><b>+' + R.register + ' ониксов</b> сразу за регистрацию</span></li>' +
      '<li>' + tk('lg') + '<span>Ониксы и промокод вместе: <b>до 12%</b> заказа · 1 оникс = 0,3 ₽</span></li>' +
      '<li>' + tk('lg') + '<span><b>Задания дня</b> по 1 ониксу и до ' + RULES.levels[4].streak + ' за 7 дней подряд</span></li>' +
      '<li>' + tk('lg') + '<span><b>Программа лояльности</b>: Бронза → Серебро → Золото → Платина → Алмаз</span></li>' +
      '<li>' + tk('lg') + '<span><b>Посылка</b>: ониксы, промокоды, рамки для аватара</span></li>' +
      '<li>' + tk('lg') + '<span><b>Статусы заказов</b>: от выкупа в Китае до получения</span></li>' +
      '<li>' + tk('lg') + '<span><b>+' + R.referrer + ' ониксов</b> за друга, когда он получит первый заказ</span></li>' +
      '</ul><p class="small" style="color:var(--navy-ink-2)">Пароль хранится в зашифрованном виде. Почта нужна, чтобы восстановить пароль.</p></div>';
  }
  function renderAuth(v) {
    var ref = store.get('ref', ''), R = RULES.reward, val = function (id) { var el = $('#' + id, v); return el ? el.value.trim() : ''; };
    var refBanner = ref ? '<div class="form-ok">' + icon('gift') + ' Вас пригласил друг: при регистрации +' + R.refFriend + ' ониксов сверху.</div>' : '';
    var body;
    if (authTab === 'register') {
      body = '<form id="auth-form" novalidate style="display:grid;gap:14px">' + refBanner +
        '<div class="fgrid"><div class="f"><label for="a-name">Имя</label><input class="input" id="a-name" autocomplete="name" placeholder="Как к вам обращаться" value="' + esc(form.name) + '"></div>' +
        '<div class="f"><label for="a-login">Логин</label><input class="input" id="a-login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="латиница, от 3 символов"></div>' +
        '<div class="f full"><label for="a-email">Почта</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@mail.ru"><span class="hint">Пришлём код подтверждения. Через почту можно восстановить пароль.</span></div>' +
        '<div class="f"><label for="a-phone">Телефон</label><input class="input" id="a-phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(form.phone) + '"></div>' +
        '<div class="f"><label for="a-tg">Telegram <span class="opt-l">· желательно</span></label><div class="prefix"><span>@</span><input class="input" id="a-tg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="username" value="' + esc(form.tg) + '"></div></div>' +
        '<div class="f full"><label for="a-pass">Пароль</label><div class="pass"><input class="input" id="a-pass" type="password" autocomplete="new-password" placeholder="не короче 6 символов"><button type="button" data-eye aria-label="Показать пароль">' + icon('eye') + '</button></div></div>' +
        '<div class="f full"><label for="a-ref">Код друга <span class="opt-l">· по желанию, +' + R.refFriend + ' ониксов</span></label><input class="input" id="a-ref" autocapitalize="characters" spellcheck="false" placeholder="Например, K7Q2MX" value="' + esc(ref) + '"></div>' +
        '<div class="f full" id="code-box"' + (regSent ? '' : ' hidden') + '><label for="a-code">Код из письма</label><input class="input code" id="a-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"><button class="link-btn" type="button" id="resend" style="justify-self:start">Отправить код ещё раз</button></div></div>' +
        '<div id="code-msg"></div><div class="form-err" id="auth-err" hidden></div>' +
        '<button class="btn btn-block" type="submit" id="auth-btn">' + (regSent ? icon('gift') + 'Подтвердить и получить ' + R.register + ' ониксов' : icon('mail') + 'Получить код на почту') + '</button></form>';
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
      if (!/^[a-z0-9_.]{3,20}$/i.test(p.login)) return 'Логин: от 3 до 20 символов, латиница, цифры, точка или «_»';
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
            regSent = true; $('#code-box', v).hidden = false; btn.innerHTML = icon('gift') + 'Подтвердить и получить ' + R.register + ' ониксов';
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
          if (r.repeat) toast('Добро пожаловать! Приветственные бонусы на эти данные уже выдавались раньше, поэтому повторно не начисляются'); else toast('Аккаунт создан! Подтвердите телефон в Telegram, и получите +' + r.pending + ' ' + tokWord(r.pending));
          setTimeout(phoneModal, 900);
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
        API.call('profile', { avatar: out }).then(function (r) { if (r.ok) { setUser(r.user); toast('Фото обновлено'); } else toast(r.error, null, 'warn'); });
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
      API.call('profile', { name: $('#p-name', md).value, phone: $('#p-phone', md).value, tg: $('#p-tg', md).value }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Данные сохранены'); } else toast(r.error, null, 'warn'); });
    });
  }

  function openMenu() {
    if ($('#drawer')) return;
    var u = acct.user, cats = categories(PRODUCTS).filter(function (c) { return c.key !== 'other'; });
    var link = function (ic, label, attrs, sub) { return '<a class="dr-i" ' + attrs + '><span class="dr-ic">' + icon(ic) + '</span><span class="dr-t">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + icon('chevron-right') + '</a>'; };
    var nSale = PRODUCTS.filter(function (x) { return discount(x) >= 3; }).length;
    var el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer';
    el.innerHTML = '<div class="dr-bg" data-dr-close></div><aside class="dr-p" role="dialog" aria-modal="true" aria-label="Меню"><div class="dr-h"><b>Меню</b><button class="icon-btn" type="button" data-dr-close aria-label="Закрыть">' + icon('x') + '</button></div><div class="dr-b">' +
      '<div class="dr-g">' + link('home', 'Главная', 'href="#home" data-go="home"') + link('grid', 'Каталог', 'href="#catalog" data-go="catalog" data-reset="1"') + link('box', 'В наличии', 'href="#stock" data-go="stock"') + link('plane', 'Предзаказ из Китая', 'href="#preorder" data-go="preorder"') + link('percent', 'Товары со скидкой', 'href="#catalog" data-go="catalog" data-sale="1"', nSale ? nSale + ' ' + plural(nSale, 'товар', 'товара', 'товаров') : '') + '</div>' +
      '<div class="dr-s">Категории</div><div class="dr-cats">' + cats.map(function (c) { return '<a class="dr-c' + (c.n ? '' : ' empty') + '" href="#catalog" data-go="catalog" data-cat="' + c.key + '"><img class="lt" src="assets/cat/' + c.key + '.svg" alt=""><img class="dk" src="assets/cat/dark/' + c.key + '.svg" alt=""><span>' + esc(c.label) + '</span></a>'; }).join('') + '</div>' +
      '<div class="dr-s">Мои покупки</div><div class="dr-g">' + link('heart', 'Избранное', 'href="#favorites" data-go="favorites"') + link('bag', 'Корзина', 'href="#cart" data-go="cart"') + link('user', u ? 'Кабинет' : 'Войти', 'href="#account" data-go="account"', u ? esc(u.name || u.login || '') : '') + (API.enabled ? link('receipt', 'Мои заказы', 'href="#orders" data-go="orders"') + link('gift', 'Игры', 'href="#games" data-go="games"') : '') + '</div>' +
      '<div class="dr-s">Информация</div><div class="dr-g">' + link('info', 'Частые вопросы', 'href="#info" data-go="info"', 'заказ, сроки, доставка, оплата') + link('truck', 'Как работает предзаказ', 'href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener"') + link('pin', 'Магазин и контакты', 'href="#info" data-go="info"', esc(SHOP.address)) + '</div>' +
      '<div class="dr-s">Оформление</div><div class="dr-th" id="dr-th">' + ['auto', 'light', 'dark'].map(function (k) { return '<button type="button" data-th="' + k + '" aria-pressed="' + (themeMode() === k) + '">' + (k === 'auto' ? 'Авто' : THEME_NAMES[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="dr-s">Связь</div><div class="dr-g">' + link('send', 'Менеджер в Telegram', 'href="' + SHOP.managerUrl + '" target="_blank" rel="noopener"', '@' + SHOP.manager) + link('megaphone', 'Канал магазина', 'href="' + SHOP.channelUrl + '" target="_blank" rel="noopener"') + link('star', 'Отзывы покупателей', 'href="' + SHOP.reviewsUrl + '" target="_blank" rel="noopener"') + link('play', 'TikTok', 'href="' + SHOP.tiktokUrl + '" target="_blank" rel="noopener"') + '</div>' +
      '</div></aside>';
    document.body.appendChild(el); document.documentElement.classList.add('dr-open');
    requestAnimationFrame(function () { el.classList.add('on'); });
    function close() { el.classList.remove('on'); document.documentElement.classList.remove('dr-open'); document.removeEventListener('keydown', onKey); setTimeout(function () { el.remove(); }, 260); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-dr-close]')) { close(); return; }
      var th = e.target.closest('[data-th]');
      if (th) { setThemeMode(th.getAttribute('data-th')); $$('[data-th]', el).forEach(function (x) { x.setAttribute('aria-pressed', x === th); }); return; }
      var a = e.target.closest('[data-go]');
      if (a) {
        e.preventDefault(); var h = a.getAttribute('data-go');
        if (h === 'catalog') { filter = newFilter(); if (a.getAttribute('data-cat')) filter.cat = a.getAttribute('data-cat'); if (a.getAttribute('data-sale')) filter.sale = true; }
        close(); go(h); return;
      }
      if (e.target.closest('a[href]')) close();
    });
    var first = $('.dr-p button', el); if (first) first.focus();
  }
  function themeModal() {
    var ICO = { auto: 'sun', light: 'sun', dark: 'moon' };
    var md = openModal(modalHead('Тема оформления') + '<div class="th-grid" id="th-opts">' + ['auto', 'light', 'dark'].map(function (k) {
      return '<button class="th-card th-' + k + '" type="button" data-th="' + k + '" aria-pressed="' + (themeMode() === k) + '"><span class="th-pv"><i class="th-bar"></i><i class="th-l1"></i><i class="th-l2"></i><i class="th-btn"></i><b class="th-ck">' + icon('check') + '</b></span><span class="th-n">' + THEME_NAMES[k] + '</span></button>';
    }).join('') + '</div><p class="small" style="margin-top:12px">«Авто» подстраивается под настройки телефона. Выбор запоминается на этом устройстве.</p>', { cls: 'sm' });
    $$('[data-th]', md).forEach(function (b) { b.addEventListener('click', function () { setThemeMode(b.getAttribute('data-th')); $$('[data-th]', md).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); var v = $('#r-theme .val'); if (v) v.textContent = THEME_NAMES[themeMode()]; }); });
  }
  // ------------------------------------------------------------ значок на экране «Домой»
  var SEASON_ICONS = []; // сезонные значки (id, название, [месяц, день] начала, конца); сейчас нет
  function seasonOn(s) { var d = new Date(Date.now() + 3 * 3600e3), m = d.getUTCMonth() + 1, k = m * 100 + d.getUTCDate(), a = s[2][0] * 100 + s[2][1], b = s[3][0] * 100 + s[3][1]; return a <= b ? k >= a && k <= b : k >= a || k <= b; }
  var HOME_BASE = [['dark', 'Тёмная'], ['white', 'Белая']];
  function homeIcons() { return HOME_BASE.concat(SEASON_ICONS.map(function (s) { return [s[0], s[1]]; })); }
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  var ICON_BG = { white: '#ffffff', newyear: '#082252', valentine: '#5a1138' };
  function homeIcon() { var v = store.get('homeIcon', 'dark'); return homeIcons().some(function (x) { return x[0] === v; }) ? v : 'dark'; }
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
        background_color: ICON_BG[id] || '#050a1d', theme_color: ICON_BG[id] || '#050a1d',
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
      ? ['Откройте сайт в <b>Safari</b> (в других браузерах на iPhone кнопки нет).', 'Нажмите <b>«Поделиться»</b>: квадрат со стрелкой внизу экрана.', 'Прокрутите список и выберите <b>«На экран «Домой»»</b>.', 'Название оставьте <b>Onion Shop</b> и нажмите <b>«Добавить»</b>.']
      : /Android/.test(ua)
        ? ['Откройте сайт в <b>Chrome</b>.', 'Нажмите <b>⋮</b> (меню) в правом верхнем углу.', 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.', 'Подтвердите: значок <b>Onion Shop</b> появится среди приложений.']
        : ['В Chrome или Edge нажмите значок установки в адресной строке (справа) или меню <b>⋮ → «Установить Onion Shop»</b>.', 'На телефоне откройте сайт и повторите те же шаги там.'];
    var md = openModal(modalHead('Значок на экране «Домой»') +
      '<p class="small" style="margin:0 0 10px">Сайт откроется как приложение, без адресной строки, одним нажатием. Сначала выберите значок, потом добавьте его на экран.</p>' +
      '<div class="home-icons" role="group" aria-label="Значок">' + homeIcons().map(function (x) {
        return '<button type="button" data-hi="' + x[0] + '" aria-pressed="' + (x[0] === cur) + '"><span class="hi-img"><img src="assets/icons/' + x[0] + '-192.png" width="64" height="64" alt="" loading="lazy"><i>' + icon('check') + '</i></span><span>' + x[1] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="notice notice-info" style="margin-top:12px">' + icon('info') + '<div>' + (standalone ? 'Вы открыли сайт с экрана «Домой». ' : '') + 'Телефон запоминает значок в момент добавления и сам его не меняет: чтобы на рабочем столе стал другой, <b>удалите старый значок и добавьте сайт заново</b>: он возьмёт тот, что выбран здесь.</div></div>' +
      '<ol class="home-steps">' + steps.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      (installEvt ? '<button class="btn btn-block" type="button" id="hi-install">' + icon('plus') + '<span>Установить приложение</span></button>' : '') +
      '<p class="small" style="margin:10px 0 0">Название на экране: <b>Onion Shop</b>. Значок можно поменять в любой момент.</p>', { cls: 'sm' });
    $$('[data-hi]', md).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-hi'); store.set('homeIcon', id); applyHomeIcon(id);
        $$('[data-hi]', md).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var val = $('#r-home .val'); if (val) val.textContent = (homeIcons().filter(function (x) { return x[0] === id; })[0] || [])[1];
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
    var md = openModal(modalHead('День рождения') + '<p class="muted">Указывается один раз. В день рождения вас ждёт подарок: ониксы, XP и промокод. Подарок получают аккаунты старше 30 дней.</p><div class="f"><label for="m-bday">Дата</label><input class="input" id="m-bday" type="date"></div><button class="btn btn-block" type="button" id="m-save">Сохранить</button>', { cls: 'sm' });
    $('#m-save', md).addEventListener('click', function () {
      var val = $('#m-bday', md).value; if (!val) { toast('Выберите дату', null, 'warn'); return; }
      var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'], mm = +val.slice(5, 7), dd = +val.slice(8, 10);
      closeModal();
      confirmBox({ title: 'Это точная дата?', text: 'Вы указываете день рождения: ' + dd + ' ' + MON[mm - 1] + '. После сохранения изменить дату нельзя, в том числе через менеджера.', actions: [
        { label: 'Изменить', cls: 'btn-ghost', run: bdayModal },
        { label: 'Да, это моя дата', cls: '', run: function () { API.call('profile', { birthday: val.slice(5) }).then(function (r) { if (r.ok) { setUser(r.user); toast(r.bday === 'young' ? 'Дата сохранена. Подарок на день рождения получают аккаунты старше 30 дней' : 'Дата сохранена'); } else toast(r.error, null, 'warn'); }); } }] });
    });
  }
  function framesModal() {
    var u = acct.user, li = u.level.index, prev = u.frame;
    function lockText(f) {
      if (f.src === 'level') return 'Только со статусом «' + RULES.levels[f.lvl].name + '»';
      if (f.src === 'byr') return 'Открывается в игре «Байер»';
      if (f.src === 'ach') { var aa = RULES.achv.filter(function (x) { return x.id === f.ach; })[0]; return 'Достижение «' + (aa ? aa.name : '') + '»: ' + (aa ? aa.d.toLowerCase() : ''); }
      if (f.rare) return 'Редкая, выпадает в посылке';
      return 'Выпадает в посылке';
    }
    function own(f) { return u.frames.indexOf(f.id) >= 0; }
    function fname(id) { return (RULES.frames.filter(function (x) { return x.id === id; })[0] || {}).name || ''; }
    var anims = RULES.frameAnims || [];
    var sorted = RULES.frames.filter(own).concat(RULES.frames.filter(function (f) { return !own(f); }));
    var md = openModal(modalHead('Рамка аватара') + '<div class="fr-prev" id="fr-prev"></div><div class="fr-grid">' + sorted.map(function (f) {
      return '<button type="button" class="fr-it' + (own(f) ? '' : ' lk') + '" data-frame="' + f.id + '" aria-pressed="false">' + ava({ name: u.name, avatar: u.avatar, frame: f.id, frameAnim: u.frameAnim }, 'md') + (own(f) ? '' : '<i class="fr-lock">' + icon('lock') + '</i>') + '<span>' + esc(f.name) + '</span></button>';
    }).join('') + '</div>' +
      (li >= 4 ? '<div class="f" style="margin-top:14px"><span class="lbl">Анимация рамки «Алмаз»</span><div class="choices" id="anims">' + anims.map(function (a) { return '<button class="choice" type="button" data-anim="' + a[0] + '" aria-pressed="' + ((u.frameAnim || 'shine') === a[0]) + '">' + esc(a[1]) + '</button>'; }).join('') + '</div></div>'
        : '<p class="small" style="margin-top:12px">Анимацию можно выбрать со статусом «Алмаз».</p>'), { cls: 'sm' });
    function show(id) {
      prev = id; var f = RULES.frames.filter(function (x) { return x.id === id; })[0] || RULES.frames[0], ok = own(f), wearing = u.frame === f.id;
      $$('[data-frame]', md).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-frame') === id)); });
      $('#fr-prev', md).innerHTML = ava({ name: u.name, avatar: u.avatar, frame: f.id, frameAnim: u.frameAnim }, 'lg') + '<div class="fr-t"><b>' + esc(f.name) + '</b><span class="small">' + (ok ? (wearing ? 'Сейчас надета' : 'Открыта у вас') : esc(lockText(f))) + '</span>' +
        '<button class="btn btn-sm" type="button" id="fr-wear"' + (ok && !wearing ? '' : ' disabled') + '>' + (wearing ? 'Надета' : ok ? 'Надеть' : 'Пока закрыта') + '</button></div>';
      var w = $('#fr-wear', md); if (w) w.addEventListener('click', function () { API.call('profile', { frame: f.id }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Рамка надета'); } else toast(r.error, null, 'warn'); }); });
    }
    $$('[data-frame]', md).forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-frame')); }); });
    $$('[data-anim]', md).forEach(function (b) { b.addEventListener('click', function () { API.call('profile', { frameAnim: b.getAttribute('data-anim'), frame: 'lvl-diamond' }).then(function (r) { if (r.ok) { closeModal(); setUser(r.user); toast('Анимация выбрана'); } else toast(r.error, null, 'warn'); }); }); });
    show(prev);
  }
  // все уровни программы лояльности
  function levelsModal() {
    var u = acct.user, cur = u ? u.level.index : -1, sel = cur < 0 ? 0 : cur;
    var md = openModal(modalHead('Программа лояльности') + '<div class="lm-tabs" role="tablist">' + RULES.levels.map(function (l, i) {
      return '<button type="button" role="tab" class="lm-tab lv-' + l.key + '" data-i="' + i + '">' + lvlImg(l.key, 38) + '<span>' + esc(l.name) + '</span></button>';
    }).join('') + '</div><div class="lm-panel" id="lm-panel"></div>');
    function show(i) {
      sel = i; var l = RULES.levels[i];
      $$('.lm-tab', md).forEach(function (b) { var on = +b.getAttribute('data-i') === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $('#lm-panel', md).innerHTML = '<div class="lh lh-row lv-' + l.key + '">' + emblem(l.key, 60, 3) + '<div class="lh-t"><b class="loyal-name">' + esc(l.name) + (i === cur ? ' <span class="chip">ваш уровень</span>' : '') + '</b><span class="small">' + (l.min ? 'от ' + num(l.min) + ' XP за месяц' : 'сразу после регистрации') + '</span></div></div>' + perkTiles(l.perks);
    }
    $$('.lm-tab', md).forEach(function (b) { b.addEventListener('click', function () { show(+b.getAttribute('data-i')); }); });
    show(sel);
  }
  function deleteModal() {
    var u = acct.user;
    if (!u.canDelete) {
      var act = u.orders.filter(function (o) { return o.active; }).length;
      confirmBox({ title: 'Пока нельзя удалить', text: 'Аккаунт можно удалить, когда нет активных заказов. Сейчас активных: ' + act + '. Дождитесь получения или напишите менеджеру.', actions: [{ label: 'Понятно', cls: 'btn' }] });
      return;
    }
    var md = openModal(modalHead('Удалить аккаунт?') + '<p class="muted">Удалятся данные кабинета, ониксы (' + num(u.balance) + '), промокоды и уровень. Восстановить будет нельзя. При новой регистрации на тот же телефон или почту приветственные бонусы повторно не начисляются.</p>' +
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
      (u.phoneOk ? '' : '<div class="ph-cta"><span class="ph-ic">' + icon('phone') + '</span><div><b>Подтвердите телефон</b><small>10 секунд в Telegram. После этого: приветственные ониксы, бонусы за друзей и подарок на день рождения.</small></div><button class="btn" type="button" id="ph-go">Подтвердить</button></div>') +
      (u.email ? '' : '<div class="notice notice-warn" style="margin-bottom:12px">' + icon('mail') + '<div><b>Добавьте почту.</b> Без неё не получится восстановить пароль. <button class="link-btn" type="button" id="add-email">Добавить</button></div></div>') +
      '<div class="dash">' +
      '<div class="profile c12"><div class="who"><div class="ava-wrap">' + ava(u, 'lg') + '<button class="ava-cam" type="button" id="ava-cam" aria-label="Изменить фото">' + icon('camera') + '</button></div>' +
      '<div style="min-width:0"><h1>' + esc(u.name) + '</h1>' +
      '<div class="meta"><span>@' + esc(u.login) + '</span>' + (u.email ? '<span>' + esc(u.email) + '</span>' : '') + '<button class="idb" type="button" data-copy="' + esc(u.code) + '">ID ' + esc(u.code) + icon('copy') + '</button><span>с нами с ' + esc(since) + '</span></div></div></div>' +
      '<div class="ptiles"><div class="ptile"><small>Ониксы</small><b>' + tk() + num(u.balance) + '</b></div><div class="ptile"><small>Это скидка до</small><b>' + rub(u.balanceRub) + '</b></div><div class="ptile"><small>Серия входов</small><b>' + u.streak + ' ' + plural(u.streak, 'день', 'дня', 'дней') + '</b></div><div class="ptile"><small>Активные заказы</small><b>' + active.length + '</b></div></div>' +
      '<div class="acts"><a class="btn" href="#games">' + icon('gift') + 'Игры</a><a class="btn btn-white" href="#cart">' + icon('bag') + 'Потратить ониксы</a></div></div>' +

      '<div class="card tile c6 loyal lv-' + L.key + '"><div class="tile-h"><h3>Программа лояльности</h3><button class="link-btn" type="button" id="all-levels">Все уровни</button></div>' +
      '<div class="lh lh-row lv-' + L.key + '">' + emblem(L.key, 68, 3) + '<div class="lh-t"><span class="small">Ваш уровень' + (L.fixed ? ' · закреплён менеджером' : '') + '</span><b class="loyal-name">' + esc(L.name) + '</b><span class="xp-num">' + num(u.xp) + ' XP <span class="small">за месяц</span></span></div></div>' +
      (L.next ? '<div class="xp-bar"><div class="bar"><i data-w="' + pctL + '%"></i></div><div class="xp-meta"><span>' + num(u.xp) + ' / ' + num(L.next.min) + ' XP</span><span>до ' + lvlImg(L.next.key, 18) + '«' + esc(L.next.name) + '» ещё <b>' + num(L.next.left) + ' XP</b></span></div></div>' : '') +
      '<div class="lvl-steps">' + RULES.levels.map(function (l, j) { return '<span class="' + (j <= L.index ? 'on' : '') + (j === L.index ? ' cur' : '') + '">' + lvlImg(l.key, 30) + esc(l.name) + '</span>'; }).join('') + '</div>' +
      '<h4 class="perks-h">Ваши привилегии</h4>' + perkTiles(lvlByKey(L.key).perks) + '</div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Задания</h3><span class="side" id="task-side"></span></div>' +
      '<div class="streak">' + streakDays.join('') + '</div>' +
      (u.checkedToday ? '<p class="small">Сегодня отмечено</p>' : '<button class="btn btn-sm" type="button" id="checkin-btn">' + icon('gift') + 'Отметиться · +' + R.checkin + ' и +' + RULES.xpReward.checkin + ' XP</button>') +
      '<div class="ttabs" role="tablist" aria-label="Период заданий" id="task-tabs"></div><div class="tasks" id="task-list"></div></div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Пригласить друга</h3><span class="side">' + u.refCount + ' ' + plural(u.refCount, 'друг', 'друга', 'друзей') + '</span></div>' +
      '<div class="ref-stats"><div><small>Друзей пришло</small><b>' + u.refCount + '</b></div><div><small>Заработано</small><b>' + tk() + num(u.refCount * R.referrer) + '</b></div><div><small>За каждого друга</small><b>+' + R.referrer + '</b></div></div>' +
      '<p class="small ref-note">Друг получает +' + R.refFriend + ' ониксов при регистрации, а вы +' + R.referrer + ', когда он получит первый заказ от ' + num(RULES.refMinOrder) + ' ₽.</p>' +
      '<div class="ref-row"><span class="lnk">' + esc(refLink.replace(/^https?:\/\//, '')) + '</span><button class="icon-btn" type="button" data-copy="' + esc(refLink) + '" aria-label="Скопировать ссылку">' + icon('copy') + '</button><button class="icon-btn acc" type="button" id="ref-share" aria-label="Поделиться">' + icon('share') + '</button></div>' +
      '<p class="small">Ваш код: <b>' + esc(u.refCode) + '</b></p></div>' +

      '<div class="card tile c6"><div class="tile-h"><h3>Промокоды</h3>' + (u.promos.length ? '<span class="side">' + u.promos.length + '</span>' : '') + '</div>' + (u.promos.length ? '<div class="pcs">' + u.promos.map(function (p) { return '<div class="pc"><div class="pc-l"><b>−' + pctTxt(p.pct) + '%</b></div><div class="pc-r"><code>' + esc(p.code) + '</code><span class="small">' + promoLine(p) + '</span></div><button class="icon-btn" type="button" data-copy="' + esc(p.code) + '" aria-label="Скопировать код">' + icon('copy') + '</button></div>'; }).join('') + '</div>' : '<div class="pc-empty">' + icon('ticket') + '<span>Пока нет промокодов.</span></div>') + '</div>' +

      ((u.waits || []).length ? '<div class="card tile c12"><div class="tile-h"><h3>Жду появления</h3><span class="side">' + u.waits.length + '</span></div><div class="waits">' + u.waits.map(function (w) {
        return '<div class="wait-c' + (w.ready ? ' rdy' : '') + '"><a class="wait-ph" href="#p-' + esc(w.id) + '"><img src="' + thumb(w.id) + '" alt="" loading="lazy" width="64" height="64"></a><div class="wait-i"><a href="#p-' + esc(w.id) + '">' + esc(w.title) + '</a>' + (w.ready ? '<span class="wait-st ok">' + icon('check-circle') + 'Уже можно заказать</span>' : '<span class="wait-st">' + icon('hourglass') + 'Сообщим, когда появится</span>') + '</div><button class="icon-btn" type="button" data-wx="' + esc(w.id) + '" aria-label="Больше не ждать">' + icon('x') + '</button></div>';
      }).join('') + '</div></div>' : '') +
      achvTile(u) +
      '<div class="card tile c12"><div class="tile-h"><h3>Мои заказы</h3><a class="link-btn" href="#orders">Все заказы</a></div>' +
      (dashOrders.length ? '<div class="orders">' + dashOrders.map(orderCard).join('') + '</div>' + (u.orders.filter(isDoneOrder).length ? '<p class="small" style="margin-top:10px"><a href="#orders">История заказов · ' + u.orders.filter(isDoneOrder).length + '</a>: завершённые заказы, их можно повторить</p>' : '') : '<p class="small">Здесь появятся заказы с номерами и статусами. <a href="#catalog">Перейти в каталог</a></p>') + '</div>' +

      '<div class="card tile c12" style="padding-block:6px"><div class="rows">' +
      '<button class="rowl" type="button" id="r-prof"><span class="ic">' + icon('user') + '</span><span class="tx">Имя, телефон и Telegram</span><span class="val">' + esc(u.phone) + '</span>' + icon('chevron-right') + '</button>' +
      '<a class="rowl" href="#info"><span class="ic">' + icon('info') + '</span><span class="tx">Частые вопросы</span>' + icon('chevron-right') + '</a>' +
      (API.enabled ? '<button class="rowl" type="button" id="r-tg"><span class="ic">' + icon('send') + '</span><span class="tx">Уведомления в Telegram</span><span class="val">' + (u.tgOn ? 'подключены' : 'не подключены') + '</span>' + icon('chevron-right') + '</button>' : '') +
      '<button class="rowl" type="button" id="r-email"><span class="ic">' + icon('mail') + '</span><span class="tx">Почта</span><span class="val">' + (u.email ? esc(u.email) : 'не указана') + '</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-pass"><span class="ic">' + icon('key') + '</span><span class="tx">Сменить пароль</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-home"><span class="ic">' + icon('phone') + '</span><span class="tx">Добавить на экран «Домой»</span><span class="val">' + esc((homeIcons().filter(function (x) { return x[0] === homeIcon(); })[0] || [])[1]) + '</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-theme"><span class="ic">' + icon(themeMode() === 'dark' ? 'moon' : 'sun') + '</span><span class="tx">Тема оформления</span><span class="val">' + THEME_NAMES[themeMode()] + '</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl" type="button" id="r-bday"' + (bd ? ' disabled' : '') + '><span class="ic">' + icon('gift') + '</span><span class="tx">День рождения</span><span class="val">' + (bd ? (+bd[1]) + ' ' + MONTHS[+bd[0] - 1] : 'указать') + '</span>' + (bd ? '' : icon('chevron-right')) + '</button>' +
      '<button class="rowl" type="button" id="r-frame"><span class="ic">' + icon('star') + '</span><span class="tx">Рамка аватара</span><span class="val">' + esc((RULES.frames.filter(function (f) { return f.id === u.frame; })[0] || {}).name || '') + '</span>' + icon('chevron-right') + '</button>' +
      (u.avatar ? '<button class="rowl" type="button" id="r-noava"><span class="ic">' + icon('camera') + '</span><span class="tx">Убрать фото</span>' + icon('chevron-right') + '</button>' : '') +
      '<button class="rowl" type="button" id="r-logout"><span class="ic">' + icon('logout') + '</span><span class="tx">Выйти</span>' + icon('chevron-right') + '</button>' +
      '<button class="rowl danger" type="button" id="r-del"><span class="ic">' + icon('trash') + '</span><span class="tx">Удалить аккаунт</span>' + icon('chevron-right') + '</button>' +
      '</div></div></div>';
    growBars(v); drawTasks(v);
    var on = function (id, fn) { var el = $('#' + id, v); if (el) el.addEventListener('click', fn); };
    on('ava-cam', pickAvatar); on('add-email', emailModal); on('r-prof', profileModal); on('r-email', emailModal); on('r-pass', passModal); on('r-home', homeModal); on('r-theme', themeModal);
    on('r-tg', tgModal); on('r-bday', bdayModal); on('r-frame', framesModal); on('r-del', deleteModal); on('all-levels', levelsModal);
    on('r-noava', function () { API.call('profile', { avatar: '' }).then(function (r) { if (r.ok) { setUser(r.user); toast('Фото убрано'); } }); });
    on('r-logout', function () { API.call('logout'); API.setSession(''); setUser(null); toast('Вы вышли из аккаунта'); });
    on('checkin-btn', function () { doCheckin($('#checkin-btn', v)); });
    on('ref-share', function () {
      var text = 'Заходи в ONION SHOP, по моей ссылке +' + R.refFriend + ' ониксов при регистрации';
      try { if (navigator.share) { navigator.share({ title: 'ONION SHOP', text: text, url: refLink }).catch(function () { /* отменили */ }); return; } } catch (e) { /* */ }
      copyText(refLink, 'Ссылка-приглашение скопирована');
    });
    $$('[data-wx]', v).forEach(function (b) { b.addEventListener('click', function () { API.call('waitlist', { productId: b.getAttribute('data-wx'), on: false }).then(function (r) { if (r.ok) setUser(r.user); }); }); });
    bindOrders(v, dashOrders);
  }

  // ------------------------------------------------------------ рулетка (карусель)
  var spinning = false, rlTimer = null, rlPos = 0;
  var RL_ORD = ['t25', 'promo', 't100', 'xp', 'none', 't200', 'frame', 't50', 're1', 'xp100', 't300', 't150', 'xp150', 'promo5', 't500', 're2', 'xp300', 't1000', 'frame2', 'xp500', 'jackpot'];
  var RL_COL = { tok: ['#8fe8fb', '#1a86c0', '#0b4f7a', 'rgba(67,201,227,.75)'], xp: ['#cfe0ff', '#4a76ec', '#14337f', 'rgba(74,118,236,.75)'], fr: ['#ffd0f0', '#c05bf0', '#6a2fa8', 'rgba(220,110,255,.7)'], pr: ['#ffe9a0', '#ffa81c', '#a05400', 'rgba(255,170,40,.7)'], re: ['#c6ffe3', '#2bd08f', '#0b7f58', 'rgba(43,208,143,.7)'], none: ['#dbe3f0', '#8f9db6', '#5a6781', 'rgba(150,170,205,.5)'] };
  function rlInfo(id) {
    var w = RULES.wheel.filter(function (x) { return x.id === id; })[0] || { id: id };
    var c = w.tokens ? 'tok' : w.xp ? 'xp' : w.frame ? 'fr' : w.promo ? 'pr' : w.spins ? 're' : 'none';
    return { id: id, c: c, n: w.tokens || w.xp || w.promo || w.spins || 0, rare: w.frame === 'rare' };
  }
  function rlSym(p) { return p.c === 'tok' ? 'i-token' : p.c === 'xp' ? 'rl-xp' : p.c === 'fr' ? (p.rare ? 'rl-frame2' : 'rl-frame') : p.c === 'pr' ? 'rl-ticket' : p.c === 're' ? 'rl-again' : 'rl-empty'; }
  function rlUse(id, w, cls) { return '<svg class="rl-ico ' + (cls || '') + '" style="width:' + w + 'px;height:' + w + 'px" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function rlBig(p) { return (p.c === 'tok' && p.n >= 300) || (p.c === 'xp' && p.n >= 300) || (p.c === 'fr' && p.rare) || (p.c === 'pr' && p.n >= 5) || (p.c === 're' && p.n >= 2); }
  function rlStars() {
    function sp(x, y, d, s) { return '<div class="rl-spk" style="left:' + x + '%;top:' + y + 'px;animation-delay:' + d + 's;width:' + s + 'px;height:' + s + 'px">' + rlUse('rl-spark', s) + '</div>'; }
    return sp(10, 40, 0, 22) + sp(84, 36, .7, 26) + sp(88, 170, 1.3, 18) + sp(6, 190, .4, 16);
  }
  function rlSlide(c, inner) { return '<div class="rl-slide" style="--c1:' + c[0] + ';--c2:' + c[1] + ';--c3:' + c[2] + ';--g:' + c[3] + '"><div class="rl-art"><div class="rl-aura"></div>' + rlStars() + inner + '</div></div>'; }
  function rlBigIc(id, sz, top) { return '<div class="rl-big" style="top:' + top + 'px">' + rlUse(id, sz) + '</div>'; }
  function rlArt(p, pr) {
    var c = RL_COL[p.c], h = '', n = p.n;
    if (p.c === 'tok') h = rlBigIc('i-token', 150, 6) + '<div class="rl-num" style="top:160px;font-size:' + (n >= 1000 ? 58 : 66) + 'px">+' + n + '</div><div class="rl-cap" style="top:246px">' + tokWord(n) + '</div>';
    else if (p.c === 'xp') h = rlBigIc('rl-xp', 146, 8) + '<div class="rl-num" style="top:160px;font-size:66px">+' + n + '</div><div class="rl-cap" style="top:246px">опыт XP</div>';
    else if (p.c === 'pr') h = rlBigIc('rl-ticket', 146, 8) + '<div class="rl-num" style="top:160px;font-size:66px">−' + n + '%</div><div class="rl-cap" style="top:246px">скидка по промокоду</div>';
    else if (p.c === 'fr') h = rlBigIc(p.rare ? 'rl-frame2' : 'rl-frame', 170, 10) + '<div class="rl-cap" style="top:214px">' + (pr && pr.frameName ? 'рамка «' + esc(pr.frameName) + '»' : p.rare ? 'редкая рамка для аватара' : 'рамка для аватара') + '</div>';
    else if (p.c === 're') h = rlBigIc('rl-again', 124, 6) + '<div class="rl-num" style="top:138px;font-size:56px">×' + n + '</div><div class="rl-cap" style="top:222px">' + (n === 1 ? 'бесплатная посылка' : 'бесплатные посылки') + '</div>';
    else h = rlBigIc('rl-empty', 150, 20) + '<div class="rl-cap" style="top:206px">Пусто, в другой раз</div>';
    return rlSlide(c, h);
  }
  function rlMystery() { return rlSlide(RL_COL.tok, '<div class="rl-num" style="top:62px;font-size:130px">?</div><div class="rl-cap" style="top:226px">Крутим…</div>'); }
  function updateRoulBalance() {
    var u = acct.user, b = $('#roul-bal'); if (!b || !u) return;
    b.innerHTML = tk('lg') + '<span>' + num(u.balance) + '</span>';
    var fb = $('#spin-free'); if (fb) { fb.hidden = !u.freeSpins; fb.textContent = 'Открыть бесплатно'; fb.disabled = spinning; }
    var fbd = $('#roul-free'); if (fbd) fbd.textContent = u.freeSpins ? 'Бесплатных посылок: ' + u.freeSpins : 'Раз в день бесплатно';
    var pbtn = $('#spin-paid'); if (pbtn) { pbtn.disabled = spinning || u.balance < RULES.spinCost; pbtn.querySelector('span').textContent = spinning ? 'Сканируем…' : 'Открыть за ' + RULES.spinCost; }
  }
  /* ------------------------------------------------------------ «Игры» и «Байер»
     Экран выбора игры. Сама игра «Байер» (3D) подгружается по требованию: assets/g3d.js и assets/byer.js.
     Все правила, случайность и награды на сервере (actions byr*). */
  var byerGame = null, byerBusy = false;
  function renderGames() {
    var v = $('#v-games'), u = acct.user;
    v.innerHTML = '<div class="pad roul-head" style="padding:0 0 10px"><div><h1>Игры</h1><p class="roul-sub">Играйте и получайте ониксы, опыт и рамки</p></div></div>' +
      '<div class="gm-bar">' + (u ? '<span class="rl-chipb">' + tk('lg') + '<span>' + num(u.balance) + '</span></span>' : '<span class="rl-free">Войдите, чтобы играть и получать призы</span>') + '</div>' +
      '<div class="gm-grid">' +
      '<a class="gm-card gm-p" href="#roulette"><span class="gm-ic">' + icon('gift', 'lg') + '</span><h2>Посылка с сюрпризом</h2><p>Рентген показывает приз: ониксы, промокод, опыт или рамка для аватара.</p><span class="gm-tag" id="gm-free">' + (u ? (u.freeSpins ? 'Бесплатных посылок: ' + u.freeSpins : 'Раз в день бесплатно') : 'Раз в день бесплатно') + '</span></a>' +
      '<a class="gm-card gm-b" href="#byer"><span class="gm-ic gm-3d"><svg viewBox="0 0 24 24"><path d="M3.5 8.5L12 4l8.5 4.5v7L12 20l-8.5-4.5zM12 12v8M3.5 8.5L12 12l8.5-3.5"/></svg></span><h2>Байер</h2><p>3D игра: бегайте по кварталу, носите посылки клиентам, прокачивайте мастерскую и растите до шоурума.</p><span class="gm-tag" id="gm-by">' + (u ? 'Загружаем…' : 'Нужен вход') + '</span></a>' +
      '</div>';
    if (u && API.enabled) API.call('byrState').then(function (r) {
      var t = $('#gm-by'); if (!t) return; if (!r.ok) { t.textContent = 'Играть'; return; }
      var b = r.byr; t.textContent = b.stageName + ', смен: ' + b.charges + ' из ' + b.chargeMax;
    }, function () { var t = $('#gm-by'); if (t) t.textContent = 'Играть'; });
  }
  function loadJs(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s);
    });
  }
  function openByer() {
    var u = acct.user;
    if (byerGame || byerBusy) return;
    if (!API.enabled) { toast('Игра скоро появится', null, 'warn'); silentHash('games'); return; }
    if (!u) { if (!acct.ready) return; requireAuth('byer'); return; }
    byerBusy = true;
    var me = document.querySelector('script[src*="assets/app.js"]'), q = me && /\?v=[^"&]+/.exec(me.getAttribute('src') || ''), v = q ? q[0] : '';
    toast('Открываем игру…');
    Promise.all([loadJs('assets/g3d.js' + v), 0]).then(function () { return loadJs('assets/byer.js' + v); })
      .then(function () { return API.call('byrState'); })
      .then(function (r) {
        byerBusy = false;
        if (!r.ok) { toast(r.error || 'Не удалось открыть игру', null, 'warn'); silentHash('games'); return; }
        var g = window.Byer.open({
          state: r.byr,
          call: function (a, p) { return API.call(a, p); },
          onUser: function (nu) { setUserLite(nu); },
          toast: function (m, kind) { if (kind === 'warn') toast(m, null, 'warn'); else reward(m); },
          onClose: function () { byerGame = null; if (location.hash.slice(1) === 'byer') { silentHash('games'); } renderGames(); setNav('games'); }
        });
        if (g.fail) { toast(g.fail, null, 'warn'); silentHash('games'); return; }
        byerGame = g;
      }, function () { byerBusy = false; toast('Нет связи, попробуйте ещё раз', null, 'warn'); silentHash('games'); });
  }

  /* ------------------------------------------------------------ «Посылка на рентгене»
     Одна кнопка: посылка из Китая едет в сканер таможни, рентген показывает, что внутри,, штамп «ПРОВЕРЕНО».
     Приз и списание ониксов определяет сервер (тот же action 'spin', те же шансы и цена). */
  var pxStop = null;
  function pxIcon(info, pr) {
    if (pr && pr.frameId) return '<span class="px-ava">' + ava({ name: acct.user && acct.user.name, avatar: acct.user && acct.user.avatar, frame: pr.frameId }, 'lg') + '</span>';
    return rlUse(rlSym(info), 92);
  }
  function pxCap(info, pr) {
    var n = info.n;
    if (info.c === 'tok') return ['+' + num(n), tokWord(n)];
    if (info.c === 'xp') return ['+' + n + ' XP', 'опыт к уровню'];
    if (info.c === 'pr') return ['−' + n + '%', 'промокод' + (pr && pr.code ? ' ' + pr.code : '')];
    if (info.c === 'fr') return [pr && pr.frameName ? '«' + pr.frameName + '»' : info.rare ? 'Редкая рамка' : 'Рамка', 'для аватара'];
    if (info.c === 're') return ['+' + n, n === 1 ? 'посылка бесплатно' : 'посылки бесплатно'];
    return ['Пусто', 'в этот раз посылка пустая'];
  }
  /* ---- ангар: фон и «живые» декорации. Люди и техника появляются в случайном порядке,
     с разной скоростью, остановками и занятиями, поэтому сцена не повторяется. */
  var HG_BG = '<svg class="hg-bg" viewBox="0 0 400 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<defs><linearGradient id="hgw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3957"/><stop offset="1" stop-color="#3d4d6c"/></linearGradient>' +
    '<linearGradient id="hgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f3ff"/><stop offset="1" stop-color="#9cc9ee"/></linearGradient>' +
    '<linearGradient id="hgs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0ff" stop-opacity=".55"/><stop offset="1" stop-color="#bfe0ff" stop-opacity="0"/></linearGradient></defs>' +
    '<rect width="400" height="130" fill="url(#hgw)"/>' +
    '<g stroke="#0b1530" stroke-opacity=".28" stroke-width="1.2"><path d="M0 22H400"/><path d="M0 12L50 22L100 12L150 22L200 12L250 22L300 12L350 22L400 12"/><path d="M0 12H400"/></g>' +
    '<g fill="#0b1530" fill-opacity=".14"><rect x="20" y="26" width="3" height="104"/><rect x="92" y="26" width="3" height="104"/><rect x="164" y="26" width="3" height="104"/><rect x="236" y="26" width="3" height="104"/><rect x="308" y="26" width="3" height="104"/><rect x="380" y="26" width="3" height="104"/></g>' +
    '<g><rect x="34" y="30" width="46" height="14" rx="2" fill="url(#hgd)"/><rect x="132" y="30" width="46" height="14" rx="2" fill="url(#hgd)"/><rect x="222" y="30" width="46" height="14" rx="2" fill="url(#hgd)"/>' +
    '<path d="M34 44L80 44L96 130L18 130Z" fill="url(#hgs)" opacity=".5"/><path d="M222 44L268 44L284 130L206 130Z" fill="url(#hgs)" opacity=".4"/></g>' +
    '<g><rect x="296" y="46" width="80" height="84" rx="3" fill="url(#hgd)"/><g fill="#8794ad"><rect x="296" y="46" width="80" height="6"/><rect x="296" y="55" width="80" height="6"/><rect x="296" y="64" width="80" height="6"/></g><rect x="292" y="42" width="88" height="5" fill="#243050"/></g>' +
    '<g><rect x="8" y="62" width="64" height="3" fill="#7e8ba6"/><rect x="8" y="88" width="64" height="3" fill="#7e8ba6"/><rect x="8" y="114" width="64" height="3" fill="#7e8ba6"/><rect x="8" y="62" width="3" height="68" fill="#7e8ba6"/><rect x="69" y="62" width="3" height="68" fill="#7e8ba6"/>' +
    '<rect x="14" y="74" width="18" height="14" fill="#c99358"/><rect x="34" y="70" width="14" height="18" fill="#b4814a"/><rect x="50" y="76" width="16" height="12" fill="#d3a46b"/><rect x="14" y="100" width="22" height="14" fill="#b4814a"/><rect x="38" y="96" width="12" height="18" fill="#c99358"/><rect x="52" y="102" width="14" height="12" fill="#d3a46b"/></g>' +
    '<g transform="translate(150 48)"><rect width="100" height="14" rx="2" fill="#f2c230"/><g fill="#1b2236"><path d="M0 0h8l-8 14zM14 0h8L8 14H0zM28 0h8L22 14h-8zM42 0h8L36 14h-8zM56 0h8L50 14h-8zM70 0h8L64 14h-8zM84 0h8L78 14h-8zM98 0h2v14h-8z" opacity=".16"/></g><text x="50" y="10.4" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8.4" font-weight="800" fill="#1b2236" letter-spacing=".6">ЗОНА ДОСМОТРА</text></g>' +
    '</svg>';
  var HG_LAMPS = '<i class="hg-lamp" style="left:14%"></i><i class="hg-lamp" style="left:50%"></i><i class="hg-lamp" style="left:86%"></i>';
  function hgRand(a, b) { return a + Math.random() * (b - a); }
  function hgPick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var HG_VEST = ['#ff8a2a', '#ffd23a', '#79d97a', '#ff6b6b', '#58b8ff'], HG_HELM = ['#ffffff', '#ffd23a', '#2d7cff', '#ff8a2a'], HG_SKIN = ['#e9b996', '#c98f66', '#8d5a3b', '#f2cfae'];
  function hgWorkerSvg(vest, helm, skin, hold) {
    var h = hold === 'box' ? '<rect x="14.5" y="17" width="11" height="9" rx="1" fill="#c99358"/><rect x="14.5" y="20" width="11" height="2" fill="#ecd0a6"/>' : hold === 'tab' ? '<rect x="15" y="17" width="7" height="9" rx="1" fill="#1d2740" stroke="#9fd0ff" stroke-width=".8"/>' : '';
    return '<svg viewBox="0 0 28 46" width="28" height="46" aria-hidden="true">' +
      '<g class="hw-l hw-l1"><rect x="8" y="28" width="4.6" height="16" rx="1.8" fill="#263253"/><rect x="7.2" y="42" width="7" height="3.2" rx="1.4" fill="#0f1830"/></g>' +
      '<g class="hw-l hw-l2"><rect x="14" y="28" width="4.6" height="16" rx="1.8" fill="#34426a"/><rect x="13.4" y="42" width="7" height="3.2" rx="1.4" fill="#0f1830"/></g>' +
      '<g class="hw-a hw-a2"><rect x="17.2" y="14" width="3.6" height="13" rx="1.8" fill="' + vest + '"/></g>' +
      '<rect x="6" y="12" width="15" height="18" rx="4.5" fill="' + vest + '"/><rect x="6" y="19.5" width="15" height="2.4" fill="#f4f9ff" opacity=".85"/>' +
      '<rect x="11.6" y="9" width="4.2" height="4" fill="' + skin + '"/><circle cx="13.6" cy="7.6" r="5" fill="' + skin + '"/>' +
      '<path d="M8.2 7.4a5.4 5.4 0 0 1 10.8 0z" fill="' + helm + '"/><rect x="7.4" y="6.8" width="12.4" height="1.9" rx=".9" fill="' + helm + '"/>' +
      '<g class="hw-a hw-a1"><rect x="5" y="14" width="3.6" height="13" rx="1.8" fill="' + vest + '" opacity=".82"/></g>' + h + '</svg>';
  }
  function hgCartSvg() {
    var bx = '', n = 1 + Math.floor(Math.random() * 3), i;
    for (i = 0; i < n; i++) bx += '<rect x="' + (6 + i * 11) + '" y="' + (6 + (i % 2) * 2) + '" width="' + (9 + Math.floor(Math.random() * 4)) + '" height="' + (11 - (i % 2) * 2) + '" rx="1" fill="' + hgPick(['#c99358', '#b4814a', '#d3a46b']) + '"/>';
    return '<svg class="hg-cart" viewBox="0 0 44 30" width="44" height="30" aria-hidden="true">' + bx + '<rect x="3" y="17" width="38" height="4" rx="1.5" fill="#8794ad"/><path d="M3 17V5" stroke="#8794ad" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="25" r="3.6" fill="#1b2236"/><circle cx="34" cy="25" r="3.6" fill="#1b2236"/></svg>';
  }
  function hgForkSvg(load) {
    var ld = '';
    if (load) ld = '<rect x="62" y="31" width="20" height="3" fill="#b78650"/><rect x="63" y="19" width="17" height="12" rx="1" fill="#c99358"/><rect x="63" y="25" width="17" height="2.4" fill="#ecd0a6"/>' + (Math.random() < .5 ? '<rect x="66" y="9" width="12" height="10" rx="1" fill="#b4814a"/>' : '');
    return '<svg viewBox="0 0 88 58" width="88" height="58" aria-hidden="true">' +
      '<rect x="56" y="4" width="4" height="46" fill="#3b4767"/><g class="fk-fork"><rect x="58" y="34" width="26" height="3.4" fill="#9aa7bd"/><rect x="58" y="22" width="3" height="15" fill="#9aa7bd"/>' + ld + '</g>' +
      '<rect x="3" y="22" width="16" height="24" rx="4" fill="#d9860b"/><rect x="8" y="26" width="46" height="20" rx="4.5" fill="#f6a21a"/>' +
      '<path d="M22 26V9H46V26" fill="none" stroke="#26324a" stroke-width="2.4"/><rect x="20" y="6" width="28" height="4" rx="1.5" fill="#26324a"/>' +
      '<circle cx="34" cy="17" r="3.6" fill="#e9b996"/><path d="M30.2 16.6a3.8 3.8 0 0 1 7.6 0z" fill="#ffd23a"/><rect x="30" y="20" width="8" height="7" rx="2" fill="#ff8a2a"/>' +
      '<circle cx="35" cy="3.4" r="2.6" class="fk-beacon" fill="#ff7a00"/>' +
      '<g class="hg-wh"><circle cx="22" cy="49" r="7.4" fill="#151c2f"/><circle cx="22" cy="49" r="3" fill="#8794ad"/><rect x="21.2" y="42.4" width="1.6" height="13.2" fill="#3b4767"/></g><g class="hg-wh"><circle cx="50" cy="50" r="5.6" fill="#151c2f"/><circle cx="50" cy="50" r="2.2" fill="#8794ad"/><rect x="49.3" y="45" width="1.4" height="10" fill="#3b4767"/></g></svg>';
  }
  function hgVanSvg() {
    return '<svg viewBox="0 0 116 58" width="116" height="58" aria-hidden="true">' +
      '<rect x="3" y="6" width="80" height="38" rx="6" fill="#eef3fb"/><rect x="3" y="28" width="80" height="6" fill="' + hgPick(['#2d7cff', '#ff8a2a', '#2fb67a']) + '"/>' +
      '<path d="M83 14H100Q108 14 112 26L113 44H83Z" fill="#dfe7f3"/><path d="M90 18H100Q105 18 108 26H90Z" fill="#8fd0ff"/><rect x="2" y="42" width="112" height="4" rx="2" fill="#7e8ba6"/>' +
      '<g class="hg-wh"><circle cx="28" cy="49" r="7.6" fill="#151c2f"/><circle cx="28" cy="49" r="3" fill="#8794ad"/><rect x="27.2" y="42.2" width="1.6" height="13.6" fill="#3b4767"/></g><g class="hg-wh"><circle cx="92" cy="49" r="7.6" fill="#151c2f"/><circle cx="92" cy="49" r="3" fill="#8794ad"/><rect x="91.2" y="42.2" width="1.6" height="13.6" fill="#3b4767"/></g></svg>';
  }
  /* сцена: box, belt, tunnel, actors */
  function pxHangar(root) {
    var layer = $('#hg-actors', root), box = $('#px-hangar', root), alive = 0, last = '', stopped = false, cars = 0;
    function W() { return box.clientWidth || 340; }
    function ok() { return !stopped && document.body.contains(layer); }
    function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
    /* Глубина d: 0 у самой ленты, 1 у дальней стены. Высоту «пола» читаем из вёрстки (на телефоне и компьютере она разная),
       поэтому колёса и ноги всегда стоят на полу, а не над стыком пола со стеной. Чем дальше, тем мельче. */
    function lane(d) {
      var fl = box.querySelector('.hg-floor'), rl = box.querySelector('.px-rollers');
      var floorTop = fl ? fl.offsetHeight : 80, beltTop = rl ? Math.round(box.getBoundingClientRect().bottom - rl.getBoundingClientRect().top) : 28;
      if (!(beltTop > 0 && beltTop < floorTop)) beltTop = 28;
      var near = beltTop + 6, far = Math.max(near + 10, floorTop - 10);
      return { yb: Math.round(near + d * (far - near)), sc: +(1 - d * 0.28).toFixed(3) };
    }
    function mk(html, cls, d, w) {
      var L = lane(d), el = document.createElement('div');
      el.className = 'hg-a ' + (cls || ''); el.style.bottom = L.yb + 'px'; el.style.zIndex = String(100 - Math.round(d * 60)); el.style.width = w + 'px';
      el.innerHTML = '<div class="hg-sc" style="transform:scale(' + L.sc + ')"><div class="hg-in">' + html + '</div></div>'; layer.appendChild(el); alive++; el._d = d; return el;
    }
    function done(el) { if (el.parentNode) el.parentNode.removeChild(el); alive--; if (el._car) cars--; }
    function face(el, dir) { el.querySelector('.hg-in').classList.toggle('rev', dir < 0); }
    function go(el, x0, x1, speed, ease) {
      return new Promise(function (res) {
        if (!ok()) { res(); return; }
        face(el, x1 >= x0 ? 1 : -1); el.classList.add('mv');
        var an = el.animate([{ transform: 'translateX(' + x0 + 'px)' }, { transform: 'translateX(' + x1 + 'px)' }], { duration: Math.max(60, Math.abs(x1 - x0) / speed * 1000), easing: ease || 'linear', fill: 'forwards' });
        an.onfinish = function () { el.classList.remove('mv'); res(); }; an.oncancel = function () { res(); };
      });
    }
    var ARRIVE = 'cubic-bezier(.25,.6,.35,1)', LEAVE = 'cubic-bezier(.55,0,.75,.45)';
    function worker(opt) {
      opt = opt || {};
      var w = W(), kind = opt.kind || hgPick(['walk', 'walk', 'box', 'box', 'cart', 'check', 'wave']), dir = opt.dir || (Math.random() < .5 ? 1 : -1);
      var vest = hgPick(HG_VEST), helm = hgPick(HG_HELM), skin = hgPick(HG_SKIN), d = opt.d != null ? opt.d : hgRand(.15, .95);
      var hold = kind === 'box' ? 'box' : kind === 'check' ? 'tab' : '';
      var el = mk('<span class="hg-ppl' + (kind === 'box' ? ' hw-carry' : '') + '">' + hgWorkerSvg(vest, helm, skin, hold) + '</span>' + (kind === 'cart' ? hgCartSvg() : ''), 'hg-w', d, kind === 'cart' ? 74 : 28);
      var ppl = el.querySelector('.hg-ppl'); ppl.style.setProperty('--st', hgRand(.5, .85).toFixed(2) + 's');
      var speed = (kind === 'cart' ? hgRand(20, 30) : hgRand(26, 50)) * (1 - d * .28), x0 = opt.x0 != null ? opt.x0 : (dir > 0 ? -90 : w + 20), far = dir > 0 ? w + 20 : -90;
      var p1 = opt.stopAt != null ? opt.stopAt : hgRand(.18, .82) * w;
      go(el, x0, p1, speed).then(function () {
        if (!ok()) return;
        var act = opt.act || (kind === 'check' ? 'look' : kind === 'wave' ? 'wave' : Math.random() < .4 ? hgPick(['look', 'look', 'back']) : '');
        if (!act) return go(el, p1, far, speed);
        ppl.classList.add('hw-stand');
        if (act === 'wave') ppl.classList.add('hw-wave');
        return wait(hgRand(1400, 3600)).then(function () {
          ppl.classList.remove('hw-stand', 'hw-wave');
          if (act === 'back') return go(el, p1, dir > 0 ? -90 : w + 20, speed);
          return go(el, p1, far, speed);
        });
      }).then(function () { done(el); });
      return el;
    }
    /* техника: одновременно не больше одной машины, чтобы погрузчик и фургон не проезжали друг сквозь друга */
    function fork() {
      var w = W(), dir = Math.random() < .5 ? 1 : -1, load = Math.random() < .65, el = mk(hgForkSvg(load), 'hg-f', hgRand(.04, .22), 88);
      el._car = true; cars++;
      var x0 = dir > 0 ? -110 : w + 30, far = dir > 0 ? w + 30 : -110, speed = hgRand(46, 70), p1 = hgRand(.25, .75) * w, stopIt = Math.random() < .6;
      var mast = el.querySelector('.fk-fork');
      go(el, x0, stopIt ? p1 : far, speed, stopIt ? ARRIVE : 'linear').then(function () {
        if (!stopIt || !ok()) return;
        mast.style.transition = 'transform .9s ease-in-out'; mast.style.transform = 'translateY(' + (Math.random() < .5 ? -16 : -6) + 'px)';
        return wait(hgRand(1500, 2600)).then(function () { mast.style.transform = 'translateY(0)'; return wait(900); }).then(function () { return go(el, p1, far, speed, LEAVE); });
      }).then(function () { done(el); });
    }
    function van() {
      var w = W(), dir = Math.random() < .5 ? 1 : -1, d = hgRand(.62, .78), el = mk(hgVanSvg(), 'hg-v', d, 116);
      el._car = true; cars++;
      var x0 = dir > 0 ? -140 : w + 30, far = dir > 0 ? w + 30 : -140, speed = hgRand(55, 80), p1 = hgRand(.3, .7) * w, stopIt = Math.random() < .7;
      go(el, x0, stopIt ? p1 : far, speed, stopIt ? ARRIVE : 'linear').then(function () {
        if (!stopIt || !ok()) return;
        if (Math.random() < .6) worker({ x0: p1 + 40, dir: -dir, kind: 'box', d: Math.max(.1, d - .3), stopAt: p1 + 40 + (dir > 0 ? -1 : 1) * 60 });
        return wait(hgRand(2200, 4200)).then(function () { return go(el, p1, far, speed, LEAVE); });
      }).then(function () { done(el); });
    }
    function pair() {
      var w = W(), mid = hgRand(.35, .65) * w, d = hgRand(.3, .7);
      worker({ dir: 1, x0: -90, stopAt: mid - 18, act: 'look', kind: 'walk', d: d });
      worker({ dir: -1, x0: w + 20, stopAt: mid + 18, act: 'wave', kind: 'walk', d: d });
    }
    function next() {
      if (!ok()) return;
      if (alive < 4 && !document.hidden && layer.offsetParent) {
        var kinds = ['w', 'w', 'w', 'w', 'f', 'f', 'v', 'p'].filter(function (k) { return k !== last || k === 'w'; }), k = hgPick(kinds);
        if ((k === 'f' || k === 'v') && cars) k = 'w';
        last = k;
        if (k === 'f') fork(); else if (k === 'v') van(); else if (k === 'p') pair(); else worker();
      }
      setTimeout(next, hgRand(1100, 2800));
    }
    function lamps() {
      if (!ok()) return;
      var ls = box.querySelectorAll('.hg-lamp'), l = ls[Math.floor(Math.random() * ls.length)];
      if (l) { l.classList.add('flick'); setTimeout(function () { l.classList.remove('flick'); }, hgRand(160, 420)); }
      setTimeout(lamps, hgRand(2500, 7000));
    }
    if (window.__HGDEBUG) window.__hg = { fork: fork, van: van, worker: worker, pair: pair };
    if (REDUCED) { worker({ x0: .3 * W(), stopAt: .3 * W(), act: 'look' }); return function () { stopped = true; }; }
    worker({ dir: 1, x0: hgRand(.1, .35) * W(), kind: 'box' }); worker({ dir: -1, x0: hgRand(.6, .9) * W(), kind: 'walk', d: hgRand(.4, .9) });
    setTimeout(next, 900); setTimeout(lamps, 2000);
    return function () { stopped = true; };
  }
  function renderRoulette() {
    var v = $('#v-roulette');
    clearInterval(rlTimer); rlTimer = null;
    if (pxStop) { pxStop(); pxStop = null; }
    if (!API.enabled) { v.innerHTML = '<div class="empty"><span class="ico">' + icon('gift') + '</span><h3>Посылка скоро появится</h3><a class="btn" href="#catalog">В каталог</a></div>'; return; }
    var u = acct.user, busyNow = false, idleI = 0, IDLE = ['t100', 'xp100', 'promo', 'frame', 're1', 't500'];
    var CAP0 = '<b>Что внутри?</b><span>Посылка проходит рентген, и вы сразу видите приз</span>';
    v.innerHTML = '<div class="pad roul-head" style="padding:0 0 10px"><div><h1>Посылка с сюрпризом</h1></div></div>' +
      '<section class="px" id="px">' +
      '<div class="rl-bar">' + (u ? '<span class="rl-chipb" id="roul-bal"></span><span class="rl-free" id="roul-free"></span>' : '<span class="rl-chipb">' + rlUse('i-token', 26) + '<span>Посылка</span></span><span class="rl-free">Войдите, чтобы открыть</span>') + '</div>' +
      '<div class="px-station">' +
        '<div class="px-mon" id="px-mon"><div class="px-mon-h"><span>РЕНТГЕН</span><span id="px-st">ГОТОВ</span></div>' +
          '<div class="px-screen" id="px-screen"><i class="px-grid"></i><div class="px-box"><i class="px-tape"></i><div class="px-item" id="px-item"></div></div><i class="px-beam"></i><b class="px-stamp" id="px-stamp">ПРОВЕРЕНО</b></div></div>' +
        '<div class="px-hangar" id="px-hangar">' + HG_BG + HG_LAMPS + '<div class="hg-floor"></div><div class="hg-actors" id="hg-actors"></div>' +
          '<div class="px-belt" id="px-belt"><div class="px-tunnel"><b class="px-beacon"></b><i></i></div><div class="px-parcel" id="px-parcel"><i class="px-ptape"></i><span class="px-lbl"><i></i></span><img src="' + LOGO + '" alt="" width="22" height="22"></div><div class="px-rollers"></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="px-cap" id="px-cap" aria-live="polite">' + CAP0 + '</div>' +
      (u ? '<button class="rl-go" id="spin-paid" type="button">' + rlUse('i-token', 24) + '<span>Открыть за ' + RULES.spinCost + '</span></button><button class="rl-go2" id="spin-free" type="button" hidden></button>' : '<button class="rl-go" id="spin-guest" type="button">' + icon('user') + '<span>Войти и получить ' + RULES.reward.register + ' ' + tokWord(RULES.reward.register) + '</span></button>') +
      '</section>';
    var px = $('#px', v), item = $('#px-item', v), cap = $('#px-cap', v), st = $('#px-st', v), stamp = $('#px-stamp', v), parcel = $('#px-parcel', v), belt = $('#px-belt', v), pxAn = null;
    pxStop = pxHangar(v);
    /* положения коробки на ленте, px от левого края */
    function bw() { return belt.clientWidth || 340; }
    function xWait() { return 12; }
    function xMid() { return Math.round(bw() / 2 - parcel.offsetWidth / 2); }
    function xIn() { return -parcel.offsetWidth - 20; }
    function xOut() { return bw() + 24; }
    function put(x) { if (pxAn) { pxAn.cancel(); pxAn = null; } parcel.style.transform = 'translateX(' + x + 'px)'; parcel.style.visibility = 'visible'; }
    function curX() { var m = /translateX\((-?[\d.]+)px\)/.exec(parcel.style.transform || ''); var r = parcel.getBoundingClientRect(), b = belt.getBoundingClientRect(); return r.width ? Math.round(r.left - b.left) : (m ? +m[1] : 0); }
    function run(on) { belt.classList.toggle('run', !!on); }
    function slide(x1, ms, ease) {
      return new Promise(function (res) {
        var x0 = curX(); run(true);
        if (REDUCED) { put(x1); run(false); res(); return; }
        if (pxAn) pxAn.cancel();
        pxAn = parcel.animate([{ transform: 'translateX(' + x0 + 'px)' }, { transform: 'translateX(' + x1 + 'px)' }], { duration: ms, easing: ease || 'linear', fill: 'forwards' });
        var an = pxAn; an.onfinish = function () { if (pxAn === an) { parcel.style.transform = 'translateX(' + x1 + 'px)'; an.cancel(); pxAn = null; } run(false); res(); };
        an.oncancel = function () { res(); };
      });
    }
    function arrive() { put(xIn()); return slide(xWait(), 800, 'cubic-bezier(.25,.55,.4,1)'); }
    function idleShow() { var info = rlInfo(IDLE[idleI++ % IDLE.length]); item.className = 'px-item ghost'; item.innerHTML = pxIcon(info); }
    function idleOn() { clearInterval(rlTimer); idleShow(); rlTimer = setInterval(function () { if (!$('#px')) { clearInterval(rlTimer); return; } if (!busyNow && !document.hidden) idleShow(); }, 2600); }
    function setState(s, t) { px.setAttribute('data-s', s); st.textContent = t; }
    function reveal(r, real) {
      var info = rlInfo(r.prize.id), c = pxCap(info, r.prize), big = rlBig(info);
      if (r.prize.capXp) c = ['+' + r.prize.capXp + ' XP', 'баланс ониксов на максимуме, вместо ониксов опыт'];
      item.className = 'px-item xray'; item.innerHTML = pxIcon(info, r.prize);
      setState('found', info.c === 'none' ? 'ПУСТО' : 'НАЙДЕНО');
      setTimeout(function () {
        item.className = 'px-item real' + (big ? ' big' : '');
        stamp.textContent = info.c === 'none' ? 'ПУСТО' : 'ПРОВЕРЕНО'; stamp.className = 'px-stamp on' + (info.c === 'none' ? ' grey' : '');
        cap.innerHTML = '<b class="' + (info.c === 'none' ? '' : 'win') + '">' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span>';
        setState('done', 'ГОТОВ');
        setUser(real); updateRoulBalance();
        if (big) { px.classList.add('px-flash'); setTimeout(function () { px.classList.remove('px-flash'); }, 900); confetti(160); }
        if (r.prize.frameId) toast('Рамка «' + (r.prize.frameName || '') + '» в кабинете, раздел «Рамка аватара»');
        else if (r.prize.code) toast('Промокод ' + r.prize.code + ' уже в кабинете');
        /* проверенная коробка едет дальше и уходит за край, следом слева выезжает новая */
        slide(xOut(), 950, 'cubic-bezier(.45,0,.85,.55)').then(function () {
          if (!$('#px')) return;
          parcel.style.visibility = 'hidden';
          return new Promise(function (res) { setTimeout(res, REDUCED ? 0 : 450); });
        }).then(function () {
          if (!$('#px')) return;
          return arrive();
        }).then(function () {
          if (!$('#px')) return;
          busyNow = false; spinning = false; updateRoulBalance();
          setTimeout(function () { if (!busyNow && $('#px')) { stamp.className = 'px-stamp'; idleOn(); } }, 2800);
        });
      }, REDUCED ? 50 : 280);
    }
    function fail(msg) {
      slide(xWait(), 500, 'ease-out').then(function () { busyNow = false; spinning = false; setState('idle', 'ГОТОВ'); cap.innerHTML = CAP0; updateRoulBalance(); idleOn(); });
      toast(msg, null, 'warn');
    }
    function doOpen(free) {
      if (busyNow || !acct.user) return;
      if (!free && acct.user.balance < RULES.spinCost) { toast('Нужно ' + RULES.spinCost + ' ониксов. Выполните задания или отметьтесь в кабинете', null, 'warn'); return; }
      busyNow = true; clearInterval(rlTimer); spinning = true; updateRoulBalance();
      stamp.className = 'px-stamp'; item.className = 'px-item'; item.innerHTML = '';
      cap.innerHTML = '<b>Сканируем…</b><span>Посылка едет в рентген</span>';
      setState('in', 'ПРИЁМ');
      var res = null, scanned = false, scanAt = 0, shown = false, SCAN = REDUCED ? 80 : 600;
      function tryShow() {
        if (shown || !scanned || !res) return; shown = true;
        setTimeout(function () { spinning = false; reveal(res.r, res.real); }, Math.max(0, SCAN - (Date.now() - scanAt)));
      }
      slide(xMid(), 900, 'cubic-bezier(.2,.5,.4,1)').then(function () { if (!busyNow) return; setState('scan', 'СКАН'); scanned = true; scanAt = Date.now(); tryShow(); });
      API.call('spin', { free: free }).then(function (r) {
        if (!r.ok) { shown = true; fail(r.error); return; }
        var sh = Object.assign({}, acct.user, { balance: acct.user.balance - (free ? 0 : RULES.spinCost), freeSpins: acct.user.freeSpins - (free ? 1 : 0) });
        var real = r.user; acct.user = sh; updateRoulBalance(); updateAcctUI();
        res = { r: r, real: real }; tryShow();
      }, function () { shown = true; fail('Нет связи, попробуйте ещё раз'); });
    }
    setState('idle', 'ГОТОВ'); updateRoulBalance(); idleOn(); put(xWait());
    var g = $('#spin-guest', v); if (g) g.addEventListener('click', function () { requireAuth('roulette'); });
    var pbtn = $('#spin-paid', v); if (pbtn) pbtn.addEventListener('click', function () { doOpen(false); });
    var fb = $('#spin-free', v); if (fb) fb.addEventListener('click', function () { doOpen(true); });
  }
  function prizeTitle(p) { return p.id === 'none' ? 'Пусто' : p.tokens ? '+' + num(p.tokens) + ' ' + tokWord(p.tokens) : p.code ? 'Промокод −' + p.pct + '%' : p.xp ? '+' + p.xp + ' XP' : p.spins ? '+' + p.spins + ' ' + plural(p.spins, 'посылка', 'посылки', 'посылок') : p.frameName ? 'Рамка «' + p.frameName + '»' : p.label; }
  function prizeSub(p) { return p.id === 'none' ? 'В этот раз не повезло, попробуйте ещё.' : p.code ? 'Код ' + p.code + ' уже в кабинете. Выберите его в корзине.' : p.xp ? 'Опыт засчитан в уровень этого месяца.' : p.spins ? 'Бесплатные посылки добавлены.' : p.frameName ? 'Новая рамка открыта.' : 'Ониксы уже на балансе.'; }
  function showPrize(p) {
    var win = p.id !== 'none';
    var visual = p.frameId ? ava({ name: acct.user && acct.user.name, avatar: acct.user && acct.user.avatar, frame: p.frameId }, 'lg') : pz(p.id);
    var title = p.id === 'none' ? 'Пусто' : p.tokens ? '+' + num(p.tokens) + ' ' + tokWord(p.tokens) : p.code ? 'Промокод −' + p.pct + '%' : p.xp ? '+' + p.xp + ' XP' : p.spins ? '+' + p.spins + ' ' + plural(p.spins, 'посылка', 'посылки', 'посылок') : p.frameName ? 'Рамка «' + p.frameName + '»' : p.label;
    var sub = p.id === 'none' ? 'В этот раз не повезло. Следующая посылка может принести джекпот.' : p.code ? 'Код ' + p.code + ' уже в кабинете. Выберите его в корзине.' : p.xp ? 'Опыт засчитан в уровень этого месяца.' : p.spins ? 'Бесплатные посылки добавлены.' : p.frameName ? 'Новая рамка открыта: наденьте её в кабинете.' : p.id === 'jackpot' ? 'Джекпот! Ониксы уже на балансе.' : 'Ониксы уже на балансе.';
    var md = openModal('<div class="prize-pop"><div class="burst">' + visual + '</div><span class="eyebrow">' + (win ? 'Ваш приз' : 'Результат') + '</span><h2>' + esc(title) + '</h2><p class="muted">' + esc(sub) + '</p>' +
      '<div class="send-row" style="width:100%">' + (p.spins ? '<button class="btn" type="button" id="again-free">' + icon('sparkles') + 'Крутить бесплатно</button>' : '<button class="btn" type="button" id="again">' + icon('sparkles') + 'Ещё раз</button>') +
      (p.frameId ? '<button class="btn btn-ghost" type="button" id="wear">Надеть рамку</button>' : '<button class="btn btn-ghost" type="button" data-close>Закрыть</button>') + '</div></div>', { cls: 'sm' });
    if (win) confetti(p.id === 'jackpot' ? 240 : 100);
    var a = $('#again', md); if (a) a.addEventListener('click', function () { closeModal(); spin(false); });
    var af = $('#again-free', md); if (af) af.addEventListener('click', function () { closeModal(); spin(true); });
    var w = $('#wear', md); if (w) w.addEventListener('click', function () { API.call('profile', { frame: p.frameId }).then(function (r) { if (r.ok) { setUser(r.user); toast('Рамка надета'); } closeModal(); }); });
  }

  // ------------------------------------------------------------ информация
  function faqItem(q, body) { return '<details><summary>' + q + icon('chevron-down') + '</summary><div class="acc-body">' + body + '</div></details>'; }
  function faqGroup(title, items) { return '<div class="sec"><h2 class="faq-h">' + title + '</h2><div class="acc card faq">' + items.join('') + '</div></div>'; }
  function renderInfo() {
    track('info');
    var R = RULES.reward, L = RULES.levels;
    var order = [
      faqItem('Как заказать: по шагам', '<ol class="faq-ol"><li><b>Выберите вещь.</b> Откройте карточку, пролистайте фото, посмотрите замеры и характеристики.</li><li><b>Размер и цвет.</b> Нажмите нужный размер: под ним появятся замеры именно этого размера. Цвет выбирайте по фото: на карточке показаны реальные оттенки.</li><li><b>«В корзину».</b> В корзине можно изменить количество, добавить пожелание к каждой вещи (например, «хочу примерить перед покупкой») или убрать лишнее.</li><li><b>Данные для связи.</b> Имя, телефон и Telegram берутся из кабинета, заполните их там, иначе заказ не уйдёт. Это нужно, чтобы менеджер мог вам написать.</li><li><b>Город и способ получения.</b> Для товаров в наличии, самовывоз, Авито Доставка или курьер. Для предзаказа: Авито, СДЭК или личная встреча.</li><li><b>Ониксы и промокод.</b> Это последний шаг перед оформлением. Скидка пересчитается сразу, итог виден в корзине.</li><li><b>«Оформить заказ».</b> Заказ получит номер, уйдёт менеджеру, а в «Моих заказах» появится его статус. Дальше менеджер пишет вам в Telegram и присылает реквизиты.</li></ol><p class="small">Важно: пока менеджер не подтвердил заказ и не пришла оплата, вещь за вами не закреплена.</p>'),
      faqItem('Что такое предзаказ и чем он отличается от «В наличии»', '<p><b>В наличии</b>: вещь уже в Москве. Её можно забрать самому или отправить по России через Авито Доставку, обычно в течение пары дней.</p><p><b>Предзаказ</b>: вещь ещё в Китае. Мы выкупаем её у поставщика только после вашего заказа и оплаты, проверяем и привозим. Так цена ниже, а выбор шире, но ждать дольше.</p><p>Стоимость доставки из Китая <b>уже включена в стоимость</b> предзаказа: отдельно за неё платить не нужно.</p><p><a href="' + SHOP.preorderUrl + '" target="_blank" rel="noopener">Подробные условия предзаказа</a></p>'),
      faqItem('Этапы предзаказа: что происходит с вашей вещью', '<ol class="faq-ol"><li><b>Оформлен.</b> Заказ создан и отправлен менеджеру. Он связывается с вами, уточняет размер, цвет и детали, присылает реквизиты.</li><li><b>Выкуплен (в течение 12 часов после оплаты).</b> Мы оплачиваем вещь у поставщика в Китае и закрепляем её за вами.</li><li><b>В пути до склада.</b> Поставщик отправляет вещь на склад в Китае, обычно до 7 дней, затем 3-5 дней дорога до склада.</li><li><b>На складе в Китае.</b> Вещь приходит, её проверяют на брак и соответствие описанию. На это уходит 1-2 дня. Вам отправляют фотоотчёт: основной бесплатно.</li><li><b>Едет в Россию.</b> После проверки вещь отправляется из Китая. Фурой это 18-32 дня от склада.</li><li><b>Едет к вам.</b> Вещь в России: её передают в выбранный способ получения. СДЭК, Авито Доставка или личная встреча.</li><li><b>Получен.</b> Вы забрали заказ. Если оставите отзыв, это поможет другим покупателям.</li></ol>'),
      faqItem('Сколько ждать предзаказ', '<p>Складывается из этапов: выкуп до 12 часов, поставщик до 7 дней, дорога до склада 3-5 дней, проверка 1-2 дня и доставка 18-32 дня. В сумме обычно <b>от 3,5 до 6,5 недель</b>.</p><p>Быстрее самолётом: это отдельная услуга, её условия и стоимость согласует менеджер. Прямо на сайте самолётом заказать нельзя.</p><p class="small">Сроки примерные: на них влияют праздники в Китае, загрузка перевозчика и погода. Если что-то задерживается, менеджер напишет сам.</p>'),
      faqItem('Размеры и замеры', '<ul><li>Если у вещи несколько размеров, под выбранным размером показываются его замеры: грудь, длина, плечи, рукав, в сантиметрах.</li><li>Замеры: это ширина самой вещи, не обхват тела. Приложите к себе похожую вещь из шкафа и сравните.</li><li>Если сомневаетесь между двумя размерами, напишите менеджеру, он подскажет по вашим параметрам.</li><li>Разница в замерах до 1-2 см допустима: вещи измеряют вручную.</li></ul>'),
      faqItem('Цвета и фото', '<ul><li>Цвета на карточке показаны реальными оттенками (болотный, кремовый, бирюзовый и т. д.).</li><li>Оттенок на экране может немного отличаться от настоящего из-за яркости и настроек телефона.</li><li>Фотографии берутся из нашего канала. Если нужен дополнительный фотоотчёт перед отправкой, он оплачивается по тарифу логиста (15 ¥ за позицию), основной бесплатный.</li></ul>'),
      faqItem('Доставка из Китая', '<ul><li>Фура, основной способ, занимает 18-32 дня от склада в Китае.</li><li>Стоимость доставки из Китая уже включена в стоимость товара.</li><li>Самолётом быстрее, но только через менеджера, он рассчитает и согласует.</li><li>Перед отправкой вещь проверяют на складе и фотографируют.</li></ul>'),
      faqItem('Получение по России', '<ul><li><b>СДЭК до пункта выдачи</b>: оплачивается отдельно, по тарифу СДЭК.</li><li><b>Авито Доставка</b>: по Москве и в другой город, с минимальной стоимостью.</li><li><b>Личная встреча</b>: в Москве бесплатно, время согласуйте с менеджером.</li><li>Номер отслеживания менеджер пришлёт в Telegram.</li></ul>'),
      faqItem('Получение товаров в наличии', '<ul><li><b>Авито Доставка</b>: по Москве и в другой город, быстрее всего.</li><li><b>Курьер по Москве</b>: не всегда доступен, согласуется с менеджером.</li><li><b>Самовывоз</b>: ' + esc(SHOP.address) + '. Время согласуйте с менеджером.</li></ul>'),
      faqItem('Оплата', '<ul><li>Перевод: Сбербанк, Т-Банк, Альфа-Банк, СБП.</li><li>Наличными: при встрече в Москве.</li><li>На сайте оплаты нет: менеджер подтвердит заказ и пришлёт реквизиты.</li><li>До 12% заказа можно оплатить ониксами и промокодом вместе, 1 оникс = 0,3 ₽.</li><li>Предзаказ начинаем выкупать после оплаты, это ускоряет заказ.</li></ul>'),
      faqItem('Статусы заказа', '<ul><li><b>Оформлен</b>: заказ создан, ждёт подтверждения менеджера.</li><li><b>Выкуплен</b>: вещь оплачена у поставщика.</li><li><b>В пути</b>: едет на склад в Китае.</li><li><b>На складе</b>: прошла проверку, готовится к отправке.</li><li><b>Едет к нам</b>: международная доставка.</li><li><b>Едет к вам</b>: в России, передана в доставку.</li><li><b>Получен</b>: заказ у вас.</li><li><b>Отменён</b>: заказ остановлен, подробности пришлёт менеджер.</li></ul><p class="small">Статус меняет менеджер, в кабинете он обновляется сам.</p>'),
      faqItem('Что не зависит от магазина', '<ul><li>Задержки у поставщика, на складе или у перевозчика, праздники и погода.</li><li>Состояние вещи, которое видно только при проверке: если найдём брак, сразу напишем вам и предложим решение.</li><li>Работа пунктов выдачи и сроки СДЭК или Авито после передачи посылки.</li></ul>'),
      faqItem('Если что-то пошло не так', '<p>Напишите менеджеру в Telegram, он отвечает в рабочее время (Пн-Пт 08:30-21:00, Сб-Вс 10:00-20:00). Бот-помощник отвечает с задержкой около минуты, это нормально, просто подождите.</p><p><a class="btn btn-sm" href="' + SHOP.managerUrl + '" target="_blank" rel="noopener">Написать менеджеру</a></p>')
    ];
    var bonus = API.enabled ? [
      faqItem('Где взять ониксы', '<ul><li>+' + R.register + ' за регистрацию</li><li>+' + R.checkin + ' за вход каждый день и от ' + L[0].streak + ' до ' + L[4].streak + ' за 7 дней подряд, зависит от уровня</li><li>Задания: ежедневные по 3 оникса, еженедельные по 25, ежемесячные от 40</li><li>Посылка</li><li>+' + R.referrer + ' за друга и +' + R.birthday + ' в день рождения</li></ul><p>Ониксы не сгорают и не передаются другим людям. Пока на балансе больше ' + num(RULES.balanceCap) + ' ониксов, вход, задания и посылка дают опыт вместо ониксов (2 оникса = 1 XP). Ониксы за заказы, отзывы, друзей и день рождения начисляются всегда.</p>'),
      faqItem('Промокоды', '<p>Личные промокоды выпадают в посылке, с уровня «Золото», −1,5% каждый месяц, на «Алмазе», ещё 3 по −2,5%. Они появляются в кабинете, а в корзине выбираются последним шагом. Каждый действует на один заказ.</p><p>Промокоды магазина вводятся вручную в поле «Промокод» в корзине.</p>'),
      faqItem('Как зарабатывается XP', '<ul><li>Полученный заказ: 1 XP за каждые 10 ₽ (когда статус «Получен»)</li><li>Ежедневный вход: +' + RULES.xpReward.checkin + ' XP</li><li>Задания: ежедневные +10 XP, еженедельные +60 XP, ежемесячные +180 XP</li><li>Посылка: приз +50 XP</li></ul>'),
      faqItem('Как работают уровни', '<p>Уровень растёт от XP, опыта за месяц. 1-го числа XP обнуляется, и уровень начинается заново с Бронзы.</p><button class="btn btn-ghost btn-sm" type="button" id="info-levels">Привилегии уровней</button>'),
      faqItem('Задания: когда обновляются', '<ul><li>Ежедневные: в 00:00 по Москве. Простые: ониксы и XP, чем выше уровень, тем их больше.</li><li>Еженедельные: в понедельник. «Оформить заказ» засчитывается сразу при оформлении.</li><li>Ежемесячные: 1-го числа. Заказы засчитываются, когда статус «Получен».</li></ul>'),
      faqItem('Посылка: как это работает', '<ul><li>1 бесплатная посылка каждый день на любом уровне, на «Алмазе», 3. Не копятся: обновляются в 00:00 по Москве.</li><li>Дальше посылка стоит ' + RULES.spinCost + ' ониксов. «Ещё раз» даёт бесплатные посылки, они не сгорают.</li><li>На «Платине» и «Алмазе» «Пусто» выпадает реже.</li><li>Призы и шансы у бесплатной и платной посылки одинаковые.</li><li>Ониксы из посылки сразу на балансе, промокод выбирается в корзине, XP идут в уровень месяца.</li></ul>')
    ] : [];
    var shop = [faqItem('Магазин и связь', contactsCard()), faqItem('Мы в соцсетях', socialCard())];
    $('#v-info').innerHTML = '<div class="view-head"><div><h1>Частые вопросы</h1></div></div>' +
      faqGroup('Заказ и доставка', order) + (bonus.length ? faqGroup('Ониксы и уровни', bonus) : '') + faqGroup('Магазин', shop);
    var il = $('#info-levels'); if (il) il.addEventListener('click', levelsModal);
  }

  // ------------------------------------------------------------ маршруты
  var skipHash = null, catBack = null, routed = 0;
  function silentHash(h) { if (location.hash.slice(1) === h) return; skipHash = h; location.hash = h; }
  function go(h) { if (location.hash.slice(1) === h || (!h && !location.hash)) route(); else location.hash = h; }
  function setNav(h) {
    var key = h === '' ? 'home' : /^p-/.test(h) || h === 'stock' || h === 'preorder' ? 'catalog' : h === 'roulette' || h === 'byer' ? 'games' : h;
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
  // плавающая кнопка «Назад»: везде, кроме главной, и не уезжает при прокрутке
  var floatBack = null;
  function goBack() { if (routed > 1) history.back(); else { location.hash = ''; } }
  function updFloatBack(h) {
    if (!floatBack) {
      floatBack = document.createElement('button'); floatBack.type = 'button'; floatBack.className = 'float-back'; floatBack.setAttribute('aria-label', 'Назад');
      floatBack.innerHTML = icon('arrow-right') + '<span>Назад</span>';
      floatBack.addEventListener('click', goBack);
      document.body.appendChild(floatBack);
      window.addEventListener('scroll', function () { if (floatBack._p) floatBack.classList.toggle('show', window.scrollY > 120); }, { passive: true });
    }
    var home = !h || h === 'home';
    floatBack._p = /^p-\d+$/.test(h);
    floatBack.hidden = !floatBack._p;
    document.body.classList.remove('has-back');
    floatBack.classList.toggle('show', floatBack._p && window.scrollY > 120);
  }
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, '')); routed++;
    if (skipHash !== null && h === skipHash) { skipHash = null; return; }
    skipHash = null;
    if (byerGame && h !== 'byer') byerGame.close();
    var m = h.match(/^ref=([A-Za-z0-9]{4,12})$/);
    if (m) {
      store.set('ref', m[1].toUpperCase());
      if (!acct.user) { authTab = 'register'; toast('Приглашение принято: +' + RULES.reward.refFriend + ' ониксов при регистрации'); }
      history.replaceState(null, '', location.pathname + location.search + '#account'); h = 'account';
    }
    closeModal(); closeLightbox(); hideBuybar(); stopHomeTimers();
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
    else if (h === 'cart') { cartStep = 'list'; renderCart(); show('cart'); }
    else if (h === 'orders') { renderOrders(); show('orders'); }
    else if (h === 'favorites') { renderFavorites(); show('favorites'); }
    else if (h === 'account') { renderAccount(); show('account'); flushTrack(); }
    else if (h === 'roulette') { renderRoulette(); show('roulette'); }
    else if (h === 'games') { renderGames(); show('games'); }
    else if (h === 'byer') { renderGames(); show('games'); openByer(); }
    else if (h === 'info') { renderInfo(); show('info'); }
    else { renderHome(); show('home'); }
    setNav(h); updFloatBack(h);
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
    else if (current === 'games') renderGames();
    else if (current === 'byer') { /* игра в своём окне */ }
    else if (current === 'cart') renderCart();
    else if (current === 'orders') renderOrders();
    if (acct.user && current === 'catalog') { if (filter.tab === 'preorder') track('pre'); else if (filter.tab === 'stock') track('stock'); }
    if (acct.user && current === 'info') track('info');
  }

  // ------------------------------------------------------------ тема
  var THEME_NAMES = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' };
  function themeMode() { try { var t = localStorage.getItem('onion.shop.theme'); return t === 'dark' || t === 'light' ? t : 'auto'; } catch (e) { return 'auto'; } }
  function setThemeMode(m) {
    if (m === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', m);
    try { if (m === 'auto') localStorage.removeItem('onion.shop.theme'); else localStorage.setItem('onion.shop.theme', m); } catch (e) { /* */ }
    themeIcon();
  }
  function themeIcon() {
    var a = document.documentElement.getAttribute('data-theme');
    var dark = a === 'dark' || (!a && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    
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
    var md = openModal(modalHead('Отзыв о заказе') + '<p class="small">За оценку: +' + R.review + ' ониксов, за оценку с отзывом от 20 символов, +' + R.reviewText + '. Отзыв увидят другие покупатели на странице товара.</p><div class="rv-list">' +
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
          box.innerHTML = '<div class="rv-done">' + icon('check-circle') + '<span>Спасибо! <b>+' + r.reward + '</b> ' + plural(r.reward, 'оникс', 'оникса', 'ониксов') + ' на балансе</span></div>';
          reward('Спасибо за отзыв: +' + r.reward + ' ониксов');
          if (!$('.rv [data-send]', md)) setTimeout(function () { closeModal(); refreshView(); }, 1300);
        });
      });
    });
  }
  var revCache = {};
  function drawReviews(r, body, n) {
    var base = +body.getAttribute('data-base') || 0;
    if (n) n.textContent = (r.count + base) ? '· ' + (r.count + base) : '';
    body.innerHTML = (!r.count && base) ? '' : r.count
      ? '<div class="rev-sum">' + stars(r.avg) + '<b>' + String(r.avg).replace('.', ',') + '</b><span class="small">' + r.count + ' ' + plural(r.count, 'отзыв', 'отзыва', 'отзывов') + '</span></div>' +
        r.list.map(function (x) { return '<div class="rev"><div class="rev-h"><b>' + esc(x.name) + '</b>' + stars(x.rating) + '<span class="small">' + esc(x.at) + '</span></div>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div>'; }).join('')
      : '<p class="small">Отзывов пока нет. Они появляются после получения заказа, их оставляют покупатели в кабинете.</p>';
  }
  function loadReviews(pid, body, n) {
    if (revCache[pid]) { drawReviews(revCache[pid], body, n); return; }
    API.call('reviews', { productId: pid }).then(function (r) {
      if (!r.ok) { body.innerHTML = '<p class="small">Не удалось загрузить отзывы. Попробуйте позже.</p>'; return; }
      revCache[pid] = r; drawReviews(r, body, n);
    });
  }
  /* подтверждение телефона: бот привязывается к кабинету и просит «Поделиться номером» */
  function phoneModal() {
    var u = acct.user; if (!u || u.phoneOk) return;
    var md = openModal(modalHead('Подтверждение телефона') + '<div id="ph-body"></div>', { cls: 'sm' }), polls = 0;
    var b = $('#ph-body', md);
    b.innerHTML = '<div class="tg-hero"><span class="tg-ic">' + icon('phone') + '</span><h3>Один шаг до бонусов</h3><p>Telegram подтвердит, что номер ' + esc(u.phone || '') + ' ваш. Мы не видим ничего, кроме номера.</p></div>' +
      '<ul class="tg-perks"><li><span class="ic">' + tk() + '</span><span><b>Приветственные ониксы</b><small>начислятся сразу после подтверждения</small></span></li><li><span class="ic">' + icon('bag') + '</span><span><b>Бонусы за друзей и подарок на ДР</b><small>и статусы заказов прямо в Telegram</small></span></li></ul>' +
      (API.mode === 'demo' ? '<button class="btn btn-block" type="button" id="ph-demo">Подтвердить (демо)</button>' : '<button class="btn btn-block" type="button" id="ph-on">' + icon('send') + 'Подтвердить в Telegram</button>') + '<div id="ph-out"></div>';
    var dm = $('#ph-demo', b); if (dm) dm.addEventListener('click', function () { API.call('phoneDemo').then(function (r) { if (!r.ok) { toast(r.error, null, 'warn'); return; } setUser(r.user); closeModal(); confetti(120); reward('Телефон подтверждён' + (r.got ? ' · +' + r.got + ' ' + tokWord(r.got) : '')); }); });
    var on = $('#ph-on', b); if (on) on.addEventListener('click', function () {
      busy(on, true, 'Секунду');
      API.call('tgLink').then(function (r) {
        busy(on, false); var out = $('#ph-out', b);
        if (!r.ok || !r.bot) { out.innerHTML = '<div class="form-err">' + esc(r.error || 'Бот магазина ещё настраивается. Напишите менеджеру @OnionShop_Support') + '</div>'; return; }
        on.hidden = true;
        out.innerHTML = '<ol class="tg-steps"><li class="now"><i>1</i><span>Откройте бота и нажмите «Старт»<a class="btn" target="_blank" rel="noopener" href="https://t.me/' + esc(r.bot) + '?start=' + esc(r.code) + '">' + icon('send') + 'Открыть @' + esc(r.bot) + '</a></span></li>' +
          '<li><i>2</i><span>Нажмите в боте «📱 Поделиться номером»</span></li><li><i>3</i><span>Вернитесь сюда: подтвердится само <em class="tg-wait"><span class="spinner"></span>ждём бота…</em></span></li></ol>' +
          '<p class="small">Бот отвечает с задержкой до минуты. Код действует час.</p>';
        (function poll() {
          if (!document.body.contains(md) || ++polls > 60) return;
          setTimeout(function () { API.call('me').then(function (m) { if (m.ok && m.user && m.user.phoneOk) { setUser(m.user); closeModal(); confetti(120); reward('Телефон подтверждён'); } else poll(); }); }, 4000);
        })();
      });
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#ph-go,#ph-go2')) phoneModal(); });
  function tgModal() {
    if (!acct.user) return;
    var md = openModal(modalHead('Уведомления в Telegram') + '<div id="tg-body"></div>', { cls: 'sm' });
    var polls = 0;
    var perks = [['receipt', 'Статус заказа', 'выкуплен, в пути, на складе, получен'], ['clock', 'Товар снова в продаже', 'из списка «Жду появления»'], ['star', 'Без спама', 'только про ваши заказы и товары']];
    function hero(ic, title, sub, cls) { return '<div class="tg-hero ' + (cls || '') + '"><span class="tg-ic">' + icon(ic) + '</span><h3>' + title + '</h3><p>' + sub + '</p></div>'; }
    function draw() {
      var u = acct.user, b = $('#tg-body', md); if (!b) return;
      if (u.tgOn) {
        b.innerHTML = hero('check-circle', 'Telegram подключён', (u.tgName ? esc(u.tgName) + ' · ' : '') + 'уведомления включены', 'ok') +
          '<ul class="tg-perks">' + perks.map(function (x) { return '<li><span class="ic">' + icon(x[0]) + '</span><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></li>'; }).join('') + '</ul>' +
          '<h4 class="tg-sub">Сообщать о новинках</h4><div class="choices" id="tg-cats"></div><p class="small">Отметьте категории: бот напишет, когда в них появится новый товар.</p>' +
          '<button class="btn btn-ghost" type="button" id="tg-off">Отключить уведомления</button>';
        drawTgCats($('#tg-cats', b));
        $('#tg-off', b).addEventListener('click', function () { API.call('tgUnlink').then(function (r) { if (r.ok) { setUser(r.user); draw(); toast('Уведомления отключены'); } }); });
      } else {
        b.innerHTML = hero('send', 'Заказы: в Telegram', 'Подключите бота ONION SHOP, и не нужно заходить на сайт, чтобы узнать, где ваш заказ.') +
          '<ul class="tg-perks">' + perks.map(function (x) { return '<li><span class="ic">' + icon(x[0]) + '</span><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></li>'; }).join('') + '</ul>' +
          '<button class="btn" type="button" id="tg-on">' + icon('send') + 'Подключить Telegram</button><div id="tg-out"></div>';
        $('#tg-on', b).addEventListener('click', function () {
          var btn = this; busy(btn, true, 'Секунду');
          API.call('tgLink').then(function (r) {
            busy(btn, false); var out = $('#tg-out', b);
            if (!r.ok) { out.innerHTML = '<div class="form-err">' + esc(r.error) + '</div>'; return; }
            if (!r.bot) { out.innerHTML = '<div class="notice notice-info">' + icon('info') + '<div>Уведомления в Telegram скоро заработают, бот магазина ещё настраивается. Пока статус заказа виден в «Моих заказах», а менеджер пишет вам лично.</div></div><a class="btn btn-ghost" style="margin-top:10px" target="_blank" rel="noopener" href="' + SHOP.managerUrl + '">Написать менеджеру</a>'; return; }
            btn.hidden = true; var pk = $('.tg-perks', b); if (pk) pk.hidden = true; var hp = $('.tg-hero p', b); if (hp) hp.hidden = true;
            out.innerHTML = '<ol class="tg-steps"><li class="done"><i>' + icon('check') + '</i><span>Код создан</span></li>' +
              '<li class="now"><i>2</i><span>Откройте бота и нажмите «Старт»<a class="btn" target="_blank" rel="noopener" href="https://t.me/' + esc(r.bot) + '?start=' + esc(r.code) + '">' + icon('send') + 'Открыть @' + esc(r.bot) + '</a></span></li>' +
              '<li><i>3</i><span>Вернитесь сюда: подключится само <em class="tg-wait"><span class="spinner"></span>ждём бота…</em></span></li></ol>' +
              '<p class="small">Код действует час. Если Telegram не открылся, откройте бота вручную и отправьте ему: <b>/start ' + esc(r.code) + '</b></p>';
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
  function drawTgCats(box) {
    var seen = {}, cats = [];
    PRODUCTS.forEach(function (p) { if (!seen[p.category]) { seen[p.category] = 1; cats.push([p.category, p.categoryLabel]); } });
    var on = (acct.user.tgCats || []).slice();
    box.innerHTML = cats.map(function (c) { return '<button class="choice" type="button" data-c="' + esc(c[0]) + '" aria-pressed="' + (on.indexOf(c[0]) >= 0) + '">' + esc(c[1]) + '</button>'; }).join('');
    $$('[data-c]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-c'), i = on.indexOf(k); if (i >= 0) on.splice(i, 1); else on.push(k);
        b.setAttribute('aria-pressed', String(on.indexOf(k) >= 0));
        API.call('tgCats', { cats: on }).then(function (r) { if (r.ok) { acct.user = r.user; } else toast(r.error, null, 'warn'); });
      });
    });
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
      : '<p>У этого товара нестандартная сетка размеров (' + p.sizes.map(esc).join(', ') + '). Сверьтесь с замерами изделия или спросите менеджера, подскажем.</p>';
    var md = openModal(modalHead('Подобрать размер') + '<div class="fit">' + form + (shoe || letters ? '<button class="btn" type="button" id="fit-go" style="margin-top:12px">Подобрать</button><div id="fit-out" aria-live="polite"></div>' : '') +
      '<p class="small" style="margin-top:12px">Это ориентир по общей сетке. Сверьте с замерами изделия (кнопка «Замеры»), а если сомневаетесь, спросите менеджера.</p></div>', { cls: 'sm' });
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
        out.innerHTML = '<div class="fit-res"><small>' + (exact ? 'Вам подойдёт' : 'Ближайший в наличии') + '</small><b>' + esc(size) + '</b>' + (exact ? '' : '<span class="small">по расчёту: ' + esc(calc) + ', такого нет</span>') + '<button class="btn btn-sm" type="button" id="fit-pick">Выбрать ' + esc(size) + '</button></div>';
        $('#fit-pick', out).addEventListener('click', function () { closeModal(); apply(size); });
      }
    });
  }
  // нет связи: плашка сверху
  function netBar(show) {
    var el = $('#net-bar');
    if (!el) { el = document.createElement('div'); el.id = 'net-bar'; el.className = 'net-bar'; el.setAttribute('role', 'status'); el.hidden = true; el.innerHTML = '<span>Нет связи: каталог открыт, но войти и оформить заказ пока нельзя.</span><button type="button">Повторить</button>'; document.body.insertBefore(el, document.body.firstChild); $('button', el).addEventListener('click', function () { refreshMe().then(function () { refreshView(); }); }); }
    el.hidden = !show;
  }

  function init() {
    try { var ref = new URLSearchParams(location.search).get('ref'); if (ref) store.set('ref', ref.toUpperCase().slice(0, 12)); } catch (e) { /* */ }
    updateCounts(); updateAcctUI(); startClock(); themeIcon(); applyHomeIcon();
    $('#demo-bar').hidden = API.mode !== 'demo';
    $('#demo-reset').addEventListener('click', function () { confirmBox({ title: 'Сбросить демо?', text: 'Удалятся демо-аккаунты, ониксы и заказы в этом браузере.', actions: [{ label: 'Отмена', cls: 'btn-ghost' }, { label: 'Сбросить', cls: 'btn-danger', run: function () { API.resetDemo(); acct.user = null; updateAcctUI(); route(); toast('Демо сброшено'); } }] }); });
    var mb = $('#menu-btn'); if (mb) mb.addEventListener('click', openMenu);
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeIcon); } catch (e) { /* */ } }
    document.addEventListener('click', function (e) {
      var mg = e.target.closest('a[href]'); if (mg && SHOP.managerUrl && (mg.getAttribute('href') || '').indexOf(SHOP.managerUrl) === 0) track('mgr');
      var c = e.target.closest('[data-copy]');
      if (c) { e.preventDefault(); copyText(c.getAttribute('data-copy'), 'Скопировано'); return; }
      var f = e.target.closest('[data-fav]');
      if (f) { e.preventDefault(); toggleFav(f.getAttribute('data-fav'), f); }
      var q = e.target.closest('[data-quick]');
      if (q) { e.preventDefault(); quickAdd(q.getAttribute('data-quick')); }
    });
    var upd = $('#catalog-updated');
    if (upd && CATALOG.updatedAt) { var t = msk(new Date(CATALOG.updatedAt)); upd.textContent = 'Каталог обновлён ' + String(t.d).padStart(2, '0') + '.' + String(t.mo).padStart(2, '0') + '.' + t.y + '.'; }
    var hs = $('#hdr-search');
    if (hs) hs.addEventListener('submit', function (e) { e.preventDefault(); var q = $('#hdr-q').value.trim(); filter = newFilter(); filter.q = q; if (q.length >= 2) track('search'); var inp = $('#hdr-q'); if (inp) inp.blur(); go('catalog'); });
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', function (e) { if (e.key === 'onion.shop.cart') { cart = store.get('cart', []); updateCounts(); if (current === 'cart') renderCart(); } });
    window.addEventListener('offline', function () { netBar(true); });
    window.addEventListener('online', function () { netBar(false); silentRefresh(); });
    window.addEventListener('onion:neterr', function () { netBar(true); });
    window.addEventListener('onion:netok', function () { netBar(false); });
    if (navigator.onLine === false) netBar(true);
    route();
    window.__onionBoot = true;
    try { var mc = store.get('meCache', null); if (mc && mc.u && mc.s && mc.s === API.getSession() && API.mode === 'live') { acct.user = mc.u; acct.ready = true; updateAcctUI(); } } catch (e) { /* */ }
    refreshMe().then(function () { lastMe = acct.user ? JSON.stringify(acct.user) : ''; refreshView(); });
    setInterval(silentRefresh, 90000);
    setInterval(refreshCatalog, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastCat > 5 * 60 * 1000) refreshCatalog(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushTrack(); else silentRefresh(); });
    window.addEventListener('focus', silentRefresh);
  }
  // ------------------------------------------------------------ заставка и предзагрузка
  function runSplash() {
    var sp = document.getElementById('splash'); if (!sp) return;
    try { sessionStorage.setItem('onion.splash', '1'); } catch (e) { /* */ }
    var MIN = REDUCED ? 1500 : 3600, MAX = 10000, t0 = Date.now(), done = 0, urls = [], seen = {};
    var add = function (u) { if (u && !seen[u]) { seen[u] = 1; urls.push(u); } };
    shopPicks().forEach(function (p) { add(full(p.photos[0].id)); });
    PRODUCTS.forEach(function (p) { add(thumb(p.photos[0].id)); });
    PRODUCTS.forEach(function (p) { p.photos.forEach(function (f) { add(thumb(f.id)); }); });
    PRODUCTS.forEach(function (p) { p.photos.slice(0, 3).forEach(function (f) { add(full(f.id)); }); });
    ['shoes', 'tees', 'hoodies', 'outerwear', 'shirts', 'pants', 'suits', 'dresses', 'bags', 'headwear', 'accessories', 'jewelry', 'watches', 'perfume', 'underwear', 'stock', 'china'].forEach(function (k) { add('assets/cat/' + k + '.svg'); add('assets/cat/dark/' + k + '.svg'); });
    var total = urls.length, idx = 0, cap = Date.now() + MAX, finished = false;
    var bar = document.getElementById('spl-bar'), txt = document.getElementById('spl-txt'), phb = document.getElementById('spl-ph');
    function next() {
      if (idx >= urls.length || Date.now() > cap) return;
      var u = urls[idx++], im = new Image();
      var fin = function () { done++; next(); };
      im.onload = fin; im.onerror = fin; im.src = u;
    }
    for (var k = 0; k < 6; k++) next();
    var profileReady = function () { return !API.enabled || !API.getSession() || acct.ready; };
    var tm = setInterval(function () {
      var el = Date.now() - t0, real = total ? done / total : 1;
      var shown = Math.min(1, Math.min(real, el / MIN));
      if (bar) bar.style.transform = 'scaleX(' + Math.max(.03, shown).toFixed(3) + ')';
      if (txt) txt.textContent = shown < .35 ? 'Готовим магазин…' : shown < .75 ? 'Загружаем фотографии…' : shown < 1 ? 'Почти готово…' : 'Добро пожаловать!';
      var ready = (real >= 1 && profileReady()) || el >= MAX;
      if (!finished && el >= MIN && ready) {
        finished = true; clearInterval(tm);
        if (bar) bar.style.transform = 'scaleX(1)';
        setTimeout(function () { sp.classList.add('out'); setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 800); }, 250);
      }
    }, 120);
  }
  var initOrig = init;
  init = function () { initOrig(); try { runSplash(); } catch (e) { var s = document.getElementById('splash'); if (s && s.parentNode) s.parentNode.removeChild(s); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
