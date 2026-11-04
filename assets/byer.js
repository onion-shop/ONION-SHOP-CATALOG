/* byer.js: игра «Байер» (3D, внутри сайта). Движок: assets/g3d.js. Правила, награды и проверка смен на сервере (core.js, actions byr*).
   Здесь: мир, управление, анимации, интерфейс игры. */
(function (W) {
  'use strict';
  var G = W.G3D, MB = G.MB, Node = G.Node, Cam = G.Cam, Core = W.OnionCore;
  var PI = Math.PI;

  /* ---------------------------------------------------------------- данные мира */
  var ITEM = [
    { n: 'Футболка', c: '#ff5a6e', d: '#c93a4e' },
    { n: 'Худи', c: '#8a6cff', d: '#5f45d6' },
    { n: 'Кроссовки', c: '#ffae2b', d: '#d68410' }
  ];
  var HOUSE_COL = [['#ffd9c2', '#e2563f'], ['#d9ecff', '#2f6fd0'], ['#e4f5d4', '#3f9b5a'], ['#ffeec2', '#d98a1f'], ['#f1dcff', '#8b4fd0'], ['#d4f3ee', '#1f9aa0']];
  var HOUSE = (function () { var o = []; [-120, -72, -24, 24, 72, 120].forEach(function (a) { var r = a * PI / 180; o.push({ x: 16 * Math.sin(r), z: -16 * Math.cos(r) }); }); return o; })();
  HOUSE.forEach(function (h) { var l = Math.hypot(h.x, h.z); h.dx = -h.x / l; h.dz = -h.z / l; h.ry = Math.atan2(h.dx, h.dz); h.door = { x: h.x + h.dx * 4.6, z: h.z + h.dz * 4.6 }; });
  var STATION = [{ x: -9, z: 11.5 }, { x: 0, z: 13.5 }, { x: 9, z: 11.5 }];
  var IP = [
    { id: 'van', x: 4.6, z: 0.4, r: 2.6, t: 'Начать смену' },
    { id: 'shop', x: -4.6, z: 0.4, r: 2.6, t: 'Мастерская' },
    { id: 'board', x: -2.6, z: -5, r: 2.4, t: 'Задания дня' },
    { id: 'chest', x: 2.6, z: -5, r: 2.4, t: 'Сундук недели' }
  ];
  var OBST = HOUSE.map(function (h) { return { x: h.x, z: h.z, r: 3.1 }; }).concat([
    { x: 0, z: 0, r: 1.9 }, { x: -9, z: 0, r: 2.7 }, { x: 9.2, z: 0.2, r: 2.2 }, { x: -2.6, z: -6.4, r: .7 }, { x: 2.6, z: -6.4, r: 1 }, { x: 0, z: 19, r: 0 },
    { x: -9, z: 13.4, r: 1.3 }, { x: 0, z: 15.4, r: 1.3 }, { x: 9, z: 13.4, r: 1.3 }
  ]);
  var BOUND = 20.5;

  /* ---------------------------------------------------------------- звук */
  var audio = { ctx: null, on: true };
  try { audio.on = localStorage.getItem('onion.byer.snd') !== '0'; } catch (e) { }
  function tone(f, d, type, vol, at, f2) {
    if (!audio.on) return;
    try {
      if (!audio.ctx) audio.ctx = new (W.AudioContext || W.webkitAudioContext)();
      var c = audio.ctx, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) { }
  }
  var SFX = {
    pick: function () { tone(520, 0.09, 'triangle', 0.09, 0, 840); },
    coin: function () { tone(880, 0.1, 'sine', 0.09); tone(1320, 0.16, 'sine', 0.08, 0.07); },
    bad: function () { tone(220, 0.25, 'sawtooth', 0.05, 0, 120); },
    tick: function () { tone(660, 0.08, 'square', 0.04); },
    go: function () { tone(880, 0.25, 'square', 0.05); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.09, i * 0.1); }); },
    ui: function () { tone(440, 0.06, 'sine', 0.05); }
  };

  /* ---------------------------------------------------------------- текстуры (рисуются в canvas) */
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function drawItem(x, k, cx, cy, s, col, dark) {
    x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = col; x.strokeStyle = dark; x.lineWidth = 0.06; x.lineJoin = 'round'; x.beginPath();
    var P;
    if (k === 0) P = [[-.5, -.28], [-.22, -.42], [-.1, -.36], [.1, -.36], [.22, -.42], [.5, -.28], [.4, -.04], [.26, -.12], [.26, .44], [-.26, .44], [-.26, -.12], [-.4, -.04]];
    else if (k === 1) P = [[-.55, -.2], [-.24, -.42], [-.12, -.42], [.12, -.42], [.24, -.42], [.55, -.2], [.46, .22], [.3, .16], [.3, .46], [-.3, .46], [-.3, .16], [-.46, .22]];
    else P = [[-.52, .22], [-.52, -.08], [-.2, -.16], [-.06, -.34], [.1, -.14], [.5, .02], [.54, .22]];
    P.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.85)';
    if (k === 1) { x.beginPath(); x.arc(0, -.34, .17, 0, PI * 2); x.fill(); x.fillStyle = dark; x.fillRect(-.14, .22, .28, .12); }
    if (k === 2) { x.fillRect(-.54, .2, 1.08, .1); }
    x.restore();
  }
  function bubbleCanvas(k) {
    var c = cv(160, 176), x = c.getContext('2d'), it = ITEM[k];
    x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 8; x.shadowOffsetY = 3;
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(24, 10); x.arcTo(150, 10, 150, 30, 26); x.arcTo(150, 124, 130, 124, 26);
    x.lineTo(96, 124); x.lineTo(80, 150); x.lineTo(64, 124); x.lineTo(30, 124); x.arcTo(10, 124, 10, 100, 26); x.arcTo(10, 10, 30, 10, 26); x.closePath(); x.fill();
    x.shadowColor = 'transparent'; x.lineWidth = 6; x.strokeStyle = it.c; x.stroke();
    drawItem(x, k, 80, 66, 78, it.c, it.d);
    return c;
  }
  function softCanvas() {
    var c = cv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  }
  function coinCanvas() {
    var c = cv(64, 64), x = c.getContext('2d');
    x.fillStyle = '#c98a10'; x.beginPath(); x.arc(32, 32, 28, 0, PI * 2); x.fill();
    x.fillStyle = '#ffd34d'; x.beginPath(); x.arc(32, 32, 23, 0, PI * 2); x.fill();
    x.fillStyle = '#ffe98f'; x.beginPath(); x.arc(26, 26, 9, 0, PI * 2); x.fill();
    x.strokeStyle = '#c98a10'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 14, 0, PI * 2); x.stroke(); return c;
  }
  function textCanvas(str, col, px, stroke) {
    var c = cv(8, 8), x = c.getContext('2d'); x.font = '800 ' + px + 'px Onest,Inter,system-ui,sans-serif';
    var w = Math.ceil(x.measureText(str).width) + 24, h = px + 20; c.width = w; c.height = h; x = c.getContext('2d');
    x.font = '800 ' + px + 'px Onest,Inter,system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 8; x.strokeStyle = stroke || 'rgba(8,20,46,.85)'; x.strokeText(str, w / 2, h / 2 + 1); x.fillStyle = col; x.fillText(str, w / 2, h / 2 + 1);
    return c;
  }

  /* ---------------------------------------------------------------- построение объектов */
  function figure(R, o) {
    var skin = o.skin || '#f3c9a5', hair = o.hair || '#3a2a22', root = new Node(), P = {};
    function part(mb, x, y, z) { var n = new Node(R.build(mb)); n.x = x; n.y = y; n.z = z; return n; }
    var body = new MB(); body.box(.86, .95, .54, o.shirt, 0, 0, 0); body.box(.9, .16, .58, o.belt || '#2d3a55', 0, -.4, 0);
    if (o.stripe) body.box(.88, .1, .56, o.stripe, 0, .1, 0);
    P.body = root.add(part(body, 0, 1.32, 0));
    [-1, 1].forEach(function (sd) {
      var l = new MB(); l.box(.3, .9, .32, o.pants || '#2d3a55', 0, -.45, 0); l.box(.32, .2, .42, o.shoe || '#f4f6fa', 0, -.84, .05);
      var a = new MB(); a.box(.24, .56, .26, o.shirt, 0, -.28, 0); a.sph(.14, skin, 0, -.62, 0, 1, 6);
      P[sd < 0 ? 'legL' : 'legR'] = root.add(part(l, sd * .21, .88, 0));
      P[sd < 0 ? 'armL' : 'armR'] = root.add(part(a, sd * .56, 1.72, 0));
    });
    var hd = new MB(); hd.sph(.44, skin, 0, 0, 0, 1.05, 10); hd.sph(.46, hair, 0, .1, -.05, 1, 9);
    hd.sph(.06, '#1b2433', -.16, .02, .38, 1, 5); hd.sph(.06, '#1b2433', .16, .02, .38, 1, 5);
    if (o.cap) { hd.cyl(.4, .46, .2, 10, o.cap, 0, .38, 0); hd.box(.5, .06, .4, o.cap, 0, .3, .42); }
    if (o.pack) { P.pack = null; }
    P.head = root.add(part(hd, 0, 2.2, 0));
    if (o.pack) { var pk = new MB(); pk.box(.7, .8, .3, o.pack, 0, 0, 0); pk.box(.6, .12, .32, '#fff', 0, .1, 0); root.add(part(pk, 0, 1.4, -.42)); }
    root.P = P; root.s = o.s || 0.8;
    return root;
  }
  function parcel(R, k, s) {
    var m = new MB(); m.shade = .1; m.box(.8 * s, .5 * s, .6 * s, ITEM[k].c, 0, 0, 0); m.box(.18 * s, .52 * s, .62 * s, '#fff6d8', 0, 0, 0);
    return R.build(m);
  }
  function houseMesh(wall, roof) {
    var m = new MB(); m.shade = .14;
    m.box(5.4, .3, 4.8, '#c9c3b8', 0, .15, 0); m.box(5, 3.2, 4.4, wall, 0, 1.9, 0); m.roof(5.9, 2, 5.1, roof, 0, 3.5, 0, 0, shade(roof, .82));
    m.box(1.15, 2.1, .14, '#5a3a2a', 0, 1.35, 2.25); m.box(1.5, 2.3, .1, '#fffaf0', 0, 1.45, 2.2); m.sph(.07, '#f7c948', .35, 1.3, 2.34, 1, 5);
    [-1.6, 1.6].forEach(function (x) { m.box(1.15, 1.15, .1, '#fffaf0', x, 2.4, 2.2); m.box(.9, .9, .12, '#9fd8f0', x, 2.4, 2.22); m.box(.06, .9, .14, '#fffaf0', x, 2.4, 2.23); });
    m.box(2.3, .14, 1.2, roof, 0, 3.0, 2.85); m.box(.1, 2.7, .1, '#fffaf0', -1.1, 1.5, 3.3); m.box(.1, 2.7, .1, '#fffaf0', 1.1, 1.5, 3.3);
    m.box(.7, 1.5, .7, '#a66e5a', 1.7, 5.0, -1.1);
    m.box(.12, .9, .12, '#6b4a34', 2.5, .5, 3.1); m.box(.5, .36, .34, '#d8434e', 2.5, 1.1, 3.1);
    return m;
  }
  function shade(h, k) { var c = G.col(h); return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(1, v * k)) * 255).toString(16)).slice(-2); }).join(''); }
  function tree(m, x, z, s, type) {
    m.shade = .22; m.cyl(.22 * s, .3 * s, 1.6 * s, 6, '#7a5238', x, .8 * s, z, true);
    if (type === 0) { m.sph(1.5 * s, '#4fb36a', x, 2.7 * s, z, .9, 8); m.sph(1.05 * s, '#63c97c', x + .5 * s, 3.5 * s, z - .2 * s, .9, 7); }
    else { m.cone(1.5 * s, 2.2 * s, 7, '#2f9a5d', x, 2.4 * s, z); m.cone(1.15 * s, 1.9 * s, 7, '#3fb46f', x, 3.6 * s, z); m.cone(.8 * s, 1.5 * s, 7, '#55c982', x, 4.6 * s, z); }
  }
  function lamp(m, x, z) { m.cyl(.1, .14, 3.2, 6, '#44506a', x, 1.6, z, true); m.sph(.34, '#fff2b8', x, 3.4, z, 1, 7); m.cyl(.2, .4, .22, 7, '#44506a', x, 3.7, z, true); }

  function buildWorld(R) {
    var m = new MB(), i;
    // остров
    m.shade = .06; m.box(49, 1.6, 49, '#e8d8a8', 0, -.9, 0); m.box(44, 1.4, 44, '#7fcf86', 0, -.7, 0);
    m.shade = .03; m.cyl(10.6, 10.6, .12, 40, '#e2d4b2', 0, .02, 0, true); m.cyl(8.2, 8.2, .14, 40, '#eadfc4', 0, .04, 0, true);
    for (i = 0; i < 6; i++) { // дорожки к домам
      var h = HOUSE[i], l = Math.hypot(h.x, h.z) - 5, mx = h.x * .5 * (1 - 5 / Math.hypot(h.x, h.z)) * 1 + h.x * .12, mz = h.z * .5 + h.z * .0;
      m.add(new MB().box(2.4, .1, 11, '#efe3c6', 0, 0, 0), h.x * .6, .02, h.z * .6, Math.atan2(h.x, h.z));
    }
    for (i = 0; i < 3; i++) m.add(new MB().box(2.4, .1, 8, '#efe3c6', 0, 0, 0), STATION[i].x * .5, .02, 5 + STATION[i].z * .35, Math.atan2(STATION[i].x * .5, 7));
    // дома
    HOUSE.forEach(function (h, k) { m.add(houseMesh(HOUSE_COL[k][0], HOUSE_COL[k][1]), h.x, 0, h.z, h.ry); });
    // склад
    var w = new MB(); w.shade = .12;
    w.box(22, 4, 5, '#e3e8f1', 0, 2, 0); w.box(22.6, .5, 5.6, '#7d92bf', 0, 4.2, 0); w.box(22.6, .2, 5.6, '#a9bbdc', 0, 4.5, 0);
    [-1, 1].forEach(function (sd) {
      for (i = -2; i <= 2; i++) { w.box(3.4, 3, .2, '#2f3f63', i * 4.4, 1.5, sd * 2.55); for (var j = 0; j < 5; j++) w.box(3.4, .16, .22, '#8ba0cf', i * 4.4, .6 + j * .55, sd * 2.57); }
      w.box(22, .5, .3, '#1a86c0', 0, 3.6, sd * 2.55);
    });
    m.add(w, 0, 0, 20.6, PI);
    // деревья, лампы, цветы
    var rnd = (function (a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(7);
    function free(x, z, d) { for (var q = 0; q < OBST.length; q++) if (Math.hypot(x - OBST[q].x, z - OBST[q].z) < OBST[q].r + d) return false; for (q = 0; q < IP.length; q++) if (Math.hypot(x - IP[q].x, z - IP[q].z) < 3) return false; for (q = 0; q < 3; q++) if (Math.hypot(x - STATION[q].x, z - STATION[q].z) < 3) return false; return Math.hypot(x, z) > 11.6 || Math.hypot(x, z) < 0; }
    var placed = 0, tries = 0;
    while (placed < 26 && tries < 400) {
      tries++; var a = rnd() * PI * 2, r = 8 + rnd() * 13, x = r * Math.sin(a), z = -r * Math.cos(a);
      if (Math.abs(x) > 20 || Math.abs(z) > 20 || (z > 14 && Math.abs(x) < 14) || !free(x, z, 3.4)) continue;
      var onPath = false; for (i = 0; i < 6; i++) { var hh = HOUSE[i], t = (x * hh.x + z * hh.z) / (hh.x * hh.x + hh.z * hh.z); if (t > 0 && t < 1.1 && Math.hypot(x - hh.x * t, z - hh.z * t) < 2.6) onPath = true; }
      if (onPath) continue;
      tree(m, x, z, .75 + rnd() * .55, rnd() < .5 ? 0 : 1); placed++; OBST.push({ x: x, z: z, r: .9 });
    }
    for (i = 0; i < 8; i++) { var la = i / 8 * PI * 2 + .2; lamp(m, 11.2 * Math.sin(la), -11.2 * Math.cos(la)); }
    var fc = ['#ff7a90', '#ffd24d', '#ffffff', '#b58cff'];
    for (i = 0; i < 60; i++) { var fa = rnd() * PI * 2, fr = 9 + rnd() * 11, fx = fr * Math.sin(fa), fz = -fr * Math.cos(fa); if (free(fx, fz, 1.4) && Math.abs(fx) < 20 && Math.abs(fz) < 20) { m.shade = .1; m.cyl(.03, .03, .4, 4, '#4aa05a', fx, .2, fz, true); m.sph(.17, fc[i % 4], fx, .46, fz, .8, 5); } }
    // причал и лодка рядом
    m.shade = .1; m.box(3.2, .3, 7, '#b88a5a', 23.8, -.35, 6); for (i = 0; i < 4; i++) m.box(.25, 1.4, .25, '#7a5a3a', 22.4 + (i % 2) * 2.8, -.7, 3.4 + Math.floor(i / 2) * 5.4);
    // фонтан
    m.shade = .1; m.cyl(1.9, 2.1, .7, 16, '#d9dfe9', 0, .35, 0, true); m.cyl(1.6, 1.6, .1, 16, '#6fd0ee', 0, .66, 0, true); m.cyl(.22, .3, 1.4, 8, '#d9dfe9', 0, 1.2, 0, true); m.cyl(.7, .4, .2, 12, '#d9dfe9', 0, 1.9, 0, true);
    return R.build(m);
  }
  function shopMesh(stage) {
    var m = new MB(); m.shade = .14, i;
    var i;
    if (stage === 1) {
      m.box(5.2, .3, 4.4, '#cfc7ba', 0, .15, 0); m.box(4.6, 2.6, 3.4, '#ffe2b8', 0, 1.6, -.2); m.box(5.2, .3, 1.6, '#fff', 0, 2.95, 1.5);
      for (i = 0; i < 5; i++) m.box(1.04, .3, 1.7, i % 2 ? '#fff' : '#e4443f', -2.08 + i * 1.04, 3.0, 1.55);
      m.box(4.2, .8, 1, '#8a5a3a', 0, .8, 1.5); m.box(4.4, .12, 1.2, '#b88a5a', 0, 1.25, 1.5);
      m.box(2.6, 1.3, .1, '#fffaf0', 0, 3.6, 1.4);
    } else if (stage === 2) {
      m.box(6.6, .3, 5, '#cfc7ba', 0, .15, 0); m.box(6, 3.4, 4, '#d9ecff', 0, 2, -.3); m.roof(6.6, 1.2, 4.4, '#2f6fd0', 0, 3.7, -.3, 0, '#2457a8');
      m.box(6.6, .3, 1.8, '#fff', 0, 3.1, 1.6); for (i = 0; i < 6; i++) m.box(1.1, .3, 1.9, i % 2 ? '#fff' : '#1a86c0', -2.75 + i * 1.1, 3.15, 1.65);
      m.box(5.2, .9, 1.1, '#8a5a3a', 0, .9, 1.7); m.box(5.4, .12, 1.3, '#b88a5a', 0, 1.4, 1.7);
      m.box(1.6, 2.1, .12, '#35507a', 0, 1.3, 1.76 + .2); m.box(3, 1.2, .12, '#fffaf0', 0, 4.9, 1.9);
      for (i = 0; i < 9; i++) m.cone(.18, .34, 4, ['#ff5a6e', '#ffd24d', '#8a6cff', '#42c9e3'][i % 4], -3 + i * .75, 3.55 - Math.abs(Math.sin(i * .35)) * .2, 2.55);
    } else {
      m.box(7.6, .3, 5.6, '#cfc7ba', 0, .15, 0); m.box(7, 3.4, 4.6, '#eef4ff', 0, 2, -.3); m.box(7.2, 3, 4.8, '#b8e8f7', 0, 5.4, -.3); m.box(7.6, .5, 5.2, '#1a2f55', 0, 7.2, -.3);
      m.box(6.2, 2.4, .12, '#8fd6ee', 0, 1.5, 2.1); for (i = -2; i <= 2; i++) m.box(.1, 2.4, .16, '#fff', i * 1.4, 1.5, 2.14);
      m.box(6.2, 1.6, .12, '#8fd6ee', 0, 5.2, 2.2); m.box(7.4, .35, 2, '#1a86c0', 0, 3.4, 2.1); m.box(2, 2.2, .1, '#fffaf0', -4, 1.2, 2.4);
      m.sph(.3, '#ffd24d', 3.8, 7.8, 2, 1, 6); m.box(.1, .5, .1, '#ffd24d', 3.8, 7.4, 2);
      for (i = 0; i < 4; i++) { m.box(1, 1.2, .6, '#ff5a6e', -2 + i * 1.3, .75, 3.2); }
    }
    return m;
  }
  function neonMesh() { var m = new MB(); m.shade = 0; m.box(4.4, .4, .12, '#ffffff', 0, 0, 0); m.box(4.6, .12, .1, '#7ae6ff', 0, -.34, 0); return m; }
  function vanMesh() {
    var m = new MB(); m.shade = .12;
    m.box(4.2, 2, 2, '#ffffff', -.7, 1.7, 0); m.box(1.8, 1.5, 2, '#1a86c0', 2.0, 1.45, 0); m.box(.1, .8, 1.6, '#9fd8f0', 2.96, 1.8, 0);
    m.box(4.2, .22, 2.04, '#1a86c0', -.7, 1.2, 0); m.box(6.4, .3, 2.1, '#2b3550', .4, .65, 0);
    [[-1.6, 0], [1.9, 0]].forEach(function (p) { [-1.05, 1.05].forEach(function (z) { var w = new MB(); w.cyl(.55, .55, .35, 10, '#222a3d', 0, 0, 0, true).cyl(.25, .25, .38, 8, '#c9d2e3', 0, 0, 0, true); w.rotZ(); m.add(w, p[0], .55, z); }); });
    m.box(2, .8, .1, '#ff5a6e', -.7, 2.1, 1.03); m.box(2, .8, .1, '#ff5a6e', -.7, 2.1, -1.03);
    return m;
  }
  function boardMesh() {
    var m = new MB(); m.shade = .12; m.box(.2, 2.6, .2, '#7a5a3a', -1.1, 1.3, 0); m.box(.2, 2.6, .2, '#7a5a3a', 1.1, 1.3, 0); m.box(2.8, 1.6, .16, '#9a7048', 0, 2, 0); m.box(2.5, 1.3, .1, '#f6efe0', 0, 2, .1);
    m.box(.7, .5, .06, '#ff8aa0', -.7, 2.3, .17); m.box(.7, .5, .06, '#8fd6ee', .1, 2.35, .17); m.box(.7, .5, .06, '#ffe28a', .8, 2.2, .17); m.box(.7, .5, .06, '#b9a2ff', -.4, 1.65, .17); m.box(3, .2, .5, '#c0392b', 0, 3.0, 0);
    return m;
  }
  function chestMesh() { var m = new MB(); m.shade = .1; m.box(1.8, 1, 1.2, '#b8742f', 0, .5, 0); m.box(1.86, .14, 1.26, '#ffd24d', 0, .8, 0); m.box(.3, .5, .1, '#ffd24d', 0, .6, .63); return m; }
  function lidMesh() { var m = new MB(); m.shade = .1; m.box(1.8, .4, 1.2, '#c9843a', 0, .2, .6); m.box(1.86, .12, 1.26, '#ffd24d', 0, .08, .6); m.box(1.86, .12, 1.26, '#ffd24d', 0, .32, .6); return m; }
  function stationMesh(k) {
    var m = new MB(); m.shade = .12; m.box(3.6, .5, 2.6, '#8a6a46', 0, .25, 0); m.box(3.2, .12, 2.2, '#b08a5c', 0, .56, 0);
    for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) { m.box(.95, .6, .8, ITEM[k].c, -1.1 + c * 1.1, 1 + r * .62, -.3 + (r % 2) * .1); m.box(.2, .62, .82, '#fff6d8', -1.1 + c * 1.1, 1 + r * .62, -.3 + (r % 2) * .1); }
    m.box(.14, 1.6, .14, '#6a4a2a', -1.7, 1.3, .9); m.box(.14, 1.6, .14, '#6a4a2a', 1.7, 1.3, .9);
    return m;
  }
  function cloudMesh() { var m = new MB(); m.shade = .12; [[0, 0, 0, 3.4], [3, .4, .6, 2.6], [-3, .2, -.4, 2.5], [1, 1.2, 0, 2.4]].forEach(function (p) { m.sph(p[3], '#ffffff', p[0], p[1], p[2], .62, 8); }); return m; }
  function boatMesh() { var m = new MB(); m.shade = .12; m.box(3.6, .8, 1.5, '#ff6a5e', 0, 0, 0); m.box(1.6, .9, 1.3, '#fff', -.4, .8, 0); m.box(.12, 2.6, .12, '#7a5a3a', .8, 1.6, 0); m.box(.1, 1.6, 1.1, '#fff6d8', .86, 1.9, 0); return m; }

  /* ---------------------------------------------------------------- игра */
  function open(ctx) {
    if (!G.Renderer.supported()) return { fail: 'Для игры нужен браузер с поддержкой WebGL 2. Обновите браузер или откройте сайт на другом устройстве.' };
    var root = document.createElement('div'); root.className = 'byg'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Байер');
    root.innerHTML =
      '<canvas class="byg-cv" tabindex="0" aria-label="Игровое поле"></canvas>' +
      '<div class="byg-top"><button class="byg-b" type="button" data-a="close" aria-label="Выйти из игры"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="byg-chip byg-stage"><i class="byg-dot"></i><span data-r="stage">Лавка</span></div><span class="byg-sp"></span>' +
      '<div class="byg-chip byg-coin"><i class="byg-c"></i><b data-r="coins">0</b></div>' +
      '<button class="byg-b" type="button" data-a="snd" aria-label="Звук"><svg viewBox="0 0 24 24" data-r="sndi"></svg></button>' +
      '<button class="byg-b" type="button" data-a="help" aria-label="Как играть"><svg viewBox="0 0 24 24"><path d="M9.2 9a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1-1.4 2M12 17.5v.01"/></svg></button></div>' +
      '<div class="byg-shift" hidden><div class="byg-timer"><b data-r="time">90</b><small>сек</small></div><div class="byg-score"><i class="byg-c"></i><b data-r="score">0</b></div><div class="byg-combo" data-r="combo" hidden></div></div>' +
      '<div class="byg-edge"></div>' +
      '<div class="byg-carry" hidden><span data-r="carry"></span></div>' +
      '<div class="byg-dock"><button type="button" class="byg-d" data-a="quests"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg><span>Задания</span><em data-r="bq" hidden></em></button>' +
      '<button type="button" class="byg-d" data-a="shop"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5 5L3.5 17.5l3 3 6.2-6.2a4 4 0 0 0 5-5l-2.6 2.6-2.4-.6-.6-2.4z"/></svg><span>Улучшения</span></button>' +
      '<button type="button" class="byg-d" data-a="chest"><svg viewBox="0 0 24 24"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/></svg><span>Сундук</span><em data-r="bc" hidden></em></button></div>' +
      '<button class="byg-act" type="button" data-a="act" hidden></button>' +
      '<div class="byg-joy" hidden><i></i></div><div class="byg-cd" hidden></div>' +
      '<div class="byg-sheet" hidden></div><div class="byg-fade"></div>';
    document.body.appendChild(root); document.documentElement.classList.add('byg-lock');
    var $ = function (s) { return root.querySelector(s); }, $r = function (n) { return root.querySelector('[data-r="' + n + '"]'); };
    var canvas = $('.byg-cv'), R;
    try { R = new G.Renderer(canvas, { shadowSize: 1024 }); } catch (e) { root.remove(); document.documentElement.classList.remove('byg-lock'); return { fail: 'Не удалось запустить 3D на этом устройстве.' }; }

    var coarse = W.matchMedia && W.matchMedia('(pointer:coarse)').matches;
    var env = R.env; (function () { var l = Math.hypot(env.ld[0], env.ld[1], env.ld[2]); env.ld = env.ld.map(function (v) { return v / l; }); })();
    env.shRadius = 31; env.sun = [.56, .52, .46]; env.sky = [.46, .54, .66]; env.gnd = [.36, .36, .38]; env.fogN = 95; env.fogF = 200;
    /* ---- сцена ---- */
    var scene = new Node(), cam = new Cam(), B = ctx.state, alive = true; cam.far = 260;
    var worldNode = scene.add(new Node(buildWorld(R))); worldNode.cast = false;
    var shopNode = scene.add(new Node()), shopStage = 0, neon = null;
    function setShop(stage) {
      if (stage === shopStage) return; shopStage = stage;
      if (shopNode.mesh) R.freeMesh(shopNode.mesh); shopNode.mesh = R.build(shopMesh(stage));
      shopNode.x = -9; shopNode.z = .4; shopNode.ry = PI / 2;
      if (neon) { scene.remove(neon); neon = null; }
      if (stage === 3) { neon = scene.add(new Node(R.build(neonMesh()))); neon.x = -7.5; neon.y = 6.2; neon.z = .4; neon.ry = PI / 2; neon.cast = false; neon.emit = .9; }
    }
    var van = scene.add(new Node(R.build(vanMesh()))); van.x = 9.4; van.z = .2; van.ry = -PI / 2 + .12;
    var board = scene.add(new Node(R.build(boardMesh()))); board.x = -2.6; board.z = -6.2; board.ry = 0;
    var chestN = scene.add(new Node(R.build(chestMesh()))), lid = chestN.add(new Node(R.build(lidMesh()))); chestN.x = 2.6; chestN.z = -6.3; lid.y = 1; lid.z = -.6; lid.rx = 0;
    var stNodes = STATION.map(function (p, k) { var n = scene.add(new Node(R.build(stationMesh(k)))); n.x = p.x; n.z = p.z + 1.9; n.ry = 0; n.userData = { k: k, b: 0 }; return n; });
    var clouds = [0, 1, 2, 3].map(function (i) { var n = scene.add(new Node(R.build(cloudMesh()))); n.x = -50 + i * 34; n.y = 22 + (i % 2) * 5; n.z = -26 + i * 14; n.s = 1.3 + i * .2; n.cast = false; n.alpha = .96; return n; });
    var boat = scene.add(new Node(R.build(boatMesh()))); boat.x = 30; boat.z = -12; boat.ry = 1.2;
    var ringMesh = (function () { var m = new MB(); m.shade = 0; m.cyl(1, 1, .04, 28, '#7ae6ff', 0, 0, 0, true); return R.build(m); })();
    var rings = IP.map(function (p) { var n = scene.add(new Node(ringMesh)); n.x = p.x; n.z = p.z; n.y = .08; n.s = p.r * .9; n.alpha = .35; n.cast = false; n.emit = .6; return n; });

    /* ---- персонажи ---- */
    var pl = figure(R, { shirt: '#1a86c0', stripe: '#ffffff', pants: '#26324f', cap: '#ff5a6e', pack: '#ffb02e', hair: '#2a1d18' }); scene.add(pl);
    pl.x = 0; pl.z = 5;
    var cust = HOUSE.map(function (h, i) {
      var cols = [['#ff7a90', '#4a3a2a'], ['#6fd0a0', '#d8b04a'], ['#b58cff', '#2a2a3a'], ['#ffd24d', '#7a4a2a'], ['#6fb8ff', '#2a1d18'], ['#ff9f6e', '#5a3a6a']][i];
      var f = figure(R, { shirt: cols[0], hair: cols[1], skin: i % 2 ? '#d9a47a' : '#f3c9a5', pants: '#3a4a6a' }); f.x = h.door.x; f.z = h.door.z; f.ry = h.ry; f.visible = false; f.userData = { pop: 0, mood: 0 }; scene.add(f); return f;
    });
    var parcelMesh = [0, 1, 2].map(function (k) { return parcel(R, k, 1); });
    var carryN = []; for (var i = 0; i < 5; i++) { var cn = new Node(parcelMesh[0]); cn.visible = false; pl.add(cn); carryN.push(cn); }
    var flyN = []; for (i = 0; i < 6; i++) { var fn = new Node(parcelMesh[0]); fn.visible = false; fn.cast = false; scene.add(fn); flyN.push(fn); }

    /* ---- спрайты и частицы ---- */
    var tSoft = R.tex(softCanvas()), tCoin = R.tex(coinCanvas()), tBub = [0, 1, 2].map(function (k) { return R.tex(bubbleCanvas(k)); });
    var white = (function () { var c = cv(4, 4), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); return R.tex(c); })();
    var txtCache = {};
    function txt(str, col, px) {
      var key = str + col + px, t = txtCache[key];
      if (!t) { var c = textCanvas(str, col, px || 54); t = txtCache[key] = { tex: R.tex(c), a: c.width / c.height }; }
      return t;
    }
    var parts = [], floats = [], labels = [];
    function burst(x, y, z, n, col, spd, up, size, life, tex, grav) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * PI * 2, s = spd * (.4 + Math.random() * .8);
        parts.push({ x: x, y: y, z: z, vx: Math.cos(a) * s, vy: up * (.5 + Math.random() * .7), vz: Math.sin(a) * s, life: life * (.7 + Math.random() * .5), t: 0, size: size * (.7 + Math.random() * .6), col: typeof col === 'function' ? col() : col, g: grav == null ? 9 : grav, tex: tex || tSoft });
      }
    }
    function floatText(str, x, y, z, col, px, scale) { var t = txt(str, col, px); floats.push({ t: t, x: x, y: y, z: z, life: 1.3, age: 0, sc: scale || 1 }); }
    var CONF = ['#ff5a6e', '#ffd24d', '#8a6cff', '#42c9e3', '#6fe39a', '#ffffff'];
    function confetti(x, y, z, n) { burst(x, y, z, n, function () { return G.col(CONF[Math.floor(Math.random() * CONF.length)]); }, 7, 12, .5, 1.8, null, 12); }
    function labelInit() {
      labels = [];
      STATION.forEach(function (p, k) { labels.push({ tex: tBub[k], x: p.x, y: 4.3, z: p.z + 1.9, w: 2.4, h: 2.62, a: 1, c: [1, 1, 1], k: k, bob: k }); });
      var t1 = txt('СКЛАД', '#ffffff', 60); labels.push({ tex: t1.tex, x: 0, y: 12.5, z: 17, w: 1.5 * t1.a, h: 1.5, a: 1, c: [1, 1, 1] });
    }
    labelInit();
    var tSign = { shop: txt('Мастерская', '#ffffff', 46), van: txt('Фургон', '#ffffff', 46), board: txt('Задания', '#ffffff', 46), chest: txt('Сундук', '#ffd34d', 46) };
    var signPos = { shop: [-9, 5.6, 2.4], van: [9.4, 4.4, .2], board: [-2.6, 4.4, -6.2], chest: [2.6, 2.7, -6.3] };

    /* ---- состояние игры ---- */
    var S = { mode: 'hub', t: 0, carried: [], cap: 2, spd: 1, cdPick: 0, deliv: [], orders: [], seed: 0, stage: 1, ups: { spd: 0, cap: 0, pack: 0 }, score: 0, combo: 0, lastT: -9, over: false, ip: null, goIp: null, target: null, vx: 0, vz: 0, stepT: 0, speed: 0, camX: 0, camZ: 5, shake: 0, countdown: 0, busy: false };
    function applyB() {
      S.cap = 2 + (B.ups.cap | 0); S.spd = 1 + .08 * (B.ups.spd | 0);
      setShop(B.stage); $r('stage').textContent = B.stageName; $r('coins').textContent = B.coins;
      var q = B.daily.filter(function (d) { return d.ready; }).length, bq = $r('bq'); bq.hidden = !q; bq.textContent = q;
      var bc = $r('bc'); bc.hidden = !B.week.ready; bc.textContent = '!';
      var wr = root.querySelector('.byg-stage'); wr.dataset.s = B.stage;
    }
    function setSndIcon() { $r('sndi').innerHTML = audio.on ? '<path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>' : '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>'; }
    setSndIcon();

    /* ---- ввод ---- */
    var keys = {}, joy = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }, tap = null;
    function kd(e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (k === 'escape') { e.preventDefault(); if (!$('.byg-sheet').hidden && S.mode !== 'result') closeSheet(); else requestClose(); return; }
      var m = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd', 'ц': 'w', 'ы': 's', 'ф': 'a', 'в': 'd' }; k = m[k] || k;
      if ('wasd'.indexOf(k) >= 0 && k.length === 1) { keys[k] = 1; S.target = null; S.goIp = null; e.preventDefault(); }
      if ((k === ' ' || k === 'enter' || k === 'e') && !e.repeat && $('.byg-sheet').hidden) { var b = $('.byg-act'); if (!b.hidden) { e.preventDefault(); b.click(); } }
    }
    function ku(e) { var k = e.key.toLowerCase(), m = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd', 'ц': 'w', 'ы': 's', 'ф': 'a', 'в': 'd' }; delete keys[m[k] || k]; }
    W.addEventListener('keydown', kd); W.addEventListener('keyup', ku);
    var joyEl = $('.byg-joy'), knob = joyEl.querySelector('i'), JR = 52;
    function pdown(e) {
      if (!$('.byg-sheet').hidden || S.countdown > 0) return;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      var rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      tap = { id: e.pointerId, x: x, y: y, t: performance.now(), moved: 0 };
      if (e.pointerType !== 'mouse' && x < rect.width * .55 && !joy.on) { joy.on = true; joy.id = e.pointerId; joy.ox = x; joy.oy = y; joy.x = joy.y = 0; joyEl.hidden = false; joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; knob.style.transform = 'translate(-50%,-50%)'; }
    }
    function pmove(e) {
      var rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (tap && tap.id === e.pointerId) tap.moved = Math.max(tap.moved, Math.hypot(x - tap.x, y - tap.y));
      if (joy.on && joy.id === e.pointerId) {
        var dx = x - joy.ox, dy = y - joy.oy, l = Math.hypot(dx, dy); if (l > JR) { dx = dx / l * JR; dy = dy / l * JR; l = JR; }
        joy.x = dx / JR; joy.y = dy / JR; knob.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px))';
        if (l > 8) { S.target = null; S.goIp = null; }
      }
    }
    function pup(e) {
      var rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (joy.on && joy.id === e.pointerId) { joy.on = false; joy.x = joy.y = 0; joyEl.hidden = true; }
      if (tap && tap.id === e.pointerId) {
        var dt = performance.now() - tap.t;
        if (tap.moved < 10 && dt < 380) groundTap(x / rect.width, y / rect.height);
        tap = null;
      }
    }
    canvas.addEventListener('pointerdown', pdown); canvas.addEventListener('pointermove', pmove); canvas.addEventListener('pointerup', pup); canvas.addEventListener('pointercancel', pup);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var marker = [];
    function groundTap(u, v) {
      var g = cam.ground(u, v, 0); if (!g) return;
      var best = null, bd = 99;
      if (S.mode === 'hub') IP.forEach(function (p) { var d = Math.hypot(g[0] - p.x, g[2] - p.z); if (d < 3.4 && d < bd) { bd = d; best = p; } });
      if (best) { S.target = { x: best.x, z: best.z }; S.goIp = best.id; } else { S.target = { x: Math.max(-BOUND, Math.min(BOUND, g[0])), z: Math.max(-BOUND, Math.min(BOUND, g[2])) }; S.goIp = null; }
      burst(S.target.x, .2, S.target.z, 6, [.5, .9, 1], 1.4, 1.5, .5, .5, null, 0);
    }

    /* ---- интерфейс ---- */
    var sheetEl = $('.byg-sheet');
    function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'on' : '') + '" style="--i:' + i + '"><svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"/></svg></i>'; return s; }
    function sheet(title, body, wide) {
      sheetEl.hidden = false; sheetEl.className = 'byg-sheet' + (wide ? ' wide' : '');
      sheetEl.innerHTML = '<div class="byg-card" role="document"><div class="byg-ch"><h2>' + title + '</h2>' + (S.mode === 'result' ? '' : '<button class="byg-b sm" type="button" data-a="sheetx" aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>') + '</div><div class="byg-cb">' + body + '</div></div>';
      requestAnimationFrame(function () { sheetEl.classList.add('in'); });
      var cb = sheetEl.querySelector('.byg-card button, .byg-card [tabindex]'); if (cb) try { cb.focus({ preventScroll: true }); } catch (e) { }
    }
    function closeSheet() { sheetEl.classList.remove('in'); sheetEl.hidden = true; sheetEl.innerHTML = ''; canvas.focus && canvas.focus({ preventScroll: true }); }
    function dots(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return '<span class="byg-dots">' + s + '</span>'; }
    function bar(v, m) { return '<div class="byg-bar"><i style="width:' + Math.max(0, Math.min(100, v / m * 100)) + '%"></i></div>'; }
    function chargeText() { return B.charges >= B.chargeMax ? 'Смен: ' + B.charges + ' из ' + B.chargeMax : 'Смен: ' + B.charges + ' из ' + B.chargeMax + ', следующая через ' + Math.ceil(B.nextMs / 60000) + ' мин'; }

    function panelStart() {
      var tut = !B.done && !lsGet('tut');
      sheet('Смена в квартале', '<p class="byg-lead">90 секунд. Берите посылки на складе и несите тем, кто их ждёт. Чем быстрее и подряд, тем больше монет.</p>' +
        '<ul class="byg-how"><li><b>1</b><span>Подойдите к ящикам на складе: посылки берутся сами</span></li><li><b>2</b><span>Над домом пузырь с вещью: отнесите её клиенту</span></li><li><b>3</b><span>Успейте, пока полоска не закончилась</span></li></ul>' +
        '<div class="byg-meta">' + chargeText() + '</div>' +
        '<div class="byg-row"><button class="btn-g" type="button" data-a="sheetx">Позже</button><button class="btn-p" type="button" data-a="go"' + (B.charges < 1 ? ' disabled' : '') + '>Начать смену</button></div>');
      if (tut) lsSet('tut', '1');
    }
    function panelShop() {
      var u = B.cat.ups, h = '<p class="byg-lead">Монеты из смен тратятся на улучшения. Они только для игры.</p><div class="byg-ups">';
      Object.keys(u).forEach(function (k) {
        var d = u[k], lv = B.ups[k] | 0, max = lv >= d.max, cost = d.cost[lv];
        h += '<div class="byg-up"><div class="byg-ut"><b>' + d.name + '</b><small>' + d.info + '</small>' + dots(lv, d.max) + '</div><button type="button" class="btn-p sm" data-a="up" data-k="' + k + '"' + (max || B.coins < cost ? ' disabled' : '') + '>' + (max ? 'Максимум' : '<i class="byg-c"></i>' + fmt(cost)) + '</button></div>';
      });
      h += '</div>';
      if (B.next) h += '<div class="byg-stg"><div><b>' + B.next.name + '</b><small>Открывается за ' + fmt(B.next.need) + ' заработанных монет</small></div>' + bar(B.next.have, B.next.need) + '<small>' + fmt(Math.min(B.next.have, B.next.need)) + ' из ' + fmt(B.next.need) + '</small></div>' + (B.stage === 2 ? '<small class="byg-note">Шоурум дарит рамку профиля «Витрина»</small>' : '');
      else h += '<div class="byg-stg"><b>Шоурум открыт</b><small>Рамка «Витрина» у вас в профиле</small></div>';
      sheet('Мастерская', h);
    }
    function panelQuests() {
      var h = '<div class="byg-qs">';
      B.daily.forEach(function (q, i) {
        h += '<div class="byg-q' + (q.got ? ' got' : '') + '"><div class="byg-qt"><b>' + q.name + '</b>' + bar(q.have, q.need) + '<small>' + fmt(q.have) + ' из ' + fmt(q.need) + '</small></div><button type="button" class="btn-p sm" data-a="quest" data-i="' + i + '"' + (q.ready ? '' : ' disabled') + '>' + (q.got ? 'Получено' : q.ready ? '<i class="byg-c"></i>' + q.coins : '<i class="byg-c"></i>' + q.coins) + '</button></div>';
      });
      h += '</div><div class="byg-bonus' + (B.dailyBonus.got ? ' got' : '') + '"><b>За все три</b><span>+' + B.dailyBonus.tok + ' ониксов и 15 XP</span></div><small class="byg-note">Задания обновляются каждый день. Лимит наград игры в месяц: ' + B.month.tok + ' из ' + B.month.tokMax + ' ониксов</small>';
      sheet('Задания дня', h);
    }
    function panelChest() {
      var w = B.week;
      sheet('Сундук недели', '<div class="byg-chestv ' + (w.ready ? 'rd' : '') + '"><svg viewBox="0 0 64 64"><rect x="8" y="26" width="48" height="28" rx="4"/><path d="M8 26c0-12 8-18 24-18s24 6 24 18z"/><rect x="28" y="30" width="8" height="10" rx="2"/></svg></div>' +
        '<p class="byg-lead">Сыграйте ' + w.need + ' смен за неделю, и в сундуке будут ониксы. Чем выше оценка смен, тем больше награда: от 20 до 60.</p>' + bar(w.shifts, w.need) +
        '<div class="byg-meta">' + Math.min(w.shifts, w.need) + ' из ' + w.need + ' смен' + (w.avg ? ', средняя оценка ' + w.avg : '') + '</div>' +
        '<div class="byg-row"><button class="btn-p" type="button" data-a="chestgo"' + (w.ready ? '' : ' disabled') + '>' + (w.claimed ? 'Уже открыт' : w.ready ? 'Открыть, ' + w.chest + ' ониксов' : 'Пока закрыт') + '</button></div>');
    }
    function panelHelp() {
      sheet('Как играть', '<ul class="byg-how"><li><b>' + (coarse ? '⬤' : 'W') + '</b><span>' + (coarse ? 'Ведите пальцем по левой части экрана, появится джойстик. Можно коснуться земли, и курьер сам придёт' : 'Стрелки или WASD, либо клик мышью по земле') + '</span></li>' +
        '<li><b>1</b><span>В фургоне начните смену на 90 секунд</span></li><li><b>2</b><span>Берите посылки у ящиков на складе. Цвет ящика совпадает с вещью в пузыре</span></li><li><b>3</b><span>Несите клиентам у домов. Быстрая доставка и серия дают больше монет</span></li><li><b>4</b><span>Тратьте монеты в мастерской, выполняйте задания дня и открывайте сундук недели</span></li></ul><small class="byg-note">Игровые монеты в ониксы не обмениваются. Ониксы дают за сундук недели и задания дня, но не больше ' + B.month.tokMax + ' в месяц.</small>');
    }
    function lsGet(k) { try { return localStorage.getItem('onion.byer.' + k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem('onion.byer.' + k, v); } catch (e) { } }

    function call(action, payload) {
      if (S.busy) return Promise.resolve({ ok: false, error: 'busy' });
      S.busy = true;
      return ctx.call(action, payload || {}).then(function (r) { S.busy = false; if (r && r.byr) { B = r.byr; ctx.state = B; applyB(); } if (r && r.user) ctx.onUser(r.user); return r; }, function (e) { S.busy = false; return { ok: false, error: 'Нет связи с сервером' }; });
    }
    function warn(t) { ctx.toast(t, 'warn'); }

    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
      var a = el.dataset.a; SFX.ui();
      if (a === 'close') return requestClose();
      if (a === 'sheetx') { if (S.mode !== 'result') closeSheet(); return; }
      if (a === 'snd') { audio.on = !audio.on; try { localStorage.setItem('onion.byer.snd', audio.on ? '1' : '0'); } catch (x) { } setSndIcon(); return; }
      if (a === 'help') return panelHelp();
      if (a === 'quests') return S.mode === 'shift' ? 0 : panelQuests();
      if (a === 'shop') return S.mode === 'shift' ? 0 : panelShop();
      if (a === 'chest') return S.mode === 'shift' ? 0 : panelChest();
      if (a === 'act') return doIp();
      if (a === 'go') return startShift();
      if (a === 'again') { closeSheet(); S.mode = 'hub'; return startShift(); }
      if (a === 'hub') { closeSheet(); S.mode = 'hub'; toHub(); return; }
      if (a === 'quit') { closeSheet(); return doClose(true); }
      if (a === 'stay') { closeSheet(); return; }
      if (a === 'up') call('byrUp', { k: el.dataset.k }).then(function (r) { if (!r.ok) return warn(r.error); SFX.coin(); burst(-9, 3, 2.5, 18, [1, .85, .3], 4, 6, .5, .9); ctx.toast('Улучшено', 'ok'); panelShop(); });
      if (a === 'quest') call('byrQuest', { i: el.dataset.i }).then(function (r) { if (!r.ok) return warn(r.error); SFX.coin(); burst(-2.6, 3.2, -5, 18, [1, .85, .3], 4, 6, .5, .9); var g = r.got; ctx.toast('Монеты +' + g.coins + (g.bonus ? ', бонус дня: +' + g.tok + ' ониксов, +' + g.xp + ' XP' : ''), 'ok'); if (g.bonus) { SFX.win(); confetti(-2.6, 3, -5, 40); } panelQuests(); });
      if (a === 'chestgo') call('byrChest').then(function (r) { if (!r.ok) return warn(r.error); SFX.win(); confetti(2.6, 2, -5, 60); lid.rx = -1.2; setTimeout(function () { lid.rx = 0; }, 2200); ctx.toast('Сундук недели: +' + r.got + ' ониксов' + (r.capped ? ' (месячный лимит игры)' : ''), 'ok'); panelChest(); });
    });

    /* ---- смена ---- */
    function toHub() {
      S.mode = 'hub'; S.carried = []; S.orders = []; cust.forEach(function (c) { c.visible = false; }); showShiftHud(false);
      S.target = null; S.goIp = null; flyN.forEach(function (n) { n.visible = false; });
      $r('combo').hidden = true;
    }
    function showShiftHud(on) { $('.byg-shift').hidden = !on; $('.byg-carry').hidden = !on; $('.byg-dock').hidden = on; root.classList.toggle('inshift', on); }
    function startShift() {
      if (S.busy) return;
      call('byrStart').then(function (r) {
        if (!r.ok) { warn(r.error || 'Не получилось'); return; }
        closeSheet(); S.mode = 'shift'; S.seed = r.seed; S.stage = r.stage; S.ups = { spd: B.ups.spd, cap: B.ups.cap, pack: B.ups.pack };
        S.orders = Core.byrSchedule(S.seed, S.stage).map(function (o) { o.st = 0; o.age = 0; return o; });
        S.t = 0; S.carried = []; S.deliv = []; S.score = 0; S.combo = 0; S.lastT = -9; S.over = false; S.target = null; S.goIp = null;
        pl.x = 0; pl.z = 6; S.camX = 0; S.camZ = 6; S.countdown = 3.2; showShiftHud(true); setScore(0); $r('time').textContent = '90';
        $r('carry').innerHTML = ''; updateCarry();
      });
    }
    function setScore(v) { $r('score').textContent = fmt(v); }
    function updateCarry() {
      var h = ''; for (var i = 0; i < S.cap; i++) { var k = S.carried[i]; h += '<i class="' + (k == null ? '' : 'on') + '"' + (k == null ? '' : ' style="--c:' + ITEM[k].c + '"') + '></i>'; }
      $r('carry').innerHTML = h;
      carryN.forEach(function (n, i) { var k = S.carried[i]; n.visible = k != null && i < S.cap; if (k != null) { n.mesh = parcelMesh[k]; n.y = 3.0 + i * .5; n.z = 0; n.x = 0; n.userData = { i: i }; n.cast = true; } });
    }
    function finishShift() {
      if (S.over) return; S.over = true; S.carried = []; updateCarry(); showShiftHud(false);
      S.mode = 'result'; S.target = null; SFX.go();
      call('byrFinish', { deliv: S.deliv }).then(function (r) {
        if (!r.ok) { S.mode = 'hub'; toHub(); warn(r.error || 'Не удалось сохранить смену'); return; }
        var s = r.summary; showResult(s);
      });
    }
    function showResult(s) {
      var win = s.stars >= 3; if (win) { SFX.win(); confetti(pl.x, 3, pl.z, 70); } else SFX.bad();
      var h = '<div class="byg-stars">' + stars(s.stars) + '</div>' +
        '<div class="byg-res"><div><small>Доставлено</small><b>' + s.n + ' из ' + s.total + '</b></div><div><small>Монеты</small><b><i class="byg-c"></i>+' + fmt(s.rev) + '</b></div><div><small>Лучшая серия</small><b>×' + s.best + '</b></div><div><small>Опыт</small><b>+' + s.xp + ' XP</b></div></div>' +
        (s.xpCap ? '<small class="byg-note">Месячный лимит опыта игры почти исчерпан</small>' : '') +
        (s.stageUp ? '<div class="byg-bonus"><b>Новый этап: ' + s.stageUp.name + '</b><span>' + (s.stageUp.frame ? 'Рамка «' + s.stageUp.frame + '» открыта' : 'Мастерская выросла') + '</span></div>' : '') +
        '<div class="byg-row"><button class="btn-g" type="button" data-a="hub">В квартал</button><button class="btn-p" type="button" data-a="again"' + (B.charges < 1 ? ' disabled' : '') + '>Ещё смена</button></div>' +
        (B.charges < 1 ? '<div class="byg-meta">' + chargeText() + '</div>' : '');
      sheet(s.n ? 'Смена завершена' : 'Смена без доставок', h);
      if (s.stageUp) { setShop(B.stage); }
    }
    function ctxLabel() {
      var b = $('.byg-act');
      if (S.mode !== 'hub' || !$('.byg-sheet').hidden) { b.hidden = true; S.ip = null; return; }
      var best = null, bd = 99; IP.forEach(function (p) { var d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < p.r && d < bd) { bd = d; best = p; } });
      if (best !== S.ip) { S.ip = best; if (best) { b.hidden = false; b.textContent = best.t; b.dataset.ip = best.id; } else b.hidden = true; }
      if (best && S.goIp === best.id) { S.goIp = null; S.target = null; doIp(); }
    }
    function doIp() { if (!S.ip) return; var id = S.ip.id; if (id === 'van') panelStart(); else if (id === 'shop') panelShop(); else if (id === 'board') panelQuests(); else panelChest(); }
    function requestClose() {
      if (S.mode === 'shift' || S.mode === 'result' && !S.over) { sheet('Выйти из игры?', '<p class="byg-lead">Идущая смена будет потеряна без награды.</p><div class="byg-row"><button class="btn-g" type="button" data-a="stay">Остаться</button><button class="btn-p" type="button" data-a="quit">Выйти</button></div>'); return; }
      doClose(false);
    }
    function doClose(abort) {
      if (!alive) return; alive = false; cancelAnimationFrame(raf);
      var done = function () { cleanup(); ctx.onClose(); };
      if (abort || S.mode === 'shift') ctx.call('byrAbort', {}).then(function (r) { if (r && r.user) ctx.onUser(r.user); done(); }, done); else done();
      root.classList.add('out');
    }
    function cleanup() {
      W.removeEventListener('keydown', kd); W.removeEventListener('keyup', ku); W.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
      try { R.dispose(); } catch (e) { } root.remove(); document.documentElement.classList.remove('byg-lock');
    }

    /* ---- кадр ---- */
    function bounce(n, a) { n.userData = n.userData || {}; n.userData.b = a; }
    var edgeEl = $('.byg-edge'), edgeChips = HOUSE.map(function (h, i) { var d = document.createElement('i'); d.hidden = true; d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4l7 14-7-4-7 4z"/></svg>'; edgeEl.appendChild(d); return d; });
    var fps = { ema: 16, bad: 0, level: 0 }, dpr = Math.min(W.devicePixelRatio || 1, coarse ? 1.75 : 2), raf = 0, last = performance.now(), clock = 0, hidden = false;
    function onResize() { size(); }
    function size() {
      var vv = W.visualViewport, w = Math.round((vv && vv.width) || W.innerWidth), h = Math.round((vv && vv.height) || W.innerHeight);
      root.style.height = h + 'px'; R.resize(w, h, dpr);
    }
    function onVis() { hidden = document.hidden; last = performance.now(); }
    W.addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis); size();

    function camUpdate(dt) {
      var asp = R.w / R.h, shiftMode = S.mode !== 'hub';
      var d = shiftMode ? 46 : 42; if (asp < 1) d *= 1 + (1 - asp) * .6; else if (asp < 1.5) d *= 1 + (1.5 - asp) * .25;
      var pitch = shiftMode ? .98 : .94, k = 1 - Math.pow(.0009, dt);
      var tx = pl.x * (shiftMode ? .62 : .8), tz = pl.z * (shiftMode ? .6 : .8) + (shiftMode ? 1.5 : 2.2);
      S.camX += (tx - S.camX) * k; S.camZ += (tz - S.camZ) * k;
      var sh = S.shake; S.shake = Math.max(0, S.shake - dt * 2.4);
      cam.target = [S.camX + (Math.random() - .5) * sh, 0, S.camZ + (Math.random() - .5) * sh];
      cam.pos = [S.camX, Math.sin(pitch) * d, S.camZ + Math.cos(pitch) * d];
      cam.fov = .62;
    }
    function move(dt) {
      var ix = 0, iz = 0;
      if (keys.a) ix -= 1; if (keys.d) ix += 1; if (keys.w) iz += 1; if (keys.s) iz -= 1;
      if (joy.on) { ix += joy.x; iz -= joy.y; }
      var fx = cam.target[0] - cam.pos[0], fz = cam.target[2] - cam.pos[2], fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      var rx = -fz, rz = fx, dx = rx * ix + fx * iz, dz = rz * ix + fz * iz, dl = Math.hypot(dx, dz), run = Math.min(1, dl);
      if (dl > 0.05) { dx /= dl; dz /= dl; }
      else if (S.target) {
        var tx = S.target.x - pl.x, tz = S.target.z - pl.z, tl = Math.hypot(tx, tz);
        if (tl < .35) { S.target = null; dx = dz = 0; run = 0; } else { dx = tx / tl; dz = tz / tl; run = Math.min(1, tl / 1.2); }
      } else { dx = dz = 0; run = 0; }
      if (S.countdown > 0) { dx = dz = 0; run = 0; }
      var sp = 6.4 * S.spd * run;
      S.vx += (dx * sp - S.vx) * Math.min(1, dt * 12); S.vz += (dz * sp - S.vz) * Math.min(1, dt * 12);
      pl.x += S.vx * dt; pl.z += S.vz * dt;
      for (var i = 0; i < OBST.length; i++) { var o = OBST[i]; if (!o.r) continue; var ox = pl.x - o.x, oz = pl.z - o.z, od = Math.hypot(ox, oz), mr = o.r + .55; if (od < mr && od > 1e-4) { pl.x = o.x + ox / od * mr; pl.z = o.z + oz / od * mr; } }
      var pr = Math.hypot(pl.x, pl.z); if (Math.abs(pl.x) > BOUND) pl.x = Math.sign(pl.x) * BOUND; if (pl.z > 17) pl.z = 17; if (pl.z < -BOUND) pl.z = -BOUND;
      S.speed = Math.hypot(S.vx, S.vz);
      if (S.speed > .4) { var ty = Math.atan2(S.vx, S.vz), dy = ((ty - pl.ry + PI * 3) % (PI * 2)) - PI; pl.ry += dy * Math.min(1, dt * 14); }
    }
    function animFigure(f, sp, t, dt, wave) {
      var P = f.P, ph = t * (9 + sp * .5), a = Math.min(1, sp / 4) * .9;
      P.legL.rx = Math.sin(ph) * a; P.legR.rx = -Math.sin(ph) * a;
      P.armL.rx = -Math.sin(ph) * a * .9; P.armR.rx = Math.sin(ph) * a * .9;
      P.body.y = 1.32 + Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3); P.head.y = 2.2 + Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
      if (wave) { P.armR.rx = PI - .5 + Math.sin(t * 9) * .35; P.armR.rz = -.3; } else P.armR.rz = 0;
    }
    function tickShift(dt) {
      if (S.countdown > 0) {
        var c0 = Math.ceil(S.countdown); S.countdown -= dt; var c1 = Math.ceil(S.countdown), cd = $('.byg-cd');
        if (S.countdown > 0.2) { cd.hidden = false; cd.textContent = c1 > 0 ? c1 : 'Старт!'; if (c1 !== c0) SFX.tick(); }
        if (S.countdown <= 0.2 && !cd.dataset.go) { cd.dataset.go = 1; cd.textContent = 'Старт!'; SFX.go(); }
        if (S.countdown <= 0) { cd.hidden = true; delete cd.dataset.go; S.countdown = 0; }
        return;
      }
      if (S.over) return;
      S.t += dt; var left = Math.max(0, 90 - S.t); $r('time').textContent = Math.ceil(left); root.classList.toggle('low', left <= 10);
      S.orders.forEach(function (o) {
        var c = cust[o.house];
        if (o.st === 0 && S.t >= o.t) { o.st = 1; c.visible = true; c.userData.pop = 0; c.userData.o = o; burst(HOUSE[o.house].door.x, 2.5, HOUSE[o.house].door.z, 8, [1, 1, 1], 2, 3, .45, .6, null, 0); tone(700, .1, 'sine', .04); }
        if (o.st === 1) { o.age = S.t - o.t; if (o.age > o.pat) { o.st = 3; c.userData.mood = -1; c.userData.mt = 0; SFX.bad(); S.combo = 0; setCombo(); floatText('Не дождался', HOUSE[o.house].door.x, 4.4, HOUSE[o.house].door.z, '#ff8a80', 40); setTimeout(function () { if (o.st === 3) c.visible = false; }, 900); } }
      });
      // склад
      S.cdPick -= dt;
      for (var i = 0; i < 3; i++) {
        var st = STATION[i], d = Math.hypot(pl.x - st.x, pl.z - (st.z + 1.4));
        if (d < 3.1 && S.carried.length < S.cap && S.cdPick <= 0) {
          S.carried.push(i); S.cdPick = .3; updateCarry(); SFX.pick(); stNodes[i].userData.b = 1; burst(st.x, 1.8, st.z + 1.6, 7, G.col(ITEM[i].c), 2.2, 3, .35, .5, null, 4);
        }
      }
      // доставка
      if (S.carried.length) for (var j = 0; j < S.orders.length; j++) {
        var o = S.orders[j]; if (o.st !== 1) continue;
        var dd = Math.hypot(pl.x - HOUSE[o.house].door.x, pl.z - HOUSE[o.house].door.z), ci = S.carried.indexOf(o.item);
        if (dd < 2.6 && ci >= 0 && S.t >= o.t + 1.15 && S.t >= S.lastT + 1.45) { deliver(o, ci); break; }
      }
      if (S.t >= 90) finishShift();
    }
    var flyI = 0;
    function deliver(o, ci) {
      S.carried.splice(ci, 1); updateCarry();
      var h = HOUSE[o.house]; S.deliv.push([o.id, Math.round(S.t * 100) / 100]);
      var sc = Core.byrScore(S.seed, S.stage, S.ups, S.deliv), row = sc.rows[sc.rows.length - 1];
      if (!row || row.id !== o.id) { S.deliv.pop(); return; }
      o.st = 2; S.lastT = S.t; S.score = sc.rev; S.combo = row.combo; setScore(S.score); setCombo();
      var c = cust[o.house]; c.userData.mood = 1; c.userData.mt = 0;
      var f = flyN[flyI++ % flyN.length]; f.mesh = parcelMesh[o.item]; f.visible = true; f.userData = { t: 0, sx: pl.x, sy: 3.2, sz: pl.z, ex: h.door.x, ey: 2.2, ez: h.door.z };
      SFX.coin(); burst(h.door.x, 3, h.door.z, 14, [1, .85, .3], 3.6, 6, .5, .9, tCoin, 9); if (row.fast) burst(h.door.x, 3, h.door.z, 10, [.6, .95, 1], 3, 5, .4, .8);
      floatText('+' + row.pay, h.door.x, 4.2, h.door.z, '#ffd34d', 64, .85);
      if (row.fast) floatText('Быстро!', h.door.x, 5.6, h.door.z, '#7ae6ff', 40, .7);
      if (row.combo >= 3) floatText('Серия ×' + row.combo, pl.x, 5.4, pl.z, '#ff9ab0', 46, .7);
    }
    function setCombo() { var e = $r('combo'); if (S.combo >= 2) { e.hidden = false; e.textContent = 'Серия ×' + S.combo; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } else e.hidden = true; }

    var sprites = R.sprites;
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      if (hidden || R.lost) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
      var ms = dt * 1000; fps.ema += (ms - fps.ema) * .05;
      if (fps.ema > 27 && ++fps.bad > 90 && fps.level < 3) { fps.bad = 0; fps.level++; if (fps.level === 1 || fps.level === 2) { dpr = Math.max(1, dpr - .5); size(); } else { R.shadows = false; } fps.ema = 16; } else if (fps.ema <= 27) fps.bad = Math.max(0, fps.bad - 2);
      move(dt); if (S.mode === 'shift') tickShift(dt); ctxLabel();
      animFigure(pl, S.speed, clock, dt, false);
      // движущиеся мелочи
      var bobY = Math.sin(clock * 2) * .08;
      carryN.forEach(function (n, i) { if (n.visible) { n.y = 3.0 + i * .5 + Math.sin(clock * 6 + i) * .03 * Math.min(1, S.speed / 3); n.rz = Math.sin(clock * 7 + i) * .05 * Math.min(1, S.speed / 3); } });
      cust.forEach(function (c, i) {
        if (!c.visible) return; var u = c.userData; u.pop = Math.min(1, u.pop + dt * 4); var o = u.o;
        c.s = .8 * (1 - Math.pow(1 - u.pop, 3) * .0 + Math.sin(u.pop * PI) * .12) * (.3 + .7 * u.pop);
        var waving = o && o.st === 1; c.y = 0;
        if (u.mood === 1) { u.mt += dt; c.y = Math.abs(Math.sin(u.mt * 10)) * .7 * Math.max(0, 1 - u.mt / 1); if (u.mt > 1.1) { c.visible = false; u.mood = 0; } c.P.armR.rx = PI - .3; c.P.armL.rx = PI - .3; }
        else if (u.mood === -1) { u.mt += dt; c.rz = Math.sin(u.mt * 30) * .08 * Math.max(0, 1 - u.mt / .6); c.P.armR.rx = 0; }
        else animFigure(c, 0, clock + i, dt, waving);
        if (u.mood === 0 && waving) { c.P.armR.rx = PI - .5 + Math.sin(clock * 9 + i) * .35; c.P.armL.rx = Math.sin(clock * 2 + i) * .1; }
      });
      stNodes.forEach(function (n) { var b = n.userData.b; if (b > 0) { n.userData.b = Math.max(0, b - dt * 4); n.s = 1 + Math.sin(n.userData.b * PI) * .08; } else n.s = 1; });
      flyN.forEach(function (f) { if (!f.visible) return; var u = f.userData; u.t += dt * 2.6; if (u.t >= 1) { f.visible = false; return; } var t = u.t; f.x = u.sx + (u.ex - u.sx) * t; f.z = u.sz + (u.ez - u.sz) * t; f.y = u.sy + (u.ey - u.sy) * t + Math.sin(t * PI) * 2.4; f.ry = t * 8; f.s = 1 - t * .35; });
      clouds.forEach(function (c, i) { c.x += dt * (.6 + i * .15); if (c.x > 60) c.x = -60; });
      boat.y = -1.1 + Math.sin(clock * 1.3) * .12; boat.rz = Math.sin(clock * 1.1) * .05; boat.x = 30 + Math.sin(clock * .08) * 2;
      rings.forEach(function (r, i) { var p = IP[i], near = S.ip === p; r.visible = S.mode === 'hub'; r.s = p.r * (.86 + Math.sin(clock * 2.4 + i) * .05 + (near ? .1 : 0)); r.alpha = near ? .55 : .3; });
      if (neon) neon.emit = .7 + Math.sin(clock * 3) * .25;
      lid.rx += ((chestOpenTarget() - lid.rx) * Math.min(1, dt * 8));
      if (B.week.ready && S.mode === 'hub' && Math.random() < dt * 7) burst(2.6 + (Math.random() - .5) * 1.4, 1.6, -6.3, 1, [1, .9, .4], .6, 2.2, .35, 1, null, -1);
      if (Math.random() < dt * 22) burst(0 + (Math.random() - .5) * .3, 2.1, 0 + (Math.random() - .5) * .3, 1, [.7, .92, 1], .9, 5.4, .3, .9, null, 9);
      if (S.speed > 3.5 && Math.random() < dt * 14) burst(pl.x - S.vx * .05, .2, pl.z - S.vz * .05, 1, [.93, .88, .75], .5, 1, .5, .45, null, -1);
      // частицы
      sprites.length = 0;
      labels.forEach(function (l) { var b = l.bob != null ? Math.sin(clock * 2 + l.bob) * .15 : 0; l.y0 = l.y0 || l.y; l.y = l.y0 + b; sprites.push(l); });
      if (S.mode === 'hub') for (var key in tSign) { var sp = signPos[key], t = tSign[key]; sprites.push({ tex: t.tex, x: sp[0], y: sp[1], z: sp[2], w: 1.45 * t.a, h: 1.45, u: [0, 0, 1, 1], c: [1, 1, 1], a: 1 }); }
      sprites.forEach(function (s) { if (!s.u) s.u = [0, 0, 1, 1]; });
      // пузыри заказов и полоски терпения
      S.orders.forEach(function (o) {
        if (o.st !== 1) return; var h = HOUSE[o.house], fr = 1 - o.age / o.pat, urgent = fr < .3, bob = Math.sin(clock * 5 + o.id) * .12, sc = 1 + (urgent ? Math.sin(clock * 14) * .06 : 0);
        sprites.push({ tex: tBub[o.item], x: h.door.x, y: 4.9 + bob, z: h.door.z, w: 2.7 * sc, h: 2.95 * sc, u: [0, 0, 1, 1], c: [1, 1, 1], a: 1 });
        var wd = 1.7, col = fr > .5 ? [.4, .9, .5] : fr > .28 ? [1, .78, .25] : [1, .35, .35];
        sprites.push({ tex: white, x: h.door.x, y: 3.7, z: h.door.z, w: wd + .14, h: .3, u: [0, 0, 1, 1], c: [.05, .1, .2], a: .85 });
        var r = cam.right, bw = wd * Math.max(0.02, fr), off = (wd - bw) / 2;
        sprites.push({ tex: white, x: h.door.x - r[0] * off, y: 3.7, z: h.door.z - r[2] * off, w: bw, h: .2, u: [0, 0, 1, 1], c: col, a: 1 });
      });
      for (var pi = parts.length - 1; pi >= 0; pi--) {
        var p = parts[pi]; p.t += dt; if (p.t >= p.life) { parts.splice(pi, 1); continue; }
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < .1 && p.g > 0) { p.y = .1; p.vy *= -.35; p.vx *= .7; p.vz *= .7; }
        var q = p.t / p.life, al = q > .6 ? 1 - (q - .6) / .4 : 1;
        sprites.push({ tex: p.tex, x: p.x, y: p.y, z: p.z, w: p.size, h: p.size, u: [0, 0, 1, 1], c: p.col, a: al });
      }
      for (var fi = floats.length - 1; fi >= 0; fi--) {
        var f = floats[fi]; f.age += dt; if (f.age >= f.life) { floats.splice(fi, 1); continue; }
        var q2 = f.age / f.life, pop = q2 < .15 ? q2 / .15 * 1.2 : 1;
        sprites.push({ tex: f.t.tex, x: f.x, y: f.y + q2 * 1.8, z: f.z, w: 1.8 * f.t.a * f.sc * pop, h: 1.8 * f.sc * pop, u: [0, 0, 1, 1], c: [1, 1, 1], a: q2 > .7 ? 1 - (q2 - .7) / .3 : 1 });
      }
      camUpdate(dt);
      edges();
      R.render(scene, cam, dt);
    }
    function chestOpenTarget() { return -1.2 * (chestFlash > clock ? 1 : 0); }
    var chestFlash = 0;
    function edges() {
      var on = S.mode === 'shift' && S.countdown <= 0;
      HOUSE.forEach(function (h, i) {
        var el = edgeChips[i], o = null; if (on) S.orders.forEach(function (x) { if (x.house === i && x.st === 1) o = x; });
        if (!o) { el.hidden = true; return; }
        var p = cam.toScreen(h.door.x, 3, h.door.z), inside = p && p[0] > .06 && p[0] < .94 && p[1] > .12 && p[1] < .84;
        if (inside) { el.hidden = true; return; }
        var cx = .5, cy = .5, ux = p ? p[0] - cx : h.door.x - cam.target[0], uy = p ? p[1] - cy : 0; if (!p) { uy = -.3; }
        var sx = ux === 0 ? 99 : (ux > 0 ? .93 - cx : .07 - cx) / ux, sy = uy === 0 ? 99 : (uy > 0 ? .8 - cy : .16 - cy) / uy, k2 = Math.min(Math.abs(sx), Math.abs(sy));
        var x2 = cx + ux * k2, y2 = cy + uy * k2;
        el.hidden = false; el.style.left = x2 * 100 + '%'; el.style.top = y2 * 100 + '%'; el.style.setProperty('--c', ITEM[o.item].c); el.style.setProperty('--r', Math.atan2(uy, ux) + PI / 2 + 'rad');
        el.classList.toggle('hot', 1 - o.age / o.pat < .3);
      });
    }

    /* ---- запуск ---- */
    applyB(); setShop(B.stage); toHub();
    root.classList.add('on');
    setTimeout(function () { root.querySelector('.byg-fade').classList.add('off'); }, 60);
    raf = requestAnimationFrame(function (t) { last = t; frame(t); });
    if (!B.done && !lsGet('tut')) setTimeout(function () { if (alive) panelHelp(); lsSet('tut', '1'); }, 900);
    return (W.__byer = {
      close: function () { doClose(false); }, resize: size,
      debug: { sim: function (sec, bot) { for (var i = 0; i < sec * 20; i++) { if (bot) bot(); move(.05); clock += .05; if (S.mode === 'shift') tickShift(.05); ctxLabel(); } }, S: S, pl: pl, cam: cam, HOUSE: HOUSE, STATION: STATION, IP: IP, R: R, press: function (id) { var el = root.querySelector('[data-a="' + id + '"]'); if (el) el.click(); } }
    });
  }

  W.Byer = { open: open };
})(window);
