/* rub.js: «Последний рубеж», 2D-игра на выживание (вид сверху под углом). Каркас: assets/gamekit.js.
   Мир после катастрофы: лагерь в центре и 6 биомов вокруг (лес, руины города, радиоактивное болото, пустыня, вечная зима, лавовые поля).
   В каждом биоме свои ресурсы, мутанты и босс. Новый биом открывается после победы над боссом прошлого И постройки защиты в лагере
   (на неё нужно «ядро» босса). Герой ходит сам, добывает, подойдя к ресурсу, атакует автоматически + 3 умения.
   Лагерь: склад, верстак, кузница, лаборатория, производство с выжившими (работают и пока вас нет), стены и башни против ночных набегов.
   Падение в бою: всё, что было в сумке, остаётся мешком на месте, его можно забрать. Энергия тратится на добычу, крафт и стройку. */
(function (W) {
  'use strict';
  var GK = W.GK, PI = Math.PI, fmt = GK.fmt, esc = GK.esc, clamp = GK.clamp;
  var R_CAMP = 560, R_OUT = 900, R_WORLD = 3200, CELL = 150, CHUNK = 512;

  /* ================================================================ данные */
  var RES = {
    wood: { n: 'Дерево', c: '#a0703c' }, stone: { n: 'Камень', c: '#9aa0a8' }, food: { n: 'Еда', c: '#e0574f' }, scrap: { n: 'Металлолом', c: '#8a96a8' },
    steel: { n: 'Сталь', c: '#c9d4e3' }, herb: { n: 'Травы', c: '#5fc06a' }, slime: { n: 'Слизь', c: '#9be03a' }, quartz: { n: 'Кварц', c: '#f2d38a' },
    oil: { n: 'Нефть', c: '#3a3a44' }, ice: { n: 'Лёд', c: '#9fe2ff' }, fur: { n: 'Мех', c: '#e8e2d4' }, obsidian: { n: 'Обсидиан', c: '#5a3a7a' }, sulfur: { n: 'Сера', c: '#ffe14a' },
    medkit: { n: 'Аптечка', c: '#ff5a6e', item: true }, grenade: { n: 'Граната', c: '#6a7a4a', item: true }
  };
  var BIOMES = [
    { id: 'forest', n: 'Мёртвый лес', g: '#4e7438', g2: '#5c8442', fx: 'leaf', enemy: ['wolf', 'boar'], nodes: [['tree', 5], ['rock', 3], ['bush', 2], ['herbp', 1]], boss: 'alpha' },
    { id: 'ruins', n: 'Руины города', g: '#6c6d6a', g2: '#7a7b77', fx: 'dust', enemy: ['rat', 'drone'], nodes: [['scrapp', 5], ['rubble', 3], ['deadtree', 2]], boss: 'golem', prot: 'radio' },
    { id: 'swamp', n: 'Ядовитое болото', g: '#4a5636', g2: '#55623c', fx: 'spore', enemy: ['bog', 'beetle'], nodes: [['pod', 4], ['herbp', 4], ['swtree', 3]], boss: 'queen', prot: 'filter' },
    { id: 'desert', n: 'Выжженная пустыня', g: '#c4a265', g2: '#d0ae70', fx: 'sand', enemy: ['scorp', 'hyena'], nodes: [['quartzp', 4], ['barrel', 3], ['cactus', 3], ['rubble', 1]], boss: 'worm', prot: 'desal' },
    { id: 'snow', n: 'Вечная зима', g: '#dfe7ef', g2: '#e9eff5', fx: 'snow', enemy: ['swolf', 'yetik'], nodes: [['iceb', 4], ['pine', 4], ['rock', 2]], boss: 'yeti', prot: 'heater' },
    { id: 'lava', n: 'Лавовые поля', g: '#3b2b29', g2: '#45322f', fx: 'ember', enemy: ['magma', 'imp'], nodes: [['obsid', 4], ['vent', 3], ['rock', 2]], boss: 'titan', prot: 'cooler' }
  ];
  var NODES = {
    tree: { res: 'wood', tier: 1, hp: 3, amt: [2, 3], r: 20 }, deadtree: { res: 'wood', tier: 1, hp: 3, amt: [1, 3], r: 16 }, swtree: { res: 'wood', tier: 1, hp: 3, amt: [2, 3], r: 18 }, pine: { res: 'wood', tier: 1, hp: 3, amt: [2, 4], r: 18 },
    rock: { res: 'stone', tier: 1, hp: 4, amt: [2, 3], r: 20 }, rubble: { res: 'stone', tier: 1, hp: 3, amt: [2, 3], r: 20 }, bush: { res: 'food', tier: 1, hp: 2, amt: [2, 3], r: 14 }, cactus: { res: 'food', tier: 1, hp: 2, amt: [1, 3], r: 14 },
    herbp: { res: 'herb', tier: 1, hp: 2, amt: [1, 2], r: 12 }, scrapp: { res: 'scrap', tier: 2, hp: 4, amt: [2, 3], r: 22 }, pod: { res: 'slime', tier: 1, hp: 3, amt: [1, 3], r: 16 },
    quartzp: { res: 'quartz', tier: 3, hp: 4, amt: [1, 3], r: 16 }, barrel: { res: 'oil', tier: 3, hp: 3, amt: [1, 2], r: 14 }, iceb: { res: 'ice', tier: 3, hp: 4, amt: [2, 3], r: 20 },
    obsid: { res: 'obsidian', tier: 4, hp: 5, amt: [1, 3], r: 18 }, vent: { res: 'sulfur', tier: 4, hp: 4, amt: [1, 3], r: 16 }
  };
  // враги: hp, урон, скорость, дальность атаки, опыт, добыча
  var EN = {
    wolf: { n: 'Мутант-волк', hp: 40, dmg: 6, spd: 125, rng: 34, xp: 6, c: '#6b6258', shape: 'quad', drop: [['food', 1]] },
    boar: { n: 'Бешеный кабан', hp: 75, dmg: 9, spd: 95, rng: 36, xp: 9, c: '#7a5a44', shape: 'quad', drop: [['food', 2]] },
    rat: { n: 'Крыса-мародёр', hp: 70, dmg: 10, spd: 135, rng: 32, xp: 11, c: '#8a7a6a', shape: 'quad', drop: [['scrap', 1]] },
    drone: { n: 'Сломанный дрон', hp: 55, dmg: 9, spd: 85, rng: 240, xp: 12, c: '#8a96a8', shape: 'drone', ranged: true, drop: [['scrap', 2]] },
    bog: { n: 'Болотник', hp: 120, dmg: 14, spd: 80, rng: 36, xp: 16, c: '#5a7a3a', shape: 'blob', drop: [['slime', 1]] },
    beetle: { n: 'Кислотный жук', hp: 90, dmg: 12, spd: 145, rng: 30, xp: 15, c: '#4a8a5a', shape: 'bug', drop: [['herb', 1]] },
    scorp: { n: 'Скорпион', hp: 160, dmg: 18, spd: 110, rng: 40, xp: 22, c: '#b0703a', shape: 'bug', drop: [['quartz', 1]] },
    hyena: { n: 'Гиена-мутант', hp: 130, dmg: 16, spd: 165, rng: 34, xp: 21, c: '#a88a5a', shape: 'quad', drop: [['food', 2]] },
    swolf: { n: 'Снежный волк', hp: 210, dmg: 23, spd: 155, rng: 36, xp: 30, c: '#d8e0ea', shape: 'quad', drop: [['fur', 1]] },
    yetik: { n: 'Детёныш йети', hp: 300, dmg: 27, spd: 95, rng: 40, xp: 34, c: '#eef3f8', shape: 'blob', drop: [['fur', 2]] },
    magma: { n: 'Магмовый слизень', hp: 320, dmg: 31, spd: 85, rng: 38, xp: 42, c: '#ff6a1f', shape: 'blob', drop: [['sulfur', 1]] },
    imp: { n: 'Огненный бес', hp: 230, dmg: 28, spd: 110, rng: 230, xp: 44, c: '#c0392b', shape: 'drone', ranged: true, drop: [['obsidian', 1]] },
    raider: { n: 'Заражённый', hp: 60, dmg: 8, spd: 90, rng: 34, xp: 8, c: '#6a7a5a', shape: 'man', drop: [['scrap', 1]] }
  };
  var BOSS = {
    alpha: { n: 'Вожак стаи', hp: 700, dmg: 16, spd: 130, rng: 46, xp: 150, c: '#4a4038', shape: 'quad', size: 2.1, sp: 'charge', adds: 'wolf', loot: [['food', 20], ['wood', 30]] },
    golem: { n: 'Бетонный голем', hp: 1500, dmg: 26, spd: 70, rng: 60, xp: 320, c: '#7a7f88', shape: 'golem', size: 2.4, sp: 'slam', adds: 'rat', loot: [['scrap', 40], ['stone', 40]] },
    queen: { n: 'Королева топей', hp: 2400, dmg: 30, spd: 75, rng: 56, xp: 520, c: '#5a8a3a', shape: 'blob', size: 2.6, sp: 'spit', adds: 'beetle', loot: [['slime', 40], ['herb', 25]] },
    worm: { n: 'Песчаный червь', hp: 3400, dmg: 38, spd: 95, rng: 60, xp: 760, c: '#b88a4a', shape: 'worm', size: 2.6, sp: 'burrow', adds: 'scorp', loot: [['quartz', 35], ['oil', 25]] },
    yeti: { n: 'Снежный йети', hp: 4600, dmg: 46, spd: 90, rng: 60, xp: 1050, c: '#f2f6fa', shape: 'golem', size: 2.6, sp: 'throw', adds: 'swolf', loot: [['fur', 30], ['ice', 40]] },
    titan: { n: 'Огненный титан', hp: 6500, dmg: 56, spd: 80, rng: 66, xp: 1500, c: '#ff5a1f', shape: 'golem', size: 2.9, sp: 'ring', adds: 'magma', loot: [['obsidian', 40], ['sulfur', 30]] }
  };
  /* постройки лагеря: x,y место; max уровень; cost(l) стоимость уровня l; need: уровень штаба */
  var BLD = {
    hq: { n: 'Штаб', x: 0, y: 0, max: 6, d: 'Сердце лагеря. Уровень штаба открывает новые постройки и уровни', cost: function (l) { return { wood: 60 * l * l, stone: 40 * l * l, steel: l >= 3 ? 20 * (l - 2) * (l - 1) : 0 }; } },
    store: { n: 'Склад', x: -170, y: -150, max: 6, d: 'Вмещает ресурсы лагеря', cost: function (l) { return { wood: 50 * l, stone: 30 * l }; }, need: function (l) { return Math.max(1, l - 1); } },
    bench: { n: 'Верстак', x: 170, y: -150, max: 3, d: 'Оружие, инструменты, рюкзаки', cost: function (l) { return { wood: 30 * l, stone: 20 * l }; }, need: function (l) { return l; } },
    saw: { n: 'Лесопилка', x: -200, y: 200, max: 5, d: 'Выжившие добывают дерево', cost: function (l) { return { wood: 50 * l, stone: 20 * l }; }, need: function (l) { return l; } },
    quarry: { n: 'Каменоломня', x: 200, y: 200, max: 5, d: 'Выжившие добывают камень', cost: function (l) { return { wood: 60 * l, stone: 20 * l }; }, need: function (l) { return l; } },
    farm: { n: 'Ферма', x: 0, y: 300, max: 5, d: 'Еда для выживших и аптечек', cost: function (l) { return { wood: 50 * l, stone: 15 * l }; }, need: function (l) { return l; } },
    forge: { n: 'Кузница', x: 300, y: 30, max: 5, d: 'Сталь, броня и лучшее оружие', cost: function (l) { return { wood: 80 * l, stone: 80 * l, scrap: 20 * l }; }, need: function (l) { return l + 1; } },
    recyc: { n: 'Переработка', x: -380, y: -160, max: 4, d: 'Выжившие переплавляют металлолом в сталь', cost: function (l) { return { wood: 60 * l, stone: 60 * l, scrap: 30 * l }; }, need: function (l) { return l + 1; } },
    lab: { n: 'Лаборатория', x: -300, y: 30, max: 3, d: 'Аптечки и гранаты', cost: function (l) { return { wood: 60 * l, stone: 40 * l, slime: 10 * l }; }, need: function (l) { return l + 2; } },
    wall: { n: 'Частокол', x: 0, y: -545, max: 6, ring: true, d: 'Стена вокруг лагеря держит ночные набеги', cost: function (l) { return { wood: 80 * l, stone: l >= 2 ? 50 * l : 0, steel: l >= 4 ? 30 * l : 0 }; }, need: function (l) { return l; } },
    tw1: { n: 'Башня', x: 370, y: -370, max: 5, tower: true, d: 'Стреляет по мутантам во время набегов', cost: function (l) { return { wood: 60 * l, stone: 40 * l, steel: l >= 2 ? 15 * l : 0 }; }, need: function (l) { return l + 1; } },
    tw2: { n: 'Башня', x: 370, y: 370, max: 5, tower: true, d: 'Стреляет по мутантам во время набегов', cost: function (l) { return { wood: 60 * l, stone: 40 * l, steel: l >= 2 ? 15 * l : 0 }; }, need: function (l) { return l + 2; } },
    tw3: { n: 'Башня', x: -370, y: 370, max: 5, tower: true, d: 'Стреляет по мутантам во время набегов', cost: function (l) { return { wood: 60 * l, stone: 40 * l, steel: l >= 2 ? 15 * l : 0 }; }, need: function (l) { return l + 3; } },
    tw4: { n: 'Башня', x: -370, y: -370, max: 5, tower: true, d: 'Стреляет по мутантам во время набегов', cost: function (l) { return { wood: 60 * l, stone: 40 * l, steel: l >= 2 ? 15 * l : 0 }; }, need: function (l) { return l + 3; } },
    radio: { n: 'Радиовышка', x: 0, y: -330, max: 1, prot: 1, d: 'Защита для Руин города: связь и карта завалов', cost: function () { return { wood: 120, stone: 80, core: 'alpha' }; }, need: function () { return 2; } },
    filter: { n: 'Фильтр воздуха', x: 400, y: -150, max: 1, prot: 2, d: 'Защита для Болота: чистый воздух', cost: function () { return { scrap: 80, steel: 30, core: 'golem' }; }, need: function () { return 3; } },
    desal: { n: 'Опреснитель', x: 400, y: 190, max: 1, prot: 3, d: 'Защита для Пустыни: запас воды', cost: function () { return { steel: 60, slime: 40, core: 'queen' }; }, need: function () { return 3; } },
    heater: { n: 'Тепловая пушка', x: -400, y: 190, max: 1, prot: 4, d: 'Защита для Зимы: обогрев', cost: function () { return { steel: 100, oil: 40, quartz: 30, core: 'worm' }; }, need: function () { return 4; } },
    cooler: { n: 'Охладитель', x: 0, y: -190, max: 1, prot: 5, d: 'Защита для Лавовых полей: охлаждение', cost: function () { return { steel: 150, ice: 60, fur: 30, core: 'yeti' }; }, need: function () { return 5; } }
  };
  var PROD = { saw: ['wood', 4], quarry: ['stone', 3], farm: ['food', 4], recyc: ['steel', 1] };
  var WEAP = [
    { n: 'Дубина', dmg: 10 }, { n: 'Топор', dmg: 17, at: 'bench', lvl: 1, cost: { wood: 15, stone: 10 } }, { n: 'Мачете', dmg: 27, at: 'bench', lvl: 2, cost: { scrap: 25, wood: 25 } },
    { n: 'Копьё из арматуры', dmg: 42, at: 'forge', lvl: 1, cost: { steel: 15, wood: 30 } }, { n: 'Кислотный меч', dmg: 62, at: 'forge', lvl: 2, cost: { steel: 30, slime: 20 } },
    { n: 'Кварцевый резак', dmg: 92, at: 'forge', lvl: 3, cost: { steel: 45, quartz: 25 } }, { n: 'Ледоруб', dmg: 132, at: 'forge', lvl: 4, cost: { steel: 60, ice: 30, fur: 10 } },
    { n: 'Обсидиановый клинок', dmg: 195, at: 'forge', lvl: 5, cost: { obsidian: 35, sulfur: 20, steel: 60 } }
  ];
  var ARMOR = [{ n: 'Лохмотья', hp: 0 }, { n: 'Доспех из покрышек', hp: 50, at: 'bench', lvl: 2, cost: { scrap: 30, wood: 20 } }, { n: 'Бронежилет', hp: 120, at: 'forge', lvl: 1, cost: { steel: 30, slime: 15 } },
    { n: 'Термокостюм', hp: 220, at: 'forge', lvl: 3, cost: { steel: 60, quartz: 20, fur: 20 } }, { n: 'Обсидиановая броня', hp: 380, at: 'forge', lvl: 5, cost: { obsidian: 40, steel: 80 } }];
  var TOOLS = [{ n: 'Нож и камень', t: 1 }, { n: 'Кирка', t: 2, at: 'bench', lvl: 1, cost: { wood: 40, stone: 30 } }, { n: 'Стальной инструмент', t: 3, at: 'forge', lvl: 1, cost: { steel: 25, wood: 30 } }, { n: 'Термобур', t: 4, at: 'forge', lvl: 3, cost: { steel: 60, quartz: 30, oil: 20 } }];
  var BAGS = [{ n: 'Сумка', cap: 40 }, { n: 'Рюкзак', cap: 70, at: 'bench', lvl: 1, cost: { wood: 30, food: 15 } }, { n: 'Туристический рюкзак', cap: 110, at: 'bench', lvl: 2, cost: { scrap: 30, herb: 10 } }, { n: 'Экспедиционный рюкзак', cap: 160, at: 'forge', lvl: 2, cost: { steel: 30, fur: 10 } }];
  var CONS = [{ id: 'medkit', n: 'Аптечка', d: 'Лечит 45% здоровья', at: 'lab', lvl: 1, cost: { herb: 3, food: 2 } }, { id: 'grenade', n: 'Граната', d: 'Мощный взрыв по области', at: 'lab', lvl: 1, cost: { scrap: 3, slime: 2 } }, { id: 'steel', n: 'Сталь (3 лома → 1)', d: 'Быстрая переплавка', at: 'forge', lvl: 1, cost: { scrap: 3 } }];
  var SURV = ['Марта', 'Гоша', 'Ирма', 'Толик', 'Ева', 'Степан', 'Лада', 'Борис', 'Уля', 'Кир', 'Нина', 'Захар'];
  var ACH = [
    { id: 'k10', n: 'Первая кровь', d: 'Победить 10 мутантов', k: 'kills', need: 10 }, { id: 'k100', n: 'Охотник', d: 'Победить 100 мутантов', k: 'kills', need: 100 }, { id: 'k500', n: 'Гроза пустошей', d: 'Победить 500 мутантов', k: 'kills', need: 500 },
    { id: 'b1', n: 'Вожак повержен', d: 'Победить первого босса', k: 'bosses', need: 1 }, { id: 'b3', n: 'Половина пути', d: 'Победить 3 боссов', k: 'bosses', need: 3 }, { id: 'b6', n: 'Последний рубеж', d: 'Победить всех 6 боссов', k: 'bosses', need: 6 },
    { id: 's3', n: 'Не один', d: 'Спасти 3 выживших', k: 'saved', need: 3 }, { id: 's10', n: 'Община', d: 'Спасти 10 выживших', k: 'saved', need: 10 },
    { id: 'hq3', n: 'Поселение', d: 'Штаб 3 уровня', k: 'hq', need: 3 }, { id: 'hq6', n: 'Цивилизация', d: 'Штаб 6 уровня', k: 'hq', need: 6 },
    { id: 'r5', n: 'Ночной дозор', d: 'Отбить 5 набегов', k: 'raids', need: 5 }, { id: 'r20', n: 'Неприступный', d: 'Отбить 20 набегов', k: 'raids', need: 20 },
    { id: 'g1000', n: 'Добытчик', d: 'Добыть 1000 ресурсов', k: 'gathered', need: 1000 }, { id: 'map', n: 'Картограф', d: 'Разведать 40% карты', k: 'explored', need: 40 },
    { id: 'w7', n: 'Легенда', d: 'Создать обсидиановый клинок', k: 'weap', need: 7 }, { id: 'lv20', n: 'Ветеран', d: 'Герой 20 уровня', k: 'lvl', need: 20 }
  ];
  var EN_MAX = 60, EN_REGEN = 30, DAY = 240, NIGHT = 90;

  /* ================================================================ мир (детерминированный) */
  function hash(a, b, s) { var h = (a * 374761393 + b * 668265263 + (s || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function sector(x, y) { var a = Math.atan2(y, x) * 180 / PI; return Math.floor(((a + 120) % 360 + 360) % 360 / 60); }
  function biomeAt(x, y) { var r = Math.hypot(x, y); if (r < R_CAMP + 60) return -1; return sector(x, y); }
  function lair(b) { var a = (b * 60 - 90) * PI / 180; return { x: Math.cos(a) * 2650, y: Math.sin(a) * 2650 }; }
  var CAGES = []; (function () { for (var b = 0; b < 6; b++) [[-14, 1500], [16, 2150]].forEach(function (p, i) { var a = ((b * 60 - 90) + p[0]) * PI / 180; CAGES.push({ id: b * 2 + i, b: b, x: Math.cos(a) * p[1], y: Math.sin(a) * p[1] }); }); })();
  function cellObj(cx, cy) {
    var x = (cx + .2 + hash(cx, cy, 1) * .6) * CELL, y = (cy + .2 + hash(cx, cy, 2) * .6) * CELL, r = Math.hypot(x, y);
    if (r > R_WORLD - 60 || r < R_CAMP + 40) return null;
    var b = sector(x, y), B = BIOMES[b], h = hash(cx, cy, 3);
    for (var i = 0; i < 6; i++) { var L = lair(i); if (Math.hypot(x - L.x, y - L.y) < 330) return null; }
    for (var q = 0; q < CAGES.length; q++) if (Math.hypot(x - CAGES[q].x, y - CAGES[q].y) < 120) return null;
    if (r < R_OUT) { if (h < .55) { var t0 = ['tree', 'rock', 'bush', 'tree', 'rock'][Math.floor(hash(cx, cy, 4) * 5)]; return { k: 'n', t: t0, x: x, y: y, b: b }; } return null; }
    if (h < .055 && r > 1050) return { k: 'e', t: B.enemy[Math.floor(hash(cx, cy, 5) * 2)], n: 1 + Math.floor(hash(cx, cy, 6) * (r > 1800 ? 3 : 2)), x: x, y: y, b: b, lv: r };
    if (h < .52) { var sum = 0; B.nodes.forEach(function (n) { sum += n[1]; }); var pick = hash(cx, cy, 7) * sum, tt = 0, ty = B.nodes[0][0]; for (var k = 0; k < B.nodes.length; k++) { tt += B.nodes[k][1]; if (pick < tt) { ty = B.nodes[k][0]; break; } } return { k: 'n', t: ty, x: x, y: y, b: b }; }
    if (h < .62) return { k: 'd', t: Math.floor(hash(cx, cy, 8) * 3), x: x, y: y, b: b };
    return null;
  }

  /* ================================================================ состояние */
  function fresh() {
    var bl = {}; Object.keys(BLD).forEach(function (k) { bl[k] = 0; }); bl.hq = 1; bl.store = 1;
    return { v: 1, hero: { lvl: 1, xp: 0, hp: 100, x: 0, y: 140 }, inv: {}, store: { wood: 40, stone: 30, food: 10 }, bld: bl, weap: 0, armor: 0, tool: 0, bag: 0,
      bosses: {}, cores: {}, open: [0], dep: {}, kills: {}, saved: {}, surv: [], comp: null, bags: [], exp: '', t: 60, raids: 0, stats: { kills: 0, gathered: 0, deaths: 0 }, ach: {},
      ms: { bosses: 0 }, tut: 0, lastAt: Date.now(), en: EN_MAX, enAt: Date.now(), skill: [0, 0, 0] };
  }
  function load(str) { var st = fresh(); if (!str) return st; try { var o = JSON.parse(str); if (o && o.v === 1) Object.keys(o).forEach(function (k) { st[k] = o[k]; }); Object.keys(BLD).forEach(function (k) { if (st.bld[k] == null) st.bld[k] = 0; }); } catch (e) { } return st; }

  /* ================================================================ запуск */
  function open(ctx) {
    var S = GK.shell({ title: 'Последний рубеж', cls: 'rb' });
    var st = load(ctx.data), E = GK.energy(st, 0, EN_REGEN);
    E.max = enMax(); var enUI = GK.energyChip(S, E);
    var I = GK.input(S, { pinch: false });
    var css = document.createElement('style'); css.textContent = RB_CSS; S.root.appendChild(css);
    var alive = true, cx = S.cx, clock = 0, $ = S.$;
    function enMax() { return EN_MAX + (st.bld.hq - 1) * 5; }
    // фишки HUD
    var hpChip = document.createElement('button'); hpChip.className = 'gk-chip rb-hp'; hpChip.setAttribute('data-rb', 'hero'); hpChip.innerHTML = '<b class="lv">1</b><span class="bar"><i></i></span><span class="v">100</span>'; S.left.appendChild(hpChip);
    var dayChip = document.createElement('div'); dayChip.className = 'gk-chip rb-day'; dayChip.innerHTML = '<i class="sun"></i><span>День</span>'; S.left.appendChild(dayChip);
    S.hud.innerHTML = '<canvas class="rb-mini" width="240" height="240" data-rb="map" aria-label="Карта"></canvas><div class="rb-boss" hidden><b></b><span class="bar"><i></i></span></div>' +
      '<div class="rb-skills"><button class="rb-sk" data-sk="0" aria-label="Вихрь"><i class="ic">🌀</i><em></em><small>Вихрь</small></button><button class="rb-sk" data-sk="1" aria-label="Аптечка"><i class="ic">➕</i><em></em><b class="n">0</b><small>Аптечка</small></button><button class="rb-sk" data-sk="2" aria-label="Граната"><i class="ic">💣</i><em></em><b class="n">0</b><small>Граната</small></button></div>' +
      '<div class="rb-bar"><button class="rb-b" data-rb="bag"><b>Сумка</b><span class="bg">0/40</span></button><button class="rb-b" data-rb="camp"><b>Лагерь</b></button><button class="rb-b" data-rb="craft"><b>Крафт</b></button><button class="rb-b" data-rb="team"><b>Отряд</b></button><button class="rb-b" data-rb="ach"><b>Цели</b><em hidden></em></button></div>' +
      '<button class="rb-act" hidden></button><div class="rb-home" hidden><i></i><span></span></div><div class="rb-dead" hidden><div><b>Вы без сознания</b><span>Добыча осталась на месте. Возвращаемся в лагерь…</span></div></div>';

    /* ---------------- герой и производные */
    var H = st.hero;
    function maxHp() { return 100 + (H.lvl - 1) * 14 + ARMOR[st.armor].hp; }
    function dmg() { return WEAP[st.weap].dmg * (1 + (H.lvl - 1) * .05); }
    function bagCap() { return BAGS[st.bag].cap; }
    function invN() { var n = 0; for (var k in st.inv) if (!RES[k].item) n += st.inv[k]; return n; }
    function storeCap() { return 200 + st.bld.store * 250; }
    function hqLvl() { return st.bld.hq; }
    function xpNeed(l) { return Math.round(40 * Math.pow(l, 1.6)); }
    var hero = { x: H.x, y: H.y, vx: 0, vy: 0, face: 1, walkT: 0, atkT: 0, swing: 0, hurtT: 0, target: null, goal: null, dead: 0, gather: null, gT: 0 };
    H.hp = Math.min(H.hp || maxHp(), maxHp());

    /* ---------------- объекты мира: кэш клеток */
    var cells = {}, enemies = [], projs = [], fx = GK.parts(), aoes = [], bossE = null;
    function key(cx2, cy2) { return cx2 + ',' + cy2; }
    function cellAt(cx2, cy2) {
      var k = key(cx2, cy2), c = cells[k];
      if (c === undefined) { c = cellObj(cx2, cy2); if (c) { c.key = k; if (c.k === 'n') { c.hp = NODES[c.t].hp; c.charges = 3; } } cells[k] = c; }
      return c;
    }
    function depleted(c) { var t = st.dep[c.key]; if (t && t > Date.now()) return true; if (t) delete st.dep[c.key]; return false; }
    function nearCells(x, y, rad, fn) { var a = Math.floor((x - rad) / CELL), b = Math.floor((x + rad) / CELL), c2 = Math.floor((y - rad) / CELL), d = Math.floor((y + rad) / CELL); for (var i = a; i <= b; i++) for (var j = c2; j <= d; j++) { var c = cellAt(i, j); if (c) fn(c); } }
    function biomeOpen(b) { return st.open.indexOf(b) >= 0; }
    function locked(x, y) { var r = Math.hypot(x, y); if (r < R_OUT) return false; return !biomeOpen(sector(x, y)); }
    // спавн врагов вокруг героя
    function spawnAround() {
      nearCells(hero.x, hero.y, 900, function (c) {
        if (c.k !== 'e' || c.live || locked(c.x, c.y)) return;
        var kt = st.kills[c.key]; if (kt && kt > Date.now()) return; if (kt) delete st.kills[c.key];
        if (Math.hypot(c.x - hero.x, c.y - hero.y) < 380) return;
        c.live = []; var lvK = 1 + Math.max(0, (c.lv - 1000) / 2200) * .6;
        for (var i = 0; i < c.n; i++) { var e = mkEnemy(c.t, c.x + (i - 1) * 30, c.y + (i % 2) * 24, lvK); e.home = c; c.live.push(e); enemies.push(e); }
      });
      // боссы
      st.open.forEach(function (b) { var bid = BIOMES[b].boss; if (st.bosses[bid] && st.bosses[bid] > Date.now() || bossE && bossE.bid === bid) return; var L = lair(b); if (Math.hypot(L.x - hero.x, L.y - hero.y) < 1000) { var e = mkEnemy(bid, L.x, L.y, 1, true); e.bid = bid; e.b = b; enemies.push(e); bossE = e; } });
      enemies = enemies.filter(function (e) { var far = Math.hypot(e.x - hero.x, e.y - hero.y) > 1500 && !e.raid; if (far) { if (e.home) e.home.live = null; if (e === bossE) bossE = null; } return !far; });
    }
    function mkEnemy(t, x, y, k, boss) { var D = boss ? BOSS[t] : EN[t]; return { t: t, D: D, boss: !!boss, x: x, y: y, hp: D.hp * k, max: D.hp * k, dmg: D.dmg * (boss ? 1 : k), spd: D.spd, face: 1, walkT: Math.random() * 3, atkT: 1, state: 'idle', sx: x, sy: y, hurt: 0, spT: 4, size: (D.size || 1) }; }

    /* ---------------- сражение */
    function hitEnemy(e, d, src) {
      if (e.dead) return; e.hp -= d; e.hurt = .18; e.state = 'chase';
      var p = scr(e.x, e.y - 30 * e.size); S.float(p[0], p[1], Math.round(d), src === 'skill' ? '#ffd34d' : '#ffffff', src === 'skill' ? 20 : 15);
      fx.burst(e.x, e.y - 18, 5, { c: e.D.c, spd: 110, g: 250, life: .4, r: 3 });
      if (e.hp <= 0) killEnemy(e);
    }
    function killEnemy(e) {
      e.dead = true; GK.sfx.hit(); fx.burst(e.x, e.y - 10, 14, { c: e.D.c, spd: 160, g: 300, life: .6, r: 4 });
      addXp(e.D.xp); st.stats.kills++;
      (e.D.drop || []).forEach(function (d) { if (Math.random() < .7) give(d[0], d[1], e.x, e.y); });
      if (e.home) { e.home.live = e.home.live && e.home.live.filter(function (x) { return !x.dead; }); if (!e.home.live || !e.home.live.length) { st.kills[e.home.key] = Date.now() + 180000; e.home.live = null; } }
      if (e.boss) {
        st.bosses[e.bid] = Date.now() + 20 * 60000; st.cores[e.bid] = (st.cores[e.bid] || 0) + 1; bossE = null;
        var first = !st.beaten || !st.beaten[e.bid]; st.beaten = st.beaten || {}; st.beaten[e.bid] = 1; st.ms.bosses = Object.keys(st.beaten).length;
        e.D.loot.forEach(function (l) { give(l[0], l[1], e.x, e.y, true); });
        GK.sfx.win(); shake = 12;
        var nb = e.b + 1, nextB = BIOMES[nb];
        S.sheet('Босс повержен!', '<div class="rb-trophy">🏆</div><p class="gk-lead"><b>' + esc(e.D.n) + '</b> побеждён. Вы получили ядро босса и трофеи.' + (first && nextB ? ' Чтобы пройти в биом «' + esc(nextB.n) + '», постройте в лагере «' + esc(BLD[nextB.prot].n) + '».' : '') + (first && !nextB ? ' Все шесть биомов покорены!' : '') + '</p><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Дальше</button></div>', { w: 400 });
        dirty(true); checkAch();
      }
      dirty();
    }
    function hurtHero(d) {
      if (hero.dead) return; H.hp -= d; hero.hurtT = .25; GK.sfx.hurt(); shake = Math.max(shake, 4);
      var p = scr(hero.x, hero.y - 50); S.float(p[0], p[1], '−' + Math.round(d), '#ff6a5a', 16);
      if (H.hp <= 0) die();
    }
    function die() {
      H.hp = 0; hero.dead = 2.8; st.stats.deaths++;
      var items = {}, any = false; Object.keys(st.inv).forEach(function (k) { if (st.inv[k] > 0) { items[k] = st.inv[k]; any = true; } });
      if (any) { st.bags.push({ x: hero.x, y: hero.y, items: items, at: Date.now() }); if (st.bags.length > 3) st.bags.shift(); }
      st.inv = {}; $('.rb-dead').hidden = false; GK.sfx.night(); dirty(true);
    }
    function respawn() { $('.rb-dead').hidden = true; hero.x = 0; hero.y = 150; H.hp = maxHp(); hero.dead = 0; enemies = enemies.filter(function (e) { return e.raid || e.boss && false; }); bossE = null; Object.keys(cells).forEach(function (k) { if (cells[k] && cells[k].live) cells[k].live = null; }); }

    /* ---------------- ресурсы */
    function give(k, n, x, y, force) {
      if (RES[k].item) { st.inv[k] = (st.inv[k] || 0) + n; return n; }
      var room = bagCap() - invN(), g = force ? n : Math.min(n, room);
      if (g <= 0) { if (Math.random() < .3) S.toast('Сумка полна. Вернитесь в лагерь, добыча сложится на склад', 'warn'); return 0; }
      st.inv[k] = (st.inv[k] || 0) + g; st.stats.gathered += g;
      if (x != null) { var p = scr(x, y - 40); S.float(p[0], p[1], '+' + g + ' ' + RES[k].n.toLowerCase(), RES[k].c === '#3a3a44' ? '#cfd6e0' : RES[k].c, 14); }
      dirty(); return g;
    }
    function storeN() { var n = 0; for (var k in st.store) if (!RES[k].item) n += st.store[k]; return n; }
    function deposit() {
      var room = storeCap() - storeN(), moved = 0, lines = [];
      Object.keys(st.inv).forEach(function (k) { if (RES[k].item || !st.inv[k]) return; var m = Math.min(st.inv[k], room); if (m <= 0) return; st.store[k] = (st.store[k] || 0) + m; st.inv[k] -= m; room -= m; moved += m; lines.push(m + ' ' + RES[k].n.toLowerCase()); if (!st.inv[k]) delete st.inv[k]; });
      if (moved) { S.toast('На склад: ' + lines.join(', '), 'ok'); GK.sfx.drop(); dirty(); }
      else if (invN() && room <= 0) S.toast('Склад лагеря полон. Улучшите склад', 'warn');
    }
    function has(cost) { for (var k in cost) { if (k === 'core') { if (!(st.cores[cost.core] > 0)) return false; continue; } if (cost[k] && (st.store[k] || 0) < cost[k]) return false; } return true; }
    function pay(cost) { for (var k in cost) { if (k === 'core') { st.cores[cost.core]--; continue; } if (cost[k]) st.store[k] -= cost[k]; } dirty(); }
    function costHtml(cost) { return '<span class="gk-cost">' + Object.keys(cost).filter(function (k) { return cost[k]; }).map(function (k) { if (k === 'core') { var ok = st.cores[cost.core] > 0; return '<span class="' + (ok ? '' : 'no') + '">⬢ ядро: ' + esc(BOSS[cost.core].n) + '</span>'; } var have = st.store[k] || 0; return '<span class="' + (have >= cost[k] ? '' : 'no') + '"><i style="background:' + RES[k].c + ';border-radius:4px"></i>' + esc(RES[k].n) + ' ' + fmt(cost[k]) + ' <small>(' + fmt(have) + ')</small></span>'; }).join('') + '</span>'; }
    function addXp(n) {
      H.xp += n;
      while (H.lvl < 40 && H.xp >= xpNeed(H.lvl)) { H.xp -= xpNeed(H.lvl); H.lvl++; H.hp = maxHp(); GK.sfx.up(); var p = scr(hero.x, hero.y - 70); S.float(p[0], p[1], 'Уровень ' + H.lvl + '!', '#7ae6ff', 22); fx.burst(hero.x, hero.y - 30, 24, { cols: ['#7ae6ff', '#ffd34d', '#fff'], spd: 180, g: 100, life: .9, r: 3 }); }
    }

    /* ---------------- умения */
    var CD = [7, 2, 2];
    function useSkill(i) {
      if (hero.dead || S.paused) return;
      if (st.skill[i] > 0) return;
      if (i === 0) {
        GK.sfx.skill(); hero.spin = .45; var n = 0;
        enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - hero.x, e.y - hero.y) < 120 + (e.size - 1) * 20) { hitEnemy(e, dmg() * 2.2, 'skill'); n++; } });
        fx.burst(hero.x, hero.y - 20, 30, { cols: ['#ffffff', '#cfe6ff', '#9fd0ff'], spd: 260, g: 0, life: .35, r: 3 });
      } else if (i === 1) {
        if (!(st.inv.medkit > 0)) { S.toast('Нет аптечек. Их делают в лаборатории лагеря', 'warn'); return; }
        if (H.hp >= maxHp()) { S.toast('Здоровье полное'); return; }
        st.inv.medkit--; H.hp = Math.min(maxHp(), H.hp + maxHp() * .45); GK.sfx.up(); fx.burst(hero.x, hero.y - 30, 18, { cols: ['#7ae68a', '#ffffff'], spd: 90, g: -60, life: .8, r: 3 }); dirty();
      } else {
        if (!(st.inv.grenade > 0)) { S.toast('Нет гранат. Их делают в лаборатории лагеря', 'warn'); return; }
        var t = nearestEnemy(380) || null, tx = t ? t.x : hero.x + hero.face * 160, ty = t ? t.y : hero.y;
        st.inv.grenade--; projs.push({ x: hero.x, y: hero.y - 20, tx: tx, ty: ty, t: 0, dur: .55, gren: true, z: 0 }); dirty();
      }
      st.skill[i] = CD[i];
    }
    $('.rb-skills').addEventListener('click', function (e) { var b = e.target.closest('[data-sk]'); if (b) useSkill(+b.dataset.sk); });
    function nearestEnemy(rad) { var best = null, bd = rad; enemies.forEach(function (e) { if (e.dead) return; var d = Math.hypot(e.x - hero.x, e.y - hero.y); if (d < bd) { bd = d; best = e; } }); return best; }

    /* ---------------- обновление мира */
    var shake = 0, spawnT = 0, uiT = 0, prodT = 0, raid = null, expT = 0;
    function isNight() { return st.t > DAY; }
    function update(dt) {
      clock += dt; if (shake > 0) shake = Math.max(0, shake - dt * 30);
      if (S.paused) { render(dt); return; }
      E.tick();
      for (var i = 0; i < 3; i++) if (st.skill[i] > 0) st.skill[i] = Math.max(0, st.skill[i] - dt);
      // день и ночь
      var wasNight = isNight(); st.t += dt; if (st.t >= DAY + NIGHT) st.t = 0;
      if (!wasNight && isNight()) startRaid(); if (wasNight && !isNight()) endRaid();
      if (hero.dead) { hero.dead -= dt; if (hero.dead <= 0) respawn(); render(dt); return; }
      // движение
      var d = I.dir(), sp = 200 * (H.hp < maxHp() * .25 ? .9 : 1);
      if (d.on) { hero.goal = null; hero.gather = null; hero.vx = d.x * sp; hero.vy = d.y * sp; }
      else if (hero.goal) { var gx = hero.goal.x - hero.x, gy = hero.goal.y - hero.y, gl = Math.hypot(gx, gy); if (gl < (hero.goal.r || 8)) { var gg = hero.goal; hero.goal = null; hero.vx = hero.vy = 0; if (gg.then) gg.then(); } else { hero.vx = gx / gl * sp; hero.vy = gy / gl * sp; } }
      else {
        // автобой: если враг рядом и агрессивен, подходим
        var en = nearestEnemy(230); hero.vx = hero.vy = 0;
        if (en && (en.state === 'chase' || en.raid)) { var ex = en.x - hero.x, ey = en.y - hero.y, el = Math.hypot(ex, ey); if (el > 46 + (en.size - 1) * 22) { hero.vx = ex / el * sp; hero.vy = ey / el * sp; } }
      }
      var nx = hero.x + hero.vx * dt, ny = hero.y + hero.vy * dt;
      if (!locked(nx, ny) && Math.hypot(nx, ny) < R_WORLD - 40) { hero.x = nx; hero.y = ny; }
      else if (locked(nx, ny)) { if (!hero.lockMsg || clock - hero.lockMsg > 3) { hero.lockMsg = clock; var sb = sector(nx, ny); S.toast(lockText(sb), 'warn'); } }
      // столкновения с ресурсами и постройками
      nearCells(hero.x, hero.y, 60, function (c) { if (c.k !== 'n' || depleted(c)) return; var r = NODES[c.t].r + 12, dx = hero.x - c.x, dy = hero.y - c.y, l = Math.hypot(dx, dy); if (l < r && l > .1) { hero.x = c.x + dx / l * r; hero.y = c.y + dy / l * r; } });
      Object.keys(BLD).forEach(function (k) { var B = BLD[k]; if (B.ring || !st.bld[k]) return; var r = 46, dx = hero.x - B.x, dy = hero.y - B.y, l = Math.hypot(dx, dy); if (l < r && l > .1) { hero.x = B.x + dx / l * r; hero.y = B.y + dy / l * r; } });
      var moving = Math.hypot(hero.vx, hero.vy) > 5; if (moving) { hero.walkT += dt; if (Math.abs(hero.vx) > 3) hero.face = hero.vx > 0 ? 1 : -1; if (Math.random() < dt * 3.5) GK.sfx.step(); }
      hero.moving = moving;
      // в лагере: склад, лечение
      var inCamp = Math.hypot(hero.x, hero.y) < R_CAMP - 20;
      if (inCamp && !hero.wasCamp && invN() > 0) deposit();
      if (inCamp && !isNight()) H.hp = Math.min(maxHp(), H.hp + maxHp() * .04 * dt);
      hero.wasCamp = inCamp;
      // мешки после падения
      st.bags = st.bags.filter(function (b) { if (Math.hypot(b.x - hero.x, b.y - hero.y) < 40) { var got = 0; Object.keys(b.items).forEach(function (k) { var g = give(k, b.items[k], null, null, true); got += g; }); S.toast('Мешок с добычей подобран', 'ok'); GK.sfx.pick(); dirty(true); return false; } return true; });
      // клетки спасённых
      CAGES.forEach(function (c) { if (st.saved[c.id] || locked(c.x, c.y)) return; if (Math.hypot(c.x - hero.x, c.y - hero.y) < 60 && !hero.cageAsk) { hero.cageAsk = c; } });
      if (hero.cageAsk && Math.hypot(hero.cageAsk.x - hero.x, hero.cageAsk.y - hero.y) > 80) hero.cageAsk = null;
      // атака
      hero.atkT -= dt; if (hero.swing > 0) hero.swing -= dt; if (hero.spin > 0) hero.spin -= dt; if (hero.hurtT > 0) hero.hurtT -= dt;
      var tgt = nearestEnemy(56 + 30);
      if (tgt) { var rr = 52 + (tgt.size - 1) * 24; if (Math.hypot(tgt.x - hero.x, tgt.y - hero.y) < rr && hero.atkT <= 0) { hero.atkT = .62; hero.swing = .22; hero.face = tgt.x > hero.x ? 1 : -1; hitEnemy(tgt, dmg() * (.9 + Math.random() * .2)); GK.sfx.hit(); } }
      // добыча: стоим рядом с ресурсом и нет врагов поблизости
      if (!tgt && !d.on) {
        var nd = null, nb = 999; nearCells(hero.x, hero.y, 70, function (c) { if (c.k !== 'n' || depleted(c)) return; var l = Math.hypot(c.x - hero.x, c.y - hero.y) - NODES[c.t].r; if (l < 30 && l < nb) { nb = l; nd = c; } });
        if (nd) {
          var N = NODES[nd.t], tier = TOOLS[st.tool].t;
          if (N.tier > tier) { if (hero.gather !== nd) { hero.gather = nd; S.toast('Нужен инструмент лучше: «' + TOOLS[N.tier - 1].n + '»', 'warn'); } }
          else {
            hero.gather = nd; hero.gT -= dt;
            if (hero.gT <= 0) {
              hero.gT = Math.max(.32, .7 - tier * .08); hero.swing = .2; hero.face = nd.x > hero.x ? 1 : -1;
              (N.res === 'wood' ? GK.sfx.chop : GK.sfx.mine)(); nd.shake = .15; fx.burst(nd.x, nd.y - 20, 4, { c: RES[N.res].c, spd: 90, g: 300, life: .4, r: 2.5 });
              nd.hp--;
              if (nd.hp <= 0) {
                if (invN() >= bagCap()) { nd.hp = 1; S.toast('Сумка полна. Вернитесь в лагерь', 'warn'); hero.gT = 1.2; }
                else if (!E.spend(1)) { nd.hp = 1; hero.gT = 1; if (!hero.enWarn || clock - hero.enWarn > 6) { hero.enWarn = clock; GK.noEnergy(S, E, st, 'добыча'); } }
                else { nd.hp = N.hp; nd.charges--; var a = N.amt[0] + Math.floor(Math.random() * (N.amt[1] - N.amt[0] + 1)) + (tier > N.tier ? 1 : 0); give(N.res, a, nd.x, nd.y); addXp(1); if (nd.charges <= 0) { st.dep[nd.key] = Date.now() + 240000; nd.charges = 3; fx.burst(nd.x, nd.y - 10, 12, { c: RES[N.res].c, spd: 140, life: .6 }); hero.gather = null; } checkAch(); }
              }
            }
          }
        } else hero.gather = null;
      }
      // враги
      enemies.forEach(function (e) { if (!e.dead) enemyAI(e, dt); });
      enemies = enemies.filter(function (e) { return !e.dead; });
      // снаряды
      projs.forEach(function (p) {
        p.t += dt; var k = Math.min(1, p.t / p.dur);
        p.x = p.sx == null ? (p.sx = p.x, p.x) : p.sx + (p.tx - p.sx) * k; p.y = p.sy == null ? (p.sy = p.y, p.y) : p.sy + (p.ty - p.sy) * k; p.z = Math.sin(k * PI) * (p.gren ? 70 : p.arc || 0);
        if (k >= 1) {
          p.done = true;
          if (p.gren) { GK.sfx.boom(); shake = 10; fx.burst(p.tx, p.ty, 34, { cols: ['#ffd34d', '#ff8a2b', '#5a4a3a'], spd: 260, g: 120, life: .6, r: 5 }); enemies.forEach(function (e) { if (Math.hypot(e.x - p.tx, e.y - p.ty) < 140) hitEnemy(e, dmg() * 3.5, 'skill'); }); }
          else if (p.tower) { if (p.e && !p.e.dead) hitEnemy(p.e, p.d); }
          else if (p.enemy && Math.hypot(hero.x - p.tx, hero.y - p.ty) < (p.aoe || 28)) hurtHero(p.d);
          if (p.enemy && p.aoe) fx.burst(p.tx, p.ty, 16, { c: p.c || '#9be03a', spd: 120, g: 0, life: .5, r: 4 });
        }
      });
      projs = projs.filter(function (p) { return !p.done; });
      // зоны атак боссов (сначала предупреждение, потом удар)
      aoes.forEach(function (a) { a.t += dt; if (!a.hit && a.t >= a.warn) { a.hit = true; if (Math.hypot(hero.x - a.x, hero.y - a.y) < a.r) hurtHero(a.d); shake = Math.max(shake, 8); GK.sfx.boom(); fx.burst(a.x, a.y, 20, { c: a.c, spd: 200, g: 0, life: .4, r: 4 }); } });
      aoes = aoes.filter(function (a) { return a.t < a.warn + .35; });
      // спавн
      spawnT -= dt; if (spawnT <= 0) { spawnT = 1.2; spawnAround(); }
      // башни
      towers(dt);
      if (raid) raidTick(dt);
      // производство лагеря
      prodT -= dt; if (prodT <= 0) { prodT = 5; produce(5 / 60); }
      // разведка
      expT -= dt; if (expT <= 0) { expT = .5; explore(hero.x, hero.y); }
      uiT -= dt; if (uiT <= 0) { uiT = .2; hud(); }
      tutor.update(); saver.tick();
      render(dt);
    }
    function lockText(b) {
      var B = BIOMES[b], prev = BIOMES[b - 1];
      if (!prev) return 'Сюда пока не пройти';
      var bossOk = st.beaten && st.beaten[prev.boss], protOk = st.bld[B.prot] > 0;
      return '«' + B.n + '» закрыт. Нужно: ' + (bossOk ? '' : 'победить босса «' + BOSS[prev.boss].n + '»' + (protOk ? '' : ' и ')) + (protOk ? '' : 'построить «' + BLD[B.prot].n + '»');
    }
    function enemyAI(e, dt) {
      var dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy), D = e.D;
      if (e.hurt > 0) e.hurt -= dt; e.atkT -= dt;
      if (e.raid) return raidAI(e, dt);
      var aggro = e.boss ? 520 : 240;
      if (hero.dead) e.state = 'home';
      else if (e.state === 'idle' && d < aggro) e.state = 'chase';
      if (e.state === 'chase' && (Math.hypot(e.x - e.sx, e.y - e.sy) > (e.boss ? 900 : 650) || Math.hypot(hero.x, hero.y) < R_CAMP)) e.state = 'home';
      var tx = e.sx, ty = e.sy, mv = 0;
      if (e.state === 'chase') {
        tx = hero.x; ty = hero.y;
        if (e.boss) bossSpecial(e, dt, d);
        if (e.charging) { e.x += e.cvx * dt; e.y += e.cvy * dt; e.charging -= dt; if (d < D.rng + 20 && !e.chit) { e.chit = 1; hurtHero(D.dmg * 1.6); } if (e.charging <= 0) e.charging = 0; e.walkT += dt * 2; return; }
        if (e.under) return;
        var want = D.ranged ? D.rng * .8 : D.rng * .85 * e.size;
        if (d > want) mv = 1; else if (D.ranged && d < D.rng * .45) mv = -1;
        if (d < D.rng * e.size + 6 && e.atkT <= 0) {
          e.atkT = D.ranged ? 1.6 : 1.05;
          if (D.ranged) projs.push({ x: e.x, y: e.y - 24, tx: hero.x, ty: hero.y, t: 0, dur: d / 320, enemy: true, d: e.dmg, c: e.t === 'imp' ? '#ff6a1f' : '#9fd0ff' });
          else { e.lunge = .2; hurtHero(e.dmg); }
        }
      } else if (e.state === 'home') { if (Math.hypot(e.x - e.sx, e.y - e.sy) < 10) { e.state = 'idle'; e.hp = Math.min(e.max, e.hp + e.max * .5); } else mv = 1; }
      else { // бродит
        e.wander = (e.wander || 0) - dt; if (e.wander <= 0) { e.wander = 2 + Math.random() * 3; e.wx = e.sx + (Math.random() - .5) * 140; e.wy = e.sy + (Math.random() - .5) * 140; }
        tx = e.wx; ty = e.wy; mv = Math.hypot(tx - e.x, ty - e.y) > 8 ? .4 : 0;
      }
      if (mv) { var vx = tx - e.x, vy = ty - e.y, l = Math.hypot(vx, vy) || 1, s = e.spd * mv * (e.state === 'home' ? 1.3 : 1) * dt; var nx = e.x + vx / l * s, ny = e.y + vy / l * s; if (!(Math.hypot(nx, ny) < R_CAMP + 20)) { e.x = nx; e.y = ny; } e.face = vx > 0 ? 1 : -1; e.walkT += dt; }
      if (e.lunge > 0) e.lunge -= dt;
    }
    function bossSpecial(e, dt, d) {
      e.spT -= dt; var D = e.D, enr = e.hp < e.max * .3 ? 1.5 : 1;
      if (!e.addsDone && e.hp < e.max * .5) { e.addsDone = 1; for (var i = 0; i < 3; i++) { var a = mkEnemy(D.adds, e.x + Math.cos(i * 2) * 80, e.y + Math.sin(i * 2) * 80, 1 + e.b * .5); a.state = 'chase'; enemies.push(a); } S.toast(D.n + ' зовёт подмогу!', 'warn'); }
      if (e.spT > 0) return; e.spT = (5.5 + Math.random() * 2) / enr;
      var sp = D.sp;
      if (sp === 'charge') { var l = d || 1; e.cvx = (hero.x - e.x) / l * 520; e.cvy = (hero.y - e.y) / l * 520; e.charging = .55; e.chit = 0; aoes.push({ x: hero.x, y: hero.y, r: 50, warn: .5, t: 0, d: 0, c: '#ff6a5a', line: [e.x, e.y] }); }
      else if (sp === 'slam') aoes.push({ x: e.x, y: e.y, r: 170, warn: 1.1, t: 0, d: D.dmg * 1.8, c: '#9aa0a8' });
      else if (sp === 'spit') { for (var k = 0; k < 3; k++) aoes.push({ x: hero.x + (Math.random() - .5) * 120, y: hero.y + (Math.random() - .5) * 120, r: 70, warn: 1 + k * .25, t: 0, d: D.dmg * 1.2, c: '#9be03a' }); }
      else if (sp === 'burrow') { e.under = 1.4; GK.sfx.boom(); setTimeout(function () { if (e.dead) return; e.x = hero.x; e.y = hero.y + 10; e.under = 0; }, 1300); aoes.push({ x: hero.x, y: hero.y, r: 110, warn: 1.3, t: 0, d: D.dmg * 1.9, c: '#c4a265' }); }
      else if (sp === 'throw') { projs.push({ x: e.x, y: e.y - 60, tx: hero.x, ty: hero.y, t: 0, dur: .9, enemy: true, d: D.dmg * 1.7, aoe: 70, arc: 120, c: '#cfefff', big: true }); aoes.push({ x: hero.x, y: hero.y, r: 70, warn: .9, t: 0, d: 0, c: '#9fe2ff' }); }
      else if (sp === 'ring') { [0, .5, 1].forEach(function (k) { aoes.push({ x: e.x, y: e.y, r: 120 + k * 90, warn: 1 + k * .45, t: 0, d: D.dmg * 1.4, c: '#ff6a1f', ring: true }); }); }
    }

    /* ---------------- ночные набеги */
    function startRaid() {
      GK.sfx.night(); var n = 3 + hqLvl() * 2 + Math.min(10, Math.floor(st.raids / 2)), dirs = Math.random() < .5 ? 1 : 2, a0 = Math.random() * PI * 2, list = [];
      var pool = ['raider'].concat(st.open.map(function (b) { return BIOMES[b].enemy[0]; }));
      for (var i = 0; i < n; i++) { var a = a0 + (i % dirs) * PI + (Math.random() - .5) * .5, t = pool[Math.floor(Math.random() * Math.min(pool.length, 1 + Math.floor(hqLvl() / 2)))]; var e = mkEnemy(t, Math.cos(a) * (R_CAMP + 340 + Math.random() * 120), Math.sin(a) * (R_CAMP + 340 + Math.random() * 120), .7 + hqLvl() * .15); e.raid = true; e.state = 'raid'; list.push(e); enemies.push(e); }
      raid = { n: n, left: n, stolen: 0 }; st.wallHp = wallMax();
      S.toast('Ночь. Мутанты идут на лагерь: ' + n + '. Башни и стены помогут', 'warn');
    }
    function wallMax() { return st.bld.wall * 260; }
    function raidAI(e, dt) {
      var d = Math.hypot(e.x, e.y), dh = Math.hypot(hero.x - e.x, hero.y - e.y);
      var tx = 0, ty = 0;
      if (dh < 160 && !hero.dead) { tx = hero.x; ty = hero.y; if (dh < e.D.rng + 6 && e.atkT <= 0) { e.atkT = 1.1; hurtHero(e.dmg); e.lunge = .2; return; } }
      else if (d < R_CAMP + 30 && d > R_CAMP - 30 && st.wallHp > 0) { if (e.atkT <= 0) { e.atkT = 1.2; st.wallHp -= e.dmg; e.lunge = .2; GK.sfx.chop(); if (st.wallHp <= 0) S.toast('Частокол прорван!', 'warn'); } return; }
      else if (d < 70) { stealOne(e); return; }
      var vx = tx - e.x, vy = ty - e.y, l = Math.hypot(vx, vy) || 1; e.x += vx / l * e.spd * .8 * dt; e.y += vy / l * e.spd * .8 * dt; e.face = vx > 0 ? 1 : -1; e.walkT += dt;
      if (e.lunge > 0) e.lunge -= dt;
    }
    function stealOne(e) {
      var ks = Object.keys(st.store).filter(function (k) { return !RES[k].item && st.store[k] > 5; }), k = ks[Math.floor(Math.random() * ks.length)];
      if (k) { var n = Math.ceil(st.store[k] * .06); st.store[k] -= n; raid.stolen += n; S.toast('Мутант утащил ' + n + ' ' + RES[k].n.toLowerCase(), 'warn'); }
      e.dead = true; e.fled = true; dirty();
    }
    function raidTick() {
      var alive2 = enemies.filter(function (e) { return e.raid && !e.dead; }).length;
      if (!alive2 && raid) { st.raids++; var rw = { scrap: 4 + hqLvl() * 3, food: 6 + hqLvl() * 2 }; Object.keys(rw).forEach(function (k) { st.store[k] = (st.store[k] || 0) + rw[k]; }); addXp(10 + hqLvl() * 6); S.toast('Набег отбит! Трофеи на складе: ' + rw.scrap + ' металлолома и ' + rw.food + ' еды', 'gold'); GK.sfx.win(); raid = null; dirty(true); checkAch(); }
    }
    function endRaid() { enemies.forEach(function (e) { if (e.raid) e.dead = true; }); if (raid) S.toast('Рассвет. Мутанты отступили'); raid = null; st.wallHp = wallMax(); }
    var twT = {};
    function towers(dt) {
      ['tw1', 'tw2', 'tw3', 'tw4'].forEach(function (k) {
        var l = st.bld[k]; if (!l) return; twT[k] = (twT[k] || 0) - dt; if (twT[k] > 0) return;
        var B = BLD[k], best = null, bd = 380; enemies.forEach(function (e) { if (e.dead || e.boss) return; var d = Math.hypot(e.x - B.x, e.y - B.y); if (d < bd) { bd = d; best = e; } });
        if (best) { twT[k] = 1.1 - l * .1; projs.push({ x: B.x, y: B.y - 70, tx: best.x, ty: best.y - 10, t: 0, dur: bd / 600, tower: true, e: best, d: 10 + l * 12 }); GK.tone(900, .04, { type: 'square', vol: .02 }); }
      });
    }

    /* ---------------- производство в лагере (и пока вас нет) */
    function workers() { return st.surv.filter(function (s) { return s !== st.comp; }); }
    function slotsOf(k) { return st.bld[k] || 0; }
    function assign() { // выжившие распределяются по производству
      var out = {}, pool = workers().length; ['saw', 'quarry', 'farm', 'recyc'].forEach(function (k) { out[k] = 0; });
      var order = ['farm', 'saw', 'quarry', 'recyc'], guard = 0;
      while (pool > 0 && guard++ < 50) { var placed = false; order.forEach(function (k) { if (pool > 0 && out[k] < slotsOf(k)) { out[k]++; pool--; placed = true; } }); if (!placed) break; }
      return out;
    }
    function produce(minutes, report) {
      var a = assign(), got = {}, room = storeCap() - storeN(), eat = workers().length * .5 * minutes, foodOk = (st.store.food || 0) >= eat;
      st.store.food = Math.max(0, (st.store.food || 0) - eat);
      Object.keys(PROD).forEach(function (k) {
        var n = a[k]; if (!n) return; var p = PROD[k], amt = p[1] * n * minutes * (1 + (st.bld[k] - 1) * .25) * (foodOk ? 1 : .5);
        if (k === 'recyc') { var can = Math.floor((st.store.scrap || 0) / 2); amt = Math.min(amt, can); st.store.scrap = (st.store.scrap || 0) - amt * 2; }
        amt = Math.min(amt, Math.max(0, room)); room -= amt;
        if (amt > 0) { st.store[p[0]] = (st.store[p[0]] || 0) + amt; got[p[0]] = (got[p[0]] || 0) + amt; }
      });
      Object.keys(st.store).forEach(function (k) { st.store[k] = Math.round(st.store[k] * 100) / 100; });
      if (report) return got;
      dirty();
    }
    function offline() {
      var away = Math.min(8 * 3600, (Date.now() - (st.lastAt || Date.now())) / 1000); if (away < 120 || !workers().length) return;
      var got = produce(away / 60, true), lines = Object.keys(got).filter(function (k) { return got[k] >= 1; }).map(function (k) { return '<div class="gk-it"><span class="ic" style="background:' + RES[k].c + '"></span><span class="t"><b>+' + fmt(got[k]) + ' ' + esc(RES[k].n.toLowerCase()) + '</b></span></div>'; });
      if (!lines.length) return;
      S.sheet('Пока вас не было', '<p class="gk-lead">Выжившие работали ' + GK.dur(away) + '. Всё сложено на склад лагеря.</p><div class="gk-list">' + lines.join('') + '</div><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Отлично</button></div>', { w: 380 });
      dirty(true);
    }

    /* ---------------- разведка карты */
    var EXP_N = 64, expBits = (function () { var a = new Uint8Array(EXP_N * EXP_N); var s = st.exp || ''; for (var i = 0; i < s.length && i * 4 < a.length; i++) { var v = parseInt(s[i], 16); for (var b = 0; b < 4; b++) a[i * 4 + b] = (v >> b) & 1; } return a; })();
    function explore(x, y) {
      var c = (R_WORLD * 2) / EXP_N, gi = Math.floor((x + R_WORLD) / c), gj = Math.floor((y + R_WORLD) / c), ch = false;
      for (var i = gi - 3; i <= gi + 3; i++) for (var j = gj - 3; j <= gj + 3; j++) { if (i < 0 || j < 0 || i >= EXP_N || j >= EXP_N) continue; if ((i - gi) * (i - gi) + (j - gj) * (j - gj) > 10) continue; var k = j * EXP_N + i; if (!expBits[k]) { expBits[k] = 1; ch = true; } }
      if (ch) { var s = ''; for (var q = 0; q < expBits.length; q += 4) s += (expBits[q] | expBits[q + 1] << 1 | expBits[q + 2] << 2 | expBits[q + 3] << 3).toString(16); st.exp = s; dirty(); }
    }
    function exploredPct() { var n = 0, t = 0, c = (R_WORLD * 2) / EXP_N; for (var j = 0; j < EXP_N; j++) for (var i = 0; i < EXP_N; i++) { var x = -R_WORLD + (i + .5) * c, y = -R_WORLD + (j + .5) * c; if (Math.hypot(x, y) > R_WORLD) continue; t++; if (expBits[j * EXP_N + i]) n++; } return Math.round(n / t * 100); }

    /* ================================================================ интерфейс */
    function achVal(a) { return a.k === 'bosses' ? Object.keys(st.beaten || {}).length : a.k === 'saved' ? Object.keys(st.saved).length : a.k === 'hq' ? st.bld.hq : a.k === 'raids' ? st.raids : a.k === 'explored' ? exploredPct() : a.k === 'weap' ? st.weap : a.k === 'lvl' ? H.lvl : st.stats[a.k] || 0; }
    function checkAch() {
      ACH.forEach(function (a) { if (!st.ach[a.id] && achVal(a) >= a.need) { st.ach[a.id] = 1; S.toast('Цель выполнена: «' + a.n + '»', 'gold'); GK.sfx.win(); } });
      var em = $('[data-rb="ach"] em'), n = ACH.filter(function (a) { return st.ach[a.id] === 1; }).length; em.hidden = !n; em.textContent = n;
    }
    function rating() { return Math.round(H.lvl * 10 + st.bld.hq * 50 + Object.keys(st.beaten || {}).length * 200 + st.stats.kills + st.raids * 15 + Object.keys(st.saved).length * 30); }
    function panelAch() {
      var c = S.sheet('Цели и рейтинг', '<div class="gk-it"><span class="ic">🏅</span><span class="t"><b>Рейтинг выжившего: ' + fmt(rating()) + '</b><small>Растёт за уровень героя, штаб, боссов, набеги и спасённых</small></span></div><div class="gk-list">' + ACH.map(function (a) {
        var v = Math.min(a.need, achVal(a)), s2 = st.ach[a.id];
        return '<div class="gk-it' + (s2 ? ' done' : '') + '"><span class="t"><b>' + (s2 ? '✓ ' : '') + esc(a.n) + '</b><small>' + esc(a.d) + '</small><div class="gk-bar"><i style="width:' + (v / a.need * 100) + '%"></i></div></span><span class="rb-n">' + fmt(v) + '/' + fmt(a.need) + '</span></div>';
      }).join('') + '</div><div class="gk-note">За первого и за всех шестерых боссов вы получите эксклюзивные рамки «Застава» и «Последний рубеж» для профиля магазина.</div>', { w: 460 });
      ACH.forEach(function (a) { if (st.ach[a.id] === 1) st.ach[a.id] = 2; }); checkAch();
    }
    function resRow(map, title) {
      var ks = Object.keys(map).filter(function (k) { return map[k] > 0 && !RES[k].item; });
      if (!ks.length) return '<p class="gk-note">' + title + ': пусто</p>';
      return '<div class="rb-res">' + ks.map(function (k) { return '<span><i style="background:' + RES[k].c + '"></i>' + esc(RES[k].n) + ' <b>' + fmt(map[k]) + '</b></span>'; }).join('') + '</div>';
    }
    function panelBag() {
      var inCamp = Math.hypot(hero.x, hero.y) < R_CAMP;
      var h = '<div class="gz-sub rb-sub">В сумке ' + invN() + ' из ' + bagCap() + '</div>' + resRow(st.inv, 'Сумка') + '<div class="rb-res"><span><i style="background:#ff5a6e"></i>Аптечки <b>' + (st.inv.medkit || 0) + '</b></span><span><i style="background:#6a7a4a"></i>Гранаты <b>' + (st.inv.grenade || 0) + '</b></span></div>' +
        '<div class="gz-sub rb-sub">Склад лагеря ' + fmt(storeN()) + ' из ' + fmt(storeCap()) + '</div>' + resRow(st.store, 'Склад') +
        (Object.keys(st.cores).some(function (k) { return st.cores[k] > 0; }) ? '<div class="rb-res">' + Object.keys(st.cores).filter(function (k) { return st.cores[k] > 0; }).map(function (k) { return '<span>⬢ ядро: ' + esc(BOSS[k].n) + ' <b>' + st.cores[k] + '</b></span>'; }).join('') + '</div>' : '') +
        (st.bags.length ? '<div class="gk-note">Мешков с добычей на карте: ' + st.bags.length + '. Они отмечены на карте.</div>' : '') +
        '<div class="gk-note">' + (inCamp ? 'Вы в лагере: добыча из сумки складывается на склад сама.' : 'Добыча попадёт на склад, когда вы вернётесь в лагерь.') + '</div>';
      S.sheet('Сумка и склад', h, { w: 440 });
    }
    function bldPanel(k) {
      var B = BLD[k], l = st.bld[k], max = l >= B.max, nl = l + 1, cost = max ? null : B.cost(nl), need = B.need ? B.need(nl) : 1, hqOk = k === 'hq' || hqLvl() >= need;
      var extra = '';
      if (k === 'bench' || k === 'forge' || k === 'lab') extra = l ? '<button class="gk-btn" id="rb-cr">Открыть: ' + B.n.toLowerCase() + '</button>' : '';
      if (PROD[k] && l) { var a = assign(); extra = '<div class="gk-note">Работают: ' + (a[k] || 0) + ' из ' + l + '. Даёт ' + RES[PROD[k][0]].n.toLowerCase() + ' каждую минуту, даже пока вас нет.</div>'; }
      if (k === 'store') extra = '<div class="gk-note">Сейчас: ' + fmt(storeN()) + ' из ' + fmt(storeCap()) + '</div>';
      if (k === 'wall' && l) extra = '<div class="gk-note">Прочность ' + wallMax() + '</div>';
      if (B.prot) { var bb = BIOMES[B.prot], prev = BIOMES[B.prot - 1]; extra = '<div class="gk-note">Открывает биом «' + esc(bb.n) + '» вместе с победой над боссом «' + esc(BOSS[prev.boss].n) + '».</div>'; }
      var c = S.sheet(B.n + (l ? (B.max > 1 ? ', уровень ' + l : '') : ''), '<p class="gk-lead">' + esc(B.d) + '</p>' + extra +
        (max ? '<div class="gz-info">' + (B.max > 1 ? 'Максимальный уровень' : 'Построено') + '</div>' : '<div class="gk-it"><span class="t"><b>' + (l ? 'Улучшить до ' + nl : 'Построить') + ' <small>(−4 энергии)</small></b>' + costHtml(cost) + (hqOk ? '' : '<small class="no">Нужен штаб ' + need + ' уровня</small>') + '</span><button class="gk-btn sm" id="rb-up"' + (has(cost) && hqOk ? '' : ' disabled') + '>' + (l ? 'Улучшить' : 'Построить') + '</button></div>'), { w: 420 });
      var up = c.querySelector('#rb-up'); if (up) up.addEventListener('click', function () { if (!E.spend(4)) { GK.noEnergy(S, E, st, 'стройка'); return; } pay(cost); st.bld[k]++; GK.sfx.build(); fx.burst(B.x, B.y - 30, 30, { cols: ['#ffd34d', '#fff', '#a0703c'], spd: 200, life: .7 }); shake = 5; if (k === 'hq') E.max = enMax(); if (k === 'wall') st.wallHp = wallMax(); if (B.prot) unlockCheck(); S.closeAll(); S.toast(B.n + (l ? ': уровень ' + st.bld[k] : ' построен'), 'ok'); dirty(true); checkAch(); });
      var cr = c.querySelector('#rb-cr'); if (cr) cr.addEventListener('click', function () { panelCraft(k); });
    }
    function unlockCheck() {
      BIOMES.forEach(function (B, i) { if (!i || biomeOpen(i)) return; var prev = BIOMES[i - 1]; if (st.beaten && st.beaten[prev.boss] && st.bld[B.prot] > 0) { st.open.push(i); S.toast('Открыт новый биом: «' + B.n + '»!', 'gold'); GK.sfx.win(); } });
    }
    function panelCamp() {
      var c = S.sheet('Лагерь', '<p class="gk-lead">Штаб ' + hqLvl() + ' уровня. Выживших: ' + st.surv.length + '. Нажмите на постройку, чтобы построить или улучшить её. В лагере можно и прямо нажимать на здания.</p><div class="gk-list">' + Object.keys(BLD).map(function (k) {
        var B = BLD[k], l = st.bld[k], max = l >= B.max, need = B.need ? B.need(l + 1) : 1;
        return '<button class="gk-it rb-bl" data-bl="' + k + '"><span class="ic">' + bldIcon(k) + '</span><span class="t"><b>' + esc(B.n) + (l ? (B.max > 1 ? ' · ур. ' + l : ' · есть') : '') + '</b><small>' + (max ? 'Максимум' : !l && hqLvl() < need ? 'Нужен штаб ' + need : esc(B.d)) + '</small></span></button>';
      }).join('') + '</div>', { w: 460 });
      c.querySelectorAll('[data-bl]').forEach(function (b) { b.addEventListener('click', function () { bldPanel(b.dataset.bl); }); });
    }
    function bldIcon(k) { var M = { hq: '🏕️', store: '📦', bench: '🛠️', saw: '🪵', quarry: '🪨', farm: '🌾', forge: '⚒️', recyc: '♻️', lab: '🧪', wall: '🧱', tw1: '🗼', tw2: '🗼', tw3: '🗼', tw4: '🗼', radio: '📡', filter: '🌬️', desal: '💧', heater: '🔥', cooler: '❄️' }; return '<span style="font-size:22px">' + (M[k] || '•') + '</span>'; }
    function panelCraft(at) {
      var tabs = [['bench', 'Верстак'], ['forge', 'Кузница'], ['lab', 'Лаборатория']];
      at = at || 'bench';
      var c = S.sheet('Крафт', '<div class="gk-tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" aria-selected="' + (t[0] === at) + '">' + t[1] + (st.bld[t[0]] ? ' · ' + st.bld[t[0]] : '') + '</button>'; }).join('') + '</div><div id="rb-tab"></div><div class="gk-note">Крафт стоит 2 энергии и берёт ресурсы со склада лагеря.</div>', { w: 480 });
      var tab = c.querySelector('#rb-tab');
      function row(kind, idx, it, cur) {
        var lvl = st.bld[it.at] || 0, okL = lvl >= it.lvl, owned = cur >= idx, next = cur === idx - 1;
        var stat = kind === 'w' ? 'Урон ' + it.dmg : kind === 'a' ? 'Здоровье +' + it.hp : kind === 't' ? 'Добывает: ' + toolRes(it.t) : kind === 'b' ? 'Вместимость ' + it.cap : it.d;
        var dis = !okL || !has(it.cost) || (!next && kind !== 'c');
        return '<div class="gk-it' + (owned && kind !== 'c' ? ' done' : '') + '"><span class="t"><b>' + esc(it.n) + (owned && kind !== 'c' ? ' ✓' : '') + '</b><small>' + stat + (okL ? '' : '. Нужен «' + BLD[it.at].n + '» ' + it.lvl + ' ур.') + '</small>' + (owned && kind !== 'c' ? '' : costHtml(it.cost)) + '</span>' + (owned && kind !== 'c' ? '' : '<button class="gk-btn sm" data-cr="' + kind + ':' + idx + '"' + (dis ? ' disabled' : '') + '>' + (kind === 'c' ? 'Создать' : next ? 'Создать' : 'Сначала прошлое') + '</button>') + '</div>';
      }
      function toolRes(t) { return Object.keys(NODES).filter(function (k) { return NODES[k].tier === t; }).map(function (k) { return RES[NODES[k].res].n.toLowerCase(); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '); }
      function show(k) {
        c.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === k)); });
        if (!st.bld[k]) { tab.innerHTML = '<p class="gk-lead">Сначала постройте «' + BLD[k].n + '» в лагере.</p><button class="gk-btn" id="rb-gob">К постройке</button>'; tab.querySelector('#rb-gob').addEventListener('click', function () { bldPanel(k); }); return; }
        var h = '<div class="gk-list">';
        WEAP.forEach(function (w, i) { if (w.at === k) h += row('w', i, w, st.weap); });
        ARMOR.forEach(function (w, i) { if (w.at === k) h += row('a', i, w, st.armor); });
        TOOLS.forEach(function (w, i) { if (w.at === k) h += row('t', i, w, st.tool); });
        BAGS.forEach(function (w, i) { if (w.at === k) h += row('b', i, w, st.bag); });
        CONS.forEach(function (w, i) { if (w.at === k) h += row('c', i, w, -1); });
        tab.innerHTML = h + '</div>';
        tab.querySelectorAll('[data-cr]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = b.dataset.cr.split(':'), kind = p[0], i = +p[1], it = (kind === 'w' ? WEAP : kind === 'a' ? ARMOR : kind === 't' ? TOOLS : kind === 'b' ? BAGS : CONS)[i];
            if (!has(it.cost)) return; if (!E.spend(2)) { GK.noEnergy(S, E, st, 'крафт'); return; }
            pay(it.cost);
            if (kind === 'w') st.weap = i; else if (kind === 'a') { st.armor = i; H.hp = maxHp(); } else if (kind === 't') st.tool = i; else if (kind === 'b') st.bag = i;
            else if (it.id === 'steel') st.store.steel = (st.store.steel || 0) + 1; else st.inv[it.id] = (st.inv[it.id] || 0) + 1;
            GK.sfx.build(); S.toast('Создано: ' + it.n, 'ok'); dirty(true); checkAch(); show(k);
          });
        });
      }
      c.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
      show(at);
    }
    function panelTeam() {
      var a = assign();
      var c = S.sheet('Отряд', '<p class="gk-lead">Выживших спасают из клеток в биомах (отмечены на карте). Они работают на лесопилке, каменоломне, ферме и переработке. Одного можно взять спутником: он ходит с вами и сражается.</p>' +
        (st.surv.length ? '<div class="gk-list">' + st.surv.map(function (s) { var comp = st.comp === s; return '<div class="gk-it"><span class="ic">' + (comp ? '🗡️' : '👷') + '</span><span class="t"><b>' + esc(s) + '</b><small>' + (comp ? 'Спутник в вылазках' : 'Работает в лагере') + '</small></span><button class="gk-btn sm' + (comp ? ' g' : '') + '" data-comp="' + esc(s) + '">' + (comp ? 'В лагерь' : 'Взять с собой') + '</button></div>'; }).join('') + '</div>' : '<div class="gz-info">Пока никого. Найдите клетку с выжившим в Мёртвом лесу.</div>') +
        '<div class="gk-note">Работа: лесопилка ' + (a.saw || 0) + ', каменоломня ' + (a.quarry || 0) + ', ферма ' + (a.farm || 0) + ', переработка ' + (a.recyc || 0) + '. Каждый ест 0,5 еды в минуту, без еды работают вдвое медленнее.</div>', { w: 440 });
      c.querySelectorAll('[data-comp]').forEach(function (b) { b.addEventListener('click', function () { var n = b.dataset.comp; st.comp = st.comp === n ? null : n; comp = st.comp ? mkComp() : null; dirty(true); panelTeam(); }); });
    }
    function panelHero() {
      var need = xpNeed(H.lvl);
      S.sheet('Герой', '<div class="gk-it"><span class="ic">🧑‍🚀</span><span class="t"><b>Уровень ' + H.lvl + '</b><div class="gk-bar"><i style="width:' + (H.xp / need * 100) + '%"></i></div><small>Опыт ' + fmt(H.xp) + ' из ' + fmt(need) + '. Каждый уровень: больше здоровья и урона</small></span></div>' +
        '<div class="gk-list"><div class="gk-it"><span class="t"><b>Здоровье ' + Math.round(H.hp) + ' / ' + maxHp() + '</b><small>Броня: ' + esc(ARMOR[st.armor].n) + '</small></span></div><div class="gk-it"><span class="t"><b>Урон ' + Math.round(dmg()) + '</b><small>Оружие: ' + esc(WEAP[st.weap].n) + '</small></span></div><div class="gk-it"><span class="t"><b>Инструмент: ' + esc(TOOLS[st.tool].n) + '</b><small>Уровень добычи ' + TOOLS[st.tool].t + ' из 4</small></span></div><div class="gk-it"><span class="t"><b>' + esc(BAGS[st.bag].n) + '</b><small>Вмещает ' + bagCap() + '</small></span></div></div>' +
        '<div class="gk-note">Побед: ' + fmt(st.stats.kills) + ', боссов: ' + Object.keys(st.beaten || {}).length + ' из 6, набегов отбито: ' + st.raids + ', разведано ' + exploredPct() + '% карты.</div>', { w: 420 });
    }
    function panelMap() {
      var c = S.sheet('Карта', '<canvas class="rb-map" width="640" height="640"></canvas><div class="rb-leg"><span><i style="background:#fff"></i>Вы</span><span><i style="background:#ffd34d"></i>Лагерь</span><span><i style="background:#ff5a6e"></i>Босс</span><span><i style="background:#7ae6ff"></i>Выживший</span><span><i style="background:#c99358"></i>Мешок</span></div>', { w: 520 });
      drawMap(c.querySelector('canvas'), 640, true);
    }
    function panelHelp() {
      S.sheet('Как играть', '<div class="gk-list">' + [['Движение', 'Джойстик слева, стрелки или WASD. Можно нажать на место на земле, герой пойдёт туда.'], ['Добыча', 'Подойдите к дереву, камню или другому ресурсу и стойте рядом: герой добывает сам. Каждая порция тратит 1 энергию.'], ['Бой', 'Герой атакует ближайшего врага сам. Умения справа: «Вихрь», аптечка и граната.'], ['Лагерь', 'Добыча складывается на склад, когда вы возвращаетесь. Стройте и улучшайте здания, создавайте снаряжение.'], ['Биомы', 'Чтобы пройти в следующий биом, победите босса текущего и постройте в лагере защиту.'], ['Ночь', 'Ночью мутанты нападают на лагерь. Частокол и башни помогут.'], ['Падение', 'Если герой упал, вся добыча из сумки останется мешком на месте. Вернитесь и заберите её.']]
        .map(function (r) { return '<div class="gk-it"><span class="t"><b>' + r[0] + '</b><small>' + r[1] + '</small></span></div>'; }).join('') + '</div><button class="gk-btn g" id="rb-tut">Пройти обучение заново</button>', { w: 460 })
        .querySelector('#rb-tut').addEventListener('click', function () { st.tut = 0; tutor.i = 0; tutor.shown = -1; S.closeAll(); });
    }
    S.onhelp = panelHelp;
    S.root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rb]'); if (!b) return; GK.sfx.click();
      var k = b.dataset.rb;
      if (k === 'bag') panelBag(); else if (k === 'camp') panelCamp(); else if (k === 'craft') panelCraft(); else if (k === 'team') panelTeam(); else if (k === 'ach') panelAch(); else if (k === 'hero') panelHero(); else if (k === 'map') panelMap();
    });
    var actBtn = $('.rb-act'); actBtn.addEventListener('click', function () { if (actBtn._fn) actBtn._fn(); });
    function freeCage(c) {
      if (!E.spend(2)) { GK.noEnergy(S, E, st, 'освободить выжившего'); return; }
      var name = SURV[c.id % SURV.length]; st.saved[c.id] = 1; st.surv.push(name); hero.cageAsk = null; GK.sfx.win(); fx.burst(c.x, c.y - 30, 30, { cols: ['#7ae6ff', '#ffd34d', '#fff'], spd: 200, life: .8 });
      S.toast(name + ' спасён(а) и идёт в лагерь работать', 'gold'); dirty(true); checkAch();
    }

    /* ---------------- касания */
    I.onTap = function (sx, sy) {
      if (S.paused || hero.dead) return;
      var w = world(sx, sy);
      // постройки лагеря
      var hitB = null; Object.keys(BLD).forEach(function (k) { var B = BLD[k]; if (B.ring) { var r = Math.hypot(w[0], w[1]); if (Math.abs(r - R_CAMP) < 26 && Math.abs(Math.atan2(w[1], w[0]) + PI / 2) < .25) hitB = k; return; } if (Math.hypot(w[0] - B.x, w[1] - (B.y - 30)) < 60) hitB = k; });
      if (hitB) { var B = BLD[hitB]; hero.goal = { x: B.x, y: B.y + 60, r: 70, then: function () { bldPanel(hitB); } }; if (Math.hypot(hero.x - B.x, hero.y - B.y) < 140) { hero.goal = null; bldPanel(hitB); } return; }
      var cg = CAGES.filter(function (c) { return !st.saved[c.id] && Math.hypot(w[0] - c.x, w[1] - (c.y - 20)) < 50; })[0];
      if (cg) { hero.goal = { x: cg.x, y: cg.y + 30, r: 40, then: function () { freeCage(cg); } }; return; }
      // по ресурсу: подойти и добывать
      var nd = null; nearCells(w[0], w[1], 60, function (c) { if (c.k === 'n' && !depleted(c) && Math.hypot(c.x - w[0], c.y - 20 - w[1]) < NODES[c.t].r + 24) nd = c; });
      if (nd) { var dx = hero.x - nd.x, dy = hero.y - nd.y, l = Math.hypot(dx, dy) || 1; hero.goal = { x: nd.x + dx / l * (NODES[nd.t].r + 16), y: nd.y + dy / l * (NODES[nd.t].r + 16), r: 6 }; return; }
      hero.goal = { x: w[0], y: w[1], r: 8 }; tapMark = { x: w[0], y: w[1], t: 0 };
    };
    I.onKeyMove = function () { hero.goal = null; };
    var tapMark = null;

    /* ---------------- спутник */
    var comp = st.comp ? mkComp() : null;
    function mkComp() { return { x: hero.x - 40, y: hero.y + 20, face: 1, walkT: 0, atkT: 0, swing: 0 }; }
    function compTick(dt) {
      if (!comp) return; if (hero.dead) { comp.x = hero.x - 40; comp.y = hero.y + 20; return; }
      var t = nearestEnemy(260), tx = hero.x - 46 * hero.face, ty = hero.y + 18;
      if (t) { tx = t.x - 30; ty = t.y; }
      var dx = tx - comp.x, dy = ty - comp.y, l = Math.hypot(dx, dy);
      if (l > 12) { var s = Math.min(l, 210 * dt); comp.x += dx / l * s; comp.y += dy / l * s; comp.walkT += dt; comp.face = dx > 0 ? 1 : -1; comp.moving = true; } else comp.moving = false;
      if (Math.hypot(comp.x - hero.x, comp.y - hero.y) > 500) { comp.x = hero.x - 40; comp.y = hero.y + 20; }
      comp.atkT -= dt; if (comp.swing > 0) comp.swing -= dt;
      if (t && Math.hypot(t.x - comp.x, t.y - comp.y) < 56 && comp.atkT <= 0) { comp.atkT = .9; comp.swing = .2; hitEnemy(t, dmg() * .4); }
    }

    /* ---------------- обучение */
    var tutor = GK.tutor(S, [
      { id: 'hi', t: 'Мир после катастрофы. Это ваш лагерь, последний рубеж. Пора выживать.', ok: 'Начнём', top: true },
      { id: 'move', t: 'Идите из лагеря к деревьям: джойстик слева, стрелки или нажатие на землю.', at: function () { return nearestNodeScr('wood'); }, done: function () { return Math.hypot(hero.x, hero.y) > R_CAMP + 20 || (st.inv.wood || 0) > 0; } },
      { id: 'wood', t: 'Встаньте рядом с деревом: герой рубит сам. Наберите 6 единиц дерева.', at: function () { return nearestNodeScr('wood'); }, done: function () { return (st.inv.wood || 0) + (st.store.wood || 0) >= 46 || st.bld.bench > 0; } },
      { id: 'stone', t: 'Теперь камень: 4 штуки.', at: function () { return nearestNodeScr('stone'); }, done: function () { return (st.inv.stone || 0) + (st.store.stone || 0) >= 34 || st.bld.bench > 0; } },
      { id: 'home', t: 'Вернитесь в лагерь: добыча сама сложится на склад.', at: function () { return scr(0, 60); }, done: function () { return !invN(); } },
      { id: 'bench', t: 'Нажмите на место верстака и постройте его.', at: function () { return scr(BLD.bench.x, BLD.bench.y - 20); }, done: function () { return st.bld.bench > 0; } },
      { id: 'axe', t: 'Откройте верстак и создайте топор: он бьёт сильнее дубины. Не хватает ресурсов? Принесите ещё.', at: function () { return scr(BLD.bench.x, BLD.bench.y - 20); }, done: function () { return st.weap >= 1; } },
      { id: 'fight', t: 'Мутанты бродят за пределами лагеря. Подойдите к врагу: герой атакует сам.', at: function () { var e = nearestEnemy(1200); return e ? scr(e.x, e.y - 30) : null; }, done: function () { return st.stats.kills >= 1; } },
      { id: 'skill', t: 'Попробуйте умение «Вихрь»: бьёт всех врагов рядом.', at: function () { var b = $('[data-sk="0"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, done: function () { return st.skill[0] > 0; } },
      { id: 'end', t: 'Отлично! Цель: найти Вожака стаи на севере леса (значок на карте). Стройте лагерь, спасайте выживших и готовьтесь к ночи.', ok: 'Вперёд', top: true }
    ], st, function () { dirty(true); });
    function nearestNodeScr(res) { var best = null, bd = 1e9; nearCells(hero.x, hero.y, 700, function (c) { if (c.k === 'n' && !depleted(c) && NODES[c.t].res === res && !locked(c.x, c.y)) { var d = Math.hypot(c.x - hero.x, c.y - hero.y); if (d < bd) { bd = d; best = c; } } }); return best ? scr(best.x, best.y - 30) : null; }

    /* ---------------- сохранение */
    var saver = GK.saver(ctx, S, function () { H.x = hero.x; H.y = hero.y; st.lastAt = Date.now(); var now = Date.now(); Object.keys(st.dep).forEach(function (k) { if (st.dep[k] < now) delete st.dep[k]; }); Object.keys(st.kills).forEach(function (k) { if (st.kills[k] < now) delete st.kills[k]; }); return st; }, ctx.onUser);
    function dirty(now) { saver.mark(); if (now) saver.flush(); }

    /* ================================================================ рисование */
    var cam = { x: hero.x, y: hero.y, z: 1 };
    function scr(x, y) { return [(x - cam.x) * cam.z + S.w / 2, (y - cam.y) * cam.z + S.h / 2]; }
    function world(sx, sy) { return [(sx - S.w / 2) / cam.z + cam.x, (sy - S.h / 2) / cam.z + cam.y]; }
    function fitZoom() { cam.z = clamp(Math.min(S.w, S.h * 1.3) / 900, .6, 1.15); }
    fitZoom(); S.onresize = fitZoom;
    var chunks = {}, chunkList = [];
    function chunk(ci, cj) {
      var k = ci + ',' + cj; if (chunks[k]) return chunks[k];
      var c = document.createElement('canvas'), dpr = Math.min(2, S.dpr) * cam.z; c.width = c.height = Math.ceil(CHUNK * dpr); var x = c.getContext('2d'); x.scale(dpr, dpr);
      var ox = ci * CHUNK, oy = cj * CHUNK, T = 32;
      for (var i = 0; i < CHUNK / T; i++) for (var j = 0; j < CHUNK / T; j++) {
        var wx = ox + i * T + T / 2, wy = oy + j * T + T / 2, r = Math.hypot(wx, wy), b = r < R_CAMP + 60 ? -1 : sector(wx, wy);
        var col = r > R_WORLD ? '#1b1d22' : b < 0 ? (r < R_CAMP - 10 ? '#7b8a55' : '#6b7d48') : BIOMES[b].g;
        x.fillStyle = col; x.fillRect(i * T, j * T, T + .5, T + .5);
        var hv = hash(i + ci * 99, j + cj * 99, 9); if (r <= R_WORLD && hv > .55) { x.fillStyle = hv > .8 ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)'; x.fillRect(i * T, j * T, T + .5, T + .5); }
      }
      // пятна и декор
      var rng = GK.rng((ci * 7919 + cj * 104729) >>> 0);
      for (var n = 0; n < 34; n++) {
        var px = rng() * CHUNK, py = rng() * CHUNK, wx2 = ox + px, wy2 = oy + py, r2 = Math.hypot(wx2, wy2); if (r2 > R_WORLD) continue;
        var b2 = r2 < R_CAMP + 60 ? -1 : sector(wx2, wy2), rr = 10 + rng() * 40;
        x.globalAlpha = .18; x.fillStyle = b2 === 5 ? '#1e1514' : b2 === 4 ? '#c9d6e4' : b2 === 3 ? '#a8854a' : b2 === 2 ? '#3a4628' : b2 === 1 ? '#555652' : '#3f6230';
        x.beginPath(); x.ellipse(px, py, rr, rr * .6, 0, 0, PI * 2); x.fill(); x.globalAlpha = 1;
        var dk = rng();
        if (b2 === 0 || b2 === -1) { if (dk < .5) { x.strokeStyle = b2 < 0 ? '#5f7a3a' : '#3d6229'; x.lineWidth = 1.6; for (var g = 0; g < 4; g++) { x.beginPath(); x.moveTo(px + g * 3, py); x.lineTo(px + g * 3 + (rng() - .5) * 4, py - 7 - rng() * 5); x.stroke(); } } }
        else if (b2 === 1) { if (dk < .4) { x.strokeStyle = 'rgba(40,40,40,.35)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 20, py + 6); x.lineTo(px + 28, py - 4); x.stroke(); } }
        else if (b2 === 2) { if (dk < .35) { x.fillStyle = 'rgba(122,208,74,.45)'; x.beginPath(); x.ellipse(px, py, 18, 9, 0, 0, PI * 2); x.fill(); x.fillStyle = 'rgba(200,255,140,.5)'; x.beginPath(); x.arc(px - 4, py - 2, 2, 0, PI * 2); x.fill(); } }
        else if (b2 === 3) { if (dk < .4) { x.strokeStyle = 'rgba(140,100,50,.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px - 14, py); x.quadraticCurveTo(px, py - 5, px + 14, py); x.stroke(); } }
        else if (b2 === 4) { if (dk < .4) { x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(px, py, 12, 5, 0, 0, PI * 2); x.fill(); } }
        else if (b2 === 5) { if (dk < .45) { x.strokeStyle = 'rgba(255,106,31,.75)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 10, py + 8); x.lineTo(px + 22, py + 4); x.lineTo(px + 30, py + 12); x.stroke(); } }
      }
      chunks[k] = c; chunkList.push(k); if (chunkList.length > 40) { delete chunks[chunkList.shift()]; }
      return c;
    }
    function outline(fill, w) { cx.fillStyle = fill; cx.fill(); cx.lineWidth = w || 2; cx.strokeStyle = 'rgba(25,20,18,.85)'; cx.stroke(); }
    function ell(x, y, rx, ry) { cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, PI * 2); }
    function drawNode(c) {
      var p = scr(c.x, c.y), N = NODES[c.t], sk = c.shake > 0 ? Math.sin(clock * 80) * 2 : 0; if (c.shake > 0) c.shake -= 1 / 60;
      cx.save(); cx.translate(p[0] + sk, p[1]); cx.scale(cam.z, cam.z);
      GK.shadow(cx, 0, 2, N.r * 1.1, N.r * .45, .28);
      var t = c.t, B = c.b;
      if (t === 'tree' || t === 'swtree') { cx.beginPath(); cx.rect(-5, -26, 10, 26); outline('#6a4a2e'); var col = t === 'swtree' ? '#5a6a3a' : B === 0 ? '#3f6b2e' : '#4a7a3a'; [[0, -46, 22], [-12, -36, 15], [12, -36, 15], [0, -60, 15]].forEach(function (q) { ell(q[0], q[1], q[2], q[2] * .85); outline(col); }); ell(-5, -52, 6, 4); cx.fillStyle = 'rgba(255,255,255,.15)'; cx.fill(); }
      else if (t === 'pine') { cx.beginPath(); cx.rect(-4, -18, 8, 18); outline('#6a4a2e'); [[-20, -14, -50], [-16, -32, -66], [-12, -48, -78]].forEach(function (q) { cx.beginPath(); cx.moveTo(q[0], q[1]); cx.lineTo(-q[0], q[1]); cx.lineTo(0, q[2]); cx.closePath(); outline('#2f6a4a'); }); cx.fillStyle = '#f2f6fa'; cx.beginPath(); cx.moveTo(-8, -66); cx.lineTo(8, -66); cx.lineTo(0, -78); cx.fill(); }
      else if (t === 'deadtree') { cx.lineCap = 'round'; cx.strokeStyle = 'rgba(25,20,18,.85)'; cx.lineWidth = 9; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(0, -40); cx.moveTo(0, -24); cx.lineTo(-14, -40); cx.moveTo(0, -32); cx.lineTo(12, -50); cx.stroke(); cx.strokeStyle = '#5a4a3e'; cx.lineWidth = 5; cx.stroke(); }
      else if (t === 'rock' || t === 'rubble') { cx.beginPath(); cx.moveTo(-20, 0); cx.lineTo(-16, -16); cx.lineTo(-4, -24); cx.lineTo(12, -20); cx.lineTo(20, -6); cx.lineTo(16, 2); cx.closePath(); outline(t === 'rubble' ? '#8a8a84' : B === 4 ? '#9aa6b4' : B === 5 ? '#4a3a38' : '#8f969e'); cx.beginPath(); cx.moveTo(-10, -16); cx.lineTo(-2, -20); cx.lineTo(4, -12); cx.closePath(); cx.fillStyle = 'rgba(255,255,255,.2)'; cx.fill(); if (B === 4) { cx.fillStyle = '#fff'; ell(0, -22, 12, 4); cx.fill(); } if (t === 'rubble') { cx.fillStyle = '#b5523a'; cx.fillRect(6, -14, 8, 5); } }
      else if (t === 'bush' || t === 'cactus') { if (t === 'cactus') { cx.beginPath(); GK.rr(cx, -6, -40, 12, 40, 6); outline('#4a8a4a'); cx.beginPath(); GK.rr(cx, -18, -28, 8, 16, 4); outline('#4a8a4a'); cx.beginPath(); GK.rr(cx, 10, -32, 8, 18, 4); outline('#4a8a4a'); cx.fillStyle = '#ff7a9a'; ell(0, -42, 4, 3); cx.fill(); } else { ell(0, -10, 16, 12); outline('#3f7a3a'); for (var i = 0; i < 5; i++) { cx.fillStyle = '#e0574f'; ell(-9 + i * 4.5, -10 + (i % 2) * 6, 2.6, 2.6); cx.fill(); } } }
      else if (t === 'herbp') { for (var k2 = 0; k2 < 5; k2++) { cx.save(); cx.rotate(-.6 + k2 * .3); ell(0, -10, 3.5, 10); outline('#5fc06a', 1.5); cx.restore(); } cx.fillStyle = '#fff6a8'; ell(0, -18, 2.5, 2.5); cx.fill(); }
      else if (t === 'scrapp') { cx.beginPath(); cx.moveTo(-24, 0); cx.lineTo(-18, -14); cx.lineTo(-4, -20); cx.lineTo(16, -16); cx.lineTo(24, 0); cx.closePath(); outline('#6a7280'); cx.beginPath(); cx.rect(-14, -26, 16, 10); outline('#a05a3a', 1.5); cx.beginPath(); cx.arc(10, -18, 6, 0, PI * 2); outline('#3a3f48', 1.5); cx.strokeStyle = '#9aa4b4'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-6, -8); cx.lineTo(8, -4); cx.stroke(); }
      else if (t === 'pod') { ell(0, -12, 13, 12); outline('#7ab03a'); ell(-4, -16, 4, 3); cx.fillStyle = 'rgba(230,255,180,.7)'; cx.fill(); var gl = .5 + Math.sin(clock * 3 + c.x) * .2; cx.fillStyle = 'rgba(155,224,58,' + gl * .4 + ')'; ell(0, -12, 20, 18); cx.fill(); }
      else if (t === 'quartzp' || t === 'iceb' || t === 'obsid') { var cc = t === 'quartzp' ? '#f2d38a' : t === 'iceb' ? '#9fe2ff' : '#5a3a7a'; [[-8, 0, 7, 26], [6, 0, 8, 34], [0, 2, 6, 20]].forEach(function (q) { cx.beginPath(); cx.moveTo(q[0] - q[2], q[1]); cx.lineTo(q[0] - q[2] * .6, q[1] - q[3]); cx.lineTo(q[0], q[1] - q[3] - 6); cx.lineTo(q[0] + q[2] * .6, q[1] - q[3]); cx.lineTo(q[0] + q[2], q[1]); cx.closePath(); outline(cc); cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(q[0] - 1, q[1] - q[3], 2, q[3] - 4); }); }
      else if (t === 'barrel') { cx.beginPath(); GK.rr(cx, -11, -30, 22, 30, 4); outline('#3a5a8a'); cx.fillStyle = '#1b1d22'; cx.fillRect(-11, -22, 22, 3); cx.fillRect(-11, -10, 22, 3); cx.fillStyle = '#ffd34d'; cx.font = '800 10px sans-serif'; cx.textAlign = 'center'; cx.fillText('☢', 0, -12); }
      else if (t === 'vent') { ell(0, -6, 16, 8); outline('#3a2a28'); ell(0, -6, 8, 4); cx.fillStyle = '#ffe14a'; cx.fill(); var vy = (clock * 30 + c.x) % 30; cx.fillStyle = 'rgba(255,225,74,' + (1 - vy / 30) * .5 + ')'; ell(0, -10 - vy, 6 + vy * .2, 4 + vy * .1); cx.fill(); }
      // полоска прочности при добыче
      if (hero.gather === c) { var k3 = c.hp / N.hp; cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(-16, 6, 32, 5); cx.fillStyle = '#ffd34d'; cx.fillRect(-16, 6, 32 * (1 - k3 + 1 / N.hp), 5); }
      cx.restore();
    }
    function drawDecor(c) {
      var p = scr(c.x, c.y); cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z, cam.z); var b = c.b;
      if (b === 1) { cx.beginPath(); cx.rect(-30, -40, 60, 40); outline('#7a7470'); cx.fillStyle = '#3a3a3c'; for (var i = 0; i < 3; i++) cx.fillRect(-24 + i * 18, -32, 10, 12); cx.fillStyle = 'rgba(25,20,18,.85)'; cx.beginPath(); cx.moveTo(-30, -40); cx.lineTo(-18, -52); cx.lineTo(0, -40); cx.fill(); }
      else if (b === 3) { cx.fillStyle = '#e8e2d4'; ell(0, -4, 14, 6); cx.fill(); cx.strokeStyle = '#c9c0a8'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-8, -4); cx.lineTo(-14, -14); cx.moveTo(4, -4); cx.lineTo(10, -16); cx.stroke(); }
      else if (b === 4) { cx.beginPath(); cx.moveTo(-18, 0); cx.lineTo(0, -16); cx.lineTo(18, 0); cx.closePath(); outline('#ffffff', 1.5); }
      else if (b === 5) { cx.fillStyle = 'rgba(255,90,20,.25)'; ell(0, 0, 24, 10); cx.fill(); cx.fillStyle = '#ff6a1f'; ell(0, 0, 12, 5); cx.fill(); cx.fillStyle = '#ffd34d'; ell(0, 0, 5, 2); cx.fill(); }
      else if (b === 2) { cx.strokeStyle = '#3a4a2a'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(-6, -24); cx.moveTo(4, 0); cx.lineTo(4, -30); cx.stroke(); cx.fillStyle = '#6a4a2e'; ell(-6, -26, 3, 7); cx.fill(); ell(4, -32, 3, 7); cx.fill(); }
      else { cx.fillStyle = '#5a7a3a'; ell(0, -4, 10, 6); cx.fill(); }
      cx.restore();
    }
    function drawChar(o, opt) {
      var p = scr(o.x, o.y), bob = o.moving ? Math.abs(Math.sin(o.walkT * 11)) * 2.5 : Math.sin(clock * 2) * .8, sw = o.moving ? Math.sin(o.walkT * 11) * 5 : 0;
      cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z * o.face, cam.z);
      GK.shadow(cx, 0, 1, 16, 6, .3);
      if (opt.hurt) { cx.globalAlpha = .65; }
      // ноги
      cx.lineCap = 'round'; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 7; cx.beginPath(); cx.moveTo(-5, -14); cx.lineTo(-5 + sw * .6, 0); cx.moveTo(5, -14); cx.lineTo(5 - sw * .6, 0); cx.stroke();
      cx.strokeStyle = opt.legs; cx.lineWidth = 4.5; cx.stroke();
      // рюкзак
      cx.beginPath(); GK.rr(cx, -17, -40 - bob, 10, 20, 4); outline(opt.pack || '#7a5a3a');
      // тело
      cx.beginPath(); GK.rr(cx, -11, -42 - bob, 22, 28, 8); outline(opt.body);
      cx.fillStyle = 'rgba(255,255,255,.12)'; cx.fillRect(-9, -40 - bob, 6, 24);
      // голова с капюшоном и противогазом
      cx.beginPath(); cx.arc(0, -52 - bob, 12, 0, PI * 2); outline(opt.hood);
      cx.beginPath(); GK.rr(cx, -3, -58 - bob, 13, 12, 5); outline(opt.face || '#d8b48a', 1.6);
      if (opt.mask) { cx.beginPath(); cx.arc(9, -50 - bob, 4.5, 0, PI * 2); outline('#4a5262', 1.5); cx.fillStyle = '#9fe2ff'; cx.fillRect(3, -56 - bob, 6, 3); }
      else { cx.fillStyle = '#1b1d22'; cx.fillRect(5, -55 - bob, 2.5, 2.5); }
      // оружие
      var sa = o.swing > 0 ? -1.6 + (o.swing / .22) * 2.2 : .5, spin = o.spin > 0;
      cx.save(); cx.translate(10, -32 - bob); cx.rotate(spin ? clock * 30 : sa);
      cx.lineWidth = 5; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(0, -28); cx.stroke(); cx.lineWidth = 3; cx.strokeStyle = opt.weapon || '#8a6a40'; cx.stroke();
      if (opt.blade) { cx.beginPath(); cx.moveTo(-2, -20); cx.lineTo(9, -30); cx.lineTo(2, -34); cx.closePath(); outline(opt.blade, 1.5); }
      cx.restore();
      if (o.swing > 0) { cx.strokeStyle = 'rgba(255,255,255,' + (o.swing / .22) * .7 + ')'; cx.lineWidth = 3; cx.beginPath(); cx.arc(8, -32, 34, -1.8, .4); cx.stroke(); }
      cx.restore();
      if (spin) { cx.save(); cx.translate(p[0], p[1] - 24 * cam.z); cx.strokeStyle = 'rgba(207,230,255,' + o.spin * 1.6 + ')'; cx.lineWidth = 4; cx.beginPath(); cx.ellipse(0, 0, 110 * cam.z, 44 * cam.z, 0, 0, PI * 2); cx.stroke(); cx.restore(); }
    }
    function drawEnemy(e) {
      if (e.under) { var pu = scr(e.x, e.y); cx.fillStyle = 'rgba(120,90,50,.5)'; cx.beginPath(); cx.ellipse(pu[0], pu[1], 40 * cam.z, 14 * cam.z, 0, 0, PI * 2); cx.fill(); return; }
      var p = scr(e.x, e.y), D = e.D, s = e.size * cam.z, bob = Math.sin(e.walkT * 10) * 2, ln = e.lunge > 0 ? 8 : 0;
      cx.save(); cx.translate(p[0], p[1]); cx.scale(s * e.face, s);
      GK.shadow(cx, 0, 1, 18, 6, .3);
      var col = e.hurt > 0 ? '#ffffff' : D.c;
      cx.translate(ln, 0);
      if (D.shape === 'quad') {
        cx.lineCap = 'round'; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 5; var lg = Math.sin(e.walkT * 12) * 5;
        cx.beginPath(); cx.moveTo(-12, -10); cx.lineTo(-12 + lg, 0); cx.moveTo(-4, -10); cx.lineTo(-4 - lg, 0); cx.moveTo(8, -10); cx.lineTo(8 + lg, 0); cx.moveTo(14, -10); cx.lineTo(14 - lg, 0); cx.stroke();
        ell(0, -16 + bob * .5, 20, 10); outline(col); cx.beginPath(); cx.moveTo(-18, -18); cx.lineTo(-28, -26 + bob); cx.lineWidth = 4; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.stroke();
        ell(20, -22 + bob * .5, 10, 8); outline(col); cx.beginPath(); cx.moveTo(14, -28); cx.lineTo(16, -36); cx.lineTo(20, -29); outline(col, 1.5);
        cx.fillStyle = '#ff3d1f'; ell(24, -24 + bob * .5, 2.2, 2.2); cx.fill(); cx.fillStyle = '#fff'; cx.fillRect(26, -19 + bob * .5, 4, 2);
      } else if (D.shape === 'blob') {
        var sq = 1 + Math.sin(e.walkT * 8) * .08; cx.save(); cx.scale(1 / sq, sq); ell(0, -16, 20, 16); outline(col); cx.restore();
        cx.fillStyle = 'rgba(255,255,255,.25)'; ell(-6, -24, 6, 4); cx.fill(); cx.fillStyle = '#1b1d22'; ell(6, -18, 3, 3.5); cx.fill(); ell(-2, -18, 3, 3.5); cx.fill(); cx.fillStyle = e.t === 'magma' ? '#ffd34d' : '#ff3d1f'; ell(6, -18, 1.2, 1.2); cx.fill(); ell(-2, -18, 1.2, 1.2); cx.fill();
      } else if (D.shape === 'bug') {
        cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 2.5; for (var i = 0; i < 3; i++) { var lg2 = Math.sin(e.walkT * 16 + i) * 3; cx.beginPath(); cx.moveTo(-8 + i * 8, -8); cx.lineTo(-12 + i * 8 + lg2, 0); cx.moveTo(-8 + i * 8, -8); cx.lineTo(-4 + i * 8 - lg2, 0); cx.stroke(); }
        ell(0, -12, 18, 9); outline(col); ell(16, -13, 7, 6); outline(col);
        if (e.t === 'scorp') { cx.lineWidth = 4; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.beginPath(); cx.moveTo(-16, -14); cx.quadraticCurveTo(-30, -40, -10, -42); cx.stroke(); cx.strokeStyle = col; cx.lineWidth = 2.5; cx.stroke(); cx.fillStyle = '#ff3d1f'; ell(-10, -42, 3, 3); cx.fill(); }
        cx.fillStyle = '#ffe14a'; ell(19, -15, 1.8, 1.8); cx.fill();
      } else if (D.shape === 'drone') {
        var hv = Math.sin(clock * 5 + e.x) * 4; ell(0, -34 + hv, 16, 9); outline(col); cx.fillStyle = e.t === 'imp' ? '#ffd34d' : '#ff3d1f'; ell(6, -34 + hv, 3, 3); cx.fill();
        if (e.t === 'drone') { cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-18, -42 + hv); cx.lineTo(18, -42 + hv); cx.stroke(); cx.fillStyle = 'rgba(200,210,220,.6)'; ell(-18, -43 + hv, 8, 2); cx.fill(); ell(18, -43 + hv, 8, 2); cx.fill(); }
        else { cx.beginPath(); cx.moveTo(-6, -42 + hv); cx.lineTo(-10, -52 + hv); cx.lineTo(-2, -44 + hv); outline(col, 1.5); cx.fillStyle = 'rgba(255,106,31,.4)'; ell(0, -34 + hv, 22, 14); cx.fill(); }
      } else if (D.shape === 'golem') {
        cx.beginPath(); GK.rr(cx, -14, -14, 10, 14, 3); outline(col); cx.beginPath(); GK.rr(cx, 4, -14, 10, 14, 3); outline(col);
        cx.beginPath(); GK.rr(cx, -20, -48 + bob * .5, 40, 36, 10); outline(col); cx.beginPath(); GK.rr(cx, -10, -62 + bob * .5, 20, 16, 6); outline(col);
        cx.beginPath(); GK.rr(cx, 18, -46 + bob, 10, 26, 5); outline(col); cx.beginPath(); GK.rr(cx, -28, -46 - bob, 10, 26, 5); outline(col);
        cx.fillStyle = e.t === 'titan' ? '#ffd34d' : e.t === 'yeti' ? '#3a7aff' : '#ff3d1f'; cx.fillRect(-6, -57 + bob * .5, 4, 3); cx.fillRect(3, -57 + bob * .5, 4, 3);
        if (e.t === 'titan') { cx.fillStyle = 'rgba(255,106,31,.35)'; ell(0, -36, 36, 30); cx.fill(); }
      } else if (D.shape === 'worm') {
        for (var sgi = 4; sgi >= 0; sgi--) { ell(-sgi * 12, -14 - Math.sin(clock * 4 + sgi) * 6 - (4 - sgi) * 6, 14 - sgi, 12 - sgi); outline(col); }
        cx.fillStyle = '#1b1d22'; ell(6, -42, 7, 6); cx.fill(); cx.fillStyle = '#fff'; for (var tth = 0; tth < 4; tth++) cx.fillRect(1 + tth * 3, -46, 1.5, 3);
      } else if (D.shape === 'man') {
        cx.lineCap = 'round'; cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 5; var lg3 = Math.sin(e.walkT * 10) * 4; cx.beginPath(); cx.moveTo(-4, -12); cx.lineTo(-4 + lg3, 0); cx.moveTo(4, -12); cx.lineTo(4 - lg3, 0); cx.stroke();
        cx.beginPath(); GK.rr(cx, -9, -36, 18, 24, 6); outline(col); cx.beginPath(); cx.arc(2, -44, 9, 0, PI * 2); outline('#9ab08a'); cx.fillStyle = '#ff3d1f'; ell(6, -45, 1.8, 1.8); cx.fill();
      }
      cx.restore();
      // полоска здоровья
      if (e.hp < e.max && !e.boss) { var w = 34 * cam.z; cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(p[0] - w / 2, p[1] - (52 * e.size + 10) * cam.z, w, 5); cx.fillStyle = '#ff5a5a'; cx.fillRect(p[0] - w / 2, p[1] - (52 * e.size + 10) * cam.z, w * Math.max(0, e.hp / e.max), 5); }
    }
    function drawBld(k) {
      var B = BLD[k], l = st.bld[k], p = scr(B.x, B.y);
      cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z, cam.z);
      if (!l) {
        var need = B.need ? B.need(1) : 1, can = hqLvl() >= need;
        cx.setLineDash([6, 5]); cx.strokeStyle = can ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)'; cx.lineWidth = 2; ell(0, 0, 46, 20); cx.stroke(); cx.setLineDash([]);
        cx.fillStyle = can ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)'; cx.font = '700 12px Onest,sans-serif'; cx.textAlign = 'center'; cx.fillText((can ? '+ ' : '') + B.n, 0, 4);
        cx.restore(); return;
      }
      GK.shadow(cx, 0, 2, 48, 16, .3);
      var wall = '#8a6a48', roof = { hq: '#b5523a', store: '#6a7a8a', bench: '#8a6a40', saw: '#7a5a3a', quarry: '#7a7f88', farm: '#c9a24a', forge: '#4a4f5a', recyc: '#4a8a6a', lab: '#4a7aa8', radio: '#5a6a7a', filter: '#5a8aa8', desal: '#3a8ab0', heater: '#b0503a', cooler: '#3a9ad8' }[k] || '#7a5a3a';
      if (B.tower) {
        cx.beginPath(); cx.rect(-12, -70, 24, 70); outline('#7a5a3a'); cx.beginPath(); cx.rect(-20, -90, 40, 22); outline('#9a7a4a');
        for (var q = 0; q < 4; q++) { cx.beginPath(); cx.rect(-20 + q * 11, -98, 7, 8); outline('#9a7a4a', 1.5); }
        cx.fillStyle = '#ffd34d'; cx.font = '800 11px Onest'; cx.textAlign = 'center'; cx.fillText(l, 0, -74);
        cx.restore(); return;
      }
      var sz = 1 + (Math.min(l, 6) - 1) * .06; cx.scale(sz, sz);
      if (k === 'hq') { cx.beginPath(); cx.moveTo(-50, 0); cx.lineTo(-40, -50); cx.lineTo(0, -80); cx.lineTo(40, -50); cx.lineTo(50, 0); cx.closePath(); outline('#a0603a'); cx.beginPath(); cx.moveTo(-12, 0); cx.lineTo(0, -34); cx.lineTo(12, 0); outline('#3a2a20'); cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(0, -80); cx.lineTo(0, -110); cx.stroke(); cx.fillStyle = '#43c9e3'; cx.beginPath(); cx.moveTo(0, -110); cx.lineTo(24, -102); cx.lineTo(0, -94); cx.fill(); var fl = Math.sin(clock * 8) * 2; cx.fillStyle = '#ff9f2b'; ell(54, -6 - fl, 7, 10); cx.fill(); cx.fillStyle = '#ffd34d'; ell(54, -4, 4, 6); cx.fill(); }
      else if (k === 'wall') { }
      else { cx.beginPath(); cx.rect(-38, -40, 76, 40); outline(wall); cx.beginPath(); cx.moveTo(-46, -38); cx.lineTo(0, -66); cx.lineTo(46, -38); cx.closePath(); outline(roof); cx.beginPath(); cx.rect(-10, -24, 20, 24); outline('#3a2a20', 1.5);
        var ic = { store: '📦', bench: '🛠', saw: '🪓', quarry: '⛏', farm: '🌾', forge: '⚒', recyc: '♻', lab: '⚗', radio: '📡', filter: '🌀', desal: '💧', heater: '🔥', cooler: '❄' }[k];
        if (k === 'radio') { cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(30, -40); cx.lineTo(30, -110); cx.stroke(); cx.fillStyle = (Math.floor(clock * 2) % 2) ? '#ff3d1f' : '#5a1a10'; ell(30, -112, 4, 4); cx.fill(); }
        if (k === 'forge' || k === 'heater') { var sm = (clock * 20) % 40; cx.fillStyle = 'rgba(120,120,120,' + (1 - sm / 40) * .5 + ')'; ell(26, -70 - sm, 8 + sm * .2, 6 + sm * .1); cx.fill(); }
        if (ic) { cx.font = '20px sans-serif'; cx.textAlign = 'center'; cx.fillText(ic, 24, -10); }
      }
      cx.restore();
      if (k !== 'wall' && Math.hypot(hero.x - B.x, hero.y - B.y) < 220) { var pp = scr(B.x, B.y - 100 - (k === 'hq' ? 26 : 0)); tag(pp[0], pp[1], B.n + (B.max > 1 ? ' ' + l : ''), '#ffd34d'); }
    }
    function tag(x, y, t, col) { cx.font = '800 12px Onest,Inter,sans-serif'; var w = cx.measureText(t).width + 16; cx.fillStyle = 'rgba(20,16,14,.78)'; GK.rr(cx, x - w / 2, y - 11, w, 20, 10); cx.fill(); cx.fillStyle = col; cx.beginPath(); cx.arc(x - w / 2 + 8, y - 1, 3, 0, PI * 2); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.fillText(t, x + 4, y + 3); }
    function drawWall() {
      var l = st.bld.wall; if (!l) return; var n = 72, hpK = raid ? Math.max(0, st.wallHp / wallMax()) : 1;
      for (var i = 0; i < n; i++) {
        var a = i / n * PI * 2, gate = [0, 18, 36, 54].some(function (g) { return Math.abs(i - g) < 2 || Math.abs(i - g - n) < 2; }); if (gate) continue;
        if (hpK <= 0 && i % 2) continue;
        var x = Math.cos(a) * R_CAMP, y = Math.sin(a) * R_CAMP; wallParts.push({ y: y, f: (function (x, y) { return function () { var p = scr(x, y); cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z, cam.z); cx.beginPath(); cx.moveTo(-9, 0); cx.lineTo(-9, -34 - l * 3); cx.lineTo(0, -44 - l * 3); cx.lineTo(9, -34 - l * 3); cx.lineTo(9, 0); cx.closePath(); outline(l >= 4 ? '#8a96a8' : l >= 2 ? '#9a7a5a' : '#8a6a40', 1.6); cx.restore(); }; })(x, y) });
      }
    }
    var wallParts = [];
    function drawCage(c) {
      var p = scr(c.x, c.y); cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z, cam.z);
      GK.shadow(cx, 0, 2, 28, 10, .3); cx.beginPath(); cx.rect(-24, -54, 48, 54); cx.fillStyle = 'rgba(30,30,30,.25)'; cx.fill();
      cx.strokeStyle = 'rgba(25,20,18,.9)'; cx.lineWidth = 4; for (var i = 0; i < 5; i++) { cx.beginPath(); cx.moveTo(-20 + i * 10, 0); cx.lineTo(-20 + i * 10, -54); cx.stroke(); } cx.beginPath(); cx.rect(-24, -58, 48, 6); outline('#6a7280');
      cx.beginPath(); cx.arc(0, -30, 8, 0, PI * 2); outline('#d8b48a', 1.5); var wv = Math.sin(clock * 6) * 6; cx.strokeStyle = '#d8b48a'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(6, -24); cx.lineTo(16, -36 + wv); cx.stroke();
      cx.restore(); tag(p[0], p[1] - 76 * cam.z, 'Выживший', '#7ae6ff');
    }
    function drawBag(b) { var p = scr(b.x, b.y); cx.save(); cx.translate(p[0], p[1] + Math.sin(clock * 3) * 2); cx.scale(cam.z, cam.z); GK.shadow(cx, 0, 2, 14, 5, .3); cx.beginPath(); cx.moveTo(-12, 0); cx.quadraticCurveTo(-16, -22, 0, -24); cx.quadraticCurveTo(16, -22, 12, 0); cx.closePath(); outline('#c99358'); cx.restore(); tag(p[0], p[1] - 40 * cam.z, 'Ваша добыча', '#c99358'); }
    function drawLair(b) {
      var L = lair(b), p = scr(L.x, L.y); if (Math.abs(p[0] - S.w / 2) > S.w || Math.abs(p[1] - S.h / 2) > S.h) return;
      cx.save(); cx.translate(p[0], p[1]); cx.scale(cam.z, cam.z); cx.strokeStyle = 'rgba(255,60,40,.35)'; cx.lineWidth = 4; cx.setLineDash([12, 10]); ell(0, 0, 240, 100); cx.stroke(); cx.setLineDash([]);
      for (var i = 0; i < 6; i++) { var a = i / 6 * PI * 2; cx.save(); cx.translate(Math.cos(a) * 230, Math.sin(a) * 96); cx.beginPath(); cx.moveTo(-5, 0); cx.lineTo(0, -40); cx.lineTo(5, 0); outline('#e8e2d4', 1.5); cx.restore(); }
      cx.restore();
    }
    function render(dt) {
      var c = cx; c.save(); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      // камера
      cam.x += (hero.x - cam.x) * Math.min(1, dt * 6); cam.y += (hero.y - 40 - cam.y) * Math.min(1, dt * 6);
      if (shake) { c.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
      c.fillStyle = '#1b1d22'; c.fillRect(-20, -20, S.w + 40, S.h + 40);
      // земля по чанкам
      var tl = world(0, 0), br = world(S.w, S.h), a = Math.floor(tl[0] / CHUNK), b = Math.floor(br[0] / CHUNK), c2 = Math.floor(tl[1] / CHUNK), d = Math.floor(br[1] / CHUNK);
      for (var i = a; i <= b; i++) for (var j = c2; j <= d; j++) { var ch = chunk(i, j), p = scr(i * CHUNK, j * CHUNK); c.drawImage(ch, p[0], p[1], CHUNK * cam.z + 1, CHUNK * cam.z + 1); }
      // закрытые биомы: туман
      for (var bb = 1; bb < 6; bb++) if (!biomeOpen(bb)) fog(bb);
      // площадь лагеря
      var pc = scr(0, 0); c.strokeStyle = 'rgba(255,211,77,.18)'; c.lineWidth = 3; c.setLineDash([10, 10]); c.beginPath(); c.ellipse(pc[0], pc[1], (R_CAMP - 30) * cam.z, (R_CAMP - 30) * cam.z, 0, 0, PI * 2); c.stroke(); c.setLineDash([]);
      st.open.forEach(function (b2) { drawLair(b2); });
      // зоны атак
      aoes.forEach(function (o) { var p2 = scr(o.x, o.y), k = Math.min(1, o.t / o.warn); c.save(); c.translate(p2[0], p2[1]); c.scale(1, .55); c.fillStyle = o.hit ? 'rgba(255,255,255,.4)' : 'rgba(255,60,40,' + (.12 + k * .2) + ')'; c.strokeStyle = 'rgba(255,60,40,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, o.r * cam.z, 0, PI * 2); if (o.ring) { c.arc(0, 0, Math.max(1, o.r - 50) * cam.z, 0, PI * 2, true); } c.fill('evenodd'); c.stroke(); if (!o.hit) { c.fillStyle = 'rgba(255,60,40,.35)'; c.beginPath(); c.arc(0, 0, o.r * cam.z * k, 0, PI * 2); c.fill(); } c.restore(); });
      // объекты по глубине
      var list = []; wallParts = [];
      nearCells(cam.x, cam.y, Math.max(S.w, S.h) / cam.z * .75 + 80, function (o) { if (o.k === 'n' && !depleted(o)) list.push({ y: o.y, f: function () { drawNode(o); } }); else if (o.k === 'd') list.push({ y: o.y - 30, f: function () { drawDecor(o); } }); });
      Object.keys(BLD).forEach(function (k) { if (!BLD[k].ring) list.push({ y: BLD[k].y, f: function () { drawBld(k); } }); });
      drawWall(); list = list.concat(wallParts);
      CAGES.forEach(function (cg) { if (!st.saved[cg.id] && !locked(cg.x, cg.y) && Math.abs(cg.x - cam.x) < 1400 && Math.abs(cg.y - cam.y) < 1400) list.push({ y: cg.y, f: function () { drawCage(cg); } }); });
      st.bags.forEach(function (bg) { list.push({ y: bg.y, f: function () { drawBag(bg); } }); });
      enemies.forEach(function (e) { list.push({ y: e.y, f: function () { drawEnemy(e); } }); });
      if (!hero.dead) list.push({ y: hero.y, f: function () { drawChar(hero, { body: '#4a6a3a', hood: '#5a4a3a', legs: '#3a3a44', pack: '#7a5a3a', mask: true, hurt: hero.hurtT > 0, weapon: '#8a6a40', blade: st.weap >= 1 ? ['#c9d4e3', '#c9d4e3', '#d8e2ee', '#9be03a', '#f2d38a', '#9fe2ff', '#7a4aa8'][st.weap - 1] : null }); } });
      if (comp && !hero.dead) list.push({ y: comp.y, f: function () { drawChar(comp, { body: '#3a6aa8', hood: '#8a5a3a', legs: '#3a3a44', face: '#e8c49a', weapon: '#6a5a4a', blade: '#c9d4e3' }); var p3 = scr(comp.x, comp.y - 80); tag(p3[0], p3[1], st.comp, '#7ae6ff'); } });
      list.sort(function (x, y) { return x.y - y.y; }).forEach(function (o) { o.f(); });
      // снаряды
      projs.forEach(function (o) { var p4 = scr(o.x, o.y - (o.z || 0)); c.fillStyle = o.gren ? '#6a7a4a' : o.tower ? '#ffd34d' : o.c || '#9fd0ff'; c.beginPath(); c.arc(p4[0], p4[1], (o.big ? 12 : o.gren ? 6 : 4) * cam.z, 0, PI * 2); c.fill(); c.strokeStyle = 'rgba(25,20,18,.8)'; c.lineWidth = 1.5; c.stroke(); });
      // частицы (в мировых координатах)
      fx.step(dt); c.save(); c.translate(S.w / 2, S.h / 2); c.scale(cam.z, cam.z); fx.draw(c, cam.x, cam.y); c.restore();
      if (tapMark) { tapMark.t += dt; var tp = scr(tapMark.x, tapMark.y), ta = 1 - tapMark.t / .6; if (ta > 0) { c.strokeStyle = 'rgba(255,255,255,' + ta + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(tp[0], tp[1], 12 + tapMark.t * 20, 6 + tapMark.t * 8, 0, 0, PI * 2); c.stroke(); } else tapMark = null; }
      // частицы биома в воздухе
      ambient(dt);
      // ночь: темнота и свет вокруг героя и лагеря
      var night = isNight() ? Math.min(1, (st.t - DAY) / 8, (DAY + NIGHT - st.t) / 8) : 0;
      if (night > 0) {
        var ph = scr(hero.x, hero.y - 30), pc2 = scr(0, 0);
        var g = c.createRadialGradient(ph[0], ph[1], 40, ph[0], ph[1], 320 * cam.z); g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(1, 'rgba(8,10,30,' + .62 * night + ')');
        c.fillStyle = g; c.fillRect(0, 0, S.w, S.h);
        c.globalCompositeOperation = 'lighter'; var g2 = c.createRadialGradient(pc2[0], pc2[1], 0, pc2[0], pc2[1], 380 * cam.z); g2.addColorStop(0, 'rgba(255,150,60,' + .12 * night + ')'); g2.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = g2; c.fillRect(0, 0, S.w, S.h); c.globalCompositeOperation = 'source-over';
      }
      // зона опасности
      if (H.hp < maxHp() * .3 && !hero.dead) { var vg = c.createRadialGradient(S.w / 2, S.h / 2, Math.min(S.w, S.h) * .3, S.w / 2, S.h / 2, Math.max(S.w, S.h) * .7); vg.addColorStop(0, 'rgba(180,0,0,0)'); vg.addColorStop(1, 'rgba(180,0,0,' + (.25 + Math.sin(clock * 6) * .08) + ')'); c.fillStyle = vg; c.fillRect(0, 0, S.w, S.h); }
      c.restore();
      miniT -= dt; if (miniT <= 0) { miniT = .35; drawMap($('.rb-mini'), 240, false); }
      compTick(dt);
    }
    var miniT = 0, amb = [];
    function ambient(dt) {
      var b = biomeAt(hero.x, hero.y), kind = b < 0 ? null : BIOMES[b].fx;
      if (kind && amb.length < 40 && Math.random() < dt * 18) amb.push({ x: Math.random() * S.w, y: kind === 'ember' ? S.h + 5 : -5, vx: kind === 'sand' ? 120 + Math.random() * 80 : (Math.random() - .5) * 30, vy: kind === 'ember' ? -40 - Math.random() * 40 : kind === 'snow' ? 40 + Math.random() * 30 : kind === 'sand' ? 20 : 25 + Math.random() * 20, k: kind, t: 0 });
      cx.save(); cx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      for (var i = amb.length - 1; i >= 0; i--) {
        var a = amb[i]; a.t += dt; a.x += (a.vx + Math.sin(a.t * 2 + i) * 20) * dt; a.y += a.vy * dt;
        if (a.y > S.h + 10 || a.y < -10 || a.x > S.w + 10 || a.t > 9 || a.k !== kind) { amb.splice(i, 1); continue; }
        cx.fillStyle = a.k === 'snow' ? 'rgba(255,255,255,.85)' : a.k === 'ember' ? 'rgba(255,140,40,.85)' : a.k === 'spore' ? 'rgba(170,240,100,.6)' : a.k === 'sand' ? 'rgba(230,200,140,.55)' : a.k === 'leaf' ? 'rgba(140,110,50,.7)' : 'rgba(200,200,200,.4)';
        cx.beginPath(); cx.arc(a.x, a.y, a.k === 'snow' ? 2.4 : 1.8, 0, PI * 2); cx.fill();
      }
      cx.restore();
    }
    function fog(b) {
      var a0 = (b * 60 - 120) * PI / 180, a1 = a0 + PI / 3, pc = scr(0, 0);
      cx.save(); cx.beginPath(); cx.arc(pc[0], pc[1], R_WORLD * cam.z, a0, a1); cx.arc(pc[0], pc[1], R_OUT * cam.z, a1, a0, true); cx.closePath();
      cx.fillStyle = 'rgba(20,18,24,.62)'; cx.fill(); cx.strokeStyle = 'rgba(255,90,60,.55)'; cx.lineWidth = 3; cx.setLineDash([14, 10]); cx.stroke(); cx.setLineDash([]); cx.restore();
      var am = (a0 + a1) / 2, lx = Math.cos(am) * (R_OUT + 120), ly = Math.sin(am) * (R_OUT + 120), p = scr(lx, ly);
      if (p[0] > -100 && p[0] < S.w + 100 && p[1] > -50 && p[1] < S.h + 50) tag(p[0], p[1], '🔒 ' + BIOMES[b].n, '#ff6a5a');
    }
    function drawMap(cv, size, big) {
      var x = cv.getContext('2d'), k = size / (R_WORLD * 2); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, size, size);
      x.save(); x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, PI * 2); x.clip();
      x.fillStyle = '#14161b'; x.fillRect(0, 0, size, size);
      for (var b = 0; b < 6; b++) { var a0 = (b * 60 - 120) * PI / 180; x.beginPath(); x.moveTo(size / 2, size / 2); x.arc(size / 2, size / 2, size / 2, a0, a0 + PI / 3); x.closePath(); x.fillStyle = BIOMES[b].g; x.globalAlpha = biomeOpen(b) ? .95 : .35; x.fill(); }
      x.globalAlpha = 1; x.fillStyle = '#7b8a55'; x.beginPath(); x.arc(size / 2, size / 2, R_CAMP * k, 0, PI * 2); x.fill();
      // неразведанное
      var c = (R_WORLD * 2) / EXP_N * k; x.fillStyle = '#101116';
      for (var j = 0; j < EXP_N; j++) for (var i = 0; i < EXP_N; i++) if (!expBits[j * EXP_N + i]) x.fillRect(Math.floor(i * c), Math.floor(j * c), Math.ceil(c) + 1, Math.ceil(c) + 1);
      function dot(wx, wy, col, r) { x.fillStyle = col; x.beginPath(); x.arc(size / 2 + wx * k, size / 2 + wy * k, r, 0, PI * 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1; x.stroke(); }
      dot(0, 0, '#ffd34d', big ? 7 : 4);
      st.open.forEach(function (b2) { var L = lair(b2), bid = BIOMES[b2].boss; if (!(st.beaten && st.beaten[bid])) dot(L.x, L.y, '#ff5a6e', big ? 7 : 4); });
      CAGES.forEach(function (cg) { if (!st.saved[cg.id] && biomeOpen(cg.b)) dot(cg.x, cg.y, '#7ae6ff', big ? 5 : 3); });
      st.bags.forEach(function (bg) { dot(bg.x, bg.y, '#c99358', big ? 6 : 3.5); });
      dot(hero.x, hero.y, '#ffffff', big ? 6 : 4);
      if (big) { x.font = '700 13px Onest,sans-serif'; x.textAlign = 'center'; BIOMES.forEach(function (B, b3) { var am = (b3 * 60 - 90) * PI / 180; x.fillStyle = biomeOpen(b3) ? '#fff' : 'rgba(255,255,255,.55)'; x.fillText((biomeOpen(b3) ? '' : '🔒 ') + B.n, size / 2 + Math.cos(am) * size * .33, size / 2 + Math.sin(am) * size * .33); }); }
      x.restore();
      x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2; x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 1, 0, PI * 2); x.stroke();
    }

    /* ---------------- HUD */
    function hud() {
      enUI(st);
      var mh = maxHp(); hpChip.querySelector('.lv').textContent = H.lvl; hpChip.querySelector('i').style.width = Math.max(0, H.hp / mh * 100) + '%'; hpChip.querySelector('.v').textContent = Math.max(0, Math.round(H.hp));
      var n = isNight(), left = n ? DAY + NIGHT - st.t : DAY - st.t;
      dayChip.classList.toggle('night', n); dayChip.querySelector('span').textContent = (n ? 'Ночь ' : 'День ') + Math.ceil(left / 60) + ' мин';
      $('.bg').textContent = invN() + '/' + bagCap();
      document.querySelectorAll('.rb-sk').forEach(function (b, i) { var cd = st.skill[i], em = b.querySelector('em'); em.style.height = (cd / CD[i] * 100) + '%'; var nn = b.querySelector('.n'); if (nn) nn.textContent = st.inv[i === 1 ? 'medkit' : 'grenade'] || 0; b.classList.toggle('off', i > 0 && !(st.inv[i === 1 ? 'medkit' : 'grenade'] > 0)); });
      // босс
      var bb = $('.rb-boss'); if (bossE && bossE.state === 'chase' && !bossE.dead) { bb.hidden = false; bb.querySelector('b').textContent = bossE.D.n; bb.querySelector('i').style.width = Math.max(0, bossE.hp / bossE.max * 100) + '%'; } else bb.hidden = true;
      // кнопка действия
      var act = null;
      if (hero.cageAsk) act = ['Освободить выжившего (−2 энергии)', function () { freeCage(hero.cageAsk); }];
      else if (Math.hypot(hero.x, hero.y) < R_CAMP) { var nb = null, nd = 160; Object.keys(BLD).forEach(function (k) { var B = BLD[k]; if (B.ring) return; var d = Math.hypot(hero.x - B.x, hero.y - B.y); if (d < nd) { nd = d; nb = k; } }); if (nb) act = [(st.bld[nb] ? 'Открыть: ' : 'Построить: ') + BLD[nb].n, function () { bldPanel(nb); }]; }
      if (act && !S.sheetOpen()) { actBtn.hidden = false; actBtn.textContent = act[0]; actBtn._fn = act[1]; } else actBtn.hidden = true;
      // стрелка к лагерю, когда сумка полна
      var home = $('.rb-home'), far = Math.hypot(hero.x, hero.y) > R_CAMP + 300;
      if (far && (invN() >= bagCap() || isNight())) { home.hidden = false; var ang = Math.atan2(-hero.y, -hero.x); home.querySelector('i').style.transform = 'rotate(' + ang + 'rad)'; home.querySelector('span').textContent = (invN() >= bagCap() ? 'Сумка полна · ' : 'Ночь · ') + 'лагерь ' + Math.round(Math.hypot(hero.x, hero.y) / 100) * 10 + ' м'; } else home.hidden = true;
      checkAchLight();
    }
    var achT = 0; function checkAchLight() { achT -= .2; if (achT <= 0) { achT = 3; checkAch(); } }

    /* ================================================================ запуск */
    // уже открытые биомы по старым победам (на случай восстановления)
    unlockCheck();
    var loop = GK.loop(function (dt) { if (alive) update(dt); });
    S.loaded(); GK.music('dark'); hud(); checkAch();
    setTimeout(offline, 500);
    S.onclose = function () { if (!alive) return; alive = false; loop.stop(); I.destroy(); saver.flush(true).then(function () { saver.stop(); saver.off(); S.destroy(); ctx.onClose(); }); };
    W.__rb = { st: st, hero: hero, H: H, enemies: function () { return enemies; }, update: update, S: S, BLD: BLD, bldPanel: bldPanel, lair: lair, kill: killEnemy, tutor: tutor, give: give, deposit: deposit, CAGES: CAGES, freeCage: freeCage, cam: cam };
    return { close: function () { S.onclose(); } };
  }

  var RB_CSS = '.rb{--gk-glass:rgba(28,22,20,.7);--gk-card:linear-gradient(170deg,#3a2c26,#1f1816);--gk-acc:linear-gradient(140deg,#f0a040,#c0602a);--gk-acc-ink:#2a1206;--gk-bar:linear-gradient(90deg,#f0a040,#ffd34d);background:#1b1d22}' +
    '.rb .gk-card{border-color:rgba(255,200,140,.18)}.rb .gk-tabs button[aria-selected="true"]{background:#f0a040;color:#2a1206}' +
    '.rb-hp{gap:8px}.rb-hp .lv{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:linear-gradient(140deg,#7ae6ff,#3a8ad8);font-size:.8rem}.rb-hp .bar{width:70px;height:8px;border-radius:9px;background:rgba(255,255,255,.15);overflow:hidden}.rb-hp .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff5a5a,#ff9a6a);transition:width .2s}' +
    '.rb-day{gap:6px;font-size:.8rem}.rb-day .sun{width:14px;height:14px;border-radius:50%;background:#ffd34d;box-shadow:0 0 8px #ffd34d}.rb-day.night .sun{background:#cfe0ff;box-shadow:inset -4px -2px 0 #2a3050,0 0 8px #9fb4ff}' +
    '.rb-mini{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:calc(60px + env(safe-area-inset-top,0px));width:120px;height:120px;border-radius:50%;z-index:4;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)}' +
    '.rb-boss{position:absolute;left:50%;top:calc(60px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:grid;gap:4px;justify-items:center;z-index:4;width:min(60vw,380px);padding:8px 14px;border-radius:14px;background:rgba(40,10,10,.75);border:1px solid rgba(255,90,90,.5)}.rb-boss[hidden]{display:none}.rb-boss b{font-size:.9rem;color:#ffb0a0}.rb-boss .bar{width:100%;height:10px;border-radius:9px;background:rgba(255,255,255,.15);overflow:hidden}.rb-boss .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff3d1f,#ff8a4a);transition:width .2s}' +
    '.rb-skills{position:absolute;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(84px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:auto auto;grid-template-areas:"a b" "c b";gap:10px;z-index:5;align-items:end}' +
    '.rb-sk{position:relative;width:62px;height:62px;border-radius:50%;border:2px solid rgba(255,220,180,.5);background:radial-gradient(circle at 35% 30%,#5a463a,#2a201c);display:grid;place-items:center;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.45)}' +
    '.rb-sk[data-sk="0"]{grid-area:b;width:78px;height:78px}.rb-sk .ic{font-size:26px;font-style:normal;line-height:1}.rb-sk small{position:absolute;bottom:6px;font-size:.58rem;font-weight:800;opacity:.85}.rb-sk .n{position:absolute;top:6px;right:9px;font-size:.72rem}' +
    '.rb-sk em{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(0,0,0,.6)}.rb-sk.off{opacity:.55}.rb-sk:active{transform:scale(.93)}' +
    '.rb-bar{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:5px;padding:5px;border-radius:16px;background:rgba(28,22,20,.75);border:1px solid rgba(255,200,140,.2);z-index:5}' +
    '.rb-b{position:relative;display:grid;justify-items:center;gap:1px;height:46px;padding:0 13px;border-radius:12px;border:0;background:rgba(255,255,255,.07);font-size:.82rem;align-content:center;white-space:nowrap}.rb-b span{font-size:.68rem;opacity:.8}.rb-b em{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#ff5a6e;font:800 .72rem/20px Onest,sans-serif;font-style:normal}.rb-b em[hidden]{display:none}' +
    '.rb-act{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);height:48px;padding:0 22px;border-radius:15px;border:0;background:linear-gradient(140deg,#ffd34d,#f08a2b);color:#2a1206;font-weight:800;font-size:.95rem;box-shadow:0 10px 24px rgba(240,138,43,.45);z-index:5;white-space:nowrap;max-width:calc(100vw - 200px);overflow:hidden;text-overflow:ellipsis}.rb-act[hidden]{display:none}' +
    '.rb-home{position:absolute;left:50%;top:calc(110px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:7px 12px;border-radius:12px;background:rgba(28,22,20,.75);border:1px solid rgba(255,211,77,.5);font-weight:700;font-size:.82rem;z-index:4;pointer-events:none}.rb-home[hidden]{display:none}.rb-home i{width:0;height:0;border-left:12px solid #ffd34d;border-top:7px solid transparent;border-bottom:7px solid transparent}' +
    '.rb-dead{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle,rgba(80,0,0,.4),rgba(0,0,0,.85));z-index:12;animation:gkfade .5s both}.rb-dead[hidden]{display:none}.rb-dead div{display:grid;gap:8px;text-align:center}.rb-dead b{font-size:1.6rem}.rb-dead span{opacity:.8}' +
    '.rb-res{display:flex;flex-wrap:wrap;gap:6px}.rb-res span{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:10px;background:rgba(255,255,255,.07);font-size:.82rem}.rb-res i{width:12px;height:12px;border-radius:4px}.rb-sub{margin-top:4px}' +
    '.gz-sub{font-weight:800;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7}.gz-info{padding:10px 12px;border-radius:12px;background:rgba(240,160,64,.12);border:1px solid rgba(240,160,64,.4);font-weight:700;font-size:.88rem}' +
    '.rb-bl{width:100%;text-align:left;cursor:pointer}.rb-n{font-size:.78rem;font-weight:800;opacity:.75;white-space:nowrap}.gk-cost small{opacity:.6;font-weight:600}.gk-it small.no{color:#ff8a80}' +
    '.rb-map{width:100%;height:auto;aspect-ratio:1;display:block}.rb-leg{display:flex;flex-wrap:wrap;gap:10px;font-size:.78rem}.rb-leg span{display:inline-flex;gap:5px;align-items:center}.rb-leg i{width:10px;height:10px;border-radius:50%}' +
    '.rb-trophy{font-size:64px;text-align:center;animation:gkpop .6s cubic-bezier(.2,1.4,.4,1) both}' +
    '@media (max-width:560px){.rb-b{padding:0 8px;font-size:.72rem;height:42px;flex:1 1 auto}.rb-bar{width:calc(100vw - 16px);justify-content:space-between;gap:3px}.rb-mini{width:92px;height:92px;top:calc(108px + env(safe-area-inset-top,0px))}.rb-sk{width:54px;height:54px}.rb-sk[data-sk="0"]{width:66px;height:66px}.rb-skills{bottom:calc(78px + env(safe-area-inset-bottom,0px))}.rb-act{bottom:calc(70px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 180px);font-size:.82rem;padding:0 14px}.rb-hp .bar{width:46px}.rb-day{display:none}}';

  W.Rub = { open: open };
})(window);
