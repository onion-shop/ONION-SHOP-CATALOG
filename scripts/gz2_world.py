# Модели района «Грузомании 2»: здания, декор, машины, земля. Все функции строят объекты в текущей сцене Blender.
import math, random
import gz2_common as C
from gz2_common import M, box, cyl, sph, cone, empty
R = random.Random(11)
NAVY, CY, ORG, WHITE, DARK = '#14305c', '#43c9e3', '#ff8a3d', '#f2f6fb', '#2a303c'
def front(b): return b['y'] - b['d'] / 2
def win(x, y, z, w, h, lit=1.2, axis='x'):
    box((w, .08, h) if axis == 'x' else (.08, w, h), (x, y, z), M('#9fd8ff', .1, .3, lit), 0)

def b_warehouse(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M(WHITE, .7), .15); box((w + .06, d + .06, .7), (x, y, h * .82), M(CY, .4), 0); box((w + 1.2, d + 1.2, .5), (x, y, h + .25), M(NAVY, .5), .12)
    for i in range(3): box((2.6, 2.2, 1.1), (x - w * .3 + i * w * .3, y + d * .15, h + 1.0), M('#e8eef6', .6), .1)
    n = 5
    for i in range(n):
        xx = x - w / 2 + (i + .5) * w / n; box((w / n * .56, .22, 4.2), (xx, front(b) - .05, 2.1), M('#33425c', .5), .06); box((w / n * .6, .14, .3), (xx, front(b) - .15, 4.3), M(CY, .35), 0)
        box((w / n * .7, 1.6, .18), (xx, front(b) - .9, 4.7), M('#8a96a6', .5, .5), .04)
    box((7, .35, 1.7), (x - w * .3, front(b) - .25, h - 1.1), M(NAVY, .5), .08); cyl(.75, .18, (x - w * .3 - 3.0, front(b) - .45, h - 1.1), M(CY, .35), (90, 0, 0)); sph(.35, (x - w * .3 - 3.0, front(b) - .55, h - 1.1), M('#ffffff'))
    for i in range(6): win(x - w / 2 + 2 + i * 4.6, front(b) - .04, h * .55, 2.4, .9)
    for sx in (-1, 1): box((.5, d, 1.0), (x + sx * (w / 2 + .3), y, .5), M('#aab6c4', .8), .05)
def b_dock(b):
    x, y, w, d = b['x'], b['y'], b['w'], b['d']
    box((w, d, .22), (x, y, .11), M('#a9b6c4', .9), 0)
    for i in range(7): box((.18, d * .9, .03), (x - w / 2 + 2 + i * (w - 4) / 6, y, .25), M('#ffc61a', .5), 0)
    for i in range(6): cyl(.14, .8, (x - w / 2 + 1.5 + i * (w - 3) / 5, y + d / 2 - .4, .6), M('#ffc61a', .5), v=8)
