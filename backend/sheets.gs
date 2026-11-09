/* Запустить один раз (кнопка «Выполнить»), чтобы разрешить отправку писем с кодами. */
function allowMail() { Logger.log('Можно отправить писем сегодня: ' + MailApp.getRemainingDailyQuota()); }

/* ===================================================================
   ONION SHOP: сервер на Google Таблице (Google Apps Script)
   Хранит аккаунты, ониксы и заказы, даёт номера заказов по порядку,
   крутит рулетку на сервере, проверяет промокоды и присылает заказы в Telegram.
   Настройка: в файле «Google-Таблица и бот.md». Код ниже трогать не нужно.
   =================================================================== */

var CATALOG_URL_DEFAULT = 'https://onion-shop.github.io/ONION-SHOP-CATALOG/data/catalog.js';
var LAYOUT_VER = '14';

var SHEET = { orders: 'Заказы', users: 'Клиенты', promos: 'Промокоды', log: 'Журнал ониксов', summary: 'Сводка', sessions: 'Сессии', reviews: 'Отзывы', waits: 'Лист ожидания', ledger: 'Учёт бонусов', flags: 'Подозрительное' };

/* Сохранения игр: строка JSON режется на куски по 45 000 знаков (лимит ячейки 50 000). */
/* Колонки: [ключ, заголовок, опции]. Опции: w: ширина, t, тип (text, money, date, check, num),
   edit: можно править вручную (светлый фон), svc, служебная (серая, свёрнута). old: прежние названия. */
var ORDER_COLS = [
  ['no', '№ заказа', { w: 110, t: 'text' }],
  ['status', 'Статус', { w: 120, t: 'status', edit: true }],
  ['paid', 'Оплачен', { w: 70, t: 'check', edit: true }],
  ['toPay', 'К оплате', { w: 95, t: 'money', old: ['К оплате, ₽'] }],
  ['name', 'Имя', { w: 120 }],
  ['contact', 'Связаться', { w: 100 }],
  ['itemsText', 'Товары', { w: 300 }],
  ['at', 'Дата (МСК)', { w: 120, t: 'date' }],
  ['count', 'Шт.', { w: 45, t: 'num' }],
  ['priority', 'Приоритет', { w: 105, t: 'text' }],
  ['phone', 'Телефон', { w: 130, t: 'text' }],
  ['tg', 'Telegram', { w: 120, t: 'text' }],
  ['kind', 'Тип', { w: 95 }],
  ['comment', 'Комментарий', { w: 180 }],
  ['note', 'Заметка (для себя)', { w: 180, edit: true }],
  ['photoRep', 'Фотоотчёт (ссылки)', { w: 180, t: 'text', edit: true }],
  ['total', 'Сумма', { w: 90, t: 'money', old: ['Сумма, ₽'] }],
  ['tokens', 'Ониксов', { w: 75, t: 'num', old: ['Ониксов списано'] }],
  ['tokenRub', 'Скидка ониксами', { w: 95, t: 'money', old: ['Скидка ониксами, ₽'] }],
  ['promo', 'Промокод', { w: 95, t: 'text' }],
  ['promoRub', 'Скидка промокодом', { w: 95, t: 'money', old: ['Скидка промокодом, ₽'] }],
  ['pack', 'Привилегия уровня', { w: 170, t: 'text' }],
  ['level', 'Уровень клиента', { w: 100, t: 'text' }],
  ['login', 'Логин', { w: 100, t: 'text' }],
  ['userId', 'ID клиента', { w: 80, t: 'text' }],
  ['text', 'Текст заказа', { w: 120, svc: true }],
  ['items', 'служебное: товары', { w: 80, svc: true }],
  ['xpDone', 'служебное: в уровне (месяц)', { w: 80, svc: true, t: 'text' }],
  ['refunded', 'служебное: ониксы возвращены', { w: 80, svc: true, t: 'text', old: ['служебное: токены возвращены'] }],
  ['notified', 'служебное: статус отправлен в Telegram', { w: 80, svc: true, t: 'text' }],
  ['remind', 'служебное: напоминания клиенту', { w: 80, svc: true, t: 'text' }],
  ['taskRew', 'служебное: награды за задания', { w: 80, svc: true, t: 'text' }],
  ['photoSent', 'служебное: фотоотчёт отправлен', { w: 80, svc: true, t: 'text' }]
];
/* колонки, которые по умолчанию свёрнуты в группу «+» (раскрываются значком над таблицей) */
var ORDER_GROUPS = [['total', 'tokens', 'tokenRub', 'promo', 'promoRub', 'pack', 'level', 'login', 'userId']];
var USER_GROUPS = [['levelFix', 'streak', 'frame', 'referredBy', 'refCount', 'refCode']];/* «Учёт бонусов»: только хэши (не телефоны и не почты), кто уже получал приветственные бонусы и подарок на ДР */
var FLAG_COLS = [['at', 'Когда', { w: 125, t: 'date' }], ['level', 'Уровень', { w: 70, t: 'num' }], ['kind', 'Тип', { w: 90, t: 'text' }], ['text', 'Что случилось', { w: 420 }]];
var LEDGER_COLS = [['key', 'Хэш', { w: 260, t: 'text' }], ['kind', 'Что получено', { w: 120, t: 'text' }], ['at', 'Когда', { w: 125, t: 'date' }], ['note', 'Примечание', { w: 200 }]];
var USER_COLS = [
  ['id', 'ID', { w: 50, t: 'text' }],
  ['login', 'Логин', { w: 100, t: 'text' }],
  ['name', 'Имя', { w: 120, t: 'text', edit: true }],
  ['levelName', 'Уровень', { w: 100, t: 'text', edit: true, old: ['Уровень (месяц)'] }],
  ['balance', 'Ониксы', { w: 75, t: 'num', edit: true, old: ['Токены'] }],
  ['xp', 'XP за месяц', { w: 90, t: 'num', edit: true, old: ['Покупки за месяц'] }],
  ['spent', 'Потрачено всего', { w: 105, t: 'money', old: ['Потрачено всего, ₽'] }],
  ['ordersCount', 'Заказов', { w: 70, t: 'num' }],
  ['tg', 'Telegram', { w: 120, t: 'text', edit: true }],
  ['phone', 'Телефон', { w: 130, t: 'text', edit: true }],
  ['email', 'Почта', { w: 170, t: 'text', edit: true }],
  ['lastCheckin', 'Последний вход', { w: 105, t: 'text' }],
  ['createdAt', 'Регистрация', { w: 120, t: 'date' }],
  ['birthday', 'День рождения (ММ-ДД)', { w: 110, t: 'text', edit: true }],
  ['levelFix', 'Уровень вручную', { w: 130, t: 'text', edit: true }],
  ['streak', 'Серия входов', { w: 85, t: 'num' }],
  ['frame', 'Рамка', { w: 80, t: 'text', edit: true }],
  ['referredBy', 'Пригласил (ID)', { w: 95, t: 'text' }],
  ['refCount', 'Друзей привёл', { w: 90, t: 'num' }],
  ['refCode', 'Код приглашения', { w: 110, t: 'text' }],  ['xpMonth', 'служебное: месяц XP', { svc: true, t: 'text', old: ['Месяц XP', 'служебное: месяц покупок'] }],
  ['freeSpins', 'служебное: бесплатные прокруты', { svc: true, t: 'num', old: ['Бесплатные прокруты'] }],
  ['refMonth', 'служебное: мес. друзей', { svc: true, t: 'text', old: ['Мес. друзей'] }],
  ['refMonthCount', 'служебное: друзей в месяце', { svc: true, t: 'num', old: ['Друзей в месяце'] }],
  ['refRewarded', 'служебное: бонус другу выдан', { svc: true, t: 'text', old: ['Бонус другу выдан'] }],
  ['bdayYear', 'служебное: ДР начислен (год)', { svc: true, t: 'text', old: ['ДР начислен (год)'] }],
  ['perkSpinMonth', 'служебное: прокрут Профи', { svc: true, t: 'text', old: ['Прокрут Профи (мес.)'] }],
  ['perkIconMonth', 'служебное: промокоды Иконы', { svc: true, t: 'text', old: ['Промокоды Иконы (мес.)'] }],
  ['phoneKey', 'служебное: телефон (цифры)', { svc: true, t: 'text', old: ['Телефон (цифры)'] }],
  ['tgKey', 'служебное: Telegram (ключ)', { svc: true, t: 'text', old: ['Telegram (ключ)'] }],
  ['emailKey', 'служебное: почта (ключ)', { svc: true, t: 'text' }],
  ['salt', 'служебное: соль', { svc: true, t: 'text' }],
  ['hash', 'служебное: пароль', { svc: true, t: 'text' }],
  ['tasks', 'служебное: задания', { svc: true, t: 'text' }],
  ['promos', 'служебное: промокоды', { svc: true, t: 'text' }],
  ['frames', 'служебное: рамки', { svc: true, t: 'text' }],
  ['avatar', 'служебное: аватар', { svc: true, t: 'text' }],
  ['state', 'служебное: привилегии', { svc: true, t: 'text' }]
];
/* в колонке «служебное: привилегии» хранится JSON с этими полями клиента */
var STATE_KEYS = ['spinDay', 'daySpins', 'daySpinsMax', 'perkDiaMonth', 'perkDiaN', 'perkDiaAt', 'packMonth', 'frameAnim', 'cnRecv', 'tgChat', 'tgName', 'tgCats', 'phoneOk', 'bonusDone', 'emailCanon', 'achv', 'watch', 'recvTotal', 'bdayOpen', 'gm', 'city', 'lastPush', 'lastNudge'];
var JSON_COLS = { tasks: 1, promos: 1, frames: 1 };
var PROMO_COLS = [
  ['code', 'Промокод', { w: 130, t: 'text', edit: true }],
  ['pct', 'Скидка, %', { w: 85, t: 'num', edit: true }],
  ['until', 'Действует до (включительно)', { w: 150, t: 'day', edit: true }],
  ['active', 'Включён', { w: 75, t: 'check', edit: true }],
  ['withTokens', 'Можно с ониксами', { w: 110, t: 'check', edit: true, old: ['Можно с токенами'] }],
  ['once', 'Один раз на клиента', { w: 120, t: 'check', edit: true }],
  ['limit', 'Лимит всего (пусто: без лимита)', { w: 150, t: 'num', edit: true }],
  ['used', 'Использовано', { w: 100 }],
  ['note', 'Комментарий', { w: 240, edit: true }]
];
var LOG_COLS = [
  ['at', 'Дата (МСК)', { w: 125, t: 'date' }], ['userId', 'ID клиента', { w: 80, t: 'text' }], ['login', 'Логин', { w: 110, t: 'text' }],
  ['delta', 'Изменение', { w: 90, t: 'num' }], ['reason', 'Причина', { w: 320 }], ['balance', 'Баланс после', { w: 100, t: 'num' }]
];
var REVIEW_COLS = [
  ['at', 'Дата (МСК)', { w: 125, t: 'date' }], ['no', '№ заказа', { w: 110, t: 'text' }], ['title', 'Товар', { w: 260 }],
  ['rating', 'Оценка', { w: 70, t: 'num' }], ['text', 'Отзыв', { w: 380 }],
  ['status', 'Показывать на сайте', { w: 140, t: 'text', edit: true }],
  ['name', 'Имя', { w: 100 }], ['login', 'Логин', { w: 100, t: 'text' }], ['userId', 'ID клиента', { w: 80, t: 'text' }],
  ['reward', 'Ониксов выдано', { w: 90, t: 'num', old: ['Токенов выдано'] }], ['productId', 'служебное: id товара', { w: 80, svc: true, t: 'text' }]
];
var WAIT_COLS = [
  ['at', 'Дата (МСК)', { w: 125, t: 'date' }], ['title', 'Товар', { w: 320 }], ['login', 'Логин', { w: 110, t: 'text' }], ['userId', 'ID клиента', { w: 80, t: 'text' }],
  ['sent', 'Сообщили, что появился', { w: 150, t: 'text' }], ['productId', 'служебное: id товара', { w: 80, svc: true, t: 'text' }]
];
var SESSION_COLS = [['token', 'Сессия', { t: 'text' }], ['userId', 'ID клиента', { t: 'text' }], ['exp', 'Действует до', { t: 'text' }]];

var C = { navy: '#0b1b4d', navy2: '#13296b', cyan: '#22d3ee', blue: '#3b82f6', edit: '#f3f8ff', svc: '#9aa3b2', line: '#e6eaf2', paid: '#e3eefb', sent: '#e5efff' };

function ss_() { return SpreadsheetApp.getActive(); }
function ALL_STAGES_() { return OnionCore.RULES.stagesPre.concat(['Отменён']); }
var STAGE_COLORS = { 'Оформлен': ['#eef2f7', '#3a4b63'], 'Выкуплен': ['#e5edfb', '#1d4fb8'], 'В пути': ['#e5edfb', '#1d4fb8'], 'На складе': ['#e5edfb', '#1d4fb8'], 'Едет к нам': ['#dff1f8', '#0a76a8'], 'Едет к вам': ['#dff1f8', '#0a76a8'], 'Получен': ['#173b8f', '#ffffff'], 'Отменён': ['#fbe9eb', '#b42318'] };
function props_() { return PropertiesService.getScriptProperties(); }
function mskText_(ms) { return Utilities.formatDate(new Date(ms), 'Europe/Moscow', 'dd.MM.yyyy HH:mm'); }
function colL_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function ci_(cols, key) { for (var i = 0; i < cols.length; i++) if (cols[i][0] === key) return i; return -1; }
/* Формулы пишутся в английском виде (через запятую). В таблицах с русскими настройками
   разделитель аргументов: точка с запятой, поэтому переводим запятые вне кавычек. */
var LOCALE_SEMI_ = null;
function F_(f) {
  if (LOCALE_SEMI_ === null) { var loc = String(ss_().getSpreadsheetLocale() || ''); LOCALE_SEMI_ = !/^(en|ja|zh|ko|th|he|iw|hi)/i.test(loc); }
  if (!LOCALE_SEMI_) return f;
  var out = '', q = false;
  for (var i = 0; i < f.length; i++) { var ch = f.charAt(i); if (ch === '"') q = !q; out += (!q && ch === ',') ? ';' : ch; }
  return out;
}
function siteBase_() { return String(props_().getProperty('CATALOG_URL') || CATALOG_URL_DEFAULT).replace(/data\/catalog\.js.*$/, ''); }

function renameLegacy_(name) {
  var OLD = { 'Журнал ониксов': 'Журнал токенов' }; // прежнее имя листа
  if (OLD[name] && !ss_().getSheetByName(name)) { var o = ss_().getSheetByName(OLD[name]); if (o) o.setName(name); }
}
function sheet_(name, cols) {
  renameLegacy_(name);
  var sh = ss_().getSheetByName(name);
  if (!sh) { sh = ss_().insertSheet(name); writeHeader_(sh, cols); }
  return sh;
}
function writeHeader_(sh, cols) {
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]);
}

