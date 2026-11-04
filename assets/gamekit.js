/* gamekit.js: общий каркас 2D-игр ONION SHOP («Грузомания», «Последний рубеж»).
   Полноэкранное окно, холст с поддержкой Retina, звук и музыка (WebAudio, без файлов), энергия,
   сохранение на сервер, обучение со стрелками, панели, всплывающие сообщения, джойстик и клавиатура. */
(function (W) {
  'use strict';
  var GK = {};
  var PI = Math.PI;
  GK.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  GK.lerp = function (a, b, t) { return a + (b - a) * t; };
  GK.ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  GK.fmt = function (n) { n = Math.round(n); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (n < 0 ? '−' : '') + s; };
  GK.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  GK.rng = function (seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  GK.dur = function (sec) { sec = Math.max(0, Math.ceil(sec)); if (sec < 60) return sec + ' с'; var m = Math.floor(sec / 60); if (m < 60) return m + ' мин' + (sec % 60 && m < 10 ? ' ' + (sec % 60) + ' с' : ''); var h = Math.floor(m / 60); return h + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : ''); };
  GK.plural = function (n, a, b, c) { n = Math.abs(n) % 100; var n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('onion.gk.' + k); localStorage.setItem('onion.gk.' + k, v); } catch (e) { return null; } }
  GK.ls = ls;

  /* ------------------------------------------------------------ звук */
  var A = { ctx: null, sfx: ls('sfx') !== '0', mus: ls('mus') !== '0', master: null, musGain: null, track: null, timer: 0 };
  function ac() {
    if (!A.ctx) { try { A.ctx = new (W.AudioContext || W.webkitAudioContext)(); A.master = A.ctx.createGain(); A.master.gain.value = .9; A.master.connect(A.ctx.destination); A.musGain = A.ctx.createGain(); A.musGain.gain.value = A.mus ? .16 : 0; A.musGain.connect(A.master); } catch (e) { return null; } }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }
  function tone(f, d, o) {
    o = o || {}; var c = ac(); if (!c || (!o.music && !A.sfx)) return;
    try {
      var t = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
      var v = o.vol || .08; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || .008)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      osc.connect(g); g.connect(o.music ? A.musGain : A.master); osc.start(t); osc.stop(t + d + .03);
    } catch (e) { }
  }
  function noise(d, o) {
    o = o || {}; var c = ac(); if (!c || !A.sfx) return;
    try {
      var n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter(); fl.type = o.type || 'lowpass'; fl.frequency.value = o.f || 1200;
      s.buffer = b; g.gain.value = o.vol || .12; s.connect(fl); fl.connect(g); g.connect(A.master); s.start(c.currentTime + (o.at || 0));
    } catch (e) { }
  }
  GK.tone = tone; GK.noise = noise;
  GK.sfx = {
    click: function () { tone(520, .05, { type: 'triangle', vol: .05 }); },
    pick: function () { tone(440, .08, { type: 'triangle', to: 780, vol: .08 }); },
    drop: function () { tone(330, .09, { type: 'triangle', to: 200, vol: .08 }); noise(.05, { f: 600, vol: .05 }); },
    coin: function () { tone(988, .08, { vol: .07 }); tone(1319, .16, { vol: .07, at: .07 }); },
    tape: function () { noise(.28, { type: 'bandpass', f: 2400, vol: .1 }); },
    stamp: function () { noise(.07, { f: 300, vol: .2 }); tone(140, .1, { type: 'square', vol: .05 }); },
    err: function () { tone(200, .18, { type: 'sawtooth', to: 120, vol: .05 }); },
    up: function () { [523, 659, 784].forEach(function (f, i) { tone(f, .14, { type: 'triangle', vol: .07, at: i * .07 }); }); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, .22, { type: 'triangle', vol: .08, at: i * .09 }); }); },
    truck: function () { tone(70, .6, { type: 'sawtooth', to: 90, vol: .04 }); noise(.5, { f: 400, vol: .05 }); },
    hit: function () { noise(.08, { f: 900, vol: .14 }); tone(160, .08, { type: 'square', to: 90, vol: .05 }); },
    hurt: function () { tone(300, .14, { type: 'sawtooth', to: 140, vol: .07 }); },
    chop: function () { noise(.06, { f: 1600, vol: .12 }); tone(240, .05, { type: 'square', vol: .03 }); },
    mine: function () { noise(.05, { type: 'highpass', f: 2600, vol: .1 }); tone(900, .05, { type: 'square', vol: .03 }); },
    skill: function () { tone(300, .3, { type: 'sawtooth', to: 900, vol: .06 }); noise(.25, { type: 'bandpass', f: 1800, vol: .06 }); },
    boom: function () { noise(.5, { f: 300, vol: .28 }); tone(80, .4, { type: 'sine', to: 40, vol: .12 }); },
    build: function () { [0, .12, .24].forEach(function (t) { noise(.05, { f: 700, vol: .12, at: t }); }); },
    night: function () { tone(220, .8, { type: 'sine', to: 110, vol: .05 }); },
    step: function () { noise(.03, { f: 500, vol: .025 }); }
  };
  /* фоновая музыка: короткие генеративные мелодии по аккордам, без файлов */
  var STY = {
    warm: { bpm: 104, prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], scale: [0, 2, 4, 7, 9], lead: 'triangle', bass: 'sine', oct: 12 },
    dark: { bpm: 72, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], scale: [0, 3, 5, 7, 10], lead: 'sine', bass: 'triangle', oct: 12 }
  };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  GK.music = function (style) {
    A.track = style ? STY[style] : null; clearInterval(A.timer); if (!A.track) return;
    var step = 0, rnd = Math.random;
    A.timer = setInterval(function () {
      if (!A.mus || !A.ctx || document.hidden) return;
      var T = A.track, beat = 60 / T.bpm, bar = Math.floor(step / 8) % T.prog.length, ch = T.prog[bar], s8 = step % 8;
      if (s8 === 0) { tone(mtof(ch[0] - 12), beat * 3.6, { type: T.bass, vol: .1, music: true, att: .05 }); ch.forEach(function (n, i) { tone(mtof(n), beat * 3.8, { type: 'sine', vol: .028, music: true, att: .3, at: i * .02 }); }); }
      if (s8 === 4) tone(mtof(ch[0] - 12 + 7), beat * 1.6, { type: T.bass, vol: .06, music: true, att: .05 });
      if (rnd() < (T === STY.warm ? .55 : .35)) { var n = ch[0] + T.oct + T.scale[Math.floor(rnd() * T.scale.length)]; tone(mtof(n), beat * (rnd() < .3 ? 1.2 : .55), { type: T.lead, vol: .035, music: true, att: .02 }); }
      step++;
    }, (60 / STY[style].bpm) * 500);
  };
  GK.setSfx = function (on) { A.sfx = on; ls('sfx', on ? '1' : '0'); };
  GK.setMus = function (on) { A.mus = on; ls('mus', on ? '1' : '0'); if (A.musGain) A.musGain.gain.value = on ? .16 : 0; };
  GK.audio = A; GK.unlock = ac;

  /* ------------------------------------------------------------ стили каркаса */
  var CSS = '.gk{position:fixed;inset:0;z-index:2000;background:#0b1d3a;color:#fff;font-family:Onest,Inter,system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden;opacity:0;transition:opacity .35s}' +
    '.gk.on{opacity:1}.gk *{box-sizing:border-box}.gk button{font:inherit;color:inherit;cursor:pointer}' +
    '.gk canvas.gk-cv{position:absolute;inset:0;width:100%;height:100%;display:block;outline:0;touch-action:none}' +
    '.gk svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}' +
    '.gk-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:calc(8px + env(safe-area-inset-top,0px)) calc(10px + env(safe-area-inset-right,0px)) 0 calc(10px + env(safe-area-inset-left,0px));pointer-events:none;z-index:5}' +
    '.gk-top>*{pointer-events:auto}.gk-left{display:flex;gap:8px;flex-wrap:wrap;min-width:0}.gk-sp{flex:1;pointer-events:none!important}' +
    '.gk-b{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;border:1px solid rgba(255,255,255,.2);background:var(--gk-glass,rgba(11,29,58,.66));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:0;transition:transform .12s}' +
    '.gk-b:active{transform:scale(.92)}.gk-b.off{opacity:.5}' +
    '.gk-chip{display:flex;align-items:center;gap:6px;height:42px;padding:0 12px;border-radius:13px;border:1px solid rgba(255,255,255,.2);background:var(--gk-glass,rgba(11,29,58,.66));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-weight:800;font-size:.92rem;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.gk-chip i{display:inline-block;width:18px;height:18px;flex:none}' +
    '.gk-en{position:relative;min-width:110px}.gk-en .bar{position:relative;flex:1;height:8px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden;min-width:44px}.gk-en .bar b{position:absolute;inset:0 auto 0 0;border-radius:9px;background:linear-gradient(90deg,#ffd34d,#ff9f2b);transition:width .3s}' +
    '.gk-en small{font-size:.72rem;opacity:.8;font-weight:700}' +
    '.gk-toast{position:absolute;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:grid;gap:6px;z-index:9;pointer-events:none;width:min(92vw,420px)}' +
    '.gk-toast div{justify-self:center;padding:9px 14px;border-radius:12px;background:rgba(8,18,36,.86);border:1px solid rgba(255,255,255,.18);font-weight:700;font-size:.88rem;line-height:1.3;text-align:center;animation:gkin .25s ease both}' +
    '.gk-toast div.ok{border-color:rgba(122,230,160,.6)}.gk-toast div.warn{border-color:rgba(255,138,128,.7)}.gk-toast div.gold{border-color:rgba(255,211,77,.8);background:rgba(60,40,0,.85)}' +
    '@keyframes gkin{from{opacity:0;transform:translateY(-8px)}}' +
    '.gk-sheet{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:calc(14px + env(safe-area-inset-top,0px)) calc(14px + env(safe-area-inset-right,0px)) calc(14px + env(safe-area-inset-bottom,0px)) calc(14px + env(safe-area-inset-left,0px));background:rgba(4,10,22,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);touch-action:auto;animation:gkfade .2s ease both}' +
    '@keyframes gkfade{from{opacity:0}}' +
    '.gk-card{width:min(var(--w,460px),100%);max-height:100%;overflow:auto;border-radius:22px;background:var(--gk-card,linear-gradient(170deg,#16335f,#0b1d3a));border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.5);padding:16px;animation:gkpop .3s cubic-bezier(.2,1.2,.4,1) both;overscroll-behavior:contain}' +
    '@keyframes gkpop{from{transform:translateY(18px) scale(.97);opacity:0}}' +
    '.gk-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.gk-ch h2{margin:0;font-size:1.22rem;font-weight:800;line-height:1.2}' +
    '.gk-x{width:36px;height:36px;border-radius:11px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);display:grid;place-items:center;flex:none}' +
    '.gk-cb{display:grid;gap:10px}.gk-lead{margin:0;color:rgba(255,255,255,.8);line-height:1.5;font-size:.93rem}.gk-note{color:rgba(255,255,255,.58);font-size:.8rem;line-height:1.4}' +
    '.gk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 16px;border-radius:14px;border:0;font-weight:800;font-size:.95rem;background:var(--gk-acc,linear-gradient(140deg,#43c9e3,#1a86c0));color:var(--gk-acc-ink,#06213a);box-shadow:0 8px 20px rgba(0,0,0,.25);white-space:nowrap;transition:transform .12s,opacity .2s}' +
    '.gk-btn:active{transform:scale(.96)}.gk-btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}.gk-btn.sm{height:38px;padding:0 12px;border-radius:11px;font-size:.86rem}.gk-btn.g{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);box-shadow:none}' +
    '.gk-row{display:flex;gap:8px;flex-wrap:wrap}.gk-row>.gk-btn{flex:1}' +
    '.gk-list{display:grid;gap:8px}.gk-it{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);min-width:0}' +
    '.gk-it .t{flex:1;min-width:0;display:grid;gap:3px}.gk-it .t b{font-size:.95rem}.gk-it .t small{color:rgba(255,255,255,.62);font-size:.78rem;line-height:1.35}' +
    '.gk-it .ic{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.08);overflow:hidden}.gk-it .ic canvas,.gk-it .ic img{width:44px;height:44px}' +
    '.gk-it.lk{opacity:.5}.gk-it.done{opacity:.55}' +
    '.gk-bar{height:7px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden}.gk-bar i{display:block;height:100%;border-radius:9px;background:var(--gk-bar,linear-gradient(90deg,#43c9e3,#8aa8ff));transition:width .4s}' +
    '.gk-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.gk-tabs button{flex:none;height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);font-weight:700;font-size:.85rem}.gk-tabs button[aria-selected="true"]{background:#fff;color:#0b1d3a}' +
    '.gk-cost{display:inline-flex;gap:8px;flex-wrap:wrap;font-size:.8rem;font-weight:700}.gk-cost span{display:inline-flex;align-items:center;gap:3px}.gk-cost span.no{color:#ff8a80}.gk-cost i{width:14px;height:14px;display:inline-block}' +
    '.gk-tut{position:absolute;inset:0;z-index:15;pointer-events:none}.gk-tut .bub{position:absolute;max-width:min(300px,82vw);padding:12px 14px;border-radius:14px;background:#fff;color:#0b1d3a;font-weight:700;font-size:.9rem;line-height:1.4;box-shadow:0 12px 30px rgba(0,0,0,.35);pointer-events:auto;animation:gkpop .3s both}' +
    '.gk-tut .bub small{display:block;margin-top:6px;color:#5a6b82;font-weight:600;font-size:.76rem}.gk-tut .bub button{margin-top:8px;height:32px;padding:0 12px;border-radius:9px;border:0;background:#0b1d3a;color:#fff;font-weight:800;font-size:.8rem}' +
    '.gk-tut .ar{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 4px rgba(255,211,77,.7),0 0 24px rgba(255,211,77,.9);animation:gkring 1s ease-in-out infinite}' +
    '@keyframes gkring{50%{transform:scale(1.25);box-shadow:0 0 0 8px rgba(255,211,77,.3),0 0 30px rgba(255,211,77,.9)}}' +
    '.gk-joy{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:50%;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.32);pointer-events:none;z-index:6}.gk-joy[hidden]{display:none}.gk-joy i{position:absolute;left:50%;top:50%;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.78);transform:translate(-50%,-50%);box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
    '.gk-load{position:absolute;inset:0;display:grid;place-items:center;z-index:30;background:#0b1d3a;transition:opacity .5s}.gk-load.out{opacity:0;pointer-events:none}.gk-load div{display:grid;gap:12px;justify-items:center;font-weight:800;font-size:1.1rem}.gk-load i{width:44px;height:44px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#fff;animation:gkspin 1s linear infinite}' +
    '@keyframes gkspin{to{transform:rotate(360deg)}}' +
    '.gk-fl{position:absolute;left:0;top:0;pointer-events:none;font-weight:800;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 8px rgba(0,0,0,.35);z-index:4;will-change:transform,opacity}' +
    '@media (max-width:520px){.gk-toast{top:calc(112px + env(safe-area-inset-top,0px))}.gk-toast div{font-size:.8rem}.gk-chip{padding:0 9px;font-size:.84rem}.gk-b{width:40px;height:40px}.gk-en{min-width:86px}}' +
    '@media (prefers-reduced-motion:reduce){.gk *{animation-duration:.01ms!important;transition-duration:.01ms!important}}';
  function injectCss() { if (document.getElementById('gk-css')) return; var st = document.createElement('style'); st.id = 'gk-css'; st.textContent = CSS; document.head.appendChild(st); }

  GK.ICONS = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    snd: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mus: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.8M12 16.6v.1"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" style="fill:#ffd34d;stroke:#b8790a;stroke-width:1.4"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  /* ------------------------------------------------------------ окно игры */
  GK.shell = function (o) {
    injectCss();
    var root = document.createElement('div'); root.className = 'gk ' + (o.cls || ''); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', o.title);
    root.innerHTML = '<canvas class="gk-cv" tabindex="0" aria-label="Игровое поле"></canvas><div class="gk-hud"></div>' +
      '<div class="gk-top"><button class="gk-b" data-gk="close" aria-label="Выйти из игры">' + GK.ICONS.x + '</button><div class="gk-left"></div><span class="gk-sp"></span><div class="gk-right" style="display:flex;gap:8px"></div>' +
      '<button class="gk-b" data-gk="mus" aria-label="Музыка">' + GK.ICONS.mus + '</button><button class="gk-b" data-gk="sfx" aria-label="Звуки">' + GK.ICONS.snd + '</button><button class="gk-b" data-gk="help" aria-label="Как играть">' + GK.ICONS.help + '</button></div>' +
      '<div class="gk-toast"></div><div class="gk-tut"></div><div class="gk-joy" hidden><i></i></div><div class="gk-sheets"></div>' +
      '<div class="gk-load"><div><i></i><span>' + GK.esc(o.title) + '</span></div></div>';
    document.body.appendChild(root); document.documentElement.classList.add('byg-lock'); document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { root.classList.add('on'); });
    var cv = root.querySelector('.gk-cv'), cx = cv.getContext('2d');
    var S = { root: root, cv: cv, cx: cx, w: 0, h: 0, dpr: 1, hud: root.querySelector('.gk-hud'), left: root.querySelector('.gk-left'), right: root.querySelector('.gk-right'), tut: root.querySelector('.gk-tut') };
    S.$ = function (q) { return root.querySelector(q); };
    function size() {
      var vv = W.visualViewport, w = Math.round((vv && vv.width) || W.innerWidth), h = Math.round((vv && vv.height) || W.innerHeight);
      S.dpr = Math.min(W.devicePixelRatio || 1, o.maxDpr || 2); S.w = w; S.h = h; root.style.height = h + 'px';
      cv.width = Math.round(w * S.dpr); cv.height = Math.round(h * S.dpr); cx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (S.onresize) S.onresize(w, h);
    }
    S.size = size; size();
    W.addEventListener('resize', size);
    function setBtn() { root.querySelector('[data-gk="mus"]').classList.toggle('off', !A.mus); root.querySelector('[data-gk="sfx"]').classList.toggle('off', !A.sfx); }
    setBtn();
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gk]'); if (!b) return; ac();
      var k = b.getAttribute('data-gk');
      if (k === 'close') { if (S.onclose) S.onclose(); }
      else if (k === 'mus') { GK.setMus(!A.mus); setBtn(); }
      else if (k === 'sfx') { GK.setSfx(!A.sfx); setBtn(); GK.sfx.click(); }
      else if (k === 'help') { if (S.onhelp) S.onhelp(); }
      else if (k === 'sheetx') { S.closeSheet(); }
    });
    root.addEventListener('pointerdown', function () { ac(); }, { capture: true });
    S.loaded = function () { var l = root.querySelector('.gk-load'); l.classList.add('out'); setTimeout(function () { l.remove(); }, 600); };
    S.toast = function (t, kind) {
      var box = root.querySelector('.gk-toast'), d = document.createElement('div'); d.className = kind || ''; d.textContent = t; box.appendChild(d);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(function () { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 420); }, kind === 'gold' ? 3600 : 2600);
    };
    /* панели: стек, крестик и Esc закрывают верхнюю */
    var sheets = root.querySelector('.gk-sheets');
    S.sheet = function (title, body, opt) {
      opt = opt || {};
      var el = document.createElement('div'); el.className = 'gk-sheet';
      el.innerHTML = '<div class="gk-card" role="document" style="' + (opt.w ? '--w:' + opt.w + 'px' : '') + '"><div class="gk-ch"><h2>' + title + '</h2>' + (opt.noClose ? '' : '<button class="gk-x" data-gk="sheetx" aria-label="Закрыть">' + GK.ICONS.x + '</button>') + '</div><div class="gk-cb">' + body + '</div></div>';
      if (!opt.keep) sheets.innerHTML = '';
      sheets.appendChild(el);
      el.addEventListener('pointerdown', function (e) { if (e.target === el && !opt.noClose) S.closeSheet(); });
      el._opt = opt; S.paused = true;
      var f = el.querySelector('button:not([disabled])'); if (f) try { f.focus({ preventScroll: true }); } catch (x) { }
      return el.querySelector('.gk-card');
    };
    S.closeSheet = function () { var l = sheets.lastElementChild; if (!l) return; var cb = l._opt && l._opt.onclose; l.remove(); S.paused = !!sheets.lastElementChild; if (cb) cb(); try { cv.focus({ preventScroll: true }); } catch (x) { } };
    S.sheetOpen = function () { return !!sheets.lastElementChild; };
    S.closeAll = function () { while (sheets.lastElementChild) S.closeSheet(); };
    /* всплывающий текст над точкой экрана */
    S.float = function (x, y, txt, col, size) {
      var d = document.createElement('div'); d.className = 'gk-fl'; d.textContent = txt; d.style.color = col || '#ffd34d'; d.style.fontSize = (size || 18) + 'px';
      root.appendChild(d); var t0 = performance.now();
      (function a(t) { var k = Math.min(1, (t - t0) / 1100); d.style.transform = 'translate(' + (x - d.offsetWidth / 2) + 'px,' + (y - 30 * GK.ease(k) - 12) + 'px) scale(' + (k < .15 ? .6 + k / .15 * .5 : 1.1 - Math.min(.1, (k - .15))) + ')'; d.style.opacity = k > .7 ? (1 - k) / .3 : 1; if (k < 1) requestAnimationFrame(a); else d.remove(); })(t0);
    };
    S.destroy = function () { W.removeEventListener('resize', size); GK.music(null); root.classList.remove('on'); setTimeout(function () { root.remove(); }, 350); document.documentElement.classList.remove('byg-lock'); document.documentElement.style.overflow = ''; };
    return S;
  };

  /* ------------------------------------------------------------ ввод: клавиатура, джойстик, касание */
  GK.input = function (S, opt) {
    opt = opt || {};
    var I = { keys: {}, jx: 0, jy: 0, joy: false, onTap: null, onDrag: null, onPinch: null };
    var KM = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd', 'ц': 'w', 'ы': 's', 'ф': 'a', 'в': 'd' };
    function kd(e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase(); k = KM[k] || k;
      if (k === 'escape') { e.preventDefault(); if (S.sheetOpen()) { var top = S.root.querySelector('.gk-sheets').lastElementChild; if (!(top._opt && top._opt.noClose)) S.closeSheet(); } else if (S.onclose) S.onclose(); return; }
      if (S.sheetOpen()) return;
      if ('wasd'.indexOf(k) >= 0 && k.length === 1) { I.keys[k] = 1; e.preventDefault(); if (I.onKeyMove) I.onKeyMove(); }
      if (opt.onKey) opt.onKey(k, e);
    }
    function ku(e) { var k = e.key.toLowerCase(); delete I.keys[KM[k] || k]; }
    W.addEventListener('keydown', kd); W.addEventListener('keyup', ku);
    var joyEl = S.root.querySelector('.gk-joy'), knob = joyEl.querySelector('i'), JR = 54, ptrs = {}, joyId = -1, ox = 0, oy = 0, tap = null, pinch = null;
    var cv = S.cv;
    function rel(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (e) {
      if (S.paused) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      var p = rel(e); ptrs[e.pointerId] = p;
      var ids = Object.keys(ptrs);
      if (ids.length === 2 && opt.pinch) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; tap = null; if (joyId >= 0) { joyId = -1; I.joy = false; I.jx = I.jy = 0; joyEl.hidden = true; } return; }
      tap = { id: e.pointerId, x: p[0], y: p[1], t: performance.now(), m: 0, drag: false };
      if (opt.joystick !== false && e.pointerType !== 'mouse' && p[0] < S.w * .5 && p[1] > 90 && joyId < 0) { joyId = e.pointerId; ox = p[0]; oy = p[1]; joyEl.hidden = false; joyEl.style.left = ox + 'px'; joyEl.style.top = oy + 'px'; knob.style.transform = 'translate(-50%,-50%)'; }
    });
    cv.addEventListener('pointermove', function (e) {
      var p = rel(e); if (!ptrs[e.pointerId]) return;
      var prev = ptrs[e.pointerId]; ptrs[e.pointerId] = p;
      if (pinch) { var ids = Object.keys(ptrs); if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (I.onPinch) I.onPinch(d / pinch.d); pinch.d = d; } return; }
      if (tap && tap.id === e.pointerId) { tap.m = Math.max(tap.m, Math.hypot(p[0] - tap.x, p[1] - tap.y)); }
      if (joyId === e.pointerId) {
        var dx = p[0] - ox, dy = p[1] - oy, l = Math.hypot(dx, dy); if (l > JR) { dx = dx / l * JR; dy = dy / l * JR; }
        I.jx = dx / JR; I.jy = dy / JR; I.joy = l > 6; knob.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px))';
        if (I.joy && I.onKeyMove) I.onKeyMove();
      } else if (tap && tap.id === e.pointerId && tap.m > 8 && I.onDrag) { tap.drag = true; I.onDrag(p[0] - prev[0], p[1] - prev[1]); }
    });
    function up(e) {
      var p = rel(e); delete ptrs[e.pointerId];
      if (pinch && Object.keys(ptrs).length < 2) { pinch = null; tap = null; return; }
      if (joyId === e.pointerId) { joyId = -1; I.joy = false; I.jx = I.jy = 0; joyEl.hidden = true; if (tap && tap.m < 8 && performance.now() - tap.t < 300 && I.onTap) I.onTap(p[0], p[1]); tap = null; return; }
      if (tap && tap.id === e.pointerId) { if (tap.m < 10 && performance.now() - tap.t < 450 && I.onTap) I.onTap(p[0], p[1]); tap = null; }
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { if (I.onPinch) { e.preventDefault(); I.onPinch(e.deltaY < 0 ? 1.1 : 0.91); } }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    I.dir = function () {
      var x = 0, y = 0; if (I.keys.a) x -= 1; if (I.keys.d) x += 1; if (I.keys.w) y -= 1; if (I.keys.s) y += 1;
      if (I.joy) { x += I.jx; y += I.jy; }
      var l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      return { x: x, y: y, on: l > .08 };
    };
    I.destroy = function () { W.removeEventListener('keydown', kd); W.removeEventListener('keyup', ku); };
    return I;
  };

  /* ------------------------------------------------------------ энергия: тратится на действия, восстанавливается со временем */
  GK.energy = function (st, max, regenSec) {
    st.en = st.en == null ? max : st.en; st.enAt = st.enAt || Date.now();
    var E = {
      max: max, regen: regenSec,
      tick: function () {
        var now = Date.now();
        if (st.en >= E.max) { st.enAt = now; return; }
        var k = Math.floor((now - st.enAt) / (E.regen * 1000));
        if (k > 0) { st.en = Math.min(E.max, st.en + k); st.enAt += k * E.regen * 1000; if (st.en >= E.max) st.enAt = now; }
      },
      has: function (n) { E.tick(); return st.en >= n; },
      spend: function (n) { E.tick(); if (st.en < n) return false; if (st.en >= E.max) st.enAt = Date.now(); st.en -= n; return true; },
      add: function (n) { st.en = Math.min(E.max + 50, st.en + n); },
      next: function () { if (st.en >= E.max) return 0; return Math.max(0, E.regen - (Date.now() - st.enAt) / 1000); },
      full: function () { if (st.en >= E.max) return 0; return E.next() + (E.max - st.en - 1) * E.regen; }
    };
    E.tick(); return E;
  };
  GK.energyChip = function (S, E) {
    var el = document.createElement('div'); el.className = 'gk-chip gk-en'; el.title = 'Энергия';
    el.innerHTML = '<i>' + GK.ICONS.bolt + '</i><span class="bar"><b></b></span><span class="v">0</span>';
    S.left.appendChild(el);
    var b = el.querySelector('b'), v = el.querySelector('.v');
    return function (st) { E.tick(); b.style.width = Math.min(100, st.en / E.max * 100) + '%'; v.textContent = Math.floor(st.en); el.title = st.en >= E.max ? 'Энергия полная' : 'Энергия: +1 через ' + GK.dur(E.next()); };
  };
  GK.noEnergy = function (S, E, st, what) {
    S.sheet('Нет энергии', '<p class="gk-lead">Для действия «' + GK.esc(what) + '» не хватает энергии. Она восстанавливается сама: +1 каждые ' + GK.dur(E.regen) + '.</p><div class="gk-it"><span class="ic">' + GK.ICONS.bolt + '</span><span class="t"><b>' + Math.floor(st.en) + ' из ' + E.max + '</b><small>' + (st.en >= E.max ? 'Полная' : 'Следующая единица через ' + GK.dur(E.next()) + ', полная через ' + GK.dur(E.full())) + '</small></span></div><div class="gk-row"><button class="gk-btn" data-gk="sheetx">Понятно</button></div>', { w: 380 });
    GK.sfx.err();
  };

  /* ------------------------------------------------------------ сохранение на сервер */
  GK.saver = function (ctx, S, getState, onUser) {
    var rev = ctx.rev || 0, dirty = false, busy = false, last = 0, dead = false;
    var Sv = {
      mark: function () { dirty = true; },
      flush: function (force) {
        if (dead || busy || (!dirty && !force)) return Promise.resolve();
        busy = true; dirty = false; last = Date.now();
        var data; try { data = JSON.stringify(getState()); } catch (e) { busy = false; return Promise.resolve(); }
        return ctx.save(data, rev).then(function (r) {
          busy = false;
          if (!r || !r.ok) { dirty = true; return; }
          if (r.conflict) {
            dead = true;
            S.sheet('Прогресс изменился', '<p class="gk-lead">Эта игра открыта на другом устройстве, и там прогресс новее. Чтобы ничего не потерять, перезапустите игру.</p><div class="gk-row"><button class="gk-btn" id="gk-rel">Перезапустить</button></div>', { noClose: true, w: 380 })
              .querySelector('#gk-rel').addEventListener('click', function () { location.reload(); });
            return;
          }
          rev = r.rev;
          if (r.frames && r.frames.length) { r.frames.forEach(function (f) { S.toast('Новая рамка для аватара: «' + f.name + '». Она уже в профиле', 'gold'); }); GK.sfx.win(); }
          if (r.user && onUser) onUser(r.user);
        }, function () { busy = false; dirty = true; });
      },
      tick: function () { if (dirty && Date.now() - last > 12000) Sv.flush(); },
      stop: function () { dead = true; }
    };
    function vis() { if (document.hidden) Sv.flush(); }
    document.addEventListener('visibilitychange', vis);
    W.addEventListener('pagehide', function () { Sv.flush(); });
    Sv.off = function () { document.removeEventListener('visibilitychange', vis); };
    return Sv;
  };

  /* ------------------------------------------------------------ обучение шаг за шагом */
  GK.tutor = function (S, steps, st, onDone) {
    var T = { i: st.tut || 0, el: S.tut, shown: -1 };
    function render(pos) {
      var s = steps[T.i]; if (!s) { T.el.innerHTML = ''; return; }
      if (T.shown !== T.i) {
        T.shown = T.i;
        T.el.innerHTML = '<div class="ar" hidden></div><div class="bub"><span>' + s.t + '</span>' + (s.sub ? '<small>' + s.sub + '</small>' : '') + (s.ok ? '<button type="button" data-tut="ok">' + (s.ok === true ? 'Дальше' : s.ok) + '</button>' : '') + '<small style="opacity:.7">Шаг ' + (T.i + 1) + ' из ' + steps.length + ' · <u data-tut="skip" style="cursor:pointer">пропустить обучение</u></small></div>';
        var ok = T.el.querySelector('[data-tut="ok"]'); if (ok) ok.addEventListener('click', function () { T.next(); });
        T.el.querySelector('[data-tut="skip"]').addEventListener('click', function () { T.i = steps.length; st.tut = T.i; T.el.innerHTML = ''; if (onDone) onDone(); });
      }
      var ar = T.el.querySelector('.ar'), bub = T.el.querySelector('.bub');
      if (pos) { ar.hidden = false; ar.style.left = pos[0] + 'px'; ar.style.top = pos[1] + 'px'; } else ar.hidden = true;
      var bx = S.w / 2 - Math.min(300, S.w * .82) / 2, by = s.top ? Math.max(120, S.h * .2) : S.h - 190;
      if (pos && !s.fixed) { by = pos[1] > S.h * .55 ? Math.max(70, pos[1] - 150) : Math.min(S.h - 140, pos[1] + 40); }
      // не закрываем центр экрана, где стоит персонаж
      var bh = bub.offsetHeight || 110, c0 = S.h / 2 - 100, c1 = S.h / 2 + 50;
      if (by < c1 && by + bh > c0) { var up = c0 - bh - 8, dn = c1 + 8; by = (pos && pos[1] < S.h / 2) ? (dn + bh < S.h - 70 ? dn : Math.max(110, up)) : (up > 100 ? up : dn); }
      bub.style.left = Math.max(10, bx) + 'px'; bub.style.top = by + 'px';
    }
    T.next = function () { T.i++; st.tut = T.i; GK.sfx.up(); if (T.i >= steps.length) { T.el.innerHTML = ''; if (onDone) onDone(); } };
    T.update = function () {
      if (T.i >= steps.length || S.sheetOpen() && !(steps[T.i] && steps[T.i].inSheet)) { if (S.sheetOpen() && T.el.firstChild) T.el.style.display = 'none'; return; }
      T.el.style.display = '';
      var s = steps[T.i]; if (s.done && s.done()) { T.next(); return; }
      render(s.at ? s.at() : null);
    };
    T.active = function () { return T.i < steps.length; };
    T.step = function () { return steps[T.i] && steps[T.i].id; };
    return T;
  };

  /* ------------------------------------------------------------ частицы на холсте */
  GK.parts = function () {
    var P = [];
    return {
      list: P,
      add: function (p) { P.push(p); },
      burst: function (x, y, n, o) {
        o = o || {};
        for (var i = 0; i < n; i++) { var a = (o.a0 != null ? o.a0 : 0) + Math.random() * (o.spread || PI * 2), s = (o.spd || 120) * (.4 + Math.random() * .8); P.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g == null ? 300 : o.g, life: (o.life || .7) * (.6 + Math.random() * .6), t: 0, r: (o.r || 3) * (.6 + Math.random() * .7), c: o.cols ? o.cols[i % o.cols.length] : (o.c || '#fff'), sq: o.sq }); }
      },
      step: function (dt) { for (var i = P.length - 1; i >= 0; i--) { var p = P[i]; p.t += dt; if (p.t >= p.life) { P.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
      draw: function (cx, ox, oy) {
        for (var i = 0; i < P.length; i++) {
          var p = P[i], k = 1 - p.t / p.life; cx.globalAlpha = Math.min(1, k * 1.6); cx.fillStyle = p.c;
          if (p.sq) { cx.save(); cx.translate(p.x - ox, p.y - oy); cx.rotate(p.t * 8); cx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r); cx.restore(); }
          else { cx.beginPath(); cx.arc(p.x - ox, p.y - oy, p.r * (0.5 + k * .5), 0, PI * 2); cx.fill(); }
        }
        cx.globalAlpha = 1;
      }
    };
  };

  /* ------------------------------------------------------------ рисование */
  GK.rr = function (cx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  GK.shade = function (hex, k) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    if (k < 1) { r *= k; g *= k; b *= k; } else { var t = k - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  };
  /* кэш спрайтов: рисуем сложную графику один раз в offscreen-холст */
  GK.sprite = (function () {
    var cache = {};
    return function (key, w, h, draw, dpr) {
      dpr = dpr || 2; var k = key + '@' + dpr;
      if (cache[k]) return cache[k];
      var c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      var x = c.getContext('2d'); x.scale(dpr, dpr); draw(x, w, h);
      c.w = w; c.h = h; cache[k] = c; return c;
    };
  })();
  GK.shadow = function (cx, x, y, rx, ry, a) { cx.fillStyle = 'rgba(0,0,0,' + (a || .22) + ')'; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, PI * 2); cx.fill(); };
  GK.icon = function (draw, size) { var c = document.createElement('canvas'), d = 2; size = size || 44; c.width = c.height = size * d; var x = c.getContext('2d'); x.scale(d, d); draw(x, size); return c; };

  /* общий цикл кадров с паузой при скрытой вкладке */
  GK.loop = function (fn) {
    var raf = 0, last = performance.now(), alive = true;
    function f(t) { if (!alive) return; raf = requestAnimationFrame(f); if (document.hidden) { last = t; return; } var dt = Math.min(.05, (t - last) / 1000); last = t; fn(dt, t); }
    raf = requestAnimationFrame(f);
    return { stop: function () { alive = false; cancelAnimationFrame(raf); } };
  };

  W.GK = GK;
})(window);
