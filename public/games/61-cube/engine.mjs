// Original clean-room rules; face IDs stay fixed as the cube rolls.
export const DIRS = {up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
export const opposite = d => ({up:'down',down:'up',left:'right',right:'left'})[d];
export function roll(o,d) {
  const [t,b,n,s,w,e]=o;
  return ({up:[s,n,t,b,w,e],down:[n,s,b,t,w,e],left:[e,w,n,s,t,b],right:[w,e,n,s,b,t]})[d] ?? [...o];
}
export function create(level) { return {x:level.x,y:level.y,orientation:[...level.orientation],faces:[0,0,0,0,0,0],floor:[...level.floor],moves:0,won:false}; }
export function move(state,d) {
  if (!DIRS[d] || state.won) return state;
  const [dx,dy]=DIRS[d], x=state.x+dx,y=state.y+dy;
  if(x<0||x>=5||y<0||y>=4) return state;
  const orientation=roll(state.orientation,d),faces=[...state.faces],floor=[...state.floor],i=y*5+x,b=orientation[1];
  [faces[b],floor[i]]=[floor[i],faces[b]];
  return {x,y,orientation,faces,floor,moves:state.moves+1,won:faces.every(Boolean)};
}
export const stampCount=s=>s.faces.reduce((a,b)=>a+b,0)+s.floor.reduce((a,b)=>a+b,0);
