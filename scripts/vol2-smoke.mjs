import { chromium, webkit } from '@playwright/test';
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGameServer } from '../artifacts/g032-build/src/server/index.js';
const games = [
 ['21-pattern','잉크 엽서'],['22-solo','네 칸 수첩'],['23-net','전등 배선실'],['24-bridges','섬 사이 징검교'],['25-lightup','밤길 램프'],['26-tents','숲속 야영지'],['27-slant','유리 지붕'],['28-untangle','얽힌 별자리'],['29-guess','표본 금고'],['30-othello','달과 해의 정원'],['31-set','삼색 표본관'],['32-mancala','씨앗 항아리'],['33-maze','반딧불 우편소'],['34-asteroids','조각별 순찰'],['35-missile-command','등대 보호막'],['36-hexagon','틈새 궤도'],['37-qbert','구름 계단 도장'],['38-whac-a-mole','달빛 버섯 채집'],['39-fruit-ninja','과즙 공방'],['40-cut-the-rope','한입 구름 공방']
];
const partial = process.argv.includes('--partial');
const output = `artifacts/g032-smoke/${new Date().toISOString().replace(/[:.]/g,'-')}`;
await mkdir(output,{recursive:true});
const requestedOrigin=process.env.VOL2_ORIGIN||(process.argv.includes('--live')?'http://192.168.0.195:15010':undefined);
if(requestedOrigin&&!['http://192.168.0.195:15010','http://127.0.0.1:15010'].includes(requestedOrigin))throw new Error('Only the documented game server may be selected.');
const server = requestedOrigin?null:createGameServer(new URL('../artifacts/g032-build/public',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=requestedOrigin||`http://127.0.0.1:${server.address().port}`;
const results=[], failures=[];
const assert=(condition,text)=>{if(!condition)throw new Error(text);};
async function snapshot(page){return page.evaluate(()=>({state:window.__vol2.state, elapsed:window.__vol2.elapsed,game:window.__vol2.snapshot()}));}
const selected=[];
for(const game of games){try{await readFile(`artifacts/g032-build/public/games/${game[0]}/index.html`);selected.push(game);}catch{if(!partial)throw new Error(`Missing ${game[0]}`);}}
try {
 for(const [name,engine,mobile] of [['desktop-chromium',chromium,false],['mobile-chromium',chromium,true],['mobile-webkit',webkit,true]]){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:950},hasTouch:mobile,isMobile:mobile});
  try{
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('requestfailed',r=>errors.push(`requestfailed ${r.url()} ${r.failure()?.errorText}`));
   for(const [id,title]of selected){
    const item={environment:name,id,checks:[],errors:[]}; results.push(item); const startError=errors.length;
    try{
     await page.goto(origin+'/');
     await page.locator('#game-search').fill(title);
     const card=page.locator(`a.card-action[href="/games/${id}/index.html"]`);
     assert(await card.count()===1,'home has unique launch link');item.checks.push('home unique card');
     await card.click({delay:80});
     await page.waitForFunction(()=>!!window.__vol2);
     assert((await snapshot(page)).state==='ready','initial ready');
     await page.locator('#start').click({delay:80});
     assert((await snapshot(page)).state==='playing','trusted start'); item.checks.push('80ms trusted start');
     // First actual input: native button click, or trusted board pointer gesture.
     const buttons=page.locator('#board button:not(:disabled)');
     if(id==='38-whac-a-mole'){
      await page.locator('#board .mushroom-hole:not(.empty)').first().waitFor();
      await page.locator('#board .mushroom-hole:not(.empty)').first().click({delay:80});
      assert((await page.evaluate(()=>window.__vol2.score))>0,'mushroom scores from a live target');
     }else if(id==='39-fruit-ninja'){
      await page.waitForFunction(()=>window.__vol2.snapshot().objects.some(o=>o.type==='fruit'&&o.y>40&&o.y<430));
      const fruit=await page.evaluate(()=>window.__vol2.snapshot().objects.find(o=>o.type==='fruit'&&o.y>40&&o.y<430));
      const box=await page.locator('#board canvas').boundingBox();
      const y=box.y+fruit.y/480*box.height;
      await page.mouse.move(box.x+(fruit.x-36)/480*box.width,y);await page.mouse.down();await page.mouse.move(box.x+(fruit.x+36)/480*box.width,y,{steps:5});await page.mouse.up();
      await page.waitForTimeout(60);assert((await page.evaluate(()=>window.__vol2.score))>=10,'fruit scores from a trusted swipe');
     }else if(id==='40-cut-the-rope'){
      await page.getByRole('button',{name:'줄 1 절단',exact:true}).click({delay:80});
      assert((await snapshot(page)).game.ropes[0].cut,'rope cut from a trusted button');
     }else if(await buttons.count()){
      // Choose an initially legal board-game move where legal hints are present.
      const legal=page.locator('#board button.legal,#board button[data-legal="true"]');
      await (await legal.count()?legal.first():buttons.first()).click({delay:80});
     }else{
      const box=await page.locator('#board canvas,#board svg').first().boundingBox();
      if(box){await page.mouse.move(box.x+box.width*.4,box.y+box.height*.35);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:6});await page.mouse.up();}
     }
     item.checks.push('trusted board input');
     await page.locator('#board').focus();await page.keyboard.press('ArrowRight',{delay:80});
     await page.waitForTimeout(120);
     if((await snapshot(page)).state==='playing'){
      await page.locator('#pause').click({delay:80});
      const paused=await snapshot(page);await page.waitForTimeout(140);assert(JSON.stringify(await snapshot(page))===JSON.stringify(paused),'pause freezes time and state');item.checks.push('pause frozen snapshot');
      await page.locator('#pause').click({delay:80});assert((await snapshot(page)).state==='playing','resume');
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert((await snapshot(page)).state==='paused','blur protection');item.checks.push('resume and blur pause');
     }
     await page.locator('#restart').click({delay:80});
     if(await page.locator('#modal').isVisible()){
      const frozen=await snapshot(page);await page.locator('.modal-close').click({delay:80});assert(JSON.stringify(await snapshot(page))===JSON.stringify(frozen),'restart cancel preserves state');
      await page.locator('#restart').click({delay:80});await page.locator('#confirm-restart').click({delay:80});
     }
     assert((await snapshot(page)).state==='playing','restart plays');item.checks.push('restart confirm and cancel');
     await page.locator('#help').click({delay:80});
     assert(await page.locator('#modal').isVisible(),'help opens');await page.keyboard.press('Tab');
     assert(await page.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)),'modal focus retained');
     await page.keyboard.press('Escape');assert((await snapshot(page)).state==='paused','help leaves paused');item.checks.push('help and focus');
     await page.locator('#wardrobe').click({delay:80});assert(await page.locator('#modal').isVisible(),'wardrobe');await page.keyboard.press('Escape');
     await page.setViewportSize({width:320,height:720});await page.waitForTimeout(50);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'320px overflow');item.checks.push('320px fits');
     if(name==='desktop-chromium'){
      await page.setViewportSize({width:1366,height:950});await page.locator('#pause').click({delay:80});await page.screenshot({path:`${output}/${id}-desktop.png`,fullPage:true});
     } else if(name==='mobile-chromium'){
      await page.locator('#pause').click({delay:80});
      await page.screenshot({path:`${output}/${id}-mobile.png`,fullPage:true});
     }
     await page.locator('.home-link').click({delay:80});await page.waitForLoadState('load');await page.locator('.game-card').first().waitFor();assert(new URL(page.url()).pathname==='/','home return');item.checks.push('home return');
     item.errors=errors.slice(startError);assert(item.errors.length===0,item.errors.join('\n'));item.status='PASS';
    }catch(e){item.status='FAIL';item.failure=e.message;item.errors=errors.slice(startError);failures.push(`${name}/${id}: ${e.message}`);await page.screenshot({path:`${output}/${id}-${name}-failure.png`,fullPage:true}).catch(()=>{});}
    console.log(`${item.status} ${name}/${id} (${item.checks.length} checks)`);
   }
   await page.goto(origin+'/');assert(await page.locator('#catalog-total').textContent()==='69','catalog 69');
   assert(await page.locator('#intro-preview').textContent()==='플레이 가능 40 · 준비 중 29','catalog 40 playable');
   while(await page.locator('#load-more').isVisible())await page.locator('#load-more').click({delay:80});
   assert(await page.locator('.game-card').count()===69,'all 69 cards');assert(await page.locator('a.card-action').count()===40,'40 playable links');
   await page.locator('#vol2-collection').click({delay:80});
   assert(await page.locator('.game-card').count()===20,'new collection reveals 20 games');
   const collectionLinks=await page.locator('a.card-action').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
   assert(games.every(([id])=>collectionLinks.includes(`/games/${id}/index.html`)),'collection contains exact Vol. 2 games');
  }finally{await context.close();await browser.close();}
 }
 const manifest=[];
 for(const [id]of selected){
  for(const file of await readdir(`public/games/${id}`)){
   if(!/\.(mjs|css|html|svg)$/.test(file))continue;
   const source=await readFile(`public/games/${id}/${file}`), response=await fetch(`${origin}/games/${id}/${file}`), bytes=Buffer.from(await response.arrayBuffer());
   assert(response.status===200,`${id}/${file} HTTP200`);assert(source.equals(bytes),`${id}/${file} build bytes`);
   manifest.push({path:`games/${id}/${file}`,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2));
}catch(e){failures.push(`integration: ${e.message}`);console.error(e.stack);}
finally{
 await writeFile(`${output}/results.json`,JSON.stringify({partial,origin,selected:selected.length,passed:results.filter(x=>x.status==='PASS').length,failed:failures.length,failures,results},null,2));
 if(server){server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
 console.log(`Evidence ${output}; ${results.filter(x=>x.status==='PASS').length} PASS / ${failures.length} FAIL`);
}
if(failures.length)process.exitCode=1;
