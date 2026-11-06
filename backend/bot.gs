/* ====================== Telegram-бот: меню покупателя и панель менеджера ======================
   Менеджер: только аккаунт @OnionShop_Support (свойство ADMIN_USERNAME). Все остальные: покупатели:
   им доступны только их заказы, бонусы, настройки и переписка с менеджером через бота. */
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
function termsUrl_() { return props_().getProperty('TERMS_URL') || 'https://onion-shop.github.io/ONION-SHOP/#how'; }
var SUPPORT_URL_ = 'https://t.me/OnionShop_Support';
var BTN_ = { cat: '🛍 Каталог', ord: '📦 Мои заказы', bon: '🎁 Бонусы', terms: 'ℹ️ Условия и сроки', sup: '💬 Задать вопрос', set: '⚙️ Настройки',
  aOrd: '📦 Заказы', aSum: '📊 Сводка', aCli: '👤 Клиент', aBc: '📣 Рассылка', aHelp: '❓ Подсказка' };
function custKb_() { return { keyboard: [[{ text: BTN_.cat }, { text: BTN_.ord }], [{ text: BTN_.bon }, { text: BTN_.terms }], [{ text: BTN_.sup }, { text: BTN_.set }]], resize_keyboard: true, is_persistent: true }; }
function adminKb_() { return { keyboard: [[{ text: BTN_.aOrd }, { text: BTN_.aSum }], [{ text: BTN_.aCli }, { text: BTN_.aBc }], [{ text: BTN_.aHelp }]], resize_keyboard: true, is_persistent: true }; }
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
  tgSend_(m.chat.id, '✅ Этот чат теперь панель менеджера ONION SHOP: сюда приходят новые заказы, вопросы покупателей и отзывы.');
  adminMenu_(m.chat.id);
  return true;
}

/* ---------- кнопки под уведомлениями покупателю ---------- */
function statusKb_(no, st) {
  var kb = [[{ text: '📦 Подробнее', callback_data: 'm|' + no }, { text: '💬 Вопрос', callback_data: 'q|' + no }]];
  if (st === 'Получен') kb.unshift([{ text: '⭐ Оставить отзыв (+ониксы)', url: siteUrl_('orders') }]);
  return kb;
}