/* ---------- перенос данных при смене колонок (по названиям заголовков) ---------- */
function migrate_(name, cols) {
  renameLegacy_(name);
  var sh = ss_().getSheetByName(name);
  if (!sh) return sheet_(name, cols);
  var lastC = Math.max(sh.getLastColumn(), 1), lastR = sh.getLastRow();
  var head = sh.getRange(1, 1, 1, lastC).getValues()[0].map(String);
  var same = head.length >= cols.length && cols.every(function (c, i) { return head[i] === c[1]; });
  if (same) return sh;
  var data = lastR > 1 ? sh.getRange(2, 1, lastR - 1, lastC).getValues() : [];
  var formulas = lastR > 1 ? sh.getRange(2, 1, lastR - 1, lastC).getFormulas() : [];
  var map = cols.map(function (c) {
    var names = [c[1]].concat((c[2] && c[2].old) || []);
    for (var i = 0; i < names.length; i++) { var j = head.indexOf(names[i]); if (j >= 0) return j; }
    return -1;
  });
  var rows = data.map(function (r, ri) {
    return cols.map(function (c, k) { var j = map[k]; if (j < 0) return c[2] && c[2].t === 'check' ? false : ''; return formulas[ri][j] || r[j]; });
  });
  if (data.length) { // резервная копия листа перед перестройкой (скрытый лист «… (резерв дата)»)
    try { var bk = sh.copyTo(ss_()); bk.setName(name + ' (резерв ' + Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM HH:mm:ss') + ')'); bk.hideSheet(); } catch (e) { }
  }
  sh.clear(); sh.clearConditionalFormatRules();
  // старые списки и галочки привязаны к прежним колонкам: без очистки они мешали бы записи данных после перестановки
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations().clearNote();
  sh.getBandings().forEach(function (b) { b.remove(); });
  writeHeader_(sh, cols);
  if (rows.length) sh.getRange(2, 1, rows.length, cols.length).setValues(rows);
  return sh;
}

/* ---------- оформление ---------- */
function style_(sh, cols, opt) {
  opt = opt || {};
  var n = cols.length, maxR = sh.getMaxRows();
  if (maxR < 500) { sh.insertRowsAfter(maxR, 500 - maxR); maxR = 500; }
  if (sh.getMaxColumns() > n) sh.deleteColumns(n + 1, sh.getMaxColumns() - n);
  sh.setHiddenGridlines(true);
  sh.setFrozenRows(1);
  if (opt.freezeCols) sh.setFrozenColumns(opt.freezeCols);
  var body = sh.getRange(2, 1, maxR - 1, n);
  body.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setFontColor('#1b2333');
  sh.getBandings().forEach(function (b) { b.remove(); });
  var band = sh.getRange(1, 1, maxR, n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  band.setHeaderRowColor(C.navy).setFirstRowColor('#ffffff').setSecondRowColor('#f7f9fc');
  var head = sh.getRange(1, 1, 1, n);
  head.setFontColor('#ffffff').setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
    .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
  sh.setRowHeight(1, 40);
  cols.forEach(function (c, i) {
    var o = c[2] || {}, col = sh.getRange(2, i + 1, maxR - 1, 1);
    if (o.w) sh.setColumnWidth(i + 1, o.w); else if (o.svc) sh.setColumnWidth(i + 1, 80);
    if (o.t === 'text') col.setNumberFormat('@');
    if (o.t === 'money') col.setNumberFormat('#,##0" ₽"').setHorizontalAlignment('right');
    if (o.t === 'num') col.setNumberFormat('0').setHorizontalAlignment('center');
    if (o.t === 'date') col.setNumberFormat('dd.MM.yyyy HH:mm').setHorizontalAlignment('center');
    if (o.t === 'day') col.setNumberFormat('dd.MM.yyyy').setHorizontalAlignment('center')
      .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Дата, например 31.10.2026').build());
    if (o.t === 'check') col.insertCheckboxes().setHorizontalAlignment('center');
    if (o.t === 'status') col.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ALL_STAGES_(), true).setAllowInvalid(false).setHelpText('Статус видит клиент в «Моих заказах»').build()).setHorizontalAlignment('center').setFontWeight('bold');
    if (o.edit) sh.getRange(1, i + 1).setBackground(C.navy2);
    if (o.svc) { col.setFontColor(C.svc).setWrap(false); sh.getRange(1, i + 1).setBackground('#5b6475'); }
  });
  // служебные колонки: в свёрнутую группу и под защиту с предупреждением
  // снять прежние группы колонок (после перестановки колонок они стояли бы не там)
  for (var gc = 1; gc <= n; gc++) { try { for (var gt = 0; gt < 3 && sh.getColumnGroupDepth(gc) > 0; gt++) sh.getRange(1, gc, 1, 1).shiftColumnGroupDepth(-1); } catch (e) {} }
  // дополнительные свёрнутые группы: редко нужные колонки прячутся за значок «+»
  (opt.groups || []).forEach(function (keys) {
    var idx = keys.map(function (k) { return ci_(cols, k) + 1; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    if (!idx.length) return;
    try { var gr = sh.getRange(1, idx[0], 1, idx[idx.length - 1] - idx[0] + 1); gr.shiftColumnGroupDepth(1); sh.getColumnGroup(idx[0], 1).collapse(); } catch (e) {}
  });
  var svc = cols.map(function (c, i) { return c[2] && c[2].svc ? i + 1 : 0; }).filter(Boolean);
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (p.getDescription() === 'ONION: служебное') p.remove(); });
  if (svc.length) {
    var first = svc[0], cnt = svc[svc.length - 1] - first + 1, rng = sh.getRange(1, first, maxR, cnt);
    try { sh.getColumnGroup(first, 1).remove(); } catch (e) {}
    try { rng.shiftColumnGroupDepth(1); sh.getColumnGroup(first, 1).collapse(); } catch (e) {}
    var pr = rng.protect().setDescription('ONION: служебное'); pr.setWarningOnly(true);
  }
  var fixed = cols.map(function (c, i) { return c[2] && !c[2].edit && !c[2].svc ? i + 1 : 0; }).filter(Boolean);
  if (opt.warnFixed) fixed.forEach(function (k) { sh.getRange(1, k, maxR, 1).protect().setDescription('ONION: служебное').setWarningOnly(true); });
  return sh;
}

