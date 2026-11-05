"""Карта района «Грузомании 2»: один источник правды для рендера (gz2_art.py) и игры (assets/gz2/layout.json).
Запуск: python3 scripts/gz2_layout.py [папка]. Координаты в метрах: x вправо-вниз по карте, y вглубь; камера смотрит из (+x, -y)."""
import json, math, os, random, sys
R = random.Random(2026)
W = {'x0': -100, 'x1': 100, 'y0': -78, 'y1': 74}                 # границы мира (за ними лес и дальний город)
ROADS = [  # прямоугольники дорог (центр, ширина по x, ширина по y); широкие магистрали и улицы
    {'id': 'mainX', 'x': 0, 'y': 0, 'w': 200, 'd': 8}, {'id': 'southX', 'x': 0, 'y': -52, 'w': 200, 'd': 7},
    {'id': 'mainY', 'x': 0, 'y': -2, 'w': 8, 'd': 152}, {'id': 'westY', 'x': -62, 'y': -2, 'w': 7, 'd': 152}, {'id': 'eastY', 'x': 62, 'y': -2, 'w': 7, 'd': 152}]
# здания: type выбирает модель в Blender; door = точка входа (x, y) на земле перед дверью; name для подписи на карте
BUILDINGS = [
    {'id': 'wh', 'type': 'warehouse', 'name': 'Центральный склад', 'x': -31, 'y': -26, 'w': 28, 'd': 17, 'h': 8, 'door': [-31, -37.6]},
    {'id': 'dock', 'type': 'dock', 'name': 'Площадка приёмки', 'x': -31, 'y': -44, 'w': 26, 'd': 9, 'h': 0.2, 'door': [-31, -44]},
    {'id': 'shop', 'type': 'shop', 'name': 'Магазин и торговый зал', 'x': 22, 'y': -16, 'w': 18, 'd': 11, 'h': 5.5, 'door': [22, -23.3]},
    {'id': 'cafe', 'type': 'cafe', 'name': 'Кафе для сотрудников', 'x': 46, 'y': -14, 'w': 10, 'd': 8, 'h': 4.2, 'door': [46, -19.3]},
    {'id': 'pickup', 'type': 'pickup', 'name': 'Пункт выдачи', 'x': 50, 'y': -34, 'w': 9, 'd': 6, 'h': 3.8, 'door': [50, -37.7]},
    {'id': 'parking', 'type': 'parking', 'name': 'Парковка', 'x': 26, 'y': -38, 'w': 30, 'd': 14, 'h': 0.2, 'door': [26, -30]},
    {'id': 'market', 'type': 'market', 'name': 'Рынок поставщиков', 'x': -31, 'y': 24, 'w': 38, 'd': 20, 'h': 3.3, 'door': [-31, 12.5]},
    {'id': 'garage', 'type': 'garage', 'name': 'Гараж и мастерская', 'x': -49, 'y': 48, 'w': 15, 'd': 10, 'h': 5, 'door': [-49, 42.7]},
    {'id': 'supplier', 'type': 'supplier', 'name': 'Оптовый поставщик', 'x': -17, 'y': 50, 'w': 20, 'd': 13, 'h': 6.5, 'door': [-17, 43]},
    {'id': 'office', 'type': 'office', 'name': 'Офис компании', 'x': 24, 'y': 28, 'w': 13, 'd': 13, 'h': 17, 'door': [24, 21]},
    {'id': 'gas', 'type': 'gas', 'name': 'Заправка', 'x': 49, 'y': 15, 'w': 15, 'd': 9, 'h': 5.2, 'door': [49, 9.8]},
    {'id': 'factory', 'type': 'supplier', 'name': 'Фабрика одежды', 'x': 84, 'y': -24, 'w': 22, 'd': 15, 'h': 8.5, 'door': [84, -32]},
    {'id': 'house1', 'type': 'house', 'name': 'Жилой дом', 'x': -84, 'y': -20, 'w': 11, 'd': 8, 'h': 5.5, 'door': [-84, -24.5]},
    {'id': 'house2', 'type': 'house', 'name': 'Жилой дом', 'x': -84, 'y': 22, 'w': 11, 'd': 8, 'h': 5.5, 'door': [-84, 17.5]},
    {'id': 'house3', 'type': 'house', 'name': 'Жилой дом', 'x': -84, 'y': 44, 'w': 11, 'd': 8, 'h': 5.5, 'door': [-84, 39.5]},
]
SOLID = {'warehouse', 'shop', 'cafe', 'pickup', 'garage', 'supplier', 'office', 'gas', 'house'}

