import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {PUZZLES, MODE_IDS, OPPOSITE, goalBoard, shuffle, targetIndex, validMode} from '../../public/games/12-fifteen/puzzles.mjs';
import {createGame, start, pause, resume, beginPreview, endPreview, moveTile, moveDirection, undo, elapsed, command, isGoal} from '../../public/games/12-fifteen/engine.mjs';
import {defaults, sanitize, settleRecord, loadSave, writeSave, STORAGE_KEY} from '../../public/games/12-fifteen/save.mjs';
const adjacent = s => s.board.findIndex((_, i) => Math.abs(Math.floor(i / s.size) - Math.floor(s.blank / s.size)) + Math.abs(i % s.size - s.blank % s.size) === 1);
const solve = id => {
  let s = start(createGame(id)), n = 10;
  for (const d of [...PUZZLES[id].route].reverse().map(d => OPPOSITE[d])) { if (s.status === 'won') break; s = moveDirection(s, d, n += 10); }
  return s;
};
function independentSolvable(board, size) {
  let inversions = 0;
  for (let i = 0; i < board.length; i++) for (let j = i + 1; j < board.length; j++) if (board[i] && board[j] && board[i] > board[j]) inversions++;
  return size % 2 ? inversions % 2 === 0 : (inversions + size - Math.floor(board.indexOf(0) / size)) % 2 === 1;
}
for (const id of MODE_IDS) {
  test(`${id}: explicit manifest, immutable same seed and exact legal shuffle`, () => {
    const fixture = JSON.parse(readFileSync(new URL('../../public/games/12-fifteen/puzzles-manifest.json', import.meta.url)));
    const p = PUZZLES[id];
    assert.deepEqual(fixture.puzzles[id], p); assert.deepEqual(shuffle(p.size, p.steps, p.seed).board, p.board);
    assert(Object.isFrozen(p)); assert(Object.isFrozen(p.board)); assert(Object.isFrozen(p.route));
    assert.equal(p.route.length, p.steps); assert(!isGoal(p.board)); assert(independentSolvable(p.board, p.size));
    assert.deepEqual([...p.board].sort((a,b) => a-b), Array.from({length:p.size*p.size},(_,i)=>i));
    const board = goalBoard(p.size); let blank = board.length - 1, previous = -1;
    for (const direction of p.route) {
      const next = targetIndex(blank, p.size, direction); assert(next >= 0); assert.notEqual(next, previous);
      [board[next],board[blank]] = [board[blank],board[next]]; previous = blank; blank = next;
    }
    assert.deepEqual(board, p.board);
  });
  test(`${id}: reverse shuffle completes via legal engine input only`, () => {
    const s = solve(id); assert.equal(s.status, 'won'); assert.deepEqual(s.board, goalBoard(s.size)); assert(s.moveCount > 0 && s.moveCount <= PUZZLES[id].steps); assert(s.elapsedMs >= 1);
    assert.strictEqual(undo(s), s); assert.strictEqual(moveTile(s, adjacent(s), 10000), s);
  });
  test(`${id}: retry never changes initial puzzle or seed`, () => {
    let s = start(createGame(id)); s = moveTile(s, adjacent(s), 20); assert.notDeepEqual(s.board, createGame(id).board);
    assert.deepEqual(createGame(id), createGame(id)); assert.deepEqual(createGame(id).board, PUZZLES[id].board);
  });
}
test('same content in a genuinely separate module process', () => {
  const output = spawnSync(process.execPath, ['--input-type=module', '-e', "import {PUZZLES} from './public/games/12-fifteen/puzzles.mjs'; console.log(JSON.stringify(PUZZLES))"], {encoding:'utf8'});
  assert.equal(output.status, 0); assert.deepEqual(JSON.parse(output.stdout), PUZZLES);
});
test('multiple seeds always legal, deterministic, solvable and non-goal', () => {
  for (const size of [3,4]) for (let seed = 1; seed <= 128; seed++) {
    const p = shuffle(size, (seed % 120) + 1, seed); assert(!isGoal(p.board)); assert(independentSolvable(p.board,size)); assert.deepEqual(shuffle(size,p.steps,seed),p);
  }
});
test('invalid shuffle parameters throw rather than illegal fallback', () => {
  for (const values of [[2,20,1],[4,0,1],[4,-1,1],[4,10001,1],[4,20,0],[4,20,NaN],[4,20,Infinity],[4,20,2**32]]) assert.throws(()=>shuffle(...values),RangeError);
});
test('goal requires every value and the final blank', () => {
  assert(isGoal(goalBoard(4))); assert(!isGoal([1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15])); assert(!isGoal([])); assert(!isGoal(null)); assert(!isGoal(Array(16))); assert(!isGoal([0])); assert(!isGoal([...goalBoard(3).slice(0,8),8]));
});
test('invalid IDs never coerce or match prototype fields', () => {
  let touched=0; const evil={toString(){touched++;throw Error('coercion');}};
  for (const id of ['toString','constructor','__proto__',Symbol('id'),evil,null]) {assert(!validMode(id));assert.throws(()=>createGame(id),RangeError);}
  assert.equal(touched,0);
});
test('ready state blocks all game input and clock starts on first valid move', () => {
  const ready=createGame(), s=start(ready); assert.strictEqual(moveTile(ready,adjacent(ready),10),ready); assert.equal(s.status,'playing'); assert.equal(elapsed(s,9000),0);
  assert.strictEqual(moveTile(s,s.blank,500),s); const moved=moveTile(s,adjacent(s),1000); assert.equal(elapsed(moved,1123),123); assert.equal(elapsed(s,2000),0);
});
test('adjacent only: diagonal, far, blank, row wrap and malformed indices no-op', () => {
  const s=start(createGame());
  for (let i=0;i<s.board.length;i++) {
    const dist=Math.abs(Math.floor(i/s.size)-Math.floor(s.blank/s.size))+Math.abs(i%s.size-s.blank%s.size);
    const n=moveTile(s,i,100); if(dist===1) {assert.notStrictEqual(n,s);assert.equal(n.moveCount,1);} else assert.strictEqual(n,s);
  }
  for(const i of [-1,16,1.5,NaN,Infinity,'3',null,undefined,Symbol('index'),{valueOf(){throw Error('coercion');}}]) assert.strictEqual(moveTile(s,i,100),s);
  // Explicit right-edge/left-edge adjacency cannot wrap to the next row.
  let edge=start(createGame('practice-v1')); edge=moveDirection(edge,'left',1);
  assert.equal(edge.blank,3); assert.strictEqual(moveTile(edge,2,2),edge);
});
test('inherited commands, Symbols, side-effect objects are identity no-op', () => {
  const s=start(createGame()); let touched=0; const evil={toString(){touched++;return 'left';},valueOf(){touched++;return 0;}};
  for(const value of ['toString','constructor','__proto__','hasOwnProperty','valueOf',Symbol('left'),evil,3,null,undefined]) {
    assert.strictEqual(moveDirection(s,value,10),s); assert.strictEqual(command(s,value,10),s);
  }
  assert.equal(touched,0); assert.equal(s.moveCount,0); assert.equal(s.history.length,0);
});
test('invalid timestamps cannot start a move or pause a clock', () => {
  const s=start(createGame()); for(const t of [NaN,Infinity,-1,'1',null,Symbol('time')]) {assert.strictEqual(moveTile(s,adjacent(s),t),s);assert.strictEqual(pause(s,t),s);}
});
test('undo restores exact board and blank, never reduces moves or active time', () => {
  const original=start(createGame()); const a=moveTile(original,adjacent(original),100); const b=moveTile(a,adjacent(a),120); const u=undo(b), uu=undo(u);
  assert.deepEqual(u.board,a.board); assert.equal(u.blank,a.blank); assert.deepEqual(uu.board,original.board); assert.equal(uu.moveCount,2);assert.equal(uu.undoCount,2);assert.equal(elapsed(uu,300),200);assert.strictEqual(undo(uu),uu);
  assert.equal(u.history.length,u.moveCount-u.undoCount);assert.equal(uu.history.length,uu.moveCount-uu.undoCount);
  assert(Object.isFrozen(original));assert(Object.isFrozen(a.board));assert(Object.isFrozen(a.history));assert.equal(original.moveCount,0);assert.equal(original.history.length,0);
});
test('undo branching uses current board and cannot make cheaper record', () => {
  const base=start(createGame()); const a=moveTile(base,adjacent(base),10), u=undo(a), b=moveTile(u,adjacent(u),20);
  assert.deepEqual(a.board,b.board);assert.equal(b.moveCount,2);assert.equal(b.undoCount,1);assert.equal(b.history.length,1);
  const save=settleRecord(defaults(),'post-20-v1',20,500).save;const record=settleRecord(save,'post-20-v1',21,1);assert(!record.improved);assert.equal(record.save.records['post-20-v1'].bestMoves,20);
});
test('pause/resume exclude inactive time and reject input until explicit resume', () => {
  const s=moveTile(start(createGame()),adjacent(createGame()),100);const p=pause(s,200,'protection');assert.equal(elapsed(p,9000),100);assert.strictEqual(moveTile(p,adjacent(p),9001),p);assert.strictEqual(undo(p),p);const r=resume(p,10000);assert.equal(elapsed(r,10100),200);
});
test('goal preview excludes active time, blocks undo/moves, release resumes normally', () => {
  const a=moveTile(start(createGame()),adjacent(createGame()),100);const p=beginPreview(a,150);assert(p.preview);assert.equal(elapsed(p,5000),50);assert.strictEqual(undo(p),p);assert.strictEqual(moveTile(p,adjacent(p),200),p);const r=endPreview(p,6000);assert.equal(elapsed(r,6100),150);assert.deepEqual(a.board,r.board);assert.equal(r.history.length,a.history.length);
});
test('protection during goal preview never resumes on release', () => {
  const a=moveTile(start(createGame()),adjacent(createGame()),100);const p=beginPreview(a,150);const blur=pause(p,200,'protection'), release=endPreview(blur,9000);assert.equal(release.status,'paused');assert(!release.preview);assert.equal(elapsed(release,10000),50);
});
test('ready/paused preview leaves timer unstarted or paused', () => {
  for(const s of [createGame(),pause(start(createGame()),10)]) {const end=endPreview(beginPreview(s,20),20000);assert.equal(end.status,s.status);assert.equal(elapsed(end,40000),0);}
});
test('won clock integer minimum 1ms, fixed forever and input locked', () => {
  const won=solve('practice-v1');assert(Number.isSafeInteger(won.elapsedMs));assert.equal(elapsed(won,1e9),won.elapsedMs);assert.strictEqual(beginPreview(won,1e9),won);assert.strictEqual(command(won,'start',1e9),won);assert.strictEqual(command(won,'undo',1e9),won);
});
test('default save isolates all modes and starts muted', () => {
  const s=defaults();assert.equal(s.version,1);assert.equal(s.theme,'cream');assert.equal(s.muted,true);assert.deepEqual(Object.keys(s.records),MODE_IDS);assert.notStrictEqual(s.records[MODE_IDS[0]],s.records[MODE_IDS[1]]);assert(!sanitize(s).recovered);
});
test('best moves first, then paired time; ties increment wins only', () => {
  let s=settleRecord(defaults(),'post-20-v1',30,100).save;
  for(const [moves,ms,improved,bm,bt] of [[31,1,false,30,100],[29,500,true,29,500],[29,400,true,29,400],[29,400,false,29,400],[29,450,false,29,400]]) {const r=settleRecord(s,'post-20-v1',moves,ms);assert.equal(r.improved,improved);assert.equal(r.save.records['post-20-v1'].bestMoves,bm);assert.equal(r.save.records['post-20-v1'].bestMs,bt);s=r.save;}
  assert.equal(s.records['post-20-v1'].wins,6);assert.equal(s.records['practice-v1'].wins,0);
});
test('all modes settle independently and roundtrip unchanged', () => {
  let s=defaults(); for(const id of MODE_IDS) {const won=solve(id);s=settleRecord(s,id,won.moveCount,won.elapsedMs).save;}
  const loaded=loadSave(()=>({getItem:key=>{assert.equal(key,STORAGE_KEY);return JSON.stringify(s);}}));assert.deepEqual(loaded.save,s);assert(!loaded.blocked);assert(!loaded.recovered);
});
test('unknown theme repairs only theme, never valid records', () => {
  const s=settleRecord(defaults(),'post-20-v1',20,100).save;const r=sanitize({...s,theme:'missing'});assert(r.recovered);assert.equal(r.save.theme,'cream');assert.deepEqual(r.save.records,s.records);
});
test('invalid records repaired individually; zero wins and best pair relations validated', () => {
  const good=settleRecord(defaults(),'practice-v1',8,200).save;
  for(const record of [{wins:0,bestMoves:1,bestMs:1},{wins:1,bestMoves:null,bestMs:null},{wins:-1,bestMoves:2,bestMs:2},{wins:1,bestMoves:0,bestMs:1},{wins:1,bestMoves:1,bestMs:0},{wins:1.1,bestMoves:2,bestMs:2},{wins:Infinity,bestMoves:2,bestMs:2},{wins:NaN,bestMoves:2,bestMs:2},{wins:Number.MAX_SAFE_INTEGER+1,bestMoves:2,bestMs:2},{wins:1,bestMoves:Infinity,bestMs:1},{wins:1,bestMoves:1,bestMs:NaN}]) {
    const r=sanitize({...good,records:{...good.records,'post-20-v1':record}});assert(r.recovered);assert.deepEqual(r.save.records['post-20-v1'],defaults().records['post-20-v1']);assert.deepEqual(r.save.records['practice-v1'],good.records['practice-v1']);
  }
});
test('old versions, malformed JSON and invalid root use defaults without deleting other keys', () => {
  for(const raw of ['{oops','null','[]','{"version":0}','{"version":2}',JSON.stringify({version:1,records:[]})]) {
    let reads=0;const r=loadSave(()=>({getItem:key=>{reads++;assert.equal(key,STORAGE_KEY);return raw;},removeItem(){assert.fail('must not delete');}}));assert(r.recovered);assert.deepEqual(r.save,defaults());assert.equal(reads,1);
  }
});
test('storage accessor getter, getItem, setItem failures are independently contained', () => {
  const getter=()=>{throw Error('getter blocked');}, get=()=>({getItem(){throw Error('read blocked');}}), set=()=>({setItem(){throw Error('write blocked');}});
  assert(loadSave(getter).blocked);assert(loadSave(get).blocked);assert(!writeSave(getter,defaults()));assert(!writeSave(set,defaults()));
  assert.equal(loadSave(()=>({getItem:()=>null})).blocked,false);let memory=defaults();memory=settleRecord(memory,'practice-v1',8,30).save;assert.equal(memory.records['practice-v1'].wins,1);
});
test('writer changes only its own versioned key', () => {
  const map=new Map([['another.game','untouched']]);assert(writeSave(()=>({setItem:(k,v)=>map.set(k,v)}),defaults()));assert.equal(map.get('another.game'),'untouched');assert.deepEqual(JSON.parse(map.get(STORAGE_KEY)),defaults());assert.equal(map.size,2);
});
test('unknown stored mode and invalid muted recover without erasing valid record', () => {
  const good=settleRecord(defaults(),'practice-v1',8,100).save;const r=sanitize({...good,muted:'false',records:{...good.records,constructor:{wins:100}}});assert(r.recovered);assert.equal(r.save.muted,true);assert.deepEqual(r.save.records,good.records);
});
test('settler rejects malformed mode and metrics without coercion or mutation', () => {
  const s=defaults(); for(const id of ['constructor','__proto__',Symbol('mode'),{}]) assert.strictEqual(settleRecord(s,id,1,1).save,s);
  for(const v of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'20',null,Symbol('metric')]) {assert.strictEqual(settleRecord(s,'post-20-v1',v,1).save,s);assert.strictEqual(settleRecord(s,'post-20-v1',1,v).save,s);}
});
test('v1.1 wins cap saturates but valid lexicographic best may improve', () => {
  const s=defaults();s.records['post-20-v1']={wins:1_000_000_000,bestMoves:20,bestMs:10};assert(!sanitize(s).recovered);
  const better=settleRecord(s,'post-20-v1',2,100);assert(better.improved);assert.deepEqual(better.save.records['post-20-v1'],{wins:1_000_000_000,bestMoves:2,bestMs:100});
  const faster=settleRecord(better.save,'post-20-v1',2,1);assert(faster.improved);assert.equal(faster.save.records['post-20-v1'].wins,1_000_000_000);assert.equal(faster.save.records['post-20-v1'].bestMs,1);
  const worse=settleRecord(faster.save,'post-20-v1',3,1);assert(!worse.improved);assert.equal(worse.save.records['post-20-v1'].wins,1_000_000_000);assert.equal(worse.save.records['post-20-v1'].bestMoves,2);
  const edge=defaults();edge.records['post-20-v1']={wins:999_999_999,bestMoves:20,bestMs:10};assert.equal(settleRecord(edge,'post-20-v1',30,30).save.records['post-20-v1'].wins,1_000_000_000);
});
test('v1.1 over-cap mode alone is reset; all safe positive best bounds accepted', () => {
  const good=settleRecord(defaults(),'practice-v1',Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER).save;
  const r=sanitize({...good,records:{...good.records,'post-20-v1':{wins:1_000_000_001,bestMoves:1,bestMs:1}}});assert(r.recovered);assert.deepEqual(r.save.records['practice-v1'],good.records['practice-v1']);assert.equal(r.save.records['post-20-v1'].wins,0);assert.equal(r.save.records['practice-v1'].bestMoves,Number.MAX_SAFE_INTEGER);
});
test('v1.1 invalid record container preserves valid settings; invalid root/version resets all', () => {
  for(const records of [null,[],false,1,'bad']) {const r=sanitize({version:1,muted:false,theme:'evening',records});assert(r.recovered);assert.equal(r.save.muted,false);assert.equal(r.save.theme,'evening');assert.deepEqual(r.save.records,defaults().records);}
  for(const root of [null,[],false,1,'bad',{version:0,muted:false,theme:'evening'},{version:2,muted:false,theme:'evening'}])assert.deepEqual(sanitize(root).save,defaults());
});
test('v1.1 inherited IDs ignored, no coercion of side-effect metrics', () => {
  const s=defaults(),good={wins:1,bestMoves:8,bestMs:1};const records=Object.create({'practice-v1':good});records['post-20-v1']=good;
  const r=sanitize({...s,records});assert.equal(r.save.records['practice-v1'].wins,0);assert.equal(r.save.records['post-20-v1'].wins,1);
  let called=0;const evil={valueOf(){called++;return 1;},toString(){called++;return '1';}};
  assert.strictEqual(settleRecord(s,'post-20-v1',evil,1).save,s);assert.strictEqual(settleRecord(s,'post-20-v1',1,evil).save,s);assert.equal(called,0);
});
