import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile}from'node:fs/promises';
import {resolve}from'node:path';
const root=resolve(process.env.GAME_TEST_ARTIFACT_DIR??'artifacts/g024-10-builder');
const output=resolve(root,'http-initial-observer-corrected');await mkdir(output,{recursive:true});
const base='http://127.0.0.1:3142';
const results=[];
for(const spec of [{name:'chromium-desktop',engine:chromium,viewport:{width:1366,height:900}},{name:'chromium-320',engine:chromium,viewport:{width:320,height:740},isMobile:true,hasTouch:true},{name:'webkit-mobile',engine:webkit,viewport:{width:375,height:812},isMobile:true,hasTouch:true}]){
 const browser=await spec.engine.launch({headless:true}),context=await browser.newContext({viewport:spec.viewport,isMobile:spec.isMobile,hasTouch:spec.hasTouch});const page=await context.newPage();const diagnostics=[],external=[];
 page.on('pageerror',e=>diagnostics.push({type:'pageerror',message:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))diagnostics.push({type:m.type(),message:m.text()});});page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
 try{
  const response=await page.goto(`${base}/games/10-sokoban/index.html`);assert.equal(response.status(),200);assert.ok(response.headers()['content-security-policy'].includes("style-src 'self'"));
  await page.waitForFunction(()=>!!window.__simpleGames10Snapshot);
  await page.evaluate(()=>{window.__clickEvidence=[];document.addEventListener('click',e=>{if(e.target.closest('button'))window.__clickEvidence.push({id:e.target.closest('button').id,trusted:e.isTrusted});},true);window.__stableChanges=0;new MutationObserver(records=>{window.__stableChanges+=records.length;}).observe(document.querySelector('#primary'),{childList:true,subtree:true,characterData:true});});
  const snap=()=>page.evaluate(()=>window.__simpleGames10Snapshot());
  const click=id=>page.locator(id).click({delay:80});
  assert.equal((await snap()).phase,'ready');await click('#primary');assert.equal((await snap()).phase,'playing');
  await page.keyboard.press('ArrowUp');const moved=(await snap()).game;assert.equal(moved.moves,1);
  await click('#primary');assert.equal((await snap()).phase,'paused');await page.locator('#arena').focus();await page.keyboard.press('ArrowDown');assert.deepEqual((await snap()).game,moved);
  await click('#primary');assert.equal((await snap()).phase,'playing');await click('#mute');assert.equal((await snap()).record.muted,false);
  await click('#wardrobe');assert.equal((await snap()).activePanel,'wardrobe');await click('#set-options [data-set="delivery"]');await click('#wardrobe-apply');assert.deepEqual((await snap()).record.equipped,{hat:'delivery',workwear:'delivery',bag:'delivery'});
  await click('#wardrobe');const before=(await snap()).record.equipped;await click('#set-options [data-set="chef"]');assert.equal(await page.locator('#wardrobe-apply').isDisabled(),true);await click('#wardrobe-cancel');assert.deepEqual((await snap()).record.equipped,before);
  await click('#help');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'help');assert.equal((await snap()).phase,'playing');
  const count=await page.evaluate(()=>window.__stableChanges);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__stableChanges),count,'no per-RAF text replacement');
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}));assert.equal(layout.overflow,false);assert.ok(layout.buttons.every(b=>b.width>=44&&b.height>=44),JSON.stringify(layout.buttons));
  assert.deepEqual(diagnostics,[]);assert.deepEqual(external,[]);const trusted=await page.evaluate(()=>window.__clickEvidence);assert.deepEqual(trusted.map(c=>c.id),['primary','primary','primary','mute','wardrobe','','wardrobe-apply','wardrobe','','wardrobe-cancel','help']);assert.ok(trusted.every(c=>c.trusted));
  if(spec.engine===chromium)await page.screenshot({path:resolve(output,`${spec.name}.png`),fullPage:true});
  results.push({project:spec.name,status:'passed',checks:14,clock:'nonfrozen',pressMs:80,trustedClicks:trusted.length,diagnostics,external,layout});
 }catch(error){results.push({project:spec.name,status:'failed',error:error.stack,diagnostics,external});}
 finally{await browser.close();}
}
await writeFile(resolve(output,'results.json'),JSON.stringify({cases:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,results},null,2));
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
