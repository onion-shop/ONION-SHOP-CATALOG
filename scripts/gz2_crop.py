# Обрезка прозрачных полей у спрайтов зданий (экономит память в браузере). Запуск: blender -b -P gz2_crop.py -- <папка assets/gz2>
import sys, os, json
import bpy, numpy as np
d = sys.argv[sys.argv.index('--') + 1]
meta = json.load(open(os.path.join(d, 'bld.json')))
for bid, m in meta.items():
    if m.get('cropped'): continue
    p = os.path.join(d, 'b_%s.webp' % bid); im = bpy.data.images.load(p); W, H = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4); al = a[:, :, 3] > 0.02
    ys, xs = np.where(al); x0, x1, y0, y1 = [int(v) for v in (max(0, xs.min() - 2), min(W, xs.max() + 3), max(0, ys.min() - 2), min(H, ys.max() + 3))]   # y снизу вверх
    c = a[y0:y1, x0:x1]; n = bpy.data.images.new('c', x1 - x0, y1 - y0, alpha=True); n.pixels = c.ravel().tolist(); n.filepath_raw = p; n.file_format = 'WEBP'; n.save()
    top = H - y1   # верхний край обрезки в пикселях сверху
    m['o'] = [m['o'][0] - x0, m['o'][1] - top]; m['W'] = x1 - x0; m['H'] = y1 - y0; m['cropped'] = 1
    bpy.data.images.remove(im); bpy.data.images.remove(n); print('crop', bid, m['W'], m['H'], flush=True)
json.dump(meta, open(os.path.join(d, 'bld.json'), 'w'))
