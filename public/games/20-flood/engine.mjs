// Original flood-fill ("paint spread") rules. Pure functions, no browser dependencies, no randomness, no timers.
// The 15 maps are fixed data generated and verified offline (see docs/20-flood design); they are not generated at runtime.
export const LIMIT_EXTRA = 3;
export const SCORE_UNIT = 100;
export const STAGE_COUNT = 15;
// [size, colors, cells (row-major colour numbers), key path (screen numbers = colour + 1)]
const table = [
  [6, 3, '000222221122202121112220222202121200', '3123'],
  [6, 3, '112011021210020011001110122100212011', '12132'],
  [6, 3, '121010202211110002021102102120112000', '321213'],
  [6, 3, '121101221001111201200110112022111011', '3212123'],
  [6, 3, '120102201110012022001200111212200101', '31231321'],
  [8, 4, '2200130123231221000021000311021130232203133323012121200321210100', '12131423'],
  [8, 4, '0311011211111210133321013200110331100130201232320013212110023103', '232431234'],
  [8, 4, '2121132111120333203311311022333233210232202110231300100002232301', '213143124'],
  [8, 4, '3020213110222130332210101202023012203313010210212202333111121220', '1312342134'],
  [8, 4, '0322313212033100122301331313232102102131313310112121233303023022', '2342423413'],
  [8, 4, '3201331323130002320303331312112132032133220100201102002333021132', '31241241243'],
  [8, 4, '0312322222010231220203123323013011303023103331313001132331333300', '31214241234'],
  [8, 4, '2012003002030332121231232023100303210123030323020101003033012103', '131412142134'],
  [8, 4, '3013203023212201012001320202102001220133130023020032320321231320', '312312413412'],
  [8, 4, '1321331231313130200120321330030100302010130232322211232120312102', '4214123124132']
];
// path: colour numbers (0-based) of one known solving route, used by tests and save validation only; never shown to players.
export const STAGES = Object.freeze(table.map(([size, colors, cells, keys], i) => {
  const path = Object.freeze([...keys].map(k => Number(k) - 1));
  return Object.freeze({ id: i + 1, tier: i < 5 ? 'intro' : 'basic', size, colors, cells, keys, path, pathLength: path.length, limit: path.length + LIMIT_EXTRA });
}));
export const toCells = cells => typeof cells === 'string' ? [...cells].map(Number) : Array.from(cells);
export function neighborsOf(size, index) {
  const r = Math.floor(index / size), c = index % size, out = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}
// Region = cells connected (4 directions) to the seed region whose original colour is `color`; returns sorted indexes.
export function expandRegion(cells, size, region, color) {
  const flat = toCells(cells), seen = new Set(region), queue = [...region];
  for (let head = 0; head < queue.length; head++) {
    for (const j of neighborsOf(size, queue[head])) if (!seen.has(j) && flat[j] === color) { seen.add(j); queue.push(j); }
  }
  return [...seen].sort((a, b) => a - b);
}
export function initialRegion(cells, size) { const flat = toCells(cells); return expandRegion(flat, size, [0], flat[0]); }
export const scoreFor = (limit, used) => (limit - used) * SCORE_UNIT;
// Displayed colour of every cell: region cells show the current colour, the others keep their original colour.
export function boardColors(cells, region, currentColor) {
  const board = toCells(cells); for (const i of region) board[i] = currentColor; return board;
}
// Bit mask of exposed sides per cell (1 top, 2 right, 4 bottom, 8 left); 0 for cells outside the region.
export function regionEdges(size, region) {
  const inside = new Set(region), edges = new Array(size * size).fill(0);
  for (const i of region) {
    const r = Math.floor(i / size), c = i % size;
    if (r === 0 || !inside.has(i - size)) edges[i] |= 1;
    if (c === size - 1 || !inside.has(i + 1)) edges[i] |= 2;
    if (r === size - 1 || !inside.has(i + size)) edges[i] |= 4;
    if (c === 0 || !inside.has(i - 1)) edges[i] |= 8;
  }
  return edges;
}
// Visual-only distance (1..8) of newly absorbed cells from the previous region; no effect on rules.
export function absorbRings(size, before, after) {
  const old = new Set(before), gained = new Set(after.filter(i => !old.has(i))), rings = new Map();
  let frontier = [...before];
  for (let ring = 1; frontier.length && gained.size > rings.size; ring++) {
    const next = [];
    for (const i of frontier) for (const j of neighborsOf(size, i)) if (gained.has(j) && !rings.has(j)) { rings.set(j, Math.min(ring, 8)); next.push(j); }
    frontier = next;
  }
  return rings;
}
const idleEvent = (regionSize = 0) => ({ seq: 0, kind: 'none', color: null, absorbed: 0, regionBefore: regionSize, regionAfter: regionSize, counted: false });
export function createGame(stageId = 1, round = 0, token = 0) {
  const stage = STAGES[stageId - 1];
  if (!stage) throw new RangeError('Unknown stage');
  const cells = toCells(stage.cells), region = initialRegion(cells, stage.size);
  return {
    phase: 'ready', pauseCause: null, round, token, stageId, tier: stage.tier, size: stage.size, colors: stage.colors, cells, region,
    currentColor: cells[0], used: 0, limit: stage.limit, pathLength: stage.pathLength, history: [], lastEvent: idleEvent(region.length), outcome: null, result: null
  };
}
export function startGame(game, stageId = game.stageId) { return { ...createGame(stageId, game.round + 1, game.token + 1), phase: 'playing' }; }
// One atomic colour choice. Order: ignore invalid -> same colour is free -> count +1 and flood -> win check first -> lose check.
export function pickColor(game, color) {
  if (game.phase !== 'playing' || !Number.isInteger(color) || color < 0 || color >= game.colors || game.used >= game.limit) return game;
  const before = game.region.length, seq = game.lastEvent.seq + 1;
  if (color === game.currentColor) return { ...game, lastEvent: { seq, kind: 'same-color', color, absorbed: 0, regionBefore: before, regionAfter: before, counted: false } };
  const region = expandRegion(game.cells, game.size, game.region, color), used = game.used + 1, total = game.size * game.size;
  const won = region.length === total, lost = !won && used >= game.limit;
  const outcome = won ? 'win' : lost ? 'lose' : null;
  return {
    ...game, region, used, currentColor: color, history: [...game.history, color],
    lastEvent: { seq, kind: 'move', color, absorbed: region.length - before, regionBefore: before, regionAfter: region.length, counted: true },
    phase: outcome ? 'result' : 'playing', pauseCause: null, outcome,
    result: outcome ? { outcome, stageId: game.stageId, used, limit: game.limit, remaining: game.limit - used, score: won ? scoreFor(game.limit, used) : null, uncovered: total - region.length } : null
  };
}
export function pauseGame(game, cause = 'manual') {
  if (game.phase === 'paused') return cause === 'protection' && game.pauseCause !== 'protection' ? { ...game, pauseCause: 'protection' } : game;
  return game.phase === 'playing' ? { ...game, phase: 'paused', pauseCause: cause } : game;
}
export function resumeGame(game) { return game.phase === 'paused' ? { ...game, phase: 'playing', pauseCause: null } : game; }
