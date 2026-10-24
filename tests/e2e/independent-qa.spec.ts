import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const KEY = 'number-garden:profile:v1';
const out = 'artifacts/g013-qa';
const blank = () => Array.from({length:4}, () => [0,0,0,0]);
const profile = (patch = {}) => ({ version:1,bestScore:0,bestTile:0,gamesStarted:0,gamesFinished:0,gamesWon:0,totalMoves:0,totalScore:0,unlockedGardens:['seed'],selectedGarden:'seed',muted:true,...patch });
const errors = new WeakMap<Page, string[]>();
const toolingErrors = new WeakMap<Page, string[]>();
const takingScreenshot = new WeakSet<Page>();
const external = new WeakMap<Page, string[]>();
const requests = new WeakMap<Page, string[]>();
async function snapshot(page:Page) { return page.locator('#board .cell').evaluateAll(es => es.map(e => Number((e as HTMLElement).dataset.value))); }
async function saved(page:Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'),KEY); }
async function start(page:Page) { await page.goto('/game.html');  await expect(page.locator('#board')).toBeFocused(); }
async function shot(page:Page, name:string) {
  // WebKit screenshot sync injects inline body{} (Playwright coreBundle.js:22719).
  // Diagnostic without screenshots has zero CSP errors; retain separately, never weaken CSP.
  takingScreenshot.add(page);try{await page.screenshot({path:`${out}/${test.info().project.name}-${name}.png`,fullPage:true});}finally{takingScreenshot.delete(page);}
}
async function fixture(page:Page, board:number[][], won=false) {
  // QA-only network adapter: production files and globals remain unchanged.
  await page.route('**/scripts/state.js',async route => {
    const response = await route.fetch();
    const original = await response.text();
    const source = original.replace('export function startGame(', 'function originalStartGame(') + `\nlet qaFirst=true; export function startGame(s,r) { const n=originalStartGame(s,r); if(!qaFirst)return n; qaFirst=false; const b=${JSON.stringify(board)}; return {...n,board:b,highestTile:Math.max(...b.flat()),won:${won}}; }`;
    await route.fulfill({response,body:source});
  });
}

test.beforeEach(async ({page}) => {
  await mkdir(out,{recursive:true});
  errors.set(page,[]); toolingErrors.set(page,[]); external.set(page,[]); requests.set(page,[]);
  page.on('pageerror',e => errors.get(page)!.push(e.message));
  page.on('console',m => { if(m.type()==='error') { if(takingScreenshot.has(page) && m.text().startsWith('Refused to apply a stylesheet')) toolingErrors.get(page)!.push(m.text()); else errors.get(page)!.push(m.text()); } });
  // Cold isolated contexts; localhost remains available, all external HTTP is denied.
  await page.route('**/*',async route => {
    const url=route.request().url(); requests.get(page)!.push(url);
    const u=new URL(url);
    if (!['127.0.0.1','localhost','[::1]'].includes(u.hostname)) { external.get(page)!.push(url); await route.abort(); }
    else await route.continue();
  });
  await page.addInitScript(() => { Math.random=()=>0; });
});
test.afterEach(async ({page},info) => {
  const evidence={project:info.project.name,test:info.title,browser:page.context().browser()?.version(),viewport:page.viewportSize(),consoleErrors:errors.get(page),screenshotToolErrors:toolingErrors.get(page),externalRequests:external.get(page),requests:requests.get(page)};
  await writeFile(`${out}/security-${info.project.name}-${info.title.replace(/[^a-z0-9-]/gi,'_')}.json`,JSON.stringify(evidence,null,2));
  expect(errors.get(page),'console/page errors').toEqual([]);
  expect(external.get(page),'external internet requests').toEqual([]);
});

test('01 home selection auto start restart cancel confirm reload records',async ({page})=>{
  await page.goto('/'); await expect(page.locator('#game-grid')).toBeVisible();
  await page.keyboard.press('ArrowLeft'); expect(await saved(page)).toBeNull();
  await page.locator('a.card-action').click(); await expect(page).toHaveURL(/\/game\.html$/);
  await expect(page.locator('#board')).toBeFocused();
  await page.locator('#help-button').click(); await expect(page.locator('#dialog-content')).toContainText('24px');
  await page.getByRole('button',{name:'도움말 닫기',exact:true}).click();
  await shot(page,'playing'); 
  expect((await snapshot(page)).filter(Boolean)).toHaveLength(2); expect((await saved(page)).gamesStarted).toBe(1);
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#score')).toHaveText('4');
  const before=await snapshot(page); const p=await saved(page);
  await page.locator('#restart-button').click(); await page.keyboard.press('ArrowDown'); expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button',{name:'취소 · 돌아가기',exact:true}).click(); expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#board')).toBeFocused();
  await page.locator('#restart-button').click(); await page.getByRole('button',{name:'새 판 시작',exact:true}).click();
  expect((await snapshot(page)).filter(Boolean)).toHaveLength(2); await expect(page.locator('#score')).toHaveText('0');
  expect(await saved(page)).toMatchObject({gamesStarted:2,gamesFinished:0,totalMoves:1,totalScore:4,bestScore:4});
  await page.reload(); await expect(page.locator('#board')).toBeFocused(); expect((await saved(page)).gamesStarted).toBe(3);
  await expect(page.locator('#best-score')).toHaveText(String(p.bestScore));
});

