import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createGameServer} from '../../artifacts/g033-final-build/src/server/index.js';
import {resolve} from 'node:path';
import fs from 'node:fs';
import * as R from '../../public/games/76-ricochet-robots/engine.mjs';
const directions=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'];
// Separate BFS oracle deliberately does not call production movement/search.
function search(level){const delta=[-7,1,7,-1],queue=[level.robots],seen=new Map([[level.robots.join(','),null]]);for(let q=0;q<queue.length;q++){const positions=queue[q],key=positions.join(',');if(positions[level.robot]===level.target){const path=[];let k=key;while(seen.get(k)){const p=seen.get(k);path.push(p.move);k=p.prev;}return path.reverse();}for(let r=0;r<3;r++)for(let d=0;d<4;d++){let end=positions[r];while(true){let n=end+delta[d];if(n<0||n>=49||d===1&&n%7===0||d===3&&end%7===0||positions.includes(n)||level.walls.some(x=>{const[a,b]=x.split(':').map(Number);return a===end&&b===n||a===n&&b===end;}))break;end=n;}if(end===positions[r])continue;const p=[...positions];p[r]=end;const k=p.join(',');if(!seen.has(k)){seen.set(k,{prev:key,move:[r,d]});queue.push(p);}}}return null;}
test('independent 76 HTTP trusted full eight-board clears and duplicate ownership', {timeout:120000},async()=>{
  const server=createGameServer(resolve('public'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();const page=await browser.newPage(),errors=[],holds=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.failure()?.errorText));
  await page.addInitScript(()=>{window.__qaKeys=[];for(const type of ['keydown','keyup'])document.addEventListener(type,e=>window.__qaKeys.push({type,key:e.key,t:performance.now(),trusted:e.isTrusted}),true);});
  try{
    await page.goto(base+'/games/76-ricochet-robots/index.html');await page.waitForFunction(()=>window.__vol4);await page.locator('#start').click({delay:80});
    const solveUI=async level=>{const path=search(R.LEVELS[level]);assert.ok(path?.length);for(const[r,d]of path){await page.locator('#board').focus();await page.keyboard.press(String(r+1),{delay:80});await page.keyboard.press(directions[d],{delay:80});}assert.equal(await page.evaluate(()=>window.__vol4.state),'won');return path;};
    const run=[];run.push({level:1,path:await solveUI(0)});
    await page.locator('#start').click({delay:80});await solveUI(0);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('simplegames.vol4.76-ricochet-robots.v1')).completed),[0]);
    for(let level=1;level<8;level++){await page.locator('[data-focus=next]').click({delay:80});run.push({level:level+1,path:await solveUI(level)});const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('simplegames.vol4.76-ricochet-robots.v1')));assert.equal(record.completed.length,level+1);}
    await page.locator('#wardrobe').click({delay:80});assert.deepEqual(await page.locator('#modal button:not(.modal-close)').evaluateAll(ns=>ns.map(n=>!n.disabled)),[true,true,true]);
    const keyEvents=await page.evaluate(()=>window.__qaKeys);for(let i=0;i<keyEvents.length-1;i++){const a=keyEvents[i],b=keyEvents[i+1];if(a.type==='keydown'&&b.type==='keyup'&&a.key===b.key)holds.push({key:a.key,ms:b.t-a.t,trusted:a.trusted&&b.trusted});}assert.ok(holds.length>100);assert.ok(holds.every(h=>h.trusted&&h.ms>=70));assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/g034-qa-c/76-ui-eight-completions.json',JSON.stringify({run,holds,minHoldMs:Math.min(...holds.map(h=>h.ms)),errors},null,2));
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
