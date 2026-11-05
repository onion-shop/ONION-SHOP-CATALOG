/* День рождения: окно даты, подарок в сам день (сцена с коробкой, ониксы, XP, промокод), аккаунт младше 30 дней, плашка телефона.
   Нужен сервер на 8766 и index.demo.html. Скриншоты в shots/bday_*. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.demo.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = (a) => { sessionStorage.setItem('onion.splash', '1'); localStorage.setItem('onion.shop.theme', a.th); if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const msk = new Date(Date.now() + 3 * 3600e3), today = msk.toISOString().slice(5, 10), mk = msk.toISOString().slice(0, 7);
  const u = { id: '1001', login: 'test', name: 'Лейла', phone: '+7 900 000-00-00', phoneKey: '9000000000', tg: '', email: 't@x.ru', emailKey: 't@x.ru', balance: 1240, xp: 700, xpMonth: mk, spent: 0, ordersCount: 0, phoneOk: a.phoneOk !== false, frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: Date.now() - (a.ageDays || 40) * 86400e3, refCode: 'ABC123', lastCheckin: '', birthday: a.bdayToday ? today : '' };
  localStorage.setItem('onion.shop.demo.v2', JSON.stringify({ users: [u], sessions: [{ token: 'S', userId: '1001', exp: Date.now() + 9e9 }], orders: [], log: [], seq: { user: 1001, order: 0 } })); localStorage.setItem('onion.shop.session', 'S'); localStorage.setItem('onion.shop.checkin', '1'); };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, th] of [[390, 844, 'light'], [1280, 800, 'dark']]) {
    console.log('--- ' + w + ' ' + th);
    const open = async (o) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); p.errs = [];
      p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_TUNNEL/.test(m.text())) p.errs.push(m.text()); });
      await p.addInitScript(SEED, Object.assign({ th }, o)); await p.goto(BASE + '#account'); return [ctx, p]; };
    // 1. телефон не подтверждён: плашка в кабинете
    let [ctx, p] = await open({ phoneOk: false }); await p.waitForTimeout(1400);
    ok(await p.evaluate(() => !!document.querySelector('.ph-cta2 .pc-btn') && document.querySelectorAll('.ph-cta2 .pc-list li').length === 3), 'плашка «Подтвердите телефон»: заголовок, три преимущества, кнопка');
    await p.screenshot({ path: `shots/bday_phone_${w}.png` });
    await p.click('.ph-cta2 .pc-btn'); await p.waitForTimeout(500); ok(await p.evaluate(() => /Подтверждение телефона/.test(document.body.innerText)), 'кнопка открывает подтверждение');
    ok(p.errs.length === 0, 'нет ошибок JS ' + p.errs.slice(0, 2).join('|')); await ctx.close();
    // 2. указать дату рождения
    [ctx, p] = await open({}); await p.waitForTimeout(1400);
    await p.click('#r-bday'); await p.waitForTimeout(500); await p.screenshot({ path: `shots/bday_modal_${w}.png` });
    ok(await p.evaluate(() => /Подарок получают аккаунты старше 30 дней/.test(document.querySelector('.modal').innerText)), 'в окне даты сказано про подарок и 30 дней'); await ctx.close();
    // 3. сегодня день рождения, аккаунт старше 30 дней
    [ctx, p] = await open({ bdayToday: true, ageDays: 40 }); await p.waitForTimeout(2400);
    ok(await p.evaluate(() => !!document.querySelector('#gb-ov')), 'в день рождения открывается подарок');
    await p.screenshot({ path: `shots/bday_box_${w}.png` });
    await p.click('#gb-open'); await p.waitForTimeout(1600); await p.screenshot({ path: `shots/bday_opening_${w}.png` });
    await p.waitForSelector('#gb-res:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(1400);
    const txt = await p.evaluate(() => document.querySelector('#gb-res').innerText);
    ok(/Ониксы/.test(txt) && /XP/.test(txt) && /Промокод/.test(txt), 'награды: ониксы, опыт, промокод: ' + txt.replace(/\s+/g, ' ').slice(0, 150));
    await p.screenshot({ path: `shots/bday_result_${w}.png` });
    const u = await p.evaluate(() => JSON.parse(localStorage.getItem('onion.shop.demo.v2')).users[0]);
    ok(u.balance > 1240 && (u.promos || []).some(x => /HAPPYBDAY/.test(x.code)), 'на баланс пришли ониксы и выдан промокод HAPPYBDAY (' + u.balance + ')');
    await p.click('#gb-done'); await p.waitForTimeout(600); await p.reload(); await p.waitForTimeout(2000);
    ok(await p.evaluate(() => !document.querySelector('#gb-ov')), 'повторно подарок не выдаётся');
    ok(p.errs.length === 0, 'нет ошибок JS ' + p.errs.slice(0, 2).join('|')); await ctx.close();
    // 4. аккаунт младше 30 дней
    [ctx, p] = await open({ bdayToday: true, ageDays: 5 }); await p.waitForTimeout(2200);
    ok(await p.evaluate(() => !document.querySelector('#gb-ov')), 'аккаунт младше 30 дней: подарок не открывается');
    await p.screenshot({ path: `shots/bday_young_${w}.png` }); await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'День рождения: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();
