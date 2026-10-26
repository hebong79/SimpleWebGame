"""PM original SVG atlases for G022; stdlib only, no external assets."""
from pathlib import Path
import xml.etree.ElementTree as ET
import json
import hashlib

HERE = Path(__file__).resolve().parent
POSES = {
    '07': ['run0', 'run1', 'run2', 'run3', 'jump', 'duck0', 'duck1', 'hit'],
    '08': ['idle', 'rise', 'fall', 'land', 'hit'],
}
COLORS = {'postal': '#46735a', 'space': '#788ba7', 'sport': '#b95d3c', 'star': '#b58b38', 'explorer': '#527e9a', 'carrot': '#c57449'}


def symbol(name, shapes):
    return f'<symbol id="{name}" viewBox="0 0 96 96">{shapes}</symbol>'


def body07(pose):
    duck = pose.startswith('duck')
    cy, ry = (68, 14) if duck else (52, 28)
    face = 64 if duck else 40
    stride = {'run0': -5, 'run1': 0, 'run2': 5, 'run3': 0, 'duck0': -3, 'duck1': 3}.get(pose, 0)
    eye = '<path d="M58 38l7 7m0-7l-7 7"/>' if pose == 'hit' else f'<circle cx="63" cy="{face}" r="2.8" fill="#203d31" stroke="none"/>'
    legs = f'<path d="M38 {cy+ry-4}v{84-cy-ry+4}h{-6+stride}m25 {-84+cy+ry-4}v{84-cy-ry+4}h{6-stride}" fill="none" stroke-width="5"/>'
    return f'<g fill="#7d9b59" stroke="#36533b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M31 {cy+8}Q12 {cy+20} 12 {cy+4}q8 9 20-3"/><ellipse cx="48" cy="{cy}" rx="20" ry="{ry}"/>{legs}<ellipse cx="53" cy="{cy+8}" rx="11" ry="{ry-7}" fill="#b6c786" stroke="none"/>{eye}<path d="M62 {face+10}h8" fill="none"/></g>'


def body08(pose):
    spread = {'idle': 0, 'rise': -5, 'fall': 6, 'land': 9, 'hit': 12}[pose]
    eye = '<path d="M36 55l5 5m0-5l-5 5m19-5l5 5m0-5l-5 5" stroke="#3f5e6a" stroke-width="2"/>' if pose == 'hit' else '<g fill="#3f5e6a"><circle cx="39" cy="57" r="2.5"/><circle cx="57" cy="57" r="2.5"/></g>'
    return f'<g fill="#fffaf0" stroke="#66818b" stroke-width="2.3" stroke-linejoin="round"><ellipse cx="{38-spread/3}" cy="28" rx="7" ry="22" transform="rotate({-10-spread} 38 44)"/><ellipse cx="{58+spread/3}" cy="28" rx="7" ry="22" transform="rotate({10+spread} 58 44)"/><ellipse cx="48" cy="64" rx="18" ry="20"/><ellipse cx="34" cy="82" rx="8" ry="3"/><ellipse cx="62" cy="82" rx="8" ry="3"/><path d="M45 66l3 3 3-3" fill="#ce9c92" stroke="none"/>{eye}</g>'


