const car=(id,r,c,axis,len)=>({id,r,c,axis,len});
// Eight authored parking layouts. No imported puzzle data or artwork.
const core=[car('A',2,0,'h',2),car('B',0,2,'v',3),car('C',5,0,'h',3),car('D',4,4,'v',2),car('E',0,3,'h',3)];
const extras=[car('F',4,0,'h',2),car('G',1,5,'v',2),car('H',3,0,'h',2),car('I',3,3,'v',2)];
export const LEVELS=[
 {name:'첫 배송',cars:[car('A',2,0,'h',2),car('B',1,2,'v',2),car('C',0,3,'h',3),car('D',3,4,'v',3),car('E',5,0,'h',2)]},
 {name:'닫힌 남쪽',cars:core.map(v=>({...v}))},
 {name:'작은 우회',cars:[...core.map(v=>({...v})),{...extras[0]}]},
 {name:'동쪽 문지기',cars:[...core.map(v=>({...v})),{...extras[1]}]},
 {name:'두 개의 열쇠',cars:[...core.map(v=>({...v})),{...extras[0]},{...extras[1]}]},
 {name:'세 번째 통로',cars:[...core.map(v=>({...v})),{...extras[0]},{...extras[1]},{...extras[2]}]},
 {name:'새벽의 행렬',cars:[...core.map(v=>({...v})),{...extras[0]},{...extras[1]},{...extras[3]}]},
 {name:'마지막 차고',cars:[...core.map(v=>({...v})),...extras.map(v=>({...v}))]}
];
export function initial(index=0){return {cars:LEVELS[index].cars.map(v=>({...v})),moves:0,won:false};}
export function occupied(cars){const grid=Array(36).fill('');for(const v of cars)for(let i=0;i<v.len;i++){const r=v.r+(v.axis==='v'?i:0),c=v.c+(v.axis==='h'?i:0);if(r>=0&&r<6&&c>=0&&c<6)grid[r*6+c]=v.id;}return grid;}
export function move(state,id,delta){
 const v=state.cars.find(v=>v.id===id);if(state.won||!v||!Number.isInteger(delta)||delta===0)return {ok:false,state};
 const grid=occupied(state.cars),sign=Math.sign(delta);
 for(let step=1;step<=Math.abs(delta);step++){
  const r=v.r+(v.axis==='v'?step*sign:0),c=v.c+(v.axis==='h'?step*sign:0);
  if(r<0||r+(v.axis==='v'?v.len:1)>6||c<0)return {ok:false,state};
  const mayExit=v.id==='A'&&v.axis==='h'&&v.r===2&&sign>0;
  if(c+(v.axis==='h'?v.len:1)>6&&!mayExit||c>6)return {ok:false,state};
  for(let k=0;k<v.len;k++){const rr=r+(v.axis==='v'?k:0),cc=c+(v.axis==='h'?k:0);if(cc>=6){if(!mayExit)return {ok:false,state};continue;}const other=grid[rr*6+cc];if(other&&other!==id)return {ok:false,state};}
 }
 const next={cars:state.cars.map(a=>a.id===id?{...a,r:a.r+(a.axis==='v'?delta:0),c:a.c+(a.axis==='h'?delta:0)}:{...a}),moves:state.moves+1,won:false};next.won=next.cars.find(v=>v.id==='A').c>=6;return {ok:true,state:next};
}
export function solve(index,limit=250000){
 const start=initial(index),encode=s=>s.cars.map(v=>v.axis==='h'?v.c:v.r).join(','),seen=new Set([encode(start)]),queue=[{state:start,path:[]}];
 for(let head=0;head<queue.length&&head<limit;head++){
  const{state,path}=queue[head];for(const v of state.cars)for(let d=-6;d<=6;d++){if(!d)continue;const result=move(state,v.id,d);if(!result.ok)continue;const nextPath=[...path,[v.id,d]];if(result.state.won)return {moves:nextPath.length,path:nextPath,visited:seen.size};const code=encode(result.state);if(!seen.has(code)){seen.add(code);queue.push({state:result.state,path:nextPath});}}
 }return null;
}
