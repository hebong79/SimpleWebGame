export const STEP=1/120,JUMP=.18;export const DIRECTIONS={q:[-1,-1],e:[-1,0],z:[1,0],c:[1,1]};
export const indexOf=(r,c)=>r*(r+1)/2+c;export const valid=(r,c,n)=>r>=0&&r<n&&c>=0&&c<=r;
export function create(){return{stage:0,rows:4,r:0,c:0,tiles:[true,...Array(9).fill(false)],lives:3,score:25,jump:null,queued:null,drops:[],dropClock:2.5,time:0,grace:0,completed:0,status:'playing'};}
export function jump(s,key){if(s.status!=='playing'||!DIRECTIONS[key])return false;if(s.jump){if(s.queued===null)s.queued=key;return false;}const[dR,dC]=DIRECTIONS[key];s.jump={fromR:s.r,fromC:s.c,r:s.r+dR,c:s.c+dC,t:0};return true;}
export function loseLife(s){if(s.grace>0||s.status!=='playing')return;s.lives--;s.r=s.c=0;s.jump=null;s.queued=null;s.grace=.8;if(s.lives<=0)s.status='lost';}
export function tick(s,dt=STEP){if(s.status!=='playing')return s;s.time+=dt;s.grace=Math.max(0,s.grace-dt);if(s.stage>0){s.dropClock-=dt;if(s.dropClock<=0){const k=Math.floor(s.time*31)%s.tiles.length;let r=0;while(indexOf(r+1,0)<=k)r++;s.drops.push({r,c:k-indexOf(r,0),eta:.8,age:0});s.dropClock=s.stage===1?2.5:1.8;}}
 for(const d of s.drops){d.eta-=dt;if(d.eta<=0)d.age+=dt;}s.drops=s.drops.filter(d=>d.age<.32);
 const hit=(r,c)=>s.drops.some(d=>d.eta<=0&&d.r===r&&d.c===c);
 if(s.jump){s.jump.t+=dt;if(s.jump.t+1e-9>=JUMP){const destination=s.jump;s.jump=null;if(!valid(destination.r,destination.c,s.rows)||(hit(destination.r,destination.c)&&s.grace<=0)){loseLife(s);return s;}s.r=destination.r;s.c=destination.c;const i=indexOf(s.r,s.c);if(!s.tiles[i]){s.tiles[i]=true;s.score+=25;}if(s.tiles.every(Boolean)){s.score+=100;s.completed=s.stage+1;if(s.stage===2){s.status='won';return s;}s.stage++;s.rows=5;s.tiles=[true,...Array(14).fill(false)];s.score+=25;s.r=s.c=0;s.drops=[];s.dropClock=s.stage===1?2.5:1.8;s.queued=null;s.grace=.8;}else if(s.queued){const key=s.queued;s.queued=null;jump(s,key);}}}
 else if(hit(s.r,s.c))loseLife(s);return s;
}