test('02 keyboard focus repeat escape modal focus trap',async ({page})=>{
  await start(page); await page.keyboard.down('ArrowRight'); await expect(page.locator('#move-count')).toHaveText('1회 이동');
  await page.waitForTimeout(150); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(150);
  await expect(page.locator('#move-count')).toHaveText('1회 이동'); await page.keyboard.up('ArrowRight');
  await page.locator('#mute-button').focus(); const b=await snapshot(page); await page.keyboard.press('ArrowDown'); expect(await snapshot(page)).toEqual(b);
  await page.locator('#board').focus(); await page.keyboard.press('ArrowDown'); await expect(page.locator('#move-count')).toHaveText('2회 이동');
  await page.waitForTimeout(130); await page.keyboard.press('Escape'); await expect(page.locator('#dialog-title')).toHaveText('잠시 쉬어가요');
  await page.keyboard.press('Escape'); await expect(page.locator('#game-dialog')).toBeVisible();
  await page.getByRole('button',{name:'게임 재개',exact:true}).click(); await expect(page.locator('#board')).toBeFocused();
  await page.locator('#restart-button').click(); await page.keyboard.press('Escape'); await expect(page.locator('#game-dialog')).not.toBeVisible();
  expect((await saved(page)).gamesStarted).toBe(1);
  await page.locator('#help-button').click();
  for(let i=0;i<8;i++){ await page.keyboard.press(i%2?'Shift+Tab':'Tab'); expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.locator('#board')).toBeFocused();
});

test('03 feedback pause blur hidden and modal interruption',async ({page})=>{
  await start(page); await page.keyboard.press('ArrowLeft');
  await page.locator('#pause-button').evaluate((el:HTMLButtonElement)=>el.click());
  const b=await snapshot(page); await page.waitForTimeout(200); await page.keyboard.press('ArrowDown'); expect(await snapshot(page)).toEqual(b);
  await page.getByRole('button',{name:'이어서하기',exact:true}).click(); expect(await snapshot(page)).toEqual(b);
  for(const modal of ['help-button','restart-button']) {
    await page.locator('#'+modal).click(); const title=await page.locator('#dialog-title').textContent();
    await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); await expect(page.locator('#dialog-title')).toHaveText(title!);
    await page.keyboard.press('Escape'); await expect(page.locator('#dialog-title')).toHaveText('잠시 쉬어가요');
    expect(await snapshot(page)).toEqual(b); await page.getByRole('button',{name:'게임 재개',exact:true}).click();
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#dialog-title')).toHaveText('잠시 쉬어가요');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(150); await expect(page.locator('#dialog-title')).toHaveText('잠시 쉬어가요');
  await page.getByRole('button',{name:'게임 재개',exact:true}).click(); expect(await snapshot(page)).toEqual(b);
});

