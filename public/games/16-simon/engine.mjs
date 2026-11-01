// Original deterministic Simon rules. Time and randomness enter only through arguments.
export const MAX_LENGTH = 1000;
export const INPUT_MS = 5000;
export function flashDuration(length) { return length >= 11 ? 400 : length >= 6 ? 450 : 500; }
export function createGame() {
  return { phase: 'ready', subphase: 'ready', round: 0, sequence: [], cursor: 0,
    completedLength: 0, remaining: 0, feedbackPad: null, feedbackRemaining: 0,
    pauseCause: null, result: null, token: 0 };
}
function randomPad(rng) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('RNG must return [0, 1).');
  return Math.floor(value * 4);
}
export function startGame(game, rng = Math.random) {
  const pad = randomPad(rng);
  return { ...createGame(), phase: 'playing', subphase: 'prepare', round: 1,
    sequence: [pad], remaining: 400, token: game.token + 1 };
}
export function pauseGame(game, cause = 'manual') {
  if (game.phase === 'paused') return cause === 'protection' && game.pauseCause !== 'protection' ? { ...game, pauseCause: cause } : game;
  if (game.phase !== 'playing') return game;
  return { ...game, phase: 'paused', pauseCause: cause };
}
export function resumeGame(game) {
  return game.phase === 'paused' ? { ...game, phase: 'playing', pauseCause: null } : game;
}
function finish(game, reason) {
  return { ...game, phase: 'result', subphase: 'result', remaining: 0, feedbackPad: null,
    feedbackRemaining: 0, result: { reason, score: game.completedLength,
      failedLength: game.sequence.length, position: game.cursor + 1 } };
}
function transition(game, rng) {
  switch (game.subphase) {
    case 'prepare': return { ...game, subphase: 'demo-on', cursor: 0, remaining: flashDuration(game.sequence.length) };
    case 'demo-on': return { ...game, subphase: game.cursor === game.sequence.length - 1 ? 'demo-tail' : 'demo-gap', remaining: game.cursor === game.sequence.length - 1 ? 400 : 250 };
    case 'demo-gap': return { ...game, subphase: 'demo-on', cursor: game.cursor + 1, remaining: flashDuration(game.sequence.length) };
    case 'demo-tail': return { ...game, subphase: 'input', cursor: 0, remaining: INPUT_MS };
    case 'input': return finish(game, 'timeout');
    case 'success': {
      const sequence = [...game.sequence, randomPad(rng)];
      return { ...game, sequence, round: sequence.length, subphase: 'demo-on', cursor: 0, remaining: flashDuration(sequence.length) };
    }
    default: return game;
  }
}
export function advanceGame(game, delta, rng = Math.random, token = game.token) {
  if (game.phase !== 'playing' || token !== game.token || !Number.isFinite(delta) || delta < 0) return game;
  let next = game, left = delta;
  // Every transition consumes positive time; bounded sequence length also bounds iteration.
  while (next.phase === 'playing') {
    // Sub-millisecond RAF deltas can leave rounding dust at an exact deadline.
    if (left + 1e-9 < next.remaining) {
      if (left === 0) return next;
      return { ...next, remaining: next.remaining - left,
        feedbackRemaining: Math.max(0, next.feedbackRemaining - left),
        feedbackPad: next.feedbackRemaining > left ? next.feedbackPad : null };
    }
    left = Math.max(0, left - next.remaining);
    next = transition({ ...next, feedbackPad: null, feedbackRemaining: 0 }, rng);
    if (left === 0) return next;
  }
  return next;
}
export function inputPad(game, pad) {
  if (game.phase !== 'playing' || game.subphase !== 'input' || !Number.isInteger(pad) || pad < 0 || pad > 3) return game;
  if (game.remaining <= 0) return finish(game, 'timeout');
  if (game.sequence[game.cursor] !== pad) return finish(game, 'wrong');
  if (game.cursor + 1 === game.sequence.length) {
    const completed = { ...game, completedLength: game.sequence.length, cursor: game.cursor + 1 };
    if (completed.completedLength === MAX_LENGTH) return finish(completed, 'complete');
    return { ...completed, subphase: 'success', remaining: 700, feedbackPad: pad, feedbackRemaining: 120 };
  }
  return { ...game, cursor: game.cursor + 1, remaining: INPUT_MS, feedbackPad: pad, feedbackRemaining: 120 };
}
export function activePad(game) {
  if (game.phase !== 'playing') return null;
  return game.subphase === 'demo-on' ? game.sequence[game.cursor] : game.feedbackRemaining > 0 ? game.feedbackPad : null;
}
