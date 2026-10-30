import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, closeModal, continueGame, createReady, exitGame, nextGoal, openModal, pauseGame, resumeGame, selectGarden, showResult, startGame, type GameState } from '../../public/games/01-2048/state.js';
import { defaultProfile } from '../../public/games/01-2048/storage.js';
const failRandom=():number=>{throw new Error('RNG must not run');};
function fixture(board:number[][],profile=defaultProfile()): GameState { const ready=createReady({...profile,gamesStarted:1}); return {...ready,phase:'playing',board}; }
test('ready does not start a game, explicit start consumes 4 RNG calls',()=>{
 const ready=createReady(); assert.equal(ready.profile.gamesStarted,0); let calls=0;
 const started=startGame(ready,()=>{calls++;return 0}); assert.equal(calls,4); assert.equal(started.board.flat().filter(Boolean).length,2); assert.equal(started.profile.gamesStarted,1); assert.equal(started.profile.bestTile,2); assert.equal(ready.profile.gamesStarted,0);
});
test('counters update once, no-op zero RNG and restart preserves records',()=>{
 let state=startGame(createReady(),()=>0);
 state=applyMove(state,'left',()=>0).state;
 assert.equal(state.score,4); assert.equal(state.profile.totalScore,4); assert.equal(state.profile.totalMoves,1);
 const noop=applyMove(state,'left',failRandom); assert.equal(noop.state,state); assert.equal(noop.changed,false);
 state=startGame(state,()=>0); assert.equal(state.profile.gamesStarted,2); assert.equal(state.profile.totalScore,4); assert.equal(state.profile.gamesFinished,0); assert.equal(state.score,0);
});
test('win+blocked prioritizes celebration, separately records both once',()=>{
 const initial=fixture([[1024,1024,4,8],[2,8,16,32],[4,16,32,64],[8,32,64,128]]);
 const result=applyMove(initial,'left',()=>0); const won=result.state;
 assert.deepEqual(won.board[0],[2048,4,8,2]); assert.equal(won.phase,'won'); assert.equal(won.finished,true);
 assert.equal(won.profile.gamesWon,1); assert.equal(won.profile.gamesFinished,1); assert.equal(continueGame(won),won);
 const over=showResult(won); assert.equal(over.phase,'over'); assert.equal(showResult(over),over); assert.equal(applyMove(over,'right',failRandom).state,over);
 assert.equal(over.profile.gamesWon,1); assert.equal(over.profile.gamesFinished,1);
});
test('continuation makes 4096 without duplicate celebration',()=>{
 const state=fixture([[1024,1024,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
 const won=applyMove(state,'left',()=>0).state; assert.equal(won.phase,'won'); assert.equal(won.profile.gamesWon,1);
 const continued=continueGame(won); assert.equal(continued.phase,'playing');
 const next=applyMove({...continued,board:[[2048,2048,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]},'left',()=>0).state;
 assert.equal(next.highestTile,4096); assert.equal(next.phase,'playing'); assert.equal(next.profile.gamesWon,1);
});
test('paused/modal block RNG; interruption during modal persists after close',()=>{
 const playing=startGame(createReady(),()=>0); const help=openModal(playing,'help');
 assert.equal(applyMove(help,'down',failRandom).changed,false);
 const paused=pauseGame(help); assert.equal(paused.modal,'help'); assert.equal(paused.phase,'paused');
 assert.equal(resumeGame(paused),paused); const closed=closeModal(paused); assert.equal(closed.phase,'paused');
 assert.equal(applyMove(closed,'down',failRandom).changed,false); assert.equal(resumeGame(closed).phase,'playing');
 assert.deepEqual(closed.board,playing.board); assert.deepEqual(closeModal(help).board,playing.board);
});
test('targets, unlocks and cosmetic theme keep identical game results',()=>{
 assert.deepEqual([64,128,256,512,1024,2048].map(nextGoal),[128,256,512,1024,2048,null]);
 const base=startGame(createReady({...defaultProfile(),bestTile:1024,unlockedGardens:['seed','grove','bloom']}),()=>0);
 const results=['seed','grove','bloom'].map(g=>applyMove(selectGarden(base,g as 'seed'|'grove'|'bloom'),'left',()=>0).state);
 results.forEach(r=>{assert.deepEqual(r.board,results[0].board);assert.equal(r.score,results[0].score)});
 const locked=startGame(createReady(),()=>0);assert.equal(selectGarden(locked,'bloom'),locked);
});
test('record overflow rejects entire transaction without changing state',()=>{
 const state=fixture([[2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],{...defaultProfile(),totalScore:Number.MAX_SAFE_INTEGER});
 const before=structuredClone(state); assert.throws(()=>applyMove(state,'left',()=>0),RangeError); assert.deepEqual(state,before);
});

test('voluntary exit preserves board, earned records and blocked counter without RNG',()=>{
 const playing=applyMove(startGame(createReady(),()=>0),'left',()=>0).state;
 const before=structuredClone(playing);
 for(const state of [playing,pauseGame(playing,'manual'),openModal(playing,'help')]){
  const exited=exitGame(state);
  assert.equal(exited.phase,'over'); assert.equal(exited.modal,null); assert.equal(exited.endReason,'exit');
  assert.equal(exited.pauseReason,null); assert.deepEqual(exited.board,playing.board);
  assert.equal(exited.score,playing.score); assert.equal(exited.highestTile,playing.highestTile);
  assert.deepEqual(exited.profile,playing.profile); assert.equal(exited.profile.gamesFinished,0);
  assert.equal(exitGame(exited),exited); assert.equal(applyMove(exited,'down',failRandom).state,exited);
  const restarted=startGame(exited,()=>0); assert.equal(restarted.endReason,null); assert.equal(restarted.score,0);
 }
 assert.deepEqual(playing,before);
});

test('blocked result remains distinct from voluntary exit including simultaneous win',()=>{
 const state=fixture([[1024,1024,4,8],[2,8,16,32],[4,16,32,64],[8,32,64,128]]);
 const won=applyMove(state,'left',()=>0).state;
 assert.equal(won.endReason,'blocked'); assert.equal(won.profile.gamesFinished,1);
 const exited=exitGame(won); assert.equal(exited.endReason,'blocked'); assert.equal(exited.profile.gamesFinished,1);
 assert.equal(showResult(won).endReason,'blocked');
});

test('manual pause is distinguished from interruption and restart cancellation preserves it',()=>{
 const playing=startGame(createReady(),()=>0);
 const manual=pauseGame(playing,'manual'); assert.equal(manual.pauseReason,'manual');
 const confirmation=openModal(manual,'restartConfirm'); const canceled=closeModal(confirmation);
 assert.equal(canceled.phase,'paused'); assert.equal(canceled.pauseReason,'manual'); assert.deepEqual(canceled.board,playing.board);
 const interrupted=pauseGame(confirmation,'interrupted'); assert.equal(interrupted.modal,'restartConfirm');
 assert.equal(closeModal(interrupted).pauseReason,'interrupted');
 assert.equal(resumeGame(canceled).pauseReason,null); assert.equal(pauseGame(playing).pauseReason,'interrupted');
});
