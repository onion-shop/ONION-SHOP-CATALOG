/* gruz.js: «Грузомания» (этап 1: каркас). Изометрический склад, графика отрендерена в Blender (assets/gz/, scripts/gz_art.py).
   Цикл: фура приезжает на док, разгрузка (энергия), товар на складе, заказы клиентов, упаковка мини-игрой, монеты, опыт, рейтинг,
   улучшения склада, уровень хаба (ms.lvl на сервере даёт рамки). Каркас окна, звук, энергия, сохранение, обучение: assets/gamekit.js. */
(function (W) {
  'use strict';
  var GK = W.GK, esc = GK.esc, fmt = GK.fmt, clamp = GK.clamp, plural = GK.plural, PI = Math.PI;
  var ART = 'assets/gz/';

  /* ================================================================ данные */
  var ITEMS = {
    tee: { n: 'Футболки', one: 'футболка', base: 36, spr: 'crate_k', c: '#d6a25e', lvl: 1 },
    hood: { n: 'Худи', one: 'худи', base: 64, spr: 'crate_o', c: '#ff8a3d', lvl: 2 },
    shoe: { n: 'Кроссовки', one: 'пара кроссовок', base: 96, spr: 'crate_w', c: '#e8eef6', lvl: 3 }
  };
  var ORDER_KEYS = ['tee', 'hood', 'shoe'];
  var CLIENTS = ['Аня', 'Игорь', 'Мария', 'Олег', 'Света', 'Данил', 'Катя', 'Артём', 'Лена', 'Максим', 'Вика', 'Павел'];
  var LVL_MAX = 12, EN_MAX = 20, EN_REGEN = 30;
  function xpNeed(l) { return Math.round(50 * Math.pow(l, 1.6)); }
  var UNLOCK = {
    2: 'Худи на складе и в заказах', 3: 'Кроссовки, второй док, больше заказов', 4: 'Больше места и дороже заказы (сортировочный центр на подходе)',
    5: 'Рамка аватара «Накладная»', 6: 'Третий док', 7: 'Заказы крупнее', 8: 'Быстрее фуры', 9: 'Ещё больше заказов', 10: 'Рамка аватара «Грузовой хаб»', 11: 'Логистический хаб набирает силу', 12: 'Максимальный уровень хаба'
  };
  var UPS = {
    cap: { n: 'Вместимость склада', d: 'Больше товара на хранении: +6 ящиков', max: 7, cost: function (l) { return Math.round(110 * Math.pow(1.85, l)); } },
    dock: { n: 'Скорость приёмки', d: 'Фуры приезжают чаще', max: 6, cost: function (l) { return Math.round(160 * Math.pow(1.9, l)); } },
    pay: { n: 'Оплата заказов', d: 'Клиенты платят на 10% больше', max: 8, cost: function (l) { return Math.round(220 * Math.pow(2, l)); } }
  };
  function capOf(st) { return 12 + 6 * (st.up.cap || 0) + (st.lvl - 1) * 2; }
  function docksOf(st) { return st.lvl >= 6 ? 3 : st.lvl >= 3 ? 2 : 1; }
  function maxOrders(st) { return 2 + Math.floor((st.lvl + 1) / 3); }
  function truckEvery(st) { return Math.max(14, 40 - (st.up.dock || 0) * 4 - st.lvl) * 1000; }
  function unlockedItems(st) { return ORDER_KEYS.filter(function (k) { return ITEMS[k].lvl <= st.lvl; }); }
  function stockTotal(st) { return ORDER_KEYS.reduce(function (a, k) { return a + (st.stock[k] || 0); }, 0); }

  function fresh() {
    var now = Date.now();
    return { v: 2, coins: 120, xp: 0, lvl: 1, rating: 3.5, stock: { tee: 0, hood: 0, shoe: 0 }, up: { cap: 0, dock: 0, pay: 0 }, orders: [], trucks: [{ dock: 0, k: 'tee', n: 4, s: 'wait', t: 1 }],
      oseq: 1, nextTruck: now + 25000, nextOrder: now + 2500, stats: { shipped: 0, perfect: 0, crates: 0, earned: 0, expired: 0 }, ms: { lvl: 1, earn: 0 }, tut: 0, en: EN_MAX, enAt: now, t0: now, lastAt: now };
  }
  function load(str) {
    var st = fresh(); if (!str) return st;
    try {
      var o = JSON.parse(str);
      if (o && o.v === 2) {
        Object.keys(o).forEach(function (k) { st[k] = o[k]; });
        ['tee', 'hood', 'shoe'].forEach(function (k) { st.stock[k] = Math.max(0, +st.stock[k] || 0); });
        st.trucks = (st.trucks || []).filter(function (t) { return t.s !== 'out'; }).map(function (t) { t.s = 'wait'; t.t = 1; return t; });
        st.lvl = clamp(+st.lvl || 1, 1, LVL_MAX);
      }
    } catch (e) { }
    return st;
  }

  /* ================================================================ запуск */
  function open(ctx) {
    var S = GK.shell({ title: 'Грузомания', cls: 'gz' });
    var st = load(ctx.data), E = GK.energy(st, EN_MAX + (st.lvl - 1) * 2, EN_REGEN), enUI = GK.energyChip(S, E);
    var I = GK.input(S, { pinch: true, joystick: false });
    var parts = GK.parts(), alive = true, ready = false, META = null, IMG = {}, T = 0, flyers = [], rings = [];
    injectCss();

    /* ---- шапка: уровень, монеты, рейтинг */
    var lvChip = document.createElement('div'); lvChip.className = 'gk-chip gz-lv'; lvChip.innerHTML = '<b>1</b><span class="bar"><i></i></span>'; S.left.appendChild(lvChip);
    var coinChip = document.createElement('div'); coinChip.className = 'gk-chip'; coinChip.innerHTML = '<i class="gz-coin"></i><span>0</span>'; S.left.appendChild(coinChip);
    var rateChip = document.createElement('div'); rateChip.className = 'gk-chip gz-rate'; rateChip.innerHTML = '<span class="s">★</span><span>0</span>'; S.left.appendChild(rateChip);
    S.hud.innerHTML = '<div class="gz-hint" hidden></div><button class="gz-act" type="button" hidden></button>' +
      '<div class="gz-dock"><button class="gz-d" data-gz="orders" type="button">Заказы<em hidden></em></button><button class="gz-d" data-gz="stock" type="button">Склад</button><button class="gz-d" data-gz="rewards" type="button">Награды</button></div>';
    var $ = function (q) { return S.root.querySelector(q); };

    /* ---- камера и проекция */
    var cam = { x: 800, y: 430, z: .6 };
    function w2p(x, y, z) { return [META.o[0] + x * META.x[0] + y * META.y[0] + (z || 0) * META.z[0], META.o[1] + x * META.x[1] + y * META.y[1] + (z || 0) * META.z[1]]; }
    function p2s(px, py) { return [(px - cam.x) * cam.z + S.w / 2, (py - cam.y) * cam.z + S.h / 2]; }
    function w2s(x, y, z) { var p = w2p(x, y, z); return p2s(p[0], p[1]); }
    function s2p(sx, sy) { return [(sx - S.w / 2) / cam.z + cam.x, (sy - S.h / 2) / cam.z + cam.y]; }
    function clampCam() {
      var vw = S.w / cam.z, vh = S.h / cam.z, W0 = META.W, H0 = META.H;
      cam.x = vw >= W0 ? W0 / 2 : clamp(cam.x, vw / 2, W0 - vw / 2); cam.y = vh >= H0 ? H0 / 2 : clamp(cam.y, vh / 2, H0 - vh / 2);
    }
    function minZ() { return Math.max(S.w / META.W, S.h / META.H); }
    function fit() { var p = w2p(-2.6, -6, 1); cam.x = p[0]; cam.y = p[1]; cam.z = clamp(S.w / 900, minZ(), 1); clampCam(); }
    I.onDrag = function (dx, dy) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); };
    I.onPinch = function (k) { cam.z = clamp(cam.z * k, minZ(), 1.6); clampCam(); };
    S.onresize = function () { if (ready) { cam.z = Math.max(cam.z, minZ()); clampCam(); } };

    /* ---- сохранение */
    var saver = GK.saver(ctx, S, function () { st.lastAt = Date.now(); st.ms = { lvl: st.lvl, earn: st.stats.earned }; return st; }, ctx.onUser);
    function dirty(now) { saver.mark(); if (now) saver.flush(); }

    /* ---- действия */
    function addCoins(n) { st.coins += n; st.stats.earned += Math.max(0, n); }
    function levelUp() {
      var up = false;
      while (st.lvl < LVL_MAX && st.xp >= xpNeed(st.lvl)) { st.xp -= xpNeed(st.lvl); st.lvl++; up = true; E.max = EN_MAX + (st.lvl - 1) * 2; E.add(5); }
      if (!up) return;
      GK.sfx.up();
      S.sheet('Уровень хаба: ' + st.lvl, '<p class="gk-lead">Склад растёт. Что нового:</p><div class="gk-list"><div class="gk-it"><span class="t"><b>' + esc(UNLOCK[st.lvl] || 'Новые возможности') + '</b><small>Энергии стало больше, часть восполнена</small></span></div></div><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Отлично</button></div>', { w: 400 });
      dirty(true);
    }
    function unload(tr) {
      if (!tr || tr.s !== 'wait') return;
      if (!E.has(1)) { GK.noEnergy(S, E, st, 'Разгрузить фуру'); return; }
      var room = capOf(st) - stockTotal(st);
      if (room <= 0) { S.toast('Склад полон: отправьте заказы или расширьте склад', 'warn'); GK.sfx.err(); return; }
      var take = Math.min(tr.n, room); E.spend(1);
      st.stock[tr.k] += take; tr.n -= take; st.stats.crates += take; GK.sfx.drop(); GK.sfx.truck();
      var pos = w2s(tr.dock * 4 - 4, -7, 1.5); S.float(pos[0], pos[1] - 20, '+' + take + ' ' + plural(take, 'ящик', 'ящика', 'ящиков'), '#fff', 18);
      for (var i = 0; i < take; i++) flyers.push({ t: -i * .12, d: .8, k: tr.k, from: [tr.dock * 4 - 4, -6.5, 1.8], to: padPos(tr.k, (st.stock[tr.k] - take + i)), kind: 'crate' });
      parts.burst(pos[0], pos[1], 14, { cols: ['#ffd34d', '#fff'], spd: 120, r: 3, g: 200 });
      if (tr.n <= 0) { tr.s = 'out'; tr.t = 0; }
      addXp(2 * take); dirty();
    }
    function addXp(n) { st.xp += n; levelUp(); }
    function padPos(k, i) { var pi = unlockedItems(st).indexOf(k); if (pi < 0) pi = 0; return [-8.5, -3.2 - pi * 2.9, .24 + Math.floor(i / 4) * .7]; }
    function orderGen() {
      var items = unlockedItems(st), kinds = Math.random() < .35 && items.length > 1 ? 2 : 1, picked = [], list = items.slice();
      for (var i = 0; i < kinds; i++) { var k = list.splice(Math.floor(Math.random() * list.length), 1)[0]; picked.push({ k: k, n: 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(st.lvl / 3))) }); }
      if (!st.stats.shipped && !st.orders.length) picked = [{ k: 'tee', n: 2 }];
      var base = picked.reduce(function (a, p) { return a + p.n * ITEMS[p.k].base; }, 0), pay = Math.round(base * 1.7 * (1 + .1 * (st.up.pay || 0)) * (1 + (st.lvl - 1) * .06));
      return { id: st.oseq++, name: CLIENTS[Math.floor(Math.random() * CLIENTS.length)], items: picked, pay: pay, due: Date.now() + (240 + Math.floor(Math.random() * 180)) * 1000 };
    }
    function need(o) { return o.items.filter(function (p) { return (st.stock[p.k] || 0) < p.n; }); }
    function itemsTxt(o) { return o.items.map(function (p) { return p.n + ' ' + (p.n === 1 ? ITEMS[p.k].one : ITEMS[p.k].n.toLowerCase()); }).join(', '); }

    /* ---- заказы и упаковка */
    var packRaf = 0;
    function ordersSheet() {
      tutOrders = true;
      var rows = st.orders.length ? st.orders.map(function (o) {
        var lack = need(o), left = Math.max(0, (o.due - Date.now()) / 1000);
        return '<div class="gk-it gz-ord' + (left < 45 ? ' hot' : '') + '"><span class="t"><b>' + esc(o.name) + '<span class="gz-pay"><i class="gz-coin"></i>' + fmt(o.pay) + '</span></b><small>' + esc(itemsTxt(o)) + ' · осталось ' + GK.dur(left) + '</small>' +
          (lack.length ? '<small class="no">Не хватает: ' + lack.map(function (p) { return (p.n - (st.stock[p.k] || 0)) + ' ' + ITEMS[p.k].n.toLowerCase(); }).join(', ') + '</small>' : '') + '</span><button class="gk-btn sm" data-gz-pack="' + o.id + '"' + (lack.length ? ' disabled' : '') + '>Собрать</button></div>';
      }).join('') : '<p class="gk-lead">Новых заказов пока нет. Они появляются сами, пока работает склад.</p>';
      var body = S.sheet('Заказы клиентов', '<div class="gk-list">' + rows + '</div><p class="gk-note">Сборка стоит 1 энергии. Поймайте зелёную зону при упаковке, и клиент заплатит больше.</p>', { w: 460 });
      body.addEventListener('click', function (e) { var b = e.target.closest('[data-gz-pack]'); if (b && !b.disabled) packGame(+b.getAttribute('data-gz-pack')); });
    }
    function packGame(id) {
      var o = st.orders.filter(function (x) { return x.id === id; })[0]; if (!o || need(o).length) return;
      if (!E.has(1)) { GK.noEnergy(S, E, st, 'Собрать заказ'); return; }
      var zone = clamp(.2 - st.lvl * .004, .12, .2), zs = .15 + Math.random() * (.85 - zone - .15), t0 = performance.now(), dir = 1, pos = 0, done = false;
      var body = S.sheet('Упаковка: ' + esc(o.name), '<p class="gk-lead">' + esc(itemsTxt(o)) + '</p><div class="gz-meter" id="gz-m"><i class="z" style="left:' + zs * 100 + '%;width:' + zone * 100 + '%"></i><b class="p"></b></div><div class="gk-row"><button class="gk-btn" id="gz-stamp" type="button">Заклеить скотчем</button></div><p class="gk-note">Нажмите, когда бегунок в зелёной зоне. Пробел тоже работает.</p>', { w: 420, onclose: function () { cancelAnimationFrame(packRaf); W.removeEventListener('keydown', key); } });
      var mk = body.querySelector('.p'), spd = .85 + st.lvl * .03;
      (function tick(t) { if (done) return; pos += dir * spd * Math.min(.05, (t - t0) / 1000) ; t0 = t; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } mk.style.left = pos * 100 + '%'; packRaf = requestAnimationFrame(tick); })(t0);
      function finish() {
        if (done) return; done = true; cancelAnimationFrame(packRaf); W.removeEventListener('keydown', key);
        var d = pos >= zs && pos <= zs + zone ? 'perfect' : (pos >= zs - zone && pos <= zs + zone * 2 ? 'good' : 'ok'), mult = d === 'perfect' ? 1.5 : d === 'good' ? 1.2 : 1;
        if (!E.spend(1)) { S.closeSheet(); return; }
        o.items.forEach(function (p) { st.stock[p.k] -= p.n; });
        st.orders = st.orders.filter(function (x) { return x.id !== o.id; });
        var coins = Math.round(o.pay * mult), n = o.items.reduce(function (a, p) { return a + p.n; }, 0);
        addCoins(coins); st.stats.shipped++; if (d === 'perfect') st.stats.perfect++; st.rating = clamp(st.rating + (d === 'perfect' ? .08 : d === 'good' ? .04 : .01), 1, 5);
        GK.sfx.tape(); setTimeout(function () { GK.sfx.coin(); }, 260);
        var from = padPos(o.items[0].k, 0); flyers.push({ t: 0, d: 1.1, kind: 'parcel', from: from, to: [8.6, 2.6, 1.7] });
        var lab = d === 'perfect' ? 'Идеально! ×1,5' : d === 'good' ? 'Хорошо ×1,2' : 'Принято';
        S.closeSheet(); S.toast(lab + ': +' + fmt(coins) + ' монет', d === 'perfect' ? 'gold' : 'ok');
        var sp = w2s(8.6, 2.6, 1.7); S.float(sp[0], sp[1] - 20, '+' + fmt(coins), '#ffd34d', 22);
        addXp(8 + 3 * n); dirty(true);
      }
      function key(e) { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); finish(); } }
      W.addEventListener('keydown', key); body.querySelector('#gz-stamp').addEventListener('click', finish); body.querySelector('#gz-m').addEventListener('pointerdown', finish);
    }

    /* ---- склад и улучшения */
    function stockSheet() {
      var cap = capOf(st), tot = stockTotal(st);
      var rows = unlockedItems(st).map(function (k) { return '<div class="gk-it"><span class="ic"><i class="gz-crate" style="--c:' + ITEMS[k].c + '"></i></span><span class="t"><b>' + ITEMS[k].n + '</b><small>На складе: ' + (st.stock[k] || 0) + '</small></span></div>'; }).join('');
      var ups = Object.keys(UPS).map(function (k) {
        var u = UPS[k], l = st.up[k] || 0, c = u.cost(l), max = l >= u.max;
        return '<div class="gk-it"><span class="t"><b>' + u.n + ' · ' + l + '/' + u.max + '</b><small>' + u.d + '</small></span><button class="gk-btn sm" data-gz-up="' + k + '"' + (max || st.coins < c ? ' disabled' : '') + '>' + (max ? 'Максимум' : '<i class="gz-coin"></i>' + fmt(c)) + '</button></div>';
      }).join('');
      var body = S.sheet('Склад', '<div class="gk-it"><span class="t"><b>Занято ' + tot + ' из ' + cap + '</b><div class="gk-bar"><i style="width:' + Math.min(100, tot / cap * 100) + '%"></i></div></span></div><div class="gk-list">' + rows + '</div><h3 class="gz-h">Улучшения</h3><div class="gk-list">' + ups + '</div>', { w: 460 });
      body.addEventListener('click', function (e) {
        var b = e.target.closest('[data-gz-up]'); if (!b || b.disabled) return;
        var k = b.getAttribute('data-gz-up'), u = UPS[k], l = st.up[k] || 0, c = u.cost(l);
        if (st.coins < c || l >= u.max) return; st.coins -= c; st.up[k] = l + 1; GK.sfx.build(); GK.sfx.up(); dirty(true); S.closeSheet(); stockSheet();
      });
    }
    function rewardsSheet() {
      function row(name, lvlNeed, mins) { var have = st.lvl >= lvlNeed, ok = (Date.now() - st.t0) / 60000 >= mins; return '<div class="gk-it' + (have ? ' done' : '') + '"><span class="t"><b>Рамка «' + name + '»</b><small>' + (have ? 'Уровень достигнут, рамка выдаётся автоматически' : 'Нужен уровень хаба ' + lvlNeed + ', сейчас ' + st.lvl) + (have && !ok ? ' (нужно ещё немного поиграть)' : '') + '</small><div class="gk-bar"><i style="width:' + Math.min(100, st.lvl / lvlNeed * 100) + '%"></i></div></span></div>'; }
      S.sheet('Награды', '<div class="gk-list">' + row('Накладная', 5, 25) + row('Грузовой хаб', 10, 120) + '</div><p class="gk-note">Рамки появляются в профиле сами. Игра пока не даёт ониксы и опыт магазина.</p>', { w: 440 });
    }
    S.onhelp = function () { S.sheet('Как играть', '<div class="gk-list"><div class="gk-it"><span class="t"><b>1. Разгрузите фуру</b><small>Нажмите на фуру у дока. Это стоит 1 энергии.</small></span></div><div class="gk-it"><span class="t"><b>2. Откройте «Заказы»</b><small>Клиенты просят товар со склада.</small></span></div><div class="gk-it"><span class="t"><b>3. Упакуйте</b><small>Поймайте зелёную зону: заказ оплатят больше.</small></span></div><div class="gk-it"><span class="t"><b>4. Улучшайте склад</b><small>Больше места, чаще фуры, выше оплата. Растите до логистического хаба.</small></span></div></div>', { w: 440 }); };

    /* ---- обучение */
    var tutOrders = false, hasTruckWait = function () { return st.trucks.some(function (t) { return t.s === 'wait'; }); };
    function truckScr(tr) { return w2s((tr || st.trucks[0] || { dock: 0 }).dock * 4 - 4, -7, 2); }
    var tutor = GK.tutor(S, [
      { id: 'hi', t: 'Добро пожаловать в Грузоманию! Вы управляете складом: принимайте фуры, собирайте заказы и растите до логистического хаба.', ok: 'Начнём', top: true },
      { id: 'truck', t: 'К доку приехала фура. Нажмите на неё, чтобы разгрузить.', at: function () { return truckScr(); }, done: function () { return st.stats.crates > 0; } },
      { id: 'orders', t: 'Товар на складе. Откройте «Заказы».', at: function () { var b = $('[data-gz="orders"]'), r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top]; }, fixed: true, done: function () { return tutOrders || st.stats.shipped > 0; } },
      { id: 'pack', t: 'Нажмите «Собрать» и остановите бегунок в зелёной зоне.', top: true, inSheet: true, done: function () { return st.stats.shipped > 0; } },
      { id: 'end', t: 'Первый заказ отправлен! Дальше: разгружайте фуры, закрывайте заказы и улучшайте склад кнопкой «Склад».', ok: 'Отлично', top: true }
    ], st, function () { dirty(true); });

    /* ---- подсказка «что дальше» и кнопка действия */
    function hint() {
      var h = $('.gz-hint'), a = $('.gz-act'), tr = st.trucks.filter(function (t) { return t.s === 'wait'; })[0], rdy = st.orders.filter(function (o) { return !need(o).length; })[0], msg = '', act = '';
      if (tr) { msg = 'Фура ждёт: ' + ITEMS[tr.k].n.toLowerCase() + ' ×' + tr.n + '. Нажмите на неё.'; act = 'Разгрузить фуру'; }
      else if (rdy) { msg = 'Заказ для «' + rdy.name + '» можно собрать.'; act = 'Открыть заказы'; }
      else if (st.orders.length) { msg = 'Ждём товар для заказов. Скоро приедет фура.'; }
      else msg = 'Скоро появятся заказы и фуры. Можно улучшить склад.';
      h.hidden = tutor.active() || S.sheetOpen(); h.textContent = msg; a.hidden = !act || tutor.active() || S.sheetOpen(); a.textContent = act; a._act = act;
    }
    $('.gz-act').addEventListener('click', function () { if (this._act === 'Разгрузить фуру') unload(st.trucks.filter(function (t) { return t.s === 'wait'; })[0]); else ordersSheet(); });
    S.root.addEventListener('click', function (e) { var b = e.target.closest('[data-gz]'); if (!b) return; GK.sfx.click(); var k = b.getAttribute('data-gz'); if (k === 'orders') ordersSheet(); else if (k === 'stock') stockSheet(); else if (k === 'rewards') rewardsSheet(); });

    /* ---- ввод: нажатие по фуре и по складу */
    function truckRect(tr) {
      var sp = META.sprites[['truck_w', 'truck_o', 'truck_b'][tr.dock]], off = truckOff(tr), a = w2p(tr.dock * 4 - 4, -7 + off, 0), x = a[0] - sp.ax, y = a[1] - sp.ay, s0 = p2s(x, y), s1 = p2s(x + sp.w, y + sp.h);
      return [s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]];
    }
    I.onTap = function (x, y) {
      if (!ready || S.sheetOpen()) return;
      for (var i = 0; i < st.trucks.length; i++) { var tr = st.trucks[i]; if (tr.s !== 'wait') continue; var r = truckRect(tr); if (x > r[0] && x < r[0] + r[2] && y > r[1] + r[3] * .2 && y < r[1] + r[3]) { unload(tr); return; } }
      var pad = w2s(-8.5, -6, .5); if (Math.hypot(x - pad[0], y - pad[1]) < 70 * cam.z) { stockSheet(); return; }
      var bld = w2s(0, 3, 3); if (Math.hypot(x - bld[0], y - bld[1]) < 120 * cam.z) ordersSheet();
    };
    function truckOff(tr) { return tr.s === 'in' ? -24 * (1 - GK.ease(clamp(tr.t, 0, 1))) : tr.s === 'out' ? -24 * GK.ease(clamp(tr.t, 0, 1)) : 0; }

    /* ---- обновление */
    var lastHud = 0, secT = 0;
    function update(dt) {
      T += dt; var now = Date.now();
      if (ready) {
        st.trucks.forEach(function (tr) { if (tr.s === 'in') { tr.t += dt / 2.2; if (tr.t >= 1) { tr.s = 'wait'; tr.t = 1; GK.sfx.truck(); } } else if (tr.s === 'out') tr.t += dt / 1.8; });
        st.trucks = st.trucks.filter(function (tr) { return !(tr.s === 'out' && tr.t >= 1); });
        if (now >= st.nextTruck && st.trucks.length < docksOf(st)) {
          var used = st.trucks.map(function (t) { return t.dock; }), dock = [0, 1, 2].filter(function (d) { return d < docksOf(st) && used.indexOf(d) < 0; })[0];
          if (dock != null) { var items = unlockedItems(st), k = items[Math.floor(Math.random() * items.length)]; st.trucks.push({ dock: dock, k: k, n: 3 + Math.floor(Math.random() * 3) + Math.floor(st.lvl / 4), s: 'in', t: 0 }); st.nextTruck = now + truckEvery(st) * (.8 + Math.random() * .5); GK.sfx.truck(); dirty(); }
          else st.nextTruck = now + 5000;
        }
        if (now >= st.nextOrder && st.orders.length < maxOrders(st)) { st.orders.push(orderGen()); st.nextOrder = now + (22 + Math.random() * 25) * 1000; GK.sfx.click(); dirty(); }
        else if (now >= st.nextOrder) st.nextOrder = now + 8000;
        secT += dt;
        if (secT > 1) {
          secT = 0;
          var before = st.orders.length; st.orders = st.orders.filter(function (o) { if (o.due < now) { st.rating = clamp(st.rating - .12, 1, 5); st.stats.expired++; return false; } return true; });
          if (st.orders.length < before) { S.toast('Заказ просрочен, рейтинг снизился', 'warn'); dirty(); }
          saver.tick(); hint(); hud();
        }
        tutor.update();
      }
      parts.step(dt);
      for (var i = flyers.length - 1; i >= 0; i--) { flyers[i].t += dt; if (flyers[i].t >= flyers[i].d) flyers.splice(i, 1); }
      draw();
    }
    function hud() {
      var need_ = xpNeed(st.lvl);
      lvChip.querySelector('b').textContent = st.lvl; lvChip.querySelector('.bar i').style.width = (st.lvl >= LVL_MAX ? 100 : Math.min(100, st.xp / need_ * 100)) + '%'; lvChip.title = st.lvl >= LVL_MAX ? 'Максимальный уровень' : 'Опыт ' + st.xp + ' из ' + need_;
      coinChip.lastChild.textContent = fmt(st.coins); rateChip.lastChild.textContent = String(st.rating.toFixed(1)).replace('.', ','); enUI(st);
      var rd = st.orders.filter(function (o) { return !need(o).length; }).length, em = $('[data-gz="orders"] em'); em.hidden = !rd; em.textContent = rd;
    }

    /* ---- рисование */
    var cx = S.cx;
    function spr(name, wx, wy, wz, alpha) {
      var s = META.sprites[name], img = IMG[name]; if (!img) return; var p = w2p(wx, wy, wz || 0), q = p2s(p[0] - s.ax, p[1] - s.ay);
      if (alpha != null) cx.globalAlpha = alpha; cx.drawImage(img, q[0], q[1], s.w * cam.z, s.h * cam.z); if (alpha != null) cx.globalAlpha = 1;
    }
    function draw() {
      cx.fillStyle = '#e7f5fc'; cx.fillRect(0, 0, S.w, S.h);
      if (!ready) return;
      var g = cx.createLinearGradient(0, 0, 0, S.h); g.addColorStop(0, '#cfe8fa'); g.addColorStop(1, '#f3fbff'); cx.fillStyle = g; cx.fillRect(0, 0, S.w, S.h);
      var o0 = p2s(0, 0); cx.drawImage(IMG.bg, o0[0], o0[1], META.W * cam.z, META.H * cam.z);
      // мягкие тени под объектами (свет слева, тень падает вправо)
      function shadow(wx, wy, w, d, h, a) {
        var pts = [], dx = h * .95, dy = h * .14, hw = w / 2, hd = d / 2, c = [[wx - hw, wy - hd], [wx + hw, wy - hd], [wx + hw, wy + hd], [wx - hw, wy + hd]];
        c.forEach(function (q) { pts.push(w2s(q[0], q[1], 0)); pts.push(w2s(q[0] + dx, q[1] + dy, 0)); });
        var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0] / pts.length; my += p[1] / pts.length; }); pts.sort(function (p, q) { return Math.atan2(p[1] - my, p[0] - mx) - Math.atan2(q[1] - my, q[0] - mx); });
        cx.fillStyle = 'rgba(30,60,110,' + a + ')'; cx.beginPath(); pts.forEach(function (p, i) { if (i) cx.lineTo(p[0], p[1]); else cx.moveTo(p[0], p[1]); }); cx.closePath(); cx.fill();
      }
      unlockedItems(st).forEach(function (k, pi) { var y = -3.2 - pi * 2.9; shadow(-8.5, y, 2, 2, .2, .16); var n = Math.min(st.stock[k] || 0, 12); if (n) shadow(-8.5, y, 1.8, 1.8, .24 + Math.ceil(n / 4) * .7, .13); });
      st.trucks.forEach(function (tr) { var off = truckOff(tr); shadow(tr.dock * 4 - 4, -7.4 + off, 2.6, 7.4, 2.8, .17); });
      var list = [];
      // паллеты и стопки ящиков
      unlockedItems(st).forEach(function (k, pi) {
        var y = -3.2 - pi * 2.9; list.push({ d: w2p(-8.5, y, 0)[1], f: function () { spr('pallet', -8.5, y, 0); } });
        var n = Math.min(st.stock[k] || 0, 12);
        for (var i = 0; i < n; i++) (function (i) { var cxw = -8.5 + ((i % 2) - .5) * .9, cyw = y + (((Math.floor(i / 2)) % 2) - .5) * .9, z = .24 + Math.floor(i / 4) * .7; list.push({ d: w2p(-8.5, y, 0)[1] + 1 + .01 * i + Math.floor(i / 4) * .3, f: function () { spr(ITEMS[k].spr, cxw, cyw, z); } }); })(i);
      });
      st.trucks.forEach(function (tr) { var nm = ['truck_w', 'truck_o', 'truck_b'][tr.dock], off = truckOff(tr), wx = tr.dock * 4 - 4; list.push({ d: w2p(wx, -7 + off, 0)[1], f: function () { spr(nm, wx, -7 + off, 0); } }); });
      list.sort(function (a, b) { return a.d - b.d; }); list.forEach(function (it) { it.f(); });
      // кольца и подписи у ждущих фур
      st.trucks.forEach(function (tr) {
        if (tr.s !== 'wait') return; var c = w2s(tr.dock * 4 - 4, -7, 0), k = .5 + .5 * Math.sin(T * 4);
        cx.save(); cx.translate(c[0], c[1] + 40 * cam.z); cx.scale(1, .5); cx.strokeStyle = 'rgba(255,211,77,' + (.5 + .4 * k) + ')'; cx.lineWidth = 5 * cam.z; cx.beginPath(); cx.arc(0, 0, (150 + 12 * k) * cam.z, 0, PI * 2); cx.stroke(); cx.restore();
        var t = ITEMS[tr.k].n + ' ×' + tr.n, p = w2s(tr.dock * 4 - 4, -7, 3.4); cx.font = '800 ' + Math.round(14 * clamp(cam.z + .3, .8, 1.3)) + 'px Onest,system-ui,sans-serif'; var tw = cx.measureText(t).width + 22, th = 28 * clamp(cam.z + .3, .8, 1.3);
        cx.fillStyle = 'rgba(11,29,58,.86)'; GK.rr(cx, p[0] - tw / 2, p[1] - th - 10 * k, tw, th, th / 2); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, p[0], p[1] - th / 2 - 10 * k);
      });
      // летающие ящики и посылки
      flyers.forEach(function (f) {
        if (f.t < 0) return; var k = GK.ease(clamp(f.t / f.d, 0, 1)), x = GK.lerp(f.from[0], f.to[0], k), y = GK.lerp(f.from[1], f.to[1], k), z = GK.lerp(f.from[2], f.to[2], k) + Math.sin(k * PI) * 2.6;
        spr(f.kind === 'parcel' ? 'parcel' : ITEMS[f.k].spr, x, y, z, 1);
      });
      parts.draw(cx, 0, 0);
    }

    /* ---- загрузка графики */
    function loadArt() {
      return fetch(ART + 'gz.json').then(function (r) { return r.json(); }).then(function (m) {
        META = m; var names = Object.keys(m.sprites), left = names.length + 1;
        return new Promise(function (res, rej) {
          function one(name, file) { var im = new Image(); im.onload = function () { IMG[name] = im; if (!--left) res(); }; im.onerror = function () { rej(new Error('img')); }; im.src = ART + file; }
          one('bg', m.bg); names.forEach(function (n) { one(n, m.sprites[n].f); });
        });
      });
    }
    function start() {
      ready = true; fit(); hud(); hint(); S.loaded(); GK.music('warm');
      S.onclose = function () { if (!alive) return; alive = false; loop.stop(); I.destroy(); cancelAnimationFrame(packRaf); saver.flush(true).then(function () { saver.stop(); saver.off(); S.destroy(); ctx.onClose(); }); };
    }
    var loop = GK.loop(function (dt) { if (alive) update(dt); });
    S.onclose = function () { if (!alive) return; alive = false; loop.stop(); I.destroy(); S.destroy(); ctx.onClose(); };
    loadArt().then(start, function () {
      S.loaded(); S.sheet('Нет связи', '<p class="gk-lead">Не удалось загрузить графику игры. Проверьте интернет и попробуйте ещё раз.</p><div class="gk-row"><button class="gk-btn" id="gz-retry" type="button">Повторить</button><button class="gk-btn g" id="gz-quit" type="button">Выйти</button></div>', { noClose: true, w: 380 });
      $('#gz-retry').addEventListener('click', function () { location.reload(); }); $('#gz-quit').addEventListener('click', function () { S.onclose(); });
    });
    W.__gz = { st: st, S: S, ordersSheet: ordersSheet, stockSheet: stockSheet, unload: unload, packGame: packGame, cam: cam, tutor: tutor, update: update, E: E, w2s: w2s, truckRect: truckRect, I: I };
    return { close: function () { S.onclose(); } };
  }

  /* ================================================================ стили игры */
  function injectCss() {
    if (document.getElementById('gz-css')) return; var s = document.createElement('style'); s.id = 'gz-css';
    s.textContent = '.gz{--gk-acc:linear-gradient(140deg,#43c9e3,#1a86c0)}' +
      '.gz-coin{display:inline-block;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffd34d 55%,#c98a10);box-shadow:inset 0 0 0 2px #c98a10;vertical-align:-3px;flex:none}.gk-btn .gz-coin{width:14px;height:14px}' +
      '.gz-lv b{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:linear-gradient(140deg,#43c9e3,#1a86c0);font-size:.8rem}.gz-lv .bar{width:46px;height:6px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}.gz-lv .bar i{display:block;height:100%;background:#43c9e3;transition:width .4s}' +
      '.gz-rate .s{color:#ffd34d}' +
      '.gz-dock{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:6px;z-index:5;padding:6px;border-radius:18px;background:rgba(11,29,58,.72);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}' +
      '.gz-d{position:relative;height:46px;padding:0 16px;border-radius:13px;border:0;background:rgba(255,255,255,.1);font-weight:800;font-size:.9rem;white-space:nowrap}.gz-d:active{transform:scale(.95)}' +
      '.gz-d em{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#ff5a6e;color:#fff;font:800 .72rem/20px Onest,sans-serif;text-align:center;font-style:normal;padding:0 5px}.gz-d em[hidden]{display:none}' +
      '.gz-hint{position:absolute;left:50%;top:calc(60px + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(92vw,440px);padding:9px 14px;border-radius:14px;background:rgba(255,255,255,.95);color:#0f2747;font-weight:700;font-size:.86rem;line-height:1.3;text-align:center;box-shadow:0 8px 20px rgba(8,30,70,.25);z-index:4;pointer-events:none}.gz-hint[hidden],.gz-act[hidden]{display:none}' +
      '.gz-act{position:absolute;left:50%;bottom:calc(78px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);height:50px;padding:0 24px;border-radius:16px;border:0;background:linear-gradient(140deg,#ffb347,#ff7a1a);color:#fff;font-weight:800;font-size:1rem;box-shadow:0 10px 26px rgba(255,122,26,.45),0 0 0 3px rgba(255,255,255,.25);z-index:5;white-space:nowrap}' +
      '.gz-ord .no{color:#ff8a80}.gz-ord.hot{border-color:rgba(255,138,128,.6)}.gz-pay{display:inline-flex;align-items:center;gap:3px;color:#ffd34d;font-size:.82rem;margin-left:8px}.gz-pay .gz-coin{width:13px;height:13px}' +
      '.gz-crate{display:block;width:28px;height:28px;border-radius:7px;background:var(--c);box-shadow:inset 0 0 0 3px rgba(0,0,0,.14),inset 0 -6px 0 rgba(0,0,0,.12)}.gz-h{margin:6px 0 0;font-size:.95rem}' +
      '.gz-meter{position:relative;height:40px;border-radius:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);overflow:hidden;touch-action:manipulation}.gz-meter .z{position:absolute;top:0;bottom:0;background:linear-gradient(180deg,#5ef08a,#1fae55);opacity:.9}.gz-meter .p{position:absolute;top:-2px;bottom:-2px;width:8px;margin-left:-4px;border-radius:6px;background:#fff;box-shadow:0 0 12px rgba(255,255,255,.8)}' +
      '.gz .gk-tut{z-index:25}';
    document.head.appendChild(s);
  }
  W.Gruz = { open: open };
})(window);
