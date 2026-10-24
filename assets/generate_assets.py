"""Original Number Garden vector artwork; Python standard library only.
Run from any directory: python assets/generate_assets.py [--check]
No randomness, remote sources, fonts, downloaded art, scripts or references.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public' / 'assets'
VALUES = (2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048)
C = dict(cream='#F5F0E3', wall='#E8DDC6', sand='#DDCEAD', soil='#A77B56',
         clay='#B87556', rim='#CE9270', dark='#294D3C', green='#557657',
         leaf='#82A06A', light='#B9C58E', yellow='#E7BB55', coral='#D88973',
         pale='#EFE0BD', stone='#E8E0CD', ink='#345044')


def attrs(**kw):
    return ' '.join(f'{k.replace("_", "-")}="{escape(str(v))}"' for k, v in kw.items())


def tag(name, **kw):
    return f'<{name} {attrs(**kw)}/>'


def path(d, fill, **kw):
    return tag('path', d=d, fill=fill, **kw)


def ellipse(x, y, rx, ry, fill, **kw):
    return tag('ellipse', cx=x, cy=y, rx=rx, ry=ry, fill=fill, **kw)


def rect(x, y, w, h, fill, r=0, **kw):
    return tag('rect', x=x, y=y, width=w, height=h, rx=r, fill=fill, **kw)


def line(x1, y1, x2, y2, color, width=3, **kw):
    return tag('line', x1=x1, y1=y1, x2=x2, y2=y2, stroke=color,
               stroke_width=width, stroke_linecap='round', **kw)


def group(body, transform='', **kw):
    return f'<g {attrs(transform=transform, **kw)}>{body}</g>'


def leaf(x, y, scale=1, angle=0, color=None):
    # Tapered asymmetric leaf with a short pale midrib; original geometry.
    body = path('M0 0 C-17 -3 -24 -19 -17 -35 C0 -33 10 -16 0 0Z', color or C['leaf'])
    body += path('M-1 -3 Q-9 -14 -15 -28', 'none', stroke=C['light'], stroke_width=1.3,
                 stroke_linecap='round', opacity='.65')
    return group(body, f'translate({x} {y}) rotate({angle}) scale({scale})')


def sprig(x, y, s=1, angle=0, pairs=3, color=None):
    body = path(f'M0 0 Q-4 -28 0 {-pairs * 18 - 12}', 'none', stroke=C['green'],
                stroke_width=2.8, stroke_linecap='round')
    for i in range(pairs):
        yy = -8 - i * 18
        body += leaf(0, yy, .60, -48, color)
        body += leaf(0, yy - 6, .57, 72, color)
    body += leaf(0, -pairs * 18, .55, 15, color)
    return group(body, f'translate({x} {y}) rotate({angle}) scale({s})')


def flower(x, y, s=1, color=None, petals=6):
    body = ''
    for i in range(petals):
        body += ellipse(0, -11, 6.3, 10.5, color or C['coral'],
                        transform=f'rotate({i * 360 / petals:.2f})')
    body += ellipse(0, 0, 5.5, 5.5, C['yellow'])
    body += ellipse(-1.3, -1.6, 1.5, 1.5, C['pale'])
    return group(body, f'translate({x} {y}) scale({s})')


def bloom_stem(x, y, s=1, color=None, bend=0):
    body = path(f'M0 0 Q{bend - 7} -33 {bend} -75', 'none', stroke=C['green'],
                stroke_width=3, stroke_linecap='round')
    body += leaf(-2, -17, .7, -62)
    body += leaf(bend / 2, -34, .56, 64)
    body += flower(bend, -76, .8, color)
    return group(body, f'translate({x} {y}) scale({s})')


def pot(x, y, s=1, plant='sprout'):
    body = ellipse(0, 5, 63, 13, C['soil'], opacity='.13')
    if plant == 'sprout':
        body += sprig(0, -66, 1.16, 0, 2)
    elif plant == 'fern':
        for a, ss in ((-52, 1), (-25, 1.35), (0, 1.45), (28, 1.2), (55, .9)):
            body += sprig(0, -65, ss, a, 4)
    elif plant == 'flowers':
        for xx, yy, ss, bend, col in ((-18, -72, 1.12, -11, C['coral']),
                                     (8, -74, 1.5, 7, C['yellow']),
                                     (27, -70, .95, 12, C['pale'])):
            body += bloom_stem(xx, yy, ss, col, bend)
    body += path('M-52 -68 L-39 -8 Q0 9 39 -8 L52 -68Z', C['clay'])
    body += path('M-43 -61 L-33 -13 Q-21 -9 -13 -10 L-22 -61Z', C['rim'], opacity='.65')
    body += ellipse(0, -68, 54, 13, C['rim'])
    body += ellipse(0, -69, 43, 7.5, '#72583F')
    body += path('M-49 -56 Q0 -43 49 -56', 'none', stroke='#A9654B', stroke_width=3)
    return group(body, f'translate({x} {y}) scale({s})')


def shrub(x, y, s=1, color=None):
    color = color or C['green']
    body = ellipse(0, 0, 105, 16, C['dark'], opacity='.10')
    body += path('M-99 -9 C-115 -37 -93 -76 -64 -70 C-67 -106 -16 -128 8 -99 '
                 'C33 -132 83 -96 75 -65 C116 -69 133 -22 100 -9Z', color)
    for xx, yy, a in ((-60, -28, -14), (-18, -51, 28), (28, -35, -16), (71, -21, 25)):
        body += sprig(xx, yy, .32, a, 2, C['leaf'])
    return group(body, f'translate({x} {y}) scale({s})')


def paving(x, y, s=1, a=0):
    body = path('M-66 -15 Q-62 -28 -35 -30 L41 -24 Q66 -18 65 0 '
                'L52 21 Q39 31 -26 27 L-62 12Z', C['stone'], stroke='#D1C3A7', stroke_width=2)
    body += path('M-45 -13 Q-8 -21 35 -13', 'none', stroke=C['cream'], stroke_width=3)
    return group(body, f'translate({x} {y}) rotate({a}) scale({s})')


def watering_can(x, y, s=1):
    body = ellipse(0, 5, 51, 9, C['soil'], opacity='.12')
    body += path('M22 -61 C78 -77 79 -8 28 -20', 'none', stroke=C['green'], stroke_width=10)
    body += path('M-32 -31 L-78 -59 L-90 -53 L-37 -1Z', C['green'])
    body += ellipse(-86, -57, 10, 6, C['dark'], transform='rotate(-24 -86 -57)')
    body += path('M-34 -59 Q0 -70 35 -57 L29 -4 Q-2 10 -34 -5Z', C['leaf'])
    body += ellipse(0, -58, 35, 10, C['green'])
    body += ellipse(0, -59, 23, 5, C['dark'])
    body += path('M-22 -45 L-22 -11', 'none', stroke=C['light'], stroke_width=5,
                 stroke_linecap='round')
    return group(body, f'translate({x} {y}) scale({s})')


def backdrop(kind):
    body = rect(0, 0, 960, 640, C['cream'])
    body += ellipse(746, 125, 82, 82, '#F2E6C8')
    body += path('M0 286 Q220 248 424 282 T960 270 L960 640 L0 640Z', C['sand'])
    body += path('M0 358 Q238 322 481 351 T960 335 L960 640 L0 640Z', '#E8DCC4')
    # Hand-laid patio joints, soft enough to remain subordinate to the planting.
    for yy, xx in ((405, 114), (496, 56), (582, 193)):
        body += path(f'M0 {yy} Q430 {yy - 23} 960 {yy + 9}', 'none', stroke='#D9CBAF', stroke_width=2)
        body += path(f'M{xx} {yy - 3} L{xx - 24} {yy + 78} M{xx + 465} {yy - 3} L{xx + 441} {yy + 78}',
                     'none', stroke='#D9CBAF', stroke_width=2)
    return body


def seed_scene():
    body = backdrop('seed')
    # Quiet plaster garden wall with arch-shaped niche and a seedling shelf.
    body += path('M0 135 Q190 117 370 143 L370 336 L0 359Z', C['wall'])
    body += path('M62 293 L62 197 A94 94 0 0 1 250 197 L250 293Z', '#D8C7A7')
    body += path('M77 287 L77 201 A79 79 0 0 1 235 201 L235 287Z', '#F1E7D3')
    body += rect(48, 286, 218, 14, C['soil'], 4)
    body += pot(159, 285, .48)
    body += path('M1 150 Q173 132 360 153', 'none', stroke='#F7F0DF', stroke_width=6)
    # Simple bamboo ladder and a small, deliberately spare vegetable bed.
    for x in (634, 744):
        body += line(x, 157, x - 10, 344, C['soil'], 7)
    for y in (185, 225, 265, 305):
        body += line(632, y, 741, y, '#B8936E', 5)
    body += sprig(687, 341, 1.5, -12, 4, C['leaf'])
    body += path('M572 391 L798 363 L885 414 L658 448Z', C['rim'])
    body += path('M658 448 L885 414 L885 459 L658 496Z', C['clay'])
    body += path('M572 391 L658 448 L658 496 L572 438Z', '#A56B4F')
    body += path('M592 392 L798 373 L862 413 L659 437Z', '#897354')
    for x, y, ss in ((645, 398, .37), (711, 394, .47), (774, 389, .39), (715, 424, .40), (808, 414, .33)):
        body += sprig(x, y, ss, -6, 1)
    body += paving(473, 376, .65, -5) + paving(462, 454, .83, 5) + paving(416, 554, 1.08, -4)
    body += ellipse(253, 492, 136, 24, C['soil'], opacity='.10')
    body += pot(245, 485, 1.25) + pot(128, 528, .66)
    body += watering_can(581, 540, .88)
    # Closed seed packet, trowel and pebbles: tiny props, no embedded lettering.
    body += group(rect(-20, -29, 40, 58, C['pale'], 4) + line(-19, -17, 19, -17, '#C9AD7C', 2)
                  + leaf(0, 15, .65, 12), 'translate(704 543) rotate(13)')
    body += group(line(0, 0, 0, -33, C['soil'], 8)
                  + path('M-14 -38 Q0 -65 14 -38 L8 -19 L-8 -19Z', '#849084'),
                  'translate(775 563) rotate(28)')
    for x, y, rx in ((71, 579, 9), (834, 534, 13), (862, 546, 8), (334, 352, 7)):
        body += ellipse(x, y, rx, rx * .58, '#C3B79E')
    body += sprig(883, 605, .68, 15, 2)
    return body


def grove_scene():
    body = backdrop('grove')
    body += path('M0 243 Q237 156 471 222 T960 198 L960 343 Q620 304 0 368Z', '#C8CDA8')
    body += path('M0 301 Q237 246 471 280 T960 260 L960 383 Q620 348 0 395Z', '#A8B790')
    # A wide tree canopy frames an open, pale courtyard.
    body += path('M128 361 Q148 230 139 127 L190 112 Q167 231 197 357Z', '#8C7151')
    body += path('M162 222 L81 142 M167 178 L246 99', 'none', stroke='#8C7151', stroke_width=17,
                 stroke_linecap='round')
    for x, y, rx, ry, col in ((52, 92, 135, 82, C['green']), (172, 59, 139, 93, C['dark']),
                             (288, 101, 142, 88, C['green']), (117, 143, 138, 77, '#66845B'),
                             (830, 107, 157, 92, C['green']), (963, 152, 149, 107, C['dark'])):
        body += ellipse(x, y, rx, ry, col)
    for x, y, a in ((50, 107, -21), (204, 82, 34), (298, 135, 65), (824, 114, -20), (923, 183, 20)):
        body += sprig(x, y, .58, a, 2, '#95AC78')
    body += shrub(276, 363, 1.05) + shrub(842, 366, 1.36) + shrub(949, 428, 1.10, C['dark'])
    body += path('M320 640 Q493 449 582 338 L635 342 Q554 481 509 640Z', '#D1BE97')
    for x, y, ss, a in ((602, 365, .54, -9), (564, 420, .66, 3), (517, 488, .80, -7), (465, 574, 1, 7)):
        body += paving(x, y, ss, a)
    # Cedar slat bench, visible feet and paired seat highlights.
    body += group(line(0, 0, 0, 62, '#6C6550', 12) + line(228, 0, 228, 62, '#6C6550', 12)
                  + line(6, -79, 6, 15, '#6C6550', 9) + line(222, -79, 222, 15, '#6C6550', 9)
                  + rect(-17, -78, 262, 22, '#BA9770', 5) + rect(-17, -46, 262, 22, '#BA9770', 5)
                  + rect(-27, -7, 282, 24, '#A5805C', 5) + rect(-23, -7, 274, 7, '#D0AF84', 3),
                  'translate(638 441)')
    body += pot(171, 535, 1.13, 'fern') + pot(319, 535, .62)
    body += shrub(51, 582, .98, C['dark']) + shrub(890, 613, 1.15, '#66845B')
    body += watering_can(686, 532, .58)
    for x, y, a in ((352, 591, -62), (563, 571, 43), (730, 360, 77)):
        body += leaf(x, y, .48, a, '#93A476')
    return body


def bloom_scene():
    body = backdrop('bloom')
    body += path('M0 175 Q300 132 545 174 T960 152 L960 345 Q500 315 0 359Z', '#E5D7B9')
    body += path('M0 177 Q300 134 545 176 T960 154', 'none', stroke='#F9F1DC', stroke_width=7)
    # Arched rose trellis is unique to the flower garden.
    body += path('M372 351 L372 185 A107 107 0 0 1 586 185 L586 351', 'none',
                 stroke='#A18A63', stroke_width=12)
    body += path('M392 349 L392 186 A87 87 0 0 1 566 186 L566 349', 'none',
                 stroke='#B5A27B', stroke_width=5)
    for y in (208, 254, 300):
        body += line(365, y, 398, y, '#A18A63', 5) + line(561, y, 593, y, '#A18A63', 5)
    body += path('M369 334 C403 279 348 216 388 168 C394 99 506 65 554 142 C604 202 553 259 588 319',
                 'none', stroke=C['green'], stroke_width=7, stroke_linecap='round')
    for x, y, a in ((371, 308, -24), (388, 252, 52), (374, 203, -40), (410, 137, 40),
                    (466, 111, 65), (532, 130, 85), (565, 189, 55), (575, 261, -25), (588, 309, 75)):
        body += leaf(x, y, 1.08, a)
    for x, y, col, ss in ((384, 192, C['coral'], .85), (424, 130, C['yellow'], .76),
                          (496, 104, C['coral'], .95), (555, 155, C['pale'], .83),
                          (574, 239, C['coral'], .75), (375, 286, C['pale'], .7)):
        body += flower(x, y, ss, col)
    body += shrub(216, 341, 1.04, '#8D9E70') + shrub(760, 345, 1.20, '#7D9567')
    # Winding stepping-stone walkway keeps the middle readable.
    body += path('M394 640 Q626 507 485 341 L536 340 Q723 497 536 640Z', '#D7C49F')
    for x, y, ss, a in ((512, 374, .57, 7), (546, 432, .65, -5), (564, 501, .80, 5), (514, 584, 1, -11)):
        body += paving(x, y, ss, a)
    # Two layered raised beds; blooms have varied height, color and petal count.
    for x, y, ss in ((176, 486, 1.0), (806, 501, 1.12)):
        b = ellipse(0, 6, 139, 18, C['soil'], opacity='.12')
        b += path('M-133 -63 L133 -63 L115 -1 Q0 18 -115 -1Z', C['clay'])
        b += rect(-139, -76, 278, 23, C['rim'], 7)
        b += ellipse(0, -69, 128, 12, '#7D7152')
        for xx, h, col, bend in ((-105, .9, C['pale'], -6), (-65, 1.4, C['coral'], -12),
                                 (-17, 1.1, C['yellow'], 5), (23, 1.7, C['yellow'], 12),
                                 (71, 1.28, C['coral'], -6), (108, .88, C['pale'], 7)):
            b += bloom_stem(xx, -68, h, col, bend)
        body += group(b, f'translate({x} {y}) scale({ss})')
    body += pot(325, 575, .82, 'flowers') + pot(729, 593, .61, 'flowers')
    body += watering_can(110, 584, .69)
    body += sprig(893, 620, .86, 16, 3)
    for x, y, col in ((382, 591, C['coral']), (636, 560, C['yellow']), (653, 585, C['pale'])):
        body += ellipse(x, y, 5, 9, col, transform=f'rotate(35 {x} {y})')
    # Small butterfly, original silhouette, not an animated particle.
    body += group(ellipse(-8, -3, 7, 11, C['yellow'], transform='rotate(-30)')
                  + ellipse(7, -3, 7, 11, C['pale'], transform='rotate(30)')
                  + line(0, -7, 0, 9, C['soil'], 2), 'translate(665 204) rotate(18)')
    return body


def tile_art(value):
    i = VALUES.index(value)
    # All drawing stays in corner/edge bands; x=36..92, y=29..97 is clear.
    if i == 0:
        b = ellipse(17, 111, 5, 8, C['soil'], transform='rotate(-35 17 111)')
        b += ellipse(111, 17, 4, 6.5, C['leaf'], transform='rotate(35 111 17)')
    elif i == 1:
        b = sprig(17, 119, .32, -10, 1) + ellipse(18, 119, 6, 2, C['soil'])
        b += leaf(114, 15, .32, 65)
    elif i == 2:
        b = sprig(19, 120, .46, -15, 1) + sprig(111, 26, .28, 30, 1)
    elif i == 3:
        b = sprig(20, 122, .43, -12, 2) + sprig(113, 29, .33, 24, 2)
    elif i == 4:
        b = sprig(15, 124, .40, -5, 3) + sprig(116, 31, .32, 20, 3)
        b += ellipse(32, 116, 2.7, 2.7, C['yellow'])
    elif i == 5:
        b = sprig(17, 124, .40, -12, 3) + sprig(114, 31, .32, 25, 3)
        for xx, yy in ((11, 91), (24, 104), (111, 10)):
            b += ellipse(xx, yy, 3.5, 4.5, C['yellow'])
    elif i == 6:
        b = bloom_stem(19, 124, .38, C['pale'], -3) + sprig(112, 31, .31, 22, 3)
        b += flower(111, 12, .30, C['yellow'])
    elif i == 7:
        b = sprig(16, 125, .43, -9, 3) + sprig(31, 124, .32, 22, 2)
        b += sprig(113, 34, .40, 23, 3) + leaf(17, 18, .37, 17, C['light'])
    elif i == 8:
        b = sprig(13, 125, .49, -4, 3) + sprig(28, 125, .37, 20, 3)
        b += sprig(114, 35, .43, 21, 3) + sprig(16, 24, .32, -12, 2)
        b += ellipse(106, 116, 3.5, 3.5, C['yellow'])
    elif i == 9:
        b = bloom_stem(15, 126, .42, C['coral'], 2) + bloom_stem(31, 125, .28, C['yellow'], -4)
        b += sprig(113, 35, .42, 21, 3) + flower(110, 13, .36, C['coral'])
        b += leaf(17, 17, .41, 22, C['light'])
    else:
        b = bloom_stem(14, 127, .42, C['yellow'], 3) + bloom_stem(31, 126, .29, C['coral'], -5)
        b += sprig(114, 37, .43, 21, 3) + flower(110, 13, .38, C['yellow'])
        b += sprig(14, 27, .34, -8, 2) + flower(16, 14, .29, C['pale'])
        b += sprig(111, 125, .31, 40, 2) + flower(109, 109, .27, C['coral'])
        b += path('M44 116 Q64 124 84 116', 'none', stroke=C['yellow'], stroke_width=1.7,
                  stroke_linecap='round')
        b += path('M61 118 L64 114 L67 118 L64 122Z', C['yellow'])
    return b


def favicon():
    b = rect(0, 0, 64, 64, C['dark'], 15)
    for x, y in ((12, 12), (35, 12), (12, 35), (35, 35)):
        b += rect(x, y, 17, 17, C['cream'] if y == 35 else '#52745A', 4)
    b += sprig(32, 40, .53, 0, 1, C['light'])
    return b


def svg(w, h, title, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" role="img" aria-label="{escape(title)}">\n'
            f'<title>{escape(title)}</title>\n{body}\n</svg>\n')


def text(x, y, label, size=20, fill=None, weight=400):
    return f'<text {attrs(x=x, y=y, fill=fill or C["ink"], font_size=size, font_family="system-ui, sans-serif", font_weight=weight)}>{escape(str(label))}</text>'


def outputs():
    out = {}
    for value in VALUES:
        out[f'tiles/tile-{value}.svg'] = svg(128, 128, f'Number Garden tile ornament {value}', tile_art(value))
    scenes = dict(seed=seed_scene(), grove=grove_scene(), bloom=bloom_scene())
    titles = dict(seed='Seed courtyard', grove='Green grove courtyard', bloom='Flower garden courtyard')
    for key, body in scenes.items():
        out[f'gardens/{key}.svg'] = svg(960, 640, titles[key], body)
    out['favicon.svg'] = svg(64, 64, 'Number Garden leaf grid', favicon())
    sheet = rect(0, 0, 1560, 1090, '#F9F6ED')
    sheet += text(36, 55, 'NUMBER GARDEN / ORIGINAL VECTOR ATLAS', 27, weight=650)
    sheet += text(36, 88, 'G-003  /  11 tile ornaments + 3 courtyard scenes + 1 favicon  /  no external sources', 16)
    for j, (key, body) in enumerate(scenes.items()):
        x = 36 + j * 504
        sheet += rect(x, 118, 480, 320, C['wall'], 12)
        sheet += f'<svg x="{x}" y="118" width="480" height="320" viewBox="0 0 960 640" overflow="hidden">{body}</svg>'
        sheet += text(x, 470, f'{key.upper()} / ' + ('DEFAULT' if j == 0 else 'UNLOCK ' + ('256' if j == 1 else '1024')), 19, weight=600)
    sheet += text(36, 529, 'TRANSPARENT TILE ORNAMENTS', 20, weight=650)
    sheet += text(36, 555, 'Numbers below are preview overlays only; runtime SVG tiles contain no text.', 16)
    for i, value in enumerate(VALUES):
        col, row = i % 6, i // 6
        x, y = 53 + col * 250, 592 + row * 217
        sheet += rect(x, y, 170, 170, ['#ECE4D4', '#E6DEC9', '#DADEC5', '#D0D8BA', '#C4D0AF', '#B7C7A5', '#A4B992', '#8BA77D', '#76966D', '#547A59', '#365F46'][i], 17)
        sheet += group(tile_art(value), f'translate({x} {y}) scale(1.328125)')
        sheet += text(x + 85, y + 100, value, 39 if value < 1024 else 33,
                      C['dark'] if i < 8 else C['cream'], 700).replace('font-size=', 'text-anchor="middle" font-size=')
        sheet += text(x, y + 195, f'tile-{value}.svg', 15)
    sheet += group(favicon(), 'translate(1338 848) scale(1.25)')
    sheet += text(1315, 967, 'favicon.svg / 64 x 64', 15)
    return out, svg(1560, 1090, 'Number Garden original artwork contact sheet', sheet)


def validate(expected):
    files = sorted(PUBLIC.rglob('*.svg'))
    actual = {str(p.relative_to(PUBLIC)).replace('\\', '/') for p in files}
    assert actual == set(expected), f'Runtime path mismatch: {actual ^ set(expected)}'
    assert len(files) == 15, f'Expected 15 runtime SVGs, found {len(files)}'
    dimensions = {}
    hashes = {}
    for file in files:
        rel = file.relative_to(PUBLIC).as_posix()
        data = file.read_text(encoding='utf-8')
        assert data == expected[rel], f'Non-deterministic or modified output: {rel}'
        root = ET.fromstring(data)
        w, h = (128, 128) if rel.startswith('tiles/') else (960, 640) if rel.startswith('gardens/') else (64, 64)
        assert root.attrib['viewBox'] == f'0 0 {w} {h}'
        assert root.attrib['width'] == str(w) and root.attrib['height'] == str(h)
        assert not re.search(r'<!DOCTYPE|<!ENTITY|@import|javascript:|data:|https?://(?!www\.w3\.org/2000/svg)', data, re.I)
        ids = set()
        for node in root.iter():
            name = node.tag.rsplit('}', 1)[-1].lower()
            assert name not in ('script', 'foreignobject', 'image', 'use', 'style', 'animate', 'animatetransform', 'set', 'iframe'), (rel, name)
            if rel.startswith('tiles/'):
                assert name not in ('text', 'rect'), f'Tile must be transparent ornament only: {rel}'
            if 'id' in node.attrib:
                assert node.attrib['id'] not in ids
                ids.add(node.attrib['id'])
            for k, v in node.attrib.items():
                assert not k.lower().startswith('on')
                assert not k.lower().endswith('href')
                assert 'url(' not in v.lower()
        dimensions[rel] = [w, h]
        hashes[rel] = hashlib.sha256(file.read_bytes()).hexdigest()
    assert len(set(hashes.values())) == 15, 'Assets must be distinct'
    ET.parse(ROOT / 'assets' / 'contact-sheet.svg')
    return dict(status='PASS', runtime_svg_count=len(files), tile_count=11, garden_count=3,
                favicon_count=1, dimensions=dimensions, sha256=hashes,
                checks=['exact paths', 'XML parse', 'dimensions/viewBox', 'distinct content',
                        'deterministic exact regeneration', 'no tile text/opaque rectangle',
                        'no scripts/events/animation/remote refs/embedded rasters/fonts', 'contact sheet XML'],
                visual_check='See assets/contact-sheet.png and docs/ASSETS.md; not a gameplay test.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate existing files without modifying them')
    args = parser.parse_args()
    out, sheet = outputs()
    if not args.check:
        for rel, data in out.items():
            file = PUBLIC / rel
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(data, encoding='utf-8', newline='\n')
        (ROOT / 'assets' / 'contact-sheet.svg').write_text(sheet, encoding='utf-8', newline='\n')
    report = validate(out)
    if not args.check:
        (ROOT / 'assets' / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
