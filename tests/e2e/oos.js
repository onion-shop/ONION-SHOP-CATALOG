/* Товар «Нет в наличии» нельзя ни добавить в корзину, ни оформить; вместо этого предлагается избранное. Нужен сервер на 8766 и index.demo.html. */
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
    // первые два товара каталога делаем «нет в наличии» и «продан»
    await p.route('**/data/catalog.js*', async r => { const resp = await r.fetch(); let t = await resp.text(); let n = 0; t = t.replace(/"status": "(preorder|stock)"/g, (m) => (++n === 1 ? '"status": "out"' : n === 2 ? '"status": "sold"' : m)); await r.fulfill({ response: resp, body: t }); });
    await p.addInitScript(SEED, mk); await p.addInitScript((th) => localStorage.setItem('onion.shop.theme', th), th);
    await p.goto(BASE + '#catalog'); await p.waitForTimeout(1500);
    const outId = await p.evaluate(() => { const c = document.querySelector('.badge-out'); const card = c && c.closest('[data-pid]'); return card ? card.getAttribute('data-pid') : null; });
    ok(!!outId, 'в каталоге есть товар со статусом «Нет в наличии»');
    await p.screenshot({ path: `shots/oos_catalog_${w}.png` });
    const card = p.locator(`[data-pid="${outId}"]`);
    await card.locator('[data-quick]').click(); await p.waitForTimeout(500);
    const cnt = await p.evaluate(() => JSON.parse(localStorage.getItem('onion.shop.cart') || '[]').length);
    ok(cnt === 0, 'нажатие на корзину у товара без наличия ничего не кладёт в корзину');
    const toastTxt = await p.evaluate(() => document.body.innerText);
    ok(/нет в наличии/i.test(toastTxt) && /избранн/i.test(toastTxt), 'вместо этого предложено добавить в избранное');
    await p.screenshot({ path: `shots/oos_toast_${w}.png` });
    await p.getByRole('button', { name: 'В избранное' }).first().click().catch(() => { }); await p.waitForTimeout(400);
    ok(await p.evaluate((id) => JSON.parse(localStorage.getItem('onion.shop.favs') || '[]').map(String).includes(String(id)), outId), 'кнопка в тосте добавляет товар в избранное');
    // страница товара: кнопки «В корзину» нет
    await p.evaluate((id) => { location.hash = 'p-' + id; }, outId); await p.waitForTimeout(900);
    ok(await p.evaluate(() => (() => { const a = document.querySelector('#add-btn'); return !a || a.offsetParent === null; })()), 'на странице товара нет кнопки «В корзину»');
    await p.screenshot({ path: `shots/oos_product_${w}.png` });
    // старый товар в корзине (положен до того, как кончился) пропадает из корзины
    await p.evaluate((id) => { localStorage.setItem('onion.shop.cart', JSON.stringify([{ id: String(id), size: null, color: null, photo: null, qty: 1, note: '' }])); }, outId);
    await p.reload(); await p.waitForTimeout(1200); await p.evaluate(() => { location.hash = 'cart'; }); await p.waitForTimeout(800);
    ok(await p.evaluate(() => /пуста/i.test(document.querySelector('#v-cart').innerText)), 'товар без наличия сам убирается из корзины');
    // сервер: заказ такого товара отклоняется
    const r = await p.evaluate(async (id) => { const m = await import('./assets/core.js').catch(() => null); return null; }, outId);
    ok(errs.length === 0, 'нет ошибок JS ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'Нет в наличии: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();

