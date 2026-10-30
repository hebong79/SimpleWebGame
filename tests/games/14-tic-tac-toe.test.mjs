import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, place, pauseGame, resumeGame, nextRound, restartRound, rove, WINNING_LINES, COUNTER_CAP, incrementTotals, totalRounds } from '../../public/games/14-tic-tac-toe/engine.mjs';
import { STORAGE_KEY, defaultRecord, validTotals, recoverRecord, loadRecord, saveRecord, settleRecord } from '../../public/games/14-tic-tac-toe/save.mjs';

const play = (moves, state = startGame(createGame())) => moves.reduce(place, state);
const win = [0,3,1,4,2], draw = [0,1,2,4,3,5,7,6,8];
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }

test('ready is empty, X first, explicit start only once', () => {
  const ready = createGame(); assert.equal(ready.phase, 'ready'); assert.deepEqual(ready.round.board, Array(9).fill(null));
  assert.equal(place(ready, 0), ready); assert.equal(nextRound(ready), ready); assert.equal(restartRound(ready), ready);
  const state = startGame(ready); assert.equal(state.round.starter, 'X'); assert.equal(state.round.id, 1); assert.equal(startGame(state), state);
});
const lineCases = [
  [[0,1,2],[0,3,1,4,2]], [[3,4,5],[3,0,4,1,5]], [[6,7,8],[6,0,7,1,8]],
  [[0,3,6],[0,1,3,2,6]], [[1,4,7],[1,0,4,2,7]], [[2,5,8],[2,0,5,1,8]],
  [[0,4,8],[0,1,4,2,8]], [[2,4,6],[2,0,4,1,6]],
];
for (const starter of ['X','O']) for (const [line, moves] of lineCases) {
  test(`${starter} starter wins canonical line ${line.join('')}`, () => {
    const initial = starter === 'X' ? startGame(createGame()) : nextRound(play(win));
    const before = JSON.stringify(initial), state = play(moves, frozen(initial));
    assert.equal(JSON.stringify(initial), before); assert.equal(state.phase, 'result'); assert.equal(state.round.winner, starter);
    assert.deepEqual(state.round.winningLines, [line]); assert.equal(state.round.current, starter);
    assert.equal(totalRounds(state.session), starter === 'X' ? 1n : 2n);
    for (let i=0;i<9;i++) assert.equal(place(state,i), state);
  });
}
test('ninth move win has priority over full-board draw', () => {
  const state = play([0,1,2,3,4,5,7,6,8]); assert.equal(state.round.moves,9); assert.equal(state.round.winner,'X'); assert.equal(state.session.draws,0);
});
test('double-line final move reports both lines and settles once', () => {
  const state = play([0,1,2,3,6,5,8,7,4]); assert.equal(state.round.moves,9); assert.equal(state.round.winner,'X');
  assert.deepEqual(state.round.winningLines,[[0,4,8],[2,4,6]]); assert.equal(state.session.xWins,1);
  assert.equal(place(state,4),state); assert.equal(resumeGame(state),state);
});
test('legal draw settles once; no winning lines', () => {
  const state = play(draw); assert.equal(state.round.winner,'draw'); assert.deepEqual(state.round.winningLines,[]); assert.equal(state.session.draws,1);
});
test('valid placement synchronous, immutable, retains starter and swaps current', () => {
  const initial=frozen(startGame(createGame())), state=place(initial,4);
  assert.equal(initial.round.moves,0); assert.equal(state.round.board[4],'X'); assert.equal(state.round.moves,1); assert.equal(state.round.current,'O'); assert.equal(state.round.starter,'X');
  assert.equal(place(state,4),state); assert.deepEqual(state.session,{xWins:0,oWins:0,draws:0});
});
test('malicious input noops without primitive coercion, turn or session changes', () => {
  const state=frozen(place(startGame(createGame()),0));
  const poison={ [Symbol.toPrimitive]() { throw new Error('must not coerce'); }, valueOf() { throw new Error('must not coerce'); } };
  for (const value of [undefined,null,false,true,'0','1',NaN,Infinity,-Infinity,-1,9,.5,1n,Symbol('1'),poison,[],[1],{},()=>1,'constructor','__proto__','toString']) assert.equal(place(state,value),state);
  assert.equal(place(state,0),state); assert.equal(state.round.moves,1);
});
test('manual/dialog/protection pause noops, precedence and explicit resume', () => {
  const initial=place(startGame(createGame()),0), paused=pauseGame(initial,'manual');
  assert.equal(paused.phase,'paused'); assert.equal(place(paused,1),paused); assert.equal(pauseGame(paused,'dialog'),paused);
  const protectedState=pauseGame(paused,'protection'); assert.equal(protectedState.pauseCause,'protection'); assert.equal(pauseGame(protectedState,'manual'),protectedState);
  const resumed=resumeGame(protectedState); assert.equal(resumed.phase,'playing'); assert.equal(resumed.round,initial.round); assert.equal(resumed.session,initial.session);
  assert.equal(pauseGame(initial,{}),initial); assert.equal(pauseGame(play(win),'protection').phase,'result');
});
test('completed next alternates PRIOR STARTER, even when X wins O-start round', () => {
  const first=play(win), second=nextRound(first); assert.equal(second.round.starter,'O'); assert.equal(second.round.current,'O'); assert.equal(second.round.id,2);
  assert.equal(nextRound(second),second);
  const xWins=play([1,0,2,3,4,6],second); assert.equal(xWins.round.winner,'X'); assert.equal(xWins.round.starter,'O');
  const third=nextRound(xWins); assert.equal(third.round.starter,'X'); assert.equal(third.session.xWins,2); assert.equal(third.round.id,3);
});
test('draw also alternates starter; aborted restart preserves starter and stats', () => {
  const second=nextRound(play(draw)), pending=place(second,8), restarted=restartRound(pauseGame(pending,'protection'));
  assert.equal(restarted.round.starter,'O'); assert.equal(restarted.round.current,'O'); assert.equal(restarted.round.id,3); assert.equal(restarted.round.moves,0); assert.equal(restarted.session,pending.session);
  assert.equal(totalRounds(restarted.session),1n); assert.equal(restarted.phase,'playing');
});
test('session totals never overflow at cap; lifetime separate', () => {
  const state=startGame(createGame()); state.session={xWins:COUNTER_CAP,oWins:0,draws:0};
  const result=play(win,state); assert.equal(result.round.winner,'X'); assert.equal(result.session,state.session);
  const totals={xWins:COUNTER_CAP-1,oWins:0,draws:0}; assert.equal(incrementTotals(totals,'draw').draws,1);
  assert.equal(incrementTotals(totals,{}),totals); assert.equal(totalRounds(result.session),1000000n);
});
test('arrows rove one axis, clamp without wrap, unsupported input noops', () => {
  assert.equal(rove(0,'ArrowLeft'),0); assert.equal(rove(0,'ArrowUp'),0); assert.equal(rove(2,'ArrowRight'),2); assert.equal(rove(8,'ArrowDown'),8);
  assert.equal(rove(4,'ArrowUp'),1); assert.equal(rove(4,'ArrowDown'),7); assert.equal(rove(4,'ArrowLeft'),3); assert.equal(rove(4,'ArrowRight'),5);
  for(const key of ['constructor','__proto__','toString',{},Symbol('x'),null,'Home']) assert.equal(rove(4,key),4);
  assert.equal(rove(-1,'ArrowUp'),-1);
});
test('every reachable board matches independent win-first oracle for X/O starters', () => {
  // Distinct-state traversal, independent coordinate oracle (not product winning-lines table).
  let visited=0;
  for (const starter of ['X','O']) {
    const root=starter==='X'?startGame(createGame()):nextRound(play(win)), seen=new Set();
    function visit(state) {
      const key=state.round.board.map(x=>x||'.').join(''); if(seen.has(key)) return; seen.add(key); visited++;
      if(state.phase==='result') return;
      for(let i=0;i<9;i++) if(state.round.board[i]===null) {
        const after=place(state,i), b=after.round.board, p=state.round.current;
        const won=[0,1,2].some(r=>[0,1,2].every(c=>b[r*3+c]===p)) || [0,1,2].some(c=>[0,1,2].every(r=>b[r*3+c]===p)) || [0,4,8].every(j=>b[j]===p) || [2,4,6].every(j=>b[j]===p);
        const expected=won?p:b.every(x=>x!==null)?'draw':null;
        assert.equal(after.round.winner,expected); assert.equal(after.phase,expected?'result':'playing');
        assert.equal(totalRounds(after.session),totalRounds(root.session)+(expected?1n:0n)); visit(after);
      }
    } visit(root);
    assert.equal(seen.size,5478);
  }
  assert.equal(visited,10956); assert.equal(WINNING_LINES.length,8);
});