test('04 noop RNG counters audio and valid single spawn',async ({page})=>{
  await fixture(page,[[2,4,0,0],[8,16,0,0],[0,0,0,0],[0,0,0,0]]); await start(page);
  await page.evaluate(()=>{(window as any).qaRng=0;Math.random=()=>{(window as any).qaRng++;return 0;};});
  const before=await snapshot(page);const p=await saved(page);await page.keyboard.press('ArrowLeft');
  expect(await snapshot(page)).toEqual(before);expect(await saved(page)).toEqual(p);expect(await page.evaluate(()=>(window as any).qaRng)).toBe(0);
  await page.keyboard.press('ArrowDown'); await expect(page.locator('#move-count')).toHaveText('1회 이동');
  expect(await page.evaluate(()=>(window as any).qaRng)).toBe(2); expect((await snapshot(page)).filter(Boolean)).toHaveLength(5);
});

test('05 victory blocked priority result retry count once',async ({page})=>{
  await fixture(page,[[1024,1024,4,8],[2,8,16,32],[4,16,32,64],[8,32,64,128]]); await start(page);await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#dialog-title')).toHaveText('2048, 꽃이 피었습니다!');await expect(page.locator('#dialog-content')).toContainText('더 이상 이동할 수 없습니다');
  await expect(page.getByRole('button',{name:'계속 도전하기',exact:true})).toBeDisabled(); await shot(page,'victory-blocked');
  expect(await saved(page)).toMatchObject({gamesStarted:1,gamesWon:1,gamesFinished:1,totalMoves:1,totalScore:2048,bestScore:2048,bestTile:2048});
  const b=await snapshot(page);await page.keyboard.press('ArrowRight');expect(await snapshot(page)).toEqual(b);
  await page.getByRole('button',{name:'결과 보기',exact:true}).click();await expect(page.locator('#dialog-title')).toHaveText('이번 정원은 여기까지');
  await expect(page.locator('#dialog-content')).toContainText('새로운 개인 최고 기록');await shot(page,'result');
  await page.keyboard.press('Escape'); await expect(page.locator('#game-dialog')).toBeVisible();
  expect(await saved(page)).toMatchObject({gamesWon:1,gamesFinished:1,totalMoves:1,totalScore:2048});
  await page.locator('#dialog-content').getByRole('button',{name:'다시시작',exact:true}).click();await expect(page.locator('#game-dialog')).not.toBeVisible();
  expect((await snapshot(page)).filter(Boolean)).toHaveLength(2);expect((await saved(page)).gamesStarted).toBe(2);
  await page.locator('#gardens-button').click();await page.getByRole('button',{name:'기록·정원 닫기',exact:true}).click();
  expect(await saved(page)).toMatchObject({gamesStarted:2,gamesWon:1,gamesFinished:1,totalMoves:1,totalScore:2048});
});

test('06 movable win continue and 4096 actual text',async ({page})=>{
  await fixture(page,[[1024,1024,2048,0],...blank().slice(1)]);await start(page);await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button',{name:'계속 도전하기',exact:true})).toBeEnabled();await page.getByRole('button',{name:'계속 도전하기',exact:true}).click();
  await expect(page.locator('#board')).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.locator('#game-dialog')).not.toBeVisible();
  await expect(page.locator('.cell[data-value="4096"] .tile-number')).toHaveText('4096');
  await expect(page.locator('.cell[data-value="4096"]')).toHaveAttribute('data-art','2048');
  expect(await saved(page)).toMatchObject({gamesWon:1,totalScore:6144});await shot(page,'4096');
});

test('07 locked gardens unlock select reload preserve board',async ({page})=>{
  await start(page);await page.locator('#gardens-button').click();await expect(page.locator('.garden-choice')).toHaveCount(3);
  await expect(page.locator('.garden-choice button').nth(1)).toBeDisabled();await expect(page.locator('.garden-choice button').nth(2)).toBeDisabled();
  await shot(page,'gardens-locked');await page.getByRole('button',{name:'기록·정원 닫기',exact:true}).click();
  await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key)!);p.bestTile=1024;p.unlockedGardens=['seed','grove','bloom'];localStorage.setItem(key,JSON.stringify(p));},KEY);
  await page.reload();const b=await snapshot(page);await page.locator('#gardens-button').click();
  await page.locator('.garden-choice').nth(2).getByRole('button').click();await page.getByRole('button',{name:'기록·정원 닫기',exact:true}).click();
  expect(await snapshot(page)).toEqual(b);await expect(page.locator('body')).toHaveAttribute('data-garden','bloom');await shot(page,'gardens-bloom');
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-garden','bloom');expect((await saved(page)).selectedGarden).toBe('bloom');
});

