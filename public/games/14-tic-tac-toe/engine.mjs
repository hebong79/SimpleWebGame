// Pure, immutable local-two-player rules. No DOM, storage, clock or RNG.
export const COUNTER_CAP = 1_000_000;
export const WINNING_LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
].map(Object.freeze));
export const opposite = player => player === 'X' ? 'O' : 'X';
export const emptyTotals = () => ({ xWins: 0, oWins: 0, draws: 0 });
export function totalRounds(totals) {
  return BigInt(totals.xWins) + BigInt(totals.oWins) + BigInt(totals.draws);
}
export function incrementTotals(totals, outcome) {
  if (outcome !== 'X' && outcome !== 'O' && outcome !== 'draw') return totals;
  if (totalRounds(totals) >= BigInt(COUNTER_CAP)) return totals;
  const key = outcome === 'X' ? 'xWins' : outcome === 'O' ? 'oWins' : 'draws';
  return { ...totals, [key]: totals[key] + 1 };
}
function freshRound(id, starter) {
  return { id, starter, current: starter, board: Array(9).fill(null), moves: 0, winner: null, winningLines: [] };
}
export function createGame() {
  return { phase: 'ready', pauseCause: null, round: freshRound(0, 'X'), session: emptyTotals() };
}
export function startGame(state) {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'playing', pauseCause: null, round: freshRound(state.round.id + 1, 'X') };
}
export function place(state, index) {
  if (state.phase !== 'playing' || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 8 || state.round.board[index] !== null) return state;
  const board = state.round.board.slice();
  const mover = state.round.current;
  board[index] = mover;
  const moves = state.round.moves + 1;
  const winningLines = WINNING_LINES.filter(line => line.every(i => board[i] === mover)).map(line => [...line]);
  const outcome = winningLines.length ? mover : moves === 9 ? 'draw' : null;
  return {
    ...state, phase: outcome ? 'result' : 'playing', pauseCause: null,
    round: { ...state.round, board, moves, current: outcome ? mover : opposite(mover), winner: outcome, winningLines },
    session: outcome ? incrementTotals(state.session, outcome) : state.session,
  };
}
export function pauseGame(state, cause = 'manual') {
  if (cause !== 'manual' && cause !== 'protection' && cause !== 'dialog') return state;
  if (state.phase !== 'playing' && state.phase !== 'paused') return state;
  const pauseCause = state.pauseCause === 'protection' || cause === 'protection' ? 'protection' : state.phase === 'paused' ? state.pauseCause : cause;
  if (state.phase === 'paused' && pauseCause === state.pauseCause) return state;
  return { ...state, phase: 'paused', pauseCause };
}
export function resumeGame(state) {
  if (state.phase !== 'paused') return state;
  return { ...state, phase: 'playing', pauseCause: null };
}
export function nextRound(state) {
  if (state.phase !== 'result') return state;
  return { ...state, phase: 'playing', pauseCause: null, round: freshRound(state.round.id + 1, opposite(state.round.starter)) };
}
export function restartRound(state) {
  if (state.phase !== 'playing' && state.phase !== 'paused') return state;
  return { ...state, phase: 'playing', pauseCause: null, round: freshRound(state.round.id + 1, state.round.starter) };
}
export function rove(index, key) {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 8 || typeof key !== 'string') return index;
  const row = Math.floor(index / 3), col = index % 3;
  switch (key) {
    case 'ArrowLeft': return row * 3 + Math.max(0, col - 1);
    case 'ArrowRight': return row * 3 + Math.min(2, col + 1);
    case 'ArrowUp': return Math.max(0, row - 1) * 3 + col;
    case 'ArrowDown': return Math.min(2, row + 1) * 3 + col;
    default: return index;
  }
}
