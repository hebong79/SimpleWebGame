import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {chromium,webkit} from '@playwright/test';
import {createGameServer} from '../../artifacts/g032-build/src/server/index.js';
import {solve} from '../../public/games/53-rush-hour/engine.mjs';
const snap=page=>page.evaluate(()=>({mode:window.__vol3.state,game:window.__vol3.snapshot()}));
for(const[environment,engine,mobile]of[['desktop',chromium,false],['mobile-webkit',webkit,true]])test(`51–54 source HTTP trusted input ${environment}`,{timeout:120000},async()=>{
 const server=createGameServer(resolve('public'));await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:950},hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 async function open(id){await page.goto(`${origin}/games/${id}/index.html`);await page.waitForFunction(()=>!!window.__vol3);assert.equal((await snap(page)).mode,'ready');await page.locator('#start').click({delay:80});assert.equal((await snap(page)).mode,'playing');}
 async function pauseAndFit(){if((await snap(page)).mode==='playing'){await page.locator('#pause').click({delay:80});const before=await snap(page);await page.waitForTimeout(100);assert.deepEqual(await snap(page),before);await page.locator('#pause').click({delay:80});assert.equal((await snap(page)).mode,'playing');}await page.setViewportSize({width:320,height:720});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize(mobile?{width:390,height:844}:{width:1366,height:950});}
 try{
  await open('51-nim');assert.equal((await snap(page)).game.state.turn,0);
  await page.locator('.pile').nth(1).focus();await page.keyboard.press('Enter',{delay:80});assert.equal((await snap(page)).game.pile,1);assert.equal((await snap(page)).game.state.turns,0);
  for(const [pile,n]of [[0,3],[1,5],[2,7]]){await page.locator('.pile').nth(pile).click({delay:80});await page.locator('.count').nth(n-1).click({delay:80});await page.getByRole('button',{name:`${n}개 가져오기 확인`,exact:true}).click({delay:80});}
  assert.equal((await snap(page)).mode,'won');assert.equal((await snap(page)).game.state.winner,0);await page.locator('#start').click({delay:80});assert.equal((await snap(page)).game.state.turn,1);await pauseAndFit();
  await open('52-abalone');await page.locator('[data-cell="0,-2"]').click({delay:80});assert.ok((await snap(page)).game.legal.includes(1));await page.getByRole('button',{name:'2 ↘',exact:true}).click({delay:80});assert.equal((await snap(page)).game.state.board['0,-1'],1);assert.equal((await snap(page)).game.state.turn,1);await pauseAndFit();
  await open('53-rush-hour');await page.locator('#pause').click({delay:80});await page.locator('.level-picker button').nth(7).click({delay:80});await page.getByRole('button',{name:'새 문제 시작',exact:true}).click({delay:80});
  for(const[id,d]of solve(7).path){const vehicle=(await snap(page)).game.state.cars.find(v=>v.id===id);await page.getByRole('button',{name:new RegExp(` ${id} 차량$`)}).first().click({delay:80});await page.locator('#board').focus();const direction=vehicle.axis==='h'?(d>0?'ArrowRight':'ArrowLeft'):(d>0?'ArrowDown':'ArrowUp');for(let i=0;i<Math.abs(d);i++)await page.keyboard.press(direction,{delay:80});await page.keyboard.press('Enter',{delay:80});}
  assert.equal((await snap(page)).mode,'won');assert.equal((await snap(page)).game.state.moves,solve(7).moves);await pauseAndFit();
  await open('54-quoridor');await page.getByRole('button',{name:'6행 4열 이동 가능',exact:true}).focus();await page.keyboard.press('Enter',{delay:80});assert.deepEqual((await snap(page)).game.state.pawns[0],[5,3]);await page.getByRole('button',{name:'▰ 울타리',exact:true}).click({delay:80});await page.locator('[data-cell="16"]').click({delay:80});assert.equal((await snap(page)).game.pending.r,2);await page.getByRole('button',{name:'울타리 설치 확인',exact:true}).click({delay:80});assert.equal((await snap(page)).game.state.walls.length,1);assert.deepEqual((await snap(page)).game.state.remaining,[6,5]);await pauseAndFit();
  assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
