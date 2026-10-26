export const RULES = Object.freeze({ width:360, height:640, x:96, y:320, radius:12, gravity:900, flapVelocity:-280, speed:110, archWidth:52, spacing:220, firstX:420, tick:1/120 });
const EPS = 1e-9;
const copy = value => structuredClone(value);
export function seededRandom(seed=1) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value,1664525)+1013904223)>>>0; return value/4294967296; };
}
export function gapFor(index, previous=320, random=Math.random) {
  if (!Number.isSafeInteger(index) || index<1) throw new RangeError('arch index');
  const height=index<=5 ? 180 : Math.max(160,180-5*(index-5));
  if (index<=5) return {height, center:320};
  const low=Math.max(100+height/2,previous-80), high=Math.min(540-height/2,previous+80);
  const value=random();
  if (!(value>=0 && value<1)) throw new RangeError('RNG must return [0,1)');
  return {height,center:low+(high-low)*value};
}
export function circleRect(point, radius, rect) {
  const dx=point.x-Math.max(rect.x,Math.min(point.x,rect.x+rect.width));
  const dy=point.y-Math.max(rect.y,Math.min(point.y,rect.y+rect.height));
  return dx*dx+dy*dy<=radius*radius+EPS;
}
const evaluate=(p,x)=>p.reduceRight((sum,c)=>sum*x+c,0);
// Isolate every real root, including double roots at tangency, on [0,1].
function roots(poly) {
  const p=[...poly];
  while(p.length>1 && Math.abs(p.at(-1))<1e-15) p.pop();
  if(p.length===1) return [];
  if(p.length===2) { const x=-p[0]/p[1]; return x>=-EPS&&x<=1+EPS?[Math.max(0,Math.min(1,x))]:[]; }
  const cuts=[0,...roots(p.slice(1).map((c,i)=>c*(i+1))),1].sort((a,b)=>a-b);
  const found=[];
  const tolerance=1e-8;
  for(const x of cuts) if(Math.abs(evaluate(p,x))<=tolerance) found.push(x);
  for(let i=1;i<cuts.length;i++) {
    let a=cuts[i-1],b=cuts[i],fa=evaluate(p,a),fb=evaluate(p,b);
    if(fa*fb>=0) continue;
    for(let k=0;k<65;k++) { const mid=(a+b)/2, fm=evaluate(p,mid); if(fa*fm<=0) {b=mid;fb=fm;} else {a=mid;fa=fm;} }
    found.push((a+b)/2);
  }
  return found.sort((a,b)=>a-b).filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>1e-10);
}
function square(p) { const out=Array(p.length*2-1).fill(0); p.forEach((a,i)=>p.forEach((b,j)=>out[i+j]+=a*b)); return out; }
// Exact rounded-rectangle boundary: four offset faces and four circular corners.
// Parametric trajectory x=x0+dx*u, y=y0+dy*u+curve*u². No expanded AABB collision shortcut.
export function sweepCircleRect(start, end, radius, rect, curve=0) {
  if(circleRect(start,radius,rect)) return {fraction:0,point:{...start}};
  const xp=[start.x,end.x-start.x], yp=[start.y,end.y-start.y-curve,curve];
  const at=u=>({x:evaluate(xp,u),y:evaluate(yp,u)});
  const candidates=[];
  const add=(poly,valid)=>{for(const u of roots(poly)) { const point=at(u); if(valid(point)) candidates.push({fraction:u,point}); }};
  for(const x of [rect.x-radius,rect.x+rect.width+radius]) add([xp[0]-x,xp[1]],p=>p.y>=rect.y-EPS&&p.y<=rect.y+rect.height+EPS);
  for(const y of [rect.y-radius,rect.y+rect.height+radius]) add([yp[0]-y,yp[1],yp[2]],p=>p.x>=rect.x-EPS&&p.x<=rect.x+rect.width+EPS);
  for(const [cx,sx] of [[rect.x,-1],[rect.x+rect.width,1]]) for(const [cy,sy] of [[rect.y,-1],[rect.y+rect.height,1]]) {
    const xx=square([xp[0]-cx,xp[1]]), yy=square([yp[0]-cy,yp[1],yp[2]]);
    const poly=yy.map((v,i)=>v+(xx[i]||0)); poly[0]-=radius*radius;
    add(poly,p=>sx*(p.x-cx)>=-EPS&&sy*(p.y-cy)>=-EPS);
  }
  return candidates.sort((a,b)=>a.fraction-b.fraction)[0]||null;
}
export function sweepBounds(y,vy,seconds,radius=12,height=640) {
  const curve=.5*RULES.gravity*seconds*seconds, dy=vy*seconds;
  if(y-radius<=0) return {fraction:0,reason:'ceiling'};
  if(y+radius>=height) return {fraction:0,reason:'ground'};
  const hits=[];
  for(const [boundary,reason] of [[radius,'ceiling'],[height-radius,'ground']]) for(const u of roots([y-boundary,dy,curve])) hits.push({fraction:u,reason});
  return hits.sort((a,b)=>a.fraction-b.fraction)[0]||null;
}
// Pure one-tick rule evaluation is shared by the engine and geometry boundary tests.
export function flightStep(bird, arches, seconds=RULES.tick) {
  const nextY=bird.y+bird.vy*seconds+.5*RULES.gravity*seconds*seconds;
  let hit=sweepBounds(bird.y,bird.vy,seconds);
  for(const arch of arches) {
    const top=arch.center-arch.height/2, bottom=arch.center+arch.height/2;
    for(const rect of [{x:arch.x,y:0,width:52,height:top},{x:arch.x,y:bottom,width:52,height:640-bottom}]) {
      const contact=sweepCircleRect({x:96,y:bird.y},{x:96+110*seconds,y:nextY},12,rect,.5*900*seconds*seconds);
      if(contact && (!hit||contact.fraction<hit.fraction)) hit={...contact,reason:'arch',arch:arch.index};
    }
  }
  const fraction=hit?.fraction??1, dt=seconds*fraction;
  const moved=arches.map(a=>({...a,x:a.x-110*dt}));
  const passed=[];
  if(!hit) for(const arch of moved) if(!arch.passed&&96>arch.x+52) {arch.passed=true;passed.push(arch.index);}
  return {bird:{x:96,y:bird.y+bird.vy*dt+.5*900*dt*dt,vy:bird.vy+900*dt},arches:moved,passed,hit:hit?{...hit,point:{x:96,y:bird.y+bird.vy*dt+.5*900*dt*dt},elapsed:dt}:null};
}
export function createEngine({random=Math.random}={}) {
  let state='ready',reason=null,pauseReason=null,time=0,ticks=0,remainder=0,score=0,round=0;
  let bird={x:96,y:320,vy:0},arches=[],nextIndex=1,previousCenter=320,queue=[],order=0,result=null;
  const snapshot=()=>copy({state,pauseReason,time,remainder,score,round,bird,arches,result});
  function spawn(x) { const gap=gapFor(nextIndex,previousCenter,random); previousCenter=gap.center; arches.push({index:nextIndex++,x,...gap,passed:false}); }
  function start() {
    if(!['ready','result'].includes(state)) return [];
    state='playing';reason=null;pauseReason=null;time=0;ticks=0;remainder=0;score=0;round++;bird={x:96,y:320,vy:-280};arches=[];nextIndex=1;previousCenter=320;queue=[];result=null;spawn(420);
    return [{type:'start',round},{type:'flap',time:0}];
  }
  function finish(why,events=[],contact=null) {
    if(!['playing','paused'].includes(state)) return [];
    state='result';reason=why;queue=[];remainder=0;
    result={round,score,reason,time,contact:contact?copy(contact):null};
    events.push({type:'result',...copy(result)});return events;
  }
  return Object.freeze({snapshot,start,
    flap(at=time+remainder) {if(state!=='playing'||!Number.isFinite(at)||at<time-EPS) return false;queue.push({at,order:order++});queue.sort((a,b)=>a.at-b.at||a.order-b.order);return true;},
    pause(why='manual') {if(state!=='playing') return false;state='paused';pauseReason=why;queue=[];return true;},
    resume() {if(state!=='paused') return false;state='playing';pauseReason=null;queue=[];return true;},
    quit() {return finish('quit');},
    ready() {if(state!=='result') return false;state='ready';bird={x:96,y:320,vy:0};arches=[];score=0;time=0;remainder=0;result=null;return true;},
    advance(seconds) {
      if(!Number.isFinite(seconds)||seconds<0) throw new RangeError('elapsed seconds');
      if(state!=='playing') return [];
      remainder+=seconds;const events=[];
      while(remainder+1e-12>=RULES.tick&&state==='playing') {
        // An event exactly on a completed tick boundary belongs to the next tick.
        const tickEnd=(ticks+1)*RULES.tick;
        while(queue.length&&queue[0].at<tickEnd-1e-12) {queue.shift();bird.vy=-280;events.push({type:'flap',time});}
        const step=flightStep(bird,arches);bird=step.bird;arches=step.arches;
        remainder=Math.max(0,remainder-RULES.tick);
        if(step.hit) {time=ticks*RULES.tick+step.hit.elapsed;finish(step.hit.reason,events,{...step.hit,time});break;}
        ticks++;time=ticks*RULES.tick;
        for(const index of step.passed) {score++;events.push({type:'pass',index,score,time});}
        arches=arches.filter(a=>a.x+52>=0);
        if(!arches.length||arches.at(-1).x<=200+EPS) spawn(420+(nextIndex-1)*220-110*time);
      }
      return events;
    }
  });
}
// Fresh press tokens are captured at key/pointer DOWN, never at release/click time.
export function createRetryGate() {
  let endedAt=-Infinity, generation=0;
  return Object.freeze({end(now){endedAt=now;generation++;},press(now){return Object.freeze({at:now,generation});},allows(token,now){return !!token&&token.generation===generation&&token.at>=endedAt+500&&now>=token.at;},remaining(now){return Math.max(0,Math.ceil(endedAt+500-now));}});
}
