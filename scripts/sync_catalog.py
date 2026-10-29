#!/usr/bin/env python3
"""
Каталог ONION SHOP из Telegram-канала.

Как это работает
  Скрипт читает публичную страницу канала (t.me/s/<канал>), находит посты
  с товарами и собирает из них data/catalog.js и фотографии в img/.
  Ничего вручную править не нужно: публикуете товар в канале как обычно —
  он появляется на сайте при следующем запуске (GitHub Actions, раз в час).

Правила, по которым пост считается товаром
  • в посте есть строка «цена: …» с числом;
  • зачёркнутая цена — это старая цена (показывается перечёркнутой);
  • слова «товар продан» (или «продано», «sold out») — товар скрывается с сайта;
  • слова «по предзаказу» — товар попадает во вкладку «Предзаказ»,
    иначе — «В наличии»;
  • слова «временно нет в наличии» (или «временно отсутствует», «закончился»,
    «ожидается поступление») — товар остаётся на сайте с пометкой
    «Временно нет в наличии»; заказ можно оформить, менеджер уточнит срок;
  • альбом с фото без текста, опубликованный следом (до 30 минут),
    добавляется к фотографиям предыдущего товара.

Запуск
  python scripts/sync_catalog.py --channel ONION_SHOP_OFFICIAL
  python scripts/sync_catalog.py --export ChatExport/result.json   (выгрузка из Telegram Desktop)
"""
from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
IMG_FULL = os.path.join(ROOT, "img", "full")
IMG_THUMB = os.path.join(ROOT, "img", "thumb")
UPLOADS_DIR = os.path.join(ROOT, "data", "uploads")
CATALOG_JS = os.path.join(DATA_DIR, "catalog.js")
OVERRIDES_JSON = os.path.join(DATA_DIR, "overrides.json")

FULL_MAX = 1000  # px по длинной стороне
THUMB_MAX = 520
ALBUM_GAP = 3          # секунд между фото одного альбома (выгрузка)
ATTACH_GAP = 30 * 60   # альбом без текста прикрепляется к товару, если вышел не позже чем через 30 мин
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

STRIKE_L, STRIKE_R = "⟦", "⟧"   # ⟦ ⟧ — пометка зачёркнутого текста

# ---------------------------------------------------------------- категории
CATEGORIES = [
    ("shoes", "Обувь", ["кроссовк", "кеды", "кед ", "мокасин", "ботин", "туфл", "лофер", "слайд", "сланц", "сапог", "обувь", "air force", "dunk"]),
    ("outerwear", "Куртки", ["куртк", "пуховик", "пальто", "ветровк", "жилет", "бомбер", "парка"]),
    ("hoodies", "Худи и свитеры", ["худи", "толстовк", "свитер", "свитшот", "кардиган", "джемпер", "лонгслив", "зип", "кофт", "пуловер", "флис", "олимпийк", "водолазк"]),
    ("tees", "Футболки и поло", ["футболк", "поло", "майк", "рубашк", "топ "]),
    ("pants", "Штаны", ["штаны", "брюки", "джинс", "шорты", "джоггер"]),
    ("accessories", "Аксессуары", ["галстук", "кошел", "сумк", "рюкзак", "запонк", "ремен", "ремн", "очки", "кепк", "шапк", "шарф", "платок", "носки", "набор", "комплект", "часы", "браслет", "цепь", "бумажник", "портмоне"]),
]
SHOE_WORDS = CATEGORIES[0][2]

BRANDS = [
    "Polo Ralph Lauren", "Ralph Lauren", "Comme Des Garçons Play", "Comme Des Garcons Play", "Comme Des Garçons",
    "Bape x Comme Des Garçons Play", "Maison Margiela", "Louis Vuitton", "Moose Knuckles", "Paul&Shark", "Paul & Shark",
    "Stone Island", "Off-White", "Balenciaga", "Gucci", "Prada", "Dior", "Chanel", "Moschino", "Montblanc", "MONTBLANC",
    "Supreme", "Nike", "Adidas", "New Balance", "Hollister", "Abercrombie", "BAPE", "Bape", "BOSS", "Hugo Boss",
    "GLO GANG", "Stockmann", "Henderson", "Mante", "OSKO", "Clingendale", "Jake’s collection", "Jake's collection",
    "ZASPORT", "Bench", "HAZE&FINN", "Stussy", "Carhartt", "The North Face", "Lacoste", "Tommy Hilfiger", "Calvin Klein",
    "Burberry", "Versace", "Armani", "Diesel", "Levi's", "Vans", "Converse", "Puma", "Reebok", "Asics", "Salomon",
]

LETTER_SIZE = {"М": "M", "Х": "X", "Л": "L", "С": "S"}


