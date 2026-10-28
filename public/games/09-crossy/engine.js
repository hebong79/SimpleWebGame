// Original Chick Picnic rules. Logical units are pixels; cosmetics never enter this module.
export const CELL = 40;
export const WIDTH = 360;
export const STEP = 1 / 120;
export const HOP_SECONDS = 0.12;
export const BODY = 28;
export const DIRECTIONS = Object.freeze({ up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] });
const mod = (x, n) => ((x % n) + n) % n;
const random = (rng) => {
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new RangeError('RNG must return [0,1)');
  return n;
};
export function laneSpeed(lane, highest) {
  return Math.min(180, lane.baseSpeed + 10 * Math.floor(highest / 20));
}
export function ensureLanes(state, through, rng = Math.random) {
  while (state.nextLane <= through) {
    const row = state.nextLane++;
    const previous = state.lanes.slice(-3);
    const forcedGrass = row < 2 || (previous.length === 3 && previous.every((l) => l.type === 'road'));
    const type = forcedGrass || random(rng) < 0.34 ? 'grass' : 'road';
    if (type === 'grass') state.lanes.push({ row, type });
    else {
      const width = random(rng) < 0.5 ? 56 : 68;
      const gap = 140 + Math.floor(random(rng) * 81);
      const period = width + gap;
      state.lanes.push({ row, type, width, gap, period, height: 26,
        direction: random(rng) < 0.5 ? -1 : 1,
        baseSpeed: 80 + Math.floor(random(rng) * 61), phase: random(rng) * period });
    }
  }
}
export function createGame(rng = Math.random) {
  const state = { mode: 'ready', pauseReason: '', col: 4, row: 0, x: 180, y: 20,
    facing: 'up', hop: null, queued: null, highest: 0, idleAge: 0, elapsed: 0,
    accumulator: 0, lanes: [], nextLane: 0, reason: null, hops: 0 };
  ensureLanes(state, 13, rng);
  return state;
}
export function start(state) {
  if (state.mode !== 'ready') return false;
  state.mode = 'playing';
  return true;
}
export function pause(state, reason = 'manual') {
  if (state.mode !== 'playing') return false;
  state.mode = 'paused'; state.pauseReason = reason; state.queued = null; state.accumulator = 0;
  return true;
}
export function resume(state) {
  if (state.mode !== 'paused') return false;
  state.mode = 'playing'; state.pauseReason = ''; state.queued = null; state.accumulator = 0;
  return true;
}
export function finish(state, reason) {
  if (!['playing', 'paused'].includes(state.mode)) return false;
  state.mode = 'result'; state.reason = reason; state.queued = null; state.accumulator = 0;
  return true;
}
function destination(state, direction, fromCol, fromRow) {
  const d = DIRECTIONS[direction];
  if (!d) return null;
  const col = fromCol + d[0], row = fromRow + d[1];
  if (col < 0 || col > 8 || row < Math.max(0, state.highest - 2)) return null;
  return { col, row };
}
function beginHop(state, direction, target, rng) {
  state.facing = direction;
  state.hop = { fromX: state.x, fromY: state.y, toX: target.col * CELL + 20,
    toY: target.row * CELL + 20, col: target.col, row: target.row, age: 0 };
  state.hops++;
  ensureLanes(state, target.row + 12, rng);
}
export function input(state, direction, rng = Math.random) {
  if (state.mode !== 'playing') return false;
  if (state.hop) {
    if (state.queued) return false;
    const target = destination(state, direction, state.hop.col, state.hop.row);
    if (!target) return false;
    state.queued = direction;
    return true;
  }
  const target = destination(state, direction, state.col, state.row);
  if (!target) return false;
  beginHop(state, direction, target, rng);
  return true;
}
// Closed slab intersection of two linearly moving axis-aligned rectangles.
// Boundary contact counts. The interval includes BOTH endpoints.
export function sweptOverlap(px0, py0, px1, py1, cx0, cy0, cx1, cy1, halfX, halfY) {
  let entry = 0, exit = 1;
  for (const [p0, p1, c0, c1, half] of [[px0, px1, cx0, cx1, halfX], [py0, py1, cy0, cy1, halfY]]) {
    const a = p0 - c0, velocity = (p1 - p0) - (c1 - c0);
    if (Math.abs(velocity) < 1e-12) { if (Math.abs(a) > half) return false; }
    else {
      const t1 = (-half - a) / velocity, t2 = (half - a) / velocity;
      entry = Math.max(entry, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
      if (entry > exit + 1e-12) return false;
    }
  }
  return entry <= exit + 1e-12;
}
export function carCenters(lane) {
  const centers = [];
  for (let k = -2; k <= Math.ceil(WIDTH / lane.period) + 1; k++) centers.push(lane.phase + k * lane.period);
  return centers;
}
function tick(state, seconds, rng) {
  const x0 = state.x, y0 = state.y;
  let x1 = x0, y1 = y0;
  if (state.hop) {
    const hop = state.hop;
    hop.age = Math.min(HOP_SECONDS, hop.age + seconds);
    const t = hop.age / HOP_SECONDS;
    x1 = hop.fromX + (hop.toX - hop.fromX) * t;
    y1 = hop.fromY + (hop.toY - hop.fromY) * t;
  }
  let collision = false;
  for (const lane of state.lanes) {
    if (lane.type !== 'road') continue;
    const delta = lane.direction * laneSpeed(lane, state.highest) * seconds;
    const cy = lane.row * CELL + 20;
    for (const cx of carCenters(lane)) {
      if (sweptOverlap(x0, y0, x1, y1, cx, cy, cx + delta, cy,
        (BODY + lane.width) / 2, (BODY + lane.height) / 2)) collision = true;
    }
    lane.phase = mod(lane.phase + delta, lane.period);
  }
  state.x = x1; state.y = y1; state.elapsed += seconds; state.idleAge += seconds;
  if (collision) { finish(state, 'collision'); return; }
  if (state.idleAge >= 10 - 1e-10) { finish(state, 'idle'); return; }
  if (state.hop && state.hop.age >= HOP_SECONDS - 1e-10) {
    state.col = state.hop.col; state.row = state.hop.row; state.hop = null;
    if (state.row > state.highest) { state.highest = state.row; state.idleAge = 0; }
    const next = state.queued; state.queued = null;
    if (next) {
      const target = destination(state, next, state.col, state.row);
      if (target) beginHop(state, next, target, rng);
    }
    state.lanes = state.lanes.filter((l) => l.row >= Math.max(0, state.highest - 4));
  }
}
export function advance(state, seconds, rng = Math.random) {
  if (state.mode !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
  // UI already protects callback stalls; pure callers receive the same fail-closed protection.
  if (seconds >= 0.25) { pause(state, 'long-frame'); return; }
  state.accumulator += seconds;
  while (state.accumulator >= STEP - 1e-12 && state.mode === 'playing') {
    let remaining = STEP;
    while (remaining > 1e-12 && state.mode === 'playing') {
      const slice = state.hop ? Math.min(remaining, HOP_SECONDS - state.hop.age) : remaining;
      tick(state, slice, rng); remaining -= slice;
    }
    state.accumulator = Math.max(0, state.accumulator - STEP);
  }
}
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
