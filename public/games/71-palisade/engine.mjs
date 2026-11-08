export const W=5,H=4;
export const neighbors=i=>[i%W?i-1:-1,i%W<W-1?i+1:-1,i>=W?i-W:-1,i<W*(H-1)?i+W:-1].filter(x=>x>=0);
export const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
export const EDGES=Array.from({length:20},(_,a)=>neighbors(a).filter(b=>b>a).map(b=>[a,b])).flat();
export function cluesFor(regions){return regions.map((r,i)=>4-neighbors(i).filter(j=>regions[j]===r).length);}
export function solutionEdges(regions){return Object.fromEntries(EDGES.map(([a,b])=>[edgeKey(a,b),regions[a]===regions[b]?0:1]));}
export function check(clues,edges){
 const groups=[],seen=new Set();for(let i=0;i<20;i++){if(seen.has(i))continue;const q=[i];seen.add(i);for(let k=0;k<q.length;k++)for(const j of neighbors(q[k]))if(edges[edgeKey(q[k],j)]!==1&&!seen.has(j)){seen.add(j);q.push(j);}groups.push(q);}
 const errors=[];for(const group of groups)if(group.length!==4)errors.push('모든 목장은 직교로 연결된 네 칸이어야 합니다.');
 const ids=[];groups.forEach((g,k)=>g.forEach(i=>ids[i]=k));
 for(const [a,b]of EDGES)if(edges[edgeKey(a,b)]===1&&ids[a]===ids[b])errors.push('같은 목장 안쪽에 남은 울타리를 지워 주세요.');
 for(let i=0;i<20;i++){const n=4-neighbors(i).length+neighbors(i).filter(j=>edges[edgeKey(i,j)]===1).length;if(clues[i]!==null&&n!==clues[i])errors.push(`${i+1}번 표지판의 울타리 수를 맞춰 주세요.`);}
 return{complete:errors.length===0,errors:[...new Set(errors)],groups};
}
// Enumerate connected four-cell regions, then exact-cover the board. Each numbered
// cell constrains its region boundary locally, including the immutable perimeter.
export function solve(clues,limit=2){
 let sets=new Map();for(let i=0;i<20;i++)sets.set(String(i),[i]);for(let n=1;n<4;n++){const next=new Map();for(const set of sets.values())for(const a of set)for(const b of neighbors(a))if(!set.includes(b)){const v=[...set,b].sort((x,y)=>x-y);next.set(v.join(','),v);}sets=next;}
 const candidates=[...sets.values()].filter(s=>s.every(i=>clues[i]===null||4-neighbors(i).filter(j=>s.includes(j)).length===clues[i]));const by=Array.from({length:20},()=>[]);for(const s of candidates)for(const i of s)by[i].push(s);const out=[];
 function visit(used,parts){if(out.length>=limit)return;if(used.size===20){const r=[];parts.forEach((s,k)=>s.forEach(i=>r[i]=k));out.push(r);return;}let choices=null;for(let i=0;i<20;i++)if(!used.has(i)){const c=by[i].filter(s=>s.every(j=>!used.has(j)));if(!c.length)return;if(!choices||c.length<choices.length)choices=c;}for(const s of choices)visit(new Set([...used,...s]),[...parts,s]);}visit(new Set(),[]);return out;
}
