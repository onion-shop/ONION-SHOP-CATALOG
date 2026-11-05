/* Грузомания, открытый район (этап 1): загрузка, движение, столкновения, камера, день и ночь, мини-карта. Нужен сервер на 8766 и index.demo.html. */
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
    await p.goto(BASE + '#games'); await p.waitForTimeout(1000); await p.evaluate(() => { location.hash = 'gruz'; });
    await p.waitForFunction(() => window.__gz2 && window.__gz2.L, null, { timeout: 20000 }); await p.waitForTimeout(1500);
    ok(true, 'район загрузился');
    await p.screenshot({ path: `shots/gz2a_start_${w}.png` });
    await p.evaluate(() => { const g = window.__gz2; g.st.tut = 99; g.tutor.i = 99; });
    // движение клавишами: идём вверх по экрану и вправо
    const p0 = await p.evaluate(() => ({ x: __gz2.P.x, y: __gz2.P.y }));
    await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d');
    const p1 = await p.evaluate(() => ({ x: __gz2.P.x, y: __gz2.P.y }));
    ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 2, 'WASD двигает персонажа: ' + Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) * 10) / 10 + ' м');
    // столкновение со зданием: идём к стене склада
    const hit = await p.evaluate(() => { const g = __gz2, wh = g.L.buildings.find(b => b.id === 'wh'); g.P.x = wh.x; g.P.y = wh.y0 - 1.2; for (let i = 0; i < 120; i++) { g.I.keys = { w: 0 }; const ox = g.P.x, oy = g.P.y; /* вручную: шаг вглубь здания */ g.P.y += .2; if (g.circleHit(g.P.x, g.P.y, .4)) { g.P.y -= .2; break; } } return { inside: g.P.y > wh.y0 + .2, y: g.P.y, y0: wh.y0 }; });
    ok(!hit.inside, 'в здание склада зайти нельзя');
    // деревья и фонари тоже препятствия
    const tr = await p.evaluate(() => { const g = __gz2, t = g.PROPS.find(o => o.t === 'tree'); return g.circleHit(t.x, t.y, .4); });
    ok(tr, 'дерево блокирует проход');
    // телепорт к рынку, плитки подгружаются, ничего не падает
    await p.evaluate(() => { const g = __gz2; g.P.x = -31; g.P.y = 8; g.cam.x = -31; g.cam.y = 8; });
    await p.waitForTimeout(1200); await p.screenshot({ path: `shots/gz2a_market_${w}.png` });
    const nt = await p.evaluate(() => Object.keys(__gz2.tiles).length); ok(nt > 0 && nt < 60, 'плитки земли подгружаются лениво: ' + nt);
    // посещение здания засчитывается рядом с дверью, подсказка и кнопка
    await p.evaluate(() => { const g = __gz2, b = g.L.buildings.find(b => b.id === 'shop'); g.P.x = b.door[0]; g.P.y = b.door[1]; });
    await p.waitForTimeout(900); ok(await p.evaluate(() => !!__gz2.st.seen.shop), 'здание у двери отмечено как посещённое');
    ok(await p.evaluate(() => !document.querySelector('.gz-act').hidden), 'у двери появилась кнопка «Подробнее»');
    // ночь: ставим время, смотрим
    await p.evaluate(() => { __gz2.st.t = 22 * 60; }); await p.waitForTimeout(700); await p.screenshot({ path: `shots/gz2a_night_${w}.png` });
    await p.evaluate(() => { __gz2.st.t = 8 * 60 + 30; __gz2.setZoom(.7); __gz2.P.x = 0; __gz2.P.y = -8; __gz2.cam.x = 0; __gz2.cam.y = -8; }); await p.waitForTimeout(900); await p.screenshot({ path: `shots/gz2a_wide_${w}.png` });
    // машины и пешеходы двигаются
    const mv = await p.evaluate(async () => { const g = __gz2, c0 = g.CARS.map(c => c.s), w0 = g.WALKERS.map(x => x.x + x.y); await new Promise(r => setTimeout(r, 1500)); return { cars: g.CARS.filter((c, i) => Math.abs(c.s - c0[i]) > .5).length, walk: g.WALKERS.filter((x, i) => Math.abs(x.x + x.y - w0[i]) > .3).length }; });
    ok(mv.cars > 10 && mv.walk > 20, 'машины и прохожие едут и идут: ' + JSON.stringify(mv));
    ok(errs.length === 0, 'нет ошибок JS ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'Грузомания район: всё хорошо'); process.exitCode = fails ? 1 : 0;
})();