function styleOrders_() {
  var sh = style_(migrate_(SHEET.orders, ORDER_COLS), ORDER_COLS, { freezeCols: 1, groups: ORDER_GROUPS });
  var maxR = sh.getMaxRows(), L = function (k) { return colL_(ci_(ORDER_COLS, k) + 1); };
  sh.getRange(L('itemsText') + '2:' + L('itemsText')).setWrap(true);
  sh.getRange(L('no') + '2:' + L('no')).setFontWeight('bold');
  sh.getRange(L('toPay') + '2:' + L('toPay')).setFontWeight('bold').setFontColor(C.navy);
  sh.getRange(L('text') + '2:' + L('text')).setWrap(false);
  var all = sh.getRange(2, 1, maxR - 1, ORDER_COLS.length);
  var stCol = sh.getRange(2, ci_(ORDER_COLS, 'status') + 1, maxR - 1, 1);
  var rules = Object.keys(STAGE_COLORS).map(function (k) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(k).setBackground(STAGE_COLORS[k][0]).setFontColor(STAGE_COLORS[k][1]).setRanges([stCol]).build();
  });
  var prCol = sh.getRange(2, ci_(ORDER_COLS, 'priority') + 1, maxR - 1, 1);
  [['№1', '#173b8f', '#ffffff'], ['№2', '#d6e4fb', '#173b8f'], ['№3', '#e8f3fc', '#0a5f8a'], ['№4', '#fff4d6', '#8a5a00']].forEach(function (x) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith(x[0]).setBackground(x[1]).setFontColor(x[2]).setBold(true).setRanges([prCol]).build());
  });
  var rowAll = sh.getRange(2, 1, maxR - 1, ORDER_COLS.length), stL = '$' + L('status') + '2', paL = '$' + L('paid') + '2', atL = '$' + L('at') + '2';
  // отменённые: серые и зачёркнутые, полученные: приглушённые, неоплаченные дольше суток: номер красным
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=' + stL + '="Отменён"').setFontColor('#9aa3b2').setStrikethrough(true).setRanges([rowAll]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=' + stL + '="Получен"').setFontColor('#7c8798').setRanges([rowAll]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(F_('=AND($A2<>"",' + paL + '=FALSE,' + stL + '<>"Отменён",ISNUMBER(' + atL + '),NOW()-' + atL + '>1)')).setBackground('#fde8e8').setFontColor('#b42318').setBold(true).setRanges([sh.getRange(2, 1, maxR - 1, 1)]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=' + paL + '=TRUE').setBackground(C.paid).setRanges([rowAll]).build());
  sh.setConditionalFormatRules(rules);
  // высота 64 только у строк с заказами (чекбоксы «Оплачен» заполняют лист до конца, раньше из-за них все пустые строки были высокими)
  var n = 0, last = sh.getLastRow();
  if (last >= 2) { var nn = sh.getRange(2, 1, last - 1, 1).getValues(); for (var q = nn.length - 1; q >= 0; q--) if (String(nn[q][0]).trim() !== '') { n = q + 1; break; } }
  if (maxR - 1 > n) sh.setRowHeights(2 + n, maxR - 1 - n, 21);
  if (n > 0) {
    sh.setRowHeights(2, n, 64);
    var sr = sh.getRange(2, ci_(ORDER_COLS, 'status') + 1, n, 1), sv = sr.getValues(), nr = sh.getRange(2, 1, n, 1).getValues();
    sr.setValues(sv.map(function (r, i) { return [r[0] || (nr[i][0] ? 'Оформлен' : '')]; }));
  }
  sh.getRange(1, ci_(ORDER_COLS, 'paid') + 1).setNote('Отмечайте, когда клиент оплатил. Строка станет зелёной.');
  sh.getRange(1, ci_(ORDER_COLS, 'status') + 1).setNote('Выберите статус из списка. Клиент сразу увидит его в «Моих заказах». Предзаказ: Оформлен → Выкуплен → В пути → На складе → Едет к нам → Едет к вам → Получен. В наличии: Оформлен → Едет к вам → Получен.');
  sh.getRange(1, ci_(ORDER_COLS, 'priority') + 1).setNote('Очередь обработки: №1 Алмаз, №2 Платина, №3 Золото, №4 платный «Приоритетный заказ» (99 ₽) для остальных, затем обычные. Если у клиента есть уровень с приоритетом, очередь определяет уровень.');
  sh.getRange(1, ci_(ORDER_COLS, 'pack') + 1).setNote('Привилегия уровня на этот заказ: «Упаковка −10%» (Платина, только предзаказ) или «Бесплатная упаковка» (Алмаз). 1 раз в месяц. Если заказ отменён: привилегия вернётся клиенту.');
  sh.getRange(1, ci_(ORDER_COLS, 'contact') + 1).setNote('Ссылка открывает чат с клиентом в Telegram (по username или по номеру телефона).');
}
function styleUsers_() {
  var sh = style_(migrate_(SHEET.users, USER_COLS), USER_COLS, { freezeCols: 2, groups: USER_GROUPS });
  var maxR = sh.getMaxRows(), lv = sh.getRange(2, ci_(USER_COLS, 'levelName') + 1, maxR - 1, 1);
  var rules = [['Алмаз', '#173b8f', '#ffffff'], ['Платина', '#e3e9f2', '#1f2f4d'], ['Золото', '#fbf1d6', '#7a5200'], ['Серебро', '#eef1f5', '#475569'], ['Бронза', '#f7e8dd', '#86461f']];
  sh.setConditionalFormatRules(rules.map(function (r) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextContains(r[0]).setBackground(r[1]).setFontColor(r[2]).setBold(true).setRanges([lv]).build();
  }));
  sh.getRange(2, ci_(USER_COLS, 'balance') + 1, maxR - 1, 1).setFontWeight('bold').setFontColor(C.navy);
  var names = OnionCore.RULES.levels.map(function (l) { return l.name; });
  sh.getRange(2, ci_(USER_COLS, 'levelName') + 1, maxR - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(true).build());
  sh.getRange(2, ci_(USER_COLS, 'levelFix') + 1, maxR - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Авто'].concat(names), true).setAllowInvalid(false).setHelpText('Пусто или «Авто»: уровень по XP. Выберите уровень, чтобы закрепить его вручную.').build());
  sh.getRange(1, ci_(USER_COLS, 'balance') + 1).setNote('Можно менять прямо здесь, клиент сразу увидит новый баланс, а изменение запишется в «Журнал ониксов». Или через меню ONION SHOP → «Начислить или списать ониксы».');
  sh.getRange(1, ci_(USER_COLS, 'levelName') + 1).setNote('Уровень, который видит клиент. Выберите другой из списка, он закрепится (появится в «Уровень вручную»).');
  sh.getRange(1, ci_(USER_COLS, 'levelFix') + 1).setNote('Закреплённый уровень. Очистите ячейку или выберите «Авто», чтобы уровень снова считался по XP.');
  sh.getRange(1, ci_(USER_COLS, 'xp') + 1).setNote('Опыт за этот месяц: 1 XP за каждые 10 ₽ полученного заказа (засчитывается при статусе «Получен»), +5 за вход, +2 за задание, призы рулетки. Уровни: Серебро от 500, Золото от 1500, Платина от 4000, Алмаз от 8000 XP. Можно поправить вручную. 1-го числа обнуляется.');
  sh.getRange(1, ci_(USER_COLS, 'birthday') + 1).setNote('Формат ММ-ДД, например 03-15, это 15 марта.');
}
function styleLog_() {
  var sh = style_(migrate_(SHEET.log, LOG_COLS), LOG_COLS, {});
  var d = sh.getRange(2, ci_(LOG_COLS, 'delta') + 1, sh.getMaxRows() - 1, 1);
  d.setNumberFormat('+0;-0;0').setFontWeight('bold');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setFontColor('#1565c0').setRanges([d]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#b91c1c').setRanges([d]).build()
  ]);
}
function stylePromos_() {
  var fresh = !ss_().getSheetByName(SHEET.promos);
  var sh = style_(migrate_(SHEET.promos, PROMO_COLS), PROMO_COLS, {});
  var oc = colL_(ci_(ORDER_COLS, 'promo') + 1);
  sh.getRange(2, ci_(PROMO_COLS, 'used') + 1).setFormula(F_('=ARRAYFORMULA(IF(A2:A="","",COUNTIF(\'' + SHEET.orders + '\'!' + oc + '2:' + oc + ',UPPER(A2:A))))'));
  sh.getRange(2, ci_(PROMO_COLS, 'used') + 1, sh.getMaxRows() - 1, 1).setHorizontalAlignment('center').setFontColor(C.navy).setFontWeight('bold');
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setFontWeight('bold').setFontColor(C.navy);
  var maxR = sh.getMaxRows(), all = sh.getRange(2, 1, maxR - 1, PROMO_COLS.length), ac = colL_(ci_(PROMO_COLS, 'active') + 1), uc = colL_(ci_(PROMO_COLS, 'until') + 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(F_('=AND($A2<>"",OR($' + ac + '2=FALSE,AND($' + uc + '2<>"",$' + uc + '2<TODAY())))')).setFontColor('#9aa3b2').setStrikethrough(true).setRanges([all]).build()
  ]);
  sh.getRange(1, 1).setNote('Новый промокод: новая строка. Клиент вводит его при оформлении заказа. Большие и маленькие буквы не важны.');
  sh.getRange(1, ci_(PROMO_COLS, 'until') + 1).setNote('Промокод работает до 23:59 по Москве этого дня. Пусто: бессрочно.');
}
function styleSummary_() {
  var sh = ss_().getSheetByName(SHEET.summary) || ss_().insertSheet(SHEET.summary, 0);
  sh.clear(); sh.clearConditionalFormatRules(); sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  if (sh.getMaxColumns() > 5) sh.deleteColumns(6, sh.getMaxColumns() - 5);
  if (sh.getMaxColumns() < 5) sh.insertColumnsAfter(sh.getMaxColumns(), 5 - sh.getMaxColumns());
  if (sh.getMaxRows() < 100) sh.insertRowsAfter(sh.getMaxRows(), 100 - sh.getMaxRows());
  var R_ = function (name, cols, k) { var l = colL_(ci_(cols, k) + 1); return "'" + name + "'!" + l + '2:' + l; };
  var O = function (k) { return R_(SHEET.orders, ORDER_COLS, k); }, U = function (k) { return R_(SHEET.users, USER_COLS, k); };
  var today = '">="&TODAY()', tomorrow = '"<"&TODAY()+1', month = '">="&EOMONTH(TODAY(),-1)+1';
  // ширины рассчитаны на экран телефона: две карточки в ряд помещаются без прокрутки
  [10, 168, 8, 168, 10].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 1, 100, 5).setFontFamily('Arial').setVerticalAlignment('middle');
  sh.getRange('B2:D2').merge().setValue('ONION SHOP: сводка').setFontSize(18).setFontWeight('bold').setFontColor(C.navy);
  sh.getRange('B3:D3').merge().setFormula('=NOW()').setNumberFormat('"Обновлено: "dd.MM.yyyy HH:mm" МСК"').setHorizontalAlignment('left').setFontColor('#6b7280').setFontSize(9);
  // быстрые переходы по листам, удобно на телефоне
  var go = function (cell, name) {
    var s = ss_().getSheetByName(name); if (!s) return;
    sh.getRange(cell).setFormula(F_('=HYPERLINK("#gid=' + s.getSheetId() + '","' + name + '  →")')).setBackground(C.navy).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setFontSize(11)
      .setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
  };
  go('B5', SHEET.orders); go('D5', SHEET.users); go('B6', SHEET.promos); go('D6', SHEET.reviews);
  sh.setRowHeight(5, 36); sh.setRowHeight(6, 36);
  var section = function (row, title) {
    sh.getRange(row, 2, 1, 3).setBorder(false, false, true, false, false, false, C.navy, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(row, 2).setValue(title).setFontWeight('bold').setFontColor(C.navy).setFontSize(12);
    sh.setRowHeight(row, 28);
  };
  var card = function (row, col, label, formula, fmt) {
    sh.getRange(row, col).setValue(label).setFontColor('#6b7280').setFontSize(9).setVerticalAlignment('bottom');
    sh.getRange(row + 1, col).setFormula(F_(formula)).setNumberFormat(fmt).setFontSize(18).setFontWeight('bold').setFontColor(C.navy).setHorizontalAlignment('left').setVerticalAlignment('top');
    sh.getRange(row, col, 2, 1).setBackground('#f3f6fc').setBorder(true, true, true, true, false, false, C.line, SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(row, 22); sh.setRowHeight(row + 1, 34);
  };
  var pair = function (row, a, b) { card(row, 2, a[0], a[1], a[2]); card(row, 4, b[0], b[1], b[2]); };
  var inWork = O('no') + ',"<>",' + O('status') + ',"<>Получен",' + O('status') + ',"<>Отменён"';
  section(8, 'Сегодня');
  pair(9, ['Заказов сегодня', '=COUNTIFS(' + O('at') + ',' + today + ',' + O('at') + ',' + tomorrow + ')', '0'],
          ['На сумму', '=SUMIFS(' + O('toPay') + ',' + O('at') + ',' + today + ',' + O('at') + ',' + tomorrow + ')', '#,##0" ₽"']);
  section(12, 'Нужно сделать');
  pair(13, ['Ждут оплаты', '=COUNTIFS(' + O('no') + ',"<>",' + O('paid') + ',FALSE,' + O('status') + ',"<>Отменён")', '0'],
           ['Неоплачено на сумму', '=SUMIFS(' + O('toPay') + ',' + O('no') + ',"<>",' + O('paid') + ',FALSE,' + O('status') + ',"<>Отменён")', '#,##0" ₽"']);
  pair(16, ['Заказов в работе', '=COUNTIFS(' + inWork + ')', '0'],
           ['Ждут товар (лист ожидания)', '=COUNTIFS(\'' + SHEET.waits + '\'!B2:B,"<>",\'' + SHEET.waits + '\'!' + colL_(ci_(WAIT_COLS, 'sent') + 1) + '2:' + colL_(ci_(WAIT_COLS, 'sent') + 1) + ',"")', '0']);
  section(19, 'Месяц');
  pair(20, ['Заказов за месяц', '=COUNTIFS(' + O('at') + ',' + month + ')', '0'],
           ['На сумму', '=SUMIFS(' + O('toPay') + ',' + O('at') + ',' + month + ')', '#,##0" ₽"']);
  pair(23, ['Средний чек', '=IFERROR(ROUND(SUMIFS(' + O('toPay') + ',' + O('at') + ',' + month + ')/COUNTIFS(' + O('at') + ',' + month + ')),0)', '#,##0" ₽"'],
           ['Новых отзывов за 7 дней', '=COUNTIFS(\'' + SHEET.reviews + '\'!A2:A,">="&TODAY()-7)', '0']);
  section(26, 'Клиенты');
  pair(27, ['Клиентов всего', '=COUNTA(' + U('id') + ')', '0'],
           ['Новых за месяц', '=COUNTIFS(' + U('createdAt') + ',' + month + ')', '0']);
  pair(30, ['Ониксов у клиентов', '=SUM(' + U('balance') + ')', '#,##0'],
           ['Это скидок на', '=SUM(' + U('balance') + ')*' + Math.round(OnionCore.settings().tokenRub * 100) + '/100', '#,##0" ₽"']);
  // списки: каждый в своём блоке с запасом строк, чтобы не наезжали друг на друга
  var line = function (row, formula) { sh.getRange(row, 2).setFormula(F_(formula)).setFontColor('#1b2333').setFontSize(10).setWrap(false); };
  var allN = 'COUNTIFS(' + O('no') + ',"<>")', rowsOf = function (cond) { return 'FILTER(ROW(' + O('no') + '),' + cond + ')'; };
  section(33, 'Заказы по статусам');
  ALL_STAGES_().forEach(function (s, i) {
    var r = 34 + i;
    sh.getRange(r, 2).setValue(s).setFontColor('#1b2333');
    sh.getRange(r, 4).setFormula(F_('=COUNTIFS(' + O('status') + ',"' + s + '")')).setHorizontalAlignment('right').setFontWeight('bold').setFontColor(C.navy);
    sh.getRange(r, 2, 1, 3).setBorder(false, false, true, false, false, false, C.line, SpreadsheetApp.BorderStyle.SOLID);
  });
  var lineText = O('no') + '&"  ·  "&' + O('name') + '&"  ·  "&TEXT(' + O('toPay') + ',"# ##0")&" ₽"';
  var lastCond = O('no') + '<>"",ROW(' + O('no') + ')-1>' + allN + '-5';
  section(43, 'Последние заказы (сначала новые)');
  line(44, '=IFERROR(SORT(ARRAYFORMULA(FILTER(' + lineText + ',' + lastCond + ')),ARRAYFORMULA(' + rowsOf(lastCond) + '),FALSE),"Заказов пока нет")');
  section(50, 'Ждут оплаты (сначала самые давние)');
  line(51, '=IFERROR(ARRAYFORMULA(FILTER(' + lineText + ',' + O('no') + '<>"",' + O('paid') + '=FALSE,' + O('status') + '<>"Отменён")),"Все заказы оплачены")');
  section(77, 'Дни рождения в ближайшие 14 дней');
  var bd = U('birthday');
  line(78, '=IFERROR(ARRAYFORMULA(FILTER(' + U('name') + '&" ("&' + U('login') + '&")  ·  "&' + bd + ',' + bd + '<>"",IFERROR(MOD(DATE(YEAR(TODAY()),VALUE(LEFT(' + bd + ',2)),VALUE(RIGHT(' + bd + ',2)))-TODAY(),365),999)<=14)),"Никого")');
  section(92, 'Как пользоваться');
  sh.getRange('B93:D93').merge().setValue('Заказы: меняйте «Статус» из списка, клиент видит его на сайте. Отметьте «Оплачен», когда клиент заплатил. Красный номер: заказ не оплачен больше суток. Редкие колонки свёрнуты значком «+» над таблицей.');
  sh.getRange('B94:D94').merge().setValue('Клиенты: колонки с синим заголовком можно править (ониксы, уровень, XP, контакты), клиент видит это сразу.');
  sh.getRange('B95:D95').merge().setValue('Если что-то сбилось: меню ONION SHOP → «Оформить таблицу заново».');
  sh.getRange('B93:D95').setWrap(true).setFontColor('#374151').setFontSize(9).setVerticalAlignment('top');
  sh.setRowHeight(93, 62); sh.setRowHeight(94, 40); sh.setRowHeight(95, 28);  sh.setTabColor(C.cyan);
  sh.setFrozenRows(0);
}
function styleReviews_() {
  var sh = style_(migrate_(SHEET.reviews, REVIEW_COLS), REVIEW_COLS, { freezeCols: 0 });
  var maxR = sh.getMaxRows();
  sh.getRange(2, ci_(REVIEW_COLS, 'text') + 1, maxR - 1, 1).setWrap(true);
  sh.getRange(2, ci_(REVIEW_COLS, 'status') + 1, maxR - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['опубликован', 'скрыт'], true).setAllowInvalid(false).setHelpText('«скрыт»: отзыв пропадёт с сайта').build());
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('скрыт').setBackground('#fde8e8').setFontColor('#b91c1c').setRanges([sh.getRange(2, ci_(REVIEW_COLS, 'status') + 1, maxR - 1, 1)]).build()]);
  sh.getRange(1, ci_(REVIEW_COLS, 'status') + 1).setNote('Выберите «скрыт», чтобы убрать отзыв с сайта. Ониксы за отзыв остаются у клиента.');
}
function styleWaits_() { style_(migrate_(SHEET.waits, WAIT_COLS), WAIT_COLS, {}); }
/* Аварийно: вернуть лист из последней резервной копии («Заказы (резерв …)», скрытый лист), если перестройка прервалась.
   Запускать вручную из редактора скриптов, потом выполнить «Оформить таблицу заново». */
function restoreFromBackup(name) {
  name = name || SHEET.orders;
  var list = ss_().getSheets().filter(function (s) { return s.getName().indexOf(name + ' (резерв ') === 0; });
  if (!list.length) throw new Error('Нет резервной копии листа «' + name + '»');
  var bk = list[list.length - 1], sh = ss_().getSheetByName(name);
  var r = bk.getLastRow(), c = bk.getLastColumn();
  sh.clear(); sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations().clearNote();
  if (sh.getMaxColumns() < c) sh.insertColumnsAfter(sh.getMaxColumns(), c - sh.getMaxColumns());
  if (sh.getMaxRows() < r) sh.insertRowsAfter(sh.getMaxRows(), r - sh.getMaxRows());
  bk.getRange(1, 1, r, c).copyTo(sh.getRange(1, 1));
  Logger.log('Лист «' + name + '» возвращён из «' + bk.getName() + '», строк: ' + (r - 1));
}
function restoreOrders() { restoreFromBackup(SHEET.orders); }
/* служебные листы: «Учёт бонусов» (хэши) и «Игры» (старые сохранения игр, больше не используются) */
function SERVICE_SHEETS_() {
  return [SHEET.ledger, 'Игры'].map(function (n) { return ss_().getSheetByName(n); }).filter(Boolean);
}
function refreshSummary() { styleSummary_(); }
function showServiceSheets() { SERVICE_SHEETS_().forEach(function (s) { s.showSheet(); }); }
function hideServiceSheets() { SERVICE_SHEETS_().forEach(function (s) { s.hideSheet(); }); }
function layout_() {
  ss_().setSpreadsheetTimeZone('Europe/Moscow');
  styleOrders_(); styleUsers_(); stylePromos_(); styleLog_(); styleReviews_(); styleWaits_(); styleSummary_();
  var s = migrate_(SHEET.sessions, SESSION_COLS); s.getRange('A:C').setNumberFormat('@'); s.hideSheet();
  ss_().getSheetByName(SHEET.orders).setTabColor(C.blue);
  ss_().getSheetByName(SHEET.users).setTabColor('#0a82ba');
  ss_().getSheetByName(SHEET.promos).setTabColor('#43c9e3');
  ss_().getSheetByName(SHEET.log).setTabColor('#64748b');
  ss_().getSheetByName(SHEET.reviews).setTabColor('#f59e0b');
  ss_().getSheetByName(SHEET.waits).setTabColor('#94a3b8');
  // «Подозрительное» оставляем на виду (красная вкладка), служебные «Учёт бонусов» и старые «Игры» прячем (данные целы, показать: меню ONION SHOP → Служебные листы)
  var fl = ss_().getSheetByName(SHEET.flags);
  if (fl) { style_(fl, FLAG_COLS, {}); fl.setTabColor('#e11d2e'); fl.getRange(2, ci_(FLAG_COLS, 'text') + 1, fl.getMaxRows() - 1, 1).setWrap(true); }
  var lg = ss_().getSheetByName(SHEET.ledger); if (lg) { style_(lg, LEDGER_COLS, {}); lg.setTabColor('#94a3b8'); }
  SERVICE_SHEETS_().forEach(function (s) { try { if (ss_().getSheets().length > 1) s.hideSheet(); } catch (e) {} });
  var order = [SHEET.summary, SHEET.orders, SHEET.users, SHEET.promos, SHEET.reviews, SHEET.waits, SHEET.log].concat(fl ? [SHEET.flags] : []);
  order.forEach(function (n, i) { var sh = ss_().getSheetByName(n); ss_().setActiveSheet(sh); ss_().moveActiveSheet(i + 1); });
  ss_().setActiveSheet(ss_().getSheetByName(SHEET.summary));
  props_().setProperty('layoutVer', LAYOUT_VER);
}
/* Перестройка листов идёт строго по одной: пока одна работает, другие запросы ждут, а потом видят, что всё уже готово. */
function ensureLayout_() {
  if (props_().getProperty('layoutVer') === LAYOUT_VER) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try { if (props_().getProperty('layoutVer') !== LAYOUT_VER) upgrade_(); } finally { lock.releaseLock(); }
}
/* Перестройка листов + разовые переносы при переходе со старых версий */
function upgrade_() {
  var was = parseInt(props_().getProperty('layoutVer') || '0', 10) || 0;
  layout_();
  if (was && was < 8) xpToPoints_();
  if (was && was < 6) pinManualLevels_();
}
/* Версия 8: в колонке уровня теперь XP, а не рубли. Переводим один раз: 10 ₽ = 1 XP. */
function xpToPoints_() {
  var p = props_(); if (p.getProperty('xpUnit') === 'points') return;
  USERS_CACHE_ = null;
  var sh = sheet_(SHEET.users, USER_COLS), col = ci_(USER_COLS, 'xp') + 1;
  users_().forEach(function (u) { if (u.xp) { u.xp = Math.floor(u.xp / 10); sh.getRange(u._row, col).setValue(u.xp); } }); // только XP, остальное (в т.ч. вписанный уровень) не трогаем
  USERS_CACHE_ = null;
  p.setProperty('xpUnit', 'points');
}
/* До версии 6 уровень нельзя было закрепить: если в колонке «Уровень» вручную вписали уровень,
   который не совпадает с расчётным, закрепляем его, чтобы правка не пропала. */
