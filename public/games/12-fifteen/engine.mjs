import {PUZZLES, DEFAULT_MODE, validMode, validDirection, targetIndex, isGoal} from './puzzles.mjs';
export {PUZZLES, isGoal};
const freeze = s => Object.freeze({...s, board: Object.freeze(s.board), history: Object.freeze(s.history)});
const validTime = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function createGame(modeId = DEFAULT_MODE) {
  if (!validMode(modeId)) throw new RangeError('Unknown puzzle ID');
  const puzzle = PUZZLES[modeId];
  return freeze({modeId, size: puzzle.size, board: [...puzzle.board], blank: puzzle.board.indexOf(0), status: 'ready', pauseReason: '', preview: false, started: false, elapsedMs: 0, activeSince: null, moveCount: 0, undoCount: 0, history: []});
}
export function elapsed(s, now) {
  return s.elapsedMs + (s.activeSince !== null && validTime(now) ? Math.max(0, now - s.activeSince) : 0);
}
const stopClock = (s, now) => ({...s, elapsedMs: elapsed(s, now), activeSince: null});
export function start(s) { return s.status === 'ready' ? freeze({...s, status: 'playing'}) : s; }
export function pause(s, now, reason = 'manual') {
  if (s.status !== 'playing' || !validTime(now)) return s;
  return freeze({...stopClock(s, now), status: 'paused', preview: false, pauseReason: reason === 'protection' ? 'protection' : reason === 'modal' ? 'modal' : 'manual'});
}
export function resume(s, now) {
  return s.status === 'paused' && validTime(now) ? freeze({...s, status: 'playing', pauseReason: '', activeSince: s.started ? now : null}) : s;
}
export function beginPreview(s, now) {
  return !s.preview && s.status !== 'won' && validTime(now) ? freeze({...stopClock(s, now), preview: true}) : s;
}
export function endPreview(s, now) {
  return s.preview && validTime(now) ? freeze({...s, preview: false, activeSince: s.started && s.status === 'playing' ? now : null}) : s;
}
export function moveTile(s, index, now) {
  if (s.status !== 'playing' || s.preview || !validTime(now) || !Number.isInteger(index) || index < 0 || index >= s.board.length || s.moveCount >= Number.MAX_SAFE_INTEGER) return s;
  const distance = Math.abs(Math.floor(index / s.size) - Math.floor(s.blank / s.size)) + Math.abs(index % s.size - s.blank % s.size);
  if (distance !== 1) return s;
  const board = [...s.board];
  [board[s.blank], board[index]] = [board[index], board[s.blank]];
  const won = isGoal(board);
  const base = {...s, board, blank: index, moveCount: s.moveCount + 1, started: true, activeSince: s.activeSince ?? now, history: [...s.history, Object.freeze({board: s.board, blank: s.blank})]};
  if (won) Object.assign(base, {status: 'won', elapsedMs: Math.max(1, Math.floor(elapsed(base, now))), activeSince: null});
  return freeze(base);
}
export function moveDirection(s, direction, now) {
  return validDirection(direction) ? moveTile(s, targetIndex(s.blank, s.size, direction), now) : s;
}
export function undo(s) {
  if (s.status !== 'playing' || s.preview || !s.history.length) return s;
  const previous = s.history.at(-1);
  return freeze({...s, board: previous.board, blank: previous.blank, history: s.history.slice(0, -1), undoCount: s.undoCount + 1});
}
// Dispatch accepts only primitive own commands; no implicit key coercion.
export function command(s, name, now) {
  if (typeof name !== 'string') return s;
  if (validDirection(name)) return moveDirection(s, name, now);
  switch (name) {
    case 'start': return start(s);
    case 'pause': return pause(s, now);
    case 'resume': return resume(s, now);
    case 'undo': return undo(s);
    default: return s;
  }
}
