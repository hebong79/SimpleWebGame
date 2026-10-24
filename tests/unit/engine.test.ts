import test from 'node:test';
import assert from 'node:assert/strict';
import { canMove, cloneBoard, createBoard, emptyBoard, isTile, maxTile, move, spawnTile, validateBoard, type Board, type Direction } from '../../src/client/engine.js';
const row = (values: number[]): Board => [values, [0,0,0,0], [0,0,0,0], [0,0,0,0]];
function sequence(...values: number[]): () => number { let i=0; return () => { assert.ok(i<values.length, 'unexpected RNG call'); return values[i++]; }; }
test('single merge vectors and score', () => {
  for (const [input, output, score] of [[[2,2,2,2],[4,4,0,0],8],[[2,2,4,0],[4,4,0,0],4],[[4,4,4,0],[8,4,0,0],8],[[2,2,4,4],[4,8,0,0],12]] as [number[],number[],number][]) {
    const result=move(row(input),'left'); assert.deepEqual(result.board[0],output); assert.equal(result.scoreDelta,score);
  }
});
test('right up and down are symmetric', () => {
  assert.deepEqual(move(row([2,2,4,4]),'right').board[0],[0,0,4,8]);
  const vertical=[[2,0,0,0],[2,0,0,0],[2,0,0,0],[2,0,0,0]];
  assert.deepEqual(move(vertical,'up').board.map(r=>r[0]),[4,4,0,0]);
  assert.deepEqual(move(vertical,'down').board.map(r=>r[0]),[0,0,4,4]);
});
test('move never mutates rows and preserves tile sum for four directions', () => {
  const board=[[2,2,4,8],[4,0,4,4],[0,8,8,16],[16,16,2,2]];
  const snapshot=cloneBoard(board); board.forEach(Object.freeze); Object.freeze(board);
  for(const dir of ['left','right','up','down'] as Direction[]){ const r=move(board,dir); assert.deepEqual(board,snapshot); assert.equal(r.board.flat().reduce((a,b)=>a+b,0),snapshot.flat().reduce((a,b)=>a+b,0)); r.board.forEach((line,i)=>assert.notEqual(line,board[i])); }
});
test('spawn consumes position then value, row-major, 90:10 boundaries', () => {
  for(const valueRandom of [0,0.899999,0.9,0.999999]){
    const generated=spawnTile(row([2,0,4,0]),sequence(0,valueRandom));
    assert.deepEqual(generated.position,{row:0,col:1}); assert.equal(generated.value,valueRandom<.9?2:4);
  }
  assert.deepEqual(spawnTile(emptyBoard(),sequence(.999999,0)).position,{row:3,col:3});
  assert.deepEqual(createBoard(sequence(0,0,0,.9))[0],[2,4,0,0]);
});
test('no-op has zero score and independent cloned output', () => {
 const b=row([2,4,0,0]); const result=move(b,'left'); assert.equal(result.changed,false); assert.equal(result.merges,0); assert.equal(result.scoreDelta,0); assert.notEqual(result.board,b);
});
test('blocked boards, adjacency and diagonal exclusion', () => {
 const blocked=[[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]];
 assert.equal(canMove(blocked),false); blocked[0][0]=4; assert.equal(canMove(blocked),true); blocked[0][0]=0; assert.equal(canMove(blocked),true);
});
test('2048 is not maximum and overflow rejects without mutation', () => {
 assert.equal(maxTile(move(row([2048,2048,0,0]),'left').board),4096);
 const b=row([2**52,2**52,0,0]); assert.throws(()=>move(b,'left'),RangeError); assert.deepEqual(b[0],[2**52,2**52,0,0]);
});
test('strict numeric and board validation including sparse and rounded log2', () => {
 for(const bad of [-2,1,3,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,2**52-1,'2',null]) assert.equal(isTile(bad),false,String(bad));
 for(const bad of [[],Array(4),[Array(4),[0,0,0,0],[0,0,0,0],[0,0,0,0]],[[2,0,0,0]],row([2,3,0,0])]) { assert.equal(validateBoard(bad),false); assert.throws(()=>move(bad as Board,'left')); }
 assert.equal(validateBoard(emptyBoard()),true);
});
test('full board and invalid random reject without random overconsumption', () => {
 const full=Array.from({length:4},()=>[2,2,2,2]); let calls=0; assert.throws(()=>spawnTile(full,()=>{calls++;return 0})); assert.equal(calls,0);
 for(const value of [-.1,1,NaN,Infinity]) assert.throws(()=>spawnTile(emptyBoard(),()=>value),RangeError);
});