function pinManualLevels_() {
  USERS_CACHE_ = null;
  users_().forEach(function (u) {
    if (u.levelFix) return;
    var fi = OnionCore.fixIndex(u.levelName);
    if (fi >= 0 && OnionCore.RULES.levels[fi].name !== OnionCore.levelInfo(u.xp).name) { u.levelFix = OnionCore.RULES.levels[fi].name; DB.saveUser(u); }
  });
}

/* Письмо с кодом: логотип, крупный код по цифрам, пояснение. Вёрстка таблицами и инлайн-стили, так её одинаково показывают Gmail, Яндекс, Mail.ru и Apple Mail. */
function mailHtml_(code, what, login) {
  var base = siteBase_(), logo = base + 'assets/logo.png';
  var digits = String(code).split('').map(function (d) {
    return '<td style="padding:0 3px"><div style="width:42px;height:56px;line-height:56px;text-align:center;background:#eef4fc;border:1px solid #cfdcf0;border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:800;color:#0b1b4d">' + d + '</div></td>';
  }).join('');
  var title = /регистр/.test(what) ? 'Подтвердите почту' : /пароль/.test(what) ? 'Восстановление пароля' : 'Подтверждение почты';
  var lead = /регистр/.test(what) ? 'Введите этот код на сайте, чтобы завершить регистрацию и получить 100 приветственных ониксов.' : /пароль/.test(what) ? 'Введите этот код на сайте и задайте новый пароль.' : 'Введите этот код на сайте, чтобы подтвердить почту.';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>' +
    '<body style="margin:0;padding:0;background:#e3eaf4">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">Ваш код ' + code + ', действует 15 минут</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e3eaf4"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(11,27,77,.12)">' +
      // шапка
      '<tr><td align="center" style="background:#0b1b4d;background-image:linear-gradient(135deg,#0b1b4d 0%,#1d4fb8 100%);padding:30px 24px 26px">' +
        '<img src="' + logo + '" width="68" height="68" alt="ONION SHOP" style="display:block;margin:0 auto 12px;border:0;border-radius:50%;background:#ffffff;padding:4px">' +
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;letter-spacing:.14em;color:#ffffff">ONION SHOP</div>' +
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#9fe3f2;margin-top:4px;letter-spacing:.04em">одежда, обувь и аксессуары</div>' +
      '</td></tr>' +
      // тело
      '<tr><td align="center" style="padding:30px 26px 8px;font-family:Arial,Helvetica,sans-serif">' +
        '<div style="font-size:22px;font-weight:800;color:#0b1b4d;margin-bottom:8px">' + title + '</div>' +
        (login ? '<div style="font-size:13.5px;color:#5a6b82;margin-bottom:10px">Аккаунт: <b style="color:#0b1b4d">' + login + '</b></div>' : '') +
        '<div style="font-size:15px;line-height:1.5;color:#3b4d66;margin:0 6px 22px">' + lead + '</div>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>' + digits + '</tr></table>' +
        '<div style="margin:22px auto 4px;display:inline-block;padding:8px 16px;background:#e5f6fb;border-radius:999px;font-size:13px;font-weight:700;color:#0a76a8">Код действует 15 минут</div>' +
      '</td></tr>' +
      '<tr><td style="padding:18px 26px 28px;font-family:Arial,Helvetica,sans-serif"><div style="border-top:1px solid #e3eaf4;padding-top:18px;font-size:12.5px;line-height:1.55;color:#6b7b91;text-align:center">' +
        'Никому не сообщайте этот код, менеджеры магазина его не спрашивают.<br>Если вы ничего не запрашивали, просто проигнорируйте письмо: без кода никто не войдёт в аккаунт.' +
      '</div></td></tr>' +
    '</table>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#8091a8;margin-top:16px">ONION SHOP · письмо отправлено автоматически, отвечать на него не нужно</div>' +
    '</td></tr></table></body></html>';
}

/* ---------- строки ↔ объекты ---------- */
function rowToObj_(row, cols) {
  var o = {};
  cols.forEach(function (c, i) {
    var v = row[i];
    if (JSON_COLS[c[0]]) { try { v = v ? JSON.parse(v) : null; } catch (e) { v = null; } }
    if (c[0] === 'state') { var st = {}; try { st = v ? JSON.parse(v) : {}; } catch (e) { st = {}; } STATE_KEYS.forEach(function (k) { if (st[k] != null) o[k] = st[k]; }); return; }
    if (v instanceof Date) v = v.getTime();
    o[c[0]] = v;
  });
  return o;
}
function objToRow_(o, cols) {
  return cols.map(function (c) {
    var v = o[c[0]];
    if (JSON_COLS[c[0]]) return JSON.stringify(v || (c[0] === 'tasks' ? null : []));
    if (c[0] === 'state') { var st = {}; STATE_KEYS.forEach(function (k) { if (o[k] != null && o[k] !== '') st[k] = o[k]; }); return JSON.stringify(st); }
    if (c[2] && c[2].t === 'date' && typeof v === 'number') return new Date(v);
    if (c[2] && c[2].t === 'date' && typeof v === 'string' && /^\d\d\.\d\d\.\d{4}/.test(v)) return v;
    if (v === undefined || v === null) return '';
    return v;
  });
}

var USERS_CACHE_ = null;
function users_() {
  if (USERS_CACHE_) return USERS_CACHE_;
  var sh = sheet_(SHEET.users, USER_COLS);
  var n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, USER_COLS.length).getValues() : [];
  var NUM = ['balance', 'xp', 'spent', 'ordersCount', 'streak', 'freeSpins', 'refCount', 'refMonthCount'];
  var STR = ['login', 'email', 'emailKey', 'tgKey', 'phoneKey', 'refCode', 'referredBy', 'lastCheckin', 'xpMonth', 'refMonth', 'perkSpinMonth', 'perkIconMonth', 'birthday', 'bdayYear', 'frame', 'avatar', 'levelFix', 'name', 'phone', 'tg'];
  USERS_CACHE_ = [];
  rows.forEach(function (r, i) {
    if (r[0] === '' || r[0] === null) return;
    var u = rowToObj_(r, USER_COLS); u._row = i + 2; u.id = String(u.id);
    Object.defineProperty(u, '_raw', { value: r, enumerable: false, writable: true, configurable: true }); // строка как в таблице: saveUser не пишет, если ничего не поменялось
    NUM.forEach(function (k) { u[k] = parseInt(u[k], 10) || 0; });
    STR.forEach(function (k) { u[k] = u[k] == null ? '' : String(u[k]); });
    u.refRewarded = u.refRewarded === true || String(u.refRewarded).toLowerCase() === 'true';
    // таблица главнее: ключи для входа и поиска берутся из видимых колонок (если их поправили вручную)
    u.login = u.login.trim().toLowerCase();
    u.emailKey = OnionCore.cleanEmail(u.email);
    u.phoneKey = OnionCore.phoneKey(u.phone);
    u.tg = OnionCore.cleanTg(u.tg); u.tgKey = u.tg.toLowerCase();
    var fi = OnionCore.fixIndex(u.levelFix); u.levelFix = fi >= 0 ? OnionCore.RULES.levels[fi].name : '';
    USERS_CACHE_.push(u);
  });
  return USERS_CACHE_;
}

function promoRows_() {
  var sh = ss_().getSheetByName(SHEET.promos); if (!sh) return [];
  var n = sh.getLastRow() - 1; if (n <= 0) return [];
  return sh.getRange(2, 1, n, PROMO_COLS.length).getValues().map(function (r) { return rowToObj_(r, PROMO_COLS); });
}
function orderRows_() {
  var sh = sheet_(SHEET.orders, ORDER_COLS), n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, ORDER_COLS.length).getValues() : [];
}
/* Первая свободная строка под последним заполненным «№ заказа» / «ID» (колонка A).
   Так новая запись не уезжает вниз листа, даже если ниже есть галочки или пометки. */
function freeRow_(sh) {
  var last = sh.getLastRow(), r = 2;
  if (last >= 2) {
    var a = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = a.length - 1; i >= 0; i--) if (String(a[i][0]).trim() !== '') { r = i + 3; break; }
  }
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), r - sh.getMaxRows() + 50);
  return r;
}
/* Собирает заказы наверх. Колонка «Оформлен/Оплачен» заполнена галочками на 500+ строк, поэтому Google считает
   лист «заполненным до конца», и новые заказы раньше падали на 1001-ю строку и ниже, их не было видно.
   Здесь строки с номером заказа переезжают в самые верхние свободные строки (порядок сохраняется).
   Строки с чужими пометками не затираются: переезд идёт только в полностью пустые строки. */
function compactOrders_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return 0;
  var last = sh.getLastRow(); if (last < 3) return 0;
  var nC = ORDER_COLS.length, iPaid = ci_(ORDER_COLS, 'paid');
  var vals = sh.getRange(2, 1, last - 1, nC).getValues();
  var filled = [], free = [];
  vals.forEach(function (r, i) {
    if (String(r[0]).trim() !== '') filled.push(i);
    else if (r.every(function (v, k) { return k === iPaid || v === '' || v === null || v === false; })) free.push(i);
  });
  var movers = [];
  for (var f = filled.length - 1, g = 0; f >= 0 && g < free.length; f--) {
    if (free[g] >= filled[f]) break;
    movers.push(filled[f]); g++;
  }
  if (!movers.length) return 0;
  movers.reverse(); // сверху вниз, чтобы порядок заказов сохранился
  var moves = movers.map(function (src, k) { return [src, free[k]]; });
  var forms = sh.getRange(2, 1, last - 1, nC).getFormulas();
  moves.forEach(function (m) {
    var from = m[0] + 2, to = m[1] + 2;
    var row = vals[m[0]].map(function (v, k) { return forms[m[0]][k] || v; });
    sh.getRange(to, 1, 1, nC).setValues([row]);
    sh.setRowHeight(to, 64);
    sh.getRange(to, iPaid + 1).insertCheckboxes();
    var paid = vals[m[0]][iPaid]; sh.getRange(to, iPaid + 1).setValue(paid === true || String(paid).toLowerCase() === 'true');
    sh.getRange(from, 1, 1, nC).clearContent();
    sh.getRange(from, iPaid + 1).insertCheckboxes();
  });
  return moves.length;
}
/* «OS1003», « 1003 » и 1003, один и тот же клиент */
function normId_(v) { return String(v == null ? '' : v).trim().replace(/^OS-?/i, ''); }
function money_(v) { if (typeof v === 'number') return v; var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; }
function monthOf_(v) {
  if (v instanceof Date) return OnionCore.monthKey(v.getTime());
  var m = String(v || '').match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? m[3] + '-' + m[2] : '';
}
function isTrue_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'да'; }

