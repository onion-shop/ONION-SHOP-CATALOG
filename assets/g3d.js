/* g3d.js: мини-движок 3D на WebGL2, без внешних библиотек.
   Низкополигональная графика: мягкий свет, карта теней с PCF, туман, вода, небо, спрайты и частицы.
   Используется игрой «Байер» (assets/byer.js). Подгружается только при запуске игры. */
(function (W) {
  'use strict';

  /* ------------------------------------------------------------ математика (матрицы 4x4, по столбцам) */
  var M = {
    ident: function (o) { o = o || new Float32Array(16); o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    mul: function (o, a, b) {
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    persp: function (o, fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2); o.fill(0);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
    },
    ortho: function (o, l, r, b, t, n, f) {
      o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
    },
    look: function (o, e, c, up) {
      var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
    },
    inv: function (o, m) {
      var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      var b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      var d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return M.ident(o); d = 1 / d;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
      return o;
    },
    /* локальная матрица узла: T * Ry * Rx * Rz * S */
    trs: function (o, x, y, z, ry, rx, rz, s) {
      var cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
      // R = Ry * Rx * Rz
      var r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
      var r10 = cx * sz, r11 = cx * cz, r12 = -sx;
      var r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
      o[0] = r00 * s; o[1] = r10 * s; o[2] = r20 * s; o[3] = 0; o[4] = r01 * s; o[5] = r11 * s; o[6] = r21 * s; o[7] = 0; o[8] = r02 * s; o[9] = r12 * s; o[10] = r22 * s; o[11] = 0;
      o[12] = x; o[13] = y; o[14] = z; o[15] = 1; return o;
    }
  };
  function col(c) {
    if (typeof c !== 'string') return c;
    var h = c.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }

  /* ------------------------------------------------------------ построитель мешей (плоское затенение, цвет в вершинах) */
  function MB() { this.v = []; this.shade = 0.16; }
  MB.prototype._tri = function (a, b, c, n, cl, y0, y1) {
    var v = this.v, s = this.shade, p = [a, b, c];
    for (var i = 0; i < 3; i++) {
      var q = p[i], t = y1 > y0 ? (q[1] - y0) / (y1 - y0) : 1, k = 1 - s * (1 - Math.max(0, Math.min(1, t)));
      v.push(q[0], q[1], q[2], n[0], n[1], n[2], cl[0] * k, cl[1] * k, cl[2] * k);
    }
  };
  function xf(p, x, y, z, ry, sc) {
    var c = Math.cos(ry || 0), s = Math.sin(ry || 0), k = sc || 1;
    return [(p[0] * c + p[2] * s) * k + x, p[1] * k + y, (-p[0] * s + p[2] * c) * k + z];
  }
  function nx(n, ry) { var c = Math.cos(ry || 0), s = Math.sin(ry || 0); return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; }
  /* параллелепипед w×h×d с центром (x,y,z) */
  MB.prototype.box = function (w, h, d, c, x, y, z, ry) {
    c = col(c); x = x || 0; y = y || 0; z = z || 0; ry = ry || 0;
    var hw = w / 2, hh = h / 2, hd = d / 2, y0 = y - hh, y1 = y + hh, self = this;
    var F = [
      [[1, 0, 0], [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]]],
      [[-1, 0, 0], [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]]],
      [[0, 1, 0], [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]]],
      [[0, -1, 0], [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]]],
      [[0, 0, 1], [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]]],
      [[0, 0, -1], [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]]]
    ];
    F.forEach(function (f) {
      var n = nx(f[0], ry), q = f[1].map(function (p) { return xf(p, x, y, z, ry, 1); });
      self._tri(q[0], q[1], q[2], n, c, y0, y1); self._tri(q[0], q[2], q[3], n, c, y0, y1);
    });
    return this;
  };
  /* усечённый цилиндр: радиус верха rt, низа rb, высота h, центр (x,y,z) */
  MB.prototype.cyl = function (rt, rb, h, seg, c, x, y, z, flat) {
    c = col(c); x = x || 0; y = y || 0; z = z || 0; seg = seg || 10;
    var y0 = y - h / 2, y1 = y + h / 2, sl = (rb - rt) / h;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
      var p0 = [x + Math.cos(a0) * rb, y0, z + Math.sin(a0) * rb], p1 = [x + Math.cos(a1) * rb, y0, z + Math.sin(a1) * rb];
      var p2 = [x + Math.cos(a1) * rt, y1, z + Math.sin(a1) * rt], p3 = [x + Math.cos(a0) * rt, y1, z + Math.sin(a0) * rt];
      var nm = function (a) { var l = Math.hypot(1, sl); return [Math.cos(a) / l, sl / l, Math.sin(a) / l]; };
      if (flat) { var n = nm(am); this._tri(p0, p2, p1, n, c, y0, y1); this._tri(p0, p3, p2, n, c, y0, y1); }
      else {
        // гладкие нормали: разбиваем на два треугольника с нормалями по углам
        var v = this.v, s = this.shade, ns = [nm(a0), nm(a1), nm(a1), nm(a0)], ps = [p0, p1, p2, p3], ids = [[0, 2, 1], [0, 3, 2]];
        for (var t = 0; t < 2; t++) for (var k = 0; k < 3; k++) {
          var ix = ids[t][k], q = ps[ix], nn = ns[ix], kk = 1 - s * (ix < 2 ? 1 : 0);
          v.push(q[0], q[1], q[2], nn[0], nn[1], nn[2], c[0] * kk, c[1] * kk, c[2] * kk);
        }
      }
      if (rt > 0) this._tri([x, y1, z], p3, p2, [0, 1, 0], c, y0, y1);
      if (rb > 0) this._tri([x, y0, z], p1, p0, [0, -1, 0], c, y0, y1);
    }
    return this;
  };
  /* сфера (эллипсоид по Y через sy) */
  MB.prototype.sph = function (r, c, x, y, z, sy, seg) {
    c = col(c); x = x || 0; y = y || 0; z = z || 0; sy = sy || 1; seg = seg || 10;
    var rings = Math.max(4, Math.round(seg * 0.7)), v = this.v, s = this.shade;
    function P(i, j) {
      var th = i / rings * Math.PI, ph = j / seg * Math.PI * 2;
      return { p: [x + r * Math.sin(th) * Math.cos(ph), y + r * sy * Math.cos(th), z + r * Math.sin(th) * Math.sin(ph)], n: [Math.sin(th) * Math.cos(ph), Math.cos(th) / sy, Math.sin(th) * Math.sin(ph)] };
    }
    var y0 = y - r * sy, y1 = y + r * sy;
    for (var i = 0; i < rings; i++) for (var j = 0; j < seg; j++) {
      var a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1), tri = [[a, b, cc], [a, cc, d]];
      tri.forEach(function (T) {
        T.forEach(function (q) {
          var l = Math.hypot(q.n[0], q.n[1], q.n[2]) || 1, t = (q.p[1] - y0) / (y1 - y0), k = 1 - s * (1 - t);
          v.push(q.p[0], q.p[1], q.p[2], q.n[0] / l, q.n[1] / l, q.n[2] / l, c[0] * k, c[1] * k, c[2] * k);
        });
      });
    }
    return this;
  };
  MB.prototype.cone = function (r, h, seg, c, x, y, z) { return this.cyl(0, r, h, seg, c, x, y, z, true); };
  /* призма-крыша: основание w×d, высота h, конёк вдоль оси Z, центр основания (x,y,z) */
  MB.prototype.roof = function (w, h, d, c, x, y, z, ry, c2) {
    c = col(c); var cb = c2 ? col(c2) : c; x = x || 0; y = y || 0; z = z || 0; ry = ry || 0;
    var hw = w / 2, hd = d / 2, y1 = y + h, self = this;
    function T(a, b, cc, n, cl) { self._tri(xf(a, x, y, z, ry, 1), xf(b, x, y, z, ry, 1), xf(cc, x, y, z, ry, 1), nx(n, ry), cl, y, y1); }
    var l = Math.hypot(h, hw), n1 = [h / l, hw / l, 0], n2 = [-h / l, hw / l, 0];
    T([hw, 0, hd], [hw, 0, -hd], [0, h, -hd], n1, c); T([hw, 0, hd], [0, h, -hd], [0, h, hd], n1, c);
    T([-hw, 0, -hd], [-hw, 0, hd], [0, h, hd], n2, cb); T([-hw, 0, -hd], [0, h, hd], [0, h, -hd], n2, cb);
    T([-hw, 0, hd], [hw, 0, hd], [0, h, hd], [0, 0, 1], cb); T([hw, 0, -hd], [-hw, 0, -hd], [0, h, -hd], [0, 0, -1], cb);
    return this;
  };
  /* плоский круг/диск на земле */
  MB.prototype.disc = function (r, c, x, y, z, seg) { return this.cyl(r, r, 0.02, seg || 24, c, x, y, z, true); };
  /* вставить другой меш с поворотом вокруг Y, масштабом и сдвигом */
  MB.prototype.add = function (o, x, y, z, ry, sc) {
    var c = Math.cos(ry || 0), sn = Math.sin(ry || 0), k = sc || 1, a = o.v, v = this.v;
    for (var i = 0; i < a.length; i += 9) {
      var px = a[i], pz = a[i + 2], nx_ = a[i + 3], nz = a[i + 5];
      v.push((px * c + pz * sn) * k + (x || 0), a[i + 1] * k + (y || 0), (-px * sn + pz * c) * k + (z || 0), nx_ * c + nz * sn, a[i + 4], -nx_ * sn + nz * c, a[i + 6], a[i + 7], a[i + 8]);
    }
    return this;
  };
  /* повернуть меш на 90° вокруг Z (ось цилиндра становится горизонтальной) */
  MB.prototype.rotZ = function () {
    var a = this.v;
    for (var i = 0; i < a.length; i += 9) { var x = a[i], y = a[i + 1], nx_ = a[i + 3], ny = a[i + 4]; a[i] = -y; a[i + 1] = x; a[i + 3] = -ny; a[i + 4] = nx_; }
    return this;
  };
  MB.prototype.count = function () { return this.v.length / 9; };

  /* ------------------------------------------------------------ узел сцены */
  function Node(mesh) {
    this.mesh = mesh || null; this.x = 0; this.y = 0; this.z = 0; this.ry = 0; this.rx = 0; this.rz = 0; this.s = 1;
    this.children = []; this.parent = null; this.visible = true; this.cast = true; this.tint = null; this.emit = 0; this.alpha = 1;
    this.m = new Float32Array(16); this.local = new Float32Array(16); this.userData = null;
  }
  Node.prototype.add = function (n) { n.parent = this; this.children.push(n); return n; };
  Node.prototype.remove = function (n) { var i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); n.parent = null; };
  Node.prototype.update = function (pm) {
    M.trs(this.local, this.x, this.y, this.z, this.ry, this.rx, this.rz, this.s);
    if (pm) M.mul(this.m, pm, this.local); else this.m.set(this.local);
    for (var i = 0; i < this.children.length; i++) this.children[i].update(this.m);
  };

  function Cam() { this.fov = 0.62; this.near = 1; this.far = 160; this.pos = [0, 20, 20]; this.target = [0, 0, 0]; this.view = M.ident(); this.proj = M.ident(); this.vp = M.ident(); this.ivp = M.ident(); this.right = [1, 0, 0]; this.up = [0, 1, 0]; }
  Cam.prototype.update = function (asp) {
    M.persp(this.proj, this.fov, asp, this.near, this.far); M.look(this.view, this.pos, this.target, [0, 1, 0]);
    M.mul(this.vp, this.proj, this.view); M.inv(this.ivp, this.vp);
    this.right = [this.view[0], this.view[4], this.view[8]]; this.up = [this.view[1], this.view[5], this.view[9]];
  };
  /* луч из точки экрана (в долях 0..1) пересекаем с плоскостью y=h */
  Cam.prototype.ground = function (u, v, h) {
    var nx_ = u * 2 - 1, ny_ = 1 - v * 2, m = this.ivp;
    function un(z) { var x = m[0] * nx_ + m[4] * ny_ + m[8] * z + m[12], y = m[1] * nx_ + m[5] * ny_ + m[9] * z + m[13], zz = m[2] * nx_ + m[6] * ny_ + m[10] * z + m[14], w = m[3] * nx_ + m[7] * ny_ + m[11] * z + m[15]; return [x / w, y / w, zz / w]; }
    var a = un(-1), b = un(1), dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return null;
    var t = (h - a[1]) / dy; if (t < 0) return null;
    return [a[0] + (b[0] - a[0]) * t, h, a[2] + (b[2] - a[2]) * t];
  };
  Cam.prototype.toScreen = function (x, y, z) {
    var m = this.vp, w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w <= 0) return null;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5, 0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5];
  };

  /* ------------------------------------------------------------ шейдеры */
  var VS_MAIN = '#version 300 es\nlayout(location=0) in vec3 aPos;layout(location=1) in vec3 aNrm;layout(location=2) in vec3 aCol;\n' +
    'uniform mat4 uVP,uM,uLVP;out vec3 vN;out vec3 vC;out vec4 vL;out vec3 vW;\n' +
    'void main(){vec4 w=uM*vec4(aPos,1.);vW=w.xyz;vN=mat3(uM)*aNrm;vC=aCol;vL=uLVP*w;gl_Position=uVP*w;}';
  var FS_MAIN = '#version 300 es\nprecision highp float;precision highp sampler2DShadow;\n' +
    'in vec3 vN;in vec3 vC;in vec4 vL;in vec3 vW;out vec4 o;\n' +
    'uniform sampler2DShadow uSh;uniform vec3 uLd,uSun,uSky,uGnd,uFog,uCam;uniform vec4 uTint;uniform float uEmit,uAlpha,uShOn,uTexel,uFogN,uFogF;\n' +
    'void main(){vec3 n=normalize(vN);float nd=max(dot(n,uLd),0.);float sh=1.;\n' +
    'if(uShOn>0.5){vec3 sc=vL.xyz/vL.w*.5+.5;if(sc.x>0.&&sc.x<1.&&sc.y>0.&&sc.y<1.&&sc.z<1.){sh=0.;float b=.0016+.0022*(1.-nd);\n' +
    'for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)sh+=texture(uSh,vec3(sc.xy+vec2(float(i),float(j))*uTexel,sc.z-b));sh/=9.;}}\n' +
    'vec3 hemi=mix(uGnd,uSky,n.y*.5+.5);vec3 vd=normalize(uCam-vW);float rim=pow(1.-max(dot(n,vd),0.),3.)*.14;\n' +
    'vec3 c=vC*(hemi+uSun*nd*sh)+uSky*rim+vC*uEmit;c=mix(c,uTint.rgb,uTint.a);\n' +
    'float d=length(uCam-vW);float f=smoothstep(uFogN,uFogF,d);c=mix(c,uFog,f);o=vec4(c,uAlpha);}';
  var VS_DEPTH = '#version 300 es\nlayout(location=0) in vec3 aPos;uniform mat4 uLVP,uM;void main(){gl_Position=uLVP*uM*vec4(aPos,1.);}';
  var FS_DEPTH = '#version 300 es\nprecision mediump float;void main(){}';
  var VS_SKY = '#version 300 es\nout vec2 vP;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vP=p;gl_Position=vec4(p*2.-1.,.9999,1.);}';
  var FS_SKY = '#version 300 es\nprecision mediump float;in vec2 vP;out vec4 o;uniform vec3 uTop,uMid,uBot;uniform float uT;\n' +
    'void main(){float y=vP.y;vec3 c=y<.45?mix(uBot,uMid,smoothstep(0.,.45,y)):mix(uMid,uTop,smoothstep(.45,1.,y));\n' +
    'float s=exp(-pow((vP.x-.72)*3.2,2.)-pow((y-.62)*3.6,2.));c+=vec3(1.,.93,.7)*s*.28;o=vec4(c,1.);}';
  var VS_WATER = '#version 300 es\nlayout(location=0) in vec3 aPos;uniform mat4 uVP;out vec3 vW;void main(){vW=aPos;gl_Position=uVP*vec4(aPos,1.);}';
  var FS_WATER = '#version 300 es\nprecision highp float;in vec3 vW;out vec4 o;uniform vec3 uCam,uFog,uA,uB;uniform float uT,uFogN,uFogF;\n' +
    'void main(){vec2 p=vW.xz;float w=sin(p.x*.5+uT*.7)*.5+sin(p.y*.42-uT*.55)*.5+sin((p.x+p.y)*.23+uT*.4)*.5;float b=smoothstep(.2,.9,w*.5+.5);\n' +
    'float foam=smoothstep(.97,1.,sin(p.x*1.1+uT*1.2)*sin(p.y*1.3-uT*.9));vec3 c=mix(uA,uB,b)+vec3(.12)*foam;\n' +
    'float d=length(uCam-vW);c=mix(c,uFog,smoothstep(uFogN,uFogF,d));o=vec4(c,1.);}';
  var VS_BB = '#version 300 es\nuniform mat4 uVP;uniform vec3 uC,uR,uU;uniform vec2 uS;uniform vec4 uUV;out vec2 vT;\n' +
    'void main(){vec2 q=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1));vT=vec2(uUV.x+q.x*uUV.z,uUV.y+(1.-q.y)*uUV.w);vec3 w=uC+uR*(q.x-.5)*uS.x+uU*q.y*uS.y;gl_Position=uVP*vec4(w,1.);}';
  var FS_BB = '#version 300 es\nprecision mediump float;in vec2 vT;out vec4 o;uniform sampler2D uTex;uniform vec4 uTint;\n' +
    'void main(){vec4 t=texture(uTex,vT);o=vec4(t.rgb*uTint.rgb,t.a*uTint.a);if(o.a<.01)discard;}';

  function prog(gl, vs, fs) {
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
    return { p: p, u: u };
  }

  /* ------------------------------------------------------------ рендерер */
  function Renderer(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error('webgl2');
    this.gl = gl; this.canvas = canvas; this.t = 0; this.shadowSize = opts.shadowSize || 1024; this.shadows = opts.shadows !== false;
    this.lost = false; var self = this;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.lost = true; });
    canvas.addEventListener('webglcontextrestored', function () { self.lost = false; if (self.onrestore) self.onrestore(); });
    this.main = prog(gl, VS_MAIN, FS_MAIN); this.depth = prog(gl, VS_DEPTH, FS_DEPTH); this.sky = prog(gl, VS_SKY, FS_SKY);
    this.water = prog(gl, VS_WATER, FS_WATER); this.bb = prog(gl, VS_BB, FS_BB);
    this.vaoEmpty = gl.createVertexArray();
    // карта теней
    var S = this.shadowSize; this.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, S, S, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lvp = M.ident(); this.lview = M.ident(); this.lproj = M.ident();
    // свет и окружение
    this.env = {
      ld: [0.46, 0.78, 0.42], sun: [0.78, 0.72, 0.62], sky: [0.50, 0.60, 0.74], gnd: [0.34, 0.33, 0.36],
      fog: [0.74, 0.86, 0.96], fogN: 55, fogF: 120, top: [0.30, 0.56, 0.88], mid: [0.62, 0.82, 0.96], bot: [0.88, 0.95, 1.0],
      waterA: [0.20, 0.66, 0.86], waterB: [0.30, 0.78, 0.94], shCenter: [0, 0, 0], shRadius: 26
    };
    this.waterMesh = null; this.sprites = []; this.draws = []; this.casters = [];
    var q = new MB(); this.waterVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.waterVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-300, -1.2, -300, 300, -1.2, -300, 300, -1.2, 300, -300, -1.2, -300, 300, -1.2, 300, -300, -1.2, 300]), gl.STATIC_DRAW);
    this.waterVao = gl.createVertexArray(); gl.bindVertexArray(this.waterVao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.bindVertexArray(null);
  }
  Renderer.prototype.build = function (mb) {
    var gl = this.gl, v = new Float32Array(mb.v), m = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: v.length / 9 };
    gl.bindVertexArray(m.vao); gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    for (var i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, i * 12); }
    gl.bindVertexArray(null); return m;
  };
  Renderer.prototype.freeMesh = function (m) { if (!m) return; this.gl.deleteBuffer(m.vbo); this.gl.deleteVertexArray(m.vao); };
  Renderer.prototype.tex = function (canvas) {
    var gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  Renderer.prototype.retex = function (t, canvas) { var gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); };
  Renderer.prototype.resize = function (w, h, dpr) {
    var c = this.canvas; c.width = Math.max(2, Math.round(w * dpr)); c.height = Math.max(2, Math.round(h * dpr)); c.style.width = w + 'px'; c.style.height = h + 'px'; this.w = c.width; this.h = c.height;
  };
  function collect(n, out, cast) {
    if (!n.visible) return;
    if (n.mesh) { out.push(n); if (n.cast) cast.push(n); }
    for (var i = 0; i < n.children.length; i++) collect(n.children[i], out, cast);
  }
  function bind3(gl, loc, v) { gl.uniform3f(loc, v[0], v[1], v[2]); }

  Renderer.prototype.render = function (root, cam, dt) {
    if (this.lost) return;
    var gl = this.gl, e = this.env; this.t += dt || 0;
    root.update(null); cam.update(this.w / this.h);
    var draws = this.draws, casters = this.casters; draws.length = 0; casters.length = 0; collect(root, draws, casters);
    var useSh = this.shadows;
    if (useSh) {
      // свет: ортографическая проекция вокруг центра игрового мира
      var R = e.shRadius, c = e.shCenter, ld = e.ld, eye = [c[0] + ld[0] * 60, c[1] + ld[1] * 60, c[2] + ld[2] * 60];
      M.look(this.lview, eye, c, [0, 1, 0]); M.ortho(this.lproj, -R, R, -R, R, 1, 130); M.mul(this.lvp, this.lproj, this.lview);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFb); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      gl.useProgram(this.depth.p); gl.uniformMatrix4fv(this.depth.u.uLVP, false, this.lvp);
      for (var i = 0; i < casters.length; i++) { var n = casters[i]; if (n.alpha < 0.5) continue; gl.uniformMatrix4fv(this.depth.u.uM, false, n.m); gl.bindVertexArray(n.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, n.mesh.n); }
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, this.w, this.h); gl.clearColor(e.fog[0], e.fog[1], e.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // небо
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this.sky.p); bind3(gl, this.sky.u.uTop, e.top); bind3(gl, this.sky.u.uMid, e.mid); bind3(gl, this.sky.u.uBot, e.bot);
    gl.bindVertexArray(this.vaoEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    // вода
    gl.useProgram(this.water.p); gl.uniformMatrix4fv(this.water.u.uVP, false, cam.vp); bind3(gl, this.water.u.uCam, cam.pos); bind3(gl, this.water.u.uFog, e.fog);
    bind3(gl, this.water.u.uA, e.waterA); bind3(gl, this.water.u.uB, e.waterB); gl.uniform1f(this.water.u.uT, this.t); gl.uniform1f(this.water.u.uFogN, e.fogN); gl.uniform1f(this.water.u.uFogF, e.fogF);
    gl.bindVertexArray(this.waterVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    // сцена
    var u = this.main.u; gl.useProgram(this.main.p);
    gl.uniformMatrix4fv(u.uVP, false, cam.vp); gl.uniformMatrix4fv(u.uLVP, false, this.lvp);
    bind3(gl, u.uLd, e.ld); bind3(gl, u.uSun, e.sun); bind3(gl, u.uSky, e.sky); bind3(gl, u.uGnd, e.gnd); bind3(gl, u.uFog, e.fog); bind3(gl, u.uCam, cam.pos);
    gl.uniform1f(u.uShOn, useSh ? 1 : 0); gl.uniform1f(u.uTexel, 1 / this.shadowSize); gl.uniform1f(u.uFogN, e.fogN); gl.uniform1f(u.uFogF, e.fogF);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(u.uSh, 0);
    var opaque = [], trans = [];
    for (var j = 0; j < draws.length; j++) (draws[j].alpha < 0.99 ? trans : opaque).push(draws[j]);
    var self = this;
    function drawList(list) {
      for (var k = 0; k < list.length; k++) {
        var n = list[k], t = n.tint;
        gl.uniformMatrix4fv(u.uM, false, n.m);
        if (t) gl.uniform4f(u.uTint, t[0], t[1], t[2], t[3]); else gl.uniform4f(u.uTint, 0, 0, 0, 0);
        gl.uniform1f(u.uEmit, n.emit || 0); gl.uniform1f(u.uAlpha, n.alpha);
        gl.bindVertexArray(n.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, n.mesh.n);
      }
    }
    drawList(opaque);
    if (trans.length) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); drawList(trans); gl.depthMask(true); }
    // спрайты (пузыри, текст, частицы)
    var sp = this.sprites;
    if (sp.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      var b = this.bb; gl.useProgram(b.p); gl.uniformMatrix4fv(b.u.uVP, false, cam.vp); bind3(gl, b.u.uR, cam.right); bind3(gl, b.u.uU, cam.up);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(b.u.uTex, 0); gl.bindVertexArray(this.vaoEmpty);
      var last = null;
      for (var s = 0; s < sp.length; s++) {
        var q = sp[s]; if (q.a <= 0.01) continue;
        if (q.tex !== last) { gl.bindTexture(gl.TEXTURE_2D, q.tex); last = q.tex; }
        gl.uniform3f(b.u.uC, q.x, q.y, q.z); gl.uniform2f(b.u.uS, q.w, q.h); gl.uniform4f(b.u.uUV, q.u[0], q.u[1], q.u[2], q.u[3]); gl.uniform4f(b.u.uTint, q.c[0], q.c[1], q.c[2], q.a);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.depthMask(true);
    }
    gl.disable(gl.BLEND); gl.bindVertexArray(null);
  };
  Renderer.prototype.dispose = function () {
    var gl = this.gl; try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { }
  };
  Renderer.supported = function () { try { var c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; } };

  W.G3D = { M: M, MB: MB, Node: Node, Cam: Cam, Renderer: Renderer, col: col };
})(window);
