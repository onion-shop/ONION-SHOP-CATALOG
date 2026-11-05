/* Уведомления в Telegram включены всегда: после подключения нет ни кнопки отключения, ни выбора категорий. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.demo.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = (mk) => { sessionStorage.setItem('onion.splash', '1'); if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const u = { id: '1001', login: 'test', name: 'Лейла', phone: '+7 900 000-00-00', phoneKey: '9000000000', tg: '', email: 't@x.ru', emailKey: 't@x.ru', balance: 1240, xp: 700, xpMonth: mk, spent: 0, ordersCount: 0, phoneOk: true, frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: Date.now() - 40 * 86400e3, refCode: 'ABC123', lastCheckin: '', tgChat: '555', tgName: '@test' };
  localStorage.setItem('onion.shop.demo.v2', JSON.stringify({ users: [u], sessions: [{ token: 'S', userId: '1001', exp: Date.now() + 9e9 }], orders: [], log: [], seq: { user: 1001, order: 0 } })); localStorage.setItem('onion.shop.session', 'S'); localStorage.setItem('onion.shop.checkin', '1'); };
(async () => {
  const b = await chromium.launch(); const mk = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
  for (const [w, h, th] of [[390, 844, 'light'], [1280, 800, 'dark']]) {
    console.log('--- ' + w + ' ' + th);
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });
    await p.addInitScript(SEED, mk); await p.addInitScript((th) => localStorage.setItem('onion.shop.theme', th), th);
    await p.goto(BASE + '#account'); await p.waitForTimeout(1200);
    await p.click('#r-tg'); await p.waitForTimeout(500);
    const t = await p.evaluate(() => document.querySelector('#tg-body').innerText);
    ok(/Telegram подключён/.test(t) && /все уведомления включены/.test(t), 'показано, что все уведомления включены');
    ok(await p.evaluate(() => !document.querySelector('#tg-off') && !document.querySelector('#tg-cats') && !document.querySelector('[data-c]')), 'нет кнопки «Отключить» и выбора категорий');
    ok(/нельзя отключить/.test(t), 'написано, что отключить нельзя');
    await p.screenshot({ path: `shots/tg_on_${w}.png` });
    const r = await p.evaluate(async () => { try { const m = JSON.parse(localStorage.getItem('onion.shop.demo.v2')); return !!m.users[0].tgChat; } catch (e) { return false; } });
    ok(r, 'подключение осталось (отключить нечем)');
    ok(errs.length === 0, 'нет ошибок JS ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'Telegram: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();