var DB = {
  now: function () { return Date.now(); },
  random: function () { return Math.random(); },
  hash: function (s) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
    return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
  },
  token: function () { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16); },
  getUser: function (id) { id = String(id); return users_().filter(function (u) { return u.id === id; })[0] || null; },
  findUser: function (field, value) {
    var map = { login: 'login', tg: 'tgKey', phone: 'phoneKey', refCode: 'refCode', email: 'emailKey' };
    var key = map[field] || field; value = String(value);
    return users_().filter(function (u) { return String(u[key]) === value; })[0] || null;
  },
  createUser: function (u) {
    var p = props_(), seq = parseInt(p.getProperty('userSeq') || '1000', 10) + 1;
    p.setProperty('userSeq', String(seq));
    u.id = String(seq);
    var sh = sheet_(SHEET.users, USER_COLS);
    u.levelName = OnionCore.levelOf(u).name;
    u._row = freeRow_(sh);
    sh.getRange(u._row, 1, 1, USER_COLS.length).setValues([objToRow_(u, USER_COLS)]);
    users_().push(u);
    return u;
  },
  saveUser: function (u) {
    u.levelName = OnionCore.levelOf(u).name;
    var row = objToRow_(u, USER_COLS);
    // запись в таблицу самая дорогая операция: если строка клиента не изменилась (обычный «me»), не пишем.
    // Сравнение строгое по каждой ячейке; при любом сомнении (другой тип, даты) строка записывается как раньше.
    if (u._raw && u._raw.length === row.length) {
      var norm = function (v) { return v instanceof Date ? 'D' + v.getTime() : (v === null || v === undefined ? '' : String(v)); }, same = true;
      for (var i = 0; i < row.length; i++) { if (norm(row[i]) !== norm(u._raw[i])) { same = false; break; } }
      if (same) return;
    }
    sheet_(SHEET.users, USER_COLS).getRange(u._row, 1, 1, USER_COLS.length).setValues([row]);
    if (u._row) { try { Object.defineProperty(u, '_raw', { value: row, enumerable: false, writable: true, configurable: true }); } catch (e) { u._raw = row; } }
  },
  getSession: function (token) {
    var sh = sheet_(SHEET.sessions, SESSION_COLS);
    var cell = sh.getRange('A:A').createTextFinder(String(token)).matchEntireCell(true).findNext();
    if (!cell) return null;
    var r = sh.getRange(cell.getRow(), 1, 1, 3).getValues()[0];
    return { token: r[0], userId: String(r[1]), exp: +r[2] };
  },
  saveSession: function (s) { sheet_(SHEET.sessions, SESSION_COLS).appendRow([s.token, s.userId, String(s.exp)]); },
  renewSession: function (token, exp) {
    var sh = sheet_(SHEET.sessions, SESSION_COLS);
    var cell = sh.getRange('A:A').createTextFinder(String(token)).matchEntireCell(true).findNext();
    if (cell) sh.getRange(cell.getRow(), 3).setValue(String(exp));
  },
  deleteSession: function (token) {
    var sh = sheet_(SHEET.sessions, SESSION_COLS);
    var cell = sh.getRange('A:A').createTextFinder(String(token)).matchEntireCell(true).findNext();
    if (cell) sh.deleteRow(cell.getRow());
  },
  nextOrderSeq: function () {
    var p = props_(), seq = parseInt(p.getProperty('orderSeq') || '0', 10) + 1;
    p.setProperty('orderSeq', String(seq));
    return seq;
  },
  saveOrder: function (o) {
    var row = Object.assign({}, o);
    row.itemsText = o.items.map(function (it) { return it.title + (it.size ? ' · ' + it.size : '') + (it.color ? ' · ' + it.color : '') + ' × ' + it.qty; }).join('\n');
    row.items = JSON.stringify(o.items);
    row.at = new Date(o.at);
    row.paid = false; row.status = o.status || 'Оформлен';
    if (!row.tg || row.tg === '@') row.tg = '';
    var tgName = String(row.tg || '').replace(/^@/, ''), digits = String(o.phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '7' + digits;
    row.contact = tgName ? F_('=HYPERLINK("https://t.me/' + tgName + '","Telegram ↗")') : digits ? F_('=HYPERLINK("https://t.me/+' + digits + '","По номеру ↗")') : '';
    row.xpDone = ''; row.refunded = ''; row.notified = row.status; row.remind = '';
    var sh = sheet_(SHEET.orders, ORDER_COLS), r = freeRow_(sh);
    sh.getRange(r, 1, 1, ORDER_COLS.length).setValues([ORDER_COLS.map(function (c) { var v = row[c[0]]; return v === undefined || v === null ? '' : v; })]);
    sh.setRowHeight(r, 64);
    sh.getRange(r, ci_(ORDER_COLS, 'paid') + 1).insertCheckboxes();
  },
  listOrders: function (userId, limit) {
    var rows = orderRows_(), out = [], iu = ci_(ORDER_COLS, 'userId');
    for (var i = rows.length - 1; i >= 0 && out.length < limit; i--) {
      if (normId_(rows[i][iu]) !== String(userId)) continue;
      var o = {}; ORDER_COLS.forEach(function (c, j) { o[c[0]] = rows[i][j]; });
      try { o.items = JSON.parse(o.items || '[]'); } catch (e) { o.items = []; }
      o.at = o.at instanceof Date ? mskText_(o.at.getTime()) : String(o.at);
      delete o.photo; delete o.contact; delete o.note;
      out.push(o);
    }
    return out;
  },
  log: function (e) {
    sheet_(SHEET.log, LOG_COLS).appendRow([new Date(e.at), e.userId, e.login, e.delta, e.reason, e.balance]);
  },
  // промокоды магазина из листа «Промокоды»
  shopPromo: function (code) {
    code = String(code).trim().toUpperCase();
    var r = promoRows_().filter(function (x) { return String(x.code).trim().toUpperCase() === code; })[0];
    if (!r) return null;
    var until = null; // до 23:59:59 по Москве указанного дня
    if (typeof r.until === 'number') until = Date.parse(Utilities.formatDate(new Date(r.until), 'Europe/Moscow', 'yyyy-MM-dd') + 'T23:59:59+03:00');
    return { code: code, pct: parseFloat(String(r.pct).replace(',', '.')) || 0, active: isTrue_(r.active), withTokens: isTrue_(r.withTokens), once: isTrue_(r.once), limit: parseInt(r.limit, 10) || 0, until: until };
  },
  promoUses: function (code) {
    code = String(code).trim().toUpperCase();
    var rows = orderRows_(), ip = ci_(ORDER_COLS, 'promo'), iu = ci_(ORDER_COLS, 'userId'), ih = ci_(ORDER_COLS, 'phone');
    var res = { total: 0, users: [], phones: [] };
    rows.forEach(function (r) {
      if (String(r[ip]).trim().toUpperCase() !== code) return;
      res.total++;
      if (normId_(r[iu])) res.users.push(normId_(r[iu]));
      var d = String(r[ih]).replace(/\D/g, ''); if (d.length === 11) d = d.slice(1);
      if (d) res.phones.push(d);
    });
    return res;
  },
  // каталог с сайта, чтобы цены в заказе нельзя было подменить
  catalog_: null,
  loadCatalog_: function () {
    if (DB.catalog_ !== null) return DB.catalog_;
    var cache = CacheService.getScriptCache(), hit = cache.get('catalog');
    if (hit) { DB.catalog_ = JSON.parse(hit); return DB.catalog_; }
    try {
      var url = props_().getProperty('CATALOG_URL') || CATALOG_URL_DEFAULT;
      var res = UrlFetchApp.fetch(url + '?t=' + Date.now(), { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) { DB.catalog_ = false; return false; }
      var s = res.getContentText(), data = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
      var slim = {};
      (data.products || []).forEach(function (p) { slim[p.id] = { id: p.id, title: p.title, date: p.date || '', price: p.price, oldPrice: p.oldPrice || 0, category: p.category || '', cl: p.categoryLabel || '', status: p.status, link: p.link, sizes: p.sizes || [], colors: p.colors || [], details: p.details || [], photos: (p.photos || []).map(function (x) { return { id: x.id }; }) }; });
      var str = JSON.stringify(slim);
      if (str.length < 95000) cache.put('catalog', str, 600);
      DB.catalog_ = slim;
    } catch (e) { DB.catalog_ = false; }
    return DB.catalog_;
  },
  catalogReady: function () { return !!DB.loadCatalog_(); },
  product: function (id) { var c = DB.loadCatalog_(); return c ? (c[id] || null) : null; },
  notify: function (text, meta) {
    var p = props_(), token = p.getProperty('BOT_TOKEN'), chat = p.getProperty('ADMIN_CHAT_ID');
    if (!token || !chat) return false;
    var payload = { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: 'true' };
    if (meta && meta.no) DB.hot(10);
    if (meta && meta.no) payload.reply_markup = JSON.stringify({ inline_keyboard: adminKeyboard_(meta.no, meta.kind) });
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'post', muteHttpExceptions: true, payload: payload });
    if (meta && meta.no) { try { orderPhotos_(chat, meta.no); } catch (e) { } }
    return res.getResponseCode() === 200;
  },
  // «горячее окно»: несколько минут бот слушает Telegram почти без задержки (клиент подключает бота, пришёл новый заказ)
  hot: function (min) { props_().setProperty('tgHot', String(Date.now() + min * 60000)); },
  userPhoto: function (u, url, caption, kb) {
    var t = props_().getProperty('BOT_TOKEN');
    if (!t || !u || !u.tgChat) return false;
    try {
      var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/sendPhoto', { method: 'post', muteHttpExceptions: true, payload: kb && kb.length ? { chat_id: u.tgChat, photo: url, caption: String(caption).slice(0, 1000), reply_markup: JSON.stringify({ inline_keyboard: kb }) } : { chat_id: u.tgChat, photo: url, caption: String(caption).slice(0, 1000) } });
      if (res.getResponseCode() === 200) return true;
    } catch (e) { }
    return DB.userNotify(u, caption, kb);
  },
  // одноразовые коды на почту, во временном хранилище Google (сами исчезают)
  putCode: function (key, obj, ttlSec) { if (String(key).indexOf('tg:') === 0) DB.hot(6); CacheService.getScriptCache().put(key, JSON.stringify(obj), Math.max(1, Math.min(21600, ttlSec || 900))); },
  getCode: function (key) { var v = CacheService.getScriptCache().get(key); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  delCode: function (key) { CacheService.getScriptCache().remove(key); },
  mail: function (to, subject, code, what, login) {
    try {
      if (MailApp.getRemainingDailyQuota() < 1) return false;
      var html = mailHtml_(code, what, login);
      MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, body: 'ONION SHOP. Ваш код ' + what + ': ' + code + '. Действует 15 минут. Никому его не сообщайте. Если это были не вы, просто проигнорируйте письмо.', name: 'ONION SHOP' });
      return true;
    } catch (e) { console.error(e); return false; }
  },
  botUser: function () {
    var p = props_(), b = p.getProperty('BOT_USER'), t = p.getProperty('BOT_TOKEN');
    if (b || !t) return b || '';
    try {
      var r = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/getMe', { muteHttpExceptions: true }).getContentText());
      if (r.ok && r.result && r.result.username) { p.setProperty('BOT_USER', r.result.username); return r.result.username; }
    } catch (e) { }
    return '';
  },
  // сообщение клиенту в его личный чат с ботом (если он подключил уведомления)
  userNotify: function (u, text, kb) {
    var t = props_().getProperty('BOT_TOKEN');
    if (!t || !u || !u.tgChat) return false;
    try {
      var pl = { chat_id: u.tgChat, text: String(text).slice(0, 4000), disable_web_page_preview: 'true' };
      if (kb && kb.length) pl.reply_markup = JSON.stringify({ inline_keyboard: kb });
      var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/sendMessage', { method: 'post', muteHttpExceptions: true, payload: pl });
      var code = res.getResponseCode();
      if (code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); } // клиент заблокировал бота
      return code === 200;
    } catch (e) { return false; }
  },
  reviewRows_: function () {
    var sh = ss_().getSheetByName(SHEET.reviews); if (!sh) return [];
    var n = sh.getLastRow() - 1; if (n <= 0) return [];
    return sh.getRange(2, 1, n, REVIEW_COLS.length).getValues().map(function (r) { var o = rowToObj_(r, REVIEW_COLS); o.no = String(o.no); o.productId = String(o.productId); o.userId = normId_(o.userId); return o; });
  },
  reviewKeys: function (uid) { return DB.reviewRows_().filter(function (r) { return r.userId === String(uid); }).map(function (r) { return r.no + '|' + r.productId; }); },
  reviewHas: function (no, pid) { return DB.reviewRows_().some(function (r) { return r.no === no && r.productId === pid; }); },
  reviewAdd: function (r) {
    var sh = sheet_(SHEET.reviews, REVIEW_COLS), row = freeRow_(sh);
    var o = Object.assign({}, r); o.at = new Date(r.at);
    sh.getRange(row, 1, 1, REVIEW_COLS.length).setValues([REVIEW_COLS.map(function (c) { var v = o[c[0]]; return v === undefined || v === null ? '' : v; })]);
    sh.getRange(row, ci_(REVIEW_COLS, 'text') + 1).setWrap(true);
    try { DB.notify('⭐ Новый отзыв ' + '★'.repeat(Math.max(1, Math.min(5, +r.rating || 0))) + ' от @' + r.login + '\n«' + String(r.title || '').slice(0, 60) + '» · заказ ' + r.no + (r.text ? '\n\n' + String(r.text).slice(0, 600) : '') + '\n\nНачислено ' + r.reward + ' ониксов. Скрыть отзыв: лист «Отзывы».'); } catch (e) { }
  },
  reviewsFor: function (pid) {
    return DB.reviewRows_().filter(function (r) { return r.productId === pid && String(r.status).trim() !== 'скрыт' && +r.rating >= 1; }).reverse().map(function (r) {
      return { name: r.name, rating: +r.rating, text: String(r.text || ''), at: r.at instanceof Date || typeof r.at === 'number' ? mskText_(+new Date(r.at)).slice(0, 10) : String(r.at).slice(0, 10) };
    });
  },
  waitRows_: function () {
    var sh = ss_().getSheetByName(SHEET.waits); if (!sh) return [];
    var n = sh.getLastRow() - 1; if (n <= 0) return [];
    return sh.getRange(2, 1, n, WAIT_COLS.length).getValues().map(function (r, i) { var o = rowToObj_(r, WAIT_COLS); o._row = i + 2; o.userId = normId_(o.userId); o.productId = String(o.productId); return o; });
  },
  waitsOf: function (uid) { return DB.waitRows_().filter(function (w) { return w.userId === String(uid) && w.productId; }); },
  waitAdd: function (w) {
    var sh = sheet_(SHEET.waits, WAIT_COLS), row = freeRow_(sh), o = Object.assign({}, w); o.at = new Date(w.at);
    sh.getRange(row, 1, 1, WAIT_COLS.length).setValues([WAIT_COLS.map(function (c) { var v = o[c[0]]; return v === undefined || v === null ? '' : v; })]);
  },
  waitRemove: function (uid, pid) {
    var sh = ss_().getSheetByName(SHEET.waits); if (!sh) return;
    DB.waitRows_().filter(function (w) { return w.userId === String(uid) && w.productId === pid; }).map(function (w) { return w._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  },
  // мониторинг: 1: только запись; 2 и выше: ещё и сообщение менеджеру (не чаще раза в час на тип)
  flag: function (e) {
    var sh = sheet_(SHEET.flags, FLAG_COLS); sh.appendRow([new Date(e.at), e.level, e.kind, e.text]);
    if (e.level >= 2) { var k = 'flagN:' + e.kind; if (!CacheService.getScriptCache().get(k)) { CacheService.getScriptCache().put(k, '1', 3600); try { DB.notify('🛡 Подозрительная активность (уровень ' + e.level + ')\n' + e.text + '\nПодробности: лист «Подозрительное».'); } catch (x) { } } }
  },
  ledgerRows_: function () {
    if (DB.ledger_) return DB.ledger_;
    var sh = ss_().getSheetByName(SHEET.ledger), n = sh ? sh.getLastRow() - 1 : 0, m = {};
    if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(function (r) { m[String(r[0]) + '|' + String(r[1])] = 1; });
    return (DB.ledger_ = m);
  },
  ledgerHas: function (key, kind) { return !!DB.ledgerRows_()[key + '|' + kind]; },
  ledgerAdd: function (e) {
    var sh = sheet_(SHEET.ledger, LEDGER_COLS);
    sh.appendRow([e.key, e.kind, new Date(e.at), e.note || '']);
    DB.ledgerRows_()[e.key + '|' + e.kind] = 1;
  },
  deleteUser: function (u) {
    sheet_(SHEET.users, USER_COLS).deleteRow(u._row);
    USERS_CACHE_ = null;
  },
  deleteSessionsOf: function (userId) {
    var sh = sheet_(SHEET.sessions, SESSION_COLS), n = sh.getLastRow();
    if (n < 1) return;
    var ids = sh.getRange(1, 2, n, 1).getValues();
    for (var i = n - 1; i >= 0; i--) if (String(ids[i][0]) === String(userId)) sh.deleteRow(i + 1);
  },
  rateLimited: function (login) { var v = CacheService.getScriptCache().get('fail:' + login); return v && +v >= 6; },
  failedLogin: function (login) { var c = CacheService.getScriptCache(), k = 'fail:' + login; c.put(k, String((+c.get(k) || 0) + 1), 900); }
};

/* ---------- уровень клиента считается по ПОЛУЧЕННЫМ заказам ----------
   Статус стал «Получен» → «К оплате» даёт XP (1 XP за 10 ₽) в «XP за месяц» и идёт в «Потрачено всего».
   Статус «Получен» сняли → сумма вычитается обратно. В служебной колонке заказа записан месяц,
   в котором сумму засчитали, поэтому одна и та же сумма не попадёт в уровень дважды.
   Вызывается при каждом обращении сайта, при правке статуса в таблице и из меню. */
/* личный промокод клиента: при отмене заказа снова активен (если не истёк), при снятии отмены, снова использован */
function promoBack_(u, code, used) {
  if (!code) return;
  (u.promos || []).forEach(function (p) { if (String(p.code).toUpperCase() === code.toUpperCase()) { if (used) { p.used = true; } else if (p.used) { delete p.used; delete p.usedAt; } } });
}
/* статус «Получен» сняли (возврат): ониксы за отзывы по этому заказу списываются, отзывы скрываются */
function reviewRevoke_(u, no) {
  var sh = ss_().getSheetByName(SHEET.reviews); if (!sh || !no) return;
  var n = sh.getLastRow() - 1; if (n < 1) return;
  var vals = sh.getRange(2, 1, n, REVIEW_COLS.length).getValues(), iN = ci_(REVIEW_COLS, 'no'), iU = ci_(REVIEW_COLS, 'userId'), iR = ci_(REVIEW_COLS, 'reward'), iS = ci_(REVIEW_COLS, 'status');
  vals.forEach(function (r, k) {
    if (String(r[iN]).trim() !== no || normId_(r[iU]) !== String(u.id)) return;
    var rw = Math.round(+r[iR] || 0); if (rw <= 0) return;
    OnionCore.adjustTokens(DB, u, -rw, 'Заказ ' + no + ' возвращён: ониксы за отзыв списаны');
    sh.getRange(k + 2, iR + 1).setValue(0); sh.getRange(k + 2, iS + 1).setValue('скрыт');
  });
  DB.reviews_ = null;
}
function syncXp_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return 0;
  var rows = orderRows_(), p = props_();
  var migrate = p.getProperty('xpMode') !== 'received';
  if (!rows.length) { if (migrate) p.setProperty('xpMode', 'received'); p.setProperty('refundMode', '1'); return 0; }
  var I = function (k) { return ci_(ORDER_COLS, k); };
  var iKd = I('kind'), iNo = I('no'), iSt = I('status'), iU = I('userId'), iPay = I('toPay'), iX = I('xpDone'), iAt = I('at'), iTk = I('tokens'), iRf = I('refunded'), iPk = I('pack'), iTot = I('total'), iPr = I('promo'), iTr = I('taskRew');
  var getU = function (id) { id = normId_(id); return touched[id] || (touched[id] = DB.getUser(id)); };
  var rmode = p.getProperty('refundMode') !== '1'; // первый запуск: уже отменённые заказы ониксы не возвращают (вы могли вернуть вручную)
  var mk = OnionCore.monthKey(Date.now()), touched = {}, changed = 0;
  rows.forEach(function (r, i) {
    if (!String(r[iNo]).trim()) return;
    var uid = normId_(r[iU]); if (!uid) return;
    var got = String(r[iSt]).trim() === 'Получен', done = String(r[iX] || '').trim(), next = done;
    var u = touched[uid] || DB.getUser(uid), pay = money_(r[iPay]);
    if (migrate && !done) {
      // заказы, оформленные до обновления: сумма уже была засчитана в момент оформления
      if (got) next = monthOf_(r[iAt]) || mk;
      else if (u) { OnionCore.receive(DB, u, pay, -1, monthOf_(r[iAt]), { kind: String(r[iKd]) }); touched[uid] = u; }
    } else if (got && !done) {
      if (u) {
        OnionCore.receive(DB, u, pay, 1, null, { kind: String(r[iKd]) }); touched[uid] = u;
        // реферальный бонус пригласившему, когда первый заказ друга от 1 000 ₽ получен
        var rr = OnionCore.referralOnReceive(DB, u, money_(r[iTot]), getU); if (rr) touched[rr.id] = rr;
      }
      next = mk;
    } else if (!got && done) {
      if (u) { OnionCore.receive(DB, u, pay, -1, done, { kind: String(r[iKd]) }); reviewRevoke_(u, String(r[iNo]).trim()); touched[uid] = u; }
      next = '';
    }
    if (next !== done) { var cell = sh.getRange(i + 2, iX + 1); cell.setNumberFormat('@'); cell.setValue(next); changed++; }
    // возврат ониксов при отмене заказа (и обратно, если отмену сняли)
    var canc = String(r[iSt]).trim() === 'Отменён', rf = String(r[iRf] || '').trim(), nrf = rf, tk = Math.max(0, Math.round(+r[iTk] || 0));
    if (canc && !rf) {
      if (rmode) nrf = 'до обновления';
      else {
        nrf = 'да'; if (u && tk > 0) { OnionCore.adjustTokens(DB, u, tk, 'Возврат ониксов: заказ ' + r[iNo] + ' отменён'); touched[uid] = u; }
        if (u) {
          // награды за задания «оформить заказ», которые дал этот заказ, списываются; личный промокод возвращается
          OnionCore.orderCanceled(DB, u, { no: r[iNo], at: +new Date(r[iAt]), total: money_(r[iTot]), kind: String(r[iKd]), taskRew: iTr >= 0 ? String(r[iTr] || '') : '' }, 1);
          promoBack_(u, String(r[iPr] || '').trim(), false); touched[uid] = u;
          var nc = rows.filter(function (x) { return normId_(x[iU]) === uid && String(x[iSt]).trim() === 'Отменён' && x[iAt] instanceof Date && Date.now() - x[iAt].getTime() < 30 * 86400000; }).length;
          if (nc >= 3) OnionCore.flag(DB, 2, 'cancel', '@' + u.login + ': ' + nc + ' отменённых заказа за 30 дней');
        }
        if (u && iPk >= 0 && String(r[iPk] || '').trim() && u.packMonth && u.packMonth === (monthOf_(r[iAt]) || u.packMonth)) { u.packMonth = ''; touched[uid] = u; }
      }
    } else if (!canc && rf) {
      if (rf === 'да' && u && tk > 0) { OnionCore.adjustTokens(DB, u, -tk, 'Заказ ' + r[iNo] + ' снова в работе: ониксы списаны повторно'); touched[uid] = u; }
      if (rf === 'да' && u) { OnionCore.orderCanceled(DB, u, { no: r[iNo], at: +new Date(r[iAt]), total: money_(r[iTot]), kind: String(r[iKd]) }, -1); promoBack_(u, String(r[iPr] || '').trim(), true); touched[uid] = u; }
      nrf = '';
    }
    if (nrf !== rf) { var c2 = sh.getRange(i + 2, iRf + 1); c2.setNumberFormat('@'); c2.setValue(nrf); changed++; }
  });
  if (rmode) p.setProperty('refundMode', '1');
  Object.keys(touched).forEach(function (k) { DB.saveUser(touched[k]); });
  if (migrate) p.setProperty('xpMode', 'received');
  return changed;
}

