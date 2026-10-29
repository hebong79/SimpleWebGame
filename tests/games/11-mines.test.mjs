import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition as step, neighbors, seededRng } from '../../public/games/11-mines/engine.mjs';
import { createStorage, defaults, validateRecord, settleRecord, STORAGE_KEY, LIMIT, MAX_BEST_MS } from '../../public/games/11-mines/save.mjs';
import { createTimer } from '../../public/games/11-mines/timer.mjs';
const start = () => step(createGame(), 'start');
const around = i => Array.from({length:81},(_,j)=>j).filter(j=>j!==i && Math.abs(Math.floor(i/9)-Math.floor(j/9))<=1 && Math.abs(i%9-j%9)<=1);
function invariants(s) {
  assert.equal(s.openedCount,s.opened.filter(Boolean).length);
  assert.equal(s.flagCount,s.flagged.filter(Boolean).length);
  assert.ok(s.flagCount>=0 && s.flagCount<=10);
  for(let i=0;i<81;i++) { assert.ok(!(s.opened[i]&&s.flagged[i])); if(s.opened[i]) assert.equal(s.mines[i],false); }
}
test('ready and flag-only play consume no RNG and no round result',()=>{
 let calls=0,s=createGame();const rng=()=>{calls++;return .3;};
 assert.equal(step(s,'reveal',0,rng),s);s=step(s,'start');
 for(let i=0;i<10;i++)s=step(s,'flag',i,rng);
 assert.equal(s.status,'playing');assert.equal(s.armed,false);assert.equal(calls,0);assert.equal(s.openedCount,0);
 assert.equal(step(s,'flag',10,rng),s);assert.equal(step(s,'reveal',0,rng),s);
 s=step(s,'flag',0,rng);assert.equal(s.flagCount,9);assert.equal(s.armed,false);assert.equal(calls,0);invariants(s);
});
test('every first index x 32 seeds: exactly ten mines, excluded 3x3, zero first, adjacency independent oracle',()=>{
 for(let first=0;first<81;first++)for(let seed=0;seed<32;seed++){
  const before=start(), copy=structuredClone(before), s=step(before,'reveal',first,seededRng(seed));
  assert.deepEqual(before,copy);assert.equal(s.mines.filter(Boolean).length,10);assert.equal(s.adjacent[first],0);
  for(const i of [first,...around(first)])assert.equal(s.mines[i],false);
  for(let i=0;i<81;i++)assert.equal(s.adjacent[i],around(i).filter(j=>s.mines[j]).length);
  invariants(s);
 }
});
test('neighbors corners/edges/center and invalid primitive values',()=>{
 assert.deepEqual(neighbors(0),[1,9,10]);assert.equal(neighbors(4).length,5);assert.equal(neighbors(40).length,8);assert.equal(neighbors(80).length,3);
 for(const x of [-1,81,1.5,NaN,Infinity,'1',Symbol('x'),{}])assert.deepEqual(neighbors(x),[]);
});
test('bounded partial shuffle: constant zero/near-one/one/out-of-range/invalid/throwing RNG exactly 10 calls',()=>{
 for(const value of [0,1-Number.EPSILON,1,-1,2,NaN,Infinity,-Infinity,undefined,null,'0',Symbol('r'),{}]){
  let calls=0;const s=step(start(),'reveal',40,()=>{calls++;return value;});
  assert.equal(calls,10);assert.equal(s.mines.filter(Boolean).length,10);assert.equal(s.adjacent[40],0);
 }
 let calls=0;const s=step(start(),'reveal',80,()=>{calls++;throw Error('rng');});assert.equal(calls,10);assert.equal(s.mines.filter(Boolean).length,10);
});
test('seed RNG reproducible with unsigned arithmetic and bounded finite output',()=>{
 const a=seededRng(15),b=seededRng(15);for(let i=0;i<100;i++){const value=a();assert.equal(value,b());assert.ok(value>=0&&value<1);}
 assert.equal(seededRng(NaN)(),seededRng(0)());
});
test('flood exactly matches independent zero-component boundary and does not open flagged zero',()=>{
 for(let seed=0;seed<50;seed++){
  let s=start();s=step(s,'flag',1);s=step(s,'reveal',0,seededRng(seed));
  const expected=new Set(), pending=[0];
  while(pending.length){const i=pending.shift();if(expected.has(i)||s.flagged[i]||s.mines[i])continue;expected.add(i);if(s.adjacent[i]===0)pending.push(...around(i).filter(j=>!expected.has(j)));}
  assert.deepEqual(s.opened,Array.from({length:81},(_,i)=>expected.has(i)));assert.equal(s.opened[1],false);assert.equal(s.flagged[1],true);
 }
});
test('flag-protected safe square prevents victory until explicit unflag and reveal; victory needs exactly 71',()=>{
 let s=step(start(),'flag',1);s=step(s,'reveal',0,seededRng(2));
 for(let i=0;i<81;i++)if(!s.mines[i]&&!s.flagged[i])s=step(s,'reveal',i);
 assert.equal(s.status,'playing');assert.equal(s.openedCount,70);
 s=step(s,'flag',1);assert.equal(s.openedCount,70);s=step(s,'reveal',1);assert.equal(s.status,'won');assert.equal(s.openedCount,71);invariants(s);
 for(const command of ['start','pause','resume','flag','reveal'])assert.equal(step(s,command,20),s);
});
test('mine reveal is terminal loss, wrong flags preserved, results reject all later inputs',()=>{
 let s=step(start(),'reveal',40,seededRng(93));const mine=s.mines.indexOf(true);s=step(s,'reveal',mine);
 assert.equal(s.status,'lost');assert.equal(s.exploded,mine);invariants(s);
 for(const command of ['start','pause','resume','flag','reveal'])assert.equal(step(s,command,0),s);
});
test('pause and resume preserve exact board and reject input while paused',()=>{
 let s=step(start(),'reveal',0,seededRng(10));const p=step(s,'pause');assert.equal(p.status,'paused');assert.equal(p.mines,s.mines);
 for(const c of ['flag','reveal','start','pause'])assert.equal(step(p,c,80),p);
 const r=step(p,'resume');assert.equal(r.status,'playing');assert.equal(r.opened,s.opened);assert.equal(step(r,'resume'),r);
});
test('command inherited keys, Symbols and side-effect objects: identical object no-op and zero coercion/RNG',()=>{
 const s=start();let coercions=0,calls=0;const obj={toString(){coercions++;throw Error('coercion');},[Symbol.toPrimitive](){coercions++;throw Error('coercion');}};
 for(const c of ['toString','constructor','__proto__','hasOwnProperty','valueOf','REVEAL','',null,undefined,1,Symbol('reveal'),obj])assert.equal(step(s,c,0,()=>{calls++;return 0;}),s);
 for(const i of [-1,81,.5,NaN,Infinity,'0',null,undefined,Symbol('0'),obj])for(const c of ['reveal','flag'])assert.equal(step(s,c,i,()=>{calls++;return 0;}),s);
 assert.equal(coercions,0);assert.equal(calls,0);
});
test('opened/flagged reveal no-op preserves identity and RNG',()=>{
 let calls=0,s=step(start(),'reveal',0,seededRng(4));assert.equal(step(s,'reveal',0,()=>calls++),s);assert.equal(step(s,'flag',0),s);
 const i=s.opened.findIndex(x=>!x);s=step(s,'flag',i);assert.equal(step(s,'reveal',i,()=>calls++),s);assert.equal(calls,0);
});
test('random legal command sequence retains invariants across 100 games',()=>{
 for(let seed=0;seed<100;seed++){const rng=seededRng(seed), boardRng=seededRng(seed+20);let s=start();for(let turn=0;turn<150;turn++){s=step(s,rng()<.3?'flag':'reveal',Math.floor(rng()*81),boardRng);invariants(s);}}
});
test('record defaults and valid independent key/version round trip',()=>{
 const memory=new Map([['another.game.v1','keep']]),store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};const adapter=createStorage(()=>store);
 assert.deepEqual(adapter.load(),defaults());const r=settleRecord(defaults(),'won',300);assert.equal(adapter.save({...r,theme:'night',muted:false}),true);assert.deepEqual(adapter.load(),{...r,theme:'night',muted:false});assert.equal(memory.get('another.game.v1'),'keep');assert.ok(memory.has(STORAGE_KEY));
});
test('record wins/losses/best relation and impossible aggregate recovery',()=>{
 const valid=settleRecord(defaults(),'won',123);
 for(const patch of [{version:0},{version:2},{finished:2},{wins:0},{losses:1},{finished:1.5},{finished:NaN},{wins:Infinity},{losses:-1},{bestMs:null},{bestMs:0},{bestMs:Infinity},{bestMs:1.2},{bestMs:MAX_BEST_MS+1},{finished:Number.MAX_SAFE_INTEGER}])assert.deepEqual(validateRecord({...valid,...patch}),defaults());
 assert.deepEqual(validateRecord({...defaults(),bestMs:10}),defaults());
 assert.deepEqual(validateRecord({...valid,theme:'constructor'}),{...valid,theme:'paper'});assert.deepEqual(validateRecord({...valid,theme:{}}),{...valid,theme:'paper'});
 for(const x of [null,[],0,'data',{}])assert.deepEqual(validateRecord(x),defaults());
});
test('settlement success best/tie/loss and invalid outcome no-op',()=>{
 let r=settleRecord(defaults(),'won',200);r=settleRecord(r,'won',200);assert.equal(r.bestMs,200);r=settleRecord(r,'won',100);assert.equal(r.bestMs,100);r=settleRecord(r,'lost',1);assert.deepEqual(r,{version:1,finished:4,wins:3,losses:1,bestMs:100,theme:'paper',muted:true});
 for(const c of ['toString','constructor','__proto__',Symbol('won'),{}])assert.equal(settleRecord(r,c,1),r);for(const t of [0,-1,NaN,Infinity,1.5,'2'])assert.equal(settleRecord(r,'won',t),r);
});
test('saturating totals preserve finished relation and best validity, including all-loss cap',()=>{
 const losses={...defaults(),finished:LIMIT,losses:LIMIT};assert.deepEqual(validateRecord(settleRecord(losses,'won',1)),losses);
 const wins={...defaults(),finished:LIMIT,wins:LIMIT,bestMs:200};assert.equal(settleRecord(wins,'won',100),wins);assert.equal(settleRecord(wins,'lost',1),wins);assert.deepEqual(validateRecord(wins),wins);
});
test('storage getter/read/write failures remain in-memory and never delete unrelated values',()=>{
 for(const getter of [()=>{throw Error('getter');},()=>({getItem(){throw Error('read');}})]){const a=createStorage(getter);assert.deepEqual(a.load(),defaults());assert.equal(a.blocked,true);}
 const a=createStorage(()=>({getItem:()=>null,setItem(){throw Error('write');}}));const r=a.load();assert.equal(a.save(r),false);assert.equal(a.blocked,true);
});
test('malformed JSON, old version and corrupt shape recovered without throwing',()=>{
 for(const raw of ['{','null','[]','{"version":0}','{"version":1,"finished":null}']){const a=createStorage(()=>({getItem:()=>raw}));assert.deepEqual(a.load(),defaults());assert.equal(a.recovered,true);assert.equal(a.blocked,false);}
});
test('timer starts on demand, monotonic active milliseconds only, pause/resume and result once',()=>{
 let now=0;const t=createTimer(()=>now);now=100;assert.equal(t.read(),0);t.start();now=150.9;assert.equal(t.read(),50);t.pause();now=1000;assert.equal(t.read(),50);t.start();now=1020.9;const final=t.finish();assert.equal(final,71);now=9000;assert.equal(t.finish(),final);assert.equal(t.read(),final);t.start();assert.equal(t.read(),final);t.reset();assert.equal(t.read(),0);
});
test('timer minimum1 and no fabricated cap; backwards clock delta cannot subtract active time',()=>{
 let now=100;const t=createTimer(()=>now);t.start();now=99;assert.equal(t.read(),0);assert.equal(t.finish(),1);t.reset();t.start();now=LIMIT*2;assert.equal(t.finish(),now-99);
});
test('D02 invalid RNG values yield the exact zero-sample board without coercion',()=>{
 const expected=step(start(),'reveal',40,()=>0);let coerced=0;const object={valueOf(){coerced++;throw Error('no');},toString(){coerced++;throw Error('no');}};
 for(const value of [1,-.1,2,NaN,Infinity,undefined,null,'0',Symbol('x'),object]){let calls=0;const actual=step(start(),'reveal',40,()=>{calls++;return value;});assert.deepEqual(actual,expected);assert.equal(calls,10);}
 for(const rng of [null,undefined,1,'function',object,Symbol('rng')])assert.deepEqual(step(start(),'reveal',40,rng),expected);
 assert.deepEqual(step(start(),'reveal',40,()=>{throw Error('rng');}),expected);assert.equal(coerced,0);
});
test('D03 v1 damaged statistics preserve valid theme and mute; settings recover separately',()=>{
 const valid={...settleRecord(defaults(),'won',123),theme:'night',muted:false};
 for(const patch of [{finished:2},{wins:0},{bestMs:null},{bestMs:NaN},{bestMs:Infinity},{bestMs:-1}])assert.deepEqual(validateRecord({...valid,...patch}),{...defaults(),theme:'night',muted:false});
 assert.deepEqual(validateRecord({...valid,muted:'false'}),{...valid,muted:true});assert.deepEqual(validateRecord({...valid,theme:'missing'}),{...valid,theme:'paper'});
 assert.deepEqual(validateRecord({...valid,version:0}),defaults());assert.deepEqual(validateRecord(Object.create(valid)),defaults());
 const inherited=Object.assign(Object.create({theme:'night',muted:false,finished:1,wins:1,losses:0,bestMs:2}),{version:1});assert.deepEqual(validateRecord(inherited),defaults());
 assert.deepEqual(validateRecord({...valid,unknown:'ignored'}),valid);
});
test('D04 best time accepts MAX_SAFE_INTEGER, rejects nonfinite/unsafe/fraction without clamp',()=>{
 for(const elapsed of [LIMIT+1,MAX_BEST_MS]){const r=settleRecord(defaults(),'won',elapsed);assert.equal(r.bestMs,elapsed);assert.deepEqual(validateRecord(r),r);}
 for(const elapsed of [MAX_BEST_MS+1,NaN,Infinity,-Infinity,-1,1.5,'2',Symbol('ms'),{}]){const r=defaults();assert.equal(settleRecord(r,'won',elapsed),r);}
});
