/* gruz.js: «Грузомания», 2D-игра про склад (изометрия). Каркас: assets/gamekit.js.
   Цикл: закупка у компьютера → грузовик привозит коробки на приёмку → коробки на стеллажи → заказ на стол упаковки →
   товар со стеллажей на стол → мини-игра упаковки → посылка к воротам отгрузки → монеты, опыт, рейтинг.
   Развитие: новые зоны, оборудование на готовых местах, декор, работники (автоматизация и доход вне игры),
   контракты с городами, уровни склада, достижения. Энергия тратится на каждое ручное действие. */
(function (W) {
  'use strict';
  var GK = W.GK, PI = Math.PI, fmt = GK.fmt, esc = GK.esc, clamp = GK.clamp;
  var TW = 64, TH = 32, GW = 20, GH = 14;

  /* ================================================================ данные */
  var ITEMS = {
    tee: { n: 'Футболки', one: 'Футболка', c: '#ff5a6e', buy: 8, val: 22, lvl: 1 },
    hood: { n: 'Худи', one: 'Худи', c: '#8a6cff', buy: 17, val: 44, lvl: 2 },
    snk: { n: 'Кроссовки', one: 'Кроссовки', c: '#ffae2b', buy: 28, val: 70, lvl: 3 },
    cap: { n: 'Кепки', one: 'Кепка', c: '#2fc78a', buy: 10, val: 27, lvl: 4 },
    bag: { n: 'Сумки', one: 'Сумка', c: '#3fa3ff', buy: 24, val: 60, lvl: 6 },
    jkt: { n: 'Куртки', one: 'Куртка', c: '#3b4a6b', buy: 46, val: 112, lvl: 7 }
  };
  var CRATE = 4; // штук в одной коробке
  var ZONES = {
    A: { n: 'Стартовое помещение', r: [0, 0, 8, 7], cost: 0, lvl: 1 },
    B: { n: 'Стеллажный зал', r: [8, 0, 6, 7], cost: 600, lvl: 2, d: 'Ещё 4 места под стеллажи' },
    C: { n: 'Цех упаковки', r: [0, 7, 8, 7], cost: 2500, lvl: 4, d: '3 места под столы упаковки и уголок отдыха' },
    D: { n: 'Экспедиция', r: [14, 0, 6, 7], cost: 6000, lvl: 6, d: 'Вторые ворота отгрузки и 2 стеллажа' },
    E: { n: 'Большой склад', r: [8, 7, 12, 7], cost: 15000, lvl: 8, d: '6 мест под стеллажи' }
  };
  /* готовые места: t тип, z зона, i,j клетка, w,d размер. Цены уровней в UP */
  var SLOTS = [
    { id: 'in', t: 'dockIn', z: 'A', i: 0, j: 3, w: 1, d: 2, free: true },
    { id: 'pc', t: 'pc', z: 'A', i: 1, j: 0, w: 1, d: 1, free: true },
    { id: 'board', t: 'board', z: 'A', i: 3, j: 0, w: 2, d: 1, free: true },
    { id: 'out', t: 'dockOut', z: 'A', i: 6, j: 0, w: 2, d: 1, free: true },
    { id: 'a1', t: 'shelf', z: 'A', i: 4, j: 3, w: 2, d: 1, free: true },
    { id: 'a2', t: 'shelf', z: 'A', i: 4, j: 5, w: 2, d: 1 },
    { id: 't1', t: 'table', z: 'A', i: 1, j: 2, w: 2, d: 1, free: true, iy: 1 },
    { id: 'hr', t: 'hire', z: 'A', i: 7, j: 4, w: 1, d: 1, free: true },
    { id: 'da1', t: 'decor', z: 'A', i: 0, j: 6, w: 1, d: 1 },
    { id: 'da2', t: 'decor', z: 'A', i: 7, j: 6, w: 1, d: 1 },
    { id: 'b1', t: 'shelf', z: 'B', i: 9, j: 1, w: 2, d: 1 }, { id: 'b2', t: 'shelf', z: 'B', i: 9, j: 4, w: 2, d: 1 },
    { id: 'b3', t: 'shelf', z: 'B', i: 12, j: 1, w: 2, d: 1 }, { id: 'b4', t: 'shelf', z: 'B', i: 12, j: 4, w: 2, d: 1 },
    { id: 'db1', t: 'decor', z: 'B', i: 13, j: 6, w: 1, d: 1 },
    { id: 't2', t: 'table', z: 'C', i: 1, j: 8, w: 2, d: 1 }, { id: 't3', t: 'table', z: 'C', i: 5, j: 8, w: 2, d: 1 }, { id: 't4', t: 'table', z: 'C', i: 1, j: 11, w: 2, d: 1 },
    { id: 'dc1', t: 'decor', z: 'C', i: 5, j: 12, w: 2, d: 1, big: true }, { id: 'dc2', t: 'decor', z: 'C', i: 7, j: 10, w: 1, d: 1 },
    { id: 'out2', t: 'dockOut', z: 'D', i: 17, j: 0, w: 2, d: 1 },
    { id: 'd1', t: 'shelf', z: 'D', i: 15, j: 3, w: 2, d: 1 }, { id: 'd2', t: 'shelf', z: 'D', i: 15, j: 5, w: 2, d: 1 },
    { id: 'dd1', t: 'decor', z: 'D', i: 19, j: 6, w: 1, d: 1 },
    { id: 'e1', t: 'shelf', z: 'E', i: 9, j: 8, w: 2, d: 1 }, { id: 'e2', t: 'shelf', z: 'E', i: 12, j: 8, w: 2, d: 1 }, { id: 'e3', t: 'shelf', z: 'E', i: 15, j: 8, w: 2, d: 1 },
    { id: 'e4', t: 'shelf', z: 'E', i: 9, j: 11, w: 2, d: 1 }, { id: 'e5', t: 'shelf', z: 'E', i: 12, j: 11, w: 2, d: 1 }, { id: 'e6', t: 'shelf', z: 'E', i: 15, j: 11, w: 2, d: 1 },
    { id: 'de1', t: 'decor', z: 'E', i: 19, j: 13, w: 1, d: 1 }, { id: 'de2', t: 'decor', z: 'E', i: 18, j: 9, w: 1, d: 1 }
  ];
  var SL = {}; SLOTS.forEach(function (s) { SL[s.id] = s; });
  var UP = {
    shelf: { n: 'Стеллаж', max: 5, cost: [120, 300, 700, 1500, 3000], info: function (l) { return 'Вмещает ' + shelfCap(l) + ' шт.'; } },
    table: { n: 'Стол упаковки', max: 4, cost: [250, 600, 1400, 3200], info: function (l) { return 'Упаковка ' + (l >= 2 ? 'быстрее, ' : '') + 'посылка дороже на ' + Math.round((tableK(l) - 1) * 100) + '%'; } },
    dockIn: { n: 'Ворота приёмки', max: 4, cost: [0, 400, 1200, 3000], info: function (l) { return 'Грузовик приезжает за ' + truckTime(l) + ' с, берёт до ' + truckCap(l) + ' коробок'; } },
    dockOut: { n: 'Ворота отгрузки', max: 4, cost: [800, 500, 1500, 3500], info: function (l) { return 'Курьерская служба платит +' + Math.round((outK(l) - 1) * 100) + '%'; } }
  };
  function shelfCap(l) { return 4 + l * 4; }
  function tableK(l) { return 1 + (l - 1) * .08; }
  function truckTime(l) { return Math.max(3, 9 - l * 1.5); }
  function truckCap(l) { return 2 + l * 2; }
  function outK(l) { return 1 + (l - 1) * .06; }
  var DECOR = [
    { id: 'plant', n: 'Фикус', cost: 150, cozy: 1 }, { id: 'lamp', n: 'Торшер', cost: 220, cozy: 1 }, { id: 'cooler', n: 'Кулер с водой', cost: 300, cozy: 2 },
    { id: 'poster', n: 'Постер ONION', cost: 250, cozy: 1 }, { id: 'coffee', n: 'Кофемашина', cost: 900, cozy: 3, en: 5 }, { id: 'sofa', n: 'Диван', cost: 1200, cozy: 3, big: true },
    { id: 'arcade', n: 'Игровой автомат', cost: 2400, cozy: 4, big: true }, { id: 'tree', n: 'Пальма в кадке', cost: 700, cozy: 2 }
  ];
  var FLOORS = [{ id: 'conc', n: 'Бетон', cost: 0, a: '#c9ced8', b: '#bfc5d0' }, { id: 'wood', n: 'Дерево', cost: 1500, a: '#d9b98a', b: '#cfae7d' }, { id: 'tile', n: 'Плитка', cost: 2500, a: '#e6ecf4', b: '#d4dce8' }, { id: 'epoxy', n: 'Наливной пол', cost: 4500, a: '#9fc8e6', b: '#93bddc' }];
  var WALLS = [{ id: 'grey', n: 'Серые', cost: 0, c: '#8d9ab0' }, { id: 'brick', n: 'Кирпич', cost: 1200, c: '#b7684a' }, { id: 'navy', n: 'Фирменные ONION', cost: 2000, c: '#1d4f8f' }, { id: 'mint', n: 'Мятные', cost: 1800, c: '#4fae96' }];
  var WORKERS = [
    { id: 'loader', n: 'Грузчик', d: 'Разносит коробки с приёмки по стеллажам', lvl: 2, cost: 500, c: '#ff9f2b' },
    { id: 'picker', n: 'Комплектовщик', d: 'Носит товар со стеллажей на столы упаковки', lvl: 3, cost: 900, c: '#8a6cff' },
    { id: 'packer', n: 'Упаковщик', d: 'Сам упаковывает собранные заказы', lvl: 4, cost: 1500, c: '#2fc78a' },
    { id: 'courier', n: 'Курьер', d: 'Относит готовые посылки к воротам', lvl: 5, cost: 2200, c: '#ff5a6e' },
    { id: 'buyer', n: 'Закупщик', d: 'Сам закупает товар, когда его мало', lvl: 6, cost: 3000, c: '#3fa3ff' },
    { id: 'disp', n: 'Диспетчер', d: 'Сам ставит заказы на свободные столы', lvl: 7, cost: 3500, c: '#ffd34d' }
  ];
  var CITIES = [
    { id: 'msk', n: 'Москва', lvl: 3, x: .2, y: .45, k: 1.6, size: [4, 6] }, { id: 'spb', n: 'Санкт-Петербург', lvl: 3, x: .17, y: .25, k: 1.7, size: [4, 7] },
    { id: 'kzn', n: 'Казань', lvl: 5, x: .33, y: .5, k: 1.9, size: [5, 8] }, { id: 'ekb', n: 'Екатеринбург', lvl: 7, x: .45, y: .48, k: 2.1, size: [6, 9] },
    { id: 'nsk', n: 'Новосибирск', lvl: 9, x: .62, y: .58, k: 2.4, size: [7, 10] }, { id: 'vvo', n: 'Владивосток', lvl: 10, x: .9, y: .7, k: 2.9, size: [8, 12] }
  ];
  var ACH = [
    { id: 'ship1', n: 'Первая посылка', d: 'Отправить 1 посылку', k: 'shipped', need: 1, coins: 50 },
    { id: 'ship25', n: 'Поток', d: 'Отправить 25 посылок', k: 'shipped', need: 25, coins: 300 },
    { id: 'ship100', n: 'Сотня', d: 'Отправить 100 посылок', k: 'shipped', need: 100, coins: 1000 },
    { id: 'ship500', n: 'Конвейер', d: 'Отправить 500 посылок', k: 'shipped', need: 500, coins: 5000 },
    { id: 'perfect', n: 'Аккуратист', d: '20 посылок на 3 звезды', k: 'perfect', need: 20, coins: 600 },
    { id: 'crates', n: 'Грузчик года', d: 'Разгрузить 50 коробок', k: 'crates', need: 50, coins: 500 },
    { id: 'earn', n: 'Оборот', d: 'Заработать 10 000 монет', k: 'earned', need: 10000, coins: 800 },
    { id: 'earn2', n: 'Магнат', d: 'Заработать 100 000 монет', k: 'earned', need: 100000, coins: 5000 },
    { id: 'contract', n: 'Партнёр', d: 'Выполнить контракт с городом', k: 'contracts', need: 1, coins: 400 },
    { id: 'contract10', n: 'Федеральная сеть', d: 'Выполнить 10 контрактов', k: 'contracts', need: 10, coins: 3000 },
    { id: 'cities', n: 'Вся страна', d: 'Работать со всеми 6 городами', k: 'cityN', need: 6, coins: 4000 },
    { id: 'team', n: 'Команда', d: 'Нанять всех 6 сотрудников', k: 'workerN', need: 6, coins: 2500 },
    { id: 'zones', n: 'Империя', d: 'Открыть все зоны склада', k: 'zoneN', need: 5, coins: 4000 },
    { id: 'decor', n: 'Дизайнер', d: 'Поставить 6 предметов декора', k: 'decorN', need: 6, coins: 1200 },
    { id: 'lvl5', n: 'Растём', d: 'Склад 5 уровня', k: 'lvl', need: 5, coins: 700 },
    { id: 'lvl10', n: 'Хаб', d: 'Склад 10 уровня', k: 'lvl', need: 10, coins: 3000 }
  ];
  var LVL_MAX = 15;
  function xpNeed(l) { return Math.round(70 * Math.pow(l, 1.55)); }
  var UNLOCK = { 2: 'Зона «Стеллажный зал», худи, грузчик', 3: 'Кроссовки, комплектовщик, контракты: Москва и Петербург', 4: 'Зона «Цех упаковки», кепки, упаковщик', 5: 'Курьер, Казань, рамка «Накладная»', 6: 'Зона «Экспедиция», сумки, закупщик', 7: 'Куртки, диспетчер, Екатеринбург', 8: 'Зона «Большой склад»', 9: 'Новосибирск', 10: 'Владивосток, рамка «Грузовой хаб»' };
  var EN_MAX = 40, EN_REGEN = 45;

  /* ================================================================ состояние */
  function fresh() {
    var slots = {}; SLOTS.forEach(function (s) { slots[s.id] = { lvl: s.free ? 1 : 0, item: null, qty: 0, order: null, got: [], parcel: null, prog: 0 }; });
    return { v: 1, coins: 300, xp: 0, lvl: 1, rating: 3, zones: ['A'], slots: slots, crates: [], truck: null, orders: [], oseq: 1, nextOrder: 5, contract: null,
      workers: {}, decor: {}, floor: 'conc', wall: 'grey', owned: { conc: 1, grey: 1 }, stats: { shipped: 0, perfect: 0, crates: 0, earned: 0, contracts: 0 }, ach: {}, cities: {},
      ms: { lvl: 1 }, px: 3.5, py: 4.5, tut: 0, lastAt: Date.now(), en: EN_MAX, enAt: Date.now() };
  }
  function load(str) {
    var st = fresh(); if (!str) return st;
    try { var o = JSON.parse(str); if (o && o.v === 1) { Object.keys(o).forEach(function (k) { st[k] = o[k]; }); SLOTS.forEach(function (s) { if (!st.slots[s.id]) st.slots[s.id] = { lvl: s.free ? 1 : 0, item: null, qty: 0, order: null, got: [], parcel: null, prog: 0 }; }); } } catch (e) { }
    return st;
  }

  /* ================================================================ запуск */
  function open(ctx) {
    var S = GK.shell({ title: 'Грузомания', cls: 'gz' });
    var st = load(ctx.data), E = GK.energy(st, enMax(), EN_REGEN), enUI = GK.energyChip(S, E);
    var I = GK.input(S, { pinch: true });
    var parts = GK.parts();
    var alive = true;
    function enMax() { var m = EN_MAX + (st.lvl - 1) * 2; Object.keys(st.decor || {}).forEach(function (k) { var d = DECOR.filter(function (x) { return x.id === st.decor[k]; })[0]; if (d && d.en) m += d.en; }); return m; }
    // фишки в шапке: монеты, рейтинг, уровень
    var coinChip = document.createElement('div'); coinChip.className = 'gk-chip'; coinChip.innerHTML = '<i class="gz-coin"></i><span>0</span>'; S.left.appendChild(coinChip);
    var lvlChip = document.createElement('button'); lvlChip.className = 'gk-chip gz-lvl'; lvlChip.setAttribute('data-gz', 'progress'); lvlChip.innerHTML = '<b>1</b><span class="bar"><i></i></span><span class="st">★ 3,0</span>'; S.left.appendChild(lvlChip);
    var css = document.createElement('style'); css.textContent = GZ_CSS; S.root.appendChild(css);
    S.hud.innerHTML = '<div class="gz-carry" hidden></div><div class="gz-orders"></div><div class="gz-dock"><button class="gz-d" data-gz="orders"><b>Заказы</b><em hidden></em></button><button class="gz-d" data-gz="buy"><b>Закупка</b></button><button class="gz-d" data-gz="build"><b>Склад</b></button><button class="gz-d" data-gz="team"><b>Команда</b></button><button class="gz-d" data-gz="ach"><b>Награды</b><em hidden></em></button></div><button class="gz-act" hidden></button><div class="gz-zoom"><button class="gk-b" data-gz="zin" aria-label="Приблизить">+</button><button class="gk-b" data-gz="zout" aria-label="Отдалить">−</button></div>';
    var $ = S.$;

    /* ---------------- геометрия и проходимость */
    var cam = { x: 0, y: 0, z: 1, tz: 1 };
    function iso(x, y, z) { return [(x - y) * TW / 2, (x + y) * TH / 2 - (z || 0)]; }
    function toScr(x, y, z) { var p = iso(x, y, z); return [(p[0] - cam.x) * cam.z + S.w / 2, (p[1] - cam.y) * cam.z + S.h / 2]; }
    function toWorld(sx, sy) { var X = (sx - S.w / 2) / cam.z + cam.x, Y = (sy - S.h / 2) / cam.z + cam.y; return [(X / (TW / 2) + Y / (TH / 2)) / 2, (Y / (TH / 2) - X / (TW / 2)) / 2]; }
    function zoneOf(i, j) { for (var k in ZONES) { var r = ZONES[k].r; if (i >= r[0] && i < r[0] + r[2] && j >= r[1] && j < r[1] + r[3]) return k; } return null; }
    function owned(z) { return st.zones.indexOf(z) >= 0; }
    var grid = [];
    function rebuild() {
      grid = []; for (var j = 0; j < GH; j++) { grid.push([]); for (var i = 0; i < GW; i++) grid[j].push(owned(zoneOf(i, j)) ? 0 : 1); }
      SLOTS.forEach(function (s) { if (!owned(s.z)) return; var on = st.slots[s.id].lvl > 0 || s.t !== 'decor' || st.decor[s.id]; if (s.t === 'decor' && !st.decor[s.id]) return; if (s.t === 'shelf' && !st.slots[s.id].lvl) return; if (s.t === 'table' && !st.slots[s.id].lvl) return; if (s.t === 'dockOut' && !st.slots[s.id].lvl) return; for (var a = 0; a < s.w; a++) for (var b = 0; b < s.d; b++) grid[s.j + b][s.i + a] = 2; });
    }
    function walk(i, j) { return i >= 0 && j >= 0 && i < GW && j < GH && grid[j][i] === 0; }
    function access(s) { // клетка, с которой работают с объектом
      var c = [], k;
      for (k = 0; k < s.w; k++) c.push([s.i + k, s.j + s.d]); for (k = 0; k < s.d; k++) c.push([s.i + s.w, s.j + k]);
      for (k = 0; k < s.d; k++) c.push([s.i - 1, s.j + k]); for (k = 0; k < s.w; k++) c.push([s.i + k, s.j - 1]);
      for (k = 0; k < c.length; k++) if (walk(c[k][0], c[k][1])) return [c[k][0] + .5, c[k][1] + .5];
      return [s.i + s.w / 2, s.j + s.d + .5];
    }
    function path(sx, sy, tx, ty) { // A* по клеткам
      var si = Math.floor(sx), sj = Math.floor(sy), ti = Math.floor(tx), tj = Math.floor(ty);
      if (!walk(ti, tj)) return null; if (si === ti && sj === tj) return [[tx, ty]];
      var open = [[si, sj]], g = {}, f = {}, from = {}, key = function (i, j) { return i + ',' + j; };
      g[key(si, sj)] = 0; f[key(si, sj)] = Math.abs(ti - si) + Math.abs(tj - sj);
      var it = 0;
      while (open.length && it++ < 600) {
        var bi = 0; for (var q = 1; q < open.length; q++) if (f[key(open[q][0], open[q][1])] < f[key(open[bi][0], open[bi][1])]) bi = q;
        var cur = open.splice(bi, 1)[0], ck = key(cur[0], cur[1]);
        if (cur[0] === ti && cur[1] === tj) { var out = [[tx, ty]], kk = ck; while (from[kk]) { kk = from[kk]; var pp = kk.split(','); out.unshift([+pp[0] + .5, +pp[1] + .5]); } out.shift(); out.push([tx, ty]); return out; }
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
          var ni = cur[0] + d[0], nj = cur[1] + d[1]; if (!walk(ni, nj)) return;
          if (d[0] && d[1] && (!walk(cur[0] + d[0], cur[1]) || !walk(cur[0], cur[1] + d[1]))) return;
          var nk = key(ni, nj), ng = g[ck] + (d[0] && d[1] ? 1.414 : 1);
          if (g[nk] == null || ng < g[nk]) { g[nk] = ng; f[nk] = ng + Math.hypot(ti - ni, tj - nj); from[nk] = ck; if (!open.some(function (o) { return o[0] === ni && o[1] === nj; })) open.push([ni, nj]); }
        });
      }
      return null;
    }

    /* ---------------- персонажи */
    var me = { x: st.px, y: st.py, path: null, face: 1, walkT: 0, carry: null, goal: null, speed: 3.4, col: '#1a86c0', cap: '#ff5a6e', hero: true };
    var npcs = [];
    function spawnWorkers() {
      npcs = [];
      WORKERS.forEach(function (w, k) { if (st.workers[w.id]) { var a = access(SL.hr); npcs.push({ id: w.id, x: a[0] + (k % 3) * .3, y: a[1] + .2, path: null, face: 1, walkT: 0, carry: null, task: null, wait: 0, speed: 2.4 + st.workers[w.id] * .25, col: w.c, cap: '#ffffff' }); } });
    }
    function moveTo(ent, tx, ty) { var p = path(ent.x, ent.y, tx, ty); ent.path = p; return !!p; }
    function stepEnt(ent, dt) {
      if (!ent.path || !ent.path.length) { ent.moving = false; return true; }
      var t = ent.path[0], dx = t[0] - ent.x, dy = t[1] - ent.y, l = Math.hypot(dx, dy), sp = ent.speed * dt;
      if (l <= sp) { ent.x = t[0]; ent.y = t[1]; ent.path.shift(); } else { ent.x += dx / l * sp; ent.y += dy / l * sp; }
      ent.face = (dx - dy) >= 0 ? 1 : -1; ent.moving = true; ent.walkT += dt;
      if (!ent.path.length) { ent.moving = false; return true; }
      return false;
    }

    /* ---------------- заказы */
    function itemsOpen() { return Object.keys(ITEMS).filter(function (k) { return ITEMS[k].lvl <= st.lvl; }); }
    function newOrder(city) {
      var av = itemsOpen(), n = city ? city.size[0] + Math.floor(Math.random() * (city.size[1] - city.size[0] + 1)) : 1 + Math.floor(Math.random() * Math.min(3, 1 + st.lvl / 2)), items = [];
      for (var i = 0; i < n; i++) { var w = av.map(function (k, ix) { return ix === av.length - 1 ? 2 : 3; }), r = Math.random() * w.reduce(function (a, b) { return a + b; }, 0), t = 0, pick = av[0]; for (var q = 0; q < av.length; q++) { t += w[q]; if (r < t) { pick = av[q]; break; } } items.push(pick); }
      items.sort();
      var val = items.reduce(function (a, k) { return a + ITEMS[k].val; }, 0);
      var o = { id: st.oseq++, items: items, pay: Math.round(val * (city ? city.k : 1) * (0.92 + st.rating * .04)), xp: Math.round(8 + items.length * 5 * (city ? 2 : 1)), left: city ? 900 + items.length * 90 : 210 + items.length * 70, total: 0, city: city ? city.id : null, name: city ? city.n : CLIENTS[Math.floor(Math.random() * CLIENTS.length)] };
      o.total = o.left; return o;
    }
    var CLIENTS = ['Аня', 'Максим', 'Лиза', 'Дима', 'Соня', 'Артём', 'Вера', 'Егор', 'Катя', 'Илья', 'Мила', 'Паша', 'Ника', 'Рома'];
    function orderById(id) { for (var i = 0; i < st.orders.length; i++) if (st.orders[i].id === id) return st.orders[i]; return null; }
    function tableOf(oid) { for (var k in st.slots) if (st.slots[k].order === oid) return k; return null; }
    function needLeft(sid) { // какие вещи ещё нужно принести на стол
      var s = st.slots[sid], o = orderById(s.order); if (!o) return [];
      var got = s.got.slice(), need = [];
      o.items.forEach(function (k) { var ix = got.indexOf(k); if (ix >= 0) got.splice(ix, 1); else need.push(k); });
      return need;
    }

    /* ---------------- экономика */
    function addCoins(n, x, y) { st.coins += n; if (n > 0) st.stats.earned += n; if (x != null) { var p = toScr(x, y, 40); S.float(p[0], p[1], (n > 0 ? '+' : '') + fmt(n), n > 0 ? '#ffd34d' : '#ff8a80', 20); } dirty(); }
    function addXp(n) {
      st.xp += n;
      while (st.lvl < LVL_MAX && st.xp >= xpNeed(st.lvl)) { st.xp -= xpNeed(st.lvl); st.lvl++; st.ms.lvl = st.lvl; E.max = enMax(); st.en = Math.min(E.max + 50, st.en + 10); levelUp(); }
      dirty();
    }
    function levelUp() {
      GK.sfx.win(); parts.burst(me.x, me.y, 1, {});
      var p = toScr(me.x, me.y, 60); confetti(p[0], p[1]);
      S.sheet('Склад ' + st.lvl + ' уровня!', '<div class="gz-lvlup"><b>' + st.lvl + '</b></div><p class="gk-lead">' + (UNLOCK[st.lvl] ? 'Открылось: ' + esc(UNLOCK[st.lvl]) + '.' : 'Заказы стали крупнее и дороже.') + ' Энергия +10.</p><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Отлично</button></div>', { w: 380 });
      dirty(true);
    }
    function confetti(x, y) { for (var i = 0; i < 40; i++) { var a = Math.random() * PI * 2, s = 140 + Math.random() * 260; scrParts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, t: 0, life: 1.4 + Math.random(), c: ['#ff5a6e', '#ffd34d', '#43c9e3', '#8a6cff', '#2fc78a'][i % 5], r: 3 + Math.random() * 3 }); } }
    var scrParts = [];
    function stockOf(k) { var n = 0; Object.keys(st.slots).forEach(function (id) { var s = st.slots[id]; if (SL[id].t === 'shelf' && s.item === k) n += s.qty; }); return n; }
    function rateAdd(d) { st.rating = clamp(st.rating + d, 0, 5); }

    /* ---------------- действия игрока */
    function carryUI() {
      var el = $('.gz-carry'), c = me.carry;
      if (!c) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = c.kind === 'crate' ? '<i style="--c:' + ITEMS[c.item].c + '" class="cr"></i><span>Коробка: ' + esc(ITEMS[c.item].n.toLowerCase()) + ', ' + c.n + ' шт.</span>' :
        c.kind === 'items' ? c.items.map(function (k) { return '<i style="--c:' + ITEMS[k].c + '"></i>'; }).join('') + '<span>' + c.items.length + ' из ' + handsCap() + ' в руках</span>' :
        '<i class="pc"></i><span>Посылка для ' + esc(c.name) + '</span>';
    }
    function handsCap() { return 3 + Math.floor(st.lvl / 4); }
    function spend(n, what) { if (!E.spend(n)) { GK.noEnergy(S, E, st, what); return false; } dirty(); return true; }
    function interact(sid) {
      var s = SL[sid], ss = st.slots[sid], t = s.t;
      if (t === 'pc') return panelBuy();
      if (t === 'board') return panelOrders();
      if (t === 'hire') return panelTeam();
      if (t === 'decor') return panelDecor(sid);
      if (t === 'dockIn') {
        if (!ss.lvl) return;
        if (me.carry) { S.toast('Руки заняты. Сначала отнесите то, что несёте', 'warn'); return; }
        if (!st.crates.length) { S.toast(st.truck ? 'Грузовик уже в пути' : 'Коробок нет. Закупите товар у компьютера', 'warn'); return; }
        if (!spend(1, 'взять коробку')) return;
        var cr = st.crates.shift(); me.carry = { kind: 'crate', item: cr.item, n: cr.n }; GK.sfx.pick(); carryUI(); dirty(); return;
      }
      if (t === 'shelf') {
        if (!ss.lvl) return panelSlot(sid);
        var c = me.carry;
        if (c && c.kind === 'crate') {
          if (ss.item && ss.item !== c.item) { S.toast('Этот стеллаж занят: ' + ITEMS[ss.item].n.toLowerCase() + '. Найдите пустой или с тем же товаром', 'warn'); return; }
          var room = shelfCap(ss.lvl) - ss.qty; if (room <= 0) { S.toast('Стеллаж полон. Улучшите его в меню «Склад»', 'warn'); return; }
          var put = Math.min(room, c.n); ss.item = c.item; ss.qty += put; c.n -= put; st.stats.crates += put === CRATE ? 1 : 0; GK.sfx.drop(); burstAt(s.i + s.w / 2, s.j + .5, ITEMS[ss.item].c);
          if (c.n <= 0) { me.carry = null; st.stats.crates += 0; } carryUI(); addXp(1); dirty(); checkAch(); return;
        }
        // берём товар для заказов на столах
        var need = []; Object.keys(st.slots).forEach(function (id) { if (SL[id].t === 'table' && st.slots[id].order) need = need.concat(needLeft(id)); });
        if (c && c.kind === 'items') c.items.forEach(function (k) { var ix = need.indexOf(k); if (ix >= 0) need.splice(ix, 1); });
        if (c && c.kind !== 'items') { S.toast('Руки заняты', 'warn'); return; }
        if (!ss.item || !ss.qty) { if (!c) return panelSlot(sid); S.toast('Стеллаж пустой. Привезите сюда коробку с приёмки', 'warn'); return; }
        var want = need.filter(function (k) { return k === ss.item; }).length;
        if (!want) { if (!c) return panelSlot(sid); S.toast('Этот товар сейчас не нужен на столах', 'warn'); return; }
        var have = c ? c.items.length : 0, take = Math.min(want, ss.qty, handsCap() - have);
        if (take <= 0) { S.toast('Больше в руки не помещается', 'warn'); return; }
        if (!spend(take, 'взять товар')) return;
        me.carry = me.carry || { kind: 'items', items: [] };
        for (var q = 0; q < take; q++) me.carry.items.push(ss.item);
        ss.qty -= take; if (!ss.qty) ss.item = null; GK.sfx.pick(); carryUI(); dirty(); return;
      }
      if (t === 'table') {
        if (!ss.lvl) return panelSlot(sid);
        if (ss.parcel) {
          if (me.carry) { S.toast('Руки заняты', 'warn'); return; }
          me.carry = { kind: 'parcel', oid: ss.parcel.oid, q: ss.parcel.q, name: ss.parcel.name, city: ss.parcel.city, tk: ss.parcel.tk }; ss.parcel = null; ss.order = null; ss.got = []; GK.sfx.pick(); carryUI(); dirty(); return;
        }
        if (!ss.order) return panelPickOrder(sid);
        if (me.carry && me.carry.kind === 'items') {
          var nl = needLeft(sid), moved = 0;
          me.carry.items = me.carry.items.filter(function (k) { var ix = nl.indexOf(k); if (ix >= 0) { nl.splice(ix, 1); ss.got.push(k); moved++; return false; } return true; });
          if (!me.carry.items.length) me.carry = null;
          if (moved) { GK.sfx.drop(); burstAt(s.i + 1, s.j + .5, '#ffffff'); } else S.toast('Эти вещи не нужны для заказа на этом столе', 'warn');
          carryUI(); dirty();
        }
        if (!needLeft(sid).length) { if (!spend(2, 'упаковать посылку')) return; packGame(sid); }
        else if (!me.carry) S.toast('Для заказа не хватает: ' + needLeft(sid).map(function (k) { return ITEMS[k].one.toLowerCase(); }).join(', '), 'warn');
        return;
      }
      if (t === 'dockOut') {
        if (!ss.lvl) return panelSlot(sid);
        if (!me.carry || me.carry.kind !== 'parcel') { S.toast('Сюда приносят готовые посылки', 'warn'); return; }
        var cp = me.carry; me.carry = null; carryUI(); ship(cp, sid);
      }
    }
    function burstAt(x, y, c) { var p = iso(x, y, 30); for (var i = 0; i < 10; i++) { var a = Math.random() * PI * 2, sp = 40 + Math.random() * 80; parts.add({ x: p[0], y: p[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 200, life: .6, t: 0, r: 3, c: c }); } }
    function ship(cp, sid) {
      var o = orderById(cp.oid), s = SL[sid], ss = st.slots[sid];
      var vanK = outK(ss.lvl), late = !o, pay = o ? Math.round(o.pay * vanK * (cp.q === 3 ? 1.15 : cp.q === 2 ? 1 : .85) * (tableK(cp.tk || 1))) : 0;
      if (o) {
        st.orders = st.orders.filter(function (x) { return x.id !== o.id; });
        addCoins(pay, s.i + 1, s.j); addXp(o.xp); st.stats.shipped++; if (cp.q === 3) st.stats.perfect++;
        rateAdd(cp.q === 3 ? .06 : cp.q === 2 ? .03 : -.02);
        if (o.city) { st.stats.contracts++; st.cities[o.city] = 1; st.contract = null; S.toast('Контракт с городом ' + o.name + ' выполнен!', 'gold'); GK.sfx.win(); }
      } else S.toast('Заказ уже отменён, посылку вернули на склад', 'warn');
      GK.sfx.coin(); vans[sid] = { t: 0 }; GK.sfx.truck();
      checkAch(); dirty(true);
    }
    var vans = {};

    /* ---------------- мини-игра упаковки */
    function packGame(sid) {
      var ss = st.slots[sid], o = orderById(ss.order); if (!o) return;
      var t0 = performance.now(), step = 0, inBox = 0, items = o.items.slice();
      var card = S.sheet('Упаковка заказа №' + o.id, '<p class="gk-lead" id="pk-h">Нажимайте на вещи, чтобы сложить их в коробку</p><div class="pk"><div class="pk-items">' + items.map(function (k, i) { return '<button class="pk-it" data-i="' + i + '" style="--c:' + ITEMS[k].c + '"><span class="ic">' + itemSvg(k) + '</span><span>' + esc(ITEMS[k].one) + '</span></button>'; }).join('') + '</div>' +
        '<div class="pk-box" id="pk-box"><div class="pk-fl l"></div><div class="pk-fl r"></div><div class="pk-in" id="pk-in"></div><div class="pk-tape" id="pk-tape"></div><div class="pk-lab" id="pk-lab"></div></div></div>' +
        '<div class="gk-row"><button class="gk-btn" id="pk-tp" disabled>Заклеить скотчем</button><button class="gk-btn" id="pk-lb" disabled>Наклеить этикетку</button></div><div class="gk-note" id="pk-t">Быстро и аккуратно = 3 звезды и прибавка к оплате</div>', { noClose: false, w: 440, onclose: function () { if (step < 3) { st.en = Math.min(E.max + 50, st.en + 2); S.toast('Упаковка отменена, энергия возвращена'); dirty(); } } });
      var box = card.querySelector('#pk-in'), tp = card.querySelector('#pk-tp'), lb = card.querySelector('#pk-lb');
      card.querySelectorAll('.pk-it').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.disabled) return; b.disabled = true; b.classList.add('in'); inBox++; GK.sfx.drop();
          var it = document.createElement('i'); it.style.setProperty('--c', ITEMS[items[+b.dataset.i]].c); it.style.setProperty('--r', (Math.random() * 30 - 15) + 'deg'); box.appendChild(it);
          if (inBox === items.length) { step = 1; tp.disabled = false; card.querySelector('#pk-h').textContent = 'Всё в коробке. Заклейте её'; card.querySelector('#pk-box').classList.add('full'); }
        });
      });
      tp.addEventListener('click', function () { if (step !== 1) return; step = 2; tp.disabled = true; lb.disabled = false; GK.sfx.tape(); card.querySelector('#pk-box').classList.add('closed'); card.querySelector('#pk-h').textContent = 'Теперь этикетка с адресом'; });
      lb.addEventListener('click', function () {
        if (step !== 2) return; step = 3; lb.disabled = true; GK.sfx.stamp(); card.querySelector('#pk-box').classList.add('lab');
        var sec = (performance.now() - t0) / 1000, q = sec < 5 + items.length * 1.1 ? 3 : sec < 9 + items.length * 1.6 ? 2 : 1;
        card.querySelector('#pk-h').innerHTML = 'Готово за ' + sec.toFixed(1).replace('.', ',') + ' с: ' + '<span class="pk-st">' + '★★★'.slice(0, q) + '<s>' + '★★★'.slice(q) + '</s></span>';
        ss.parcel = { oid: o.id, q: q, name: o.name, city: o.city, tk: ss.lvl };
        GK.sfx.up(); addXp(2); dirty();
        setTimeout(function () { S.closeAll(); var a = SL[sid]; burstAt(a.i + 1, a.j + .5, '#ffd34d'); S.toast('Посылка готова. Отнесите её к воротам отгрузки'); }, 900);
      });
    }
    function itemSvg(k) {
      var c = ITEMS[k].c, d = GK.shade(c, .7);
      var P = { tee: 'M5 7l4-3h6l4 3-2 3-2-1v11H9V9L7 10z', hood: 'M5 8l4-4h6l4 4-2 4-2-1v9H9v-9l-2 1zM9 4c0 3 6 3 6 0', snk: 'M3 16v-4l6-1 3-4 3 3 6 2v4z', cap: 'M4 15c0-6 4-9 8-9s8 3 8 9zM12 15h9', bag: 'M5 9h14l-1 11H6zM9 9V7a3 3 0 0 1 6 0v2', jkt: 'M6 5l3-1 3 2 3-2 3 1 2 5-2 1v9H8v-9l-2-1zM12 6v14' };
      return '<svg viewBox="0 0 24 24" style="fill:' + c + ';stroke:' + d + ';stroke-width:1.2"><path d="' + P[k] + '"/></svg>';
    }

    /* ---------------- панели */
    function costHtml(n) { return '<span class="gk-cost"><span class="' + (st.coins >= n ? '' : 'no') + '"><i class="gz-coin"></i>' + fmt(n) + '</span></span>'; }
    function panelBuy() {
      var tr = st.truck, inL = st.slots['in'].lvl, cap = truckCap(inL);
      var h = '<p class="gk-lead">Заказ у поставщика. Коробка = ' + CRATE + ' шт. Грузовик привезёт за ' + truckTime(inL) + ' с, за рейс до ' + cap + ' коробок.</p>' + (tr ? '<div class="gz-info">Грузовик в пути: ' + tr.items.length + ' ' + GK.plural(tr.items.length, 'коробка', 'коробки', 'коробок') + '</div>' : '') +
        '<div class="gk-list">' + Object.keys(ITEMS).map(function (k) {
          var it = ITEMS[k], lk = it.lvl > st.lvl, cost = it.buy * CRATE, need = st.orders.reduce(function (a, o) { return a + o.items.filter(function (x) { return x === k; }).length; }, 0);
          return '<div class="gk-it' + (lk ? ' lk' : '') + '"><span class="ic">' + itemSvg(k) + '</span><span class="t"><b>' + esc(it.n) + '</b><small>' + (lk ? 'Откроется на ' + it.lvl + ' уровне' : 'На складе ' + stockOf(k) + ' шт.' + (need ? ', в заказах нужно ' + need : '') + '. Клиенты платят ' + it.val + ' за штуку') + '</small></span>' + (lk ? '' : '<button class="gk-btn sm" data-buy="' + k + '"' + (st.coins < cost || (tr && tr.items.length >= cap) || (!tr && st.crates.length >= 8) ? ' disabled' : '') + '><i class="gz-coin"></i>' + fmt(cost) + '</button>') + '</div>';
        }).join('') + '</div><div class="gk-note">На приёмке может лежать до 8 коробок.</div>';
      var c = S.sheet('Закупка', h, { w: 460 });
      c.querySelectorAll('[data-buy]').forEach(function (b) { b.addEventListener('click', function () { buy(b.dataset.buy); panelBuy(); }); });
    }
    function buy(k, auto) {
      var it = ITEMS[k], cost = it.buy * CRATE, inL = st.slots['in'].lvl;
      if (st.coins < cost) return false;
      if (st.truck && st.truck.items.length >= truckCap(inL)) return false;
      if (st.crates.length + (st.truck ? st.truck.items.length : 0) >= 8) { if (!auto) S.toast('На приёмке нет места. Разгрузите коробки', 'warn'); return false; }
      addCoins(-cost);
      if (!st.truck) { st.truck = { t: truckTime(inL), items: [] }; truckAnim = { phase: 'in', t: 0 }; GK.sfx.truck(); }
      st.truck.items.push(k); if (!auto) GK.sfx.coin(); dirty(); return true;
    }
    var truckAnim = null;
    function orderRow(o, withBtn) {
      var tb = tableOf(o.id), urgent = o.left < 60;
      return '<div class="gk-it gz-ord' + (o.city ? ' city' : '') + '"><span class="t"><b>' + (o.city ? 'Контракт: ' : '') + esc(o.name) + ' <small class="gz-pay"><i class="gz-coin"></i>' + fmt(o.pay) + '</small></b><span class="gz-its">' + o.items.map(function (k) { return '<i style="--c:' + ITEMS[k].c + '" title="' + esc(ITEMS[k].one) + '"></i>'; }).join('') + '</span>' +
        '<small class="' + (urgent ? 'hot' : '') + '">' + (tb ? 'На столе. ' : '') + 'Осталось ' + GK.dur(o.left) + '</small><div class="gk-bar"><i style="width:' + (o.left / o.total * 100) + '%"></i></div></span>' + (withBtn && !tb ? '<button class="gk-btn sm" data-take="' + o.id + '">На стол</button>' : '') + '</div>';
    }
    function panelOrders() {
      var h = '<div class="gk-tabs"><button aria-selected="true" data-tab="o">Заказы клиентов</button><button aria-selected="false" data-tab="c">Контракты с городами</button></div><div id="gz-tab"></div>';
      var c = S.sheet('Заказы', h, { w: 480 }), tab = c.querySelector('#gz-tab');
      function show(k) {
        c.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === k)); });
        if (k === 'o') {
          var list = st.orders.filter(function (o) { return !o.city; });
          tab.innerHTML = (list.length ? '<div class="gk-list">' + list.map(function (o) { return orderRow(o, true); }).join('') + '</div>' : '<p class="gk-lead">Новых заказов пока нет. Они приходят каждые полминуты.</p>') + '<div class="gk-note">Выберите стол упаковки для заказа. Если не успеть, заказ отменится и рейтинг упадёт.</div>';
          tab.querySelectorAll('[data-take]').forEach(function (b) { b.addEventListener('click', function () { var free = freeTable(); if (!free) { S.toast('Все столы заняты', 'warn'); return; } st.slots[free].order = +b.dataset.take; st.slots[free].got = []; GK.sfx.click(); dirty(); S.closeAll(); S.toast('Заказ на столе. Принесите товар со стеллажей'); }); });
        } else {
          if (st.lvl < 3) { tab.innerHTML = '<p class="gk-lead">Контракты с городами откроются на 3 уровне склада.</p>'; return; }
          var cur = st.contract && orderById(st.contract);
          tab.innerHTML = '<div class="gz-map">' + mapSvg() + '</div>' + (cur ? orderRow(cur, true) : '<p class="gk-note">Контракт = большой заказ с долгим сроком и двойной оплатой. Одновременно один контракт.</p>') +
            '<div class="gk-list">' + CITIES.map(function (ci) {
              var lk = ci.lvl > st.lvl;
              return '<div class="gk-it' + (lk ? ' lk' : '') + '"><span class="t"><b>' + esc(ci.n) + (st.cities[ci.id] ? ' ✓' : '') + '</b><small>' + (lk ? 'Откроется на ' + ci.lvl + ' уровне' : 'От ' + ci.size[0] + ' до ' + ci.size[1] + ' вещей, оплата ×' + String(ci.k).replace('.', ',')) + '</small></span>' + (lk ? '' : '<button class="gk-btn sm" data-city="' + ci.id + '"' + (cur ? ' disabled' : '') + '>Взять</button>') + '</div>';
            }).join('') + '</div>';
          tab.querySelectorAll('[data-city]').forEach(function (b) { b.addEventListener('click', function () { if (!spend(3, 'заключить контракт')) return; var ci = CITIES.filter(function (x) { return x.id === b.dataset.city; })[0], o = newOrder(ci); st.orders.push(o); st.contract = o.id; GK.sfx.up(); dirty(); show('c'); S.toast('Контракт заключён: ' + o.items.length + ' вещей для города ' + ci.n); }); });
          tab.querySelectorAll('[data-take]').forEach(function (b) { b.addEventListener('click', function () { var free = freeTable(); if (!free) { S.toast('Все столы заняты', 'warn'); return; } st.slots[free].order = +b.dataset.take; st.slots[free].got = []; dirty(); S.closeAll(); S.toast('Контракт на столе. Носите товар партиями'); }); });
        }
      }
      c.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
      show('o');
    }
    function mapSvg() {
      var s = '<svg viewBox="0 0 400 180" style="width:100%;height:auto;display:block"><path d="M10 80C40 40 90 30 130 40S210 20 260 30 340 40 390 70 380 150 330 160 240 150 190 160 90 170 40 150 0 120 10 80Z" fill="rgba(67,201,227,.16)" stroke="rgba(67,201,227,.5)"/>';
      CITIES.forEach(function (c) { var on = st.cities[c.id], lk = c.lvl > st.lvl; s += '<circle cx="' + c.x * 400 + '" cy="' + c.y * 180 + '" r="' + (on ? 7 : 5) + '" fill="' + (lk ? '#5a6b82' : on ? '#ffd34d' : '#43c9e3') + '" stroke="#fff" stroke-width="1.5"/><text x="' + c.x * 400 + '" y="' + (c.y * 180 - 11) + '" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" opacity="' + (lk ? .5 : 1) + '">' + esc(c.n.replace('Санкт-', 'С.-')) + '</text>'; });
      return s + '</svg>';
    }
    function freeTable() { for (var k in st.slots) if (SL[k].t === 'table' && owned(SL[k].z) && st.slots[k].lvl && !st.slots[k].order && !st.slots[k].parcel) return k; return null; }
    function panelPickOrder(sid) {
      var list = st.orders.filter(function (o) { return !tableOf(o.id); });
      if (!list.length) { S.toast(st.orders.length ? 'Все заказы уже на столах' : 'Заказов пока нет. Они скоро придут', 'warn'); return; }
      var c = S.sheet('Какой заказ упаковать?', '<div class="gk-list">' + list.map(function (o) { return orderRow(o, false).replace('</div>', '') + '<button class="gk-btn sm" data-pick="' + o.id + '">Выбрать</button></div>'; }).join('') + '</div>', { w: 460 });
      c.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { st.slots[sid].order = +b.dataset.pick; st.slots[sid].got = []; GK.sfx.click(); dirty(); S.closeAll(); S.toast('Принесите товар со стеллажей: ' + needLeft(sid).map(function (k) { return ITEMS[k].one.toLowerCase(); }).join(', ')); }); });
    }
    function panelSlot(sid) {
      var s = SL[sid], ss = st.slots[sid], U = UP[s.t]; if (!U) return;
      var lvl = ss.lvl, max = lvl >= U.max, cost = U.cost[lvl];
      var sell = s.t === 'shelf' && ss.item && ss.qty ? Math.round(ss.qty * ITEMS[ss.item].buy * .8) : 0;
      var c = S.sheet(U.n + (lvl ? ', уровень ' + lvl : ''), '<p class="gk-lead">' + (lvl ? U.info(lvl) + (s.t === 'shelf' ? (ss.item ? '. Сейчас: ' + esc(ITEMS[ss.item].n.toLowerCase()) + ', ' + ss.qty + ' шт.' : '. Пустой: сюда можно положить любой товар') : '') : 'Место свободно. Поставьте сюда ' + U.n.toLowerCase() + '.') + '</p>' + (sell ? '<div class="gk-it"><span class="t"><b>Освободить стеллаж</b><small>Вернуть остатки поставщику за 80% цены</small></span><button class="gk-btn sm g" id="gz-sell">+' + fmt(sell) + '</button></div>' : '') + (!max ? '<div class="gk-it"><span class="t"><b>' + (lvl ? 'Улучшить до ' + (lvl + 1) : 'Купить') + '</b><small>' + U.info(lvl + 1) + '</small></span><button class="gk-btn sm" id="gz-up"' + (st.coins < cost ? ' disabled' : '') + '><i class="gz-coin"></i>' + fmt(cost) + '</button></div>' : '<div class="gz-info">Максимальный уровень</div>'), { w: 400 });
      var sb = c.querySelector('#gz-sell'); if (sb) sb.addEventListener('click', function () { addCoins(sell, s.i + 1, s.j); ss.qty = 0; ss.item = null; GK.sfx.coin(); S.closeAll(); dirty(true); });
      var b = c.querySelector('#gz-up'); if (b) b.addEventListener('click', function () { if (st.coins < cost) return; addCoins(-cost); ss.lvl++; rebuild(); GK.sfx.build(); burstAt(s.i + s.w / 2, s.j + .5, '#43c9e3'); S.closeAll(); S.toast(lvl ? 'Улучшено' : 'Установлено'); dirty(true); checkAch(); });
    }
    function panelBuild() {
      var h = '<div class="gk-tabs"><button aria-selected="true" data-tab="z">Помещения</button><button aria-selected="false" data-tab="e">Оборудование</button><button aria-selected="false" data-tab="s">Стиль</button></div><div id="gz-tab"></div>';
      var c = S.sheet('Склад', h, { w: 480 }), tab = c.querySelector('#gz-tab');
      function show(k) {
        c.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === k)); });
        if (k === 'z') {
          tab.innerHTML = '<div class="gk-list">' + Object.keys(ZONES).map(function (z) { var Z = ZONES[z], o = owned(z), lk = Z.lvl > st.lvl; return '<div class="gk-it' + (lk ? ' lk' : o ? ' done' : '') + '"><span class="t"><b>' + esc(Z.n) + '</b><small>' + (o ? 'Открыто' : lk ? 'Откроется на ' + Z.lvl + ' уровне. ' + esc(Z.d || '') : esc(Z.d || '')) + '</small></span>' + (o || lk ? '' : '<button class="gk-btn sm" data-zone="' + z + '"' + (st.coins < Z.cost ? ' disabled' : '') + '><i class="gz-coin"></i>' + fmt(Z.cost) + '</button>') + '</div>'; }).join('') + '</div>';
          tab.querySelectorAll('[data-zone]').forEach(function (b) { b.addEventListener('click', function () { buyZone(b.dataset.zone); show('z'); }); });
        } else if (k === 'e') {
          var list = SLOTS.filter(function (s) { return UP[s.t] && owned(s.z); });
          tab.innerHTML = '<div class="gk-list">' + list.map(function (s) { var ss = st.slots[s.id], U = UP[s.t], mx = ss.lvl >= U.max, cost = U.cost[ss.lvl]; return '<div class="gk-it"><span class="t"><b>' + U.n + ' ' + (s.id.toUpperCase()) + '</b><small>' + (ss.lvl ? 'Уровень ' + ss.lvl + '. ' + U.info(ss.lvl) : 'Не установлен') + '</small></span>' + (mx ? '<span class="gz-max">Макс.</span>' : '<button class="gk-btn sm" data-up="' + s.id + '"' + (st.coins < cost ? ' disabled' : '') + '><i class="gz-coin"></i>' + fmt(cost) + '</button>') + '</div>'; }).join('') + '</div>';
          tab.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { var s = SL[b.dataset.up], ss = st.slots[s.id], cost = UP[s.t].cost[ss.lvl]; if (st.coins < cost) return; addCoins(-cost); ss.lvl++; rebuild(); GK.sfx.build(); dirty(true); show('e'); }); });
        } else {
          tab.innerHTML = '<div class="gz-sub">Пол</div><div class="gz-sw">' + FLOORS.map(function (f) { var on = st.floor === f.id, ow = st.owned[f.id]; return '<button data-floor="' + f.id + '" class="' + (on ? 'on' : '') + '"><i style="background:linear-gradient(135deg,' + f.a + ' 50%,' + f.b + ' 50%)"></i><b>' + esc(f.n) + '</b><small>' + (on ? 'Выбрано' : ow ? 'Куплено' : fmt(f.cost) + ' монет') + '</small></button>'; }).join('') + '</div>' +
            '<div class="gz-sub">Стены</div><div class="gz-sw">' + WALLS.map(function (f) { var on = st.wall === f.id, ow = st.owned[f.id]; return '<button data-wall="' + f.id + '" class="' + (on ? 'on' : '') + '"><i style="background:' + f.c + '"></i><b>' + esc(f.n) + '</b><small>' + (on ? 'Выбрано' : ow ? 'Куплено' : fmt(f.cost) + ' монет') + '</small></button>'; }).join('') + '</div><div class="gk-note">Декор (растения, кофемашина, диван) ставится на отмеченные места на складе: нажмите на пунктирный круг.</div>';
          tab.querySelectorAll('[data-floor],[data-wall]').forEach(function (b) {
            b.addEventListener('click', function () {
              var fl = b.dataset.floor, wl = b.dataset.wall, it = (fl ? FLOORS : WALLS).filter(function (x) { return x.id === (fl || wl); })[0];
              if (!st.owned[it.id]) { if (st.coins < it.cost) { S.toast('Не хватает монет', 'warn'); return; } addCoins(-it.cost); st.owned[it.id] = 1; }
              if (fl) st.floor = fl; else st.wall = wl; GK.sfx.build(); dirty(true); show('s');
            });
          });
        }
      }
      c.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
      show('z');
    }
    function buyZone(z) {
      var Z = ZONES[z]; if (owned(z) || Z.lvl > st.lvl || st.coins < Z.cost) return;
      addCoins(-Z.cost); st.zones.push(z); rebuild(); GK.sfx.win();
      var r = Z.r, p = toScr(r[0] + r[2] / 2, r[1] + r[3] / 2, 0); confetti(p[0], p[1]);
      S.toast('Открыто: ' + Z.n, 'gold'); dirty(true); checkAch();
    }
    function panelDecor(sid) {
      var s = SL[sid], cur = st.decor[sid];
      var list = DECOR.filter(function (d) { return !d.big || s.big; });
      var c = S.sheet('Декор', '<p class="gk-lead">Уют поднимает настроение команды: работники двигаются быстрее. Кофемашина ещё и добавляет энергию.</p><div class="gk-list">' + list.map(function (d) {
        var on = cur === d.id; return '<div class="gk-it' + (on ? ' done' : '') + '"><span class="ic">' + decorIcon(d.id) + '</span><span class="t"><b>' + esc(d.n) + '</b><small>Уют +' + d.cozy + (d.en ? ', энергия +' + d.en : '') + '</small></span>' + (on ? '<span class="gz-max">Стоит</span>' : '<button class="gk-btn sm" data-dec="' + d.id + '"' + (st.coins < d.cost ? ' disabled' : '') + '><i class="gz-coin"></i>' + fmt(d.cost) + '</button>') + '</div>';
      }).join('') + '</div>' + (cur ? '<button class="gk-btn g" id="dec-rm">Убрать</button>' : ''), { w: 440 });
      c.querySelectorAll('[data-dec]').forEach(function (b) { b.addEventListener('click', function () { var d = DECOR.filter(function (x) { return x.id === b.dataset.dec; })[0]; if (st.coins < d.cost) return; addCoins(-d.cost); st.decor[sid] = d.id; E.max = enMax(); rebuild(); GK.sfx.build(); burstAt(s.i + .5, s.j + .5, '#2fc78a'); S.closeAll(); dirty(true); checkAch(); }); });
      var rm = c.querySelector('#dec-rm'); if (rm) rm.addEventListener('click', function () { delete st.decor[sid]; E.max = enMax(); rebuild(); S.closeAll(); dirty(true); });
    }
    function cozy() { var n = 0; Object.keys(st.decor).forEach(function (k) { var d = DECOR.filter(function (x) { return x.id === st.decor[k]; })[0]; if (d) n += d.cozy; }); return n; }
    function panelTeam() {
      var c = S.sheet('Команда', '<p class="gk-lead">Сотрудники работают сами и не тратят вашу энергию. Когда команда собрана полностью, склад зарабатывает и пока вас нет (до 6 часов).</p><div class="gk-list">' + WORKERS.map(function (w) {
        var l = st.workers[w.id] || 0, lk = w.lvl > st.lvl, cost = l ? Math.round(w.cost * Math.pow(1.9, l)) : w.cost, max = l >= 5;
        return '<div class="gk-it' + (lk ? ' lk' : '') + '"><span class="ic">' + workerIcon(w.c) + '</span><span class="t"><b>' + esc(w.n) + (l ? ', уровень ' + l : '') + '</b><small>' + (lk ? 'Откроется на ' + w.lvl + ' уровне' : esc(w.d)) + '</small></span>' + (lk ? '' : max ? '<span class="gz-max">Макс.</span>' : '<button class="gk-btn sm" data-hire="' + w.id + '"' + (st.coins < cost ? ' disabled' : '') + '>' + (l ? 'Обучить ' : 'Нанять ') + '<i class="gz-coin"></i>' + fmt(cost) + '</button>') + '</div>';
      }).join('') + '</div><div class="gk-note">Уют склада: ' + cozy() + '. Каждая единица ускоряет команду на 2%.</div>', { w: 460 });
      c.querySelectorAll('[data-hire]').forEach(function (b) { b.addEventListener('click', function () { var w = WORKERS.filter(function (x) { return x.id === b.dataset.hire; })[0], l = st.workers[w.id] || 0, cost = l ? Math.round(w.cost * Math.pow(1.9, l)) : w.cost; if (st.coins < cost) return; addCoins(-cost); st.workers[w.id] = l + 1; spawnWorkers(); GK.sfx.up(); dirty(true); checkAch(); panelTeam(); }); });
    }
    function workerIcon(c) { return '<svg viewBox="0 0 24 24" style="width:30px;height:30px"><circle cx="12" cy="7" r="4" fill="#f3c9a5" stroke="none"/><path d="M5 22c0-6 3-9 7-9s7 3 7 9z" fill="' + c + '" stroke="none"/><path d="M8 5.5c1-3 7-3 8 0z" fill="' + c + '" stroke="none"/></svg>'; }
    function decorIcon(id) { var M = { plant: '🌿', lamp: '💡', cooler: '💧', poster: '🖼️', coffee: '☕', sofa: '🛋️', arcade: '🕹️', tree: '🌴' }; return '<span style="font-size:24px">' + (M[id] || '•') + '</span>'; }
    function achVal(a) { return a.k === 'lvl' ? st.lvl : a.k === 'cityN' ? Object.keys(st.cities).length : a.k === 'workerN' ? Object.keys(st.workers).length : a.k === 'zoneN' ? st.zones.length : a.k === 'decorN' ? Object.keys(st.decor).length : st.stats[a.k] || 0; }
    function checkAch() {
      ACH.forEach(function (a) { if (!st.ach[a.id] && achVal(a) >= a.need) { st.ach[a.id] = 1; st.achNew = (st.achNew || 0) + 1; S.toast('Награда «' + a.n + '»: заберите ' + a.coins + ' монет в разделе «Награды»', 'gold'); GK.sfx.win(); } });
      var em = $('[data-gz="ach"] em'), n = ACH.filter(function (a) { return st.ach[a.id] === 1; }).length; em.hidden = !n; em.textContent = n;
    }
    function panelAch() {
      var c = S.sheet('Награды', '<div class="gk-list">' + ACH.map(function (a) {
        var v = Math.min(a.need, achVal(a)), s = st.ach[a.id];
        return '<div class="gk-it' + (s === 2 ? ' done' : '') + '"><span class="t"><b>' + esc(a.n) + '</b><small>' + esc(a.d) + '</small><div class="gk-bar"><i style="width:' + (v / a.need * 100) + '%"></i></div></span>' + (s === 1 ? '<button class="gk-btn sm" data-ach="' + a.id + '">+' + fmt(a.coins) + '</button>' : s === 2 ? '<span class="gz-max">Получено</span>' : '<span class="gz-max">' + fmt(v) + '/' + fmt(a.need) + '</span>') + '</div>';
      }).join('') + '</div><div class="gk-note">За 5 и 10 уровень склада вы получите эксклюзивные рамки для аватара в профиле магазина.</div>', { w: 460 });
      c.querySelectorAll('[data-ach]').forEach(function (b) { b.addEventListener('click', function () { var a = ACH.filter(function (x) { return x.id === b.dataset.ach; })[0]; st.ach[a.id] = 2; addCoins(a.coins); GK.sfx.coin(); checkAch(); dirty(true); panelAch(); }); });
    }
    function panelProgress() {
      var need = xpNeed(st.lvl);
      S.sheet('Склад ' + st.lvl + ' уровня', '<div class="gk-it"><span class="t"><b>Опыт: ' + fmt(st.xp) + ' из ' + fmt(need) + '</b><div class="gk-bar"><i style="width:' + (st.xp / need * 100) + '%"></i></div><small>Опыт дают отправленные посылки и разгрузка</small></span></div>' +
        '<div class="gk-it"><span class="t"><b>Рейтинг ★ ' + st.rating.toFixed(1).replace('.', ',') + '</b><small>Растёт за аккуратную упаковку, падает за сорванные заказы. Чем выше, тем дороже платят клиенты</small></span></div>' +
        '<div class="gz-sub">Что откроется дальше</div><div class="gk-list">' + Object.keys(UNLOCK).filter(function (l) { return +l > st.lvl; }).slice(0, 4).map(function (l) { return '<div class="gk-it lk"><span class="t"><b>Уровень ' + l + '</b><small>' + esc(UNLOCK[l]) + '</small></span></div>'; }).join('') + '</div>' +
        '<div class="gk-note">Статистика: отправлено ' + fmt(st.stats.shipped) + ', заработано ' + fmt(st.stats.earned) + ' монет, контрактов ' + st.stats.contracts + '.</div>', { w: 420 });
    }
    function panelHelp() {
      S.sheet('Как играть', '<div class="gk-list">' +
        [['1', 'Закупка', 'У компьютера купите коробки с товаром. Грузовик привезёт их на приёмку (ворота слева).'], ['2', 'Стеллажи', 'Возьмите коробку и отнесите на стеллаж. Один стеллаж = один вид товара.'], ['3', 'Заказ', 'Нажмите на стол упаковки и выберите заказ. Принесите нужные вещи со стеллажей.'], ['4', 'Упаковка', 'Сложите вещи в коробку, заклейте и наклейте этикетку. Быстрее = больше звёзд и денег.'], ['5', 'Отгрузка', 'Отнесите посылку к воротам отгрузки. Курьер заберёт её и заплатит.'], ['6', 'Развитие', 'Открывайте новые помещения, улучшайте оборудование, нанимайте команду, берите контракты с городами.']]
          .map(function (r) { return '<div class="gk-it"><span class="ic" style="font-weight:800">' + r[0] + '</span><span class="t"><b>' + r[1] + '</b><small>' + r[2] + '</small></span></div>'; }).join('') +
        '</div><div class="gk-note">Управление: нажмите на объект или место на полу, персонаж дойдёт сам. Также стрелки или WASD, на телефоне джойстик слева. Колёсико или щипок меняют масштаб. Каждое действие руками тратит энергию, она восстанавливается со временем.</div><button class="gk-btn g" id="gz-tut">Пройти обучение заново</button>', { w: 460 })
        .querySelector('#gz-tut').addEventListener('click', function () { st.tut = 0; tutor.i = 0; tutor.shown = -1; S.closeAll(); });
    }

    /* ---------------- кнопки HUD */
    S.root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gz]'); if (!b) return; GK.sfx.click();
      var k = b.dataset.gz;
      if (k === 'orders') panelOrders(); else if (k === 'buy') panelBuy(); else if (k === 'build') panelBuild(); else if (k === 'team') panelTeam(); else if (k === 'ach') panelAch(); else if (k === 'progress') panelProgress();
      else if (k === 'zin') cam.tz = clamp(cam.tz * 1.2, .55, 1.8); else if (k === 'zout') cam.tz = clamp(cam.tz / 1.2, .55, 1.8);
    });
    var actBtn = $('.gz-act');
    actBtn.addEventListener('click', function () { if (near) interact(near.id); });
    S.onhelp = panelHelp;

    /* ---------------- касания по миру */
    var near = null;
    I.onTap = function (sx, sy) {
      if (S.paused) return;
      var w = toWorld(sx, sy), wi = Math.floor(w[0]), wj = Math.floor(w[1]);
      // по объекту (с учётом высоты: проверяем и клетку чуть ниже)
      var hit = null;
      for (var dz = 0; dz <= 1.6 && !hit; dz += .4) {
        var ww = toWorld(sx, sy + dz * TH * cam.z), ii = Math.floor(ww[0]), jj = Math.floor(ww[1]);
        hit = SLOTS.filter(function (s) { return owned(s.z) && ii >= s.i && ii < s.i + s.w && jj >= s.j && jj < s.j + s.d; })[0];
      }
      if (hit) { var a = access(hit); if (moveTo(me, a[0], a[1])) { me.goal = hit.id; GK.sfx.step(); } else interact(hit.id); return; }
      // закрытая зона: предложить купить
      var z = zoneOf(wi, wj); if (z && !owned(z)) { var Z = ZONES[z]; var c = S.sheet(Z.n, '<p class="gk-lead">' + esc(Z.d || '') + '</p>' + (Z.lvl > st.lvl ? '<div class="gz-info">Откроется на ' + Z.lvl + ' уровне склада</div>' : '<button class="gk-btn" id="gz-bz"' + (st.coins < Z.cost ? ' disabled' : '') + '>Купить площадь за ' + fmt(Z.cost) + '</button>'), { w: 380 }); var bz = c.querySelector('#gz-bz'); if (bz) bz.addEventListener('click', function () { buyZone(z); S.closeAll(); }); return; }
      if (walk(wi, wj)) { moveTo(me, w[0], w[1]); me.goal = null; tapMark = { x: w[0], y: w[1], t: 0 }; }
    };
    var tapMark = null;
    I.onDrag = function (dx, dy) { if (I.joy) return; cam.x -= dx / cam.z; cam.y -= dy / cam.z; camFree = 2.5; };
    I.onPinch = function (k) { cam.tz = clamp(cam.tz * k, .55, 1.8); };
    I.onKeyMove = function () { me.path = null; me.goal = null; };
    var camFree = 0;

    /* ---------------- работники: простые задачи */
    function npcThink(n, dt) {
      var lv = st.workers[n.id] || 1, mult = 1 + cozy() * .02;
      n.speed = (2.2 + lv * .3) * mult;
      if (n.packing) {
        n.packing.t -= dt;
        if (n.packing.t <= 0) { var tb0 = n.packing.tb, ss0 = st.slots[tb0], o0 = orderById(ss0.order); if (o0 && !ss0.parcel && !needLeft(tb0).length) { ss0.parcel = { oid: o0.id, q: lv >= 4 ? 3 : 2, name: o0.name, city: o0.city, tk: ss0.lvl }; GK.sfx.tape(); dirty(); } n.packing = null; }
        return;
      }
      if (n.wait > 0) { n.wait -= dt; return; }
      if (n.path && n.path.length) return;
      var T = n.task;
      if (T && T.at) { // пришли к цели
        T.at(); n.task = null; n.wait = .4; return;
      }
      n.task = null;
      var go = function (sid, at) { var a = access(SL[sid]); if (moveTo(n, a[0], a[1])) { n.task = { at: at, sid: sid }; return true; } return false; };
      if (n.id === 'loader') {
        if (n.carry) { var sh = shelfFor(n.carry.item); if (sh) go(sh, function () { var ss = st.slots[sh], room = shelfCap(ss.lvl) - ss.qty, put = Math.min(room, n.carry.n); if (put > 0 && (!ss.item || ss.item === n.carry.item)) { ss.item = n.carry.item; ss.qty += put; n.carry.n -= put; st.stats.crates++; dirty(); } if (n.carry.n <= 0) n.carry = null; }); else n.wait = 2; return; }
        if (st.crates.length && shelfFor(st.crates[0].item)) { go('in', function () { if (st.crates.length) { var cr = st.crates.shift(); n.carry = { kind: 'crate', item: cr.item, n: cr.n }; } }); return; }
      }
      if (n.id === 'picker') {
        if (n.carry) { var tb = n.carry.table; go(tb, function () { var ss = st.slots[tb]; if (ss.order) { var nl = needLeft(tb); n.carry.items.forEach(function (k) { var ix = nl.indexOf(k); if (ix >= 0) { nl.splice(ix, 1); ss.got.push(k); } }); dirty(); } n.carry = null; }); return; }
        for (var k in st.slots) {
          if (SL[k].t !== 'table' || !st.slots[k].order || st.slots[k].parcel) continue;
          var nl = needLeft(k); if (me.carry && me.carry.kind === 'items') me.carry.items.forEach(function (x) { var ix = nl.indexOf(x); if (ix >= 0) nl.splice(ix, 1); });
          npcs.forEach(function (o) { if (o !== n && o.carry && o.carry.table === k) o.carry.items.forEach(function (x) { var ix = nl.indexOf(x); if (ix >= 0) nl.splice(ix, 1); }); });
          if (!nl.length) continue;
          var need = nl[0], sh2 = shelfWith(need); if (!sh2) continue;
          (function (tb, item, shid) { go(shid, function () { var ss = st.slots[shid]; if (ss.item === item && ss.qty > 0) { var take = Math.min(ss.qty, nl.filter(function (x) { return x === item; }).length, 1 + lv); ss.qty -= take; if (!ss.qty) ss.item = null; n.carry = { kind: 'items', items: [], table: tb }; for (var q = 0; q < take; q++) n.carry.items.push(item); dirty(); } }); })(k, need, sh2);
          return;
        }
      }
      if (n.id === 'packer') {
        for (var k2 in st.slots) { var s2 = st.slots[k2]; if (SL[k2].t === 'table' && s2.order && !s2.parcel && !needLeft(k2).length && !npcs.some(function (o) { return o !== n && o.packing && o.packing.tb === k2; }) && !(me.goal === k2)) { (function (tb) { go(tb, function () { n.packing = { tb: tb, t: Math.max(2.5, 7 - lv) }; }); })(k2); return; } }
      }
      if (n.id === 'courier') {
        if (n.carry) { var outs = ['out', 'out2'].filter(function (x) { return owned(SL[x].z) && st.slots[x].lvl; }), od = outs[0]; go(od, function () { var cp = n.carry; n.carry = null; ship(cp, od); }); return; }
        for (var k3 in st.slots) { var s3 = st.slots[k3]; if (SL[k3].t === 'table' && s3.parcel && !npcs.some(function (o) { return o !== n && o.task && o.task.sid === k3; })) { (function (tb) { go(tb, function () { var ss = st.slots[tb]; if (ss.parcel) { n.carry = { kind: 'parcel', oid: ss.parcel.oid, q: ss.parcel.q, name: ss.parcel.name, city: ss.parcel.city, tk: ss.parcel.tk }; ss.parcel = null; ss.order = null; ss.got = []; dirty(); } }); })(k3); return; } }
      }
      // свободен: стоит у места отдыха
      n.wait = 1.5 + Math.random() * 2;
      if (Math.random() < .4) { var a = access(SL.hr); moveTo(n, a[0] + (Math.random() - .5), a[1] + Math.random() * .6); }
    }
    function shelfFor(item) { var best = null; SLOTS.forEach(function (s) { if (s.t !== 'shelf' || !owned(s.z)) return; var ss = st.slots[s.id]; if (!ss.lvl) return; if ((ss.item === item && ss.qty < shelfCap(ss.lvl)) && !best) best = s.id; }); if (best) return best; SLOTS.forEach(function (s) { if (s.t !== 'shelf' || !owned(s.z)) return; var ss = st.slots[s.id]; if (ss.lvl && !ss.item && !best) best = s.id; }); return best; }
    function shelfWith(item) { var b = null; SLOTS.forEach(function (s) { if (s.t === 'shelf' && owned(s.z) && st.slots[s.id].item === item && st.slots[s.id].qty > 0 && !b) b = s.id; }); return b; }
    var autoT = 0;
    function autoJobs(dt) {
      autoT -= dt; if (autoT > 0) return; autoT = 2;
      if (st.workers.disp) { var list = st.orders.filter(function (o) { return !tableOf(o.id); }); list.forEach(function (o) { var f = freeTable(); if (f && (o.items.every(function (k) { return stockOf(k) > 0; }))) { st.slots[f].order = o.id; st.slots[f].got = []; dirty(); } }); }
      if (st.workers.buyer && st.coins > 400) {
        var demand = {}; st.orders.forEach(function (o) { o.items.forEach(function (k) { demand[k] = (demand[k] || 0) + 1; }); });
        Object.keys(demand).forEach(function (k) { var inc = (st.truck ? st.truck.items.filter(function (x) { return x === k; }).length : 0) * CRATE + st.crates.filter(function (c) { return c.item === k; }).length * CRATE; if (stockOf(k) + inc < demand[k] + 2 && shelfFor(k)) buy(k, true); });
      }
    }

    /* ---------------- доход вне игры */
    function offline() {
      var away = Math.min(6 * 3600, (Date.now() - (st.lastAt || Date.now())) / 1000);
      if (away < 120) return;
      var full = ['loader', 'picker', 'packer', 'courier'].every(function (k) { return st.workers[k]; });
      var regen = Math.floor(away / EN_REGEN);
      // заказы на паузе вне игры, сроки не идут
      if (!full) { if (away > 600) S.toast('С возвращением! Соберите полную команду (грузчик, комплектовщик, упаковщик, курьер), и склад будет работать без вас'); return; }
      var tables = SLOTS.filter(function (s) { return s.t === 'table' && owned(s.z) && st.slots[s.id].lvl; }).length;
      var lv = (st.workers.packer + st.workers.courier + st.workers.picker) / 3, rate = tables * (.5 + lv * .25) * (1 + cozy() * .02); // посылок в час
      var n = Math.floor(away / 3600 * rate), avgVal = itemsOpen().reduce(function (a, k) { return a + ITEMS[k].val; }, 0) / itemsOpen().length;
      if (!st.workers.buyer) { var stock = 0; Object.keys(ITEMS).forEach(function (k) { stock += stockOf(k); }); n = Math.min(n, Math.floor(stock / 2)); }
      if (n <= 0) return;
      var coins = Math.round(n * avgVal * 1.6 * (st.workers.buyer ? .7 : 1)), xp = n * 10;
      st.stats.shipped += n; addCoins(coins); addXp(xp);
      if (!st.workers.buyer) { var left = n * 2; Object.keys(st.slots).forEach(function (id) { var s = st.slots[id]; if (SL[id].t === 'shelf' && s.qty && left > 0) { var t = Math.min(s.qty, left); s.qty -= t; left -= t; if (!s.qty) s.item = null; } }); }
      S.sheet('Пока вас не было', '<p class="gk-lead">Команда работала ' + GK.dur(away) + '.</p><div class="gk-list"><div class="gk-it"><span class="t"><b>Отправлено посылок: ' + n + '</b><small>Заработано ' + fmt(coins) + ' монет и ' + xp + ' опыта</small></span></div></div><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Забрать</button></div>', { w: 380 });
      GK.sfx.coin(); dirty(true);
    }

    /* ---------------- обучение */
    function objScr(id) { var s = SL[id]; return toScr(s.i + s.w / 2, s.j + s.d / 2, 40); }
    var tutor = GK.tutor(S, [
      { id: 'hi', t: 'Добро пожаловать на ваш склад! Пока он крошечный, но скоро вырастет.', ok: 'Начнём', top: true },
      { id: 'pc', t: 'Нажмите на компьютер, чтобы закупить товар.', at: function () { return objScr('pc'); }, done: function () { return S.sheetOpen() || st.truck || st.crates.length; } },
      { id: 'buy', t: 'Купите коробку футболок.', inSheet: true, fixed: true, done: function () { return st.truck || st.crates.length || stockOf('tee') > 0; } },
      { id: 'crate', t: 'Грузовик привёз коробку на приёмку. Подойдите и возьмите её.', at: function () { return objScr('in'); }, done: function () { return me.carry && me.carry.kind === 'crate' || stockOf('tee') > 0; } },
      { id: 'shelf', t: 'Отнесите коробку на стеллаж.', at: function () { return objScr('a1'); }, done: function () { return stockOf('tee') > 0 && (!me.carry || me.carry.kind !== 'crate'); } },
      { id: 'order', t: 'Пришёл заказ. Нажмите на стол упаковки и выберите его.', at: function () { return objScr('t1'); }, done: function () { return !!st.slots.t1.order || st.stats.shipped > 0; } },
      { id: 'pick', t: 'Возьмите со стеллажа вещи для заказа.', at: function () { return objScr('a1'); }, done: function () { return (me.carry && me.carry.kind === 'items') || (st.slots.t1.order && !needLeft('t1').length) || st.stats.shipped > 0; } },
      { id: 'pack', t: 'Отнесите их к столу и упакуйте.', at: function () { return objScr('t1'); }, done: function () { return !!st.slots.t1.parcel || (me.carry && me.carry.kind === 'parcel') || st.stats.shipped > 0; } },
      { id: 'grab', t: 'Возьмите готовую посылку со стола.', at: function () { return objScr('t1'); }, done: function () { return (me.carry && me.carry.kind === 'parcel') || st.stats.shipped > 0; } },
      { id: 'ship', t: 'Отнесите посылку к воротам отгрузки.', at: function () { return objScr('out'); }, done: function () { return st.stats.shipped > 0; } },
      { id: 'end', t: 'Первая посылка ушла! Дальше расширяйте склад, ставьте новые стеллажи и нанимайте команду.', ok: 'Отлично', sub: 'Кнопки внизу: заказы, закупка, склад, команда, награды', top: true }
    ], st, function () { dirty(true); });
    function ensureTutOrder() { if (tutor.active() && tutor.step() === 'order' && !st.orders.length) st.orders.push(Object.assign(newOrder(null), { items: ['tee'], pay: 30, name: 'Аня' })); }

    /* ---------------- сохранение */
    var saver = GK.saver(ctx, S, function () { st.px = me.x; st.py = me.y; st.lastAt = Date.now(); if (me.carry && me.carry.kind === 'crate') { st.crates.unshift({ item: me.carry.item, n: me.carry.n }); var r = JSON.parse(JSON.stringify(st)); st.crates.shift(); return r; } return st; }, ctx.onUser);
    function dirty(now) { saver.mark(); if (now) saver.flush(); }

    /* ================================================================ рисование */
    var cx = S.cx;
    function poly(pts, fill, stroke) { cx.beginPath(); pts.forEach(function (p, i) { if (i) cx.lineTo(p[0], p[1]); else cx.moveTo(p[0], p[1]); }); cx.closePath(); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = 1; cx.stroke(); } }
    function P(x, y, z) { var p = iso(x, y, z); return [p[0] - cam.x, p[1] - cam.y]; }
    function box(x, y, w, d, h, top, left, right, z0) {
      z0 = z0 || 0;
      var a = P(x, y + d, z0), b = P(x + w, y + d, z0), c = P(x + w, y, z0), A2 = P(x, y + d, z0 + h), B2 = P(x + w, y + d, z0 + h), C2 = P(x + w, y, z0 + h), D2 = P(x, y, z0 + h);
      poly([a, b, B2, A2], left); poly([b, c, C2, B2], right); poly([A2, B2, C2, D2], top);
    }
    function boxC(x, y, w, d, h, col, z0) { box(x, y, w, d, h, GK.shade(col, 1.12), GK.shade(col, .86), GK.shade(col, .7), z0); }
    function person(e, t) {
      var p = P(e.x, e.y, 0), bob = e.moving ? Math.abs(Math.sin(e.walkT * 12)) * 2 : 0, sw = e.moving ? Math.sin(e.walkT * 12) * 4 : 0;
      cx.save(); cx.translate(p[0], p[1]);
      GK.shadow(cx, 0, 0, 11, 5, .25);
      cx.scale(e.face, 1);
      cx.fillStyle = '#2b3550'; cx.fillRect(-5 + sw * .5, -12, 4, 12); cx.fillRect(1 - sw * .5, -12, 4, 12);
      cx.fillStyle = e.col; GK.rr(cx, -8, -27 - bob, 16, 17, 5); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.25)'; cx.fillRect(-8, -21 - bob, 16, 2.5);
      cx.fillStyle = '#f3c9a5'; cx.beginPath(); cx.arc(0, -33 - bob, 7, 0, PI * 2); cx.fill();
      cx.fillStyle = e.cap; cx.beginPath(); cx.arc(0, -35 - bob, 7.2, PI, 0); cx.fill(); cx.fillRect(0, -36 - bob, 10, 2.5);
      cx.fillStyle = '#1b2433'; cx.fillRect(2, -34 - bob, 2, 2);
      // что несёт
      var c = e.carry;
      if (c) {
        cx.scale(e.face, 1);
        if (c.kind === 'crate') { drawCrate(-10, -58 - bob, ITEMS[c.item].c, 20); }
        else if (c.kind === 'items') { c.items.forEach(function (k, i) { cx.fillStyle = ITEMS[k].c; GK.rr(cx, -12 + i * 8, -50 - bob - (i % 2) * 3, 9, 9, 2); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.stroke(); }); }
        else { drawParcel(-9, -52 - bob, 18); }
      }
      if (e.packing) { cx.fillStyle = '#fff'; cx.font = '700 10px Onest,sans-serif'; cx.textAlign = 'center'; cx.fillText('…', 0, -48); }
      cx.restore();
    }
    function drawCrate(x, y, col, s) { cx.fillStyle = '#c99358'; GK.rr(cx, x, y, s, s * .8, 2); cx.fill(); cx.fillStyle = '#e3b678'; cx.fillRect(x, y, s, s * .22); cx.fillStyle = col; cx.fillRect(x + s * .35, y + s * .35, s * .3, s * .3); cx.strokeStyle = 'rgba(80,50,20,.5)'; cx.lineWidth = 1; cx.strokeRect(x + .5, y + .5, s - 1, s * .8 - 1); }
    function drawParcel(x, y, s) { cx.fillStyle = '#d8a865'; GK.rr(cx, x, y, s, s * .78, 2); cx.fill(); cx.fillStyle = '#f2d79b'; cx.fillRect(x + s * .42, y, s * .16, s * .78); cx.fillStyle = '#fff'; cx.fillRect(x + 2, y + 3, s * .3, s * .22); }
    function drawSlot(s) {
      var ss = st.slots[s.id], x = s.i, y = s.j, w = s.w, d = s.d;
      if (s.t === 'shelf') {
        if (!ss.lvl) { placeholder(s, 'Стеллаж'); return; }
        var col = ['#7d8aa3', '#6f7f9c', '#5d79b3', '#3f6fc8', '#2b5dd0'][ss.lvl - 1] || '#5d79b3';
        boxC(x + .05, y + .1, w - .1, d - .2, 4, col);
        for (var lv = 0; lv < 3; lv++) {
          var zz = 4 + lv * 18; boxC(x + .05, y + .1, w - .1, d - .2, 3, '#d3dae6', zz);
          var cap = shelfCap(ss.lvl), per = cap / 3, n = clamp(ss.qty - lv * per, 0, per);
          if (ss.item) for (var q = 0; q < Math.ceil(n); q++) { var fx = x + .12 + (q / per) * (w - .3), c = ITEMS[ss.item].c; box(fx, y + .25, (w - .3) / per * .85, .5, 11, GK.shade(c, 1.15), GK.shade(c, .9), GK.shade(c, .7), zz + 3); }
        }
        var top = P(x + .05, y + .1, 58), tt = P(x + w - .05, y + .1, 58); cx.strokeStyle = GK.shade(col, .7); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(top[0], top[1]); cx.lineTo(P(x + .05, y + .1, 0)[0], P(x + .05, y + .1, 0)[1]); cx.moveTo(tt[0], tt[1]); cx.lineTo(P(x + w - .05, y + .1, 0)[0], P(x + w - .05, y + .1, 0)[1]); cx.stroke();
        if (ss.item) label(x + w / 2, y + d / 2, 70, ss.qty + '/' + shelfCap(ss.lvl), ITEMS[ss.item].c);
        return;
      }
      if (s.t === 'table') {
        if (!ss.lvl) { placeholder(s, 'Стол'); return; }
        boxC(x + .1, y + .15, w - .2, d - .3, 22, ['#b07c4c', '#a8733f', '#8f6236', '#6a4a2e'][ss.lvl - 1] || '#b07c4c');
        box(x + .1, y + .15, w - .2, d - .3, 2, '#e9eef6', '#c9d2e0', '#b5c0d2', 22);
        var tp = P(x + w / 2, y + d / 2, 24);
        if (ss.parcel) drawParcel(tp[0] - 11, tp[1] - 16, 22);
        else if (ss.order) {
          var o = orderById(ss.order); if (o) { cx.fillStyle = '#c99358'; GK.rr(cx, tp[0] - 12, tp[1] - 12, 24, 14, 2); cx.fill(); ss.got.forEach(function (k, i) { cx.fillStyle = ITEMS[k].c; cx.fillRect(tp[0] - 10 + i * 5 % 20, tp[1] - 16 - Math.floor(i / 4) * 4, 5, 5); }); label(x + w / 2, y + d / 2, 56, ss.got.length + '/' + o.items.length, o.city ? '#ffd34d' : '#43c9e3'); }
        } else label(x + w / 2, y + d / 2, 46, 'Стол', '#9aa6b8');
        return;
      }
      if (s.t === 'dockIn') {
        var wc = (WALLS.filter(function (w2) { return w2.id === st.wall; })[0] || WALLS[0]).c;
        box(x - .15, y, .15, d, 66, GK.shade(wc, 1.1), GK.shade(wc, .85), GK.shade(wc, .7));
        var a1 = P(x, y + .15, 4), a2 = P(x, y + d - .15, 4), a3 = P(x, y + d - .15, 52), a4 = P(x, y + .15, 52);
        poly([a1, a2, a3, a4], '#3a4660'); for (var r = 0; r < 6; r++) { var u1 = P(x, y + .15, 8 + r * 7.5), u2 = P(x, y + d - .15, 8 + r * 7.5); cx.strokeStyle = '#59657f'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(u1[0], u1[1]); cx.lineTo(u2[0], u2[1]); cx.stroke(); }
        // коробки на приёмке
        st.crates.forEach(function (c, i) { var cp = P(x + .55 + (i % 2) * .35, y + .35 + Math.floor(i / 2) * .4, 0); drawCrate(cp[0] - 9, cp[1] - 16 - 0, ITEMS[c.item].c, 18); });
        if (st.crates.length) label(x + .7, y + d / 2, 50, st.crates.length + ' кор.', '#ffae2b');
        return;
      }
      if (s.t === 'dockOut') {
        if (!ss.lvl) { placeholder(s, 'Ворота'); return; }
        var b1 = P(x + .1, y, 4), b2 = P(x + w - .1, y, 4), b3 = P(x + w - .1, y, 54), b4 = P(x + .1, y, 54);
        poly([b1, b2, b3, b4], '#2a3348'); for (var r2 = 0; r2 < 6; r2++) { var v1 = P(x + .1, y, 8 + r2 * 7.5), v2 = P(x + w - .1, y, 8 + r2 * 7.5); cx.strokeStyle = '#4a5878'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(v1[0], v1[1]); cx.lineTo(v2[0], v2[1]); cx.stroke(); }
        var st1 = P(x + .1, y + .9, 1); cx.fillStyle = 'rgba(255,211,77,.5)'; for (var k = 0; k < 5; k++) { var q1 = P(x + .1 + k * .38, y + .95, 0); cx.fillRect(q1[0] - 6, q1[1] - 2, 10, 3); }
        label(x + w / 2, y + .4, 64, 'Отгрузка', '#2fc78a');
        return;
      }
      if (s.t === 'pc') { boxC(x + .1, y + .15, .8, .7, 24, '#4a5b82'); box(x + .3, y + .3, .4, .1, 18, '#1a2a44', '#223555', '#1a2a44', 24); var sc = P(x + .5, y + .35, 34); cx.fillStyle = '#43c9e3'; cx.fillRect(sc[0] - 7, sc[1] - 6, 14, 8); label(x + .5, y + .5, 58, 'Закупка', '#43c9e3'); return; }
      if (s.t === 'board') {
        var c1 = P(x + .1, y, 22), c2 = P(x + w - .1, y, 22), c3 = P(x + w - .1, y, 56), c4 = P(x + .1, y, 56);
        poly([c1, c2, c3, c4], '#f6efe0', '#9a7048');
        st.orders.slice(0, 6).forEach(function (o, i) { var q = P(x + .25 + (i % 3) * .55, y, 48 - Math.floor(i / 3) * 14); cx.fillStyle = o.city ? '#ffe28a' : ['#ff8aa0', '#8fd6ee', '#b9a2ff'][i % 3]; cx.fillRect(q[0] - 5, q[1] - 4, 10, 9); });
        var nb = st.orders.filter(function (o) { return !tableOf(o.id); }).length; label(x + w / 2, y + .2, 70, nb ? 'Заказы: ' + nb : 'Заказы', nb ? '#ff5a6e' : '#8a6cff');
        return;
      }
      if (s.t === 'hire') { boxC(x + .15, y + .15, .7, .7, 18, '#ffd34d'); label(x + .5, y + .5, 40, 'Команда', '#ffd34d'); return; }
      if (s.t === 'decor') {
        var dv = st.decor[s.id];
        if (!dv) { var cc = P(x + s.w / 2, y + s.d / 2, 0); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.setLineDash([4, 4]); cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(cc[0], cc[1], 18 * s.w, 9 * s.w, 0, 0, PI * 2); cx.stroke(); cx.setLineDash([]); cx.fillStyle = 'rgba(255,255,255,.7)'; cx.font = '800 14px Onest,sans-serif'; cx.textAlign = 'center'; cx.fillText('+', cc[0], cc[1] + 5); return; }
        drawDecor(dv, x, y, s.w, s.d);
      }
    }
    function drawDecor(id, x, y, w, d) {
      var c = P(x + w / 2, y + d / 2, 0);
      if (id === 'plant' || id === 'tree') { boxC(x + .3, y + .3, .4, .4, 12, '#c06a3c'); cx.fillStyle = id === 'tree' ? '#2fa36b' : '#3fbf7f'; for (var i = 0; i < 6; i++) { cx.beginPath(); cx.ellipse(c[0] + Math.cos(i) * 6, c[1] - 22 - (id === 'tree' ? 14 : 0) + Math.sin(i * 2) * 4, 9, id === 'tree' ? 4 : 6, i, 0, PI * 2); cx.fill(); } if (id === 'tree') { cx.fillStyle = '#8a6a40'; cx.fillRect(c[0] - 2, c[1] - 30, 4, 20); } return; }
      if (id === 'lamp') { cx.fillStyle = '#44506a'; cx.fillRect(c[0] - 1.5, c[1] - 44, 3, 44); cx.fillStyle = '#fff2b8'; cx.beginPath(); cx.moveTo(c[0] - 10, c[1] - 40); cx.lineTo(c[0] + 10, c[1] - 40); cx.lineTo(c[0] + 6, c[1] - 52); cx.lineTo(c[0] - 6, c[1] - 52); cx.fill(); var g = cx.createRadialGradient(c[0], c[1] - 40, 2, c[0], c[1] - 40, 40); g.addColorStop(0, 'rgba(255,240,180,.35)'); g.addColorStop(1, 'rgba(255,240,180,0)'); cx.fillStyle = g; cx.fillRect(c[0] - 40, c[1] - 80, 80, 80); return; }
      if (id === 'cooler') { boxC(x + .3, y + .3, .4, .4, 26, '#e6ecf4'); cx.fillStyle = 'rgba(111,208,238,.8)'; cx.beginPath(); cx.ellipse(c[0], c[1] - 34, 6, 8, 0, 0, PI * 2); cx.fill(); return; }
      if (id === 'poster') { boxC(x + .4, y + .4, .2, .2, 8, '#44506a'); cx.fillStyle = '#1a86c0'; cx.fillRect(c[0] - 10, c[1] - 40, 20, 26); cx.fillStyle = '#fff'; cx.font = '800 7px Onest,sans-serif'; cx.textAlign = 'center'; cx.fillText('ONION', c[0], c[1] - 25); return; }
      if (id === 'coffee') { boxC(x + .2, y + .25, .6, .5, 18, '#8a6a40'); boxC(x + .3, y + .35, .4, .3, 16, '#2b3550', 18); cx.fillStyle = '#fff'; cx.fillRect(c[0] - 2, c[1] - 26, 4, 3); return; }
      if (id === 'sofa') { boxC(x + .1, y + .2, w - .2, .6, 10, '#3f6fc8'); boxC(x + .1, y + .15, w - .2, .18, 22, '#3a63b5'); return; }
      if (id === 'arcade') { boxC(x + .5, y + .2, .7, .6, 40, '#8a6cff'); var s2 = P(x + .85, y + .5, 30); cx.fillStyle = (Math.floor(clock * 3) % 2) ? '#43f0d0' : '#ff5fd2'; cx.fillRect(s2[0] - 8, s2[1] - 10, 16, 10); return; }
    }
    function placeholder(s, t) {
      var a = P(s.i + .1, s.j + .1, 0), b = P(s.i + s.w - .1, s.j + .1, 0), c = P(s.i + s.w - .1, s.j + s.d - .1, 0), d = P(s.i + .1, s.j + s.d - .1, 0);
      cx.setLineDash([5, 4]); poly([a, b, c, d], 'rgba(255,255,255,.08)', 'rgba(255,255,255,.6)'); cx.setLineDash([]);
      var m = P(s.i + s.w / 2, s.j + s.d / 2, 0); cx.fillStyle = 'rgba(255,255,255,.85)'; cx.font = '700 10px Onest,sans-serif'; cx.textAlign = 'center'; cx.fillText('+ ' + t, m[0], m[1] + 3);
    }
    function label(x, y, z, t, col) {
      var p = P(x, y, z); cx.font = '800 11px Onest,Inter,sans-serif'; var w = cx.measureText(t).width + 14;
      cx.fillStyle = 'rgba(11,29,58,.82)'; GK.rr(cx, p[0] - w / 2, p[1] - 10, w, 18, 9); cx.fill(); cx.fillStyle = col; cx.beginPath(); cx.arc(p[0] - w / 2 + 7, p[1] - 1, 2.5, 0, PI * 2); cx.fill();
      cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.fillText(t, p[0] + 3, p[1] + 3);
    }
    var clock = 0;
    function draw(dt) {
      var c = cx; c.save(); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      var g = c.createLinearGradient(0, 0, 0, S.h); g.addColorStop(0, '#2c6aa8'); g.addColorStop(1, '#173a6b'); c.fillStyle = g; c.fillRect(0, 0, S.w, S.h);
      c.translate(S.w / 2, S.h / 2); c.scale(cam.z, cam.z);
      // улица вокруг
      var fl = FLOORS.filter(function (f) { return f.id === st.floor; })[0] || FLOORS[0], wl = (WALLS.filter(function (w) { return w.id === st.wall; })[0] || WALLS[0]).c;
      poly([P(-4, -4), P(GW + 4, -4), P(GW + 4, GH + 4), P(-4, GH + 4)], '#6f7b8f');
      for (var k = -4; k < GW + 4; k += 2) { var q1 = P(k, -2.6), q2 = P(k + 1, -2.6); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke(); }
      for (var k2 = -4; k2 < GH + 4; k2 += 2) { var r1 = P(-2.6, k2), r2 = P(-2.6, k2 + 1); c.beginPath(); c.moveTo(r1[0], r1[1]); c.lineTo(r2[0], r2[1]); c.stroke(); }
      // пол по клеткам
      for (var j = 0; j < GH; j++) for (var i = 0; i < GW; i++) {
        var z = zoneOf(i, j), o = owned(z), tl = P(i, j), tr = P(i + 1, j), br = P(i + 1, j + 1), bl = P(i, j + 1);
        if (o) poly([tl, tr, br, bl], (i + j) % 2 ? fl.a : fl.b);
        else poly([tl, tr, br, bl], (i + j) % 2 ? 'rgba(20,40,70,.55)' : 'rgba(20,40,70,.45)');
      }
      // подписи закрытых зон
      Object.keys(ZONES).forEach(function (zk) { if (owned(zk)) return; var Z = ZONES[zk], r = Z.r, m = P(r[0] + r[2] / 2, r[1] + r[3] / 2, 0), lk = Z.lvl > st.lvl; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '800 14px Onest,sans-serif'; c.fillText(Z.n, m[0], m[1] - 8); c.font = '700 12px Onest,sans-serif'; c.fillStyle = lk ? 'rgba(255,255,255,.6)' : '#ffd34d'; c.fillText(lk ? 'с ' + Z.lvl + ' уровня' : 'Купить за ' + fmt(Z.cost), m[0], m[1] + 10); });
      // задние стены по границе своей площади (верх и лево)
      for (var i2 = 0; i2 < GW; i2++) for (var j2 = 0; j2 < GH; j2++) {
        if (!owned(zoneOf(i2, j2))) continue;
        if (j2 === 0 || !owned(zoneOf(i2, j2 - 1))) { var u1 = P(i2, j2, 0), u2 = P(i2 + 1, j2, 0), u3 = P(i2 + 1, j2, 66), u4 = P(i2, j2, 66); poly([u1, u2, u3, u4], GK.shade(wl, .92)); if (i2 % 3 === 1 && j2 === 0) { var wn = P(i2 + .2, j2, 30), wn2 = P(i2 + .8, j2, 30), wn3 = P(i2 + .8, j2, 52), wn4 = P(i2 + .2, j2, 52); poly([wn, wn2, wn3, wn4], 'rgba(170,220,255,.7)'); } }
        if (i2 === 0 || !owned(zoneOf(i2 - 1, j2))) { var v1 = P(i2, j2, 0), v2 = P(i2, j2 + 1, 0), v3 = P(i2, j2 + 1, 66), v4 = P(i2, j2, 66); poly([v1, v2, v3, v4], GK.shade(wl, .75)); }
      }
      // грузовик приёмки
      if (truckAnim || st.truck) { var tk = truckAnim ? truckAnim.p || 0 : 1, tx = -3.2 - (1 - tk) * 6; boxC(tx, 2.9, 2.2, 1.5, 34, '#ffffff'); boxC(tx + 2.2, 3.1, .9, 1.2, 26, '#ff5a6e'); var wh = P(tx + .4, 4.4, 0); GK.shadow(c, wh[0], wh[1], 8, 3, .3); }
      // фургоны отгрузки
      Object.keys(vans).forEach(function (sid) { var v = vans[sid], s = SL[sid], k3 = v.t < .5 ? v.t / .5 : 1 - (v.t - .5) / .5, ty = -1.6 - (1 - k3) * 5; boxC(s.i + .1, ty, 1.8, 1.1, 26, '#1a86c0'); boxC(s.i + .1, ty - .7, 1.8, .7, 20, '#ffffff'); });
      // объекты и люди по глубине
      var items = [];
      SLOTS.forEach(function (s) { if (owned(s.z)) items.push({ d: s.i + s.j + s.w + s.d - 1, f: function () { drawSlot(s); } }); });
      items.push({ d: me.x + me.y, f: function () { person(me); } });
      npcs.forEach(function (n) { items.push({ d: n.x + n.y, f: function () { person(n); } }); });
      items.sort(function (a, b) { return a.d - b.d; }).forEach(function (o) { o.f(); });
      // отметка касания
      if (tapMark) { tapMark.t += dt; var tp = P(tapMark.x, tapMark.y, 0), a = 1 - tapMark.t / .6; if (a > 0) { c.strokeStyle = 'rgba(255,255,255,' + a + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(tp[0], tp[1], 10 + tapMark.t * 20, 5 + tapMark.t * 10, 0, 0, PI * 2); c.stroke(); } else tapMark = null; }
      // путь игрока
      if (me.path && me.path.length) { c.fillStyle = 'rgba(255,255,255,.5)'; me.path.forEach(function (q) { var pp = P(q[0], q[1], 0); c.beginPath(); c.arc(pp[0], pp[1], 2.2, 0, PI * 2); c.fill(); }); }
      parts.step(dt); parts.draw(c, cam.x, cam.y);
      c.restore();
      // экранные частицы (конфетти)
      c.save(); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      for (var q = scrParts.length - 1; q >= 0; q--) { var sp = scrParts[q]; sp.t += dt; if (sp.t > sp.life) { scrParts.splice(q, 1); continue; } sp.vy += 500 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; c.globalAlpha = Math.min(1, (sp.life - sp.t) * 2); c.fillStyle = sp.c; c.fillRect(sp.x, sp.y, sp.r * 2, sp.r); }
      c.globalAlpha = 1; c.restore();
    }

    /* ================================================================ цикл */
    var orderT = 0, uiT = 0;
    function update(dt) {
      clock += dt;
      cam.z += (cam.tz - cam.z) * Math.min(1, dt * 8);
      if (S.paused) { draw(dt); return; }
      // движение игрока
      var d = I.dir();
      if (d.on) {
        me.path = null; me.goal = null;
        var vx = (d.x + d.y) * .7071, vy = (d.y - d.x) * .7071, sp = me.speed * dt, nx = me.x + vx * sp, ny = me.y + vy * sp;
        if (walk(Math.floor(nx), Math.floor(me.y))) me.x = nx; if (walk(Math.floor(me.x), Math.floor(ny))) me.y = ny;
        me.moving = true; me.walkT += dt; me.face = (vx - vy) >= 0 ? 1 : -1;
      } else if (me.path) { if (stepEnt(me, dt) && me.goal) { var gid = me.goal; me.goal = null; interact(gid); } }
      else me.moving = false;
      // ближайший объект для кнопки действия
      near = null; var best = 1.3;
      SLOTS.forEach(function (s) { if (!owned(s.z)) return; var a = access(s), dd = Math.hypot(a[0] - me.x, a[1] - me.y); if (dd < best) { best = dd; near = s; } });
      if (near && !S.sheetOpen()) { actBtn.hidden = false; actBtn.textContent = actLabel(near); } else actBtn.hidden = true;
      // грузовик
      if (st.truck) { st.truck.t -= dt; if (truckAnim) { truckAnim.t += dt; truckAnim.p = Math.min(1, truckAnim.t / 1.2); } if (st.truck.t <= 0) { st.truck.items.forEach(function (k) { st.crates.push({ item: k, n: CRATE }); }); st.truck = null; truckAnim = { t: 0, p: 1, leave: 0 }; GK.sfx.drop(); S.toast('Грузовик привёз товар на приёмку'); dirty(); } }
      else if (truckAnim) { truckAnim.leave = (truckAnim.leave || 0) + dt; truckAnim.p = 1 - Math.min(1, truckAnim.leave / 1.2); if (truckAnim.leave > 1.3) truckAnim = null; }
      Object.keys(vans).forEach(function (k) { vans[k].t += dt / 2.2; if (vans[k].t >= 1) delete vans[k]; });
      // заказы
      orderT -= dt;
      var plain = st.orders.filter(function (o) { return !o.city; }).length, cap = 3 + Math.floor(st.lvl / 3);
      if (orderT <= 0 && plain < cap && !(tutor.active() && tutor.i < 5)) { orderT = 28 + Math.random() * 14; st.orders.push(newOrder(null)); GK.tone(880, .08, { vol: .05 }); dirty(); }
      ensureTutOrder();
      st.orders.forEach(function (o) {
        if (tutor.active() && !o.city) return; // во время обучения сроки не идут
        o.left -= dt; if (o.left <= 0) { o.dead = true; }
      });
      var dead = st.orders.filter(function (o) { return o.dead; });
      if (dead.length) { dead.forEach(function (o) { var tb = tableOf(o.id); if (tb) { var ss = st.slots[tb]; ss.got.forEach(function (k) { returnItem(k); }); ss.order = null; ss.got = []; ss.parcel = null; } if (o.city) st.contract = null; rateAdd(o.city ? -.4 : -.15); S.toast('Заказ ' + (o.city ? 'для города ' : 'для ') + o.name + ' сорван. Рейтинг снизился', 'warn'); GK.sfx.err(); }); st.orders = st.orders.filter(function (o) { return !o.dead; }); dirty(); }
      Object.keys(st.slots).forEach(function (k) { var ss = st.slots[k]; if (SL[k].t === 'table' && ss.order && !orderById(ss.order) && !ss.parcel) { ss.got.forEach(returnItem); ss.order = null; ss.got = []; } });
      npcs.forEach(function (n) { stepEnt(n, dt); npcThink(n, dt); });
      autoJobs(dt);
      // камера за игроком
      if (camFree > 0) camFree -= dt; else { var mp = iso(me.x, me.y, 30); cam.x += (mp[0] - cam.x) * Math.min(1, dt * 4); cam.y += (mp[1] - cam.y) * Math.min(1, dt * 4); }
      if (me.moving && Math.random() < dt * 4) GK.sfx.step();
      uiT -= dt; if (uiT <= 0) { uiT = .25; hud(); }
      tutor.update(); saver.tick();
      draw(dt);
    }
    function returnItem(k) { var sh = shelfFor(k); if (sh) { var s = st.slots[sh]; s.item = k; s.qty++; } }
    function actLabel(s) {
      var ss = st.slots[s.id], c = me.carry;
      switch (s.t) {
        case 'pc': return 'Закупка'; case 'board': return 'Заказы'; case 'hire': return 'Команда'; case 'decor': return st.decor[s.id] ? 'Декор' : 'Поставить декор';
        case 'dockIn': return c ? 'Руки заняты' : st.crates.length ? 'Взять коробку' : 'Приёмка';
        case 'shelf': return !ss.lvl ? 'Поставить стеллаж' : c && c.kind === 'crate' ? 'Положить на стеллаж' : 'Взять товар';
        case 'table': return !ss.lvl ? 'Поставить стол' : ss.parcel ? 'Взять посылку' : !ss.order ? 'Выбрать заказ' : c && c.kind === 'items' ? 'Положить на стол' : !needLeft(s.id).length ? 'Упаковать' : 'Нужны вещи';
        case 'dockOut': return !ss.lvl ? 'Поставить ворота' : c && c.kind === 'parcel' ? 'Отправить посылку' : 'Отгрузка';
      }
      return 'Действие';
    }
    function hud() {
      enUI(st);
      coinChip.querySelector('span').textContent = fmt(st.coins);
      lvlChip.querySelector('b').textContent = st.lvl; lvlChip.querySelector('i').style.width = (st.xp / xpNeed(st.lvl) * 100) + '%'; lvlChip.querySelector('.st').textContent = '★ ' + st.rating.toFixed(1).replace('.', ',');
      var free = st.orders.filter(function (o) { return !tableOf(o.id); }).length, em = $('[data-gz="orders"] em'); em.hidden = !free; em.textContent = free;
      // мини-список заказов на столах
      var on = st.orders.filter(function (o) { return tableOf(o.id); }).slice(0, 3);
      $('.gz-orders').innerHTML = on.map(function (o) { var tb = tableOf(o.id), ss = st.slots[tb]; return '<div class="gz-oc' + (o.left < 60 ? ' hot' : '') + '"><b>' + esc(o.name) + '</b><span>' + o.items.map(function (k, i) { var got = ss.got.slice(), n = 0; return '<i style="--c:' + ITEMS[k].c + '"></i>'; }).join('') + '</span><small>' + (ss.parcel ? 'готово' : ss.got.length + '/' + o.items.length) + ' · ' + GK.dur(o.left) + '</small></div>'; }).join('');
    }

    /* ================================================================ запуск и выход */
    rebuild(); spawnWorkers();
    if (!walk(Math.floor(me.x), Math.floor(me.y))) { me.x = 3.5; me.y = 4.5; }
    var mp0 = iso(me.x, me.y, 30); cam.x = mp0[0]; cam.y = mp0[1];
    function fitZoom() { cam.tz = cam.z = clamp(Math.min(S.w / 620, S.h / 520), .62, 1.25); }
    fitZoom(); S.onresize = function () { };
    carryUI(); hud(); checkAch();
    var loop = GK.loop(function (dt) { if (alive) update(dt); });
    S.loaded(); GK.music('warm');
    setTimeout(offline, 500);
    S.onclose = function () {
      if (!alive) return; alive = false; loop.stop(); I.destroy();
      saver.flush(true).then(function () { saver.stop(); saver.off(); S.destroy(); ctx.onClose(); });
    };
    W.__gz = { path: path, needLeft: needLeft, shelfWith: shelfWith, grid: function () { return grid; }, st: st, me: me, interact: interact, S: S, SL: SL, access: access, tutor: tutor, update: update, cam: cam, npcs: npcs };
    return { close: function () { S.onclose(); } };
  }

  var GZ_CSS = '.gz{--gk-acc:linear-gradient(140deg,#43c9e3,#1a86c0)}' +
    '.gz-coin{display:inline-block;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffd34d 55%,#c98a10);box-shadow:inset 0 0 0 2px #c98a10;vertical-align:-3px;flex:none}' +
    '.gk-btn .gz-coin{width:14px;height:14px}' +
    '.gz-lvl{gap:8px}.gz-lvl b{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:linear-gradient(140deg,#43c9e3,#1a86c0);font-size:.8rem}.gz-lvl .bar{width:46px;height:6px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}.gz-lvl .bar i{display:block;height:100%;background:#43c9e3}.gz-lvl .st{color:#ffd34d;font-size:.82rem}' +
    '.gz-dock{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:6px;z-index:5;padding:6px;border-radius:18px;background:rgba(11,29,58,.7);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}' +
    '.gz-d{position:relative;height:44px;padding:0 14px;border-radius:13px;border:0;background:rgba(255,255,255,.08);font-weight:800;font-size:.86rem;white-space:nowrap}.gz-d:active{transform:scale(.95)}' +
    '.gz-d em{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#ff5a6e;color:#fff;font:800 .72rem/20px Onest,sans-serif;text-align:center;font-style:normal;padding:0 5px}.gz-d em[hidden]{display:none}' +
    '.gz-act{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);height:50px;padding:0 24px;border-radius:16px;border:0;background:linear-gradient(140deg,#ffd34d,#ff9f2b);color:#3a2400;font-weight:800;font-size:1rem;box-shadow:0 10px 26px rgba(255,159,43,.45),0 0 0 3px rgba(255,255,255,.25);z-index:5;white-space:nowrap}.gz-act[hidden]{display:none}' +
    '.gz-carry{position:absolute;left:50%;top:calc(60px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;gap:6px;align-items:center;padding:8px 12px;border-radius:14px;background:rgba(11,29,58,.75);border:1px solid rgba(255,255,255,.18);font-weight:700;font-size:.82rem;z-index:4;white-space:nowrap;max-width:92vw}.gz-carry[hidden]{display:none}' +
    '.gz-carry i{width:16px;height:16px;border-radius:5px;background:var(--c);box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)}.gz-carry i.cr{background:#c99358;box-shadow:inset 0 0 0 4px var(--c)}.gz-carry i.pc{background:#d8a865}' +
    '.gz-orders{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:calc(60px + env(safe-area-inset-top,0px));display:grid;gap:6px;z-index:4;pointer-events:none}' +
    '.gz-oc{padding:7px 10px;border-radius:12px;background:rgba(11,29,58,.72);border:1px solid rgba(255,255,255,.16);display:grid;gap:3px;min-width:120px}.gz-oc b{font-size:.8rem}.gz-oc span{display:flex;gap:3px}.gz-oc i{width:11px;height:11px;border-radius:3px;background:var(--c)}.gz-oc small{font-size:.72rem;opacity:.75}.gz-oc.hot{border-color:#ff8a80}' +
    '.gz-zoom{position:absolute;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(80px + env(safe-area-inset-bottom,0px));display:grid;gap:6px;z-index:4}.gz-zoom .gk-b{font-size:1.3rem;font-weight:800}' +
    '.gz-ord .gz-its{display:flex;gap:4px;flex-wrap:wrap}.gz-ord .gz-its i{width:14px;height:14px;border-radius:4px;background:var(--c)}.gz-ord.city{border-color:rgba(255,211,77,.5);background:rgba(255,211,77,.08)}.gz-ord small.hot{color:#ff8a80}' +
    '.gz-pay{display:inline-flex;align-items:center;gap:3px;color:#ffd34d;font-size:.82rem;margin-left:6px}.gz-pay .gz-coin{width:13px;height:13px}' +
    '.gz-info{padding:10px 12px;border-radius:12px;background:rgba(67,201,227,.12);border:1px solid rgba(67,201,227,.35);font-weight:700;font-size:.88rem}' +
    '.gz-max{font-size:.78rem;font-weight:800;opacity:.7;white-space:nowrap}.gz-sub{font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7;margin-top:4px}' +
    '.gz-sw{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.gz-sw button{display:grid;gap:4px;justify-items:center;padding:8px 4px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);text-align:center}.gz-sw button.on{border-color:#43c9e3;background:rgba(67,201,227,.14)}.gz-sw i{width:36px;height:36px;border-radius:10px}.gz-sw b{font-size:.78rem}.gz-sw small{font-size:.7rem;opacity:.7}' +
    '.gz-map{border-radius:14px;background:rgba(255,255,255,.04);padding:6px}' +
    '.gz-lvlup{display:grid;place-items:center;height:110px}.gz-lvlup b{display:grid;place-items:center;width:90px;height:90px;border-radius:28px;background:linear-gradient(140deg,#43c9e3,#1a86c0);font-size:2.6rem;box-shadow:0 0 0 8px rgba(67,201,227,.2),0 14px 40px rgba(26,134,192,.6);animation:gkpop .6s cubic-bezier(.2,1.4,.4,1) both}' +
    '.pk{display:grid;grid-template-columns:1fr 160px;gap:12px;align-items:center}.pk-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}' +
    '.pk-it{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);font-weight:700;font-size:.8rem;text-align:left;transition:transform .25s,opacity .25s}.pk-it .ic svg{width:26px;height:26px}.pk-it.in{opacity:.25;transform:scale(.85)}' +
    '.pk-box{position:relative;height:150px;perspective:400px}.pk-box::before{content:"";position:absolute;left:14%;right:14%;bottom:8%;height:58%;border-radius:6px;background:linear-gradient(180deg,#d8a865,#b8844a);box-shadow:inset 0 0 0 2px rgba(80,50,20,.35)}' +
    '.pk-fl{position:absolute;bottom:66%;width:36%;height:22%;background:#c99358;transform-origin:bottom;transition:transform .4s}.pk-fl.l{left:14%;transform:rotateX(-60deg) skewX(-10deg)}.pk-fl.r{right:14%;transform:rotateX(-60deg) skewX(10deg)}' +
    '.pk-box.closed .pk-fl{transform:none}.pk-in{position:absolute;left:20%;right:20%;bottom:18%;height:45%;display:flex;flex-wrap:wrap-reverse;gap:3px;align-content:flex-start;justify-content:center;overflow:hidden}.pk-in i{width:26px;height:20px;border-radius:5px;background:var(--c);transform:rotate(var(--r));animation:gkpop .3s both}' +
    '.pk-box.closed .pk-in{opacity:0}.pk-tape{position:absolute;left:46%;width:8%;bottom:8%;height:0;background:rgba(255,236,170,.9);transition:height .4s}.pk-box.closed .pk-tape{height:80%}' +
    '.pk-lab{position:absolute;left:24%;bottom:22%;width:30%;height:22%;border-radius:3px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);transform:scale(0) rotate(-8deg);transition:transform .3s cubic-bezier(.2,1.6,.4,1)}.pk-lab::after{content:"";position:absolute;inset:25% 15%;background:repeating-linear-gradient(90deg,#0b1d3a 0 2px,transparent 2px 4px)}.pk-box.lab .pk-lab{transform:scale(1) rotate(-8deg)}' +
    '.pk-st{color:#ffd34d;font-size:1.1rem;letter-spacing:2px}.pk-st s{color:rgba(255,255,255,.25);text-decoration:none}' +
    '@media (max-width:560px){.gz-d{padding:0 8px;font-size:.72rem;height:40px;flex:1 1 auto}.gz-dock{gap:3px;padding:4px;width:calc(100vw - 16px);justify-content:space-between}.gz-orders{top:calc(108px + env(safe-area-inset-top,0px))}.gz-oc{min-width:104px}.pk{grid-template-columns:1fr}.pk-box{height:120px}.gz-sw{grid-template-columns:repeat(2,minmax(0,1fr))}.gz-lvl .bar{display:none}}' +
    '@media (max-width:380px){.gz-d{padding:0 5px;font-size:.68rem}}';

  W.Gruz = { open: open };
})(window);
