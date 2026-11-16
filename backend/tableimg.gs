/* ====================== Таблица картинкой (для «Моих заказов») ======================
   Apps Script не умеет рисовать, поэтому таблица собирается здесь вручную: буквы берём из готового шрифта
   (font_atlas.gs), складываем в картинку и пакуем в PNG. Голубая шапка, белые ячейки, тонкий чёрный контур.
   Вокруг таблицы оставлено белое поле, чтобы рамка была целой со всех четырёх сторон. */
var FONT_IDX_ = null;
function fontInit_() {
  if (FONT_IDX_) return FONT_IDX_;
  var raw = Utilities.base64Decode(FONT_.data), off = [], pos = 0, map = {};
  for (var i = 0; i < FONT_.chars.length; i++) { off[i] = pos; pos += FONT_.w[i] * FONT_.H / 2; map[FONT_.chars.charAt(i)] = i; }
  FONT_IDX_ = { raw: raw, off: off, map: map };
  return FONT_IDX_;
}
function glyphIdx_(ch) { var m = fontInit_().map; return m[ch] != null ? m[ch] : m[' ']; }
function textW_(s, bold) { var w = 0; for (var i = 0; i < s.length; i++) w += FONT_.adv[glyphIdx_(s.charAt(i))]; return w + (bold ? 2 : 0); }
function drawGlyph_(img, W, Hh, gx, gy, gi, rgb) {
  var F = fontInit_(), w = FONT_.w[gi], base = F.off[gi], raw = F.raw;
  for (var y = 0; y < FONT_.H; y++) {
    var py = gy + y; if (py < 0 || py >= Hh) continue;
    for (var x = 0; x < w; x++) {
      var p = y * w + x, b = raw[base + (p >> 1)] & 255, a = (p & 1) ? (b & 15) : (b >> 4);
      if (!a) continue;
      var px = gx + x; if (px < 0 || px >= W) continue;
      var o = py * (W * 3 + 1) + 1 + px * 3;
      for (var c = 0; c < 3; c++) img[o + c] = img[o + c] + ((rgb[c] - img[o + c]) * a / 15) | 0;
    }
  }
}
function drawText_(img, W, Hh, x, y, s, bold, rgb) {
  for (var i = 0; i < s.length; i++) {
    var gi = glyphIdx_(s.charAt(i)), gx = x + i * 0; /* позиция считается ниже */
    drawGlyph_(img, W, Hh, x - 3, y, gi, rgb);
    if (bold) drawGlyph_(img, W, Hh, x - 3 + 2, y, gi, rgb);
    x += FONT_.adv[gi];
  }
}
function fillRect_(img, W, Hh, x0, y0, x1, y1, rgb) {
  var stride = W * 3 + 1;
  for (var y = Math.max(0, y0); y < Math.min(Hh, y1); y++) for (var x = Math.max(0, x0); x < Math.min(W, x1); x++) { var o = y * stride + 1 + x * 3; img[o] = rgb[0]; img[o + 1] = rgb[1]; img[o + 2] = rgb[2]; }
}
var CRC_T_ = null;
function crc32_(arr, start, end, crc) {
  if (!CRC_T_) { CRC_T_ = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC_T_[n] = c >>> 0; } }
  var c2 = crc == null ? 0xFFFFFFFF : crc;
  for (var i = start; i < end; i++) c2 = CRC_T_[(c2 ^ arr[i]) & 255] ^ (c2 >>> 8);
  return (c2 ^ 0xFFFFFFFF) >>> 0;
}
function be32_(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
function signed_(u8) { var out = new Array(u8.length); for (var i = 0; i < u8.length; i++) out[i] = u8[i] > 127 ? u8[i] - 256 : u8[i]; return out; }
function adler32_(arr) { var a = 1, b = 0, n = arr.length, i = 0; while (n > 0) { var t = Math.min(n, 5552); n -= t; while (t--) { a += arr[i++]; b += a; } a %= 65521; b %= 65521; } return ((b << 16) | a) >>> 0; }
/* zlib-поток: сжимаем gzip-ом Google и достаём из него deflate; если формат неожиданный, пишем без сжатия */
function zlib_(raw) {
  var out = [0x78, 0x9c], done = false;
  try {
    var gz = Utilities.gzip(Utilities.newBlob(signed_(raw), 'application/octet-stream', 'x')).getBytes();
    if ((gz[0] & 255) === 0x1f && (gz[1] & 255) === 0x8b && gz[3] === 0) {
      for (var i = 10; i < gz.length - 8; i++) out.push(gz[i] & 255);
      done = true;
    }
  } catch (e) { done = false; }
  if (!done) {
    out = [0x78, 0x01];
    for (var p = 0; p < raw.length; p += 65535) {
      var len = Math.min(65535, raw.length - p), last = p + len >= raw.length ? 1 : 0;
      out.push(last, len & 255, len >> 8, (~len) & 255, ((~len) >> 8) & 255);
      for (var j = 0; j < len; j++) out.push(raw[p + j]);
    }
  }
  return out.concat(be32_(adler32_(raw)));
}
function pngChunk_(type, data) {
  var t = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], td = t.concat(data);
  return be32_(data.length).concat(td, be32_(crc32_(td, 0, td.length)));
}
function pngBlob_(img, W, Hh, name) {
  var png = [137, 80, 78, 71, 13, 10, 26, 10].concat(pngChunk_('IHDR', be32_(W).concat(be32_(Hh), [8, 2, 0, 0, 0])), pngChunk_('IDAT', zlib_(img)), pngChunk_('IEND', []));
  return Utilities.newBlob(signed_(png), 'image/png', name || 'table.png');
}
/* head: ['Заказ', ...], rows: [[...], ...]. Возвращает PNG-файл. */
function tableRaw_(head, rows) {
  var PADX = 26, ROWH = 84, M = 18, B = 4, cols = head.length, colW = [], sumW = 0, i, j;
  for (j = 0; j < cols; j++) { var mw = textW_(head[j], true); rows.forEach(function (r) { mw = Math.max(mw, textW_(String(r[j] == null ? '' : r[j]), false)); }); colW[j] = mw + PADX * 2; sumW += colW[j]; }
  var nR = rows.length + 1, W = M * 2 + sumW + B, Hh = M * 2 + nR * ROWH + B, img = new Uint8Array((W * 3 + 1) * Hh);
  for (i = 0; i < Hh; i++) { var o0 = i * (W * 3 + 1); img[o0] = 0; for (var k = 1; k <= W * 3; k++) img[o0 + k] = 255; }
  fillRect_(img, W, Hh, M, M, M + sumW + B, M + ROWH, [191, 227, 251]);
  var ink = [0, 0, 0], x = M, y;
  for (j = 0; j < cols; j++) { drawText_(img, W, Hh, x + PADX + B, M + B + (ROWH - FONT_.H) / 2 | 0, head[j], true, ink); x += colW[j]; }
  rows.forEach(function (r, ri) {
    var xx = M, yy = M + (ri + 1) * ROWH + B;
    for (var c = 0; c < cols; c++) { drawText_(img, W, Hh, xx + PADX + B, yy + (ROWH - FONT_.H) / 2 | 0, String(r[c] == null ? '' : r[c]), false, ink); xx += colW[c]; }
  });
  x = M; for (j = 0; j <= cols; j++) { fillRect_(img, W, Hh, x, M, x + B, M + nR * ROWH + B, ink); if (j < cols) x += colW[j]; }
  for (i = 0; i <= nR; i++) fillRect_(img, W, Hh, M, M + i * ROWH, M + sumW + B, M + i * ROWH + B, ink);
  return { img: img, W: W, H: Hh };
}
function tableImage_(head, rows) { var t = tableRaw_(head, rows); return pngBlob_(t.img, t.W, t.H, 'orders.png'); }
/* отправка картинки файлом; подпись стоит над картинкой */
function tgPhotoBlob_(chat, blob, caption, kb) {
  try {
    var p = { chat_id: String(chat), photo: blob, caption: String(caption || '').slice(0, 1000), parse_mode: 'HTML', show_caption_above_media: 'true' };
    if (kb) p.reply_markup = JSON.stringify(Array.isArray(kb) ? { inline_keyboard: kb } : kb);
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + props_().getProperty('BOT_TOKEN') + '/sendPhoto', { method: 'post', muteHttpExceptions: true, payload: p });
    return JSON.parse(r.getContentText());
  } catch (e) { console.warn('photo blob: ' + e); return null; }
}
