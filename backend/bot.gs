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
var BTN_ = { cat: '💠 Каталог', ord: '🧾 Мои заказы', bon: '💎 Бонусы', guide: '📘 Инструкция', faq: '💬 Вопросы', sup: '✉️ Написать менеджеру',
  aOrd: '📦 Заказы', aUnp: '💳 Неоплаченные', aSum: '📊 Сводка', aCli: '👤 Клиент', aBc: '📣 Рассылка', aPromo: '🏷 Промокоды', aRev: '⭐ Отзывы', aHelp: '❓ Подсказка' };
var OLD_BTN_ = { '🆕 Новинки': 'cat', '🔥 Скидки': 'cat', '🛍 Каталог': 'cat', 'ℹ️ Условия и сроки': 'faq', '❓ Вопросы': 'faq', '💬 Задать вопрос': 'sup', '💬 Написать менеджеру': 'sup', '⚙️ Настройки': 'set', '💬 Менеджер': 'sup', '📦 Мои заказы': 'ord', '🎁 Бонусы': 'bon' };
/* меню внизу: каталог главной синей кнопкой, остальное парами */
function custKb_() { return { keyboard: [[{ text: BTN_.cat, style: 'primary' }], [{ text: BTN_.ord }, { text: BTN_.bon }], [{ text: BTN_.guide }, { text: BTN_.faq }], [{ text: BTN_.sup }]], resize_keyboard: true, is_persistent: true, input_field_placeholder: 'Вопрос менеджеру или пункт меню' }; }
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

/* ====================== оформление сообщений ======================
   Единый стиль ONION SHOP: значки только из сине-бело-серой гаммы (💠 🔹 ▫️ 🧾 💎 ✉️ 📘 🤍 ☑️), короткие заголовки,
   данные в таблицах, подробности в раскрывающихся пунктах. Главная кнопка сообщения синяя (style primary),
   остальные обычные, красная только у отмены заказа.
   Большие экраны (приветствие, каталог, заказы, бонусы, вопросы, инструкция) уходят форматом Telegram Rich messages
   (sendRichMessage, Bot API 10.1+): заголовки, таблицы, раскрывающиеся пункты. Если Telegram отказал (ошибка разметки,
   старый API), уходит то же содержимое обычным HTML (richToHtml_).
   Уведомления о заказах остаются обычным текстом: их должны увидеть все, даже на старых версиях Telegram. */
function pri_(b) { b.style = 'primary'; return b; }
function dng_(b) { b.style = 'danger'; return b; }
function tgRich_(chat, html, kb) {
  var p = { chat_id: String(chat), rich_message: { html: html, skip_entity_detection: true } };
  if (kb) p.reply_markup = Array.isArray(kb) ? { inline_keyboard: kb } : kb;
  var r = tgApi_('sendRichMessage', p);
  if (r && (r.ok || r.error_code === 403)) return r;
  console.warn('rich -> html: ' + (r && r.description));
  return tgSend_(chat, richToHtml_(html), kb);
}
function tgRichEdit_(chat, msgId, html, kb) {
  var r = tgApi_('editMessageText', { chat_id: String(chat), message_id: msgId, rich_message: { html: html, skip_entity_detection: true }, reply_markup: { inline_keyboard: kb || [] } });
  if (r && (r.ok || /not modified/i.test(r.description || ''))) return r;
  return tgEdit_(chat, msgId, richToHtml_(html), kb);
}
/* запасной вид для старых клиентов: таблицы в строки, раскрывающиеся пункты в сворачиваемые цитаты */
function richToHtml_(h) {
  var s = String(h);
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, function (m, t) {
    return (t.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter(function (r) { return r.indexOf('<th') < 0; }).map(function (r) {
      var c = (r.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(function (x) { return x.replace(/<\/?td[^>]*>/g, '').trim(); }).filter(Boolean);
      if (c.length < 2) return c[0] || '';
      return c[0] + (c[0].replace(/<[^>]+>/g, '').length <= 3 ? ' ' : ': ') + c.slice(1).join(', ');
    }).join('\n') + '\n\n';
  });
  s = s.replace(/<ol>([\s\S]*?)<\/ol>/g, function (m, t) { var i = 0; return t.replace(/<li>([\s\S]*?)<\/li>/g, function (x, y) { return (++i) + '. ' + y.trim() + '\n'; }) + '\n'; });
  s = s.replace(/<ul>([\s\S]*?)<\/ul>/g, function (m, t) { return t.replace(/<li>([\s\S]*?)<\/li>/g, function (x, y) { return '▫️ ' + y.trim() + '\n'; }) + '\n'; });
  s = s.replace(/<h\d>([\s\S]*?)<\/h\d>/g, '<b>$1</b>\n');
  s = s.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
  s = s.replace(/<footer>([\s\S]*?)<\/footer>/g, '<i>$1</i>\n');
  s = s.replace(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g, function (m, a, b) { return '<b>' + a.trim() + '</b>\n<blockquote expandable>' + b.trim() + '</blockquote>\n\n'; });
  s = s.replace(/<hr\s*\/?>|<\/?mark>/g, '');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* первая строка сообщения (обычного или rich): по ней понимаем, какой экран открыт, и правим его, а не шлём новый */
function rtPlain_(x) { if (x == null) return ''; if (typeof x === 'string') return x; if (Array.isArray(x)) return x.map(rtPlain_).join(''); return rtPlain_(x.text); }
function msgHead_(m) {
  if (!m) return '';
  if (m.text) return String(m.text).split('\n')[0];
  var b = m.rich_message && m.rich_message.blocks && m.rich_message.blocks[0];
  return b ? rtPlain_(b.text) : '';
}

/* ====================== фирменные стикеры ======================
   Картинки 512×512 WEBP лежат на сайте (assets/bot/st/*.webp). Первый раз Telegram берёт файл по ссылке,
   дальше бот шлёт его по file_id. Набор для Telegram (t.me/addstickers/...) создаёт функция stickersSetup(). */
var STK_VER_ = '1';
var STICKERS_ = { hello: '👋', catalog: '🛍', accepted: '🧾', onway: '✈️', delivered: '📦', thanks: '🤍', support: '💬', bonus: '💎' };
var STICKER_AT_ = { 'Принят': 'accepted', 'Едет к вам': 'onway', 'Получен': 'delivered' };
function stickerUrl_(key) { return siteBase_() + 'assets/bot/st/' + key + '.webp?v=' + STK_VER_; }
function sticker_(chat, key, kb) {
  var fk = 'STK_' + key + '_' + STK_VER_, fid = props_().getProperty(fk);
  var p = { chat_id: String(chat), sticker: fid || stickerUrl_(key) };
  if (kb) p.reply_markup = Array.isArray(kb) ? { inline_keyboard: kb } : kb;
  var r = tgApi_('sendSticker', p);
  if ((!r || !r.ok) && fid) { props_().deleteProperty(fk); p.sticker = stickerUrl_(key); r = tgApi_('sendSticker', p); }
  if (r && r.ok && !fid && r.result && r.result.sticker) props_().setProperty(fk, r.result.sticker.file_id);
  return r;
}
/* Запустить один раз из редактора Apps Script: создаёт набор стикеров ONION SHOP на аккаунт менеджера */
function stickersSetup() {
  var admin = props_().getProperty('ADMIN_CHAT_ID');
  if (!admin) { Logger.log('Сначала привяжите менеджера: напишите боту /start с аккаунта @' + adminUser_()); return; }
  var me = tgApi_('getMe', {}), bot = me && me.result && me.result.username;
  if (!bot) { Logger.log('Не удалось узнать имя бота, проверьте BOT_TOKEN'); return; }
  var name = 'onionshop_by_' + bot;
  var list = Object.keys(STICKERS_).map(function (k) { return { sticker: stickerUrl_(k), format: 'static', emoji_list: [STICKERS_[k]] }; });
  var r = tgApi_('createNewStickerSet', { user_id: Number(admin), name: name, title: 'ONION SHOP', stickers: list });
  if (r && r.ok) { tgSend_(admin, '🤍 <b>Набор стикеров ONION SHOP готов</b>\nhttps://t.me/addstickers/' + name); Logger.log('Готово: https://t.me/addstickers/' + name); }
  else Logger.log('Не получилось: ' + (r && r.description));
}

/* ====================== уведомления покупателю: короткий текст и одна синяя кнопка ====================== */
function notice_(u, title, body, btn) {
  if (!u || !u.tgChat) return false;
  if (btn && !btn.style) btn.style = 'primary';
  var r = tgSend_(u.tgChat, '<b>' + title + '</b>\n' + body, btn ? [[btn]] : null);
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); return false; }
  return !!(r && r.ok);
}
function btnOrder_(no) { return { text: 'Открыть заказ', callback_data: 'm|' + no }; }
function btnUrl_(text, hash) { return { text: text, url: siteUrl_(hash) }; }
/* статусы заказа: значок, заголовок, текст */
var ST_ = {
  'Принят': ['🧾', 'Заказ принят', 'Менеджер проверит позиции и пришлёт реквизиты для оплаты в этот чат.'],
  'Выкуплен': ['☑️', 'Заказ выкуплен', 'Вещи выкуплены у поставщика и направляются на наш склад.'],
  'Едет в Китай': ['🔹', 'Заказ едет на склад', 'Поставщик везёт вещи на наш склад, обычно это 3-5 дней.'],
  'Проверка товара': ['🔎', 'Заказ на складе', 'Проверяем каждую вещь и готовим фотоотчёт перед отправкой.'],
  'Едет в Россию': ['✈️', 'Заказ едет в Россию', 'Посылка покинула склад. Дорога обычно занимает 18-32 дня, мы следим за ней.'],
  'Едет к вам': ['📬', 'Заказ едет к вам', 'Передали в доставку. Трек-номер менеджер пришлёт в этот чат.'],
  'Получен': ['🤍', 'Заказ получен', 'Спасибо, что выбрали ONION SHOP. Поделитесь впечатлением: за отзыв начислим до {rt} ониксов.'],
  'Отменён': ['▫️', 'Заказ отменён', 'Если часть суммы была оплачена ониксами, они уже на балансе. Отменили по ошибке? Напишите сюда, разберёмся.']
};
/* шкала пути заказа: ▰▰▰▱▱▱▱ 3/7 (у заказа в наличии своя, короткая) */
function stageBar_(no, st) {
  var stages = OnionCore.RULES.stagesPre;
  try { var f = orderIdx_(no); if (f && f.o) stages = OnionCore.stagesFor(f.o.kind); } catch (e) { }
  var i = stages.indexOf(st); if (i < 0) return '';
  var s = ''; for (var k = 0; k < stages.length; k++) s += k <= i ? '▰' : '▱';
  return s + '  ' + (i + 1) + '/' + stages.length;
}
function statusText_(no, st) {
  var s = ST_[st] || ['🔹', 'Статус заказа обновлён', 'Новый статус: ' + st + '.'];
  var bar = st === 'Отменён' ? '' : stageBar_(no, st);
  return s[0] + ' <b>' + s[1] + '</b>\n<code>' + hesc_(no) + '</code>' + (bar ? '   ' + bar : '') + '\n<blockquote>' + hesc_(fill_(s[2], { rt: OnionCore.RULES.reward.reviewText })) + '</blockquote>';
}
function statusKb_(no, st) { return st === 'Получен' ? [[pri_(btnUrl_('🤍 Оставить отзыв', 'orders'))]] : [[pri_(btnOrder_(no))]]; }
function statusNotice_(u, no, st) {
  if (!u || !u.tgChat) return false;
  if (STICKER_AT_[st]) sticker_(u.tgChat, STICKER_AT_[st]);
  var r = tgSend_(u.tgChat, statusText_(no, st), statusKb_(no, st));
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); return false; }
  return !!(r && r.ok);
}
function payText_(no, sum) {
  return '🏦 <b>Ожидаем оплату</b>\n<code>' + hesc_(no) + '</code>\nК оплате: <b>' + rub_(sum) + '</b>\n<blockquote>' +
    pick_(['Уже перевели? Тогда всё в порядке: менеджер отметит оплату, и заказ пойдёт дальше.', 'Реквизиты прислал менеджер. Если оплата уже ушла, ничего делать не нужно.']) + '</blockquote>';
}
function reviewText_(no, r, rt) {
  return '🤍 <b>Как вам заказ?</b>\n<code>' + hesc_(no) + '</code>\n<blockquote>Оценка займёт минуту и поможет другим с выбором.\nЗа звёзды +' + r + ' ониксов, с парой слов о посадке и качестве +' + rt + '.</blockquote>';
}