test('08 corrupt storage and malicious theme safe recovery',async ({page})=>{
  await page.goto('/game.html');await page.evaluate(key=>{localStorage.setItem('qa-other-app','keep');localStorage.setItem(key,'{broken');},KEY);
  await page.reload();await expect(page.locator('#storage-warning')).toContainText('복구');expect(await page.evaluate(()=>localStorage.getItem('qa-other-app'))).toBe('keep');
  expect((await snapshot(page)).filter(Boolean)).toHaveLength(2);
  const malicious=profile({bestScore:128,totalScore:128,bestTile:256,selectedGarden:'<img src="https://invalid.test/x" onerror="window.qaXss=1">',unlockedGardens:['seed','evil','grove','grove'],muted:'bad'});
  await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key:KEY,p:malicious});await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-garden','seed');await expect(page.locator('#best-score')).toHaveText('128');
  expect(await saved(page)).toMatchObject({bestTile:256,unlockedGardens:['seed','grove'],selectedGarden:'seed',muted:true});
  expect(await page.evaluate(()=>(window as any).qaXss)).toBeUndefined();
});

for(const failure of ['access','read','write'] as const) test(`09 storage blocked ${failure} memory warning`,async ({page})=>{
  await page.addInitScript(mode=>{
    if(mode==='access') Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
    else Storage.prototype[mode==='read'?'getItem':'setItem']=function(){throw new DOMException('Blocked',mode==='read'?'SecurityError':'QuotaExceededError');};
  },failure);
  await start(page);await expect(page.locator('#storage-warning')).toContainText('저장되지 않습니다');await page.keyboard.press('ArrowLeft');await expect(page.locator('#score')).toHaveText('4');
  await page.locator('#restart-button').click();await page.getByRole('button',{name:'새 판 시작',exact:true}).click();await expect(page.locator('#storage-warning')).toBeVisible();
});

test('10 responsive layouts button 44px modal scroll reduced motion',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await start(page);
  const measurements=[];
  for(const [width,height] of [[320,568],[375,667],[768,1024],[1366,768],[667,375]]){
    await page.setViewportSize({width,height});
    const data=await page.evaluate(()=>{
      const board=document.querySelector('#board')!.getBoundingClientRect();
      const buttons=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}));
      return {overflow:document.documentElement.scrollWidth>innerWidth,board:{w:board.width,h:board.height},buttons};
    });measurements.push({width,height,...data});expect(data.overflow).toBe(false);expect(Math.abs(data.board.w-data.board.h)).toBeLessThan(1);
    expect(data.buttons.filter(b=>b.w<44||b.h<44)).toEqual([]);await shot(page,`layout-${width}x${height}`);
    await page.locator('#help-button').click();await page.getByRole('button',{name:'도움말 닫기',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'도움말 닫기',exact:true}).click();
  }
  await page.locator('#board').focus();await page.keyboard.press('ArrowLeft');expect(await page.locator('[data-merged],[data-spawned]').count()).toBe(0);
  await writeFile(`${out}/layout-${test.info().project.name}.json`,JSON.stringify(measurements,null,2));
});

