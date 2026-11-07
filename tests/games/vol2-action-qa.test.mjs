import test from 'node:test';
import assert from 'node:assert/strict';
import * as defense from '../../public/games/35-missile-command/engine.mjs';
import * as orbit from '../../public/games/36-hexagon/engine.mjs';
import * as steps from '../../public/games/37-qbert/engine.mjs';
import * as mushroom from '../../public/games/38-whac-a-mole/engine.mjs';
import * as fruit from '../../public/games/39-fruit-ninja/engine.mjs';
import * as rope from '../../public/games/40-cut-the-rope/engine.mjs';

const near=(actual,expected,epsilon=1e-7)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} should equal ${expected}`);
const frozen=state=>JSON.stringify(state);

test('35 eight shots consume finite ammo, empty and finished games reject firing',()=>{
 const s=defense.create();for(let i=0;i<8;i++)assert.equal(defense.fire(s,{x:100+i*30,y:150}),true);
 assert.equal(s.ammo,0);assert.equal(s.shots.length,8);assert.equal(defense.fire(s),false);assert.equal(s.shots.length,8);
 const ended=defense.create();ended.status='lost';assert.equal(defense.fire(ended),false);assert.equal(ended.ammo,8);
});
test('35 one shield catches multiple enemies; overlapping shields never double score an enemy',()=>{
 const s=defense.create();s.nextSpawn=Infinity;s.shields=[{x:200,y:200,age:.35,r:56},{x:220,y:200,age:.35,r:56}];
 s.enemies=[190,220,350].map(x=>({x,y:200,tx:x,target:0,speed:0}));defense.tick(s);
 assert.equal(s.score,100);assert.equal(s.enemies.length,1);assert.equal(s.enemies[0].x,350);assert.deepEqual(s.lighthouses,[true,true,true,true]);
});
test('35 swept enemy crossing hits a shield and all lighthouses lost takes priority over wave completion',()=>{
 const s=defense.create();s.nextSpawn=Infinity;s.shields=[{x:200,y:200,age:.35,r:56}];s.enemies=[{x:200,y:80,tx:200,target:0,speed:2000}];defense.tick(s,.1);assert.equal(s.enemies.length,0);assert.equal(s.score,50);
 const lost=defense.create();lost.lighthouses.fill(false);lost.spawned=6;lost.enemies=[];defense.tick(lost);assert.equal(lost.status,'lost');assert.equal(lost.wave,0);
});
test('35 all three waves replenish ammo once and retain a surviving lighthouse',()=>{
 const s=defense.create();s.lighthouses=[true,false,false,false];for(let wave=0;wave<3;wave++){assert.equal(s.wave,wave);s.ammo=0;s.spawned=[6,9,12][wave];s.enemies=[];s.nextSpawn=Infinity;defense.tick(s);if(wave<2){assert.equal(s.ammo,8);assert.equal(s.status,'playing');}}
 assert.equal(s.status,'won');assert.equal(s.score,300);const ended=frozen(s);defense.tick(s,1);assert.equal(frozen(s),ended);
});

test('36 angular wrap uses the short arc across zero and opposite controls cancel',()=>{
 near(orbit.normalize(-.01),orbit.TAU-.01);near(orbit.angleDistance(orbit.TAU-.01,.01),.02);
 const s=orbit.create();s.angle=orbit.TAU-.01;s.spawn=Infinity;s.rings=[{r:55,gap:.01,width:Math.PI/2}];orbit.tick(s);assert.equal(s.status,'playing');
 const stopped=orbit.create();stopped.left=stopped.right=true;orbit.tick(stopped);near(stopped.angle,0);
});
test('36 a low-fps ring crossing cannot tunnel through the collision band',()=>{
 const s=orbit.create();s.spawn=Infinity;s.angle=0;s.rings=[{r:80,gap:Math.PI,width:Math.PI/2}];orbit.tick(s,.6);assert.equal(s.status,'lost');
 const safe=orbit.create();safe.spawn=Infinity;safe.angle=0;safe.rings=[{r:80,gap:0,width:Math.PI/2}];orbit.tick(safe,.6);assert.equal(safe.status,'playing');
});
test('36 every adjacent deterministic gap is reachable at the specified rotation speed',()=>{
 const travel=240*Math.PI/180*1.2;assert.equal(orbit.PATTERNS.length,10);
 for(let i=0;i<orbit.PATTERNS.length;i++)assert.ok(orbit.angleDistance(orbit.PATTERNS[i],orbit.PATTERNS[(i+1)%10])<travel);
});
for(const mode of ['goal','practice'])test(`36 ${mode} full deterministic pattern can be survived with actual fixed ticks`,()=>{
 const s=orbit.create(mode);for(let k=0;k<8000&&s.status==='playing';k++){
  const next=s.rings.filter(r=>r.r>=orbit.RADIUS-10).sort((a,b)=>a.r-b.r)[0];
  const delta=next?Math.atan2(Math.sin(next.gap-s.angle),Math.cos(next.gap-s.angle)):0;
  s.left=delta<-.02;s.right=delta>.02;orbit.tick(s);
 }
 assert.equal(s.status,'won');assert.equal(s.time,mode==='goal'?60:30);
});

test('37 at most one jump is queued, and it runs only after the current landing',()=>{
 const s=steps.create();assert.equal(steps.jump(s,'c'),true);assert.equal(steps.jump(s,'z'),false);assert.equal(s.queued,'z');steps.jump(s,'q');assert.equal(s.queued,'z');
 for(let i=0;i<Math.ceil(steps.JUMP/steps.STEP);i++)steps.tick(s);assert.equal(s.r,1);assert.equal(s.c,1);assert.ok(s.jump);assert.equal(s.jump.r,2);assert.equal(s.jump.c,1);assert.equal(s.queued,null);
 for(let i=0;i<Math.ceil(steps.JUMP/steps.STEP);i++)steps.tick(s);assert.equal(s.r,2);assert.equal(s.c,1);assert.equal(s.jump,null);
});
test('37 impact on the final unpainted tile takes priority over stamping and stage completion',()=>{
 const s=steps.create();s.tiles.fill(true);s.tiles[steps.indexOf(1,0)]=false;s.jump={fromR:0,fromC:0,r:1,c:0,t:steps.JUMP-steps.STEP};s.drops=[{r:1,c:0,eta:0,age:0}];steps.tick(s);
 assert.equal(s.lives,2);assert.equal(s.tiles[steps.indexOf(1,0)],false);assert.equal(s.stage,0);assert.equal(s.completed,0);assert.equal(s.score,25);assert.equal(s.queued,null);
});
test('37 falling preserves stamps, consumes one life and three board completions terminate',()=>{
 const falling=steps.create(),before=[...falling.tiles];steps.jump(falling,'q');for(let i=0;i<22;i++)steps.tick(falling);assert.equal(falling.lives,2);assert.deepEqual(falling.tiles,before);assert.equal(falling.r,0);assert.equal(falling.c,0);
 const s=steps.create();for(let stage=0;stage<3;stage++){s.tiles.fill(true);s.tiles[steps.indexOf(1,0)]=false;s.r=s.c=0;s.grace=0;s.drops=[];s.dropClock=1000;s.jump={fromR:0,fromC:0,r:1,c:0,t:steps.JUMP-steps.STEP};steps.tick(s);assert.equal(s.completed,stage+1);if(stage<2){assert.equal(s.rows,5);assert.equal(s.tiles.length,15);assert.equal(s.stage,stage+1);}}
 assert.equal(s.status,'won');assert.equal(steps.jump(s,'c'),false);
});
test('37 multiple hazards during grace cannot repeatedly consume lives',()=>{
 const s=steps.create();s.drops=[{r:0,c:0,eta:0,age:0},{r:0,c:0,eta:0,age:0}];steps.tick(s);assert.equal(s.lives,2);for(let i=0;i<12;i++)steps.tick(s);assert.equal(s.lives,2);
});
test('37 grace protects a valid hazardous landing while still committing movement and stamp',()=>{
 const s=steps.create();s.grace=.5;s.drops=[{r:1,c:0,eta:0,age:0}];s.jump={fromR:0,fromC:0,r:1,c:0,t:steps.JUMP-steps.STEP};steps.tick(s);
 assert.equal(s.lives,3);assert.equal(s.r,1);assert.equal(s.c,0);assert.equal(s.tiles[steps.indexOf(1,0)],true);assert.equal(s.score,50);
});

test('38 the same consumed target tapped twice or tapped plus keyboard is scored once without penalty',()=>{
 const s=mushroom.create();s.targets[3]={id:17,star:false,life:.8};assert.equal(mushroom.hit(s,3),10);assert.equal(mushroom.hit(s,3),0);assert.equal(s.score,10);assert.equal(s.targets[3],null);
});
test('38 a star scores once, a genuinely empty hole costs five and score has a zero floor',()=>{
 const s=mushroom.create();s.targets[5]={id:18,star:true,life:.8};assert.equal(mushroom.hit(s,5),30);assert.equal(mushroom.hit(s,1),-5);assert.equal(s.score,25);
 const empty=mushroom.create();mushroom.hit(empty,0);assert.equal(empty.score,0);
});
test('38 zero seconds blocks input, clears targets, and normal/practice timers remain separate',()=>{
 const s=mushroom.create();s.time=.002;s.targets[0]={id:1,star:true,life:1};mushroom.tick(s,.1,()=>0);assert.equal(s.time,0);assert.equal(s.status,'won');assert.ok(s.targets.every(v=>v===null));assert.equal(mushroom.hit(s,0),0);assert.equal(s.score,0);
 assert.equal(mushroom.create('normal').time,30);assert.equal(mushroom.create('practice').time,45);
});
test('38 spawn never occupies more than two holes, nor repeats the same hole three times',()=>{
 const crowded=mushroom.create();crowded.targets[0]={id:11,star:false,life:10};crowded.targets[1]={id:12,star:false,life:10};mushroom.tick(crowded,.01,()=>0);assert.equal(crowded.targets.filter(Boolean).length,2);
 const practice=mushroom.create('practice');practice.targets[0]={id:11,star:false,life:10};mushroom.tick(practice,.01,()=>0);assert.equal(practice.targets.filter(Boolean).length,1);
 const s=mushroom.create(),history=[];let previousId=0;
 for(let k=0;k<7300&&s.status==='playing';k++){mushroom.tick(s,1/240,()=>0);assert.ok(s.targets.filter(Boolean).length<=2);if(s.serial!==previousId){previousId=s.serial;history.push(s.last);if(history.length>=3)assert.equal(history.slice(-3).every(v=>v===history.at(-1)),false);}for(let i=0;i<9;i++)if(s.targets[i])mushroom.hit(s,i);}
 assert.equal(s.status,'won');
});

const object=(id,x,type='fruit',y=200)=>({id,x,y,type,r:20,fruit:0,vx:0,vy:0});
test('39 intersection times handle direction, tangency, misses and point taps',()=>{
 near(fruit.entryTime({x:0,y:0},{x:10,y:0},{x:5,y:0},1),.4);near(fruit.entryTime({x:10,y:0},{x:0,y:0},{x:5,y:0},1),.4);
 near(fruit.entryTime({x:0,y:1},{x:10,y:1},{x:5,y:0},1),.5);assert.equal(fruit.entryTime({x:0,y:5},{x:10,y:5},{x:5,y:0},1),null);assert.equal(fruit.entryTime({x:5,y:0},{x:5,y:0},{x:5,y:0},1),0);
});
for(const reverse of [false,true])test(`39 ${reverse?'reverse':'forward'} swipe orders fruit and bomb by entry time`,()=>{
 const s=fruit.create();s.objects=[object(3,300),object(2,200,'bomb'),object(1,100)];fruit.beginStroke(s);const hits=fruit.slice(s,{x:reverse?400:0,y:200},{x:reverse?0:400,y:200});
 assert.deepEqual(hits.map(v=>v.id),[reverse?3:1,2]);assert.equal(s.score,10);assert.equal(s.status,'lost');assert.ok(s.objects.some(v=>v.id===(reverse?1:3)));
});
test('39 simultaneous bomb entry takes priority over a lower-id fruit',()=>{
 const s=fruit.create();s.objects=[object(1,200),object(2,200,'bomb')];fruit.beginStroke(s);const hits=fruit.slice(s,{x:0,y:200},{x:400,y:200});assert.equal(s.status,'lost');assert.equal(s.score,0);assert.deepEqual(hits,[{id:2,bomb:true}]);
});
test('39 each fruit is consumed once, combo is once per stroke, and a fresh stroke resets combo',()=>{
 const s=fruit.create();s.objects=[object(1,80),object(2,160),object(3,240),object(4,320)];fruit.beginStroke(s);fruit.slice(s,{x:0,y:200},{x:400,y:200});assert.equal(s.score,60);assert.equal(s.slices,4);assert.equal(fruit.slice(s,{x:400,y:200},{x:0,y:200}).length,0);assert.equal(s.score,60);
 s.objects=[object(5,80),object(6,160),object(7,240)];fruit.beginStroke(s);fruit.slice(s,{x:0,y:200},{x:400,y:200});assert.equal(s.score,110);
});
test('39 zero-time input is rejected and deadline evaluates the 150-point order',()=>{
 const s=fruit.create();s.time=0;s.objects=[object(1,100)];assert.deepEqual(fruit.slice(s,{x:0,y:200},{x:400,y:200}),[]);assert.equal(s.score,0);
 for(const[score,status]of[[149,'lost'],[150,'won']]){const state=fruit.create();state.time=.001;state.score=score;fruit.tick(state,.02,()=>.5);assert.equal(state.time,0);assert.equal(state.status,status);}
});

test('40 eight level definitions are distinct puzzles rather than duplicate entries',()=>{
 assert.equal(rope.LEVELS.length,8);assert.equal(new Set(rope.LEVELS.map(level=>JSON.stringify(level))).size,8);
});
for(let level=0;level<8;level++)test(`40 level ${level+1} has an executable cut schedule reaching the real target`,()=>{
 let solved=false,winningSchedule=null;
 // Search inputs only: no object positions, velocities, targets or outcome flags are altered.
 for(const first of [0,1]){if(solved)break;for(let delay=0;delay<=300;delay+=5){const s=rope.create(level);rope.cut(s,first);for(let k=0;k<1500&&s.status==='playing';k++){if(k===delay)for(let i=0;i<s.ropes.length;i++)rope.cut(s,i);rope.tick(s);}if(s.status==='won'){solved=true;winningSchedule={first,delayTicks:delay};break;}}}
 assert.equal(solved,true,`No successful schedule for level ${level+1}`);assert.ok(winningSchedule);
});
test('40 cutting preserves instantaneous velocity and the remaining rope; re-cut is ignored',()=>{
 const s=rope.create(2);s.vx=45;s.vy=-20;const before={x:s.x,y:s.y,vx:s.vx,vy:s.vy,length:s.ropes[1].length};assert.equal(rope.cut(s,0),true);assert.equal(rope.cut(s,0),false);assert.deepEqual({x:s.x,y:s.y,vx:s.vx,vy:s.vy,length:s.ropes[1].length},before);assert.equal(s.ropes[1].cut,false);
 for(let i=0;i<120;i++){rope.tick(s);const r=s.ropes[1];assert.ok(Math.hypot(s.x-r.x,s.y-r.y)<=r.length+.001);}
});
test('40 one fast tick collects swept stars and the target, not merely end-position overlaps',()=>{
 const s=rope.create(0);s.x=240;s.y=200;s.vx=0;s.vy=1000;s.ropes.forEach(r=>r.cut=true);rope.tick(s,.2);assert.equal(s.stars.filter(v=>v.taken).length,3);assert.equal(s.status,'won');
});
test('40 swipe crossing cuts each rope once and reset restores ropes and star state',()=>{
 const s=rope.create(2);const count=rope.swipe(s,{x:0,y:100},{x:480,y:100});assert.equal(count,2);assert.equal(rope.swipe(s,{x:0,y:100},{x:480,y:100}),0);s.stars[0].taken=true;const reset=rope.create(2);assert.ok(reset.ropes.every(r=>!r.cut));assert.ok(reset.stars.every(star=>!star.taken));
});

if(process.env.VOL2_ACTION_BROWSER==='1')test('39/40 foreign pointer move/up cannot cut; the original primary stroke continues (three browsers)',async()=>{
 const {chromium,webkit}=await import('@playwright/test');const {resolve}=await import('node:path');const {createGameServer}=await import('../../artifacts/g032-build/src/server/index.js');const server=createGameServer(resolve('artifacts/g032-build/public'));await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const[name,engine,mobile,width]of[['PC',chromium,false,1200],['mobileChromium',chromium,true,320],['mobileWebKit',webkit,true,320]]){
  const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  try{
   await context.route('**/39-fruit-ninja/engine.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export * from './engine.mjs?qa-original';import {create as original} from './engine.mjs?qa-original';export function create(mode){const s=original(mode);s.objects=[{id:999,type:'fruit',fruit:0,x:240,y:240,r:23,vx:0,vy:0}];s.spawn=1000;return s;}`}));
   for(const[id,y,startX,endX]of[['39-fruit-ninja',240,30,450],['40-cut-the-rope',100,100,380]]){
    await page.goto(`${base}/games/${id}/index.html`);await page.waitForFunction(()=>window.__vol2?.state==='ready');await page.locator('#start').click({delay:80});const canvas=page.locator('#board canvas');
    // The start control follows the whole board/tools. Clicking it may scroll
    // the canvas above the viewport. Mouse coordinates are viewport-relative,
    // so an offscreen bbox cannot establish the claimed primary stroke.
    const beforeRect=await canvas.boundingBox(),beforeViewport=await page.evaluate(()=>({scrollX,scrollY,width:innerWidth,height:innerHeight}));
    await canvas.scrollIntoViewIfNeeded();
    const rect=await canvas.boundingBox(),viewport=await page.evaluate(()=>({scrollX,scrollY,width:innerWidth,height:innerHeight}));
    assert.ok(rect&&beforeRect,`${name} ${id} canvas has geometry`);
    const point=x=>({x:rect.x+x/480*rect.width,y:rect.y+y/480*rect.height});const a=point(startX),b=point(endX);
    console.log('POINTER_GEOMETRY',JSON.stringify({environment:name,id,beforeRect,beforeViewport,beforeLogicalStart:{x:beforeRect.x+startX/480*beforeRect.width,y:beforeRect.y+y/480*beforeRect.height},rect,viewport,primaryStart:a,primaryEnd:b}));
    for(const p of[a,b])assert.ok(p.x>=0&&p.x<viewport.width&&p.y>=0&&p.y<viewport.height,`${name} ${id} primary point must be inside the viewport: ${JSON.stringify(p)}`);
    await canvas.evaluate(node=>{window.__qaNativePointerStart=null;node.addEventListener('pointerdown',event=>{if(event.isTrusted&&event.isPrimary)window.__qaNativePointerStart={id:event.pointerId,x:event.clientX,y:event.clientY,isTrusted:event.isTrusted};},{capture:true});});
    await page.mouse.move(a.x,a.y);await page.mouse.down();
    const nativeStart=await page.evaluate(()=>window.__qaNativePointerStart);assert.ok(nativeStart?.isTrusted,`${name} ${id} primary stroke must begin on the canvas`);console.log('PRIMARY_POINTER_START',JSON.stringify({environment:name,id,...nativeStart}));const foreign={...b,pointerId:nativeStart.id+1000};
    await canvas.evaluate((node,p)=>{for(const type of ['pointerdown','pointermove'])node.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:p.pointerId,pointerType:'touch',isPrimary:false,clientX:p.x,clientY:p.y,buttons:1}));},foreign);
    const after=await page.evaluate(()=>window.__vol2.snapshot());if(id.startsWith('39')){assert.equal(after.score,0,`${name} foreign pointer must not slice fruit`);assert.equal(after.objects.length,1);}else assert.ok(after.ropes.every(r=>!r.cut),`${name} foreign pointer must not cut rope`);
    await canvas.evaluate((node,p)=>node.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:p.pointerId,pointerType:'touch',isPrimary:false,clientX:p.x,clientY:p.y,buttons:0})),foreign);
    await page.mouse.move(b.x,b.y);await page.mouse.up();const legitimate=await page.evaluate(()=>window.__vol2.snapshot());if(id.startsWith('39'))assert.equal(legitimate.score,10,`${name} primary stroke survives foreign up`);else assert.ok(legitimate.ropes.some(r=>r.cut),`${name} primary stroke survives foreign up`);
   }
  }finally{await context.close();await browser.close();}
 }}finally{await new Promise(ok=>server.close(ok));}
});
