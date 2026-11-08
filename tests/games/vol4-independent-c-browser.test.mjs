import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
import {createGameServer} from '../../artifacts/g033-final-build/src/server/index.js';
import {resolve} from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
const out='artifacts/g034-qa-c';fs.mkdirSync(out,{recursive:true});
const games=['76-ricochet-robots','77-onitama','78-hanabi','79-love-letter','80-cant-stop'];
const click=locator=>locator.click({delay:80});
const snap=page=>page.evaluate(()=>window.__vol4.snapshot());
const state=page=>page.evaluate(()=>window.__vol4.state);
const checks=[];
function record(name,detail){checks.push({name,...detail});}
async function tabActivate(page,key){
  for(let i=0;i<180;i++){
    if(await page.evaluate(k=>document.activeElement?.dataset.focus===k,key)){await page.keyboard.press('Enter',{delay:80});return;}
    await page.keyboard.press('Tab');
  }
  assert.fail(`Tab target ${key} unreachable`);
}
async function firstAction(page,id){
  if(id.startsWith('76')){await page.locator('#board').focus();await page.keyboard.press('ArrowUp',{delay:80});assert.equal((await snap(page)).moves,1);}
  if(id.startsWith('77')){await page.locator('#board').focus();await tabActivate(page,'card1');assert.equal((await snap(page)).cardSlot,1);await click(page.locator('[data-focus=cell20]'));await click(page.locator('[data-focus=cell16]'));assert.equal((await snap(page)).turns,1);}
  if(id.startsWith('78')){await click(page.locator('[data-focus=reveal]'));await page.locator('#board').focus();await tabActivate(page,'discard');assert.equal((await snap(page)).turns,1);}
  if(id.startsWith('79')){await click(page.locator('[data-focus=reveal]'));await page.locator('#board').focus();await tabActivate(page,'play');assert.equal((await snap(page)).turns,1);}
  if(id.startsWith('80')){await page.locator('#board').focus();await tabActivate(page,'roll');assert.equal((await snap(page)).phase,'choose');await click(page.locator('[data-focus=pair0]'));assert.equal((await snap(page)).phase,'decide');assert.equal((await snap(page)).temp[2],2);}
}
async function privacy(page,id){
  let s=await snap(page);
  if(id.startsWith('78')){
    assert.equal(s.revealed,false);assert.ok(s.hands.flat().every(c=>!('n'in c)&&!('color'in c)));
    await click(page.locator('[data-focus=reveal]'));s=await snap(page);
    assert.ok(s.hands[s.turn].every(c=>!('color'in c)&&!('n'in c)));
    assert.ok(s.hands[1-s.turn].every(c=>Number.isInteger(c.n)&&Number.isInteger(c.color)));
    const own=await page.locator('.c-card.back').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,html:n.outerHTML,attrs:[...n.attributes].map(a=>[a.name,a.value])})));
    assert.equal(own.length,3);for(const n of own){assert.match(n.text,/^\?\s*내 카드/);assert.doesNotMatch(n.html,/data-(color|value|number)|title=|aria-label=.*[◆●▲]/);assert.ok(!n.text.includes('A◆')&&!n.text.includes('B●')&&!n.text.includes('C▲'));}
    await click(page.locator('#pause'));s=await snap(page);assert.equal(s.revealed,false);assert.ok(s.hands.flat().every(c=>!('n'in c)&&!('color'in c)));assert.equal(await page.locator('.c-card.back').count(),0);
    await click(page.locator('#pause'));
  }
  if(id.startsWith('79')){
    assert.equal(s.pending,true);assert.equal(s.peek,2);assert.deepEqual(s.hands[1],[null]);assert.equal('removed'in s,false);assert.equal('deck'in s,false);
    assert.equal(await page.getByRole('heading',{name:'현재 플레이어에게만 보이는 열람',exact:true}).count(),1);
    await click(page.locator('#pause'));s=await snap(page);assert.equal(s.peek,null);assert.ok(s.hands.flat().every(c=>c===null));assert.equal(await page.getByRole('heading',{name:'현재 플레이어에게만 보이는 열람',exact:true}).count(),0);
    await click(page.locator('#pause'));await click(page.locator('[data-focus=reveal]'));assert.equal((await snap(page)).peek,2);
    await click(page.locator('[data-focus=ack]'));s=await snap(page);assert.equal(s.turn,1);assert.equal(s.peek,null);assert.equal(s.revealed,false);assert.ok(s.hands.flat().every(c=>c===null));
    assert.equal(await page.locator('[data-focus=own0]').count(),0);
  }
}

