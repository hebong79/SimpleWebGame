import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';
import {createGameServer} from '../../artifacts/g032-build/src/server/index.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out='artifacts/g033-qa-action/browser-'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir(out,{recursive:true});
const server=createGameServer(resolve('public'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const snap=p=>p.evaluate(()=>({state:window.__vol3.state,elapsed:window.__vol3.elapsed,game:window.__vol3.snapshot()}));
const results=[];
for(const [environment,engine,mobile] of [['PCChromium',chromium,false],['MobileWebKit',webkit,true]]){
 for(const id of ['55-dobble','56-rhythm-doctor','57-downwell','58-dig-dug','59-vvvvvv','60-mini-metro']){
  test(`${environment} sourceHTTP ${id}: trusted inputs pause mode reset storage 320px CSP`,async()=>{
   const browser=await engine.launch();const context=await browser.newContext({viewport:mobile?{width:320,height:760}:{width:1366,height:900},hasTouch:mobile,isMobile:mobile});const page=await context.newPage();const errors=[];let row={environment,id,checks:[]};results.push(row);
   page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('requestfailed',e=>errors.push(e.url()+': '+e.failure()?.errorText));
   if(id==='59-vvvvvv')await context.addInitScript(()=>localStorage.setItem('simplegames.vol3.59-vvvvvv.v1',JSON.stringify({version:1,wins:6,best:10,rooms:[0,1,2,3,4,5],theme:0,muted:true})));
   if(id==='55-dobble')await context.addInitScript(()=>localStorage.setItem('simplegames.vol3.55-dobble.v1','{broken'));
   try{
    const response=await page.goto(origin+'/games/'+id+'/index.html');assert.equal(response.status(),200);assert.match(response.headers()['content-security-policy'],/script-src 'self'/);await page.waitForFunction(()=>!!window.__vol3);assert.equal((await snap(page)).state,'ready');
    await page.locator('#start').click({delay:80});assert.equal((await snap(page)).state,'playing');row.checks.push('strict sourceHTTP and80ms start');
    if(id==='55-dobble'){
      const pick=await page.evaluate(async()=>{const{DECK}=await import('./engine.mjs');const s=window.__vol3.snapshot();return DECK[s.right].findIndex(x=>DECK[s.left].includes(x));});await page.locator(`button[data-slot="${pick}"]`).click({delay:80});assert.equal((await snap(page)).game.score,1);await page.locator('#board').focus();await page.keyboard.press(String(pick+1),{delay:80});assert.ok((await snap(page)).game.attempts>=2);
    } else if(id==='56-rhythm-doctor'){
      await page.getByRole('button',{name:'♥ 신호 복구',exact:true}).click({delay:80});assert.match((await snap(page)).game.last,/빈 박/);await page.locator('#board').focus();await page.keyboard.press(' ',{delay:80});assert.equal((await snap(page)).game.combo,0);
    } else if(id==='57-downwell'){
      const initial=await snap(page);await page.getByRole('button',{name:'오른쪽 →',exact:true}).click({delay:80});assert.ok((await snap(page)).game.x>initial.game.x);await page.locator('#board').focus();const before=await snap(page);await page.keyboard.down('ArrowRight');await page.keyboard.down(' ');await page.waitForTimeout(80);await page.keyboard.up(' ');await page.keyboard.up('ArrowRight');const after=await snap(page);assert.ok(after.game.x>before.game.x);assert.ok(after.game.ammo<before.game.ammo||after.game.onGround);row.checks.push('simultaneous trusted keyboard move+pulse');
    } else if(id==='58-dig-dug'){
      const before=await snap(page);await page.getByRole('button',{name:'→',exact:true}).click({delay:80});assert.ok((await snap(page)).game.x>before.game.x);await page.locator('#board').focus();await page.keyboard.press('ArrowDown',{delay:80});assert.equal((await snap(page)).game.dir,'down');
    } else if(id==='59-vvvvvv'){
      await page.getByRole('button',{name:'중력 반전 ↕',exact:true}).click({delay:80});assert.equal((await snap(page)).game.gravity,-1);await page.locator('#board').focus();await page.keyboard.press(' ',{delay:80});assert.equal((await snap(page)).game.gravity,-1);
    } else {
      await page.getByRole('button',{name:'청록 실선 노선 편집',exact:true}).click({delay:80});assert.equal((await snap(page)).game.editing.line,0);const frozen=await snap(page);await page.waitForTimeout(180);assert.equal((await snap(page)).game.time,frozen.game.time);await page.locator('#board').focus();await page.keyboard.press('1',{delay:80});assert.ok(!(await snap(page)).game.editing.draft.includes(0));await page.getByRole('button',{name:'편집 취소',exact:true}).click({delay:80});
    }
    row.checks.push('pointer80ms and keyboard game input');
    await page.locator('#pause').click({delay:80});const frozen=await snap(page);await page.waitForTimeout(180);assert.deepEqual(await snap(page),frozen);row.checks.push('pause freezes game and clock');
    const selector={
      '55-dobble':'기본 · 크기와 회전','56-rhythm-doctor':'2 · 빠른 수리','58-dig-dug':'2 · 갈림길 진드기','59-vvvvvv':'2 · 엇갈린 정비선'
    }[id];
    if(selector){
      await page.getByRole('button',{name:selector,exact:true}).click({delay:80});assert.equal(await page.locator('#modal').isVisible(),true);assert.deepEqual((await snap(page)).game,frozen.game);await page.getByRole('button',{name:'닫기',exact:true}).click({delay:80});assert.deepEqual((await snap(page)).game,frozen.game);assert.equal((await snap(page)).state,'paused');
      await page.getByRole('button',{name:selector,exact:true}).click({delay:80});await page.getByRole('button',{name:'새 문제 시작',exact:true}).click({delay:80});const changed=await snap(page);assert.equal(changed.state,'playing');assert.ok(changed.game.time<1);if(id==='55-dobble'){assert.equal(changed.game.mode,'varied');assert.equal(changed.game.score,0);}if(id==='56-rhythm-doctor'){assert.equal(changed.game.loop,1);assert.equal(changed.game.beat,60/112);}if(id==='58-dig-dug')assert.equal(changed.game.level,1);if(id==='59-vvvvvv')assert.equal(changed.game.room,1);row.checks.push('paused selection cancel preserves old state; confirm resets real selected mode');
    } else {await page.locator('#pause').click({delay:80});assert.equal((await snap(page)).state,'playing');}
    await page.locator('#help').click({delay:80});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal((await snap(page)).state,'paused');row.checks.push('help keyboard focus protection');
    await page.setViewportSize({width:320,height:760});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const tooSmall=await page.locator('.actions button,.touch-controls button,.level-picker button,.route-edit button,.specimen-card button').evaluateAll(nodes=>nodes.filter(n=>!n.hidden&&n.getBoundingClientRect().width&&n.getBoundingClientRect().height<44).map(n=>n.textContent));assert.deepEqual(tooSmall,[]);row.checks.push('320px no overflow; primary buttons >=44px');
    if(!mobile)await page.screenshot({path:out+'/'+id+'-320.png',fullPage:true});
    await page.getByRole('button',{name:'소리 꺼짐',exact:true}).click({delay:80});const record=await page.evaluate(id=>JSON.parse(localStorage.getItem('simplegames.vol3.'+id+'.v1')),id);assert.equal(record.muted,false);row.checks.push('record writes after corrupt/default storage');
    await page.locator('.home-link').click({delay:80});assert.equal(new URL(page.url()).pathname,'/');assert.deepEqual(errors,[]);row.checks.push('home return and runtime/CSP errors0');row.status='PASS';
   }catch(e){row.status='FAIL';row.error=e.stack;row.errors=errors;throw e;}finally{await context.close();await browser.close();await writeFile(out+'/results.json',JSON.stringify({origin,results},null,2));}
  });
 }
}
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));console.log('Evidence '+out);});
for(const [environment,engine,mobile] of [['PCChromium',chromium,false],['MobileWebKit',webkit,true]])test(`${environment} storage denied continues active game and writes warning`,async()=>{const browser=await engine.launch();const context=await browser.newContext({viewport:{width:320,height:760},isMobile:mobile,hasTouch:mobile});await context.addInitScript(()=>Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Test blocked','QuotaExceededError');}}));const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});try{await page.goto(origin+'/games/56-rhythm-doctor/index.html');await page.waitForFunction(()=>!!window.__vol3);await page.locator('#start').click({delay:80});await page.getByRole('button',{name:'보정 +20ms',exact:true}).click({delay:80});assert.equal((await snap(page)).state,'playing');assert.equal((await snap(page)).game.offset,.02);assert.equal(await page.locator('#storage-warning').isVisible(),true);await page.locator('#board').focus();await page.keyboard.press(' ',{delay:80});assert.equal((await snap(page)).game.last,'빈 박 입력 · 연속 기록 초기화');assert.deepEqual(errors,[]);}finally{await context.close();await browser.close();}});
