export const SNACKS = Object.freeze(['apple', 'pear', 'orange', 'berry', 'cookie', 'bread', 'cherry', 'candy']);
export const MODES = Object.freeze({ easy: Object.freeze({ columns: 3, pairs: 6 }), normal: Object.freeze({ columns: 4, pairs: 8 }) });
export const MAX_ATTEMPTS = 999999;
export const MAX_ELAPSED_MS = 86400000;
export const MISMATCH_MS = 800;
const validMode = mode => typeof mode === 'string' && Object.hasOwn(MODES, mode);
export function createReady(mode = 'normal', roundId = 0) {
  if (!validMode(mode) || !Number.isSafeInteger(roundId) || roundId < 0) throw new TypeError('Invalid round options');
  return { mode, roundId, phase: 'ready', pauseCause: null, cards: [], firstIndex: null, mismatchIndices: null, mismatchRemainingMs: 0, attempts: 0, matchedPairs: 0, activeElapsedMs: 0, firstFlipStarted: false };
}
export function createDeck(mode, rng = Math.random) {
  if (!validMode(mode) || typeof rng !== 'function') throw new TypeError('Invalid deck options');
  const ids = SNACKS.slice(0, MODES[mode].pairs).flatMap(id => [id, id]);
  for (let i = ids.length - 1; i > 0; i--) {
    const r = rng();
    if (typeof r !== 'number' || !Number.isFinite(r) || r < 0 || r >= 1) throw new RangeError('난수를 만들지 못했습니다. 다시 시도해 주세요.');
    const j = Math.floor(r * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.map((id, index) => ({ index, id, revealed: false, matched: false }));
}
export function startRound(state, rng = Math.random) {
  if (!Number.isSafeInteger(state.roundId) || state.roundId >= Number.MAX_SAFE_INTEGER) throw new RangeError('Round limit');
  const cards = createDeck(state.mode, rng);
  return { ...createReady(state.mode, state.roundId + 1), cards, phase: 'playing' };
}
export function reveal(state, index) {
  if (state.phase !== 'playing' || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= state.cards.length || state.mismatchIndices !== null) return state;
  const card = state.cards[index];
  if (card.revealed || card.matched) return state;
  const cards = state.cards.map(c => c.index === index ? { ...c, revealed: true } : c);
  if (state.firstIndex === null) return { ...state, cards, firstIndex: index, firstFlipStarted: true };
  const attempts = Math.min(MAX_ATTEMPTS, state.attempts + 1);
  const first = state.firstIndex;
  if (cards[first].id === card.id) {
    cards[first] = { ...cards[first], matched: true };
    cards[index] = { ...cards[index], matched: true };
    const matchedPairs = state.matchedPairs + 1;
    return { ...state, cards, attempts, matchedPairs, firstIndex: null, phase: matchedPairs === MODES[state.mode].pairs ? 'success' : attempts === MAX_ATTEMPTS ? 'limit' : 'playing' };
  }
  return { ...state, cards, attempts, phase: attempts === MAX_ATTEMPTS ? 'limit' : 'playing', mismatchIndices: [first, index], mismatchRemainingMs: MISMATCH_MS };
}
export function advance(state, dt) {
  if (state.phase !== 'playing' || !state.firstFlipStarted || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0 || dt > 250) return state;
  const activeElapsedMs = Math.min(MAX_ELAPSED_MS, state.activeElapsedMs + dt);
  let next = { ...state, activeElapsedMs };
  if (state.mismatchIndices !== null) {
    const remaining = Math.max(0, state.mismatchRemainingMs - dt);
    next.mismatchRemainingMs = remaining;
    if (remaining === 0) {
      next.cards = state.cards.map(c => state.mismatchIndices.includes(c.index) ? { ...c, revealed: false } : c);
      next.firstIndex = null;
      next.mismatchIndices = null;
    }
  }
  if (activeElapsedMs === MAX_ELAPSED_MS) next.phase = 'limit';
  return next;
}
export function pause(state, cause = 'manual') {
  if (!['manual', 'dialog', 'protection'].includes(cause)) return state;
  if (state.phase === 'paused') return cause === 'protection' && state.pauseCause !== cause ? { ...state, pauseCause: cause } : state;
  return state.phase === 'playing' ? { ...state, phase: 'paused', pauseCause: cause } : state;
}
export function resume(state) { return state.phase === 'paused' ? { ...state, phase: 'playing', pauseCause: null } : state; }
