/* Генератор рамок аватара (39 штук из docs/frames-gallery.html).
   Запуск из корня проекта: node scripts/make_frames.js
   Берёт код рамок из галереи, пишет assets/fr/<id>.svg (под аватаром), <id>t.svg (поверх аватара), <id>s.svg и <id>ts.svg (без движения,
   для prefers-reduced-motion) и обновляет блок стилей между «frames:begin» и «frames:end» в assets/style.css.
   Рамка рисуется в viewBox 120x120, аватар радиус 34 в центре. Шрифт для надписей системный (картинка не видит шрифтов страницы). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs', 'frames-gallery.html'), 'utf8');
const a = html.indexOf('<script>') + 8, b = html.indexOf('/* ===== сборка страницы ===== */');
const mod = new Function(html.slice(a, b).replace(/^\s*\(function\(\)\{/, '') + ';return {F:F,Builder:Builder};')();
const NUM = [5, 8, 15, 17, 21, 24, 27, 35, 36, 37, 38, 39, 46, 48, 52, 53, 55, 57, 63, 65, 69, 80, 81, 83, 84, 85, 87, 89, 90, 91, 94, 95, 96, 97, 98, 99, 101, 104, 105];
const LEVEL = { 35: 'lvl-bronze', 36: 'lvl-silver', 37: 'lvl-gold', 38: 'lvl-platinum', 39: 'lvl-diamond' };
const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
const ANIM_CSS = 'svg .spin,svg .spinr,svg .pulse,svg .tw,svg .flick,svg .wob{transform-box:view-box;transform-origin:50% 50%}' +
  '.spin{animation:spin 14s linear infinite}.spinr{animation:spin 18s linear infinite reverse}.spin2{animation:spin 6s linear infinite}' +
  '.pulse{animation:pulse 2.4s ease-in-out infinite}.tw{animation:tw 2.2s ease-in-out infinite}.tw2{animation:tw 2.2s ease-in-out -1.1s infinite}' +
  '.flick{animation:flick .9s ease-in-out infinite alternate}.flick2{animation:flick .7s ease-in-out -.3s infinite alternate}.wob{animation:wob 5s ease-in-out infinite alternate}' +
  '@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}@keyframes tw{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}' +
  '@keyframes flick{from{opacity:.55}to{opacity:1}}@keyframes wob{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
const outDir = path.join(root, 'assets', 'fr'); fs.mkdirSync(outDir, { recursive: true });
fs.readdirSync(outDir).forEach(f => fs.unlinkSync(path.join(outDir, f)));
const V = 3;   // версия в ссылках на картинки (сбрасывает кэш браузера)
// в исходниках галереи бывают незакрытые теги (HTML-парсер их чинит сам, а SVG как картинка нет): закрываем недостающие
function balance(s) {
  const stack = [], re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g; let m;
  while ((m = re.exec(s))) { if (m[4]) continue; if (m[1]) { const i = stack.lastIndexOf(m[2]); if (i >= 0) stack.length = i; } else stack.push(m[2]); }
  return s + stack.reverse().map(t => '</' + t + '>').join('');
}
function svgDoc(defs, body, anim) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' + (defs ? '<defs>' + defs + '</defs>' : '') + (anim ? '<style>' + ANIM_CSS + '</style>' : '') + body + '</svg>'; }
const list = [], css = [], reduce = [];
NUM.forEach(n => {
  const it = mod.F[n - 1], id = LEVEL[n] || 'f' + n, bld = new mod.Builder('u' + n + '_'), out = it.fn(bld);
  let back = Array.isArray(out) ? out[0] : out, top = Array.isArray(out) ? (out[1] || '') : '';
  const fix = s => s.replace(/font-family="[^"]*"/g, 'font-family="' + FONT + '"');
  back = balance(fix(back)); top = balance(fix(top));
  const defs = bld.defs.join(''), anim = /class="/.test(back + top);
  fs.writeFileSync(path.join(outDir, id + '.svg'), svgDoc(defs, back, anim));
  if (top) fs.writeFileSync(path.join(outDir, id + 't.svg'), svgDoc(defs, top, anim));
  if (anim) { fs.writeFileSync(path.join(outDir, id + 's.svg'), svgDoc(defs, back, false)); if (top) fs.writeFileSync(path.join(outDir, id + 'ts.svg'), svgDoc(defs, top, false)); }
  css.push('.ava.f-' + id + '{--fr:url(fr/' + id + '.svg?v=' + V + ')' + (top ? ';--fx:url(fr/' + id + 't.svg?v=' + V + ')' : '') + '}');
  if (anim) reduce.push('.ava.f-' + id + '{--fr:url(fr/' + id + 's.svg?v=' + V + ')' + (top ? ';--fx:url(fr/' + id + 'ts.svg?v=' + V + ')' : '') + '}');
  list.push({ id: id, n: n, name: it.n, anim: anim, top: !!top });
});
const block = '/* frames:begin (scripts/make_frames.js, рамки из docs/frames-gallery.html). Слой ::before под аватаром, ::after поверх */\n' +
  '.ava.fx{box-shadow:none}\n' +
  '.ava.fx::before,.ava.fx::after{content:"";position:absolute;inset:-38.2%;background:var(--fr) center/100% 100% no-repeat;pointer-events:none;-webkit-mask:none;mask:none;border:0;border-radius:0;filter:none;transform:none;z-index:0}\n' +
  '.ava.fx::after{background-image:var(--fx,none);z-index:2}\n' +
  '.ava .ini{font-weight:inherit}\n' +
  '.ava.fx{background:none}\n' +
  '.ava.fx>.ini,.ava.fx>img{position:relative;z-index:1;width:100%;height:100%;border-radius:50%;display:grid;place-items:center;box-sizing:border-box}\n' +
  '.ava.fx>.ini{background:linear-gradient(140deg,#2b5da0,#173a6b)}\n' +
  css.join('\n') + '\n@media (prefers-reduced-motion:reduce){\n' + reduce.join('\n') + '\n}\n/* frames:end */';
const cp = path.join(root, 'assets', 'style.css'); let s = fs.readFileSync(cp, 'utf8');
if (s.indexOf('/* frames:begin') >= 0) s = s.replace(/\/\* frames:begin[\s\S]*?\/\* frames:end \*\//, () => block);
else { const i = s.indexOf('/* v49: рамки профиля'), j = s.indexOf('/* v49: коллекция рамок по группам */'); if (i < 0 || j < 0) throw new Error('старый блок рамок не найден'); s = s.slice(0, i) + block + '\n' + s.slice(j); }
fs.writeFileSync(cp, s);
fs.writeFileSync(path.join(root, 'assets', 'fr', 'list.json'), JSON.stringify(list));
console.log('рамок', list.length, 'файлов', fs.readdirSync(outDir).length, 'с движением', list.filter(x => x.anim).length);
list.forEach(x => console.log(x.n, x.id, x.name));
