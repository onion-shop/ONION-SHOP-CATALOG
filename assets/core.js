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
    levels: [
      { key: 'novice', name: 'Новичок', min: 0, perks: ['4 задания в день и рулетка'] },
      { key: 'fashion', name: 'Модник', min: 5000, perks: ['+1 задание в день'] },
      { key: 'pro', name: 'Профи', min: 15000, perks: ['+1 задание в день', 'Бесплатный прокрут рулетки каждый месяц'] },
      { key: 'expert', name: 'Эксперт', min: 40000, perks: ['+1 задание в день', '−10% на упаковку'] },
      { key: 'icon', name: 'Икона стиля', min: 80000, perks: ['+1 задание в день', 'Бесплатная упаковка 1 раз в месяц', '3 подарочных промокода −5% каждый месяц'] }
    ],
    // задания дня: lvl — с какого уровня открывается (у Новичка 4, каждый уровень +1)
    tasks: [
      { key: 'checkin', title: 'Зайти на сайт', hint: 'Отметьтесь сегодня', reward: 1, lvl: 0 },
      { key: 'view3', title: 'Посмотреть 3 товара', hint: 'Откройте три карточки', reward: 1, lvl: 0 },
      { key: 'fav', title: 'Добавить товар в избранное', hint: 'Нажмите ♡ на товаре', reward: 1, lvl: 0 },
      { key: 'share', title: 'Поделиться товаром', hint: 'Кнопка «Поделиться» в карточке', reward: 1, lvl: 0 },
      { key: 'pre', title: 'Открыть раздел «Предзаказ»', hint: 'Загляните, что едет из Китая', reward: 1, lvl: 1 },
      { key: 'view5', title: 'Посмотреть 5 товаров', hint: 'Откройте пять карточек', reward: 1, lvl: 2 },
      { key: 'info', title: 'Прочитать «Доставку и оплату»', hint: 'Раздел с условиями', reward: 1, lvl: 3 },
      { key: 'cart', title: 'Положить товар в корзину', hint: 'Любой товар', reward: 1, lvl: 4 }
    ],
    // рулетка: веса из 200 (шанс = вес / 2 %). Приз в 65% прокрутов, «Пусто» — 35%
    wheel: [
      { id: 'none', label: 'Пусто', sub: 'в другой раз', w: 70 },
      { id: 't50', label: '+50', sub: 'токенов', w: 48, tokens: 50 },
      { id: 't100', label: '+100', sub: 'токенов', w: 26, tokens: 100 },
      { id: 't200', label: '+200', sub: 'токенов', w: 10, tokens: 200 },
      { id: 't500', label: '+500', sub: 'токенов', w: 3, tokens: 500 },
      { id: 'jackpot', label: 'Повезло!', sub: '+2000 токенов', w: 1, tokens: 2000 },
      { id: 'xp', label: '+300', sub: 'к уровню', w: 18, xp: 300 },
      { id: 'frame', label: 'Рамка', sub: 'для аватара', w: 10, frame: true },
      { id: 'promo', label: '−3%', sub: 'промокод', w: 4, promo: 3 },
      { id: 're1', label: 'Ещё раз', sub: '×1', w: 8, spins: 1 },
      { id: 're2', label: 'Ещё раз', sub: '×2', w: 2, spins: 2 }
    ],
    // статусы заказа (меняются в таблице, клиент видит их в «Моих заказах»)
    stagesPre: ['Оформлен', 'Выкуплен', 'В пути', 'На складе', 'Едет к нам', 'Едет к вам', 'Получен'],
    stagesStock: ['Оформлен', 'Едет к вам', 'Получен'],
    stageNotes: { 'Оформлен': 'Заказ принят менеджером', 'Выкуплен': 'Оплачен поставщику', 'В пути': 'Поставщик везёт на склад в Китае', 'На складе': 'Проверка и фотоотчёт на складе', 'Едет к нам': 'Из Китая в Москву', 'Едет к вам': 'Передан в доставку', 'Получен': 'Заказ у вас', 'Отменён': 'Заказ отменён' },
    finalStages: ['Получен', 'Отменён'],
    codeTtlMin: 15,
    frames: [
      { id: 'base', name: 'Обычная' },
      { id: 'neon', name: 'Неон' },
      { id: 'gold', name: 'Золото' },
      { id: 'ice', name: 'Лёд' },
      { id: 'cosmos', name: 'Космос' },
      { id: 'flame', name: 'Пламя' }
    ]
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
  function tasksFor(xp) { var li = levelIndex(xp); return RULES.tasks.filter(function (t) { return (t.lvl || 0) <= li; }); }
  function stagesFor(kind) { return kind === 'в наличии' ? RULES.stagesStock : RULES.stagesPre; }
  function phoneKey(s) { var d = digits(s); if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1); return d; }
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function tokensToRub(t) { return Math.round(t * RULES.tokenRub); }
  function levelIndex(xp) { var i = 0; for (var j = 0; j < RULES.levels.length; j++) if ((xp || 0) >= RULES.levels[j].min) i = j; return i; }
  function levelInfo(xp) {
    var i = levelIndex(xp), L = RULES.levels[i], N = RULES.levels[i + 1];
    var perks = [];
    for (var k = 0; k <= i; k++) perks = perks.concat(RULES.levels[k].perks);
    return { index: i, key: L.key, name: L.name, min: L.min, next: N ? { name: N.name, min: N.min, left: N.min - (xp || 0) } : null, perks: perks, own: L.perks };
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
  function grantPerks(db, u) {
    var li = levelIndex(u.xp), mk = u.xpMonth;
    if (li >= 2 && u.perkSpinMonth !== mk) { u.freeSpins = (u.freeSpins || 0) + 1; u.perkSpinMonth = mk; log(db, u, 0, 'Бесплатный прокрут за уровень Профи'); }
    if (li >= 4 && u.perkIconMonth !== mk) {
      for (var i = 0; i < 3; i++) u.promos.push({ code: genCode(db, 'ICON', 5), pct: 5, from: 'Икона стиля', at: db.now() });
      u.perkIconMonth = mk; log(db, u, 0, '3 промокода −5% за уровень Икона стиля');
    }
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
      tasks: tasksFor(u.xp).map(function (t) { return t.key; }),
      balance: u.balance || 0, balanceRub: tokensToRub(u.balance || 0),
      xp: u.xp || 0, level: levelInfo(u.xp), spent: u.spent || 0, ordersCount: u.ordersCount || 0,
      streak: u.lastCheckin === today || u.lastCheckin === dayKey(db.now() - 86400000) ? (u.streak || 0) : 0,
      checkedToday: u.lastCheckin === today, tasksDone: (u.tasks && u.tasks.day === today) ? u.tasks.done.slice() : [],
      freeSpins: u.freeSpins || 0,
      promos: (u.promos || []).filter(function (p) { return !p.used; }),
      frames: u.frames || ['base'], frame: u.frame || 'base',
      birthday: u.birthday || '', refCode: u.refCode, refCount: u.refCount || 0,
      createdAt: u.createdAt, orders: orders,
      canDelete: !orders.some(function (o) { return o.active; })
    };
  }
  function settings() {
    return {
      tokenRub: RULES.tokenRub, maxShare: RULES.maxShare, spinCost: RULES.spinCost, reward: RULES.reward,
      levels: RULES.levels, tasks: RULES.tasks, frames: RULES.frames, refMinOrder: RULES.refMinOrder,
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
    if (p.frame != null) { if ((u.frames || []).indexOf(p.frame) < 0) return err('Эта рамка ещё не открыта'); u.frame = p.frame; }
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
    if (u.tasks.done.indexOf('checkin') < 0) u.tasks.done.push('checkin');
    var extra = [];
    if (u.streak % 7 === 0) { log(db, u, RULES.reward.streak7, 'Серия 7 дней'); got += RULES.reward.streak7; extra.push('серия 7 дней +' + RULES.reward.streak7); }
    var year = String(msk(now).getUTCFullYear());
    if (u.birthday && u.birthday === today.slice(5) && u.bdayYear !== year) {
      u.bdayYear = year; log(db, u, RULES.reward.birthday, 'С днём рождения!'); got += RULES.reward.birthday; extra.push('день рождения +' + RULES.reward.birthday);
    }
    db.saveUser(u);
    return ok({ got: got, extra: extra, user: publicUser(db, u) });
  };

  A.task = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var t = tasksFor(u.xp).filter(function (x) { return x.key === p.task && x.key !== 'checkin'; })[0];
    if (!t) return err('Это задание откроется на следующем уровне');
    if (u.tasks.done.indexOf(t.key) >= 0) return ok({ got: 0, user: publicUser(db, u) });
    var got = t.reward;
    u.tasks.done.push(t.key);
    log(db, u, got, 'Задание: ' + t.title);
    db.saveUser(u);
    return ok({ got: got, title: t.title, user: publicUser(db, u) });
  };

  A.spin = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var free = !!p.free && (u.freeSpins || 0) > 0;
    if (!free && (u.balance || 0) < RULES.spinCost) return err('Не хватает токенов: нужно ' + RULES.spinCost);
    if (free) u.freeSpins -= 1; else log(db, u, -RULES.spinCost, 'Прокрут рулетки');
    var sumW = RULES.wheel.reduce(function (a, w) { return a + w.w; }, 0);
    var total = 0, r = db.random() * sumW, idx = 0;
    for (var i = 0; i < RULES.wheel.length; i++) { total += RULES.wheel[i].w; if (r < total) { idx = i; break; } }
    var prize = RULES.wheel[idx], result = { id: prize.id, label: prize.label, sub: prize.sub };
    if (prize.tokens) { log(db, u, prize.tokens, 'Рулетка: ' + prize.label + ' ' + prize.sub); result.tokens = prize.tokens; }
    if (prize.xp) { u.xp = (u.xp || 0) + prize.xp; grantPerks(db, u); result.xp = prize.xp; }
    if (prize.spins) { u.freeSpins = (u.freeSpins || 0) + prize.spins; result.spins = prize.spins; }
    if (prize.promo) { var code = genCode(db, 'LUCK', 5); u.promos.push({ code: code, pct: prize.promo, from: 'Рулетка', at: db.now() }); result.code = code; result.pct = prize.promo; }
    if (prize.frame) {
      var left = RULES.frames.filter(function (f) { return u.frames.indexOf(f.id) < 0; });
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
    L.push('📅 ' + whenText(o.at));
    L.push('');
    L.push('👤 ПОКУПАТЕЛЬ');
    L.push('Имя: ' + String(f.name).trim());
    L.push('Телефон: ' + fmtPhone(f.phone));
    L.push(cleanTg(f.tg) ? 'Telegram: @' + cleanTg(f.tg) : 'Telegram: нет username — связаться по телефону');
    if (o.user) L.push('Аккаунт: ' + o.user.login + ' · ID OS' + o.user.id + ' · уровень «' + o.user.levelName + '»' + (o.user.levelPerk ? ' (' + o.user.levelPerk + ')' : ''));
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
    if (o.promo) L.push('🏷 Промокод ' + o.promo + ': −' + rub(o.promoRub));
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
      lines.push({ id: String(prod.id), title: prod.title, status: prod.status, size: it.size ? String(it.size).slice(0, 40) : '', color: it.color ? String(it.color).slice(0, 60) : '', photoNo: photoNo, photo: it.photo || null, note: String(it.note || '').slice(0, 300), qty: qty, price: prod.price, link: prod.link || '', thumb: (prod.photos && prod.photos[0] ? prod.photos[0].id : it.thumb) || null });
    });
    return { lines: lines, unverified: unverified, gone: gone };
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
    var own = u ? (u.promos || []).filter(function (x) { return !x.used && x.code === code; })[0] : null;
    if (own) return ok({ promo: { code: own.code, pct: own.pct, withTokens: true, personal: true } });
    var sp = checkShopPromo(db, code, u, p.phone, parseInt(p.useTokens, 10) || 0);
    if (sp.error) return err(sp.error);
    return ok({ promo: sp });
  };

  A.order = function (db, p) {
    var f = p.form || {};
    var built = buildLines(db, p.items);
    if (built.gone.length) return err('Уже продано: ' + built.gone.join(', ') + '. Уберите из корзины и попробуйте снова');
    if (!built.lines.length) return err('Корзина пуста');
    var hasPre = built.lines.some(function (l) { return l.status === 'preorder'; });
    var hasStock = built.lines.some(function (l) { return l.status !== 'preorder'; });
    var bad = checkFields(f, hasStock, hasPre); if (bad) return err(bad);
    var total = 0, cnt = 0;
    built.lines.forEach(function (l) { total += l.price * l.qty; cnt += l.qty; });
    var u = sessionUser(db, p), tokens = 0, tokenRub = 0, promo = '', promoRub = 0;
    if (u) {
      var maxTok = Math.min(u.balance || 0, Math.floor(total * RULES.maxShare / RULES.tokenRub));
      tokens = Math.max(0, Math.min(maxTok, parseInt(p.useTokens, 10) || 0));
      tokenRub = tokensToRub(tokens);
    }
    var promoCode = String(p.promo || '').trim().toUpperCase();
    if (promoCode) {
      var pr = u ? (u.promos || []).filter(function (x) { return !x.used && x.code === promoCode; })[0] : null;
      if (pr) {
        promo = pr.code; promoRub = Math.round(total * pr.pct / 100);
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
    var li = u ? levelInfo(u.xp) : null;
    var perk = li ? (li.own.filter(function (x) { return /упаков/i.test(x); })[0] || '') : '';
    var text = orderText({ no: no, at: at, f: f, lines: built.lines, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, toPay: toPay, user: u ? { login: u.login, id: u.id, levelName: li.name, levelPerk: perk } : null });
    if (built.unverified) text += '\n\n⚠️ Каталог был недоступен — цены взяты с сайта, проверьте.';
    if (u) {
      if (tokens) log(db, u, -tokens, 'Оплата заказа №' + no);
      u.xp = (u.xp || 0) + toPay; u.spent = (u.spent || 0) + toPay; u.ordersCount = (u.ordersCount || 0) + 1;
      grantPerks(db, u);
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
      count: cnt, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, toPay: toPay,
      kind: hasPre && hasStock ? 'смешанный' : hasPre ? 'предзаказ' : 'в наличии', comment: String(f.comment || '').trim(), text: text
    };
    db.saveOrder(order);
    var notified = false;
    try { notified = db.notify ? !!db.notify(text) : false; } catch (e) { notified = false; }
    return ok({ order: order, notified: notified, user: u ? publicUser(db, u) : null });
  };

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
    offlineNo: offlineNo, levelInfo: levelInfo, tokensToRub: tokensToRub, settings: settings, dayKey: dayKey, monthKey: monthKey,
    cleanTg: cleanTg, fmtPhone: fmtPhone, digits: digits, validEmail: validEmail, tasksFor: tasksFor, stagesFor: stagesFor
  };
})();
if (typeof module !== 'undefined') module.exports = OnionCore;
