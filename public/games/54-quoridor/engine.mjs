export const DIRECTIONS=[[-1,0],[0,1],[1,0],[0,-1]];
export function initial(n=7,first=0){return {n,pawns:[[n-1,Math.floor(n/2)],[0,Math.floor(n/2)]],walls:[],remaining:[6,6],turn:first,turns:0,winner:null};}
export const inside=(n,r,c)=>r>=0&&r<n&&c>=0&&c<n;
export function blocked(state,a,b){
 const [r,c]=a,[rr,cc]=b;if(Math.abs(r-rr)+Math.abs(c-cc)!==1)return true;
 return state.walls.some(w=>w.o==='h'?r!==rr&&Math.min(r,rr)===w.r&&(c===w.c||c===w.c+1):c!==cc&&Math.min(c,cc)===w.c&&(r===w.r||r===w.r+1));
}
export function reachable(state,player){
 const queue=[state.pawns[player]],seen=new Set([queue[0].join(',')]),goal=player===0?0:state.n-1;
 for(let i=0;i<queue.length;i++){const a=queue[i];if(a[0]===goal)return true;for(const[dr,dc]of DIRECTIONS){const b=[a[0]+dr,a[1]+dc],k=b.join(',');if(inside(state.n,...b)&&!seen.has(k)&&!blocked(state,a,b)){seen.add(k);queue.push(b);}}}return false;
}
export function legalMoves(state){
 if(state.winner!==null)return [];const player=state.turn,a=state.pawns[player],other=state.pawns[1-player],out=[];
 const add=b=>{if(!out.some(p=>p[0]===b[0]&&p[1]===b[1]))out.push(b);};
 for(const[dr,dc]of DIRECTIONS){const b=[a[0]+dr,a[1]+dc];if(!inside(state.n,...b)||blocked(state,a,b))continue;
  if(b[0]!==other[0]||b[1]!==other[1]){add(b);continue;}
  const beyond=[b[0]+dr,b[1]+dc];if(inside(state.n,...beyond)&&!blocked(state,b,beyond))add(beyond);
  else for(const[er,ec]of DIRECTIONS.filter(([er,ec])=>er*dr+ec*dc===0)){const side=[b[0]+er,b[1]+ec];if(inside(state.n,...side)&&!blocked(state,b,side))add(side);}
 }return out;
}
export function move(state,r,c){if(!legalMoves(state).some(p=>p[0]===r&&p[1]===c))return {ok:false,state,reason:'표시된 도착 칸을 골라 주세요.'};const next={...state,pawns:state.pawns.map(p=>[...p]),turns:state.turns+1};next.pawns[state.turn]=[r,c];if(r===(state.turn===0?0:state.n-1))next.winner=state.turn;else next.turn=1-state.turn;return {ok:true,state:next};}
export function wall(state,w){
 const fail=reason=>({ok:false,state,reason});if(state.winner!==null)return fail('판이 끝났어요.');
 if(!w||!Number.isInteger(w.r)||!Number.isInteger(w.c)||w.r<0||w.c<0||w.r>=state.n-1||w.c>=state.n-1||!['h','v'].includes(w.o))return fail('울타리는 보드 안 두 칸 경계에 놓아야 해요.');
 if(state.remaining[state.turn]<=0)return fail('울타리를 모두 사용했어요.');
 if(state.walls.some(v=>v.o!==w.o?v.r===w.r&&v.c===w.c:w.o==='h'?v.r===w.r&&Math.abs(v.c-w.c)<=1:v.c===w.c&&Math.abs(v.r-w.r)<=1))return fail('울타리는 교차하거나 겹칠 수 없어요.');
 const next={...state,pawns:state.pawns.map(p=>[...p]),walls:[...state.walls,{...w}],remaining:[...state.remaining],turns:state.turns+1};next.remaining[state.turn]--;
 if(!reachable(next,0)||!reachable(next,1))return fail('두 사람 모두 도착할 길을 남겨야 해요.');next.turn=1-state.turn;return {ok:true,state:next};
}