test('11 pointer boundaries real mouse capture and cancel adapter',async ({page})=>{
  await start(page);await page.locator('#board').scrollIntoViewIfNeeded();const box=(await page.locator('#board').boundingBox())!;
  const x=box.x+box.width/2,y=box.y+box.height/2;
  for(const [dx,dy,expected] of [[23,0,0],[24,24,0],[24,0,1],[0,-24,1],[30,10,2]]){
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy);await page.mouse.up();
    await expect(page.locator('#move-count')).toHaveText(`${expected}회 이동`);await page.waitForTimeout(130);
  }
  const result=await page.evaluate(async()=>{
    const {bindInput}=await import('/scripts/input.js');const board=document.createElement('div');board.tabIndex=0;document.body.append(board);
    board.setPointerCapture=()=>{};const moves:string[]=[];const binding=bindInput(board,{enabled:()=>true,move:(d:string)=>moves.push(d),pause:()=>{}});
    function fire(type:string,id:number,x:number,primary=true){board.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',isPrimary:primary,clientX:x,clientY:0}));}
    fire('pointerdown',1,0);fire('pointercancel',1,0);fire('pointerup',1,60);
    fire('pointerdown',1,0);fire('pointerdown',2,0,false);fire('pointerup',2,60,false);fire('pointerup',1,60);
    fire('pointerdown',1,0);fire('lostpointercapture',1,0);fire('pointerup',1,60);
    fire('pointerdown',1,0);binding.reset();fire('pointerup',1,60);
    const invalid=[...moves];fire('pointerdown',1,0);fire('pointerup',1,24);const valid=[...moves];binding.destroy();board.remove();return {invalid,valid};
  });expect(result).toEqual({invalid:[],valid:['right']});
  expect(await page.locator('#board').evaluate(el=>getComputedStyle(el).touchAction)).toBe('none');
});

test('12 audio oscillator automation mute pause fallback no listening',async ({page})=>{
  await page.addInitScript(()=>{
    (window as any).qaAudio={created:0,started:0,stopped:0};
    const Native=window.AudioContext;
    if(Native) window.AudioContext=class extends Native { constructor(...args:any[]){super(...args);(window as any).qaAudio.created++;} createOscillator(){const o=super.createOscillator();const start=o.start.bind(o),stop=o.stop.bind(o);o.start=(...a:any[])=>{(window as any).qaAudio.started++;start(...a);};o.stop=(...a:any[])=>{(window as any).qaAudio.stopped++;stop(...a);};return o;} } as any;
  });
  await start(page);expect(await page.evaluate(()=>(window as any).qaAudio.created)).toBe(0);await page.locator('#mute-button').click();
  await page.waitForTimeout(150);const supported=await page.evaluate(()=>typeof window.AudioContext==='function');await page.locator('#board').focus();await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(()=>(window as any).qaAudio.started)).toBe(supported?1:0);
  await page.waitForTimeout(150);await page.keyboard.press('ArrowLeft');expect(await page.evaluate(()=>(window as any).qaAudio.started)).toBe(supported?1:0);
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).qaAudio.started)).toBe(supported?1:0);
  await page.locator('#mute-button').click();await page.reload();await expect(page.locator('#mute-button')).toContainText('소리 꺼짐');
  await page.evaluate(()=>{window.AudioContext=class {constructor(){throw Error('QA denied');}} as any;});
  await page.locator('#mute-button').click();await page.locator('#board').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('#score')).toHaveText('4');
});

