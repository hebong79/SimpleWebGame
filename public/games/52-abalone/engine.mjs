export const DIRECTIONS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const key=(q,r)=>`${q},${r}`;
export const inside=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3;
export const CELLS=Array.from({length:7},(_,r)=>r-3).flatMap(r=>Array.from({length:7},(_,q)=>q-3).filter(q=>inside(q,r)).map(q=>[q,r]));
export function initial(first=0){const board={};for(const [q,r]of CELLS)board[key(q,r)]=r<=-2?1:r>=2?2:0;return {board,turn:first,turns:0,expelled:[0,0],winner:null,draw:false};}
function groupAxis(points){if(points.length===1)return 0;for(let axis=0;axis<3;axis++){const[dq,dr]=DIRECTIONS[axis],sorted=[...points].sort((a,b)=>(a[0]*dq+a[1]*dr)-(b[0]*dq+b[1]*dr));if(sorted.every((p,i)=>i===0||p[0]-sorted[i-1][0]===dq&&p[1]-sorted[i-1][1]===dr))return axis;}return -1;}
export function move(state,selected,direction){
 const fail=reason=>({ok:false,reason,state});if(state.winner!==null||state.draw)return fail('판이 끝났어요.');
 if(!Number.isInteger(direction)||direction<0||direction>=6)return fail('방향을 고르세요.');
 if(!Array.isArray(selected)||selected.length<1||selected.length>3||new Set(selected).size!==selected.length)return fail('내 구슬 1~3개를 고르세요.');
 const points=selected.map(k=>k.split(',').map(Number));if(points.some(([q,r])=>!inside(q,r)||state.board[key(q,r)]!==state.turn+1))return fail('내 구슬만 선택할 수 있어요.');
 const axis=groupAxis(points);if(axis<0)return fail('연속된 일직선 구슬을 고르세요.');
 const[dq,dr]=DIRECTIONS[direction],inline=points.length===1||direction%3===axis;let pushed=[];
 if(!inline){if(points.some(([q,r])=>!inside(q+dq,r+dr)||state.board[key(q+dq,r+dr)]!==0))return fail('옆 이동의 도착 칸이 모두 비어 있어야 해요.');}
 else{
  const front=points.find(([q,r])=>!selected.includes(key(q+dq,r+dr)));let q=front[0]+dq,r=front[1]+dr;
  if(!inside(q,r))return fail('내 구슬을 밖으로 보낼 수 없어요.');
  while(inside(q,r)&&state.board[key(q,r)]===2-state.turn){pushed.push(key(q,r));q+=dq;r+=dr;}
  if(pushed.length>=points.length||pushed.length>2)return fail('내 구슬 수가 상대보다 많아야 밀 수 있어요.');
  if(inside(q,r)&&state.board[key(q,r)]!==0)return fail('상대 뒤가 막혀 있어요.');
 }
 const next={...state,board:{...state.board},expelled:[...state.expelled],turns:state.turns+1};
 for(const k of [...selected,...pushed])next.board[k]=0;
 for(const k of pushed){const[q,r]=k.split(',').map(Number);if(inside(q+dq,r+dr))next.board[key(q+dq,r+dr)]=2-state.turn;else next.expelled[state.turn]++;}
 for(const[q,r]of points)next.board[key(q+dq,r+dr)]=state.turn+1;
 if(next.expelled[state.turn]>=3)next.winner=state.turn;else if(next.turns>=80)next.draw=true;else next.turn=1-state.turn;
 return {ok:true,state:next,pushed:pushed.length};
}
export function legalDirections(state,selected){return DIRECTIONS.map((_,i)=>i).filter(i=>move(state,selected,i).ok);}