def norm_space(s: str) -> str:
    return re.sub(r"[ \t ]+", " ", s).strip()


def strip_decor(s: str) -> str:
    """Убирает эмодзи и значки в начале/конце строки."""
    s = re.sub(r"^[^\wА-Яа-яЁё(«\"']+", "", s)
    s = re.sub(r"[^\wА-Яа-яЁё)».!?\"'%²]+$", "", s)
    return s.strip()


def cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def parse_numbers(s: str):
    """'⟦1300⟧ 1200' -> [(1300, True), (1200, False)]; '95.000 80.000' -> [(95000,..),(80000,..)]"""
    out = []
    pos = 0
    for m in re.finditer(re.escape(STRIKE_L) + r"(.*?)" + re.escape(STRIKE_R) + r"|(\d[\d .,]*\d|\d)", s):
        if m.group(1) is not None:
            for n in re.findall(r"\d[\d .,]*\d|\d", m.group(1)):
                v = to_int(n)
                if v:
                    out.append((v, True))
        else:
            v = to_int(m.group(2))
            if v:
                out.append((v, False))
    return out


def to_int(n: str):
    n = n.strip()
    # 95.000 / 12 650 / 19,000 — разделители тысяч
    if re.fullmatch(r"\d{1,3}([ .,]\d{3})+", n):
        n = re.sub(r"[ .,]", "", n)
    else:
        n = re.split(r"[ .,]", n)[0]
    try:
        v = int(n)
    except ValueError:
        return None
    return v if v > 0 else None


def split_list(value: str):
    value = value.replace(STRIKE_L, "").replace(STRIKE_R, "")
    parts = re.split(r"\s*[/,;]\s*|\s+и\s+", value)
    return [p.strip(" .") for p in parts if p.strip(" .")]


COLOR_NO = re.compile(
    r"^(.*?)\s*(?:\(\s*(?:фото\s*№?\s*)?(\d{1,2})\s*\)|[—–-]\s*(?:фото\s*№?\s*)?(\d{1,2})|\s+фото\s*№?\s*(\d{1,2}))\s*$",
    re.I,
)


def parse_colors(value: str):
    """'красный (7), голубой — 8, белый' -> (['красный', 'голубой', 'белый'], {'красный': 7, 'голубой': 8}).
    Номер — это номер фото в посте (1 — первое). Так цвет на сайте сам покажет своё фото."""
    names, photo_no = [], {}
    for part in split_list(value):
        m = COLOR_NO.match(part)
        if m:
            name = m.group(1).strip(" .:·").lower()
            num = int(next(g for g in m.groups()[1:] if g))
            if name:
                names.append(name)
                if num > 0:
                    photo_no[name] = num
            continue
        names.append(part.lower())
    return names, photo_no


def parse_sizes(value: str, is_shoes: bool):
    value = norm_space(value.replace(STRIKE_L, "").replace(STRIKE_R, ""))
    if not value:
        return []
    # 42,5 — один размер с дробью
    if re.fullmatch(r"\d{2},\d", value):
        return [value]
    m = re.fullmatch(r"(\d{2})\s*[-–—]\s*(\d{2})", value)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if is_shoes and 0 < b - a <= 12:
            return [str(x) for x in range(a, b + 1)]
        return [value.replace("-", "–")]
    if "/" in value:
        parts = [p.strip() for p in value.split("/") if p.strip()]
    elif re.fullmatch(r"([A-ZА-Я0-9]{1,4}\s*,\s*)+[A-ZА-Я0-9]{1,4}", value, re.I):
        parts = [p.strip() for p in value.split(",")]
    else:
        parts = [value]
    out = []
    for p in parts:
        if re.fullmatch(r"[A-Za-zА-Яа-я0-9]{1,4}", p):
            p = "".join(LETTER_SIZE.get(ch.upper(), ch.upper()) for ch in p)
        out.append(p)
    return out


def find_brand(title: str):
    low = title.lower().replace("ё", "е")
    best = None  # (позиция, -длина, бренд)
    for b in BRANDS:
        i = low.find(b.lower().replace("ё", "е"))
        if i >= 0:
            cand = (i, -len(b), b)
            if best is None or cand < best:
                best = cand
    if best:
        # сохраняем написание из поста
        i, n = best[0], -best[1]
        return title[i:i + n].strip()
    m = re.search(r"[A-Za-z][A-Za-z0-9&’'.\-]*(?:\s+[A-Za-z][A-Za-z0-9&’'.\-]*){0,1}", title)
    return m.group(0).strip() if m else ""


