import assert from 'node:assert/strict';
import {test} from 'node:test';
import { LEVELS } from '../../public/games/10-sokoban/levels.mjs';
import { BOARDS, createGame, parseLevel, move, undo, cornerDeadlocks, snapshot } from '../../public/games/10-sokoban/engine.mjs';
import { STORAGE_KEY, availableSets, canEquip, defaultRecord, validateRecord, settleClear, equipRecord, createPersistence } from '../../public/games/10-sokoban/save.mjs';
const fixture=(rows)=>createGame({id:0,name:'unit-only',rows});
const play=(state,path)=>[...path].reduce((s,d)=>move(s,d),state);
const clears=n=>{let r=defaultRecord();for(let id=1;id<=n;id++)r=settleClear(r,id,{pushes:LEVELS[id-1].pushes,moves:LEVELS[id-1].moves}).record;return r;};
function canonical(rows){
  let grid=rows.map(r=>[...r]);const variants=[];
  for(let turn=0;turn<4;turn++){
    variants.push(grid.map(r=>r.join('')).join('\n'),grid.map(r=>[...r].reverse().join('')).join('\n'));
    grid=grid[0].map((_,x)=>grid.map(r=>r[x]).reverse());
  }
  return variants.sort()[0];
}
test('exactly 20 original rectangular levels, box curriculum, no mirrored/transposed copies',()=>{
  assert.equal(LEVELS.length,20);assert.equal(new Set(LEVELS.map(l=>canonical(l.rows))).size,20);
  LEVELS.forEach((l,i)=>{const b=BOARDS[i];assert.equal(l.id,i+1);assert.ok(b.width<=8&&b.height<=8);assert.equal(b.initialBoxes.length,i<5?1:i<12?2:3);assert.equal(b.goals.length,b.initialBoxes.length);assert.equal(new Set([...b.initialBoxes,b.initialPlayer]).size,b.initialBoxes.length+1);assert.ok(!b.initialBoxes.every(p=>b.goals.includes(p)));assert.match(l.solution,/^[UDLR]+$/);});
});
for(const level of LEVELS)test(`all-level replay ${level.id}: ${level.name}`,()=>{
  let state=createGame(level.id);
  [...level.solution].forEach((direction,index)=>{const previous=state;state=move(state,direction);assert.notEqual(state,previous,`step ${index} is legal`);assert.equal(state.won,index===level.solution.length-1,'win only on final input');});
  assert.equal(state.won,true);assert.equal(state.pushes,level.pushes);assert.equal(state.moves,level.moves);assert.equal(state.history.length,level.moves);assert.ok(state.board.goals.every(p=>state.boxes.includes(p)));
  assert.equal(move(state,'U'),state);assert.equal(undo(state),state);
});
test('invalid walls and directions are exact no-ops, including history',()=>{let s=createGame(1);s=move(s,'U');const before=s;assert.equal(move(s,'U'),before);assert.equal(move(s,'diagonal'),before);assert.equal(undo(createGame(1)).moves,0);});
const invalidDirections=[
  ...Object.getOwnPropertyNames(Object.prototype).map(value=>[`inherited ${value}`,value]),
  ...['','u','r','RR',' R','R ','diagonal'].map(value=>[`unknown string ${JSON.stringify(value)}`,value]),
  ['null',null],['undefined',undefined],['zero',0],['number',1],['negative number',-1],['NaN',NaN],['infinity',Infinity],['bigint',1n],['true',true],['false',false],
  ['object',{}],['null-prototype object',Object.create(null)],['array',[]],['direction array',['R']],['boxed direction',new String('R')],
  ['stringifying direction',{toString:()=> 'R'}],['primitive direction',{[Symbol.toPrimitive]:()=> 'R'}],
  ['throwing coercion',{[Symbol.toPrimitive](){throw new Error('Invalid direction must not be coerced');}}],
  ['function',()=> 'R'],['stringifying function',Object.assign(()=>{}, {toString:()=> 'R'})],['symbol',Symbol('R')],
  ['throwing proxy',new Proxy({}, {get(){throw new Error('Invalid direction properties must not be read');}})],
  ['revoked proxy',(()=>{const {proxy,revoke}=Proxy.revocable({},{});revoke();return proxy;})()],
];
for(const [name,direction] of invalidDirections)test(`invalid direction is an identical-state no-op: ${name}`,()=>{
  for(const state of [createGame(1),move(createGame(1),'R'),play(createGame(1),'RR')]){
    const before=snapshot(state),history=state.history,boxes=state.boxes;
    assert.strictEqual(move(state,direction),state);
    assert.deepEqual(state,before);
    assert.strictEqual(state.history,history);assert.strictEqual(state.boxes,boxes);
    assert.equal(state.moves,before.moves);assert.equal(state.pushes,before.pushes);
  }
});
test('cannot push two adjacent boxes or pull a box',()=>{const s=fixture(['#######','#     #','# @$$.#','#   . #','#######']);assert.equal(move(s,'R'),s);const left=move(s,'L');assert.deepEqual(left.boxes,s.boxes);assert.equal(left.pushes,0);});
test('cannot push box through wall',()=>{const s=fixture(['######','# @$##','# .  #','######']);assert.equal(move(s,'R'),s);});
test('goals remain static beneath moving boxes and player',()=>{
  const s=fixture(['########','#      #','# @$.. #','#   $  #','#      #','########']);
  const on=move(s,'R'),off=move(on,'R');assert.deepEqual(on.board.goals,s.board.goals);assert.deepEqual(off.board.goals,s.board.goals);assert.ok(on.board.goals.includes(on.boxes[0]));assert.ok(off.board.goals.includes(off.player));assert.equal(undo(off).player,on.player);
});
test('unlimited undo restores exact player boxes counters and every prior history',()=>{
  let s=fixture(['#######','#@    #','#  $ .#','#     #','#######']);const saved=[s];
  for(let i=0;i<600;i++){s=move(s,i%2?'L':'R');saved.push(s);}assert.equal(s.history.length,600);
  for(let i=599;i>=0;i--){s=undo(s);assert.deepEqual(s,saved[i]);}
});
test('push undo restores counters and does not mutate old state',()=>{const s=createGame(1),copy=snapshot(s),next=move(s,'R');assert.equal(next.pushes,1);assert.equal(next.moves,1);assert.deepEqual(s,copy);assert.deepEqual(undo(next),s);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.boxes)&&Object.isFrozen(s.history));});
test('corner deadlocks are advisory, goals are exempt, undo still works',()=>{
  const s=fixture(['######','# $@ #','#  . #','#    #','######']);const stuck=move(s,'L');assert.equal(stuck.won,false);assert.equal(cornerDeadlocks(stuck).length,1);assert.deepEqual(undo(stuck),s);assert.equal(cornerDeadlocks(play(createGame(1),LEVELS[0].solution)).length,0);
});
test('snapshot is independently mutable without touching engine',()=>{const s=createGame(1),c=snapshot(s);c.boxes[0]=0;c.board.goals.length=0;c.history.push({});assert.notEqual(c.boxes[0],s.boxes[0]);assert.ok(s.board.goals.length);assert.equal(s.history.length,0);});
for(const [name,rows] of [
 ['open border',['#####','#@$.#','#   #']],['unequal width',['#####','#@$.##','#####']],['no player',['#####','# $.#','#####']],['multiple players',['######','#@@$.#','######']],['no goals',['#####','#@$ #','#####']],['initially solved',['#####','#@* #','#####']],['unknown tile',['#####','#@x.#','#####']],['disconnected',['########','#@ #$ .#','########']],
])test(`invalid map rejects ${name}`,()=>assert.throws(()=>parseLevel({rows})));
test('default record valid and load/recovery never writes or removes any key',()=>{
  let writes=0,removes=0;const storage={getItem:key=>{assert.equal(key,STORAGE_KEY);return null;},setItem:()=>writes++,removeItem:()=>removes++};const p=createPersistence(()=>storage);assert.deepEqual(p.load(),defaultRecord());assert.equal(writes,0);assert.equal(removes,0);assert.ok(validateRecord(defaultRecord()));
});
test('sequential clears unlock exactly one stage and cap at 20',()=>{for(let n=0;n<=20;n++){const r=clears(n);assert.equal(r.unlocked,Math.min(20,n+1));assert.deepEqual(r.cleared,Array.from({length:n},(_,i)=>i+1));assert.ok(validateRecord(r));}assert.throws(()=>settleClear(defaultRecord(),2,{pushes:3,moves:3}));});
test('per-level best lexicographic pushes before moves, tie then moves',()=>{
  let r=settleClear(defaultRecord(),1,{pushes:5,moves:20}).record;
  r=settleClear(r,1,{pushes:4,moves:100}).record;assert.deepEqual(r.bests[1],{pushes:4,moves:100});
  r=settleClear(r,1,{pushes:4,moves:30}).record;assert.deepEqual(r.bests[1],{pushes:4,moves:30});
  const result=settleClear(r,1,{pushes:5,moves:6});assert.equal(result.improved,false);assert.deepEqual(result.record.bests[1],r.bests[1]);assert.equal(result.record.cleared.length,1);
  assert.equal(settleClear(r,1,{pushes:4,moves:30}).improved,false);
});
test('cosmetics unlock truth table exactly at stages 5 and 15',()=>{
  assert.deepEqual(availableSets(clears(0)),['basic','delivery']);assert.deepEqual(availableSets(clears(4)),['basic','delivery']);assert.deepEqual(availableSets(clears(5)),['basic','delivery','mechanic']);assert.deepEqual(availableSets(clears(14)),['basic','delivery','mechanic']);assert.deepEqual(availableSets(clears(15)),['basic','delivery','mechanic','chef']);
});
test('mixed part equipment validates ownership and cannot bypass locked sets',()=>{
  const mix={hat:'delivery',workwear:'basic',bag:'mechanic'};assert.equal(canEquip(clears(4),mix),false);assert.equal(equipRecord(clears(4),mix),null);const r=equipRecord(clears(5),mix);assert.deepEqual(r.equipped,mix);assert.ok(validateRecord(r));assert.equal(canEquip(r,{...mix,hat:'invalid'}),false);assert.equal(canEquip(r,{...mix,other:'basic'}),false);
});
for(const [name,mutate] of [
 ['old version',r=>r.version=0],['extra fields',r=>r.other=true],['nonboolean mute',r=>r.muted=1],['unsafe moves',r=>r.bests[1].moves=Number.MAX_SAFE_INTEGER+1],['NaN pushes',r=>r.bests[1].pushes=NaN],['negative pushes',r=>r.bests[1].pushes=-1],['moves below pushes',r=>r.bests[1].moves=1],['below certified minimum pushes',r=>r.bests[1]={pushes:1,moves:100}],['below certified optimal moves',r=>r.bests[2]={pushes:3,moves:3}],['nonsequential clears',r=>r.cleared=[1,3]],['duplicate clears',r=>r.cleared=[1,1]],['unlock skip',r=>r.unlocked=5],['invalid stage id',r=>{r.bests['01']=r.bests[1];delete r.bests[1];}],['best for uncleared',r=>r.bests[3]={pushes:3,moves:6}],['missing best',r=>delete r.bests[1]],['locked outfit',r=>r.equipped.hat='chef'],['wrong part',r=>{r.equipped.top='delivery';delete r.equipped.workwear;}],
])test(`record rejects ${name}`,()=>{const r=clears(2);mutate(r);assert.equal(validateRecord(r),null);});
test('safe-integer high records remain accepted and validation does not multiply unsafe totals',()=>{const r=clears(1);r.bests[1]={pushes:Number.MAX_SAFE_INTEGER,moves:Number.MAX_SAFE_INTEGER};assert.ok(validateRecord(r));});
test('storage getter/read/parse errors recover without writes',()=>{
  for(const getStorage of [()=>{throw new Error('getter');},()=>({getItem(){throw new Error('read');}}),()=>({getItem:()=>'{broken'}),()=>({getItem:()=>JSON.stringify({version:0})})]){
    const messages=[],p=createPersistence(getStorage,m=>messages.push(m));assert.deepEqual(p.load(),defaultRecord());assert.equal(messages.length,1);assert.ok(p.warning);
  }
});
test('setItem failure leaves caller memory usable, warning stays visible',()=>{const p=createPersistence(()=>({setItem(){throw new Error('quota');}}));const r=clears(5);assert.equal(p.save(r),false);assert.equal(r.unlocked,6);assert.ok(p.warning);assert.ok(canEquip(r,{hat:'mechanic',workwear:'mechanic',bag:'delivery'}));});
test('roundtrip persists own key only and cloned validation protects caller',()=>{const map=new Map([['foreign','untouched']]);const writes=[];const p=createPersistence(()=>({getItem:k=>map.get(k),setItem:(k,v)=>{writes.push(k);map.set(k,v);}}));const r=clears(15);p.save(r);const restored=p.load();assert.deepEqual(restored,r);restored.bests[1].moves=999;assert.notEqual(p.load().bests[1].moves,999);assert.deepEqual(writes,[STORAGE_KEY]);assert.equal(map.get('foreign'),'untouched');});
test('cosmetic choices never enter engine or alter rule outcomes',()=>{const inputs=LEVELS[17].solution;const a=play(createGame(18),inputs);for(const outfit of ['basic','delivery','mechanic','chef']){const r=equipRecord(clears(15),{hat:outfit,workwear:outfit,bag:outfit});assert.ok(r);assert.deepEqual(play(createGame(18),inputs),a);}});
