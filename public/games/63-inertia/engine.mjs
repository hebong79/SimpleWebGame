export const DIRS={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
export function create(l){return {position:l.start,gems:[...l.gems],moves:0,lost:false,won:false,path:[]};}
export function slide(s,l,d){
  if(!DIRS[d]||s.won||s.lost)return s;
  let p=s.position;const gems=[...s.gems],path=[];let lost=false;
  const [dx,dy]=DIRS[d];
  for(let k=0;k<7;k++){
    const x=p%7+dx,y=Math.floor(p/7)+dy,n=y*7+x;
    if(x<0||x>=7||y<0||y>=7||l.walls.includes(n))break;
    p=n;path.push(p);const gi=gems.indexOf(p);if(gi>=0)gems.splice(gi,1);
    if(l.cracks.includes(p)){lost=true;break;}if(l.stops.includes(p))break;
  }
  if(!path.length)return s;
  return {position:p,gems,moves:s.moves+1,path,lost,won:!lost&&gems.length===0};
}
export function solve(l){
  const initial=create(l),q=[[initial,[]]],seen=new Set();
  for(let i=0;i<q.length;i++){const [s,path]=q[i],key=s.position+':'+s.gems.join(',');if(seen.has(key))continue;seen.add(key);
    for(const d of Object.keys(DIRS)){const n=slide(s,l,d);if(n===s||n.lost)continue;if(n.won)return [...path,d];q.push([n,[...path,d]]);}}
  return null;
}
