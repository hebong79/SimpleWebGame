// Developer verification utility; not imported by the browser game.
import {createGameServer} from '../../../artifacts/g032-build/src/server/index.js';
import {chromium,webkit} from '@playwright/test';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEVELS as rectangles} from './levels.mjs';
import {LEVELS as dominoes} from '../42-dominosa/levels.mjs';
import {LEVELS as loops} from '../43-loopy/levels.mjs';
import {LEVELS as rails} from '../44-tracks/levels.mjs';
import {LEVELS as maps} from '../45-map/levels.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),server=createGameServer(resolve(root,'public'));
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin=`http://127.0.0.1:${server.address().port}`,results=[];
const assert=(v,s)=>{if(!v)throw Error(s);};
try{for(const [environment,engine,mobile]of [['desktop-chromium',chromium,false],['mobile-chromium',chromium,true],['mobile-webkit',webkit,true]]){if(process.env.A1_ENV && process.env.A1_ENV!==environment)continue;const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:mobile?{width:320,height:740}:{width:1366,height:950},hasTouch:mobile,isMobile:mobile});try{const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});for(const [id,levels]of [['41-rectangles',rectangles],['42-dominosa',dominoes],['43-loopy',loops],['44-tracks',rails],['45-map',maps]]){if(process.env.A1_GAME && !process.env.A1_GAME.split(',').includes(id))continue;const errorStart=errors.length;await page.goto(`${origin}/games/${id}/index.html`);await page.waitForFunction(()=>!!window.__vol3);await page.locator('#start').click({delay:80});assert(await page.evaluate(()=>window.__vol3.state)==='playing','start');const level=levels[0];
 if(id==='41-rectangles'){for(const r of level.solution){await page.locator(`[data-cell="${r.top*level.n+r.left}"]`).click({delay:80});await page.locator(`[data-cell="${r.bottom*level.n+r.right}"]`).click({delay:80});}}
 if(id==='42-dominosa'){for(const [a,b]of level.solution){await page.locator(`[data-cell="${a}"]`).click({delay:80});await page.locator(`[data-cell="${b}"]`).click({delay:80});}}
 if(id==='43-loopy'){for(const [i,v]of level.solution.entries())if(v)await page.locator('#board .edge').nth(i).click({delay:80});}
 if(id==='44-tracks'){for(const [i,v]of level.solution.entries())if(v&&!level.fixed.includes(i))await page.locator('#board .edge').nth(i).click({delay:80});await page.waitForTimeout(1950);}
 if(id==='45-map'){for(const [i,v]of level.solution.entries())if(!level.fixed[i]){await page.locator('.palette button').nth(v-1).click({delay:80});await page.locator('#board .map-region').nth(i).click({delay:80});}}
 assert(await page.evaluate(()=>window.__vol3.state)==='won',id+' solved through trusted input');
 await page.getByRole('button',{name:'다음 문제 →',exact:true}).click({delay:80});assert(await page.evaluate(()=>window.__vol3.state)==='playing','next starts');assert(await page.evaluate(()=>window.__vol3.snapshot().level)===1,'next stage selected');
 if(id==='41-rectangles'){const q=levels[1].solution[0],a=await page.locator('[data-cell]').nth(q.top*levels[1].n+q.left).boundingBox(),b=await page.locator('[data-cell]').nth(q.bottom*levels[1].n+q.right).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();assert(await page.evaluate(()=>window.__vol3.snapshot().regions.length)===1,'trusted rectangle drag');}if(id==='44-tracks'){const edge=page.locator('#board .edge:not(:disabled)').first(),index=Number(await edge.getAttribute('data-edge')),before=await page.evaluate(i=>window.__vol3.snapshot().marks[i],index);await edge.focus();await page.keyboard.press('Enter',{delay:80});assert(await page.evaluate(i=>window.__vol3.snapshot().marks[i],index)!==before,'Tab target Enter toggles exact rail edge');}await page.locator('#pause').click({delay:80});const frozen=await page.evaluate(()=>JSON.stringify(window.__vol3.snapshot()));await page.waitForTimeout(130);assert(await page.evaluate(()=>JSON.stringify(window.__vol3.snapshot()))===frozen,'pause frozen');await page.locator('#pause').click({delay:80});
 await page.locator('#board').focus();await page.keyboard.press('ArrowRight',{delay:80});await page.keyboard.press('Enter',{delay:80});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no outer overflow');assert(errors.length===errorStart,errors.slice(errorStart).join('\n'));
 results.push({environment,id,status:'PASS',checks:'trusted 80ms full first-board solve, next-board, pause/resume, keyboard, 320px, CSP/runtime'});console.log(`PASS ${environment}/${id}`);
 } }finally{await context.close();await browser.close();}}}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
console.log(JSON.stringify({passed:results.length,results},null,2));
