export const STEP=1/120, WIDTH=480, HEIGHT=480;
export function create(){return{wave:0,ammo:8,lighthouses:[true,true,true,true],enemies:[],shots:[],shields:[],spawned:0,nextSpawn:0.7,elapsed:0,score:0,status:'playing',aim:{x:240,y:180}};}
export function fire(s,target=s.aim){if(s.status!=='playing'||s.ammo<=0)return false;const x=Math.max(10,Math.min(470,target.x)),y=Math.max(25,Math.min(370,target.y)),dx=x-240,dy=y-442,len=Math.hypot(dx,dy);s.ammo--;s.shots.push({x:240,y:442,tx:x,ty:y,vx:dx/len*350,vy:dy/len*350});return true;}
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function tick(s,dt=STEP){if(s.status!=='playing')return s;s.elapsed+=dt;s.nextSpawn-=dt;const count=[6,9,12][s.wave];
  if(s.spawned<count&&s.nextSpawn<=0){const k=s.spawned++,target=(k*3+s.wave)%4;s.enemies.push({x:28+(k*97+s.wave*53)%424,y:-12,tx:[72,184,296,408][target],target,speed:49+s.wave*13});s.nextSpawn=0.9;}
  const remaining=[];for(const b of s.shots){const before={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;if(segmentDistance({x:b.tx,y:b.ty},before,b)<=350*dt/2){s.shields.push({x:b.tx,y:b.ty,age:0,r:0});}else remaining.push(b);}s.shots=remaining;
  for(const shield of s.shields){shield.age+=dt;shield.r=Math.min(56,shield.age/.35*56);}s.shields=s.shields.filter(x=>x.age<.75);
  const survivors=[];for(const e of s.enemies){const before={x:e.x,y:e.y},dx=e.tx-e.x,dy=425-e.y,len=Math.hypot(dx,dy)||1;e.x+=dx/len*e.speed*dt;e.y+=dy/len*e.speed*dt;if(s.shields.some(shield=>segmentDistance(shield,before,e)<=shield.r+5)){s.score+=50;continue;}if(e.y>=418){s.lighthouses[e.target]=false;continue;}survivors.push(e);}s.enemies=survivors;
  if(!s.lighthouses.some(Boolean)){s.status='lost';return s;}
  if(s.spawned===count&&s.enemies.length===0){s.score+=s.lighthouses.filter(Boolean).length*100;if(s.wave===2)s.status='won';else{s.wave++;s.ammo=8;s.spawned=0;s.nextSpawn=1.5;s.shots=[];s.shields=[];}}return s;
}