/* ---------- правки в таблице сразу применяются к профилю (простой триггер, ничего включать не нужно) ---------- */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet(), name = sh.getName();
    if (name !== SHEET.orders && name !== SHEET.users) return;
    if (props_().getProperty('layoutVer') !== LAYOUT_VER) return; // таблица ещё не перестроена под новую версию
    var r0 = e.range.getRow(), c0 = e.range.getColumn(), r1 = r0 + e.range.getNumRows() - 1, c1 = c0 + e.range.getNumColumns() - 1;
    if (r1 < 2) return;
    var hit = function (cols, key) { var c = ci_(cols, key) + 1; return c >= c0 && c <= c1; };
    var single = r0 === r1 && c0 === c1;
    var lock = null;
    try { lock = LockService.getScriptLock(); lock.waitLock(20000); } catch (x) { lock = null; }
    try {
      USERS_CACHE_ = null;
      if (name === SHEET.orders) {
        if (hit(ORDER_COLS, 'status') || hit(ORDER_COLS, 'userId') || hit(ORDER_COLS, 'toPay')) syncXp_();
        return;
      }
      var any = ['balance', 'levelName', 'levelFix', 'xp', 'name', 'email', 'phone', 'tg', 'login'].some(function (k) { return hit(USER_COLS, k); });
      if (!any) return;
      var mk = OnionCore.monthKey(Date.now()), L = OnionCore.RULES.levels;
      users_().forEach(function (u) {
        if (u._row < r0 || u._row > r1) return;
        if (hit(USER_COLS, 'balance') && single) {
          var was = parseInt(e.oldValue, 10) || 0, d = (u.balance || 0) - was;
          if (d) DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: d, reason: 'Изменено вручную в таблице', balance: u.balance || 0 });
        }
        if (hit(USER_COLS, 'levelName')) { // уровень выбрали в колонке «Уровень», закрепляем его
          var fi = OnionCore.fixIndex(u.levelName);
          u.levelFix = fi >= 0 ? L[fi].name : '';
        }
        if (hit(USER_COLS, 'xp')) u.xpMonth = mk; // поправленная сумма относится к текущему месяцу
        DB.saveUser(u); // пересчитает «Уровень» и приведёт ключи к новым контактам
      });
    } finally { if (lock) lock.releaseLock(); }
  } catch (err) { console.error(err && err.stack || err); }
}

/* Стирает ВСЕ клиентские данные: клиентов, заказы, журнал ониксов, сессии и резервные копии листов.
   Промокоды и оформление остаются. Нумерация начнётся заново (клиенты с 1001, заказы с OS-…-00001).
   Запускается только вручную из меню и только после того, как введёшь слово УДАЛИТЬ. Отменить нельзя
   (разве что через «Файл → История версий»). */
/* ---------- очистка данных: каждый раздел отдельно ---------- */
function clearSheet_(name) {
  var sh = ss_().getSheetByName(name); if (!sh) return;
  var rows = sh.getMaxRows() - 1; if (rows > 0) sh.getRange(2, 1, rows, sh.getMaxColumns()).clearContent();
}
function dropBackups_() { ss_().getSheets().forEach(function (sh) { if (/\(резерв /.test(sh.getName())) ss_().deleteSheet(sh); }); }
/* what: orders | users | log | promos | personal | sessions | all */
function clearData_(what) {
  var T = {
    orders: ['Удалить все заказы?', 'Будут стёрты ВСЕ заказы на листе «Заказы», нумерация начнётся с 1. Клиенты, ониксы и промокоды останутся.', 'Заказы удалены. Нумерация заказов начнётся с OS-…-00001.'],
    users: ['Удалить всех клиентов?', 'Будут стёрты ВСЕ аккаунты клиентов (баланс, уровень, пароли) и их входы. Заказы и журнал ониксов останутся.', 'Все клиенты удалены. Люди смогут зарегистрироваться заново.'],
    log: ['Очистить журнал ониксов?', 'Будет стёрта история начислений и списаний ониксов. Балансы клиентов не изменятся.', 'Журнал ониксов очищен.'],
    promos: ['Удалить промокоды магазина?', 'Будут стёрты все строки на листе «Промокоды». Личные промокоды клиентов (из рулетки и уровней) останутся.', 'Промокоды магазина удалены. Новые добавляйте строками на листе «Промокоды».'],
    personal: ['Удалить личные промокоды клиентов?', 'У всех клиентов исчезнут промокоды из рулетки и за уровень. Промокоды магазина (лист «Промокоды») останутся.', 'Личные промокоды клиентов удалены.'],
    sessions: ['Выйти всем из аккаунтов?', 'Все клиенты будут разлогинены и войдут заново по логину и паролю. Данные не удаляются.', 'Все сессии сброшены.'],
    all: ['Удалить ВСЁ?', 'Будут стёрты ВСЕ клиенты, заказы и журнал ониксов. Промокоды магазина останутся.', 'Готово. Все клиенты, заказы и журнал ониксов удалены. Сайт можно проверять с чистого листа.']
  }[what];
  if (!T) return;
  var ui = SpreadsheetApp.getUi();
  var q = ui.prompt(T[0], T[1] + '\n\nЧтобы подтвердить, введите слово УДАЛИТЬ:', ui.ButtonSet.OK_CANCEL);
  if (q.getSelectedButton() !== ui.Button.OK || q.getResponseText().trim().toUpperCase() !== 'УДАЛИТЬ') { ui.alert('Отменено. Ничего не удалено.'); return; }
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var p = props_();
    if (what === 'orders' || what === 'all') { clearSheet_(SHEET.orders); p.setProperty('orderSeq', '0'); }
    if (what === 'users' || what === 'all') { clearSheet_(SHEET.users); clearSheet_(SHEET.sessions); p.setProperty('userSeq', '1000'); }
    if (what === 'log' || what === 'all') clearSheet_(SHEET.log);
    if (what === 'sessions') clearSheet_(SHEET.sessions);
    if (what === 'promos') clearSheet_(SHEET.promos);
    if (what === 'personal') { USERS_CACHE_ = null; users_().forEach(function (u) { if ((u.promos || []).length) { u.promos = []; DB.saveUser(u); } }); }
    if (what !== 'log' && what !== 'promos' && what !== 'sessions' && what !== 'personal') dropBackups_();
    USERS_CACHE_ = null;
    CacheService.getScriptCache().remove('catalog');
  } finally { lock.releaseLock(); }
  ui.alert(T[2]);
}
function clearOrders() { clearData_('orders'); }
function clearUsers() { clearData_('users'); }
function clearLog() { clearData_('log'); }
function clearPromos() { clearData_('promos'); }
function clearPersonalPromos() { clearData_('personal'); }
function clearSessions() { clearData_('sessions'); }
function clearAllData() { clearData_('all'); }

function recountLevels() {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  var n = 0;
  try { USERS_CACHE_ = null; ensureLayout_(); compactOrders_(); n = syncXp_(); users_().forEach(function (u) { OnionCore.touch(DB, u); DB.saveUser(u); }); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert('Готово. Обновлено заказов: ' + n + '. Уровни всех клиентов пересчитаны.');
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return out_({ ok: true, shop: 'ONION SHOP', settings: OnionCore.settings() }); }

function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out_({ ok: false, error: 'Неверный запрос' }); }
  if (p && p.update_id !== undefined && !p.action) return tgWebhook_(e, p); // сообщение от Telegram (webhook): отвечаем сразу
  if (p.action === 'settings') return out_(OnionCore.handle('settings', p, DB));
  if (p.action === 'reviews') { try { DB.catalog_ = null; return out_(OnionCore.handle('reviews', p, DB)); } catch (x) { return out_({ ok: false, error: 'Не удалось загрузить отзывы' }); } }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out_({ ok: false, error: 'Сервер занят, попробуйте через минуту' });
  try {
    USERS_CACHE_ = null; DB.catalog_ = null; DB.ledger_ = null;
    ensureLayout_();
    // тяжёлая сверка с таблицей (перенос строк, уровни, возврат ониксов), раз в минуту и всегда перед оформлением заказа;
    // раньше она шла на каждое нажатие и тормозила сайт. Ещё её каждую минуту делает бот (telegramTick).
    var cache = CacheService.getScriptCache();
    if (p.action === 'order' || !cache.get('syncAt')) {
      try { compactOrders_(); } catch (x) { console.error(x && x.stack || x); }
      try { syncXp_(); } catch (x) { console.error(x && x.stack || x); }
      cache.put('syncAt', '1', 60);
    }
    var res = OnionCore.handle(p.action, p, DB);
    SpreadsheetApp.flush();
    return out_(res);
  } catch (x) {
    console.error(x && x.stack || x);
    return out_({ ok: false, error: 'Ошибка сервера. Попробуйте ещё раз или напишите менеджеру' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- мгновенные ответы бота: Telegram сам присылает каждое сообщение сюда (webhook) ---------- */
function tgWebhook_(e, up) {
  var p = props_(), secret = p.getProperty('TG_SECRET');
  if (!secret || !e || !e.parameter || String(e.parameter.tg) !== secret) return out_({ ok: false });
  var cache = CacheService.getScriptCache(), key = 'upd:' + up.update_id, lastId = +(p.getProperty('tgLastUpd') || 0);
  // Google отвечает Telegram редиректом 302, поэтому Telegram повторяет доставку: каждое сообщение обрабатываем один раз
  if (cache.get(key) || (lastId && up.update_id < lastId - 300)) return out_({ ok: true, dup: true });
  cache.put(key, '1', 21600);
  if (up.update_id > lastId) p.setProperty('tgLastUpd', String(up.update_id));
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { cache.remove(key); return out_({ ok: false }); }
  try {
    USERS_CACHE_ = null; DB.catalog_ = null; DB.ledger_ = null;
    ensureLayout_();
    tgHandle_([up]);
    try { syncXp_(); } catch (x) { console.error(x && x.stack || x); }
    try { tgStatuses_(); } catch (x) { console.error(x && x.stack || x); }
  } catch (x) { console.error('webhook', x && x.stack || x); }
  finally { lock.releaseLock(); }
  return out_({ ok: true });
}
function webAppUrl_() {
  var u = props_().getProperty('WEBAPP_URL'); if (u) return u;
  try {
    var s = UrlFetchApp.fetch(siteBase_() + 'assets/config.js?t=' + Date.now(), { muteHttpExceptions: true }).getContentText();
    var m = /apiUrl:\s*"(https:\/\/script\.google\.com\/macros\/s\/[^"]+)"/.exec(s);
    if (m) { props_().setProperty('WEBAPP_URL', m[1]); return m[1]; }
  } catch (x) { }
  return '';
}
/* Включает webhook: Telegram шлёт сообщения сюда сразу, без минутного ожидания. Ответ: '' или текст ошибки. */
function enableWebhook_() {
  var p = props_(), token = p.getProperty('BOT_TOKEN'), url = webAppUrl_();
  if (!token) return 'Нет токена бота';
  if (!url) return 'Не нашёл адрес веб-приложения (assets/config.js)';
  var secret = p.getProperty('TG_SECRET');
  if (!secret) { secret = Utilities.getUuid().replace(/-/g, '').slice(0, 24); p.setProperty('TG_SECRET', secret); }
  var r = tgApi_('setWebhook', { url: url + '?tg=' + secret, allowed_updates: ['message', 'callback_query'], max_connections: 8, drop_pending_updates: false });
  if (!r || !r.ok) return 'Telegram не принял webhook: ' + (r && r.description || 'нет ответа');
  p.setProperty('tgWebhook', '1');
  return '';
}
function enableWebhook() {
  var err = enableWebhook_();
  Logger.log(err ? 'ОШИБКА: ' + err : 'Webhook включён');
  try { SpreadsheetApp.getUi().alert(err ? 'Не получилось: ' + err : 'Готово: бот теперь отвечает сразу.'); } catch (x) { }
}
function disableWebhook() {
  tgApi_('deleteWebhook', {}); props_().deleteProperty('tgWebhook');
  Logger.log('Webhook выключен, бот снова читает сообщения раз в минуту');
}
/* Диагностика: что Telegram думает о webhook (ошибки доставки, очередь) */
function webhookInfo() {
  var r = tgApi_('getWebhookInfo', {}), i = r && r.result || {};
  Logger.log('url=' + String(i.url || '').replace(/\?tg=.*/, '?tg=***') + ' | в очереди: ' + i.pending_update_count + ' | последняя ошибка: ' + (i.last_error_message || 'нет') + ' | когда: ' + (i.last_error_date ? new Date(i.last_error_date * 1000) : '-'));
}

/* ------------------------------------------------------------------ меню в таблице */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ONION SHOP')
    .addItem('1. Первичная настройка', 'setup')
    .addItem('2. Ввести токен Telegram-бота', 'setBotToken')
    .addItem('3. Привязать чат (после /start боту)', 'linkChat')
    .addSeparator()
    .addItem('4. Включить Telegram-уведомления клиентам', 'enableTelegram')
    .addItem('5. Бот отвечает мгновенно (webhook)', 'enableWebhook')
    .addItem('Примеры сообщений бота (мне)', 'botDemo')
    .addSeparator()
    .addItem('Начислить или списать ониксы', 'adminTokens')
    .addItem('Удалить клиента…', 'deleteClient')
    .addItem('Пересчитать уровни по заказам', 'recountLevels')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Очистка данных (по отдельности)')
      .addItem('Только заказы', 'clearOrders')
      .addItem('Только клиентов', 'clearUsers')
      .addItem('Только журнал ониксов', 'clearLog')
      .addItem('Только промокоды магазина', 'clearPromos')
      .addItem('Только личные промокоды клиентов', 'clearPersonalPromos')
      .addItem('Выйти всем из аккаунтов', 'clearSessions')
      .addSeparator()
      .addItem('Всё сразу (клиенты, заказы, журнал)', 'clearAllData'))
    .addItem('Обновить сводку', 'refreshSummary')
    .addItem('Оформить таблицу заново', 'relayout')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Служебные листы')
      .addItem('Показать («Учёт бонусов», «Игры»)', 'showServiceSheets')
      .addItem('Спрятать', 'hideServiceSheets'))
    .addItem('Отправить тестовое сообщение', 'testNotify')
    .addItem('Проверить письма с кодом', 'testMail')
    .addItem('Обновить каталог (сбросить кеш)', 'resetCatalogCache')
    .addItem('Ускорить обновление каталога (каждые 10 минут)', 'setupCatalogPing')
    .addItem('Обновить каталог с канала прямо сейчас', 'catalogPingNow')
    .addToUi();
}