/* ====================== покупатель ====================== */
function welcome_(name, linked) {
  var head = '👋 ' + (name ? hesc_(name) + ', добро' : 'Добро') + ' пожаловать в ONION SHOP BOT';
  return head + '\n\n' +
    'Я ваш персональный помощник для комфортного и продуманного шопинга.\n\n' +
    '🔷 <b>Ваши заказы</b>\nСледите за заказами в любое время. Состав, фотографии товаров, размеры, стоимость и актуальный статус.\n\n' +
    '🔷 <b>Уведомления</b>\nБот сам сообщает о каждом изменении заказа, присылает фотоотчёт после проверки товаров на складе, рассказывает о новых поступлениях и о снижении цен на избранное.\n\n' +
    '🔷 <b>Оплата</b>\nРеквизиты приходят сразу после оформления. Оплатите удобным способом сейчас или отложите оплату, а бот вовремя напомнит.\n\n' +
    '🔷 <b>Поддержка</b>\nОстались вопросы? Напишите менеджеру прямо в чате и при необходимости приложите фото.\n\n' +
    (linked ? '' : '📲 Чтобы получать уведомления, подключите бота в кабинете на сайте.\n\n') +
    '◻️ Нажмите «Открыть каталог», чтобы начать';
}
/* одна кнопка: каталог открывается мини-приложением; без подключённых уведомлений ещё и кнопка подключения */
function welcomeKb_(linked, plain) {
  var cat = plain ? btnUrl_('Открыть каталог', '') : { text: 'Открыть каталог', web_app: { url: siteUrl_('') } };
  var kb = [[pri_(cat)]];
  if (!linked) kb.push([btnUrl_('📲 Подключить уведомления', 'account')]);
  return kb;
}
/* приветственное видео (телефон, «Добро пожаловать»); id файла запоминаем, дальше Telegram берёт его у себя */
var VID_VER_ = '7';
function vidUrl_(n) { return siteBase_() + 'assets/bot/' + n + '.mp4?v=' + VID_VER_; }
function tgAnimation_(chat, key, caption, kb) {
  var fk = 'FID_' + key + '_' + VID_VER_, fid = props_().getProperty(fk);
  var p = { chat_id: String(chat), animation: fid || vidUrl_(key), caption: String(caption || '').slice(0, 1024), parse_mode: 'HTML', width: 1280, height: 720, duration: 18 };
  if (kb) p.reply_markup = Array.isArray(kb) ? { inline_keyboard: kb } : kb;
  var r = tgApi_('sendAnimation', p);
  if ((!r || !r.ok) && fid) { props_().deleteProperty(fk); p.animation = vidUrl_(key); r = tgApi_('sendAnimation', p); }
  if (r && r.ok && !fid) { var a = (r.result && (r.result.animation || r.result.document)) || {}; if (a.file_id) props_().setProperty(fk, a.file_id); }
  return r;
}
/* меню внизу чата: Telegram привязывает клавиатуру к сообщению (если сообщение удалить, меню исчезает), поэтому короткая строка остаётся */
function setMenu_(chat, kb) { tgSend_(chat, 'Меню внизу 👇', kb); }
/* приветствие: один пост (видео, текст, кнопка). menuKb: клавиатура меню; менеджеру в «Примерах» передаём null, чтобы не сбить его панель */
function sendWelcomeTo_(chat, name, linked, menuKb) {
  var cap = welcome_(name, linked), a = tgAnimation_(chat, 'welcome2', cap, welcomeKb_(linked));
  if (a && a.error_code === 403) return a;
  if (!a || !a.ok) { a = tgSend_(chat, cap, welcomeKb_(linked)); if (!a || !a.ok) a = tgSend_(chat, cap, welcomeKb_(linked, true)); }
  if (menuKb) setMenu_(chat, menuKb);
  return a;
}
function sendWelcome_(m, linked) { sendWelcomeTo_(m.chat.id, m.chat.first_name, linked, custKb_()); }
function needLink_(chat) {
  tgSend_(chat, '📲 <b>Кабинет пока не подключён</b>\n<blockquote>Откройте кабинет на сайте, раздел «Уведомления в Telegram», и нажмите «Подключить». Это займёт полминуты.</blockquote>', [[pri_(btnUrl_('Открыть кабинет', 'account'))]]);
}
function custCatalog_(chat) {
  tgRich_(chat, '<h3>💠 Каталог</h3>' +
    '<p>Коллекция регулярно пополняется. Выберите, с чего начать: раздел откроется на сайте.</p>' +
    '<table bordered compact>' +
    '<tr><td>🆕 <b>Новинки</b></td><td>свежие поступления</td></tr>' +
    '<tr><td>📉 <b>Скидки</b></td><td>вещи со сниженной ценой</td></tr>' +
    '<tr><td>🏙 <b>В наличии</b></td><td>уже в Москве, без ожидания</td></tr>' +
    '<tr><td>✈️ <b>Предзаказ</b></td><td>24-47 дней, доставка уже в цене</td></tr>' +
    '</table>' +
    '<footer>Добавьте вещь в избранное, и бот напишет, когда она подешевеет.</footer>', [
    [pri_(btnUrl_('🆕 Новинки', 'catalog')), btnUrl_('📉 Скидки', 'catalog')],
    [btnUrl_('🏙 В наличии', 'stock'), btnUrl_('✈️ Предзаказ', 'preorder')]]);
}
/* частые вопросы: один экран, каждая тема раскрывается на месте */
var FAQ_ = [
  ['order', 'как оформить заказ', '<p>Выберите вещь на сайте, отметьте размер и цвет и добавьте в корзину. Контакты подставятся из кабинета, останется выбрать способ получения и, если хотите, ониксы или промокод.</p><p>После оформления заказ получает номер, менеджер проверяет его и присылает реквизиты для оплаты. Вещь закрепляется за вами после оплаты.</p>'],
  ['pre', 'предзаказ и сроки', '<table bordered compact><tr><th>этап</th><th>срок</th></tr><tr><td>выкуп у поставщика</td><td>до 12 часов</td></tr><tr><td>дорога до нашего склада</td><td>4-12 дней</td></tr><tr><td>проверка и фотоотчёт</td><td>на складе</td></tr><tr><td>доставка в Россию</td><td>18-32 дня</td></tr></table><p>В сумме выходит примерно <b>24-47 дней</b>. Доставка уже включена в цену. Самолётом быстрее, это обсуждается с менеджером.</p>'],
  ['ship', 'доставка и получение', '<p><b>В наличии</b> (уже в Москве): Авито Доставка по Москве и в другие города, курьер по Москве (не всегда) или самовывоз.</p><p><b>Предзаказ</b>: когда вещь в России, отправим СДЭК, Авито Доставкой или передадим при встрече в Москве. Трек-номер пришлёт менеджер.</p>'],
  ['pay', 'оплата', '<p>Переводом (Сбербанк, Т-Банк, Альфа-Банк, СБП) или наличными при встрече в Москве. На сайте оплаты нет: после проверки заказа менеджер пришлёт реквизиты.</p><p>До 12% заказа можно оплатить ониксами и промокодом вместе.</p>'],
  ['cancel', 'отмена заказа', '<p>Пока заказ в статусе «Принят», его можно отменить самостоятельно: «Мои заказы», нужный заказ, кнопка «Отменить заказ». Ониксы вернутся на баланс.</p><p>Когда заказ уже в работе, изменения согласуйте с менеджером.</p>'],
  ['bonus', 'ониксы и уровни', '<p>Ониксы начисляются за регистрацию, ежедневный вход, задания, отзывы, приглашённых друзей и в посылке с сюрпризом. 1 оникс = 0,3 ₽.</p><p>Уровень считается по опыту (XP) за месяц: чем он выше, тем больше заданий, промокоды и приоритет заказа. 1-го числа опыт обнуляется.</p>'],
  ['size', 'размеры', '<p>Если у модели есть замеры, они в карточке товара в разделе «Замеры изделия». Это размеры самой вещи, а не обхват тела: проще всего сравнить с похожей вещью из своего шкафа.</p><p>Сомневаетесь между двумя размерами? Напишите менеджеру свои параметры, он подскажет.</p>']
];
function custFaq_(chat, msgId, key) {
  var html = '<h3>💬 Частые вопросы</h3><p>Главное о заказах, сроках и оплате. Нажмите на тему, чтобы раскрыть ответ.</p>' +
    FAQ_.map(function (x) { return '<details' + (x[0] === key ? ' open' : '') + '><summary>' + x[1] + '</summary>' + x[2] + '</details>'; }).join('') +
    '<footer>Не нашли ответ? Менеджер ответит в этом чате.</footer>';
  var kb = [[pri_({ text: '✉️ Спросить менеджера', callback_data: 'q|' }), { text: '📘 Инструкция', callback_data: 'gi' }]];
  if (msgId) tgRichEdit_(chat, msgId, html, kb); else tgRich_(chat, html, kb);
}
function custAsk_(chat, no) {
  cachePut_('q:' + chat, no || '-', 900);
  tgSend_(chat, '✉️ <b>Сообщение менеджеру</b>\n<blockquote>Напишите вопрос одним сообщением, можно приложить фото.' + (no ? ' Номер заказа <code>' + hesc_(no) + '</code> я передам сам.' : '') + ' Ответ придёт в этот чат.</blockquote>');
}
/* ====================== мои заказы ======================
   Список: таблица действующих заказов и кнопка на каждый. Завершённые и отменённые убраны за одну кнопку с количеством.
   Шкала этапов: 🟢 пройден, 🟡 идёт сейчас, 🔴 ещё впереди. Карточка заказа: фото, дата, состав, оплата, путь заказа. */
