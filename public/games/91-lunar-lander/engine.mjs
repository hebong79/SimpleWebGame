export const MISSIONS = [{name:'넓은 기지',x:310,width:150,y:338},{name:'좁은 기지',x:380,width:82,y:338},{name:'고지대 기지',x:230,width:90,y:278}];
export const RULES={gravity:65,thrust:150,fuelRate:16};
export function createGame(mission=0){return {mission,time:0,x:310,y:48,vx:0,vy:0,angle:0,fuel:100,held:{},state:'playing'};}
export function ground(s,x=s.x){const p=MISSIONS[s.mission];return Math.abs(x-p.x)<=p.width/2?p.y:350+Math.sin(x*.045)*14;}
export function landingSafe(s){const p=MISSIONS[s.mission];return Math.abs(s.x-p.x)+12<=p.width/2&&Math.abs(s.angle)<=10&&Math.abs(s.vx)<=16&&Math.abs(s.vy)<=32;}
export function input(s,key){if(s.state==='playing')s.held[key]=true;}
export function release(s,key){delete s.held[key];}
export function clear(s){s.held={};}
export function step(s,dt){if(s.state!=='playing')return;s.time+=dt;s.angle=Math.max(-85,Math.min(85,s.angle+((s.held.right?1:0)-(s.held.left?1:0))*85*dt));let burn=0;if(s.held.action&&s.fuel>0){burn=Math.min(dt,s.fuel/16);s.fuel=Math.max(0,s.fuel-burn*16);}const a=s.angle*Math.PI/180;s.vx+=Math.sin(a)*150*burn;s.vy+=65*dt-Math.cos(a)*150*burn;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.y<13){s.y=13;s.vy=Math.max(0,s.vy);}if(s.x<12||s.x>608){s.state='lost';clear(s);}else if(s.y+12>=ground(s)){s.y=ground(s)-12;s.state=landingSafe(s)?'won':'lost';clear(s);}}