function setup() {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    upgrade_();
    var first = ss_().getSheetByName('Лист1') || ss_().getSheetByName('Sheet1');
    if (first && first.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(first);
    var p = props_();
    if (!p.getProperty('CATALOG_URL')) p.setProperty('CATALOG_URL', CATALOG_URL_DEFAULT);
  } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert('Готово', 'Листы созданы и оформлены. Если сайт ещё не подключён: Начать развёртывание → Новое развёртывание → Веб-приложение (доступ: все), ссылку, в assets/config.js.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function relayout() {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { upgrade_(); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert('Таблица оформлена заново. Данные на месте.');
}

function setBotToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Токен бота', 'Создайте бота в @BotFather (/newbot) и вставьте сюда токен вида 123456:ABC…', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var t = r.getResponseText().trim();
  if (!/^\d+:[\w-]{30,}$/.test(t)) { ui.alert('Похоже, это не токен бота. Скопируйте его из @BotFather целиком.'); return; }
  props_().setProperty('BOT_TOKEN', t);
  var bot = '';
  try { bot = setupTelegram_(); } catch (e) { console.error(e); }
  ui.alert(bot ? 'Токен сохранён, бот @' + bot + ' включён: на «Старт» он отвечает приветствием, клиенты подключают уведомления на сайте.\n\nЧтобы заказы приходили вам, откройте бота, нажмите «Старт» и выберите пункт меню «3. Привязать чат».' : 'Токен сохранён, но Telegram не отозвался. Проверьте токен и повторите пункт 4 меню.');
}

/* ---------- уведомления клиентам в Telegram ----------
   Клиент нажимает на сайте «Подключить Telegram» → открывается бот с кодом → бот привязывает его чат.
   Раз в минуту (триггер telegramTick) бот читает такие нажатия, рассылает смену статусов заказов
   и сообщает, что товар из листа ожидания появился. */
function enableTelegram() {
  var ui = SpreadsheetApp.getUi();
  if (!props_().getProperty('BOT_TOKEN')) { ui.alert('Сначала пункт «2. Ввести токен Telegram-бота».'); return; }
  var bot = setupTelegram_();
  if (!bot) { ui.alert('Telegram не принял токен. Проверьте пункт 2 и попробуйте ещё раз.'); return; }
  ui.alert('Готово', 'Бот @' + bot + ' включён: он отвечает на «Старт» приветствием (до минуты) и рассылает уведомления подключившимся клиентам.', ui.ButtonSet.OK);
}
/* Включает бота: макет страницы листов, описание, минутный триггер. Возвращает username бота или ''. */
function setupTelegram_() {
  var p = props_();
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { upgrade_(); } finally { lock.releaseLock(); }
  p.deleteProperty('BOT_USER');
  var bot = DB.botUser();
  if (!bot) return '';
  var tg = function (m, o) { try { UrlFetchApp.fetch('https://api.telegram.org/bot' + p.getProperty('BOT_TOKEN') + '/' + m, { method: 'post', muteHttpExceptions: true, contentType: 'application/json', payload: JSON.stringify(o) }); } catch (e) { } };
  if (!p.getProperty('tgWebhook')) tg('deleteWebhook', {});
  tg('setMyDescription', { description: 'ONION SHOP: одежда, обувь и аксессуары в наличии и под заказ из Китая.\n\nЯ пришлю сообщение, когда заказ меняет статус или нужный товар снова в продаже. Нажмите «Старт», чтобы начать.' });
  setBotCommands_();
  tg('setMyShortDescription', { short_description: 'Статусы заказов ONION SHOP и новости о товарах' });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'telegramTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('telegramTick').timeBased().everyMinutes(1).create();
  CacheService.getScriptCache().remove('catalog');
  return bot;
}
function disableTelegram() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'telegramTick') ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getUi().alert('Рассылка клиентам выключена.');
}
function telegramPass_(onlyPoll) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    USERS_CACHE_ = null; DB.catalog_ = null; DB.ledger_ = null;
    if (!props_().getProperty('BOT_TOKEN')) return;
    if (!props_().getProperty('tgWebhook')) { try { tgPoll_(); } catch (e) { console.error('poll', e && e.stack || e); } }
    try { syncXp_(); } catch (e) { console.error('xp', e && e.stack || e); }
    try { tgStatuses_(); } catch (e) { console.error('status', e && e.stack || e); }
    try { tgPhotos_(); } catch (e) { console.error('photos', e && e.stack || e); }
    if (onlyPoll) return;
    try { tgWaits_(); } catch (e) { console.error('wait', e && e.stack || e); }
    try { tgWatch_(); } catch (e) { console.error('watch', e && e.stack || e); }
    try { tgReminders_(); } catch (e) { console.error('remind', e && e.stack || e); }
    try { tgNew_(); } catch (e) { console.error('new', e && e.stack || e); }
    try { tgPromo_(); } catch (e) { console.error('promo', e && e.stack || e); }
    try { tgNudge_(); } catch (e) { console.error('nudge', e && e.stack || e); }
    try { adminDigest_(); } catch (e) { console.error('digest', e && e.stack || e); }
  } finally { lock.releaseLock(); }
}
/* Раз в минуту. Если «горячее окно» открыто (клиент нажал «Подключить» или пришёл заказ), бот ещё ~45 секунд
   слушает Telegram и отвечает за 1-2 секунды. Блокировка берётся только на саму обработку, сайт не ждёт. */
