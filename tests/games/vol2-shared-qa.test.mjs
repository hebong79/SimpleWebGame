import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';

// Independent shell fixture: no game engine or builder-authored QA is reused.
const fixture = `import {mount,button} from './shared.mjs';
mount({id:'qa-shared',title:'공통 셸 검증',subtitle:'독립 QA fixture',help:'시작 · 입력 · 정지 · 복원',theme:'ink',create(ctx){
 let value=0,ticks=0,resets=0;
 const action=button('입력',()=>{if(ctx.active()){value++;ctx.score(value);}});ctx.board.append(action);
 ctx.tools.append(button('완료 검증',()=>{if(ctx.active()){ctx.win('완료',9);ctx.win('중복',100);}}),button('실패 검증',()=>{if(ctx.active())ctx.lose('실패',3);}));
 return{reset(){value=0;ticks=0;resets++;},key(e){if(e.key==='Enter'){e.preventDefault();value++;ctx.score(value);}},tick(dt){ticks+=dt;ctx.meta('입력 대기');},snapshot(){return{value,ticks,resets};}};
}});`;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const KEY='simplegames.vol2.qa-shared.v1';
const environments=[['PC Chromium',chromium,1200,false],['mobile Chromium',chromium,320,true],['mobile WebKit',webkit,320,true]];
let server,base;
test.before(async()=>{const {createGameServer}=await import('../../artifacts/g032-build/src/server/index.js');server=createGameServer(resolve('artifacts/g032-build/public'));await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});base=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise(ok=>server.close(ok));});
async function contextFor(browser,width,mobile){const context=await browser.newContext({viewport:{width,height:800},isMobile:mobile,hasTouch:mobile});await context.route('**/games/vol2/qa-shared.html',r=>r.fulfill({contentType:'text/html',headers:{'content-security-policy':CSP},body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./shared.css"><script type="module" src="./qa-shared-main.mjs"></script></head><body></body></html>'}));await context.route('**/games/vol2/qa-shared-main.mjs',r=>r.fulfill({contentType:'text/javascript',body:fixture}));return context;}
async function open(page){await page.goto(`${base}/games/vol2/qa-shared.html`);await page.waitForFunction(()=>window.__vol2?.state==='ready');}
const click=locator=>locator.click({delay:80});
const snap=page=>page.evaluate(()=>window.__vol2.snapshot());

test('shared source and candidate build are byte-identical at QA start',async()=>{for(const name of ['shared.mjs','shared.css'])assert.deepEqual(await readFile(`public/games/vol2/${name}`),await readFile(`artifacts/g032-build/public/games/vol2/${name}`));});
for(const[name,engine,width,mobile]of environments){
 test(`${name}: lifecycle, trusted input, repeats, modal focus, restart and frame stability`,async()=>{
  const browser=await engine.launch({headless:true}),context=await contextFor(browser,width,mobile),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{await open(page);await page.locator('#board').focus();await page.keyboard.press('Enter');assert.equal((await snap(page)).value,0);
   await click(page.locator('#start'));await page.keyboard.press('Enter');assert.equal((await snap(page)).value,1);
   await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal((await snap(page)).value,2);
   await page.locator('#mute').focus();await page.keyboard.press('Enter');assert.equal((await snap(page)).value,2);
   await click(page.locator('#help'));assert.equal(await page.evaluate(()=>window.__vol2.state),'paused');
   const saved=await snap(page);for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)),true);}
   await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(n=>n.open),false);await page.locator('#board').focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);assert.deepEqual(await snap(page),saved);
   await click(page.locator('#pause'));await click(page.locator('#restart'));await click(page.locator('#modal .modal-close'));assert.equal((await snap(page)).value,2);assert.equal(await page.evaluate(()=>window.__vol2.state),'paused');
   await click(page.locator('#restart'));await click(page.locator('#confirm-restart'));assert.equal((await snap(page)).value,0);assert.equal(await page.evaluate(()=>window.__vol2.state),'playing');
   await page.evaluate(()=>{window.__qaMutations=[];const o=new MutationObserver(items=>window.__qaMutations.push(...items.map(v=>v.target.id)));for(const id of ['start','pause','restart','undo','help','wardrobe'])o.observe(document.getElementById(id),{subtree:true,childList:true,characterData:true,attributes:true});window.__qaObserver=o;});await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__qaMutations),[]);
   await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>window.__vol2.state),'paused');await page.waitForTimeout(100);const frozen=await snap(page);await page.waitForTimeout(100);assert.deepEqual(await snap(page),frozen);
   const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('.actions button,.auxiliary button,.home-link')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>({id:n.id,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})).filter(r=>r.w<43.9||r.h<43.9)}));assert.equal(geometry.overflow,false);assert.deepEqual(geometry.small,[]);assert.deepEqual(errors,[]);
  }finally{await context.close();await browser.close();}
 });
 test(`${name}: settlement once, theme/mute persistence, corruption and blocked storage`,async()=>{
  const browser=await engine.launch({headless:true}),context=await contextFor(browser,width,mobile),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await open(page);await page.evaluate(key=>{localStorage.setItem(key,JSON.stringify({version:1,wins:2,best:7,theme:0,muted:true}));localStorage.setItem('qa-unrelated','keep');},KEY);await page.reload();await page.waitForFunction(()=>window.__vol2?.state==='ready');
   await click(page.locator('#wardrobe'));const choices=page.locator('#modal>button');assert.equal(await choices.nth(2).isDisabled(),true);await click(choices.nth(1));assert.equal(await page.locator('body').getAttribute('data-variant'),'1');
   await click(page.locator('#mute'));assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
   await click(page.locator('#start'));await click(page.getByRole('button',{name:'완료 검증',exact:true}));assert.equal(await page.evaluate(()=>window.__vol2.state),'won');const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(stored.wins,3);assert.equal(stored.best,9);assert.equal(stored.theme,1);assert.equal(stored.muted,false);assert.equal(await page.evaluate(()=>localStorage.getItem('qa-unrelated')),'keep');
   await page.reload();await page.waitForFunction(()=>window.__vol2?.state==='ready');assert.equal((await snap(page)).value,0);assert.equal(await page.locator('body').getAttribute('data-variant'),'1');assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
   await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await page.reload();await page.waitForFunction(()=>window.__vol2?.state==='ready');assert.equal(await page.locator('#storage-warning').isVisible(),true);await click(page.locator('#mute'));assert.equal(await page.locator('#storage-warning').isVisible(),false);
   await page.evaluate(key=>localStorage.setItem(key,'{"version":1,"wins":-4,"best":"invalid","theme":2,"muted":{},"__proto__":{"polluted":true}}'),KEY);await page.reload();await page.waitForFunction(()=>window.__vol2?.state==='ready');assert.equal(await page.locator('body').getAttribute('data-variant'),'0');assert.equal(await page.locator('.best-card strong').innerText(),'0');assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>({}).polluted),undefined);assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const blocked=await contextFor(browser,width,mobile),p=await blocked.newPage();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  try{await open(p);assert.equal(await p.locator('#storage-warning').isVisible(),true);await click(p.locator('#start'));await p.keyboard.press('Enter');assert.equal((await snap(p)).value,1);await click(p.getByRole('button',{name:'완료 검증',exact:true}));assert.equal(await p.evaluate(()=>window.__vol2.state),'won');assert.equal(await p.locator('#storage-warning').isVisible(),true);}finally{await blocked.close();await browser.close();}
 });
}
