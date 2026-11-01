"""Иконки для экрана «Домой»: тёмная, белая, хэллоуинская. Размеры 180 (iOS), 192/512 (Android), maskable 512, favicon 48."""
from PIL import Image, ImageDraw, ImageFilter
import math, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
LOGO = Image.open(os.path.join(ROOT, 'logo.png')).convert('RGBA')
S = 1024  # рисуем крупно, потом уменьшаем

def vgrad(top, bot, size=S):
    im = Image.new('RGB', (size, size))
    px = im.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(size): px[x, y] = c
    return im

def radial(cx, cy, r, col, alpha=255, size=S):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(r * 0.45))
    return Image.new('RGB', (size, size), col), m

def put_logo(base, scale, dx=0, dy=0, shadow=None):
    sz = int(S * scale)
    lg = LOGO.resize((sz, sz), Image.LANCZOS)
    x = (S - sz) // 2 + dx; y = (S - sz) // 2 + dy
    if shadow:
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        a = lg.split()[3].point(lambda v: int(v * shadow[1]))
        sh.paste(Image.new('RGBA', (sz, sz), shadow[0] + (255,)), (x, y + int(S * .012)), a)
        sh = sh.filter(ImageFilter.GaussianBlur(S * .014))
        base.alpha_composite(sh)
    base.alpha_composite(lg, (x, y))

def heart_pts(cx, cy, r, rot=0):
    pts = []
    for i in range(90):
        t = i / 90 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        c, s_ = math.cos(rot), math.sin(rot)
        pts.append((cx + (x * c - y * s_) * r / 17, cy + (x * s_ + y * c) * r / 17))
    return pts

def sparkle(d, cx, cy, r, col):
    w = r * .16
    d.polygon([(cx, cy - r), (cx + w, cy - w), (cx + r, cy), (cx + w, cy + w), (cx, cy + r), (cx - w, cy + w), (cx - r, cy), (cx - w, cy - w)], fill=col)

def flake(d, cx, cy, r, col, wd):
    for k in range(6):
        a = k * math.pi / 3
        ex, ey = cx + math.cos(a) * r, cy + math.sin(a) * r
        d.line([(cx, cy), (ex, ey)], fill=col, width=wd)
        for f in (.55, .8):
            bx, by = cx + math.cos(a) * r * f, cy + math.sin(a) * r * f
            for sg in (-1, 1):
                aa = a + sg * math.pi / 4
                d.line([(bx, by), (bx + math.cos(aa) * r * .22, by + math.sin(aa) * r * .22)], fill=col, width=max(2, wd - 1))

def bat(d, cx, cy, w, col):
    # аккуратная летучая мышь: крылья с зубчатым краем
    h = w * .4
    for s_ in (-1, 1):
        pts = [(cx + s_ * w * .05, cy - h * .1), (cx + s_ * w * .2, cy - h * .42), (cx + s_ * w * .5, cy - h * .5),
               (cx + s_ * w * .42, cy - h * .05), (cx + s_ * w * .36, cy + h * .22), (cx + s_ * w * .27, cy + h * .02),
               (cx + s_ * w * .17, cy + h * .24), (cx + s_ * w * .09, cy + h * .06)]
        d.polygon(pts, fill=col)
    d.ellipse([cx - w * .07, cy - h * .22, cx + w * .07, cy + h * .38], fill=col)
    for s_ in (-1, 1):
        d.polygon([(cx + s_ * w * .065, cy - h * .18), (cx + s_ * w * .045, cy - h * .52), (cx + s_ * w * .005, cy - h * .2)], fill=col)

