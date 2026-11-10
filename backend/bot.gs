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
