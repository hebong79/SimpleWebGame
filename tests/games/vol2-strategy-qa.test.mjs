import test from 'node:test';
import assert from 'node:assert/strict';
import * as stars from '../../public/games/28-untangle/engine.mjs';
import * as code from '../../public/games/29-guess/engine.mjs';
import * as reversi from '../../public/games/30-othello/engine.mjs';
import * as sets from '../../public/games/31-set/engine.mjs';
import * as mancala from '../../public/games/32-mancala/engine.mjs';
import * as maze from '../../public/games/33-maze/engine.mjs';
import * as asteroids from '../../public/games/34-asteroids/engine.mjs';
const sum=a=>a.reduce((n,v)=>n+v,0);
const emptyInput={left:false,right:false,thrust:false,fire:false};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} equals ${b}`);

test('28 eight graph problems are distinct and every supplied solution is valid',()=>{
 assert.equal(stars.LEVELS.length,8);assert.equal(new Set(stars.LEVELS.map(l=>JSON.stringify(l.initial))).size,8);
 for(const level of stars.LEVELS){assert.equal(stars.violations(level.solution,level.edges).count,0);assert.ok(stars.violations(level.initial,level.edges).count>0);assert.ok(level.solution.length>=6);assert.equal(new Set(level.edges.map(e=>[...e].sort((a,b)=>a-b).join(','))).size,level.edges.length);}
});
test('28 shared endpoint is allowed, independent crossings, edge overlaps and a vertex on an edge are not',()=>{
 assert.equal(stars.violations([{x:0,y:0},{x:100,y:0},{x:0,y:100}],[[0,1],[0,2]]).count,0);
 const cross=[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}];assert.ok(stars.violations(cross,[[0,1],[2,3]]).count>0);const point=stars.crossingPoints(cross,[[0,1],[2,3]])[0];near(point.x,50);near(point.y,50);
 assert.ok(stars.violations([{x:0,y:0},{x:100,y:0},{x:50,y:0}],[[0,1],[0,2]]).count>0);
 assert.ok(stars.violations([{x:0,y:0},{x:100,y:0},{x:50,y:0}],[[0,1]]).count>0);
 assert.ok(stars.violations([{x:0,y:0},{x:5,y:0}],[]).count>0);
});
test('29 duplicate colors are counted only up to the unmatched secret multiplicity',()=>{
 assert.deepEqual(code.feedback([0,0,1,2],[0,1,0,0]),{exact:1,color:2});assert.deepEqual(code.feedback([0,0,0,0],[0,1,1,1]),{exact:1,color:0});assert.deepEqual(code.feedback([0,1,2,3],[3,2,1,0]),{exact:0,color:4});assert.deepEqual(code.feedback([1,1,1,1],[1,1,1,1]),{exact:4,color:0});
});
test('29 intro forbids repeated or incomplete marks, while basic permits repetition',()=>{
 assert.equal(code.validGuess([0,0,1],'intro'),false);assert.equal(code.validGuess([0,null,2],'intro'),false);assert.equal(code.validGuess([0,1,2],'intro'),true);assert.equal(code.validGuess([0,0,0,0],'basic'),true);assert.equal(code.validGuess([0,1,null,3],'basic'),false);assert.equal(code.validGuess([0,1,2,6],'basic'),false);
 const intro=code.newCode('intro',()=>0),basic=code.newCode('basic',()=>0);assert.deepEqual(intro,[0,1,2]);assert.deepEqual(basic,[0,0,0,0]);
});
test('29 feedback never mutates either code or guess and consumes no generation RNG',()=>{
 let calls=0;const secret=code.newCode('basic',()=>{calls++;return .3;}),guess=[0,1,2,3],before=[...secret],g=[...guess],created=calls;for(let i=0;i<8;i++)code.feedback(secret,guess);assert.deepEqual(secret,before);assert.deepEqual(guess,g);assert.equal(calls,created);
});

for(const n of [6,8])test(`30 ${n}x${n} starts with four pieces and legal moves do not mutate the old board`,()=>{
 const b=reversi.initial(n),original=[...b];assert.equal(b.filter(Boolean).length,4);assert.equal(reversi.legal(b,n,1).length,4);assert.equal(reversi.legal(b,n,2).length,4);const move=reversi.move(b,n,reversi.legal(b,n,1)[0],1);assert.equal(move.board.filter(v=>v===1).length,4);assert.equal(move.board.filter(v=>v===2).length,1);assert.deepEqual(b,original);assert.equal(reversi.move(b,n,0,1),null);
});
test('30 captures along all eight directions, but never wraps a row edge',()=>{
 const n=8,b=Array(64).fill(0),index=3*n+3;for(const[dr,dc]of reversi.DIRS){b[(3+dr)*n+3+dc]=2;b[(3+2*dr)*n+3+2*dc]=1;}assert.equal(reversi.flips(b,n,index,1).length,8);
 const boundary=Array(16).fill(0);boundary[3]=2;boundary[2]=1;assert.deepEqual(reversi.flips(boundary,4,4,1),[]);
});
test('30 an opponent with no legal move passes, and both blocked players end before any full-board assumption',()=>{
 const b=Array(16).fill(1);b[1]=b[13]=2;b[2]=b[14]=0;const first=reversi.move(b,4,2,1);assert.equal(first.pass,true);assert.equal(first.done,false);assert.equal(first.turn,1);assert.deepEqual(reversi.legal(first.board,4,2),[]);assert.deepEqual(reversi.legal(first.board,4,1),[14]);const last=reversi.move(first.board,4,14,1);assert.equal(last.done,true);assert.deepEqual(last.counts,[16,0]);
 const withEmpty=Array(16).fill(1);withEmpty[1]=2;withEmpty[2]=0;withEmpty[15]=0;const blocked=reversi.move(withEmpty,4,2,1);assert.equal(blocked.done,true);assert.equal(blocked.board[15],0);
});
test('30 a full board can finish as an exact draw',()=>{
 const b=[0,2,1,2,1,1,2,2,2,2,1,2,1,2,2,1],result=reversi.move(b,4,0,1);assert.equal(result.done,true);assert.deepEqual(result.counts,[8,8]);
});

for(const attributes of [3,4])test(`31 ${attributes}-attribute deck is unique and has the exact combinatorial set count`,()=>{
 const deck=sets.deck(attributes),n=3**attributes;assert.equal(deck.length,n);assert.equal(new Set(deck.map(c=>c.join(','))).size,n);assert.ok(deck.every(c=>c.length===attributes&&c.every(v=>[0,1,2].includes(v))));let count=0;for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(let c=b+1;c<n;c++)if(sets.isSet([deck[a],deck[b],deck[c]]))count++;assert.equal(count,n*(n-1)/6);
});
test('31 a two-same one-different attribute fails and identifies the first mismatch',()=>{
 const cards=[[0,0,0,0],[1,1,1,1],[2,2,1,2]];assert.equal(sets.isSet(cards),false);assert.equal(sets.mismatch(cards),2);assert.equal(sets.isSet([[0,0,0,0],[1,1,1,1],[2,2,2,2]]),true);
});
test('31 no-set redeal preserves all uncollected cards, injects an actual set and never mutates the old layout',()=>{
 const deck=sets.deck(4),cap=deck.filter(c=>c.every(v=>v<2)),shown=cap.slice(0,12),pile=deck.filter(c=>!shown.includes(c)),before=JSON.stringify({shown,pile});assert.equal(sets.findSet(shown),null);const dealt=sets.deal({shown,pile});assert.equal(dealt.done,false);assert.ok(sets.findSet(dealt.shown));assert.equal(dealt.shown.length,12);assert.equal(dealt.shown.length+dealt.pile.length,81);assert.equal(new Set([...dealt.shown,...dealt.pile].map(c=>c.join(','))).size,81);assert.equal(JSON.stringify({shown,pile}),before);
});
test('31 empty draw pile continues for a visible set, and finishes only when no remaining set exists',()=>{
 const valid=[[0,0,0],[1,1,1],[2,2,2]];assert.equal(sets.deal({shown:valid,pile:[]}).done,false);assert.equal(sets.deal({shown:[],pile:[]}).done,true);const cap=sets.deck(4).filter(c=>c.every(v=>v<2));assert.equal(sets.deal({shown:cap.slice(0,12),pile:cap.slice(12)}).done,true);
});

for(const seeds of [2,4])test(`32 ${seeds}-seed game conserves the full seed total through legal turns`,()=>{
 let s=mancala.initial(seeds),total=seeds*12;assert.equal(sum(s.pits),total);for(let i=0;i<500&&!s.done;i++){const index=s.pits.findIndex((v,j)=>v>0&&mancala.own(j,s.turn));assert.ok(index>=0);const old=JSON.stringify(s),next=mancala.move(s,index);assert.equal(JSON.stringify(s),old);assert.equal(sum(next.pits),total);assert.ok(next.pits.every(v=>Number.isInteger(v)&&v>=0));s=next;}
});
test('32 sowing skips the opponent store even over a complete lap and own store grants an extra turn',()=>{
 const s=mancala.initial(0);s.pits[0]=14;s.pits[5]=1;s.pits[7]=1;const r=mancala.move(s,0);assert.equal(r.path.length,14);assert.equal(r.path.includes(13),false);assert.equal(r.pits[13],0);assert.equal(sum(r.pits),16);
 const normal=mancala.move(mancala.initial(4),2);assert.deepEqual(normal.path,[3,4,5,6]);assert.equal(normal.again,true);assert.equal(normal.turn,0);
 const top=mancala.initial(4);top.turn=1;const extra=mancala.move(top,9);assert.deepEqual(extra.path,[10,11,12,13]);assert.equal(extra.again,true);assert.equal(extra.turn,1);
});
test('32 captures mirror the opposite pit and require that opposite pit to contain seeds',()=>{
 const s=mancala.initial(0);s.pits[0]=1;s.pits[1]=1;s.pits[7]=1;s.pits[10]=5;const captured=mancala.move(s,1);assert.equal(captured.captured,6);assert.equal(captured.pits[6],6);assert.equal(captured.pits[2],0);assert.equal(captured.pits[10],0);assert.equal(captured.done,false);assert.equal(sum(captured.pits),8);
 const top=mancala.initial(0);top.turn=1;top.pits[0]=1;top.pits[1]=5;top.pits[7]=1;top.pits[10]=1;const mirrored=mancala.move(top,10);assert.equal(mirrored.captured,6);assert.equal(mirrored.pits[13],6);assert.equal(sum(mirrored.pits),8);
 const noCapture=mancala.initial(0);noCapture.pits[0]=1;noCapture.pits[1]=1;noCapture.pits[7]=1;assert.equal(mancala.move(noCapture,1).captured,0);
});
test('32 terminal sweeping preserves seeds and overrides an otherwise extra turn',()=>{
 const s=mancala.initial(0);s.pits[5]=1;s.pits[7]=4;s.pits[8]=2;const r=mancala.move(s,5);assert.equal(r.done,true);assert.equal(r.again,false);assert.equal(r.pits[6],1);assert.equal(r.pits[13],6);assert.equal(sum(r.pits),7);assert.equal(mancala.move(r,7),null);assert.equal(mancala.move(mancala.initial(),7),null);
});

test('33 three maps are distinct, every walkable cell is connected and all initial actors/items are reachable',()=>{
 assert.equal(maze.MAPS.length,3);assert.equal(new Set(maze.MAPS.map(m=>m.join('\n'))).size,3);
 maze.MAPS.forEach((map,i)=>{assert.equal(map.length,11);assert.ok(map.every(r=>r.length===13));const reachable=new Set(maze.reachable(map)),open=map.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='#'?[]:[y*13+x]));assert.equal(reachable.size,open.length);const s=maze.initial(i);assert.ok(s.robots.every(r=>reachable.has(r.y*13+r.x)));assert.ok(s.lanterns.every(p=>reachable.has(p)));assert.ok(s.letters.every(p=>reachable.has(p)));assert.equal(new Set(s.letters).size,s.letters.length);});
});
test('33 a queued blocked turn is retained until a junction makes it legal',()=>{
 const s=maze.initial();s.player={x:2,y:1};s.dir='right';s.freeze=100;s.letters=[100];maze.reserve(s,'down');maze.step(s,.25);assert.deepEqual(s.player,{x:3,y:1});assert.equal(s.queued,'down');assert.equal(s.dir,'right');
 s.player={x:1,y:1};s.dir='right';maze.step(s,.25);assert.deepEqual(s.player,{x:1,y:2});assert.equal(s.dir,'down');
});
test('33 robot shortest-path tie is deterministic in the documented neighbor order',()=>{
 const map=Array.from({length:11},(_,y)=>y===0||y===10?'#############':'#...........#'),s=maze.initial();s.map=map;s.player={x:5,y:5};s.robots=[{x:4,y:4}];s.letters=[14];s.lanterns=[];s.dir=null;s.queued=null;s.immune=0;const copy=structuredClone(s);maze.step(s,1/3.2);maze.step(copy,1/3.2);assert.deepEqual(s.robots,[{x:4,y:5}]);assert.deepEqual(copy.robots,s.robots);
});
test('33 lantern makes contact harmless immediately before the damage phase',()=>{
 const s=maze.initial();s.player={x:10,y:1};s.dir='right';s.robots=[{x:11,y:1}];s.letters=[15];s.immune=0;s.freeze=0;maze.step(s,.25);assert.equal(s.lives,3);assert.equal(s.freeze,4);assert.equal(s.score,20);assert.deepEqual(s.player,{x:11,y:1});assert.equal(s.lanterns.includes(24),false);
});
test('33 damage wins over collecting the final letter and resets movement once',()=>{
 const s=maze.initial();s.player={x:1,y:1};s.dir='right';s.queued='right';s.robots=[{x:2,y:1}];s.letters=[15];s.immune=0;maze.step(s,.25);assert.equal(s.lives,2);assert.deepEqual(s.letters,[15]);assert.equal(s.score,0);assert.equal(s.done,false);assert.deepEqual(s.player,{x:1,y:1});assert.equal(s.dir,null);assert.equal(s.queued,null);assert.equal(s.playerClock,0);assert.equal(s.robotClock,0);assert.equal(s.immune,1.5);
});
test('33 a letter scores once, remaining-life bonus settles once, and completed state cannot advance',()=>{
 const s=maze.initial();s.letters=[15,16];s.freeze=100;s.dir='right';maze.step(s,.25);assert.equal(s.score,10);maze.reserve(s,'left');maze.step(s,.25);maze.reserve(s,'right');maze.step(s,.25);assert.equal(s.score,10);maze.step(s,.25);assert.equal(s.done,true);assert.equal(s.won,true);assert.equal(s.score,320);const before=JSON.stringify(s);maze.step(s,1);assert.equal(JSON.stringify(s),before);
});

test('34 wrapping and collisions use the short torus distance across both seams',()=>{
 assert.equal(asteroids.wrap(-1,800),799);assert.equal(asteroids.wrap(801,800),1);near(asteroids.torusDistance({x:1,y:1},{x:799,y:479}),Math.sqrt(8));
 const s=asteroids.initial();s.immune=100;s.rocks=[asteroids.makeRock(799,240,1,0,0,1),asteroids.makeRock(500,400,3,0,0,2)];s.bullets=[{x:1,y:240,vx:0,vy:0,life:1}];asteroids.step(s,emptyInput,1/120);assert.equal(s.score,100);assert.equal(s.rocks.some(r=>r.id===1),false);
});
test('34 released thrust retains inertia, opposing rotations cancel and speed is capped',()=>{
 const s=asteroids.initial();s.rocks=[asteroids.makeRock(500,400,3,0,0,90)];s.immune=100;for(let i=0;i<100;i++)asteroids.step(s,{...emptyInput,thrust:true},1/120);const {vx,vy,angle}=s.ship;for(let i=0;i<20;i++)asteroids.step(s,{...emptyInput,left:true,right:true},1/120);near(s.ship.vx,vx);near(s.ship.vy,vy);near(s.ship.angle,angle);for(let i=0;i<500;i++)asteroids.step(s,{...emptyInput,thrust:true},1/120);assert.ok(Math.hypot(s.ship.vx,s.ship.vy)<=240.0000001);
});
test('34 two simultaneous bullets split a parent once; new fragments cannot be hit until the next tick',()=>{
 const s=asteroids.initial();s.immune=100;s.nextId=100;s.rocks=[asteroids.makeRock(200,200,3,0,0,1)];s.bullets=[0,1].map(()=>({x:200,y:200,vx:0,vy:0,life:1}));asteroids.step(s,emptyInput,1/120);assert.equal(s.score,20);assert.equal(s.rocks.length,2);assert.ok(s.rocks.every(r=>r.size===2));assert.equal(new Set(s.rocks.map(r=>r.id)).size,2);assert.equal(s.bullets.length,1);asteroids.step(s,emptyInput,1/120);assert.equal(s.score,70);assert.equal(s.rocks.length,3);
});
test('34 seam damage consumes one life, safe respawn clears velocity and grace prevents immediate second damage',()=>{
 const s=asteroids.initial();s.ship={x:2,y:240,vx:0,vy:0,angle:0};s.rocks=[asteroids.makeRock(799,240,1,0,0,1)];s.immune=0;asteroids.step(s,emptyInput,1/120);assert.equal(s.lives,2);assert.equal(s.ship.vx,0);assert.equal(s.ship.vy,0);assert.equal(s.immune,1.5);asteroids.step(s,emptyInput,1/120);assert.equal(s.lives,2);assert.deepEqual(asteroids.safeSpawn(s.rocks),asteroids.safeSpawn(structuredClone(s.rocks)));
});
test('34 three cleared waves terminate and finished games are immutable',()=>{
 const s=asteroids.initial();s.immune=100;for(let wave=1;wave<=3;wave++){assert.equal(s.wave,wave);s.rocks=[];asteroids.step(s,emptyInput,1/120);}assert.equal(s.done,true);assert.equal(s.won,true);const before=JSON.stringify(s);asteroids.step(s,{...emptyInput,fire:true,thrust:true},1);assert.equal(JSON.stringify(s),before);
});

if(process.env.VOL2_STRATEGY_BROWSER==='1')test('29/30/31/32 maintain keyboard focus through real renders; invalid/failed guesses do not reroll the code',async()=>{
 const {chromium,webkit}=await import('@playwright/test');const {resolve}=await import('node:path');const {createGameServer}=await import('../../artifacts/g032-build/src/server/index.js');const server=createGameServer(resolve('artifacts/g032-build/public'));await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const[name,engine,width,mobile]of[['PC',chromium,1200,false],['mobileChromium',chromium,320,true],['mobileWebKit',webkit,320,true]]){
  const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();await context.addInitScript(()=>{window.__strategyRandomCalls=0;Math.random=()=>{window.__strategyRandomCalls++;return 0;};});
  async function open(id){await page.goto(`${base}/games/${id}/index.html`);await page.waitForFunction(()=>window.__vol2?.state==='ready');await page.locator('#start').click({delay:80});}
  const inBoard=()=>page.evaluate(()=>document.getElementById('board').contains(document.activeElement));
  try{
   await open('29-guess');const generated=await page.evaluate(()=>window.__strategyRandomCalls);await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).rows.length,0);assert.equal(await page.evaluate(()=>window.__strategyRandomCalls),generated);await page.locator('#board .code-input').first().locator('button').first().click({delay:80});await page.keyboard.press('1');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).guess[0],0,`${name} slot click keeps keyboard input active`);
   await page.locator('#board').focus();for(let i=0;i<4;i++)await page.keyboard.press('2');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).rows.length,1);assert.equal(await page.evaluate(()=>window.__strategyRandomCalls),generated);for(let attempt=1;attempt<8;attempt++){for(let i=0;i<4;i++)await page.keyboard.press('2');await page.keyboard.press('Enter');}assert.equal(await page.evaluate(()=>window.__vol2.state),'lost');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).rows.length,8);
   await open('30-othello');for(let i=0;i<2;i++)await page.keyboard.press('ArrowDown');for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).history,1);assert.equal(await inBoard(),true,`${name} reversi move keeps game focus`);
   await open('31-set');await page.locator('.set-card').first().focus();await page.keyboard.press('Space');assert.deepEqual((await page.evaluate(()=>window.__vol2.snapshot())).selected,[0]);assert.equal(await inBoard(),true,`${name} SET selection keeps card focus`);
   await open('32-mancala');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vol2.snapshot().animation===null);assert.equal(await inBoard(),true,`${name} sowing keeps keyboard focus`);await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.pit),'3');
  }finally{await context.close();await browser.close();}
 }}finally{await new Promise(ok=>server.close(ok));}
});
