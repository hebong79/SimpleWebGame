import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile}from'node:fs/promises';
import {resolve}from'node:path';
import {createHash}from'node:crypto';
import { LEVELS } from '../../public/games/10-sokoban/levels.mjs';
const root=resolve(process.env.GAME_TEST_ARTIFACT_DIR??'artifacts/g024-10-builder'),out=resolve(root,'http-full');await mkdir(out,{recursive:true});
const base='http://127.0.0.1:3142',url=base+'/games/10-sokoban/index.html',key='simplegames.hamster-depot.v1';
const results=[],diagnostics=[],external=[];
const cases=async(project,name,fn)=>{try{const evidence=await fn();results.push({project,name,status:'passed',evidence});console.log(`PASS ${project}: ${name}`);}catch(error){results.push({project,name,status:'failed',error:error.stack});console.log(`FAIL ${project}: ${name}\n${error.stack}`);throw error;}};
const specs=[{name:'chromium-desktop',engine:chromium,viewport:{width:1366,height:900}},{name:'chromium-320',engine:chromium,viewport:{width:320,height:740},isMobile:true,hasTouch:true},{name:'webkit-mobile',engine:webkit,viewport:{width:375,height:812},isMobile:true,hasTouch:true}];
function observe(page,project){page.on('pageerror',e=>diagnostics.push({project,type:'pageerror',message:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))diagnostics.push({project,type:m.type(),message:m.text()});});page.on('request',r=>{if(!r.url().startsWith(base))external.push({project,url:r.url()});});}
for(const spec of specs){
 const browser=await spec.engine.launch({headless:true}),context=await browser.newContext({viewport:spec.viewport,isMobile:spec.isMobile,hasTouch:spec.hasTouch,reducedMotion:'reduce'}),page=await context.newPage();observe(page,spec.name);
 const s=()=>page.evaluate(()=>window.__simpleGames10Snapshot()),click=selector=>page.locator(selector).click({delay:80});
 const fresh=async()=>{await page.goto(url);await page.waitForFunction(()=>!!window.__simpleGames10Snapshot);};
 const choose=async id=>{await click('#levels');await page.locator('#level-grid button').nth(id-1).click({delay:80});if((await s()).activePanel==='confirm')await click('#confirm-yes');};
 const buttonsLayout=async()=>page.evaluate(()=>{const modal=document.querySelector('dialog[open]'),host=modal??document;return{overflow:document.documentElement.scrollWidth>innerWidth,modal:modal?{width:modal.clientWidth,scrollWidth:modal.scrollWidth,height:modal.getBoundingClientRect().height,viewportHeight:innerHeight}:null,buttons:[...host.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.closest('[hidden]')).map(b=>({id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))};});
 async function layout(){const x=await buttonsLayout();assert.equal(x.overflow,false);if(x.modal){assert.ok(x.modal.scrollWidth<=x.modal.width);assert.ok(x.modal.height<=x.modal.viewportHeight);}assert.ok(x.buttons.every(b=>b.width>=44&&b.height>=44),JSON.stringify(x));return x;}
 async function poseCoverage(){
  const seen=[];
  for(const pose of ['walk','push']){if((await s()).preview.pose!==pose)await click('#preview-action');for(let i=0;i<4;i++){seen.push((await s()).preview);await click('#preview-turn');}}
  assert.equal(new Set(seen.map(v=>v.direction+v.pose)).size,8);return seen;
 }
 try{
  await fresh();
  await cases(spec.name,'ready, CSP assets, private snapshot clone, no source setter',async()=>{
   const snap=await s();assert.equal(snap.phase,'ready');assert.equal(snap.game.moves,0);assert.equal(snap.record.unlocked,1);
   const changed=await page.evaluate(()=>{const c=window.__simpleGames10Snapshot();c.game.boxes[0]=-1;c.record.unlocked=20;const d=Object.getOwnPropertyDescriptor(window,'__simpleGames10Snapshot');return{now:window.__simpleGames10Snapshot(),setter:!!d.set,writable:d.writable};});assert.equal(changed.setter,false);assert.equal(changed.writable,false);assert.deepEqual(changed.now,snap);return layout();
  });
  await cases(spec.name,'accessible sequential level selection and focus trap',async()=>{
   await click('#levels');assert.equal(await page.locator('#level-grid button:disabled').count(),19);await layout();
   const tabbables=page.locator('#modal button:visible:enabled');await tabbables.last().focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'modal-close');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.includes('1')) ,true);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'levels');assert.equal((await s()).phase,'ready');
  });
  await cases(spec.name,'fresh input only, modifier/repeat/no-op, exact undo and restart cancel',async()=>{
   await click('#primary');await page.keyboard.press('ArrowUp');const up=(await s()).game;assert.equal(up.moves,1);await page.keyboard.press('ArrowUp');assert.deepEqual((await s()).game,up);
   await page.keyboard.press('Control+ArrowDown');await page.keyboard.press('Shift+ArrowDown');assert.deepEqual((await s()).game,up);
   await page.keyboard.down('ArrowDown');const one=(await s()).game;await page.keyboard.down('ArrowDown');await page.keyboard.up('ArrowDown');assert.deepEqual((await s()).game,one);assert.equal(one.moves,2);
   await page.keyboard.press('z');assert.deepEqual((await s()).game,up);
   await page.keyboard.press('r');await page.keyboard.press('ArrowDown');assert.deepEqual((await s()).game,up);await click('#confirm-cancel');assert.deepEqual((await s()).game,up);assert.equal((await s()).phase,'playing');assert.equal(await page.evaluate(()=>document.activeElement.id),'arena');
   await click('#primary');const paused=await s();assert.equal(paused.pauseReason,'manual');await click('#restart');await click('#confirm-cancel');assert.equal((await s()).pauseReason,'manual');assert.deepEqual((await s()).game,paused.game);assert.equal((await s()).phase,'paused');await click('#primary');await page.keyboard.press('z');assert.equal((await s()).game.moves,0);
  });
  await cases(spec.name,'help, protective blur branch, explicit resume, home cancel',async()=>{
   await click('#help');const before=(await s()).game;await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.press('Escape');assert.equal((await s()).phase,'paused');assert.equal((await s()).pauseReason,'blur');assert.deepEqual((await s()).game,before);
   await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>document.activeElement.id),'help');await click('#primary');await page.waitForTimeout(280);assert.equal((await s()).phase,'playing');assert.equal(await page.evaluate(()=>document.activeElement.id),'arena');
   await click('#home');await click('#confirm-cancel');assert.equal((await s()).phase,'playing');assert.equal(await page.evaluate(()=>document.activeElement.id),'home');return{blur:'synthetic window event on real HTTP; not OS focus automation'};
  });
  await cases(spec.name,'primary pointer threshold, cancellation, outside second finger and trusted buttons',async()=>{
   await page.locator('#arena').focus();const before=(await s()).game;
   const pointer=async(type,target,props)=>page.evaluate(({type,target,props})=>document.querySelector(target).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',button:0,...props})),{type,target,props});
   await pointer('pointerdown','#arena',{pointerId:1,isPrimary:true,clientX:50,clientY:50});await pointer('pointerup','#arena',{pointerId:1,isPrimary:true,clientX:73,clientY:50});assert.deepEqual((await s()).game,before);
   await pointer('pointerdown','#arena',{pointerId:1,isPrimary:true,clientX:50,clientY:50});await pointer('pointerup','#arena',{pointerId:1,isPrimary:true,clientX:90,clientY:90});assert.deepEqual((await s()).game,before);
   await pointer('pointerdown','#arena',{pointerId:1,isPrimary:true,clientX:50,clientY:50});assert.equal(await pointer('pointerdown','body',{pointerId:2,isPrimary:false,clientX:2,clientY:2}),true);await pointer('pointerup','#arena',{pointerId:1,isPrimary:true,clientX:100,clientY:50});await pointer('pointerup','body',{pointerId:2,isPrimary:false});assert.deepEqual((await s()).game,before);
   await pointer('pointerdown','#arena',{pointerId:1,isPrimary:true,clientX:50,clientY:50});await pointer('pointercancel','#arena',{pointerId:1,isPrimary:true});await pointer('pointerup','#arena',{pointerId:1,isPrimary:true,clientX:100,clientY:50});assert.deepEqual((await s()).game,before);
   await click('[data-direction="U"]');assert.equal((await s()).game.moves,before.moves+1);await click('#undo');assert.deepEqual((await s()).game,before);return{pointer:'synthetic PointerEvent diagnostics; direction and undo clicks trusted 80ms'};
  });
  await cases(spec.name,'free full outfit, mixed parts, cancel, locked apply and 8 poses',async()=>{
   await click('#wardrobe');await layout();await click('#set-options [data-set="delivery"]');await click('#wardrobe-apply');assert.deepEqual((await s()).record.equipped,{hat:'delivery',workwear:'delivery',bag:'delivery'});
   await click('#wardrobe');await click('#part-options [data-part="hat"][data-set="basic"]');await click('#wardrobe-apply');assert.deepEqual((await s()).record.equipped,{hat:'basic',workwear:'delivery',bag:'delivery'});
   await click('#wardrobe');const before=(await s()).record.equipped;await click('#set-options [data-set="chef"]');assert.equal(await page.locator('#wardrobe-apply').isDisabled(),true);const poses=await poseCoverage();await click('#wardrobe-cancel');assert.deepEqual((await s()).record.equipped,before);return{poses};
  });
  await cases(spec.name,'first clear synchronous one-shot, result keys/undo do not unearn, nested focus',async()=>{
   await page.locator('#arena').focus();for(const k of ['ArrowUp','ArrowDown','ArrowRight','ArrowRight'])await page.keyboard.press(k);
   let snap=await s();assert.equal(snap.phase,'won');assert.equal(snap.settlements,1);assert.deepEqual(snap.record.bests[1],{pushes:2,moves:4});assert.equal(snap.record.unlocked,2);const before=snap.game;
   await page.keyboard.press('z');await page.keyboard.press('ArrowLeft');assert.deepEqual((await s()).game,before);assert.equal((await s()).settlements,1);
   await click('#result-wardrobe');await click('#wardrobe-cancel');assert.equal((await s()).activePanel,'result');assert.equal(await page.evaluate(()=>document.activeElement.id),'result-wardrobe');await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>document.activeElement.id),'result-wardrobe');
   await page.keyboard.press('Escape');assert.equal((await s()).phase,'won');await page.locator('#arena').focus();await page.keyboard.press('z');assert.deepEqual((await s()).game,before);await click('#primary');assert.equal((await s()).settlements,1);await click('#result-retry');assert.equal((await s()).phase,'ready');
  });
  for(const level of LEVELS){
   await cases(spec.name,`public-key solution level ${level.id}`,async()=>{
    assert.equal((await s()).game.board.id,level.id);assert.equal((await s()).phase,'ready');await click('#primary');
    for(const d of level.solution)await page.keyboard.press({U:'ArrowUp',R:'ArrowRight',D:'ArrowDown',L:'ArrowLeft'}[d],{delay:5});
    const snap=await s();assert.equal(snap.phase,'won');assert.equal(snap.activePanel,'result');assert.equal(snap.game.moves,level.moves);assert.equal(snap.game.pushes,level.pushes);assert.equal(snap.record.cleared.length,level.id);assert.equal(snap.record.unlocked,Math.min(20,level.id+1));assert.equal(snap.settlements,level.id+1);assert.deepEqual(snap.record.bests[level.id],{pushes:level.pushes,moves:level.moves});
    if(level.id===5||level.id===15){await click('#result-wardrobe');const set=level.id===5?'mechanic':'chef';await click(`#set-options [data-set="${set}"]`);assert.equal(await page.locator('#wardrobe-apply').isDisabled(),false);await click('#wardrobe-apply');assert.deepEqual((await s()).record.equipped,{hat:set,workwear:set,bag:set});}
    if(level.id<20)await click('#next');else assert.equal(await page.locator('#next').isDisabled(),true);
    return{moves:level.moves,pushes:level.pushes,input:'public trusted keyboard; no live state writes'};
   });
  }
  await cases(spec.name,'reload retains all bests/outfit, starts fresh ready, completed stages replayable',async()=>{
   const before=(await s()).record;await fresh();const snap=await s();assert.equal(snap.phase,'ready');assert.equal(snap.game.board.id,1);assert.equal(snap.game.moves,0);assert.deepEqual(snap.record,before);assert.equal(snap.settlements,0);
   await click('#levels');assert.equal(await page.locator('#level-grid button:disabled').count(),0);await page.locator('#level-grid button').nth(1).click({delay:80});assert.equal((await s()).phase,'ready');assert.equal((await s()).game.board.id,2);
  });
  await cases(spec.name,'natural corner advisory and undo, confirmed restart only resets current board',async()=>{
   await click('#primary');const states=[(await s()).game];for(const d of 'RULDLU'){await page.keyboard.press({U:'ArrowUp',R:'ArrowRight',D:'ArrowDown',L:'ArrowLeft'}[d]);states.push((await s()).game);}
   assert.match(await page.locator('#game-status').textContent(),/구석/);assert.equal((await s()).phase,'playing');await click('#undo');assert.deepEqual((await s()).game,states.at(-2));
   const record=(await s()).record;await click('#restart');await click('#confirm-yes');assert.equal((await s()).phase,'ready');assert.equal((await s()).game.moves,0);assert.equal((await s()).game.history.length,0);assert.deepEqual((await s()).record,record);
  });
  await cases(spec.name,'320 and landscape modal geometry, 44px targets, stable nodes',async()=>{
   const evidence=[];for(const viewport of [{width:320,height:740},{width:667,height:375}]){await page.setViewportSize(viewport);await click('#wardrobe');evidence.push(await layout());await click('#wardrobe-cancel');await click('#levels');evidence.push(await layout());await page.keyboard.press('Escape');await click('#help');evidence.push(await layout());await page.keyboard.press('Escape');}
   await page.setViewportSize(spec.viewport);
   await page.evaluate(()=>{window.__textChanges=0;new MutationObserver(r=>window.__textChanges+=r.length).observe(document.querySelector('main'),{childList:true,subtree:true,characterData:true});});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__textChanges),0);
   if(spec.engine===chromium){await click('#wardrobe');await page.screenshot({path:resolve(out,`${spec.name}-wardrobe.png`),fullPage:true});await click('#wardrobe-cancel');}return evidence;
  });
  await cases(spec.name,'HTTP CSP/console/external request gate',async()=>{assert.deepEqual(diagnostics.filter(d=>d.project===spec.name),[]);assert.deepEqual(external.filter(d=>d.project===spec.name),[]);});
 }catch{/* Preserve first failure; subsequent dependent cases are not falsely counted. */}
 finally{await browser.close();await writeFile(resolve(out,'results-progress.json'),JSON.stringify({results,diagnostics,external},null,2));}
}
// Fresh isolated storage/audio fault contexts, not live-state mutations.
for(const mode of ['getter','getItem','setItem','corrupt','audio']){
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();
 await context.addInitScript(({mode,key})=>{
  window.__saveWrites=[];
  if(mode==='getter')Object.defineProperty(window,'localStorage',{get(){throw new Error('fixture getter');}});
  else if(mode==='getItem')Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('fixture read');}});
  else if(mode==='setItem')Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('fixture quota');}});
  else if(mode==='corrupt'){
   if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,'{broken');localStorage.setItem('foreign-key','keep');sessionStorage.setItem('seeded','yes');}
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__saveWrites.push(k);return original.call(this,k,v);};
  }else if(mode==='audio')Object.defineProperty(window,'AudioContext',{value:class{constructor(){throw new Error('fixture audio');}}});
 },{mode,key});
 const page=await context.newPage();observe(page,`fault-${mode}`);
 try{await cases(`fault-${mode}`,'storage resilience/no recovery write or audio degradation',async()=>{
  await page.goto(url);await page.waitForFunction(()=>!!window.__simpleGames10Snapshot);const snap=()=>page.evaluate(()=>window.__simpleGames10Snapshot());
  if(['getter','getItem','corrupt'].includes(mode))assert.ok((await snap()).storageWarning);
  if(mode==='corrupt'){assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'{broken');assert.deepEqual(await page.evaluate(()=>window.__saveWrites),[]);}
  if(mode==='audio')await page.locator('#mute').click({delay:80});
  await page.locator('#primary').click({delay:80});await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');assert.equal((await snap()).phase,'won');assert.equal((await snap()).record.cleared.length,1);
  if(['getter','getItem','setItem'].includes(mode))assert.ok((await snap()).storageWarning);
  if(mode==='corrupt'){assert.deepEqual(await page.evaluate(()=>window.__saveWrites),[key]);assert.equal(await page.evaluate(()=>localStorage.getItem('foreign-key')),'keep');}
  assert.deepEqual(diagnostics.filter(d=>d.project===`fault-${mode}`),[]);
 });}catch{}finally{await browser.close();}
}
await cases('http','exact asset bytes and strict CSP',async()=>{
 const assets=[];for(const file of ['index.html','styles.css','main.mjs','engine.mjs','save.mjs','art.mjs','levels.mjs']){
  const response=await fetch(base+'/games/10-sokoban/'+file);assert.equal(response.status,200);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'; style-src 'self'"));const served=Buffer.from(await response.arrayBuffer()),source=await readFile(resolve('public/games/10-sokoban',file));assert.ok(served.equals(source));assets.push({file,sha256:createHash('sha256').update(source).digest('hex')});
 }return assets;
});
const summary={executed:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,clock:'real/nonfrozen',results,diagnostics,external,limits:['No physical device','No actual audio listening','No human-duration acceptance','blur and multi-pointer branches use explicitly synthetic events']};
await writeFile(resolve(out,'results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({executed:summary.executed,passed:summary.passed,failed:summary.failed,skipped:summary.skipped,diagnostics:diagnostics.length,external:external.length}));if(summary.failed)process.exitCode=1;
