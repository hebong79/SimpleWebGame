import test from 'node:test';
import assert from 'node:assert/strict';
import * as pattern from '../../public/games/21-pattern/engine.mjs';
import * as solo from '../../public/games/22-solo/engine.mjs';
import * as net from '../../public/games/23-net/engine.mjs';
import * as bridges from '../../public/games/24-bridges/engine.mjs';
import * as light from '../../public/games/25-lightup/engine.mjs';
import * as tents from '../../public/games/26-tents/engine.mjs';
import * as slant from '../../public/games/27-slant/engine.mjs';

test('21 consecutive groups 1,2 distinguish a separating space',()=>{assert.deepEqual(pattern.runs([1,0,1,1,0]),[1,2]);assert.notDeepEqual(pattern.runs([1,1,1,0,0]),[1,2]);});
test('21 row match alone does not pass when a column differs',()=>{const level={n:2,clues:{rows:[[1],[1]],cols:[[2],[0]]}};assert.equal(pattern.valid([1,0,0,1],level),false);});
for(const [i,level]of pattern.LEVELS.entries())test(`21 postcard ${i+1} has one solution, correct size and a distinct image`,()=>{assert.equal(level.n,i<4?5:7);assert.equal(pattern.solve(level,2).length,1);assert.equal(pattern.valid(level.solution,level),true);assert.equal(pattern.LEVELS.filter(l=>l.solution.join('')===level.solution.join('')).length,1);});
for(const [i,level]of solo.LEVELS.entries())test(`22 notebook ${i+1} has one valid solution with immutable clues`,()=>{assert.equal(solo.solve(level.givens).length,1);assert.equal(solo.valid(level.solution),true);const clue=level.givens.findIndex(Boolean),next=solo.write(level.solution,level.givens,clue,0);assert.strictEqual(next,level.solution);});
test('22 a Latin square with block duplicates fails',()=>{assert.equal(solo.valid([1,2,3,4,2,3,4,1,3,4,1,2,4,1,2,3]),false);});
test('22 writes reject out of range values and preserve other cells',()=>{const g=Array(16).fill(0),b=[...g];assert.strictEqual(solo.write(b,g,0,5),b);const v=solo.write(b,g,0,3);assert.equal(v[0],3);assert.equal(b[0],0);});
for(const [i,level]of net.LEVELS.entries())test(`23 circuit ${i+1} solves as a tree with symmetric rotations normalized`,()=>{assert.equal(net.inspect(level.solution,level.n).won,true);assert.notDeepEqual(level.board,level.solution);assert.ok(net.solve(level,1).length===1);level.board.forEach(m=>{assert.equal(net.rotate(net.rotate(net.rotate(net.rotate(m)))),m);assert.equal(m.toString(2).replaceAll('0','').length,net.rotate(m).toString(2).replaceAll('0','').length);});});
test('23 no wrap across edges and exposed ports prevent success',()=>{assert.equal(net.inspect([8,2,8,2],2).seen.size,1);assert.equal(net.inspect([8,2,8,2],2).won,false);assert.equal(net.inspect([6,12,3,9],2).won,false);});
test('23 source is centered in even and odd boards and disconnected power reach starts there',()=>{assert.equal(net.sourceIndex(4),10);assert.equal(net.sourceIndex(5),12);assert.deepEqual([...net.inspect(Array(16).fill(0),4).seen],[10]);});
for(const [i,level]of bridges.LEVELS.entries())test(`24 archipelago ${i+1} known solution and independent solver`,()=>{assert.equal(bridges.inspect(level,level.solution).won,true);assert.ok(bridges.solve(level,1).length>0);assert.ok(level.nodes.length>=5&&level.nodes.length<=10);});
test('24 disconnected degree-perfect islands fail',()=>{const level={nodes:[{x:0,y:0,target:1},{x:1,y:0,target:1},{x:0,y:2,target:1},{x:1,y:2,target:1}],edges:[[0,1],[2,3]]};const s=bridges.inspect(level,[1,1]);assert.deepEqual(s.degrees,[1,1,1,1]);assert.equal(s.won,false);});
test('24 crossing is prohibited, intermediate island blocks, third bridge cycles to zero',()=>{const nodes=[{x:0,y:1,target:2},{x:2,y:1,target:2},{x:1,y:0,target:2},{x:1,y:2,target:2}];assert.equal(bridges.cross(nodes,[0,1],[2,3]),true);const level={nodes,edges:[[0,1],[2,3]]};assert.deepEqual(bridges.cycle(level,[1,0],1),[1,0]);assert.deepEqual(bridges.cycle(level,[2,0],0),[0,0]);assert.deepEqual(bridges.neighbors([{x:0,y:0},{x:1,y:0},{x:2,y:0}]),[[0,1],[1,2]]);});
for(const [i,level]of light.LEVELS.entries())test(`25 night lane ${i+1} has a satisfying lamp placement`,()=>{assert.equal(level.n,i<4?5:7);assert.equal(light.inspect(level,level.solution).won,true);assert.notDeepEqual(level.walls,light.LEVELS[(i+1)%8].walls);});
test('25 walls block lamp vision and diagonal bulbs do not count for numbered wall',()=>{const level={n:3,walls:[-2,1,-2,-1,-1,-1,-2,-1,-2]},board=[1,0,0,0,0,0,1,0,1];const state=light.inspect(level,board);assert.equal(state.bad.size,0);assert.equal(state.counts.get(1),1);assert.equal(state.lit.has(8),true);const diagonal={n:3,walls:[-2,-2,-2,-2,0,-2,-2,-2,-2]};assert.equal(light.inspect(diagonal,[1,0,0,0,0,0,0,0,0]).counts.get(4),0);});
test('25 mutually visible lamps remain placed and are both marked invalid',()=>{const l={n:2,walls:[-2,-2,-2,-2]},b=[1,1,0,0];const c=light.inspect(l,b);assert.deepEqual([...c.bad].sort(),[0,1]);assert.equal(c.won,false);assert.deepEqual(b,[1,1,0,0]);});
for(const [i,level]of tents.LEVELS.entries())test(`26 campsite ${i+1} satisfies rows, columns, matching, separation`,()=>{assert.equal(tents.inspect(level,level.solution).won,true);assert.equal(level.trees.length,4);assert.equal(level.solution.filter(v=>v===1).length,4);});
test('26 local adjacency is insufficient without one-to-one matching',()=>{assert.equal(tents.match([1,24],[0,2],5),false);assert.equal(tents.match([1,3],[0,2],5),true);});
test('26 diagonal tents touch even when each has a tree',()=>{const level={n:3,trees:[1,7],rows:[1,1,0],cols:[1,1,0]};assert.equal(tents.inspect(level,[1,0,0,0,1,0,0,0,0]).bad.size,2);});
for(const [i,level]of slant.LEVELS.entries())test(`27 roof ${i+1} is acyclic and uniquely determined`,()=>{assert.equal(level.n,i<3?4:5);assert.equal(slant.inspect(level,level.solution).won,true);assert.equal(slant.solve(level).length,1);});
test('27 a star junction is not a cycle but closed diamond is',()=>{const level={n:2,clues:Array(9).fill(-1)};assert.equal(slant.inspect(level,[1,2,2,1]).loop,false);assert.equal(slant.inspect(level,[2,1,1,2]).loop,true);assert.equal(slant.inspect(level,[0,0,0,0]).won,false);});

