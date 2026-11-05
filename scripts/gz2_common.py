# Общее для рендера «Грузомании 2» в Blender: материалы, примитивы, люди с суставами, камера и проекция.
import bpy, math, json, os, random, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
MPP = 27.0                      # пикселей на метр на всех спрайтах и тайлах
sc = bpy.context.scene
TAG = [None]; GROUPS = {}
_mats = {}

def reset(samples=48):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global sc; sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.quality = 88
    GROUPS.clear(); _mats.clear(); TAG[0] = None

def world(top=(.55, .78, 1.0), bottom=(.82, .93, .98), strength=.95):
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True; nt = wd.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB'); bg = nt.nodes.new('ShaderNodeBackground'); o = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], ramp.inputs[0])
    e = ramp.color_ramp.elements; e[0].position = .3; e[0].color = bottom + (1,); e[1].position = .85; e[1].color = top + (1,)
    bg.inputs['Strength'].default_value = strength; nt.links.new(ramp.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], o.inputs[0])

def sun():
    s = bpy.data.lights.new('s', 'SUN'); s.energy = 3.4; s.angle = math.radians(4); s.color = (1, .95, .86)
    o = bpy.data.objects.new('s', s); sc.collection.objects.link(o); o.rotation_euler = (math.radians(48), math.radians(6), math.radians(-40))

