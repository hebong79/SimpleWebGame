// 조약돌 하나 (pebble-solo) pure rules engine. No DOM, no timers, no randomness.
// A game is a plain object; every function returns a NEW game (or the same reference for a no-op).
export const COUNT_CAP = 1_000_000;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

// cells: -1 = not on the board, 0 = empty hole, 1 = peg. Cell index = row * width + col.
export const BOARDS = freeze({
  cross5: { id: 'cross5', width: 5, height: 5, holes: [0, 4, 20, 24] },
  cross7: { id: 'cross7', width: 7, height: 7, holes: [0, 1, 5, 6, 7, 8, 12, 13, 35, 36, 40, 41, 42, 43, 47, 48] },
});

export const STAGES = freeze([
  { id: 1, board: 'cross5', tier: 'early', count: 4, pegs: [5, 11, 12, 16], witness: [[12, 10], [5, 15], [15, 17]] },
  { id: 2, board: 'cross5', tier: 'early', count: 5, pegs: [2, 3, 7, 8, 12], witness: [[3, 1], [8, 6], [1, 11], [11, 13]] },
  { id: 3, board: 'cross5', tier: 'early', count: 6, pegs: [11, 12, 13, 15, 16, 22], witness: [[12, 14], [15, 17], [22, 12], [11, 13], [14, 12]] },
  { id: 4, board: 'cross5', tier: 'mid', count: 7, pegs: [2, 5, 12, 13, 16, 18, 19], witness: [[13, 11], [16, 6], [5, 7], [2, 12], [19, 17], [12, 22]] },
  { id: 5, board: 'cross5', tier: 'mid', count: 8, pegs: [2, 5, 8, 10, 12, 16, 18, 19], witness: [[5, 15], [15, 17], [17, 7], [2, 12], [19, 17], [17, 7], [7, 9]] },
  { id: 6, board: 'cross5', tier: 'mid', count: 9, pegs: [1, 7, 8, 9, 10, 11, 13, 14, 17], witness: [[8, 6], [10, 12], [17, 7], [6, 8], [9, 7], [14, 12], [12, 2], [1, 3]] },
  { id: 7, board: 'cross5', tier: 'mid', count: 10, pegs: [5, 6, 7, 8, 11, 13, 14, 17, 18, 22], witness: [[6, 16], [8, 6], [5, 7], [13, 23], [16, 18], [23, 13], [14, 12], [7, 17], [22, 12]] },
  { id: 8, board: 'cross5', tier: 'late', count: 12, pegs: [3, 6, 8, 9, 11, 12, 14, 17, 18, 21, 22, 23], witness: [[3, 13], [6, 16], [9, 19], [12, 14], [21, 11], [22, 12], [11, 13], [14, 12], [19, 17], [12, 22], [23, 21]] },
  { id: 9, board: 'cross5', tier: 'late', count: 14, pegs: [1, 2, 3, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 19], witness: [[1, 11], [3, 1], [7, 17], [9, 7], [10, 12], [12, 2], [1, 3], [18, 8], [3, 13], [14, 12], [16, 18], [19, 17], [12, 22]] },
  { id: 10, board: 'cross5', tier: 'late', count: 16, pegs: [1, 2, 3, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 22, 23], witness: [[3, 13], [1, 3], [6, 8], [15, 17], [17, 7], [8, 6], [6, 16], [14, 12], [19, 17], [17, 7], [23, 21], [21, 11], [10, 12], [12, 2], [3, 1]] },
]);

export function emptyCells(board) {
  const cells = new Array(board.width * board.height).fill(0);
  for (const hole of board.holes) cells[hole] = -1;
  return cells;
}
export function cellsFromPegs(board, pegs) {
  const cells = emptyCells(board);
  for (const peg of pegs) {
    if (!Number.isInteger(peg) || peg < 0 || peg >= cells.length || cells[peg] !== 0) throw new RangeError(`invalid peg cell ${peg}`);
    cells[peg] = 1;
  }
  return cells;
}
export const countPegs = cells => cells.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0);

const inRange = (cells, index) => Number.isInteger(index) && index >= 0 && index < cells.length;
// Validates one jump without changing anything. reason: off-board | no-peg | bad-geometry | no-middle | occupied
export function checkJump(board, cells, from, to) {
  if (!inRange(cells, from) || !inRange(cells, to) || cells[from] === -1 || cells[to] === -1) return { ok: false, reason: 'off-board' };
  if (cells[from] !== 1) return { ok: false, reason: 'no-peg' };
  const fr = Math.floor(from / board.width), fc = from % board.width, tr = Math.floor(to / board.width), tc = to % board.width;
  const dr = tr - fr, dc = tc - fc;
  if (!((dr === 0 && Math.abs(dc) === 2) || (dc === 0 && Math.abs(dr) === 2))) return { ok: false, reason: 'bad-geometry' };
  const over = ((fr + tr) / 2) * board.width + (fc + tc) / 2;
  if (cells[over] === -1) return { ok: false, reason: 'off-board' };
  if (cells[over] !== 1) return { ok: false, reason: 'no-middle' };
  if (cells[to] !== 0) return { ok: false, reason: 'occupied' };
  return { ok: true, over };
}
const STEPS = [[0, -2], [0, 2], [-2, 0], [2, 0]];
export function jumpsFrom(board, cells, from) {
  const found = [];
  if (!inRange(cells, from) || cells[from] !== 1) return found;
  const row = Math.floor(from / board.width), col = from % board.width;
  for (const [dr, dc] of STEPS) {
    const r = row + dr, c = col + dc;
    if (r < 0 || c < 0 || r >= board.height || c >= board.width) continue;
    const to = r * board.width + c, check = checkJump(board, cells, from, to);
    if (check.ok) found.push({ from, over: check.over, to });
  }
  return found;
}
export function legalJumps(board, cells) {
  const found = [];
  for (let from = 0; from < cells.length; from++) found.push(...jumpsFrom(board, cells, from));
  return found;
}
export const isWon = cells => countPegs(cells) === 1;
export const isStuck = (board, cells) => countPegs(cells) > 1 && legalJumps(board, cells).length === 0;

