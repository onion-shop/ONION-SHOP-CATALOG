// Тесты защиты от накруток: node tests/abuse_test.js (из корня проекта)
const path = require('path');
const C = require(path.join(__dirname, '../assets/core.js'));
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '../data/catalog.js'), 'utf8');
const cat = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const byId = {}; cat.products.forEach(p => byId[p.id] = p);
let now = Date.UTC(2026, 10, 6, 9, 0, 0); // 6 ноября, 12:00 МСК
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const crypto = require('crypto');
const mem = { users: [], sessions: [], orders: [], log: [], ledger: [], seq: { user: 1000, order: 0 } };
const db = {
  now: () => now, random: rnd, hash: s => crypto.createHash('sha256').update(s).digest('hex'), token: () => crypto.randomBytes(20).toString('hex'),
  getUser: id => mem.users.find(u => u.id === String(id)) || null,
  findUser: (f, v) => { const k = { login: 'login', tg: 'tgKey', phone: 'phoneKey', refCode: 'refCode', email: 'emailKey' }[f] || f; return mem.users.find(u => String(u[k]) === String(v)) || null; },
  createUser: u => { mem.seq.user++; u.id = String(mem.seq.user); mem.users.push(u); return u; }, saveUser: () => {},
  deleteUser: u => { mem.users = mem.users.filter(x => x.id !== u.id); },
  getSession: t => mem.sessions.find(s => s.token === t) || null, saveSession: s => mem.sessions.push(s), renewSession: () => {}, deleteSession: t => { mem.sessions = mem.sessions.filter(s => s.token !== t); },
  deleteSessionsOf: id => { mem.sessions = mem.sessions.filter(s => s.userId !== id); },
  nextOrderSeq: () => ++mem.seq.order, saveOrder: o => mem.orders.push(o), listOrders: (u, n) => mem.orders.filter(o => o.userId === u).slice(-n).reverse(),
  log: e => mem.log.push(e), catalogReady: () => true, product: id => byId[id] || null, notify: () => true,
  ledgerHas: (key, kind) => mem.ledger.some(e => e.key === key && e.kind === kind), ledgerAdd: e => mem.ledger.push(e),
  codes: {}, putCode(k, o) { this.codes[k] = o; }, getCode(k) { return this.codes[k] || null; }, delCode(k) { delete this.codes[k]; }, mail(to, s, code) { this.lastCode = code; return true; }
};
const H = (a, p) => C.handle(a, p, db);
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function reg(o, noConfirm) {
  db.codes = {}; const sc = H('sendCode', { purpose: 'register', email: o.email });
  const r = H('register', Object.assign({ password: 'secret1', name: 'Тест Тестов', code: db.lastCode }, o));
  if (r.ok && !noConfirm) { const u = db.getUser(r.user.id); C.phoneConfirm(db, u, { user_id: 7, phone_number: u.phoneKey }, 7); r.user = H('me', { session: r.session }).user; }
  return r;
}
const user = s => db.getUser(db.getSession(s).userId);
const stock = cat.products.filter(p => p.status === 'stock' && p.price >= 1500);
const item = p => ({ id: String(p.id), size: (p.sizes || [])[0] || '', color: ((p.colors || [])[0] || {}).name || '', qty: 1 });
const form = { recv: 'pickup', comment: '' };

console.log('\n— 1. Удаление аккаунта и повторная регистрация');
let r = reg({ login: 'anna', email: 'Anna.Smith+shop@gmail.com', phone: '+7 900 111-22-33', tg: '@anna_x' });
ok(r.ok && r.user.balance === 100, 'первая регистрация + подтверждение телефона: +100 ониксов');
const annaRef = r.user.refCode;
r = H('deleteAccount', { session: r.session, password: 'secret1' }); ok(r.ok, 'аккаунт удалён');
ok(mem.ledger.length >= 3 && mem.ledger.every(e => !/anna|900|gmail/i.test(e.key)), 'в учёте только хэши, без телефона и почты');
r = reg({ login: 'anna2', email: 'annasmith@gmail.com', phone: '89001112233' });
ok(r.ok && r.user.balance === 0 && r.repeat, 'тот же телефон/почта (Gmail без точек): регистрация есть, бонуса нет');
let inviter = reg({ login: 'boris', email: 'boris@mail.ru', phone: '+7 911 000-00-01' });
H('deleteAccount', { session: r.session, password: 'secret1' });
r = reg({ login: 'anna3', email: 'anna.smith+again@googlemail.com', phone: '+7 999 555-44-33', ref: inviter.user.refCode });
ok(r.ok && r.user.balance === 0 && !user(r.session).referredBy, 'алиас той же почты + чужая ссылка: ни приветственного, ни реферального бонуса');
r = reg({ login: 'newbie', email: 'newbie@mail.ru', phone: '+7 922 333-44-55', ref: inviter.user.refCode });
ok(r.ok && r.user.balance === 150, 'новый человек по ссылке: 100 + 50, как раньше');
const friendS = r.session;