test('independent C HTTP: PC Chromium and 320px mobile WebKit, all games; strict unfiltered errors', {timeout:240000},async t=>{
  const server=createGameServer(resolve('public'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const manifest=[];
  try{
    for(const id of games)for(const name of ['index.html','engine.mjs','main.mjs']){
      const url=`/games/${id}/${name}`,r=await fetch(base+url),bytes=Buffer.from(await r.arrayBuffer()),local=fs.readFileSync('public'+url);assert.equal(r.status,200);assert.deepEqual(bytes,local);assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);manifest.push({url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),csp:r.headers.get('content-security-policy')});
    }
    fs.writeFileSync(`${out}/http-manifest.json`,JSON.stringify(manifest,null,2));
    for(const [environment,engine,mobile]of [['pc-chromium',chromium,false],['mobile-webkit',webkit,true]]){
      const browser=await engine.launch();
      try{for(const id of games){await t.test(`${environment} ${id}`,{timeout:45000},async()=>{
        const context=await browser.newContext({viewport:mobile?{width:320,height:760}:{width:1366,height:950},isMobile:mobile,hasTouch:mobile});
        await context.addInitScript(()=>{Math.random=()=>0.3;});const page=await context.newPage(),errors=[],responses=[];
        page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text()});});page.on('pageerror',e=>errors.push({kind:'pageerror',message:e.message}));page.on('requestfailed',r=>errors.push({kind:'requestfailed',url:r.url(),message:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)errors.push({kind:'http',status:r.status(),url:r.url()});responses.push(r.url());});
        await page.addInitScript(()=>{window.__qaTrusted=[];document.addEventListener('click',e=>window.__qaTrusted.push({type:'click',trusted:e.isTrusted,t:performance.now()}),true);document.addEventListener('keydown',e=>window.__qaTrusted.push({type:'key',key:e.key,trusted:e.isTrusted,t:performance.now()}),true);});
        try{
          await page.goto(`${base}/games/${id}/index.html`);await page.waitForFunction(()=>!!window.__vol4);assert.equal(await state(page),'ready');
          const before=await snap(page);await click(page.locator('#start'));assert.equal(await state(page),'playing');await firstAction(page,id);assert.notDeepEqual(await snap(page),before);
          await privacy(page,id);
          const gameBeforePause=await snap(page);await click(page.locator('#pause'));assert.equal(await state(page),'paused');const frozen=JSON.stringify(await page.evaluate(()=>[window.__vol4.snapshot(),window.__vol4.elapsed]));await page.waitForTimeout(130);assert.equal(JSON.stringify(await page.evaluate(()=>[window.__vol4.snapshot(),window.__vol4.elapsed])),frozen);
          await click(page.locator('#restart'));assert.match(await page.locator('#modal').textContent(),/현재 판/);await page.keyboard.press('Escape',{delay:80});assert.equal(await state(page),'paused');
          // Privacy curtain may hide views after pause; actual public game counters stay intact.
          const afterCancel=await snap(page);for(const k of ['moves','turns','phase','level','set'])if(k in gameBeforePause)assert.deepEqual(afterCancel[k],gameBeforePause[k]);
          await click(page.locator('#pause'));assert.equal(await state(page),'playing');
          if(id.startsWith('76')||id.startsWith('77')){
            const field=id.startsWith('76')?'level':'set',target=id.startsWith('76')?'next':'set1',old=(await snap(page))[field];await click(page.locator(`[data-focus=${target}]`));await page.keyboard.press('Escape',{delay:80});assert.equal((await snap(page))[field],old);await click(page.locator('#pause'));await click(page.locator(`[data-focus=${target}]`));await click(page.getByRole('button',{name:'새 문제 시작',exact:true}));assert.equal((await snap(page))[field],1);
          }
          await click(page.locator('#restart'));await click(page.locator('#confirm-restart'));assert.equal(await state(page),'playing');
          const restarted=await snap(page);if(id.startsWith('76'))assert.equal(restarted.moves,0);else if(id.startsWith('80'))assert.equal(restarted.phase,'roll');else assert.equal(restarted.turns,0);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          const small=await page.locator('button:visible').evaluateAll(ns=>ns.filter(n=>{const b=n.getBoundingClientRect();return b.width<43.9||b.height<43.9;}).map(n=>({text:n.textContent,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));assert.deepEqual(small,[]);
          assert.equal(await page.locator('a.home-link').getAttribute('href'),'/');
          const trust=await page.evaluate(()=>window.__qaTrusted);assert.ok(trust.filter(x=>x.type==='click'||x.type==='key').every(x=>x.trusted));assert.ok(trust.some(x=>x.type==='key'&&x.key==='Tab')||id.startsWith('76'));
          if(!mobile)await page.screenshot({path:`${out}/${environment}-${id}.png`,fullPage:true});
          assert.deepEqual(errors,[]);record(environment+' '+id,{status:'PASS',trustedEvents:trust.length,errors,responses:responses.length});
        }catch(e){record(environment+' '+id,{status:'FAIL',error:e.stack,errors});throw e;}finally{await context.close();}
      });}}
      finally{await browser.close();}
    }
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify(checks,null,2));}
});

