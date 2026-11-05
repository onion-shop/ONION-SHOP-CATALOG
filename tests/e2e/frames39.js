/* Рамки аватара (39 штук): все открываются, надеваются, сохраняются после перезагрузки; файлы грузятся без ошибок; старые рамки сбрасываются.
   Нужен сервер на 8766 и index.demo.html. Скриншоты в shots/fr_*. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.demo.html';
let LIST, WHEEL;
const LEVELS = [['lvl-bronze', 0], ['lvl-silver', 500], ['lvl-gold', 1500], ['lvl-platinum', 4000], ['lvl-diamond', 8000]];
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = (a) => { sessionStorage.setItem('onion.splash', '1'); localStorage.setItem('onion.shop.theme', a.th); if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const mk = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
  const u = { id: '1001', login: 'test', name: 'Лейла', phone: '+7 900 000-00-00', phoneKey: '9000000000', tg: '', email: 't@x.ru', emailKey: 't@x.ru', balance: 1240, xp: a.xp, xpMonth: mk, spent: 0, ordersCount: 0, phoneOk: true, frame: a.frame || 'base', frames: a.frames, promos: [], tasks: null, avatar: '', createdAt: Date.now() - 40 * 86400e3, refCode: 'ABC123', lastCheckin: '' };
  localStorage.setItem('onion.shop.demo.v2', JSON.stringify({ users: [u], sessions: [{ token: 'S', userId: '1001', exp: Date.now() + 9e9 }], orders: [], log: [], seq: { user: 1001, order: 0 } })); localStorage.setItem('onion.shop.session', 'S'); localStorage.setItem('onion.shop.checkin', '1'); };
const open = async (b, w, h, th, a, extra) => { const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h } }, extra || {})); const p = await ctx.newPage(); p.errs = []; p.bad = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) p.errs.push(m.text()); });
  p.on('response', r => { if (/assets\/fr\//.test(r.url()) && r.status() !== 200 && r.status() !== 304) p.bad.push(r.status() + ' ' + r.url()); });
  await p.addInitScript(SEED, Object.assign({ th }, a)); await p.goto(BASE + '#account'); await p.waitForTimeout(1200); return [ctx, p]; };
(async () => {
  LIST = await (await fetch(new URL('assets/fr/list.json', BASE))).json(); WHEEL = LIST.filter(x => !x.id.startsWith('lvl-'));
  const b = await chromium.launch();
  for (const [w, h, th] of [[390, 844, 'light'], [1280, 800, 'dark']]) {
    console.log('--- ' + w + ' ' + th);
    // 1. 34 свободные рамки + статус Серебро: окно, надевание по одной, сохранение
    let [ctx, p] = await open(b, w, h, th, { xp: 700, frames: ['base'].concat(WHEEL.map(x => x.id)) });
    await p.click('#r-frame'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.querySelectorAll('.fr-it').length) === 39, 'в окне 39 рамок одной коллекцией');
    ok(await p.evaluate(() => !/редк|Обычн|Эпич|Легенд/i.test(document.querySelector('.modal').innerText)), 'нет разделов и меток редкости');
    await p.screenshot({ path: `shots/fr_modal_${w}_${th}.png` });
    let worn = 0;
    for (const f of WHEEL.concat([{ id: 'lvl-silver' }])) {
      await p.click(`[data-frame="${f.id}"]`); await p.waitForTimeout(120);
      await p.click('#fr-wear'); await p.waitForFunction((i) => JSON.parse(localStorage.getItem('onion.shop.demo.v2')).users[0].frame === i, f.id, { timeout: 3000 }).catch(() => { }); await p.waitForTimeout(450);
      const cur = await p.evaluate(() => JSON.parse(localStorage.getItem('onion.shop.demo.v2')).users[0].frame);
      if (cur === f.id) worn++; else console.log('   не надета', f.id, cur);
      await p.click('#r-frame'); await p.waitForSelector('.fr-it', { timeout: 3000 }); await p.waitForTimeout(150);
    }
    ok(worn === WHEEL.length + 1, 'все 35 доступных рамок надеваются: ' + worn);
    // сохранение после перезагрузки на последней
    await p.reload(); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => !!document.querySelector('.chip .ava.f-lvl-silver, .tabbar .ava.f-lvl-silver, .ava.lg.f-lvl-silver')), 'рамка сохранилась после перезагрузки');
    ok(p.bad.length === 0, 'файлы рамок грузятся без ошибок ' + p.bad.slice(0, 2).join(' | '));
    ok(p.errs.length === 0, 'нет ошибок JS ' + p.errs.slice(0, 2).join(' | ')); await ctx.close();
    // 2. остальные статусные рамки: надеваются на своём статусе
    for (const [id, xp] of LEVELS) {
      [ctx, p] = await open(b, w, h, th, { xp, frames: ['base'] });
      await p.click('#r-frame'); await p.waitForTimeout(500); await p.click(`[data-frame="${id}"]`); await p.waitForTimeout(150); await p.click('#fr-wear'); await p.waitForFunction((i) => JSON.parse(localStorage.getItem('onion.shop.demo.v2')).users[0].frame === i, id, { timeout: 3000 }).catch(() => { }); await p.waitForTimeout(300);
      ok(await p.evaluate(() => JSON.parse(localStorage.getItem('onion.shop.demo.v2')).users[0].frame) === id, 'статусная рамка ' + id + ' надевается на своём статусе');
      await p.reload(); await p.waitForTimeout(1000); ok(await p.evaluate((i) => !!document.querySelector('.ava.f-' + i), id), id + ' на месте после перезагрузки');
      if (th === 'light' || id === 'lvl-diamond') await p.screenshot({ path: `shots/fr_${id}_${w}_${th}.png` });
      ok(p.errs.length === 0 && p.bad.length === 0, 'без ошибок ' + p.errs.concat(p.bad).slice(0, 2).join('|')); await ctx.close();
    }
    // 3. миграция: надета удалённая рамка, остальные данные целы
    [ctx, p] = await open(b, w, h, th, { xp: 700, frame: 'mint', frames: ['base', 'mint', 'rose', 'f35'] });
    await p.waitForTimeout(500);
    const u = await p.evaluate(async () => { const r = await window.OnionAPI.call('me', {}); return r.user; });
    ok(u.frame === 'base' && u.frames.indexOf('mint') < 0 && u.frames.indexOf('rose') < 0, 'удалённая рамка сброшена на базовую, старые убраны из списка');
    ok(u.balance === 1240 && u.xp === 700, 'ониксы и опыт не тронуты (' + u.balance + ', ' + u.xp + ')'); await ctx.close();
  }
  // 4. prefers-reduced-motion: у рамки с движением картинка не меняется со временем
  for (const mode of ['no-preference', 'reduce']) {
    const [ctx, p] = await open(b, 390, 844, 'light', { xp: 700, frame: 'f5', frames: ['base', 'f5'] }, { reducedMotion: mode });
    await p.evaluate(() => document.querySelector('.ava.lg').scrollIntoView({ block: 'center' }));
    const el = await p.$('.ava.lg'); const box = await el.boundingBox(); const clip = { x: box.x - 30, y: box.y - 30, width: box.width + 60, height: box.height + 60 };
    const s1 = (await p.screenshot({ clip })).toString('base64'); await p.waitForTimeout(2500); const s2 = (await p.screenshot({ clip })).toString('base64');
    ok(mode === 'reduce' ? s1 === s2 : s1 !== s2, 'движение рамки: ' + (mode === 'reduce' ? 'выключено при reduced-motion' : 'есть без reduced-motion'));
    await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'Рамки: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();