def find_category(title: str):
    low = " " + title.lower().replace("ё", "е") + " "
    best = None
    for key, label, words in CATEGORIES:
        for w in words:
            i = low.find(w)
            if i >= 0 and (best is None or i < best[0]):
                best = (i, key, label)
    if best:
        return best[1], best[2]
    return "other", "Другое"


SPEC_KEYS = re.compile(r"^(материал|состояние|состав|производство|страна|бренд|качество|комплект|комплектация|особенности|сезон|застежка|застёжка|подкладка|цвет|размер|страна производства|артикул|модель|коллекция|фасон|крой|посадка|длина рукава|тип)\b", re.I)

KEY_ALIASES = {
    "цена": "price",
    "размер": "sizes", "размеры": "sizes", "доступны размеры": "sizes", "доступные размеры": "sizes", "размерный ряд": "sizes",
    "цвет": "colors", "цвета": "colors", "доступные цвета": "colors", "доступны цвета": "colors", "расцветки": "colors",
    "качества": "Качество", "качество": "Качество",
}
STOP_MARKERS = ("whatsapp", "telegram:", "@onionshop_support", "sending & reviews", "sending &amp; reviews")


# --- «Главное о товаре»: то, что написано в посте (ничего не выдумываем) ---
FACT_RULES = [
    ("Состояние", [
        (r"нов(?:ое|ый|ая|ые)\s+(?:с|c)\s+бирк", "Новое, с биркой"),
        (r"(?:с|c)\s+бирк(?:ой|ами)", "С биркой"),
        (r"нов(?:ое|ый|ая|ые)\s+без\s+бирк", "Новое, без бирки"),
        (r"(?:идеальн|отличн)\w*\s+состояни", "Отличное состояние"),
        (r"как\s+нов", "Как новое"),
        (r"\bб\s*/\s*у\b|\bбу\b|был\w*\s+в\s+употреблени", "Б/у"),
        (r"нов(?:ое|ый|ая|ые)\b", "Новое"),
    ]),
    ("Материал", [
        (r"натуральн\w+\s+кож", "Натуральная кожа"), (r"натуральн\w+\s+замш", "Натуральная замша"),
        (r"натуральн\w+\s+шел[кг]|натуральн\w+\s+шёл", "Натуральный шёлк"), (r"\bшел[кг]|\bшёлк", "Шёлк"),
        (r"натуральн\w+\s+мех", "Натуральный мех"), (r"эко\s*-?\s*кож", "Экокожа"), (r"\bкожа\b|\bкожан", "Кожа"),
        (r"замш", "Замша"), (r"кашемир", "Кашемир"), (r"мериносов", "Шерсть мериноса"), (r"\bшерст", "Шерсть"),
        (r"100\s*%\s*хлоп|\bхлопок|\bхлопков", "Хлопок"), (r"\bлен\b|\bлён|\bлнян", "Лён"),
        (r"\bпух\b|пухов", "Пуховое наполнение"), (r"нейлон", "Нейлон"), (r"\bденим|\bджинс", "Деним"),
        (r"\bфлис", "Флис"), (r"велюр|вельвет", "Велюр / вельвет"), (r"\bгортекс|gore-?tex", "Gore-Tex"),
        (r"полиэстер", "Полиэстер"),
    ]),
    ("Подлинность", [(r"оригинал(?!ьн\w+\s+качеств)|подлинн|100\s*%\s*оригинал", "Оригинал"), (r"люкс\s*качеств|lux", "Люкс-качество")]),
    ("Комплект", [(r"в\s+комплекте[^.\n]{0,40}(?:коробк|упаковк)|(?:коробк|упаковк)\w*\s+в\s+комплекте", "С коробкой / упаковкой"), (r"в\s+комплекте[^.\n]{0,40}пыльник|пыльник\w*\s+в\s+комплекте", "С пыльником")]),
    ("Сделано", [(r"made\s+in\s+([a-z]+)", None)]),
    ("Подкладка", [(r"на\s+подкладк|подкладк", "Есть подкладка")]),
]
FACT_MAX = 6


def extract_facts(lines, have_labels):
    """Возвращает [[подпись, значение]] только по тому, что есть в тексте поста. Не дублирует уже найденные поля."""
    text = " \n".join(lines).lower().replace("ё", "е")
    have = {h.lower() for h in have_labels}
    out = []
    for label, rules in FACT_RULES:
        if label.lower() in have:
            continue
        found = []
        for rx, val in rules:
            m = re.search(rx, text)
            if not m:
                continue
            v = val if val is not None else m.group(1).capitalize()
            # «новое» не пишем, если уже нашли «новое, с биркой» и т.п.
            if label == "Состояние" and found:
                continue
            if v not in found and not any(v.lower() in f.lower() or f.lower() in v.lower() for f in found):
                found.append(v)
            if label in ("Состояние", "Подлинность", "Сезон", "Сделано", "Подкладка", "Комплект"):
                break
        if found:
            out.append([label, ", ".join(found[:3])])
    return out[:FACT_MAX]