def costume(game, pose, part, outfit):
    c = COLORS[outfit]
    duck = pose.startswith('duck')
    y = 61 if duck else (31 if game == '07' else 22)
    if part in ('hat', 'ears'):
        if outfit in ('space', 'star'):
            shape = f'<path d="M34 {y}l5-9 8 5 9-6 5 11z" fill="{c}"/><circle cx="48" cy="{y-4}" r="3" fill="#f9f1be"/>'
        else:
            shape = f'<path d="M33 {y}v-9q14-8 28 0v9z" fill="{c}"/><path d="M28 {y}h39" stroke="{c}" stroke-width="5"/><rect x="43" y="{y-10}" width="9" height="6" rx="1" fill="#f7e8c6"/>'
    elif part == 'body':
        cy = 72 if duck else (66 if game == '07' else 73)
        width = 32 if game == '07' else 28
        shape = f'<path d="M{48-width/2} {cy-9}q{width/2} 5 {width} 0v15q{-width/2} 8 {-width} 0z" fill="{c}"/><path d="M46 {cy-7}v15" stroke="#f7e8c6" stroke-width="2"/>'
    else:
        y = 66 if duck else (51 if game == '07' else 57)
        shape = f'<path d="M28 {y}h-9v18h13V{y+4}" fill="{c}"/><path d="M23 {y+3}v-5h6v5" fill="none" stroke="{c}" stroke-width="3"/><path d="M20 {y+8}h10" stroke="#f7e8c6" stroke-width="2"/>'
    return f'<g stroke="#344f48" stroke-width="1.5" stroke-linejoin="round">{shape}</g>'


def atlas(game):
    poses = POSES[game]
    kinds = ['postal', 'space', 'sport'] if game == '07' else ['star', 'explorer', 'carrot']
    parts = ['hat', 'body', 'bag'] if game == '07' else ['ears', 'body', 'bag']
    items = [symbol(f'base-{p}', body07(p) if game == '07' else body08(p)) for p in poses]
    for p in poses:
        for outfit in kinds:
            for part in parts:
                items.append(symbol(f'{outfit}-{part}-{p}', costume(game, p, part, outfit)))
    if game == '07':
        items.extend([symbol('cactus', '<path d="M37 90V22a11 11 0 0122 0v28h9V31h13v28H59v31zM37 63H16V37h13v13h8" fill="#567453" stroke="#36533b" stroke-width="3"/>'), symbol('bird', '<path d="M9 54l25-9 15-20 7 24 31 8-27 13H32z" fill="#b95d3c" stroke="#79442f" stroke-width="3"/><circle cx="70" cy="56" r="2.5" fill="#f8e6c3"/>')])
    else:
        items.extend([symbol('cloud', '<path d="M16 64a15 15 0 016-29 24 24 0 0145-1 15 15 0 017 30z" fill="#fffaf0" stroke="#99b7be" stroke-width="3"/>'), symbol('platform', '<rect x="3" y="35" width="90" height="24" rx="12" fill="#719f8b"/><path d="M13 43h70" stroke="#f9fcf0" stroke-width="5" stroke-linecap="round"/>'), symbol('platform-moving', '<rect x="3" y="35" width="90" height="24" rx="12" fill="#c18963"/><path d="M18 47h60m-60 0l8-6m-8 6l8 6m52-6l-8-6m8 6l-8 6" fill="none" stroke="#fff6e7" stroke-width="3"/>')])
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><title>G022 PM original {game} costume and pose atlas</title><defs>{"".join(items)}</defs></svg>\n'


def main():
    manifest = {'author': 'PM 대현자', 'provenance': 'Original geometric SVG authored for this project; no third-party art/fonts/network.', 'license': 'Project-owned original art', 'feet_anchor': [48, 84], 'viewBox': [0, 0, 96, 96], 'recommended_scale': 0.8, 'layer_order': ['bag', 'base', 'body', 'hat/ears'], 'poses': POSES, 'assets': {}}
    for game in POSES:
        data = atlas(game).encode()
        root = ET.fromstring(data)
        ids = [e.attrib['id'] for e in root.iter() if 'id' in e.attrib]
        assert len(ids) == len(set(ids))
        dest = HERE / f'{game}-kit.svg'
        if dest.exists() and dest.read_bytes() != data:
            raise RuntimeError(f'Refusing changed existing asset: {dest}')
        dest.write_bytes(data)
        manifest['assets'][dest.name] = {'sha256': hashlib.sha256(data).hexdigest(), 'symbols': len(ids), 'bytes': len(data)}
    dest = HERE / 'asset-manifest.json'
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    if dest.exists() and dest.read_text(encoding='utf-8') != text:
        raise RuntimeError('Refusing changed manifest')
    dest.write_text(text, encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == '__main__':
    main()
