const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.demo.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = (mk) => { sessionStorage.setItem('onion.splash', '1'); if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const u = { id: '1001', login: 'test', name: 'Лейла', phone: '+7 900 000-00-00', phoneKey: '9000000000', tg: '', email: 't@x.ru', emailKey: 't@x.ru', balance: 1240, xp: 700, xpMonth: mk, spent: 0, ordersCount: 0, phoneOk: true, frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: Date.now() - 40 * 86400e3, refCode: 'ABC123', lastCheckin: '' };
  localStorage.setItem('onion.shop.demo.v2', JSON.stringify({ users: [u], sessions: [{ token: 'S', userId: '1001', exp: Date.now() + 9e9 }], orders: [], log: [], seq: { user: 1001, order: 0 } })); localStorage.setItem('onion.shop.session', 'S'); localStorage.setItem('onion.shop.checkin', '1'); };
const hash = (p) => p.evaluate(() => location.hash);
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !!e.getBoundingClientRect().width; }, sel);
(async () => {
  const b = await chromium.launch(); const mk = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
  for (const [w, th] of [[390, 'light'], [1280, 'dark']]) {
    console.log('--- ' + w + ' ' + th);
    // вошедший
    let ctx = await b.newContext({ viewport: { width: w, height: 900 } }); let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(SEED, mk); await p.addInitScript((th) => localStorage.setItem('onion.shop.theme', th), th);
    await p.goto(BASE + '#account'); await p.waitForTimeout(1200);
    // 1. кабинет -> «Игра» (сразу посылка) -> назад
    await p.evaluate(() => { const a = [...document.querySelectorAll('a[href="#roulette"]')].filter(x => x.getBoundingClientRect().width)[0]; a.click(); }); await p.waitForTimeout(700);
    ok(await hash(p) === '#roulette', 'из кабинета кнопка «Игра» сразу открывает посылку'); ok(await vis(p, '#rl-back'), 'в «Посылке» есть кнопка «Назад»');
    ok(await p.evaluate(() => !document.querySelector('#v-games') && !document.querySelector('.gm-card')), 'раздела с несколькими играми больше нет');
    if (w === 390 && th === 'light') await p.screenshot({ path: 'shots/nav_roulette_after_' + w + '.png' });
    const rbox = await p.evaluate(() => { const r = document.querySelector('#rl-back').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    ok(rbox[1] >= 36 && rbox[0] >= 70, 'кнопка достаточного размера ' + rbox.join('x'));
    await p.click('#rl-back'); await p.waitForTimeout(500); ok(await hash(p) === '#account', '«Назад» из «Посылки» вернул в кабинет');
    // 2. системная кнопка назад
    await p.evaluate(() => { location.hash = 'roulette'; }); await p.waitForTimeout(500);
    await p.goBack(); await p.waitForTimeout(500); ok(await hash(p) === '#account', 'системное «Назад»: из «Посылки» в кабинет');
    // 3. с главной
    await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(500); await p.evaluate(() => { location.hash = 'roulette'; }); await p.waitForTimeout(500);
    await p.click('#rl-back'); await p.waitForTimeout(500); ok(await hash(p) === '' || await hash(p) === '#', 'пришли с главной: «Назад» ведёт на главную (' + await hash(p) + ')');
    // 4. из товара
    await p.evaluate(() => { location.hash = 'p-325'; }); await p.waitForTimeout(500); await p.evaluate(() => { location.hash = 'roulette'; }); await p.waitForTimeout(400); await p.click('#rl-back'); await p.waitForTimeout(500);
    ok(await hash(p) === '#p-325', 'пришли из карточки: «Назад» вернул в карточку');
    ok(errs.length === 0, 'нет ошибок JS ' + errs.join('|')); await ctx.close();
    // 5. прямая ссылка, вошедший; старые ссылки на игры ведут в посылку
    ctx = await b.newContext({ viewport: { width: w, height: 900 } }); p = await ctx.newPage(); await p.addInitScript(SEED, mk);
    await p.goto(BASE + '#roulette'); await p.waitForTimeout(1200);
    ok(await vis(p, '#rl-back'), 'прямая ссылка #roulette: кнопка есть'); await p.click('#rl-back'); await p.waitForTimeout(600); ok(await hash(p) === '#account', 'нет истории, вошедший: «Назад» ведёт в кабинет (' + await hash(p) + ')'); await ctx.close();
    for (const old of ['games', 'gruz', 'rub']) { ctx = await b.newContext({ viewport: { width: w, height: 900 } }); p = await ctx.newPage(); await p.addInitScript(SEED, mk);
      await p.goto(BASE + '#' + old); await p.waitForTimeout(1200); ok(await hash(p) === '#roulette' && await vis(p, '#rl-back'), 'старая ссылка #' + old + ' ведёт в посылку'); await ctx.close(); }
    // 6. гость
    ctx = await b.newContext({ viewport: { width: w, height: 900 } }); p = await ctx.newPage(); await p.addInitScript(() => sessionStorage.setItem('onion.splash', '1'));
    await p.goto(BASE + '#roulette'); await p.waitForTimeout(1200); ok(await vis(p, '#rl-back'), 'гость: кнопка в «Посылке»'); await p.click('#rl-back'); await p.waitForTimeout(600);
    ok(['', '#'].includes(await hash(p)), 'гость без истории: на главную (' + await hash(p) + ')'); await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'навигация: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();