console.log('\n— 2. Реферальный бонус только после «Получен»');
const inv0 = db.getUser(inviter.user.id).balance;
r = H('order', { session: friendS, items: [item(stock[0])], form, useTokens: 0 });
ok(r.ok, 'друг оформил заказ на ' + r.order.total + ' ₽');
ok(db.getUser(inviter.user.id).balance === inv0, 'пригласивший пока ничего не получил (заказ только оформлен)');
let ref = C.referralOnReceive(db, user(friendS), r.order.total);
ok(ref && db.getUser(inviter.user.id).balance === inv0 + 100, 'заказ получен → пригласившему +100');
ref = C.referralOnReceive(db, user(friendS), r.order.total);
ok(!ref && db.getUser(inviter.user.id).balance === inv0 + 100, 'повторный «Получен» не начисляет второй раз');

console.log('\n— 3. Награды за «Оформить заказ» списываются при отмене');
// подбираем клиента, у которого на этой неделе есть задание «Оформить заказ» (набор заданий у каждого свой)
let fs3 = null, fu = null;
for (let i = 0; i < 40 && !fs3; i++) { const rr = reg({ login: 'shopper' + i, email: 'shopper' + i + '@mail.ru', phone: '+7 966 000-00-' + String(10 + i) }); const uu = user(rr.session); if (C.taskPick(uu, 'w', now).some(k => /^w_(ord|stock)$/.test(k))) { fs3 = rr.session; fu = uu; } }
fu.balance = 0;
let ord = null; { const rr = H('order', { session: fs3, items: [item(stock[2])], form, useTokens: 0 }); if (rr.order.taskRew) ord = rr.order; }
if (!ord) console.log('     (заданий на заказ в этой неделе нет — проверяем только счётчики)');
const b1 = fu.balance, rew = ord ? JSON.parse(ord.taskRew) : [], sumTk = rew.reduce((a, x) => a + x.tk, 0);
if (ord) {
  ok(sumTk > 0 && b1 >= sumTk, 'заказ закрыл задания: ' + rew.map(x => x.k + ' +' + x.tk).join(', '));
  C.orderCanceled(db, fu, { no: ord.no, at: ord.at, total: ord.total, kind: ord.kind, taskRew: ord.taskRew }, 1);
  ok(fu.balance === b1 - sumTk, 'отмена: награды списаны (' + b1 + ' → ' + fu.balance + ')');
  ok(rew.every(x => fu.tasks[x.per].done.indexOf(x.k) < 0), 'задания снова не выполнены');
  C.orderCanceled(db, fu, { no: ord.no, at: ord.at, total: ord.total, kind: ord.kind }, -1);
  ok(rew.every(x => fu.tasks[x.per].done.indexOf(x.k) >= 0), 'отмену сняли: задания снова засчитаны');
}