const stageOf = id => STAGES[Number.isInteger(id) && id >= 1 && id <= STAGES.length ? id - 1 : 0];
export function createGame(stageId = 1, round = 0, token = 0) {
  const stage = stageOf(stageId), board = BOARDS[stage.board], cells = cellsFromPegs(board, stage.pegs);
  return { phase: 'ready', pauseCause: null, stage: stage.id, tier: stage.tier, boardId: board.id, width: board.width, height: board.height,
    cells, remaining: stage.count, selected: null, history: [], jumps: 0, undoCount: 0, round, token, result: null };
}
// Same layout for another stage while still in ready (a "stage select" step, not a new round).
export function selectStage(game, stageId) {
  if (game.phase !== 'ready' || stageOf(stageId).id === game.stage) return game;
  return createGame(stageId, game.round, game.token + 1);
}
export function startGame(game, stageId = game.stage) {
  const fresh = createGame(stageId, game.round + 1, game.token + 1);
  return { ...fresh, phase: 'playing' };
}
export function restart(game) { return ['playing', 'paused', 'result'].includes(game.phase) ? startGame(game, game.stage) : game; }

const boardOf = game => BOARDS[game.boardId];
export const targetsOf = game => game.selected === null ? [] : jumpsFrom(boardOf(game), game.cells, game.selected).map(({ to, over }) => ({ to, over }));
function finish(game) {
  const board = boardOf(game), remaining = countPegs(game.cells);
  const outcome = remaining === 1 ? 'win' : isStuck(board, game.cells) ? 'stuck' : null;
  if (!outcome) return { ...game, phase: 'playing', pauseCause: null, remaining, result: null };
  return { ...game, phase: 'result', pauseCause: null, remaining, selected: null, result: { outcome, remaining, undoCount: game.undoCount, stage: game.stage } };
}
export function tryJump(game, from, to) {
  if (game.phase !== 'playing') return { ok: false, reason: 'phase', game };
  const check = checkJump(boardOf(game), game.cells, from, to);
  if (!check.ok) return { ok: false, reason: check.reason, game };
  const cells = game.cells.slice(); cells[from] = 0; cells[check.over] = 0; cells[to] = 1;
  const next = finish({ ...game, cells, selected: null, history: [...game.history, { from, over: check.over, to }], jumps: Math.min(COUNT_CAP, game.jumps + 1) });
  return { ok: true, reason: null, game: next };
}
// Selection table of the design (1.3). kind: ignored | pick-first | select | replace | deselect | jump | not-target.
export function select(game, cell) {
  if (game.phase !== 'playing' || !inRange(game.cells, cell) || game.cells[cell] === -1) return { kind: 'ignored', game };
  if (game.cells[cell] === 1) {
    if (game.selected === cell) return { kind: 'deselect', game: { ...game, selected: null } };
    const next = { ...game, selected: cell };
    return { kind: game.selected === null ? 'select' : 'replace', noTargets: targetsOf(next).length === 0, game: next };
  }
  if (game.selected === null) return { kind: 'pick-first', game };
  if (!targetsOf(game).some(target => target.to === cell)) return { kind: 'not-target', game };
  const jumped = tryJump(game, game.selected, cell);
  return { kind: 'jump', game: jumped.game };
}
export function deselect(game) { return game.phase === 'playing' && game.selected !== null ? { ...game, selected: null } : game; }

// Unlimited undo. A stuck result may continue by undoing one jump; a won result may not.
export function undo(game) {
  const open = game.phase === 'playing' || (game.phase === 'result' && game.result?.outcome === 'stuck');
  if (!open || game.history.length === 0) return game;
  const last = game.history.at(-1), cells = game.cells.slice();
  cells[last.to] = 0; cells[last.from] = 1; cells[last.over] = 1;
  return finish({ ...game, phase: 'playing', cells, selected: null, history: game.history.slice(0, -1), undoCount: Math.min(COUNT_CAP, game.undoCount + 1), result: null });
}
// cause: 'manual' | 'protect'. A protect pause upgrades a manual pause; nothing happens outside playing/paused.
export function pauseGame(game, cause = 'manual') {
  const next = cause === 'protect' ? 'protect' : 'manual';
  if (game.phase === 'playing') return { ...game, phase: 'paused', pauseCause: next, selected: null };
  if (game.phase === 'paused' && game.pauseCause === 'manual' && next === 'protect') return { ...game, pauseCause: 'protect' };
  return game;
}
export function resumeGame(game) { return game.phase === 'paused' ? { ...game, phase: 'playing', pauseCause: null, selected: null } : game; }