def M(hexc, rough=.6, metal=0.0, emit=None):
    key = (hexc, rough, metal, emit)
    if key in _mats: return _mats[key]
    c = tuple((int(hexc[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))
    m = bpy.data.materials.new('m' + str(len(_mats))); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = c + (1,); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = c + (1,); b.inputs['Emission Strength'].default_value = emit
    _mats[key] = m; return m

PAR = [None]
def _fin(o, m, shade=True):
    o.data.materials.append(m)
    if shade: bpy.ops.object.shade_smooth()
    if PAR[0] is not None: o.parent = PAR[0]
    else: GROUPS.setdefault(TAG[0], []).append(o)
    return o
def box(size, loc, m, bevel=.06, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = size; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler = [math.radians(r) for r in rot]
    if bevel: b = o.modifiers.new('b', 'BEVEL'); b.width = min(bevel, min(size) * .3); b.segments = 2
    return _fin(o, m)
def cyl(r, d, loc, m, rot=(0, 0, 0), v=18):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=[math.radians(x) for x in rot]); return _fin(bpy.context.object, m)
def sph(r, loc, m, k=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10); o = bpy.context.object; o.scale = k; return _fin(o, m)
def cone(r, d, loc, m, v=12):
    bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, depth=d, location=loc); return _fin(bpy.context.object, m)
def empty(loc=(0, 0, 0), rot=0, scale=1.0):
    e = bpy.data.objects.new('e', None); sc.collection.objects.link(e); e.location = loc; e.rotation_euler = (0, 0, math.radians(rot)); e.scale = (scale,) * 3
    if PAR[0] is not None: e.parent = PAR[0]
    else: GROUPS.setdefault(TAG[0], []).append(e)
    return e

# ---------- человек: суставы (плечи, бёдра), шаг и размах рук ----------
SKIN = ['#f1c9a5', '#e0ac82', '#c68a5e', '#8d5a3a']
def person(x, y, rot=0, shirt='#ff8a3d', pants='#2a303c', skin='#f1c9a5', hair='#2b1d14', hat=None, vest=False, hairstyle=0, phase=0.0, carry=False, scale=1.3, shoes='#1d1d22', jacket=None):
    root = empty((x, y, 0), rot, scale); prev = PAR[0]; PAR[0] = root
    ms, mp, mk, mh, msh = M(shirt, .7), M(pants, .75), M(skin, .65), M(hair, .8), M(shoes, .6)
    sw = math.sin(phase * 2 * math.pi) * 34   # размах в градусах
    for sg in (-1, 1):   # ноги: шарнир в бедре, колено не сгибаем, зато ботинок вынесен
        hip = empty((sg * .13, 0, .8)); PAR[0] = hip; hip.rotation_euler = (math.radians(sg * sw), 0, 0)
        box((.17, .18, .76), (0, 0, -.38), mp, .04); box((.19, .32, .13), (0, .06, -.8), msh, .04); PAR[0] = root
    box((.52, .28, .2), (0, 0, .82), mp, .05)
    box((.54, .3, .64), (0, 0, 1.14), ms, .09)
    if jacket: box((.58, .33, .5), (0, 0, 1.12), M(jacket, .7), .06)
    if vest:
        box((.58, .34, .48), (0, 0, 1.15), M('#ff7a00', .55), .05); box((.59, .35, .05), (0, 0, 1.03), M('#e8eef6', .3, 0, 1.2), 0); box((.59, .35, .05), (0, 0, 1.27), M('#e8eef6', .3, 0, 1.2), 0)
    for sg in (-1, 1):   # руки от плеч
        sh = empty((sg * .34, 0, 1.4)); PAR[0] = sh
        if carry: sh.rotation_euler = (math.radians(-75), 0, 0)
        else: sh.rotation_euler = (math.radians(-sg * sw * .9), 0, 0)
        box((.12, .13, .62), (0, 0, -.31), ms, .04); sph(.075, (0, 0, -.66), mk); PAR[0] = root
    cyl(.08, .1, (0, 0, 1.5), mk, v=10); sph(.2, (0, 0, 1.7), mk)
    for sg in (-1, 1): sph(.03, (sg * .08, .17, 1.73), M('#14141a', .4))
    box((.1, .03, .02), (0, .2, 1.65), M('#b0605a', .7), 0)
    if hat: sph(.235, (0, -.01, 1.8), M(hat, .5), (1, 1, .62)); cyl(.265, .03, (0, .05, 1.75), M(hat, .5), v=14)
    else:
        if hairstyle == 0: sph(.215, (0, -.02, 1.76), mh, (1, 1.03, .78))
        elif hairstyle == 1: sph(.22, (0, -.04, 1.75), mh, (1, 1.1, .9)); box((.4, .1, .42), (0, -.18, 1.6), mh, .05)
        else: sph(.21, (0, 0, 1.79), mh, (1, 1, .55)); box((.44, .14, .22), (0, -.12, 1.64), mh, .05)
    if carry: box((.5, .42, .42), (0, .5, 1.22), M('#d6a25e', .8), .04); box((.12, .43, .43), (0, .5, 1.22), M('#efe6cf', .7), 0)
    PAR[0] = prev; return root

# ---------- камера и проекция ----------
CAMD = Vector((17, -17, 15)).normalized()
def camera(target=(0, 0, 0), ortho_w_px=None, img=None):
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.clip_end = 3000; cam.clip_start = .1
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    t = bpy.data.objects.new('t', None); sc.collection.objects.link(t); t.location = target
    co.location = Vector(target) + CAMD * 600
    tr = co.constraints.new('TRACK_TO'); tr.target = t; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
    if img: sc.render.resolution_x, sc.render.resolution_y = img; cam.ortho_scale = max(img) / MPP
    bpy.context.view_layer.update(); return co, cam

def proj(co, v):
    c = world_to_camera_view(sc, co, Vector(v)); return c.x * sc.render.resolution_x, (1 - c.y) * sc.render.resolution_y

def fit_camera(co, cam, pts, margin=60):
    """Подбираем размер кадра и сдвиг так, чтобы все точки поместились; MPP фиксирован."""
    sc.render.resolution_x = 8000; sc.render.resolution_y = 8000; cam.ortho_scale = 8000 / MPP; cam.shift_x = cam.shift_y = 0
    bpy.context.view_layer.update()
    xs, ys = [], []
    for p in pts: a = proj(co, p); xs.append(a[0]); ys.append(a[1])
    w = int(max(xs) - min(xs) + 2 * margin); h = int(max(ys) - min(ys) + 2 * margin)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    m = max(w, h); sc.render.resolution_x, sc.render.resolution_y = w, h; cam.ortho_scale = m / MPP   # ortho_scale относится к большей стороне
    cam.shift_x = (cx - 4000) / m; cam.shift_y = -(cy - 4000) / m   # смещение в долях большей стороны (положительный Y вверх)
    bpy.context.view_layer.update(); return w, h

def border(x0, y0, x1, y1):
    W, H = sc.render.resolution_x, sc.render.resolution_y
    sc.render.use_border = True; sc.render.use_crop_to_border = True
    sc.render.border_min_x = x0 / W; sc.render.border_max_x = x1 / W; sc.render.border_min_y = 1 - y1 / H; sc.render.border_max_y = 1 - y0 / H

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

def bbox_px(co, objs, margin=6):
    xs, ys = [], []
    for ob in objs:
        if ob.type != 'MESH': continue
        for v in ob.data.vertices:
            p = proj(co, ob.matrix_world @ v.co); xs.append(p[0]); ys.append(p[1])
    W, H = sc.render.resolution_x, sc.render.resolution_y
    return max(0, int(min(xs) - margin)), max(0, int(min(ys) - margin)), min(W, int(max(xs) + margin)), min(H, int(max(ys) + margin))

def all_objs(group):
    out = []
    def walk(o):
        out.append(o)
        for c in o.children: walk(c)
    for o in GROUPS.get(group, []): walk(o)
    return out