test('independent C storage: corrupt/blocked fallback plus exact 76 and 77 unlock ownership', {timeout:180000},async t=>{
  const server=createGameServer(resolve('public'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch();
  try{
    for(const mode of ['corrupt','blocked'])for(const id of games)await t.test(mode+' '+id,async()=>{
      const context=await browser.newContext();await context.addInitScript(({mode,id})=>{if(mode==='blocked'){Storage.prototype.getItem=()=>{throw Error('qa read blocked');};Storage.prototype.setItem=()=>{throw Error('qa write blocked');};}else localStorage.setItem('simplegames.vol4.'+id+'.v1','{broken');},{mode,id});const page=await context.newPage();try{await page.goto(base+'/games/'+id+'/index.html');await page.waitForFunction(()=>window.__vol4);await click(page.locator('#start'));assert.equal(await state(page),'playing');assert.equal(await page.locator('#storage-warning').isVisible(),true);await click(page.locator('#mute'));assert.equal(await state(page),'playing');}finally{await context.close();}
    });
    for(const [id,fixtures]of [['76-ricochet-robots',[[{wins:999,completed:[0,0,1,'2',9],theme:2},[true,false,false],0],[{wins:0,completed:[0,1,2,3],theme:1},[true,true,false],1],[{wins:0,completed:[0,1,2,3,4,5,6,7],theme:2},[true,true,true],2]]],['77-onitama',[[{wins:2,theme:1},[true,false,false],0],[{wins:3,theme:1},[true,true,false],1],[{wins:7,theme:2},[true,true,false],0],[{wins:8,theme:2},[true,true,true],2]]]])for(const[raw,enabled,variant]of fixtures)await t.test(`${id} unlock ${JSON.stringify(raw)}`,async()=>{
      const context=await browser.newContext();await context.addInitScript(({id,raw})=>{localStorage.setItem('simplegames.vol4.'+id+'.v1',JSON.stringify({version:1,best:0,muted:true,...raw}));localStorage.setItem('simplegames.vol4.sibling.v1','preserve sibling');},{id,raw});const page=await context.newPage();try{await page.goto(base+'/games/'+id+'/index.html');await page.waitForFunction(()=>window.__vol4);assert.equal(await page.locator('body').getAttribute('data-variant'),String(variant));await click(page.locator('#wardrobe'));const flags=await page.locator('#modal button:not(.modal-close)').evaluateAll(ns=>ns.map(n=>!n.disabled));assert.deepEqual(flags,enabled);await page.keyboard.press('Escape');await click(page.locator('#start'));await click(page.locator('#mute'));assert.equal(await page.evaluate(()=>localStorage.getItem('simplegames.vol4.sibling.v1')),'preserve sibling');}finally{await context.close();}
    });
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
