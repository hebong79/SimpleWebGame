from pathlib import Path
import json,html,math
r=Path('.');games=json.loads((r/'docs/vol3/catalog.json').read_text(encoding='utf-8'));out=r/'public/games/vol3/covers';out.mkdir(exist_ok=True)
palettes=[('#f4e8cd','#976544','#d4a873'),('#e7e5f4','#655d99','#a9a3d0'),('#e2efe4','#2b7868','#8dbbb0'),('#e3eee5','#397e66','#a0bba0'),('#e9ede4','#586c5a','#b2cda7'),('#e6eef8','#3f7fa7','#adcce3'),('#24213e','#edd491','#8a85b3'),('#182e38','#77dacc','#4e7a83'),('#f1e7d7','#9c6551','#c6aa8a'),('#e6f1df','#407650','#a6c59a')]
def rect(x,y,w,h,fill,stroke='none',rx=5):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def text(x,y,t,size=24,color='#233f56'):return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Segoe UI,Malgun Gothic,sans-serif" font-weight="600" font-size="{size}" fill="{color}">{html.escape(str(t))}</text>'
def line(x,y,a,b,c,width=4):return f'<line x1="{x}" y1="{y}" x2="{a}" y2="{b}" stroke="{c}" stroke-width="{width}" stroke-linecap="round"/>'
def circle(x,y,rad,c,st='none'):return f'<circle cx="{x}" cy="{y}" r="{rad}" fill="{c}" stroke="{st}" stroke-width="2"/>'
for k,g in enumerate(games):
 n=k+41;bg,ink,muted=palettes[k%10];shape='';
 if n in [41,42,46,49,50]:
  cols=4;cell=48;x0=204;y0=88
  for y in range(4):
   for x in range(4):
    v=(x+y)%4+1;shape+=rect(x0+x*cell,y0+y*cell,44,44,'#ffffff30',muted)
    value=v if n==46 else ('+'if(x+y)%2==0 else '−')if n==49 else ['→','↓','←','↗'][(y+x//3)%4] if n==50 else (x+y)%3 if n==42 else (6 if x==0 and y==0 else 4 if x==2 and y==1 else '')
    shape+=text(x0+x*cell+22,y0+y*cell+30,value,24,ink)
  if n==41:shape+=rect(204,88,92,92,muted,ink)+text(250,146,4,28,ink)+rect(300,184,92,92,muted,ink)+text(346,243,4,28,ink)
 elif n in [43,44,47]:
  for y in range(5):
   for x in range(5):shape+=circle(196+x*52,80+y*48,3,muted)
  points=[(196,80),(352,80),(352,176),(404,176),(404,272),(196,272),(196,80)] if n==43 else [(196,80),(248,80),(248,176),(352,176),(352,272),(404,272)]
  if n==47:
   shape+=rect(196,80,104,96,'#ffffff20',muted)+rect(300,80,104,96,'#ffffff20',muted)+rect(196,176,104,96,'#ffffff20',muted)+text(248,142,'✦',40,ink)+text(352,142,'✦',40,ink)+text(248,238,'✦',40,ink)+text(352,238,'✦',40,ink)
  else:
   for a,b in zip(points,points[1:]):shape+=line(*a,*b,ink,7)
   shape+=text(220,143,'2',20,ink)+text(326,238,'1',20,ink)
 elif n==45:
  pts=['190,80 270,80 288,160 186,176','270,80 362,80 374,164 288,160','362,80 420,86 417,180 374,164','186,176 288,160 274,270 186,270','288,160 374,164 365,270 274,270','374,164 417,180 417,270 365,270']
  for j,p in enumerate(pts):shape+=f'<polygon points="{p}" fill="{["#dfa78f","#aacba5","#a8bfd6","#e5ce89"][j%4]}" stroke="{ink}" stroke-width="3"/>'
  for x,y,s in [(228,134,'●'),(323,131,'≡'),(390,142,'×'),(230,232,'×'),(320,230,'◆'),(390,235,'?')]:shape+=text(x,y,s,27,ink)
 elif n==48:
  shape+=rect(204,88,192,192,'#ffffff0b',muted)
  for j in range(5):
   for x in range(5):shape+=rect(204+x*38,88+j*38,38,38,'none','#36515a',0)
  for j in range(5):shape+=circle(222+j*38,70,11,ink)+circle(184,106+j*38,11,ink)
  shape+=text(222,76,'H',11,bg)+text(184,112,'R',11,bg)+text(337,226,'?',30,ink)
 elif n==51:
  for j,num in enumerate([3,5,7]):
   shape+=rect(150,82+j*66,300,55,'#ffffff50')
   for x in range(num):shape+=circle(200+x*32,110+j*66,12,muted,ink)
 elif n==52:
  for y in range(-3,4):
   for x in range(-3,4):
    if max(abs(x),abs(y),abs(x+y))<=3:shape+=circle(300+(x+y/2)*33,175+y*29,14,ink if y<0 else muted if y>0 else '#ffffff30','#ffffff60')
 elif n==53:
  shape+=rect(190,70,224,224,'#29384f')
  for x,y,w,h,c in [(194,145,108,32,'#ffc781'),(268,74,34,104,'#a7d0bf'),(340,74,70,34,'#b9a5d4'),(232,254,106,34,'#e4ce9b'),(378,145,32,102,'#9ebbd7')]:shape+=rect(x,y,w,h,c,'#ffffff80')
  shape+=text(444,175,'→',36,ink)
 elif n==54:
  for y in range(7):
   for x in range(7):shape+=rect(190+x*31,70+y*31,27,27,'#ffffff70',muted,2)
  shape+=line(250,134,310,134,ink,6)+line(342,165,342,225,ink,6)+text(297,122,'♟',32,ink)+text(297,246,'♟',32,ink)
 elif n==55:
  for cx in [218,380]:
   shape+=circle(cx,178,72,'#ffffff80',ink)
   for j,s in enumerate(['✦','●','◆','☾']):shape+=text(cx+math.cos(j*math.pi/2)*36,188+math.sin(j*math.pi/2)*36,s,28,[ink,muted,'#ae718f','#728dba'][j])
  shape+=circle(218,142,22,'none',ink)+circle(380,142,22,'none',ink)
 elif n==56:
  shape+=rect(150,85,300,200,'#172e3c')
  for j in range(7):shape+=circle(180+j*39,125,13,'#84ddbf'if j==6 else'#365264')+text(180+j*39,130,j+1,12,'#ffffff')
  pts=[(175,206),(230,206),(247,188),(265,223),(285,163),(307,235),(330,206),(424,206)]
  for a,b in zip(pts,pts[1:]):shape+=line(*a,*b,'#84ddbf',3)
 elif n in [57,59]:
  shape+=rect(182,65,240,235,'#20263e')
  for x,y,w in [(182,65,240),(182,291,240),(200,166,80),(320,225,75)]:shape+=rect(x,y,w,8,'#96c9d6')
  shape+=rect(285,105,24,27,'#94d3d7')+circle(291,114,3,'#23364e')+circle(302,114,3,'#23364e')+text(297,209,'↓'if n==57 else'↕',40,'#96d6ee')
  if n==59:
   for x in range(240,350,20):shape+=f'<path d="M{x},291l9,-18l9,18" fill="#eead8d"/>'
  else:shape+=text(238,232,'◆',24,'#d1b3e2')+text(366,167,'◆',24,'#d1b3e2')
 elif n==58:
  shape+=rect(180,65,245,235,'#9c6f4e')
  for x,y,w,h in [(180,130,210,24),(250,130,24,130),(250,236,140,24)]:shape+=rect(x,y,w,h,'#283e4a',rx=0)
  shape+=circle(260,142,12,'#a1ddcf')+circle(350,142,12,'#dd9eae')+line(276,142,333,142,'#a1ddcf',8)
 elif n==60:
  shape+=f'<path d="M170 100L260 65L350 100L425 80L455 166L370 210L410 280L270 290L150 220Z" fill="#cbdca7"/>'
  pts=[(180,142),(260,175),(344,110),(422,152),(383,264),(265,267)]
  for a,b in zip(pts[:4],pts[1:4]):shape+=line(*a,*b,ink,5)
  for a,b in zip([pts[1],pts[5],pts[4],pts[3]],[pts[5],pts[4],pts[3]]):shape+=line(*a,*b,'#be897c',5)
  for j,(x,y)in enumerate(pts):shape+=circle(x,y,11,'#fff',ink)if j%3==0 else rect(x-10,y-10,20,20,'#fff',ink,1)if j%3==1 else f'<path d="M{x},{y-12}l12,23h-24Z" fill="#fff" stroke="{ink}" stroke-width="2"/>'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">{rect(0,0,600,360,bg,rx=0)}{text(60,42,str(n),17,ink)}{text(320,42,g["title"],19,ink)}{shape}{text(300,335,"SIMPLE GAMES / VOL. 03",10,ink)}</svg>'
 (out/f'{n}.svg').write_text(svg,encoding='utf-8')
