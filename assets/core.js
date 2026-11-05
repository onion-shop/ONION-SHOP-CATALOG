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
    early: { hours: 24, level: 2 }, // новинки первые сутки, только для Золота и выше
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
        ['1 бесплатная посылка в день', 'Обновляется в 00:00 по Москве'],
        ['10 ониксов за серию 7 дней', 'Отмечайтесь 7 дней подряд'],
        ['Рамка «Бронза»', 'Доступна со статусом Бронза']] },
      { key: 'silver', name: 'Серебро', alias: ['модник'], min: 500, tasks: 5, streak: 12, spins: 1, priority: '', perks: [
        ['Доступны 5 заданий', 'На одно больше, чем на Бронзе'],
        ['1 бесплатная посылка в день', 'Обновляется в 00:00 по Москве'],
        ['12 ониксов за серию 7 дней', 'Вместо 10 на Бронзе'],
        ['Рамка «Серебро»', 'Доступна со статусом Серебро']] },
      { key: 'gold', name: 'Золото', alias: ['профи'], min: 1500, tasks: 6, streak: 15, spins: 1, priority: 'Повышенный', perks: [
        ['Доступны 6 заданий', 'На одно больше, чем на Серебре'],
        ['1 бесплатная посылка в день', 'Обновляется в 00:00 по Москве'],
        ['15 ониксов за серию 7 дней', 'Вместо 12 на Серебре'],
        ['Приоритет заказов', 'Менеджер видит пометку «Приоритет»'],
        ['Промокод −1,5% раз в месяц', 'На одну категорию, выпадает случайно'],
        ['Рамка «Золото»', 'Доступна со статусом Золото']] },
      { key: 'platinum', name: 'Платина', alias: ['эксперт'], min: 4000, tasks: 6, streak: 17, spins: 1, priority: 'Высокий', boost: 1, pack: 'pre10', perks: [
        ['Доступны 6 заданий', 'Как на Золоте'],
        ['1 бесплатная посылка в день', 'Обновляется в 00:00 по Москве'],
        ['17 ониксов за серию 7 дней', 'Вместо 15 на Золоте'],
        ['Высокий приоритет заказов', 'Менеджер берёт их раньше'],
        ['Промокод −1,5% на любой товар', 'Раз в месяц'],
        ['Шансы в посылке выше', 'Пустые призы выпадают реже'],
        ['−10% на упаковку предзаказа', 'Раз в месяц, отмечается в корзине'],
        ['Рамка «Платина»', 'Доступна со статусом Платина']] },
      { key: 'diamond', name: 'Алмаз', alias: ['икона'], min: 8000, tasks: 6, streak: 20, spins: 3, priority: 'Наивысший', boost: 2, pack: 'free', perks: [
        ['Доступны 6 заданий', 'Как на Платине'],
        ['3 бесплатные посылки в день', 'Шансы выше, чем на Платине'],
        ['20 ониксов за серию 7 дней', 'Вместо 17 на Платине'],
        ['Наивысший приоритет заказов', 'Менеджер берёт их первыми'],
        ['3 промокода −2,5% в месяц', 'По одному в неделю'],
        ['Промокод −1,5% на любой товар', 'Раз в месяц'],
        ['Бесплатная упаковка предзаказа', 'Раз в месяц, отмечается в корзине'],
        ['Рамка «Алмаз» с анимацией', 'Анимацию можно выбрать']] }
    ],
    // категории для промокода уровня Золото
    promoCats: [
      { key: 'shoes', label: 'Обувь', cats: ['shoes'] },
      { key: 'clothes', label: 'Одежда', cats: ['hoodies', 'tees', 'pants'] },
      { key: 'outer', label: 'Куртки', cats: ['outerwear'] },
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
      { per: 'd', key: 'outer', title: 'Посмотреть 2 куртки или худи', hint: 'Куртки и худи', m: 'viewcat', cats: ['outerwear', 'hoodies'], n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'basic', title: 'Посмотреть футболки или штаны', hint: 'Две любые карточки', m: 'viewcat', cats: ['tees', 'pants'], n: 2, tk: 3, xp: 10 },
      { per: 'd', key: 'acc', title: 'Посмотреть аксессуары', hint: 'Любой аксессуар', m: 'viewcat', cats: ['accessories'], n: 1, tk: 3, xp: 10 },
      { per: 'd', key: 'spin', title: 'Открыть посылку', hint: 'Бесплатная посылка раз в день', m: 'spin', n: 1, tk: 3, xp: 10 },

      { per: 'w', key: 'w_days', title: 'Заходить 5 дней за неделю', hint: 'Нажимайте «Отметиться» в кабинете', m: 'checkin', n: 5, tk: 25, xp: 60 },
      { per: 'w', key: 'w_view20', title: 'Посмотреть 20 разных товаров', hint: 'За неделю', m: 'view', n: 20, tk: 25, xp: 60 },
      { per: 'w', key: 'w_fav5', title: 'Добавить 5 товаров в избранное', hint: 'Отложите то, что понравилось', m: 'fav', n: 5, tk: 25, xp: 60 },
      { per: 'w', key: 'w_cart3', title: 'Положить в корзину 3 товара', hint: 'Три разных товара', m: 'cart', n: 3, tk: 25, xp: 60 },
      { per: 'w', key: 'w_share3', title: 'Поделиться 3 товарами', hint: 'Отправьте друзьям', m: 'share', n: 3, tk: 25, xp: 60 },
      { per: 'w', key: 'w_cats', title: 'Посмотреть товары из 4 категорий', hint: 'Обувь, куртки, худи, аксессуары…', m: 'cats', n: 4, tk: 25, xp: 60 },
      { per: 'w', key: 'w_spin3', title: 'Открыть 3 посылки', hint: 'За неделю', m: 'spin', n: 3, tk: 25, xp: 60 },
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
    /* Рамки. Три группы: level (статус, только свой), wheel (выпадает только в «Посылке с сюрпризом», r: редкость 1..5),
       ach (эксклюзив за достижение магазина или этап игры). Рамка не даёт никаких привилегий. */
    frames: [
      { id: 'base', name: 'Без рамки' },
      { id: 'lvl-bronze', name: 'Бронза', src: 'level', lvl: 0 },
      { id: 'lvl-silver', name: 'Серебро', src: 'level', lvl: 1 },
      { id: 'lvl-gold', name: 'Золото', src: 'level', lvl: 2 },
      { id: 'lvl-platinum', name: 'Платина', src: 'level', lvl: 3 },
      { id: 'lvl-diamond', name: 'Алмаз', src: 'level', lvl: 4 },
      { id: 'mint', name: 'Мятный леденец', src: 'wheel', r: 1 },
      { id: 'rose', name: 'Роза', src: 'wheel', r: 1 },
      { id: 'violet', name: 'Фиалка', src: 'wheel', r: 1 },
      { id: 'sky', name: 'Облака', src: 'wheel', r: 1 },
      { id: 'lime', name: 'Долька лайма', src: 'wheel', r: 1 },
      { id: 'amber', name: 'Янтарные бусы', src: 'wheel', r: 2 },
      { id: 'coral', name: 'Коралл', src: 'wheel', r: 2 },
      { id: 'ice', name: 'Лёд', src: 'wheel', r: 2 },
      { id: 'neon', name: 'Неон', src: 'wheel', r: 3 },
      { id: 'gold', name: 'Солнце', src: 'wheel', r: 3 },
      { id: 'sunset', name: 'Закат', src: 'wheel', r: 3 },
      { id: 'aurora', name: 'Аврора', src: 'wheel', r: 4 },
      { id: 'rainbow', name: 'Радуга', src: 'wheel', r: 4 },
      { id: 'cosmos', name: 'Космос', src: 'wheel', r: 5 },
      { id: 'flame', name: 'Пламя', src: 'wheel', r: 5 },
      { id: 'ach-china', name: 'Маршрут', src: 'ach', ach: 'china' },
      { id: 'ach-loyal', name: 'Лавры', src: 'ach', ach: 'five' },
      { id: 'ach-critic', name: 'Пять звёзд', src: 'ach', ach: 'review5' },
      { id: 'ach-friend', name: 'Сцепка', src: 'ach', ach: 'friend' },
      { id: 'gz-1', name: 'Накладная', src: 'game', game: 'gruz', how: 'Грузомания: склад 5 уровня' },
      { id: 'gz-2', name: 'Грузовой хаб', src: 'game', game: 'gruz', how: 'Грузомания: склад 10 уровня' },
      { id: 'rb-1', name: 'Застава', src: 'game', game: 'rub', how: 'Последний рубеж: победить первого босса' },
      { id: 'rb-2', name: 'Последний рубеж', src: 'game', game: 'rub', how: 'Последний рубеж: победить всех 6 боссов' }
    ],
    rarity: [null, { name: 'Обычная', w: 40 }, { name: 'Необычная', w: 28 }, { name: 'Редкая', w: 18 }, { name: 'Эпическая', w: 10 }, { name: 'Легендарная', w: 4 }],
    // достижения: только значки и рамки, без ониксов; однажды полученные не пропадают
    achv: [
      { id: 'first', name: 'Первый заказ', d: 'Получить заказ', ic: 'bag' },
      { id: 'china', name: 'Дальний рейс', d: 'Получить заказ из Китая', ic: 'plane', frame: 'ach-china' },
      { id: 'five', name: 'Пять образов', d: 'Получить 5 заказов', ic: 'trophy', frame: 'ach-loyal' },
      { id: 'ten', name: 'Гардероб', d: 'Получить 10 заказов', ic: 'crown' },
      { id: 'review', name: 'Своё мнение', d: 'Оставить первый отзыв', ic: 'chat' },
      { id: 'review5', name: 'Знаток', d: 'Оставить 5 отзывов', ic: 'star', frame: 'ach-critic' },
      { id: 'friend', name: 'Душа компании', d: 'Друг сделал первый заказ', ic: 'users', frame: 'ach-friend' },
      { id: 'collector', name: 'Коллекционер', d: 'Собрать 3 рамки из посылок', ic: 'frame' },
      { id: 'streak', name: 'Семь дней', d: 'Заходить 7 дней подряд', ic: 'flame' },
      { id: 'bday', name: 'Свой праздник', d: 'Открыть подарок на день рождения', ic: 'gift' }
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
  // первая привилегия каждого уровня считается из taskCount(): числа не расходятся с правилами выдачи заданий
  RULES.levels.forEach(function (L, i) {
    L.perks[0] = ['Ежедневных заданий: ' + taskCount('d', i), 'Еженедельных: ' + taskCount('w', i) + ', ежемесячных: ' + taskCount('m', i)];
  });
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
      if (f.src === 'level') return li === f.lvl; // статусная рамка только своего статуса
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
    // Золото: −1,5% на случайную категорию; Платина и выше: −1,5% на любой товар (раз в месяц)
    if (li >= 2) {
      var p15 = (u.promos || []).filter(function (p) { return p.kind === 'lvl15' && p.exp === mk; })[0];
      if (!p15) {
        var c = li >= 3 ? null : RULES.promoCats[Math.floor(db.random() * RULES.promoCats.length)];
        var pr = { code: genCode(db, li >= 3 ? 'PLAT' : 'GOLD', 5), pct: 1.5, kind: 'lvl15', exp: mk, from: li >= 3 ? 'Платина · любой товар' : 'Золото · ' + c.label, at: now };
        if (c) { pr.cat = c.key; pr.catLabel = c.label; }
        u.promos.push(pr); log(db, u, 0, 'Промокод −1,5%' + (c ? ' на «' + c.label + '»' : ' на любой товар') + ' за уровень ' + L.name);
      } else if (li >= 3 && p15.cat && !p15.used) {
        delete p15.cat; delete p15.catLabel; p15.from = 'Платина · любой товар';
        log(db, u, 0, 'Промокод ' + p15.code + ' теперь действует на любой товар (Платина)');
      }
    }
    // Алмаз: 3 промокода −2,5% в месяц, по одному в неделю
    if (li >= 4) {
      if (u.perkDiaMonth !== mk) { u.perkDiaMonth = mk; u.perkDiaN = 0; }
      if ((u.perkDiaN || 0) < 3 && (!u.perkDiaN || now - (+u.perkDiaAt || 0) >= 7 * 86400000)) {
        u.perkDiaN = (u.perkDiaN || 0) + 1; u.perkDiaAt = now;
        u.promos.push({ code: genCode(db, 'DIAM', 5), pct: 2.5, kind: 'lvl25', exp: mk, from: 'Алмаз · неделя ' + u.perkDiaN + ' из 3', at: now });
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
  function earlyLeft(prod, now) { var t = prod && prod.date ? Date.parse(prod.date) : 0; if (!t) return 0; var left = t + RULES.early.hours * 3600000 - now; return left > 0 ? left : 0; }
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
      id: u.id, code: 'OS' + u.id, login: u.login, name: u.name, phone: u.phone, tg: u.tg, email: u.email || '', avatar: u.avatar || '',
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
    var login = cleanLogin(p.login), pass = String(p.password || ''), name = String(p.name || '').trim();
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
    if (tg && db.findUser('tg', tg.toLowerCase())) return err('Этот Telegram уже привязан к другому аккаунту');
    if (db.findUser('phone', ph)) return err('Этот телефон уже привязан к другому аккаунту');
    var bad = checkCode(db, 'register', email, p.code); if (bad) return bad;
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
    if (!u || hashPass(db, u.salt, String(p.password || '')) !== u.hash) {
      if (db.failedLogin) db.failedLogin(login);
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
    db.saveUser(u);
    return ok({ user: publicUser(db, u), settings: settings() });
  };

  A.profile = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth'); var bdayNow = false;
    if (p.name != null) { var n = String(p.name).trim(); if (n.length < 2) return err('Укажите имя'); u.name = n; }
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
    if (u.tgChat && db.userNotify) { try { db.userNotify(u, '🎂 С днём рождения, ' + firstName(u.name) + '! Подарок уже в кабинете: ' + B.tokens + ' ониксов (≈ ' + tokensToRub(B.tokens) + ' ₽), ' + B.xp + ' XP и промокод ' + code + ' на −' + pctText(B.promoPct) + '%.'); } catch (e) {} }
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

  /* рамка из посылки: сначала редкость по весам (только из ещё не открытых), потом рамка этой редкости.
     «Редкая рамка» даёт эпическую или легендарную, если они ещё есть, иначе любую неоткрытую. */
  function pickFrame(db, u, rare) {
    var left = RULES.frames.filter(function (f) { return f.src === 'wheel' && (u.frames || []).indexOf(f.id) < 0; });
    if (rare && left.some(function (f) { return f.r >= 4; })) left = left.filter(function (f) { return f.r >= 4; });
    if (!left.length) return null;
    var byR = {}, sum = 0, r;
    left.forEach(function (f) { byR[f.r] = byR[f.r] || []; byR[f.r].push(f); });
    for (r in byR) sum += RULES.rarity[r].w;
    var x = db.random() * sum, t = 0, pick = null;
    for (r in byR) { t += RULES.rarity[r].w; if (x < t) { pick = byR[r]; break; } }
    pick = pick || byR[Object.keys(byR)[0]];
    return pick[Math.floor(db.random() * pick.length)];
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
      var f = pickFrame(db, u, prize.frame === 'rare');
      if (f) { u.frames.push(f.id); result.frameId = f.id; result.frameName = f.name; result.frameR = f.r; result.frameRarity = RULES.rarity[f.r].name; }
      else { var e2 = earn(db, u, 50, 'Посылка: все рамки уже открыты'); result.tokens = e2.tok; result.sub = 'все рамки открыты: +50 ониксов'; if (e2.xp) { result.capXp = e2.xp; result.cap = RULES.balanceCap; } }
    }
    track(db, u, 'spin'); settle(db, u);
    db.saveUser(u);
    result.free = free;
    return ok({ prize: result, index: idx, user: publicUser(db, u) });
  };

  // ---------------------------------------------------------------- игры «Грузомания» и «Последний рубеж»
  /* Игры считаются в браузере, сервер хранит сохранение (строка JSON) и выдаёт рамки за этапы.
     Магазину игры пока ничего не дают: ни ониксов, ни опыта. Защита рамок: этап засчитывается не раньше
     минимального времени игры с первого сохранения (честно так быстро не дойти). */
  var GAMES = {
    gruz: { name: 'Грузомания', frames: [{ id: 'gz-1', key: 'lvl', need: 5, minMin: 25 }, { id: 'gz-2', key: 'lvl', need: 10, minMin: 120 }] },
    rub: { name: 'Последний рубеж', frames: [{ id: 'rb-1', key: 'bosses', need: 1, minMin: 15 }, { id: 'rb-2', key: 'bosses', need: 6, minMin: 180 }] }
  };
  var GAME_MAX = 150000;
  function gameMeta(u, g) { u.gm = u.gm && typeof u.gm === 'object' ? u.gm : {}; return (u.gm[g] = u.gm[g] || { first: 0, rev: 0, saves: 0, play: 0 }); }
  A.gameLoad = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var g = String(p.game || ''); if (!GAMES[g]) return err('Нет такой игры');
    var m = gameMeta(u, g), d = db.gameGet ? db.gameGet(u.id, g) : null;
    return ok({ data: d || '', rev: m.rev || 0, now: db.now() });
  };
  A.gameSave = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var g = String(p.game || ''), G = GAMES[g]; if (!G) return err('Нет такой игры');
    var data = String(p.data || ''); if (!data || data.length > GAME_MAX) return err('Сохранение слишком большое');
    var st; try { st = JSON.parse(data); } catch (e) { return err('Повреждённое сохранение'); }
    var m = gameMeta(u, g), now = db.now();
    if ((+p.base || 0) < (m.rev || 0)) return ok({ conflict: true, data: db.gameGet(u.id, g) || '', rev: m.rev });
    if (!m.first) m.first = now;
    m.rev = (m.rev || 0) + 1; m.saves = (m.saves || 0) + 1; m.at = now;
    var ms = st && st.ms && typeof st.ms === 'object' ? st.ms : {}, got = [];
    u.frames = u.frames || ['base'];
    G.frames.forEach(function (f) {
      if ((+ms[f.key] || 0) >= f.need && u.frames.indexOf(f.id) < 0 && now - m.first >= f.minMin * 60000 && m.saves >= 5) {
        u.frames.push(f.id); got.push({ id: f.id, name: (RULES.frames.filter(function (x) { return x.id === f.id; })[0] || {}).name });
      }
    });
    db.gameSet(u.id, g, data, now);
    if (got.length) settle(db, u);
    db.saveUser(u);
    var res = { rev: m.rev, frames: got };
    if (got.length) res.user = publicUser(db, u);
    return ok(res);
  };

  // ---------------------------------------------------------------- заказ
  function checkFields(f, hasStock, hasPre) {
    if (String(f.name || '').trim().length < 2) return 'Укажите имя';
    var d = digits(f.phone); if (d.length < 10 || d.length > 15) return 'Укажите телефон';
    var tgv = cleanTg(f.tg); if (tgv && !validTg(tgv)) return 'Проверьте username в Telegram или оставьте поле пустым';
    if (hasStock) { if (!RECV[f.recv]) return 'Выберите способ получения'; if (f.recv === 'city' && String(f.recvCity || '').trim().length < 2) return 'Укажите город'; }
    if (hasStock && hasPre && f.together !== 'together' && f.together !== 'separate') return 'Выберите: получить всё вместе или раздельно';
    if (hasPre) {
      if (!SHIP[f.ship]) return 'Выберите способ отправки из Китая';
      if (String(f.city || '').trim().length < 2) return 'Укажите город для предзаказа';
      if (!PRE_RECV[f.preRecv]) return 'Выберите способ получения предзаказа';
      if (f.ack !== true) return 'Подтвердите, что прочитали условия предзаказа';
    }
    return null;
  }
  function whenText(ms) { var d = msk(ms); return pad(d.getUTCDate(), 2) + '.' + pad(d.getUTCMonth() + 1, 2) + '.' + d.getUTCFullYear() + ', ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ' (МСК)'; }

  /** Текст заказа для менеджера. o: {no, at, f (поля анкеты), lines:[{title,status,size,color,photoNo,note,qty,price,link}], total, tokens, tokenRub, promo, promoRub, toPay, user} */
  function orderText(o) {
    var f = o.f, L = [], hasPre = false, hasStock = false, hasOut = false, cnt = 0;
    L.push('🛍 ЗАКАЗ ONION SHOP · №' + o.no);
    if (o.f.vip === true) L.push('⚡ ПРИОРИТЕТНЫЙ ЗАКАЗ (+' + RULES.vipPrice + ' ₽, оплачено в заказе), клиент просит уделить заказу особое внимание');
    if (o.priority) L.push('⭐ ПРИОРИТЕТ: ' + o.priority.toUpperCase() + ' (уровень ' + o.user.levelName + ')');
    L.push('📅 ' + whenText(o.at));
    L.push('');
    L.push('👤 ПОКУПАТЕЛЬ');
    L.push('Имя: ' + String(f.name).trim());
    L.push('Телефон: ' + fmtPhone(f.phone));
    L.push(cleanTg(f.tg) ? 'Telegram: @' + cleanTg(f.tg) : 'Telegram: нет username, связаться по телефону');
    if (o.user) L.push('Аккаунт: ' + o.user.login + ' · ID OS' + o.user.id + ' · уровень «' + o.user.levelName + '»');
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
      if (opt.length) L.push('   ' + opt.join(' · '));
      if (l.note) L.push('   Пожелания: ' + l.note);
      L.push('   ' + l.qty + ' шт × ' + rub(l.price) + ' = ' + rub(l.price * l.qty));
      if (l.link) L.push('   ' + l.link);
    });
    L.push('');
    L.push('💰 Сумма: ' + rub(o.total) + ' · ' + cnt + ' шт');
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
      L.push('✈️ ПРЕДЗАКАЗ, отправка из Китая: ' + SHIP[f.ship] + ', город, ' + String(f.city).trim() + ', получение, ' + PRE_RECV[f.preRecv]);
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
      if (prod && prod.status === 'sold') { gone.push(prod.title || it.id); return; }
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
    if (su) { // контакты, из профиля; профиль должен быть заполнен
      if (String(su.name || '').trim().length < 2 || phoneKey(su.phone || '').length < 10) return err('Заполните имя и телефон в кабинете перед заказом');
      f = Object.assign({}, f, { name: su.name, phone: su.phone, tg: su.tg || '' });
    }
    var built = buildLines(db, p.items);
    if (built.gone.length) return err('Уже продано: ' + built.gone.join(', ') + '. Уберите из корзины и попробуйте снова');
    if (!built.lines.length) return err('Корзина пуста');
    if (!su || levelOf(su).index < RULES.early.level) {
      for (var ei = 0; ei < built.lines.length; ei++) { var ep = db.product ? db.product(built.lines[ei].id) : null, el = earlyLeft(ep, db.now());
        if (el) return err('«' + built.lines[ei].title + '» откроется для всех через ' + Math.ceil(el / 3600000) + ' ч. Первые сутки новинки доступны уровню «Золото» и выше'); }
    }
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
      count: cnt, total: total, tokens: tokens, tokenRub: tokenRub, promo: promo, promoRub: promoRub, vipRub: vipRub, toPay: toPay, priority: f.vip === true ? '⚡ Приоритетный' + (priority ? ' · ' + priority : '') : (priority || (u ? 'Обычный' : '')), pack: pack, level: li ? li.name : '',
      kind: hasPre && hasStock ? 'смешанный' : hasPre ? 'предзаказ' : (hasOut && !built.lines.some(function (l) { return l.status === 'stock'; })) ? 'временно нет' : 'в наличии', comment: String(f.comment || '').trim(), text: text
    };
    if (u && taskRew.length) order.taskRew = JSON.stringify(taskRew);
    db.saveOrder(order);
    if (u && u.tgChat && db.userNotify) { try { db.userNotify(u, '🧾 Заказ ' + no + ' принят. Сумма к оплате: ' + toPay + ' ₽.\nМенеджер скоро свяжется с вами. Статусы заказа будут приходить сюда.', [[{ text: '📦 Подробнее о заказе', callback_data: 'm|' + no }]]); } catch (e) { /* не критично */ } }
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
  A.tgUnlink = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    u.tgChat = ''; u.tgName = ''; db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };
  A.tgCats = function (db, p) {
    var u = sessionUser(db, p); if (!u) return err('auth');
    var l = (Array.isArray(p.cats) ? p.cats : []).map(function (c) { return String(c).replace(/[^\w-]/g, '').slice(0, 24); }).filter(Boolean).slice(0, 12);
    u.tgCats = l.join(','); db.saveUser(u);
    return ok({ user: publicUser(db, u) });
  };
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
    var tokens = text.length >= 20 ? RULES.reward.reviewText : RULES.reward.review;
    touch(db, u);
    db.reviewAdd({ at: db.now(), no: no, userId: u.id, login: u.login, name: firstName(u.name), productId: pid, title: it.title, rating: rating, text: text, status: 'опубликован', reward: tokens });
    log(db, u, tokens, 'Отзыв на товар «' + String(it.title).slice(0, 40) + '»');
    track(db, u, 'review'); settle(db, u); db.saveUser(u);
    return ok({ reward: tokens, user: publicUser(db, u) });
  };
  A.reviews = function (db, p) {
    var rows = (db.reviewsFor ? db.reviewsFor(String(p.productId || '')) : []) || [], sum = 0;
    rows.forEach(function (r) { sum += +r.rating || 0; });
    return ok({ count: rows.length, avg: rows.length ? Math.round(sum / rows.length * 10) / 10 : 0,
      list: rows.slice(0, 20).map(function (r) { return { name: r.name, rating: +r.rating, text: r.text, at: r.at }; }) });
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
    if (!A[action]) return err('Неизвестное действие');
    return A[action](db, p || {});
  }

  return {
    RULES: RULES, handle: handle, orderText: orderText, buildLines: buildLines, checkFields: checkFields,
    offlineNo: offlineNo, levelInfo: levelInfo, levelOf: levelOf, fixIndex: fixIndex, receive: receive, priceDrops: priceDrops, photoLinks: photoLinks, earlyLeft: earlyLeft, phoneConfirm: phoneConfirm, flag: flag, referralOnReceive: referralOnReceive, orderCanceled: orderCanceled, canonEmail: canonEmail, bdayIsToday: bdayIsToday, adjustTokens: adjustTokens, xpOfRub: xpOfRub, wheelFor: wheelFor, framesFor: framesFor, pctText: pctText, promoBase: promoBase, touch: touch, tokensToRub: tokensToRub, settings: settings, dayKey: dayKey, monthKey: monthKey,
    statusMessage: statusMessage, tgBind: tgBind,
    GAMES: GAMES,
    cleanTg: cleanTg, cleanEmail: cleanEmail, phoneKey: phoneKey, fmtPhone: fmtPhone, digits: digits, validEmail: validEmail, taskPick: picksFor, weekKey: weekKey, stagesFor: stagesFor
  };
})();
if (typeof module !== 'undefined') module.exports = OnionCore;