console.log('\n— 4. День рождения');
const today = '11-06';
r = reg({ login: 'young', email: 'young@mail.ru', phone: '+7 933 000-11-22' });
let ys = r.session;
r = H('profile', { session: ys, birthday: today });
ok(r.ok && r.bday === 'young', 'новый аккаунт указал сегодняшнюю дату: подарок не положен (младше 30 дней)');
r = H('bdayGift', { session: ys }); ok(!r.ok, 'запрос подарка напрямую отклонён: ' + r.error);
r = reg({ login: 'oldie', email: 'oldie@mail.ru', phone: '+7 944 000-11-22' });
const os = r.session, ou = user(os); ou.createdAt = now - 40 * 86400000; const ob = ou.balance, ox = ou.xp || 0;
r = H('profile', { session: os, birthday: today });
ok(r.ok && r.bdayNow && r.user.bdayToday, 'старый аккаунт указал сегодняшнюю дату → подарок доступен сразу');
r = H('me', { session: os }); ok(r.user.bdayToday, 'при следующем входе поздравление показывается');
r = H('bdayGift', { session: os });
ok(r.ok && ou.balance === ob + 3334, '+3 334 оникса (≈ ' + Math.round(3334 * 0.3) + ' ₽)');
ok(ou.xp === ox + 1500 && C.levelOf(ou).key === 'gold', '+1 500 XP → уровень Золото');
const bp = ou.promos.find(p => p.kind === 'bday');
ok(bp && /^HAPPYBDAY-[A-Z0-9]{4}$/.test(bp.code) && bp.pct === 3.5 && bp.until - now === 30 * 86400000, 'промокод ' + (bp && bp.code) + ' −3,5% на 30 дней');
r = H('bdayGift', { session: os }); ok(!r.ok && ou.balance === ob + 3334, 'повторный запрос (обновление страницы) — отказ');
r = H('me', { session: os }); ok(!r.user.bdayToday, 'после получения поздравление больше не показывается');
ok(r.user.achv.indexOf('bday') >= 0, 'открыл подарок: значок «Свой праздник» выдан');
r = H('profile', { session: os, birthday: '12-01' }); ok(!r.ok, 'дату нельзя поменять, чтобы получить второй подарок');
// промокод работает и сочетается с ониксами; второй раз — нет
r = H('order', { session: os, items: [item(stock[1])], form, useTokens: 99999, promo: bp.code });
ok(r.ok && r.order.promo === bp.code && r.order.promoRub === Math.round(r.order.total * 0.035), 'промокод применён: −' + r.order.promoRub + ' ₽ к заказу ' + r.order.total + ' ₽');
ok(r.order.tokenRub + r.order.promoRub <= Math.floor(r.order.total * 0.12) && r.order.tokens === Math.floor((Math.floor(r.order.total * 0.12) - r.order.promoRub) / 0.3), 'ониксы и промокод вместе не больше 12% заказа: ' + r.order.tokenRub + ' + ' + r.order.promoRub + ' ₽ из ' + r.order.total + ' ₽');
r = H('order', { session: os, items: [item(stock[1])], form, useTokens: 0, promo: bp.code });
ok(!r.ok || !r.order.promo, 'одноразовый промокод второй раз не срабатывает');
// удаление и повторная регистрация в тот же год (сначала заказы завершены)
mem.orders.forEach(o => { if (o.userId === ou.id) o.status = 'Получен'; });
r = H('deleteAccount', { session: os, password: 'secret1' }); ok(r.ok, 'аккаунт с завершёнными заказами удалён');
r = reg({ login: 'oldie2', email: 'oldie@mail.ru', phone: '+7 944 000-11-22' });
const o2 = user(r.session); o2.createdAt = now - 40 * 86400000;
r = H('profile', { session: r.session, birthday: today });
ok(r.ok && r.bday === 'got' && !r.user.bdayToday, 'удалил аккаунт и создал заново: второй подарок за этот год не выдаётся');
// 29 февраля
ok(C.bdayIsToday('02-29', Date.UTC(2027, 1, 28, 9)) && !C.bdayIsToday('02-29', Date.UTC(2028, 1, 28, 9)) && C.bdayIsToday('02-29', Date.UTC(2028, 1, 29, 9)), '29 февраля: в невисокосный год — 28-го, в високосный — 29-го');
// день рождения по Москве: 23:30 МСК 5 ноября — ещё не день рождения
const save = now; now = Date.UTC(2026, 10, 5, 20, 30); ok(!C.bdayIsToday('11-06', now), 'граница суток по Москве'); now = save;

console.log('\n— 5. Ониксы, рулетка и подмена данных с клиента');
r = reg({ login: 'hacker', email: 'h@mail.ru', phone: '+7 955 000-11-22' }); const hs = r.session, hu = user(hs);
r = H('profile', { session: hs, balance: 999999, xp: 99999, freeSpins: 50 });
ok(hu.balance === 100 && !hu.xp && !hu.freeSpins, 'баланс, XP и прокруты нельзя прислать с клиента');
hu.balance = 50; hu.daySpins = 0; hu.freeSpins = 0; hu.spinDay = '2026-11-06';
r = H('spin', { session: hs }); ok(!r.ok && hu.balance === 50, 'платный прокрут без 100 ониксов — отказ');
r = H('spin', { session: hs, free: true }); ok(!r.ok && hu.balance === 50, 'бесплатный прокрут без прокрутов — отказ (не превращается в платный)');
hu.balance = 1000;
r = H('order', { session: hs, items: [{ id: String(stock[0].id), price: 1, qty: 1 }], form, useTokens: -500 });
ok(r.ok && r.order.total === stock[0].price && r.order.tokens === 0, 'цена берётся из каталога, а не с клиента; отрицательные ониксы не начисляются');
r = H('order', { session: hs, items: [item(stock[0])], form, promo: 'LUCK-FAKE1' }); ok(!r.ok, 'чужой или выдуманный промокод — отказ');
const t0 = JSON.stringify(hu.tasks.d.s);
H('track', { session: hs, events: [{ ev: 'view', id: '999999' }, { ev: 'balance', id: '1' }] });
ok(JSON.stringify(hu.tasks.d.s) === t0, 'события по несуществующим товарам и выдуманные события не засчитываются');
r = H('adjustTokens', { session: hs, delta: 5000 }); ok(!r.ok, 'служебное начисление недоступно с сайта');

