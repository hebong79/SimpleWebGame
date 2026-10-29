// Original rule engine. No DOM, storage, wall clock or implicit randomness.
export const SIZE = 9;
export const MINE_COUNT = 10;
export const SAFE_COUNT = 71;
const COMMANDS = Object.freeze({ start: true, pause: true, resume: true, reveal: true, flag: true });
export function neighbors(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 81) return [];
  const row = Math.floor(index / SIZE), col = index % SIZE, result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && row + dy >= 0 && row + dy < SIZE && col + dx >= 0 && col + dx < SIZE) result.push((row + dy) * SIZE + col + dx);
  }
  return result;
}
export function createGame() {
  return { status: 'ready', armed: false, mines: Array(81).fill(false), adjacent: Array(81).fill(0), opened: Array(81).fill(false), flagged: Array(81).fill(false), openedCount: 0, flagCount: 0, exploded: null };
}
export function seededRng(seed) {
  let value = Number.isSafeInteger(seed) ? seed >>> 0 : 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function sample(rng) {
  // Exactly ten bounded samples. Anything outside primitive finite [0,1) => zero.
  let value;
  try { value = typeof rng === 'function' ? rng() : 0; } catch { value = 0; }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
}
function arm(state, first, rng) {
  const excluded = new Set([first, ...neighbors(first)]);
  const candidates = Array.from({ length: 81 }, (_, i) => i).filter(i => !excluded.has(i));
  const mines = Array(81).fill(false);
  for (let i = 0; i < MINE_COUNT; i++) {
    const j = i + Math.floor(sample(rng) * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    mines[candidates[i]] = true;
  }
  return { ...state, armed: true, mines, adjacent: mines.map((_, i) => neighbors(i).filter(j => mines[j]).length) };
}
export function transition(state, command, index, rng) {
  if (typeof command !== 'string' || !Object.hasOwn(COMMANDS, command)) return state;
  if (command === 'start') return state.status === 'ready' ? { ...state, status: 'playing' } : state;
  if (command === 'pause') return state.status === 'playing' ? { ...state, status: 'paused' } : state;
  if (command === 'resume') return state.status === 'paused' ? { ...state, status: 'playing' } : state;
  if (state.status !== 'playing' || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= 81 || state.opened[index]) return state;
  if (command === 'flag') {
    if (!state.flagged[index] && state.flagCount === MINE_COUNT) return state;
    const flagged = state.flagged.slice();
    flagged[index] = !flagged[index];
    return { ...state, flagged, flagCount: state.flagCount + (flagged[index] ? 1 : -1) };
  }
  if (state.flagged[index]) return state;
  const next = state.armed ? state : arm(state, index, arguments.length < 4 ? Math.random : rng);
  if (next.mines[index]) return { ...next, status: 'lost', exploded: index };
  const opened = next.opened.slice(), visited = new Set(), queue = [index];
  let openedCount = next.openedCount;
  while (queue.length) {
    const cell = queue.pop();
    if (visited.has(cell)) continue;
    visited.add(cell);
    if (opened[cell] || next.flagged[cell] || next.mines[cell]) continue;
    opened[cell] = true;
    openedCount++;
    if (next.adjacent[cell] === 0) for (const neighbor of neighbors(cell)) if (!visited.has(neighbor)) queue.push(neighbor);
  }
  return { ...next, opened, openedCount, status: openedCount === SAFE_COUNT ? 'won' : 'playing' };
}