var STAGE_NAME_ = {};
function stageName_(s) { return STAGE_NAME_[s] || s; }
function shortNo_(no) { return String(no).replace(/^OS-/, ''); }
function orderLine_(o) { return '№' + shortNo_(o.no) + ', ' + (o.status || 'Принят') + ', ' + rub_(o.toPay); }
function orderNo5_(no) { return String(no).replace(/^OS-\d+-/, ''); }
function orderSt_(o) { var s = String(o.status || 'Принят').trim(); return STATUS_OLD_[s] || s; }
function isActive_(o) { var st = orderSt_(o); return st !== 'Получен' && st !== 'Отменён'; }
function dateOf_(o) { return String(o.at || '').split(' ')[0]; }
function payWord_(o) { return isTrue_(o.paid) ? 'оплачено' : 'ждёт оплаты'; }
function lowerFirst_(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
function orderBtn_(o) { return pri_({ text: '№' + orderNo5_(o.no) + ' ' + stageName_(orderSt_(o)), callback_data: 'm|' + o.no }); }
/* Список заказов: обычная таблица Telegram. Новое сообщение отправляем, старое (delId) удаляем. */
function ordersSend_(chat, delId, title, head, rows, kb) {
  var html = '<h3>' + title + '</h3><table bordered><tr>' + head.map(function (h) { return '<th>' + hesc_(h) + '</th>'; }).join('') + '</tr>' +
    rows.map(function (rw) { return '<tr>' + rw.map(function (c) { return '<td>' + hesc_(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  var r = tgRich_(chat, html, kb);
  if (delId && r && r.ok !== false) tgApi_('deleteMessage', { chat_id: String(chat), message_id: delId });
}/* порядок: новые сверху. Завершённых и отменённых показываем по 10 последних, более старые из списка бота уходят (в таблице заказов они остаются) */
function atMs_(o) { var m = String(o.at || '').match(/(\d+)\.(\d+)\.(\d+)(?:\s+(\d+):(\d+))?/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : 0; }
function newestFirst_(list) { return list.map(function (o, i) { return { o: o, i: i, t: atMs_(o) }; }).sort(function (a, b) { return b.t - a.t || a.i - b.i; }).map(function (x) { return x.o; }); }
function activeOrders_(all) { return newestFirst_(all.filter(isActive_)); }
function pastOrders_(all) {
  var done = newestFirst_(all.filter(function (o) { return orderSt_(o) === 'Получен'; })).slice(0, 10), off = newestFirst_(all.filter(function (o) { return orderSt_(o) === 'Отменён'; })).slice(0, 10);
  return newestFirst_(done.concat(off));
}function custOrders_(chat, delId, page) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var all = DB.listOrders(u.id, 150), actAll = activeOrders_(all), past = pastOrders_(all).length;
  var per = 6, pages = Math.max(1, Math.ceil(actAll.length / per)); page = Math.max(0, Math.min(pages - 1, +page || 0));
  var act = actAll.slice(page * per, page * per + per);
  if (!all.length) { tgRich_(chat, '<h3>Мои заказы</h3><p>Заказов пока нет. Оформите первый на сайте, он сразу появится здесь, а статусы я буду присылать сам.</p>', [[pri_({ text: 'Открыть каталог', web_app: { url: siteUrl_('') } })]]); if (delId) tgApi_('deleteMessage', { chat_id: String(chat), message_id: delId }); return; }
  var kb = act.map(function (o) { return [orderBtn_(o)]; });
  if (pages > 1) { var nav = []; if (page > 0) nav.push({ text: '‹ Назад', callback_data: 'mo|' + (page - 1) }); nav.push({ text: (page + 1) + ' / ' + pages, callback_data: 'mo|' + page }); if (page < pages - 1) nav.push({ text: 'Вперёд ›', callback_data: 'mo|' + (page + 1) }); kb.push(nav); }
  if (past) kb.push([{ text: 'Завершённые и отменённые (' + past + ')', callback_data: 'mh|0' }]);
  if (!act.length) { tgRich_(chat, '<h3>Мои заказы</h3><p>Сейчас все заказы завершены.</p>', kb); if (delId) tgApi_('deleteMessage', { chat_id: String(chat), message_id: delId }); return; }
  ordersSend_(chat, delId, 'Мои заказы' + (pages > 1 ? ' (' + actAll.length + ')' : ''), ['Заказ', 'Статус', 'К оплате'], act.map(function (o) { return [shortNo_(o.no), stageName_(orderSt_(o)), rub_(o.toPay)]; }), kb);
}function custOrdersPast_(chat, delId, page) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var past = pastOrders_(DB.listOrders(u.id, 150)), per = 8, pages = Math.max(1, Math.ceil(past.length / per));
  page = Math.max(0, Math.min(pages - 1, +page || 0));
  var chunk = past.slice(page * per, page * per + per);
  var kb = [], row = [];
  chunk.forEach(function (o) { row.push(pri_({ text: '№' + orderNo5_(o.no), callback_data: 'm|' + o.no })); if (row.length === 4) { kb.push(row); row = []; } });
  if (row.length) kb.push(row);
  if (pages > 1) { var nav = []; if (page > 0) nav.push({ text: 'Новее', callback_data: 'mh|' + (page - 1) }); if (page < pages - 1) nav.push({ text: 'Старше', callback_data: 'mh|' + (page + 1) }); kb.push(nav); }
  kb.push([{ text: 'Актуальные заказы', callback_data: 'mo' }]);
  ordersSend_(chat, delId, 'Завершённые и отменённые' + (pages > 1 ? ' (' + (page + 1) + '/' + pages + ')' : ''), ['Заказ', 'Дата', 'Сумма', 'Статус'],
    chunk.map(function (o) { return [shortNo_(o.no), dateOf_(o), rub_(o.toPay), orderSt_(o) === 'Отменён' ? 'Отменён' : 'Получен']; }), kb);
}function orderPhotoUrls_(o) {
  var urls = [], seen = {};
  (o.items || []).forEach(function (it) { var id = it.photo || it.thumb; if (id && !seen[id]) { seen[id] = 1; urls.push(photoUrl_(id)); } });
  return urls.slice(0, 6);
}
/* состав: «· Название.» и с новой строки «Размер M, цвет белый» (материал только если он есть) */
function itemName_(it) { var s = String(it.title || '').trim(); if (!s) return ''; s = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?]$/.test(s) ? s : s + '.'; }
function itemOpt_(it) {
  var a = [];
  if (it.size) a.push('Размер ' + String(it.size).trim());
  if (it.color) a.push('цвет ' + lowerFirst_(String(it.color).trim()));
  if (it.material) a.push('материал ' + lowerFirst_(String(it.material).trim()));
  if ((it.qty || 1) > 1) a.push(it.qty + ' шт');
  return a.join(', ');
}
function cardItems_(o) { return (o.items || []).map(function (it) { return { n: itemName_(it), o: itemOpt_(it) }; }).filter(function (x) { return x.n; }); }
function orderPay_(o) { return rub_(o.toPay) + ' (' + payWord_(o) + ')'; }
/* шкала этапов: список строк */
function stageLines_(o) {
  var st = orderSt_(o); if (st === 'Отменён') return ['Заказ отменён'];
  var stages = OnionCore.stagesFor(o.kind), cur = Math.max(0, stages.indexOf(st)), done = st === 'Получен';
  return stages.map(function (s, i) { return (done || i < cur ? '🟢 ' : i === cur ? '🟡 ' : '🔴 ') + stageName_(s); });
}
/* текстовый вид карточки (подпись к фото, запасной вариант) */
function orderCardText_(o) {
  var its = cardItems_(o).map(function (x) { return '· ' + hesc_(x.n) + (x.o ? '\n' + hesc_(x.o) : ''); }).join('\n');
  return '<b>Заказ ' + hesc_(o.no) + '</b>\n' + hesc_(dateOf_(o)) + '\n\n' + (its ? '<b>Состав</b>\n' + its + '\n\n' : '') +
    '<b>К оплате</b>\n' + hesc_(orderPay_(o)) + '\n\n<b>Путь заказа</b>\n' + stageLines_(o).join('\n');
}
/* вид для Rich message: фото сверху (несколько фото: коллаж, по нажатию листаются), этапы отдельными строками */
function orderCardRich_(o, urls) {
  var media = urls.length > 1 ? '<tg-collage>' + urls.map(function (u) { return '<img src="' + u + '">'; }).join('') + '</tg-collage>' : urls.length ? '<img src="' + urls[0] + '">' : '';
  var its = cardItems_(o).map(function (x) { return '<p>· ' + hesc_(x.n) + (x.o ? '<br>' + hesc_(x.o) : '') + '</p>'; }).join('');
  return media + '<h3>Заказ ' + hesc_(o.no) + '</h3><p>' + hesc_(dateOf_(o)) + '</p>' + (its ? '<h4>Состав</h4>' + its : '') +
    '<h4>К оплате</h4><p>' + hesc_(orderPay_(o)) + '</p><h4>Путь заказа</h4>' + stageLines_(o).map(function (l) { return '<p>' + l + '</p>'; }).join('');
}function orderCardKb_(o, idx, n) {
  var kb = [[{ text: 'Вопрос по заказу', callback_data: 'q|' + o.no }, { text: 'Все заказы', callback_data: 'mo' }]];
  if (n > 1) kb.unshift([{ text: '‹', callback_data: 'pg|' + o.no + '|' + ((idx + n - 1) % n) }, { text: (idx + 1) + ' / ' + n, callback_data: 'pg|' + o.no + '|' + idx }, { text: '›', callback_data: 'pg|' + o.no + '|' + ((idx + 1) % n) }]);
  return kb;
}
function custOrderCard_(cq, no) {
  var chat = cq.message.chat.id, mid = cq.message.message_id, u = tgUserByChat_(chat); if (!u) { tgAnswer_(cq.id, 'Сначала подключите бота в кабинете'); return; }
  var o = DB.listOrders(u.id, 60).filter(function (x) { return String(x.no) === no; })[0];
  if (!o) { tgAnswer_(cq.id, 'Заказ не найден'); return; }
  tgAnswer_(cq.id, '');
  var urls = orderPhotoUrls_(o), kb = orderCardKb_(o, 0, urls.length), r = null;
  if (urls.length > 1) r = tgPhoto_(chat, urls[0], orderCardText_(o), kb); /* несколько товаров: фото листаются стрелками */
  else r = tgApi_('sendRichMessage', { chat_id: String(chat), rich_message: { html: orderCardRich_(o, urls), skip_entity_detection: true }, reply_markup: { inline_keyboard: kb } });
  if (!r || !r.ok) {
    console.warn('card rich -> photo: ' + (r && r.description));
    r = urls.length ? tgPhoto_(chat, urls[0], orderCardText_(o), kb) : tgSend_(chat, orderCardText_(o), kb);
  }
  if (r && r.ok) tgApi_('deleteMessage', { chat_id: String(chat), message_id: mid }); /* список или окно подтверждения заменяем карточкой */
}
/* листание фото в карточке заказа с несколькими товарами */
/* пробный заказ с тремя товарами: только для проверки листания фото, в таблицу не попадает */
var DEMO_NO_ = 'OS-26-99999';
function demoOrder_() {
  return { no: DEMO_NO_, at: '16.11.2026 12:00', status: 'Выкуплен', kind: 'предзаказ', toPay: 9840, paid: false, items: [
    { title: 'Пробный товар: утеплённая кофта', size: 'M', color: 'Белый', photo: '682' },
    { title: 'Пробный товар: джинсы прямого кроя', size: '32', color: 'Синий', photo: '610' },
    { title: 'Пробный товар: кроссовки беговые', size: '42', color: 'Чёрный', photo: '633' }] };
}
function demoMultiTo_(chat) { var o = demoOrder_(), urls = orderPhotoUrls_(o); return tgPhoto_(chat, urls[0], orderCardText_(o), orderCardKb_(o, 0, urls.length)); }
function botDemoMulti() { var a = props_().getProperty('ADMIN_CHAT_ID'); if (a) demoMultiTo_(a); }
function custOrderPage_(cq, no, idx) {
  var chat = cq.message.chat.id, u = tgUserByChat_(chat); if (!u) { tgAnswer_(cq.id, ''); return; }
  var o = no === DEMO_NO_ ? demoOrder_() : DB.listOrders(u.id, 60).filter(function (x) { return String(x.no) === no; })[0];
  if (!o) { tgAnswer_(cq.id, 'Заказ не найден'); return; }
  var urls = orderPhotoUrls_(o), n = urls.length; if (!n) { tgAnswer_(cq.id, ''); return; }
  idx = Math.max(0, Math.min(n - 1, +idx || 0)); tgAnswer_(cq.id, '');
  tgApi_('editMessageMedia', { chat_id: String(chat), message_id: cq.message.message_id, media: { type: 'photo', media: urls[idx], caption: orderCardText_(o).slice(0, 1000), parse_mode: 'HTML' }, reply_markup: { inline_keyboard: orderCardKb_(o, idx, n) } });
}
function custBonus_(chat) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var R = OnionCore.RULES, L = OnionCore.levelOf(u), next = R.levels[L.index + 1], bal = u.balance || 0, xp = u.xp || 0;
  var html = '<h3>💎 Ваши бонусы</h3><table bordered compact>' +
    '<tr><td>Ониксы</td><td><b>' + num_(bal) + '</b></td><td>до ' + rub_(Math.floor(bal * R.tokenRub)) + ' скидки</td></tr>' +
    '<tr><td>Уровень</td><td><b>' + hesc_(L.name) + '</b></td><td>' + num_(xp) + ' XP за месяц</td></tr>' +
    (next ? '<tr><td>Следующий</td><td><b>' + hesc_(next.name) + '</b></td><td>ещё ' + num_(Math.max(0, next.min - xp)) + ' XP</td></tr>' : '') + '</table>';
  var pr = []; try { pr = OnionCore.activePromos(DB, u) || []; } catch (e) { pr = []; }
  if (pr.length) html += '<h4>ваши промокоды</h4><table bordered compact>' + pr.slice(0, 8).map(function (p) {
    return '<tr><td><code>' + hesc_(p.code) + '</code></td><td>−' + String(p.pct).replace('.', ',') + '%</td><td>' + (p.cat ? 'только «' + hesc_(p.catLabel) + '»' : 'на весь заказ') + '</td></tr>';
  }).join('') + '</table><p><i>Нажмите на код, чтобы скопировать, и вставьте его при оформлении заказа.</i></p>';
  html += '<p>Ониксы и промокод вместе покрывают до ' + Math.round(R.maxShare * 100) + '% заказа. 1 оникс = ' + String(R.tokenRub).replace('.', ',') + ' ₽.</p>';
  html += '<details><summary>как получить больше ониксов</summary><ul><li>ежедневный вход на сайте и задания уровня</li><li>отзыв о заказе: до +' + R.reward.reviewText + '</li><li>друг по вашей ссылке: +' + R.reward.referrer + ' после его первого заказа от ' + rub_(R.refMinOrder) + '</li><li>посылка с сюрпризом на сайте</li></ul></details>';
  html += '<details><summary>уровни</summary><table bordered compact><tr><th>уровень</th><th>опыт за месяц</th></tr>' +
    R.levels.map(function (l, i) { return '<tr><td>' + (i === L.index ? '<b>' + hesc_(l.name) + '</b>' : hesc_(l.name)) + '</td><td>от ' + num_(l.min) + ' XP</td></tr>'; }).join('') +
    '</table><p>Чем выше уровень, тем больше заданий, промокоды и приоритет заказа. 1-го числа опыт обнуляется.</p></details>';
  var kb = [];
  if (u.refCode) {
    var link = siteUrl_('ref=' + u.refCode);
    html += '<footer>Пригласите друга: ему +' + R.reward.refFriend + ' ониксов при регистрации, вам +' + R.reward.referrer + ', когда он получит первый заказ.</footer>';
    kb.push([pri_({ text: '📤 Пригласить друга', url: 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Загляни в ONION SHOP: по моей ссылке +' + R.reward.refFriend + ' ониксов при регистрации') })]);
  }
  kb.push([btnUrl_('💠 Задания и посылка', 'roulette')]);
  tgRich_(chat, html, kb);
}
/* уведомления включены всегда и отключить их нельзя: экран только объясняет, что приходит */
function custSettings_(chat, msgId) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var html = '<h3>📲 Уведомления</h3><p>Пока бот подключён, всё приходит само:</p><table bordered compact>' +
    '<tr><td>🧾</td><td>статусы заказов и напоминания об оплате</td></tr><tr><td>📸</td><td>фотоотчёты со склада</td></tr>' +
    '<tr><td>🔹</td><td>вещь из списка ожидания снова в продаже</td></tr><tr><td>📉</td><td>вещь из избранного подешевела</td></tr>' +
    '<tr><td>💎</td><td>бонусы, ониксы и подарки</td></tr></table>';
  var kb = [[pri_({ text: '🧾 Мои заказы', callback_data: 'mo' })]];
  if (msgId) tgRichEdit_(chat, msgId, html, kb); else tgRich_(chat, html, kb);
}

/* ====================== инструкция: 8 уроков с анимацией ======================
   Оглавление (rich) и урок: анимация assets/bot/guide-N.mp4 с подписью. Кнопки «назад/далее» меняют анимацию
   и подпись в том же сообщении (editMessageMedia), чат не засоряется. Пока анимация не выложена, урок уходит текстом. */
var GUIDE_VER_ = '1';
var GUIDE_ = [
  ['Начало работы', 'меню и разделы',
    '1. Нажмите «Старт» или отправьте /start.\n2. Внизу появится меню: Каталог, Мои заказы, Бонусы, Инструкция, Вопросы и связь с менеджером.\n3. Если меню скрылось, нажмите значок с квадратиками справа от поля ввода.',
    'Подключите уведомления в кабинете на сайте, и статусы заказов начнут приходить сами.'],
  ['Каталог', 'новинки, наличие, предзаказ',
    '1. Нажмите «💠 Каталог» в меню.\n2. Выберите раздел: Новинки, Скидки, В наличии или Предзаказ.\n3. Каталог откроется на сайте: листайте карточки и переключайте категории сверху.',
    'Вещи «в наличии» уже в Москве, предзаказ приезжает за 24-47 дней.'],
  ['Карточка товара', 'фото, размеры, наличие',
    '1. Нажмите на карточку, чтобы открыть товар.\n2. Листайте фото свайпом, нажмите на фото для увеличения.\n3. Выберите цвет и размер.\n4. Под ценой видно, в наличии вещь или под заказ.\n5. Замеры изделия, если они есть, ниже в карточке.',
    'Нет нужного размера? Нажмите «Жду появления», бот напишет, когда вещь вернётся.'],
  ['Оформление заказа', 'корзина и подтверждение',
    '1. В карточке нажмите «В корзину».\n2. Откройте корзину и перейдите к оформлению.\n3. Контакты подставятся из кабинета, выберите способ получения.\n4. По желанию спишите ониксы или введите промокод.\n5. Подтвердите заказ: в бот придёт «Заказ принят».\n6. Менеджер пришлёт реквизиты, после оплаты вещь закреплена за вами.',
    'Пока заказ в статусе «Принят», его можно отменить в «Мои заказы».'],
  ['Доставка и оплата', 'способы и сроки',
    '1. Нажмите «💬 Вопросы» в меню.\n2. Раскройте пункты «доставка и получение» и «оплата».\n\n<b>В наличии:</b> Авито Доставка, курьер по Москве или самовывоз.\n<b>Предзаказ:</b> СДЭК, Авито Доставка или встреча в Москве.\n<b>Оплата:</b> перевод или наличные при встрече.',
    'Трек-номер посылки менеджер пришлёт в этот чат.'],
  ['Промокоды и скидки', 'ониксы и коды',
    '1. Нажмите «💎 Бонусы»: там баланс ониксов и ваши промокоды.\n2. Нажмите на код, он скопируется.\n3. При оформлении заказа вставьте код в поле промокода и включите списание ониксов.',
    'Ониксы и промокод вместе покрывают до 12% заказа.'],
  ['Поддержка', 'связь с менеджером',
    '1. Нажмите «✉️ Написать менеджеру» или «Вопрос по заказу» в карточке заказа.\n2. Напишите вопрос одним сообщением, можно с фото.\n3. Ответ менеджера придёт в этот же чат.',
    'Менеджер магазина: @OnionShop_Support.'],
  ['Дополнительные возможности', 'всё остальное',
    '▫️ Отмена заказа, пока он в статусе «Принят».\n▫️ Фотоотчёт со склада по предзаказу.\n▫️ Сообщение, когда вещь из избранного подешевела или снова в продаже.\n▫️ Ониксы за друзей: ссылка-приглашение в «Бонусах».\n▫️ Уровни, задания и посылка с сюрпризом на сайте.',
    'Все уведомления приходят автоматически, пока бот подключён.']
];
function guideUrl_(i) { return siteBase_() + 'assets/bot/guide-' + (i + 1) + '.mp4?v=' + GUIDE_VER_; }
function guideCaption_(i) {
  var g = GUIDE_[i];
  return '📘 <b>' + g[0] + '</b>   ' + (i + 1) + '/' + GUIDE_.length + '\n\n<blockquote>' + g[2] + '</blockquote>\n<i>' + g[3] + '</i>';
}
function guideKb_(i) {
  var row = [];
  if (i > 0) row.push({ text: '← Назад', callback_data: 'gd|' + (i - 1) });
  row.push(i < GUIDE_.length - 1 ? pri_({ text: 'Далее →', callback_data: 'gd|' + (i + 1) }) : pri_(btnUrl_('💠 Открыть каталог', '')));
  return [row, [{ text: '📘 Все уроки', callback_data: 'gi' }]];
}
function guideIndex_(chat, msgId) {
  var html = '<h3>📘 Инструкция</h3><p>Восемь коротких уроков с анимацией: что нажимать и в каком порядке. Смотрите по порядку или сразу нужный.</p><table bordered compact>' +
    GUIDE_.map(function (g, i) { return '<tr><td><b>' + (i + 1) + '</b></td><td><b>' + g[0] + '</b></td><td>' + g[1] + '</td></tr>'; }).join('') +
    '</table><footer>Остались вопросы? Напишите менеджеру, ответ придёт в этот чат.</footer>';
  var kb = [[pri_({ text: '▶ Смотреть по порядку', callback_data: 'gd|0' })]];
  for (var i = 0; i < GUIDE_.length; i += 2) kb.push(GUIDE_.slice(i, i + 2).map(function (g, j) { return { text: (i + j + 1) + '. ' + g[0], callback_data: 'gd|' + (i + j) }; }));
  if (msgId) tgRichEdit_(chat, msgId, html, kb); else tgRich_(chat, html, kb);
}
function guideStep_(chat, msgId, i) {
  i = Math.max(0, Math.min(GUIDE_.length - 1, +i || 0));
  var fk = 'FID_guide' + i + '_' + GUIDE_VER_, fid = props_().getProperty(fk), cap = guideCaption_(i), kb = { inline_keyboard: guideKb_(i) };
  var keep = function (r) { var a = r && r.ok && r.result && (r.result.animation || r.result.document); if (a && a.file_id && !fid) props_().setProperty(fk, a.file_id); return r; };
  var r;
  if (msgId) {
    var edit = function (media) { return tgApi_('editMessageMedia', { chat_id: String(chat), message_id: msgId, media: { type: 'animation', media: media, caption: cap, parse_mode: 'HTML' }, reply_markup: kb }); };
    r = edit(fid || guideUrl_(i));
    if ((!r || !r.ok) && fid) { props_().deleteProperty(fk); fid = null; r = edit(guideUrl_(i)); }
    if (r && r.ok) return keep(r);
  }
  var send = function (media) { return tgApi_('sendAnimation', { chat_id: String(chat), animation: media, caption: cap, parse_mode: 'HTML', reply_markup: kb }); };
  r = send(fid || guideUrl_(i));
  if ((!r || !r.ok) && fid) { props_().deleteProperty(fk); fid = null; r = send(guideUrl_(i)); }
  if (r && r.ok) return keep(r);
  return tgSend_(chat, cap, kb.inline_keyboard);
}
function custCallback_(cq, a) {
  var chat = cq.message.chat.id, mid = cq.message.message_id, head = msgHead_(cq.message);
  /* экран правим на месте, только если кнопку нажали в нём самом; из приветствия или уведомления шлём новый */
  var here = function (re) { return re.test(head) ? mid : null; };
  if (a[0] === 'm') { custOrderCard_(cq, a[1]); return true; }
  if (a[0] === 'pg') { custOrderPage_(cq, a[1], a[2]); return true; }
  if (a[0] === 'mo') { tgAnswer_(cq.id, ''); custOrders_(chat, mid, a[1]); return true; }
  if (a[0] === 'mh') { tgAnswer_(cq.id, ''); custOrdersPast_(chat, mid, a[1]); return true; }
  if (a[0] === 'gi') { tgAnswer_(cq.id, ''); guideIndex_(chat, here(/Инструкция$/)); return true; }
  if (a[0] === 'gd') { tgAnswer_(cq.id, ''); guideStep_(chat, cq.message.animation || cq.message.document || /Инструкция$/.test(head) ? mid : null, a[1]); return true; }
  /* отмена заказа из бота: тот же код и та же проверка статуса, что на сайте (OnionCore.cancelFor).
     cx: спрашиваем подтверждение, cy: отменяем. Старое сообщение с кнопкой ничего не обойдёт: статус проверяется заново. */
  if (a[0] === 'cx' || a[0] === 'cy') {
    var cu = tgUserByChat_(chat); if (!cu) { tgAnswer_(cq.id, 'Сначала подключите бота в кабинете'); return true; }
    var cno = String(a[1] || '').trim().toUpperCase();
    var co = DB.listOrders(cu.id, 50).filter(function (x) { return String(x.no) === cno; })[0];
    if (!co) { tgAnswer_(cq.id, 'Заказ не найден'); return true; }
    if (a[0] === 'cx') {
      if (String(co.status || 'Принят').trim() !== 'Принят') { tgAnswer_(cq.id, co.status === 'Отменён' ? 'Этот заказ уже отменён' : co.status === 'Получен' ? 'Заказ уже получен, отменить его нельзя' : 'Заказ уже в работе, отмена недоступна'); custOrderCard_(cq, cno); return true; }
      tgAnswer_(cq.id, '');
      tgRichEdit_(chat, mid, '<h3>Заказ ' + hesc_(cno) + ': отменить?</h3><p>Заказ отменится сразу, вернуть его потом не получится. Ониксы, если вы ими платили, вернутся на баланс.</p>', [[dng_({ text: 'Да, отменить', callback_data: 'cy|' + cno })], [pri_({ text: 'Оставить заказ', callback_data: 'm|' + cno })]]);
      return true;
    }
    var cr = OnionCore.cancelFor(DB, cu, cno, 'bot');
    if (cr.ok) {
      tgAnswer_(cq.id, 'Заказ отменён');
      tgRichEdit_(chat, mid, '<h3>Заказ ' + hesc_(cno) + ' отменён</h3><p>Ониксы, если вы ими платили, уже на балансе. Передумаете, оформите заказ заново на сайте.</p>', [[pri_(btnUrl_('💠 Открыть каталог', ''))], [{ text: '← Все заказы', callback_data: 'mo' }]]);
    } else if (cr.status !== undefined) {
      tgAnswer_(cq.id, cr.error);
      custOrderCard_(cq, cno);
    } else tgAnswer_(cq.id, cr.error || 'Не получилось отменить, попробуйте ещё раз');
    return true;
  }
  if (a[0] === 'q') { tgAnswer_(cq.id, ''); custAsk_(chat, a[1] || ''); return true; }
  if (a[0] === 'bn') { tgAnswer_(cq.id, ''); custBonus_(chat); return true; }
  if (a[0] === 'ns') { tgAnswer_(cq.id, ''); custSettings_(chat); return true; }
  if (a[0] === 'fq') { tgAnswer_(cq.id, ''); custFaq_(chat, here(/Частые вопросы/), a[1] || ''); return true; }
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
  if (!admin) { tgSend_(chat, '✉️ <b>Напишите менеджеру напрямую</b>\nТак ответ придёт быстрее.', [[pri_({ text: '✉️ @OnionShop_Support', url: SUPPORT_URL_ })]]); return; }
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
  if (n === 0) { sticker_(chat, 'support'); tgSend_(chat, pick_(V_.asked)); } // подтверждаем один раз, а не на каждое сообщение подряд
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
    '👤 <b>Клиенты:</b> отправьте логин, ID, @telegram или телефон. В карточке: ониксы, написать, удалить, личный промокод (или /gift КЛИЕНТ 10 30: скидка и дни).\n' +
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
  var act = ordersAll_().filter(function (o) { return !isDone_(String(o.status || 'Принят')); }), stages = openStages_();
  var list = f === 'u' ? act.filter(function (o) { return !isTrue_(o.paid); }) : f === 's' ? act.filter(function (o) { return String(o.status || 'Принят') === stages[+idx]; }) : act;
  list = list.slice().reverse();
  var title = f === 'u' ? 'Неоплаченные' : f === 's' ? 'Статус «' + stages[+idx] + '»' : 'Активные заказы';
  var text = '📦 <b>' + title + ': ' + list.length + '</b>' + (list.length > 12 ? '\nПоказаны 12 последних' : '') + (list.length ? '' : '\nПусто 🎉');
  var kb = list.slice(0, 12).map(function (o) { return [{ text: (isTrue_(o.paid) ? '💰 ' : '') + orderLine_(o), callback_data: 'o|' + o.no }]; });
  var fr = [], cnt = function (s) { return act.filter(function (o) { return String(o.status || 'Принят') === s; }).length; };
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
  var o = f.o, st = String(o.status || 'Принят'), cu = o.userId ? DB.getUser(normId_(o.userId)) : null;
  var text = '🧾 <b>Заказ ' + hesc_(o.no) + '</b>\nСтатус: <b>' + hesc_(st) + '</b>' + (isTrue_(o.paid) ? ', 💰 оплачен' : ', не оплачен') +
    '\n\n' + hesc_(String(o.itemsText || '').slice(0, 900)) + '\n\n💰 К оплате: <b>' + rub_(money_(o.toPay)) + '</b> (' + hesc_(o.kind) + ')' +
    '\n👤 ' + hesc_(o.name) + ', ' + hesc_(o.phone) + (o.tg ? ', ' + hesc_(o.tg) : '') + (cu ? (cu.tgChat ? ', 📲 бот подключён' : ', без бота') : '') +
    (o.pack ? '\n🎁 ' + hesc_(o.pack) : '') + (o.note ? '\n📝 ' + hesc_(o.note) : '');
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
  var act = all.filter(function (o) { return !isDone_(String(o.status || 'Принят')); });
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
  var old = ordersAll_().filter(function (o) { return !isDone_(String(o.status || 'Принят')) && !isTrue_(o.paid) && o.at instanceof Date && Date.now() - o.at.getTime() > 86400000; });
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
  var r2 = []; if (u.tgChat) r2.push({ text: '✉️ Написать', callback_data: 'rp|' + u.tgChat }); r2.push({ text: '🗑 Удалить', callback_data: 'd|' + u.id }); kb.push(r2); kb.push([{ text: '🎁 Промокод −5%', callback_data: 'gp|' + u.id + '|5' }, { text: '🎁 −10%', callback_data: 'gp|' + u.id + '|10' }, { text: '🎁 −15%', callback_data: 'gp|' + u.id + '|15' }]);
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function removeClient_(u) {
  var wr = DB.waitRows_().filter(function (w) { return w.userId === u.id; }).map(function (w) { return w._row; }).sort(function (x, y) { return y - x; });
  var ws = ss_().getSheetByName(SHEET.waits); if (ws) wr.forEach(function (rw) { ws.deleteRow(rw); });
  DB.deleteSessionsOf(u.id);
  DB.log({ at: Date.now(), userId: u.id, login: u.login, delta: -(u.balance || 0), reason: 'Клиент удалён менеджером (Telegram)', balance: 0 });
  DB.deleteUser(u); USERS_CACHE_ = null;
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
function broadcastTargets_(mode) {
  var act = {};
  if (mode === 'a') ordersAll_().forEach(function (o) { if (!isDone_(String(o.status || 'Принят'))) act[normId_(o.userId)] = 1; });
  return users_().filter(function (u) { return u.tgChat && (mode !== 'a' || act[u.id]); });
}
function askBroadcast_(chat, text, photo) { bcPreview_(chat, { t: 'custom', text: text || '', photo: photo || '' }); }
/* ответ менеджера покупателю */
function replyToClient_(admin, chat, m) {
  var u = tgUserByChat_(chat), r;
  if (m.text) r = tgSend_(chat, '✉️ <b>Ответ менеджера</b>\n<blockquote>' + hesc_(m.text) + '</blockquote>\n<i>Ответить можно прямо здесь.</i>');
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
  if (['m', 'pg', 'mo', 'mh', 'q', 'ns', 'fq', 'ph', 'gi', 'gd'].indexOf(a[0]) >= 0 || (a[0] === 'bn' && a.length === 1)) { custCallback_(cq, a); return; }
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
  if (a[0] === 'gp') {
    var gu = DB.getUser(a[1]); if (!gu) { tgAnswer_(cq.id, 'Клиент не найден'); return; }
    var gr = giftPromo_(gu, parseFloat(a[2]) || 5, 30, ''); tgAnswer_(cq.id, gr ? 'Выдан ' + gr.code : 'Не получилось'); if (gr) tgSend_(chat, '🎁 Промокод <code>' + gr.code + '</code> на −' + (parseFloat(a[2]) || 5) + '% выдан @' + hesc_(gu.login) + ' на 30 дней.'); return;
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
  if ((mm = text.match(/^\/gift\s+(\S+)\s+(\d+(?:[.,]\d+)?)(?:\s+(\d+))?\s*$/i))) { var gu2 = findClient_(mm[1]); if (!gu2) { tgSend_(chat, 'Клиент не найден.'); return; } var gp2 = parseFloat(mm[2].replace(',', '.')); if (!(gp2 >= 1 && gp2 <= 50)) { tgSend_(chat, 'Скидка от 1 до 50 процентов.'); return; } var gr2 = giftPromo_(gu2, gp2, Math.min(365, parseInt(mm[3], 10) || 30), ''); tgSend_(chat, gr2 ? '🎁 Промокод <code>' + gr2.code + '</code> на −' + gp2 + '% выдан @' + hesc_(gu2.login) + '.' : 'Не получилось.'); return; }
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

/* обработка уже полученных сообщений; позицию очереди Telegram ведёт только tgPollOnce_ (здесь её не трогаем) */
function tgHandle_(updates) {
  updates.forEach(function (up) {
    try {
      if (up.callback_query) { adminCallback_(up.callback_query); return; }
      var m = up.message; if (!m || !m.chat || m.chat.type !== 'private') return;
      var text = String(m.text || '').trim(), who = m.chat.username ? '@' + m.chat.username : (m.chat.first_name || ''), c = m.chat.id;
      if (/^\/start\s+T\d{12}/.test(text)) {
        var r = OnionCore.tgBind(DB, text, c, who);
        if (r && r.ok) { if (r.user && r.user.phoneOk === false) askPhone_(c); else sendWelcome_(m, true); }
        else tgSend_(c, '📲 <b>Ссылка устарела</b>\n<blockquote>Откройте на сайте кабинет, раздел «Уведомления в Telegram», и нажмите «Подключить» ещё раз.</blockquote>', [[pri_(btnUrl_('Открыть кабинет', 'account'))]]);
        return;
      }
      if (m.contact) { phoneContact_(m); return; }
      if (claimAdmin_(m)) return;
      if (isAdmin_(c)) { adminText_(m, text); return; }
      var old = OLD_BTN_[text];
      if (/^\/start/.test(text)) sendWelcome_(m, !!tgUserByChat_(c));
      else if (text === BTN_.ord || old === 'ord' || /^\/orders/.test(text)) custOrders_(c);
      else if (/^\/demomulti/.test(text)) demoMultiTo_(c); /* пробный заказ с тремя фото, временная команда */
      else if (text === BTN_.bon || old === 'bon' || /^\/bonus/.test(text)) custBonus_(c);
      else if (text === BTN_.cat || old === 'cat' || /^\/catalog/.test(text)) custCatalog_(c);
      else if (text === BTN_.guide || /^\/(guide|help)/.test(text)) guideIndex_(c);
      else if (text === BTN_.faq || old === 'faq' || /^\/(faq|terms|info)/.test(text)) custFaq_(c, null, '');
      else if (old === 'set' || /^\/settings/.test(text)) custSettings_(c);
      else if (text === BTN_.sup || old === 'sup' || /^\/(support|ask)/.test(text)) custAsk_(c, '');
      else if (/^\/menu/.test(text)) { var s = sticker_(c, 'hello', custKb_()); if (!s || !s.ok) tgSend_(c, pick_(V_.welcomeBack), custKb_()); }
      else if (/^\//.test(text)) tgSend_(c, 'Такой команды нет, но меню всегда внизу 👇', custKb_());
      else relayToManager_(m);
    } catch (e) { console.error('tg', e && e.stack || e); }
  });
}

/* подтверждение телефона: кнопка Telegram «Поделиться номером» (Telegram сам подтверждает, что номер владельца) */
function askPhone_(chat) {
  tgSend_(chat, '📱 <b>Последний шаг: подтвердите телефон</b>\n<blockquote>Нажмите кнопку внизу «Поделиться номером». Telegram передаст только ваш номер, так мы защищаем бонусы от накруток.</blockquote>\nПосле этого начислим приветственные ониксы, а ещё откроются бонусы за друзей и подарок на день рождения.',
    { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true, style: 'primary' }]], resize_keyboard: true, one_time_keyboard: true });
}
function phoneContact_(m) {
  var c = m.chat.id, u = tgUserByChat_(c);
  if (!u) { tgSend_(c, 'Сначала откройте на сайте кабинет и нажмите «Подтвердить телефон»: бот привяжется к вашему аккаунту.', custKb_()); return; }
  var r = OnionCore.phoneConfirm(DB, u, m.contact, m.from && m.from.id);
  if (!r.ok) { tgSend_(c, '⚠️ ' + hesc_(r.msg), custKb_()); return; }
  if (r.got) sticker_(c, 'bonus');
  tgSend_(c, '☑️ <b>Телефон подтверждён</b>' + (r.changed ? '\nВ кабинете теперь номер из Telegram.' : '') + (r.got ? '\n💎 На баланс начислено <b>' + r.got + '</b> ониксов.' : '') + '\nБонусы магазина теперь доступны.', custKb_());
}

/* список команд в меню «/» и описание бота («Что умеет этот бот?»): покупателям свои, менеджеру (только его чат) расширенный.
   Картинку или анимацию над описанием Telegram позволяет поставить только вручную в @BotFather (/setdescriptionpic). */
var BOT_DESCRIPTION_ = 'ONION SHOP\nВаш личный помощник в покупках.\n\nСообщу, когда заказ тронется в путь, а любимая вещь подешевеет. Первым расскажу о новинках и подарю бонусы. А если что-то неясно, просто напишите, я на связи.\n\nНажмите «Старт», и начнём.';
var BOT_SHORT_ = 'Ваш личный помощник в покупках. Следит за заказами, ценами и новинками.';
function setBotCommands_() {
  tgApi_('setMyCommands', { commands: [{ command: 'menu', description: 'Меню' }, { command: 'catalog', description: 'Каталог на сайте' }, { command: 'orders', description: 'Мои заказы и статусы' }, { command: 'bonus', description: 'Ониксы, уровень, промокоды' }, { command: 'guide', description: 'Инструкция с анимацией' }, { command: 'faq', description: 'Частые вопросы' }, { command: 'ask', description: 'Написать менеджеру' }] });
  tgApi_('setMyDescription', { description: BOT_DESCRIPTION_ });
  tgApi_('setMyShortDescription', { short_description: BOT_SHORT_ });
  var a = props_().getProperty('ADMIN_CHAT_ID');
  if (a) tgApi_('setMyCommands', { scope: { type: 'chat', chat_id: Number(a) }, commands: [{ command: 'menu', description: 'Панель менеджера' }, { command: 'orders', description: 'Активные заказы' }, { command: 'stats', description: 'Сводка' }, { command: 'promos', description: 'Промокоды' }, { command: 'promo', description: '/promo КОД 10: новый промокод' }, { command: 'reviews', description: 'Фото из отзывов на проверке' }, { command: 'client', description: '/client логин: карточка клиента' }, { command: 'tokens', description: '/tokens логин +50 причина' }, { command: 'delete', description: '/delete логин: удалить клиента' }, { command: 'broadcast', description: '/broadcast текст: рассылка' }, { command: 'cancel', description: 'Отменить ввод' }, { command: 'help', description: 'Как работать с ботом' }] });
}

/* ====================== голос бота, посты для рассылок ======================
   Тексты живые, варианты подбираются случайно, чтобы сообщения не повторялись. */
function pick_(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickAt_(a, i) { return a[(i || 0) % a.length]; }
function fill_(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] !== undefined ? o[k] : m; }); }
var V_ = {
  fresh1: ['🆕 Новая вещь в каталоге', '🆕 Пополнение коллекции', '🆕 Свежее поступление, таких обычно немного', '🆕 Выложили новую вещь'],
  freshN: ['Пополнение: {n} новых вещей', 'В каталоге {n} новинок', 'Выложили {n} новых вещей'],
  sale: ['📉 Цены снижены, пока действует', '📉 Скидки до {pct}%', '📉 Подборка со скидкой', '📉 Хорошая цена, долго не продержится'],
  feat: ['Новое у нас: {f}. Загляните, должно стать удобнее', 'Добавили {f}, попробуйте', 'Теперь на сайте есть {f}'],
  drop: ['📉 Вещь из избранного подешевела', '📉 Цена в избранном снизилась', '📉 Из избранного стало дешевле'],
  restock: ['🔹 Снова в продаже', '🔹 Вы ждали, и вот она', '🔹 Вернулась в каталог'],
  winback: ['🤍 Давно не виделись', '🤍 Загляните, у нас много нового', '🤍 Пока вас не было, коллекция обновилась'],
  welcomeBack: ['Меню внизу 👇', 'Чем помочь? Меню внизу 👇'],
  asked: ['☑️ Передал менеджеру, ответ придёт сюда же.', '☑️ Принял, менеджер уже видит ваше сообщение. Ответ придёт в этот чат.', '☑️ Отправил менеджеру. Как только он ответит, сообщение появится здесь.']
};
function IMG_(n) { return siteBase_() + 'assets/bot/' + n + '.jpg'; }
function photoUrl_(id) { return siteBase_() + 'img/full/' + id + '.jpg'; }
function prodPhoto_(c) { return c && c.photos && c.photos.length ? photoUrl_(c.photos[0].id) : ''; }
function detailOf_(c, key) { var d = (c.details || []).filter(function (x) { return String(x[0]).toLowerCase() === key; })[0]; return d ? d[1] : ''; }
function cap1_(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
/* подпись к товару для ручной рассылки: название, цена, цвета, размеры, по строкам */
function postCaption_(c) {
  var st = detailOf_(c, 'состояние'), L = ['<b>' + hesc_(c.title) + '</b>'];
  L.push((c.oldPrice > c.price ? '<s>' + rub_(c.oldPrice) + '</s>  ' : '') + '<b>' + rub_(c.price) + '</b>');
  var D = [];
  if (st) D.push('▫️ Состояние: ' + hesc_(st));
  if (c.colors && c.colors.length) D.push('▫️ Цвет: ' + hesc_(c.colors.join(', ')));
  if (c.sizes && c.sizes.length) D.push('▫️ Размеры: ' + hesc_(c.sizes.join(', ')));
  D.push(c.status === 'preorder' ? '✈️ Предзаказ, доставка уже в цене' : '🏙 В наличии в Москве');
  L.push('<blockquote>' + D.join('\n') + '</blockquote>');
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
  if (kb && kb[0] && kb[0][0] && !kb[0][0].style) kb[0][0].style = 'primary';
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
  if (fresh.length === 1) { var c = cat[fresh[0]]; return { title: pick_(V_.fresh1), body: hesc_(c.title) + ', <b>' + rub_(c.price) + '</b>' + (c.status === 'preorder' ? '\n✈️ Предзаказ, доставка уже в цене' : '\n🏙 В наличии в Москве'), btn: btnUrl_('Посмотреть', 'p-' + c.id) }; }
  var L = fresh.slice(0, 3).map(function (id) { return cat[id]; });
  return { title: '🆕 ' + fill_(pick_(V_.freshN), { n: fresh.length }), body: L.map(function (c) { return hesc_(c.title) + ', ' + rub_(c.price); }).join('\n') + (fresh.length > 3 ? '\nи ещё ' + (fresh.length - 3) + ' в каталоге' : ''), btn: btnUrl_('Смотреть новинки', 'catalog') };
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
    out.text = '<b>🆕 ' + fill_(pickAt_(V_.freshN, iv), { n: L.length }) + '</b>\n\n' + L.map(function (c) { return '🔹 ' + hesc_(c.title) + ', <b>' + rub_(c.price) + '</b>'; }).join('\n');
    out.photo = prodPhoto_(L[0]); out.kb = [[btnUrl_('Смотреть новинки', 'catalog')]];
    return out;
  }
  if (d.t === 'sale') {
    var S = saleList_(3); if (!S.length) return null;
    out.text = '<b>' + fill_(pickAt_(V_.sale, iv), { pct: Math.max(5, Math.floor(S[0].d / 5) * 5) }) + '</b>\n\n' + S.map(function (x) { return '🔹 ' + hesc_(x.c.title) + '\n<s>' + rub_(x.c.oldPrice) + '</s> <b>' + rub_(x.c.price) + '</b>, −' + x.d + '%'; }).join('\n');
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
  sendWelcomeTo_(chat, 'Миша', true, null);
  custCatalog_(chat);
  custFaq_(chat, null, 'pre');
  guideIndex_(chat);
  guideStep_(chat, null, 0);
  sticker_(chat, 'accepted');
  tgSend_(chat, statusText_('OS-26-00001', 'Принят'), statusKb_('OS-26-00001', 'Принят'));
  tgSend_(chat, statusText_('OS-26-00001', 'Едет в Россию'), statusKb_('OS-26-00001', 'Едет в Россию'));
  tgSend_(chat, payText_('OS-26-00001', 26564), [[pri_(btnOrder_('OS-26-00001'))]]);
  sticker_(chat, 'delivered');
  tgSend_(chat, statusText_('OS-26-00001', 'Получен'), statusKb_('OS-26-00001', 'Получен'));
  var cat = DB.loadCatalog_() || {}, L = freshList_(3, cat);
  if (L.length) { var a = autoFresh_(L.map(function (c) { return c.id; }), cat); tgSend_(chat, '<b>' + a.title + '</b>\n' + a.body, [[pri_(a.btn)]]); }
  var s = autoSale_(); if (s) tgSend_(chat, '<b>' + s.title + '</b>\n' + s.body, [[pri_(s.btn)]]);
  if (L.length) tgSend_(chat, '<b>' + pick_(V_.drop) + '</b>\n' + hesc_(L[0].title) + ': <b>' + rub_(L[0].price) + '</b> вместо <s>' + rub_(L[0].price + 500) + '</s>', [[pri_(btnUrl_('Посмотреть', 'p-' + L[0].id))]]);
}
function botDemo() { var a = props_().getProperty('ADMIN_CHAT_ID'); if (a) botDemo_(a); else Logger.log('Менеджер ещё не привязан: напишите боту /start с аккаунта @' + adminUser_()); }