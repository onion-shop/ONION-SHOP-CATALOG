/* Запустить один раз (кнопка «Выполнить»), чтобы разрешить отправку писем с кодами. */
function allowMail() { Logger.log('Можно отправить писем сегодня: ' + MailApp.getRemainingDailyQuota()); }

/* ===================================================================
   ONION SHOP: сервер на Google Таблице (Google Apps Script)
   Хранит аккаунты, ониксы и заказы, даёт номера заказов по порядку,
   крутит рулетку на сервере, проверяет промокоды и присылает заказы в Telegram.
   Настройка: в файле «Google-Таблица и бот.md». Код ниже трогать не нужно.
   =================================================================== */

var CATALOG_URL_DEFAULT = 'https://onion-shop.github.io/ONION-SHOP-CATALOG/data/catalog.js';
var LAYOUT_VER = '15';

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
  ['reward', 'Ониксов выдано', { w: 90, t: 'num', old: ['Токенов выдано'] }],
  ['photoSt', 'Фото покупателя', { w: 130, t: 'text', edit: true }], ['photos', 'служебное: фото (Google Диск)', { w: 120, svc: true, t: 'text' }],
  ['productId', 'служебное: id товара', { w: 80, svc: true, t: 'text' }]
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
    return cols.map(function (c, k) { var j = map[k]; if (j < 0) return c[2] && c[2].t === 'check' ? false : ''; return formulas[ri][j] || safeCell_(r[j]); });
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
  var iP = ci_(REVIEW_COLS, 'photoSt') + 1;
  sh.getRange(2, iP, maxR - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['на проверке', 'показывать', 'скрыть'], true).setAllowInvalid(true).build());
  sh.getRange(1, iP).setNote('Фото, которые покупатель приложил к отзыву. «показывать»: фото видны на сайте под отзывом. Проще всего одобрять кнопками в боте: они приходят вместе с отзывом.');
  sh.setConditionalFormatRules(sh.getConditionalFormatRules().concat([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('на проверке').setBackground('#fff4d6').setFontColor('#92400e').setRanges([sh.getRange(2, iP, maxR - 1, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('показывать').setBackground('#e3f6ea').setFontColor('#166534').setRanges([sh.getRange(2, iP, maxR - 1, 1)]).build()]));
}
/* папка для фото из отзывов (создаётся один раз) и ссылка на картинку для сайта */
function reviewFolder_() {
  var p = props_(), id = p.getProperty('REVIEW_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder('ONION SHOP: фото отзывов');
  p.setProperty('REVIEW_FOLDER', f.getId());
  return f;
}
function drivePhotoUrl_(id) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200'; }
/* менеджер одобряет или скрывает фото отзыва (кнопка в боте): ищем отзыв по заказу и товару */
function setReviewPhotoSt_(no, pid, st) {
  var sh = ss_().getSheetByName(SHEET.reviews); if (!sh) return false;
  var rows = DB.reviewRows_(), i = -1;
  rows.forEach(function (r, k) { if (r.no === no && r.productId === pid) i = k; });
  if (i < 0) return false;
  sh.getRange(i + 2, ci_(REVIEW_COLS, 'photoSt') + 1).setValue(st);
  return true;
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
    return safeCell_(v);
  });
}
/* Защита таблицы от «формул в тексте». Строка от клиента, которая начинается с = + или -, иначе стала бы формулой:
   например, имя «=IMPORTXML(…)» при открытии таблицы отправило бы чужие данные на посторонний сайт.
   Такая строка записывается как обычный текст (апостроф в начале Google не показывает). Телефоны, числа и @ники не трогаем. */
function safeCell_(v) {
  if (typeof v !== 'string' || !v) return v;
  if (/^[=+\-\t\r]/.test(v) && !/^[+\-]?[\d\s().,\-]+$/.test(v)) return "'" + v;
  return v;
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
    var row = vals[m[0]].map(function (v, k) { return forms[m[0]][k] || safeCell_(v); });
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
    row.itemsText = o.items.map(function (it) { return it.title + (it.size ? ', ' + it.size : '') + (it.color ? ', ' + it.color : '') + ' × ' + it.qty; }).join('\n');
    row.items = JSON.stringify(o.items);
    row.at = new Date(o.at);
    row.paid = false; row.status = o.status || 'Оформлен';
    if (!row.tg || row.tg === '@') row.tg = '';
    var tgName = String(row.tg || '').replace(/^@/, ''), digits = String(o.phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '7' + digits;
    row.contact = tgName ? F_('=HYPERLINK("https://t.me/' + tgName + '","Telegram ↗")') : digits ? F_('=HYPERLINK("https://t.me/+' + digits + '","По номеру ↗")') : '';
    row.xpDone = ''; row.refunded = ''; row.notified = row.status; row.remind = '';
    var sh = sheet_(SHEET.orders, ORDER_COLS), r = freeRow_(sh);
    sh.getRange(r, 1, 1, ORDER_COLS.length).setValues([ORDER_COLS.map(function (c) { var v = row[c[0]]; return v === undefined || v === null ? '' : c[0] === 'contact' ? v : safeCell_(v); })]);
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
    sheet_(SHEET.log, LOG_COLS).appendRow([new Date(e.at), safeCell_(String(e.userId == null ? '' : e.userId)), safeCell_(e.login), e.delta, safeCell_(e.reason), e.balance]);
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
    sh.getRange(row, 1, 1, REVIEW_COLS.length).setValues([REVIEW_COLS.map(function (c) { var v = o[c[0]]; return v === undefined || v === null ? '' : safeCell_(v); })]);
    sh.getRange(row, ci_(REVIEW_COLS, 'text') + 1).setWrap(true);
    try { reviewToManager_(r, row); } catch (e) { console.error('review notify', e && e.stack || e); }
  },
  reviewsFor: function (pid) {
    return DB.reviewRows_().filter(function (r) { return r.productId === pid && String(r.status).trim() !== 'скрыт' && +r.rating >= 1; }).reverse().map(function (r) {
      var ph = String(r.photoSt || '').trim() === 'показывать' ? String(r.photos || '').split(/\s+/).filter(function (id) { return /^[\w-]{10,}$/.test(id); }).map(drivePhotoUrl_) : [];
      return { name: r.name, rating: +r.rating, text: String(r.text || ''), at: r.at instanceof Date || typeof r.at === 'number' ? mskText_(+new Date(r.at)).slice(0, 10) : String(r.at).slice(0, 10), photos: ph };
    });
  },
  /* фото к отзыву: в папку «ONION SHOP: фото отзывов» на Google Диске владельца, доступ «по ссылке, только просмотр» */
  savePhoto: function (dataUrl, name) {
    try {
      var bytes = Utilities.base64Decode(String(dataUrl).replace(/^data:image\/jpeg;base64,/, ''));
      if (bytes.length < 200 || bytes.length > 400000 || (bytes[0] & 255) !== 0xFF || (bytes[1] & 255) !== 0xD8) return '';
      var f = reviewFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', String(name).replace(/[^\w.-]/g, '_') + '.jpg'));
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return f.getId();
    } catch (e) { console.error('savePhoto', e && e.stack || e); return ''; }
  },
  waitRows_: function () {
    var sh = ss_().getSheetByName(SHEET.waits); if (!sh) return [];
    var n = sh.getLastRow() - 1; if (n <= 0) return [];
    return sh.getRange(2, 1, n, WAIT_COLS.length).getValues().map(function (r, i) { var o = rowToObj_(r, WAIT_COLS); o._row = i + 2; o.userId = normId_(o.userId); o.productId = String(o.productId); return o; });
  },
  waitsOf: function (uid) { return DB.waitRows_().filter(function (w) { return w.userId === String(uid) && w.productId; }); },
  waitAdd: function (w) {
    var sh = sheet_(SHEET.waits, WAIT_COLS), row = freeRow_(sh), o = Object.assign({}, w); o.at = new Date(w.at);
    sh.getRange(row, 1, 1, WAIT_COLS.length).setValues([WAIT_COLS.map(function (c) { var v = o[c[0]]; return v === undefined || v === null ? '' : safeCell_(v); })]);
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
  // раз в час: если сайт уже ходит в новое развёртывание (адрес /exec сменился), переводим туда и бота
  try {
    var uc = CacheService.getScriptCache();
    if (!uc.get('urlChk')) {
      uc.put('urlChk', '1', 3600);
      var cur = ScriptApp.getService().getUrl(), pr0 = props_();
      if (cur && /\/exec$/.test(cur) && cur !== pr0.getProperty('WEBAPP_URL')) pr0.setProperty('WEBAPP_URL', cur);
    }
  } catch (x) { }
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
    tgHandle_([up]); // только ответ на сообщение: тяжёлые сверки делает минутный триггер, чтобы бот отвечал за секунду
  } catch (x) { console.error('webhook', x && x.stack || x); }
  finally { lock.releaseLock(); }
  return out_({ ok: true });
}
function webAppUrl_() {
  var u = props_().getProperty('WEBAPP_URL'); if (u) return u;
  try { var su = ScriptApp.getService().getUrl(); if (su && /\/exec$/.test(su)) { props_().setProperty('WEBAPP_URL', su); return su; } } catch (x) { }
  try {
    var s = UrlFetchApp.fetch(siteBase_() + 'assets/config.js?t=' + Date.now(), { muteHttpExceptions: true }).getContentText();
    var m = /apiUrl:\s*"(https:\/\/script\.google\.com\/macros\/s\/[^"]+)"/.exec(s);
    if (m) { props_().setProperty('WEBAPP_URL', m[1]); return m[1]; }
  } catch (x) { }
  return '';
}
/* Включает webhook: Telegram шлёт сообщения сюда сразу, без минутного ожидания. Ответ: '' или текст ошибки. */
/* Важно: Apps Script на любой POST отвечает Telegram редиректом 302, а Telegram считает это ошибкой и повторяет одно и то же сообщение, из-за чего очередь встаёт и бот молчит.
   Поэтому webhook включается ТОЛЬКО через прокси-адрес (свойство WEBHOOK_RELAY, например Cloudflare Worker), который отвечает Telegram кодом 200 сразу и сам передаёт сообщение сюда.
   Без прокси бот работает через опрос раз в минуту: медленнее, но надёжно. */
function enableWebhook_() {
  var p = props_(), token = p.getProperty('BOT_TOKEN'), url = p.getProperty('WEBHOOK_RELAY') || '';
  if (!token) return 'Нет токена бота';
  if (!url) return 'Прокси для мгновенных ответов не настроен (свойство WEBHOOK_RELAY)';
  var secret = p.getProperty('TG_SECRET');
  if (!secret) { secret = Utilities.getUuid().replace(/-/g, '').slice(0, 24); p.setProperty('TG_SECRET', secret); }
  var r = tgApi_('setWebhook', { url: url.replace(/\/+$/, '') + '/?tg=' + secret, allowed_updates: ['message', 'callback_query'], max_connections: 8, drop_pending_updates: false });
  if (!r || !r.ok) return 'Telegram не принял webhook: ' + (r && r.description || 'нет ответа');
  p.setProperty('tgWebhook', '1');
  return '';
}
function enableWebhook() {
  var err = enableWebhook_();
  Logger.log(err ? 'ОШИБКА: ' + err : 'Webhook включён');
  try { SpreadsheetApp.getUi().alert(err ? 'Не получилось: ' + err : 'Готово: бот теперь отвечает сразу.'); } catch (x) { }
}
function disableWebhook_() { tgApi_('deleteWebhook', { drop_pending_updates: false }); props_().deleteProperty('tgWebhook'); }
function disableWebhook() {
  disableWebhook_();
  Logger.log('Webhook выключен, бот снова читает сообщения раз в минуту');
}
/* Диагностика: что Telegram думает о webhook (ошибки доставки, очередь) */
function webhookInfo() {
  var r = tgApi_('getWebhookInfo', {}), i = r && r.result || {};
  Logger.log('url=' + String(i.url || '').replace(/\?tg=.*/, '?tg=***') + ' | в очереди: ' + i.pending_update_count + ' | последняя ошибка: ' + (i.last_error_message || 'нет') + ' | когда: ' + (i.last_error_date ? new Date(i.last_error_date * 1000) : '-'));
}

/* ------------------------------------------------------------------ меню в таблице
   Сгруппировано по задачам: заказы, клиенты, промокоды и отзывы, отчёты, бот, настройка. */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ONION SHOP')
    .addSubMenu(ui.createMenu('📦 Заказы')
      .addItem('Найти заказ по номеру…', 'findOrder')
      .addItem('Показать только активные', 'filterActiveOrders')
      .addItem('Показать неоплаченные', 'filterUnpaidOrders')
      .addItem('Показать все заказы', 'filterAllOrders'))
    .addSubMenu(ui.createMenu('👤 Клиенты')
      .addItem('Найти клиента…', 'findClientUi')
      .addItem('Начислить или списать ониксы…', 'adminTokens')
      .addItem('Удалить клиента…', 'deleteClient')
      .addItem('Пересчитать уровни по заказам', 'recountLevels'))
    .addSubMenu(ui.createMenu('🏷 Промокоды и отзывы')
      .addItem('Создать промокод…', 'createPromoUi')
      .addItem('Фото из отзывов на проверке', 'showReviewQueue'))
    .addSubMenu(ui.createMenu('📊 Отчёты')
      .addItem('Аналитика продаж (обновить лист)', 'buildAnalytics')
      .addItem('Обновить сводку', 'refreshSummary'))
    .addSubMenu(ui.createMenu('🤖 Telegram-бот')
      .addItem('Ввести токен бота', 'setBotToken')
      .addItem('Включить бота и уведомления клиентам', 'enableTelegram')
      .addItem('Мгновенные ответы (webhook)', 'enableWebhook')
      .addItem('Проверить связь с ботом', 'webhookInfoUi')
      .addItem('Чат менеджера: как привязать', 'linkChat')
      .addItem('Примеры сообщений бота (мне)', 'botDemo')
      .addItem('Отправить мне тестовое сообщение', 'testNotify'))
    .addSubMenu(ui.createMenu('⚙️ Настройка и обслуживание')
      .addItem('Первичная настройка', 'setup')
      .addItem('Оформить таблицу заново', 'relayout')
      .addItem('Проверить письма с кодом', 'testMail')
      .addItem('Обновить каталог (сбросить кеш)', 'resetCatalogCache')
      .addItem('Ускорить обновление каталога (каждые 10 минут)', 'setupCatalogPing')
      .addItem('Обновить каталог с канала прямо сейчас', 'catalogPingNow')
      .addSeparator()
      .addItem('Показать служебные листы', 'showServiceSheets')
      .addItem('Спрятать служебные листы', 'hideServiceSheets')
      .addSubMenu(ui.createMenu('Очистка данных (осторожно)')
        .addItem('Только заказы', 'clearOrders')
        .addItem('Только клиентов', 'clearUsers')
        .addItem('Только журнал ониксов', 'clearLog')
        .addItem('Только промокоды магазина', 'clearPromos')
        .addItem('Только личные промокоды клиентов', 'clearPersonalPromos')
        .addItem('Выйти всем из аккаунтов', 'clearSessions')
        .addSeparator()
        .addItem('Всё сразу (клиенты, заказы, журнал)', 'clearAllData')))
    .addToUi();
}

/* ---------- инструменты таблицы: поиск, фильтры, промокоды, аналитика ---------- */
function ordersFilter_() {
  var sh = ss_().getSheetByName(SHEET.orders); if (!sh) return null;
  return sh.getFilter() || sh.getRange(1, 1, Math.max(2, sh.getMaxRows()), ORDER_COLS.length).createFilter();
}
function filterActiveOrders() {
  var f = ordersFilter_(); if (!f) return; filterAllOrders(true);
  f.setColumnFilterCriteria(ci_(ORDER_COLS, 'status') + 1, SpreadsheetApp.newFilterCriteria().setHiddenValues(['Получен', 'Отменён']).build());
  ss_().setActiveSheet(ss_().getSheetByName(SHEET.orders)); ss_().toast('Скрыты полученные и отменённые заказы. Вернуть всё: меню «Заказы» → «Показать все заказы».', 'ONION SHOP', 6);
}
function filterUnpaidOrders() {
  var f = ordersFilter_(); if (!f) return; filterAllOrders(true);
  var col = colL_(ci_(ORDER_COLS, 'paid') + 1);
  f.setColumnFilterCriteria(ci_(ORDER_COLS, 'paid') + 1, SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied(F_('=NOT($' + col + '2)')).build());
  f.setColumnFilterCriteria(ci_(ORDER_COLS, 'status') + 1, SpreadsheetApp.newFilterCriteria().setHiddenValues(['Получен', 'Отменён']).build());
  ss_().setActiveSheet(ss_().getSheetByName(SHEET.orders)); ss_().toast('Показаны активные заказы без оплаты.', 'ONION SHOP', 5);
}
function filterAllOrders(quiet) {
  var sh = ss_().getSheetByName(SHEET.orders), f = sh && sh.getFilter(); if (!f) return;
  for (var c = 1; c <= ORDER_COLS.length; c++) { try { if (f.getColumnFilterCriteria(c)) f.removeColumnFilterCriteria(c); } catch (e) { } }
  if (quiet !== true) ss_().toast('Показаны все заказы.', 'ONION SHOP', 3);
}
function findOrder() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Найти заказ', 'Номер заказа, например OS-26-00012 или 26-00012:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var q = r.getResponseText().trim().toUpperCase(); if (!/^OS-/.test(q)) q = 'OS-' + q;
  var f = orderIdx_(q); if (!f) { ui.alert('Заказ ' + q + ' не найден.'); return; }
  filterAllOrders(true);
  var sh = ss_().getSheetByName(SHEET.orders); ss_().setActiveSheet(sh); sh.setActiveRange(sh.getRange(f.row, 1, 1, ORDER_COLS.length));
}
function findClientUi() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Найти клиента', 'Логин, ID, @telegram или телефон:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var u = findClient_(r.getResponseText()); if (!u) { ui.alert('Клиент не найден.'); return; }
  var sh = ss_().getSheetByName(SHEET.users); ss_().setActiveSheet(sh); sh.setActiveRange(sh.getRange(u._row, 1, 1, USER_COLS.length));
}
function createPromoUi() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Новый промокод', 'Код (латиница или кириллица, цифры), например AUTUMN10:', ui.ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Скидка', 'Сколько процентов (от 1 до 50)?', ui.ButtonSet.OK_CANCEL); if (b.getSelectedButton() !== ui.Button.OK) return;
  var c = ui.prompt('Лимит', 'Сколько раз всего можно использовать? Пусто: без лимита.', ui.ButtonSet.OK_CANCEL); if (c.getSelectedButton() !== ui.Button.OK) return;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var e; try { e = promoCreate_(a.getResponseText(), parseFloat(String(b.getResponseText()).replace(',', '.')), parseInt(c.getResponseText(), 10) || 0); } finally { lock.releaseLock(); }
  ui.alert(e ? 'Не получилось: ' + e : 'Промокод создан и включён (один раз на клиента, можно вместе с ониксами). Настройки меняются прямо в листе «Промокоды».');
}
function showReviewQueue() {
  var list = DB.reviewRows_().filter(function (r) { return String(r.photoSt || '').trim() === 'на проверке'; });
  var sh = ss_().getSheetByName(SHEET.reviews); if (sh) ss_().setActiveSheet(sh);
  SpreadsheetApp.getUi().alert(list.length ? 'Фото ждут проверки: ' + list.length + '.\nВ колонке «Фото покупателя» выберите «показывать» или «скрыть». Удобнее одобрять кнопками в боте: «⭐ Отзывы».' : 'Все фото из отзывов проверены.');
}
function webhookInfoUi() {
  var r = tgApi_('getWebhookInfo', {}), i = r && r.result || {};
  SpreadsheetApp.getUi().alert('Связь с ботом', !r ? 'Telegram не ответил. Проверьте токен бота.' : i.url ? 'Мгновенные ответы включены ✅\nСообщений в очереди: ' + (i.pending_update_count || 0) + (i.last_error_message ? '\nПоследняя ошибка: ' + i.last_error_message : '') : 'Мгновенные ответы выключены: бот отвечает раз в минуту. Включите пункт «Мгновенные ответы (webhook)».', SpreadsheetApp.getUi().ButtonSet.OK);
}
/* лист «Аналитика»: выручка и заказы по месяцам (с графиком), топ товаров, топ клиентов. Отменённые заказы не считаются. */
function buildAnalytics() {
  var ss = ss_(), sh = ss.getSheetByName('Аналитика') || ss.insertSheet('Аналитика');
  sh.clear(); sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  var all = ordersAll_().filter(function (o) { return String(o.status) !== 'Отменён'; });
  var byM = {}, prods = {}, clients = {};
  all.forEach(function (o) {
    var d = o.at instanceof Date ? o.at : null; if (!d) return;
    var k = Utilities.formatDate(d, 'Europe/Moscow', 'yyyy-MM'), sum = money_(o.toPay) || 0;
    var m = byM[k] = byM[k] || { n: 0, sum: 0, got: 0 }; m.n++; m.sum += sum; if (String(o.status) === 'Получен') m.got += sum;
    var items = []; try { items = JSON.parse(o.items || '[]'); } catch (e) { }
    items.forEach(function (it) { var p = prods[it.id] = prods[it.id] || { t: it.title, q: 0, s: 0 }; p.q += +it.qty || 1; p.s += (+it.price || 0) * (+it.qty || 1); });
    var cid = normId_(o.userId) || ('тел. ' + o.phone); var c = clients[cid] = clients[cid] || { name: o.name, login: o.login || '', n: 0, s: 0 }; c.n++; c.s += sum;
  });
  var months = Object.keys(byM).sort().slice(-12);
  var head = function (r, c, t) { sh.getRange(r, c).setValue(t).setFontSize(13).setFontWeight('bold').setFontColor(C.navy); };
  sh.getRange('A1').setValue('Аналитика ONION SHOP').setFontSize(18).setFontWeight('bold').setFontColor(C.navy);
  sh.getRange('A2').setValue('Обновлено ' + mskText_(Date.now()) + '. Отменённые заказы не учитываются. Обновить: меню ONION SHOP → Отчёты.').setFontColor('#64748b');
  head(4, 1, 'По месяцам');
  var mRows = [['Месяц', 'Заказов', 'Сумма заказов, ₽', 'Получено клиентами, ₽', 'Средний чек, ₽']].concat(months.map(function (k) { var m = byM[k]; return [k.slice(5) + '.' + k.slice(0, 4), m.n, Math.round(m.sum), Math.round(m.got), m.n ? Math.round(m.sum / m.n) : 0]; }));
  if (mRows.length === 1) mRows.push(['нет данных', 0, 0, 0, 0]);
  sh.getRange(5, 1, mRows.length, 5).setValues(mRows);
  var top = Object.keys(prods).map(function (id) { return prods[id]; }).sort(function (a, b) { return b.q - a.q || b.s - a.s; }).slice(0, 10);
  var r0 = 5 + mRows.length + 2; head(r0, 1, 'Топ-10 товаров');
  var pRows = [['Товар', 'Штук', 'На сумму, ₽']].concat(top.map(function (p) { return [p.t, p.q, Math.round(p.s)]; })); if (pRows.length === 1) pRows.push(['нет данных', 0, 0]);
  sh.getRange(r0 + 1, 1, pRows.length, 3).setValues(pRows);
  var tc = Object.keys(clients).map(function (k) { return clients[k]; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
  head(r0, 5, 'Топ-10 клиентов');
  var cRows = [['Клиент', 'Логин', 'Заказов', 'Сумма, ₽']].concat(tc.map(function (c) { return [safeCell_(String(c.name || '')), c.login, c.n, Math.round(c.s)]; })); if (cRows.length === 1) cRows.push(['нет данных', '', 0, 0]);
  sh.getRange(r0 + 1, 5, cRows.length, 4).setValues(cRows);
  [[5, mRows.length, 5], [r0 + 1, pRows.length, 3]].forEach(function (t) { sh.getRange(t[0], 1, 1, t[2]).setBackground(C.navy).setFontColor('#ffffff').setFontWeight('bold'); });
  sh.getRange(r0 + 1, 5, 1, 4).setBackground(C.navy).setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(6, 3, Math.max(1, mRows.length - 1), 3).setNumberFormat('#,##0');
  sh.setColumnWidth(1, 300); sh.setColumnWidths(2, 4, 130); sh.setColumnWidth(5, 200); sh.setColumnWidths(6, 3, 110);
  sh.setHiddenGridlines(true); sh.setFrozenRows(0); sh.setTabColor('#16a34a');
  if (months.length) {
    sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN).addRange(sh.getRange(5, 1, mRows.length, 1)).addRange(sh.getRange(5, 3, mRows.length, 1))
      .setPosition(4, 10, 0, 0).setOption('title', 'Сумма заказов по месяцам').setOption('legend', { position: 'none' }).setOption('colors', ['#1a86c0']).setOption('width', 620).setOption('height', 320).build());
  }
  ss.setActiveSheet(sh);
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
  ScriptApp.getProjectTriggers().forEach(function (t) { var h = t.getHandlerFunction(); if (h === 'telegramTick' || h === 'onEditInstant') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('telegramTick').timeBased().everyMinutes(1).create();
  // правка статуса или фотоотчёта в таблице сразу уходит клиенту (а не через минуту)
  try { ScriptApp.newTrigger('onEditInstant').forSpreadsheet(ss_()).onEdit().create(); } catch (x) { console.error('onEdit trigger', x); }
  CacheService.getScriptCache().remove('catalog');
  return bot;
}
/* установленный триггер: менеджер поменял статус заказа или вставил фотоотчёт в таблице, клиент узнаёт в ту же секунду */
function onEditInstant(e) {
  try {
    if (!e || !e.range || e.range.getSheet().getName() !== SHEET.orders) return;
    var c0 = e.range.getColumn(), c1 = c0 + e.range.getNumColumns() - 1;
    var hit = function (k) { var c = ci_(ORDER_COLS, k) + 1; return c >= c0 && c <= c1; };
    if (!hit('status') && !hit('photoRep') && !hit('paid')) return;
    var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return;
    try { USERS_CACHE_ = null; SpreadsheetApp.flush(); syncXp_(); tgStatuses_(); tgPhotos_(); } finally { lock.releaseLock(); }
  } catch (x) { console.error('onEditInstant', x && x.stack || x); }
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
  // webhook ещё не включён: пробуем сами раз в час (нужен адрес веб-приложения), тогда бот начнёт отвечать мгновенно
  // webhook без прокси ломает очередь Telegram (302): выключаем его, бот читает сообщения опросом
  if (p.getProperty('tgWebhook') && !p.getProperty('WEBHOOK_RELAY')) { try { disableWebhook_(); } catch (x) { } }
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
    if (u && u.tgChat) { notice_(u, 'Фотоотчёт готов 📸', 'Сфотографировали вещи из заказа ' + hesc_(no) + ' на складе. Посмотрите, как они выглядят перед отправкой.', { text: 'Посмотреть фото', url: links[0] }); sent++; }
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
      var body = drops.slice(0, 3).map(function (d) { return hesc_(d.title) + ': ' + rub_(d.now) + ' вместо ' + rub_(d.was); }).join('\n');
      notice_(u, pick_(V_.drop), body, drops.length === 1 ? btnUrl_('Посмотреть', 'p-' + drops[0].id) : btnUrl_('Открыть избранное', 'favorites')); sent++;
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
    if (nt && u && u.tgChat) { statusNotice_(u, no, st); sent++; } // только текст и одна кнопка
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
      if (autoCfg_().remind) notifyHtml_(u, payText_(no, money_(r[I('toPay')])), [[btnOrder_(no)]]);
      setRemind_(sh, i + 2, I('remind'), r[I('remind')], { pay: 1 }); sent++;
    } else if (st === 'Получен' && rm.got && !rm.rev && now - rm.got > 3 * 86400000) {
      var items = []; try { items = JSON.parse(r[I('items')] || '[]'); } catch (e) { }
      var done = DB.reviewKeys(u.id), left = items.filter(function (it) { return done.indexOf(no + '|' + it.id) < 0; });
      if (left.length && autoCfg_().remind) { notifyHtml_(u, reviewText_(no, OnionCore.RULES.reward.review, OnionCore.RULES.reward.reviewText), [[btnUrl_('Оставить отзыв', 'orders')]]); sent++; }
      setRemind_(sh, i + 2, I('remind'), r[I('remind')], { rev: 1 });
    }
  });
}
/* скидки: раз в 3 дня около 18:00 по Москве, тем, у кого подключён бот; каждый раз новыми словами */
function tgPromo_() {
  var p = props_(), now = Date.now(), h = mskHour_();
  if (h < 18 || h > 19 || !autoCfg_().sale) return;
  if (now - (+p.getProperty('promoAt') || 0) < 3 * 86400000 - 3600000) return;
  var b = autoSale_();
  p.setProperty('promoAt', String(now));
  if (!b) return;
  var sent = 0;
  users_().forEach(function (u) { if (u.tgChat && sent < 100 && canPush_(u, 20)) { if (notice_(u, b.title, b.body, b.btn)) { sent++; markPush_(u); } } });
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
  var b = autoFresh_(fresh, cat);
  p.setProperty('seenIds', ids.join(',').slice(-8500));
  if (!b) return;
  var sent = 0;
  users_().forEach(function (u) { if (u.tgChat && sent < 150 && canPush_(u, 3)) { if (notice_(u, b.title, b.body, b.btn)) { sent++; markPush_(u); } } });
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
    if (notice_(u, pick_(V_.winback), 'Пока вас не было, в каталоге появились новые вещи. Например, ' + hesc_(L[0].title) + ' за ' + rub_(L[0].price) + '.', btnUrl_('Смотреть новинки', 'catalog'))) { u.lastNudge = now; markPush_(u); sent++; }
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
      notice_(u, pick_(V_.restock), hesc_(w.title) + ' снова можно заказать' + (pr && pr.price ? ', ' + rub_(pr.price) : '') + '. Вы просили сообщить.', btnUrl_('Посмотреть', 'p-' + w.productId)); sent++;
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


/* ====================== Telegram-бот ONION SHOP: помощник покупателя и панель менеджера ======================
   Покупатель: заказы и статусы, бонусы и промокоды, ответы на частые вопросы, связь с менеджером. Покупки на сайте.
   Все уведомления покупателю только текстом: заголовок, пара строк и одна кнопка. Фото уходят только в рассылках менеджера.
   Менеджер: только аккаунт @OnionShop_Support (свойство ADMIN_USERNAME): заказы, клиенты, ониксы, промокоды, отзывы, рассылки. */
function tgApi_(method, payload) {
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + props_().getProperty('BOT_TOKEN') + '/' + method, { method: 'post', muteHttpExceptions: true, contentType: 'application/json', payload: JSON.stringify(payload) });
    return JSON.parse(r.getContentText());
  } catch (e) { return null; }
}
function tgSend_(chat, text, kb) {
  var p = { chat_id: String(chat), text: String(text).slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true };
  if (kb) p.reply_markup = Array.isArray(kb) ? { inline_keyboard: kb } : kb;
  return tgApi_('sendMessage', p);
}
function tgEdit_(chat, msgId, text, kb) {
  var r = tgApi_('editMessageText', { chat_id: String(chat), message_id: msgId, text: String(text).slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: kb || [] } });
  if (!r || !r.ok) { if (!(r && /not modified/i.test(r.description || ''))) tgSend_(chat, text, kb); }
}
function hesc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function siteUrl_(hash) { return siteBase_() + (hash ? '#' + hash : ''); }
function num_(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function rub_(n) { return num_(n) + ' ₽'; }
function plural_(n, a, b, c) { n = Math.abs(n) % 100; var m = n % 10; return n > 10 && n < 20 ? c : m > 1 && m < 5 ? b : m === 1 ? a : c; }
var SUPPORT_URL_ = 'https://t.me/OnionShop_Support';
/* кнопки меню покупателя; старые подписи тоже понимаем (у кого-то клавиатура осталась от прошлой версии) */
var BTN_ = { ord: '📦 Мои заказы', bon: '🎁 Бонусы', cat: '🛍 Каталог', faq: '❓ Вопросы', sup: '💬 Написать менеджеру',
  aOrd: '📦 Заказы', aUnp: '💳 Неоплаченные', aSum: '📊 Сводка', aCli: '👤 Клиент', aBc: '📣 Рассылка', aPromo: '🏷 Промокоды', aRev: '⭐ Отзывы', aHelp: '❓ Подсказка' };
var OLD_BTN_ = { '🆕 Новинки': 'cat', '🔥 Скидки': 'cat', 'ℹ️ Условия и сроки': 'faq', '💬 Задать вопрос': 'sup', '⚙️ Настройки': 'set', '💬 Менеджер': 'sup' };
function custKb_() { return { keyboard: [[{ text: BTN_.ord }, { text: BTN_.bon }], [{ text: BTN_.cat }, { text: BTN_.faq }], [{ text: BTN_.sup }]], resize_keyboard: true, is_persistent: true, input_field_placeholder: 'Напишите вопрос или выберите пункт' }; }
function adminKb_() { return { keyboard: [[{ text: BTN_.aOrd }, { text: BTN_.aUnp }], [{ text: BTN_.aSum }, { text: BTN_.aCli }], [{ text: BTN_.aBc }, { text: BTN_.aPromo }], [{ text: BTN_.aRev }, { text: BTN_.aHelp }]], resize_keyboard: true, is_persistent: true }; }
function cacheGet_(k) { try { return CacheService.getScriptCache().get(k); } catch (e) { return null; } }
function cachePut_(k, v, sec) { try { CacheService.getScriptCache().put(k, String(v), sec); } catch (e) { } }
function cacheDel_(k) { try { CacheService.getScriptCache().remove(k); } catch (e) { } }

/* ---------- кто менеджер ---------- */
function adminUser_() { return String(props_().getProperty('ADMIN_USERNAME') || 'OnionShop_Support').replace(/^@/, '').toLowerCase(); }
function isAdmin_(chat) { var a = props_().getProperty('ADMIN_CHAT_ID'); return !!a && String(a) === String(chat); }
function claimAdmin_(m) {
  var p = props_(), old = p.getProperty('ADMIN_CHAT_ID');
  if (!m.chat.username || m.chat.username.toLowerCase() !== adminUser_() || String(old) === String(m.chat.id)) return false;
  p.setProperty('ADMIN_CHAT_ID', String(m.chat.id));
  if (old) tgApi_('deleteMyCommands', { scope: { type: 'chat', chat_id: Number(old) } });
  if (old) tgSend_(old, 'Этот чат больше не панель менеджера: управление переехало на @' + hesc_(m.chat.username) + '.', { remove_keyboard: true });
  setBotCommands_();
  tgSend_(m.chat.id, '✅ Готово, этот чат теперь панель менеджера ONION SHOP. Сюда приходят новые заказы, вопросы покупателей и отзывы.');
  adminMenu_(m.chat.id);
  return true;
}

/* ====================== уведомления покупателю: только текст и одна кнопка ======================
   Формат как у больших магазинов: жирный заголовок, одна-две строки по делу, одна кнопка. */
function notice_(u, title, body, btn) {
  if (!u || !u.tgChat) return false;
  var r = tgSend_(u.tgChat, '<b>' + title + '</b>\n' + body, btn ? [[btn]] : null);
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); return false; }
  return !!(r && r.ok);
}
function btnOrder_(no) { return { text: 'Открыть заказ', callback_data: 'm|' + no }; }
function btnUrl_(text, hash) { return { text: text, url: siteUrl_(hash) }; }
/* статусы заказа: заголовок и текст; {no}: номер заказа */
var ST_ = {
  'Оформлен': ['Заказ принят 🧾', 'Заказ {no} у нас. Менеджер проверит его и пришлёт реквизиты для оплаты.'],
  'Выкуплен': ['Заказ выкуплен ✅', 'Выкупили {no} у поставщика. Теперь он едет на наш склад в Китае.'],
  'В пути': ['Заказ едет на склад 🚚', '{no} в пути к нашему складу в Китае, обычно это 3-5 дней.'],
  'На складе': ['Заказ на складе 📦', '{no} уже на складе: проверяем вещи и готовим отправку в Россию.'],
  'Едет к нам': ['Заказ едет в Россию ✈️', '{no} отправили из Китая. Дорога обычно занимает 18-32 дня, мы следим за ней.'],
  'Едет к вам': ['Заказ едет к вам 🚚', '{no} передали в доставку. Трек-номер пришлёт менеджер.'],
  'Получен': ['Заказ получен 🎉', 'Спасибо, что выбрали ONION SHOP! Расскажите, как вам вещи: за отзыв начислим до {rt} ониксов.'],
  'Отменён': ['Заказ отменён', '{no} отменён. Если вы оплачивали часть ониксами, они уже вернулись на баланс. Если это ошибка, просто напишите сюда.']
};
function statusNotice_(u, no, st) {
  var s = ST_[st] || ['Статус заказа обновлён', '{no}: ' + st];
  var body = fill_(s[1], { no: no, rt: OnionCore.RULES.reward.reviewText });
  if (st === 'Получен') return notice_(u, s[0], body, btnUrl_('Оставить отзыв', 'orders'));
  return notice_(u, s[0], body, btnOrder_(no));
}
/* для превью в «Примерах» и старого кода: текст статуса без отправки */
function statusText_(no, st) { var s = ST_[st] || ['Статус заказа обновлён', '{no}: ' + st]; return '<b>' + s[0] + '</b>\n' + fill_(s[1], { no: hesc_(no), rt: OnionCore.RULES.reward.reviewText }); }
function statusKb_(no, st) { return st === 'Получен' ? [[btnUrl_('Оставить отзыв', 'orders')]] : [[btnOrder_(no)]]; }
function payText_(no, sum) { return '<b>Заказ ждёт оплаты 💳</b>\n' + pick_(['К оплате по заказу ' + hesc_(no) + ': ' + rub_(sum) + '. Если уже оплатили, ничего делать не нужно, менеджер отметит.', 'Напоминаем про оплату заказа ' + hesc_(no) + ': ' + rub_(sum) + '. Оплатили? Тогда всё в порядке, менеджер скоро отметит.']); }
function reviewText_(no, r, rt) { return '<b>Как вам заказ? ⭐</b>\n' + pick_(['Оцените вещи из заказа ' + hesc_(no) + ': за оценку +' + r + ' ониксов, а с парой слов о посадке и качестве +' + rt + '.', 'Поделитесь впечатлением о заказе ' + hesc_(no) + '. Это займёт минуту, а другим поможет с выбором. За отзыв до +' + rt + ' ониксов.']); }

