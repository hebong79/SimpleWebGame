import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, advanceGame, inputPad, pauseGame, resumeGame, activePad, flashDuration } from '../../public/games/16-simon/engine.mjs';
import { defaultRecord, validateRecord, settleRecord, loadRecord, saveRecord, STORAGE_KEY } from '../../public/games/16-simon/save.mjs';

const rng = () => 0;
const inputState = (sequence = [0]) => ({ ...startGame(createGame(), rng), subphase: 'input', sequence, round: sequence.length, remaining: 5000 });
function finishDemo(game) {
  while (game.subphase !== 'input') game = advanceGame(game, game.remaining, rng);
  return game;
}
test('ready has no sequence, explicit start draws exactly one uniform pad', () => {
  assert.deepEqual(createGame().sequence, []);
  for (const [value, expected] of [[0,0],[0.24999,0],[0.25,1],[0.5,2],[0.75,3],[0.99999,3]]) {
    let calls = 0;
    const game = startGame(createGame(), () => { calls++; return value; });
    assert.deepEqual(game.sequence, [expected]); assert.equal(calls, 1); assert.equal(game.remaining, 400);
  }
});
test('invalid random values reject rather than corrupt the pattern', () => {
  for (const value of [NaN, -0.1, 1, Infinity]) assert.throws(() => startGame(createGame(), () => value), RangeError);
});
test('initial prepare 400, on 500 and final dark 400 without extra gap', () => {
  let g = startGame(createGame(), rng);
  g = advanceGame(g, 399, rng); assert.equal(g.subphase, 'prepare'); assert.equal(g.remaining, 1);
  g = advanceGame(g, 1, rng); assert.equal(g.subphase, 'demo-on'); assert.equal(activePad(g), 0);
  g = advanceGame(g, 499, rng); assert.equal(g.remaining, 1);
  g = advanceGame(g, 1, rng); assert.equal(g.subphase, 'demo-tail'); assert.equal(activePad(g), null); assert.equal(g.remaining, 400);
  g = advanceGame(g, 399, rng); assert.equal(g.subphase, 'demo-tail');
  g = advanceGame(g, 1, rng); assert.equal(g.subphase, 'input'); assert.equal(g.remaining, 5000);
});
test('only inter-pad gaps are 250ms', () => {
  let g = { ...startGame(createGame(), rng), sequence: [0,1], round: 2 };
  g = advanceGame(g, 400 + 500, rng); assert.equal(g.subphase, 'demo-gap'); assert.equal(g.remaining, 250);
  g = advanceGame(g, 249, rng); assert.equal(g.cursor, 0);
  g = advanceGame(g, 1, rng); assert.equal(g.cursor, 1); assert.equal(g.subphase, 'demo-on');
  g = advanceGame(g, 500, rng); assert.equal(g.subphase, 'demo-tail'); assert.equal(g.remaining, 400);
});
test('speed boundaries 5/6 and 10/11 preserve required durations', () => {
  assert.deepEqual([1,5,6,10,11,1000].map(flashDuration), [500,500,450,450,400,400]);
  for (const length of [6,11]) {
    const g = advanceGame({ ...startGame(createGame(),rng), sequence: Array(length).fill(0) }, 400, rng);
    assert.equal(g.remaining, length === 6 ? 450 : 400);
  }
});
test('all demo phases ignore every pad without altering timing or RNG', () => {
  for (const subphase of ['prepare','demo-on','demo-gap','demo-tail','success']) {
    const g = { ...inputState(), subphase };
    for (let pad = 0; pad < 4; pad++) assert.equal(inputPad(g, pad), g);
  }
});
test('invalid pad values never modify input state', () => {
  const g = inputState(); for (const pad of [-1,4,0.5,NaN,'0',null,undefined]) assert.equal(inputPad(g,pad),g);
});
test('first failure score is zero and result is stable', () => {
  const g = inputPad(inputState(), 1); assert.equal(g.phase,'result'); assert.equal(g.result.score,0);
  assert.equal(g.result.reason,'wrong'); assert.equal(inputPad(g,0),g); assert.equal(advanceGame(g,100000,rng),g);
});
test('first timeout at exactly 5000ms produces zero', () => {
  let g = advanceGame(inputState(), 4999.999, rng); assert.equal(g.phase,'playing');
  g = advanceGame(g,0.001,rng); assert.equal(g.phase,'result'); assert.equal(g.result.reason,'timeout'); assert.equal(g.completedLength,0);
});
test('zero remaining gives timeout precedence over the right answer', () => {
  const g = inputPad({ ...inputState(), remaining: 0 },0); assert.equal(g.result.reason,'timeout');
});
test('each correct nonfinal answer resets its own 5 second budget', () => {
  let g = advanceGame(inputState([0,1,2]),4900,rng);
  g = inputPad(g,0); assert.equal(g.remaining,5000); assert.equal(g.cursor,1);
  g = advanceGame(g,4999,rng); g = inputPad(g,1); assert.equal(g.remaining,5000); assert.equal(g.completedLength,0);
});
test('feedback never locks same-pad repeated inputs', () => {
  let g = inputPad(inputState([0,0,0]),0); assert.equal(g.feedbackRemaining,120);
  g = inputPad(g,0); assert.equal(g.cursor,2); g = inputPad(g,0); assert.equal(g.completedLength,3); assert.equal(g.subphase,'success');
});
test('success commits only full length, waits 700, appends one pad preserving prefix', () => {
  let calls = 0, g = inputPad(inputState([0,0]),0); g = inputPad(g,0);
  assert.equal(g.completedLength,2); assert.equal(g.remaining,700);
  g = advanceGame(g,699,() => { calls++; return 0.75; }); assert.equal(calls,0);
  g = advanceGame(g,1,() => { calls++; return 0.75; }); assert.equal(calls,1);
  assert.deepEqual(g.sequence,[0,0,3]); assert.equal(g.subphase,'demo-on'); assert.equal(g.remaining,500);
});
test('failed partial round keeps previous completed length', () => {
  const g = inputPad({ ...inputState([0,1,2]), completedLength:2 },3);
  assert.equal(g.result.score,2); assert.equal(g.result.failedLength,3); assert.equal(g.result.position,1);
});
for (const subphase of ['prepare','demo-on','demo-gap','demo-tail','input','success']) {
  test(`pause exactly freezes ${subphase}, highlight hidden and restored`, () => {
    const g = { ...inputState([0,1]), subphase, remaining:123.5, feedbackPad:1,feedbackRemaining:80 };
    let p = pauseGame(g,'manual'); assert.equal(p.remaining,123.5); assert.equal(advanceGame(p,9999,rng),p); assert.equal(activePad(p),null);
    p = resumeGame(p); assert.equal(p.subphase,subphase); assert.equal(p.remaining,123.5);
    p = advanceGame(p,23.5,rng); assert.equal(p.remaining,100);
  });
}
test('protective pause overrides modal/manual pause and never auto resumes', () => {
  let g = pauseGame(inputState(),'dialog'); g = pauseGame(g,'protection'); assert.equal(g.pauseCause,'protection');
  g = pauseGame(g,'manual'); assert.equal(g.pauseCause,'protection');
  assert.equal(inputPad(g,0),g); assert.equal(advanceGame(g,99999,rng),g);
});
test('fresh token invalidates stale advance; bad deltas are no-ops', () => {
  const g = startGame(startGame(createGame(),rng),rng);
  assert.equal(advanceGame(g,400,rng,g.token-1),g);
  for (const delta of [-1,NaN,Infinity]) assert.equal(advanceGame(g,delta,rng),g);
});
test('1000 completion is bounded and never draws the 1001st item', () => {
  let g = { ...inputState(Array(1000).fill(0)), cursor:999, completedLength:999 };
  g = inputPad(g,0); assert.equal(g.phase,'result'); assert.equal(g.result.reason,'complete'); assert.equal(g.result.score,1000);
});
test('engine is immutable and large deterministic delta matches granular time', () => {
  const g = startGame(createGame(),rng), before = structuredClone(g);
  assert.deepEqual(advanceGame(g,1300,rng),finishDemo(g)); assert.deepEqual(g,before);
});
test('valid save round trip and exact one settlement increment', () => {
  const record = settleRecord(defaultRecord(),7); assert.deepEqual(record.records,{ plays:1,bestLength:7,totalCompleted:7 });
  assert.deepEqual(validateRecord(record),{ record,warnings:[] }); assert.equal(defaultRecord().records.plays,0);
});
test('zero score still counts a completed result', () => {
  assert.deepEqual(settleRecord(defaultRecord(),0).records,{ plays:1,bestLength:0,totalCompleted:0 });
});
test('record cap freezes the complete aggregate, including best', () => {
  const record = { ...defaultRecord(), records:{ plays:1000000,bestLength:5,totalCompleted:5 } };
  assert.equal(settleRecord(record,1000),record);
});
test('bad records preserve valid settings, and each bad setting repairs independently', () => {
  const r = defaultRecord(); r.settings = { theme:'dawn',muted:false }; r.records.plays=-1;
  const valid = validateRecord(r).record; assert.deepEqual(valid.settings,{theme:'dawn',muted:false}); assert.deepEqual(valid.records,defaultRecord().records);
  const a = settleRecord(defaultRecord(),4); a.settings={theme:'bad',muted:false};
  const repaired=validateRecord(a).record; assert.equal(repaired.settings.theme,'night'); assert.equal(repaired.settings.muted,false); assert.equal(repaired.records.bestLength,4);
});
test('version, primitive, nonfinite, unsafe and aggregate relationship corruption recover', () => {
  for (const value of [null,1,[],{version:2}]) assert.ok(validateRecord(value).warnings.length);
  for (const records of [{plays:0,bestLength:1,totalCompleted:1},{plays:1,bestLength:2,totalCompleted:1},{plays:1,bestLength:0,totalCompleted:1001},{plays:NaN,bestLength:0,totalCompleted:0},{plays:1,bestLength:Infinity,totalCompleted:0},{plays:1,bestLength:0,totalCompleted:Number.MAX_SAFE_INTEGER+1}]) {
    const result=validateRecord({...defaultRecord(),records}); assert.deepEqual(result.record.records,defaultRecord().records); assert.ok(result.warnings.length);
  }
});
test('storage getter/getItem/setItem failures are caught; reads never write', () => {
  for (const getter of [() => { throw Error(); },() => ({getItem(){throw Error();}})]) assert.ok(loadRecord(getter).warnings.length);
  assert.equal(saveRecord(defaultRecord(),() => {throw Error();}).ok,false);
  assert.equal(saveRecord(defaultRecord(),() => ({setItem(){throw Error();}})).ok,false);
  let writes=0; const storage={getItem(){return null;},setItem(){writes++;}};
  assert.deepEqual(loadRecord(() => storage).warnings,[]); assert.equal(writes,0);
});
test('JSON error recovers and persistence touches only its dedicated key', () => {
  assert.ok(loadRecord(() => ({getItem(){return '{';}})).warnings.length);
  const entries=new Map([['other-game','keep']]);
  const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
  assert.equal(saveRecord(settleRecord(defaultRecord(),3),()=>storage).ok,true);
  assert.equal(entries.get('other-game'),'keep'); assert.equal(entries.size,2); assert.ok(entries.has(STORAGE_KEY));
  assert.equal(loadRecord(()=>storage).record.records.bestLength,3);
});
