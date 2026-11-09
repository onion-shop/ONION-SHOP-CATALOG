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
var BTN_ = { cat: '🛍 Каталог', fresh: '🆕 Новинки', sale: '🔥 Скидки', ord: '📦 Мои заказы', bon: '🎁 Бонусы', terms: 'ℹ️ Условия и сроки', sup: '💬 Задать вопрос', set: '⚙️ Настройки',
  aOrd: '📦 Заказы', aUnp: '💳 Неоплаченные', aSum: '📊 Сводка', aCli: '👤 Клиент', aBc: '📣 Рассылка', aNew: '🆕 Пост по товару', aAuto: '⚙️ Авто-рассылки', aHelp: '❓ Подсказка' };
function custKb_() { return { keyboard: [[{ text: BTN_.cat }, { text: BTN_.fresh }, { text: BTN_.sale }], [{ text: BTN_.ord }, { text: BTN_.bon }], [{ text: BTN_.terms }, { text: BTN_.sup }, { text: BTN_.set }]], resize_keyboard: true, is_persistent: true }; }
function adminKb_() { return { keyboard: [[{ text: BTN_.aOrd }, { text: BTN_.aUnp }], [{ text: BTN_.aSum }, { text: BTN_.aCli }], [{ text: BTN_.aBc }, { text: BTN_.aNew }], [{ text: BTN_.aAuto }, { text: BTN_.aHelp }]], resize_keyboard: true, is_persistent: true }; }
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
  return '👋 <b>Привет' + (name ? ', ' + hesc_(name) : '') + '! Это бот ONION SHOP</b>\n———\n' +
    '•<b>что у нас:</b> одежда, обувь и аксессуары\n•<b>как:</b> в наличии и под заказ из Китая\n•<b>тут:</b> статусы заказов, новинки, скидки, бонусы\n\n' +
    (linked ? '✅ Уведомления подключены, всё важное придёт сюда сразу.' : '🔔 Чтобы заказы и новинки приходили сюда, откройте на сайте кабинет → «Уведомления в Telegram» → «Подключить».') +
    '\n\nЕсли что-то непонятно, просто напишите, я передам менеджеру.';
}
function welcomeKb_(linked) {
  return [[{ text: '🛍 Открыть каталог', url: siteUrl_('catalog') }], [{ text: 'ℹ️ Условия и сроки доставки', url: termsUrl_() }],
    [{ text: linked ? '👤 Мой кабинет' : '🔔 Подключить уведомления', url: siteUrl_('account') }]];
}
function sendWelcome_(m, linked) {
  tgPhoto_(m.chat.id, IMG_('welcome'), welcome_(m.chat.first_name, linked), welcomeKb_(linked));
  tgSend_(m.chat.id, 'Меню всегда под рукой 👇', custKb_());
}
/* новинки и скидки для покупателя: посты как в канале, с фото */
function custFresh_(chat) {
  var L = freshList_(3); if (!L.length) { tgSend_(chat, 'Пока без новинок, загляните позже 🙂'); return; }
  tgSend_(chat, '🆕 <b>Свежее в каталоге</b>');
  L.forEach(function (c) { tgPhoto_(chat, prodPhoto_(c), postCaption_(c), [[{ text: '🛍 Открыть товар', url: siteUrl_('p-' + c.id) }]]); });
  tgSend_(chat, 'Больше вещей в каталоге 👇', [[{ text: '🛍 Весь каталог', url: siteUrl_('catalog') }]]);
}
function custSale_(chat) {
  var b = bcBuild_({ t: 'sale', iv: Math.floor(Math.random() * 20) });
  if (!b) { tgSend_(chat, 'Сейчас скидок нет, но мы следим. Как только появятся, напишу сюда 🔥', [[{ text: '🛍 Каталог', url: siteUrl_('catalog') }]]); return; }
  tgPhoto_(chat, b.photo, b.text, b.kb);
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
  var kb = [[{ text: '🖼 Фото товаров', callback_data: 'ph|' + o.no }, { text: '💬 Вопрос по заказу', callback_data: 'q|' + o.no }]];
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
  if (a[0] === 'ph') {
    tgAnswer_(cq.id, '');
    if (!isAdmin_(chat)) { var pu = tgUserByChat_(chat); if (!pu || !DB.listOrders(pu.id, 50).some(function (x) { return String(x.no) === a[1]; })) { tgSend_(chat, 'Заказ не найден.'); return true; } }
    if (!orderPhotos_(chat, a[1])) tgSend_(chat, 'Фото к этому заказу не сохранились.');
    return true;
  }
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
  tgSend_(chat, pick_(V_.asked) + (props_().getProperty('tgWebhook') ? '' : '\n⏳ Бот сам отвечает с задержкой до минуты.'));
}
function tgUserByChat_(chat) { return users_().filter(function (u) { return u.tgChat === String(chat); })[0] || null; }
function tgAnswer_(id, text) { tgApi_('answerCallbackQuery', { callback_query_id: id, text: text || '' }); }