console.log('\n— 6. Подтверждение телефона');
r = reg({ login: 'phone1', email: 'phone1@mail.ru', phone: '+7 977 111-00-01' }, true);
let ps = r.session, pu = user(ps);
ok(r.ok && r.user.balance === 0 && r.user.phoneOk === false && r.pending === 100, 'после регистрации бонус ждёт подтверждения телефона');
r = H('order', { session: ps, items: [item(stock[0])], form });
ok(r.ok && r.order.tokens === 0 && pu.balance === 0, 'без подтверждения заказ оформляется, но бонусов нет');
r = C.phoneConfirm(db, pu, { user_id: 5, phone_number: '79771110001' }, 6);
ok(!r.ok && pu.balance === 0, 'чужой контакт (не свой номер) не подходит');
r = C.phoneConfirm(db, pu, { user_id: 6, phone_number: '79223334455' }, 6);
ok(!r.ok, 'номер, занятый другим аккаунтом, не подтверждается');
r = C.phoneConfirm(db, pu, { user_id: 6, phone_number: '+79771110001' }, 6);
ok(r.ok && r.got === 100 && pu.balance === 100 && pu.phoneOk, 'свой номер через Telegram: подтверждён, +100 ониксов');
r = C.phoneConfirm(db, pu, { user_id: 6, phone_number: '+79771110001' }, 6);
ok(r.ok && r.got === 0 && pu.balance === 100, 'повторное подтверждение бонус не дублирует');
r = H('profile', { session: ps, phone: '+7 977 111-00-99' }); ok(r.ok && r.user.phoneOk === false, 'сменил телефон — нужно подтвердить снова');
r = C.phoneConfirm(db, pu, { user_id: 6, phone_number: '79771110055' }, 6);
ok(r.ok && r.changed && pu.phoneKey === '9771110055' && pu.balance === 100, 'в кабинет ставится номер, подтверждённый Telegram; бонус не повторяется');
r = H('phoneDemo', { session: ps }); ok(!r.ok, 'демо-подтверждение на настоящем сервере недоступно');

console.log('\n— 7. Почта: варианты одного ящика');
r = reg({ login: 'mailx', email: 'ivan.petrov@gmail.com', phone: '+7 977 222-00-01' });
r = reg({ login: 'mailx2', email: 'ivanpetrov+2@gmail.com', phone: '+7 977 222-00-02' });
ok(!r.ok && /почта/.test(r.error), 'второй аккаунт на тот же Gmail с точками/«+» не создаётся');

console.log('\n— 8. Лимит кодов и мониторинг');
const flags = []; db.flag = e => flags.push(e);
let lim = null; for (let i = 0; i < 55; i++) { db.codes['limit:x' + i + '@m.ru'] = null; const rr = H('sendCode', { purpose: 'register', email: 'x' + i + '@m.ru' }); if (!rr.ok && /много/.test(rr.error)) { lim = i; break; } }
ok(lim !== null && lim <= 50 && flags.some(f => f.kind === 'codes'), 'больше 50 кодов за час — пауза и сигнал менеджеру (сработало на ' + lim + ')');
delete db.flag;

console.log('\n— 9. Ранний доступ для Золота');
const newP = Object.assign({}, stock[3], { id: '99901', date: new Date(now - 3600000).toISOString() }); byId['99901'] = newP;
r = reg({ login: 'bronze', email: 'bronze@mail.ru', phone: '+7 977 333-00-01' });
let bs = r.session;
r = H('order', { session: bs, items: [{ id: '99901', size: (newP.sizes || [])[0] || '', qty: 1 }], form });
ok(!r.ok && /Золото/.test(r.error), 'Бронза не может купить новинку первые 24 часа');
user(bs).xp = 1600;
r = H('order', { session: bs, items: [{ id: '99901', size: (newP.sizes || [])[0] || '', qty: 1 }], form });
ok(r.ok, 'Золото может купить новинку сразу');
newP.date = new Date(now - 25 * 3600000).toISOString(); user(bs).xp = 0;
r = H('order', { session: bs, items: [{ id: '99901', size: (newP.sizes || [])[0] || '', qty: 1 }], form });
ok(r.ok, 'через 24 часа новинка доступна всем');

