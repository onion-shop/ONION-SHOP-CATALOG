# Рендер района «Грузомании 2». Запуск: blender -b -P gz2_art.py -- <режим> <выходная папка> [samples]
# режимы: gtest (один тайл земли), ground (все тайлы), bld (здания), props (деревья и др.), meta
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import gz2_common as C
import gz2_world as Wd
args = sys.argv[sys.argv.index('--') + 1:]
mode, out = args[0], args[1]; samples = int(args[2]) if len(args) > 2 else 24
os.makedirs(out, exist_ok=True)
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'gz2', 'layout.json'), encoding='utf-8'))
TILE = 640

def setup():
    C.reset(samples); C.world(); C.sun(); C.sc.render.film_transparent = False

def corners():
    w = L['world']; x0, x1, y0, y1 = w['x0'] - 20, w['x1'] + 20, w['y0'] - 20, w['y1'] + 20
    return [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (0, 40)]

def hide_cam(groups):
    for g in groups:
        for o in C.all_objs(g): o.visible_camera = False

if mode in ('gtest', 'ground'):
    setup(); Wd.ground(L); Wd.solids(L)
    co, cam = C.camera((0, 0, 0)); W, H = C.fit_camera(co, cam, corners(), 20)
    gnd = set(C.GROUPS.keys()) - {'ground'}; hide_cam(gnd)   # всё, кроме земли, не видно камере, но отбрасывает тени
    # точка начала кадра в мире нужна движку: пишем проекцию (аффинную): origin, ex, ey, ez в пикселях кадра
    o = C.proj(co, (0, 0, 0)); ex = C.proj(co, (1, 0, 0)); ey = C.proj(co, (0, 1, 0)); ez = C.proj(co, (0, 0, 1))
    meta = {'W': W, 'H': H, 'tile': TILE, 'o': o, 'x': [ex[0] - o[0], ex[1] - o[1]], 'y': [ey[0] - o[0], ey[1] - o[1]], 'z': [ez[0] - o[0], ez[1] - o[1]], 'mpp': C.MPP}
    json.dump(meta, open(os.path.join(out, 'ground.json'), 'w'))
    print('frame', W, H, meta)
    cols, rows = math.ceil(W / TILE), math.ceil(H / TILE)
    if mode == 'gtest': tiles = [(cols // 2, rows // 2)]
    else: tiles = [(i, j) for j in range(rows) for i in range(cols)]
    for n, (i, j) in enumerate(tiles):
        C.border(i * TILE, j * TILE, min(W, (i + 1) * TILE), min(H, (j + 1) * TILE)); C.render(os.path.join(out, 'g_%d_%d.webp' % (i, j)))
        print('tile', n + 1, '/', len(tiles), flush=True)

elif mode in ('chars', 'veh', 'props'):
    import numpy as np
    def frame(build, fw, fh, ax, ay, tmp):
        """Рисуем один объект в начале координат; точка (0,0,0) попадает в пиксель (ax, ay) кадра fw x fh."""
        setup(); C.sc.render.film_transparent = True; C.TAG[0] = 'o'; build()
        co, cam = C.camera((0, 0, 0), None, (fw, fh)); cam.shift_x = (fw / 2 - ax) / max(fw, fh); cam.shift_y = (ay - fh / 2) / max(fw, fh)
        C.sc.render.image_settings.file_format = 'PNG'; C.sc.render.image_settings.color_mode = 'RGBA'
        C.render(tmp); im = bpy.data.images.load(tmp); a = np.array(im.pixels[:], dtype=np.float32).reshape(fh, fw, 4); bpy.data.images.remove(im); return a
    def save(arr, path):
        h, w = arr.shape[:2]; im = bpy.data.images.new('s', w, h, alpha=True); im.pixels = arr.ravel().tolist(); im.filepath_raw = path; im.file_format = 'WEBP'; im.save(); bpy.data.images.remove(im)
    tmp = os.path.join(out, '_t.png')
    if mode == 'chars':
        LOOKS = {  # имя: (рубашка, штаны, кожа, волосы, шапка, жилет, причёска, куртка)
            'player': ('#ff8a3d', '#2a303c', 0, '#2b1d14', '#43c9e3', True, 0, None), 'loader': ('#43a3e8', '#2a303c', 1, '#3a2a1a', '#ffc61a', True, 0, None),
            'picker': ('#43c9e3', '#394152', 0, '#6b3a1f', None, False, 1, None), 'packer': ('#8a6bff', '#2a303c', 2, '#14100c', None, False, 2, None),
            'driver': ('#58b87a', '#2f3b52', 1, '#2b1d14', '#14305c', False, 0, None), 'cashier': ('#e5484d', '#2a303c', 0, '#c9873a', None, False, 1, None),
            'manager': ('#f2f6fb', '#14305c', 2, '#1f1712', None, False, 0, '#14305c'), 'mechanic': ('#6a7686', '#4a505c', 3, '#14100c', '#ff8a3d', False, 0, None),
            'c1': ('#ffc61a', '#3f5d94', 0, '#6b3a1f', None, False, 1, None), 'c2': ('#e5484d', '#2a303c', 1, '#2b1d14', None, False, 2, '#394152'),
            'c3': ('#58b87a', '#6b5a3c', 2, '#14100c', '#e5484d', False, 0, None), 'c4': ('#8a6bff', '#394152', 3, '#14100c', None, False, 1, None),
            'c5': ('#43c9e3', '#2a303c', 0, '#c9873a', None, False, 2, '#e8eef6'), 'c6': ('#f2c9c9', '#4a505c', 1, '#3a2a1a', None, False, 0, None)}
        only = [k for k in args[3:]] or list(LOOKS)
        FW, FH, AX, AY = 96, 128, 48, 100; meta = {'fw': FW, 'fh': FH, 'ax': AX, 'ay': AY, 'dirs': 8, 'frames': 4, 'looks': {}}
        for name in only:
            for carry in ((False, True) if name in ('player', 'loader', 'picker', 'packer') else (False,)):
                sh, pa, sk, ha, hat, vest, hs, jk = LOOKS[name]; key = name + ('_carry' if carry else '')
                sheet = np.zeros((FH * 4, FW * 8, 4), np.float32)   # строки: фаза шага (сверху вниз), колонки: направление
                for ph in range(4):
                    for d in range(8):
                        a = frame(lambda: C.person(0, 0, d * 45, sh, pa, C.SKIN[sk], ha, hat, vest, hs, ph / 4 if not carry else ph / 8, carry, 1.3, '#1d1d22', jk), FW, FH, AX, AY, tmp)
                        r0 = (3 - ph) * FH; sheet[r0:r0 + FH, d * FW:(d + 1) * FW] = a
                save(sheet, os.path.join(out, 'ch_%s.webp' % key)); meta['looks'][key] = 1; print('look', key, flush=True)
        json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
    elif mode == 'veh':
        FW, FH, AX, AY = 300, 230, 150, 150; V = [('car', c) for c in ('#e5484d', '#43a3e8', '#ffc61a', '#58b87a', '#8a6bff')] + [('van', '#43c9e3'), ('van', '#ff8a3d'), ('truck', '#14305c'), ('truck', '#e5484d')]
        sheet = np.zeros((FH * len(V), FW * 4, 4), np.float32)
        for i, (k, col) in enumerate(V):
            for hd in range(4):
                a = frame(lambda: Wd.vehicle(k, col, hd), FW, FH, AX, AY, tmp); r0 = (len(V) - 1 - i) * FH; sheet[r0:r0 + FH, hd * FW:(hd + 1) * FW] = a
            print('veh', i, flush=True)
        save(sheet, os.path.join(out, 'veh.webp')); json.dump({'fw': FW, 'fh': FH, 'ax': AX, 'ay': AY, 'list': V}, open(os.path.join(out, 'veh.json'), 'w'))
    else:
        FW, FH, AX, AY = 220, 300, 110, 255; P = [('tree', v) for v in range(4)] + [('bush', 0), ('bush', 1), ('lamp', 0), ('bench', 0)]
        sheet = np.zeros((FH, FW * len(P), 4), np.float32)
        fn = {'tree': lambda v: Wd.tree(0, 0, v, 1.0), 'bush': lambda v: Wd.bush(0, 0, v, 1.0), 'lamp': lambda v: Wd.lamp(0, 0), 'bench': lambda v: Wd.bench(0, 0, 0)}
        for i, (k, v) in enumerate(P): sheet[:, i * FW:(i + 1) * FW] = frame(lambda: fn[k](v), FW, FH, AX, AY, tmp)
        save(sheet, os.path.join(out, 'props.webp')); json.dump({'fw': FW, 'fh': FH, 'ax': AX, 'ay': AY, 'list': P}, open(os.path.join(out, 'props.json'), 'w'))

elif mode == 'bld':
    # здания по одному: земля скрыта (но тени от самого здания на землю не нужны — рисуем их на канвасе)
    ids = [b['id'] for b in L['buildings'] if b['type'] not in ('dock', 'parking', 'market')] + ['market']
    meta = {}
    for bid in ids:
        b = next(q for q in L['buildings'] if q['id'] == bid)
        setup(); C.sc.render.film_transparent = True; C.TAG[0] = 'b'; Wd.BUILD[b['type']](b)
        co, cam = C.camera((b['x'], b['y'], 0)); objs = C.all_objs('b')
        pts = [(b['x'] + sx * (b['w'] / 2 + 8), b['y'] + sy * (b['d'] / 2 + 8), z) for sx in (-1, 1) for sy in (-1, 1) for z in (0, b['h'] + 14)]
        W, H = C.fit_camera(co, cam, pts, 10)
        o = C.proj(co, (0, 0, 0)); ex = C.proj(co, (1, 0, 0)); ey = C.proj(co, (0, 1, 0)); ez = C.proj(co, (0, 0, 1))
        C.render(os.path.join(out, 'b_%s.webp' % bid)); meta[bid] = {'W': W, 'H': H, 'o': o, 'x': [ex[0] - o[0], ex[1] - o[1]], 'y': [ey[0] - o[0], ey[1] - o[1]], 'z': [ez[0] - o[0], ez[1] - o[1]]}
        print('bld', bid, W, H, flush=True)
    json.dump(meta, open(os.path.join(out, 'bld.json'), 'w'))
