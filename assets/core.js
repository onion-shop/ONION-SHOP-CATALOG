/* ONION SHOP — правила магазина (один файл для сайта и для Google Таблицы).
   Здесь: токены, уровни, задания, рулетка, партнёрка, номера заказов и текст заказа.
   На сервере (Google Apps Script) этот же код работает с таблицей,
   на сайте в демо-режиме — с памятью браузера. */
var OnionCore = (function () {
  'use strict';

  // ---------------------------------------------------------------- правила (вариант Б)
  var RULES = {
    tokenRub: 0.4,          // 1 токен = 0,4 ₽ скидки
    maxShare: 0.15,         // токенами можно оплатить не больше 15% суммы заказа
    spinCost: 100,          // прокрут рулетки
    reward: { register: 100, refFriend: 50, referrer: 100, checkin: 1, streak7: 10, task: 1, birthday: 200 },
    refMinOrder: 1000,      // друг засчитывается после первого заказа от 1000 ₽
    refMaxPerMonth: 10,
    sessionDays: 60,
    /* Программа лояльности. Уровень месяца растёт от XP (опыта), обнуляется 1-го числа.
       XP: полученные заказы (1 XP за каждые 10 ₽), ежедневный вход, задания, рулетка. */
    xpPerRub: 0.1,
    xpReward: { checkin: 5, task: 2 },
    levels: [
      { key: 'bronze', name: 'Бронза', alias: ['новичок'], min: 0, tasks: 4, streak: 10, spins: 1, priority: '', perks: [
        ['4 задания в день', 'Каждое — +1 токен и +2 XP'],
        ['1 бесплатный прокрут рулетки каждый день', 'Обновляется в 00:00 по Москве, не копится'],
        ['10 токенов за серию 7 дней', 'Отмечайтесь в кабинете 7 дней подряд']] },
      { key: 'silver', name: 'Серебро', alias: ['модник'], min: 500, tasks: 5, streak: 12, spins: 1, priority: '', perks: [
        ['5 заданий в день', '+1 задание к обычным четырём'],
        ['12 токенов за серию 7 дней', 'Вместо 10 на Бронзе'],
        ['Рамка «Серебро» для аватара', 'Есть, пока у вас Серебро или выше. 1-го числа уровень обнуляется — и рамка тоже'],
        ['1 бесплатный прокрут рулетки каждый день', '']] },
      { key: 'gold', name: 'Золото', alias: ['профи'], min: 1500, tasks: 6, streak: 15, spins: 1, priority: 'Повышенный', perks: [
        ['6 заданий в день', '4 обычных + 2 дополнительных'],
        ['15 токенов за серию 7 дней', ''],
        ['Больше внимания к заказам', 'Менеджер видит ваш заказ с пометкой «Приоритет»'],
        ['Рамка «Золото» для аватара', 'Пока у вас Золото или выше'],
        ['Промокод −1,5% раз в месяц', 'На одну категорию — какую, решает случай: обувь, одежда, куртки или аксессуары. Действует до конца месяца'],
        ['1 бесплатный прокрут рулетки каждый день', '']] },
      { key: 'platinum', name: 'Платина', alias: ['эксперт'], min: 4000, tasks: 6, streak: 17, spins: 1, priority: 'Высокий', boost: 1, pack: 'pre10', perks: [
        ['Ещё больше внимания к заказам', 'Высокий приоритет у менеджера'],
        ['17 токенов за серию 7 дней', ''],
        ['Промокод −1,5% — на любой товар', 'Раз в месяц, без ограничения по категории'],
        ['Шансы в рулетке немного выше', 'Пусто выпадает реже — призы чаще'],
        ['−10% на упаковку для предзаказа', 'Только для заказа по предзаказу из Китая, 1 раз в месяц. Отмечается в корзине'],
        ['6 заданий в день, рамки «Серебро» и «Золото»', ''],
        ['1 бесплатный прокрут рулетки каждый день', '']] },
      { key: 'diamond', name: 'Алмаз', alias: ['икона'], min: 8000, tasks: 6, streak: 20, spins: 3, priority: 'Наивысший', boost: 2, pack: 'free', perks: [
        ['Самое приоритетное внимание к заказам', 'Ваши заказы менеджер берёт первыми'],
        ['3 промокода −2,5% в месяц', 'По одному каждую неделю, действуют до конца месяца'],
        ['20 токенов за серию 7 дней', ''],
        ['Бесплатная упаковка 1 раз в месяц', 'Для любого заказа. Отмечается в корзине'],
        ['3 бесплатных прокрута каждый день', 'И шансы выше, чем на Платине'],
        ['Рамка «Алмаз» с анимацией', 'Можно выбрать анимацию. Открыты все рамки, кроме редких из рулетки'],
        ['Промокод −1,5% на любой товар и 6 заданий в день', 'Остаются с прошлых уровней']] }
    ],
    // категории для промокода уровня Золото
    promoCats: [
      { key: 'shoes', label: 'Обувь', cats: ['shoes'] },
      { key: 'clothes', label: 'Одежда', cats: ['hoodies', 'tees', 'pants'] },
      { key: 'outer', label: 'Куртки', cats: ['outerwear'] },
      { key: 'acc', label: 'Аксессуары', cats: ['accessories'] }
    ],
    // задания дня: lvl — с какого уровня открывается (Бронза 4, Серебро 5, Золото и выше 6)
    tasks: [
      { key: 'checkin', title: 'Зайти на сайт', hint: 'Отметьтесь сегодня', reward: 1, lvl: 0 },
      { key: 'view3', title: 'Посмотреть 3 товара', hint: 'Откройте три карточки', reward: 1, lvl: 0 },
      { key: 'fav', title: 'Добавить товар в избранное', hint: 'Нажмите ♡ на товаре', reward: 1, lvl: 0 },
      { key: 'share', title: 'Поделиться товаром', hint: 'Кнопка «Поделиться» в карточке', reward: 1, lvl: 0 },
      { key: 'pre', title: 'Открыть раздел «Предзаказ»', hint: 'Загляните, что едет из Китая', reward: 1, lvl: 1 },
      { key: 'cart', title: 'Положить товар в корзину', hint: 'Любой товар', reward: 1, lvl: 2 }
    ],
    // рулетка: веса из 200 (шанс = вес / 2 %). Приз в 70% прокрутов, «Пусто» — 30%
    wheel: [
      { id: 'none', label: 'Пусто', sub: 'в другой раз', w: 59 },
      { id: 't50', label: '+50', sub: 'токенов', w: 51, tokens: 50 },
      { id: 't100', label: '+100', sub: 'токенов', w: 28, tokens: 100 },
      { id: 't200', label: '+200', sub: 'токенов', w: 11, tokens: 200 },
      { id: 't500', label: '+500', sub: 'токенов', w: 4, tokens: 500 },
      { id: 'jackpot', label: 'Повезло!', sub: '+2000 токенов', w: 1, tokens: 2000 },
      { id: 'xp', label: '+50 XP', sub: 'к уровню', w: 19, xp: 50 },
      { id: 'frame', label: 'Рамка', sub: 'для аватара', w: 11, frame: true },
      { id: 'promo', label: '−3%', sub: 'промокод', w: 5, promo: 3 },
      { id: 're1', label: 'Ещё раз', sub: '×1', w: 9, spins: 1 },
      { id: 're2', label: 'Ещё раз', sub: '×2', w: 2, spins: 2 }
    ],
    // Платина и Алмаз: «Пусто» реже, призы чаще (сумма весов та же — 200)
    wheelBoost: {
      1: { none: -4, t50: 2, t100: 1, xp: 1 },
      2: { none: -8, t50: 3, t100: 2, t200: 1, t500: 1, promo: 1 }
    },
    // статусы заказа (меняются в таблице, клиент видит их в «Моих заказах»)
    stagesPre: ['Оформлен', 'Выкуплен', 'В пути', 'На складе', 'Едет к нам', 'Едет к вам', 'Получен'],
    stagesStock: ['Оформлен', 'Едет к вам', 'Получен'],
    stageNotes: { 'Оформлен': 'Заказ принят менеджером', 'Выкуплен': 'Оплачен поставщику', 'В пути': 'Поставщик везёт на склад в Китае', 'На складе': 'Проверка и фотоотчёт на складе', 'Едет к нам': 'Из Китая в Москву', 'Едет к вам': 'Передан в доставку', 'Получен': 'Заказ у вас', 'Отменён': 'Заказ отменён' },
    finalStages: ['Получен', 'Отменён'],
    codeTtlMin: 15,
    // src: wheel — выпадает в рулетке (rare — только в рулетке, даже для Алмаза); level — даётся уровнем
    frames: [
      { id: 'base', name: 'Обычная' },
      { id: 'neon', name: 'Неон', src: 'wheel' },
      { id: 'gold', name: 'Солнце', src: 'wheel' },
      { id: 'ice', name: 'Лёд', src: 'wheel' },
      { id: 'cosmos', name: 'Космос', src: 'wheel', rare: true },
      { id: 'flame', name: 'Пламя', src: 'wheel', rare: true },
      { id: 'lvl-silver', name: 'Серебро', src: 'level', lvl: 1 },
      { id: 'lvl-gold', name: 'Золото', src: 'level', lvl: 2 },
      { id: 'lvl-diamond', name: 'Алмаз', src: 'level', lvl: 4 }
    ],
    frameAnims: [['shine', 'Блеск'], ['pulse', 'Пульс'], ['orbit', 'Орбита'], ['none', 'Без анимации']]
  };
  var RECV = { city: 'Доставка через Авито (другой город или Москва)', courier: 'Курьер по Москве (согласовать с менеджером)', pickup: 'Самовывоз (Москва, Рублёвское шоссе, 16к1)' };
  var SHIP = { air: 'самолёт', truck: 'фура' };
  var PRE_RECV = { avito: 'Авито Доставка', cdek: 'СДЭК', meet: 'личная встреча (Москва)' };
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // ---------------------------------------------------------------- утилиты
  function ok(o) { o = o || {}; o.ok = true; return o; }
  function err(m) { return { ok: false, error: m }; }
  function msk(ms) { return new Date(ms + 3 * 3600000); }
  function dayKey(ms) { return msk(ms).toISOString().slice(0, 10); }
  function monthKey(ms) { return dayKey(ms).slice(0, 7); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function cleanLogin(s) { return String(s || '').trim().toLowerCase(); }
  function cleanTg(s) { return String(s || '').trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, ''); }
  function fmtPhone(s) {
    var d = digits(s);
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    if (d.length === 10) return '+7 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
    return String(s || '').trim();
  }
  function cleanEmail(s) { return String(s || '').trim().toLowerCase(); }
  function validEmail(e) { return /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 120; }
  function validTg(t) { return /^[A-Za-z0-9_]{4,32}$/.test(t); }
  // tasksFor(u) — по клиенту (учитывает уровень, закреплённый вручную); tasksFor(число) — по XP
  function tasksFor(x) { var li = (x && typeof x === 'object') ? levelOf(x).index : levelIndex(x); return RULES.tasks.filter(function (t) { return (t.lvl || 0) <= li; }); }
  function stagesFor(kind) { return kind === 'в наличии' ? RULES.stagesStock : RULES.stagesPre; }
  function phoneKey(s) { var d = digits(s); if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1); return d; }
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function tokensToRub(t) { return Math.round(t * RULES.tokenRub); }
  function levelIndex(xp) { var i = 0; for (var j = 0; j < RULES.levels.length; j++) if ((xp || 0) >= RULES.levels[j].min) i = j; return i; }
  function levelAt(i, xp, fixed) {
    var L = RULES.levels[i], N = RULES.levels[i + 1];
    return { index: i, key: L.key, name: L.name, min: L.min, next: N && !fixed ? { key: N.key, name: N.name, min: N.min, left: N.min - (xp || 0) } : null,
      perks: L.perks.map(function (x) { return x[0]; }), perkList: L.perks, fixed: !!fixed, tasks: L.tasks, streak: L.streak, spins: L.spins, priority: L.priority || '', pack: L.pack || '' };
  }
  function xpOfRub(r) { return Math.floor(Math.max(0, +r || 0) * RULES.xpPerRub); }
  function wheelFor(li) {
    var b = RULES.wheelBoost[li >= 4 ? 2 : li >= 3 ? 1 : 0] || {};
    return RULES.wheel.map(function (w) { return Math.max(0, w.w + (b[w.id] || 0)); });
  }
  function framesFor(u) {
    var li = levelOf(u).index, own = u.frames || [];
    return RULES.frames.filter(function (f) {
      if (f.id === 'base') return true;
      if (f.src === 'level') return li >= f.lvl;
      return own.indexOf(f.id) >= 0 || (li >= 4 && !f.rare);
    }).map(function (f) { return f.id; });
  }
  function pctText(p) { return String(p).replace('.', ','); }
  function activePromos(db, u) { var mk = monthKey(db.now()); return (u.promos || []).filter(function (p) { return !p.used && (!p.exp || p.exp === mk); }); }
  function promoCat(key) { return RULES.promoCats.filter(function (c) { return c.key === key; })[0] || null; }
  function levelInfo(xp) { return levelAt(levelIndex(xp), xp, false); }
  /* Уровень, закреплённый вручную в таблице (колонка «Уровень вручную»): название уровня или пусто/«авто». */
  function fixIndex(name) {
    var s = String(name || '').trim().toLowerCase().replace(/ё/g, 'е');
    if (!s || /^авто/.test(s)) return -1;
    for (var i = 0; i < RULES.levels.length; i++) {
      var names = [RULES.levels[i].name.toLowerCase().replace(/ё/g, 'е'), RULES.levels[i].key].concat(RULES.levels[i].alias || []);
      for (var j = 0; j < names.length; j++) { var n = names[j]; if (n === s || n.indexOf(s) === 0 || s.indexOf(n) === 0) return i; }
    }
    return -1;
  }
  function levelOf(u) {
    var f = fixIndex(u && u.levelFix);
    return f >= 0 ? levelAt(f, u.xp, true) : levelInfo(u && u.xp);
  }
  function genCode(db, prefix, len) {
    var s = prefix || '';
    for (var i = 0; i < (len || 6); i++) s += CODE_ABC.charAt(Math.floor(db.random() * CODE_ABC.length));
    return s;
  }
  function hashPass(db, salt, pass) { var h = salt + ':' + pass; for (var i = 0; i < 200; i++) h = db.hash(h + salt); return h; }
  function log(db, u, delta, reason) {
    u.balance = Math.max(0, (u.balance || 0) + delta);
    db.log({ at: db.now(), userId: u.id, login: u.login, delta: delta, reason: reason, balance: u.balance });
  }
  function adjustTokens(db, u, delta, reason) { touch(db, u); log(db, u, Math.round(+delta || 0), reason); return u; }
  function orderNo(db, seq) { return 'OS-' + String(msk(db.now()).getUTCFullYear()).slice(2) + '-' + pad(seq, 5); }

  // месяц сменился — XP обнуляется; задания — каждый день новые; бонусы уровня
  function touch(db, u) {
    var now = db.now(), mk = monthKey(now), dk = dayKey(now);
    if (u.xpMonth !== mk) { u.xpMonth = mk; u.xp = 0; }
    if (!u.tasks || u.tasks.day !== dk) u.tasks = { day: dk, done: [] };
    if (!u.promos) u.promos = [];
    if (!u.frames || !u.frames.length) u.frames = ['base'];
    grantPerks(db, u);
  }
  function addXp(db, u, n) { u.xp = (u.xp || 0) + Math.max(0, Math.round(n || 0)); grantPerks(db, u); }
  function grantPerks(db, u) {
    var L = levelOf(u), li = L.index, now = db.now(), mk = monthKey(now), dk = dayKey(now);
    // бесплатные прокруты дня: не копятся; при повышении уровня в тот же день — доливаем разницу
    if (u.spinDay !== dk) { u.spinDay = dk; u.daySpins = L.spins; u.daySpinsMax = L.spins; }
    else if (L.spins > (u.daySpinsMax || 0)) { u.daySpins = (u.daySpins || 0) + L.spins - (u.daySpinsMax || 0); u.daySpinsMax = L.spins; }
    // Золото: −1,5% на случайную категорию; Платина и выше: −1,5% на любой товар (раз в месяц)
    if (li >= 2) {
      var p15 = (u.promos || []).filter(function (p) { return p.kind === 'lvl15' && p.exp === mk; })[0];
      if (!p15) {
        var c = li >= 3 ? null : RULES.promoCats[Math.floor(db.random() * RULES.promoCats.length)];
        var pr = { code: genCode(db, li >= 3 ? 'PLAT' : 'GOLD', 5), pct: 1.5, kind: 'lvl15', exp: mk, from: li >= 3 ? 'Платина · любой товар' : 'Золото · ' + c.label, at: now };
        if (c) { pr.cat = c.key; pr.catLabel = c.label; }
        u.promos.push(pr); log(db, u, 0, 'Промокод −1,5%' + (c ? ' на «' + c.label + '»' : ' на любой товар') + ' за уровень ' + L.name);
      } else if (li >= 3 && p15.cat && !p15.used) {
        delete p15.cat; delete p15.catLabel; p15.from = 'Платина · любой товар';
        log(db, u, 0, 'Промокод ' + p15.code + ' теперь действует на любой товар (Платина)');
      }
    }
    // Алмаз: 3 промокода −2,5% в месяц, по одному в неделю
    if (li >= 4) {
      if (u.perkDiaMonth !== mk) { u.perkDiaMonth = mk; u.perkDiaN = 0; }
      if ((u.perkDiaN || 0) < 3 && (!u.perkDiaN || now - (+u.perkDiaAt || 0) >= 7 * 86400000)) {
        u.perkDiaN = (u.perkDiaN || 0) + 1; u.perkDiaAt = now;
        u.promos.push({ code: genCode(db, 'DIAM', 5), pct: 2.5, kind: 'lvl25', exp: mk, from: 'Алмаз · неделя ' + u.perkDiaN + ' из 3', at: now });
        log(db, u, 0, 'Промокод −2,5% за уровень Алмаз (' + u.perkDiaN + ' из 3)');
      }
    }
    // рамка, которой больше нет на этом уровне, снимается
    if (u.frame && u.frame !== 'base' && framesFor(u).indexOf(u.frame) < 0) u.frame = 'base';
  }
  function packInfo(db, u) {
    var L = levelOf(u); if (!L.pack) return null;
    var mk = monthKey(db.now());
    return { kind: L.pack, label: L.pack === 'free' ? 'Бесплатная упаковка' : 'Упаковка −10%', note: L.pack === 'free' ? 'Привилегия Алмаза: 1 раз в месяц, для любого заказа' : 'Привилегия Платины: 1 раз в месяц, только для заказа с предзаказом', level: L.name, available: u.packMonth !== mk };
  }
  function sessionUser(db, p) {
    if (!p || !p.session) return null;
    var s = db.getSession(p.session);
    if (!s || +s.exp < db.now()) return null;
    var u = db.getUser(s.userId);
    if (!u) return null;
    touch(db, u);
    return u;
  }
  function publicUser(db, u) {
    var today = dayKey(db.now());
    var orders = (db.listOrders(u.id, 30) || []).map(function (o) {
      var st = String(o.status || 'Оформлен');
      return { no: o.no, at: o.at, count: o.count, total: o.total, tokens: o.tokens, tokenRub: o.tokenRub, promo: o.promo || '', promoRub: o.promoRub, toPay: o.toPay, text: o.text, items: o.items || [], kind: o.kind || '', status: st, stages: stagesFor(o.kind), active: RULES.finalStages.indexOf(st) < 0 };
    });
    return {
      id: u.id, code: 'OS' + u.id, login: u.login, name: u.name, phone: u.phone, tg: u.tg, email: u.email || '', avatar: u.avatar || '',
      tasks: tasksFor(u).map(function (t) { return t.key; }),
      balance: u.balance || 0, balanceRub: tokensToRub(u.balance || 0),
      xp: u.xp || 0, level: levelOf(u), spent: u.spent || 0, ordersCount: u.ordersCount || 0, wheel: wheelFor(levelOf(u).index), pack: packInfo(db, u),
      streak: u.lastCheckin === today || u.lastCheckin === dayKey(db.now() - 86400000) ? (u.streak || 0) : 0,
      checkedToday: u.lastCheckin === today, tasksDone: (u.tasks && u.tasks.day === today) ? u.tasks.done.slice() : [],
      freeSpins: (u.daySpins || 0) + (u.freeSpins || 0), daySpins: u.daySpins || 0, daySpinsMax: u.daySpinsMax || 0, bonusSpins: u.freeSpins || 0,
      promos: activePromos(db, u).map(function (p) { return { code: p.code, pct: p.pct, from: p.from, cat: p.cat || '', catLabel: p.catLabel || '', exp: p.exp || '' }; }),
      frames: framesFor(u), frame: u.frame || 'base', frameAnim: u.frameAnim || 'shine',
      birthday: u.birthday || '', refCode: u.refCode, refCount: u.refCount || 0,
      createdAt: u.createdAt, orders: orders,
      canDelete: !orders.some(function (o) { return o.active; })
    };
  }
  function settings() {
    return {
      tokenRub: RULES.tokenRub, maxShare: RULES.maxShare, spinCost: RULES.spinCost, reward: RULES.reward, xpPerRub: RULES.xpPerRub, xpReward: RULES.xpReward,
      levels: RULES.levels, promoCats: RULES.promoCats, frameAnims: RULES.frameAnims, tasks: RULES.tasks, frames: RULES.frames, refMinOrder: RULES.refMinOrder,
      stagesPre: RULES.stagesPre, stagesStock: RULES.stagesStock, stageNotes: RULES.stageNotes,
      wheel: RULES.wheel.map(function (w) { return { id: w.id, label: w.label, sub: w.sub, w: w.w }; })
    };
  }
  function newSession(db, u) {
    var token = db.token();
    db.saveSession({ token: token, userId: u.id, exp: db.now() + RULES.sessionDays * 86400000 });
    return token;
  }

  // ---------------------------------------------------------------- действия
  var A = {};
  A.settings = function () { return ok({ settings: settings() }); };

  /* ---------- коды на почту: регистрация, восстановление пароля, смена почты ---------- */
  function makeCode(db) { var c = ''; for (var i = 0; i < 6; i++) c += String(Math.floor(db.random() * 10)); return c; }
  function codeKey(purpose, email) { return 'code:' + purpose + ':' + email; }
  function checkCode(db, purpose, email, code) {
    if (!db.getCode) return err('Коды на почту не настроены');
    var rec = db.getCode(codeKey(purpose, email));
    if (!rec || +rec.exp < db.now()) return err('Код устарел или не запрошен. Запросите новый');
    if ((rec.tries || 0) >= 5) { db.delCode(codeKey(purpose, email)); return err('Слишком много попыток. Запросите новый код'); }
    if (db.hash(rec.salt + ':' + String(code || '').trim()) !== rec.hash) {
      rec.tries = (rec.tries || 0) + 1; db.putCode(codeKey(purpose, email), rec, Math.max(1, Math.round((+rec.exp - db.now()) / 1000)));
      return err('Неверный код. Осталось попыток: ' + (5 - rec.tries));
    }
    db.delCode(codeKey(purpose, email));
    return null;
  }

  A.sendCode = function (db, p) {
    var purpose = String(p.purpose || ''), email = cleanEmail(p.email);
    if (['register', 'reset', 'email'].indexOf(purpose) < 0) return err('Неизвестный запрос');
    if (!validEmail(email)) return err('Проверьте почту, например name@mail.ru');
    if (!db.mail || !db.putCode) return err('Отправка писем пока не настроена. Напишите менеджеру');
    var u = null;
    if (purpose === 'register') { if (db.findUser('email', email)) return err('Эта почта уже привязана к аккаунту. Войдите или восстановите пароль'); }
    if (purpose === 'email') {
      u = sessionUser(db, p); if (!u) return err('auth');
      var other = db.findUser('email', email); if (other && other.id !== u.id) return err('Эта почта уже привязана к другому аккаунту');
    }
    if (purpose === 'reset') u = db.findUser('email', email);
    var lim = db.getCode('limit:' + email);
    if (lim && +lim.next > db.now()) return err('Код уже отправлен. Повторно можно через ' + Math.ceil((+lim.next - db.now()) / 1000) + ' с');
    var sent = { ok: true, sent: true, email: email };
    if (purpose === 'reset' && !u) { db.putCode('limit:' + email, { next: db.now() + 60000 }, 60); return sent; } // не выдаём, есть ли такая почта
    var code = makeCode(db), salt = db.token().slice(0, 12);
    db.putCode(codeKey(purpose, email), { hash: db.hash(salt + ':' + code), salt: salt, exp: db.now() + RULES.codeTtlMin * 60000, tries: 0 }, RULES.codeTtlMin * 60);
    db.putCode('limit:' + email, { next: db.now() + 60000 }, 60);
    var what = purpose === 'register' ? 'для регистрации' : purpose === 'reset' ? 'для восстановления пароля' : 'для подтверждения почты';
    var okSend = db.mail(email, 'Код ONION SHOP: ' + code, code, what, u ? u.login : '');
    if (!okSend) return err('Не получилось отправить письмо. Попробуйте позже или напишите менеджеру');
    if (db.demoCodes) sent.demoCode = code; // только в демо-режиме, на сервере код не возвращается
    return sent;
  };

  A.register = function (db, p) {
    var login = cleanLogin(p.login), pass = String(p.password || ''), name = String(p.name || '').trim();
    var tg = cleanTg(p.tg), ph = phoneKey(p.phone), email = cleanEmail(p.email);
    if (!/^[a-z0-9_.]{3,20}$/.test(login)) return err('Логин: от 3 до 20 символов — латиница, цифры, точка или «_»');
    if (pass.length < 6) return err('Пароль: не короче 6 символов');
    if (name.length < 2) return err('Укажите имя');
    if (!validEmail(email)) return err('Укажите почту, например name@mail.ru');
    if (ph.length < 10 || ph.length > 15) return err('Укажите телефон, например +7 900 000-00-00');
    if (tg && !validTg(tg)) return err('Username в Telegram: латиница, цифры и «_», от 4 символов. Если username нет, оставьте поле пустым');
    if (db.findUser('login', login)) return err('Такой логин уже занят');
    if (db.findUser('email', email)) return err('Эта почта уже привязана к аккаунту');
    if (tg && db.findUser('tg', tg.toLowerCase())) return err('Этот Telegram уже привязан к другому аккаунту');
    if (db.findUser('phone', ph)) return err('Этот телефон уже привязан к другому аккаунту');
    var bad = checkCode(db, 'register', email, p.code); if (bad) return bad;
    var ref = null;
    if (p.ref) { ref = db.findUser('refCode', String(p.ref).trim().toUpperCase()); }
    var refCode; do { refCode = genCode(db, '', 6); } while (db.findUser('refCode', refCode));
    var salt = db.token().slice(0, 16);
    var u = {
      login: login, name: name, email: email, emailKey: email, phone: fmtPhone(p.phone), phoneKey: ph, tg: tg, tgKey: tg ? tg.toLowerCase() : '',
      salt: salt, hash: hashPass(db, salt, pass), balance: 0, xp: 0, xpMonth: monthKey(db.now()), spent: 0, ordersCount: 0,
      streak: 0, lastCheckin: '', freeSpins: 0, refCode: refCode, referredBy: ref ? ref.id : '', refCount: 0, refMonth: '', refMonthCount: 0,
      refRewarded: false, birthday: '', bdayYear: '', frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: db.now()
    };
    u = db.createUser(u);
    touch(db, u);
    log(db, u, RULES.reward.register, 'Регистрация');
    if (ref) log(db, u, RULES.reward.refFriend, 'Бонус по приглашению от ' + ref.login);
    if (db.registerBonus) log(db, u, db.registerBonus, 'Демо-токены для проверки');
    db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u), welcome: RULES.reward.register + (ref ? RULES.reward.refFriend : 0) });
  };

  A.resetPassword = function (db, p) {
    var email = cleanEmail(p.email), pass = String(p.password || '');
    if (!validEmail(email)) return err('Проверьте почту');
    if (pass.length < 6) return err('Новый пароль: не короче 6 символов');
    var bad = checkCode(db, 'reset', email, p.code); if (bad) return bad;
    var u = db.findUser('email', email); if (!u) return err('Аккаунт не найден');
    u.salt = db.token().slice(0, 16); u.hash = hashPass(db, u.salt, pass);
    if (db.deleteSessionsOf) db.deleteSessionsOf(u.id);
    touch(db, u); db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u) });
  };

  A.setEmail = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var email = cleanEmail(p.email); if (!validEmail(email)) return err('Проверьте почту');
    var other = db.findUser('email', email); if (other && other.id !== u.id) return err('Эта почта уже привязана к другому аккаунту');
    var bad = checkCode(db, 'email', email, p.code); if (bad) return bad;
    u.email = email; u.emailKey = email; db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };

  A.changePassword = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (hashPass(db, u.salt, String(p.old || '')) !== u.hash) return err('Текущий пароль неверный');
    var pass = String(p.password || ''); if (pass.length < 6) return err('Новый пароль: не короче 6 символов');
    u.salt = db.token().slice(0, 16); u.hash = hashPass(db, u.salt, pass); db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };

  A.deleteAccount = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (hashPass(db, u.salt, String(p.password || '')) !== u.hash) return err('Неверный пароль');
    var active = (db.listOrders(u.id, 200) || []).filter(function (o) { return RULES.finalStages.indexOf(String(o.status || 'Оформлен')) < 0; });
    if (active.length) return err('Удалить аккаунт можно, когда нет активных заказов. Сейчас активных: ' + active.length);
    db.log({ at: db.now(), userId: u.id, login: u.login, delta: -(u.balance || 0), reason: 'Аккаунт удалён клиентом', balance: 0 });
    if (db.deleteSessionsOf) db.deleteSessionsOf(u.id);
    db.deleteUser(u);
    return ok({ deleted: true });
  };

  A.login = function (db, p) {
    var login = cleanLogin(p.login);
    if (db.rateLimited && db.rateLimited(login)) return err('Слишком много попыток. Подождите 15 минут');
    var u = db.findUser('login', login) || (login.indexOf('@') > 0 ? db.findUser('email', login) : null) || (login.charAt(0) === '@' ? db.findUser('tg', login.slice(1)) : null);
    if (!u || hashPass(db, u.salt, String(p.password || '')) !== u.hash) {
      if (db.failedLogin) db.failedLogin(login);
      return err('Неверный логин или пароль');
    }
    touch(db, u); db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u) });
  };

  A.logout = function (db, p) { if (p.session) db.deleteSession(p.session); return ok(); };

  A.me = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    db.saveUser(u);
    return ok({ user: publicUser(db, u), settings: settings() });
  };

  A.profile = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (p.name != null) { var n = String(p.name).trim(); if (n.length < 2) return err('Укажите имя'); u.name = n; }
    if (p.phone != null) {
      var ph = phoneKey(p.phone); if (ph.length < 10 || ph.length > 15) return err('Проверьте телефон');
      var other = db.findUser('phone', ph); if (other && other.id !== u.id) return err('Этот телефон уже привязан к другому аккаунту');
      u.phone = fmtPhone(p.phone); u.phoneKey = ph;
    }
    if (p.tg != null) {
      var tg = cleanTg(p.tg);
      if (tg) {
        if (!validTg(tg)) return err('Проверьте username в Telegram');
        var o2 = db.findUser('tg', tg.toLowerCase()); if (o2 && o2.id !== u.id) return err('Этот Telegram уже привязан к другому аккаунту');
      }
      u.tg = tg; u.tgKey = tg ? tg.toLowerCase() : '';
    }
    if (p.avatar != null) {
      var av = String(p.avatar);
      if (av && (av.length > 45000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(av))) return err('Фото не подошло. Выберите другое (JPG или PNG)');
      u.avatar = av;
    }
    if (p.frame != null) { if (framesFor(u).indexOf(p.frame) < 0) return err('Эта рамка ещё не открыта'); u.frame = p.frame; }
    if (p.frameAnim != null) {
      if (levelOf(u).index < 4) return err('Анимация рамки доступна на уровне Алмаз');
      if (!RULES.frameAnims.some(function (a) { return a[0] === p.frameAnim; })) return err('Нет такой анимации');
      u.frameAnim = p.frameAnim;
    }
    if (p.birthday != null) {
      if (u.birthday) return err('Дату рождения можно указать только один раз');
      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(p.birthday)) return err('Проверьте дату рождения');
      u.birthday = p.birthday;
      u.bdayYear = String(msk(db.now()).getUTCFullYear()); // в этом году не начисляем задним числом
    }
    db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };

  A.checkin = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var now = db.now(), today = dayKey(now), yest = dayKey(now - 86400000);
    if (u.lastCheckin === today) return err('Сегодня вы уже отмечались');
    u.streak = u.lastCheckin === yest ? (u.streak || 0) + 1 : 1;
    u.lastCheckin = today;
    var got = RULES.reward.checkin;
    log(db, u, got, 'Ежедневный вход');
    addXp(db, u, RULES.xpReward.checkin);
    if (u.tasks.done.indexOf('checkin') < 0) u.tasks.done.push('checkin');
    var extra = [];
    if (u.streak % 7 === 0) { var sr = levelOf(u).streak; log(db, u, sr, 'Серия 7 дней (' + levelOf(u).name + ')'); got += sr; extra.push('серия 7 дней +' + sr); }
    var year = String(msk(now).getUTCFullYear());
    if (u.birthday && u.birthday === today.slice(5) && u.bdayYear !== year) {
      u.bdayYear = year; log(db, u, RULES.reward.birthday, 'С днём рождения!'); got += RULES.reward.birthday; extra.push('день рождения +' + RULES.reward.birthday);
    }
    db.saveUser(u);
    return ok({ got: got, xp: RULES.xpReward.checkin, extra: extra, user: publicUser(db, u) });
  };

  A.task = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var t = tasksFor(u).filter(function (x) { return x.key === p.task && x.key !== 'checkin'; })[0];
    if (!t) return err('Это задание откроется на следующем уровне');
    if (u.tasks.done.indexOf(t.key) >= 0) return ok({ got: 0, user: publicUser(db, u) });
    var got = t.reward;
    u.tasks.done.push(t.key);
    log(db, u, got, 'Задание: ' + t.title);
    addXp(db, u, RULES.xpReward.task);
    db.saveUser(u);
    return ok({ got: got, xp: RULES.xpReward.task, title: t.title, user: publicUser(db, u) });
  };

  A.spin = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var free = !!p.free && ((u.daySpins || 0) + (u.freeSpins || 0)) > 0;
    if (!free && (u.balance || 0) < RULES.spinCost) return err('Не хватает токенов: нужно ' + RULES.spinCost);
    if (free) { if ((u.daySpins || 0) > 0) u.daySpins -= 1; else u.freeSpins -= 1; } else log(db, u, -RULES.spinCost, 'Прокрут рулетки');
    var W = wheelFor(levelOf(u).index), sumW = W.reduce(function (a, w) { return a + w; }, 0);
    var total = 0, r = db.random() * sumW, idx = 0;
    for (var i = 0; i < W.length; i++) { total += W[i]; if (r < total) { idx = i; break; } }
    var prize = RULES.wheel[idx], result = { id: prize.id, label: prize.label, sub: prize.sub };
    if (prize.tokens) { log(db, u, prize.tokens, 'Рулетка: ' + prize.label + ' ' + prize.sub); result.tokens = prize.tokens; }
    if (prize.xp) { addXp(db, u, prize.xp); result.xp = prize.xp; }
    if (prize.spins) { u.freeSpins = (u.freeSpins || 0) + prize.spins; result.spins = prize.spins; }
    if (prize.promo) { var code = genCode(db, 'LUCK', 5); u.promos.push({ code: code, pct: prize.promo, from: 'Рулетка', at: db.now() }); result.code = code; result.pct = prize.promo; }
    if (prize.frame) {
      var left = RULES.frames.filter(function (f) { return f.src === 'wheel' && u.frames.indexOf(f.id) < 0; });
      if (left.length) { var f = left[Math.floor(db.random() * left.length)]; u.frames.push(f.id); result.frameId = f.id; result.frameName = f.name; }
      else { log(db, u, 50, 'Рулетка: все рамки уже открыты'); result.tokens = 50; result.sub = 'все рамки открыты: +50 токенов'; }
    }
    db.saveUser(u);
    return ok({ prize: result, index: idx, user: publicUser(db, u) });
  };

  // ---------------------------------------------------------------- заказ
  function checkFields(f, hasStock, hasPre) {
    if (String(f.name || '').trim().length < 2) return 'Укажите имя';
    var d = digits(f.phone); if (d.length < 10 || d.length > 15) return 'Укажите телефон';
    var tgv = cleanTg(f.tg); if (tgv && !validTg(tgv)) return 'Проверьте username в Telegram или оставьте поле пустым';
    if (hasStock) { if (!RECV[f.recv]) return 'Выберите способ получения'; if (f.recv === 'city' && String(f.recvCity || '').trim().length < 2) return 'Укажите город'; }
    if (hasPre) {
      if (!SHIP[f.ship]) return 'Выберите способ отправки из Китая';
      if (String(f.city || '').trim().length < 2) return 'Укажите город для предзаказа';
      if (!PRE_RECV[f.preRecv]) return 'Выберите способ получения предзаказа';
      if (f.ack !== true) return 'Подтвердите, что прочитали условия предзаказа';
    }
    return null;
  }
  function whenText(ms) { var d = msk(ms); return pad(d.getUTCDate(), 2) + '.' + pad(d.getUTCMonth() + 1, 2) + '.' + d.getUTCFullYear() + ', ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ' (МСК)'; }

  /** Текст заказа для менеджера. o: {no, at, f (поля анкеты), lines:[{title,status,size,color,photoNo,note,qty,price,link}], total, tokens, tokenRub, promo, promoRub, toPay, user} */
  function orderText(o) {
    var f = o.f, L = [], hasPre = false, hasStock = false, cnt = 0;
    L.push('🛍 ЗАКАЗ ONION SHOP · №' + o.no);
    if (o.priority) L.push('⭐ ПРИОРИТЕТ: ' + o.priority.toUpperCase() + ' (уровень ' + o.user.levelName + ')');
    L.push('📅 ' + whenText(o.at));
    L.push('');
    L.push('👤 ПОКУПАТЕЛЬ');
    L.push('Имя: ' + String(f.name).trim());
    L.push('Телефон: ' + fmtPhone(f.phone));
    L.push(cleanTg(f.tg) ? 'Telegram: @' + cleanTg(f.tg) : 'Telegram: нет username — связаться по телефону');
    if (o.user) L.push('Аккаунт: ' + o.user.login + ' · ID OS' + o.user.id + ' · уровень «' + o.user.levelName + '»');
    L.push('');
    L.push('📦 ТОВАРЫ');
    o.lines.forEach(function (l, i) {
      if (l.status === 'preorder') hasPre = true; else hasStock = true;
      cnt += l.qty;
      L.push((i + 1) + '. ' + l.title + (l.status === 'preorder' ? ' — ПРЕДЗАКАЗ' : ' — в наличии'));
      var opt = [];
      if (l.size) opt.push('Размер: ' + l.size);
      if (l.color) opt.push('Цвет: ' + l.color);
      if (l.photoNo) opt.push('фото №' + l.photoNo);
      if (opt.length) L.push('   ' + opt.join(' · '));
      if (l.note) L.push('   Пожелания: ' + l.note);
      L.push('   ' + l.qty + ' шт × ' + rub(l.price) + ' = ' + rub(l.price * l.qty));
      if (l.link) L.push('   ' + l.link);
    });
    L.push('');
    L.push('💰 Сумма: ' + rub(o.total) + ' · ' + cnt + ' шт');
    if (o.tokens) L.push('🪙 Списано токенов: ' + o.tokens + ' (−' + rub(o.tokenRub) + ')');
    if (o.promo) L.push('🏷 Промокод ' + o.promo + (o.promoNote ? ' (' + o.promoNote + ')' : '') + ': −' + rub(o.promoRub));
    if (o.pack) L.push('🎁 ПРИВИЛЕГИЯ: ' + o.pack + ' — учесть при расчёте упаковки');
    L.push('✅ К ОПЛАТЕ: ' + rub(o.toPay));
    if (hasPre) L.push('(доставка из Китая оплачивается отдельно по весу)');
    L.push('');
    if (hasStock) {
      var r = '🚚 ПОЛУЧЕНИЕ' + (hasPre ? ' (товары в наличии)' : '') + ': ' + RECV[f.recv];
      if (f.recv === 'city') r += ', город: ' + String(f.recvCity).trim();
      if (f.recv === 'courier' && String(f.recvAddr || '').trim()) r += ', адрес: ' + String(f.recvAddr).trim();
      L.push(r);
    }
    if (hasPre) {
      L.push('✈️ ПРЕДЗАКАЗ: отправка из Китая — ' + SHIP[f.ship] + ', город — ' + String(f.city).trim() + ', получение — ' + PRE_RECV[f.preRecv]);
      L.push('☑️ С условиями предзаказа ознакомлен(а)');
    }
    if (String(f.comment || '').trim()) { L.push(''); L.push('💬 Комментарий: ' + String(f.comment).trim()); }
    return L.join('\n');
  }

  /** Собирает и проверяет строки заказа. items: [{id, size, color, photo, qty, note, title, price, status, link, photos}] */
  function buildLines(db, items) {
    var lines = [], unverified = false, gone = [];
    (items || []).forEach(function (it) {
      var qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
      var prod = db.product ? db.product(String(it.id)) : null;
      if (!prod) {
        if (db.catalogReady && db.catalogReady()) { gone.push(it.title || it.id); return; }
        unverified = true;
        prod = { id: it.id, title: String(it.title || 'Товар ' + it.id), price: Math.max(0, parseInt(it.price, 10) || 0), status: it.status === 'preorder' ? 'preorder' : 'stock', link: it.link || '', photos: [] };
      }
      var photoNo = 0;
      if (it.photo && prod.photos) { for (var i = 0; i < prod.photos.length; i++) if (String(prod.photos[i].id) === String(it.photo)) photoNo = i + 1; }
      if (!photoNo && it.photoNo) photoNo = parseInt(it.photoNo, 10) || 0;
      lines.push({ id: String(prod.id), title: prod.title, status: prod.status, category: prod.category || it.category || '', size: it.size ? String(it.size).slice(0, 40) : '', color: it.color ? String(it.color).slice(0, 60) : '', photoNo: photoNo, photo: it.photo || null, note: String(it.note || '').slice(0, 300), qty: qty, price: prod.price, link: prod.link || '', thumb: (prod.photos && prod.photos[0] ? prod.photos[0].id : it.thumb) || null });
    });
    return { lines: lines, unverified: unverified, gone: gone };
  }

  /* Скидка по промокоду: личный промокод категории (cat) считается только с товаров этой категории */
  function promoBase(lines, cat) {
    var c = cat ? promoCat(cat) : null, sum = 0;
    lines.forEach(function (l) { if (!c || c.cats.indexOf(l.category) >= 0) sum += l.price * l.qty; });
    return sum;
  }

  /* Промокоды магазина (лист «Промокоды» в таблице): код, %, срок, вкл/выкл, с токенами, раз на клиента, лимит. */
  function checkShopPromo(db, code, u, phone, tokens) {
    var sp = db.shopPromo ? db.shopPromo(code) : null;
    if (!sp || !sp.active || !(sp.pct > 0)) return { error: 'Промокод не найден' };
    if (sp.until && db.now() > sp.until) return { error: 'Срок промокода ' + code + ' закончился' };
    if (tokens > 0 && sp.withTokens === false) return { error: 'Промокод ' + code + ' нельзя совмещать с токенами. Уберите списание токенов' };
    var uses = db.promoUses ? db.promoUses(code) : null;
    if (uses) {
      if (sp.limit > 0 && uses.total >= sp.limit) return { error: 'Промокод ' + code + ' уже закончился' };
      if (sp.once) {
        var pk = phoneKey(phone);
        if ((u && uses.users.indexOf(String(u.id)) >= 0) || (pk && uses.phones.indexOf(pk) >= 0)) return { error: 'Вы уже использовали промокод ' + code };
      }
    }
    return { code: code, pct: sp.pct, withTokens: sp.withTokens !== false, until: sp.until || null };
  }

  // предпросмотр промокода в корзине (ничего не списывает)
  A.checkPromo = function (db, p) {
    var code = String(p.promo || '').trim().toUpperCase();
    if (!code) return err('Введите промокод');
    var u = sessionUser(db, p);
    var own = u ? activePromos(db, u).filter(function (x) { return x.code === code; })[0] : null;
    if (own) return ok({ promo: { code: own.code, pct: own.pct, withTokens: true, personal: true, cat: own.cat || '', catLabel: own.catLabel || '' } });
    var sp = checkShopPromo(db, code, u, p.phone, parseInt(p.useTokens, 10) || 0);
    if (sp.error) return err(sp.error);
    return ok({ promo: sp });
  };

  A.order = function (db, p) {
    var f = p.form || {};
    // заказ — только из кабинета: без входа в аккаунт оформить нельзя (db.allowGuest — только для автотестов)
    if (!db.allowGuest && !sessionUser(db, p)) return { ok: false, error: 'Чтобы оформить заказ, войдите в кабинет или создайте его', needAccount: true };
    var built = buildLines(db, p.items);
    if (built.gone.length) return err('Уже продано: ' + built.gone.join(', ') + '. Уберите из корзины и попробуйте снова');
    if (!built.lines.length) return err('Корзина пуста');
    var hasPre = built.lines.some(function (l) { return l.status === 'preorder'; });
    var hasStock = built.lines.some(function (l) { return l.status !== 'preorder'; });
    var bad = checkFields(f, hasStock, hasPre); if (bad) return err(bad);
    var total = 0, cnt = 0;
    built.lines.forEach(function (l) { total += l.price * l.qty; cnt += l.qty; });
    var u = sessionUser(db, p), tokens = 0, tokenRub = 0, promo = '', promoRub = 0, promoNote = '', pack = '';
    if (u) {
      var maxTok = Math.min(u.balance || 0, Math.floor(total * RULES.maxShare / RULES.tokenRub));
      tokens = Math.max(0, Math.min(maxTok, parseInt(p.useTokens, 10) || 0));
      tokenRub = tokensToRub(tokens);
    }
    var promoCode = String(p.promo || '').trim().toUpperCase();
    if (promoCode) {
      var pr = u ? activePromos(db, u).filter(function (x) { return x.code === promoCode; })[0] : null;
      if (pr) {
        var base = promoBase(built.lines, pr.cat);
        if (!base) return err('Промокод ' + pr.code + ' действует только на категорию «' + pr.catLabel + '» — в корзине таких товаров нет');
        promo = pr.code; promoRub = Math.round(base * pr.pct / 100); promoNote = pr.cat ? '−' + pctText(pr.pct) + '% на «' + pr.catLabel + '»' : '';
        pr.used = true; pr.usedAt = db.now();
      } else {
        var sp = checkShopPromo(db, promoCode, u, f.phone, tokens);
        if (sp.error) return err(sp.error);
        promo = sp.code; promoRub = Math.round(total * sp.pct / 100);
      }
    }
    var toPay = Math.max(0, total - tokenRub - promoRub);
    var seq = db.nextOrderSeq();
    var no = orderNo(db, seq), at = db.now();
    var li = u ? levelOf(u) : null, priority = li && li.priority ? li.priority : '';
    var pk = u ? packInfo(db, u) : null;
    if (pk && pk.available && p.usePack !== false && (pk.kind === 'free' || hasPre)) { pack = pk.label + ' (' + pk.level + ')'; u.packMonth = monthKey(at); }
    var text = orderText({ no: no, at: at, f: f, lines: built.lines, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, promoNote: promoNote, pack: pack, priority: priority, toPay: toPay, user: u ? { login: u.login, id: u.id, levelName: li.name } : null });
    if (built.unverified) text += '\n\n⚠️ Каталог был недоступен — цены взяты с сайта, проверьте.';
    if (u) {
      if (tokens) log(db, u, -tokens, 'Оплата заказа №' + no);
      // сумма идёт в уровень и в «Потрачено всего» только когда заказ получен (статус «Получен» — см. receive)
      u.ordersCount = (u.ordersCount || 0) + 1;
      if (u.referredBy && !u.refRewarded && total >= RULES.refMinOrder) {
        u.refRewarded = true;
        var ref = db.getUser(u.referredBy);
        if (ref) {
          touch(db, ref);
          var mk = monthKey(at);
          if (ref.refMonth !== mk) { ref.refMonth = mk; ref.refMonthCount = 0; }
          if ((ref.refMonthCount || 0) < RULES.refMaxPerMonth) {
            ref.refMonthCount = (ref.refMonthCount || 0) + 1; ref.refCount = (ref.refCount || 0) + 1;
            log(db, ref, RULES.reward.referrer, 'Приглашённый друг @' + u.login + ' сделал заказ');
            db.saveUser(ref);
          }
        }
      }
      db.saveUser(u);
    }
    var order = {
      no: no, seq: seq, at: at, userId: u ? u.id : '', login: u ? u.login : '', name: String(f.name).trim(), phone: fmtPhone(f.phone), tg: cleanTg(f.tg) ? '@' + cleanTg(f.tg) : '', status: 'Оформлен',
      items: built.lines.map(function (l) { return { id: l.id, title: l.title, qty: l.qty, price: l.price, size: l.size, color: l.color, photo: l.photo, thumb: l.thumb, status: l.status }; }),
      count: cnt, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, toPay: toPay, priority: priority || (u ? 'Обычный' : ''), pack: pack, level: li ? li.name : '',
      kind: hasPre && hasStock ? 'смешанный' : hasPre ? 'предзаказ' : 'в наличии', comment: String(f.comment || '').trim(), text: text
    };
    db.saveOrder(order);
    var notified = false;
    try { notified = db.notify ? !!db.notify(text) : false; } catch (e) { notified = false; }
    return ok({ order: order, notified: notified, user: u ? publicUser(db, u) : null });
  };

  /* Заказ получен (sign = 1) или статус «Получен» сняли (sign = -1).
     Сумма «К оплате» даёт XP (1 XP за 10 ₽) в уровень месяца и идёт в «Потрачено всего».
     month — месяц, в котором сумму засчитали: при отмене из уровня вычитаем, только если месяц тот же. */
  function receive(db, u, amount, sign, month) {
    touch(db, u);
    amount = Math.max(0, Math.round(+amount || 0));
    var xp = xpOfRub(amount);
    if (sign > 0) {
      u.spent = (u.spent || 0) + amount;
      addXp(db, u, xp);
    } else {
      u.spent = Math.max(0, (u.spent || 0) - amount);
      if (!month || month === u.xpMonth) u.xp = Math.max(0, (u.xp || 0) - xp);
    }
    return u;
  }

  // без сервера: номер из даты и случайных символов (повтор практически невозможен)
  function offlineNo(ms, rnd) {
    var d = msk(ms), s = '';
    for (var i = 0; i < 3; i++) s += CODE_ABC.charAt(Math.floor(rnd() * CODE_ABC.length));
    return 'OS-' + pad(d.getUTCDate(), 2) + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCHours(), 2) + pad(d.getUTCMinutes(), 2) + '-' + s;
  }

  function handle(action, p, db) {
    if (!A[action]) return err('Неизвестное действие');
    return A[action](db, p || {});
  }

  return {
    RULES: RULES, handle: handle, orderText: orderText, buildLines: buildLines, checkFields: checkFields,
    offlineNo: offlineNo, levelInfo: levelInfo, levelOf: levelOf, fixIndex: fixIndex, receive: receive, adjustTokens: adjustTokens, xpOfRub: xpOfRub, wheelFor: wheelFor, framesFor: framesFor, pctText: pctText, promoBase: promoBase, touch: touch, tokensToRub: tokensToRub, settings: settings, dayKey: dayKey, monthKey: monthKey,
    cleanTg: cleanTg, cleanEmail: cleanEmail, phoneKey: phoneKey, fmtPhone: fmtPhone, digits: digits, validEmail: validEmail, tasksFor: tasksFor, stagesFor: stagesFor
  };
})();
if (typeof module !== 'undefined') module.exports = OnionCore;