/* ====================== покупатель ====================== */
function welcome_(name, linked) {
  return '<b>Привет' + (name ? ', ' + hesc_(name) : '') + '! Я бот ONION SHOP 👋</b>\n\n' +
    'Слежу за вашими заказами и сразу пишу, когда меняется статус, приходит фотоотчёт или вещь из избранного дешевеет.\n\n' +
    'Здесь можно посмотреть заказы, бонусы и промокоды, найти ответ на частый вопрос или написать менеджеру. Покупки и весь каталог на сайте.' +
    (linked ? '\n\n✅ Уведомления подключены.' : '\n\nЧтобы я видел ваши заказы, подключите меня в кабинете на сайте: «Уведомления в Telegram», затем «Подключить».');
}
function welcomeKb_(linked) { return [[linked ? btnUrl_('🛍 Открыть магазин', '') : btnUrl_('🔔 Подключить уведомления', 'account')]]; }
function sendWelcome_(m, linked) {
  var r = tgPhoto_(m.chat.id, IMG_('welcome'), welcome_(m.chat.first_name, linked), welcomeKb_(linked));
  if (!r || !r.ok) tgSend_(m.chat.id, welcome_(m.chat.first_name, linked), welcomeKb_(linked));
  tgSend_(m.chat.id, 'Меню всегда внизу 👇', custKb_());
}
function needLink_(chat) {
  tgSend_(chat, 'Пока я не вижу ваш кабинет. Откройте на сайте кабинет, раздел «Уведомления в Telegram», и нажмите «Подключить». Это полминуты.', [[btnUrl_('🔔 Открыть кабинет', 'account')]]);
}
function custCatalog_(chat) {
  tgSend_(chat, '<b>Каталог ONION SHOP</b>\nОдежда, обувь и аксессуары: в наличии в Москве и под заказ из Китая. Выберите раздел, откроется на сайте.', [
    [btnUrl_('✨ Новинки', 'catalog'), btnUrl_('🔥 Скидки', 'catalog')],
    [btnUrl_('📍 В наличии', 'stock'), btnUrl_('✈️ Предзаказ', 'preorder')]]);
}
/* частые вопросы прямо в боте: одно сообщение, которое меняется при выборе темы */
var FAQ_ = [
  ['order', 'Как оформить заказ', 'Выберите вещь на сайте, отметьте размер и цвет и добавьте в корзину. Контакты подставятся из кабинета, останется выбрать способ получения и, если хотите, ониксы или промокод.\n\nПосле оформления заказ получает номер, а менеджер проверяет его и присылает реквизиты для оплаты. Вещь закрепляется за вами после оплаты.'],
  ['pre', 'Предзаказ и сроки', 'Предзаказ значит, что вещь пока в Китае. После оплаты мы выкупаем её у поставщика (до 12 часов), она едет на наш склад (4-12 дней), там её проверяют и фотографируют, а потом фура везёт её в Россию (18-32 дня).\n\nВ сумме выходит примерно <b>24-47 дней</b>. Доставка из Китая уже включена в цену. Самолётом быстрее, это обсуждается с менеджером.'],
  ['ship', 'Доставка и получение', '<b>Вещи в наличии</b> (уже в Москве): Авито Доставка по Москве и в другие города, курьер по Москве (не всегда) или самовывоз.\n\n<b>Предзаказ</b>: когда вещь в России, отправим СДЭК, Авито Доставкой или передадим при встрече в Москве. Трек-номер пришлёт менеджер.'],
  ['pay', 'Оплата', 'Переводом (Сбербанк, Т-Банк, Альфа-Банк, СБП) или наличными при встрече в Москве. На сайте оплаты нет: после проверки заказа менеджер пришлёт реквизиты.\n\nДо 12% заказа можно оплатить ониксами и промокодом вместе.'],
  ['bonus', 'Ониксы и уровни', 'Ониксы начисляются за регистрацию, ежедневный вход, задания, отзывы, приглашённых друзей и в посылке с сюрпризом. 1 оникс равен 0,3 ₽.\n\nУровень считается по опыту (XP) за месяц: чем выше уровень, тем больше заданий, промокоды и приоритет заказа. 1-го числа опыт обнуляется.'],
  ['size', 'Размеры', 'Если у модели есть замеры, они в карточке товара в разделе «Замеры изделия». Это размеры самой вещи, а не обхват тела: проще всего сравнить с похожей вещью из своего шкафа.\n\nСомневаетесь между двумя размерами? Напишите менеджеру свои параметры, он подскажет.']
];
function custFaq_(chat, msgId, key) {
  var it = FAQ_.filter(function (x) { return x[0] === key; })[0];
  var text, kb;
  if (!it) {
    text = '<b>Частые вопросы</b>\nВыберите тему, отвечу прямо здесь.';
    kb = []; for (var i = 0; i < FAQ_.length; i += 2) kb.push(FAQ_.slice(i, i + 2).map(function (x) { return { text: x[1], callback_data: 'fq|' + x[0] }; }));
    kb.push([{ text: '💬 Спросить менеджера', callback_data: 'q|' }]);
  } else {
    text = '<b>' + it[1] + '</b>\n\n' + it[2];
    kb = [[{ text: '← Все вопросы', callback_data: 'fq|' }, { text: '💬 Спросить', callback_data: 'q|' }]];
  }
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function custAsk_(chat, no) {
  cachePut_('q:' + chat, no || '-', 900);
  tgSend_(chat, 'Напишите вопрос одним сообщением' + (no ? ', я передам его менеджеру вместе с номером заказа <b>' + hesc_(no) + '</b>' : ', я сразу передам его менеджеру') + '. Можно приложить фото. Ответ придёт сюда же.');
}
function orderLine_(o) { return '№' + String(o.no).replace(/^OS-/, '') + ', ' + (o.status || 'Оформлен') + ', ' + rub_(o.toPay); }
function custOrders_(chat, msgId) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var list = DB.listOrders(u.id, 8);
  if (!list.length) { tgSend_(chat, 'Заказов пока нет. Когда оформите заказ на сайте, он появится здесь, а статусы я буду присылать сам.', [[btnUrl_('🛍 Перейти в каталог', 'catalog')]]); return; }
  var text = '<b>Ваши заказы</b>\nНажмите на заказ, чтобы увидеть статус и состав.';
  var kb = list.map(function (o) { return [{ text: orderLine_(o), callback_data: 'm|' + o.no }]; });
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function custOrderCard_(cq, no) {
  var chat = cq.message.chat.id, u = tgUserByChat_(chat); if (!u) { tgAnswer_(cq.id, 'Сначала подключите бота в кабинете'); return; }
  var o = DB.listOrders(u.id, 50).filter(function (x) { return String(x.no) === no; })[0];
  if (!o) { tgAnswer_(cq.id, 'Заказ не найден'); return; }
  var stages = OnionCore.stagesFor(o.kind), cur = stages.indexOf(o.status || 'Оформлен');
  var chain = o.status === 'Отменён' ? '❌ Отменён' : stages.map(function (s, i) { return (i < cur ? '✅ ' : i === cur ? '🔵 <b>' : '⚪ ') + s + (i === cur ? '</b>' : ''); }).join('\n');
  var items = (o.items || []).map(function (it) { return '🛍 ' + hesc_(it.title || '') + (it.size ? ', ' + hesc_(it.size) : '') + (it.color ? ', ' + hesc_(String(it.color).toLowerCase()) : '') + (it.qty > 1 ? ' × ' + it.qty : ''); }).join('\n');
  tgAnswer_(cq.id, '');
  var text = '<b>Заказ ' + hesc_(o.no) + '</b>\n' + hesc_(o.at) + '\n\n' + items + '\n\nК оплате: <b>' + rub_(o.toPay) + '</b>' + (isTrue_(o.paid) ? ', оплачен ✅' : '') + '\n\n' + chain;
  var kb = [[{ text: '💬 Вопрос по заказу', callback_data: 'q|' + o.no }]];
  if (o.status === 'Получен') kb.unshift([btnUrl_('⭐ Оставить отзыв', 'orders')]);
  kb.push([{ text: '← Все заказы', callback_data: 'mo' }]);
  if (cq.message.text && /^Заказ |^Ваши заказы/.test(String(cq.message.text))) tgEdit_(chat, cq.message.message_id, text, kb); else tgSend_(chat, text, kb);
}
function custBonus_(chat) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var R = OnionCore.RULES, L = OnionCore.levelOf(u), next = R.levels[L.index + 1], bal = u.balance || 0;
  var text = '<b>Ваши бонусы</b>\n\n🪙 Ониксы: <b>' + num_(bal) + '</b>, это до ' + rub_(Math.floor(bal * R.tokenRub)) + ' скидки\n⭐ Уровень: <b>' + hesc_(L.name) + '</b>, ' + num_(u.xp || 0) + ' XP за месяц' +
    (next ? '\nДо уровня «' + hesc_(next.name) + '» осталось ' + num_(Math.max(0, next.min - (u.xp || 0))) + ' XP' : '');
  var pr = []; try { pr = OnionCore.activePromos(DB, u) || []; } catch (e) { pr = []; }
  if (pr.length) text += '\n\n<b>Промокоды</b> (нажмите, чтобы скопировать)\n' + pr.slice(0, 8).map(function (p) { return '<code>' + hesc_(p.code) + '</code> −' + String(p.pct).replace('.', ',') + '%' + (p.cat ? ', только «' + hesc_(p.catLabel) + '»' : ''); }).join('\n');
  text += '\n\nОниксами и промокодом вместе можно оплатить до 12% заказа.';
  var kb = [];
  if (u.refCode) {
    var link = siteUrl_('ref=' + u.refCode);
    text += '\n\n👥 <b>Пригласите друга</b>: ему +' + R.reward.refFriend + ' ониксов при регистрации, вам +' + R.reward.referrer + ', когда он получит первый заказ от ' + rub_(R.refMinOrder) + '.';
    kb.push([{ text: '📤 Пригласить друга', url: 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Одежда и обувь в наличии и из Китая, ONION SHOP. По моей ссылке +' + R.reward.refFriend + ' ониксов при регистрации') }]);
  }
  kb.push([btnUrl_('🎁 Задания и посылка', 'roulette')]);
  tgSend_(chat, text, kb);
}
/* уведомления включены всегда и отключить их нельзя: экран только объясняет, что приходит */
function custSettings_(chat, msgId) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var text = '<b>Что я присылаю</b>\n\n📦 статусы заказов и напоминания об оплате\n📸 фотоотчёты со склада\n🔔 «Жду появления»: вещь снова в продаже\n📉 скидки на вещи из избранного\n🎁 бонусы, ониксы и подарки\n\nВсё приходит автоматически, пока бот подключён.';
  var kb = [[{ text: '📦 Мои заказы', callback_data: 'mo' }]];
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function custCallback_(cq, a) {
  var chat = cq.message.chat.id, mid = cq.message.message_id;
  if (a[0] === 'm') { custOrderCard_(cq, a[1]); return true; }
  if (a[0] === 'mo') { tgAnswer_(cq.id, ''); custOrders_(chat, mid); return true; }
  if (a[0] === 'q') { tgAnswer_(cq.id, ''); custAsk_(chat, a[1] || ''); return true; }
  if (a[0] === 'bn') { tgAnswer_(cq.id, ''); custBonus_(chat); return true; }
  if (a[0] === 'ns') { tgAnswer_(cq.id, ''); custSettings_(chat); return true; }
  if (a[0] === 'fq') { tgAnswer_(cq.id, ''); custFaq_(chat, mid, a[1] || ''); return true; }
  if (a[0] === 'ph') { // фото товаров заказа: только своему заказу (менеджеру любому)
    tgAnswer_(cq.id, '');
    if (!isAdmin_(chat)) { var pu = tgUserByChat_(chat); if (!pu || !DB.listOrders(pu.id, 50).some(function (x) { return String(x.no) === a[1]; })) { tgSend_(chat, 'Заказ не найден.'); return true; } }
    if (!orderPhotos_(chat, a[1])) tgSend_(chat, 'Фото к этому заказу не сохранились.');
    return true;
  }
  return false;
}
/* вопрос покупателя → менеджеру. Метка #c<чат> стоит последней строкой: менеджер отвечает свайпом или кнопкой.
   Берём именно последнюю метку: покупатель мог вписать «#c…» в свой текст, чтобы ответ ушёл чужому человеку. */
function relayToManager_(m) {
  var chat = m.chat.id, admin = props_().getProperty('ADMIN_CHAT_ID');
  if (!admin) { tgSend_(chat, 'Сейчас удобнее написать менеджеру напрямую 👇', [[{ text: '💬 @OnionShop_Support', url: SUPPORT_URL_ }]]); return; }
  var n = +(cacheGet_('qn:' + chat) || 0);
  if (n >= 8) { tgSend_(chat, 'Вы прислали много сообщений подряд. Менеджер уже видит их и ответит, как только сможет.'); return; }
  cachePut_('qn:' + chat, n + 1, 600);
  var u = tgUserByChat_(chat), q = cacheGet_('q:' + chat); cacheDel_('q:' + chat);
  var who = u ? '@' + hesc_(u.login) + ', ID ' + hesc_(u.id) + ', ' + hesc_(OnionCore.levelOf(u).name) : hesc_(m.chat.username ? '@' + m.chat.username : (m.chat.first_name || 'покупатель')) + ' (кабинет не подключён)';
  var tgLink = m.chat.username && u ? ', @' + hesc_(m.chat.username) : '';
  var head = '💬 <b>Вопрос покупателя</b>\n' + who + tgLink + (q && q !== '-' ? '\nПо заказу <b>' + hesc_(q) + '</b>' : '');
  var kb = [[{ text: '✍️ Ответить', callback_data: 'rp|' + chat }]];
  if (u) kb[0].push({ text: '👤 Клиент', callback_data: 'c|' + u.id });
  if (q && q !== '-') kb.push([{ text: '🧾 Заказ ' + q, callback_data: 'o|' + q }]);
  if (m.text) tgSend_(admin, head + '\n\n' + hesc_(m.text) + '\n\n#c' + chat, kb);
  else { tgSend_(admin, head + '\n(вложение ниже)\n\n#c' + chat, kb); tgApi_('copyMessage', { chat_id: admin, from_chat_id: chat, message_id: m.message_id }); }
  if (n === 0) tgSend_(chat, pick_(V_.asked)); // подтверждаем один раз, а не на каждое сообщение подряд
}
function tgUserByChat_(chat) { return users_().filter(function (u) { return u.tgChat === String(chat); })[0] || null; }
function tgAnswer_(id, text) { tgApi_('answerCallbackQuery', { callback_query_id: id, text: text || '' }); }

/* ====================== менеджер ====================== */
function adminMenu_(chat) {
  tgSend_(chat, '🛠 <b>Панель менеджера ONION SHOP</b>\nЗаказы, клиенты, ониксы, промокоды, отзывы и рассылки. В таблицу заходить не обязательно.', [
    [{ text: '📦 Активные заказы', callback_data: 'ml|a' }, { text: '💳 Неоплаченные', callback_data: 'ml|u' }],
    [{ text: '👤 Найти клиента', callback_data: 'cf' }, { text: '📊 Сводка', callback_data: 'st' }],
    [{ text: '🏷 Промокоды', callback_data: 'pl' }, { text: '⭐ Отзывы с фото', callback_data: 'rl' }],
    [{ text: '📣 Рассылка', callback_data: 'bm' }, { text: '⚙️ Авто-сообщения', callback_data: 'ac' }]]);
  tgSend_(chat, 'Кнопки внизу для быстрого доступа 👇', adminKb_());
}
function adminHelp_(chat) {
  tgSend_(chat, '<b>Как работать с ботом</b>\n\n' +
    '📦 <b>Заказы.</b> Новый заказ приходит сюда с кнопками статусов. Список: «Заказы», есть фильтры. Номер заказа (OS-26-00012 или 26-00012) сразу открывает карточку. Смена статуса тут же уходит клиенту.\n\n' +
    '💬 <b>Вопросы покупателей</b> приходят сюда. Ответить: свайп по сообщению и текст (или фото), либо кнопка «Ответить».\n\n' +
    '👤 <b>Клиенты:</b> отправьте логин, ID, @telegram или телефон. В карточке: ониксы, написать, удалить.\n' +
    '🪙 /tokens логин +50 причина: начислить (с минусом списать), клиенту придёт сообщение.\n' +
    '🏷 <b>Промокоды:</b> список, включить или выключить, новый: /promo КОД 10 (скидка 10%).\n' +
    '⭐ <b>Отзывы с фото:</b> фото появляются на сайте после вашего «Показать».\n' +
    '📣 <b>Рассылка:</b> пост про товар, новинки, скидки, новость или свой текст с фото. Перед отправкой видно готовый пост.\n' +
    '⚙️ <b>Авто-сообщения</b> клиентам (только текст): новинки, скидки, подешевело в избранном, «давно не заходили», напоминания.\n' +
    '📝 В карточке заказа можно оставить заметку для себя.\n\n' +
    '☀️ Каждый день в 10:00 сводка и неоплаченные заказы.\n/cancel: отменить ввод.');
}
function ordersAll_() { return orderRows_().map(function (r) { var o = rowToObj_(r, ORDER_COLS); o.no = String(o.no).trim(); return o; }).filter(function (o) { return o.no; }); }
function isDone_(st) { return st === 'Получен' || st === 'Отменён'; }
function openStages_() { var R = OnionCore.RULES, out = []; R.stagesPre.concat(R.stagesStock).forEach(function (s) { if (!isDone_(s) && out.indexOf(s) < 0) out.push(s); }); return out; }
function adminOrders_(chat, msgId, f, idx) {
  f = f || 'a';
  var act = ordersAll_().filter(function (o) { return !isDone_(String(o.status || 'Оформлен')); }), stages = openStages_();
  var list = f === 'u' ? act.filter(function (o) { return !isTrue_(o.paid); }) : f === 's' ? act.filter(function (o) { return String(o.status || 'Оформлен') === stages[+idx]; }) : act;
  list = list.slice().reverse();
  var title = f === 'u' ? 'Неоплаченные' : f === 's' ? 'Статус «' + stages[+idx] + '»' : 'Активные заказы';
  var text = '📦 <b>' + title + ': ' + list.length + '</b>' + (list.length > 12 ? '\nПоказаны 12 последних' : '') + (list.length ? '' : '\nПусто 🎉');
  var kb = list.slice(0, 12).map(function (o) { return [{ text: (isTrue_(o.paid) ? '💰 ' : '') + orderLine_(o), callback_data: 'o|' + o.no }]; });
  var fr = [], cnt = function (s) { return act.filter(function (o) { return String(o.status || 'Оформлен') === s; }).length; };
  stages.forEach(function (s, i) { var c = cnt(s); if (c) fr.push({ text: s + ' ' + c, callback_data: 'ml|s|' + i }); });
  for (var i = 0; i < fr.length; i += 3) kb.push(fr.slice(i, i + 3));
  kb.push([{ text: 'Все ' + act.length, callback_data: 'ml|a' }, { text: '💳 Неоплач. ' + act.filter(function (o) { return !isTrue_(o.paid); }).length, callback_data: 'ml|u' }, { text: '🔄', callback_data: 'ml|' + f + (f === 's' ? '|' + idx : '') }]);
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function orderIdx_(no) {
  var rows = orderRows_(), iNo = ci_(ORDER_COLS, 'no'), idx = -1;
  rows.forEach(function (r, i) { if (String(r[iNo]).trim().toUpperCase() === String(no).toUpperCase()) idx = i; });
  return idx < 0 ? null : { idx: idx, row: idx + 2, o: rowToObj_(rows[idx], ORDER_COLS) };
}
function orderCard_(chat, no, msgId) {
  var f = orderIdx_(no);
  if (!f) { tgSend_(chat, 'Заказ ' + hesc_(no) + ' не найден.'); return; }
  var o = f.o, st = String(o.status || 'Оформлен'), cu = o.userId ? DB.getUser(normId_(o.userId)) : null;
  var text = '🧾 <b>Заказ ' + hesc_(o.no) + '</b>\nСтатус: <b>' + hesc_(st) + '</b>' + (isTrue_(o.paid) ? ', 💰 оплачен' : ', не оплачен') +
    '\n\n' + hesc_(String(o.itemsText || '').slice(0, 900)) + '\n\n💰 К оплате: <b>' + rub_(money_(o.toPay)) + '</b> (' + hesc_(o.kind) + ')' +
    '\n👤 ' + hesc_(o.name) + ', ' + hesc_(o.phone) + (o.tg ? ', ' + hesc_(o.tg) : '') + (cu ? (cu.tgChat ? ', 🔔 бот подключён' : ', без бота') : '') +
    (o.pack ? '\n🎁 ' + hesc_(o.pack) : '') + (o.comment ? '\n💬 ' + hesc_(o.comment) : '') + (o.note ? '\n📝 ' + hesc_(o.note) : '');
  var kb = adminKeyboard_(o.no, String(o.kind)), row = [];
  kb.push([{ text: '🖼 Фото товаров', callback_data: 'ph|' + o.no }]);
  if (cu && cu.tgChat) row.push({ text: '✉️ Написать', callback_data: 'rp|' + cu.tgChat });
  row.push({ text: '📝 Заметка', callback_data: 'nt|' + o.no });
  if (cu) row.push({ text: '👤 Клиент', callback_data: 'c|' + cu.id });
  kb.push(row);
  kb.push([{ text: '← К заказам', callback_data: 'ml|a' }]);
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function statsText_() {
  var all = ordersAll_(), now = Date.now(), day = Utilities.formatDate(new Date(now), 'Europe/Moscow', 'dd.MM.yyyy');
  var dayOf = function (o, d) { return o.at instanceof Date ? Utilities.formatDate(o.at, 'Europe/Moscow', 'dd.MM.yyyy') === d : String(o.at).indexOf(d) === 0; };
  var yd = Utilities.formatDate(new Date(now - 86400000), 'Europe/Moscow', 'dd.MM.yyyy');
  var today = all.filter(function (o) { return dayOf(o, day); }), yest = all.filter(function (o) { return dayOf(o, yd); });
  var act = all.filter(function (o) { return !isDone_(String(o.status || 'Оформлен')); });
  var mk = Utilities.formatDate(new Date(now), 'Europe/Moscow', 'MM.yyyy'), month = all.filter(function (o) { return o.at instanceof Date ? Utilities.formatDate(o.at, 'Europe/Moscow', 'MM.yyyy') === mk : String(o.at).slice(3, 10) === mk; });
  var sum = function (a) { return a.reduce(function (s, o) { return s + (money_(o.toPay) || 0); }, 0); };
  var us = users_();
  return '📊 <b>Сводка</b>\n\nСегодня: ' + today.length + ' ' + plural_(today.length, 'заказ', 'заказа', 'заказов') + ' на ' + rub_(sum(today)) + '\nВчера: ' + yest.length + ' на ' + rub_(sum(yest)) +
    '\nЗа месяц: ' + month.length + ' на ' + rub_(sum(month)) +
    '\nАктивных: ' + act.length + ', из них не оплачено ' + act.filter(function (o) { return !isTrue_(o.paid); }).length + '\nВсего заказов: ' + all.length +
    '\nКлиентов: ' + us.length + ', с ботом: ' + us.filter(function (u) { return u.tgChat; }).length;
}
function adminStats_(chat) { tgSend_(chat, statsText_(), [[{ text: '📦 Активные', callback_data: 'ml|a' }, { text: '💳 Неоплаченные', callback_data: 'ml|u' }]]); }
/* утренняя сводка менеджеру: раз в день после 10:00 МСК */
function adminDigest_() {
  var p = props_(), admin = p.getProperty('ADMIN_CHAT_ID'); if (!admin) return;
  var now = new Date(), day = Utilities.formatDate(now, 'Europe/Moscow', 'yyyy-MM-dd'), h = +Utilities.formatDate(now, 'Europe/Moscow', 'H');
  if (h < 10 || p.getProperty('digestDay') === day) return;
  p.setProperty('digestDay', day);
  var old = ordersAll_().filter(function (o) { return !isDone_(String(o.status || 'Оформлен')) && !isTrue_(o.paid) && o.at instanceof Date && Date.now() - o.at.getTime() > 86400000; });
  var waitPh = DB.reviewRows_().filter(function (r) { return String(r.photoSt || '').trim() === 'на проверке'; }).length;
  var text = '☀️ <b>Доброе утро!</b>\n\n' + statsText_().replace('📊 <b>Сводка</b>\n\n', '') + (old.length ? '\n\n💳 Не оплачены дольше суток: ' + old.length : '') + (waitPh ? '\n⭐ Отзывов с фото ждут проверки: ' + waitPh : '');
  var kb = old.slice(-8).reverse().map(function (o) { return [{ text: orderLine_(o), callback_data: 'o|' + o.no }]; });
  kb.push([{ text: '📦 Все активные', callback_data: 'ml|a' }]);
  if (waitPh) kb.push([{ text: '⭐ Проверить фото', callback_data: 'rl' }]);
  tgSend_(admin, text, kb);
}
function findClient_(q) {
  q = String(q || '').trim().replace(/^@/, ''); if (!q) return null; USERS_CACHE_ = null;
  return DB.getUser(normId_(q)) || DB.findUser('login', q.toLowerCase()) || (OnionCore.cleanTg ? DB.findUser('tg', OnionCore.cleanTg(q)) : null) || DB.findUser('phone', q) || null;
}
function clientCard_(chat, u, msgId) {
  var L = OnionCore.levelOf(u), mine = orderRows_().filter(function (r) { return normId_(r[ci_(ORDER_COLS, 'userId')]) === u.id; });
  var last = mine.slice(-3).reverse().map(function (r) { return String(r[ci_(ORDER_COLS, 'no')]).trim(); });
  var text = '👤 <b>@' + hesc_(u.login) + '</b>, ID ' + hesc_(u.id) + '\n' + hesc_(u.name || '') + (u.phone ? ', ' + hesc_(u.phone) + (u.phoneOk === false ? ' (не подтверждён)' : ' ✅') : '') + (u.tg ? ', ' + hesc_(u.tg) : '') + (u.city ? '\n📍 ' + hesc_(u.city) : '') +
    '\nУровень: ' + hesc_(L.name) + ', 🪙 ' + num_(u.balance || 0) + ' ониксов, заказов: ' + mine.length + '\nБот: ' + (u.tgChat ? 'подключён ' + hesc_(u.tgName || '') : 'не подключён');
  var kb = [[{ text: '+50', callback_data: 't|' + u.id + '|50' }, { text: '+100', callback_data: 't|' + u.id + '|100' }, { text: '−50', callback_data: 't|' + u.id + '|-50' }]];
  last.forEach(function (no) { kb.push([{ text: '🧾 ' + no, callback_data: 'o|' + no }]); });
  var r2 = []; if (u.tgChat) r2.push({ text: '✉️ Написать', callback_data: 'rp|' + u.tgChat }); r2.push({ text: '🗑 Удалить', callback_data: 'd|' + u.id }); kb.push(r2);
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function adjustClient_(u, d, reason) {
  USERS_CACHE_ = null; u = DB.getUser(u.id); if (!u) return null;
  u.balance = Math.max(0, (u.balance || 0) + d);
  DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: d, reason: reason || 'Менеджер (Telegram)', balance: u.balance });
  DB.saveUser(u);
  var why = reason && reason !== 'Менеджер (Telegram)' ? ' ' + hesc_(reason) + '.' : '';
  notice_(u, d > 0 ? 'Вам начислено ' + num_(d) + ' ' + plural_(d, 'оникс', 'оникса', 'ониксов') + ' 🪙' : 'Списано ' + num_(-d) + ' ' + plural_(-d, 'оникс', 'оникса', 'ониксов'), 'Баланс сейчас: ' + num_(u.balance) + '.' + why, { text: 'Мои бонусы', callback_data: 'bn' });
  return u;
}
function removeClient_(u) {
  var wr = DB.waitRows_().filter(function (w) { return w.userId === u.id; }).map(function (w) { return w._row; }).sort(function (x, y) { return y - x; });
  var ws = ss_().getSheetByName(SHEET.waits); if (ws) wr.forEach(function (rw) { ws.deleteRow(rw); });
  DB.deleteSessionsOf(u.id);
  DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: -(u.balance || 0), reason: 'Клиент удалён менеджером (Telegram)', balance: 0 });
  DB.deleteUser(u); USERS_CACHE_ = null;
}
function broadcastTargets_(mode) {
  var act = {};
  if (mode === 'a') ordersAll_().forEach(function (o) { if (!isDone_(String(o.status || 'Оформлен'))) act[normId_(o.userId)] = 1; });
  return users_().filter(function (u) { return u.tgChat && (mode !== 'a' || act[u.id]); });
}
function askBroadcast_(chat, text, photo) { bcPreview_(chat, { t: 'custom', text: text || '', photo: photo || '' }); }
/* ответ менеджера покупателю */
function replyToClient_(admin, chat, m) {
  var u = tgUserByChat_(chat), r;
  if (m.text) r = tgSend_(chat, '<b>Ответ менеджера 💬</b>\n' + hesc_(m.text) + '\n\n<i>Ответить можно прямо здесь.</i>');
  else r = tgApi_('copyMessage', { chat_id: chat, from_chat_id: admin, message_id: m.message_id });
  tgSend_(admin, r && r.ok ? '✅ Отправлено' + (u ? ' @' + hesc_(u.login) : '') : '⚠️ Не доставлено: похоже, покупатель заблокировал бота.');
}

/* ---------- промокоды магазина из бота (лист «Промокоды») ---------- */
function promoList_(chat, msgId) {
  var rows = promoRows_().filter(function (r) { return String(r.code || '').trim(); });
  var text = '🏷 <b>Промокоды магазина: ' + rows.length + '</b>\nНажмите, чтобы включить или выключить. Новый: /promo КОД 10 (скидка 10%), можно добавить лимит: /promo КОД 10 50.';
  var kb = rows.slice(-20).reverse().map(function (r) {
    var uses = DB.promoUses(r.code).total, on = isTrue_(r.active);
    return [{ text: (on ? '✅ ' : '⬜ ') + String(r.code).toUpperCase() + ', −' + r.pct + '%, исп. ' + uses + (r.limit ? ' из ' + r.limit : ''), callback_data: 'pt|' + String(r.code).toUpperCase().slice(0, 40) }];
  });
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function promoToggle_(code) {
  var sh = ss_().getSheetByName(SHEET.promos); if (!sh) return null;
  var rows = promoRows_(), i = -1;
  rows.forEach(function (r, k) { if (String(r.code).trim().toUpperCase() === code) i = k; });
  if (i < 0) return null;
  var on = !isTrue_(rows[i].active);
  sh.getRange(i + 2, ci_(PROMO_COLS, 'active') + 1).setValue(on);
  return on;
}
function promoCreate_(code, pct, limit) {
  code = String(code).trim().toUpperCase();
  if (!/^[A-ZА-Я0-9_-]{3,20}$/.test(code)) return 'Код: 3-20 символов, буквы, цифры, «-» или «_».';
  if (!(pct > 0 && pct <= 50)) return 'Скидка от 1 до 50%.';
  if (promoRows_().some(function (r) { return String(r.code).trim().toUpperCase() === code; })) return 'Такой промокод уже есть.';
  var sh = sheet_(SHEET.promos, PROMO_COLS), row = freeRow_(sh);
  var o = { code: code, pct: pct, until: '', active: true, withTokens: true, once: true, limit: limit || '', used: '', note: 'Создан в боте ' + mskText_(Date.now()) };
  sh.getRange(row, 1, 1, PROMO_COLS.length).setValues([PROMO_COLS.map(function (c) { return o[c[0]] === undefined ? '' : o[c[0]]; })]);
  return '';
}

/* ---------- отзывы: фото покупателей проверяет менеджер ---------- */
function reviewToManager_(r) {
  var admin = props_().getProperty('ADMIN_CHAT_ID'); if (!admin) return;
  var ids = String(r.photos || '').split(/\s+/).filter(Boolean);
  var text = '⭐ <b>Новый отзыв ' + '★'.repeat(Math.max(1, Math.min(5, +r.rating || 0))) + '</b> от @' + hesc_(r.login) + '\n«' + hesc_(String(r.title || '').slice(0, 60)) + '», заказ ' + hesc_(r.no) +
    (r.text ? '\n\n' + hesc_(String(r.text).slice(0, 600)) : '') + '\n\nНачислено ' + r.reward + ' ониксов.' + (ids.length ? '\n📸 Фото: ' + ids.length + '. На сайте появятся после «Показать».' : '');
  if (ids.length) sendAlbum_(admin, ids.map(drivePhotoUrl_), '');
  var kb = ids.length ? [[{ text: '✅ Показать фото', callback_data: 'rv|' + r.no + '|' + r.productId + '|y' }, { text: '🙈 Скрыть фото', callback_data: 'rv|' + r.no + '|' + r.productId + '|n' }]] : [];
  kb.push([{ text: '🚫 Скрыть весь отзыв', callback_data: 'rv|' + r.no + '|' + r.productId + '|x' }]);
  tgSend_(admin, text, kb);
}
function reviewQueue_(chat) {
  var list = DB.reviewRows_().filter(function (r) { return String(r.photoSt || '').trim() === 'на проверке'; });
  if (!list.length) { tgSend_(chat, '⭐ Все фото из отзывов проверены 🎉'); return; }
  tgSend_(chat, '⭐ <b>Фото ждут проверки: ' + list.length + '</b>\nПоказываю по очереди.');
  list.slice(0, 5).forEach(function (r) { reviewToManager_(r); });
}
function setReviewHidden_(no, pid) {
  var sh = ss_().getSheetByName(SHEET.reviews); if (!sh) return false;
  var rows = DB.reviewRows_(), i = -1; rows.forEach(function (r, k) { if (r.no === no && r.productId === pid) i = k; });
  if (i < 0) return false;
  sh.getRange(i + 2, ci_(REVIEW_COLS, 'status') + 1).setValue('скрыт');
  return true;
}

function adminCallback_(cq) {
  if (!cq.message) return;
  var chat = cq.message.chat.id, mid = cq.message.message_id, a = String(cq.data || '').split('|');
  if (!isAdmin_(chat)) { if (!custCallback_(cq, a)) tgAnswer_(cq.id, 'Эта кнопка больше не работает'); return; }
  if (['m', 'mo', 'q', 'ns', 'fq', 'ph'].indexOf(a[0]) >= 0 || (a[0] === 'bn' && a.length === 1)) { custCallback_(cq, a); return; }
  var p = props_();
  // ---- рассылки и авто-сообщения ----
  if (a[0] === 'bm') { tgAnswer_(cq.id, ''); bcMenu_(chat); return; }
  if (a[0] === 'bp') { tgAnswer_(cq.id, ''); bcProducts_(chat); return; }
  if (a[0] === 'bpp') { tgAnswer_(cq.id, ''); bcPreview_(chat, { t: 'prod', id: a[1], iv: Math.floor(Math.random() * 20) }); return; }
  if (a[0] === 'bn') {
    tgAnswer_(cq.id, '');
    if (a[1] === 'n') { p.setProperty('adminAwait', 'feat'); tgSend_(chat, '🚀 Коротко напишите, что нового на сайте или в магазине (например: «подборка образов» или «быстрая оплата»). Бот соберёт из этого пост. /cancel: отмена.'); return; }
    var kind = a[1] === 'r' ? pick_(['prod', 'fresh', 'sale']) : a[1] === 'f' ? 'fresh' : 'sale', d = { t: kind, iv: Math.floor(Math.random() * 20), n: 3 };
    if (kind === 'prod') { var L = freshList_(6); if (L.length) d.id = pick_(L).id; }
    bcPreview_(chat, d); return;
  }
  if (a[0] === 'bx') { var od = bcDraft_(); tgAnswer_(cq.id, 'Другой вариант'); if (od) { od.iv = (od.iv || 0) + 1; bcPreview_(chat, od); } return; }
  if (a[0] === 'bz') { tgAnswer_(cq.id, a[1] === 'x' ? 'Отменено' : 'Отправляю…'); bcSend_(chat, a[1]); return; }
  if (a[0] === 'ac') { tgAnswer_(cq.id, ''); autoMenu_(chat, null); return; }
  if (a[0] === 'at') {
    if (a[1] === 'demo') { tgAnswer_(cq.id, 'Отправляю примеры'); botDemo_(chat); return; }
    var cfg = autoCfg_(); cfg[a[1]] = cfg[a[1]] ? 0 : 1; p.setProperty('autoCfg', JSON.stringify(cfg)); tgAnswer_(cq.id, cfg[a[1]] ? 'Включено' : 'Выключено'); autoMenu_(chat, mid); return;
  }
  // ---- промокоды и отзывы ----
  if (a[0] === 'pl') { tgAnswer_(cq.id, ''); promoList_(chat, null); return; }
  if (a[0] === 'pt') { var on = promoToggle_(a[1]); tgAnswer_(cq.id, on === null ? 'Промокод не найден' : a[1] + (on ? ': включён' : ': выключен')); promoList_(chat, mid); return; }
  if (a[0] === 'rl') { tgAnswer_(cq.id, ''); reviewQueue_(chat); return; }
  if (a[0] === 'rv') {
    var done = a[3] === 'x' ? setReviewHidden_(a[1], a[2]) : setReviewPhotoSt_(a[1], a[2], a[3] === 'y' ? 'показывать' : 'скрыть');
    tgAnswer_(cq.id, !done ? 'Отзыв не найден' : a[3] === 'y' ? 'Фото показаны на сайте' : a[3] === 'n' ? 'Фото скрыты' : 'Отзыв скрыт с сайта');
    if (done) tgEdit_(chat, mid, String(cq.message.text || '').slice(0, 3500) + '\n\n' + (a[3] === 'y' ? '✅ Фото на сайте' : a[3] === 'n' ? '🙈 Фото скрыты' : '🚫 Отзыв скрыт'), []);
    return;
  }
  if (a[0] === 'ml') { tgAnswer_(cq.id, ''); adminOrders_(chat, mid, a[1] === '0' ? 'a' : a[1], a[2]); return; }
  if (a[0] === 'st') { tgAnswer_(cq.id, ''); adminStats_(chat); return; }
  if (a[0] === 'cf') { p.setProperty('adminAwait', 'client'); tgAnswer_(cq.id, ''); tgSend_(chat, 'Отправьте логин, ID, @telegram или телефон клиента.'); return; }
  if (a[0] === 'bcs') { p.setProperty('adminAwait', 'broadcast'); tgAnswer_(cq.id, ''); tgSend_(chat, 'Отправьте текст рассылки одним сообщением или фото с подписью. Сначала покажу, как это увидят клиенты. /cancel: отмена.'); return; }
  if (a[0] === 'rp') { p.setProperty('adminAwait', 'reply|' + a[1]); tgAnswer_(cq.id, ''); var ru = tgUserByChat_(a[1]); tgSend_(chat, '✍️ Напишите ответ' + (ru ? ' для @' + hesc_(ru.login) : '') + ' одним сообщением (можно фото). /cancel: отмена.'); return; }
  if (a[0] === 'nt') { p.setProperty('adminAwait', 'note|' + a[1]); tgAnswer_(cq.id, ''); tgSend_(chat, '📝 Заметка к заказу ' + hesc_(a[1]) + ' (видите только вы). Отправьте текст или «-», чтобы очистить. /cancel: отмена.'); return; }
  if (a[0] === 'c') { var cu = DB.getUser(a[1]); tgAnswer_(cq.id, ''); if (!cu) { tgSend_(chat, 'Клиент не найден.'); return; } clientCard_(chat, cu, /^👤/.test(String(cq.message.text || '')) ? mid : null); return; }
  if (a[0] === 't') {
    var tu = DB.getUser(a[1]); if (!tu) { tgAnswer_(cq.id, 'Клиент не найден'); return; }
    var dd = parseInt(a[2], 10) || 0; var nu = adjustClient_(tu, dd);
    tgAnswer_(cq.id, (dd > 0 ? '+' : '') + dd + ', баланс ' + (nu ? nu.balance : '?')); if (nu) clientCard_(chat, nu, mid); return;
  }
  if (a[0] === 'd') {
    var du = DB.getUser(a[1]); if (!du) { tgAnswer_(cq.id, 'Клиент не найден'); return; }
    tgAnswer_(cq.id, ''); tgEdit_(chat, mid, '⚠️ <b>Удалить @' + hesc_(du.login) + '?</b>\nОниксов: ' + (du.balance || 0) + '. Аккаунт и вход исчезнут, заказы останутся в таблице как история.', [[{ text: 'Да, удалить', callback_data: 'dy|' + du.id }, { text: 'Отмена', callback_data: 'c|' + du.id }]]); return;
  }
  if (a[0] === 'dy') {
    var yu = DB.getUser(a[1]); if (!yu) { tgAnswer_(cq.id, 'Уже удалён'); return; }
    removeClient_(yu); tgAnswer_(cq.id, 'Удалён'); tgEdit_(chat, mid, '🗑 Клиент @' + hesc_(yu.login) + ' удалён. Заказы сохранены в таблице.', []); return;
  }
  if (a[0] === 'o') { tgAnswer_(cq.id, ''); orderCard_(chat, a[1], /^🧾|^📦/.test(String(cq.message.text || '')) ? mid : null); return; }
  // p|no: оплачен, s|no|i: статус
  var f = orderIdx_(a[1]), sh = ss_().getSheetByName(SHEET.orders);
  if (!f || !sh) { tgAnswer_(cq.id, 'Заказ ' + a[1] + ' не найден'); return; }
  var isCard = /^🧾/.test(String(cq.message.text || ''));
  if (a[0] === 'p') { sh.getRange(f.row, ci_(ORDER_COLS, 'paid') + 1).setValue(true); tgAnswer_(cq.id, '💰 ' + a[1] + ': отмечен оплаченным'); if (isCard) orderCard_(chat, f.o.no, mid); return; }
  var list = adminStages_(String(f.o.kind)), st = list[+a[2]];
  if (!st) { tgAnswer_(cq.id, 'Неизвестный статус'); return; }
  sh.getRange(f.row, ci_(ORDER_COLS, 'status') + 1).setValue(st);
  try { SpreadsheetApp.flush(); syncXp_(); tgStatuses_(); } catch (e) { console.error('status now', e && e.stack || e); } // клиент узнаёт сразу, а не через минуту
  tgAnswer_(cq.id, '✅ ' + a[1] + ': ' + st + ', клиенту отправлено');
  if (isCard) orderCard_(chat, f.o.no, mid);
}

function adminText_(m, text) {
  var chat = m.chat.id, p = props_(), aw = p.getProperty('adminAwait') || '', mm;
  // ответ свайпом на вопрос покупателя: берём последнюю метку #c<чат> в конце сообщения
  var rt = m.reply_to_message && String(m.reply_to_message.text || m.reply_to_message.caption || '').match(/#c(-?\d+)\s*$/);
  if (rt && !/^\//.test(text)) { replyToClient_(chat, rt[1], m); return; }
  if (/^\/cancel/i.test(text)) { p.deleteProperty('adminAwait'); tgSend_(chat, 'Отменено.'); return; }
  if (/^reply\|/.test(aw) && !/^\//.test(text)) { p.deleteProperty('adminAwait'); replyToClient_(chat, aw.split('|')[1], m); return; }
  if (aw === 'broadcast' || /^\/broadcast/i.test(String(m.caption || ''))) {
    var cap = String(m.caption || '').replace(/^\/broadcast\s*/i, '').trim();
    if (m.photo && m.photo.length) { p.deleteProperty('adminAwait'); askBroadcast_(chat, cap, m.photo[m.photo.length - 1].file_id); return; }
  }
  if (!m.text) { tgSend_(chat, 'Чтобы отправить фото покупателю, ответьте (свайп) на его вопрос или нажмите «✍️ Ответить».'); return; }
  if (/^note\|/.test(aw) && !/^\//.test(text)) {
    p.deleteProperty('adminAwait'); var no = aw.split('|')[1], f = orderIdx_(no);
    if (!f) { tgSend_(chat, 'Заказ не найден.'); return; }
    ss_().getSheetByName(SHEET.orders).getRange(f.row, ci_(ORDER_COLS, 'note') + 1).setValue(text === '-' ? '' : safeCell_(text));
    tgSend_(chat, '📝 Сохранено.'); orderCard_(chat, no); return;
  }
  if (/^\/(menu|admin|start)/i.test(text)) { p.deleteProperty('adminAwait'); adminMenu_(chat); return; }
  if (aw === 'feat' && !/^\//.test(text) && text !== BTN_.aBc) { p.deleteProperty('adminAwait'); bcPreview_(chat, { t: 'feat', f: text.slice(0, 80), iv: Math.floor(Math.random() * 20) }); return; }
  if (text === BTN_.aOrd || /^\/orders/i.test(text)) { adminOrders_(chat); return; }
  if (text === BTN_.aUnp) { adminOrders_(chat, null, 'u'); return; }
  if (text === BTN_.aBc || text === '🆕 Пост по товару') { p.deleteProperty('adminAwait'); bcMenu_(chat); return; }
  if (text === BTN_.aPromo || /^\/promos?$/i.test(text)) { promoList_(chat, null); return; }
  if (text === BTN_.aRev || /^\/reviews/i.test(text)) { reviewQueue_(chat); return; }
  if (text === '⚙️ Авто-рассылки') { autoMenu_(chat, null); return; }
  if (text === BTN_.aSum || /^\/stats/i.test(text)) { adminStats_(chat); return; }
  if (text === BTN_.aHelp || /^\/help/i.test(text)) { adminHelp_(chat); return; }
  if (text === BTN_.aCli) { p.setProperty('adminAwait', 'client'); tgSend_(chat, 'Отправьте логин, ID, @telegram или телефон клиента.'); return; }
  if ((mm = text.match(/^\/promo\s+(\S+)\s+(\d+(?:[.,]\d+)?)(?:\s+(\d+))?\s*$/i))) {
    var e1 = promoCreate_(mm[1], parseFloat(mm[2].replace(',', '.')), parseInt(mm[3], 10) || 0);
    tgSend_(chat, e1 ? '⚠️ ' + e1 : '✅ Промокод <code>' + hesc_(mm[1].toUpperCase()) + '</code> на −' + mm[2] + '% создан и включён. Один раз на клиента, можно с ониксами.' + (mm[3] ? ' Лимит: ' + mm[3] + '.' : ''));
    if (!e1) promoList_(chat, null); return;
  }
  if ((mm = text.match(/^\/client\s+(.+)/i))) { var cu = findClient_(mm[1]); if (cu) clientCard_(chat, cu); else tgSend_(chat, 'Клиент не найден.'); return; }
  if ((mm = text.match(/^\/tokens\s+(\S+)\s+([+-]?\d+)\s*(.*)$/i))) {
    var tu = findClient_(mm[1]); if (!tu) { tgSend_(chat, 'Клиент не найден.'); return; }
    var nu = adjustClient_(tu, parseInt(mm[2], 10), mm[3] || 'Менеджер (Telegram)'); tgSend_(chat, '✅ @' + hesc_(nu.login) + ': баланс ' + nu.balance + ' ониксов'); return;
  }
  if ((mm = text.match(/^\/delete\s+(\S+)/i))) { var du = findClient_(mm[1]); if (!du) { tgSend_(chat, 'Клиент не найден.'); return; } tgSend_(chat, '⚠️ <b>Удалить @' + hesc_(du.login) + '?</b> Заказы останутся в таблице.', [[{ text: 'Да, удалить', callback_data: 'dy|' + du.id }, { text: 'Отмена', callback_data: 'c|' + du.id }]]); return; }
  if ((mm = text.match(/^\/broadcast\s+([\s\S]+)/i))) { askBroadcast_(chat, mm[1].trim()); return; }
  if (aw === 'broadcast') { p.deleteProperty('adminAwait'); askBroadcast_(chat, text); return; }
  if (/^(OS-)?\d{2}-\d{3,}$/i.test(text)) { orderCard_(chat, /^OS-/i.test(text) ? text.toUpperCase() : 'OS-' + text, null); return; }
  if (aw === 'client' || text.length < 40) {
    var fu = findClient_(text);
    if (fu) { p.deleteProperty('adminAwait'); clientCard_(chat, fu); return; }
    if (aw === 'client') { tgSend_(chat, 'Не нашёл. Проверьте логин, ID или телефон и отправьте ещё раз. /cancel: отмена.'); return; }
  }
  adminMenu_(chat);
}

function tgHandle_(updates) {
  var p = props_(), off = parseInt(p.getProperty('tgOffset') || '0', 10) || 0;
  updates.forEach(function (up) {
    off = Math.max(off, up.update_id + 1);
    try {
      if (up.callback_query) { adminCallback_(up.callback_query); return; }
      var m = up.message; if (!m || !m.chat || m.chat.type !== 'private') return;
      var text = String(m.text || '').trim(), who = m.chat.username ? '@' + m.chat.username : (m.chat.first_name || ''), c = m.chat.id;
      if (/^\/start\s+T\d{12}/.test(text)) {
        var r = OnionCore.tgBind(DB, text, c, who);
        if (r && r.ok) { if (r.user && r.user.phoneOk === false) askPhone_(c); else sendWelcome_(m, true); }
        else tgSend_(c, 'Ссылка устарела. Откройте на сайте кабинет, раздел «Уведомления в Telegram», и нажмите «Подключить» ещё раз.', [[btnUrl_('🔔 Открыть кабинет', 'account')]]);
        return;
      }
      if (m.contact) { phoneContact_(m); return; }
      if (claimAdmin_(m)) return;
      if (isAdmin_(c)) { adminText_(m, text); return; }
      var old = OLD_BTN_[text];
      if (/^\/start/.test(text)) sendWelcome_(m, !!tgUserByChat_(c));
      else if (text === BTN_.ord || /^\/orders/.test(text)) custOrders_(c);
      else if (text === BTN_.bon || /^\/bonus/.test(text)) custBonus_(c);
      else if (text === BTN_.cat || old === 'cat' || /^\/catalog/.test(text)) custCatalog_(c);
      else if (text === BTN_.faq || old === 'faq' || /^\/(faq|terms|info)/.test(text)) custFaq_(c, null, '');
      else if (old === 'set' || /^\/settings/.test(text)) custSettings_(c);
      else if (text === BTN_.sup || old === 'sup' || /^\/(help|support|ask)/.test(text)) custAsk_(c, '');
      else if (/^\/menu/.test(text)) tgSend_(c, pick_(V_.welcomeBack), custKb_());
      else if (/^\//.test(text)) tgSend_(c, 'Такой команды нет, но меню всегда внизу 👇', custKb_());
      else relayToManager_(m);
    } catch (e) { console.error('tg', e && e.stack || e); }
  });
  p.setProperty('tgOffset', String(off));
}

/* подтверждение телефона: кнопка Telegram «Поделиться номером» (Telegram сам подтверждает, что номер владельца) */
function askPhone_(chat) {
  tgSend_(chat, '<b>Последний шаг: подтвердите телефон 📱</b>\nНажмите кнопку внизу «Поделиться номером». Telegram передаст только ваш номер, так мы защищаем бонусы от накруток.\n\nПосле этого начислим приветственные ониксы, а ещё станут доступны бонусы за друзей и подарок на день рождения.',
    { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
}
function phoneContact_(m) {
  var c = m.chat.id, u = tgUserByChat_(c);
  if (!u) { tgSend_(c, 'Сначала откройте на сайте кабинет и нажмите «Подтвердить телефон»: бот привяжется к вашему аккаунту.', custKb_()); return; }
  var r = OnionCore.phoneConfirm(DB, u, m.contact, m.from && m.from.id);
  if (!r.ok) { tgSend_(c, '⚠️ ' + hesc_(r.msg), custKb_()); return; }
  tgSend_(c, '<b>Телефон подтверждён ✅</b>' + (r.changed ? '\nВ кабинете теперь номер из Telegram.' : '') + (r.got ? '\nНа баланс начислено ' + r.got + ' ониксов 🎁' : '') + '\nБонусы магазина теперь доступны.', custKb_());
}

/* список команд в меню «/»: покупателям свои, менеджеру (только его чат) расширенный */
function setBotCommands_() {
  tgApi_('setMyCommands', { commands: [{ command: 'menu', description: 'Меню' }, { command: 'orders', description: 'Мои заказы и статусы' }, { command: 'bonus', description: 'Ониксы, уровень, промокоды' }, { command: 'faq', description: 'Частые вопросы' }, { command: 'catalog', description: 'Каталог на сайте' }, { command: 'ask', description: 'Написать менеджеру' }] });
  var a = props_().getProperty('ADMIN_CHAT_ID');
  if (a) tgApi_('setMyCommands', { scope: { type: 'chat', chat_id: Number(a) }, commands: [{ command: 'menu', description: 'Панель менеджера' }, { command: 'orders', description: 'Активные заказы' }, { command: 'stats', description: 'Сводка' }, { command: 'promos', description: 'Промокоды' }, { command: 'promo', description: '/promo КОД 10: новый промокод' }, { command: 'reviews', description: 'Фото из отзывов на проверке' }, { command: 'client', description: '/client логин: карточка клиента' }, { command: 'tokens', description: '/tokens логин +50 причина' }, { command: 'delete', description: '/delete логин: удалить клиента' }, { command: 'broadcast', description: '/broadcast текст: рассылка' }, { command: 'cancel', description: 'Отменить ввод' }, { command: 'help', description: 'Как работать с ботом' }] });
}

/* ====================== голос бота, посты для рассылок ======================
   Тексты живые, варианты подбираются случайно, чтобы сообщения не повторялись. */
function pick_(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickAt_(a, i) { return a[(i || 0) % a.length]; }
function fill_(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] !== undefined ? o[k] : m; }); }
var V_ = {
  fresh1: ['Свежая вещь в каталоге 👀', 'Пополнение: вот что приехало', 'Новинка, таких у нас обычно немного', 'Выложили новую вещь, загляните'],
  freshN: ['Пополнение: {n} новых вещей', 'В каталоге {n} новинок', 'Выложили {n} новых вещей'],
  sale: ['Цены снизили, пока действует 🔥', 'Скидки до {pct}%', 'Подборка со скидкой', 'Хорошая цена на эти вещи, долго не продержится'],
  feat: ['Новое у нас: {f}. Загляните, должно быть удобнее', 'Добавили {f}, попробуйте', 'Теперь на сайте есть {f}'],
  drop: ['Вещь из избранного подешевела 📉', 'Цена в избранном снизилась 📉', 'Из избранного стало дешевле 📉'],
  restock: ['Снова в продаже 🛍', 'Вы ждали, и вот она 🛍', 'Вернулась в каталог 🛍'],
  winback: ['Давно не виделись 👋', 'Заглядывайте, у нас много нового 👋', 'Скучаем! Вот что появилось 👋'],
  welcomeBack: ['Привет! Меню внизу 👇', 'Здравствуйте! Чем помочь? Меню внизу 👇'],
  asked: ['✅ Передал менеджеру, ответ придёт сюда же.', '✅ Принял, менеджер уже видит ваше сообщение. Ответ придёт в этот чат.', '✅ Отправил менеджеру. Как только он ответит, сообщение появится здесь.']
};
function IMG_(n) { return siteBase_() + 'assets/bot/' + n + '.jpg'; }
function photoUrl_(id) { return siteBase_() + 'img/full/' + id + '.jpg'; }
function prodPhoto_(c) { return c && c.photos && c.photos.length ? photoUrl_(c.photos[0].id) : ''; }
function detailOf_(c, key) { var d = (c.details || []).filter(function (x) { return String(x[0]).toLowerCase() === key; })[0]; return d ? d[1] : ''; }
function cap1_(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
/* подпись к товару для ручной рассылки: название, цена, цвета, размеры, по строкам */
function postCaption_(c) {
  var st = detailOf_(c, 'состояние'), L = ['<b>' + hesc_(c.title) + '</b>'];
  L.push('💰 ' + (c.oldPrice > c.price ? '<s>' + rub_(c.oldPrice) + '</s> ' : '') + '<b>' + rub_(c.price) + '</b>');
  if (st) L.push('✨ Состояние: ' + hesc_(st));
  if (c.colors && c.colors.length) L.push('🎨 ' + hesc_(cap1_(c.colors.join(', '))));
  if (c.sizes && c.sizes.length) L.push('📏 Размеры: ' + hesc_(c.sizes.join(', ')));
  L.push(c.status === 'preorder' ? '✈️ Под заказ из Китая' : '📍 В наличии в Москве');
  return L.join('\n');
}
function freshList_(n, cat) {
  cat = cat || DB.loadCatalog_() || {};
  return Object.keys(cat).sort(function (a, b) { return b - a; }).filter(function (id) { return cat[id].status === 'stock' || cat[id].status === 'preorder'; }).slice(0, n).map(function (id) { return cat[id]; });
}
function saleList_(n) {
  var cat = DB.loadCatalog_() || {};
  return Object.keys(cat).map(function (id) { return cat[id]; }).filter(function (c) { return (c.status === 'stock' || c.status === 'preorder') && c.oldPrice > c.price; })
    .map(function (c) { return { c: c, d: Math.round((1 - c.price / c.oldPrice) * 100) }; }).sort(function (a, b) { return b.d - a.d; }).slice(0, n);
}
function sendAlbum_(chat, urls, caption) {
  urls = urls.filter(Boolean).slice(0, 10);
  if (!urls.length) return null;
  if (urls.length === 1) return tgPhoto_(chat, urls[0], caption);
  return tgApi_('sendMediaGroup', { chat_id: String(chat), media: urls.map(function (u, i) { var m = { type: 'photo', media: u }; if (i === 0 && caption) { m.caption = String(caption).slice(0, 1000); m.parse_mode = 'HTML'; } return m; }) });
}
function tgPhoto_(chat, url, caption, kb) {
  var p = { chat_id: String(chat), photo: url, caption: String(caption || '').slice(0, 1000), parse_mode: 'HTML' };
  if (kb) p.reply_markup = Array.isArray(kb) ? { inline_keyboard: kb } : kb;
  var r = tgApi_('sendPhoto', p);
  if (!r || !r.ok) { if (r && r.error_code === 403) return r; return tgSend_(chat, caption, kb); }
  return r;
}
function notifyHtml_(u, text, kb) {
  var r = tgSend_(u.tgChat, text, kb);
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); }
  return !!(r && r.ok);
}
/* пост рассылки: с фото только для ручных рассылок менеджера (b.photo), авто-сообщения отправляются без фото */
function sendPostTo_(u, b) {
  var r = b.photo ? tgPhoto_(u.tgChat, b.photo, b.text, b.kb) : tgSend_(u.tgChat, b.text, b.kb);
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); return false; }
  return !!(r && r.ok);
}
function autoCfg_() {
  var d = { fresh: 1, sale: 1, drop: 1, nudge: 1, remind: 1 };
  try { var s = JSON.parse(props_().getProperty('autoCfg') || '{}'); Object.keys(s).forEach(function (k) { d[k] = s[k] ? 1 : 0; }); } catch (e) { }
  return d;
}
function canPush_(u, hours) { return !u.lastPush || Date.now() - (+u.lastPush || 0) > hours * 3600000; }
function markPush_(u) { u.lastPush = Date.now(); DB.saveUser(u); }
function mskHour_() { return +Utilities.formatDate(new Date(), 'Europe/Moscow', 'H'); }

/* ---------- авто-сообщения клиентам: только текст и одна кнопка ---------- */
function autoFresh_(fresh, cat) {
  if (fresh.length === 1) { var c = cat[fresh[0]]; return { title: pick_(V_.fresh1), body: hesc_(c.title) + ', ' + rub_(c.price) + (c.status === 'preorder' ? ', под заказ из Китая.' : ', в наличии в Москве.'), btn: btnUrl_('Посмотреть', 'p-' + c.id) }; }
  var L = fresh.slice(0, 3).map(function (id) { return cat[id]; });
  return { title: fill_(pick_(V_.freshN), { n: fresh.length }) + ' ✨', body: L.map(function (c) { return hesc_(c.title) + ', ' + rub_(c.price); }).join('\n') + (fresh.length > 3 ? '\nи ещё ' + (fresh.length - 3) + ' в каталоге' : ''), btn: btnUrl_('Смотреть новинки', 'catalog') };
}
function autoSale_() {
  var S = saleList_(3); if (!S.length) return null;
  return { title: fill_(pick_(V_.sale), { pct: Math.max(5, Math.floor(S[0].d / 5) * 5) }), body: S.map(function (x) { return hesc_(x.c.title) + ': ' + rub_(x.c.price) + ' вместо ' + rub_(x.c.oldPrice); }).join('\n'), btn: btnUrl_('Смотреть скидки', 'catalog') };
}

/* ---------- посты для ручных рассылок менеджера: здесь фото можно ---------- */
function bcDraft_(d) {
  var p = props_();
  if (d === null) { p.deleteProperty('bcDraft'); return null; }
  if (d) { p.setProperty('bcDraft', JSON.stringify(d)); return d; }
  try { return JSON.parse(p.getProperty('bcDraft') || 'null'); } catch (e) { return null; }
}
function bcBuild_(d) {
  var cat = DB.loadCatalog_() || {}, out = { text: '', photo: '', kb: [] }, iv = d.iv || 0;
  if (d.t === 'prod') {
    var c = cat[d.id]; if (!c) return null;
    out.text = '<b>' + pickAt_(V_.fresh1, iv) + '</b>\n\n' + postCaption_(c); out.photo = prodPhoto_(c);
    out.kb = [[btnUrl_('🛍 Открыть товар', 'p-' + c.id)]];
    return out;
  }
  if (d.t === 'fresh') {
    var L = freshList_(d.n || 3, cat); if (!L.length) return null;
    if (L.length === 1) return bcBuild_({ t: 'prod', id: L[0].id, iv: iv });
    out.text = '<b>' + fill_(pickAt_(V_.freshN, iv), { n: L.length }) + ' ✨</b>\n\n' + L.map(function (c) { return '🛍 ' + hesc_(c.title) + ', <b>' + rub_(c.price) + '</b>'; }).join('\n');
    out.photo = prodPhoto_(L[0]); out.kb = [[btnUrl_('Смотреть новинки', 'catalog')]];
    return out;
  }
  if (d.t === 'sale') {
    var S = saleList_(3); if (!S.length) return null;
    out.text = '<b>' + fill_(pickAt_(V_.sale, iv), { pct: Math.max(5, Math.floor(S[0].d / 5) * 5) }) + '</b>\n\n' + S.map(function (x) { return '🔥 ' + hesc_(x.c.title) + '\n<s>' + rub_(x.c.oldPrice) + '</s> <b>' + rub_(x.c.price) + '</b>, −' + x.d + '%'; }).join('\n');
    out.photo = prodPhoto_(S[0].c); out.kb = [[btnUrl_('Смотреть скидки', 'catalog')]];
    return out;
  }
  if (d.t === 'feat') {
    out.text = '🚀 ' + fill_(pickAt_(V_.feat, iv), { f: '<b>' + hesc_(d.f) + '</b>' }); out.photo = IMG_('welcome');
    out.kb = [[btnUrl_('Посмотреть на сайте', '')]];
    return out;
  }
  if (d.t === 'custom') { out.text = hesc_(d.text || ''); out.photo = d.photo || ''; return out; }
  return null;
}
function bcPreview_(chat, d) {
  var b = bcBuild_(d);
  if (!b) { tgSend_(chat, 'Не из чего собрать такой пост (нет подходящих товаров). Выберите другой вариант.'); return; }
  bcDraft_(d);
  tgSend_(chat, '👇 <b>Так увидят покупатели</b>');
  if (b.photo) tgPhoto_(chat, b.photo, b.text, b.kb); else tgSend_(chat, b.text, b.kb);
  var n = broadcastTargets_('').length, na = broadcastTargets_('a').length;
  tgSend_(chat, 'Что дальше?', [[{ text: '✅ Отправить всем (' + n + ')', callback_data: 'bz|y' }], [{ text: '📦 Тем, у кого активный заказ (' + na + ')', callback_data: 'bz|a' }],
    [{ text: '👤 Только мне, проверить', callback_data: 'bz|m' }, { text: '🔄 Другой текст', callback_data: 'bx' }], [{ text: 'Отмена', callback_data: 'bz|x' }]]);
}
function bcSend_(chat, mode) {
  var d = bcDraft_(), b = d && bcBuild_(d);
  if (!b) { tgSend_(chat, 'Черновик пропал, начните рассылку заново.'); return; }
  if (mode === 'x') { bcDraft_(null); tgSend_(chat, 'Отменил.'); return; }
  if (mode === 'm') { if (b.photo) tgPhoto_(chat, b.photo, b.text, b.kb); else tgSend_(chat, b.text, b.kb); tgSend_(chat, '☝️ Это вам для проверки, остальным не отправлено.'); return; }
  var all = broadcastTargets_(mode === 'a' ? 'a' : ''), sent = 0;
  all.slice(0, 300).forEach(function (u) { if (sendPostTo_(u, b)) sent++; Utilities.sleep(40); });
  bcDraft_(null);
  tgSend_(chat, '✅ Рассылка отправлена: ' + sent + ' из ' + all.length);
}
function bcMenu_(chat) {
  tgSend_(chat, '📣 <b>Рассылка</b>\nВыберите, что отправить. Бот соберёт текст сам, каждый раз по-разному, а перед отправкой вы увидите готовый пост. В рассылке можно с фото.', [
    [{ text: '🛍 Пост про товар', callback_data: 'bp' }, { text: '✨ Новинки', callback_data: 'bn|f' }],
    [{ text: '🔥 Скидки', callback_data: 'bn|s' }, { text: '🎲 Случайный пост', callback_data: 'bn|r' }],
    [{ text: '🚀 Новость магазина', callback_data: 'bn|n' }, { text: '✍️ Свой текст или фото', callback_data: 'bcs' }]]);
}
function bcProducts_(chat) {
  var L = freshList_(10), kb = L.map(function (c) { return [{ text: String(c.title).slice(0, 40) + ', ' + rub_(c.price), callback_data: 'bpp|' + c.id }]; });
  if (!L.length) { tgSend_(chat, 'В каталоге пока нет товаров для поста.'); return; }
  tgSend_(chat, '🛍 <b>Какой товар показать клиентам?</b>\nСвежие сверху.', kb);
}
function autoMenu_(chat, msgId) {
  var c = autoCfg_(), on = function (k) { return c[k] ? '✅ ' : '⬜ '; };
  var text = '⚙️ <b>Авто-сообщения клиентам</b>\nБот пишет сам, только текстом и с одной кнопкой. Ночью не беспокоит, одному человеку не чаще раза в сутки.\n\n' +
    '✨ Новинки: как только появились в каталоге\n🔥 Скидки: раз в 3 дня вечером\n📉 Подешевело в избранном\n👋 Давно не заходили: раз в месяц\n💳 Напоминания про оплату и отзыв';
  var kb = [[{ text: on('fresh') + 'Новинки', callback_data: 'at|fresh' }, { text: on('sale') + 'Скидки', callback_data: 'at|sale' }],
    [{ text: on('drop') + 'Подешевело', callback_data: 'at|drop' }, { text: on('nudge') + 'Давно не были', callback_data: 'at|nudge' }],
    [{ text: on('remind') + 'Напоминания', callback_data: 'at|remind' }], [{ text: '🧪 Показать примеры мне', callback_data: 'at|demo' }]];
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
/* фото товаров заказа (альбом): менеджеру и самому клиенту по его кнопке */
function orderItems_(no) {
  var f = orderIdx_(no), items = []; if (!f) return { f: null, items: [] };
  try { items = JSON.parse(f.o.items || '[]'); } catch (e) { items = []; }
  return { f: f, items: items };
}
function orderPhotos_(chat, no) {
  var r = orderItems_(no); if (!r.f) return false;
  var urls = [], seen = {};
  r.items.forEach(function (it) { var id = it.photo || it.thumb; if (id && !seen[id]) { seen[id] = 1; urls.push(photoUrl_(id)); } });
  if (!urls.length) return false;
  var cap = '🖼 <b>Заказ ' + hesc_(no) + '</b>\n' + r.items.map(function (it) { return hesc_(it.title || '') + (it.size ? ', ' + hesc_(it.size) : '') + (it.color ? ', ' + hesc_(it.color) : '') + (it.qty > 1 ? ' × ' + it.qty : ''); }).join('\n');
  sendAlbum_(chat, urls, cap);
  return true;
}
/* примеры сообщений бота: приходят только менеджеру, клиентам ничего не уходит */
function botDemo_(chat) {
  tgSend_(chat, '🧪 <b>Примеры того, что бот пишет клиентам</b>\nЭто пробные сообщения, только вам.');
  tgPhoto_(chat, IMG_('welcome'), welcome_('Миша', true), welcomeKb_(true));
  tgSend_(chat, statusText_('OS-26-00001', 'Выкуплен'), statusKb_('OS-26-00001', 'Выкуплен'));
  tgSend_(chat, statusText_('OS-26-00001', 'Едет к вам'), statusKb_('OS-26-00001', 'Едет к вам'));
  tgSend_(chat, payText_('OS-26-00001', 26564), [[btnOrder_('OS-26-00001')]]);
  tgSend_(chat, statusText_('OS-26-00001', 'Получен'), statusKb_('OS-26-00001', 'Получен'));
  var cat = DB.loadCatalog_() || {}, L = freshList_(3, cat);
  if (L.length) { var a = autoFresh_(L.map(function (c) { return c.id; }), cat); tgSend_(chat, '<b>' + a.title + '</b>\n' + a.body, [[a.btn]]); }
  var s = autoSale_(); if (s) tgSend_(chat, '<b>' + s.title + '</b>\n' + s.body, [[s.btn]]);
  if (L.length) tgSend_(chat, '<b>' + pick_(V_.drop) + '</b>\n' + hesc_(L[0].title) + ': ' + rub_(L[0].price) + ' вместо ' + rub_(L[0].price + 500), [[btnUrl_('Посмотреть', 'p-' + L[0].id)]]);
}
function botDemo() { var a = props_().getProperty('ADMIN_CHAT_ID'); if (a) botDemo_(a); else Logger.log('Менеджер ещё не привязан: напишите боту /start с аккаунта @' + adminUser_()); }


/* ====================== РџСЂР°РІРёР»Р° РјР°РіР°Р·РёРЅР° (РѕР±С‰РёРµ СЃ СЃР°Р№С‚РѕРј) ====================== */
/* ONION SHOP, правила магазина (один файл для сайта и для Google Таблицы).
   Здесь: ониксы, уровни, задания, посылка, партнёрка, номера заказов и текст заказа.
   На сервере (Google Apps Script) этот же код работает с таблицей,
   на сайте в демо-режиме, с памятью браузера. */
var OnionCore = (function () {
  'use strict';

  // ---------------------------------------------------------------- правила (вариант Б)
  var RULES = {
    vipPrice: 99,
    tokenRub: 0.3,          // 1 оникс = 0,3 ₽ скидки
    maxShare: 0.12,         // ониксы и промокод вместе: не больше 12% суммы заказа
    balanceCap: 10000,      // выше этого баланса задания, вход и посылка дают опыт вместо ониксов (2 оникса = 1 XP)
    spinCost: 100,          // прокрут посылки
    reward: { register: 100, refFriend: 50, referrer: 100, checkin: 1, streak7: 10, task: 1, birthday: 3334, review: 5, reviewText: 15 },
    // подарок на день рождения: ониксы ≈ 1 000 ₽ (по курсу 0,3 ₽), XP, личный промокод; только аккаунтам старше 30 дней
      birthday: { tokens: 3334, xp: 1500, promoPct: 3.5, promoDays: 30, minAgeDays: 30 },
    refMinOrder: 1000,      // друг засчитывается после первого заказа от 1000 ₽
    refMaxPerMonth: 10,
    sessionDays: 120,
    /* Программа лояльности. Уровень месяца растёт от XP (опыта), обнуляется 1-го числа.
       XP: полученные заказы (1 XP за каждые 10 ₽), ежедневный вход, задания, посылка. */
    xpPerRub: 0.1,
    xpReward: { checkin: 10 },
    levels: [
      { key: 'bronze', name: 'Бронза', alias: ['новичок'], min: 0, tasks: 4, streak: 10, spins: 1, priority: '', perks: [
        ['Доступны 4 задания', 'Ежедневные, а также еженедельные и ежемесячные'],
        ['1 бесплатная посылка в игре в день', 'Игра «Посылка с сюрпризом», обновляется в 00:00 по Москве'],
        ['10 ониксов за серию 7 дней', 'Отмечайтесь 7 дней подряд'],
        ['Рамка «Бронза»', 'Доступна со статусом Бронза']] },
      { key: 'silver', name: 'Серебро', alias: ['модник'], min: 500, tasks: 5, streak: 12, spins: 1, priority: '', perks: [
        ['Доступны 5 заданий', 'На одно больше, чем на Бронзе'],
        ['1 бесплатная посылка в игре в день', 'Игра «Посылка с сюрпризом», обновляется в 00:00 по Москве'],
        ['12 ониксов за серию 7 дней', 'Вместо 10 на Бронзе'],
        ['Рамка «Серебро»', 'Доступна со статусом Серебро']] },
      { key: 'gold', name: 'Золото', alias: ['профи'], min: 1500, tasks: 6, streak: 15, spins: 1, priority: 'Повышенный', perks: [
        ['Доступны 6 заданий', 'На одно больше, чем на Серебре'],
        ['1 бесплатная посылка в игре в день', 'Игра «Посылка с сюрпризом», обновляется в 00:00 по Москве'],
        ['15 ониксов за серию 7 дней', 'Вместо 12 на Серебре'],
        ['Приоритет заказов', 'Менеджер видит пометку «Приоритет»'],
        ['Промокод −1,5% раз в месяц', 'На одну категорию, выпадает случайно'],
        ['Рамка «Золото»', 'Доступна со статусом Золото']] },
      { key: 'platinum', name: 'Платина', alias: ['эксперт'], min: 4000, tasks: 6, streak: 17, spins: 1, priority: 'Высокий', boost: 1, pack: 'pre10', perks: [
        ['Доступны 6 заданий', 'Как на Золоте'],
        ['1 бесплатная посылка в игре в день', 'Игра «Посылка с сюрпризом», обновляется в 00:00 по Москве'],
        ['17 ониксов за серию 7 дней', 'Вместо 15 на Золоте'],
        ['Высокий приоритет заказов', 'Менеджер берёт их раньше'],
        ['Промокод −1,5% на одну категорию', 'Раз в месяц, выпадает случайно'],
        ['Промокод −1,5% на любой товар', 'Отдельный, тоже раз в месяц'],
        ['Шансы в посылке выше', 'Пустые призы выпадают реже'],
        ['−10% на упаковку предзаказа', 'Раз в месяц, отмечается в корзине'],
        ['Рамка «Платина»', 'Доступна со статусом Платина']] },
      { key: 'diamond', name: 'Алмаз', alias: ['икона'], min: 8000, tasks: 6, streak: 20, spins: 3, priority: 'Наивысший', boost: 2, pack: 'free', perks: [
        ['Доступны 6 заданий', 'Как на Платине'],
        ['3 бесплатные посылки в игре в день', 'Игра «Посылка с сюрпризом», шансы выше, чем на Платине'],
        ['20 ониксов за серию 7 дней', 'Вместо 17 на Платине'],
        ['Наивысший приоритет заказов', 'Менеджер берёт их первыми'],
        ['3 промокода −2,5% в месяц', 'По одному в неделю'],
        ['Промокод −1,5% на одну категорию', 'Раз в месяц, выпадает случайно'],
        ['Промокод −1,5% на любой товар', 'Отдельный, тоже раз в месяц'],
        ['Бесплатная упаковка предзаказа', 'Раз в месяц, отмечается в корзине'],
        ['Рамка «Алмаз» с анимацией', 'Анимацию можно выбрать']] }
    ],
    // категории для промокода уровня Золото
    promoCats: [
      { key: 'shoes', label: 'Обувь', cats: ['shoes'] },
      { key: 'clothes', label: 'Одежда', cats: ['hoodies', 'sweaters', 'longsleeves', 'tees', 'polo', 'pants', 'jeans', 'shorts'] },
      { key: 'outer', label: 'Куртки', cats: ['outerwear', 'puffers'] },
      { key: 'acc', label: 'Аксессуары', cats: ['accessories'] }
    ],
    // задания: d: ежедневные (простые), w, еженедельные (сложнее), m, ежемесячные (самые сложные, заказы считаются по статусу «Получен»)
    // m: что считаем, n, цель, tk, ониксы, xp, очки уровня, auto, награду уже выдало само действие
    tasks: [
      { per: 'd', key: 'checkin', title: 'Зайти на сайт', hint: 'Отметьтесь сегодня', m: 'checkin', n: 1, tk: 1, xp: 10, auto: true },
      { per: 'd', key: 'view3', title: 'Посмотреть 3 товара', hint: 'Откройте три карточки', m: 'view', n: 3, tk: 3, xp: 10 },
      { per: 'd', key: 'view6', title: 'Посмотреть 6 товаров', hint: 'Откройте шесть разных карточек', m: 'view', n: 6, tk: 3, xp: 10 },
      { per: 'd', key: 'fav', title: 'Добавить товар в избранное', hint: 'Нажмите ♡ на товаре', m: 'fav', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'fav3', title: 'Добавить 3 товара в избранное', hint: 'Нажмите ♡ на трёх разных товарах', m: 'fav', n: 3, tk: 3, xp: 10 },
      { per: 'd', key: 'share', title: 'Поделиться товаром', hint: 'Кнопка «Поделиться» в карточке', m: 'share', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'pre', title: 'Открыть раздел «Предзаказ»', hint: 'Загляните, что едет из Китая', m: 'pre', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'stock', title: 'Заглянуть в раздел «В наличии»', hint: 'Вещи, которые уже в Москве', m: 'stock', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'cart', title: 'Положить товар в корзину', hint: 'Любой товар', m: 'cart', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'cart2', title: 'Положить 2 товара в корзину', hint: 'Два разных товара', m: 'cart', n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'info', title: 'Открыть «Частые вопросы»', hint: 'Раздел в меню', m: 'info', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'sale', title: 'Посмотреть 2 товара со скидкой', hint: 'Карточки с зачёркнутой ценой', m: 'sale', n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'brand', title: 'Открыть товары одного бренда', hint: 'Фильтр «Бренд» в каталоге', m: 'brand', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'search', title: 'Найти вещь через поиск', hint: 'Строка поиска вверху сайта', m: 'search', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'price', title: 'Выбрать фильтр по цене', hint: 'Фильтр «Цена» в каталоге', m: 'price', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'zoom', title: 'Рассмотреть фото вблизи', hint: 'Нажмите на фото товара', m: 'zoom', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'measure', title: 'Заглянуть в замеры', hint: 'Раздел «Замеры изделия» в карточке', m: 'measure', n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'shoes', title: 'Посмотреть 2 пары обуви', hint: 'Раздел «Обувь»', m: 'viewcat', cats: ['shoes'], n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'outer', title: 'Посмотреть 2 куртки или худи', hint: 'Куртки и худи', m: 'viewcat', cats: ['outerwear', 'puffers', 'hoodies', 'sweaters'], n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'basic', title: 'Посмотреть футболки или штаны', hint: 'Две любые карточки', m: 'viewcat', cats: ['tees', 'polo', 'longsleeves', 'pants', 'jeans', 'shorts'], n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'acc', title: 'Посмотреть аксессуары', hint: 'Любой аксессуар', m: 'viewcat', cats: ['accessories'], n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'spin', title: 'Открыть посылку в игре', hint: 'Бесплатная посылка в игре, раз в день', m: 'spin', n: 1, tk: 3, xp: 10 },

      { per: 'w', key: 'w_days', title: 'Заходить 5 дней за неделю', hint: 'Нажимайте «Отметиться» в кабинете', m: 'checkin', n: 5, tk: 25, xp: 60 },
      { per: 'w', key: 'w_view20', title: 'Посмотреть 20 разных товаров', hint: 'За неделю', m: 'view', n: 20, tk: 25, xp: 60 },
      { per: 'w', key: 'w_fav5', title: 'Добавить 5 товаров в избранное', hint: 'Отложите то, что понравилось', m: 'fav', n: 5, tk: 25, xp: 60 },
      { per: 'w', key: 'w_cart3', title: 'Положить в корзину 3 товара', hint: 'Три разных товара', m: 'cart', n: 3, tk: 25, xp: 60 },
      { per: 'w', key: 'w_share3', title: 'Поделиться 3 товарами', hint: 'Отправьте друзьям', m: 'share', n: 3, tk: 25, xp: 60 },
      { per: 'w', key: 'w_cats', title: 'Посмотреть товары из 4 категорий', hint: 'Обувь, куртки, худи, аксессуары…', m: 'cats', n: 4, tk: 25, xp: 60 },
      { per: 'w', key: 'w_spin3', title: 'Открыть 3 посылки в игре', hint: 'В игре «Посылка с сюрпризом», за неделю', m: 'spin', n: 3, tk: 25, xp: 60 },
      { per: 'w', key: 'w_mgr', title: 'Написать менеджеру', hint: 'Спросить про вещь или размер, кнопка Telegram', m: 'mgr', n: 1, tk: 25, xp: 60 },
      { per: 'w', key: 'w_ord', title: 'Оформить заказ', hint: 'Любой заказ: достаточно оформить', m: 'ordN', n: 1, tk: 25, xp: 60 },
      { per: 'w', key: 'w_ord2', title: 'Оформить 2 заказа', hint: 'Достаточно оформить', m: 'ordN', n: 2, tk: 25, xp: 60 },
      { per: 'w', key: 'w_pre', title: 'Оформить предзаказ из Китая', hint: 'Вещь из раздела «Предзаказ»', m: 'ordPre', n: 1, tk: 25, xp: 60 },
      { per: 'w', key: 'w_stock', title: 'Оформить заказ вещи в наличии', hint: 'Вещь из раздела «В наличии»', m: 'ordStock', n: 1, tk: 25, xp: 60 },
      { per: 'w', key: 'w_sum', title: 'Оформить заказы на 5 000 ₽', hint: 'Сумма за неделю', m: 'ordSum', n: 5000, tk: 25, xp: 60 },
      { per: 'w', key: 'w_ref', title: 'Пригласить друга', hint: 'Друг регистрируется по вашей ссылке и получает первый заказ от 1 000 ₽', m: 'ref', n: 1, tk: 25, xp: 60 },
      { per: 'w', key: 'w_daily', title: 'Выполнить 12 ежедневных заданий', hint: 'Считаются выполненные за неделю', m: 'dDone', n: 12, tk: 25, xp: 60 },

      { per: 'm', key: 'm_recv', title: 'Получить заказ', hint: 'Засчитывается, когда заказ получен, статус «Получен»', m: 'recvN', n: 1, tk: 40, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_recv2', title: 'Получить 2 заказа', hint: 'Статус «Получен»', m: 'recvN', n: 2, tk: 80, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_recv3', title: 'Получить 3 заказа', hint: 'Статус «Получен»', m: 'recvN', n: 3, tk: 120, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_cn', title: 'Получить заказ из Китая', hint: 'Предзаказ со статусом «Получен»', m: 'recvPre', n: 1, tk: 60, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_first', title: 'Первый заказ из Китая', hint: 'Получите свой первый предзаказ, статус «Получен»', m: 'recvPre', n: 1, tk: 100, xp: 180, grp: 'recv', once: 'cn' },
      { per: 'm', key: 'm_sum10', title: 'Получить заказы на 10 000 ₽', hint: 'Сумма «К оплате», статус «Получен»', m: 'recvSum', n: 10000, tk: 60, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_sum25', title: 'Получить заказы на 25 000 ₽', hint: 'Сумма «К оплате», статус «Получен»', m: 'recvSum', n: 25000, tk: 120, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_sum50', title: 'Получить заказы на 50 000 ₽', hint: 'Сумма «К оплате», статус «Получен»', m: 'recvSum', n: 50000, tk: 200, xp: 180, grp: 'recv' },
      { per: 'm', key: 'm_ord3', title: 'Оформить 3 заказа за месяц', hint: 'Достаточно оформить', m: 'ordN', n: 3, tk: 40, xp: 180 },
      { per: 'm', key: 'm_both', title: 'Заказать и из наличия, и из Китая', hint: 'Один заказ из «В наличии» и один предзаказ', m: 'both', n: 1, tk: 40, xp: 180 },
      { per: 'm', key: 'm_days20', title: 'Заходить 20 дней за месяц', hint: 'Нажимайте «Отметиться» в кабинете', m: 'checkin', n: 20, tk: 80, xp: 180 },
      { per: 'm', key: 'm_streak14', title: 'Серия входов 14 дней', hint: 'Без пропусков', m: 'streak', n: 14, tk: 80, xp: 180 },
      { per: 'm', key: 'm_ref2', title: 'Пригласить 2 друга', hint: 'Друзья по вашей ссылке получают первый заказ от 1 000 ₽', m: 'ref', n: 2, tk: 80, xp: 180 },
      { per: 'm', key: 'm_spin15', title: 'Открыть 15 посылок', hint: 'За месяц', m: 'spin', n: 15, tk: 80, xp: 180 },
      { per: 'm', key: 'm_weekly', title: 'Выполнить 6 еженедельных заданий', hint: 'Считаются выполненные за месяц', m: 'wDone', n: 6, tk: 80, xp: 180 },
      { per: 'm', key: 'm_view100', title: 'Посмотреть 100 товаров', hint: 'За месяц', m: 'view', n: 100, tk: 80, xp: 180 },
      { per: 'm', key: 'm_xp', title: 'Дойти до Золота за месяц', hint: 'Набрать 1 500 XP', m: 'xp', n: 1500, tk: 80, xp: 180 }
    ],
    taskPer: { d: { name: 'Ежедневные', until: 'до конца дня' }, w: { name: 'Еженедельные', until: 'до воскресенья' }, m: { name: 'Ежемесячные', until: 'до конца месяца' } },
    // рулетка: веса из 10 000 (шанс = вес / 100 %). «Пусто» добирает остаток до 10 000 само
    wheel: [
      { id: 'none', label: 'Пусто', sub: 'в другой раз', w: 2247 },
      { id: 't25', label: '+25', sub: 'ониксов', w: 1500, tokens: 25 },
      { id: 't50', label: '+50', sub: 'ониксов', w: 1750, tokens: 50 },
      { id: 't100', label: '+100', sub: 'ониксов', w: 1100, tokens: 100 },
      { id: 't150', label: '+150', sub: 'ониксов', w: 600, tokens: 150 },
      { id: 't200', label: '+200', sub: 'ониксов', w: 400, tokens: 200 },
      { id: 't300', label: '+300', sub: 'ониксов', w: 200, tokens: 300 },
      { id: 't500', label: '+500', sub: 'ониксов', w: 120, tokens: 500 },
      { id: 't1000', label: '+1000', sub: 'ониксов', w: 30, tokens: 1000 },
      { id: 'jackpot', label: 'Повезло!', sub: '+2000 ониксов', w: 8, tokens: 2000 },
      { id: 'xp', label: '+50 XP', sub: 'к уровню', w: 600, xp: 50 },
      { id: 'xp100', label: '+100 XP', sub: 'к уровню', w: 300, xp: 100 },
      { id: 'xp150', label: '+150 XP', sub: 'к уровню', w: 130, xp: 150 },
      { id: 'xp300', label: '+300 XP', sub: 'к уровню', w: 50, xp: 300 },
      { id: 'xp500', label: '+500 XP', sub: 'к уровню', w: 10, xp: 500 },
      { id: 'frame', label: 'Рамка', sub: 'для аватара', w: 330, frame: true },
      { id: 'frame2', label: 'Особая рамка', sub: 'выпадает реже остальных призов', w: 25, frame: 'rare' },
      { id: 'promo', label: '−3%', sub: 'промокод', w: 190, promo: 3 },
      { id: 'promo5', label: '−5%', sub: 'промокод', w: 20, promo: 5 },
      { id: 're1', label: 'Ещё раз', sub: '×1', w: 330, spins: 1 },
      { id: 're2', label: 'Ещё раз', sub: '×2', w: 60, spins: 2 }
    ],
    // Платина и Алмаз: «Пусто» реже, призы чаще (сумма весов та же, 10 000)
    wheelBoost: {
      1: { none: -300, t50: 100, t100: 80, xp: 60, t150: 40, xp100: 20 },
      2: { none: -550, t50: 120, t100: 120, t200: 90, t300: 50, t500: 45, xp100: 50, t150: 75 }
    },
    // статусы заказа (меняются в таблице, клиент видит их в «Моих заказах»)
    stagesPre: ['Оформлен', 'Выкуплен', 'В пути', 'На складе', 'Едет к нам', 'Едет к вам', 'Получен'],
    stagesStock: ['Оформлен', 'Едет к вам', 'Получен'],
    stageNotes: { 'Оформлен': 'Заказ принят менеджером', 'Выкуплен': 'Оплачен поставщику', 'В пути': 'Поставщик везёт на склад в Китае', 'На складе': 'Проверка и фотоотчёт на складе', 'Едет к нам': 'Из Китая в Москву', 'Едет к вам': 'Передан в доставку', 'Получен': 'Заказ у вас', 'Отменён': 'Заказ отменён' },
    finalStages: ['Получен', 'Отменён'],
    codeTtlMin: 15,
    /* Рамки: одна коллекция из 39 штук (рисунки assets/fr/, генератор scripts/make_frames.js, источник docs/frames-gallery.html), без редкости.
       level: статусные пять, надеваются только при своём статусе; wheel: выпадают только в «Посылке с сюрпризом»
       (поровну среди неоткрытых); ach: рамка за достижение магазина (одна на достижение). Рамка не даёт никаких привилегий. */
    frames: [
      { id: 'base', name: 'Обычная' },
      { id: 'lvl-bronze', name: 'Бронза', src: 'level', lvl: 0 },
      { id: 'lvl-silver', name: 'Серебро', src: 'level', lvl: 1 },
      { id: 'lvl-gold', name: 'Золото', src: 'level', lvl: 2 },
      { id: 'lvl-platinum', name: 'Платина', src: 'level', lvl: 3 },
      { id: 'lvl-diamond', name: 'Алмаз', src: 'level', lvl: 4 },
      { id: 'f5', name: 'Пиксельная радуга', src: 'wheel' },
      { id: 'f8', name: 'Воксельный огонь', src: 'ach', ach: 'streak' },
      { id: 'f15', name: 'Неон-закат', src: 'wheel' },
      { id: 'f17', name: 'Неон-радуга', src: 'wheel' },
      { id: 'f21', name: 'Роза', src: 'wheel' },
      { id: 'f24', name: 'Ромашки', src: 'ach', ach: 'review' },
      { id: 'f27', name: 'Лавровый венок', src: 'ach', ach: 'five' },
      { id: 'f46', name: 'Хром', src: 'ach', ach: 'collector' },
      { id: 'f48', name: 'Луковица', src: 'ach', ach: 'first' },
      { id: 'f52', name: 'Осторожно', src: 'ach', ach: 'china' },
      { id: 'f53', name: 'Гардероб', src: 'ach', ach: 'ten' },
      { id: 'f55', name: 'Штрихкод', src: 'wheel' },
      { id: 'f57', name: 'Подарочная лента', src: 'wheel' },
      { id: 'f63', name: 'Космос', src: 'wheel' },
      { id: 'f65', name: 'Солнце', src: 'wheel' },
      { id: 'f69', name: 'Капли', src: 'wheel' },
      { id: 'f80', name: 'HUD', src: 'wheel' },
      { id: 'f81', name: 'Шестерёнки', src: 'ach', ach: 'review5' },
      { id: 'f83', name: 'Аркада', src: 'wheel' },
      { id: 'f84', name: 'Тетрис', src: 'wheel' },
      { id: 'f85', name: 'Кошачьи ушки', src: 'wheel' },
      { id: 'f87', name: 'Ангел', src: 'wheel' },
      { id: 'f89', name: 'Чертёнок', src: 'wheel' },
      { id: 'f90', name: 'Сердечки', src: 'ach', ach: 'friend' },
      { id: 'f91', name: 'Праздник', src: 'ach', ach: 'bday' },
      { id: 'f94', name: 'Гирлянда', src: 'wheel' },
      { id: 'f95', name: 'Хэллоуин', src: 'wheel' },
      { id: 'f96', name: 'Ёлочные шары', src: 'wheel' },
      { id: 'f97', name: 'Леденец', src: 'wheel' },
      { id: 'f98', name: 'Арбуз', src: 'wheel' },
      { id: 'f99', name: 'Пончик', src: 'wheel' },
      { id: 'f101', name: 'Сакура', src: 'wheel' },
      { id: 'f104', name: 'Радужные секторы', src: 'wheel' },
      { id: 'f105', name: 'Горошек', src: 'wheel' }
    ],
    // достижения: только значки и рамки, без ониксов; однажды полученные не пропадают
    achv: [
      { id: 'first', name: 'Первый заказ', d: 'Получить заказ', ic: 'bag', frame: 'f48' },
      { id: 'china', name: 'Дальний рейс', d: 'Получить заказ из Китая', ic: 'plane', frame: 'f52' },
      { id: 'five', name: 'Пять образов', d: 'Получить 5 заказов', ic: 'trophy', frame: 'f27' },
      { id: 'ten', name: 'Гардероб', d: 'Получить 10 заказов', ic: 'crown', frame: 'f53' },
      { id: 'review', name: 'Своё мнение', d: 'Оставить первый отзыв', ic: 'chat', frame: 'f24' },
      { id: 'review5', name: 'Знаток', d: 'Оставить 5 отзывов', ic: 'star', frame: 'f81' },
      { id: 'friend', name: 'Душа компании', d: 'Друг сделал первый заказ', ic: 'users', frame: 'f90' },
      { id: 'collector', name: 'Коллекционер', d: 'Собрать 3 рамки из посылок', ic: 'frame', frame: 'f46' },
      { id: 'streak', name: 'Семь дней', d: 'Заходить 7 дней подряд', ic: 'flame', frame: 'f8' },
      { id: 'bday', name: 'Свой праздник', d: 'Открыть подарок на день рождения', ic: 'gift', frame: 'f91' }
    ],
    frameAnims: [['shine', 'Блеск'], ['pulse', 'Пульс'], ['orbit', 'Орбита'], ['none', 'Без анимации']]
  };
  var RECV = { city: 'Доставка через Авито (другой город или Москва)', courier: 'Курьер по Москве (согласовать с менеджером)', pickup: 'Самовывоз (Москва, Рублёвское шоссе, 16к1)' };
  var SHIP = { air: 'самолёт', truck: 'фура' };
  var PRE_RECV = { avito: 'Авито Доставка', cdek: 'СДЭК', meet: 'личная встреча (Москва)' };
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // ---------------------------------------------------------------- утилиты
  function ok(o) { o = o || {}; o.ok = true; return o; }
  function err(m) { return { ok: false, error: m }; }
  function msk(ms) { return new Date(ms + 3 * 3600000); }
  function dayKey(ms) { return msk(ms).toISOString().slice(0, 10); }
  function monthKey(ms) { return dayKey(ms).slice(0, 7); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function cleanLogin(s) { return String(s || '').trim().toLowerCase(); }
  // имя: без служебных символов и угловых скобок, не длиннее 40 знаков
  function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function cleanTg(s) { return String(s || '').trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, ''); }
  function fmtPhone(s) {
    var d = digits(s);
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    if (d.length === 10) return '+7 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
    return String(s || '').trim();
  }
  function cleanEmail(s) { return String(s || '').trim().toLowerCase(); }
  function validEmail(e) { return /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 120; }
  function validTg(t) { return /^[A-Za-z0-9_]{4,32}$/.test(t); }
  // ---------------------------------------------------------------- задания: день / неделя / месяц
  // порядок обработки заказов менеджером: сначала уровни с приоритетом (от старшего), потом платный «Приоритетный заказ», потом остальные
  function priorityOrder() { return RULES.levels.filter(function (L) { return L.priority; }).map(function (L) { return L.name; }).reverse(); }
  function taskLine(i) { return taskCount('d', i) + ' ежедневных, ' + taskCount('w', i) + ' еженедельных, ' + taskCount('m', i) + ' ежемесячных'; }
  // первая привилегия каждого уровня считается из taskCount(): числа не расходятся с правилами выдачи заданий
  RULES.levels.forEach(function (L, i) {
    L.perks[0] = ['Задания', taskLine(i)];
    L.perks.forEach(function (pk) { if (/приоритет заказов/i.test(pk[0])) pk[1] = 'Порядок обработки: ' + priorityOrder().join(', '); });
  });
  RULES.taskLine = taskLine; RULES.priorityOrder = priorityOrder;
  var TASK = {}; RULES.tasks.forEach(function (t) { TASK[t.key] = t; });
  var TASK_UNIQ = { view: 150, fav: 60, cart: 60, share: 60, sale: 60, vc: 150 }; // считаем разные товары, а не повторные нажатия
  var CLIENT_EV = ['view', 'fav', 'cart', 'share', 'pre', 'stock', 'info', 'search', 'brand', 'price', 'zoom', 'measure', 'mgr'];
  var TASK_MUST = { m: 'recv' }; // в месяце всегда есть задание про получение заказа
  function weekKey(ms) { return dayKey(ms - ((msk(ms).getUTCDay() + 6) % 7) * 86400000); }
  function periodKey(per, ms) { return per === 'd' ? dayKey(ms) : per === 'w' ? weekKey(ms) : monthKey(ms); }
  function prevKeyOf(per, key) {
    if (per === 'm') { var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1; return m < 1 ? (y - 1) + '-12' : y + '-' + pad(m, 2); }
    return new Date(Date.parse(key + 'T00:00:00Z') - (per === 'w' ? 7 : 1) * 86400000).toISOString().slice(0, 10);
  }
  function hashSeed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(list, seedStr) {
    var r = rng(hashSeed(seedStr)), a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function taskCount(per, li) {
    var L = RULES.levels[li];
    return per === 'd' ? L.tasks : per === 'w' ? Math.max(2, L.tasks - 2) : 2 + (li >= 2 ? 1 : 0) + (li >= 4 ? 1 : 0);
  }
  // порядок заданий на период: у каждого клиента свой, каждый день/неделю/месяц новый; прошлые: в конец
  function taskOrder(u, per, key) {
    var pool = RULES.tasks.filter(function (t) { return t.per === per && t.key !== 'checkin'; }).map(function (t) { return t.key; });
    var skip = shuffled(pool, u.id + '|' + per + '|' + prevKeyOf(per, key)).slice(0, per === 'd' ? 6 : per === 'w' ? 4 : 3);
    var fresh = shuffled(pool, u.id + '|' + per + '|' + key);
    var out = fresh.filter(function (k) { return skip.indexOf(k) < 0; }).concat(fresh.filter(function (k) { return skip.indexOf(k) >= 0; }));
    var must = TASK_MUST[per];
    if (must) { var mk = out.filter(function (k) { return TASK[k].grp === must && taskOk(TASK[k], u); })[0]; if (mk) out = [mk].concat(out.filter(function (k) { return k !== mk; })); }
    return per === 'd' ? ['checkin'].concat(out) : out;
  }
  function taskOk(t, u) { return !(t.once === 'cn' && (u.cnRecv || 0) > 0); }
  function picksFor(u, per, now) {
    var li = levelOf(u).index, n = taskCount(per, li), res = [];
    taskOrder(u, per, periodKey(per, now)).forEach(function (k) { if (res.length < n && taskOk(TASK[k], u)) res.push(k); });
    return res;
  }
  function taskSlot(u, per, now) {
    var key = periodKey(per, now);
    if (!u.tasks || typeof u.tasks !== 'object' || u.tasks.day !== undefined) u.tasks = { news: [] };
    if (!u.tasks[per] || u.tasks[per].k !== key) u.tasks[per] = { k: key, c: {}, s: {}, done: [] };
    return u.tasks[per];
  }
  // событие попадает сразу в день, неделю и месяц
  function track(db, u, ev, id, amount) {
    var now = db.now();
    ['d', 'w', 'm'].forEach(function (per) {
      var st = taskSlot(u, per, now);
      if (TASK_UNIQ[ev]) { var l = st.s[ev] || (st.s[ev] = []); if (id && l.indexOf(id) < 0 && l.length < TASK_UNIQ[ev]) l.push(id); }
      else if (ev === 'streak') st.c.streak = Math.max(st.c.streak || 0, amount || 0);
      else st.c[ev] = Math.max(0, Math.min(1e7, (st.c[ev] || 0) + (amount == null ? 1 : amount)));
    });
  }
  function taskProgress(t, st, u) {
    var s = st.s || {}, c = st.c || {};
    if (t.m === 'view' || t.m === 'fav' || t.m === 'cart' || t.m === 'share' || t.m === 'sale') return (s[t.m] || []).length;
    if (t.m === 'viewcat') return (s.vc || []).filter(function (x) { return t.cats.indexOf(x.split(':')[0]) >= 0; }).length;
    if (t.m === 'cats') { var seen = {}; (s.vc || []).forEach(function (x) { seen[x.split(':')[0]] = 1; }); return Object.keys(seen).length; }
    if (t.m === 'both') return Math.min(c.ordPre || 0, c.ordStock || 0);
    if (t.m === 'xp') return u.xp || 0;
    return c[t.m] || 0;
  }
  // выдаёт награды за выполненные задания: дневные → еженедельные → ежемесячные (счётчики «выполнено» идут вверх по цепочке)
  function settle(db, u) {
    var now = db.now(), news = (u.tasks && u.tasks.news) || [];
    ['d', 'w', 'm'].forEach(function (per) {
      var st = taskSlot(u, per, now); news = u.tasks.news || (u.tasks.news = []);
      picksFor(u, per, now).forEach(function (k) {
        var t = TASK[k]; if (st.done.indexOf(k) >= 0 || taskProgress(t, st, u) < t.n) return;
        st.done.push(k);
        if (!t.auto) { earn(db, u, t.tk, 'Задание (' + RULES.taskPer[per].name.toLowerCase() + '): ' + t.title); addXp(db, u, t.xp); news.push({ k: k, per: per, title: t.title, tk: t.tk, xp: t.xp, at: now }); }
        if (news.length > 12) news.shift();
        if (per === 'd') track(db, u, 'dDone'); else if (per === 'w') track(db, u, 'wDone');
      });
    });
    return u;
  }
  function boardFor(u, now) {
    var out = {};
    ['d', 'w', 'm'].forEach(function (per) {
      var st = taskSlot(u, per, now), keys = picksFor(u, per, now);
      st.done.forEach(function (k) { if (keys.indexOf(k) < 0 && TASK[k]) keys.push(k); });
      out[per] = keys.map(function (k) { var t = TASK[k], d = st.done.indexOf(k) >= 0; return { k: k, p: d ? t.n : Math.min(t.n, Math.floor(taskProgress(t, st, u))), n: t.n, d: d }; });
    });
    return out;
  }
  function stagesFor(kind) { return kind === 'в наличии' || kind === 'временно нет' ? RULES.stagesStock : RULES.stagesPre; }
  function phoneKey(s) { var d = digits(s); if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1); return d; }
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function tokensToRub(t) { return Math.round(t * RULES.tokenRub); }
  function levelIndex(xp) { var i = 0; for (var j = 0; j < RULES.levels.length; j++) if ((xp || 0) >= RULES.levels[j].min) i = j; return i; }
  function levelAt(i, xp, fixed) {
    var L = RULES.levels[i], N = RULES.levels[i + 1];
    return { index: i, key: L.key, name: L.name, min: L.min, next: N && !fixed ? { key: N.key, name: N.name, min: N.min, left: N.min - (xp || 0) } : null,
      perks: L.perks.map(function (x) { return x[0]; }), perkList: L.perks, fixed: !!fixed, tasks: L.tasks, streak: L.streak, spins: L.spins, priority: L.priority || '', pack: L.pack || '' };
  }
  function xpOfRub(r) { return Math.floor(Math.max(0, +r || 0) * RULES.xpPerRub); }
  /* Призы и шансы одинаковые у платной и бесплатной посылки (в том числе «Ещё раз»). */
  function wheelFor(li) {
    var b = RULES.wheelBoost[li >= 4 ? 2 : li >= 3 ? 1 : 0] || {};
    return RULES.wheel.map(function (w) { return Math.max(0, w.w + (b[w.id] || 0)); });
  }
  /* ониксы за активность (вход, задания, посылка): не выше потолка баланса, остаток превращается в опыт */
  function earn(db, u, n, reason) {
    n = Math.max(0, Math.round(n || 0));
    var room = Math.max(0, RULES.balanceCap - (u.balance || 0)), give = Math.min(n, room), over = n - give, xp = Math.floor(over / 2);
    if (give > 0) log(db, u, give, reason);
    if (over > 0) { log(db, u, 0, reason + ': баланс на максимуме ' + RULES.balanceCap + ', вместо ' + over + ' ониксов +' + xp + ' XP'); addXp(db, u, xp); }
    return { tok: give, xp: xp };
  }
  function framesFor(u) {
    var li = levelOf(u).index, own = u.frames || [];
    return RULES.frames.filter(function (f) {
      if (f.id === 'base') return true;
      if (f.src === 'level') return f.lvl <= li; // статусные рамки накапливаются: свой статус и все ниже; в начале месяца, когда уровень сбросился, лишние пропадают
      return own.indexOf(f.id) >= 0; // остальные: только выпавшие в посылке или полученные за достижение/игру
    }).map(function (f) { return f.id; });
  }
  function pctText(p) { return String(p).replace('.', ','); }
  function activePromos(db, u) { var mk = monthKey(db.now()), now = db.now(); return (u.promos || []).filter(function (p) { return !p.used && (!p.exp || p.exp === mk) && (!p.until || +p.until > now); }); }
  function promoCat(key) { return RULES.promoCats.filter(function (c) { return c.key === key; })[0] || null; }
  function levelInfo(xp) { return levelAt(levelIndex(xp), xp, false); }
  /* Уровень, закреплённый вручную в таблице (колонка «Уровень вручную»): название уровня или пусто/«авто». */
  function fixIndex(name) {
    var s = String(name || '').trim().toLowerCase().replace(/ё/g, 'е');
    if (!s || /^авто/.test(s)) return -1;
    for (var i = 0; i < RULES.levels.length; i++) {
      var names = [RULES.levels[i].name.toLowerCase().replace(/ё/g, 'е'), RULES.levels[i].key].concat(RULES.levels[i].alias || []);
      for (var j = 0; j < names.length; j++) { var n = names[j]; if (n === s || n.indexOf(s) === 0 || s.indexOf(n) === 0) return i; }
    }
    return -1;
  }
  function levelOf(u) {
    var f = fixIndex(u && u.levelFix);
    return f >= 0 ? levelAt(f, u.xp, true) : levelInfo(u && u.xp);
  }
  function genCode(db, prefix, len) {
    var s = prefix || '';
    for (var i = 0; i < (len || 6); i++) s += CODE_ABC.charAt(Math.floor(db.random() * CODE_ABC.length));
    return s;
  }
  /* ---------- учёт права на бонусы (без персональных данных) ----------
     При удалении аккаунта храним только хэши телефона, почты и Telegram: по ним нельзя восстановить данные,
     но можно понять, что этот человек уже получал приветственные бонусы и подарок на день рождения. */
  function canonEmail(e) {
    e = cleanEmail(e); var at = e.lastIndexOf('@'); if (at < 1) return e;
    var name = e.slice(0, at).replace(/\+.*$/, ''), dom = e.slice(at + 1);
    if (dom === 'googlemail.com') dom = 'gmail.com';
    if (dom === 'gmail.com') name = name.replace(/\./g, '');
    if (/^(ya\.ru|yandex\.(ru|com|by|kz|ua))$/.test(dom)) { dom = 'yandex.ru'; name = name.replace(/\./g, '-'); }
    return name + '@' + dom;
  }
  function idKeys(db, x) {
    var out = [], ph = phoneKey(x.phoneKey || x.phone || ''), em = canonEmail(x.email || x.emailKey || ''), tg = String(x.tgKey || x.tg || '').replace(/^@/, '').toLowerCase();
    if (ph.length >= 10) out.push('p:' + ph);
    if (em.indexOf('@') > 0) out.push('e:' + em);
    if (tg) out.push('t:' + tg);
    return out.map(function (k) { return String(db.hash('onion-ledger|' + k)).slice(0, 32); });
  }
  function ledgerHas(db, keys, kind) { if (!db.ledgerHas) return false; for (var i = 0; i < keys.length; i++) if (db.ledgerHas(keys[i], kind)) return true; return false; }
  function ledgerAdd(db, keys, kind, note) { if (!db.ledgerAdd) return; keys.forEach(function (k) { if (!db.ledgerHas || !db.ledgerHas(k, kind)) db.ledgerAdd({ key: k, kind: kind, at: db.now(), note: note || '' }); }); }
  /* день рождения сегодня? 29 февраля в невисокосный год празднуем 28 февраля */
  function bdayIsToday(bd, now) {
    if (!bd) return false;
    var dk = dayKey(now), md = dk.slice(5), y = +dk.slice(0, 4);
    if (bd === md) return true;
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return bd === '02-29' && !leap && md === '02-28';
  }
  function bdayState(db, u) {
    var now = db.now(), year = String(msk(now).getUTCFullYear());
    if (!bdayIsToday(u.birthday, now)) return '';
    if (u.bdayYear === year) return 'got';
    if (now - (+u.createdAt || now) < RULES.birthday.minAgeDays * 86400000) return 'young';
    if (u.phoneOk === false) return 'phone';
    if (ledgerHas(db, idKeys(db, u), 'bday' + year)) return 'got';
    return 'ready';
  }
  /* ---------- мониторинг подозрительных действий: запись + уведомление менеджеру, без блокировки аккаунтов ---------- */
  var LIMITS = { codesPerHour: 50, regsPerHour: 10 };
  function bump(db, key, ttl) { if (!db.getCode || !db.putCode) return 0; var c = db.getCode(key), n = (c && +c.n || 0) + 1; db.putCode(key, { n: n }, ttl); return n; }
  function hourKey(db) { return dayKey(db.now()) + 'T' + pad(msk(db.now()).getUTCHours(), 2); }
  function flag(db, level, kind, text) { if (db.flag) { try { db.flag({ at: db.now(), level: level, kind: kind, text: String(text).slice(0, 300) }); } catch (e) { } } }
  function hashPass(db, salt, pass) { var h = salt + ':' + pass; for (var i = 0; i < 200; i++) h = db.hash(h + salt); return h; }
  function log(db, u, delta, reason) {
    u.balance = Math.max(0, (u.balance || 0) + delta);
    db.log({ at: db.now(), userId: u.id, login: u.login, delta: delta, reason: reason, balance: u.balance });
  }
  function adjustTokens(db, u, delta, reason) { touch(db, u); log(db, u, Math.round(+delta || 0), reason); return u; }
  function orderNo(db, seq) { return 'OS-' + String(msk(db.now()).getUTCFullYear()).slice(2) + '-' + pad(seq, 5); }

  // месяц сменился: XP обнуляется; задания: каждый день новые; бонусы уровня
  function touch(db, u) {
    var now = db.now(), mk = monthKey(now);
    if (u.xpMonth !== mk) { u.xpMonth = mk; u.xp = 0; }
    ['d', 'w', 'm'].forEach(function (per) { taskSlot(u, per, now); });
    if (!u.promos) u.promos = [];
    if (!u.frames || !u.frames.length) u.frames = ['base'];
    var fk = RULES.frames.map(function (f) { return f.id; }); // рамки старой коллекции удалены: из списка убираем, надетая удалённая становится базовой
    u.frames = u.frames.filter(function (id) { return fk.indexOf(id) >= 0; }); if (u.frames.indexOf('base') < 0) u.frames.unshift('base');
    if (u.frame && fk.indexOf(u.frame) < 0) u.frame = 'base';
    grantPerks(db, u);
    settle(db, u);
  }
  // XP «за активность» (вход, простые задания, рулетка) в месяц ограничен: до Золота без покупки не дойти
  function addXp(db, u, n) { u.xp = (u.xp || 0) + Math.max(0, Math.round(n || 0)); grantPerks(db, u); }
  function grantPerks(db, u) {
    var L = levelOf(u), li = L.index, now = db.now(), mk = monthKey(now), dk = dayKey(now);
    // бесплатные прокруты дня: не копятся; при повышении уровня в тот же день, доливаем разницу
    if (u.spinDay !== dk) { u.spinDay = dk; u.daySpins = L.spins; u.daySpinsMax = L.spins; }
    else if (L.spins > (u.daySpinsMax || 0)) { u.daySpins = (u.daySpins || 0) + L.spins - (u.daySpinsMax || 0); u.daySpinsMax = L.spins; }
    // Золото и выше: −1,5% на случайную категорию, раз в месяц.
    // Платина и выше: ещё один, отдельный промокод −1,5% на любой товар, тоже раз в месяц.
    if (li >= 2) {
      var p15 = (u.promos || []).filter(function (p) { return p.kind === 'lvl15' && p.exp === mk; })[0];
      if (!p15) {
        var c = RULES.promoCats[Math.floor(db.random() * RULES.promoCats.length)];
        var pr = { code: genCode(db, 'GOLD', 5), pct: 1.5, kind: 'lvl15', exp: mk, from: 'Золото, ' + c.label, at: now, cat: c.key, catLabel: c.label };
        u.promos.push(pr); log(db, u, 0, 'Промокод −1,5% на «' + c.label + '» за уровень ' + L.name);
      }
    }
    if (li >= 3) {
      var p15p = (u.promos || []).filter(function (p) { return p.kind === 'lvl15p' && p.exp === mk; })[0];
      if (!p15p) {
        u.promos.push({ code: genCode(db, 'PLAT', 5), pct: 1.5, kind: 'lvl15p', exp: mk, from: 'Платина, на любой товар', at: now });
        log(db, u, 0, 'Промокод −1,5% на любой товар за уровень ' + L.name);
      }
    }    // Алмаз: 3 промокода −2,5% в месяц, по одному в неделю
    if (li >= 4) {
      if (u.perkDiaMonth !== mk) { u.perkDiaMonth = mk; u.perkDiaN = 0; }
      if ((u.perkDiaN || 0) < 3 && (!u.perkDiaN || now - (+u.perkDiaAt || 0) >= 7 * 86400000)) {
        u.perkDiaN = (u.perkDiaN || 0) + 1; u.perkDiaAt = now;
        u.promos.push({ code: genCode(db, 'DIAM', 5), pct: 2.5, kind: 'lvl25', exp: mk, from: 'Алмаз, неделя ' + u.perkDiaN + ' из 3', at: now });
        log(db, u, 0, 'Промокод −2,5% за уровень Алмаз (' + u.perkDiaN + ' из 3)');
      }
    }
    // рамка, которой больше нет на этом уровне, снимается
    if (u.frame && u.frame !== 'base' && framesFor(u).indexOf(u.frame) < 0) u.frame = 'base';
  }
  function packInfo(db, u) {
    var L = levelOf(u); if (!L.pack) return null;
    var mk = monthKey(db.now());
    return { kind: L.pack, label: L.pack === 'free' ? 'Бесплатная упаковка' : 'Упаковка −10%', note: L.pack === 'free' ? 'Привилегия Алмаза: 1 раз в месяц, только для предзаказа из Китая' : 'Привилегия Платины: 1 раз в месяц, только для заказа с предзаказом', level: L.name, available: u.packMonth !== mk };
  }
  function sessionUser(db, p) {
    if (!p || !p.session) return null;
    var s = db.getSession(p.session);
    if (!s || +s.exp < db.now()) return null;
    var u = db.getUser(s.userId);
    if (!u) return null;
    touch(db, u);
    return u;
  }
  /* фотоотчёт: менеджер вставляет одну или несколько ссылок (через пробел или с новой строки); показываем только http(s) */
  function earlyLeft() { return 0; } // раннего доступа больше нет: любой заказ доступен всем уровням сразу
  function checkAchv(db, u, orders, reviews) {
    var have = Array.isArray(u.achv) ? u.achv.slice() : [], add = [];
    var recv = Math.max(+u.recvTotal || 0, (orders || []).filter(function (o) { return o.status === 'Получен'; }).length);
    var pre = Math.max(+u.cnRecv || 0, (orders || []).filter(function (o) { return o.status === 'Получен' && (o.kind === 'предзаказ' || o.kind === 'смешанный'); }).length);
    var cond = { first: recv >= 1, china: pre >= 1, five: recv >= 5, ten: recv >= 10, review: reviews >= 1, review5: reviews >= 5, friend: (u.refCount || 0) >= 1, collector: (u.frames || []).filter(function (id) { var f = RULES.frames.filter(function (x) { return x.id === id; })[0]; return f && f.src === 'wheel'; }).length >= 3, streak: (u.streak || 0) >= 7, bday: !!u.bdayOpen };
    // «Именинник» раньше выдавался по полю bdayYear, которое ставится и при вводе даты (чтобы не выдавать подарок задним числом).
    // Оставляем значок только тем, у кого подарок действительно выдан: запись в учёте бонусов за этот год.
    if (have.indexOf('bday') >= 0 && !u.bdayOpen) {
      if (u.bdayYear && ledgerHas(db, idKeys(db, u), 'bday' + u.bdayYear)) u.bdayOpen = 1;
      else { have = have.filter(function (x) { return x !== 'bday'; }); u.achv = have; add.push('-bday'); }
    }
    RULES.achv.forEach(function (a) {
      if (have.indexOf(a.id) >= 0 || !cond[a.id]) return;
      have.push(a.id); add.push(a.id);
      if (a.frame) { u.frames = u.frames || ['base']; if (u.frames.indexOf(a.frame) < 0) u.frames.push(a.frame); }
    });
    // рамки за достижения, полученные раньше, выдаём задним числом
    RULES.achv.forEach(function (a) { if (a.frame && have.indexOf(a.id) >= 0) { u.frames = u.frames || ['base']; if (u.frames.indexOf(a.frame) < 0) { u.frames.push(a.frame); add.push('+' + a.frame); } } });
    if (add.length) u.achv = have;
    return add; // элемент '-bday' означает «значок снят», нужен только чтобы сохранить пользователя
  }
  function photoLinks(v) { return String(v || '').split(/[\s,;]+/).filter(function (x) { return /^https?:\/\/[^\s"'<>]{4,400}$/i.test(x); }).slice(0, 6); }
  function publicUser(db, u) {
    var today = dayKey(db.now());
    var orders = (db.listOrders(u.id, 30) || []).map(function (o) {
      var st = String(o.status || 'Оформлен');
      return { no: o.no, at: o.at, count: o.count, total: o.total, tokens: o.tokens, tokenRub: o.tokenRub, promo: o.promo || '', promoRub: o.promoRub, toPay: o.toPay, text: o.text, items: o.items || [], kind: o.kind || '', photos: photoLinks(o.photoRep), status: st, stages: stagesFor(o.kind), active: RULES.finalStages.indexOf(st) < 0 };
    });
    var rk = db.reviewKeys ? db.reviewKeys(u.id) : [];
    if (checkAchv(db, u, orders, rk.length).length) { try { db.saveUser(u); } catch (e) { } }
    orders.forEach(function (o) { o.reviewed = (o.items || []).filter(function (it) { return rk.indexOf(o.no + '|' + it.id) >= 0; }).map(function (it) { return it.id; }); });
    var waits = (db.waitsOf ? db.waitsOf(u.id) : []).map(function (w) { var pr = db.product ? db.product(w.productId) : null; return { id: w.productId, title: w.title, ready: !!(pr && pr.status !== 'out' && pr.status !== 'sold') }; });
    return {
      favIds: Object.keys(u.watch && typeof u.watch === 'object' ? u.watch : {}), tgOn: !!u.tgChat, tgName: u.tgName || '', tgCats: String(u.tgCats || '').split(',').filter(Boolean), waits: waits, reviewCount: rk.length,
      id: u.id, code: 'OS' + u.id, login: u.login, name: u.name, phone: u.phone, tg: u.tg, email: u.email || '', city: u.city || '', avatar: u.avatar || '',
      board: boardFor(u, db.now()), taskNews: ((u.tasks && u.tasks.news) || []).slice(),
      balance: u.balance || 0, balanceRub: tokensToRub(u.balance || 0),
      xp: u.xp || 0, level: levelOf(u), spent: u.spent || 0, ordersCount: u.ordersCount || 0, wheel: wheelFor(levelOf(u).index), balanceCap: RULES.balanceCap, pack: packInfo(db, u),
      streak: u.lastCheckin === today || u.lastCheckin === dayKey(db.now() - 86400000) ? (u.streak || 0) : 0,
      checkedToday: u.lastCheckin === today,
      freeSpins: (u.daySpins || 0) + (u.freeSpins || 0), daySpins: u.daySpins || 0, daySpinsMax: u.daySpinsMax || 0, bonusSpins: u.freeSpins || 0,
      promos: activePromos(db, u).map(function (p) { return { code: p.code, pct: p.pct, from: p.from, cat: p.cat || '', catLabel: p.catLabel || '', exp: p.exp || '', until: +p.until || 0 }; }),
      frames: framesFor(u), frame: u.frame || 'base', frameAnim: u.frameAnim || 'shine',
      birthday: u.birthday || '', phoneOk: u.phoneOk !== false, achv: Array.isArray(u.achv) ? u.achv : [], bdayToday: bdayState(db, u) === 'ready', bday: bdayState(db, u), refCode: u.refCode, refCount: u.refCount || 0,
      createdAt: u.createdAt, orders: orders,
      canDelete: !orders.some(function (o) { return o.active; })
    };
  }
  function settings() {
    return {
      tokenRub: RULES.tokenRub, maxShare: RULES.maxShare, spinCost: RULES.spinCost, reward: RULES.reward, xpPerRub: RULES.xpPerRub, xpReward: RULES.xpReward,
      levels: RULES.levels, promoCats: RULES.promoCats, frameAnims: RULES.frameAnims, tasks: RULES.tasks, frames: RULES.frames, refMinOrder: RULES.refMinOrder,
      stagesPre: RULES.stagesPre, stagesStock: RULES.stagesStock, stageNotes: RULES.stageNotes,
      wheel: RULES.wheel.map(function (w) { return { id: w.id, label: w.label, sub: w.sub, w: w.w }; })
    };
  }
  function newSession(db, u) {
    var token = db.token();
    db.saveSession({ token: token, userId: u.id, exp: db.now() + RULES.sessionDays * 86400000 });
    return token;
  }

  // ---------------------------------------------------------------- действия
  var A = {};
  A.settings = function () { return ok({ settings: settings() }); };

  /* ---------- коды на почту: регистрация, восстановление пароля, смена почты ---------- */
  function makeCode(db) { var c = ''; for (var i = 0; i < 6; i++) c += String(Math.floor(db.random() * 10)); return c; }
  function codeKey(purpose, email) { return 'code:' + purpose + ':' + email; }
  function checkCode(db, purpose, email, code) {
    if (!db.getCode) return err('Коды на почту не настроены');
    var rec = db.getCode(codeKey(purpose, email));
    if (!rec || +rec.exp < db.now()) return err('Код устарел или не запрошен. Запросите новый');
    if ((rec.tries || 0) >= 5) { db.delCode(codeKey(purpose, email)); return err('Слишком много попыток. Запросите новый код'); }
    if (db.hash(rec.salt + ':' + String(code || '').trim()) !== rec.hash) {
      rec.tries = (rec.tries || 0) + 1; db.putCode(codeKey(purpose, email), rec, Math.max(1, Math.round((+rec.exp - db.now()) / 1000)));
      return err('Неверный код. Осталось попыток: ' + (5 - rec.tries));
    }
    db.delCode(codeKey(purpose, email));
    return null;
  }

  A.sendCode = function (db, p) {
    var purpose = String(p.purpose || ''), email = cleanEmail(p.email);
    if (['register', 'reset', 'email'].indexOf(purpose) < 0) return err('Неизвестный запрос');
    if (!validEmail(email)) return err('Проверьте почту, например name@mail.ru');
    if (!db.mail || !db.putCode) return err('Отправка писем пока не настроена. Напишите менеджеру');
    var u = null;
    if (purpose === 'register') { if (db.findUser('email', email)) return err('Эта почта уже привязана к аккаунту. Войдите или восстановите пароль'); }
    if (purpose === 'email') {
      u = sessionUser(db, p); if (!u) return err('auth');
      var other = db.findUser('email', email); if (other && other.id !== u.id) return err('Эта почта уже привязана к другому аккаунту');
    }
    if (purpose === 'reset') u = db.findUser('email', email);
    var lim = db.getCode('limit:' + email);
    if (lim && +lim.next > db.now()) return err('Код уже отправлен. Повторно можно через ' + Math.ceil((+lim.next - db.now()) / 1000) + ' с');
    var sent = { ok: true, sent: true, email: email };
    if (purpose === 'reset' && !u) { db.putCode('limit:' + email, { next: db.now() + 60000 }, 60); return sent; } // не выдаём, есть ли такая почта
    var hk = 'cnt:codes:' + hourKey(db), n0 = db.getCode ? ((db.getCode(hk) || {}).n || 0) : 0;
    if (n0 >= LIMITS.codesPerHour) { if (n0 === LIMITS.codesPerHour) { bump(db, hk, 3700); flag(db, 3, 'codes', 'Запросов кодов за час больше ' + LIMITS.codesPerHour + ', новые коды на паузе до конца часа'); } return err('Сейчас слишком много запросов. Попробуйте через час или напишите менеджеру @OnionShop_Support'); }
    bump(db, hk, 3700);
    var code = makeCode(db), salt = db.token().slice(0, 12);
    db.putCode(codeKey(purpose, email), { hash: db.hash(salt + ':' + code), salt: salt, exp: db.now() + RULES.codeTtlMin * 60000, tries: 0 }, RULES.codeTtlMin * 60);
    db.putCode('limit:' + email, { next: db.now() + 60000 }, 60);
    var what = purpose === 'register' ? 'для регистрации' : purpose === 'reset' ? 'для восстановления пароля' : 'для подтверждения почты';
    var okSend = db.mail(email, 'Код ONION SHOP: ' + code, code, what, u ? u.login : '');
    if (!okSend) return err('Не получилось отправить письмо. Попробуйте позже или напишите менеджеру');
    if (db.demoCodes) sent.demoCode = code; // только в демо-режиме, на сервере код не возвращается
    return sent;
  };

  A.register = function (db, p) {
    var login = cleanLogin(p.login), pass = String(p.password || ''), name = cleanName(p.name);
    var tg = cleanTg(p.tg), ph = phoneKey(p.phone), email = cleanEmail(p.email);
    if (!/^[a-z0-9_.]{3,20}$/.test(login)) return err('Логин: от 3 до 20 символов, латиница, цифры, точка или «_»');
    if (pass.length < 6) return err('Пароль: не короче 6 символов');
    if (name.length < 2) return err('Укажите имя');
    if (!validEmail(email)) return err('Укажите почту, например name@mail.ru');
    if (ph.length < 10 || ph.length > 15) return err('Укажите телефон, например +7 900 000-00-00');
    if (tg && !validTg(tg)) return err('Username в Telegram: латиница, цифры и «_», от 4 символов. Если username нет, оставьте поле пустым');
    if (db.findUser('login', login)) return err('Такой логин уже занят');
    var ec = canonEmail(email);
    if (db.findUser('email', email) || db.findUser('emailCanon', ec) || (ec !== email && db.findUser('email', ec))) return err('Эта почта уже привязана к аккаунту');
    // сначала код из письма (почта ваша), и только потом проверка телефона и Telegram: без кода нельзя узнать, чей номер есть в базе
    var bad = checkCode(db, 'register', email, p.code); if (bad) return bad;
    if (tg && db.findUser('tg', tg.toLowerCase())) return err('Этот Telegram уже привязан к другому аккаунту. Запросите новый код и укажите другой');
    if (db.findUser('phone', ph)) return err('Этот телефон уже привязан к другому аккаунту. Запросите новый код и укажите другой номер');
    var ref = null, repeat = ledgerHas(db, idKeys(db, { phone: ph, email: email, tg: tg }), 'acct');
    if (p.ref && !repeat) { ref = db.findUser('refCode', String(p.ref).trim().toUpperCase()); }
    var refCode; do { refCode = genCode(db, '', 6); } while (db.findUser('refCode', refCode));
    var salt = db.token().slice(0, 16);
    var u = {
      login: login, name: name, email: email, emailKey: email, emailCanon: canonEmail(email), phone: fmtPhone(p.phone), phoneKey: ph, tg: tg, tgKey: tg ? tg.toLowerCase() : '',
      salt: salt, hash: hashPass(db, salt, pass), balance: 0, xp: 0, xpMonth: monthKey(db.now()), spent: 0, ordersCount: 0,
      streak: 0, lastCheckin: '', freeSpins: 0, refCode: refCode, referredBy: ref ? ref.id : '', refCount: 0, refMonth: '', refMonthCount: 0,
      refRewarded: false, birthday: '', bdayYear: '', frame: 'base', frames: ['base'], promos: [], tasks: null, avatar: '', createdAt: db.now()
    };
    u = db.createUser(u);
    touch(db, u);
    // телефон подтверждается через Telegram-бота; до этого приветственные бонусы ждут, заказ недоступен
    u.phoneOk = false; u.bonusDone = repeat ? 'repeat' : '';
    if (repeat) { log(db, u, 0, 'Повторная регистрация: приветственные бонусы уже были получены раньше'); flag(db, 1, 'repeat', 'Повторная регистрация после удаления: @' + login); }
    var rn = bump(db, 'cnt:regs:' + hourKey(db), 3700); if (rn === LIMITS.regsPerHour + 1) flag(db, 2, 'regs', 'Больше ' + LIMITS.regsPerHour + ' регистраций за час: проверьте новых клиентов');
    else log(db, u, 0, 'Регистрация: бонусы начислятся после подтверждения телефона');
    if (db.registerBonus) log(db, u, db.registerBonus, 'Демо-ониксы для проверки');
    db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u), welcome: 0, pending: repeat ? 0 : RULES.reward.register + (ref ? RULES.reward.refFriend : 0), repeat: repeat, needPhone: true });
  };

  A.resetPassword = function (db, p) {
    var email = cleanEmail(p.email), pass = String(p.password || '');
    if (!validEmail(email)) return err('Проверьте почту');
    if (pass.length < 6) return err('Новый пароль: не короче 6 символов');
    var bad = checkCode(db, 'reset', email, p.code); if (bad) return bad;
    var u = db.findUser('email', email); if (!u) return err('Аккаунт не найден');
    u.salt = db.token().slice(0, 16); u.hash = hashPass(db, u.salt, pass);
    if (db.deleteSessionsOf) db.deleteSessionsOf(u.id);
    touch(db, u); db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u) });
  };

  A.setEmail = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var email = cleanEmail(p.email); if (!validEmail(email)) return err('Проверьте почту');
    var other = db.findUser('email', email); if (other && other.id !== u.id) return err('Эта почта уже привязана к другому аккаунту');
    var bad = checkCode(db, 'email', email, p.code); if (bad) return bad;
    u.email = email; u.emailKey = email; db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };

  A.changePassword = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (hashPass(db, u.salt, String(p.old || '')) !== u.hash) return err('Текущий пароль неверный');
    var pass = String(p.password || ''); if (pass.length < 6) return err('Новый пароль: не короче 6 символов');
    u.salt = db.token().slice(0, 16); u.hash = hashPass(db, u.salt, pass); db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };

  A.deleteAccount = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (hashPass(db, u.salt, String(p.password || '')) !== u.hash) return err('Неверный пароль');
    var active = (db.listOrders(u.id, 200) || []).filter(function (o) { return RULES.finalStages.indexOf(String(o.status || 'Оформлен')) < 0; });
    if (active.length) return err('Удалить аккаунт можно, когда нет активных заказов. Сейчас активных: ' + active.length);
    db.log({ at: db.now(), userId: u.id, login: u.login, delta: -(u.balance || 0), reason: 'Аккаунт удалён клиентом', balance: 0 });
    var keys = idKeys(db, u); ledgerAdd(db, keys, 'acct', 'аккаунт удалён');
    if (u.bdayYear) ledgerAdd(db, keys, 'bday' + u.bdayYear, 'подарок получен до удаления');
    if (db.deleteSessionsOf) db.deleteSessionsOf(u.id);
    db.deleteUser(u);
    return ok({ deleted: true });
  };

  A.login = function (db, p) {
    var login = cleanLogin(p.login);
    if (db.rateLimited && db.rateLimited(login)) return err('Слишком много попыток. Подождите 15 минут');
    var u = db.findUser('login', login) || (login.indexOf('@') > 0 ? db.findUser('email', login) : null) || (login.charAt(0) === '@' ? db.findUser('tg', login.slice(1)) : null);
    // лимит и на сам аккаунт: перебор пароля через логин, почту и @telegram по очереди тоже упирается в 6 попыток за 15 минут
    if (u && db.rateLimited && db.rateLimited('id:' + u.id)) return err('Слишком много попыток. Подождите 15 минут');
    if (!u || hashPass(db, u.salt, String(p.password || '')) !== u.hash) {
      if (db.failedLogin) { db.failedLogin(login); if (u) db.failedLogin('id:' + u.id); }
      return err('Неверный логин или пароль');
    }
    touch(db, u); db.saveUser(u);
    return ok({ session: newSession(db, u), user: publicUser(db, u) });
  };

  A.logout = function (db, p) { if (p.session) db.deleteSession(p.session); return ok(); };

  A.me = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    // «скользящий» вход: пока клиент заходит на сайт, сессия продлевается (не чаще раза в неделю), заново вводить пароль не придётся
    try { var ss = db.getSession(p.session), full = RULES.sessionDays * 86400000; if (ss && db.renewSession && ss.exp - db.now() < full - 7 * 86400000) db.renewSession(p.session, db.now() + full); } catch (e) { /* не критично */ }
    db.saveUser(u); // на сервере запись пропускается, если строка клиента не изменилась
    return ok({ user: publicUser(db, u) }); // settings клиенту в этом ответе не нужны (сайт их не читает)
  };

  A.profile = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth'); var bdayNow = false;
    if (p.name != null) { var n = cleanName(p.name); if (n.length < 2) return err('Укажите имя'); u.name = n; }
    // смена телефона или Telegram: не чаще 10 раз в час, иначе через профиль можно было бы перебором узнавать, чьи номера есть в базе
    var phCh = p.phone != null && phoneKey(p.phone) !== u.phoneKey, tgCh = p.tg != null && String(cleanTg(p.tg) || '').toLowerCase() !== String(u.tgKey || '');
    if ((phCh || tgCh) && bump(db, 'prof:' + u.id, 3600) > 10) { flag(db, 2, 'profile', 'Много смен телефона или Telegram подряд: @' + u.login); return err('Слишком много изменений подряд. Попробуйте через час или напишите менеджеру'); }
    if (p.phone != null) {
      var ph = phoneKey(p.phone); if (ph.length < 10 || ph.length > 15) return err('Проверьте телефон');
      var other = db.findUser('phone', ph); if (other && other.id !== u.id) return err('Этот телефон уже привязан к другому аккаунту');
      if (ph !== u.phoneKey) u.phoneOk = false; // новый номер нужно снова подтвердить в Telegram
      u.phone = fmtPhone(p.phone); u.phoneKey = ph;
    }
    if (p.tg != null) {
      var tg = cleanTg(p.tg);
      if (tg) {
        if (!validTg(tg)) return err('Проверьте username в Telegram');
        var o2 = db.findUser('tg', tg.toLowerCase()); if (o2 && o2.id !== u.id) return err('Этот Telegram уже привязан к другому аккаунту');
      }
      u.tg = tg; u.tgKey = tg ? tg.toLowerCase() : '';
    }
    if (p.city != null) { u.city = String(p.city).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); }
    if (p.avatar != null) {
      var av = String(p.avatar);
      if (av && (av.length > 45000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(av))) return err('Фото не подошло. Выберите другое (JPG или PNG)');
      u.avatar = av;
    }
    if (p.frame != null) { if (framesFor(u).indexOf(p.frame) < 0) return err('Эта рамка ещё не открыта'); u.frame = p.frame; }
    if (p.frameAnim != null) {
      if (levelOf(u).index < 4) return err('Анимация рамки доступна на уровне Алмаз');
      if (!RULES.frameAnims.some(function (a) { return a[0] === p.frameAnim; })) return err('Нет такой анимации');
      u.frameAnim = p.frameAnim;
    }
    if (p.birthday != null) {
      if (u.birthday) return err('Дату рождения можно указать только один раз');
      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(p.birthday)) return err('Проверьте дату рождения');
      u.birthday = p.birthday;
      var byear = String(msk(db.now()).getUTCFullYear());
      if (bdayIsToday(p.birthday, db.now())) bdayNow = true; // день рождения сегодня: подарок доступен сразу (A.bdayGift), bdayYear не трогаем
      else u.bdayYear = byear; // прошедшие даты задним числом не выдаём
    }
    db.saveUser(u);
    return ok({ user: publicUser(db, u), bdayNow: bdayNow, bday: bdayState(db, u) });
  };

  // подарок на день рождения: один раз в год, только в сам день и только аккаунтам старше 30 дней.
  // Повторно не выдаётся ни при обновлении страницы, ни после удаления и новой регистрации (учёт по хэшам).
  A.bdayGift = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    touch(db, u);
    var st = bdayState(db, u), B = RULES.birthday, now = db.now(), year = String(msk(now).getUTCFullYear());
    if (u.phoneOk === false) return err('Сначала подтвердите телефон в кабинете');
    if (st === 'got') return err('Подарок в этом году уже получен');
    if (st === 'young') return err('Подарок на день рождения получают аккаунты старше ' + B.minAgeDays + ' дней');
    if (st !== 'ready') return err('Подарок доступен только в день рождения');
    u.bdayYear = year; u.bdayOpen = 1;
    log(db, u, B.tokens, 'Подарок на день рождения');
    addXp(db, u, B.xp);
    var code; do { code = genCode(db, 'HAPPYBDAY-', 4); } while ((u.promos || []).some(function (x) { return x.code === code; }));
    var until = now + B.promoDays * 86400000;
    u.promos.push({ code: code, pct: B.promoPct, kind: 'bday', from: 'Подарок на день рождения', at: now, exp: '', until: until });
    log(db, u, 0, 'Промокод ' + code + ' −' + pctText(B.promoPct) + '% на 30 дней (день рождения)');
    ledgerAdd(db, idKeys(db, u), 'bday' + year, 'подарок выдан');
    settle(db, u); db.saveUser(u);
    if (u.tgChat && db.userNotify) { try { db.userNotify(u, '🎂 С днём рождения, ' + firstName(u.name) + '!\nПодарок уже в кабинете: ' + B.tokens + ' ониксов (это ' + tokensToRub(B.tokens) + ' ₽), ' + B.xp + ' XP и промокод ' + code + ' на −' + pctText(B.promoPct) + '%.', [[{ text: 'Мои бонусы', callback_data: 'bn' }]]); } catch (e) {} }
    return ok({ gifts: [{ k: 'tok', n: B.tokens, rub: tokensToRub(B.tokens) }, { k: 'xp', n: B.xp }, { k: 'promo', code: code, pct: B.promoPct, until: until }], user: publicUser(db, u) });
  };

  A.checkin = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var now = db.now(), today = dayKey(now), yest = dayKey(now - 86400000);
    if (u.lastCheckin === today) return err('Сегодня вы уже отмечались');
    u.streak = u.lastCheckin === yest ? (u.streak || 0) + 1 : 1;
    u.lastCheckin = today;
    var got = earn(db, u, RULES.reward.checkin, 'Ежедневный вход').tok;
    addXp(db, u, RULES.xpReward.checkin);
    track(db, u, 'checkin'); track(db, u, 'streak', null, u.streak);
    var extra = [];
    if (u.streak % 7 === 0) { var sr = levelOf(u).streak; got += earn(db, u, sr, 'Серия 7 дней (' + levelOf(u).name + ')').tok; extra.push('серия 7 дней +' + sr); }
    settle(db, u); db.saveUser(u);
    return ok({ got: got, xp: RULES.xpReward.checkin, extra: extra, user: publicUser(db, u) });
  };

  // события сайта (просмотры, избранное и т. п.): пачкой, клиент отправляет раз в несколько секунд
  A.track = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    touch(db, u);
    var list = Array.isArray(p.events) ? p.events.slice(0, 40) : [{ ev: p.ev, id: p.id }];
    list.forEach(function (e) {
      var ev = String((e && e.ev) || ''), id = e && e.id != null ? String(e.id).slice(0, 14) : '';
      if (CLIENT_EV.indexOf(ev) < 0) return;
      if (ev === 'view' || ev === 'fav' || ev === 'cart' || ev === 'share') {
        var pr = db.product(id); if (!pr) return;
        track(db, u, ev, id);
        if (ev === 'view') {
          if (pr.category) track(db, u, 'vc', pr.category + ':' + id);
          if (pr.oldPrice && pr.oldPrice > pr.price && Math.round((pr.oldPrice - pr.price) / pr.oldPrice * 100) >= 3) track(db, u, 'sale', id);
        }
      } else track(db, u, ev, null, 1);
      var st = taskSlot(u, 'd', db.now()); if ((st.c[ev] || 0) > 60) st.c[ev] = 60;
    });
    settle(db, u); db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };
  // избранное на сервере: запоминаем цену, чтобы бот сообщил, когда вещь подешевеет
  A.watch = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var ids = (Array.isArray(p.ids) ? p.ids : []).map(function (x) { return String(x).replace(/\D/g, '').slice(0, 12); }).filter(Boolean).slice(0, 60);
    var old = u.watch && typeof u.watch === 'object' ? u.watch : {}, w = {};
    ids.forEach(function (id) { var pr = db.product ? db.product(id) : null; if (!pr || pr.status === 'sold') return; w[id] = old[id] != null ? old[id] : pr.price; });
    u.watch = w; db.saveUser(u);
    return ok({ n: Object.keys(w).length });
  };
  /* снижения цен по избранному (вызывает бот): [{id, title, was, now}] и новые запомненные цены */
  function priceDrops(db, u) {
    var w = u.watch && typeof u.watch === 'object' ? u.watch : null, out = []; if (!w) return out;
    Object.keys(w).forEach(function (id) {
      var pr = db.product ? db.product(id) : null;
      if (!pr || pr.status === 'sold') { delete w[id]; return; }
      if (+pr.price < +w[id]) out.push({ id: id, title: pr.title, was: +w[id], now: +pr.price });
      w[id] = +pr.price;
    });
    return out;
  }
  A.ackNews = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    touch(db, u); u.tasks.news = []; db.saveUser(u);
    return ok({});
  };

  /* рамка из посылки: поровну среди ещё не открытых (редкости нет) */
  function pickFrame(db, u) {
    var left = RULES.frames.filter(function (f) { return f.src === 'wheel' && (u.frames || []).indexOf(f.id) < 0; });
    return left.length ? left[Math.floor(db.random() * left.length)] : null;
  }
  A.spin = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var free = !!p.free && ((u.daySpins || 0) + (u.freeSpins || 0)) > 0;
    if (!free && (u.balance || 0) < RULES.spinCost) return err('Не хватает ониксов: нужно ' + RULES.spinCost);
    if (free) { if ((u.daySpins || 0) > 0) u.daySpins -= 1; else u.freeSpins -= 1; } else log(db, u, -RULES.spinCost, 'Прокрут посылки');
    var W = wheelFor(levelOf(u).index), sumW = W.reduce(function (a, w) { return a + w; }, 0);
    var total = 0, r = db.random() * sumW, idx = 0;
    for (var i = 0; i < W.length; i++) { total += W[i]; if (r < total) { idx = i; break; } }
    var prize = RULES.wheel[idx], result = { id: prize.id, label: prize.label, sub: prize.sub };
    if (prize.tokens) { var e1 = earn(db, u, prize.tokens, 'Посылка: ' + prize.label + ' ' + prize.sub); result.tokens = e1.tok; if (e1.xp) { result.capXp = e1.xp; result.cap = RULES.balanceCap; } }
    if (prize.xp) { addXp(db, u, prize.xp); result.xp = prize.xp; }
    if (prize.spins) { u.freeSpins = (u.freeSpins || 0) + prize.spins; result.spins = prize.spins; }
    if (prize.promo) { var code = genCode(db, 'LUCK', 5); u.promos.push({ code: code, pct: prize.promo, from: 'Посылка', at: db.now() }); result.code = code; result.pct = prize.promo; }
    if (prize.frame) {
      var f = pickFrame(db, u);
      if (f) { u.frames.push(f.id); result.frameId = f.id; result.frameName = f.name; }
      else { var e2 = earn(db, u, 50, 'Посылка: все рамки уже открыты'); result.tokens = e2.tok; result.sub = 'все рамки открыты: +50 ониксов'; if (e2.xp) { result.capXp = e2.xp; result.cap = RULES.balanceCap; } }
    }
    track(db, u, 'spin'); settle(db, u);
    db.saveUser(u);
    result.free = free;
    return ok({ prize: result, index: idx, user: publicUser(db, u) });
  };

  // ---------------------------------------------------------------- заказ
  function checkFields(f, hasStock, hasPre) {
    if (String(f.name || '').trim().length < 2) return 'Укажите имя';
    var d = digits(f.phone); if (d.length < 10 || d.length > 15) return 'Укажите телефон';
    var tgv = cleanTg(f.tg); if (tgv && !validTg(tgv)) return 'Проверьте username в Telegram или оставьте поле пустым';
    if (hasStock) { if (!RECV[f.recv]) return 'Выберите способ получения'; if (f.recv === 'city' && String(f.recvCity || '').trim().length < 2) return 'Укажите город'; if (f.recv === 'courier' && String(f.recvAddr || '').trim().length < 5) return 'Укажите полный адрес для курьера'; }
    if (hasStock && hasPre && f.together !== 'together' && f.together !== 'separate') return 'Выберите: получить всё вместе или раздельно';
    if (hasPre) {
      if (!SHIP[f.ship]) return 'Выберите способ отправки из Китая';
      if (!PRE_RECV[f.preRecv]) return 'Выберите способ получения предзаказа';
      if (f.preRecv !== 'meet' && String(f.city || '').trim().length < 2) return 'Укажите город';
      if (f.preRecv === 'cdek' && String(f.preAddr || '').trim().length < 5) return 'Укажите полный адрес для СДЭК';
      if (f.ack !== true) return 'Подтвердите, что прочитали условия предзаказа';
    }
    return null;
  }
  function whenText(ms) { var d = msk(ms); return pad(d.getUTCDate(), 2) + '.' + pad(d.getUTCMonth() + 1, 2) + '.' + d.getUTCFullYear() + ', ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ' (МСК)'; }

  // значение колонки «Приоритет» в таблице: номер очереди и название, сортируется по возрастанию («№1 Алмаз», «№4 Платный»)
  function prioCell(priority, li, paid, u) {
    var ord = priorityOrder(), r = priority && li ? ord.indexOf(li.name) + 1 : 0;
    if (r) return '№' + r + ' ' + li.name + (paid ? ' (платный)' : '');
    return paid ? '№' + (ord.length + 1) + ' Платный' : (u ? 'Обычный' : '');
  }

  /** Текст заказа для менеджера. o: {no, at, f (поля анкеты), lines:[{title,status,size,color,photoNo,note,qty,price,link}], total, tokens, tokenRub, promo, promoRub, toPay, user} */
  function orderText(o) {
    var f = o.f, L = [], hasPre = false, hasStock = false, hasOut = false, cnt = 0;
    L.push('🛍 ЗАКАЗ ONION SHOP №' + o.no);
    var pOrder = priorityOrder(), pRank = o.priority && o.user ? pOrder.indexOf(o.user.levelName) + 1 : 0, pTotal = pOrder.length + 1;
    if (pRank) L.push('⭐ ПРИОРИТЕТ УРОВНЯ: ' + o.priority.toUpperCase() + ' (' + o.user.levelName + '), очередь №' + pRank + ' из ' + pTotal);
    if (o.f.vip === true) L.push('⚡ ПЛАТНЫЙ ПРИОРИТЕТ (+' + RULES.vipPrice + ' ₽, оплачено в заказе)' + (pRank ? ', очередь определяет уровень' : ', очередь №' + pTotal + ' из ' + pTotal + ', после ' + pOrder.join(', ')));
    if (pRank || o.f.vip === true) L.push('📋 Порядок обработки: ' + pOrder.join(', ') + ', платный приоритет, остальные заказы');
    L.push('📅 ' + whenText(o.at));
    L.push('');
    L.push('👤 ПОКУПАТЕЛЬ');
    L.push('Имя: ' + String(f.name).trim());
    L.push('Телефон: ' + fmtPhone(f.phone));
    L.push(cleanTg(f.tg) ? 'Telegram: @' + cleanTg(f.tg) : 'Telegram: нет username, связаться по телефону');
    if (o.user) L.push('Аккаунт: ' + o.user.login + ', ID OS' + o.user.id + ', уровень «' + o.user.levelName + '»');
    L.push('');
    L.push('📦 ТОВАРЫ');
    o.lines.forEach(function (l, i) {
      if (l.status === 'preorder') hasPre = true; else hasStock = true;
      cnt += l.qty;
      if (l.status === 'out') hasOut = true;
      L.push((i + 1) + '. ' + l.title + (l.status === 'preorder' ? ', ПРЕДЗАКАЗ' : l.status === 'out' ? ', ⏳ ВРЕМЕННО НЕТ В НАЛИЧИИ (уточнить срок поступления)' : ', в наличии'));
      var opt = [];
      if (l.size) opt.push('Размер: ' + l.size);
      if (l.color) opt.push('Цвет: ' + l.color);
      if (l.photoNo) opt.push('фото №' + l.photoNo);
      if (opt.length) L.push('   ' + opt.join(', '));
      if (l.note) L.push('   Пожелания: ' + l.note);
      L.push('   ' + l.qty + ' шт × ' + rub(l.price) + ' = ' + rub(l.price * l.qty));
      if (l.link) L.push('   ' + l.link);
    });
    L.push('');
    L.push('💰 Сумма: ' + rub(o.total) + ', товаров: ' + cnt + ' шт.');
    if (o.tokens) L.push('🪙 Списано ониксов: ' + o.tokens + ' (−' + rub(o.tokenRub) + ')');
    if (o.promo) L.push('🏷 Промокод ' + o.promo + (o.promoNote ? ' (' + o.promoNote + ')' : '') + ': −' + rub(o.promoRub));
    if (o.pack) L.push('🎁 ПРИВИЛЕГИЯ: ' + o.pack + ', учесть при расчёте упаковки');
    L.push('✅ К ОПЛАТЕ: ' + rub(o.toPay));
    if (hasPre) L.push('(стоимость доставки из Китая уже включена в стоимость)');
    if (hasPre && o.f.ship === 'air') L.push('✈️ АВИА: доставка и все связанные расходы, полностью за счёт клиента по авиатарифу (≈40 $/кг, от 10 кг, 36 $/кг). Ониксы и промокод уменьшают только стоимость товаров, но не доставку и не упаковку.');
    if (hasOut) L.push('⏳ Есть товар, которого сейчас нет в наличии: сообщите клиенту срок поступления или предложите замену до оплаты.');
    L.push('');
    if (hasStock) {
      var r = '🚚 ПОЛУЧЕНИЕ' + (hasPre ? ' (товары в наличии)' : '') + ': ' + RECV[f.recv];
      if (f.recv === 'city') r += ', город: ' + String(f.recvCity).trim();
      if (f.recv === 'courier' && String(f.recvAddr || '').trim()) r += ', адрес: ' + String(f.recvAddr).trim();
      L.push(r);
    }
    if (hasPre) {
      L.push('✈️ ПРЕДЗАКАЗ, отправка из Китая: ' + SHIP[f.ship] + (f.preRecv !== 'meet' && String(f.city || '').trim() ? ', город: ' + String(f.city).trim() : '') + ', получение: ' + PRE_RECV[f.preRecv] + (f.preRecv === 'cdek' && String(f.preAddr || '').trim() ? ', адрес: ' + String(f.preAddr).trim() : ''));
      L.push('☑️ С условиями предзаказа ознакомлен(а)');
    }
    if (hasStock && hasPre) L.push(f.together === 'together' ? '📮 ПОЛУЧЕНИЕ ЗАКАЗА: ВСЁ ВМЕСТЕ: товар в наличии дождётся предзаказа, клиент получает всё сразу' : '📮 ПОЛУЧЕНИЕ ЗАКАЗА: РАЗДЕЛЬНО: сначала товары в наличии, а предзаказ после приезда из Китая');
    if (String(f.comment || '').trim()) { L.push(''); L.push('💬 Комментарий: ' + String(f.comment).trim()); }
    return L.join('\n');
  }

  /** Собирает и проверяет строки заказа. items: [{id, size, color, photo, qty, note, title, price, status, link, photos}] */
  function buildLines(db, items) {
    var lines = [], unverified = false, gone = [];
    (items || []).forEach(function (it) {
      var qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
      var prod = db.product ? db.product(String(it.id)) : null;
      if (prod && (prod.status === 'sold' || prod.status === 'out')) { gone.push(prod.title || it.id); return; }   // нет в наличии или продано: заказать нельзя никак
      if (!prod) {
        if (db.catalogReady && db.catalogReady()) { gone.push(it.title || it.id); return; }
        unverified = true;
        prod = { id: it.id, title: String(it.title || 'Товар ' + it.id), price: Math.max(0, parseInt(it.price, 10) || 0), status: it.status === 'preorder' ? 'preorder' : it.status === 'out' ? 'out' : 'stock', link: it.link || '', photos: [] };
      }
      var photoNo = 0;
      if (it.photo && prod.photos) { for (var i = 0; i < prod.photos.length; i++) if (String(prod.photos[i].id) === String(it.photo)) photoNo = i + 1; }
      if (!photoNo && it.photoNo) photoNo = parseInt(it.photoNo, 10) || 0;
      lines.push({ id: String(prod.id), title: prod.title, status: prod.status === 'preorder' ? 'preorder' : prod.status === 'out' ? 'out' : 'stock', category: prod.category || it.category || '', size: it.size ? String(it.size).slice(0, 40) : '', color: it.color ? String(it.color).slice(0, 60) : '', photoNo: photoNo, photo: it.photo || null, note: String(it.note || '').slice(0, 300), qty: qty, price: prod.price, link: prod.link || '', thumb: (prod.photos && prod.photos[0] ? prod.photos[0].id : it.thumb) || null });
    });
    return { lines: lines, unverified: unverified, gone: gone };
  }

  /* Скидка по промокоду: личный промокод категории (cat) считается только с товаров этой категории */
  function promoBase(lines, cat) {
    var c = cat ? promoCat(cat) : null, sum = 0;
    lines.forEach(function (l) { if (!c || c.cats.indexOf(l.category) >= 0) sum += l.price * l.qty; });
    return sum;
  }

  /* Промокоды магазина (лист «Промокоды» в таблице): код, %, срок, вкл/выкл, с ониксами, раз на клиента, лимит. */
  function checkShopPromo(db, code, u, phone, tokens) {
    var sp = db.shopPromo ? db.shopPromo(code) : null;
    if (!sp || !sp.active || !(sp.pct > 0)) return { error: 'Промокод не найден' };
    if (sp.until && db.now() > sp.until) return { error: 'Срок промокода ' + code + ' закончился' };
    if (tokens > 0 && sp.withTokens === false) return { error: 'Промокод ' + code + ' нельзя совмещать с ониксами. Уберите списание ониксов' };
    var uses = db.promoUses ? db.promoUses(code) : null;
    if (uses) {
      if (sp.limit > 0 && uses.total >= sp.limit) return { error: 'Промокод ' + code + ' уже закончился' };
      if (sp.once) {
        var pk = phoneKey(phone);
        if ((u && uses.users.indexOf(String(u.id)) >= 0) || (pk && uses.phones.indexOf(pk) >= 0)) return { error: 'Вы уже использовали промокод ' + code };
      }
    }
    return { code: code, pct: sp.pct, withTokens: sp.withTokens !== false, until: sp.until || null };
  }

  // предпросмотр промокода в корзине (ничего не списывает)
  A.checkPromo = function (db, p) {
    var code = String(p.promo || '').trim().toUpperCase();
    if (!code) return err('Введите промокод');
    var u = sessionUser(db, p);
    var own = u ? activePromos(db, u).filter(function (x) { return x.code === code; })[0] : null;
    if (own) return ok({ promo: { code: own.code, pct: own.pct, withTokens: true, personal: true, cat: own.cat || '', catLabel: own.catLabel || '' } });
    var sp = checkShopPromo(db, code, u, p.phone, parseInt(p.useTokens, 10) || 0);
    if (sp.error) return err(sp.error);
    return ok({ promo: sp });
  };

  A.order = function (db, p) {
    var f = p.form || {};
    // заказ: только из кабинета: без входа в аккаунт оформить нельзя (db.allowGuest: только для автотестов)
    if (!db.allowGuest && !sessionUser(db, p)) return { ok: false, error: 'Чтобы оформить заказ, войдите в кабинет или создайте его', needAccount: true };
    var su = sessionUser(db, p);
    // защита от потока заказов (спам менеджеру и накрутка заданий «оформить заказ»): до 5 в час и до 15 в сутки на аккаунт
    var ordKeys = su ? ['ordH:' + su.id + ':' + hourKey(db), 'ordD:' + su.id + ':' + dayKey(db.now())] : [];
    if (su && db.getCode && (((db.getCode(ordKeys[0]) || {}).n || 0) >= 5 || ((db.getCode(ordKeys[1]) || {}).n || 0) >= 15)) { flag(db, 2, 'orders', 'Слишком много заказов подряд: @' + su.login); return err('Слишком много заказов подряд. Если нужно оформить ещё, напишите менеджеру @OnionShop_Support'); }
    if (su) { // контакты, из профиля; профиль должен быть заполнен
      if (String(su.name || '').trim().length < 2 || phoneKey(su.phone || '').length < 10) return err('Заполните имя и телефон в кабинете перед заказом');
      f = Object.assign({}, f, { name: su.name, phone: su.phone, tg: su.tg || '' });
    }
    var built = buildLines(db, p.items);
    if (built.gone.length) return err('Сейчас нельзя заказать (нет в наличии или продано): ' + built.gone.join(', ') + '. Уберите из корзины, а такой товар можно добавить в избранное');
    if (!built.lines.length) return err('Корзина пуста');
    var hasPre = built.lines.some(function (l) { return l.status === 'preorder'; });
    var hasStock = built.lines.some(function (l) { return l.status !== 'preorder'; });
    var hasOut = built.lines.some(function (l) { return l.status === 'out'; });
    if (hasPre) f.ship = 'truck'; // самолёт временно только через менеджера
    var bad = checkFields(f, hasStock, hasPre); if (bad) return err(bad);
    var total = 0, cnt = 0;
    built.lines.forEach(function (l) { total += l.price * l.qty; cnt += l.qty; });
    var u = sessionUser(db, p), tokens = 0, tokenRub = 0, promo = '', promoRub = 0, promoNote = '', pack = '';
    // каталог не загрузился, цены пришли с сайта; скидки ониксами и промокодами в таком заказе не даём, менеджер посчитает сам
    if (built.unverified && ((parseInt(p.useTokens, 10) || 0) > 0 || String(p.promo || '').trim())) return err('Каталог сейчас обновляется: ониксы и промокод временно недоступны. Оформите заказ без них или попробуйте через минуту');
    if (u) {
      var maxTok = Math.min(u.balance || 0, Math.floor(total * RULES.maxShare / RULES.tokenRub));
      tokens = Math.max(0, Math.min(maxTok, parseInt(p.useTokens, 10) || 0));
      tokenRub = tokensToRub(tokens);
    }
    var promoCode = String(p.promo || '').trim().toUpperCase();
    if (promoCode) {
      var pr = u ? activePromos(db, u).filter(function (x) { return x.code === promoCode; })[0] : null;
      if (pr) {
        var base = promoBase(built.lines, pr.cat);
        if (!base) return err('Промокод ' + pr.code + ' действует только на категорию «' + pr.catLabel + '»: в корзине таких товаров нет');
        promo = pr.code; promoRub = Math.round(base * pr.pct / 100); promoNote = pr.cat ? '−' + pctText(pr.pct) + '% на «' + pr.catLabel + '»' : '';
        pr.used = true; pr.usedAt = db.now();
      } else {
        var sp = checkShopPromo(db, promoCode, u, f.phone, tokens);
        if (sp.error) return err(sp.error);
        promo = sp.code; promoRub = Math.round(total * sp.pct / 100);
      }
    }
    // ониксы и промокод вместе не больше 12% суммы: лишние ониксы не списываем
    if (tokens && tokenRub + promoRub > Math.floor(total * RULES.maxShare)) { tokens = Math.max(0, Math.floor((Math.floor(total * RULES.maxShare) - promoRub) / RULES.tokenRub)); tokenRub = tokensToRub(tokens); }
    var vipRub = f.vip === true ? RULES.vipPrice : 0;
    var toPay = Math.max(0, total - tokenRub - promoRub) + vipRub;
    var seq = db.nextOrderSeq();
    var no = orderNo(db, seq), at = db.now();
    var li = u ? levelOf(u) : null, priority = li && li.priority ? li.priority : '';
    var pk = u ? packInfo(db, u) : null;
    if (pk && pk.available && p.usePack !== false && hasPre) { pack = pk.label + ' (' + pk.level + ')'; u.packMonth = monthKey(at); }
    var text = orderText({ no: no, at: at, f: f, lines: built.lines, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, promoNote: promoNote, pack: pack, priority: priority, vipRub: vipRub, toPay: toPay, user: u ? { login: u.login, id: u.id, levelName: li.name } : null });
    if (built.unverified) text += '\n\n⚠️ Каталог был недоступен, цены взяты с сайта, проверьте.';
    if (u) {
      if (tokens) log(db, u, -tokens, 'Оплата заказа №' + no);
      // сумма идёт в уровень и в «Потрачено всего» только когда заказ получен (статус «Получен»: см. receive)
      u.ordersCount = (u.ordersCount || 0) + 1;
      touch(db, u); var doneBefore = doneSnap(u); track(db, u, 'ordN'); if (hasPre) track(db, u, 'ordPre'); if (hasStock || hasOut) track(db, u, 'ordStock'); track(db, u, 'ordSum', null, total);
      settle(db, u); var taskRew = orderTaskRewards(u, doneBefore); db.saveUser(u);
    }
    var order = {
      no: no, seq: seq, at: at, userId: u ? u.id : '', login: u ? u.login : '', name: String(f.name).trim(), phone: fmtPhone(f.phone), tg: cleanTg(f.tg) ? '@' + cleanTg(f.tg) : '', status: 'Оформлен',
      items: built.lines.map(function (l) { return { id: l.id, title: l.title, qty: l.qty, price: l.price, size: l.size, color: l.color, photo: l.photo, thumb: l.thumb, status: l.status }; }),
      count: cnt, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, vipRub: vipRub, toPay: toPay, priority: prioCell(priority, li, f.vip === true, u), pack: pack, level: li ? li.name : '',
      kind: hasPre && hasStock ? 'смешанный' : hasPre ? 'предзаказ' : (hasOut && !built.lines.some(function (l) { return l.status === 'stock'; })) ? 'временно нет' : 'в наличии', comment: String(f.comment || '').trim(), text: text
    };
    if (u && taskRew.length) order.taskRew = JSON.stringify(taskRew);
    db.saveOrder(order);
    if (ordKeys.length) { bump(db, ordKeys[0], 3700); bump(db, ordKeys[1], 90000); }
    if (u && u.tgChat && db.userNotify) { try { db.userNotify(u, 'Заказ ' + no + ' принят 🧾\nК оплате: ' + toPay + ' ₽. Менеджер проверит заказ и пришлёт реквизиты, а статусы я буду присылать сюда.', [[{ text: 'Открыть заказ', callback_data: 'm|' + no }]]); } catch (e) { /* не критично */ } }
    var notified = false;
    try { notified = db.notify ? !!db.notify(text, { no: no, kind: order.kind }) : false; } catch (e) { notified = false; }
    return ok({ order: order, notified: notified, user: u ? publicUser(db, u) : null });
  };

  /* Заказ получен (sign = 1) или статус «Получен» сняли (sign = -1).
     Сумма «К оплате» даёт XP (1 XP за 10 ₽) в уровень месяца и идёт в «Потрачено всего».
     month: месяц, в котором сумму засчитали: при отмене из уровня вычитаем, только если месяц тот же. */
  function isPreKind(k) { return k === 'предзаказ' || k === 'смешанный'; }
  /* награды за задания «оформить заказ»: запоминаем, какие задания закрыл именно этот заказ, чтобы при отмене списать */
  var ORDER_METRICS = ['ordN', 'ordPre', 'ordStock', 'ordSum', 'both'];
  function doneSnap(u) { var o = {}; ['d', 'w', 'm'].forEach(function (per) { var st = u.tasks && u.tasks[per]; o[per] = st ? { k: st.k, done: st.done.slice() } : { k: '', done: [] }; }); return o; }
  function orderTaskRewards(u, before) {
    var out = [];
    ['d', 'w', 'm'].forEach(function (per) {
      var st = u.tasks[per], b = before[per];
      st.done.forEach(function (k) {
        var t = TASK[k]; if (!t || t.auto || ORDER_METRICS.indexOf(t.m) < 0) return;
        if (b.k === st.k && b.done.indexOf(k) >= 0) return;
        out.push({ per: per, pk: st.k, k: k, tk: t.tk, xp: t.xp });
      });
    });
    return out;
  }
  /* заказ отменён (sign = 1) или отмену сняли (sign = -1): счётчики заданий и награды за них */
  function orderCanceled(db, u, info, sign) {
    touch(db, u);
    var at = +info.at || db.now(), total = Math.max(0, Math.round(+info.total || 0)), kind = String(info.kind || '');
    var rew = []; try { rew = info.taskRew ? (typeof info.taskRew === 'string' ? JSON.parse(info.taskRew) : info.taskRew) : []; } catch (e) { rew = []; }
    var hasPre = isPreKind(kind), hasStock = kind !== 'предзаказ';
    ['d', 'w', 'm'].forEach(function (per) {
      var st = taskSlot(u, per, db.now()); if (st.k !== periodKey(per, at)) return; // прошедший период не трогаем
      var d = sign > 0 ? -1 : 1;
      st.c.ordN = Math.max(0, (st.c.ordN || 0) + d);
      if (hasPre) st.c.ordPre = Math.max(0, (st.c.ordPre || 0) + d);
      if (hasStock) st.c.ordStock = Math.max(0, (st.c.ordStock || 0) + d);
      st.c.ordSum = Math.max(0, (st.c.ordSum || 0) + d * total);
    });
    if (sign > 0) {
      rew.forEach(function (r) {
        var t = TASK[r.k]; if (!t) return;
        log(db, u, -Math.abs(+r.tk || 0), 'Заказ ' + (info.no || '') + ' отменён: награда за задание «' + t.title + '» списана');
        if (monthKey(at) === u.xpMonth) u.xp = Math.max(0, (u.xp || 0) - Math.abs(+r.xp || 0));
        var st = taskSlot(u, r.per, db.now()); if (st.k === r.pk) st.done = st.done.filter(function (k) { return k !== r.k; });
      });
    } else settle(db, u);
    return u;
  }
  /* реферальный бонус: пригласившему: когда первый заказ друга от 1 000 ₽ получен (статус «Получен») */
  function referralOnReceive(db, u, total, getUser) {
    if (!u.referredBy || u.refRewarded || (+total || 0) < RULES.refMinOrder) return null;
    u.refRewarded = true;
    var ref = (getUser || db.getUser)(u.referredBy); if (!ref) return null;
    touch(db, ref);
    var mk = monthKey(db.now());
    if (ref.refMonth !== mk) { ref.refMonth = mk; ref.refMonthCount = 0; }
    if ((ref.refMonthCount || 0) >= RULES.refMaxPerMonth) return ref;
    ref.refMonthCount = (ref.refMonthCount || 0) + 1; ref.refCount = (ref.refCount || 0) + 1;
    log(db, ref, RULES.reward.referrer, 'Приглашённый друг @' + u.login + ' получил первый заказ');
    track(db, ref, 'ref'); settle(db, ref);
    return ref;
  }
  function receive(db, u, amount, sign, month, info) {
    touch(db, u);
    amount = Math.max(0, Math.round(+amount || 0));
    var xp = xpOfRub(amount);
    if (sign > 0) {
      u.spent = (u.spent || 0) + amount; u.recvTotal = (u.recvTotal || 0) + 1;
      addXp(db, u, xp);
      track(db, u, 'recvN'); track(db, u, 'recvSum', null, amount);
      if (isPreKind(info && info.kind)) { track(db, u, 'recvPre'); u.cnRecv = (u.cnRecv || 0) + 1; }
      settle(db, u);
    } else {
      u.spent = Math.max(0, (u.spent || 0) - amount); u.recvTotal = Math.max(0, (u.recvTotal || 0) - 1);
      if (!month || month === u.xpMonth) {
        u.xp = Math.max(0, (u.xp || 0) - xp);
        track(db, u, 'recvN', null, -1); track(db, u, 'recvSum', null, -amount);
        if (isPreKind(info && info.kind)) track(db, u, 'recvPre', null, -1);
      }
      if (isPreKind(info && info.kind)) u.cnRecv = Math.max(0, (u.cnRecv || 0) - 1);
    }
    return u;
  }


  /* ---------- подтверждение телефона через Telegram (кнопка «Поделиться номером») ----------
     Telegram сам подтверждает, что номер принадлежит владельцу аккаунта (contact.user_id === from.id). */
  function grantWelcome(db, u) {
    if (u.bonusDone) return 0;
    var keys = idKeys(db, u);
    if (ledgerHas(db, keys, 'acct')) { u.bonusDone = 'repeat'; log(db, u, 0, 'Телефон подтверждён: приветственные бонусы уже получались раньше'); return 0; }
    u.bonusDone = 'yes'; var got = RULES.reward.register;
    log(db, u, RULES.reward.register, 'Регистрация (телефон подтверждён)');
    var ref = u.referredBy ? db.getUser(u.referredBy) : null;
    if (ref) { log(db, u, RULES.reward.refFriend, 'Бонус по приглашению от ' + ref.login); got += RULES.reward.refFriend; }
    return got;
  }
  function phoneConfirm(db, u, contact, fromId) {
    if (!u) return { ok: false, msg: 'Сначала подключите бота к кабинету на сайте' };
    if (!contact || String(contact.user_id || '') !== String(fromId || '')) return { ok: false, msg: 'Отправьте свой номер кнопкой «📱 Поделиться номером», чужой контакт не подойдёт' };
    var ph = phoneKey(contact.phone_number);
    if (ph.length < 10 || ph.length > 15) return { ok: false, msg: 'Не удалось прочитать номер' };
    var other = db.findUser('phone', ph);
    if (other && other.id !== u.id) return { ok: false, msg: 'Этот номер уже привязан к другому аккаунту ONION SHOP. Напишите менеджеру, если это ошибка' };
    var changed = ph !== u.phoneKey;
    if (changed) { u.phone = fmtPhone('+' + String(contact.phone_number).replace(/^\+/, '')); u.phoneKey = ph; }
    u.phoneOk = true; touch(db, u);
    var got = grantWelcome(db, u);
    settle(db, u); db.saveUser(u);
    return { ok: true, got: got, changed: changed, user: u };
  }
  // демо-режим: подтверждение одной кнопкой (настоящий сервер этого не позволяет)
  A.phoneDemo = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    if (!db.registerBonus) return err('Подтвердите телефон через Telegram-бота');
    var r = phoneConfirm(db, u, { user_id: 1, phone_number: u.phoneKey }, 1);
    return r.ok ? ok({ got: r.got, user: publicUser(db, u) }) : err(r.msg);
  };

  /* ---------- Telegram: подключение, статусы заказов ---------- */
  var STATUS_EMO = { 'Оформлен': '🧾', 'Выкуплен': '✅', 'В пути': '🚚', 'На складе': '📦', 'Едет к нам': '✈️', 'Едет к вам': '🚚', 'Получен': '🎉', 'Отменён': '❌' };
  function statusMessage(no, status) {
    var note = RULES.stageNotes[status] || '';
    var t = (STATUS_EMO[status] || '🔔') + ' Заказ ' + no + ': ' + status + (note ? '\n' + note : '');
    if (status === 'Получен') t += '\nОставьте отзыв на сайте, получите ониксы.';
    if (status === 'Отменён') t += '\nОниксы, если вы их тратили, вернутся на баланс.';
    return t;
  }
  A.tgLink = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var code = 'T' + makeCode(db) + makeCode(db);
    db.putCode('tg:' + code, { userId: u.id }, 3600);
    return ok({ code: code, bot: db.botUser ? (db.botUser() || '') : '', on: !!u.tgChat });
  };
  // уведомления в Telegram включены всегда: ни отключить, ни выбрать категории нельзя (после подключения приходит всё)
  // вызывается ботом (не сайтом): текст «/start T123…» из чата → привязка к клиенту
  function tgBind(db, text, chat, name) {
    var m = /^\/start(?:@\w+)?\s+(T\d{12})\s*$/.exec(String(text || '').trim());
    if (!m) return null;
    var c = db.getCode('tg:' + m[1]); if (!c) return { ok: false };
    var u = db.getUser(c.userId); if (!u) return { ok: false };
    u.tgChat = String(chat); u.tgName = String(name || ''); db.saveUser(u); db.delCode('tg:' + m[1]);
    return { ok: true, user: u };
  }

  /* ---------- отзывы ---------- */
  function firstName(n) { return String(n || 'Клиент').trim().split(/\s+/)[0].slice(0, 20); }
  A.review = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var no = String(p.no || ''), pid = String(p.productId || ''), rating = parseInt(p.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return err('Поставьте оценку от 1 до 5');
    var o = (db.listOrders(u.id, 200) || []).filter(function (x) { return x.no === no; })[0];
    if (!o || String(o.status) !== 'Получен') return err('Отзыв можно оставить после получения заказа');
    var it = (o.items || []).filter(function (x) { return String(x.id) === pid; })[0];
    if (!it) return err('Этого товара нет в заказе');
    if (db.reviewHas(no, pid)) return err('Вы уже оставили отзыв на этот товар');
    var text = String(p.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    // фото к отзыву: до 3 штук, только JPEG в base64 (сайт сам сжимает), каждое до ~350 КБ. На сайте их видно после одобрения менеджером.
    var raw = Array.isArray(p.photos) ? p.photos : [];
    if (raw.length > 3) return err('К отзыву можно приложить до 3 фото');
    var shots = raw.filter(function (d) { return typeof d === 'string' && d.length <= 500000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(d); });
    if (shots.length !== raw.length) return err('Не получилось прочитать фото. Попробуйте другое');
    var tokens = text.length >= 20 ? RULES.reward.reviewText : RULES.reward.review;
    touch(db, u);
    var ids = [];
    shots.forEach(function (d, i) { var id = db.savePhoto ? db.savePhoto(d, no + '_' + pid + '_' + (i + 1)) : ''; if (id) ids.push(id); });
    db.reviewAdd({ at: db.now(), no: no, userId: u.id, login: u.login, name: firstName(u.name), productId: pid, title: it.title, rating: rating, text: text, status: 'опубликован', reward: tokens, photos: ids.join(' '), photoSt: ids.length ? 'на проверке' : '' });
    log(db, u, tokens, 'Отзыв на товар «' + String(it.title).slice(0, 40) + '»');
    track(db, u, 'review'); settle(db, u); db.saveUser(u);
    return ok({ reward: tokens, user: publicUser(db, u) });
  };
  A.reviews = function (db, p) {
    var rows = (db.reviewsFor ? db.reviewsFor(String(p.productId || '')) : []) || [], sum = 0;
    rows.forEach(function (r) { sum += +r.rating || 0; });
    return ok({ count: rows.length, avg: rows.length ? Math.round(sum / rows.length * 10) / 10 : 0,
      list: rows.slice(0, 50).map(function (r) { return { name: r.name, rating: +r.rating, text: r.text, at: r.at, photos: (r.photos || []).slice(0, 3) }; }) });
  };

  /* ---------- «Сообщить, когда появится» ---------- */
  A.waitlist = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var pid = String(p.productId || ''), pr = db.product(pid);
    if (p.on === false) { db.waitRemove(u.id, pid); return ok({ user: publicUser(db, u) }); }
    if (!pr) return err('Товар не найден');
    if (pr.status !== 'out') return err('Этот товар уже можно заказать');
    if (db.waitsOf(u.id).length >= 20) return err('Можно следить не больше чем за 20 товарами');
    if (!db.waitsOf(u.id).some(function (w) { return w.productId === pid; })) db.waitAdd({ at: db.now(), userId: u.id, login: u.login, productId: pid, title: pr.title });
    return ok({ user: publicUser(db, u) });
  };

  // без сервера: номер из даты и случайных символов (повтор практически невозможен)
  function offlineNo(ms, rnd) {
    var d = msk(ms), s = '';
    for (var i = 0; i < 3; i++) s += CODE_ABC.charAt(Math.floor(rnd() * CODE_ABC.length));
    return 'OS-' + pad(d.getUTCDate(), 2) + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCHours(), 2) + pad(d.getUTCMinutes(), 2) + '-' + s;
  }

  function handle(action, p, db) {
    if (!Object.prototype.hasOwnProperty.call(A, action) || typeof A[action] !== 'function') return err('Неизвестное действие'); // не пускаем «constructor», «toString» и т. п.
    return A[action](db, p || {});
  }

  return {
    RULES: RULES, handle: handle, orderText: orderText, buildLines: buildLines, checkFields: checkFields,
    offlineNo: offlineNo, levelInfo: levelInfo, levelOf: levelOf, fixIndex: fixIndex, receive: receive, priceDrops: priceDrops, photoLinks: photoLinks, earlyLeft: earlyLeft, phoneConfirm: phoneConfirm, flag: flag, referralOnReceive: referralOnReceive, orderCanceled: orderCanceled, canonEmail: canonEmail, bdayIsToday: bdayIsToday, adjustTokens: adjustTokens, xpOfRub: xpOfRub, wheelFor: wheelFor, framesFor: framesFor, pctText: pctText, promoBase: promoBase, touch: touch, tokensToRub: tokensToRub, settings: settings, dayKey: dayKey, monthKey: monthKey,
    statusMessage: statusMessage, tgBind: tgBind, activePromos: activePromos,
    cleanTg: cleanTg, cleanEmail: cleanEmail, phoneKey: phoneKey, fmtPhone: fmtPhone, digits: digits, validEmail: validEmail, taskPick: picksFor, weekKey: weekKey, stagesFor: stagesFor
  };
})();

