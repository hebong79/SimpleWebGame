"""Local visual evidence with an already-installed Chrome/Edge; no installation.
The deterministic SVG generator is standard-library-only. This optional rendering
check uses the already-installed Pillow module to inspect raster alpha pixels.
Run: python assets/render_assets.py
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image
from generate_assets import ROOT, PUBLIC, VALUES

ASSETS = ROOT / 'assets'
BROWSERS = [Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
            Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')]


def render(browser: Path, source: Path, target: Path, width: int, height: int):
    args = [str(browser), '--headless', '--disable-gpu', '--hide-scrollbars',
            '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
            '--disable-extensions', '--force-device-scale-factor=1',
            '--run-all-compositor-stages-before-draw', '--virtual-time-budget=1000',
            '--default-background-color=00000000', f'--window-size={width},{height}',
            '--screenshot=' + str(target), source.as_uri()]
    result = subprocess.run(args, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stderr
    assert target.is_file(), result.stderr
    with Image.open(target) as im:
        assert im.size == (width, height), (target.name, im.size)
        assert len(im.convert('RGB').getcolors(width * height) or []) > 20, 'Blank render'
    return dict(source=source.relative_to(ROOT).as_posix(),
                screenshot=target.relative_to(ROOT).as_posix(),
                dimensions=[width, height], bytes=target.stat().st_size,
                exit_code=result.returncode)


def main():
    browser = next((p for p in BROWSERS if p.is_file()), None)
    if browser is None:
        raise SystemExit('No installed Chrome/Edge; visual inspection remains unverified.')
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    atlas = ET.Element('{http://www.w3.org/2000/svg}svg',
                       dict(width='1408', height='256', viewBox='0 0 1408 256'))
    for i, value in enumerate(VALUES):
        tile = ET.parse(PUBLIC / 'tiles' / f'tile-{value}.svg').getroot()
        tile.set('x', str(i * 128))
        tile.set('y', '64')
        tile.set('overflow', 'hidden')
        atlas.append(tile)
    atlas_path = ASSETS / 'ornament-alpha-atlas.svg'
    ET.ElementTree(atlas).write(atlas_path, encoding='utf-8', xml_declaration=True)
    sheet = render(browser, ASSETS / 'contact-sheet.svg', ASSETS / 'contact-sheet.png', 1560, 1090)
    alpha = render(browser, atlas_path, ASSETS / 'ornament-alpha-atlas.png', 1408, 256)
    pixel_checks = []
    with Image.open(ASSETS / 'ornament-alpha-atlas.png') as im:
        im = im.convert('RGBA')
        for i, value in enumerate(VALUES):
            # Actual browser pixels, not only path-coordinate inspection.
            center = im.getchannel('A').crop((i * 128 + 20, 64 + 40, i * 128 + 108, 64 + 84))
            assert center.getextrema() == (0, 0), f'Tile {value} intrudes into number region'
            full = im.getchannel('A').crop((i * 128, 64, (i + 1) * 128, 192))
            assert full.getbbox() is not None, f'Tile {value} failed to render'
            histogram = full.histogram()
            transparent_ratio = histogram[0] / (128 * 128)
            assert transparent_ratio > .80, (value, transparent_ratio)
            pixel_checks.append(dict(value=value, center_alpha_min_max=[0, 0],
                                     transparent_ratio=round(transparent_ratio, 4), nonempty=True))
    report = dict(status='PASS', renderer=str(browser), render_commands='See assets/render_assets.py',
                  number_safe_rectangle=[20, 40, 108, 84], renders=[sheet, alpha], tile_pixel_checks=pixel_checks,
                  scope='Asset rendering and central-alpha checks only; not game/UI/device acceptance.')
    (ASSETS / 'render-validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