def make(kind):
    if kind == 'dark':
        base = Image.new('RGBA', (S, S), (5, 10, 29, 255))
        g, m = radial(S * .5, S * .5, S * .42, (20, 60, 140), 90); base.paste(g, (0, 0), m)
        put_logo(base, .70, shadow=((0, 10, 40), .6))
    elif kind == 'white':
        base = vgrad((255, 255, 255), (222, 232, 246)).convert('RGBA')
        put_logo(base, .70, shadow=((60, 100, 170), .28))
    elif kind == 'halloween':
        base = vgrad((38, 14, 66), (8, 4, 20)).convert('RGBA')
        g, m = radial(S * .5, S * .5, S * .40, (255, 120, 28), 150); base.paste(g, (0, 0), m)
        d = ImageDraw.Draw(base)
        d.ellipse([S * .14, S * .14, S * .86, S * .86], outline=(255, 150, 60), width=int(S * .006))
        for (x, y, r) in [(.2, .72, .02), (.8, .26, .016), (.3, .15, .012), (.86, .62, .012), (.12, .38, .012)]:
            sparkle(d, S * x, S * y, S * r, (255, 214, 150))
        for (x, y, w) in [(.24, .24, .13), (.8, .78, .11)]:
            bat(d, S * x, S * y, S * w, (10, 4, 20))
        put_logo(base, .56, shadow=((0, 0, 0), .7))
    elif kind == 'newyear':
        base = vgrad((10, 36, 82), (4, 12, 38)).convert('RGBA')
        g, m = radial(S * .5, S * .5, S * .42, (70, 160, 255), 120); base.paste(g, (0, 0), m)
        d = ImageDraw.Draw(base)
        d.ellipse([S * .14, S * .14, S * .86, S * .86], outline=(236, 196, 110), width=int(S * .006))
        for (x, y, r, wd) in [(.2, .2, .075, 7), (.82, .24, .05, 5), (.8, .8, .085, 7), (.18, .78, .045, 5), (.5, .07, .04, 4), (.52, .93, .035, 4)]:
            flake(d, S * x, S * y, S * r, (226, 240, 255), wd)
        for (x, y, r) in [(.9, .5, .022), (.1, .5, .018), (.34, .1, .016), (.68, .9, .018)]:
            sparkle(d, S * x, S * y, S * r, (255, 222, 140))
        put_logo(base, .56, shadow=((0, 10, 40), .7))
    elif kind == 'valentine':
        base = vgrad((120, 22, 70), (40, 6, 30)).convert('RGBA')
        g, m = radial(S * .5, S * .5, S * .42, (255, 110, 160), 150); base.paste(g, (0, 0), m)
        d = ImageDraw.Draw(base)
        d.ellipse([S * .14, S * .14, S * .86, S * .86], outline=(255, 190, 210), width=int(S * .006))
        for (x, y, r, rot, col) in [(.2, .2, .1, -.3, (255, 120, 160)), (.84, .24, .06, .3, (255, 170, 195)), (.82, .8, .11, .25, (255, 96, 140)),
                                    (.18, .8, .06, -.25, (255, 170, 195)), (.5, .07, .045, 0, (255, 190, 210)), (.55, .93, .04, 0, (255, 150, 180))]:
            d.polygon(heart_pts(S * x, S * y, S * r, rot), fill=col)
            hl = heart_pts(S * (x - r * .22), S * (y - r * .22), S * r * .28, rot)
            d.polygon(hl, fill=tuple(min(255, c + 40) for c in col))
        for (x, y, r) in [(.9, .5, .02), (.1, .5, .018), (.34, .1, .016)]:
            sparkle(d, S * x, S * y, S * r, (255, 226, 235))
        put_logo(base, .56, shadow=((50, 0, 30), .7))
    return base

def save(img, name, size, mask=False):
    im = img
    if mask:  # maskable: логотип в «безопасной зоне» 80%
        bg = Image.new('RGBA', (S, S), img.getpixel((4, 4)))
        small = img.resize((int(S * .8), int(S * .8)), Image.LANCZOS)
        bg.paste(small, (int(S * .1), int(S * .1)))
        im = bg
    out = im.resize((size, size), Image.LANCZOS)
    out.convert('RGB').save(os.path.join(ROOT, 'icons', name), optimize=True)

os.makedirs(os.path.join(ROOT, 'icons'), exist_ok=True)
for k in ('dark', 'white', 'halloween', 'newyear', 'valentine'):
    im = make(k)
    save(im, k + '-180.png', 180); save(im, k + '-192.png', 192); save(im, k + '-512.png', 512)
    save(im, k + '-maskable-512.png', 512, mask=True); save(im, k + '-48.png', 48)
print('icons ok')