function telegramTick() {
  telegramPass_(false);
  var p = props_();
  if (p.getProperty('tgWebhook')) return; // webhook включён: сообщения приходят сами, слушать не нужно
  if (!p.getProperty('BOT_TOKEN') || +(p.getProperty('tgHot') || 0) < Date.now()) return;
  var end = Date.now() + (+(p.getProperty('tgBurstMs') || 45000));
  while (Date.now() < end) {
    var ups = [];
    try { ups = tgFetch_(Math.max(1, Math.min(8, Math.floor((end - Date.now()) / 1000)))); } catch (e) { Utilities.sleep(1000); }
    if (ups.length) {
      var lock = LockService.getScriptLock();
      if (lock.tryLock(15000)) {
        try { USERS_CACHE_ = null; DB.catalog_ = null; tgHandle_(ups); try { syncXp_(); } catch (e) { } try { tgStatuses_(); } catch (e) { } } finally { lock.releaseLock(); }
      }
    }
  }
}
/* кнопки под новым заказом в чате менеджера: меняют статус прямо из Telegram */
function adminStages_(kind) { var R = OnionCore.RULES; return (kind === 'в наличии' || kind === 'временно нет' ? R.stagesStock : R.stagesPre).filter(function (x) { return x !== 'Оформлен'; }).concat(['Отменён']); }
function adminKeyboard_(no, kind) {
  var list = adminStages_(kind), rows = [[{ text: '💰 Оплачен', callback_data: 'p|' + no }]], row = [];
  list.forEach(function (st, i) { row.push({ text: (st === 'Отменён' ? '❌ ' : '') + st, callback_data: 's|' + no + '|' + i }); if (row.length === 2) { rows.push(row); row = []; } });
  if (row.length) rows.push(row);
  return rows;
}
function tgFetch_(timeout) {
  var p = props_(), off = parseInt(p.getProperty('tgOffset') || '0', 10) || 0;
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + p.getProperty('BOT_TOKEN') + '/getUpdates?timeout=' + timeout + '&offset=' + off, { muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  return data.ok ? (data.result || []) : [];
}
function tgPoll_() { tgHandle_(tgFetch_(0)); }
/* фотоотчёт: как только менеджер вставил ссылку в «Фотоотчёт», клиент получает сообщение в Telegram */
function tgPhotos_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return;
  var rows = orderRows_(), iNo = ci_(ORDER_COLS, 'no'), iP = ci_(ORDER_COLS, 'photoRep'), iS = ci_(ORDER_COLS, 'photoSent'), iU = ci_(ORDER_COLS, 'userId'), sent = 0;
  if (iP < 0 || iS < 0) return;
  rows.forEach(function (r, i) {
    var links = OnionCore.photoLinks(r[iP]), key = links.join(' ');
    if (!links.length || String(r[iS] || '') === key || sent >= 20) return;
    var uid = normId_(r[iU]), u = uid ? DB.getUser(uid) : null, no = String(r[iNo]).trim();
    if (u && u.tgChat) { DB.userNotify(u, '📸 Фотоотчёт по заказу ' + no + ' готов: посмотрите, как выглядит ваша вещь перед отправкой.', [links.slice(0, 3).map(function (l, k) { return { text: 'Фото ' + (k + 1), url: l }; })]); sent++; }
    var c = sh.getRange(i + 2, iS + 1); c.setNumberFormat('@'); c.setValue(key);
  });
}
/* снижение цены на вещи из избранного, раз в 3 часа */
function tgWatch_() {
  var c = CacheService.getScriptCache(); if (c.get('watchAt') || !autoCfg_().drop) return; c.put('watchAt', '1', 10800);
  if (!DB.catalogReady()) return;
  var sent = 0;
  users_().forEach(function (u) {
    if (!u.watch || sent >= 40) return;
    var before = JSON.stringify(u.watch), drops = OnionCore.priceDrops(DB, u);
    if (drops.length && u.tgChat) {
      var t = '📉 <b>' + pick_(V_.drop) + '</b>\n———\n' + drops.slice(0, 5).map(function (d) { return '•<i>' + hesc_(d.title) + '</i>: <s>' + d.was + '</s> <b>' + d.now + '</b>'; }).join('\n');
      // tgSend_ отправляет с parse_mode HTML: раньше клиент видел в сообщении теги <b>, <s> как текст
      tgSend_(u.tgChat, t, [drops.slice(0, 3).map(function (d) { return { text: 'Открыть: ' + String(d.title).slice(0, 18), url: siteUrl_('p-' + d.id) }; })]); sent++;
    }
    if (JSON.stringify(u.watch) !== before) DB.saveUser(u);
  });
}
function tgStatuses_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return;
  var rows = orderRows_(), iNo = ci_(ORDER_COLS, 'no'), iSt = ci_(ORDER_COLS, 'status'), iN = ci_(ORDER_COLS, 'notified'), iU = ci_(ORDER_COLS, 'userId'), iRm = ci_(ORDER_COLS, 'remind'), iIt = ci_(ORDER_COLS, 'items'), sent = 0;
  rows.forEach(function (r, i) {
    var no = String(r[iNo]).trim(), st = String(r[iSt]).trim(), nt = String(r[iN] || '').trim();
    if (!no || !st || nt === st || sent >= 25) return;
    var uid = normId_(r[iU]), u = uid ? DB.getUser(uid) : null;
    if (nt && u && u.tgChat) {
      var text = statusText_(no, st), photo = '';
      if (st === 'На складе' || st === 'Получен') { try { var it = JSON.parse(r[iIt] || '[]')[0]; if (it && (it.photo || it.thumb)) photo = photoUrl_(it.photo || it.thumb); } catch (e) { } }
      var kb = statusKb_(no, st);
      sendPostTo_(u, { text: text, photo: photo, kb: kb });
      sent++;
    }
    var c = sh.getRange(i + 2, iN + 1); c.setNumberFormat('@'); c.setValue(st);
    if (st === 'Получен') setRemind_(sh, i + 2, iRm, r[iRm], { got: Date.now() });
  });
}
function setRemind_(sh, row, iRm, cur, patch) {
  var o = {}; try { o = cur ? JSON.parse(cur) : {}; } catch (e) { o = {}; }
  Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
  var c = sh.getRange(row, iRm + 1); c.setNumberFormat('@'); c.setValue(JSON.stringify(o));
}
/* напоминания: оплата через сутки, отзыв через 3 дня после «Получен» */
function tgReminders_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return;
  var rows = orderRows_(), I = function (k) { return ci_(ORDER_COLS, k); }, now = Date.now(), sent = 0;
  rows.forEach(function (r, i) {
    if (sent >= 15) return;
    var no = String(r[I('no')]).trim(); if (!no) return;
    var uid = normId_(r[I('userId')]), u = uid ? DB.getUser(uid) : null; if (!u || !u.tgChat) return;
    var st = String(r[I('status')]).trim(), rm = {}; try { rm = r[I('remind')] ? JSON.parse(r[I('remind')]) : {}; } catch (e) { rm = {}; }
    var at = r[I('at')] instanceof Date ? r[I('at')].getTime() : 0;
    if (st === 'Оформлен' && !isTrue_(r[I('paid')]) && !rm.pay && at && now - at > 86400000) {
      if (autoCfg_().remind) notifyHtml_(u, payText_(no, money_(r[I('toPay')])), [[{ text: '📦 Заказ', callback_data: 'm|' + no }, { text: '💬 Вопрос по оплате', callback_data: 'q|' + no }]]);
      setRemind_(sh, i + 2, I('remind'), r[I('remind')], { pay: 1 }); sent++;
    } else if (st === 'Получен' && rm.got && !rm.rev && now - rm.got > 3 * 86400000) {
      var items = []; try { items = JSON.parse(r[I('items')] || '[]'); } catch (e) { }
      var done = DB.reviewKeys(u.id), left = items.filter(function (it) { return done.indexOf(no + '|' + it.id) < 0; });
      if (left.length && autoCfg_().remind) { notifyHtml_(u, reviewText_(no, OnionCore.RULES.reward.review, OnionCore.RULES.reward.reviewText), [[{ text: '⭐ Оставить отзыв', url: siteUrl_('orders') }]]); sent++; }
      setRemind_(sh, i + 2, I('remind'), r[I('remind')], { rev: 1 });
    }
  });
}
/* скидки: раз в 3 дня около 18:00 по Москве, тем, у кого подключён бот; каждый раз новыми словами */
function tgPromo_() {
  var p = props_(), now = Date.now(), h = mskHour_();
  if (h < 18 || h > 19 || !autoCfg_().sale) return;
  if (now - (+p.getProperty('promoAt') || 0) < 3 * 86400000 - 3600000) return;
  var b = bcBuild_({ t: 'sale', iv: Math.floor(Math.random() * 20) });
  p.setProperty('promoAt', String(now));
  if (!b) return;
  var sent = 0;
  users_().forEach(function (u) { if (u.tgChat && sent < 100 && canPush_(u, 20)) { if (sendPostTo_(u, b)) { sent++; markPush_(u); } } });
}
/* новинки: как только появились в каталоге (днём, с 10 до 21 по Москве), всем с подключённым ботом */
function tgNew_() {
  var cat = DB.loadCatalog_(); if (!cat) return;
  var p = props_(), seen = p.getProperty('seenIds'), ids = Object.keys(cat);
  if (seen === null) { p.setProperty('seenIds', ids.join(',').slice(-8500)); return; }
  var S = {}; seen.split(',').forEach(function (x) { S[x] = 1; });
  var fresh = ids.filter(function (id) { return !S[id] && cat[id].status !== 'out' && cat[id].status !== 'sold'; });
  if (!fresh.length) { if (ids.join(',').slice(-8500) !== seen) p.setProperty('seenIds', ids.join(',').slice(-8500)); return; }
  var h = mskHour_(); if (h < 10 || h >= 21) return; // ночью не беспокоим, отправим утром
  if (!autoCfg_().fresh) { p.setProperty('seenIds', ids.join(',').slice(-8500)); return; }
  fresh.sort(function (a, b) { return b - a; });
  var b = fresh.length === 1 ? bcBuild_({ t: 'prod', id: fresh[0], iv: Math.floor(Math.random() * 20) }) : (function () {
    var L = fresh.slice(0, 5).map(function (id) { return cat[id]; });
    return { text: '🆕 <b>' + fill_(pick_(V_.freshN), { n: fresh.length }) + '</b>\n———\n' + L.map(function (c) { return '•<i>' + hesc_(c.title) + '</i>: ' + c.price; }).join('\n'), photo: prodPhoto_(L[0]), kb: L.map(function (c) { return [{ text: String(c.title).slice(0, 34) + ' · ' + c.price, url: siteUrl_('p-' + c.id) }]; }) };
  })();
  p.setProperty('seenIds', ids.join(',').slice(-8500));
  if (!b) return;
  var sent = 0;
  users_().forEach(function (u) { if (u.tgChat && sent < 150 && canPush_(u, 3)) { if (sendPostTo_(u, b)) { sent++; markPush_(u); } } });
}
/* «давно не заходили»: раз в день около 12:00 пишем тем, кто не заказывал больше месяца (не чаще раза в 3 недели) */
function tgNudge_() {
  var p = props_(), now = Date.now(), h = mskHour_(), day = Utilities.formatDate(new Date(now), 'Europe/Moscow', 'yyyy-MM-dd');
  if (h < 12 || h > 14 || p.getProperty('nudgeDay') === day || !autoCfg_().nudge) return;
  p.setProperty('nudgeDay', day);
  var L = freshList_(1); if (!L.length) return;
  var last = {};
  ordersAll_().forEach(function (o) { var uid = normId_(o.userId), t = o.at instanceof Date ? o.at.getTime() : 0; if (uid && t > (last[uid] || 0)) last[uid] = t; });
  var sent = 0;
  users_().forEach(function (u) {
    if (!u.tgChat || sent >= 20) return;
    var reg = u.createdAt ? new Date(u.createdAt).getTime() : 0, lo = Math.max(last[u.id] || 0, reg);
    if (!lo || now - lo < 30 * 86400000 || (u.lastNudge && now - u.lastNudge < 21 * 86400000) || !canPush_(u, 20)) return;
    var b = { text: '👋 <b>' + pick_(V_.winback) + '</b>\n\n' + postCaption_(L[0]), photo: prodPhoto_(L[0]), kb: [[{ text: '🛍 Открыть товар', url: siteUrl_('p-' + L[0].id) }], [{ text: '🛍 Весь каталог', url: siteUrl_('catalog') }]] };
    if (sendPostTo_(u, b)) { u.lastNudge = now; markPush_(u); sent++; }
  });
}function tgWaits_() {
  var sh = ss_().getSheetByName(SHEET.waits); if (!sh) return;
  var iS = ci_(WAIT_COLS, 'sent'), sent = 0;
  DB.waitRows_().forEach(function (w) {
    if (String(w.sent || '').trim() || sent >= 25) return;
    var pr = DB.product(w.productId);
    if (!pr || pr.status === 'out' || pr.status === 'sold') return;
    var u = DB.getUser(w.userId);
    if (u && u.tgChat) {
      var b = { text: '🛍 <b>' + fill_(pick_(V_.restock), { t: hesc_(w.title) }) + '</b>' + (pr ? '\n\n' + postCaption_(pr) : ''), photo: prodPhoto_(pr), kb: [[{ text: '🛍 Открыть товар', url: siteUrl_('p-' + w.productId) }]] };
      sendPostTo_(u, b); sent++;
    }
    var c = sh.getRange(w._row, iS + 1); c.setNumberFormat('@'); c.setValue(mskText_(Date.now()));
  });
}

/* Удалить одного клиента: встаньте на его строку в листе «Клиенты» и выберите пункт меню (или введите ID / логин) */
function deleteClient() {
  var ui = SpreadsheetApp.getUi(), key = '';
  var sh = ss_().getActiveSheet();
  if (sh.getName() === SHEET.users) {
    var r = sh.getActiveCell().getRow();
    if (r > 1) key = String(sh.getRange(r, 1).getValue()).trim();
  }
  if (!key) {
    var q = ui.prompt('Удалить клиента', 'Введите ID клиента (колонка «ID», например 1005) или его логин.\nСовет: можно сначала встать на строку клиента в листе «Клиенты».', ui.ButtonSet.OK_CANCEL);
    if (q.getSelectedButton() !== ui.Button.OK) return;
    key = q.getResponseText().trim();
  }
  USERS_CACHE_ = null;
  var u = DB.getUser(normId_(key)) || DB.findUser('login', key.replace(/^@/, '').toLowerCase());
  if (!u) { ui.alert('Клиент «' + key + '» не найден.'); return; }
  var ords = orderRows_().map(function (r, i) { return { row: i + 2, uid: normId_(r[ci_(ORDER_COLS, 'userId')]), no: r[ci_(ORDER_COLS, 'no')] }; }).filter(function (o) { return o.uid === u.id; });
  var a = ui.alert('Удалить клиента?', 'ID ' + u.id + ' · @' + u.login + ' · ' + (u.name || '') + '\nОниксов на балансе: ' + (u.balance || 0) + '\nЗаказов: ' + ords.length + '\n\nАккаунт и вход будут удалены без возможности восстановления. Удалить?', ui.ButtonSet.YES_NO);
  if (a !== ui.Button.YES) { ui.alert('Отменено. Ничего не удалено.'); return; }
  var delOrders = false;
  if (ords.length) {
    var b = ui.alert('Что сделать с заказами клиента (' + ords.length + ')?', 'ДА: оставить заказы в таблице (это история продаж, рекомендуется).\nНЕТ: удалить и заказы клиента.', ui.ButtonSet.YES_NO);
    delOrders = b === ui.Button.NO;
  }
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var wr = DB.waitRows_().filter(function (w) { return w.userId === u.id; }).map(function (w) { return w._row; }).sort(function (x, y) { return y - x; });
    var ws = ss_().getSheetByName(SHEET.waits); wr.forEach(function (rw) { ws.deleteRow(rw); });
    DB.deleteSessionsOf(u.id);
    DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: -(u.balance || 0), reason: 'Клиент удалён менеджером', balance: 0 });
    DB.deleteUser(u);
    if (delOrders) { var os = ss_().getSheetByName(SHEET.orders); ords.sort(function (x, y) { return y.row - x.row; }).forEach(function (o) { os.deleteRow(o.row); }); }
    USERS_CACHE_ = null;
  } finally { lock.releaseLock(); }
  ui.alert('Клиент @' + u.login + ' удалён' + (delOrders ? ' вместе с заказами.' : '. Заказы остались в таблице.'));
}

function linkChat() {
  var ui = SpreadsheetApp.getUi(), token = props_().getProperty('BOT_TOKEN');
  if (!token) { ui.alert('Сначала пункт «2. Ввести токен Telegram-бота».'); return; }
  var cur = props_().getProperty('ADMIN_CHAT_ID');
  ui.alert('Чат менеджера', 'Панель менеджера привязывается автоматически к аккаунту @' + adminUser_() + '.\n\nОткройте бота с этого аккаунта и отправьте ему /start (или любое сообщение): через минуту придёт подтверждение.\n\nСейчас привязан чат: ' + (cur || 'нет') + '. Другие аккаунты прав менеджера не получают.', ui.ButtonSet.OK);
  DB.hot(5);
}

function testNotify() {
  var ok = DB.notify('🧪 Тест ONION SHOP: ' + mskText_(Date.now()) + '. Уведомления работают.');
  SpreadsheetApp.getUi().alert(ok ? 'Сообщение отправлено.' : 'Не получилось. Проверьте пункты 2 и 3 меню.');
}

function testMail() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Проверка писем', 'На какую почту прислать тестовое письмо с кодом?', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var to = r.getResponseText().trim();
  var ok = DB.mail(to, 'Код ONION SHOP: 123456 (проверка)', '123456', 'для проверки', '');
  ui.alert(ok ? 'Письмо отправлено на ' + to + '. Осталось писем на сегодня: ' + MailApp.getRemainingDailyQuota() : 'Не получилось отправить письмо.');
}

function resetCatalogCache() { CacheService.getScriptCache().remove('catalog'); SpreadsheetApp.getUi().alert('Кеш каталога сброшен.'); }

function adminTokens() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Ониксы', 'Логин клиента:', ui.ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui.Button.OK) return;
  var u = DB.findUser('login', a.getResponseText().trim().toLowerCase());
  if (!u) { ui.alert('Клиент не найден.'); return; }
  var b = ui.prompt('Ониксы для ' + u.login + ' (сейчас ' + u.balance + ')', 'Сколько начислить? Для списания поставьте минус, например -100:', ui.ButtonSet.OK_CANCEL); if (b.getSelectedButton() !== ui.Button.OK) return;
  var d = parseInt(b.getResponseText(), 10); if (!d) { ui.alert('Нужно число.'); return; }
  var c = ui.prompt('Причина', 'Например: отзыв с фото', ui.ButtonSet.OK_CANCEL); if (c.getSelectedButton() !== ui.Button.OK) return;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    USERS_CACHE_ = null; u = DB.findUser('login', u.login);
    u.balance = Math.max(0, (u.balance || 0) + d);
    DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: d, reason: c.getResponseText() || 'Вручную', balance: u.balance });
    DB.saveUser(u);
  } finally { lock.releaseLock(); }
  ui.alert('Готово. Баланс ' + u.login + ': ' + u.balance + ' ониксов.');
}

/* ====== Ускоренное обновление каталога ======
   GitHub запускает расписание «каждые 15 минут» примерно раз в час. Чтобы товары из канала появлялись быстрее,
   таблица сама каждые 10 минут «нажимает» Run workflow через GitHub API. Нужен токен GitHub (Fine-grained,
   только этот репозиторий, право Actions: Read and write): хранится в свойствах скрипта, на сайт не попадает. */
var GH_REPO_ = 'onion-shop/ONION-SHOP-CATALOG';
function setupCatalogPing() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Токен GitHub', 'GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate.\nRepository access: Only select repositories → ONION-SHOP-CATALOG. Permissions → Actions: Read and write.\nВставьте токен (github_pat_…):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var t = r.getResponseText().trim();
  if (!/^(github_pat_|ghp_)[\w]{20,}$/.test(t)) { ui.alert('Похоже, это не токен GitHub.'); return; }
  props_().setProperty('GH_TOKEN', t);
  var res = ghDispatch_();
  if (!res.ok) { props_().deleteProperty('GH_TOKEN'); ui.alert('GitHub не принял токен: ' + res.msg + '\nПроверьте право Actions: Read and write и что выбран репозиторий ' + GH_REPO_ + '.'); return; }
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === 'catalogPingTick') ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('catalogPingTick').timeBased().everyMinutes(10).create();
  ui.alert('Готово. Каталог теперь обновляется каждые 10 минут (сам запуск занимает ещё 1-2 минуты). Первый запуск уже отправлен.');
}
function ghDispatch_() {
  var t = props_().getProperty('GH_TOKEN'); if (!t) return { ok: false, msg: 'нет токена' };
  try {
    var r = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO_ + '/actions/workflows/sync.yml/dispatches', { method: 'post', muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, payload: JSON.stringify({ ref: 'main' }) });
    var c = r.getResponseCode();
    return { ok: c === 204, msg: 'код ' + c + ' ' + String(r.getContentText()).slice(0, 120) };
  } catch (e) { return { ok: false, msg: String(e) }; }
}
function catalogPingTick() { var r = ghDispatch_(); if (!r.ok) console.error('catalog ping', r.msg); }
function catalogPingNow() {
  var ui = SpreadsheetApp.getUi();
  if (!props_().getProperty('GH_TOKEN')) { ui.alert('Сначала пункт «Ускорить обновление каталога», там один раз вводится токен GitHub.'); return; }
  var r = ghDispatch_(); CacheService.getScriptCache().remove('catalog');
  ui.alert(r.ok ? 'Запущено. Товары появятся на сайте через 1-2 минуты.' : 'Не получилось: ' + r.msg);
}
