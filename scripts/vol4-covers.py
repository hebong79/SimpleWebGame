from pathlib import Path
import json,html,math
r=Path('.');games=json.loads((r/'docs/vol4/catalog.json').read_text(encoding='utf-8'));out=r/'public/games/vol4/covers';out.mkdir(exist_ok=True)
def rect(x,y,w,h,fill,stroke='none',rx=4):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def t(x,y,s,size=22,c='#263e57'):return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Segoe UI,Malgun Gothic,sans-serif" font-weight="600" font-size="{size}" fill="{c}">{html.escape(str(s))}</text>'
def line(x,y,a,b,c,width=4):return f'<line x1="{x}" y1="{y}" x2="{a}" y2="{b}" stroke="{c}" stroke-width="{width}" stroke-linecap="round"/>'
def circle(x,y,rad,c,st='none'):return f'<circle cx="{x}" cy="{y}" r="{rad}" fill="{c}" stroke="{st}" stroke-width="2"/>'
colors=[('#f4e8d0','#986646','#ceaf8f'),('#e9e8f6','#655c96','#aba5cc'),('#e2f0e4','#387f6f','#9cb9ab'),('#e1eee5','#42745b','#a0b996'),('#e7eadd','#805c43','#b8b098'),('#e7eff9','#3e6b98','#a8c5df'),('#23243e','#75d3c2','#8698b8'),('#18303b','#8bd8cd','#8d9ac7'),('#f4ebdd','#438577','#d2b997'),('#e6f0e3','#344e64','#afc0b4')]
for k,g in enumerate(games):
 n=k+61;bg,ink,muted=colors[k%10];s=''
 if n in [61,62,63,64,65,66,67,68,69,70,71,72,74,75,76,77]:
  count=3 if n==62 else 6 if n in[70,72]else 5;size=192/count;x0=204;y0=84
  for y in range(count):
   for x in range(count):
    value='';fill='#ffffffb0';stroke=muted;idx=y*count+x
    if n==62:value=([4,1,3,5,2,6,7,8,9])[idx]
    if n==64:value=(x//2+y)%4+1 if(x+y)%3 else '';fill=['#d4dfbb','#a9d8d2','#c7b7dd','#f2c987'][(x//2+y)%4]
    if n==65:value=(x+y)%4+1 if(x+y)%3==0 else ''
    if n==66:value=(x+y)%5+1;fill=ink if idx in[2,6,18]else'#ffffffb0';value=''if idx in[2,6,18]else value
    if n==67:fill=ink if idx in[2,5,9,15,18,22]else'#ffffffc0';value=7 if idx==12 else ''
    if n==68:value='/'if idx==6 else'\\'if idx==14 else['직','반','공'][idx%3]if idx%5==0 else''
    if n==70:fill=ink if idx in[2,7,10,13,16,19,28,35]else'#ffffffb0';value=idx%5 if idx%3==0 else''
    if n==72:value='해'if idx%3==0 else'달'if idx%4==0 else'';fill='#f5ce87'if value=='해'else'#34465e'if value=='달'else'#ffffffb0'
    if n==75:value=[1,2,3][idx%3]if idx in[7,8,13,17]else'';fill='#d8c2a4' if value else '#ffffffb0'
    s+=rect(x0+x*size,y0+y*size,size-2,size-2,fill,stroke,2)+t(x0+x*size+size/2,y0+y*size+size*.66,value,int(size*.46),ink if n!=72 or value!='달'else'#fff')
  if n==61:s+=f'<path d="M280 132l26,-15l26,15v31l-26,15l-26,-15Z" fill="#be8b57"/>'+f'<path d="M280 132l26,15l26,-15l-26,-15Z" fill="#f5cc83"/>'+line(306,147,306,178,'#f9e2bb',2)
  if n==62:s+=rect(204,84,126,126,'#71c8b166',ink)+t(267,161,'↻',48,ink)
  if n in[63,76]:s+=line(231,219,367,219,ink,4)+t(330,211,'◆',24,'#d6a74d')+rect(250,177,24,25,'#86cbb9',ink)+circle(257,185,3,ink)+circle(266,185,3,ink)+rect(369,176,24,25,'#d0b7dd',ink)
  if n==65:
   for x,y,w,h,v in[(204,84,76,38,'3+'),(282,84,76,76,'12×'),(204,164,154,38,'8+'),(360,84,36,114,'2×')]:s+=rect(x,y,w,h,'none',ink)+t(x+12,y+14,v,10,ink)
  if n==67:s+=line(222,180,378,180,'#73cbb688',26)+line(300,100,300,260,'#73cbb688',26)+t(300,193,7,24,ink)
  if n==69:
   pts=[(222,103),(378,103),(378,257),(222,257),(222,103)]
   for a,b in zip(pts,pts[1:]):s+=line(*a,*b,ink,6)
   for x,y,c in[(222,103,ink),(378,103,ink),(378,257,ink),(222,257,ink),(261,103,'#fff'),(378,142,'#fff')]:s+=circle(x,y,9,c,ink)
  if n==71:
   for x,y,w,h in[(204,84,76,76),(282,84,76,76),(360,84,36,192),(204,162,76,114),(282,162,76,114)]:s+=rect(x,y,w,h,'none',ink,0)
  if n==74:
   for x,y in[(0,0),(1,0),(0,1),(1,2),(2,2),(3,2),(3,3),(4,3),(4,4)]:s+=rect(205+x*38,85+y*38,34,34,'#81c7b4'if x<3 else'#db998f')
  if n==75:s+=t(225,157,'♟',32,'#d58482')+t(300,260,'♟',32,'#648ea8')
  if n==77:s+=rect(414,120,64,90,'#f6f2e4',ink)+t(446,154,'↑',30,ink)+t(446,190,'나무',12,ink)+rect(124,152,64,90,'#f6f2e4',ink)+t(156,185,'↖',30,ink)+t(156,224,'바람',12,ink)
 elif n==73:
  s+=rect(195,86,210,190,'#253249');symbols=['◆','✦','●','▲'];palette=['#83ccb5','#e5b272','#d997a5','#91b7db']
  for j in range(4):s+=rect(207+j*46,159,42,42,'#fff')+t(228+j*46,189,symbols[j],28,palette[j])
  for j in[0,1,3]:s+=rect(253,113+j*46,42,42,'#fff')+t(274,143+j*46,symbols[1],28,palette[j])
 elif n==78:
  for j in range(3):s+=rect(190+j*76,80,64,82,['#db9698','#7ac8b2','#c7b0dc'][j])+t(222+j*76,112,'ABC'[j],26,ink)+t(222+j*76,145,j+1,22,ink)
  for j in range(3):s+=rect(190+j*76,196,64,82,'#d4e3e9',ink)+t(222+j*76,240,'?',34,ink)
 elif n==79:
  for j,(x,v)in enumerate([(160,1),(266,3),(383,'?')]):s+=rect(x,102,90,154,['#f1c67d','#79cbb4','#d9e6eb'][j],ink,10)+t(x+45,190,v,48,ink)
 elif n==80:
  for col in range(11):
   height=13-2*abs(col-5)
   for row in range(height):s+=circle(130+col*34,276-row*14,4,ink if(col,row)in[(4,7),(7,6)]else muted)
   s+=t(130+col*34,303,col+2,12,ink)
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">{rect(0,0,600,360,bg,rx=0)}{t(65,40,n,18,ink)}{t(320,40,g["title"],19,ink)}{s}{t(300,335,"SIMPLE GAMES / VOL.04",10,ink)}</svg>'
 (out/f'{n}.svg').write_text(svg,encoding='utf-8')
