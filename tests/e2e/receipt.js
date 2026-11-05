/* Окно заказа («трекер посылки»): номер с копированием, шаги статуса, раскрывающийся состав и чек. Нужен сервер на 8766 и index.demo.html. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.demo.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = (mk) => { sessionStorage.setItem('onion.splash', '1'); if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const u = { id: '1001', login: 'test', name: 'Лейла', phone: '+7 900 000-00-00', phoneKey: '9000000000', tg: '', email: 't@x.ru', emailKey: 't@x.ru', balance: 1240, xp: 700, xpMonth: mk, spent: 0, ordersCount: 0, phoneOk: true, frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: Date.now() - 40 * 86400e3, refCode: 'ABC123', lastCheckin: '' };
  localStorage.setItem('onion.shop.demo.v2', JSON.stringify({ users: [u], sessions: [{ token: 'S', userId: '1001', exp: Date.now() + 9e9 }], orders: [], log: [], seq: { user: 1001, order: 0 } })); localStorage.setItem('onion.shop.session', 'S'); localStorage.setItem('onion.shop.checkin', '1'); };
(async () => {
  const b = await chromium.launch(); const mk = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
  for (const [w, h, th] of [[390, 844, 'light'], [1280, 800, 'dark']]) {
    console.log('--- ' + w + ' ' + th);
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });
    await p.addInitScript(SEED, mk); await p.addInitScript((th) => localStorage.setItem('onion.shop.theme', th), th);
    await p.goto(BASE + '#account'); await p.waitForTimeout(1200);
    const o = await p.evaluate(async () => { const cat = (window.ONION_CATALOG || {}).products || []; const pr = cat.filter(x => x.status === 'stock').slice(0, 2); return await window.OnionAPI.call('order', { items: pr.map(x => ({ id: String(x.id), qty: 1, size: (x.sizes || [])[0] || '', color: '' })), form: { recv: 'pickup', comment: '', name: 'Лейла', phone: '+7 900 000-00-00', city: 'Москва' }, useTokens: 0 }); });
    ok(o && o.ok, 'тестовый заказ создан ' + (o && o.error || ''));
    await p.goto(BASE + '#orders'); await p.reload(); await p.waitForTimeout(1500);
    await p.click('.order [data-open]'); await p.waitForTimeout(500);
    const t = await p.evaluate(() => document.querySelector('.modal').innerText);
    ok(/Номер заказа/.test(t) && /Копировать/.test(t), 'есть номер заказа и кнопка «Копировать»');
    ok(await p.evaluate(() => document.querySelectorAll('.rv-tl li').length >= 3), 'статус показан шагами (трекер)');
    ok(await p.evaluate(() => !!document.querySelector('.rv-tl li.now') || !!document.querySelector('.rv-tl li.done')), 'текущий шаг выделен');
    ok(await p.evaluate(() => !document.querySelector('.rv-det').open), 'состав заказа свёрнут');
    await p.click('.rv-det summary'); await p.waitForTimeout(300);
    const t2 = await p.evaluate(() => document.querySelector('.rv-det').innerText);
    ok(/К оплате/.test(t2) && /Товары/.test(t2), 'в составе есть товары и «К оплате»');
    await p.screenshot({ path: `shots/receipt_${w}.png` });
    await p.click('.rv-cp'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => /скопирован|Скопировано|скопирован/i.test(document.body.innerText)), 'номер копируется');
    ok(errs.length === 0, 'нет ошибок JS ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'Заказ: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();