def rect_hit(px, py, r, rr, pad=0):
    return abs(px - rr['x']) < rr['w'] / 2 + pad + r and abs(py - rr['y']) < rr['d'] / 2 + pad + r
def on_road(px, py, pad=2.5):
    return any(abs(px - r['x']) < r['w'] / 2 + pad and abs(py - r['y']) < r['d'] / 2 + pad for r in ROADS)
def near_building(px, py, pad=3.0):
    return any(rect_hit(px, py, 0, b, pad) for b in BUILDINGS)

props = []
# деревья: вся территория, кроме дорог и зданий; плотнее по краям (лес на границе)
for _ in range(900):
    x, y = R.uniform(W['x0'] + 4, W['x1'] - 4), R.uniform(W['y0'] + 4, W['y1'] - 4)
    edge = min(x - W['x0'], W['x1'] - x, y - W['y0'], W['y1'] - y)
    if on_road(x, y) or near_building(x, y, 4.0): continue
    if edge > 24 and R.random() > .12: continue
    if any((x - p['x']) ** 2 + (y - p['y']) ** 2 < 14 for p in props if p['t'] == 'tree'): continue
    props.append({'t': 'tree', 'v': R.randint(0, 3), 'x': round(x, 1), 'y': round(y, 1), 'k': round(R.uniform(.8, 1.4), 2), 'r': .9})
# кусты и клумбы
for _ in range(170):
    x, y = R.uniform(W['x0'] + 3, W['x1'] - 3), R.uniform(W['y0'] + 3, W['y1'] - 3)
    if on_road(x, y, 4) or near_building(x, y, 3): continue
    props.append({'t': 'bush', 'v': R.randint(0, 1), 'x': round(x, 1), 'y': round(y, 1), 'k': round(R.uniform(.8, 1.2), 2), 'r': .6})
