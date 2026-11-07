const BASE=['#############','#.....#.....#','#.###.#.###.#','#...#...#...#','###.#.#.#.###','#...#.#.#...#','#.###.#.###.#','#.....#.....#','#.###...###.#','#...........#','#############'];
const SECOND=['#############','#...........#','#.###.#.###.#','#...#.#.#...#','###.#...#.###','#...#####...#','#.#.......#.#','#.###.#.###.#','#.....#.....#','#.###...###.#','#############'];
const THIRD=['#############','#...........#','#.###.###.#.#','#...#...#.#.#','#.#.###.#.#.#','#.#.....#...#','#.###.#.###.#','#...#.#.....#','###.#.###.#.#','#...........#','#############'];
export const MAPS=[BASE,SECOND,THIRD];
export const DIRECTIONS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function open(map,x,y){return x>=0&&x<13&&y>=0&&y<11&&map[y][x]!=='#';}
export function neighbors(map,x,y){return Object.entries(DIRECTIONS).map(([d,[dx,dy]])=>({x:x+dx,y:y+dy,d})).filter(p=>open(map,p.x,p.y));}
export function reachable(map,start={x:1,y:1}){const seen=new Set([start.y*13+start.x]),q=[start];for(let i=0;i<q.length;i++)for(const p of neighbors(map,q[i].x,q[i].y)){const k=p.y*13+p.x;if(!seen.has(k)){seen.add(k);q.push(p);}}return [...seen];}
export function initial(level=0){const map=MAPS[level],letters=reachable(map).filter(i=>i!==14&&i!==24&&i!==118);return {level,map,player:{x:1,y:1},robots:(level===0?[{x:11,y:9}]:[{x:11,y:9},{x:11,y:1}]).map(p=>({...p})),letters,lanterns:[24,118],lives:3,score:0,time:0,freeze:0,immune:0,dir:null,queued:null,playerClock:0,robotClock:0,done:false,won:false,event:''};}
export function reserve(state,dir){if(DIRECTIONS[dir]&&!state.done)state.queued=dir;}
function collided(s){return s.robots.some(r=>r.x===s.player.x&&r.y===s.player.y);}
function hit(s){if(s.freeze>0||s.immune>0||!collided(s))return false;s.lives--;s.event='hit';if(!s.lives){s.done=true;s.won=false;return true;}s.player={x:1,y:1};s.robots=(s.level===0?[{x:11,y:9}]:[{x:11,y:9},{x:11,y:1}]).map(p=>({...p}));s.immune=1.5;s.dir=null;s.queued=null;s.playerClock=0;s.robotClock=0;return true;}
function distance(map,start,goal){const q=[{...start,n:0}],seen=new Set([start.y*13+start.x]);for(let i=0;i<q.length;i++){const p=q[i];if(p.x===goal.x&&p.y===goal.y)return p.n;for(const n of neighbors(map,p.x,p.y)){const k=n.y*13+n.x;if(!seen.has(k)){seen.add(k);q.push({...n,n:p.n+1});}}}return 999;}
export function step(s,dt){if(s.done)return s;s.time+=dt;s.freeze=Math.max(0,s.freeze-dt);s.immune=Math.max(0,s.immune-dt);s.event='';s.playerClock+=dt;s.robotClock+=dt;let touched=false;if(s.playerClock>=.25){s.playerClock-=.25;const p=s.player,q=DIRECTIONS[s.queued];if(q&&open(s.map,p.x+q[0],p.y+q[1]))s.dir=s.queued;const d=DIRECTIONS[s.dir];if(d&&open(s.map,p.x+d[0],p.y+d[1])){s.player={x:p.x+d[0],y:p.y+d[1]};touched=true;}else s.dir=null;}
// A lantern acts immediately at the landing cell, before enemy contact.
const idx=s.player.y*13+s.player.x;if(touched&&s.lanterns.includes(idx)){s.lanterns=s.lanterns.filter(i=>i!==idx);s.freeze=4;s.score+=20;s.event='lantern';}
if(hit(s))return s;
if(s.robotClock>=1/3.2){s.robotClock-=1/3.2;if(s.freeze<=0)s.robots=s.robots.map((r,i)=>{const ns=neighbors(s.map,r.x,r.y);ns.sort((a,b)=>distance(s.map,a,s.player)-distance(s.map,b,s.player)||((a.x+a.y+i)%3)-((b.x+b.y+i)%3));return ns.length?{x:ns[0].x,y:ns[0].y}:r;});}
// Damage wins a tie with collecting the final letter.
if(hit(s))return s;if(touched&&s.letters.includes(idx)){s.letters=s.letters.filter(i=>i!==idx);s.score+=10;s.event='letter';}if(!s.letters.length){s.done=true;s.won=true;s.score+=s.lives*100;s.event='complete';}return s;}
