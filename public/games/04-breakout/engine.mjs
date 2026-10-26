// Original deterministic rules and continuous collision solver for Cosmic Cleanup.
export const RULES = Object.freeze({ width:720, height:960, paddleWidth:120, paddleHeight:18, paddleY:884, ballRadius:9, lives:3, columns:8, rows:4, speeds:Object.freeze([300,350,400]), keyboardSpeed:540, brickPoints:10, lifeBonus:50 });
const EPS=1e-7, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createBricks(stage=1) {
  return Array.from({length:32},(_,id)=>{const row=Math.floor(id/8), col=id%8;return {id,row,col,x:48+col*79.25,y:144+row*(stage===3?44:42)+(stage===2?Math.abs(col-3.5)*8:stage===3?(col%2)*16:0),width:69.25,height:28,alive:true};});
}
function attach(s) {s.phase='attached';s.ball={x:s.paddle.x,y:RULES.paddleY-RULES.ballRadius-1,vx:0,vy:0,r:RULES.ballRadius};}
export function createGame() {
  const s={status:'ready',phase:'attached',stage:1,lives:3,score:0,totalBricks:0,endReason:null,paddle:{x:360,y:884,width:120,height:18},ball:null,bricks:createBricks(1)};attach(s);return s;
}
export function startGame(s) {if(s.status!=='ready')return [];s.status='playing';return [{type:'start'}];}
export function launchBall(s) {
  if(s.status!=='playing'||s.phase!=='attached'||s.lives<=0)return [];
  s.phase='flight';const speed=RULES.speeds[s.stage-1];s.ball.vx=speed*Math.sin(Math.PI/12);s.ball.vy=-speed*Math.cos(Math.PI/12);return [{type:'launch'}];
}
export function pauseGame(s) {if(s.status!=='playing')return [];s.status='paused';return [{type:'pause'}];}
export function resumeGame(s) {if(s.status!=='paused')return [];s.status='playing';return [{type:'resume'}];}
export function finishGame(s,reason='quit') {
  if(s.status==='ready'||s.status==='finished'||!['quit','won','lost'].includes(reason))return [];
  s.status='finished';s.endReason=reason;s.ball.vx=0;s.ball.vy=0;
  return [{type:'finish',reason,score:s.score,stage:s.stage,totalBricks:s.totalBricks,lives:s.lives}];
}
function clearStage(s,events) {
  if(s.bricks.some(b=>b.alive))return false;
  const bonus=s.lives*50;s.score+=bonus;events.push({type:'stageClear',stage:s.stage,bonus});
  if(s.stage===3)events.push(...finishGame(s,'won'));
  else {s.stage++;s.bricks=createBricks(s.stage);attach(s);events.push({type:'stage',stage:s.stage});}
  return true;
}
// Swept circle against rectangle faces and four circular corners. No expanded-box
// corner false positives, and no frame-size dependence for thin objects.
function rectHit(ball,rect,limit) {
  const {x,y,vx,vy,r}=ball, left=rect.x,right=rect.x+rect.width,top=rect.y,bottom=rect.y+rect.height;
  const hits=[];
  function add(t,nx,ny){if(t>=-EPS&&t<=limit+EPS&&vx*nx+vy*ny<-EPS)hits.push({t:Math.max(0,t),nx,ny});}
  if(vx>0){const t=(left-r-x)/vx,yy=y+vy*t;if(yy>=top-EPS&&yy<=bottom+EPS)add(t,-1,0);}
  if(vx<0){const t=(right+r-x)/vx,yy=y+vy*t;if(yy>=top-EPS&&yy<=bottom+EPS)add(t,1,0);}
  if(vy>0){const t=(top-r-y)/vy,xx=x+vx*t;if(xx>=left-EPS&&xx<=right+EPS)add(t,0,-1);}
  if(vy<0){const t=(bottom+r-y)/vy,xx=x+vx*t;if(xx>=left-EPS&&xx<=right+EPS)add(t,0,1);}
  const a=vx*vx+vy*vy;
  if(a>0)for(const [cx,cy,sx,sy] of [[left,top,-1,-1],[right,top,1,-1],[left,bottom,-1,1],[right,bottom,1,1]]){
    const dx=x-cx,dy=y-cy,b=2*(dx*vx+dy*vy),c=dx*dx+dy*dy-r*r,disc=b*b-4*a*c;
    if(disc<0)continue;const t=(-b-Math.sqrt(disc))/(2*a),px=x+vx*t,py=y+vy*t;
    if((px-cx)*sx>=-EPS&&(py-cy)*sy>=-EPS)add(t,(px-cx)/r,(py-cy)/r);
  }
  return hits.sort((a,b)=>a.t-b.t)[0];
}
export function step(s,seconds,input={}) {
  if(s.status!=='playing'||!Number.isFinite(seconds)||seconds<=0)return [];
  const events=[];
  if(Number.isFinite(input.paddleX))s.paddle.x=clamp(input.paddleX,60,660);
  else if(Number.isFinite(input.axis))s.paddle.x=clamp(s.paddle.x+clamp(input.axis,-1,1)*RULES.keyboardSpeed*seconds,60,660);
  if(s.phase==='attached'){s.ball.x=s.paddle.x;return events;}
  if(clearStage(s,events))return events;
  let remaining=seconds,iterations=0;
  while(remaining>EPS&&iterations++<20000){
    const b=s.ball,hits=[];
    const add=(t,nx,ny,type,brick)=>{if(t>=-EPS&&t<=remaining+EPS)hits.push({t:Math.max(0,t),nx,ny,type,brick});};
    if(b.vx<0)add((b.r-b.x)/b.vx,1,0,'wall');
    if(b.vx>0)add((720-b.r-b.x)/b.vx,-1,0,'wall');
    if(b.vy<0)add((b.r-b.y)/b.vy,0,1,'wall');
    if(b.vy>0)add((960+b.r-b.y)/b.vy,0,-1,'bottom');
    if(b.vy>0){const h=rectHit(b,{x:s.paddle.x-60,y:884,width:120,height:18},remaining);if(h)add(h.t,h.nx,h.ny,'paddle');}
    for(const brick of s.bricks)if(brick.alive){const h=rectHit(b,brick,remaining);if(h)add(h.t,h.nx,h.ny,'brick',brick);}
    if(!hits.length){b.x+=b.vx*remaining;b.y+=b.vy*remaining;break;}
    hits.sort((a,b)=>a.t-b.t);const t=hits[0].t,contact=hits.filter(h=>Math.abs(h.t-t)<EPS);
    b.x+=b.vx*t;b.y+=b.vy*t;remaining-=t;
    for(const h of contact)if(h.type==='brick'&&h.brick.alive){h.brick.alive=false;s.score+=10;s.totalBricks++;events.push({type:'brick',id:h.brick.id,points:10});}
    // Stage completion takes priority over every loss in this same call.
    if(clearStage(s,events))break;
    if(contact.some(h=>h.type==='bottom')){
      s.lives--;events.push({type:'lifeLost',lives:s.lives});
      if(s.lives===0)events.push(...finishGame(s,'lost'));else attach(s);break;
    }
    if(contact.some(h=>h.type==='paddle')){
      const angle=clamp((b.x-s.paddle.x)/60,-1,1)*Math.PI/3,speed=RULES.speeds[s.stage-1];
      b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed;b.y=Math.min(b.y,884-b.r-EPS);events.push({type:'paddle'});
    }else {
      let nx=0,ny=0;for(const h of contact){nx+=h.nx;ny+=h.ny;}
      const size=Math.hypot(nx,ny);if(size){nx/=size;ny/=size;const dot=b.vx*nx+b.vy*ny;b.vx-=2*dot*nx;b.vy-=2*dot*ny;}
      // A vertical floor on angle avoids a permanently horizontal orbit.
      const speed=Math.hypot(b.vx,b.vy),minY=speed*.15;
      if(speed&&Math.abs(b.vy)<minY){b.vy=(b.vy<0?-1:1)*minY;b.vx=(b.vx<0?-1:1)*Math.sqrt(speed*speed-minY*minY);}
      b.x+=nx*EPS*8;b.y+=ny*EPS*8;
    }
    const skip=Math.min(remaining,EPS);b.x+=b.vx*skip;b.y+=b.vy*skip;remaining-=skip;
  }
  return events;
}
