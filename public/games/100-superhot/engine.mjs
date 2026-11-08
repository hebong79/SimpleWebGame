const V={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
const clone=x=>JSON.parse(JSON.stringify(x));
export const ROOMS=Array.from({length:6},(_,i)=>({start:[1,5],exit:[7,1],walls:[[3,2],[3,3],...(i%2?[[4,4]]:[[5,5]]),...(i>=2?[[5,2]]:[]),...(i>=4?[[2,1]]:[])],guards:[{id:'A',kind:'fixed',x:6,y:2,dir:'left',stopped:false},{id:'B',kind:'patrol',x:5,y:4,dir:'left',stopped:false,route:[[5,4],[6,4],[7,4],[6,4]],step:i%4}]}));
export function create(room=0){const n=((room%6)+6)%6,r=clone(ROOMS[n]);for(const g of r.guards)if(g.kind==='patrol')[g.x,g.y]=g.route[g.step];return{room:n,x:r.start[0],y:r.start[1],exit:r.exit,walls:r.walls,guards:r.guards,beams:[],pulses:3,ticks:0,won:false,lost:false,message:'입력 전에는 빔도 경비도 멈춰요.'};}
export function blocked(s,x,y){return x<0||x>8||y<0||y>6||s.walls.some(w=>w[0]===x&&w[1]===y);}
export function pulse(s,dir){const v=V[dir];if(!v||s.pulses<=0)return false;s.pulses--;for(let k=1;k<=4;k++){const x=s.x+v[0]*k,y=s.y+v[1]*k;if(blocked(s,x,y))break;const g=s.guards.find(q=>!q.stopped&&q.x===x&&q.y===y);if(g){g.stopped=true;break;}}return true;}
export function act(s,action,dir){if(s.won||s.lost)return false;
 if(action==='move'){const v=V[dir];if(!v)return false;const x=s.x+v[0],y=s.y+v[1];if(blocked(s,x,y)||s.guards.some(g=>!g.stopped&&g.x===x&&g.y===y))return false;s.x=x;s.y=y;}
 else if(action==='pulse'){if(!pulse(s,dir))return false;}else if(action!=='wait')return false;
 s.ticks++;let hit=s.beams.some(b=>b.x===s.x&&b.y===s.y);
 // Existing beams advance before any new emission. A beam crossed by the player also hits.
 s.beams=s.beams.map(b=>({...b,x:b.x+V[b.dir][0],y:b.y+V[b.dir][1]})).filter(b=>!blocked(s,b.x,b.y));
 if(s.beams.some(b=>b.x===s.x&&b.y===s.y))hit=true;
 for(const g of s.guards){if(g.stopped)continue;const [dx,dy]=V[g.dir],x=g.x+dx,y=g.y+dy;if(!blocked(s,x,y)){s.beams.push({x,y,dir:g.dir,guard:g.id});if(x===s.x&&y===s.y)hit=true;}
   if(g.kind==='patrol'){g.step=(g.step+1)%g.route.length;const [nx,ny]=g.route[g.step];if(!blocked(s,nx,ny)){g.x=nx;g.y=ny;if(nx===s.x&&ny===s.y)hit=true;}}
 }
 if(hit){s.lost=true;s.message='빔 피격 · 출구보다 피격 판정이 먼저예요.';}else if(s.x===s.exit[0]&&s.y===s.exit[1]){s.won=true;s.message='경비실 탈출!';}else s.message=`틱 ${s.ticks} · 경비는 표시된 방향으로 발사 후 순회해요.`;return true;
}
export function snapshot(s){return clone(s);}
export function solve(room,limit=120000){const initial=create(room),queue=[{s:initial,path:[]}],seen=new Set();const actions=[...Object.keys(V).map(d=>['move',d]),...Object.keys(V).map(d=>['pulse',d]),['wait']];
 const key=s=>JSON.stringify([s.x,s.y,s.pulses,s.guards.map(g=>[g.stopped,g.step]),s.beams.map(b=>[b.x,b.y,b.dir])]);seen.add(key(initial));
 for(let i=0;i<queue.length&&i<limit;i++){const{s,path}=queue[i];for(const a of actions){const n=clone(s);if(!act(n,...a)||n.lost)continue;const p=[...path,a];if(n.won)return{path:p,visited:i+1,ticks:n.ticks};const k=key(n);if(!seen.has(k)){seen.add(k);queue.push({s:n,path:p});}}}return null;}