console.log('\n— 10. Снижение цены и достижения');
r = H('watch', { session: bs, ids: ['99901', '999999'] }); ok(r.ok && r.n === 1, 'избранное сохраняется на сервере (несуществующие товары отброшены)');
const bu = user(bs), oldPrice = newP.price; newP.price = oldPrice - 300;
let dr = C.priceDrops(db, bu); ok(dr.length === 1 && dr[0].was === oldPrice && dr[0].now === oldPrice - 300, 'подешевело на 300 ₽ — бот получит уведомление');
dr = C.priceDrops(db, bu); ok(dr.length === 0, 'о той же цене второй раз не сообщаем');
newP.price = oldPrice;
mem.orders.forEach(o => { if (o.userId === bu.id) o.status = 'Получен'; });
r = H('me', { session: bs });
ok(r.user.achv.indexOf('first') >= 0 && bu.balance === r.user.balance, 'достижение «Первая распаковка» выдано, ониксы не начисляются');
bu.recvTotal = 5; r = H('me', { session: bs });
ok(r.user.achv.indexOf('five') >= 0 && r.user.frames.indexOf('ach-loyal') >= 0, '5 полученных заказов → значок и рамка «Лавры»');
bu.recvTotal = 0; r = H('me', { session: bs }); ok(r.user.achv.indexOf('five') >= 0, 'полученное достижение не пропадает');

console.log('\n— 12. Достижения: только за реальное действие');
{ const pu = reg({ login: 'bd1', email: 'bd1@mail.ru', phone: '+7 999 300-40-50' }); const uu = user(pu.session); uu.createdAt = now - 90 * 864e5; uu.phoneOk = true;
  const other = new Date(now + 3 * 3600000 + 40 * 864e5); const md = String(other.getUTCMonth() + 1).padStart(2, '0') + '-' + String(other.getUTCDate()).padStart(2, '0');
  let rr = H('profile', { session: pu.session, birthday: md }); ok(rr.ok, 'дата рождения сохранена');
  rr = H('me', { session: pu.session }); ok(rr.user.achv.indexOf('bday') < 0, 'указал дату рождения: значок «Свой праздник» НЕ выдан');
  uu.achv = ['bday']; rr = H('me', { session: pu.session }); ok(rr.user.achv.indexOf('bday') < 0, 'выданный раньше по ошибке значок снят (подарок не открывался)');
  rr = H('me', { session: pu.session }); ok(rr.user.achv.filter(x => x === 'bday').length === 0, 'без повторов');
  ok(!rr.user.achv.some(x => x.charAt(0) === '-'), 'служебные пометки в список значков не попадают'); }

console.log('\n— 13. Экономика: бесплатная посылка и потолок баланса');
{ const W0 = C.RULES.wheel, sum = a => a.reduce((x, y) => x + y, 0);
  const pu = reg({ login: 'eco1', email: 'eco1@mail.ru', phone: '+7 999 500-60-70' }); const uu = user(pu.session); uu.phoneOk = true;
  let rr = H('me', { session: pu.session }); const wp = rr.user.wheel;
  ok(rr.user.wheelFree === undefined && Math.abs(sum(wp) - 10000) < 1, 'у бесплатной посылки нет отдельной таблицы, веса платной в сумме 10 000');
  const cnt = { free: {}, paid: {} };
  for (let i = 0; i < 4000; i++) {
    uu.xp = 0; uu.balance = 5000; uu.daySpins = 1; uu.freeSpins = 0; let q = H('spin', { session: pu.session, free: true }); if (q.ok) cnt.free[q.prize.id] = (cnt.free[q.prize.id] || 0) + 1;
    uu.xp = 0; uu.balance = 5000; q = H('spin', { session: pu.session, free: false }); if (q.ok) cnt.paid[q.prize.id] = (cnt.paid[q.prize.id] || 0) + 1;
  }
  const dev = W0.map((p, i) => { const e = wp[i] / 10000 * 4000; return e > 40 ? Math.abs((cnt.free[p.id] || 0) - e) / Math.sqrt(e) : 0; });
  const dev2 = W0.map((p, i) => { const e = wp[i] / 10000 * 4000; return e > 40 ? Math.abs((cnt.paid[p.id] || 0) - e) / Math.sqrt(e) : 0; });
  if (Math.max.apply(null, dev.concat(dev2)) >= 4.5) console.log(W0.map((p, i) => p.id + ' w' + wp[i] + ' free' + (cnt.free[p.id] || 0) + ' paid' + (cnt.paid[p.id] || 0)).join(' | '));
  ok(Math.max.apply(null, dev) < 4.5 && Math.max.apply(null, dev2) < 4.5, 'бесплатная и платная посылка выдают призы с одними и теми же шансами (4000 прокрутов каждой)');
  uu.balance = 9990; uu.daySpins = 0; uu.freeSpins = 0;
  let maxB = 0; for (let i = 0; i < 40; i++) { uu.balance = Math.max(uu.balance, 9990); rr = H('spin', { session: pu.session, free: false }); if (rr.ok) maxB = Math.max(maxB, uu.balance); }
  ok(maxB <= 10000, 'платная посылка у баланса 9 990: баланс не выше 10 000 (максимум ' + maxB + ')');
  uu.balance = 10000; const x0 = uu.xp || 0; uu.lastCheckin = ''; rr = H('checkin', { session: pu.session });
  ok(rr.ok && uu.balance === 10000 && (uu.xp || 0) > x0, 'вход при балансе 10 000: ониксы не начислены, опыт начислен');
  uu.balance = 500; const t = C.RULES.tasks.find(t => t.per === 'd' && !t.auto); ok(t.tk === 3 && t.xp === 10, 'дневное задание: 3 оникса и 10 XP');
  ok(C.RULES.tasks.filter(t => t.per === 'w').every(t => t.tk === 25 && t.xp === 60), 'недельные задания: 25 ониксов и 60 XP'); }

