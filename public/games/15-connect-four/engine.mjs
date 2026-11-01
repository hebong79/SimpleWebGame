/** Original, deterministic local two-player rules. Time is supplied by the caller. */
export const ROWS = 6, COLS = 7, DROP_MS = 200, COUNTER_CAP = 1_000_000;
export const emptyRecords = () => ({ sunWins: 0, seaWins: 0, draws: 0 });
const player = p => p === 'sun' || p === 'sea';
const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export function validRecords(r) {
  return !!r && typeof r === 'object' && !Array.isArray(r) &&
    [r.sunWins, r.seaWins, r.draws].every(n => integer(n, COUNTER_CAP)) &&
    r.sunWins + r.seaWins + r.draws <= COUNTER_CAP;
}
export function incrementRecords(records, outcome) {
  if (!validRecords(records) || !['sun', 'sea', 'draw'].includes(outcome) ||
      records.sunWins + records.seaWins + records.draws >= COUNTER_CAP) return records;
  const key = outcome === 'draw' ? 'draws' : `${outcome}Wins`;
  return { ...records, [key]: records[key] + 1 };
}
export function validBoard(board) {
  return Array.isArray(board) && board.length === ROWS && board.every(row =>
    Array.isArray(row) && row.length === COLS && row.every(cell => cell === null || player(cell)));
}
export function findWinningCells(board, row, col) {
  if (!validBoard(board) || !integer(row, ROWS - 1) || !integer(col, COLS - 1) || !player(board[row][col])) return [];
  const owner = board[row][col], found = new Map();
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[row, col]];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === owner) {
        line.push([r, c]); r += dr * sign; c += dc * sign;
      }
    }
    if (line.length >= 4) for (const cell of line) found.set(cell.join(','), cell);
  }
  return [...found.values()];
}
export function createGame() {
  return { phase: 'ready', subphase: 'choosing', round: 0, board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    starter: 'sun', current: 'sun', moves: 0, remainingMs: 0, lastMove: null, winningCells: [], outcome: null,
    pauseReason: null, session: emptyRecords() };
}
export function validState(s) {
  if (!s || !['ready', 'playing', 'paused', 'result'].includes(s.phase) ||
      !['choosing', 'dropping'].includes(s.subphase) || !validBoard(s.board) || !player(s.starter) || !player(s.current) ||
      !integer(s.round, Number.MAX_SAFE_INTEGER) || !integer(s.moves, 42) ||
      !Number.isFinite(s.remainingMs) || s.remainingMs < 0 || s.remainingMs > DROP_MS || !validRecords(s.session) ||
      !Array.isArray(s.winningCells) || ![null, 'sun', 'sea', 'draw'].includes(s.outcome) ||
      ![null, 'manual', 'protect', 'modal'].includes(s.pauseReason)) return false;
  if (s.board.flat().filter(Boolean).length !== s.moves) return false;
  if (s.subphase === 'choosing' && s.remainingMs !== 0) return false;
  if (s.phase !== 'result' && s.outcome !== null) return false;
  if (s.phase === 'result' && s.subphase !== 'choosing') return false;
  if (s.phase === 'paused' && s.pauseReason === null) return false;
  for (let col = 0; col < COLS; col++) {
    let emptyBelow = false;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (s.board[row][col] === null) emptyBelow = true;
      else if (emptyBelow) return false;
    }
  }
  if (s.lastMove !== null && (!s.lastMove || typeof s.lastMove !== 'object' || !integer(s.lastMove.row, 5) || !integer(s.lastMove.col, 6) ||
      !player(s.lastMove.player) || s.board[s.lastMove.row][s.lastMove.col] !== s.lastMove.player)) return false;
  if (s.subphase === 'dropping' && (!s.lastMove || s.remainingMs <= 0 || s.lastMove.player !== s.current)) return false;
  if (s.phase === 'result' && s.outcome === null) return false;
  return s.winningCells.every(cell => Array.isArray(cell) && integer(cell[0], 5) && integer(cell[1], 6));
}
export function startRound(state) {
  if (!validState(state)) return state;
  const starter = state.phase === 'result' ? (state.starter === 'sun' ? 'sea' : 'sun') : state.starter;
  return { ...createGame(), phase: 'playing', round: state.round + 1, starter, current: starter, session: { ...state.session } };
}
export function drop(state, col) {
  if (!validState(state) || state.phase !== 'playing' || state.subphase !== 'choosing' || !integer(col, 6)) return state;
  let row = ROWS - 1;
  while (row >= 0 && state.board[row][col] !== null) row--;
  if (row < 0) return state;
  const board = state.board.map(line => [...line]); board[row][col] = state.current;
  return { ...state, board, moves: state.moves + 1, subphase: 'dropping', remainingMs: DROP_MS,
    lastMove: { row, col, player: state.current } };
}
export function pause(state, reason = 'manual') {
  if (!validState(state) || !['manual', 'protect', 'modal'].includes(reason) || !['playing', 'paused'].includes(state.phase)) return state;
  const pauseReason = state.pauseReason === 'protect' || reason === 'protect' ? 'protect' : state.phase === 'paused' ? state.pauseReason : reason;
  return { ...state, phase: 'paused', pauseReason };
}
export function resume(state) {
  return validState(state) && state.phase === 'paused' ? { ...state, phase: 'playing', pauseReason: null } : state;
}
export function tick(state, deltaMs) {
  if (!validState(state) || state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs < 0) return state;
  if (deltaMs > 250) return pause(state, 'protect');
  if (state.subphase !== 'dropping' || deltaMs === 0) return state;
  const remainingMs = Math.max(0, state.remainingMs - deltaMs);
  if (remainingMs > 0) return { ...state, remainingMs };
  const winningCells = findWinningCells(state.board, state.lastMove.row, state.lastMove.col);
  const outcome = winningCells.length ? state.current : state.moves === 42 ? 'draw' : null;
  return { ...state, remainingMs: 0, subphase: 'choosing', winningCells, outcome,
    phase: outcome ? 'result' : 'playing', current: outcome ? state.current : state.current === 'sun' ? 'sea' : 'sun',
    session: outcome ? incrementRecords(state.session, outcome) : state.session };
}
