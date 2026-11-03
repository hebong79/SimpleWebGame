export const MODES = Object.freeze({ easy: Object.freeze({ rows: 8, cols: 8, colors: 3 }), normal: Object.freeze({ rows: 10, cols: 10, colors: 3 }), extra: Object.freeze({ rows: 10, cols: 10, colors: 4 }) });
export const COLLAPSE_MS = 200;
export const modeOf = mode => Object.hasOwn(MODES, mode) ? mode : 'normal';
export function createBoard(mode = 'normal', random = Math.random) {
  const { rows, cols, colors } = MODES[modeOf(mode)];
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => {
    const value = random();
    return Math.min(colors - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * colors)));
  }));
}
export const countRemaining = board => board.reduce((n, row) => n + row.filter(cell => cell !== null).length, 0);
export const groupScore = size => Number.isSafeInteger(size) && size >= 2 ? (size - 2) ** 2 : 0;
export function floodGroup(board, row, col) {
  const color = board[row]?.[col];
  if (color === null || color === undefined) return [];
  const stack = [[row, col]], seen = new Set(), group = [];
  while (stack.length) {
    const [r, c] = stack.pop(), key = `${r},${c}`;
    if (seen.has(key) || board[r]?.[c] !== color) continue;
    seen.add(key); group.push([r, c]);
    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
  return group.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export function hasMoves(board) {
  return board.some((row, r) => row.some((color, c) => color !== null && (board[r + 1]?.[c] === color || row[c + 1] === color)));
}
export function collapseBoard(board) {
  const rows = board.length, cols = board[0]?.length ?? 0;
  const result = Array.from({ length: rows }, () => Array(cols).fill(null));
  let target = 0;
  for (let c = 0; c < cols; c++) {
    const values = board.map(row => row[c]).filter(cell => cell !== null);
    if (!values.length) continue;
    values.forEach((cell, i) => { result[rows - values.length + i][target] = cell; }); target++;
  }
  return result;
}
export function createGame(mode = 'normal') {
  return { phase: 'ready', subphase: 'idle', round: 0, revision: 0, mode: modeOf(mode), board: [], selection: [], remaining: 0, score: 0, moves: 0, bonus: 0, lockRemaining: 0, pauseCause: null, result: null, notice: '' };
}
function finish(game) {
  if (game.phase === 'result') return game;
  return { ...game, phase: 'result', subphase: 'finished', lockRemaining: 0, selection: [], result: { reason: game.remaining === 0 ? 'all-clear' : 'no-moves', score: game.score, remaining: game.remaining, moves: game.moves, bonus: game.bonus } };
}
export function startGame(game, mode = game.mode, random = Math.random) {
  const board = createBoard(mode, random);
  const next = { ...createGame(mode), phase: 'playing', subphase: 'input', round: game.round + 1, board, remaining: countRemaining(board) };
  return hasMoves(board) ? next : finish(next);
}
export function clearSelection(game) {
  if (game.phase !== 'playing' || game.subphase !== 'input' || !game.selection.length) return game;
  return { ...game, selection: [], notice: '선택을 취소했어요.' };
}
export function selectCell(game, row, col) {
  if (game.phase !== 'playing' || game.subphase !== 'input') return game;
  const group = floodGroup(game.board, row, col);
  if (group.length < 2) return { ...game, selection: [], notice: '같은 모양이 둘 이상 연결된 묶음을 골라 주세요.' };
  if (!game.selection.some(([r, c]) => r === row && c === col)) return { ...game, selection: group, notice: '' };
  const removed = game.board.map(row => [...row]); group.forEach(([r, c]) => { removed[r][c] = null; });
  const board = collapseBoard(removed), remaining = countRemaining(board), bonus = remaining === 0 ? 500 : 0;
  return { ...game, board, remaining, selection: [], score: game.score + groupScore(group.length) + bonus, bonus: game.bonus + bonus, moves: game.moves + 1, revision: game.revision + 1, subphase: 'collapse', lockRemaining: COLLAPSE_MS, notice: '' };
}
export function advanceGame(game, elapsed) {
  if (game.phase !== 'playing' || game.subphase !== 'collapse' || !Number.isFinite(elapsed) || elapsed <= 0) return game;
  const lockRemaining = Math.max(0, game.lockRemaining - elapsed);
  if (lockRemaining > 0) return { ...game, lockRemaining };
  const next = { ...game, lockRemaining: 0, subphase: 'input' };
  return hasMoves(game.board) ? next : finish(next);
}
export function pauseGame(game, cause = 'manual') {
  if (game.phase === 'paused') return cause === 'protection' && game.pauseCause !== 'protection' ? { ...game, pauseCause: cause } : game;
  return game.phase === 'playing' ? { ...game, phase: 'paused', pauseCause: cause } : game;
}
export function resumeGame(game) { return game.phase === 'paused' ? { ...game, phase: 'playing', pauseCause: null } : game; }
