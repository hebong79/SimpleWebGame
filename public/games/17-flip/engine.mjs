// Original deterministic cross-toggle puzzle rules. No browser dependencies.
export const LOCK_MS = 120;
export function affected(size, index) {
  if (![3, 4].includes(size) || !Number.isInteger(index) || index < 0 || index >= size * size) return [];
  const r = Math.floor(index / size), c = index % size;
  return [index, ...(r > 0 ? [index - size] : []), ...(r < size - 1 ? [index + size] : []), ...(c > 0 ? [index - 1] : []), ...(c < size - 1 ? [index + 1] : [])];
}
export function toggle(board, size, index) {
  const cells = affected(size, index); if (!cells.length) return board;
  const next = [...board]; for (const i of cells) next[i] ^= 1; return next;
}
export function makeBoard(size, scramble) { return scramble.reduce((board, i) => toggle(board, size, i), Array(size * size).fill(1)); }
export function solve(board, size) {
  const n = size * size, goal = (1 << n) - 1;
  const value = board.reduce((mask, on, i) => mask | (on << i), 0);
  const masks = Array.from({ length: n }, (_, i) => affected(size, i).reduce((m, j) => m | (1 << j), 0));
  let best = null, oldGray = 0, current = value, count = 0;
  for (let k = 0; k < (1 << n); k++) {
    const gray = k ^ (k >> 1);
    if (k) { const changed = gray ^ oldGray, i = 31 - Math.clz32(changed); current ^= masks[i]; count += (gray & changed) ? 1 : -1; }
    if (current === goal && (best === null || count < best.length)) best = Array.from({ length: n }, (_, i) => i).filter(i => gray & (1 << i));
    oldGray = gray;
  }
  return best;
}
const content = [
  [3, [0]], [3, [4, 8]], [3, [0, 2, 6]], [3, [0, 1, 5, 8]], [3, [0, 1, 3, 5, 8]],
  [4, [0, 15]], [4, [1, 6, 12]], [4, [0, 5, 10, 15]], [4, [0, 3, 6, 9, 12]],
  [4, [0, 1, 4, 8, 11, 15]], [4, [1, 2, 4, 7, 10, 12, 15]], [4, [0, 2, 5, 7, 8, 10, 13, 15]],
  [4, [0, 1, 3, 4, 6, 9, 11, 12, 14]], [4, [0, 1, 2, 4, 5, 7, 8, 10, 13, 15]],
  [4, [1, 3, 5, 6, 7, 8, 11]]
];
const targets = [1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 5, 4, 5, 4, 7];
export const STAGES = Object.freeze(content.map(([size, scramble], i) => Object.freeze({ id: i + 1, size, scramble: Object.freeze(scramble), target: targets[i] })));
export function starsFor(moves, target) { return moves <= target ? 3 : moves <= target + 2 ? 2 : 1; }
export function createGame(stage = 1) {
  const level = STAGES[stage - 1]; if (!level) throw new RangeError('Unknown stage');
  return { phase: 'ready', subphase: 'ready', round: 0, stage, size: level.size, board: makeBoard(level.size, level.scramble), moves: 0, history: [], remaining: 0, pauseCause: null, result: null, token: 0 };
}
export function startGame(game, stage = game.stage) { return { ...createGame(stage), phase: 'playing', subphase: 'input', round: game.round + 1, token: game.token + 1 }; }
export function pressCell(game, index) {
  if (game.phase !== 'playing' || game.remaining > 0 || !affected(game.size, index).length || game.moves >= Number.MAX_SAFE_INTEGER) return game;
  const board = toggle(game.board, game.size, index), moves = game.moves + 1, won = board.every(Boolean);
  return { ...game, board, moves, history: [...game.history, index], remaining: won ? 0 : LOCK_MS, phase: won ? 'result' : 'playing', subphase: won ? 'result' : 'feedback', result: won ? { stage: game.stage, moves, stars: starsFor(moves, STAGES[game.stage - 1].target) } : null };
}
export function undo(game) {
  if (game.phase !== 'playing' || game.remaining > 0 || !game.history.length) return game;
  return { ...game, board: toggle(game.board, game.size, game.history.at(-1)), moves: game.moves - 1, history: game.history.slice(0, -1), remaining: LOCK_MS, subphase: 'feedback' };
}
export function pauseGame(game, cause = 'manual') {
  if (game.phase === 'paused') return cause === 'protection' && game.pauseCause !== cause ? { ...game, pauseCause: cause } : game;
  return game.phase === 'playing' ? { ...game, phase: 'paused', pauseCause: cause } : game;
}
export function resumeGame(game) { return game.phase === 'paused' ? { ...game, phase: 'playing', pauseCause: null } : game; }
export function tick(game, delta, token = game.token) {
  if (game.phase !== 'playing' || token !== game.token || !Number.isFinite(delta) || delta < 0) return game;
  if (delta > 250) return pauseGame(game, 'protection');
  if (game.remaining === 0) return game;
  const remaining = Math.max(0, game.remaining - delta);
  return { ...game, remaining, subphase: remaining > 0 ? 'feedback' : 'input' };
}
