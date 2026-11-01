"""Рисует значки уровней программы лояльности (assets/lvl/*.svg)."""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'lvl')
M = {  # светлый, средний, тёмный, кант
    'bronze':   ('#ffd9b8', '#cf8a55', '#7a4120', '#5c2f15'),
    'silver':   ('#ffffff', '#c7cfdb', '#7d8899', '#5b6577'),
    'gold':     ('#fff3c4', '#e8b64a', '#a06d14', '#7a500a'),
    'platinum': ('#f3f6ff', '#a7b7d8', '#4b5d86', '#33446b'),
    'diamond':  ('#eafdff', '#86e1f7', '#2f7fd8', '#1d4fb8'),
}
STAR = 'M60 44 C62.2 57.5 64.5 59.8 78 62 C64.5 64.2 62.2 66.5 60 80 C57.8 66.5 55.5 64.2 42 62 C55.5 59.8 57.8 57.5 60 44 Z'
def badge(key, idx):
    a, b, c, d = M[key]
    gems = idx + 1
    gx = [60 + (i - (gems - 1) / 2) * 8 for i in range(gems)]
    gem_svg = ''.join(f'<circle cx="{x:.1f}" cy="31.5" r="2.6" fill="url(#gem)" stroke="{d}" stroke-width=".8"/>' for x in gx)
    tips = [(42, 13), (60, 8), (78, 13)] if idx < 3 else [(38, 17), (49, 11), (60, 7), (71, 11), (82, 17)]
    if idx < 3:
        crown = 'M37 35 L40 14 L51 25 L60 8 L69 25 L80 14 L83 35 Z'
    else:
        crown = 'M35 35 L37 17 L45 26 L49 11 L56 24 L60 7 L64 24 L71 11 L75 26 L83 17 L85 35 Z'
    balls = ''.join(f'<circle cx="{x}" cy="{y}" r="3" fill="url(#m)" stroke="{d}" stroke-width=".8"/>' for x, y in tips)
    spark = ''
    if key in ('platinum', 'diamond'):
        sp = [(24, 40, 4), (98, 48, 3.2), (92, 98, 2.6)] if key == 'diamond' else [(97, 46, 2.8)]
        spark = ''.join(f'<path d="M{x} {y-r*2} Q{x+r*.35} {y-r*.35} {x+r*2} {y} Q{x+r*.35} {y+r*.35} {x} {y+r*2} Q{x-r*.35} {y+r*.35} {x-r*2} {y} Q{x-r*.35} {y-r*.35} {x} {y-r*2} Z" fill="#fff" opacity=".95"/>' for x, y, r in sp)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="{key}">
<defs>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset=".48" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></linearGradient>
<linearGradient id="m2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/><stop offset=".55" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></linearGradient>
<radialGradient id="disc" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#3f8cff"/><stop offset=".55" stop-color="#1d4fb8"/><stop offset="1" stop-color="#0b1b4d"/></radialGradient>
<radialGradient id="gem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#8fe6f5"/><stop offset="1" stop-color="#1e88c7"/></radialGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8fe6f5" stop-opacity=".9"/><stop offset="1" stop-color="#8fe6f5" stop-opacity="0"/></radialGradient>
</defs>
<g>
<circle cx="60" cy="68" r="41" fill="url(#m)" stroke="{d}" stroke-width="1.2"/>
<circle cx="60" cy="68" r="35" fill="url(#m2)"/>
<circle cx="60" cy="68" r="30.5" fill="url(#disc)" stroke="{d}" stroke-width="1"/>
<circle cx="60" cy="68" r="20" fill="url(#glow)"/>
<path d="{STAR}" transform="translate(0 6)" fill="#fff"/>
<path d="M45 52 A20 20 0 0 1 73 47" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>
<path d="{crown}" fill="url(#m)" stroke="{d}" stroke-width="1.1" stroke-linejoin="round"/>
<rect x="{35 if idx >= 3 else 37}" y="28" width="{50 if idx >= 3 else 46}" height="7.5" rx="2" fill="url(#m2)" stroke="{d}" stroke-width="1"/>
{balls}{gem_svg}
</g>{spark}
</svg>'''
os.makedirs(OUT, exist_ok=True)
for i, k in enumerate(M):
    open(os.path.join(OUT, k + '.svg'), 'w').write(badge(k, i))
print('ok', list(M))