/* ---------- менеджер ---------- */
function adminMenu_(chat) {
  tgSend_(chat, '🛠 <b>Панель менеджера ONION SHOP</b>\nВсё, что было в таблице, теперь здесь: заказы, клиенты, ониксы, вопросы, рассылки.', [
    [{ text: '📦 Активные заказы', callback_data: 'ml|a' }, { text: '💳 Неоплаченные', callback_data: 'ml|u' }],
    [{ text: '👤 Найти клиента', callback_data: 'cf' }, { text: '📊 Сводка', callback_data: 'st' }],
    [{ text: '📣 Рассылка', callback_data: 'bm' }, { text: '🆕 Пост по товару', callback_data: 'bp' }],
    [{ text: '⚙️ Авто-рассылки', callback_data: 'ac' }]]);
  tgSend_(chat, 'Кнопки внизу: быстрый доступ 👇', adminKb_());
}
function adminHelp_(chat) {
  tgSend_(chat, '<b>Как работать с ботом</b>\n\n' +
    '📦 <b>Заказы.</b> Новый заказ приходит с кнопками статусов. Список: «Заказы» (есть фильтры по статусу и «неоплаченные»). Номер заказа (OS-26-00012 или 26-00012): сразу карточка. Смена статуса тут же уходит клиенту.\n\n' +
    '💬 <b>Вопросы покупателей</b> приходят сюда. Ответить: свайпните сообщение → «Ответить» и напишите текст (или фото), либо кнопка «✍️ Ответить».\n\n' +
    '👤 <b>Клиенты:</b> /client логин | ID | @telegram | телефон. В карточке: +/− ониксы, написать, удалить.\n' +
    '🪙 /tokens логин +50 причина, начислить (минус: списать), клиенту придёт уведомление.\n' +
    '🗑 /delete логин: удалить (с подтверждением, заказы остаются).\n' +
    '📣 <b>Рассылка:</b> пост про товар, новинки, скидки, новая функция или случайный пост. Текст бот собирает сам, каждый раз по-разному, вы видите готовый пост и жмёте «Отправить». Можно и свой текст или фото.\n' +
    '⚙️ <b>Авто-рассылки:</b> новинки, скидки, «подешевело в избранном», «давно не заходили», напоминания. Каждую можно включить и выключить.\n' +
    '🖼 В заказе: кнопка «Фото», альбом всех товаров заказа. С новым заказом фото приходят сами.\n' +
    '📣 /broadcast текст: быстрая рассылка своим текстом.\n' +
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
  kb.push([{ text: '🖼 Фото товаров', callback_data: 'ph|' + o.no }]);
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
  bcPreview_(chat, { t: 'custom', text: text || '', photo: photo || '' }); return;
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
  if (['m', 'mo', 'q', 'ns', 'nc', 'noff', 'noffy', 'ph'].indexOf(a[0]) >= 0 || (a[0] === 'bn' && a.length === 1)) { custCallback_(cq, a); return; }
  var p = props_();
  // ---- рассылки и авто-рассылки ----
  if (a[0] === 'bm') { tgAnswer_(cq.id, ''); bcMenu_(chat); return; }
  if (a[0] === 'bp') { tgAnswer_(cq.id, ''); bcProducts_(chat); return; }
  if (a[0] === 'bpp') { tgAnswer_(cq.id, ''); bcPreview_(chat, { t: 'prod', id: a[1], iv: Math.floor(Math.random() * 20) }); return; }
  if (a[0] === 'bn') {
    tgAnswer_(cq.id, '');
    if (a[1] === 'n') { p.setProperty('adminAwait', 'feat'); tgSend_(chat, '🚀 Напишите коротко, что нового на сайте или в магазине (например: «подборка образов» или «быстрая оплата»). Бот сам соберёт из этого пост. /cancel: отмена.'); return; }
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
  if (aw === 'feat' && !/^\//.test(text) && text !== BTN_.aBc && text !== BTN_.aNew) { p.deleteProperty('adminAwait'); bcPreview_(chat, { t: 'feat', f: text.slice(0, 80), iv: Math.floor(Math.random() * 20) }); return; }
  if (text === BTN_.aOrd || /^\/orders/i.test(text)) { adminOrders_(chat); return; }
  if (text === BTN_.aUnp) { adminOrders_(chat, null, 'u'); return; }
  if (text === BTN_.aBc) { p.deleteProperty('adminAwait'); bcMenu_(chat); return; }
  if (text === BTN_.aNew) { p.deleteProperty('adminAwait'); bcProducts_(chat); return; }
  if (text === BTN_.aAuto) { autoMenu_(chat, null); return; }
  if (text === BTN_.aSum || /^\/stats/i.test(text)) { adminStats_(chat); return; }
  if (text === BTN_.aHelp || /^\/help/i.test(text)) { adminHelp_(chat); return; }
  if (text === BTN_.aCli) { p.setProperty('adminAwait', 'client'); tgSend_(chat, 'Отправьте логин, ID, @telegram или телефон клиента.'); return; }
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
      else if (text === BTN_.fresh || /^\/(fresh|new)/.test(text)) custFresh_(c);
      else if (text === BTN_.sale || /^\/sale/.test(text)) custSale_(c);
      else if (/^\/menu/.test(text)) tgSend_(c, pick_(V_.welcomeBack) + ' Меню 👇', custKb_());
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

/* ====================== голос бота, посты как в канале, рассылки ======================
   Тексты написаны живым языком магазина. Варианты подбираются случайно, чтобы сообщения не повторялись. */
function pick_(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickAt_(a, i) { return a[(i || 0) % a.length]; }
function fill_(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] !== undefined ? o[k] : m; }); }
var V_ = {
  fresh1: ['Свежая вещь в каталоге 👀', 'Короче, пополнение. Смотрите, что приехало', 'Новинка. Таких у нас обычно немного', 'Выложили новую вещь, глянете?', 'Привет! Вот что у нас новенького', 'Прям то, что надо к сезону'],
  freshN: ['Пополнение: {n} новых вещей', 'Короче, у нас {n} новинок', 'Выложили {n} новых вещей, смотрите ниже'],
  sale: ['Цены просели, пока действует 🔥', 'Скидки до {pct}%', 'Подборка со скидкой, смотрите', 'Хорошая цена на эти вещи, долго не продержится'],
  feat: ['Новое у нас: {f}. Загляните, должно быть удобнее', 'Короче, добавили {f}. Попробуйте', 'Теперь есть {f}. Открывайте и смотрите'],
  drop: ['Подешевело то, что вы отложили 📉', 'Цена на вещь из избранного стала ниже', 'Хорошая новость: из избранного подешевело'],
  restock: ['«{t}» снова в продаже', 'Вы ждали: «{t}» вернулась в каталог', 'Новость: «{t}» снова можно заказать'],
  payTail: ['Если уже оплатили, ничего делать не нужно: менеджер отметит.', 'Оплатили? Тогда всё в порядке, менеджер скоро отметит.', 'Есть вопрос по оплате? Просто напишите сюда.'],
  reviewTail: ['Расскажите, как вам вещь: это важно и нам, и другим покупателям.', 'Займёт минуту, а ониксы останутся у вас.', 'Нам правда важно ваше мнение.'],
  winback: ['Давно не виделись! Смотрите, что у нас сейчас', 'Привет! Скучаем. Вот что появилось, пока вас не было', 'Заглядывайте, у нас много нового'],
  welcomeBack: ['Привет! Рад видеть 👋', 'Привет! Чем помочь?', 'Здравствуйте! Что подсказать?'],
  asked: ['✅ Передал менеджеру. Ответ придёт сюда же.', '✅ Принял, менеджер уже в курсе. Ответ придёт в этот чат.', '✅ Всё, отправил менеджеру. Как только ответит, напишу сюда.']
};
var ST_ = {
  'Оформлен': ['🧾', 'Заказ принят', ['Менеджер скоро свяжется с вами.', 'Уже занимаемся, скоро напишем.']],
  'Выкуплен': ['✅', 'Заказ выкуплен', ['Выкупили у поставщика, всё идёт по плану.', 'Дальше отправка, держим в курсе.']],
  'В пути': ['🚚', 'Заказ в пути', ['Уже едет к нам из Китая.', 'Поехали! Следующий шаг: склад.']],
  'На складе': ['📦', 'Заказ на складе', ['Приехал к нам, сейчас всё проверим.', 'Он уже у нас, смотрим состояние.']],
  'Едет к нам': ['✈️', 'Заказ едет к нам', ['Осталось чуть-чуть.', 'Скоро будет на месте.']],
  'Едет к вам': ['🚚', 'Заказ едет к вам', ['Передали в доставку, скоро будет у вас.', 'Скоро он будет у вас.']],
  'Получен': ['🎉', 'Заказ получен', ['Спасибо, что выбрали нас 🤍', 'Надеемся, всё понравилось!']],
  'Отменён': ['❌', 'Заказ отменён', ['Если это ошибка, просто напишите сюда.', 'Если есть вопросы, напишите сюда.']]
};
function statusText_(no, st) {
  var s = ST_[st] || ['🔔', st, ['']], note = OnionCore.RULES.stageNotes && OnionCore.RULES.stageNotes[st] || '';
  var t = s[0] + ' <b>' + s[1] + '</b>\n———\n•<b>заказ:</b> ' + hesc_(no) + '\n•<b>статус:</b> ' + hesc_(st) + '\n\n' + pick_(s[2]);
  if (note) t += '\n\nℹ️ ' + hesc_(note);
  if (st === 'Получен') t += '\nОставьте отзыв на сайте, получите ониксы.';
  if (st === 'Отменён') t += '\nОниксы, если вы их тратили, вернутся на баланс.';
  return t;
}
function payText_(no, sum) { return '💳 <b>Заказ ждёт оплаты</b>\n———\n•<b>заказ:</b> ' + hesc_(no) + '\n•<b>к оплате:</b> ' + hesc_(sum) + ' ₽\n\n' + pick_(V_.payTail); }
function reviewText_(no, r, rt) { return '⭐ <b>Как вам заказ?</b>\n———\n•<b>заказ:</b> ' + hesc_(no) + '\n•<b>за отзыв:</b> +' + r + ' ониксов, с текстом +' + rt + '\n\n' + pick_(V_.reviewTail); }function IMG_(n) { return siteBase_() + 'assets/bot/' + n + '.jpg'; }
function photoUrl_(id) { return siteBase_() + 'img/full/' + id + '.jpg'; }
function prodPhoto_(c) { return c && c.photos && c.photos.length ? photoUrl_(c.photos[0].id) : ''; }
function detailOf_(c, key) { var d = (c.details || []).filter(function (x) { return String(x[0]).toLowerCase() === key; })[0]; return d ? d[1] : ''; }
function cap1_(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
/* подпись к товару в том же виде, что в канале: курсивное название, ———, список с «•» */
function postCaption_(c) {
  var st = detailOf_(c, 'состояние'), L = ['<i>' + hesc_(c.title) + '</i>', '———'];
  if (st) L.push('•<b>состояние:</b> ' + hesc_(st));
  L.push('•<b>цена:</b> ' + (c.oldPrice > c.price ? '<s>' + c.oldPrice + '</s> ' : '') + c.price);
  if (c.colors && c.colors.length) L.push('•<b>цвет:</b> ' + hesc_(cap1_(c.colors.join(', '))));
  if (c.sizes && c.sizes.length) L.push('•<b>размеры:</b> ' + hesc_(c.sizes.join(' / ')));
  if (c.status === 'preorder') L.push('•<b>наличие:</b> под заказ из Китая');
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

/* ---------- посты: что собираем и как показываем ---------- */
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
    out.kb = [[{ text: '🛍 Открыть товар', url: siteUrl_('p-' + c.id) }], [{ text: '💬 Спросить менеджера', callback_data: 'q|' }]];
    return out;
  }
  if (d.t === 'fresh') {
    var L = freshList_(d.n || 3, cat); if (!L.length) return null;
    if (L.length === 1) return bcBuild_({ t: 'prod', id: L[0].id, iv: iv });
    out.text = '🆕 <b>' + fill_(pickAt_(V_.freshN, iv), { n: L.length }) + '</b>\n———\n' + L.map(function (c) { return '•<i>' + hesc_(c.title) + '</i>: ' + c.price; }).join('\n');
    out.photo = prodPhoto_(L[0]); out.kb = L.map(function (c) { return [{ text: String(c.title).slice(0, 34) + ' · ' + c.price, url: siteUrl_('p-' + c.id) }]; });
    return out;
  }
  if (d.t === 'sale') {
    var S = saleList_(3); if (!S.length) return null;
    out.text = '🔥 <b>' + fill_(pickAt_(V_.sale, iv), { pct: Math.max(5, Math.floor(S[0].d / 5) * 5) }) + '</b>\n———\n' + S.map(function (x) { return '•<i>' + hesc_(x.c.title) + '</i>\n   <s>' + x.c.oldPrice + '</s> <b>' + x.c.price + '</b> (−' + x.d + '%)'; }).join('\n');
    out.photo = prodPhoto_(S[0].c); out.kb = S.map(function (x) { return [{ text: String(x.c.title).slice(0, 30) + ' · −' + x.d + '%', url: siteUrl_('p-' + x.c.id) }]; });
    return out;
  }
  if (d.t === 'feat') {
    out.text = '🚀 ' + fill_(pickAt_(V_.feat, iv), { f: '<b>' + hesc_(d.f) + '</b>' }); out.photo = IMG_('feature');
    out.kb = [[{ text: '🚀 Посмотреть на сайте', url: siteUrl_('') }]];
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
  if (mode === 'm') { if (b.photo) tgPhoto_(chat, b.photo, b.text, b.kb); else tgSend_(chat, b.text, b.kb); tgSend_(chat, '☝️ Это вам для проверки. Остальным не отправлено.'); return; }
  var all = broadcastTargets_(mode === 'a' ? 'a' : ''), sent = 0;
  all.slice(0, 300).forEach(function (u) { if (sendPostTo_(u, b)) sent++; Utilities.sleep(40); });
  bcDraft_(null);
  tgSend_(chat, '✅ Рассылка отправлена: ' + sent + ' из ' + all.length);
}
function bcMenu_(chat) {
  tgSend_(chat, '📣 <b>Рассылка</b>\nВыберите, что отправить. Текст бот соберёт сам, каждый раз по-разному, перед отправкой вы увидите готовый пост.', [
    [{ text: '🆕 Пост про товар', callback_data: 'bp' }, { text: '✨ Новинки', callback_data: 'bn|f' }],
    [{ text: '🔥 Скидки', callback_data: 'bn|s' }, { text: '🎲 Случайный пост', callback_data: 'bn|r' }],
    [{ text: '🚀 Новая функция', callback_data: 'bn|n' }, { text: '✍️ Свой текст или фото', callback_data: 'bcs' }]]);
}
function bcProducts_(chat) {
  var L = freshList_(10), kb = L.map(function (c) { return [{ text: String(c.title).slice(0, 40) + ' · ' + c.price, callback_data: 'bpp|' + c.id }]; });
  if (!L.length) { tgSend_(chat, 'В каталоге пока нет товаров для поста.'); return; }
  tgSend_(chat, '🆕 <b>Какой товар показать клиентам?</b>\nСвежие сверху.', kb);
}
function autoMenu_(chat, msgId) {
  var c = autoCfg_(), on = function (k) { return c[k] ? '✅ ' : '⬜ '; };
  var text = '⚙️ <b>Авто-рассылки</b>\nБот сам пишет клиентам, каждый раз новыми словами. Ночью не беспокоит, одному человеку не чаще раза в сутки.\n\n' +
    '🆕 Новинки: сразу, как появились в каталоге\n🔥 Скидки: раз в 3 дня вечером\n📉 Подешевело в избранном\n👋 Давно не заходили: раз в месяц напомнить\n💳 Напоминания про оплату и отзыв';
  var kb = [[{ text: on('fresh') + 'Новинки', callback_data: 'at|fresh' }, { text: on('sale') + 'Скидки', callback_data: 'at|sale' }],
    [{ text: on('drop') + 'Подешевело', callback_data: 'at|drop' }, { text: on('nudge') + 'Давно не были', callback_data: 'at|nudge' }],
    [{ text: on('remind') + 'Напоминания', callback_data: 'at|remind' }], [{ text: '🧪 Показать примеры мне', callback_data: 'at|demo' }]];
  if (msgId) tgEdit_(chat, msgId, text, kb); else tgSend_(chat, text, kb);
}
/* фото товаров заказа (альбом): менеджеру и самому клиенту */
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
  var cap = '🖼 <b>Заказ ' + hesc_(no) + '</b>\n' + r.items.map(function (it) { return '•' + hesc_(it.title || '') + (it.size ? ' · ' + hesc_(it.size) : '') + (it.color ? ' · ' + hesc_(it.color) : '') + (it.qty > 1 ? ' × ' + it.qty : ''); }).join('\n');
  sendAlbum_(chat, urls, cap);
  return true;
}
/* примеры сообщений бота: приходят только менеджеру, клиентам ничего не уходит */
function botDemo_(chat) {
  tgSend_(chat, '🧪 <b>Примеры того, что бот пишет клиентам</b>\nЭто пробные сообщения, только вам.');
  tgPhoto_(chat, IMG_('welcome'), welcome_('Миша', true), welcomeKb_(true));
  var L = freshList_(3);
  if (L.length) { var b1 = bcBuild_({ t: 'prod', id: L[0].id, iv: Math.floor(Math.random() * 20) }); tgPhoto_(chat, b1.photo, b1.text, b1.kb); }
  var b2 = bcBuild_({ t: 'fresh', n: 3, iv: Math.floor(Math.random() * 20) }); if (b2) tgPhoto_(chat, b2.photo, b2.text, b2.kb);
  var b3 = bcBuild_({ t: 'sale', iv: Math.floor(Math.random() * 20) }); if (b3) tgPhoto_(chat, b3.photo, b3.text, b3.kb);
  var b4 = bcBuild_({ t: 'feat', f: 'подборка образов', iv: Math.floor(Math.random() * 20) }); tgPhoto_(chat, b4.photo, b4.text, b4.kb);
  tgSend_(chat, statusText_('OS-26-00001', 'В пути'));
  tgSend_(chat, payText_('OS-26-00001', '26 564'));
  tgSend_(chat, reviewText_('OS-26-00001', 5, 15), [[{ text: '⭐ Оставить отзыв', url: siteUrl_('orders') }]]);
  tgSend_(chat, statusText_('OS-26-00001', 'Получен'));
  if (L.length) tgPhoto_(chat, prodPhoto_(L[0]), '👋 <b>' + pick_(V_.winback) + '</b>\n\n' + postCaption_(L[0]), [[{ text: '🛍 Открыть товар', url: siteUrl_('p-' + L[0].id) }]]);
}
function botDemo() { var a = props_().getProperty('ADMIN_CHAT_ID'); if (a) botDemo_(a); else Logger.log('Менеджер ещё не привязан: напишите боту /start с аккаунта @' + adminUser_()); }