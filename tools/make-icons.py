"""앱 아이콘 생성 (빌드 도구): python tools/make-icons.py
어두운 바탕 위에 색 막대 = '하이라이트된 가사 줄'을 형상화."""
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
BG = (20, 20, 19)
ROWS = [  # (색, 시작, 길이) 비율
    [((57, 135, 229), 0.00, 0.34), ((64, 64, 60), 0.40, 0.20), ((57, 135, 229), 0.66, 0.34)],
    [((217, 89, 38), 0.00, 0.22), ((64, 64, 60), 0.28, 0.38), ((217, 89, 38), 0.72, 0.28)],
    [((64, 64, 60), 0.00, 0.30), ((25, 158, 112), 0.36, 0.30), ((25, 158, 112), 0.72, 0.28)],
    [((213, 81, 129), 0.00, 0.46), ((64, 64, 60), 0.52, 0.16), ((213, 81, 129), 0.74, 0.26)],
]

def icon(size, pad_ratio=0.18, rounded=True):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    pad = S * pad_ratio
    inner = S - pad * 2
    n = len(ROWS)
    bar_h = inner / (n * 1.55)
    gap = (inner - bar_h * n) / (n - 1)
    for i, row in enumerate(ROWS):
        y = pad + i * (bar_h + gap)
        for col, x0, w in row:
            x = pad + x0 * inner
            fill = col if len(col) == 4 else col + (255,)
            d.rounded_rectangle([x, y, x + w * inner - S * 0.012, y + bar_h], radius=bar_h / 2, fill=fill)
    return im.resize((size, size), Image.LANCZOS)

icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(512, pad_ratio=0.26, rounded=False).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(180, rounded=False).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(32).save(os.path.join(OUT, 'favicon-32.png'))
print('ok')
