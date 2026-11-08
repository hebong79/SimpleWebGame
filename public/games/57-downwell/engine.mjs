export const WIDTH=400,HEIGHT=600;
export const MAPS=[
 {name:'연보라 샛길',offset:0,platforms:[[135,105,130],[30,250,112],[240,400,112],[110,560,140]],crystals:[[200,75],[85,210],[294,360],[180,520],[45,650]],enemies:[[200,320],[310,610]]},
 {name:'빙하 결정층',offset:700,platforms:[[32,85,126],[225,240,110],[60,410,100],[150,570,120]],crystals:[[95,50],[280,200],[108,370],[210,530],[338,640]],enemies:[[180,180],[190,470],[290,640]]},
 {name:'석양 구조로',offset:1400,platforms:[[240,90,104],[35,260,100],[210,430,102],[70,580,120]],crystals:[[292,50],[88,220],[260,390],[130,540],[330,650]],enemies:[[150,150],[180,330],[310,520],[220,670]]}
];
export function initial(){return{x:200,y:55,vy:0,hp:3,immune:0,ammo:3,onGround:false,score:0,crystals:0,time:0,stage:0,camera:0,prevFire:false,shots:[],done:false,won:false,platforms:MAPS.flatMap((m,k)=>m.platforms.map(([x,y,w])=>({x,y:y+m.offset,w,safe:true,stage:k}))).concat({x:16,y:2200,w:368,safe:true,rescue:true}),gems:MAPS.flatMap(m=>m.crystals.map(([x,y])=>({x,y:y+m.offset,taken:false}))),enemies:MAPS.flatMap((m,k)=>m.enemies.map(([x,y],i)=>({x,y:y+m.offset,origin:x,phase:i+k*2,alive:true}))),event:''};}
function substep(s,input,dt){s.time+=dt;s.event='';s.immune=Math.max(0,s.immune-dt);s.x=Math.max(27,Math.min(373,s.x+((input.right?1:0)-(input.left?1:0))*160*dt));const rising=!!input.fire&&!s.prevFire;s.prevFire=!!input.fire;if(rising&&!s.onGround&&s.ammo>0){s.ammo--;s.shots.push({x:s.x,y:s.y+14});s.vy=Math.min(s.vy,40);s.event='pulse';}const old=s.y;s.vy=Math.min(500,s.vy+620*dt);s.y+=s.vy*dt;s.onGround=false;
 if(s.vy>=0){const crossed=s.platforms.filter(p=>s.x+10>p.x&&s.x-10<p.x+p.w&&old+14<=p.y+.001&&s.y+14>=p.y).sort((a,b)=>a.y-b.y)[0];if(crossed){s.y=crossed.y-14;s.vy=0;s.onGround=true;if(crossed.safe)s.ammo=3;if(crossed.rescue){s.done=true;s.won=true;s.event='rescue';}}}
 s.stage=Math.min(2,Math.floor(s.y/700));s.camera=Math.max(s.camera,Math.max(0,Math.min(1670,s.y-170)));
 for(const g of s.gems)if(!g.taken&&Math.abs(g.x-s.x)<23&&Math.abs(g.y-s.y)<25){g.taken=true;s.crystals++;s.score+=10;s.event='gem';}
 for(const e of s.enemies)if(e.alive){e.x=Math.max(32,Math.min(368,e.origin+Math.sin(s.time*1.4+e.phase)*45));if(s.immune===0&&Math.abs(e.x-s.x)<23&&Math.abs(e.y-s.y)<24){s.hp--;s.immune=1;s.event='hit';if(s.hp<=0){s.done=true;s.won=false;}}}
 for(const shot of s.shots){shot.y+=650*dt;const e=s.enemies.find(e=>e.alive&&Math.abs(e.x-shot.x)<22&&Math.abs(e.y-shot.y)<22);if(e){e.alive=false;shot.hit=true;s.score+=30;s.event='enemy';}}
 s.shots=s.shots.filter(b=>!b.hit&&b.y<s.camera+HEIGHT+50);if(s.y>2280){s.done=true;s.won=false;}}
export function step(s,input,dt){if(s.done||!Number.isFinite(dt)||dt<0)return;let t=Math.min(5,dt);while(t>1e-9&&!s.done){const d=Math.min(1/120,t);substep(s,input,d);t-=d;}}