test('13 security headers independent modules and rules differential',async ({page,request})=>{
  const response=await request.get('/');expect(response.status()).toBe(200);expect(response.headers()['x-content-type-options']).toBe('nosniff');expect(response.headers()['content-security-policy']).toContain("connect-src 'none'");
  await page.goto('/game.html');
  const result=await page.evaluate(async()=>{
    const e=await import('/scripts/engine.js'),s=await import('/scripts/state.js'),st=await import('/scripts/storage.js');
    let checked=0;
    const ref=(a:number[])=>{const v=a.filter(Boolean),o:number[]=[];let score=0;for(let i=0;i<v.length;i++){if(v[i]===v[i+1]){o.push(v[i]*2);score+=v[i]*2;i++;}else o.push(v[i]);}return {line:[...o,...Array(4-o.length).fill(0)],score};};
    for(let n=0;n<625;n++) {let x=n;const row=[];for(let i=0;i<4;i++){row.push([0,2,4,8,16][x%5]);x=Math.floor(x/5);}for(const d of ['left','right','up','down']){
      const b=Array.from({length:4},()=>[0,0,0,0]);const rev=d==='right'||d==='down';for(let i=0;i<4;i++){if(d==='left'||d==='right')b[0][i]=row[i];else b[i][0]=row[i];}
      const before=JSON.stringify(b);const r=e.move(b,d);const expected=ref(rev?[...row].reverse():row);const actual=d==='left'||d==='right'?r.board[0]:r.board.map((a:number[])=>a[0]);
      if(JSON.stringify(actual)!==JSON.stringify(rev?expected.line.reverse():expected.line)||r.scoreDelta!==expected.score||JSON.stringify(b)!==before)throw Error('Differential '+n+' '+d);checked++;
    }}
    const targets=[64,128,256,512,1024,2048].map(s.nextGoal);
    const normalized=[];for(const bad of [null,[],{},'x',{...st.defaultProfile(),version:0},{...st.defaultProfile(),bestScore:-1},{...st.defaultProfile(),gamesStarted:0,gamesWon:1}])normalized.push(st.normalizeProfile(bad).recovered);
    const themes=[];for(const g of ['seed','grove','bloom'])for(const muted of [true,false]){const p={...st.defaultProfile(),bestTile:1024,unlockedGardens:['seed','grove','bloom'],selectedGarden:g,muted};let a=s.startGame(s.createReady(p),()=>0);a=s.applyMove(a,'left',()=>0).state;themes.push({board:a.board,score:a.score,phase:a.phase});}
    return {checked,targets,normalized,themes};
  });
  expect(result.checked).toBe(2500);expect(result.targets).toEqual([128,256,512,1024,2048,null]);expect(result.normalized.every(Boolean)).toBe(true);
  for(const theme of result.themes)expect(theme).toEqual(result.themes[0]);await writeFile(`${out}/rules-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});

test('14 multitouch outside board must cancel gesture',async ({page,browserName})=>{
  await start(page);await page.locator('#board').scrollIntoViewIfNeeded();
  const before=await snapshot(page);
  if(browserName==='chromium') {
    const session=await page.context().newCDPSession(page);const b=(await page.locator('#board').boundingBox())!;
    const first={id:1,x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};
    const second={id:2,x:20,y:20};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,x:first.x+50},second]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
  } else {
    // WebKit has no CDP; browser-dispatched PointerEvents, capture shim only.
    await page.locator('#board').evaluate((board:HTMLElement)=>{
      const capture=board.setPointerCapture;board.setPointerCapture=()=>{};
      const event=(id:number,x:number,primary:boolean)=>({bubbles:true,pointerType:'touch',pointerId:id,isPrimary:primary,clientX:x,clientY:100});
      board.dispatchEvent(new PointerEvent('pointerdown',event(1,100,true)));
      document.body.dispatchEvent(new PointerEvent('pointerdown',event(2,20,false)));
      board.dispatchEvent(new PointerEvent('pointerup',event(1,150,true)));
      document.body.dispatchEvent(new PointerEvent('pointerup',event(2,20,false)));board.setPointerCapture=capture;
    });
  }
  const actual=await snapshot(page);await writeFile(`${out}/multitouch-${test.info().project.name}.json`,JSON.stringify({before,actual,mode:browserName==='chromium'?'CDP real browser touch dispatch':'synthetic PointerEvent capture adapter'},null,2));
  expect(actual,'second pointer outside board must invalidate first swipe').toEqual(before);
});

test('15 objective badge UI thresholds and immediate unlock',async ({page})=>{
  await fixture(page,[[512,512,0,0],...blank().slice(1)]);await start(page);
  await expect(page.locator('#next-goal')).toHaveText('1024');await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#next-goal')).toHaveText('2048');expect(await saved(page)).toMatchObject({bestTile:1024,selectedGarden:'seed',unlockedGardens:['seed','grove','bloom']});
  await page.locator('#gardens-button').click();await expect(page.locator('.garden-choice button').nth(2)).toBeEnabled();
});

test('16 touch single gesture chromium and scroll outside board',async ({page,browserName})=>{
  await start(page);await page.setViewportSize({width:375,height:667});await page.locator('#board').scrollIntoViewIfNeeded();
  if(browserName==='chromium') {
    const s=await page.context().newCDPSession(page);const b=(await page.locator('#board').boundingBox())!;
    const p={id:1,x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};
    const scroll=await page.evaluate(()=>scrollY);
    await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,x:p.x+24}]});
    await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#move-count')).toHaveText('1회 이동');expect(await page.evaluate(()=>scrollY)).toBe(scroll);
    await s.detach();
  } else {await page.touchscreen.tap(200,100);await expect(page.locator('#move-count')).toHaveText('0회 이동');}
  const before=await snapshot(page);await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);expect(await snapshot(page)).toEqual(before);
});