def parse_post(text: str):
    """Текст поста (зачёркнутое в ⟦ ⟧) -> словарь товара или None."""
    if not text or not re.search(r"цена\s*:?\s*" + re.escape(STRIKE_L) + r"?\s*\d", text, re.I):
        return None
    low_all = text.lower()
    sold = bool(re.search(r"товар\s+продан|продано\b|продан[аоы]?\b|sold\s*out", low_all))
    preorder = "предзаказ" in low_all
    out_of_stock = (not preorder) and bool(re.search(
        r"временно\s+(?:нет|отсутству|законч|нет\s+в)|нет\s+в\s+наличии|закончил(?:ся|ась|ись)|ожидается\s+(?:поступление|завоз)|ожидаем\s+поступлени", low_all))

    raw_lines = [norm_space(l) for l in text.replace("\r", "").split("\n")]
    lines = []
    for l in raw_lines:
        if any(mk in l.lower() for mk in STOP_MARKERS):
            break
        lines.append(l)
    lines = [l for l in lines]
    # заголовок
    title_line = next((l for l in lines if l and not re.fullmatch(r"[—\-–━_=\s]+", l)), "")
    title_parts = [strip_decor(p) for p in title_line.split("|")]
    title = title_parts[0] if title_parts else ""
    subtitle = " · ".join(p for p in title_parts[1:] if p)
    if not title:
        return None
    is_shoes = any(w in (" " + title.lower() + " ") for w in SHOE_WORDS)

    price = old = None
    size_table, cur_size = {}, None
    sizes, colors, details, notes = [], [], [], []
    color_photos = {}
    pending = None  # ключ, значение которого на следующей строке
    started = False
    for l in lines:
        if l == title_line and not started:
            started = True
            continue
        if not l or re.fullmatch(r"[—\-–━_=\s]+", l):
            pending = None if not l else pending
            continue
        low = l.lower()
        if re.search(r"товар\s+продан|подобрать аналогичную|оформляется по предзаказу|по предзаказу|временно\s+нет|нет\s+в\s+наличии|временно\s+отсутству|ожидается\s+(?:поступление|завоз)|^продан[аоы]?\b", low):
            continue
        body = re.sub(r"^[•·●▪︎\-–—*>\s]+", "", l)
        # «Размер S» + строки замеров под ним -> таблица замеров по размерам
        mh = re.match(r"^размер\s+([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9,.\-–/ ]{0,8})$", body, re.I)
        if mh and not re.search(r"[:—]", body):
            cur_size = "".join(LETTER_SIZE.get(ch.upper(), ch.upper()) for ch in mh.group(1).strip()) if re.fullmatch(r"[A-Za-zА-Яа-я]{1,4}", mh.group(1).strip()) else mh.group(1).strip()
            size_table.setdefault(cur_size, [])
            continue
        mi = re.match(r"^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2}(?:[.,]\d)?)\s*[:—–-]\s*(.+)$", body)
        if mi and len(re.findall(r"[А-Яа-яA-Za-z ]{3,}?\s*\d+[.,]?\d*", mi.group(2))) >= 2:
            pairs = re.findall(r"([А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z ]{2,}?)\s*[—–:=-]?\s*(\d+(?:[.,]\d+)?)\s*(?:см)?", mi.group(2))
            if pairs:
                size_table.setdefault(mi.group(1), []).extend([[cap(a.strip()), b.replace('.', ',') + " см"] for a, b in pairs])
                continue
        if cur_size is not None:
            mm = re.match(r"^([А-Яа-яЁёA-Za-z ]{3,30}?)\s*[—–:-]\s*(\d[\d.,]*)\s*(см|cm|мм)?$", body)
            if mm:
                size_table[cur_size].append([cap(mm.group(1).strip()), mm.group(2).replace('.', ',') + " см"])
                continue
            cur_size = None
        m = re.match(r"^([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё ]{1,30}?)\s*:\s*(.*)$", body)
        if m:
            key_raw = m.group(1).strip().lower().replace("ё", "е")
            val = m.group(2).strip()
            key = KEY_ALIASES.get(key_raw, key_raw)
            if key == "price":
                nums = parse_numbers(val)
                struck = [v for v, s in nums if s]
                plain = [v for v, s in nums if not s]
                if plain:
                    price = plain[-1]
                    if struck:
                        old = struck[0]
                    elif len(plain) >= 2 and plain[0] > plain[-1]:
                        old = plain[0]
                elif struck:
                    price = struck[-1]
                pending = None
                continue
            if key in ("sizes", "colors"):
                if val:
                    if key == "sizes":
                        sizes = parse_sizes(val, is_shoes)
                    else:
                        colors, color_photos = parse_colors(val)
                    pending = None
                else:
                    pending = key
                continue
            label = cap(key if key[:1].isupper() else key_raw)
            if val:
                details.append([label, strip_decor(val) or val])
                pending = None
            else:
                details.append([label, ""])
                pending = ("detail", len(details) - 1)
            continue
        # строка без «ключ: значение»
        if pending == "sizes":
            sizes = parse_sizes(body, is_shoes)
            pending = None
            continue
        if pending == "colors":
            colors, color_photos = parse_colors(body)
            pending = None
            continue
        if isinstance(pending, tuple):
            i = pending[1]
            item = strip_decor(body)
            if item:
                details[i][1] = (details[i][1] + ", " if details[i][1] else "") + item
            continue
        # «ширина плеч — 40 см»
        m2 = re.match(r"^([А-Яа-яЁёA-Za-z ]{3,30}?)\s+[—–-]\s+(.+)$", body)
        if m2 and (re.search(r"\d", m2.group(2)) or SPEC_KEYS.search(m2.group(1))):
            details.append([cap(m2.group(1).strip()), m2.group(2).strip()])
            continue
        note = strip_decor(body)
        if note and len(note) > 2:
            notes.append(cap(note))

    if price is None:
        return None
    if old is not None and old <= price:
        old = None
    cat_key, cat_label = find_category(title)
    # «Носки … размер 41–47» — один универсальный размер
    item = {
        "title": title,
        "subtitle": subtitle,
        "brand": find_brand(title),
        "category": cat_key,
        "categoryLabel": cat_label,
        "status": "preorder" if preorder else ("out" if out_of_stock else "stock"),
        "price": price,
        "oldPrice": old,
        "sizes": sizes,
        "colors": colors,
        "details": [d for d in details if d[1]],
        "notes": notes[:14],
        "facts": extract_facts(lines, [d[0] for d in details if d[1]]),
        "sold": sold,
    }
    if color_photos:
        item["colorPhotos"] = color_photos
    size_table = {k: v for k, v in size_table.items() if v}
    if size_table:
        item["sizeTable"] = size_table
        if not item["sizes"]:
            item["sizes"] = list(size_table.keys())
    item["notes"] = [n for n in item["notes"] if not re.match(r"^размер\s+\S{1,8}$", n, re.I)]
    return llm_enrich(text, item)