/* ---------- покупатель ---------- */
function welcome_(name, linked) {
  return '👋 <b>Привет' + (name ? ', ' + hesc_(name) : '') + '! Это бот ONION SHOP.</b>\n\n' +
    'Одежда, обувь и аксессуары, в наличии и под заказ из Китая.\n\n' +
    (linked ? '✅ Уведомления подключены.\n\n' : 'Чтобы получать сообщения о заказах, откройте на сайте кабинет → «Уведомления в Telegram» → «Подключить».\n\n') +
    'Здесь можно:\n• следить за заказами, статусы придут сами;\n• узнать про ониксы и уровень;\n• задать вопрос менеджеру, просто напишите его в чат.\n\n' +
    '⏳ <i>Бот отвечает не мгновенно, иногда до минуты. Это нормально: нажмите кнопку один раз и немного подождите, сообщение дойдёт.</i>\n\nКнопки меню: внизу 👇';
}
function welcomeKb_(linked) {
  return [[{ text: '🛍 Открыть каталог', url: siteUrl_('catalog') }], [{ text: 'ℹ️ Условия и сроки доставки', url: termsUrl_() }],
    [{ text: linked ? '👤 Мой кабинет' : '🔔 Подключить уведомления', url: siteUrl_('account') }]];
}
function sendWelcome_(m, linked) {
  tgSend_(m.chat.id, welcome_(m.chat.first_name, linked), welcomeKb_(linked));
  tgSend_(m.chat.id, 'Меню всегда под рукой 👇', custKb_());
}
function custCatalog_(chat) {
  tgSend_(chat, '🛍 <b>Каталог ONION SHOP</b>\nОдежда, обувь и аксессуары. Есть товары в наличии и под заказ из Китая.', [
    [{ text: 'Весь каталог', url: siteUrl_('catalog') }],
    [{ text: 'В наличии', url: siteUrl_('stock') }, { text: 'Предзаказ', url: siteUrl_('preorder') }],
    [{ text: '🔔 Мои уведомления', callback_data: 'ns' }]]);
}
function custTerms_(chat) {
  tgSend_(chat, '📦 <b>Условия и сроки</b>\n\n<b>Предзаказ из Китая.</b> Выкупаем у поставщика после заказа, проверяем на складе и отправляем.\n' +
    '🚚 Фура идёт около 18-32 дней от склада. Самолётом быстрее, по согласованию с менеджером.\n' +
    'Стоимость доставки из Китая уже включена в стоимость товара.\n\n' +
    '<b>В наличии</b>: Авито Доставка, курьер по Москве или самовывоз, способ выбирается при оформлении.\n\nПолные условия, политика и порядок оформления, по кнопкам ниже.', [
    [{ text: 'Условия предзаказа и политика', url: termsUrl_() }],
    [{ text: 'Как оформить заказ', url: siteUrl_('info') }],
    [{ text: '💬 Задать вопрос', callback_data: 'q|' }]]);
}
function custAsk_(chat, no) {
  cachePut_('q:' + chat, no || '-', 900);
  tgSend_(chat, '💬 Напишите вопрос одним сообщением' + (no ? ', передам менеджеру вместе с номером заказа <b>' + hesc_(no) + '</b>' : ', я передам его менеджеру') + '. Можно приложить фото.\nОтвет придёт сюда же.', [[{ text: 'Или написать напрямую', url: SUPPORT_URL_ }]]);
}
function needLink_(chat) { tgSend_(chat, 'Сначала подключите уведомления: на сайте кабинет → «Уведомления в Telegram» → «Подключить». Это займёт полминуты.', [[{ text: '🔔 Открыть кабинет', url: siteUrl_('account') }]]); }
function custOrders_(chat, msgId) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var list = DB.listOrders(u.id, 6);
  if (!list.length) { tgSend_(chat, 'Заказов пока нет. Загляните в каталог 👇', [[{ text: '🛍 Каталог', url: siteUrl_('catalog') }]]); return; }
  var text = '<b>Ваши последние заказы</b>\nНажмите на заказ, чтобы увидеть детали.';
  var kb = list.map(function (o) { return [{ text: o.no + ' · ' + (o.status || 'Оформлен') + ' · ' + o.toPay + ' ₽', callback_data: 'm|' + o.no }]; });
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function custOrderCard_(cq, no) {
  var chat = cq.message.chat.id, u = tgUserByChat_(chat); if (!u) { tgAnswer_(cq.id, 'Подключите уведомления'); return; }
  var o = DB.listOrders(u.id, 50).filter(function (x) { return String(x.no) === no; })[0];
  if (!o) { tgAnswer_(cq.id, 'Заказ не найден'); return; }
  var stages = OnionCore.stagesFor(o.kind), cur = stages.indexOf(o.status || 'Оформлен');
  var chain = o.status === 'Отменён' ? '❌ Отменён' : stages.map(function (s, i) { return (i < cur ? '✅ ' : i === cur ? '🔵 ' : '⚪ ') + s; }).join('\n');
  var items = (o.items || []).map(function (it) { return '• ' + hesc_(it.title || '') + (it.size ? ' · ' + hesc_(it.size) : '') + (it.qty > 1 ? ' × ' + it.qty : ''); }).join('\n');
  var note = OnionCore.RULES.stageNotes && OnionCore.RULES.stageNotes[o.status] ? '\n\nℹ️ ' + hesc_(OnionCore.RULES.stageNotes[o.status]) : '';
  tgAnswer_(cq.id, '');
  var text = '📦 <b>Заказ ' + hesc_(o.no) + '</b> · ' + hesc_(o.at) + '\n' + items + '\n\n💰 К оплате: <b>' + hesc_(o.toPay) + ' ₽</b>' + (isTrue_(o.paid) ? ' (оплачен)' : '') + '\n\n' + chain + note;
  var kb = [[{ text: '💬 Вопрос по заказу', callback_data: 'q|' + o.no }]];
  if (o.status === 'Получен') kb.push([{ text: '⭐ Оставить отзыв', url: siteUrl_('orders') }]);
  kb.push([{ text: '⬅️ Все заказы', callback_data: 'mo' }]);
  if (/^📦 <b>|^Ваши последние|^📦 Заказ/.test(String(cq.message.text || ''))) tgEdit_(chat, cq.message.message_id, text, kb); else tgSend_(chat, text, kb);
}
function custBonus_(chat) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var L = OnionCore.levelOf(u), R = OnionCore.RULES, kb = [[{ text: '📦 Посылка и задания', url: siteUrl_('roulette') }]];
  var text = '🎁 <b>Ваши бонусы</b>\n\n🪙 Ониксов: <b>' + (u.balance || 0) + '</b> (≈ ' + Math.floor((u.balance || 0) * R.tokenRub) + ' ₽)\n⭐ Уровень: <b>' + hesc_(L.name) + '</b>\n\nОниксами и промокодом вместе можно оплатить до 12% заказа. Ежедневные задания и посылка, в кабинете.';
  if (u.refCode) {
    var link = siteUrl_('ref=' + u.refCode);
    text += '\n\n👥 <b>Пригласите друга</b>: ему +' + R.reward.refFriend + ' ониксов при регистрации, вам +' + R.reward.referrer + ' после его первого заказа от ' + R.refMinOrder + ' ₽.\nВаша ссылка: ' + hesc_(link);
    kb.push([{ text: '📤 Поделиться ссылкой', url: 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Одежда и обувь из Китая и в наличии. ONION SHOP. По моей ссылке +' + R.reward.refFriend + ' ониксов при регистрации') }]);
  }
  kb.push([{ text: '👤 Кабинет', url: siteUrl_('account') }]);
  tgSend_(chat, text, kb);
}
/* уведомления: все категории включены всегда и отключить их нельзя, экран только показывает, что приходит */
function custSettings_(chat, msgId) {
  var u = tgUserByChat_(chat); if (!u) { needLink_(chat); return; }
  var text = '🔔 <b>Уведомления ONION SHOP</b>\n\nПока бот подключён, вам всегда приходит всё, что связано с сайтом:\n✅ статусы заказов и напоминания\n✅ товар из «Жду появления» снова в продаже\n✅ скидки на вещи из избранного\n✅ новинки и акции\n✅ бонусы, ониксы, уровни и подарки\n\nВсё это приходит автоматически.';
  var kb = [[{ text: '📦 Мои заказы', callback_data: 'mo' }], [{ text: '🛍 Каталог', url: siteUrl_('catalog') }]];
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function custCallback_(cq, a) {
  var chat = cq.message.chat.id, mid = cq.message.message_id;
  if (a[0] === 'm') { custOrderCard_(cq, a[1]); return true; }
  if (a[0] === 'mo') { tgAnswer_(cq.id, ''); custOrders_(chat, mid); return true; }
  if (a[0] === 'q') { tgAnswer_(cq.id, ''); custAsk_(chat, a[1] || ''); return true; }
  if (a[0] === 'bn') { tgAnswer_(cq.id, ''); custBonus_(chat); return true; }
  if (a[0] === 'ns') { tgAnswer_(cq.id, ''); custSettings_(chat); return true; }
  return false;
}
/* вопрос покупателя → менеджеру. В конце сообщения метка #c<чат>: менеджер отвечает «ответом» на него или кнопкой */
function relayToManager_(m) {
  var chat = m.chat.id, admin = props_().getProperty('ADMIN_CHAT_ID');
  if (!admin) { tgSend_(chat, 'Напишите, пожалуйста, менеджеру напрямую 👇', [[{ text: '💬 @OnionShop_Support', url: SUPPORT_URL_ }]]); return; }
  var n = +(cacheGet_('qn:' + chat) || 0);
  if (n >= 8) { tgSend_(chat, 'Слишком много сообщений подряд. Подождите немного или напишите менеджеру напрямую.', [[{ text: '💬 Написать', url: SUPPORT_URL_ }]]); return; }
  cachePut_('qn:' + chat, n + 1, 600);
  var u = tgUserByChat_(chat), q = cacheGet_('q:' + chat); cacheDel_('q:' + chat);
  var who = u ? '@' + hesc_(u.login) + ' · ID ' + hesc_(u.id) + ' · ' + hesc_(OnionCore.levelOf(u).name) : hesc_(m.chat.username ? '@' + m.chat.username : (m.chat.first_name || 'покупатель')) + ' (кабинет не подключён)';
  var tgLink = m.chat.username ? ' · @' + hesc_(m.chat.username) : '';
  var head = '💬 <b>Вопрос покупателя</b>\n' + who + tgLink + (q && q !== '-' ? '\nПо заказу: <b>' + hesc_(q) + '</b>' : '');
  var kb = [[{ text: '✍️ Ответить', callback_data: 'rp|' + chat }]];
  if (u) kb[0].push({ text: '👤 Клиент', callback_data: 'c|' + u.id });
  if (q && q !== '-') kb.push([{ text: '🧾 Заказ ' + q, callback_data: 'o|' + q }]);
  if (m.text) tgSend_(admin, head + '\n\n' + hesc_(m.text) + '\n\n#c' + chat, kb);
  else { tgSend_(admin, head + '\n(вложение ниже)\n\n#c' + chat, kb); tgApi_('copyMessage', { chat_id: admin, from_chat_id: chat, message_id: m.message_id }); }
  tgSend_(chat, '✅ Передал менеджеру. Ответ придёт сюда же' + (n ? '.' : ', обычно в течение рабочего дня.') + '\n⏳ Бот сам отвечает с задержкой до минуты.');
}
function tgUserByChat_(chat) { return users_().filter(function (u) { return u.tgChat === String(chat); })[0] || null; }
function tgAnswer_(id, text) { tgApi_('answerCallbackQuery', { callback_query_id: id, text: text || '' }); }

/* ---------- менеджер ---------- */
function adminMenu_(chat) {
  tgSend_(chat, '🛠 <b>Панель менеджера ONION SHOP</b>\nЗаказы, клиенты, ониксы, вопросы и рассылка, прямо здесь.', [
    [{ text: '📦 Активные заказы', callback_data: 'ml|a' }, { text: '💳 Неоплаченные', callback_data: 'ml|u' }],
    [{ text: '👤 Найти клиента', callback_data: 'cf' }, { text: '📊 Сводка', callback_data: 'st' }],
    [{ text: '📣 Рассылка', callback_data: 'bcs' }]]);
  tgSend_(chat, 'Кнопки внизу: быстрый доступ 👇', adminKb_());
}
function adminHelp_(chat) {
  tgSend_(chat, '<b>Как работать с ботом</b>\n\n' +
    '📦 <b>Заказы.</b> Новый заказ приходит с кнопками статусов. Список: «Заказы» (есть фильтры по статусу и «неоплаченные»). Номер заказа (OS-26-00012 или 26-00012): сразу карточка. Смена статуса тут же уходит клиенту.\n\n' +
    '💬 <b>Вопросы покупателей</b> приходят сюда. Ответить: свайпните сообщение → «Ответить» и напишите текст (или фото), либо кнопка «✍️ Ответить».\n\n' +
    '👤 <b>Клиенты:</b> /client логин | ID | @telegram | телефон. В карточке: +/− ониксы, написать, удалить.\n' +
    '🪙 /tokens логин +50 причина, начислить (минус: списать), клиенту придёт уведомление.\n' +
    '🗑 /delete логин: удалить (с подтверждением, заказы остаются).\n' +
    '📣 /broadcast текст: рассылка. Можно с фото, отправьте фото с подписью (всем или только клиентам с активными заказами, сначала предпросмотр).\n' +
    '📝 В карточке заказа, заметка для себя (колонка «Заметка»).\n\n' +
    '☀️ Каждый день в 10:00: сводка и неоплаченные заказы. ⭐ Новые отзывы тоже приходят сюда.\n/cancel: отменить ввод.');
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
  var kb = list.slice(0, 12).map(function (o) { return [{ text: (isTrue_(o.paid) ? '💰 ' : '') + o.no.replace(/^OS-/, '') + ' · ' + (o.status || 'Оформлен') + ' · ' + o.toPay + ' ₽', callback_data: 'o|' + o.no }]; });
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
  var text = '🧾 <b>Заказ ' + hesc_(o.no) + '</b>\nСтатус: <b>' + hesc_(st) + '</b>' + (isTrue_(o.paid) ? ' · 💰 оплачен' : ' · не оплачен') +
    '\n\n' + hesc_(String(o.itemsText || '').slice(0, 900)) + '\n\n💰 К оплате: <b>' + hesc_(o.toPay) + ' ₽</b> (' + hesc_(o.kind) + ')' +
    '\n👤 ' + hesc_(o.name) + ' · ' + hesc_(o.phone) + (o.tg ? ' · ' + hesc_(o.tg) : '') + (cu ? (cu.tgChat ? ' · 🔔 бот' : ' · без бота') : '') +
    (o.pack ? '\n🎁 ' + hesc_(o.pack) : '') + (o.comment ? '\n💬 ' + hesc_(o.comment) : '') + (o.note ? '\n📝 ' + hesc_(o.note) : '');
  var kb = adminKeyboard_(o.no, String(o.kind)), row = [];
  if (cu && cu.tgChat) row.push({ text: '✉️ Написать', callback_data: 'rp|' + cu.tgChat });
  row.push({ text: '📝 Заметка', callback_data: 'nt|' + o.no });
  if (cu) row.push({ text: '👤 Клиент', callback_data: 'c|' + cu.id });
  kb.push(row);
  kb.push([{ text: '⬅️ К заказам', callback_data: 'ml|a' }]);
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
function statsText_() {
  var all = ordersAll_(), now = Date.now(), day = Utilities.formatDate(new Date(now), 'Europe/Moscow', 'dd.MM.yyyy');
  var dayOf = function (o, d) { return o.at instanceof Date ? Utilities.formatDate(o.at, 'Europe/Moscow', 'dd.MM.yyyy') === d : String(o.at).indexOf(d) === 0; };
  var yd = Utilities.formatDate(new Date(now - 86400000), 'Europe/Moscow', 'dd.MM.yyyy');
  var today = all.filter(function (o) { return dayOf(o, day); }), yest = all.filter(function (o) { return dayOf(o, yd); });
  var act = all.filter(function (o) { return !isDone_(String(o.status || 'Оформлен')); });
  var sum = function (a) { return Math.round(a.reduce(function (s, o) { return s + (money_(o.toPay) || 0); }, 0)); };
  var us = users_();
  return '📊 <b>Сводка</b>\n\nСегодня: ' + today.length + ' зак. на ' + sum(today) + ' ₽\nВчера: ' + yest.length + ' зак. на ' + sum(yest) + ' ₽\nАктивных: ' + act.length + ' (не оплачено: ' + act.filter(function (o) { return !isTrue_(o.paid); }).length + ')\nВсего заказов: ' + all.length +
    '\nКлиентов: ' + us.length + ' · с ботом: ' + us.filter(function (u) { return u.tgChat; }).length;
}
function adminStats_(chat) { tgSend_(chat, statsText_(), [[{ text: '📦 Активные', callback_data: 'ml|a' }, { text: '💳 Неоплаченные', callback_data: 'ml|u' }]]); }
/* утренняя сводка менеджеру: раз в день после 10:00 МСК */
function adminDigest_() {
  var p = props_(), admin = p.getProperty('ADMIN_CHAT_ID'); if (!admin) return;
  var now = new Date(), day = Utilities.formatDate(now, 'Europe/Moscow', 'yyyy-MM-dd'), h = +Utilities.formatDate(now, 'Europe/Moscow', 'H');
  if (h < 10 || p.getProperty('digestDay') === day) return;
  p.setProperty('digestDay', day);
  var old = ordersAll_().filter(function (o) { return !isDone_(String(o.status || 'Оформлен')) && !isTrue_(o.paid) && o.at instanceof Date && Date.now() - o.at.getTime() > 86400000; });
  var text = '☀️ <b>Доброе утро!</b>\n\n' + statsText_().replace('📊 <b>Сводка</b>\n\n', '') + (old.length ? '\n\n💳 Не оплачены дольше суток: ' + old.length : '');
  var kb = old.slice(-8).reverse().map(function (o) { return [{ text: o.no.replace(/^OS-/, '') + ' · ' + (o.status || 'Оформлен') + ' · ' + o.toPay + ' ₽', callback_data: 'o|' + o.no }]; });
  kb.push([{ text: '📦 Все активные', callback_data: 'ml|a' }]);
  tgSend_(admin, text, kb);
}
function findClient_(q) {
  q = String(q || '').trim().replace(/^@/, ''); if (!q) return null; USERS_CACHE_ = null;
  return DB.getUser(normId_(q)) || DB.findUser('login', q.toLowerCase()) || (OnionCore.cleanTg ? DB.findUser('tg', OnionCore.cleanTg(q)) : null) || DB.findUser('phone', q) || null;
}
function clientCard_(chat, u, msgId) {
  var L = OnionCore.levelOf(u), mine = orderRows_().filter(function (r) { return normId_(r[ci_(ORDER_COLS, 'userId')]) === u.id; });
  var last = mine.slice(-3).reverse().map(function (r) { return String(r[ci_(ORDER_COLS, 'no')]).trim(); });
  var text = '👤 <b>@' + hesc_(u.login) + '</b> · ID ' + hesc_(u.id) + '\n' + hesc_(u.name || '') + (u.phone ? ' · ' + hesc_(u.phone) + (u.phoneOk === false ? ' (не подтверждён)' : ' ✅') : '') + (u.tg ? ' · ' + hesc_(u.tg) : '') +
    '\nУровень: ' + hesc_(L.name) + ' · 🪙 ' + (u.balance || 0) + ' ониксов · заказов: ' + mine.length + '\nБот: ' + (u.tgChat ? 'подключён ' + hesc_(u.tgName || '') : 'не подключён');
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
  DB.userNotify(u, (d > 0 ? '🪙 Вам начислено ' + d + ' ониксов' : '🪙 Списано ' + (-d) + ' ониксов') + (reason && reason !== 'Менеджер (Telegram)' ? ': ' + reason : '') + '.\nБаланс: ' + u.balance, [[{ text: '🎁 Мои бонусы', callback_data: 'bn' }]]);
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
function askBroadcast_(chat, text, photo) {
  var pr = props_(); pr.setProperty('bcText', text || ''); if (photo) pr.setProperty('bcPhoto', photo); else pr.deleteProperty('bcPhoto');
  var kb = [[{ text: '✅ Всем (' + broadcastTargets_('').length + ')', callback_data: 'bc|y' }],
    [{ text: '📦 Только с активными заказами (' + broadcastTargets_('a').length + ')', callback_data: 'bc|a' }],
    [{ text: 'Отмена', callback_data: 'bc|n' }]];
  if (photo) {
    tgApi_('sendPhoto', { chat_id: chat, photo: photo, caption: String(text || '').slice(0, 900), reply_markup: { inline_keyboard: kb } });
    tgSend_(chat, '☝️ Так увидят покупатели. Кому отправить?');
  } else tgSend_(chat, '📣 <b>Проверьте рассылку</b>:\n\n' + hesc_(text) + '\n\nКому отправить?', kb);
}
function sendBroadcast_(u, text, photo) {
  if (!photo) return DB.userNotify(u, text);
  var r = tgApi_('sendPhoto', { chat_id: u.tgChat, photo: photo, caption: String(text || '').slice(0, 1000) });
  if (r && r.ok) return true;
  if (r && r.error_code === 403) { u.tgChat = ''; u.tgName = ''; DB.saveUser(u); return false; }
  return text ? DB.userNotify(u, text) : false;
}
/* ответ менеджера покупателю */
function replyToClient_(admin, chat, m) {
  var u = tgUserByChat_(chat), r;
  if (m.text) r = tgSend_(chat, '💬 <b>Ответ менеджера ONION SHOP</b>\n\n' + hesc_(m.text) + '\n\n<i>Ответить можно прямо здесь.</i>', [[{ text: '📦 Мои заказы', callback_data: 'mo' }]]);
  else r = tgApi_('copyMessage', { chat_id: chat, from_chat_id: admin, message_id: m.message_id });
  tgSend_(admin, r && r.ok ? '✅ Отправлено' + (u ? ' @' + hesc_(u.login) : '') : '⚠️ Не доставлено: покупатель, видимо, заблокировал бота.');
}

function adminCallback_(cq) {
  if (!cq.message) return;
  var chat = cq.message.chat.id, mid = cq.message.message_id, a = String(cq.data || '').split('|');
  if (!isAdmin_(chat)) { if (!custCallback_(cq, a)) tgAnswer_(cq.id, 'Нет доступа'); return; }
  if (['m', 'mo', 'q', 'bn', 'ns', 'nc', 'noff', 'noffy'].indexOf(a[0]) >= 0) { custCallback_(cq, a); return; }
  var p = props_();
  if (a[0] === 'ml') { tgAnswer_(cq.id, ''); adminOrders_(chat, mid, a[1] === '0' ? 'a' : a[1], a[2]); return; }
  if (a[0] === 'st') { tgAnswer_(cq.id, ''); adminStats_(chat); return; }
  if (a[0] === 'cf') { p.setProperty('adminAwait', 'client'); tgAnswer_(cq.id, ''); tgSend_(chat, 'Отправьте логин, ID, @telegram или телефон клиента.'); return; }
  if (a[0] === 'bcs') { p.setProperty('adminAwait', 'broadcast'); tgAnswer_(cq.id, ''); tgSend_(chat, 'Отправьте текст рассылки одним сообщением, или фото с подписью. Увидите предпросмотр и выберете, кому отправить. /cancel: отмена.'); return; }
  if (a[0] === 'rp') { p.setProperty('adminAwait', 'reply|' + a[1]); tgAnswer_(cq.id, ''); var ru = tgUserByChat_(a[1]); tgSend_(chat, '✍️ Напишите ответ' + (ru ? ' для @' + hesc_(ru.login) : '') + ' одним сообщением (можно фото). /cancel: отмена.'); return; }
  if (a[0] === 'nt') { p.setProperty('adminAwait', 'note|' + a[1]); tgAnswer_(cq.id, ''); tgSend_(chat, '📝 Заметка к заказу ' + hesc_(a[1]) + ' (видите только вы). Отправьте текст, «-», очистить. /cancel: отмена.'); return; }
  if (a[0] === 'bc') {
    var txt = p.getProperty('bcText') || '', ph = p.getProperty('bcPhoto') || ''; p.deleteProperty('bcText'); p.deleteProperty('bcPhoto');
    if ((a[1] !== 'y' && a[1] !== 'a') || (!txt && !ph)) { tgAnswer_(cq.id, 'Отменено'); tgSend_(chat, 'Рассылка отменена.'); return; }
    var sent = 0, all = broadcastTargets_(a[1] === 'a' ? 'a' : ''); all.forEach(function (u) { if (sendBroadcast_(u, txt, ph)) sent++; });
    tgAnswer_(cq.id, 'Отправлено: ' + sent); tgSend_(chat, '✅ Рассылка отправлена: ' + sent + ' из ' + all.length); return;
  }
  if (a[0] === 'c') { var cu = DB.getUser(a[1]); tgAnswer_(cq.id, ''); if (!cu) { tgSend_(chat, 'Клиент не найден.'); return; } clientCard_(chat, cu, /^👤/.test(String(cq.message.text || '')) ? mid : null); return; }
  if (a[0] === 't') {
    var tu = DB.getUser(a[1]); if (!tu) { tgAnswer_(cq.id, 'Клиент не найден'); return; }
    var d = parseInt(a[2], 10) || 0; var nu = adjustClient_(tu, d);
    tgAnswer_(cq.id, (d > 0 ? '+' : '') + d + ' → баланс ' + (nu ? nu.balance : '?')); if (nu) clientCard_(chat, nu, mid); return;
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
  // p|no: оплачен, s|no|i, статус
  var f = orderIdx_(a[1]), sh = ss_().getSheetByName(SHEET.orders);
  if (!f || !sh) { tgAnswer_(cq.id, 'Заказ ' + a[1] + ' не найден'); return; }
  var isCard = /^🧾/.test(String(cq.message.text || ''));
  if (a[0] === 'p') { sh.getRange(f.row, ci_(ORDER_COLS, 'paid') + 1).setValue(true); tgAnswer_(cq.id, '💰 ' + a[1] + ': отмечен оплаченным'); if (isCard) orderCard_(chat, f.o.no, mid); return; }
  var list = adminStages_(String(f.o.kind)), st = list[+a[2]];
  if (!st) { tgAnswer_(cq.id, 'Неизвестный статус'); return; }
  sh.getRange(f.row, ci_(ORDER_COLS, 'status') + 1).setValue(st);
  tgAnswer_(cq.id, '✅ ' + a[1] + ' → ' + st + ' (клиенту уйдёт уведомление)');
  if (isCard) orderCard_(chat, f.o.no, mid);
}

function adminText_(m, text) {
  var chat = m.chat.id, p = props_(), aw = p.getProperty('adminAwait') || '', mm;
  // ответ свайпом на вопрос покупателя (#c<чат>)
  var rt = m.reply_to_message && String(m.reply_to_message.text || m.reply_to_message.caption || '').match(/#c(-?\d+)/);
  if (rt && !/^\//.test(text)) { replyToClient_(chat, rt[1], m); return; }
  if (/^\/cancel/i.test(text)) { p.deleteProperty('adminAwait'); p.deleteProperty('bcText'); tgSend_(chat, 'Отменено.'); return; }
  if (/^reply\|/.test(aw) && !/^\//.test(text)) { p.deleteProperty('adminAwait'); replyToClient_(chat, aw.split('|')[1], m); return; }
  if (aw === 'broadcast' || /^\/broadcast/i.test(String(m.caption || ''))) {
    var cap = String(m.caption || '').replace(/^\/broadcast\s*/i, '').trim();
    if (m.photo && m.photo.length) { p.deleteProperty('adminAwait'); askBroadcast_(chat, cap, m.photo[m.photo.length - 1].file_id); return; }
  }
  if (!m.text) { tgSend_(chat, 'Чтобы отправить фото покупателю, ответьте (свайп) на его вопрос или нажмите «✍️ Ответить».'); return; }
  if (/^note\|/.test(aw) && !/^\//.test(text)) {
    p.deleteProperty('adminAwait'); var no = aw.split('|')[1], f = orderIdx_(no);
    if (!f) { tgSend_(chat, 'Заказ не найден.'); return; }
    ss_().getSheetByName(SHEET.orders).getRange(f.row, ci_(ORDER_COLS, 'note') + 1).setValue(text === '-' ? '' : text);
    tgSend_(chat, '📝 Сохранено.'); orderCard_(chat, no); return;
  }
  if (/^\/(menu|admin|start)/i.test(text)) { p.deleteProperty('adminAwait'); adminMenu_(chat); return; }
  if (text === BTN_.aOrd || /^\/orders/i.test(text)) { adminOrders_(chat); return; }
  if (text === BTN_.aSum || /^\/stats/i.test(text)) { adminStats_(chat); return; }
  if (text === BTN_.aHelp || /^\/help/i.test(text)) { adminHelp_(chat); return; }
  if (text === BTN_.aCli) { p.setProperty('adminAwait', 'client'); tgSend_(chat, 'Отправьте логин, ID, @telegram или телефон клиента.'); return; }
  if (text === BTN_.aBc) { p.setProperty('adminAwait', 'broadcast'); tgSend_(chat, 'Отправьте текст рассылки одним сообщением, или фото с подписью. /cancel: отмена.'); return; }
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
        else tgSend_(c, 'Код не подошёл или устарел. Откройте на сайте кабинет → «Уведомления в Telegram» и нажмите «Подключить» ещё раз.', [[{ text: '🔔 Открыть кабинет', url: siteUrl_('account') }]]);
        return;
      }
      if (m.contact) { phoneContact_(m); return; }
      if (claimAdmin_(m)) return;
      if (isAdmin_(c)) { adminText_(m, text); return; }
      if (/^\/start/.test(text)) { p.setProperty('lastStart', JSON.stringify({ id: c, name: who })); sendWelcome_(m, !!tgUserByChat_(c)); }
      else if (text === BTN_.cat || /^\/catalog/.test(text)) custCatalog_(c);
      else if (text === BTN_.ord || /^\/orders/.test(text)) custOrders_(c);
      else if (text === BTN_.bon || /^\/bonus/.test(text)) custBonus_(c);
      else if (text === BTN_.terms || /^\/(terms|info)/.test(text)) custTerms_(c);
      else if (text === BTN_.set || /^\/settings/.test(text)) custSettings_(c);
      else if (text === BTN_.sup || text === '💬 Менеджер' || /^\/(help|support|ask)/.test(text)) custAsk_(c, '');
      else if (/^\/menu/.test(text)) tgSend_(c, 'Меню 👇\n⏳ Бот отвечает с небольшой задержкой, до минуты, подождите, пожалуйста.', custKb_());
      else if (/^\//.test(text)) tgSend_(c, 'Не знаю такой команды. Меню: внизу 👇', custKb_());
      else relayToManager_(m);
    } catch (e) { console.error('tg', e && e.stack || e); }
  });
  p.setProperty('tgOffset', String(off));
}

/* подтверждение телефона: кнопка Telegram «Поделиться номером» (Telegram сам подтверждает, что номер владельца) */
function askPhone_(chat) {
  tgSend_(chat, '📱 <b>Последний шаг: подтвердите телефон</b>\n\nНажмите кнопку внизу «Поделиться номером». Telegram передаст только ваш номер, так мы защищаем бонусы от накруток.\n\nПосле подтверждения: приветственные ониксы, бонусы за друзей и подарок на день рождения.',
    { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
}
function phoneContact_(m) {
  var c = m.chat.id, u = tgUserByChat_(c);
  if (!u) { tgSend_(c, 'Сначала откройте на сайте кабинет → «Подтвердить телефон» и нажмите кнопку, бот привяжется к вашему аккаунту.', custKb_()); return; }
  var r = OnionCore.phoneConfirm(DB, u, m.contact, m.from && m.from.id);
  if (!r.ok) { tgSend_(c, '⚠️ ' + hesc_(r.msg), custKb_()); return; }
  tgSend_(c, '✅ <b>Телефон подтверждён</b>' + (r.changed ? '\nВ кабинете указан номер из Telegram.' : '') + (r.got ? '\n🎁 На баланс начислено ' + r.got + ' ониксов.' : '') + '\n\nБонусы магазина теперь доступны.', custKb_());
}

/* список команд в меню «/»: покупателям: свои, менеджеру (только его чат): расширенный */
function setBotCommands_() {
  tgApi_('setMyCommands', { commands: [{ command: 'menu', description: 'Меню' }, { command: 'catalog', description: 'Каталог' }, { command: 'orders', description: 'Мои заказы и статусы' }, { command: 'bonus', description: 'Ониксы, уровень, пригласить друга' }, { command: 'terms', description: 'Условия и сроки' }, { command: 'settings', description: 'Настройки уведомлений' }, { command: 'ask', description: 'Задать вопрос менеджеру' }] });
  var a = props_().getProperty('ADMIN_CHAT_ID');
  if (a) tgApi_('setMyCommands', { scope: { type: 'chat', chat_id: Number(a) }, commands: [{ command: 'menu', description: 'Панель менеджера' }, { command: 'orders', description: 'Активные заказы' }, { command: 'stats', description: 'Сводка' }, { command: 'client', description: '/client логин: карточка клиента' }, { command: 'tokens', description: '/tokens логин +50 причина' }, { command: 'delete', description: '/delete логин: удалить клиента' }, { command: 'broadcast', description: '/broadcast текст: рассылка' }, { command: 'cancel', description: 'Отменить ввод' }, { command: 'help', description: 'Как работать с ботом' }] });
}
