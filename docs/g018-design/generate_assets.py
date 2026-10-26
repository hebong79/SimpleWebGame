from pathlib import Path
import argparse, hashlib, json
BASE=Path(__file__).resolve().parent
COLORS={"I":"#86b6af","J":"#8ea2ba","L":"#d3a376","O":"#dbc575","S":"#9bac79","T":"#b09aa9","Z":"#c4897e"}
def kits():
    blocks=[]
    for ident,color in COLORS.items():
        blocks.append(f'<symbol id="tile-{ident}" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="5" fill="{color}" stroke="#243c35" stroke-width="2"/><path d="M6 8H26" stroke="#fffef9" opacity=".45"/><text x="16" y="23" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="700" fill="#243c35">{ident}</text></symbol>')
    kit05='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 32" role="img" aria-label="직접 제작한 블록 7종"><defs>'+''.join(blocks)+'</defs>'+''.join(f'<use href="#tile-{i}" x="{n*32}" width="32" height="32"/>' for n,i in enumerate(COLORS))+'</svg>'
    body=[]
    for f,wing in [('fly0','M34 50Q16 24 24 19Q46 32 53 49'),('fly1','M34 50Q12 47 18 59Q36 65 53 49'),('fly2','M34 50Q22 76 34 78Q49 69 53 49'),('hit','M34 50Q12 47 18 59Q36 65 53 49')]:
        eye='<path d="M55 39l8 8m0-8l-8 8" stroke="#284d3b" stroke-width="3"/>' if f=='hit' else '<circle cx="60" cy="42" r="3" fill="#243c35"/>'
        body.append(f'<symbol id="sparrow-{f}" viewBox="0 0 96 96"><path d="M25 48L13 40L17 57Z" fill="#79523e"/><circle cx="48" cy="48" r="24" fill="#ab7754"/><path d="M46 52Q50 76 67 59" fill="#e9c8a0"/><path d="{wing}" fill="#76513e" stroke="#f6f3e9" stroke-width="2"/><path d="M70 43L82 48L69 52Z" fill="#dba64a"/>{eye}<path d="M43 70v7m12-7v7" stroke="#79523e" stroke-width="3"/></symbol>')
        for outfit in ['pilot','rain','bee']:
            hue={'pilot':'#597b83','rain':'#e7b451','bee':'#c5a442'}[outfit]
            head={'pilot':'<path d="M29 29Q46 8 68 30V36H29Z" fill="#597b83"/><rect x="35" y="24" width="27" height="9" rx="4" fill="#dce5d7" stroke="#284d3b"/>','rain':'<path d="M25 34L38 15H58L72 34Z" fill="#e7b451"/><path d="M22 35H74" stroke="#a87526" stroke-width="4"/>','bee':'<path d="M39 22L34 12m21 10l7-10" stroke="#284d3b" stroke-width="3"/><circle cx="34" cy="11" r="4" fill="#c5a442"/><circle cx="62" cy="11" r="4" fill="#c5a442"/>'}[outfit]
            chest=f'<path d="M31 52Q50 72 68 52L62 68Q46 80 32 65Z" fill="{hue}"/>'
            if outfit=='bee': chest+='<path d="M35 60H64M37 67H59" stroke="#284d3b" stroke-width="4"/>'
            ankle=f'<path d="M40 72H48M51 72H59" stroke="{hue}" stroke-width="5"/>'
            for part,shape in [('head',head),('body',chest),('ankle',ankle)]:body.append(f'<symbol id="{outfit}-{part}-{f}" viewBox="0 0 96 96">{shape}</symbol>')
    body.append('<symbol id="garden-arch" viewBox="0 0 52 240"><rect x="3" y="0" width="46" height="240" rx="5" fill="#c3d4b7" stroke="#55775c" stroke-width="3"/><path d="M5 25L47 65M5 65L47 105M5 105L47 145M5 145L47 185M5 185L47 225M47 25L5 65M47 65L5 105M47 105L5 145M47 145L5 185M47 185L5 225" stroke="#55775c" stroke-width="2"/><path d="M26 15Q4 54 25 92T26 175T26 234" fill="none" stroke="#7b9d66" stroke-width="6"/></symbol>')
    kit06='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 96" role="img" aria-label="자체 참새 날갯짓3종과 충돌1종, 의상9부위와 아치"><defs>'+''.join(body)+'</defs>'+''.join(f'<use href="#sparrow-{f}" x="{n*96}" width="96" height="96"/>' for n,f in enumerate(['fly0','fly1','fly2','hit']))+'</svg>'
    return {'05/kit.svg':kit05,'06/kit.svg':kit06}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();out={}
    for name,content in kits().items():
        p=BASE/name;data=(content+'\n').encode()
        if args.check:assert p.read_bytes()==data,name
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        out[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    print(json.dumps({'checked':args.check,'assets':out}))
if __name__=='__main__':main()
