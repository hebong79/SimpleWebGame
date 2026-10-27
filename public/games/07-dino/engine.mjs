export const RULES=Object.freeze({width:960,height:360,ground:300,x:120,bodyWidth:36,stand:48,duck:24,gravity:1600,jumpVelocity:-560,tick:1/120,spawnX:1040});
const EPS=1e-10, clone=value=>structuredClone(value);
export function speedAt(time){return Math.min(400,240+20*Math.floor((time+EPS)/20));}
// Suppress only integral-pixel roundoff within four floating-point ULPs;
// do not expand collision boxes or round genuine fractional travel distances.
export function distanceAt(time){const n=Math.min(8,Math.floor(time/20));const value=20*(240*n+10*n*(n-1))+(time-20*n)*(240+20*n),integer=Math.round(value);return Math.abs(value-integer)<=4*Number.EPSILON*Math.max(1,Math.abs(value))?integer:value;}
export function gapRequirement(speed,extra){return 1.2*Math.min(400,speed+20)+extra;}
export function makeObstacle(time,rng){const bird=time>=30&&rng()<1/3;return bird?{type:'bird',width:52,top:256,bottom:272}:{type:'cactus',width:24+Math.floor(rng()*29),top:300-(44+Math.floor(rng()*21)),bottom:300};}
// Exact intersection of the horizontal overlap interval and quadratic foot path.
// Inclusive roots count as contact; the horizontal interval is never expanded.
export function firstCollision(body,obstacle,speed,duration){
  const lo=Math.max(0,(obstacle.x-body.x-body.width)/speed),hi=Math.min(duration,(obstacle.x+obstacle.width-body.x)/speed);
  if(lo>hi||hi<0)return null;
  const low=obstacle.top,high=obstacle.bottom+body.height,g=body.grounded?0:1600;
  const foot=t=>body.foot+body.vy*t+g*t*t/2;
  if(foot(lo)>=low&&foot(lo)<=high)return lo;
  const candidates=[];
  for(const bound of [low,high]){
    if(g===0){if(body.vy!==0)candidates.push((bound-body.foot)/body.vy);}
    else {const d=body.vy*body.vy-2*g*(body.foot-bound);if(d>=0){const r=Math.sqrt(d);candidates.push((-body.vy-r)/g,(-body.vy+r)/g);}}
  }
  const roots=candidates.filter(t=>t>=lo&&t<=hi).sort((a,b)=>a-b);
  return roots.length?roots[0]:null;
}
export function createEngine({rng=Math.random}={}){
  let state='ready',round=0,time=0,ticks=0,accumulator=0,jumpStart=null,height=48,pauseReason=null,result=null,obstacles=[],nextExtra=0,nextId=1;
  const jumps=new Set(),ducks=new Set();
  const body=()=>{const a=jumpStart===null?0:time-jumpStart;return {x:120,width:36,height,foot:jumpStart===null?300:300-560*a+800*a*a,vy:jumpStart===null?0:-560+1600*a,grounded:jumpStart===null};};
  const currentObstacles=()=>obstacles.map(o=>({...o,x:1040-(distanceAt(time)-o.bornDistance)}));
  function reset(){time=0;ticks=0;accumulator=0;jumpStart=null;height=48;pauseReason=null;result=null;obstacles=[];nextExtra=0;nextId=1;jumps.clear();ducks.clear();}
  function finish(reason,hit=null){if(!['playing','paused'].includes(state))return [];const b=body(),metric=Math.floor(distanceAt(time));result={type:'result',reason,round,score:Math.floor(metric/10),metric,time,distance:distanceAt(time),collision:hit?{obstacle:clone(hit),body:b}:null};state='result';accumulator=0;jumps.clear();ducks.clear();return [clone(result)];}
  function contact(){if(state!=='playing')return [];const b=body();for(const o of currentObstacles())if(firstCollision(b,o,speedAt(time),0)===0)return finish('collision',o);return [];}
  function posture(){if(jumpStart===null)height=ducks.size?24:48;return contact();}
  function spawn(){const o={...makeObstacle(time,rng),id:nextId++,born:time,bornDistance:distanceAt(time)};obstacles.push(o);nextExtra=Math.floor(rng()*121);}
  function segment(duration){
    const end=time+duration,events=[];
    while(state==='playing'&&time<end-EPS){
      const speed=speedAt(time),b=body(),list=currentObstacles();
      let boundary=end;
      if(speed<400)boundary=Math.min(boundary,(Math.floor((time+EPS)/20)+1)*20);
      if(jumpStart!==null)boundary=Math.min(boundary,jumpStart+.7);
      const last=list.at(-1),gap=last?1040-last.x-last.width:Infinity,needed=gapRequirement(speed,nextExtra);
      if(gap+EPS>=needed){spawn();continue;}
      boundary=Math.min(boundary,time+(needed-gap)/speed);
      let dt=boundary-time,hit=null,hitTime=Infinity;
      for(const o of list){const t=firstCollision(b,o,speed,dt);if(t!==null&&t<hitTime){hitTime=t;hit=o;}}
      if(hit){time+=hitTime;const at=currentObstacles().find(o=>o.id===hit.id);events.push(...finish('collision',at));break;}
      time=boundary;
      if(jumpStart!==null&&time>=jumpStart+.7-EPS){jumpStart=null;height=ducks.size?24:48;events.push(...contact());}
      obstacles=obstacles.filter(o=>1040-(distanceAt(time)-o.bornDistance)+o.width>=0);
    }
    if(state==='playing')time=end;
    return events;
  }
  return Object.freeze({
    snapshot(){const metric=Math.floor(distanceAt(time));return clone({state,round,time,accumulator,speed:speedAt(time),distance:distanceAt(time),metric,score:Math.floor(metric/10),body:body(),duckHeld:ducks.size>0,jumpHeld:jumps.size>0,obstacles:currentObstacles(),preparedExtra:nextExtra,pauseReason,result});},
    ready(){if(['playing','paused'].includes(state))return false;reset();state='ready';return true;},
    start(){if(!['ready','result'].includes(state))return false;reset();round++;state='playing';spawn();return true;},
    advance(dt){if(state!=='playing'||!Number.isFinite(dt)||dt<=0)return [];accumulator+=dt;const events=[];while(state==='playing'&&accumulator+EPS>=1/120){accumulator=Math.max(0,accumulator-1/120);const end=(ticks+1)/120;events.push(...segment(end-time));if(state==='playing'){ticks++;time=end;}}return events;},
    jumpDown(token='jump'){if(state!=='playing'||jumps.has(token))return [];jumps.add(token);if(jumpStart!==null||ducks.size)return [];jumpStart=time;height=48;return [{type:'jump',round,time}];},
    jumpUp(token='jump'){if(state==='playing')jumps.delete(token);},
    duckDown(token='duck'){if(state!=='playing'||ducks.has(token))return [];ducks.add(token);return posture();},
    duckUp(token='duck'){if(state!=='playing')return [];ducks.delete(token);return posture();},
    release(){jumps.clear();ducks.clear();return posture();},
    pause(reason='manual'){if(state!=='playing')return false;state='paused';pauseReason=reason;jumps.clear();ducks.clear();return true;},
    resume(){if(state!=='paused')return [];state='playing';pauseReason=null;return posture();},
    quit(){return finish('quit');}
  });
}