if(process.argv.includes('--browser'))test('21~27 actual HTTP input, solve, persistence, pause and mobile layout in Chromium/WebKit',async()=>{
 const {chromium,webkit}=await import('@playwright/test');
 const {createGameServer}=await import('../../artifacts/g032-build/src/server/index.js');
 const {resolve}=await import('node:path');
 const server=createGameServer(resolve('artifacts/g032-build/public'));
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const base=`http://127.0.0.1:${server.address().port}`;
 const games=[['21-pattern',pattern],['22-solo',solo],['23-net',net],['24-bridges',bridges],['25-lightup',light],['26-tents',tents],['27-slant',slant]];
 let checks=0;
 try{for(const [name,engine,width,mobile]of[['PC',chromium,1200,false],['mobile-chromium',chromium,320,true],['mobile-webkit',webkit,320,true]]){
  const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:{width,height:900},isMobile:mobile,hasTouch:mobile});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{for(const [id,module]of games){
   await page.goto(`${base}/games/${id}/index.html`);await page.waitForFunction(()=>window.__vol2?.state==='ready');await page.locator('#start').click({delay:80});assert.equal(await page.evaluate(()=>window.__vol2.state),'playing');checks++;
   await page.locator('#pause').click({delay:80});await page.locator('#board').focus();const paused=await page.evaluate(()=>window.__vol2.snapshot());await page.keyboard.press('Enter');await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>window.__vol2.snapshot()),paused);checks++;
   await page.locator('#pause').click({delay:80});await page.locator('#board').focus();const initial=module.LEVELS[0];
   if(id==='21-pattern'){
    await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).board[2],1);await page.locator('#undo').click({delay:80});assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).board[2],0);checks++;
    for(let i=0;i<initial.solution.length;i++)if(initial.solution[i])await page.locator(`.puzzle-cell[data-index="${i}"]`).click({delay:80});
   }else if(id==='22-solo'){
    for(let i=0;i<16;i++)if(!initial.givens[i]){await page.locator(`.puzzle-cell[data-index="${i}"]`).click({delay:80});await page.keyboard.press(String(initial.solution[i]));}
   }else if(id==='23-net'){
    for(let i=0;i<initial.board.length;i++){let v=initial.board[i],count=0;while(v!==initial.solution[i]&&count<4){v=net.rotate(v);count++;}for(let k=0;k<count;k++)await page.locator(`.puzzle-cell[data-index="${i}"]`).click({delay:80});}
   }else if(id==='24-bridges'){
    for(let e=0;e<initial.edges.length;e++)for(let k=0;k<initial.solution[e];k++){const[a,b]=initial.edges[e];await page.locator('.island-choices button').nth(a).click({delay:80});await page.locator('.island-choices button').nth(b).click({delay:80});}
   }else if(id==='25-lightup'||id==='26-tents'){
    for(let i=0;i<initial.solution.length;i++)if(initial.solution[i]===1)await page.locator(`.puzzle-cell[data-index="${i}"]`).click({delay:80});
   }else{
    for(let i=0;i<initial.solution.length;i++)for(let k=0;k<initial.solution[i];k++)await page.locator(`.puzzle-cell[data-index="${i}"]`).click({delay:80});
   }
   assert.equal(await page.evaluate(()=>window.__vol2.state),'won',`${name} ${id} completes`);checks++;
   assert.ok(await page.evaluate(id=>JSON.parse(localStorage.getItem(`simplegames.vol2.${id}.v1`)).completed.includes(0),id));checks++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${name} ${id} viewport fits`);checks++;
   for(let k=1;k<module.LEVELS.length;k++)await page.getByRole('button',{name:'다음 문제 →',exact:true}).click({delay:80});await page.locator('#start').click({delay:80});assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).level,module.LEVELS.length-1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
   await page.reload();await page.waitForFunction(()=>window.__vol2?.state==='ready');assert.equal((await page.evaluate(()=>window.__vol2.snapshot())).level,module.LEVELS.length-1);checks++;
   console.log(`BROWSER ${name} ${id} PASS`);
  }assert.deepEqual(errors,[],`${name} console/runtime/CSP errors`);checks++;}finally{await context.close();await browser.close();}
 }}finally{await new Promise(ok=>server.close(ok));}
 console.log(`LOGIC_BROWSER_CHECKS ${checks}`);
});
