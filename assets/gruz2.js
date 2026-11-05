/* gruz2.js: «Грузомания», открытый район (этап 1: карта, движение, камера, день и ночь, здания снаружи).
   Графика отрендерена в Blender (scripts/gz2_art.py): плитки земли с тенями, спрайты зданий, людей, машин и декора.
   Координаты в метрах: x вправо-вниз, y вправо-вверх (камера смотрит из +x,-y). Проекция аффинная: assets/gz2/ground.json. */
(function (W) {
  'use strict';
  var GK = W.GK, ART = 'assets/gz2/', PI = Math.PI, clamp = GK.clamp, lerp = GK.lerp;
  var TILE = 640, MIN_PER_SEC = 2;   // один игровой день: 12 минут реального времени
  var SOLID = { warehouse: 1, shop: 1, cafe: 1, pickup: 1, garage: 1, supplier: 1, office: 1, gas: 1, house: 1 };
  var CAR_ROW = { car: 0, van: 5, truck: 7 };
  var LOOKS_NPC = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'picker', 'packer', 'cashier', 'driver'];
  var STEPS = 4, WALK_SPEED = 5.2;

  function fresh(legacy) { return { v: 2, x: -12, y: -8, t: 8 * 60, day: 1, tut: 0, zoom: 0, seen: {}, legacy: legacy || 0, ms: { lvl: legacy || 1, earn: 0 } }; }
  function load(data) {
    var d = null; try { d = data ? JSON.parse(data) : null; } catch (e) { d = null; }
    if (d && d.v === 2) { var f = fresh(d.legacy); for (var k in d) f[k] = d[k]; f.seen = f.seen || {}; return f; }
    var old = d && +d.lvl || 0; return fresh(old);   // старое сохранение первой версии: уровень учитываем для рамок, остальное начинаем заново
  }

  function open(ctx) {
    var S = GK.shell({ title: 'Грузомания', cls: 'gz' });
    var st = load(ctx.data), alive = true, ready = false, DATA = null, IMG = {}, T = 0, parts = GK.parts();
    var I = GK.input(S, { pinch: true });
    injectCss();
    var $ = function (q) { return S.root.querySelector(q); };

    /* ---- шапка и интерфейс */
    var clockChip = document.createElement('div'); clockChip.className = 'gk-chip gz-clock'; clockChip.innerHTML = '<i class="gz-sun"></i><span>08:00</span><small>день 1</small>'; S.left.appendChild(clockChip);
    S.hud.innerHTML = '<div class="gz-hint" hidden></div><button class="gz-act" type="button" hidden></button><canvas class="gz-mini" width="132" height="132"></canvas><div class="gz-zoom"><button type="button" data-gz="zin" aria-label="Приблизить">+</button><button type="button" data-gz="zout" aria-label="Отдалить">−</button></div>';
    var mini = $('.gz-mini'), mcx = mini.getContext('2d');

    /* ---- камера и проекция */
    var cam = { x: st.x, y: st.y, z: 1 }, P = { x: st.x, y: st.y, vx: 0, vy: 0, dist: 0, d: 0, mv: false };
    function w2p(x, y, z) { var G = DATA.ground; return [G.o[0] + x * G.x[0] + y * G.y[0] + (z || 0) * G.z[0], G.o[1] + x * G.x[1] + y * G.y[1] + (z || 0) * G.z[1]]; }
    var cp = [0, 0];
    function p2s(px, py) { return [(px - cp[0]) * cam.z + S.w / 2, (py - cp[1]) * cam.z + S.h / 2]; }
    function w2s(x, y, z) { var p = w2p(x, y, z); return p2s(p[0], p[1]); }
    function setZoom(z) { cam.z = clamp(z, .55, 2); st.zoom = cam.z; }
    I.onPinch = function (k) { setZoom(cam.z * k); };
    S.root.addEventListener('click', function (e) { var b = e.target.closest('[data-gz]'); if (!b) return; var k = b.getAttribute('data-gz'); if (k === 'zin') setZoom(cam.z * 1.2); else if (k === 'zout') setZoom(cam.z / 1.2); });

    /* ---- сохранение */
    var saver = GK.saver(ctx, S, function () { st.x = P.x; st.y = P.y; return st; }, ctx.onUser);
    function dirty(now) { saver.mark(); if (now) saver.flush(); }

    /* ---- мир: здания, столкновения, декор, прохожие, машины */
    var L, BLD = [], PROPS = [], CARS = [], WALKERS = [], PARKED = [], GRID = {}, SOL = [], lampList = [];
    function bkey(b) { return b.x - b.y; }
    function build() {
      L = DATA.layout; BLD = L.buildings.filter(function (b) { return DATA.bld[b.id]; }).map(function (b) { b.x0 = b.x - b.w / 2; b.x1 = b.x + b.w / 2; b.y0 = b.y - b.d / 2; b.y1 = b.y + b.d / 2; b.k = bkey(b); return b; });
      BLD.sort(function (a, b) { return a.k - b.k; });
      SOL = L.buildings.filter(function (b) { return SOLID[b.type]; });
      L.buildings.forEach(function (b) { b.x0 = b.x - b.w / 2; b.x1 = b.x + b.w / 2; b.y0 = b.y - b.d / 2; b.y1 = b.y + b.d / 2; });
      function cell(x, y) { return Math.floor(x / 10) + ',' + Math.floor(y / 10); }
      function addG(o) { var c = cell(o.x, o.y); (GRID[c] = GRID[c] || []).push(o); }
      var tr = { tree: 0, bush: 1, lamp: 2, bench: 3 };
      L.props.forEach(function (p) {
        var o = { t: p.t, x: p.x, y: p.y, v: p.v || 0, k: p.k || 1, r: p.t === 'tree' ? .55 * (p.k || 1) : p.t === 'bush' ? .5 : p.t === 'lamp' ? .25 : .7, key: p.x - p.y };
        o.col = p.t === 'tree' ? p.v : p.t === 'bush' ? 4 + p.v : p.t === 'lamp' ? 6 : 7;
        o.key = adjust(o.key, o.x, o.y); PROPS.push(o); if (p.t !== 'bush' || true) addG(o); if (p.t === 'lamp') lampList.push(o);
      });
      L.parked.forEach(function (c) { var o = { t: 'car', x: c.x, y: c.y, r: 1.5, row: c.k === 'car' ? c.c % 5 : CAR_ROW[c.k] + (c.c % 2), h: c.rot % 360 === 90 ? 1 : c.rot % 360 === 270 ? 3 : c.rot % 360 === 0 ? 0 : 2, key: c.x - c.y }; o.key = adjust(o.key, o.x, o.y); PARKED.push(o); addG(o); });
      // машины на полосах
      var r = GK.rng(77);
      L.lanes.forEach(function (ln) { for (var i = 0; i < 2; i++) { var len = Math.abs(ln.to - ln.from), s = ln.from + ln.dir * (len * (i + r() * .6) / 2.2); CARS.push({ ln: ln, s: s, sp: 6 + r() * 3, v: 0, row: pickRow(r), wait: 0 }); } });
      // прохожие по петлям тротуаров
      L.walk.forEach(function (loop, li) {
        var lens = [], tot = 0; for (var i = 0; i < loop.length; i++) { var a = loop[i], b = loop[(i + 1) % loop.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(d); tot += d; }
        for (var n = 0; n < 5; n++) WALKERS.push({ loop: loop, lens: lens, tot: tot, s: r() * tot, sp: 1.2 + r() * .6, look: LOOKS_NPC[(li * 5 + n) % LOOKS_NPC.length], dir: r() < .5 ? 1 : -1, x: 0, y: 0, d: 0, dist: r() * 10 });
      });
    }
    function pickRow(r) { var q = r(); return q < .6 ? Math.floor(r() * 5) : q < .85 ? 5 + Math.floor(r() * 2) : 7 + Math.floor(r() * 2); }
    // сдвиг ключа глубины так, чтобы объект рисовался правильно относительно зданий (прямоугольник против точки)
    function adjust(key, x, y) {
      for (var i = 0; i < BLD.length; i++) {
        var b = BLD[i]; if (Math.abs(x - b.x) > b.w / 2 + 40 || Math.abs(y - b.y) > b.d / 2 + 40) continue;
        if (x > b.x1 || y < b.y0) { if (key <= b.k) key = b.k + .001; } else { if (key >= b.k) key = b.k - .001; }
      }
      return key;
    }
    function circleHit(x, y, r) {
      var W0 = L.world; if (x < W0.x0 + 3 || x > W0.x1 - 3 || y < W0.y0 + 3 || y > W0.y1 - 3) return true;
      for (var i = 0; i < SOL.length; i++) { var b = SOL[i]; if (x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r) return true; }
      var cx = Math.floor(x / 10), cy = Math.floor(y / 10);
      for (var a = -1; a <= 1; a++) for (var c = -1; c <= 1; c++) { var g = GRID[(cx + a) + ',' + (cy + c)]; if (!g) continue; for (var j = 0; j < g.length; j++) { var o = g[j]; if (o.t === 'bush') continue; var dx = x - o.x, dy = y - o.y, rr = r + o.r; if (dx * dx + dy * dy < rr * rr) return true; } }
      return false;
    }
    function movePlayer(dx, dy) { if (!circleHit(P.x + dx, P.y, .4)) P.x += dx; if (!circleHit(P.x, P.y + dy, .4)) P.y += dy; }

    /* ---- день и ночь */
    var KEYS = [[0, [84, 94, 156]], [5, [92, 102, 164]], [6.5, [255, 190, 160]], [8, [255, 255, 255]], [17, [255, 255, 255]], [19, [255, 186, 140]], [20.5, [110, 116, 172]], [24, [84, 94, 156]]];
    function tint(h) { for (var i = 1; i < KEYS.length; i++) if (h <= KEYS[i][0]) { var a = KEYS[i - 1], b = KEYS[i], k = (h - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k)]; } return [255, 255, 255]; }
    function night() { var h = st.t / 60, t = tint(h); return clamp(1 - (t[0] + t[1] + t[2]) / 765 * 1.2, 0, 1) * (h < 6.5 || h > 19 ? 1 : .6); }
    var glow = GK.sprite('gz2glow', 64, 64, function (x) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,225,150,.95)'); g.addColorStop(.35, 'rgba(255,200,110,.35)'); g.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, 1);

    /* ---- плитки земли: ленивая загрузка, кэш */
    var tiles = {}, tileCount = 0;
    function getTile(i, j) {
      var k = i + '_' + j, t = tiles[k];
      if (!t) { if (tileCount > 200) return null; t = tiles[k] = { im: new Image(), ok: false, use: T }; t.im.onload = function () { t.ok = true; }; t.im.onerror = function () { t.bad = true; }; t.im.src = ART + 'g_' + k + '.webp'; tileCount++; }
      t.use = T; return t.ok ? t.im : null;
    }
    function evict() { var ks = Object.keys(tiles); if (ks.length < 44) return; ks.sort(function (a, b) { return tiles[a].use - tiles[b].use; }); for (var i = 0; i < ks.length - 36; i++) { if (T - tiles[ks[i]].use < 2) break; var t = tiles[ks[i]]; t.im.onload = null; t.im.src = ''; delete tiles[ks[i]]; tileCount--; } }

    /* ---- обновление */
    var clockAcc = 0, saveAcc = 0;
    function update(dt) {
      T += dt; if (S.paused || !ready) { draw(); return; }
      var d = I.dir(), vx = 0, vy = 0;
      if (d.on) { var wx = d.x + d.y, wy = d.x - d.y, l = Math.hypot(wx, wy) || 1; var sp = WALK_SPEED * Math.min(1, Math.hypot(d.x, d.y)); vx = wx / l * sp; vy = wy / l * sp; }
      if (d.on) { var ox = P.x, oy = P.y; movePlayer(vx * dt, vy * dt); var mv = Math.hypot(P.x - ox, P.y - oy); P.dist += mv; P.vx = vx; P.vy = vy; P.mv = mv > 1e-4; if (P.mv) P.d = dirIndex(vx, vy); } else { P.mv = false; }
      var k = 1 - Math.exp(-7 * dt); cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * k;
      st.t += dt * MIN_PER_SEC; if (st.t >= 1440) { st.t -= 1440; st.day++; }
      clockAcc += dt; if (clockAcc > .5) { clockAcc = 0; var h = Math.floor(st.t / 60), m = Math.floor(st.t % 60); clockChip.querySelector('span').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; clockChip.querySelector('small').textContent = 'день ' + st.day; clockChip.querySelector('.gz-sun').className = 'gz-sun' + (night() > .5 ? ' n' : ''); drawMini(); hint(); }
      saveAcc += dt; if (saveAcc > 8) { saveAcc = 0; dirty(); } saver.tick();
      moveNpcs(dt); parts.step(dt); tutor.update();
      draw();
    }
    function dirIndex(vx, vy) { var th = Math.atan2(-vx, vy); return ((Math.round(th / (PI / 4)) % 8) + 8) % 8; }
    function moveNpcs(dt) {
      // пешеходы
      for (var i = 0; i < WALKERS.length; i++) {
        var w = WALKERS[i]; w.s = (w.s + w.sp * dt * w.dir + w.tot) % w.tot; var s = w.s, n = w.loop.length, idx = 0;
        while (s > w.lens[idx]) { s -= w.lens[idx]; idx = (idx + 1) % n; }
        var a = w.loop[idx], b = w.loop[(idx + 1) % n], f = s / w.lens[idx]; var nx = lerp(a[0], b[0], f), ny = lerp(a[1], b[1], f);
        if (w.x || w.y) { var dx = nx - w.x, dy = ny - w.y; if (dx || dy) w.d = dirIndex(dx * w.dir, dy * w.dir); } w.x = nx; w.y = ny; w.dist += w.sp * dt;
      }
      // машины: едут по полосе, притормаживают перед другой машиной впереди
      for (var c = 0; c < CARS.length; c++) {
        var car = CARS[c], ln = car.ln, pos = ln.ax === 'x' ? [car.s, ln.at] : [ln.at, car.s], blocked = false;
        for (var q = 0; q < CARS.length; q++) {
          if (q === c) continue; var o = CARS[q], po = o.ln.ax === 'x' ? [o.s, o.ln.at] : [o.ln.at, o.s], fx = ln.ax === 'x' ? ln.dir : 0, fy = ln.ax === 'y' ? ln.dir : 0, rx = po[0] - pos[0], ry = po[1] - pos[1];
          var ahead = rx * fx + ry * fy, side = Math.abs(rx * fy - ry * fx); if (ahead > 0 && ahead < 8 && side < 2.2) { blocked = true; break; }
        }
        if (!blocked) { var fx2 = ln.ax === 'x' ? ln.dir : 0, fy2 = ln.ax === 'y' ? ln.dir : 0; for (var u = -1; u < WALKERS.length && !blocked; u++) { var pe = u < 0 ? P : WALKERS[u], rx2 = pe.x - pos[0], ry2 = pe.y - pos[1], ah = rx2 * fx2 + ry2 * fy2, sd = Math.abs(rx2 * fy2 - ry2 * fx2); if (ah > 0 && ah < 7 && sd < 1.7) blocked = true; } }   // пропускаем людей на переходах
        if (blocked && car.wait < 4) { car.wait += dt; car.v = Math.max(0, car.v - 14 * dt); } else { if (!blocked) car.wait = 0; car.v = Math.min(car.sp, car.v + 5 * dt); if (blocked) car.wait += dt; if (car.wait > 6) car.wait = 0; }
        car.s += ln.dir * car.v * dt; if ((ln.dir > 0 && car.s > ln.to) || (ln.dir < 0 && car.s < ln.to)) { car.s = ln.from; car.row = pickRow(GK.rng(Math.floor(T * 1000))); car.v = 0; }
      }
    }

    /* ---- рисование */
    var cx = S.cx;
    function drawSprite(im, sx, sy, sw, sh, dx, dy, dw, dh) { cx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); }
    function draw() {
      if (!ready) return;
      var cpw = w2p(cam.x, cam.y, 1); cp = cpw; var z = cam.z, vw = S.w / z / 2 + 40, vh = S.h / z / 2 + 40, G = DATA.ground;
      cx.fillStyle = '#86b87f'; cx.fillRect(0, 0, S.w, S.h);
      // плитки
      var i0 = Math.floor((cp[0] - vw) / TILE), i1 = Math.floor((cp[0] + vw) / TILE), j0 = Math.floor((cp[1] - vh) / TILE), j1 = Math.floor((cp[1] + vh) / TILE);
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) { if (i < 0 || j < 0 || i * TILE >= G.W || j * TILE >= G.H) continue; var im = getTile(i, j); if (!im) continue; var tw = Math.min(TILE, G.W - i * TILE), th = Math.min(TILE, G.H - j * TILE), p = p2s(i * TILE, j * TILE); cx.drawImage(im, p[0], p[1], tw * z + .8, th * z + .8); }
      if ((T | 0) % 3 === 0) evict();
      // сортируемые объекты
      var list = [], mx0 = cp[0] - vw - 60, mx1 = cp[0] + vw + 60, my0 = cp[1] - vh - 200, my1 = cp[1] + vh + 80;
      function vis(x, y) { var p = w2p(x, y, 0); return p[0] > mx0 && p[0] < mx1 && p[1] > my0 && p[1] < my1; }
      for (var b = 0; b < BLD.length; b++) { var bb = BLD[b], m = DATA.bld[bb.id], po = w2p(0, 0, 0), x0 = po[0] - m.o[0], y0 = po[1] - m.o[1]; if (x0 + m.W < cp[0] - vw || x0 > cp[0] + vw || y0 + m.H < cp[1] - vh || y0 > cp[1] + vh) continue; list.push({ k: bb.k, t: 0, b: bb }); }
      for (var q = 0; q < PROPS.length; q++) { var pr = PROPS[q]; if (vis(pr.x, pr.y)) list.push({ k: pr.key, t: 1, o: pr }); }
      for (var q2 = 0; q2 < PARKED.length; q2++) { var pk = PARKED[q2]; if (vis(pk.x, pk.y)) list.push({ k: pk.key, t: 2, o: pk, row: pk.row, h: pk.h, x: pk.x, y: pk.y }); }
      for (var c = 0; c < CARS.length; c++) { var car = CARS[c], ln = car.ln, x = ln.ax === 'x' ? car.s : ln.at, y = ln.ax === 'x' ? ln.at : car.s; if (!vis(x, y)) continue; list.push({ k: adjust(x - y, x, y), t: 2, row: car.row, h: ln.ax === 'x' ? (ln.dir > 0 ? 0 : 2) : (ln.dir > 0 ? 1 : 3), x: x, y: y, mv: car.v > .5 }); }
      for (var w = 0; w < WALKERS.length; w++) { var wk = WALKERS[w]; if (vis(wk.x, wk.y)) list.push({ k: adjust(wk.x - wk.y, wk.x, wk.y), t: 3, look: wk.look, d: wk.d, f: Math.floor(wk.dist / .42) % STEPS, x: wk.x, y: wk.y }); }
      list.push({ k: adjust(P.x - P.y, P.x, P.y) + .0005, t: 3, look: 'player', d: P.d, f: P.mv ? Math.floor(P.dist / .45) % STEPS : 0, x: P.x, y: P.y, me: 1 });
      list.sort(function (a, b) { return a.k - b.k; });
      for (var n = 0; n < list.length; n++) {
        var it = list[n];
        if (it.t === 0) { var bg = it.b, mt = DATA.bld[bg.id], po2 = w2p(0, 0, 0), s0 = p2s(po2[0] - mt.o[0], po2[1] - mt.o[1]); cx.drawImage(IMG['b_' + bg.id], s0[0], s0[1], mt.W * z, mt.H * z); }
        else if (it.t === 1) drawProp(it.o);
        else if (it.t === 2) drawCar(it);
        else drawPerson(it);
      }
      parts.draw(cx, 0, 0);
      // ночь: затемнение и свет фонарей
      var tn = tint(st.t / 60); if (tn[0] < 254 || tn[1] < 254 || tn[2] < 254) { cx.globalCompositeOperation = 'multiply'; cx.fillStyle = 'rgb(' + (tn[0] | 0) + ',' + (tn[1] | 0) + ',' + (tn[2] | 0) + ')'; cx.fillRect(0, 0, S.w, S.h); cx.globalCompositeOperation = 'source-over'; }
      var nt = night(); if (nt > .08) {
        cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = Math.min(1, nt * 1.1);
        for (var l = 0; l < lampList.length; l++) { var lp = lampList[l]; if (!vis(lp.x, lp.y)) continue; var sp = w2s(lp.x, lp.y, 5), gs = 150 * z; cx.drawImage(glow, sp[0] - gs / 2, sp[1] - gs / 2, gs, gs); }
        for (var c2 = 0; c2 < CARS.length; c2++) { var cr = CARS[c2], lx = cr.ln.ax === 'x' ? cr.s : cr.ln.at, ly = cr.ln.ax === 'x' ? cr.ln.at : cr.s; if (!vis(lx, ly)) continue; var fx = cr.ln.ax === 'x' ? cr.ln.dir * 2.6 : 0, fy = cr.ln.ax === 'y' ? cr.ln.dir * 2.6 : 0, hp = w2s(lx + fx, ly + fy, 1), hs = 110 * z; cx.drawImage(glow, hp[0] - hs / 2, hp[1] - hs / 2, hs, hs); }
        cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      }
      drawLabels();
    }
    function drawProp(o) {
      var m = DATA.props, z = cam.z, p = w2s(o.x, o.y, 0), k = o.t === 'tree' ? o.k : 1, sw = m.fw * z * k, sh = m.fh * z * k;
      cx.drawImage(IMG.props, o.col * m.fw, 0, m.fw, m.fh, p[0] - m.ax * z * k, p[1] - m.ay * z * k, sw, sh);
    }
    function drawCar(it) {
      var m = DATA.veh, z = cam.z, p = w2s(it.x, it.y, 0), bob = it.mv ? Math.sin(T * 24 + it.x) * .6 * z : 0;
      cx.drawImage(IMG.veh, it.h * m.fw, it.row * m.fh, m.fw, m.fh, p[0] - m.ax * z, p[1] - m.ay * z + bob, m.fw * z, m.fh * z);
    }
    function drawPerson(it) {
      var m = DATA.chars, z = cam.z, p = w2s(it.x, it.y, 0), im = IMG['ch_' + it.look]; if (!im) return;
      cx.fillStyle = 'rgba(15,25,50,.2)'; cx.beginPath(); cx.ellipse(p[0] + 3 * z, p[1] + 1 * z, 11 * z, 5 * z, 0, 0, PI * 2); cx.fill();
      cx.drawImage(im, it.d * m.fw, it.f * m.fh, m.fw, m.fh, p[0] - m.ax * z, p[1] - m.ay * z, m.fw * z, m.fh * z);
      if (it.me) { cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p[0], p[1], 15 * z, 7.5 * z, 0, 0, PI * 2); cx.stroke(); }
    }
    var labelCache = {};
    function label(txt) { return GK.sprite('gz2lb' + txt, 160, 24, function (x, w, h) { x.font = '800 12px Onest, system-ui, sans-serif'; var tw = Math.min(w - 4, x.measureText(txt).width + 18); GK.rr(x, (w - tw) / 2, 2, tw, 20, 10); x.fillStyle = 'rgba(11,29,58,.82)'; x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, 12.5, w - 12); }, 2); }
    function drawLabels() {
      if (cam.z < .7) return;
      L.buildings.forEach(function (b) {
        if (b.type === 'house' || b.type === 'parking' || b.type === 'dock') return; var p = w2s(b.x, b.y, b.h + 2.2); if (p[0] < -90 || p[0] > S.w + 90 || p[1] < -30 || p[1] > S.h + 30) return;
        var lb = label(b.name); cx.drawImage(lb, p[0] - 80, p[1] - 24, 160, 24);
      });
      // стрелка к цели
      var g = goal(); if (!g) return; var gp = w2s(g.door[0], g.door[1], 3), bounce = Math.sin(T * 4) * 5;
      if (gp[0] > 20 && gp[0] < S.w - 20 && gp[1] > 90 && gp[1] < S.h - 40) { cx.fillStyle = '#ffd34d'; cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(gp[0], gp[1] + bounce); cx.lineTo(gp[0] - 11, gp[1] - 16 + bounce); cx.lineTo(gp[0] + 11, gp[1] - 16 + bounce); cx.closePath(); cx.stroke(); cx.fill(); }
      else { var ax = S.w / 2, ay = S.h / 2, dx = gp[0] - ax, dy = gp[1] - ay, a = Math.atan2(dy, dx), ex = clamp(ax + Math.cos(a) * 1e4, 34, S.w - 34), ey = clamp(ay + Math.sin(a) * 1e4, 100, S.h - 90), t = Math.min((ex - ax) / (Math.cos(a) || 1e-9), (ey - ay) / (Math.sin(a) || 1e-9)); t = Math.abs(t); var px = ax + Math.cos(a) * t, py = ay + Math.sin(a) * t; cx.save(); cx.translate(px, py); cx.rotate(a); cx.fillStyle = '#ffd34d'; cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(14, 0); cx.lineTo(-8, -12); cx.lineTo(-8, 12); cx.closePath(); cx.stroke(); cx.fill(); cx.restore(); }
    }

    /* ---- мини-карта */
    var miniBg = null;
    function mapXY(x, y) { var W0 = L.world, u = (x + y) - (W0.x0 + W0.y0), v = (x - y) - (W0.x0 - W0.y1), R = (W0.x1 - W0.x0) + (W0.y1 - W0.y0); return [u / R * 128 + 2, v / R * 128 + 2]; }
    function drawMini() {
      if (!miniBg) {
        miniBg = document.createElement('canvas'); miniBg.width = miniBg.height = 132; var m = miniBg.getContext('2d'), W0 = L.world;
        function quad(x0, y0, x1, y1, col) { var a = mapXY(x0, y0), b = mapXY(x1, y0), c = mapXY(x1, y1), d = mapXY(x0, y1); m.fillStyle = col; m.beginPath(); m.moveTo(a[0], a[1]); m.lineTo(b[0], b[1]); m.lineTo(c[0], c[1]); m.lineTo(d[0], d[1]); m.closePath(); m.fill(); }
        quad(W0.x0, W0.y0, W0.x1, W0.y1, '#7fb578'); L.roads.forEach(function (r) { quad(Math.max(W0.x0, r.x - r.w / 2), Math.max(W0.y0, r.y - r.d / 2), Math.min(W0.x1, r.x + r.w / 2), Math.min(W0.y1, r.y + r.d / 2), '#5a616d'); });
        L.buildings.forEach(function (b) { if (b.type === 'parking') quad(b.x0, b.y0, b.x1, b.y1, '#8d96a3'); else if (b.type !== 'dock') quad(b.x0, b.y0, b.x1, b.y1, b.type === 'house' ? '#e3b9a0' : '#ffffff'); });
      }
      mcx.clearRect(0, 0, 132, 132); mcx.globalAlpha = .92; mcx.drawImage(miniBg, 0, 0); mcx.globalAlpha = 1;
      var g = goal(); if (g) { var q = mapXY(g.door[0], g.door[1]); mcx.fillStyle = '#ffd34d'; mcx.beginPath(); mcx.arc(q[0], q[1], 4, 0, PI * 2); mcx.fill(); mcx.strokeStyle = '#0b1d3a'; mcx.lineWidth = 1.5; mcx.stroke(); }
      var me = mapXY(P.x, P.y); mcx.fillStyle = '#ff5a6e'; mcx.beginPath(); mcx.arc(me[0], me[1], 3.5, 0, PI * 2); mcx.fill(); mcx.strokeStyle = '#fff'; mcx.lineWidth = 1.5; mcx.stroke();
    }

    /* ---- цели, подсказка, здания */
    var ORDER = ['wh', 'market', 'shop', 'supplier', 'garage', 'office', 'gas', 'cafe', 'pickup'];
    function goal() { for (var i = 0; i < ORDER.length; i++) if (!st.seen[ORDER[i]]) return L.buildings.filter(function (b) { return b.id === ORDER[i]; })[0]; return null; }
    function nearBuilding() { var best = null, bd = 6; L.buildings.forEach(function (b) { if (b.type === 'house' || b.type === 'parking' || b.type === 'dock') return; var d = Math.hypot(P.x - b.door[0], P.y - b.door[1]); if (d < bd) { bd = d; best = b; } }); return best; }
    var actB = null;
    function hint() {
      var h = $('.gz-hint'), a = $('.gz-act'), nb = nearBuilding(), g = goal(), msg;
      if (nb && !st.seen[nb.id] && Math.hypot(P.x - nb.door[0], P.y - nb.door[1]) < 3.6) { st.seen[nb.id] = 1; dirty(); GK.sfx.up(); S.toast('Новое место: ' + nb.name, 'gold'); }
      if (g) { var d = Math.round(Math.hypot(P.x - g.door[0], P.y - g.door[1])); msg = 'Дальше: ' + g.name + ' (' + d + ' м). Следуйте за жёлтой стрелкой.'; } else msg = 'Район изучен. Скоро здесь появятся закупки, перевозки и заказы.';
      h.hidden = tutor.active() || S.sheetOpen(); h.textContent = msg;
      actB = nb; a.hidden = !nb || tutor.active() || S.sheetOpen(); if (nb) a.textContent = 'Подробнее: ' + nb.name;
    }
    $('.gz-act').addEventListener('click', function () { if (actB) buildingSheet(actB); });
    var INFO = { wh: 'Главный склад. Здесь хранится товар, сюда его привозят с рынка и поставщиков, отсюда он уходит в магазин и пункты выдачи.', market: 'Рынок поставщиков. Торговцы продают товар оптом: чем больше партия, тем ниже цена. Бывают редкие лоты.', shop: 'Ваш магазин и торговый зал: покупатели приходят и приезжают сами.', supplier: 'Оптовый поставщик: большие партии со скидкой. Привезти их можно на фуре.', garage: 'Гараж и мастерская: ремонт, топливо и покупка новых машин.', office: 'Офис компании: уровень, исследования, контракты и рейтинг.', gas: 'Заправка: топливо для ваших машин и фур.', cafe: 'Кафе для сотрудников: отдых снижает усталость и поднимает настроение.', pickup: 'Пункт выдачи: сюда доставляют посылки для клиентов района.', factory: 'Фабрика одежды: источник товара и контрактов.' };
    function buildingSheet(b) {
      S.sheet(GK.esc(b.name), '<p class="gk-lead">' + GK.esc(INFO[b.id] || 'Здание района.') + '</p><p class="gk-lead" style="opacity:.8">Вход внутрь появится в следующем обновлении этапа 2. Пока можно изучать район.</p><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Понятно</button></div>', { w: 400 });
    }
    var tutor = GK.tutor(S, [
      { id: 'hi', t: 'Добро пожаловать в Грузоманию! Это ваш район. Здесь вы будете закупать товар, возить его, хранить и продавать.', ok: 'Начнём', top: true },
      { id: 'move', t: 'Идите: джойстик слева (на телефоне) или клавиши W A S D. Колесо мыши и щипок меняют масштаб.', top: true, done: function () { return P.dist > 12; } },
      { id: 'go', t: 'Жёлтая стрелка показывает, куда идти. Дойдите до Центрального склада.', top: true, done: function () { return st.seen.wh; } },
      { id: 'end', t: 'Это ваша база. Обойдите район: рынок, магазин, поставщиков. Время идёт, наступит ночь, зажгутся фонари.', ok: 'Отлично', top: true }
    ], st, function () { dirty(true); });
    S.onhelp = function () { st.tut = 0; tutor.i = 0; tutor.shown = -1; };

    /* ---- загрузка */
    function jget(f) { return fetch(ART + f).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }
    function loadArt() {
      return Promise.all([jget('layout.json'), jget('ground.json'), jget('bld.json'), jget('chars.json'), jget('veh.json'), jget('props.json')]).then(function (r) {
        DATA = { layout: r[0], ground: r[1], bld: r[2], chars: r[3], veh: r[4], props: r[5] };
        var files = { props: 'props.webp', veh: 'veh.webp' }; Object.keys(r[2]).forEach(function (id) { files['b_' + id] = 'b_' + id + '.webp'; }); Object.keys(r[3].looks).forEach(function (k) { files['ch_' + k] = 'ch_' + k + '.webp'; });
        var names = Object.keys(files), left = names.length;
        return new Promise(function (res, rej) { names.forEach(function (n) { var im = new Image(); im.onload = function () { IMG[n] = im; if (!--left) res(); }; im.onerror = function () { rej(new Error('img ' + n)); }; im.src = ART + files[n]; }); });
      });
    }
    function start() {
      build();
      for (var r = 0; circleHit(P.x, P.y, .4) && r < 40; r += .5) for (var a = 0; a < 12; a++) { var tx = st.x + Math.cos(a * .5236) * r, ty = st.y + Math.sin(a * .5236) * r; if (!circleHit(tx, ty, .4)) { P.x = tx; P.y = ty; r = 99; break; } }   // не застрять в препятствии при старте
      cam.x = P.x; cam.y = P.y; ready = true; setZoom(st.zoom || clamp(S.w / 560, .95, 1.5)); hint(); drawMini(); S.loaded(); GK.music('warm');
      S.onclose = function () { if (!alive) return; alive = false; loop.stop(); I.destroy(); saver.flush(true).then(function () { saver.stop(); saver.off(); S.destroy(); ctx.onClose(); }); };
    }
    var loop = GK.loop(function (dt) { if (alive) update(dt); });
    S.onclose = function () { if (!alive) return; alive = false; loop.stop(); I.destroy(); S.destroy(); ctx.onClose(); };
    loadArt().then(start, function () {
      S.loaded(); S.sheet('Нет связи', '<p class="gk-lead">Не удалось загрузить графику игры. Проверьте интернет и попробуйте ещё раз.</p><div class="gk-row"><button class="gk-btn" id="gz-retry" type="button">Повторить</button><button class="gk-btn g" id="gz-quit" type="button">Выйти</button></div>', { noClose: true, w: 380 });
      $('#gz-retry').addEventListener('click', function () { location.reload(); }); $('#gz-quit').addEventListener('click', function () { S.onclose(); });
    });
    W.__gz2 = { st: st, P: P, cam: cam, S: S, I: I, update: update, tutor: tutor, circleHit: circleHit, w2s: w2s, goal: goal, hint: hint, CARS: CARS, WALKERS: WALKERS, PROPS: PROPS, get L() { return L; }, get BLD() { return BLD; }, setZoom: setZoom, tiles: tiles, buildingSheet: buildingSheet };
    return { close: function () { S.onclose(); } };
  }

  function injectCss() {
    if (document.getElementById('gz2-css')) return; var s = document.createElement('style'); s.id = 'gz2-css';
    s.textContent = '.gz{--gk-acc:linear-gradient(140deg,#43c9e3,#1a86c0)}' +
      '.gz-clock span{font-weight:800;font-variant-numeric:tabular-nums}.gz-clock small{opacity:.75;font-size:.72rem}.gz-sun{display:inline-block;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7c2,#ffd34d 60%,#e0a020);flex:none}.gz-sun.n{background:radial-gradient(circle at 65% 35%,transparent 38%,#cfd9ff 40%);box-shadow:inset -4px 2px 0 #cfd9ff}' +
      '.gz-hint{position:absolute;left:50%;top:calc(60px + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(92vw,440px);padding:9px 14px;border-radius:14px;background:rgba(255,255,255,.95);color:#0f2747;font-weight:700;font-size:.86rem;line-height:1.3;text-align:center;box-shadow:0 8px 20px rgba(8,30,70,.25);z-index:4;pointer-events:none}.gz-hint[hidden],.gz-act[hidden]{display:none}' +
      '.gz-act{position:absolute;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);height:52px;padding:0 24px;border-radius:16px;border:0;background:linear-gradient(140deg,#ffb347,#ff7a1a);color:#fff;font-weight:800;font-size:1rem;box-shadow:0 10px 26px rgba(255,122,26,.45),0 0 0 3px rgba(255,255,255,.25);z-index:5;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}' +
      '.gz-mini{position:absolute;right:10px;top:calc(60px + env(safe-area-inset-top,0px));width:112px;height:112px;border-radius:16px;background:rgba(11,29,58,.55);border:1px solid rgba(255,255,255,.25);z-index:4;pointer-events:none;backdrop-filter:blur(6px)}' +
      '.gz-zoom{position:absolute;right:10px;bottom:calc(26px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:6px;z-index:5}.gz-zoom button{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(11,29,58,.72);color:#fff;font:800 1.3rem/1 Onest,sans-serif}' +
      '@media (max-width:480px){.gz-mini{width:96px;height:96px;top:calc(56px + env(safe-area-inset-top,0px))}.gz-hint{top:calc(56px + env(safe-area-inset-top,0px));max-width:calc(100vw - 130px);left:10px;transform:none;text-align:left;font-size:.8rem}}' +
      '.gz .gk-tut{z-index:25}';
    document.head.appendChild(s);
  }
  W.Gruz2 = { open: open, model: { fresh: fresh, load: load } };
})(window);
