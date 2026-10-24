import { chromium, webkit, devices } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const results=[];
for (const [name,type,device] of [['chromium',chromium,devices['Desktop Chrome']],['webkit',webkit,devices['iPhone 13']]]) {
 const browser=await type.launch();const context=await browser.newContext(device);const page=await context.newPage();const events=[];
 page.on('console',m=>{if(m.type()==='error')events.push({text:m.text(),location:m.location()});});page.on('pageerror',e=>events.push({error:e.message}));
 await page.addInitScript(()=>{Math.random=()=>0;});await page.goto('http://127.0.0.1:3101');await page.locator('#start-button').click();
 await page.locator('#help-button').click();const focus=[];
 for(let i=0;i<5;i++){focus.push(await page.evaluate(()=>({active:document.activeElement?.tagName,id:document.activeElement?.id,html:document.activeElement?.outerHTML.slice(0,120),hasFocus:document.hasFocus()})));await page.keyboard.press('Tab');}
 await page.keyboard.press('Escape');const beforeScreenshot=[...events];
 await page.screenshot({path:`artifacts/qa/diagnostic-${name}.png`,fullPage:true});const afterScreenshot=[...events];
 if(await page.getByRole('button',{name:'게임 재개',exact:true}).isVisible()) await page.getByRole('button',{name:'게임 재개',exact:true}).click();
 await page.locator('#mute-button').click();await page.waitForTimeout(300);
 const audio=await page.evaluate(async()=>{try{const c=new AudioContext();const before=c.state;await Promise.race([c.resume(),new Promise(r=>setTimeout(r,200))]);const after=c.state;await c.close();return {before,after};}catch(e){return {error:String(e)};}});
 results.push({name,browser:browser.version(),focus,beforeScreenshot,afterScreenshot,audio});await browser.close();
}
await writeFile('artifacts/qa/diagnostic.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