# фонари вдоль дорог (с обеих сторон, через 15 м)
for rd in ROADS:
    if rd['w'] > rd['d']:
        for i in range(int(rd['w'] // 15) - 1):
            for s in (-1, 1):
                x = rd['x'] - rd['w'] / 2 + 10 + i * 15 + (7 if s > 0 else 0); y = rd['y'] + s * (rd['d'] / 2 + 1.4)
                props.append({'t': 'lamp', 'x': round(x, 1), 'y': round(y, 1), 'r': .25})
    else:
        for i in range(int(rd['d'] // 15) - 1):
            for s in (-1, 1):
                y = rd['y'] - rd['d'] / 2 + 10 + i * 15 + (7 if s > 0 else 0); x = rd['x'] + s * (rd['w'] / 2 + 1.4)
                props.append({'t': 'lamp', 'x': round(x, 1), 'y': round(y, 1), 'r': .25})
props = [p for p in props if p['t'] != 'lamp' or not any(rect_hit(p['x'], p['y'], 0, b, 1.0) for b in BUILDINGS if b['type'] in SOLID)]
# скамейки и урны у перекрёстков и зданий
for (x, y, rot) in ((6, -6.5, 0), (-6, 6.5, 0), (14, 6.5, 0), (-14, -6.5, 0), (56, -6.5, 0), (-56, 6.5, 0), (-40, -52.5 + 6, 0), (30, -52.5 + 6, 0)):
    props.append({'t': 'bench', 'x': x, 'y': y, 'rot': rot, 'r': .9})
# машины на парковке и у зданий (статичные), ёлки у заправки уже в деревьях
CARS_PARKED = [{'x': 14 + i * 3.6, 'y': -38 + (2.5 if i % 2 else -2.5), 'rot': 90 if i % 2 else 270, 'c': i % 5, 'k': 'car'} for i in range(7)] + [{'x': -22, 'y': -48, 'rot': 90, 'c': 2, 'k': 'van'}, {'x': -36, 'y': -48, 'rot': 90, 'c': 4, 'k': 'truck'}]
# маршруты прохожих (замкнутые петли по тротуарам) и дорожные полосы машин
SIDE = 5.2
WALK = [
    [[-60, -SIDE], [60, -SIDE], [60, SIDE], [-60, SIDE]],                                      # вдоль главной улицы
    [[-SIDE, -50], [-SIDE, 20], [SIDE, 20], [SIDE, -50]],                                       # вдоль главной вертикальной
    [[-30, -SIDE - 1], [-30, -48], [-8, -48], [-8, -SIDE - 1]],                                 # склад и рынок
    [[8, -SIDE - 1], [8, -48], [58, -48], [58, -SIDE - 1]],                                     # магазин, кафе, пункт выдачи
    [[8, SIDE + 1], [8, 56], [58, 56], [58, SIDE + 1]],                                         # офис и заправка
    [[-58, SIDE + 1], [-58, 56], [-8, 56], [-8, SIDE + 1]],                                     # рынок, поставщик
]
LANES = [  # (id, ось, значение второй координаты, направление, диапазон по оси)
    {'id': 'mx+', 'ax': 'x', 'at': -2.0, 'dir': 1, 'from': -96, 'to': 96}, {'id': 'mx-', 'ax': 'x', 'at': 2.0, 'dir': -1, 'from': 96, 'to': -96},
    {'id': 'sx+', 'ax': 'x', 'at': -53.5, 'dir': 1, 'from': -96, 'to': 96}, {'id': 'sx-', 'ax': 'x', 'at': -50.5, 'dir': -1, 'from': 96, 'to': -96},
    {'id': 'my+', 'ax': 'y', 'at': 2.0, 'dir': 1, 'from': -72, 'to': 70}, {'id': 'my-', 'ax': 'y', 'at': -2.0, 'dir': -1, 'from': 70, 'to': -72},
    {'id': 'wy+', 'ax': 'y', 'at': -60.0, 'dir': 1, 'from': -72, 'to': 70}, {'id': 'wy-', 'ax': 'y', 'at': -64.0, 'dir': -1, 'from': 70, 'to': -72},
    {'id': 'ey+', 'ax': 'y', 'at': 64.0, 'dir': 1, 'from': -72, 'to': 70}, {'id': 'ey-', 'ax': 'y', 'at': 60.0, 'dir': -1, 'from': 70, 'to': -72},
]
SKYLINE = [{'x': -80 + i * 11.5, 'y': 96 + R.uniform(-4, 4), 'w': R.uniform(7, 12), 'd': R.uniform(7, 12), 'h': R.uniform(14, 48)} for i in range(18)]
START = {'x': -31, 'y': -34}   # игрок появляется у центрального склада

def build():
    return {'world': W, 'roads': ROADS, 'buildings': BUILDINGS, 'props': props, 'parked': CARS_PARKED, 'walk': WALK, 'lanes': LANES, 'skyline': SKYLINE, 'start': START}
if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True); L = build()
    json.dump(L, open(os.path.join(out, 'layout.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('layout: зданий', len(BUILDINGS), 'деревьев', sum(1 for p in props if p['t'] == 'tree'), 'фонарей', sum(1 for p in props if p['t'] == 'lamp'), 'кустов', sum(1 for p in props if p['t'] == 'bush'))
