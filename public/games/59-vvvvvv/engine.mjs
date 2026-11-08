export const WIDTH=480,HEIGHT=300,TILE=30;
export const ROOMS=[
 {name:'첫 반전',bottom:[[120,240]],top:[],checkpoint:[75,258,1],route:[[75,-1],[280,1],[440,0]]},
 {name:'엇갈린 정비선',bottom:[[110,200],[350,400]],top:[[240,305]],checkpoint:[75,258,1],route:[[75,-1],[220,1],[325,-1],[440,1]]},
 {name:'짧은 발판',bottom:[[100,200],[335,395]],top:[[240,300]],checkpoint:[70,42,-1],route:[[70,-1],[220,1],[320,-1],[440,1]]},
 {name:'두 신호 사이',bottom:[[105,185],[340,405]],top:[[225,290]],checkpoint:[70,258,1],route:[[70,-1],[205,1],[315,-1],[440,1]]},
 {name:'천장 점검로',bottom:[[95,190],[345,405]],top:[[230,300]],checkpoint:[65,42,-1],route:[[65,-1],[212,1],[325,-1],[440,1]]},
 {name:'별빛 출구',bottom:[[100,180],[335,400]],top:[[220,285]],checkpoint:[65,258,1],route:[[65,-1],[200,1],[310,-1],[440,1]]}
];
export function initial(room=0){return{room,x:45,y:258,vy:0,gravity:1,grounded:true,time:0,deaths:0,checkpoint:{x:45,y:258,gravity:1},checkpointSet:false,prevFlip:false,done:false,event:''};}
export function flip(s){if(s.done||!s.grounded)return false;s.gravity*=-1;s.grounded=false;return true;}
export function respawn(s){s.deaths++;s.x=s.checkpoint.x;s.y=s.checkpoint.y;s.gravity=s.checkpoint.gravity;s.vy=0;s.grounded=true;s.prevFlip=false;s.event='death';}
function spike(s){const m=ROOMS[s.room],left=s.x-8,right=s.x+8;if(s.y+12>=267&&m.bottom.some(([a,b])=>right>a&&left<b))return true;if(s.y-12<=33&&m.top.some(([a,b])=>right>a&&left<b))return true;return false;}
function substep(s,input,dt){s.event='';s.time+=dt;const rising=!!input.flip&&!s.prevFlip;s.prevFlip=!!input.flip;if(rising)flip(s);s.x=Math.max(15,Math.min(465,s.x+((input.right?1:0)-(input.left?1:0))*150*dt));s.vy=Math.max(-360,Math.min(360,s.vy+s.gravity*700*dt));s.y+=s.vy*dt;s.grounded=false;if(s.y+12>=270&&s.gravity===1){s.y=258;s.vy=0;s.grounded=true;}if(s.y-12<=30&&s.gravity===-1){s.y=42;s.vy=0;s.grounded=true;}if(spike(s)){respawn(s);return;}const[x,y,g]=ROOMS[s.room].checkpoint;if(!s.checkpointSet&&Math.abs(s.x-x)<18&&Math.abs(s.y-y)<18&&s.gravity===g&&s.grounded){s.checkpoint={x,y,gravity:g};s.checkpointSet=true;s.event='checkpoint';}if(s.x>=438&&s.y>=245&&s.gravity===1&&s.grounded){s.done=true;s.event='exit';}}
export function step(s,input,dt){if(s.done||!Number.isFinite(dt)||dt<0)return;let t=Math.min(5,dt);while(t>1e-9&&!s.done){const d=Math.min(1/120,t);substep(s,input,d);t-=d;}}
