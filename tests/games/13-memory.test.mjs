import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createReady, createDeck, startRound, reveal, advance, pause, resume, SNACKS, MODES, MAX_ATTEMPTS, MAX_ELAPSED_MS } from '../../public/games/13-memory/engine.mjs';
import { defaults, parseSave, compareBest, settleRecord, createStore, STORAGE_KEY, MAX_COMPLETIONS } from '../../public/games/13-memory/save.mjs';
const rng = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const round = mode => startRound(createReady(mode), rng(136));
function pair(s, matched = true) { const first = s.cards.find(c => !c.matched && !c.revealed); return [first.index, s.cards.find(c => c.index !== first.index && !c.matched && (c.id === first.id) === matched).index]; }
function finish(s) { while (s.phase === 'playing') { const [a,b] = pair(s); s = reveal(reveal(s,a),b); } return s; }
function ticks(s, amount) { while (amount > 0) { const dt = Math.min(250, amount); s = advance(s,dt); amount -= dt; } return s; }
const malicious = [undefined, null, true, false, '0', '', Symbol('x'), {}, { valueOf() { throw Error('coercion'); } }, [], NaN, Infinity, -Infinity, -1, .5];

// Execute the actual document gesture listeners, not a second implementation.
// An explicit read-only original path permits the same assertions as a red control.
const gestureSource = await readFile(process.env.G026_13_GESTURE_SOURCE || new URL('../../public/games/13-memory/main.mjs', import.meta.url), 'utf8');
function gestureHarness() {
  const listeners = new Map();
  class Element { closest() { return this; } }
  const target = new Element(), outside = new Element();
  const context = vm.createContext({ Element, Math, performance: { now: () => 100 }, document: { addEventListener(type, listener) { listeners.set(type, listener); } } });
  const start = gestureSource.indexOf('const targetOf =');
  const end = gestureSource.indexOf("document.addEventListener('keydown'", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext('let gesture = null;\n' + gestureSource.slice(start, end), context);
  const emit = (type, extra = {}) => {
    const event = { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20, target, detail: 1, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    listeners.get(type)?.(event); return event;
  };
  const tap = () => { emit('pointerdown'); emit('pointerup'); emit('lostpointercapture'); return emit('click'); };
  return { emit, tap, outside };
}
test('gesture: normal touch pointerup -> implicit lostcapture -> click activates once', () => {
  const h = gestureHarness(); assert.equal(h.tap().prevented, false); assert.equal(h.emit('click').prevented, true);
});
test('gesture: early lostcapture cancels only the matching active pointer', () => {
  const h = gestureHarness(); h.emit('pointerdown'); h.emit('lostpointercapture'); h.emit('pointerup'); assert.equal(h.emit('click').prevented, true); assert.equal(h.tap().prevented, false);
  h.emit('pointerdown'); h.emit('lostpointercapture', { pointerId: 2 }); h.emit('pointerup'); assert.equal(h.emit('click').prevented, false);
});
test('gesture: cancel, outside secondary, wrong up, scroll and >8px still cancel; next tap recovers', () => {
  for (const kind of ['pointercancel', 'secondary', 'wrong-up', 'scroll', 'move9', 'nonprimary', 'right', 'wrong-id']) {
    const h = gestureHarness(); h.emit('pointerdown', kind === 'nonprimary' ? { isPrimary: false } : kind === 'right' ? { button: 2 } : {});
    if (kind === 'secondary') h.emit('pointerdown', { pointerId: 2, isPrimary: false, target: h.outside });
    if (kind === 'pointercancel' || kind === 'scroll') h.emit(kind);
    if (kind === 'move9') h.emit('pointermove', { clientX: 29 });
    h.emit('pointerup', kind === 'wrong-up' ? { target: h.outside } : kind === 'wrong-id' ? { pointerId: 2 } : {});
    assert.equal(h.emit('click').prevented, true, kind); assert.equal(h.tap().prevented, false, kind + ' recovery');
  }
});
test('gesture: exactly8px remains valid; scroll after up cancels; keyboard remains independent', () => {
  const h = gestureHarness(); h.emit('pointerdown'); h.emit('pointermove', { clientX: 28 }); h.emit('pointerup', { clientX: 28 }); h.emit('lostpointercapture'); assert.equal(h.emit('click').prevented, false);
  h.emit('pointerdown'); h.emit('pointerup'); h.emit('scroll'); assert.equal(h.emit('click').prevented, true);
  h.emit('pointerdown'); h.emit('pointercancel'); assert.equal(h.emit('click', { detail: 0 }).prevented, false);
});
test('lifecycle: pagehide pauses/cancels without new image renders; pageshow masks faces without resuming', () => {
  const listeners = new Map(), document = { hidden: false, addEventListener(type, fn) { listeners.set(type, fn); } };
  const context = vm.createContext({ document, window: { addEventListener(type, fn) { listeners.set(type, fn); } } });
  const protection = gestureSource.match(/function protection\(\) \{[^\n]+\}/)?.[0];
  const start = gestureSource.indexOf("window.addEventListener('blur'");
  const end = gestureSource.indexOf("Object.defineProperty(window, '__g026Snapshot'", start);
  assert.ok(protection && start >= 0 && end > start);
  vm.runInContext("let pageLeaving=false, state={phase:'playing'}, stops=0, renders=0; const pause=s=>({...s,phase:'paused'}); const stopPump=()=>stops++; const render=()=>renders++;\n" + protection + '\n' + gestureSource.slice(start,end),context);
  const metrics = () => JSON.parse(vm.runInContext('JSON.stringify({state,stops,renders})',context));
  listeners.get('pagehide')(); assert.equal(metrics().state.phase,'paused'); assert.equal(metrics().stops,1); assert.equal(metrics().renders,0);
  document.hidden=true; listeners.get('visibilitychange')(); assert.equal(metrics().stops,2); assert.equal(metrics().renders,0);
  document.hidden=false; listeners.get('pageshow')(); assert.equal(metrics().state.phase,'paused'); assert.equal(metrics().renders,1);
  listeners.get('blur')(); assert.equal(metrics().renders,2);
});
for (const mode of ['easy','normal']) {
  test(`${mode}: deck is exactly twice each selected snack, deterministic and bounded`, () => {
    const deck = createDeck(mode,rng(55));
    assert.equal(deck.length,MODES[mode].pairs * 2); assert.deepEqual(deck,createDeck(mode,rng(55)));
    assert.equal(new Set(deck.map(c => c.index)).size, deck.length);
    for (const id of SNACKS.slice(0,MODES[mode].pairs)) assert.equal(deck.filter(c => c.id === id).length,2);
    assert.ok(deck.every(c => !c.revealed && !c.matched));
    assert.equal(createDeck(mode,() => 0).length,deck.length); assert.equal(createDeck(mode,() => 1 - Number.EPSILON).length,deck.length);
  });
  test(`${mode}: normal engine completion is synchronous and all matched`, () => {
    const done = finish(round(mode)); assert.equal(done.phase,'success'); assert.equal(done.attempts,MODES[mode].pairs); assert.equal(done.matchedPairs,MODES[mode].pairs); assert.ok(done.cards.every(c=>c.revealed&&c.matched)); assert.equal(reveal(done,0),done); assert.equal(advance(done,1),done);
  });
}
test('RNG rejection is atomic including throwing/coercion values and late failure', () => {
  for (const bad of [...malicious.filter(value => value !== .5), 1, 2]) { const s = round('easy'), before = structuredClone(s); let calls = 0; assert.throws(() => startRound(s,() => ++calls === 3 ? bad : .5)); assert.deepEqual(s,before); assert.equal(calls,3); }
  const s = round('normal'); assert.throws(()=>startRound(s,()=>{throw Error('RNG');})); assert.equal(s.roundId,1);
});
test('invalid mode and RNG function fail without inherited property admission',()=>{ for(const mode of ['toString','constructor','__proto__',Symbol(),{},null]) { assert.throws(()=>createDeck(mode)); assert.throws(()=>createReady(mode)); } assert.throws(()=>createDeck('easy',null)); });
test('input validation preserves exact identity and never coerces',()=>{ const s = round('easy'); for(const i of [...malicious,12,999]) assert.equal(reveal(s,i),s); });
test('first card starts timer; same card does not increment attempt',()=>{ let s=round('normal'); assert.equal(advance(s,10),s); s=reveal(s,0); assert.equal(s.firstFlipStarted,true); assert.equal(s.attempts,0); assert.equal(reveal(s,0),s); assert.equal(advance(s,125).activeElapsedMs,125); });
test('second distinct card increments once; no third card during mismatch',()=>{ let s=round('normal'); const [a,b]=pair(s,false); s=reveal(reveal(s,a),b); assert.equal(s.attempts,1); assert.deepEqual(s.mismatchIndices,[a,b]); assert.equal(s.mismatchRemainingMs,800); for(let i=0;i<s.cards.length;i++) assert.equal(reveal(s,i),s); });
test('799 + 1 mismatch closes exactly at 800 through legal dt steps',()=>{ let s=round('easy'); const [a,b]=pair(s,false); s=reveal(reveal(s,a),b); s=ticks(s,799); assert.equal(s.mismatchRemainingMs,1); assert.ok(s.cards[a].revealed&&s.cards[b].revealed); s=advance(s,1); assert.equal(s.mismatchRemainingMs,0); assert.equal(s.firstIndex,null); assert.equal(s.mismatchIndices,null); assert.ok(!s.cards[a].revealed&&!s.cards[b].revealed); assert.equal(s.activeElapsedMs,800); });
test('pause preserves remaining mismatch and elapsed; protection precedence',()=>{ let s=round('normal'); const [a,b]=pair(s,false); s=ticks(reveal(reveal(s,a),b),300); s=pause(s); assert.equal(s.pauseCause,'manual'); const frozen=s; assert.equal(advance(s,250),s); assert.equal(reveal(s,3),s); s=pause(s,'dialog'); assert.equal(s,frozen); s=pause(s,'protection'); assert.equal(s.pauseCause,'protection'); assert.equal(s.mismatchRemainingMs,500); s=ticks(resume(s),499); assert.equal(s.mismatchRemainingMs,1); s=advance(s,1); assert.equal(s.mismatchIndices,null); assert.equal(s.activeElapsedMs,800); });
test('matched input is noop and next pair can reveal immediately',()=>{ let s=round('normal'); const [a,b]=pair(s); s=reveal(reveal(s,a),b); assert.equal(s.matchedPairs,1); assert.equal(s.firstIndex,null); assert.equal(reveal(s,a),s); const [next]=pair(s); assert.equal(reveal(s,next).firstIndex,next); });
test('advance rejects invalid and oversized dt with identity',()=>{ const s=reveal(round('easy'),0); for(const dt of [...malicious.filter(value => value !== .5),0,251,Number.MAX_VALUE]) assert.equal(advance(s,dt),s); });
test('restart is a fresh token and does not share old mutable card state',()=>{ let old=round('normal'); const [a,b]=pair(old,false); old=ticks(reveal(reveal(old,a),b),500); const fresh=startRound(old,rng(4)); ticks(old,300); assert.equal(fresh.roundId,old.roundId+1); assert.equal(fresh.activeElapsedMs,0); assert.equal(fresh.attempts,0); assert.ok(fresh.cards.every(c=>!c.revealed)); });
test('attempt cap ends limit, all matched success has priority at cap',()=>{ let s=round('easy'); const [a,b]=pair(s,false); s={...s,attempts:MAX_ATTEMPTS-1}; s=reveal(reveal(s,a),b); assert.equal(s.phase,'limit'); assert.equal(s.attempts,MAX_ATTEMPTS); let final=round('easy'); for(let n=0;n<5;n++){const [c,d]=pair(final);final=reveal(reveal(final,c),d);} final={...final,attempts:MAX_ATTEMPTS-1}; const [c,d]=pair(final); final=reveal(reveal(final,c),d); assert.equal(final.phase,'success'); assert.equal(final.attempts,MAX_ATTEMPTS); });
test('time cap saturates without overflow and protective result is not success',()=>{ const s={...reveal(round('normal'),0),activeElapsedMs:MAX_ELAPSED_MS-.5}; const end=advance(s,250); assert.equal(end.phase,'limit'); assert.equal(end.activeElapsedMs,MAX_ELAPSED_MS); assert.equal(advance(end,1),end); assert.equal(settleRecord(defaults().modes.normal,end).comparison,null); });
test('ready/result pause and resume are identity noops; invalid causes noop',()=>{ const s=createReady();assert.equal(pause(s),s);assert.equal(resume(s),s);const playing=round('normal');assert.equal(pause(playing,'constructor'),playing);assert.equal(resume(playing),playing); });
test('best comparison is attempts then integer time, exact tie preserves best identity',()=>{ const best={attempts:12,elapsedMs:1000}; assert.equal(compareBest({attempts:11,elapsedMs:999999},best),'new'); assert.equal(compareBest({attempts:13,elapsedMs:1},best),'kept'); assert.equal(compareBest({attempts:12,elapsedMs:999},best),'new'); assert.equal(compareBest({...best},best),'tie'); let s={...finish(round('easy')),attempts:12,activeElapsedMs:1000.9}; const result=settleRecord({completions:5,best},s); assert.equal(result.comparison,'tie'); assert.equal(result.record.best,best); assert.equal(result.record.completions,6); });
test('success stores at least 1ms and completion cap still allows better best',()=>{ const s=finish(round('easy')); const record=settleRecord({completions:MAX_COMPLETIONS,best:{attempts:9,elapsedMs:5000}},s).record; assert.equal(record.completions,MAX_COMPLETIONS); assert.deepEqual(record.best,{attempts:6,elapsedMs:1}); });
test('missing storage defaults, malformed JSON and version are isolated resets',()=>{ assert.equal(parseSave(null).warning,false); for(const raw of ['{','null','[]','42','{"version":2}']){ const result=parseSave(raw);assert.equal(result.warning,true);assert.deepEqual(result.data,defaults()); } });
test('independent settings field recovery and each mode recovery',()=>{ const input=defaults(); input.settings={mode:'easy',theme:'unknown',muted:false}; input.modes.easy={completions:1,best:{attempts:6,elapsedMs:50}}; input.modes.normal={completions:1,best:null}; input.extra={a:1}; const out=parseSave(JSON.stringify(input)); assert.equal(out.warning,true); assert.deepEqual(out.data.settings,{mode:'easy',theme:'cream',muted:false});assert.deepEqual(out.data.modes.easy,input.modes.easy);assert.deepEqual(out.data.modes.normal,defaults().modes.normal); });
test('storage primitive ranges and cross field relations reject corruption per record',()=>{ const badRecords=[{completions:0,best:{attempts:6,elapsedMs:1}},{completions:1,best:null},{completions:-1,best:null},{completions:1000001,best:{attempts:6,elapsedMs:1}},{completions:1,best:{attempts:5,elapsedMs:1}},{completions:1,best:{attempts:6,elapsedMs:0}},{completions:1,best:{attempts:999999+1,elapsedMs:1}},{completions:1,best:{attempts:6,elapsedMs:86400001}},{completions:'1',best:{attempts:6,elapsedMs:1}},{completions:1,best:{attempts:6.5,elapsedMs:1}}]; for(const record of badRecords){const data=defaults();data.modes.easy=record;data.settings.theme='evening';const out=parseSave(JSON.stringify(data));assert.equal(out.warning,true);assert.equal(out.data.settings.theme,'evening');assert.deepEqual(out.data.modes.easy,defaults().modes.easy);} });
test('valid record/settings round trip with unknown properties ignored',()=>{ const data=defaults(); data.modes.normal={completions:1000000,best:{attempts:999999,elapsedMs:86400000}};data.settings.mode='easy'; data.settings.theme='meadow';data.unknown=3; const parsed=parseSave(JSON.stringify(data));assert.equal(parsed.warning,false);assert.deepEqual(parsed.data.modes,data.modes);assert.equal(Object.hasOwn(parsed.data,'unknown'),false); });
function memoryStorage(raw=null){const map=new Map([['other-game','exact preserved']]);if(raw!==null)map.set(STORAGE_KEY,raw);let writes=0;return {map,get writes(){return writes;},getItem:key=>map.get(key)??null,setItem(key,value){writes++;map.set(key,value);}};}
test('store does not write load/pause/retry/noop settings and writes only own key',()=>{ const storage=memoryStorage();const store=createStore(()=>storage);assert.equal(storage.writes,0);assert.equal(store.applySettings({mode:'normal'}),false);assert.equal(store.applySettings({theme:'constructor',muted:'false'}),false);assert.equal(storage.writes,0);store.applySettings({theme:'evening'});assert.equal(storage.writes,1);assert.equal(storage.map.get('other-game'),'exact preserved');assert.equal(store.settle(round('normal')),null);assert.equal(storage.writes,1); });
test('store settles once per round, retry retains records and mode records separate',()=>{ const storage=memoryStorage();const store=createStore(()=>storage);const done=finish(round('easy'));assert.equal(store.settle(done),'new');assert.equal(store.settle(structuredClone(done)),null);assert.equal(storage.writes,1);const next=finish(startRound(done,rng(8)));assert.equal(store.settle(next),'tie');assert.equal(storage.writes,2);assert.equal(store.snapshot().modes.easy.completions,2);assert.equal(store.snapshot().modes.normal.completions,0); });
for(const failure of ['getter','getItem','setItem']) test(`storage ${failure} exception is playable with persistent warning and in memory result`,()=>{const storage={getItem(){if(failure==='getItem')throw Error('read');return null;},setItem(){if(failure==='setItem')throw Error('write');}};const store=createStore(()=>{if(failure==='getter')throw Error('getter');return storage;});const done=finish(round('normal'));assert.equal(store.settle(done),'new');assert.equal(store.snapshot().modes.normal.completions,1);assert.equal(store.warning(),true);store.applySettings({muted:false});assert.equal(store.snapshot().settings.muted,false);assert.equal(store.warning(),true);});
test('snapshot is deeply detached, including nested best',()=>{ const storage=memoryStorage();const store=createStore(()=>storage);store.settle(finish(round('easy')));const snapshot=store.snapshot();snapshot.settings.mode='normal';snapshot.modes.easy.best.attempts=99;assert.equal(store.snapshot().modes.easy.best.attempts,6); });
test('original 8 fronts + 3 backs manifest hashes and no external SVG content',async()=>{const base=new URL('../../public/games/13-memory/assets/',import.meta.url);const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));assert.equal(manifest.fronts.length,8);assert.equal(manifest.backs.length,3);const files=await readdir(base);assert.equal(files.filter(f=>f.endsWith('.svg')).length,11);const hashes=[];for(const asset of [...manifest.fronts,...manifest.backs]){const svg=await readFile(new URL(`${asset.id}.svg`,base),'utf8');const hash=createHash('sha256').update(svg).digest('hex');assert.equal(hash,asset.sha256);assert.match(svg,/viewBox="0 0 64 64"/);assert.doesNotMatch(svg,/<script|<foreignObject|href=|url\(|<image|onload=/i);hashes.push(hash);}assert.equal(new Set(hashes).size,11); });