test('default muted/paper record contains no session or unfinished board', () => {
  const data=defaultRecord(); assert.deepEqual(data,{version:1,settings:{theme:'paper',muted:true},lifetime:{xWins:0,oWins:0,draws:0}});
  assert.equal(STORAGE_KEY,'simplegames.star-moon.v1');
});
test('strict integer and total-cap validation, including safe-but-impossible sum', () => {
  for(const lifetime of [{xWins:1000000,oWins:1,draws:0},{xWins:500000,oWins:500000,draws:1},{xWins:1.1,oWins:0,draws:0},{xWins:-1,oWins:0,draws:0},{xWins:'1',oWins:0,draws:0},{xWins:Infinity,oWins:0,draws:0},{xWins:NaN,oWins:0,draws:0},{xWins:Number.MAX_SAFE_INTEGER,oWins:0,draws:0},{xWins:0,oWins:0},null,[]]) assert.equal(validTotals(lifetime),false);
  assert.equal(validTotals({xWins:500000,oWins:499999,draws:1}),true); assert.equal(validTotals({xWins:0,oWins:0,draws:0}),true);
});
test('invalid lifetime recovers all three together, settings survive', () => {
  const result=recoverRecord({version:1,settings:{theme:'night',muted:false},lifetime:{xWins:1000000,oWins:1,draws:9}});
  assert.deepEqual(result.record.settings,{theme:'night',muted:false}); assert.deepEqual(result.record.lifetime,{xWins:0,oWins:0,draws:0}); assert.equal(result.warnings.length,1);
});
for (const field of ['theme','muted']) test(`partial settings recovery only ${field}`, () => {
  const data={version:1,settings:{theme:'night',muted:false},lifetime:{xWins:1,oWins:2,draws:3}}; data.settings[field]=field==='theme'?'constructor':0;
  const result=recoverRecord(data); assert.equal(result.warnings.length,1); assert.deepEqual(result.record.lifetime,data.lifetime);
  assert.equal(result.record.settings[field],defaultRecord().settings[field]); assert.equal(result.record.settings[field==='theme'?'muted':'theme'],field==='theme'?false:'night');
});
test('load absent does not write, remove, or touch unrelated key', () => {
  const calls=[], storage={getItem(key){calls.push(['get',key]);return null;},setItem(){throw Error('no write');},removeItem(){throw Error('no delete');}};
  assert.deepEqual(loadRecord(()=>storage),{record:defaultRecord(),warnings:[]}); assert.deepEqual(calls,[['get',STORAGE_KEY]]);
});
for (const value of ['{','null','[]','1','{"version":2}','{"version":1e999}']) test(`corrupted/old JSON ${value} recovers without writes`, () => {
  const result=loadRecord(()=>({getItem:()=>value,setItem(){throw Error('no writes');}})); assert.deepEqual(result.record,defaultRecord()); assert.ok(result.warnings.length);
});
test('storage getter throws independently, playable default memory', () => {
  const result=loadRecord(()=>{throw Error('getter denied');}); assert.deepEqual(result.record,defaultRecord()); assert.equal(result.warnings.length,1);
});
test('storage getItem throws independently', () => {
  const result=loadRecord(()=>({getItem(){throw Error('get denied');}})); assert.deepEqual(result.record,defaultRecord()); assert.equal(result.warnings.length,1);
});
test('write failure preserves already-settled memory; getter/setItem fail safely', () => {
  const record=settleRecord(defaultRecord(),'X'); assert.equal(record.lifetime.xWins,1);
  for(const storage of [()=>{throw Error('getter denied');},()=>({setItem(){throw Error('quota');}})]) { const result=saveRecord(record,storage); assert.equal(result.ok,false); assert.ok(result.warning); assert.equal(record.lifetime.xWins,1); }
});
test('completion/settings save only own key once; load resets session, keeps lifetime', () => {
  const storageMap=new Map([['simplegames.favorites.v1','unrelated-byte-string']]), calls=[];
  const storage={getItem:key=>storageMap.get(key)??null,setItem(key,value){calls.push(key); storageMap.set(key,value);}};
  const record=settleRecord(defaultRecord(),play(win).round.winner); assert.equal(saveRecord(record,()=>storage).ok,true);
  assert.deepEqual(calls,[STORAGE_KEY]); assert.equal(storageMap.get('simplegames.favorites.v1'),'unrelated-byte-string');
  const loaded=loadRecord(()=>storage); assert.equal(loaded.record.lifetime.xWins,1); assert.deepEqual(createGame().session,{xWins:0,oWins:0,draws:0}); assert.equal(createGame().round.starter,'X');
});
test('lifetime cap stops every category atomically but record remains valid', () => {
  const record={...defaultRecord(),lifetime:{xWins:1,oWins:999998,draws:1}};
  for(const outcome of ['X','O','draw',Symbol('bad'),{}]) assert.equal(settleRecord(record,outcome),record);
  assert.equal(validTotals(record.lifetime),true);
});
test('invalid write payload refuses rather than silently replacing valid memory', () => {
  let written=0; const record={...defaultRecord(),settings:{theme:'unknown',muted:true}};
  assert.equal(saveRecord(record,()=>({setItem(){written++;}})).ok,false); assert.equal(written,0);
});
