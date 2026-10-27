export const RULES = Object.freeze({ width:360, height:640, bodyWidth:28, bodyHeight:36, gravity:1200, jumpVelocity:-600, speed:180, step:1/120, platformWidth:72, platformHeight:12 });
const EPS = 1e-9;
const copy = value => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function seededRandom(seed=1) {
  let state=seed>>>0;
  return () => { state=(Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
}
// Absolute-time triangle wave: center -> +30 -> center -> -30.
export function platformX(platform,time) {
  if(!platform.moving) return platform.x;
  const phase=(((time-platform.born)*30+30)%120+120)%120;
  return platform.nominal+(phase<=60?phase-30:90-phase);
}
export function bodyX(body,direction,seconds) {
  return clamp(body.x+direction*RULES.speed*seconds,14,346);
}
export function descendingContact(body,platform,direction,time,duration) {
  const discriminant=body.vy*body.vy+2*RULES.gravity*(platform.top-body.foot);
  if(discriminant<0) return null;
  const root=(-body.vy+Math.sqrt(discriminant))/RULES.gravity;
  if(root < -EPS || root > duration+EPS || body.vy+RULES.gravity*root < -EPS) return null;
  const t=clamp(root,0,duration), x=bodyX(body,direction,t), px=platformX(platform,time+t);
  return Math.abs(x-px)<=50+EPS ? t : null;
}
function highPoint(body,duration) {
  const t=clamp(-body.vy/RULES.gravity,0,duration);
  return Math.min(body.foot,body.foot+body.vy*duration+600*duration*duration,body.foot+body.vy*t+600*t*t);
}
// Pure single ballistic interval, also used by engine. No frame-end AABB.
export function flyInterval(body,platforms,direction,time,duration,cameraTop=0,minEverFoot=560) {
  let landing=null, end=duration;
  for(const p of platforms) {
    const contact=descendingContact(body,p,direction,time,duration);
    if(contact!==null && (landing===null || contact<end-EPS || (Math.abs(contact-end)<=EPS && p.id<landing.id))) { end=contact; landing=p; }
  }
  let minimum=Math.min(minEverFoot,highPoint(body,end));
  let camera=Math.min(cameraTop,minimum-274);
  // The camera is stationary throughout descent. Its preceding apex is known analytically.
  const bottom=camera+676;
  const disc=body.vy*body.vy+2400*(bottom-body.foot);
  const fall=disc>=0?(-body.vy+Math.sqrt(disc))/1200:Infinity;
  const failed=fall>=-EPS && fall<end-EPS && body.vy+1200*fall>=0;
  if(failed) { end=Math.max(0,fall); landing=null; minimum=Math.min(minEverFoot,highPoint(body,end)); camera=Math.min(cameraTop,minimum-274); }
  const next={x:bodyX(body,direction,end),foot:body.foot+body.vy*end+600*end*end,vy:body.vy+1200*end};
  if(landing) { next.foot=landing.top; next.vy=-600; }
  return {body:next,seconds:end,cameraTop:camera,minEverFoot:minimum,landingId:landing?.id??null,failed};
}
export function initialSpine() {
  return {platforms:[{id:0,x:180,nominal:180,top:560,moving:false,born:0}],nextId:1,eligibleCandidates:0,frontier:{nominal:180,top:560}};
}
export function generateSpine(spine,cameraTop,score,time,rng) {
  const next=copy(spine);
  next.platforms=next.platforms.filter(p=>p.top-cameraTop<=680);
  // Removing fixed platforms cannot leave more than an active fifth moving.
  const enforce=()=>{
    let moving=next.platforms.filter(p=>p.moving).sort((a,b)=>a.id-b.id);
    while(moving.length>Math.floor(next.platforms.length/5)) {
      const p=moving.shift();p.x=platformX(p,time);p.moving=false;
    }
  };
  enforce();
  while(next.platforms.length<5 || next.frontier.top>cameraTop-120) {
    const gap=60+Math.floor(rng()*41), shift=(rng()*2-1)*80;
    if(score>=500) next.eligibleCandidates++;
    const candidate=score>=500 && next.eligibleCandidates%5===0;
    const moving=candidate && next.platforms.filter(p=>p.moving).length<Math.floor((next.platforms.length+1)/5);
    const nominal=clamp(next.frontier.nominal+shift,moving?66:36,moving?294:324);
    const top=next.frontier.top-gap;
    next.platforms.push({id:next.nextId++,x:nominal,nominal,top,moving,born:time});
    next.frontier={nominal,top};
  }
  enforce();return next;
}
export function createEngine({rng=Math.random}={}) {
  let round=0, accumulator=0, held=new Map(), order=0;
  let state;
  function readyState() { return {state:'ready',round,time:0,body:{x:180,foot:560,vy:0},cameraTop:0,minEverFoot:560,metric:0,score:0,bounces:0,lastLandingTime:-1,pauseReason:null,result:null,spine:initialSpine()}; }
  state=readyState();
  const direction=()=>{let last=null;for(const v of held.values())if(!last||v.order>last.order)last=v;return last?.side??0;};
  const snapshot=()=>copy({...state,direction:direction(),remainder:accumulator,platforms:state.spine.platforms.map(p=>({...p,x:platformX(p,state.time)}))});
  function finish(reason,events) {
    if(state.state==='result')return;
    state.state='result';held.clear();accumulator=0;
    state.result={type:'result',round:state.round,reason,score:state.score,metric:state.metric};events.push(copy(state.result));
  }
  function step(duration,events) {
    let remaining=duration;
    while(remaining>EPS && state.state==='playing') {
      const flight=flyInterval(state.body,state.spine.platforms,direction(),state.time,remaining,state.cameraTop,state.minEverFoot);
      state.body=flight.body;state.cameraTop=flight.cameraTop;state.minEverFoot=flight.minEverFoot;
      state.time+=flight.seconds;remaining-=flight.seconds;
      state.metric=Math.floor(Math.max(0,560-state.minEverFoot)+EPS);state.score=Math.floor(state.metric/10);
      if(flight.failed) { finish('fall',events);break; }
      if(flight.landingId!==null) { state.bounces++;state.lastLandingTime=state.time;events.push({type:'bounce',platformId:flight.landingId,time:state.time}); }
      state.spine=generateSpine(state.spine,state.cameraTop,state.score,state.time,rng);
    }
  }
  return Object.freeze({snapshot,
    start() {
      if(!['ready','result'].includes(state.state))return false;
      round++;state=readyState();state.round=round;state.state='playing';state.body.vy=-600;held.clear();accumulator=0;
      state.spine=generateSpine(state.spine,0,0,0,rng);return true;
    },
    ready() {if(state.state==='playing'||state.state==='paused')return false;held.clear();accumulator=0;state=readyState();return true;},
    pause(reason='manual') {if(state.state!=='playing')return false;state.state='paused';state.pauseReason=reason;held.clear();return true;},
    resume() {if(state.state!=='paused')return false;state.state='playing';state.pauseReason=null;held.clear();return true;},
    directionDown(side,token=String(side)) {if(state.state!=='playing'||![-1,1].includes(side)||held.has(token))return false;held.set(token,{side,order:++order});return true;},
    directionUp(token) {return held.delete(token);},
    release() {held.clear();},
    advance(seconds) {
      const events=[];
      if(state.state!=='playing'||!Number.isFinite(seconds)||seconds<=0)return events;
      accumulator+=seconds;
      while(accumulator+EPS>=RULES.step && state.state==='playing') {
        accumulator=Math.max(0,accumulator-RULES.step);
        // Canonicalize sub-nanosecond arithmetic dust at fixed-tick boundaries.
        if(accumulator<EPS)accumulator=0;
        step(RULES.step,events);
      }
      return events;
    },
    quit() {const events=[];if(state.state==='playing'||state.state==='paused')finish('quit',events);return events;}
  });
}
