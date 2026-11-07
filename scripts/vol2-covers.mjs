import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../public/games/vol2/covers/', import.meta.url);
await mkdir(out, { recursive: true });
const palettes = ['#f7efde','#e6f0fc','#152e40','#246b7d','#1b2840','#e6efd8','#dceef4','#241c3c','#eaf1f6','#124236','#eceffa','#684430','#142540','#17223c','#102e43','#211635','#213254','#30343d','#38243e','#354656'];
const rect = (x,y,w,h,fill,rx=8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const circle = (x,y,r,fill,stroke='none',sw=2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x,y,a,b,color='#bca2ed',w=4) => `<path d="M${x} ${y}L${a} ${b}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const text = (x,y,t,color='#23435b',size=22) => `<text x="${x}" y="${y}" fill="${color}" font-family="sans-serif" font-size="${size}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${t}</text>`;
const star = (x,y,r=16,c='#ffd790') => `<path d="M${x} ${y-r}l${r*.3} ${r*.65} ${r*.7} ${r*.1}-${r*.5} ${r*.5} .15 ${r*.75}-${r*.65}-${r*.35}-${r*.65} ${r*.35} .15-${r*.75}-${r*.5}-${r*.5} ${r*.7}-${r*.1}z" fill="${c}"/>`;
for (let n=21;n<=40;n++) {
  let art='',bg=palettes[n-21];
  if ([21,22,23,25,26,27,30].includes(n)) {
    const size=n===22?4:n===30?8:5, cell=n===30?27:43, x=300-size*cell/2,y=177-size*cell/2;
    for(let r=0;r<size;r++) for(let c=0;c<size;c++) {
      const xx=x+c*cell, yy=y+r*cell;
      let color=n===30?((r+c)%2?'#2b7059':'#24664f'):n===23?'#254255':n===25?'#405270':n===26?((r+c)%2?'#f5f8e8':'#d4e4c9'):'#fffaf1';
      if(n===21&&([1,2,3].includes(c)||r===1)&&r<4)color='#228b7a';
      if(n===25&&(r===2||c===2))color='#ffe396';
      art+=rect(xx+1,yy+1,cell-2,cell-2,color,3);
      if(n===22&&(r+c)%3!==1)art+=text(xx+cell/2,yy+cell/2,((r*2+Math.floor(r/2)+c)%4)+1,'#224768',25);
      if(n===23){art+=line(xx+cell/2,yy+cell/2,xx+cell,yy+cell/2,'#7ce4c6',5);if((r+c)%2)art+=line(xx+cell/2,yy+cell/2,xx+cell/2,yy,'#7ce4c6',5);art+=circle(xx+cell/2,yy+cell/2,4,'#7ce4c6');}
      if(n===26&&(r*5+c)%6===0)art+=`<path d="M${xx+8} ${yy+34}l14-26 14 26z" fill="#49785a"/>`;
      if(n===26&&(r===1&&c===3||r===3&&c===1))art+=`<path d="M${xx+6} ${yy+34}l16-25 16 25z" fill="#ca6539"/>`;
      if(n===27)art+=line(xx+((r+c)%2?2:cell-2),yy+2,xx+((r+c)%2?cell-2:2),yy+cell-2,'#337b97',3);
      if(n===30&&((r===3||r===4)&&(c===3||c===4)))art+=circle(xx+cell/2,yy+cell/2,10,(r+c)%2?'#ffe09b':'#17374c');
    }
    if(n===21)for(let k=0;k<5;k++){art+=text(x-18,y+k*cell+22,[1,5,3,3,1][k],'#397c70',16);art+=text(x+k*cell+22,y-18,[1,3,4,3,1][k],'#397c70',16);}
    if(n===22)art+=line(x+cell*2,y,x+cell*2,y+cell*4,'#3e73aa',3)+line(x,y+cell*2,x+cell*4,y+cell*2,'#3e73aa',3);
    if(n===25)art+=circle(300,177,13,'#ffce68','#a67b2a');
    if(n===27)art+=circle(x+43,y+43,12,'#fff')+text(x+43,y+43,'3','#286786',16);
  } else if(n===24){
    const pts=[[155,105],[300,105],[445,105],[155,245],[300,245],[445,245]];
    for(const [a,b]of [[0,1],[1,2],[0,3],[1,4],[3,4],[4,5],[2,5]])art+=line(...pts[a],...pts[b],'#f4d797',5);
    pts.forEach(([x,y],i)=>{art+=circle(x,y,23,'#f9eccd','#c59c57',3)+text(x,y,[2,3,2,2,3,2][i]);});
  }else if(n===28){
    const pts=[[173,82],[405,89],[446,246],[307,281],[154,237],[276,172]];
    for(const [a,b]of [[0,2],[0,3],[0,5],[1,3],[1,4],[2,4],[2,5],[3,5]])art+=line(...pts[a],...pts[b],'#b9a0e4',3);
    pts.forEach(([x,y])=>art+=circle(x,y,16,'#564478','#bda5e8')+star(x,y,11,'#dac9fa'));
  }else if(n===29){
    for(let row=0;row<3;row++){art+=rect(120,75+row*68,360,56,'#fff');for(let col=0;col<4;col++){const xx=151+col*55;art+=circle(xx,103+row*68,17,['#397eb7','#d57255','#4a9677','#8664ad'][(col+row)%4]);art+=text(xx,103+row*68,['●','◆','▲','■'][(col+row)%4],'#fff',15);}art+=text(403,103+row*68,`${row+1} · ${3-row}`,'#576b7d',17);}
  }else if(n===31){
    for(let i=0;i<12;i++){const x=113+i%4*95,y=64+Math.floor(i/4)*80;art+=rect(x,y,85,69,'#fff');for(let k=0;k<i%3+1;k++)art+=text(x+42+(k-i%3/2)*18,y+35,['◇','●','▲'][Math.floor(i/3)%3],['#368d79','#b65c7e','#4a72ae'][i%3],23);}
  }else if(n===32){
    art+=rect(85,93,430,172,'#af794a',32)+rect(101,113,44,132,'#603b2b',21)+rect(455,113,44,132,'#603b2b',21);for(let i=0;i<12;i++){const x=175+i%6*49,y=143+Math.floor(i/6)*73;art+=circle(x,y,21,'#784b32');for(let k=0;k<(i%4)+2;k++)art+=circle(x-7+k%3*7,y-4+Math.floor(k/3)*8,3,'#ffe0a2');}art+=text(123,178,6,'#ffe0a2')+text(477,178,5,'#ffe0a2');
  }else if(n===33){
    for(let r=0;r<9;r++)for(let c=0;c<13;c++){const x=132+c*26,y=60+r*26;if(r===0||r===8||c===0||c===12||(r%2===0&&c%3!==0))art+=rect(x,y,24,24,'#345983',4);else art+=circle(x+12,y+12,2,'#e7efe6');}art+=circle(222,175,12,'#b3ee93')+circle(226,171,3,'#254e49')+circle(378,123,10,'#ea8b84');
  }else if(n===34){
    for(let i=0;i<40;i++)art+=circle(90+(i*79)%420,45+(i*53)%270,i%4===0?1.6:.8,'#a9bad4');for(const[x,y,s]of [[165,106,35],[431,118,29],[375,258,19],[198,245,14]])art+=`<path d="M${x-s} ${y-8}l12-${s} ${s} 5 17 28-12 ${s} -${s} 4z" fill="#2d4665" stroke="#a6bdd6" stroke-width="2"/>`;art+=`<path d="M288 152l39 14-35 21 9-19z" fill="#93ead8"/>`+line(335,166,375,166,'#ffdd98',3);
  }else if(n===35){
    art+=rect(90,278,420,15,'#345c6a');for(const x of[125,220,380,475])art+=rect(x,250,18,29,'#d5e6d9',3)+rect(x-1,246,20,8,'#f4b97d',3);for(let i=0;i<5;i++)art+=line(130+i*75,55,170+i*60,197,'#7bbcc9',2)+circle(170+i*60,197,5,'#c2edeb');art+=circle(305,164,47,'#285861','#7ee2d9',3)+circle(422,229,23,'#285861','#7ee2d9',3)+line(300,278,305,164,'#7ee2d9',2);
  }else if(n===36){
    for(let i=0;i<3;i++)art+=`<circle cx="300" cy="180" r="${62+i*38}" fill="none" stroke="${['#d0a0ff','#a575dd','#7652ab'][i]}" stroke-width="12" stroke-dasharray="${(62+i*38)*4.8} 160" transform="rotate(${i*65+10} 300 180)"/>`;art+=`<path d="M290 173l17-12 19 13-18 18z" fill="#63448a"/>`+circle(349,174,8,'#a8ffec');
  }else if(n===37){
    for(let r=0;r<4;r++)for(let c=0;c<=r;c++){const x=300+(c-r/2)*69,y=80+r*57;art+=`<path d="M${x} ${y-17}l33 17-33 18-33-18z" fill="${(r+c)%3?'#839fc2':'#f8ca98'}"/><path d="M${x-33} ${y}l33 18v16l-33-17z" fill="#385b7b"/><path d="M${x} ${y+18}l33-18v17l-33 17z" fill="#2b4b6b"/>`;if((r+c)%3===0)art+=star(x,y,9,'#ac7754');}art+=circle(300,169,14,'#edf8ff')+circle(295,169,2,'#24334d')+circle(305,169,2,'#24334d');
  }else if(n===38){
    for(let i=0;i<9;i++){const x=184+i%3*116,y=81+Math.floor(i/3)*85;art+=rect(x-45,y-26,90,72,'#45434f',12)+`<ellipse cx="${x}" cy="${y+10}" rx="30" ry="17" fill="#24242c" stroke="#64606c"/>`;if(i===2||i===4||i===6){art+=rect(x-6,y-5,12,33,'#ffe2a9',5)+`<path d="M${x-27} ${y}a27 25 0 0 1 54 0z" fill="${i===4?'#bf77b3':'#a7e8be'}"/>`+circle(x-10,y-8,3,'#fff')+circle(x+10,y-8,3,'#fff');}}
  }else if(n===39){
    for(const[x,y,c]of[[173,235,'#f49b54'],[292,116,'#ef7186'],[430,181,'#9fd385']])art+=circle(x,y,29,c)+line(x,y-31,x+9,y-42,'#afc885',4);art+=circle(398,270,22,'#242234','#f6b078',2)+text(398,270,'!','#ffeac7')+line(147,263,334,78,'#ffeaa3',4)+line(160,264,341,79,'#fff4cb',1);
  }else if(n===40){
    art+=line(200,56,300,166,'#e2e9ef',3)+line(400,56,300,166,'#e2e9ef',3)+circle(200,56,7,'#becad7')+circle(400,56,7,'#becad7')+circle(300,166,21,'#ffd08c');for(const[x,y]of[[235,222],[302,252],[367,221]])art+=star(x,y,12);art+=rect(280,277,11,37,'#efd8ec',5)+rect(309,277,11,37,'#efd8ec',5)+circle(300,310,27,'#e8dbea')+circle(300,317,11,'#61778c')+circle(290,305,3,'#304253')+circle(310,305,3,'#304253');
  }
  const dark=[23,24,25,28,30,32,33,34,35,36,37,38,39,40].includes(n);
  const doc=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">${rect(0,0,600,360,bg,0)}${text(50,34,String(n),dark?'#d0dfeb':'#67828f',16)}${art}</svg>`;
  await writeFile(new URL(`${n}.svg`,out),doc,'utf8');
}
console.log('20 original SVG covers written.');
