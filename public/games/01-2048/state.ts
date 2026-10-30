import { canMove, createBoard, emptyBoard, maxTile, move, spawnTile, type Board, type Direction, type Position, type RNG } from './engine.js';
import { defaultProfile, gardensFor, type Garden, type Profile } from './storage.js';
export type Phase = 'ready' | 'playing' | 'paused' | 'won' | 'over';
export type Modal = 'help' | 'gardens' | 'restartConfirm';
export interface GameState {
  phase: Phase; modal: Modal | null; board: Board; score: number; highestTile: number; moves: number;
  won: boolean; finished: boolean; bestAtStart: number; profile: Profile;
  endReason: 'blocked' | 'exit' | null;
  pauseReason: 'manual' | 'interrupted' | null;
}
export interface Turn { state: GameState; changed: boolean; scoreDelta: number; merges: number; mergedPositions: Position[]; spawned?: Position }
function add(a: number, b: number): number { const sum = a + b; if (!Number.isSafeInteger(sum)) throw new RangeError('Record overflow'); return sum; }
export function createReady(profile: Profile = defaultProfile()): GameState {
  return { phase: 'ready', modal: null, board: emptyBoard(), score: 0, highestTile: 0, moves: 0, won: false, finished: false, bestAtStart: profile.bestScore, profile, endReason: null, pauseReason: null };
}
export function startGame(state: GameState, rng: RNG): GameState {
  const board = createBoard(rng);
  const bestTile = Math.max(state.profile.bestTile, maxTile(board));
  const profile = { ...state.profile, bestTile, gamesStarted: add(state.profile.gamesStarted, 1), unlockedGardens: gardensFor(bestTile) };
  return { ...createReady(profile), phase: 'playing', board, highestTile: maxTile(board), bestAtStart: state.profile.bestScore };
}
export function applyMove(state: GameState, direction: Direction, rng: RNG): Turn {
  const unchanged = (): Turn => ({ state, changed: false, scoreDelta: 0, merges: 0, mergedPositions: [] });
  if (state.phase !== 'playing' || state.modal) return unchanged();
  const result = move(state.board, direction);
  if (!result.changed) return unchanged();
  const score = add(state.score, result.scoreDelta);
  const spawned = spawnTile(result.board, rng);
  const highestTile = maxTile(spawned.board);
  const firstWin = !state.won && highestTile >= 2048;
  const blocked = !canMove(spawned.board);
  const bestTile = Math.max(state.profile.bestTile, highestTile);
  const profile: Profile = {
    ...state.profile, bestScore: Math.max(state.profile.bestScore, score), bestTile,
    totalMoves: add(state.profile.totalMoves, 1), totalScore: add(state.profile.totalScore, result.scoreDelta),
    gamesWon: add(state.profile.gamesWon, firstWin ? 1 : 0), gamesFinished: add(state.profile.gamesFinished, blocked && !state.finished ? 1 : 0),
    unlockedGardens: gardensFor(bestTile),
  };
  return {
    state: { ...state, board: spawned.board, score, highestTile, moves: add(state.moves, 1), won: state.won || firstWin, finished: state.finished || blocked, endReason: blocked ? 'blocked' : null, profile, phase: firstWin ? 'won' : blocked ? 'over' : 'playing' },
    changed: true, scoreDelta: result.scoreDelta, merges: result.merges, mergedPositions: result.mergedPositions, spawned: spawned.position,
  };
}
export function pauseGame(state: GameState, reason: 'manual' | 'interrupted' = 'interrupted'): GameState {
  return state.phase === 'playing' || (state.phase === 'paused' && reason === 'interrupted')
    ? { ...state, phase: 'paused', pauseReason: reason } : state;
}
export function resumeGame(state: GameState): GameState { return state.phase === 'paused' && !state.modal ? { ...state, phase: 'playing', pauseReason: null } : state; }
/** A voluntary exit preserves all earned records and never counts as a blocked game. */
export function exitGame(state: GameState): GameState {
  return state.phase === 'over' ? state : { ...state, phase: 'over', modal: null, endReason: state.finished ? 'blocked' : 'exit', pauseReason: null };
}
export function openModal(state: GameState, modal: Modal): GameState { return { ...state, modal }; }
export function closeModal(state: GameState): GameState { return { ...state, modal: null }; }
export function continueGame(state: GameState): GameState { return state.phase === 'won' && !state.finished ? { ...state, phase: 'playing' } : state; }
export function showResult(state: GameState): GameState { return state.phase === 'won' && state.finished ? { ...state, phase: 'over' } : state; }
export function selectGarden(state: GameState, garden: Garden): GameState {
  return state.profile.unlockedGardens.includes(garden) ? { ...state, profile: { ...state.profile, selectedGarden: garden } } : state;
}
export function setMuted(state: GameState, muted: boolean): GameState { return { ...state, profile: { ...state.profile, muted } }; }
export function nextGoal(tile: number): number | null { return [128, 256, 512, 1024, 2048].find(goal => tile < goal) ?? null; }
export function recordLabel(state: GameState): string { return state.score > state.bestAtStart ? '새로운 개인 최고 기록' : state.score === state.bestAtStart ? '최고점과 동점' : '다음 정원을 향한 한 걸음'; }
