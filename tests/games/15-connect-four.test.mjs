import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startRound, drop, tick, pause, resume, findWinningCells, validState, incrementRecords, emptyRecords, DROP_MS } from '../../public/games/15-connect-four/engine.mjs';
import { defaultRecord, recoverRecord, loadRecord, saveRecord, settleRecord, STORAGE_KEY } from '../../public/games/15-connect-four/save.mjs';
const play = (state, col) => tick(drop(state, col), DROP_MS);
const board = () => Array.from({ length: 6 }, () => Array(7).fill(null));
test('ready board is 7x6 and explicit start begins sun', () => {
  const ready = createGame(); assert.equal(ready.phase, 'ready'); assert.equal(ready.board.flat().length, 42);
  assert.equal(drop(ready, 0), ready); const s = startRound(ready); assert.equal(s.current, 'sun'); assert.equal(s.round, 1); assert.ok(validState(s));
});
test('gravity commits atomically and 200ms locks current player', () => {
  const a = startRound(createGame()), b = drop(a, 2);
  assert.equal(a.board[5][2], null); assert.equal(b.board[5][2], 'sun'); assert.equal(b.current, 'sun'); assert.equal(b.remainingMs, 200);
  assert.equal(drop(b, 3), b); const c = tick(b, 199); assert.equal(c.current, 'sun'); assert.equal(c.remainingMs, 1);
  const d = tick(c, 1); assert.equal(d.current, 'sea'); assert.equal(d.subphase, 'choosing'); assert.equal(play(d, 2).board[4][2], 'sea');
});
for (const invalid of [-1, 7, 1.5, NaN, Infinity, '1', null, {}, undefined]) test(`invalid column ${String(invalid)} is exact no-op`, () => {
  const s = startRound(createGame()); assert.equal(drop(s, invalid), s);
});
test('full column preserves board and turn', () => {
  let s = startRound(createGame()); for (let i = 0; i < 6; i++) s = play(s, 0);
  assert.equal(s.moves, 6); assert.equal(drop(s, 0), s); assert.equal(s.current, 'sun');
});
for (const [label, points] of [
  ['horizontal edge', [[5,0],[5,1],[5,2],[5,3]]],
  ['vertical edge', [[2,6],[3,6],[4,6],[5,6]]],
  ['positive diagonal', [[1,2],[2,3],[3,4],[4,5]]],
  ['negative diagonal edge', [[5,0],[4,1],[3,2],[2,3]]],
  ['six long line', [[5,0],[5,1],[5,2],[5,3],[5,4],[5,5]]],
]) test(`finds full ${label}`, () => {
  const b = board(); for (const [r,c] of points) b[r][c] = 'sun'; const [r,c] = points[1];
  assert.equal(findWinningCells(b,r,c).length, points.length);
});
test('one move reveals union of crossing lines', () => {
  const b = board(); const points = [[3,0],[3,1],[3,2],[3,3],[0,3],[1,3],[2,3]];
  for (const [r,c] of points) b[r][c] = 'sea'; assert.equal(findWinningCells(b,3,3).length, 7);
});
test('legal horizontal win settles once and locks result input', () => {
  let s = startRound(createGame()); for (const c of [0,0,1,1,2,2,3]) s = play(s,c);
  assert.equal(s.phase, 'result'); assert.equal(s.outcome,'sun'); assert.equal(s.session.sunWins,1); assert.equal(s.winningCells.length,4);
  assert.equal(tick(s,200),s); assert.equal(drop(s,4),s); assert.equal(pause(s),s);
  const next = startRound(s); assert.equal(next.starter,'sea'); assert.equal(next.current,'sea'); assert.equal(next.session.sunWins,1);
});
test('vertical win from actual drops', () => {
  let s = startRound(createGame()); for (const c of [6,5,6,5,6,5,6]) s = play(s,c);
  assert.equal(s.outcome,'sun'); assert.equal(s.winningCells.length,4);
});
test('pause freezes fractional remainder and protection has priority', () => {
  const s = tick(drop(startRound(createGame()),3),57.5), stopped = pause(s,'manual');
  assert.equal(stopped.remainingMs,142.5); assert.equal(tick(stopped,200),stopped);
  assert.equal(pause(stopped,'modal').pauseReason,'manual');
  const protectedState = pause(stopped,'protect'); assert.equal(pause(protectedState,'modal').pauseReason,'protect');
  const resumed = resume(protectedState); assert.equal(tick(resumed,142).remainingMs,.5);
  assert.equal(tick(tick(resumed,142),.5).current,'sea');
});
test('long frame protects instead of completing drop', () => {
  const s = drop(startRound(createGame()),1), p = tick(s,251); assert.equal(p.phase,'paused'); assert.equal(p.remainingMs,200); assert.equal(p.pauseReason,'protect');
  for (const n of [NaN,Infinity,-1]) assert.equal(tick(s,n),s);
});
test('restart keeps starter while result next round alternates', () => {
  let s = startRound(createGame()); for (const c of [0,1,0,1,0,1,0]) s = play(s,c);
  s = startRound(s); assert.equal(s.starter,'sea'); s = play(s,0); s = startRound(pause(s));
  assert.equal(s.starter,'sea'); assert.equal(s.moves,0); assert.equal(s.session.sunWins,1);
});
test('full board draw and final winning move has priority over draw', () => {
  // Boundary fixture is a legitimate shape with no lines; pure rules do not require a hidden test setter.
  const b = [
    ['sun','sun','sea','sea','sun','sun','sea'],['sea','sea','sun','sun','sea','sea','sun'],
    ['sun','sun','sea','sea','sun','sun','sea'],['sea','sea','sun','sun','sea','sea','sun'],
    ['sun','sun','sea','sea','sun','sun','sea'],['sea','sea','sun','sun','sea','sea','sun']];
  b[0][6] = null; let s = { ...startRound(createGame()), board:b,moves:41,current:'sea' };
  s = play(s,6); assert.equal(s.outcome,'draw'); assert.equal(s.session.draws,1);
  const win = board(); for (let r=0;r<6;r++) for(let c=0;c<7;c++) win[r][c]='sea'; win[0][0]=null;
  s = play({ ...startRound(createGame()),board:win,moves:41,current:'sea' },0); assert.equal(s.outcome,'sea'); assert.equal(s.session.draws,0);
});
test('external invalid state and winning arguments are safely rejected', () => {
  for(const v of [null,undefined,{},[],1,'bad',{...createGame(),lastMove:undefined},{...createGame(),session:null},{...createGame(),board:[[null]]}]) {
    assert.equal(validState(v),false); assert.equal(drop(v,0),v); assert.equal(tick(v,1),v); assert.equal(startRound(v),v); assert.equal(pause(v),v); assert.equal(resume(v),v);
  }
  for(const args of [[null,0,0],[board(),-1,0],[board(),0,7],[board(),.5,0]]) assert.deepEqual(findWinningCells(...args),[]);
});
test('counter cap is atomic and invalid outcomes do not increment', () => {
  const r = {sunWins:999999,seaWins:1,draws:0}; assert.equal(incrementRecords(r,'sun'),r);
  assert.equal(incrementRecords(r,'draw'),r); assert.equal(incrementRecords(r,'bad'),r);
  assert.deepEqual(incrementRecords(emptyRecords(),'sea'),{sunWins:0,seaWins:1,draws:0});
});
test('save defaults and valid round-trip never persist a board', () => {
  const map=new Map([['other','preserve']]); let writes=0;
  const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{ writes++;map.set(key,value); }};
  assert.deepEqual(loadRecord(()=>storage).record,defaultRecord()); assert.equal(writes,0);
  let r=settleRecord(defaultRecord(),'sun'); r.settings.theme='evening'; assert.equal(saveRecord(r,()=>storage).ok,true);
  assert.deepEqual(loadRecord(()=>storage).record,r); assert.equal(map.get('other'),'preserve'); assert.equal(JSON.parse(map.get(STORAGE_KEY)).board,undefined); assert.equal(writes,1);
});
test('settings recover individually while preserving valid records', () => {
  const r={version:1,settings:{theme:'bad',muted:false},records:{sunWins:5,seaWins:2,draws:1}};
  const a=recoverRecord(r); assert.equal(a.record.settings.theme,'coast'); assert.equal(a.record.settings.muted,false); assert.equal(a.record.records.sunWins,5); assert.equal(a.warnings.length,1);
  r.settings={theme:'evening',muted:'bad'}; const b=recoverRecord(r); assert.equal(b.record.settings.theme,'evening'); assert.equal(b.record.settings.muted,true); assert.equal(b.record.records.sunWins,5);
});
for(const records of [{sunWins:1.1,seaWins:0,draws:0},{sunWins:-1,seaWins:0,draws:0},{sunWins:Infinity,seaWins:0,draws:0},{sunWins:999999,seaWins:2,draws:0},{sunWins:1000001,seaWins:0,draws:0},null]) test(`bad records ${JSON.stringify(records)} recover only records`, () => {
  const r=recoverRecord({version:1,settings:{theme:'evening',muted:false},records}).record;
  assert.deepEqual(r.records,emptyRecords()); assert.deepEqual(r.settings,{theme:'evening',muted:false});
});
test('storage getter, read, write exceptions and JSON/version faults are recoverable', () => {
  for(const getter of [()=>{throw Error('getter');},()=>({getItem(){throw Error('read');}})]) assert.ok(loadRecord(getter).warnings.length);
  for(const raw of ['{','null','3','[]','{"version":2}']) assert.ok(loadRecord(()=>({getItem:()=>raw})).warnings.length);
  assert.equal(saveRecord(defaultRecord(),()=>{throw Error('getter');}).ok,false);
  assert.equal(saveRecord(defaultRecord(),()=>({setItem(){throw Error('write');}})).ok,false);
  assert.equal(saveRecord({version:2},()=>({setItem(){throw Error('must not write');}})).ok,false);
});