# ---------------------------------------------------------------- «умный» разбор (по желанию)
LLM_CACHE_PATH = os.path.join(DATA_DIR, "llm_cache.json")
LLM_CATS = {"shoes", "outerwear", "hoodies", "tees", "pants", "accessories", "other"}
_llm_cache = None


def _cache():
    global _llm_cache
    if _llm_cache is None:
        try:
            _llm_cache = json.load(open(LLM_CACHE_PATH, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            _llm_cache = {}
    return _llm_cache


def llm_enrich(text: str, item: dict):
    """Если задан секрет ANTHROPIC_API_KEY, пост дополнительно читает нейросеть: понимает смысл
    независимо от шаблона (категория, бренд, цвета, размеры, замеры по размерам, материал и т.д.).
    Без ключа или при любой ошибке остаётся обычный разбор по правилам."""
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return item
    h = hashlib.md5(text.encode("utf-8")).hexdigest()
    cache = _cache()
    data = cache.get(h)
    if data is None:
        prompt = (
            "Ты разбираешь пост магазина одежды из Telegram. Верни ТОЛЬКО JSON без пояснений с ключами: "
            "brand (строка), category (одно из: shoes, outerwear, hoodies, tees, pants, accessories, other), "
            "colors (список названий цветов по-русски, строчными, как в посте), sizes (список размеров), "
            "size_table (объект: размер -> объект «название замера» -> «значение с единицей», только если замеры даны по размерам), "
            "measurements (список пар [название, значение] для замеров изделия без привязки к размеру), "
            "details (список пар [название, значение]: состояние, материал, состав, сезон и подобное; БЕЗ замеров, цены, размеров, цветов, контактов). "
            "Ничего не выдумывай — только то, что есть в посте.\n\nПОСТ:\n" + text.replace(STRIKE_L, "").replace(STRIKE_R, "")
        )
        body = json.dumps({"model": "claude-haiku-5-5", "max_tokens": 1500, "messages": [{"role": "user", "content": prompt}]}).encode("utf-8")
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                out = json.loads(r.read().decode("utf-8"))
            raw = "".join(b.get("text", "") for b in out.get("content", []))
            data = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
            cache[h] = data
            os.makedirs(DATA_DIR, exist_ok=True)
            json.dump(cache, open(LLM_CACHE_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        except Exception as e:  # noqa: BLE001
            print(f"  нейросеть: {e}", file=sys.stderr)
            return item
    try:
        if data.get("category") in LLM_CATS:
            labels = {k: l for k, l, _ in CATEGORIES}
            labels["other"] = "Другое"
            item["category"], item["categoryLabel"] = data["category"], labels[data["category"]]
        if str(data.get("brand") or "").strip():
            item["brand"] = str(data["brand"]).strip()
        if not item["colors"] and isinstance(data.get("colors"), list):
            item["colors"] = [str(c).strip().lower() for c in data["colors"] if str(c).strip()]
        if not item["sizes"] and isinstance(data.get("sizes"), list):
            item["sizes"] = [str(c).strip() for c in data["sizes"] if str(c).strip()]
        st = data.get("size_table")
        if not item.get("sizeTable") and isinstance(st, dict) and st:
            item["sizeTable"] = {str(k): [[cap(str(a)), str(b)] for a, b in v.items()] for k, v in st.items() if isinstance(v, dict) and v}
        have = {d[0].lower() for d in item["details"]}
        if isinstance(data.get("details"), list):
            for d in data["details"]:
                if isinstance(d, list) and len(d) == 2 and str(d[0]).strip().lower() not in have and str(d[1]).strip():
                    item["details"].append([cap(str(d[0]).strip()), str(d[1]).strip()])
                    have.add(str(d[0]).strip().lower())
        if isinstance(data.get("measurements"), list) and not item.get("sizeTable"):
            for d in data["measurements"]:
                if isinstance(d, list) and len(d) == 2 and str(d[0]).strip().lower() not in have:
                    item["details"].append([cap(str(d[0]).strip()), str(d[1]).strip()])
    except Exception as e:  # noqa: BLE001
        print(f"  нейросеть, разбор ответа: {e}", file=sys.stderr)
    return item


# ---------------------------------------------------------------- источники
class Post:
    __slots__ = ("id", "ts", "text", "photos")

    def __init__(self, pid, ts, text, photos):
        self.id = pid          # id первого сообщения альбома
        self.ts = ts           # unix time
        self.text = text       # текст с ⟦зачёркнутым⟧
        self.photos = photos   # [(photo_msg_id, источник: путь или url)]


def posts_from_export(path):
    d = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    msgs = [m for m in d.get("messages", []) if m.get("type") == "message"]
    posts = []
    for m in msgs:
        ts = int(m.get("date_unixtime") or 0)
        ents = m.get("text_entities") or []
        text = "".join(
            (STRIKE_L + e.get("text", "") + STRIKE_R) if e.get("type") == "strikethrough" else e.get("text", "")
            for e in ents
        )
        photos = [(m["id"], os.path.join(base, m["photo"]))] if m.get("photo") else []
        if posts and ts - posts[-1].ts <= ALBUM_GAP and (not text.strip() or not posts[-1].text.strip()):
            p = posts[-1]
            p.photos += photos
            p.ts = ts
            if text.strip():
                p.text = text
        else:
            posts.append(Post(m["id"], ts, text, photos))
    return posts


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru,en;q=0.8"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 3)
    raise RuntimeError(f"Не удалось загрузить {url}: {last}")


def html_text(node):
    from bs4 import NavigableString
    for s in node.find_all(["s", "del", "strike"]):
        s.replace_with(NavigableString(STRIKE_L + s.get_text() + STRIKE_R))
    for br in node.find_all("br"):
        br.replace_with(NavigableString("\n"))
    return node.get_text()


def posts_from_page(html_bytes):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_bytes, "html.parser")
    posts = []
    for msg in soup.select("div.tgme_widget_message[data-post]"):
        try:
            pid = int(msg["data-post"].rsplit("/", 1)[1])
        except (ValueError, IndexError):
            continue
        t = msg.select_one("time[datetime]")
        ts = 0
        if t:
            ts = int(datetime.fromisoformat(t["datetime"].replace("Z", "+00:00")).timestamp())
        text = ""
        for node in msg.select("div.tgme_widget_message_text"):
            if node.find_parent(class_="tgme_widget_message_reply"):
                continue
            text = html_text(node)
        photos = []
        for a in msg.select("a.tgme_widget_message_photo_wrap"):
            style = html.unescape(a.get("style", ""))
            mu = re.search(r"background-image:\s*url\(['\"]?([^'\")]+)['\"]?\)", style)
            if not mu:
                continue
            url = mu.group(1)
            if url.startswith("//"):
                url = "https:" + url
            mh = re.search(r"/(\d+)(?:\?single)?$", a.get("href", ""))
            photos.append((int(mh.group(1)) if mh else pid, url))
        posts.append(Post(pid, ts, text, photos))
    more = None
    for a in soup.select("a.tme_messages_more[data-before]"):
        more = a["data-before"]
    return posts, more


def posts_from_channel(channel, max_pages=60):
    seen = {}
    url = f"https://t.me/s/{channel}"
    before = None
    for _ in range(max_pages):
        page_url = url + (f"?before={before}" if before else "")
        page_posts, more = posts_from_page(fetch(page_url))
        new = [p for p in page_posts if p.id not in seen]
        for p in new:
            seen[p.id] = p
        if not more or not new or (before and int(more) >= int(before)):
            break
        before = more
        time.sleep(0.8)
    return sorted(seen.values(), key=lambda p: p.id)


# ---------------------------------------------------------------- сборка
def build_products(posts, channel):
    products = []
    last = None
    for p in posts:
        if p.text.strip():
            item = parse_post(p.text)
            if item:
                item["id"] = str(p.id)
                item["ts"] = p.ts
                item["_photos"] = list(p.photos)
                item["link"] = f"https://t.me/{channel}/{p.id}"
                products.append(item)
                last = item
            else:
                last = None
        elif p.photos and last is not None and p.ts - last["ts"] <= ATTACH_GAP:
            last["_photos"] += p.photos
            last["ts_extra"] = p.ts
    return products


def save_image(raw: bytes, photo_id: int):
    from PIL import Image, ImageOps
    os.makedirs(IMG_FULL, exist_ok=True)
    os.makedirs(IMG_THUMB, exist_ok=True)
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    full = im.copy()
    full.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
    full.save(os.path.join(IMG_FULL, f"{photo_id}.jpg"), "JPEG", quality=76, optimize=True, progressive=True)
    th = im.copy()
    th.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
    th.save(os.path.join(IMG_THUMB, f"{photo_id}.jpg"), "JPEG", quality=74, optimize=True, progressive=True)
    return full.size


def apply_overrides(products):
    """Ручные правки из data/overrides.json (их пишет редактор admin.html): {id: {price, title, hidden, ...}}.
    Правка сильнее текста поста, пока она есть в файле. Удалите её в редакторе — вернётся то, что в канале."""
    try:
        ov = json.load(open(OVERRIDES_JSON, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return products
    labels = {k: l for k, l, _ in CATEGORIES}
    labels["other"] = "Другое"
    out = []
    for p in products:
        o = ov.get(p["id"]) or {}
        if o.get("hidden"):
            continue
        for k in ("title", "subtitle", "brand"):
            if isinstance(o.get(k), str) and o[k].strip():
                p[k] = o[k].strip()
        for k in ("price", "oldPrice"):
            if k in o:
                v = o[k]
                p[k] = int(v) if isinstance(v, (int, float)) and v > 0 else (None if k == "oldPrice" else p[k])
        if o.get("status") in ("stock", "preorder", "out", "sold"):
            p["status"] = o["status"]
        if o.get("category") in labels:
            p["category"], p["categoryLabel"] = o["category"], labels[o["category"]]
        for k in ("colors", "sizes"):
            if isinstance(o.get(k), list):
                p[k] = [str(x).strip() for x in o[k] if str(x).strip()]
        if isinstance(o.get("extra"), list):
            for uid in o["extra"]:
                uid = str(uid)
                path = os.path.join(UPLOADS_DIR, uid + ".jpg")
                if re.fullmatch(r"u\d+", uid) and os.path.exists(path):
                    p["_photos"].append((uid, path))
        p["_order"] = [str(x) for x in o.get("photoOrder", [])] if isinstance(o.get("photoOrder"), list) else []
        p["_hide"] = {str(x) for x in o.get("photoHide", [])} if isinstance(o.get("photoHide"), list) else set()
        if isinstance(o.get("details"), list):
            p["details"] = [[str(a).strip(), str(b).strip()] for a, b in o["details"] if str(a).strip() and str(b).strip()]
        out.append(p)
    return out


def read_existing():
    if not os.path.exists(CATALOG_JS):
        return None
    try:
        s = open(CATALOG_JS, encoding="utf-8").read()
        s = s[s.index("{"): s.rindex("}") + 1]
        return json.loads(s)
    except Exception:  # noqa: BLE001
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", default="ONION_SHOP_OFFICIAL")
    ap.add_argument("--export", help="result.json из выгрузки Telegram Desktop (вместо сайта t.me)")
    args = ap.parse_args()

    if args.export:
        posts = posts_from_export(args.export)
        source = "export"
    else:
        posts = posts_from_channel(args.channel)
        source = "t.me"
    products = build_products(posts, args.channel)
    old = read_existing()
    old_meta = {p["id"]: p for p in (old or {}).get("products", [])}
    active = apply_overrides([p for p in products if not p["sold"]])

    # защита: если страница канала изменила формат и товаров не нашлось — каталог не трогаем
    if old and len(old.get("products", [])) >= 3 and len(active) == 0:
        print("Товары не найдены — похоже, страница канала изменилась. Каталог оставлен без изменений.", file=sys.stderr)
        sys.exit(2)

    # Фото скачиваем каждый раз (параллельно) и сравниваем с прежним отпечатком:
    # если фото в посте заменили, на сайте оно тоже заменится. Неизменённые фото не перезаписываются.
    from concurrent.futures import ThreadPoolExecutor

    def load(src):
        try:
            return open(src, "rb").read() if (source == "export" or os.path.exists(src)) else fetch(src, tries=2)
        except Exception as e:  # noqa: BLE001
            print(f"  фото {src}: {e}", file=sys.stderr)
            return None

    jobs = [(pid, src) for p in active for pid, src in p["_photos"]]
    with ThreadPoolExecutor(max_workers=8) as pool:
        raws = dict(zip([pid for pid, _ in jobs], pool.map(load, [src for _, src in jobs])))

    used = set()
    changed_photos = 0
    for p in active:
        hashes = set()
        files = []
        known = {f["id"]: f for f in old_meta.get(p["id"], {}).get("photos", [])}
        for photo_id, src in p.pop("_photos"):
            full_path = os.path.join(IMG_FULL, f"{photo_id}.jpg")
            raw = raws.get(photo_id)
            old_f = known.get(photo_id) if os.path.exists(full_path) else None
            if raw is None:
                if old_f and old_f.get("hash") not in hashes:  # не скачалось — оставляем прежнее фото
                    hashes.add(old_f.get("hash"))
                    files.append(old_f)
                    used.add(photo_id)
                continue
            h = hashlib.md5(raw).hexdigest()[:12]
            if old_f and old_f.get("hash") == h:
                if h in hashes:
                    continue
                hashes.add(h)
                files.append(old_f)
                used.add(photo_id)
                continue
            if old_f:
                changed_photos += 1
            if h in hashes:
                continue
            hashes.add(h)
            try:
                w, hh = save_image(raw, photo_id)
            except Exception as e:  # noqa: BLE001
                print(f"  фото {photo_id} не открылось: {e}", file=sys.stderr)
                continue
            files.append({"id": photo_id, "w": w, "ht": hh, "hash": h})
            used.add(photo_id)
        order, hide = p.pop("_order", []), p.pop("_hide", set())
        if order or hide:
            pos = {k: i for i, k in enumerate(order)}
            files.sort(key=lambda f: pos.get(str(f["id"]), len(order)))  # стабильная: остальные остаются по порядку
            kept = [f for f in files if str(f["id"]) not in hide]
            files = kept or files[:1]
        p["photos"] = files
        p.pop("sold", None)
        p.pop("ts_extra", None)
        p["date"] = datetime.fromtimestamp(p.pop("ts"), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    active = [p for p in active if p["photos"]]
    active.sort(key=lambda p: int(p["id"]), reverse=True)

    # удаляем фото товаров, которых больше нет
    for d in (IMG_FULL, IMG_THUMB):
        if os.path.isdir(d):
            for fn in os.listdir(d):
                m = re.fullmatch(r"(\d+|u\d+)\.jpg", fn)
                if m and m.group(1) not in {str(u) for u in used}:
                    os.remove(os.path.join(d, fn))

    catalog = {
        "channel": args.channel,
        "source": source,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "products": active,
    }
    # если товары не изменились — не меняем и дату, чтобы не было лишних коммитов
    if old and json.dumps(old.get("products"), sort_keys=True, ensure_ascii=False) == json.dumps(active, sort_keys=True, ensure_ascii=False):
        catalog["updatedAt"] = old.get("updatedAt", catalog["updatedAt"])
    os.makedirs(DATA_DIR, exist_ok=True)
    body = json.dumps(catalog, ensure_ascii=False, indent=1)
    with open(CATALOG_JS, "w", encoding="utf-8") as f:
        f.write("/* Файл создаётся автоматически из Telegram-канала. Вручную не редактируйте. */\n")
        f.write("window.ONION_CATALOG = " + body + ";\n")
    st = sum(1 for p in active if p["status"] == "stock")
    out = sum(1 for p in active if p["status"] == "out")
    print(f"Готово: {len(active)} товаров ({st} в наличии, {out} временно нет, {len(active) - st - out} по предзаказу), фото: {len(used)}, заменённых фото: {changed_photos}")


if __name__ == "__main__":
    main()
