export const STEP = 1 / 120;
export const LEVELS = Array.from({length:8}, (_,i) => {
  const anchors = i < 2 ? [{x:240,y:42}] : [{x:120+(i%2)*20,y:45},{x:360-(i%2)*20,y:45}];
  const level={ anchors, start:{x:240+(i%2?30:0),y:190}, target:{x:240+(i>3?(i%2?82:-82):0),y:425,r:35}, stars:[{x:240,y:270},{x:240+(i>3?(i%2?42:-42):0),y:337},{x:240+(i>3?(i%2?82:-82):0),y:390}], swing:i>3?75*(i%2?1:-1):0 };
  if(i===6){level.anchors=[{x:105,y:50},{x:355,y:30}];level.start={x:230,y:170};level.target={x:145,y:430,r:35};level.stars=[{x:213,y:245},{x:175,y:325},{x:147,y:390}];level.swing=-85;}
  if(i===7){level.anchors=[{x:145,y:30},{x:370,y:55}];level.start={x:250,y:180};level.target={x:340,y:415,r:35};level.stars=[{x:278,y:250},{x:310,y:315},{x:340,y:380}];level.swing=90;}
  return level;
});
export function distanceToSegment(p,a,b) { const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy); }
export function intersect(a,b,c,d) { const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return p*q<=0&&r*s<=0&&Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.max(c.x,d.x)>=Math.min(a.x,b.x)&&Math.max(a.y,b.y)>=Math.min(c.y,d.y)&&Math.max(c.y,d.y)>=Math.min(a.y,b.y); }
export function create(level=0) { const l=LEVELS[level%8];return {level:level%8,x:l.start.x,y:l.start.y,vx:l.swing,vy:0,ropes:l.anchors.map(a=>({...a,length:Math.hypot(l.start.x-a.x,l.start.y-a.y),cut:false})),stars:l.stars.map(s=>({...s,taken:false})),status:'playing',elapsed:0}; }
export function cut(s,index) { if(s.status!=='playing'||!s.ropes[index]||s.ropes[index].cut)return false;s.ropes[index].cut=true;return true; }
export function swipe(s,a,b) { let n=0;s.ropes.forEach((r,i)=>{if(!r.cut&&intersect(a,b,r,{x:s.x,y:s.y})&&cut(s,i))n++;});return n; }
export function tick(s,dt=STEP) { if(s.status!=='playing')return s;const before={x:s.x,y:s.y};s.elapsed+=dt;s.vy+=310*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
  // Position constraints are projected together, retaining tangential velocity.
  for(let pass=0;pass<8;pass++)for(const r of s.ropes){if(r.cut)continue;const dx=s.x-r.x,dy=s.y-r.y,len=Math.hypot(dx,dy)||1;if(len>r.length){s.x=r.x+dx/len*r.length;s.y=r.y+dy/len*r.length;}}
  s.vx=(s.x-before.x)/dt;s.vy=(s.y-before.y)/dt;
  const after={x:s.x,y:s.y};for(const star of s.stars)if(!star.taken&&distanceToSegment(star,before,after)<=23)star.taken=true;
  const target=LEVELS[s.level].target;if(distanceToSegment(target,before,after)<=target.r+12)s.status='won';else if(s.y>515||s.x< -55||s.x>535)s.status='lost';return s;
}