console.log('\n— 14. Игры удалены: серверных действий игр больше нет');
{ const pu = reg({ login: 'gm1', email: 'gm1@mail.ru', phone: '+7 999 700-80-90' });
  ok(!H('gameLoad', { session: pu.session, game: 'gruz' }).ok && !H('gameSave', { session: pu.session, game: 'gruz', data: '{}' }).ok, 'Грузомании и Последнего рубежа больше нет на сервере'); }

console.log('\n— 14b. Рамки из посылки: редкость');
{ const F = C.RULES.frames, W = F.filter(f => f.src === 'wheel');
  ok(W.every(f => f.r >= 1 && f.r <= 5) && [1, 2, 3, 4, 5].every(r => W.some(f => f.r === r)), 'у каждой рамки из посылки редкость 1–5, все пять редкостей есть');
  ok(F.filter(f => f.src === 'level').length === 5, 'пять статусных рамок');
  ok(F.filter(f => f.src === 'ach' || f.src === 'game').length === 4, 'четыре эксклюзивные рамки за достижения');
  const pu = reg({ login: 'fr9', email: 'fr9@mail.ru', phone: '+7 999 700-90-90' }); const uu = user(pu.session); uu.phoneOk = true;
  const got = {}; let all = true;
  for (let i = 0; i < 400; i++) { uu.frames = ['base']; uu.balance = 5000; uu.xp = 0;
    const idx = C.RULES.wheel.findIndex(w => w.id === 'frame'); const save = C.RULES.wheel.map(w => w.w); C.RULES.wheel.forEach((w, k) => { w.w = k === idx ? 1 : 0; });
    const r = H('spin', { session: pu.session }); C.RULES.wheel.forEach((w, k) => { w.w = save[k]; });
    if (!r.ok || !r.prize.frameId) { all = false; break; }
    const f = F.find(x => x.id === r.prize.frameId); got[f.r] = (got[f.r] || 0) + 1;
    if (uu.frames.indexOf(f.id) < 0 || f.src !== 'wheel') all = false; }
  ok(all, 'выпавшая рамка добавляется в коллекцию и это рамка из посылки');
  ok(got[1] > got[3] && got[3] > got[5] && got[5] > 0, 'обычные выпадают чаще редких, легендарные реже всех: ' + JSON.stringify(got));
  uu.frames = ['base']; const idx2 = C.RULES.wheel.findIndex(w => w.id === 'frame2'); const sv = C.RULES.wheel.map(w => w.w); C.RULES.wheel.forEach((w, k) => { w.w = k === idx2 ? 1 : 0; });
  const r2 = H('spin', { session: pu.session }); C.RULES.wheel.forEach((w, k) => { w.w = sv[k]; });
  ok(r2.ok && F.find(x => x.id === r2.prize.frameId).r >= 4, '«Редкая рамка» даёт эпическую или легендарную');
  const fid = r2.prize.frameId; ok(H('profile', { session: pu.session, frame: fid }).ok && H('me', { session: pu.session }).user.frame === fid, 'полученную рамку можно надеть, сервер возвращает её же');
  ok(!H('profile', { session: pu.session, frame: 'cosmos' === fid ? 'flame' : 'cosmos' }).ok || uu.frames.indexOf('cosmos') >= 0, 'не полученную рамку надеть нельзя'); }