def b_shop(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#fdfdff', .7), .15); box((w + 1.0, d + 1.0, .45), (x, y, h + .22), M(NAVY, .5), .1)
    box((w * .78, .12, 3.0), (x - w * .06, front(b) - .03, 1.9), M('#bfe9f4', .1, .3, 1.0), 0); box((w * .8, 2.0, .2), (x - w * .06, front(b) - 1.1, 3.6), M('#e5484d', .55), .04, (12, 0, 0))
    box((3.4, .15, 3.0), (x + w * .38, front(b) - .05, 1.55), M('#9fd8ff', .1, .3, .6), 0); box((w * .55, .3, 1.15), (x - w * .06, front(b) - .3, h - .55), M(NAVY, .5), .06)
    for i in range(4): box((1.1, 1.0, .2), (x - w * .35 + i * 1.8, front(b) - 2.5, .1), M('#e8eef6', .8), 0)
    for i in range(3): box((.9, .9, 1.3), (x - w * .3 + i * 2.3, front(b) - .9, .65), M(['#e5484d', '#43c9e3', '#ffc61a'][i], .6), .06)
    for i in range(2): box((2.4, 1.8, .7), (x + w * .1 + i * 3.4, y + d * .15, h + .75), M('#e8eef6', .6), .1)
def b_cafe(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#ffe9c4', .75), .15); box((w + 1.0, d + 1.0, .4), (x, y, h + .2), M('#7a4f2c', .6), .1)
    box((w * .6, .12, 2.1), (x - w * .1, front(b) - .03, 1.7), M('#bfe9f4', .1, .3, 1.1), 0); box((w * .65, 1.4, .15), (x - w * .1, front(b) - .8, 3.0), M('#ff8a3d', .55), .04, (14, 0, 0)); box((2.2, .12, 2.6), (x + w * .33, front(b) - .03, 1.4), M('#7a4f2c', .6), .04)
    for i in range(4):
        tx = x - w * .35 + i * 2.8; ty = front(b) - 3.2; cyl(.55, .06, (tx, ty, .78), M('#e8eef6'), v=12); cyl(.05, .78, (tx, ty, .39), M(DARK), v=6); cyl(.04, 1.7, (tx, ty, 1.35), M(DARK), v=6); cone(1.25, .55, (tx, ty, 2.1), M(['#e5484d', '#43c9e3', '#ffc61a', '#58b87a'][i]), 12)
        for s_ in (-1, 1): box((.4, .4, .45), (tx + s_ * .85, ty, .25), M('#7a4f2c', .8), .04)
    box((3.4, .3, .9), (x - w * .1, front(b) - .3, h - .4), M('#7a4f2c', .6), .05)
def b_pickup(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#e8f1fb', .7), .15); box((w + .8, d + .8, .4), (x, y, h + .2), M(NAVY, .5), .1); box((w, .1, .5), (x, front(b) - .03, h - .5), M('#ff8a3d', .5), 0)
    for i in range(5):
        for j in range(3): box((1.1, .08, .8), (x - w * .36 + i * 1.5, front(b) - .05, .7 + j * .95), M(['#43c9e3', '#ff8a3d', '#8a6bff', '#58b87a', '#ffc61a'][(i + j) % 5], .5), .02)
    box((4.2, .25, .9), (x, front(b) - .25, h + .6), M(CY, .35), .06); box((.2, 2.0, 3.0), (x - w / 2 - 2.2, front(b) - 1, 1.5), M('#3a4150', .5), .03)
def b_parking(b):
    x, y, w, d = b['x'], b['y'], b['w'], b['d']
    box((w, d, .12), (x, y, .06), M('#555c68', .9), 0)
    for i in range(int(w // 3.6)): box((.14, d * .42, .03), (x - w / 2 + 1.8 + i * 3.6, y + d * .24, .14), M('#f2f2f2', .6), 0); box((.14, d * .42, .03), (x - w / 2 + 1.8 + i * 3.6, y - d * .24, .14), M('#f2f2f2', .6), 0)
def b_market(b):
    x, y, w, d = b['x'], b['y'], b['w'], b['d']
    box((w, d, .1), (x, y, .05), M('#c9d3de', .9), 0)
    cols = ['#e5484d', '#43c9e3', '#ffc61a', '#58b87a', '#ff8a3d']
    for i in range(4):
        for j in range(2):
            sx, sy = x - w / 2 + 5 + i * 9.4, y - d / 2 + 4.5 + j * 9.0
            box((6, 3.2, 1.1), (sx, sy, .65), M('#f2f6fb', .7), .06); box((6.8, 4.0, .2), (sx, sy, 3.2), M(cols[(i + j * 2) % 5], .55), .05, (0, 0, 0)); box((6.8, 1.0, .2), (sx, sy - 1.9, 2.95), M('#ffffff', .6), .03)
            for k in (-1, 1): cyl(.08, 2.6, (sx + k * 3.0, sy - 1.5, 1.4), M(DARK), v=8)
            for q in range(3): box((.7, .7, .55), (sx - 2 + q * .9, sy - 1.0, 1.3 + .27), M(R.choice(['#d6a25e', '#ff8a3d', '#58b87a', '#e5484d']), .8), .05)
            box((2.6, .12, .8), (sx, sy - 2.15, 2.5), M(NAVY, .5), .03)
    box((w, .25, 1.3), (x, y + d / 2 + .1, .65), M('#a9b6c4', .8), .05)
def b_garage(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#e3d3c4', .75), .15); box((w + .8, d + .8, .4), (x, y, h + .2), M('#3a4150', .6), .1); box((w, .1, .6), (x, front(b) - .03, h - .5), M(ORG, .5), 0)
    box((5.4, .14, 3.6), (x - w * .15, front(b) - .05, 1.8), M('#8a96a6', .55, .5), .05)
    for i in range(6): box((5.4, .02, .08), (x - w * .15, front(b) - .13, .5 + i * .6), M('#6a7686', .6), 0)
    for i in range(5): cyl(.5, .4, (x + w * .3 + (i % 2) * .3, front(b) - 1.3, .25 + (i // 2) * .42), M('#1c1c20', .8), v=14)
    box((3.4, .3, .9), (x + w * .28, front(b) - .3, 3.6), M(NAVY, .5), .05); win(x + w * .28, front(b) - .04, 1.9, 2.2, 1.6)
def b_supplier(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#c3d1e0', .75), .15); box((w + 1.0, d + 1.0, .5), (x, y, h + .25), M('#4a505c', .6), .1); box((w + .06, d + .06, .8), (x, y, h * .8), M('#ffc61a', .5), 0)
    for i in range(3): box((w * .2, .2, 4.2), (x - w * .3 + i * w * .3, front(b) - .05, 2.1), M('#33425c', .5), .06)
    for i in range(4): cyl(.7, .5, (x - w * .3 + i * 3.2, y, h + .9), M('#8a96a6', .5, .5), v=14)
    cyl(1.6, 5, (x + w / 2 + 3.5, y + 2, 2.6), M('#e8eef6', .5, .3), v=18); cyl(1.6, 5, (x + w / 2 + 3.5, y - 2, 2.6), M('#e8eef6', .5, .3), v=18)
    for i in range(3):
        for j in range(2): box((2.4, 6.0, 2.5), (x - w / 2 - 3.0 - j * 2.6, y - 2 + i * 3.4, 1.4), M(['#e5484d', '#43a3e8', '#ffc61a'][(i + j) % 3], .6), .08)
    box((6.4, .3, 1.3), (x, front(b) - .25, h - .8), M(NAVY, .5), .06)
def b_office(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d, h), (x, y, h / 2), M('#c9d8e8', .6), .15); box((w + .8, d + .8, .5), (x, y, h + .25), M('#3a4150', .6), .1); box((w + .06, d + .06, .5), (x, y, 4.2), M(CY, .35), 0)
    for f in range(5):
        for k in range(4):
            lit = 1.5 if (f * 3 + k) % 4 else .2
            win(x - w / 2 + 1.7 + k * 3.0, front(b) - .04, 2.0 + f * 3.0 + 3, 2.0, 1.5, lit); win(x + w / 2 + .04, y - d / 2 + 1.7 + k * 3.0, 2.0 + f * 3.0 + 3, 2.0, 1.5, lit, 'y')
    box((5, 2.4, .2), (x, front(b) - 1.2, 3.4), M(CY, .35, .2), .04); box((4.4, .2, 3.0), (x, front(b) - .05, 1.5), M('#9fd8ff', .1, .3, .9), 0); cyl(.06, 4, (x + 2, y, h + 2.6), M(DARK), v=6)
    box((3, .3, .9), (x, front(b) - .3, 5.0), M(NAVY, .5), .05)
def b_gas(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    box((w, d * .5, .45), (x, y - 1.5, h), M('#e5484d', .5), .1)
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(.25, h, (x + sx * (w / 2 - 1), y - 1.5 + sy * d * .2, h / 2), M('#e8eef6'), v=10)
    for i in range(3): box((.9, .7, 1.7), (x - 4 + i * 4, y - 1.5, .9), M('#ffc61a', .5), .06); box((.6, .06, .6), (x - 4 + i * 4, y - 1.5 - .36, 1.3), M(NAVY), 0)
    box((5, 3.4, 3.0), (x + w / 2 + 2.6, y + 1.8, 1.5), M('#fdfdff'), .1); box((5.6, 4, .3), (x + w / 2 + 2.6, y + 1.8, 3.1), M(NAVY, .5), .06); win(x + w / 2 + 2.6, y + 1.8 - 1.7, 1.6, 3.4, 1.5)
    cyl(.15, 6.5, (x + w / 2 + 6.6, y - 4, 3.25), M(NAVY), v=8); box((2.4, .5, 2.0), (x + w / 2 + 6.6, y - 4, 6.6), M('#e5484d', .5, 0, .7), .05)
def b_house(b):
    x, y, w, d, h = b['x'], b['y'], b['w'], b['d'], b['h']
    col = R.choice(['#f6d9b8', '#d8e8f6', '#f2c9c9', '#dff0d0'])
    box((w, d, h), (x, y, h / 2), M(col, .75), .12); a = math.radians(32); L = d / 2 / math.cos(a) + .5
    box((w + 1.0, L, .3), (x, y - d / 4 - .1, h + d / 4 * math.tan(a) + .1), M('#b5533c', .65), .04, (32, 0, 0)); box((w + 1.0, L, .3), (x, y + d / 4 + .1, h + d / 4 * math.tan(a) + .1), M('#b5533c', .65), .04, (-32, 0, 0))
    box((1.0, 1.0, 2.2), (x + w * .28, y, h + 1.6), M('#9a6b6b', .8), .05)
    for k in (-1, 1): win(x + k * w * .27, front(b) - .04, 3.0, 1.7, 1.4, .8)
    box((1.4, .12, 2.4), (x, front(b) - .03, 1.2), M('#7a4f2c', .7), .04)
    for i in range(10): box((.14, .14, 1.1), (x - w / 2 - 1.5 + i * (w + 3) / 9, front(b) - 3.0, .55), M('#ffffff', .7), 0)
    box((w + 3, .1, .1), (x, front(b) - 3.0, 1.0), M('#ffffff', .7), 0)
BUILD = {'warehouse': b_warehouse, 'dock': b_dock, 'shop': b_shop, 'cafe': b_cafe, 'pickup': b_pickup, 'parking': b_parking, 'market': b_market, 'garage': b_garage, 'supplier': b_supplier, 'office': b_office, 'gas': b_gas, 'house': b_house}

# ---------- декор и техника ----------
def tree(x, y, v=0, k=1.0):
    cols = ['#58b87a', '#47a86a', '#6fcf8f', '#3f9a5e']; col = cols[v % 4]
    cyl(.28 * k, 2.2 * k, (x, y, 1.1 * k), M('#7a4f2c', .9), v=10)
    if v % 2 == 0: sph(1.7 * k, (x, y, 3.1 * k), M(col, .85)); sph(1.25 * k, (x + .75 * k, y + .3 * k, 3.8 * k), M(col, .85)); sph(1.0 * k, (x - .7 * k, y - .3 * k, 3.6 * k), M(col, .85))
    else: cone(1.8 * k, 2.8 * k, (x, y, 2.9 * k), M(col, .85)); cone(1.4 * k, 2.4 * k, (x, y, 4.2 * k), M(col, .85)); cone(.9 * k, 1.8 * k, (x, y, 5.3 * k), M(col, .85))
def bush(x, y, v=0, k=1.0):
    col = '#58b87a' if v == 0 else '#6fcf8f'; sph(.9 * k, (x, y, .6 * k), M(col, .85)); sph(.65 * k, (x + .7 * k, y + .2 * k, .5 * k), M(col, .85))
    if v: [sph(.12, (x + R.uniform(-.7, .7), y + R.uniform(-.5, .5), .9), M(R.choice(['#e5484d', '#ffc61a', '#ffffff']), .6)) for _ in range(4)]
def lamp(x, y, h=5.0):
    cyl(.09, h, (x, y, h / 2), M('#3a4150', .5, .6), v=8); box((.9, .3, .16), (x, y, h + .05), M('#3a4150', .5, .6), .03); box((.8, .22, .06), (x, y, h - .08), M('#fff3c8', .3, 0, 5), 0)
def bench(x, y, rot=0):
    box((1.8, .5, .12), (x, y, .5), M('#9a6b3b', .8), .02, (0, 0, rot)); box((1.8, .12, .5), (x, y + .2, .8), M('#9a6b3b', .8), .02, (0, 0, rot))
    for s_ in (-1, 1): box((.1, .5, .5), (x + s_ * .75, y, .25), M(DARK), 0, (0, 0, rot))
def vehicle(kind, col, heading):
    """heading: 0 = нос на +x, 1 = на +y, 2 = на -x, 3 = на -y"""
    e = empty((0, 0, 0), [-90, 0, 90, 180][heading]); prev = C.PAR[0]; C.PAR[0] = e
    if kind == 'car':
        L, Wd, H = 4.2, 1.9, .8
        box((Wd, L, H), (0, 0, .55 + H / 2), M(col, .35, .3), .18); box((Wd * .86, L * .5, .7), (0, -L * .06, .55 + H + .3), M(col, .35, .3), .2); box((Wd * .87, L * .46, .5), (0, -L * .06, .55 + H + .32), M('#9fd8ff', .1, .4), .15)
        box((1.5, .08, .22), (0, L / 2 + .02, .85), M('#fff3c8', .3, 0, 3), 0)
    elif kind == 'van':
        L, Wd, H = 5.6, 2.2, 1.5
        box((Wd, L, H), (0, -.3, .55 + H / 2), M(col, .4, .2), .15); box((Wd * .95, L * .28, H * .85), (0, L * .36, .55 + H * .45), M(col, .4, .2), .15); box((Wd * .8, .1, .7), (0, L * .5 + .02, 1.55), M('#9fd8ff', .1, .4), .05)
    else:
        L, Wd, H = 8.0, 2.5, 2.7
        box((Wd, L * .72, H), (0, -L * .14, .55 + H / 2), M('#e8eef6', .55), .15); box((Wd, L * .24, H * .72), (0, L * .38, .55 + H * .36), M(col, .45), .15); box((Wd * .84, .1, .9), (0, L * .5 + .02, 1.9), M('#9fd8ff', .1, .4), .05)
        box((Wd + .02, L * .72, .22), (0, -L * .14, 1.0), M(col, .5), 0)
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(.38, .26, (sx * (Wd / 2), sy * L * .3, .38), M('#1c1c20', .8), (0, 90, 0), 14)
    C.PAR[0] = prev; return e

# ---------- земля ----------
def ground(L):
    C.TAG[0] = 'ground'
    wx0, wx1, wy0, wy1 = L['world']['x0'] - 60, L['world']['x1'] + 60, L['world']['y0'] - 40, L['world']['y1'] + 70
    box((wx1 - wx0, wy1 - wy0, .3), ((wx0 + wx1) / 2, (wy0 + wy1) / 2, -.15), M('#86b87f', .95), 0)
    asphalt, side, line = M('#4a505c', .9), M('#c9d3de', .85), M('#f2f2f2', .6)
    for n_, r in enumerate(L['roads']):
        box((r['w'] + 3.6, r['d'] + 3.6, .2), (r['x'], r['y'], .04 + n_ * .006), side, 0); box((r['w'], r['d'], .22), (r['x'], r['y'], .07 + n_ * .006), asphalt, 0)
    for r in L['roads']:   # разметка (пунктир) вне перекрёстков, зебры у перекрёстков
        if r['w'] > r['d']:
            for i in range(int(r['w'] // 5)):
                x = r['x'] - r['w'] / 2 + 2.5 + i * 5
                if not any(abs(x - q['x']) < q['w'] / 2 + 3 for q in L['roads'] if q['d'] > q['w']): box((2.2, .22, .02), (x, r['y'], .2), line, 0)
        else:
            for i in range(int(r['d'] // 5)):
                y = r['y'] - r['d'] / 2 + 2.5 + i * 5
                if not any(abs(y - q['y']) < q['d'] / 2 + 3 for q in L['roads'] if q['w'] > q['d']): box((.22, 2.2, .02), (r['x'], y, .2), line, 0)
    for a in L['roads']:
        for bb in L['roads']:
            if a['w'] > a['d'] and bb['d'] > bb['w']:
                cx, cy = bb['x'], a['y']
                for sg in (-1, 1):
                    for k in range(6): box((2.0, .6, .02), (cx + sg * (bb['w'] / 2 + 1.6), cy - 3 + k * 1.2, .2), line, 0); box((.6, 2.0, .02), (cx - 3 + k * 1.2, cy + sg * (a['d'] / 2 + 1.6), .2), line, 0)
    pads = {'warehouse': 6, 'shop': 5, 'cafe': 4, 'pickup': 5, 'garage': 4, 'supplier': 6, 'office': 5, 'gas': 3}
    for b in L['buildings']:
        if b['type'] in pads: box((b['w'] + pads[b['type']] * 2, b['d'] + pads[b['type']] * 2, .12), (b['x'], b['y'] - 1, .06), M('#d3dae3', .9), 0)
    for b in L['buildings']:
        if b['type'] in ('dock', 'parking'): BUILD[b['type']](b)
    # пруд и дорожки в парке (северо-восток)
    cyl(9.5, .12, (38, 46, .05), M('#9fd8ff', .2, .1), v=40); cyl(11, .08, (38, 46, .03), M('#d3dae3', .9), v=40)
    for i in range(10): box((1.6, 1.6, .06), (30 + i * 1.8, 34, .06), M('#d3dae3', .9), 0)

def solids(L):
    for b in L['buildings']:
        if b['type'] in ('dock', 'parking'): continue
        C.TAG[0] = 'b_' + b['id']; BUILD[b['type']](b)
    C.TAG[0] = 'props'
    for p in L['props']:
        t = p['t']
        if t == 'tree': tree(p['x'], p['y'], p['v'], p['k'])
        elif t == 'bush': bush(p['x'], p['y'], p['v'], p['k'])
        elif t == 'lamp': lamp(p['x'], p['y'])
        elif t == 'bench': bench(p['x'], p['y'], p.get('rot', 0))
    C.TAG[0] = 'skyline'
    for s in L['skyline']: box((s['w'], s['d'], s['h']), (s['x'], s['y'], s['h'] / 2 - 2), M(R.choice(['#aab9cc', '#b8c6d8', '#9fb0c4']), .6), .1)
