import { drafts } from './design-levels.mjs';
import { writeFileSync } from 'node:fs';
const dirs=[['U',0,-1],['R',1,0],['D',0,1],['L',-1,0]];
export function solve(rows, limit=700000) {
 const w=rows[0].length, floors=new Set(), goals=[], boxes=[]; let player;
 rows.forEach((r,y)=>[...r].forEach((c,x)=>{const p=y*w+x;if(c!=='#'){floors.add(p);if(c==='.')goals.push(p);if(c==='$')boxes.push(p);if(c==='@')player=p;}}));
 const sort=b=>b.slice().sort((a,b)=>a-b), key=(p,b)=>p+'|'+sort(b).join(','), won=b=>b.every(p=>goals.includes(p));
 const heap=[], less=(a,b)=>a.pushes<b.pushes||(a.pushes===b.pushes&&a.path.length<b.path.length);
 function put(n){heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(n,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=n;}
 function pop(){const n=heap[0],v=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let j=2*i+1;if(j+1<heap.length&&less(heap[j+1],heap[j]))j++;if(!less(heap[j],v))break;heap[i]=heap[j];i=j;}heap[i]=v;}return n;}
 put({p:player,b:sort(boxes),pushes:0,path:''});const seen=new Map();let visited=0;
 while(heap.length&&visited<limit){const n=pop(),k=key(n.p,n.b),prev=seen.get(k);if(prev&&(prev[0]<n.pushes||(prev[0]===n.pushes&&prev[1]<=n.path.length)))continue;seen.set(k,[n.pushes,n.path.length]);visited++;
 if(won(n.b))return {solution:n.path,pushes:n.pushes,moves:n.path.length,visited};
 const paths=new Map([[n.p,'']]),q=[n.p];for(let i=0;i<q.length;i++){const p=q[i];for(const [c,dx,dy]of dirs){const t=p+dy*w+dx;if(!floors.has(t)||n.b.includes(t)||paths.has(t))continue;paths.set(t,paths.get(p)+c);q.push(t);}}
 for(const b of n.b)for(const[c,dx,dy]of dirs){const d=dy*w+dx,t=b+d,behind=b-d;if(!floors.has(t)||n.b.includes(t)||!paths.has(behind))continue;
 if(!goals.includes(t)){const wall=p=>!floors.has(p);if((wall(t-1)||wall(t+1))&&(wall(t-w)||wall(t+w)))continue;}
 const next=n.b.filter(v=>v!==b);next.push(t);put({p:b,b:sort(next),pushes:n.pushes+1,path:n.path+paths.get(behind)+c});}
 }
 return {solution:null,visited,remaining:heap.length};
}
if (process.argv[1]?.endsWith('solve-levels.mjs')) {
const results=drafts.map(([name,hint,rows],i)=>({id:i+1,name,hint,rows,...solve(rows)}));
writeFileSync(new URL('./level-verification-initial.json',import.meta.url),JSON.stringify(results,null,2));
for(const r of results)console.log(r.id,r.name,r.solution?`${r.pushes} pushes / ${r.moves} moves`: 'UNSOLVED',r.visited);
}