console.log('\n— 15. Статусы и рамки');
{ const pu = reg({ login: 'frm1', email: 'frm1@mail.ru', phone: '+7 999 800-10-20' }); const uu = user(pu.session); uu.phoneOk = true; const S = pu.session;
  const mk = new Date(now + 3 * 3600e3).toISOString().slice(0, 7);
  const keys = ['bronze', 'silver', 'gold', 'platinum', 'diamond'], xps = [0, 500, 1500, 4000, 8000];
  const lvlIds = keys.map(k => 'lvl-' + k), wheelIds = C.RULES.frames.filter(f => f.src === 'wheel').map(f => f.id);
  keys.forEach((k, i) => {
    uu.xpMonth = mk; uu.xp = xps[i]; const fr = H('me', { session: S }).user.frames;
    ok(fr.indexOf('lvl-' + k) >= 0 && lvlIds.filter(x => x !== 'lvl-' + k && fr.indexOf(x) >= 0).length === 0 && !wheelIds.some(w => fr.indexOf(w) >= 0), 'статус «' + k + '»: открыта только рамка «' + k + '», коллекционные не открыты');
  });
  ok(C.RULES.frames.filter(f => f.src === 'level').length === 5, 'у каждого из 5 статусов своя рамка (включая бронзовую и платиновую)');
  uu.xpMonth = mk; uu.xp = 500; H('me', { session: S });
  ok(H('profile', { session: S, frame: 'lvl-silver' }).ok && !H('profile', { session: S, frame: 'lvl-gold' }).ok && !H('profile', { session: S, frame: 'neon' }).ok, 'на Серебре можно надеть серебряную, золотую и неоткрытую «Неон» нельзя');
  uu.xp = 1500; const me2 = H('me', { session: S }).user; ok(me2.frame === 'base', 'после повышения до Золота серебряная рамка снимается');
  uu.xp = 8000; uu.frames = ['base', 'neon']; let fr = H('me', { session: S }).user.frames;
  ok(fr.indexOf('neon') >= 0 && fr.indexOf('ice') < 0 && fr.indexOf('lvl-gold') < 0, 'Алмаз открывает алмазную рамку; полученная из посылки «Неон» остаётся, «Лёд» не открывается сама');
  ok(!H('profile', { session: S, frame: 'ice' }).ok && !H('profile', { session: S, frame: 'lvl-silver' }).ok && H('profile', { session: S, frame: 'lvl-diamond' }).ok, 'на Алмазе нельзя надеть чужие рамки, алмазную можно');
  const ids = C.RULES.achv.map(a => a.id); ok(ids.indexOf('gold') < 0 && C.RULES.achv.find(a => a.id === 'friend').name === 'Душа компании', 'достижение «Золотой статус» заменено, «Душа компании» переименована');
  ok(C.RULES.achv.every(a => a.name.length <= 20 && a.d.length <= 34), 'названия достижений до 20 знаков, описания до 34');
  ok(C.RULES.levels.every(l => l.perks.every(p => p[0] && p[1])), 'в карточках программы лояльности нет пустых текстов ни у одного статуса'); }

console.log('\n— 11. Каталог недоступен');
{ const cr = db.catalogReady, pr = db.product; db.catalogReady = () => false; db.product = () => null;
  const ou = reg({ login: 'cat1', email: 'cat1@mail.ru', phone: '+7 999 100-20-30' }); const cu = user(ou.session); cu.balance = 2000; cu.phoneOk = true;
  let rr = H('order', { session: ou.session, items: [{ id: '777', title: 'Тест', price: 10, qty: 1 }], form, useTokens: 500 });
  ok(!rr.ok && cu.balance === 2000, 'цены с сайта (каталог не загрузился) — ониксы списать нельзя');
  rr = H('order', { session: ou.session, items: [{ id: '777', title: 'Тест', price: 10, qty: 1 }], form, useTokens: 0 });
  ok(rr.ok && /проверьте/.test(rr.order.text), 'без скидок заказ уходит с пометкой менеджеру «проверьте цены»');
  db.catalogReady = cr; db.product = pr; }

