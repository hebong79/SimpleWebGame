export const COLS=13,ROWS=9;
export const MAPS=[
 {name:'얕은 구조굴',start:[1,1],tunnels:[[1,1,11,1],[3,1,3,7],[9,1,9,7],[3,7,9,7]],enemies:[[4,1],[8,3],[9,6]]},
 {name:'갈림길 진드기',start:[1,1],tunnels:[[1,1,11,1],[1,1,1,7],[1,4,11,4],[5,1,5,7],[11,1,11,7]],enemies:[[9,1],[5,6],[11,7]]},
 {name:'깊은 구조대',start:[1,1],tunnels:[[1,1,11,1],[3,1,3,7],[7,1,7,7],[1,7,11,7],[1,4,11,4]],enemies:[[7,3],[11,7],[3,6],[10,4]]}
];
export const DIRS={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
export function initial(level=0){const m=MAPS[level]||MAPS[0],soil=Array(COLS*ROWS).fill(true);for(const[x1,y1,x2,y2]of m.tunnels){const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);let x=x1,y=y1;soil[y*COLS+x]=false;while(x!==x2||y!==y2){x+=dx;y+=dy;soil[y*COLS+x]=false;}}for(const[x,y]of m.enemies)soil[y*COLS+x]=false;return{level,x:m.start[0],y:m.start[1],dir:'right',soil,enemies:m.enemies.map(([x,y])=>({x,y,pump:0,alive:true})),hp:3,immune:0,time:0,moveClock:0,enemyClock:0,score:0,done:false,won:false,target:-1,event:''};}
function inBounds(x,y){return x>=0&&x<COLS&&y>=0&&y<ROWS;}
function direction(input){return['left','right','up','down'].find(k=>input[k])||null;}
export function pumpTarget(s){const[dx,dy]=DIRS[s.dir],x=s.x+dx,y=s.y+dy;if(!inBounds(x,y)||s.soil[y*COLS+x])return-1;return s.enemies.findIndex(e=>e.alive&&e.x===x&&e.y===y);}
function nextToward(s,e){const q=[[e.x,e.y]],seen=new Set([e.y*COLS+e.x]),first=new Map();for(let k=0;k<q.length;k++){const[x,y]=q[k];if(x===s.x&&y===s.y)return first.get(y*COLS+x);for(const[dx,dy]of Object.values(DIRS)){const xx=x+dx,yy=y+dy,id=yy*COLS+xx;if(inBounds(xx,yy)&&!s.soil[id]&&!seen.has(id)){seen.add(id);q.push([xx,yy]);first.set(id,k===0?[xx,yy]:first.get(y*COLS+x));}}}return null;}
function substep(s,input,dt){s.time+=dt;s.event='';s.immune=Math.max(0,s.immune-dt);const dir=direction(input);s.moveClock=Math.max(0,s.moveClock-dt);if(dir){s.dir=dir;if(!input.pump&&s.moveClock<=0){const[dx,dy]=DIRS[dir],x=s.x+dx,y=s.y+dy;if(inBounds(x,y)){s.x=x;s.y=y;s.soil[y*COLS+x]=false;}s.moveClock=.16;}}else s.moveClock=0;s.target=input.pump?pumpTarget(s):-1;for(let i=0;i<s.enemies.length;i++){const e=s.enemies[i];if(!e.alive)continue;e.pump=Math.max(0,e.pump+(i===s.target?dt:-dt*.6));if(e.pump>=.8-1e-9){e.alive=false;s.score+=100;s.event='capture';}}
 s.enemyClock+=dt;if(s.enemyClock>=.52){s.enemyClock-=.52;if(s.level>=1)for(let i=0;i<s.enemies.length;i++){const e=s.enemies[i];if(e.alive&&i!==s.target){const next=nextToward(s,e);if(next&&!s.enemies.some((o,j)=>j!==i&&o.alive&&o.x===next[0]&&o.y===next[1]))[e.x,e.y]=next;}}}
 if(s.immune===0&&s.enemies.some(e=>e.alive&&e.x===s.x&&e.y===s.y)){s.hp--;s.immune=1;s.event='hit';if(s.hp<=0){s.done=true;s.won=false;}}
 if(s.enemies.every(e=>!e.alive)){s.done=true;s.won=true;}}
export function step(s,input,dt){if(s.done||!Number.isFinite(dt)||dt<0)return;let t=Math.min(5,dt);while(t>1e-9&&!s.done){const d=Math.min(1/120,t);substep(s,input,d);t-=d;}}