console.log('\n— 11b. Нет в наличии: заказать нельзя никак');
{ const target = stock[0], keep = target.status, ou2 = reg({ login: 'oos1', email: 'oos1@mail.ru', phone: '+7 999 100-20-31' }); const cu2 = user(ou2.session); cu2.phoneOk = true;
  const n0 = (mem.orders || []).length; target.status = 'out';
  let rr = H('order', { session: ou2.session, items: [item(target)], form, useTokens: 0 });
  ok(!rr.ok && /нет в наличии/i.test(rr.error || ''), 'товар «Нет в наличии» сервер не принимает в заказ: ' + (rr.error || ''));
  rr = H('order', { session: ou2.session, items: [item(target), item(stock[1])], form, useTokens: 0 });
  ok(!rr.ok, 'заказ с одной недоступной позицией целиком отклоняется');
  target.status = keep; ok((mem.orders || []).length === n0, 'отклонённые заказы не сохраняются');
  rr = H('order', { session: ou2.session, items: [item(target)], form, useTokens: 0 }); ok(rr.ok, 'когда товар снова в наличии, заказ проходит'); }

console.log('\n— 12. Формулировки');
{ const names = ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз'];
  const dW = [4, 5, 6, 6, 6], wW = [2, 3, 4, 4, 4], mW = [2, 2, 3, 3, 4];
  ok(C.RULES.levels.every((l, i) => l.perks[0][0] === 'Задания' && l.tasks === dW[i]), 'в привилегиях жирная строка «Задания», ежедневных по правилам уровня (4, 5, 6, 6, 6)');
  ok(C.RULES.levels.every((l, i) => l.perks[0][1] === dW[i] + ' ежедневных, ' + wW[i] + ' еженедельных, ' + mW[i] + ' ежемесячных'), 'подпись: «4 ежедневных, 2 еженедельных, 2 ежемесячных», числа из taskCount (2/2, 3/2, 4/3, 4/3, 4/4)');
  ok(C.RULES.levels.every((l, i) => l.perks[0][1] === C.RULES.taskLine(i)), 'везде одна и та же строка: берётся из RULES.taskLine');
  ok(C.RULES.levels.every((l) => !/Доступны|в день|Ежедневных заданий/.test(l.perks[0][0] + l.perks[0][1])), 'в привилегиях нет старых формулировок');
  ok(C.RULES.priorityOrder().join(',') === 'Алмаз,Платина,Золото', 'порядок обработки заказов по уровням: Алмаз, Платина, Золото');
  ok(C.RULES.levels.filter((l) => /приоритет заказов/i.test(l.perks.map((p) => p[0]).join('|'))).length === 3 && C.RULES.levels.every((l) => l.perks.filter((p) => /приоритет заказов/i.test(p[0])).every((p) => p[1] === 'Порядок обработки: Алмаз, Платина, Золото')), 'в привилегиях Золота, Платины и Алмаза пояснён порядок обработки');
  { const mk = (levelName, priority, vip) => C.orderText({ no: 'OS-1', at: Date.now(), f: { name: 'Тест', phone: '+7 900 000-00-00', tg: 'x', recv: 'pickup', vip }, lines: [], total: 1000, tokens: 0, tokenRub: 0, promo: '', promoRub: 0, priority, user: { login: 'a', id: '1', levelName } });
    const dia = mk('Алмаз', 'Наивысший', false), gold = mk('Золото', 'Повышенный', true), paid = mk('Бронза', '', true), none = mk('Бронза', '', false);
    ok(/очередь №1 из 4/.test(dia) && /Порядок обработки: Алмаз, Платина, Золото, платный приоритет, остальные/.test(dia), 'менеджер видит: Алмаз, очередь №1 из 4 и порядок');
    ok(/очередь №3 из 4/.test(gold) && /ПЛАТНЫЙ ПРИОРИТЕТ \(\+99 ₽[^)]*\), очередь определяет уровень/.test(gold), 'Золото с платным приоритетом: очередь №3, платный не перебивает уровень');
    ok(/ПЛАТНЫЙ ПРИОРИТЕТ/.test(paid) && /очередь №4 из 4, после Алмаз, Платина, Золото/.test(paid) && !/ПРИОРИТЕТ УРОВНЯ/.test(paid), 'платный без уровня: очередь №4 из 4, после Алмаза, Платины, Золота');
    ok(!/ПРИОРИТЕТ|Порядок обработки/.test(none), 'обычный заказ без пометок приоритета'); }
  const all = JSON.stringify([C.RULES.levels, C.RULES.tasks, C.RULES.taskPer, C.RULES.frames, C.RULES.wheel]);
  ok(!/[^ежн]недельн|[^е]месячн|2 друзей|шесть боссов|«Я зашёл»/i.test(all), 'в правилах нет «недельные/месячные» без «еже», «2 друзей», «Я зашёл»');
  ok(!/Редкая рамка|эпическая|легендарная/i.test(JSON.stringify(C.RULES.wheel)), 'в призах посылки нет названий редкости рамок'); }

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'Все проверки пройдены'));
process.exitCode = fails ? 1 : 0;
