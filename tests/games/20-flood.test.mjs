import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGES, STAGE_COUNT, LIMIT_EXTRA, neighborsOf, expandRegion, initialRegion, scoreFor, boardColors, regionEdges, absorbRings, createGame, startGame, pickColor, pauseGame, resumeGame } from '../../public/games/20-flood/engine.mjs';
import { STORAGE_KEY, CAP, THEMES, defaultRecord, recoverRecord, validStage, loadRecord, saveRecord, settleRecord } from '../../public/games/20-flood/save.mjs';

// ---------- independent oracle (coordinates + explicit stack; shares nothing with engine.mjs) ----------
function oracleFlood(cells, size, region, color) {
  const inside = new Set(region), stack = [...region];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / size), c = i % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const j = rr * size + cc; if (!inside.has(j) && cells[j] === color) { inside.add(j); stack.push(j); }
    }
  }
  return [...inside].sort((a, b) => a - b);
}
const oracleStart = (cells, size) => oracleFlood(cells, size, [0], cells[0]);
function oracleRun(cells, size, picks) {
  let region = oracleStart(cells, size), current = cells[0], used = 0;
  for (const p of picks) { if (region.length === size * size) break; if (p === current) continue; used++; current = p; region = oracleFlood(cells, size, region, p); }
  return { region, used, current, complete: region.length === size * size };
}
// independent solver A: BigInt bit-mask BFS over (region, colour)
function solveBFS(cellsText, size, colors) {
  const cells = [...cellsText].map(Number), n = size * size, full = (1n << BigInt(n)) - 1n;
  const masks = Array.from({ length: colors }, () => 0n);
  cells.forEach((c, i) => { masks[c] |= 1n << BigInt(i); });
  const grow = (region, c) => {
    for (;;) {
      let nb = 0n;
      for (let i = 0; i < n; i++) if ((region >> BigInt(i)) & 1n) { const r = Math.floor(i / size), col = i % size; if (r > 0) nb |= 1n << BigInt(i - size); if (r < size - 1) nb |= 1n << BigInt(i + size); if (col > 0) nb |= 1n << BigInt(i - 1); if (col < size - 1) nb |= 1n << BigInt(i + 1); }
      const add = nb & masks[c] & ~region; if (add === 0n) return region; region |= add;
    }
  };
  const start = grow(1n, cells[0]);
  if (start === full) return 0;
  let frontier = [[start, cells[0]]]; const seen = new Set([`${start}:${cells[0]}`]);
  for (let depth = 1; depth <= 30; depth++) {
    const next = [];
    for (const [region, color] of frontier) for (let c = 0; c < colors; c++) {
      if (c === color) continue; const grown = grow(region, c); if (grown === full) return depth;
      const key = `${grown}:${c}`; if (!seen.has(key)) { seen.add(key); next.push([grown, c]); }
    }
    frontier = next;
  }
  return null;
}
// independent solver B: iterative-deepening DFS with transposition table and "colours left outside <= moves left" pruning
function solveDFS(cellsText, size, colors, maxDepth) {
  const cells = [...cellsText].map(Number);
  const flood = (region, color) => Uint8Array.from(oracleFlood(cells, size, [...region.keys()].filter(i => region[i]), color).reduce((a, i) => { a[i] = 1; return a; }, new Uint8Array(cells.length)));
  const start = Uint8Array.from(oracleStart(cells, size).reduce((a, i) => { a[i] = 1; return a; }, new Uint8Array(cells.length)));
  for (let depth = 0; depth <= maxDepth; depth++) {
    const seen = new Map();
    const dfs = (region, color, left) => {
      if (region.every(v => v === 1)) return true; if (left === 0) return false;
      const outside = new Set(); region.forEach((v, i) => { if (!v) outside.add(cells[i]); }); if (outside.size > left) return false;
      const key = `${region.join('')}${color}`; if ((seen.get(key) ?? -1) >= left) return false; seen.set(key, left);
      for (let c = 0; c < colors; c++) if (c !== color && dfs(flood(region, c), c, left - 1)) return true;
      return false;
    };
    if (dfs(start, cells[0], depth)) return depth;
  }
  return null;
}
const normalize = text => { const map = new Map(); return [...text].map(ch => { if (!map.has(ch)) map.set(ch, map.size); return map.get(ch); }).join(''); };
const transpose = (text, size) => Array.from({ length: text.length }, (_, k) => text[(k % size) * size + Math.floor(k / size)]).join('');
function xorshift(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
// a small custom playing board (engine functions accept any cells)
const custom = (cells, size, colors, limit) => ({ ...createGame(1), phase: 'playing', cells, size, colors, region: initialRegion(cells, size), currentColor: cells[0], limit, used: 0, history: [], pathLength: 0 });
const V1 = [0, 1, 1, 2, 0, 1, 2, 2, 0], V2 = [0, 1, 1, 2, 0, 1, 2, 2, 3];
// design table 3.1 copied independently of engine.mjs: [cells, key path, start region size]
const EXPECTED = [
  ['000222221122202121112220222202121200', '3123', 3], ['112011021210020011001110122100212011', '12132', 2], ['121010202211110002021102102120112000', '321213', 1],
  ['121101221001111201200110112022111011', '3212123', 1], ['120102201110012022001200111212200101', '31231321', 1],
  ['2200130123231221000021000311021130232203133323012121200321210100', '12131423', 3], ['0311011211111210133321013200110331100130201232320013212110023103', '232431234', 1],
  ['2121132111120333203311311022333233210232202110231300100002232301', '213143124', 1], ['3020213110222130332210101202023012203313010210212202333111121220', '1312342134', 1],
  ['0322313212033100122301331313232102102131313310112121233303023022', '2342423413', 1], ['3201331323130002320303331312112132032133220100201102002333021132', '31241241243', 1],
  ['0312322222010231220203123323013011303023103331313001132331333300', '31214241234', 1], ['2012003002030332121231232023100303210123030323020101003033012103', '131412142134', 1],
  ['3013203023212201012001320202102001220133130023020032320321231320', '312312413412', 1], ['1321331231313130200120321330030100302010130232322211232120312102', '4214123124132', 1]
];

// ---------- rules ----------
test('AC01 initial region: 4-direction component of cell 0, diagonal and row wrap excluded', () => {
  assert.deepEqual(initialRegion(V1, 3), [0]); assert.deepEqual(oracleStart(V1, 3), [0]);
  assert.deepEqual(initialRegion([0, 1, 1, 0, 0, 1, 1, 1, 0], 3), [0, 3, 4]);
  // index 2 (row 0, last column) and index 3 (row 1, first column) have the same colour but are not adjacent
  assert.deepEqual(initialRegion([1, 0, 2, 2, 0, 0, 1, 1, 1], 3), [0]);
  assert.deepEqual(initialRegion([2, 1, 1, 1, 2, 2, 1, 1, 1], 3), [0]);
  assert.deepEqual(neighborsOf(3, 2).sort(), [1, 5]); assert.deepEqual(neighborsOf(3, 3).sort((a, b) => a - b), [0, 4, 6]); assert.deepEqual(neighborsOf(3, 4).sort((a, b) => a - b), [1, 3, 5, 7]);
});
test('AC02 V1 chain absorb, used +1 per different colour, same colour free', () => {
  let s = custom(V1, 3, 3, 9);
  s = pickColor(s, 1); assert.deepEqual(s.region, [0, 1, 2, 5]); assert.equal(s.used, 1); assert.equal(s.lastEvent.kind, 'move'); assert.equal(s.lastEvent.absorbed, 3);
  const same = pickColor(s, 1); assert.equal(same.used, 1); assert.deepEqual(same.region, [0, 1, 2, 5]); assert.deepEqual(same.history, [1]); assert.equal(same.lastEvent.kind, 'same-color'); assert.equal(same.lastEvent.counted, false); assert.equal(same.phase, 'playing'); assert.equal(same.outcome, null);
  s = pickColor(same, 0); assert.deepEqual(s.region, [0, 1, 2, 4, 5, 8]); assert.equal(s.used, 2);
  s = pickColor(s, 2); assert.equal(s.region.length, 9); assert.equal(s.used, 3); assert.equal(s.phase, 'result'); assert.equal(s.outcome, 'win'); assert.equal(s.result.score, (9 - 3) * 100);
  assert.deepEqual(s.history, [1, 0, 2]);
});
test('AC04 V2 region that does not grow still counts; vanished colour counts too', () => {
  let s = custom(V2, 3, 4, 9);
  s = pickColor(s, 3); assert.equal(s.used, 1); assert.deepEqual(s.region, [0]); assert.equal(s.lastEvent.absorbed, 0); assert.equal(s.lastEvent.counted, true);
  assert.equal(pickColor(s, 3).used, 1);
  s = pickColor(s, 1); assert.deepEqual(s.region, [0, 1, 2, 5]); s = pickColor(s, 0); assert.deepEqual(s.region, [0, 1, 2, 4, 5]); s = pickColor(s, 2); assert.deepEqual(s.region, [0, 1, 2, 3, 4, 5, 6, 7]);
  // colour 1 no longer exists outside the region (it vanished) but choosing it is still a counted move
  const vanished = pickColor(s, 1); assert.equal(vanished.used, s.used + 1); assert.deepEqual(vanished.region, s.region);
  s = pickColor(s, 3); assert.equal(s.used, 5); assert.equal(s.outcome, 'win');
});
test('AC05 last allowed move: complete wins before the lose check; incomplete loses', () => {
  const play = (limit) => [3, 3, 1, 0, 2, 3].reduce(pickColor, custom(V2, 3, 4, limit));
  const win = play(5); assert.equal(win.used, 5); assert.equal(win.outcome, 'win'); assert.equal(win.result.score, 0); assert.equal(win.result.remaining, 0); assert.equal(win.phase, 'result');
  const lose = play(4); assert.equal(lose.used, 4); assert.equal(lose.outcome, 'lose'); assert.equal(lose.region.length, 8); assert.equal(lose.result.score, null); assert.equal(lose.result.uncovered, 1);
  const six = play(6); assert.equal(six.result.score, 100);
  // same colour at used == limit - 1 neither counts nor loses
  const near = [3, 1, 0].reduce(pickColor, custom(V2, 3, 4, 4)); assert.equal(near.used, 3); const keep = pickColor(near, near.currentColor); assert.equal(keep.used, 3); assert.equal(keep.phase, 'playing'); assert.equal(keep.outcome, null);
});
test('AC06 results ignore input; invalid colours and non-playing phases are ignored by reference', () => {
  const lose = [3, 1, 0, 2].reduce(pickColor, custom(V2, 3, 4, 4)); assert.equal(lose.phase, 'result');
  for (const c of [0, 1, 2, 3]) assert.equal(pickColor(lose, c), lose);
  const playing = custom(V2, 3, 4, 9);
  for (const bad of [-1, 4, 1.5, NaN, Infinity, '1', null, undefined, {}]) assert.equal(pickColor(playing, bad), playing);
  const ready = createGame(1); assert.equal(pickColor(ready, 1), ready);
  const paused = pauseGame(startGame(createGame(1)), 'manual'); assert.equal(pickColor(paused, 1), paused);
  assert.equal(scoreFor(7, 4), 300); assert.equal(scoreFor(7, 7), 0);
});
test('3-colour stages reject colour 3 without counting', () => {
  const s = startGame(createGame(1)); assert.equal(pickColor(s, 3), s); const t = startGame(createGame(6)); assert.equal(pickColor(t, 3).used, 1);
});
test('random property: engine equals independent oracle (2000 boards, same-colour picks included)', () => {
  const rnd = xorshift(20261102);
  for (let n = 0; n < 2000; n++) {
    const size = 3 + Math.floor(rnd() * 6), colors = 2 + Math.floor(rnd() * 3), cells = Array.from({ length: size * size }, () => Math.floor(rnd() * colors));
    if (oracleStart(cells, size).length === size * size) continue; // maps never start complete (AC07)
    const picks = Array.from({ length: 4 + Math.floor(rnd() * 30) }, () => Math.floor(rnd() * colors));
    let s = custom(cells, size, colors, 100000), previous = s.region.length;
    for (const p of picks) {
      s = pickColor(s, p); assert.ok(s.region.length >= previous); previous = s.region.length; assert.equal(s.region[0], 0);
      assert.deepEqual(boardColors(cells, s.region, s.currentColor).filter((_, i) => s.region.includes(i)).every(c => c === s.currentColor), true);
    }
    const o = oracleRun(cells, size, picks);
    assert.deepEqual(s.region, o.region); assert.equal(s.used, o.used); assert.equal(s.currentColor, o.current); assert.equal(s.outcome === 'win', o.complete);
    // connected check by an independent traversal inside the region
    assert.deepEqual(oracleFlood(Array(size * size).fill(0), size, [0], 0).length, size * size);
    const inside = new Set(s.region), seen = new Set([0]), stack = [0];
    while (stack.length) { const i = stack.pop(); for (const j of neighborsOf(size, i)) if (inside.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); } }
    assert.equal(seen.size, s.region.length);
  }
});
// ---------- maps ----------
test('AC07/08 fixed maps: shape, colours, start region, immutability, no duplicates (renumbered and transposed)', () => {
  assert.equal(STAGES.length, STAGE_COUNT); assert.ok(Object.isFrozen(STAGES)); const seen = new Set();
  STAGES.forEach((stage, i) => {
    assert.ok(Object.isFrozen(stage)); assert.ok(Object.isFrozen(stage.path)); assert.equal(stage.id, i + 1);
    assert.equal(stage.size, i < 5 ? 6 : 8); assert.equal(stage.colors, i < 5 ? 3 : 4); assert.equal(stage.tier, i < 5 ? 'intro' : 'basic');
    assert.equal(stage.cells.length, stage.size ** 2); assert.ok([...stage.cells].every(ch => Number(ch) < stage.colors));
    assert.equal(new Set(stage.cells).size, stage.colors);
    const start = oracleStart([...stage.cells].map(Number), stage.size);
    assert.ok(start.length < stage.size ** 2); assert.ok(start.length <= 4); assert.equal(start.length, EXPECTED[i][2]);
    assert.equal(stage.cells, EXPECTED[i][0]); assert.equal(stage.keys, EXPECTED[i][1]); assert.deepEqual([...stage.path], [...EXPECTED[i][1]].map(k => Number(k) - 1));
    const a = normalize(stage.cells), b = normalize(transpose(stage.cells, stage.size));
    assert.ok(!seen.has(a), `stage ${stage.id} duplicates`); assert.ok(!seen.has(b), `stage ${stage.id} transposed duplicates`); seen.add(a); seen.add(b);
  });
});
test('AC09/10 path replays to first completion at pathLength; limit = pathLength + 3', () => {
  for (const stage of STAGES) {
    const cells = [...stage.cells].map(Number); let region = oracleStart(cells, stage.size), current = cells[0], first = null;
    stage.path.forEach((color, k) => { assert.notEqual(color, current); current = color; region = oracleFlood(cells, stage.size, region, color); if (region.length === cells.length && first === null) first = k + 1; assert.ok(first === null || first === k + 1, 'complete before the last path step'); });
    assert.equal(first, stage.pathLength); assert.equal(stage.pathLength, stage.path.length); assert.equal(stage.limit, stage.pathLength + LIMIT_EXTRA);
  }
});
for (const stage of STAGES) test(`AC10 stage ${stage.id}: two independent solvers agree with pathLength ${stage.pathLength}`, () => {
  assert.equal(solveBFS(stage.cells, stage.size, stage.colors), stage.pathLength);
  assert.equal(solveDFS(stage.cells, stage.size, stage.colors, stage.pathLength), stage.pathLength);
});
test('AC06/11 engine-played path on every stage wins with score 300; wasted moves reduce the score by 100 each', () => {
  for (const stage of STAGES) {
    let s = startGame(createGame(stage.id)); for (const c of stage.path) s = pickColor(s, c);
    assert.equal(s.outcome, 'win'); assert.equal(s.used, stage.pathLength); assert.equal(s.result.score, 300); assert.equal(s.result.remaining, 3); assert.equal(s.round, 1); assert.deepEqual(s.history, [...stage.path]);
    assert.equal(s.region.length, stage.size ** 2); assert.equal(s.result.uncovered, 0);
  }
});
test('AC05/06 every stage has a losing line of exactly `limit` counted moves; result has no score', () => {
  const rnd = xorshift(77);
  for (const stage of STAGES) {
    let found = null;
    for (let n = 0; n < 4000 && !found; n++) {
      let s = startGame(createGame(stage.id)), guard = 0;
      while (s.phase === 'playing' && guard++ < 100) s = pickColor(s, Math.floor(rnd() * stage.colors));
      if (s.outcome === 'lose') found = s;
    }
    assert.ok(found, `stage ${stage.id} lose line`); assert.equal(found.used, stage.limit); assert.equal(found.result.score, null); assert.equal(found.result.remaining, 0); assert.ok(found.result.uncovered > 0);
    assert.equal(found.region.length + found.result.uncovered, stage.size ** 2); assert.equal(pickColor(found, 0), found);
  }
});
test('createGame/startGame: ready state, new round and token, immutable cells, unknown stage throws', () => {
  const ready = createGame(6); assert.equal(ready.phase, 'ready'); assert.equal(ready.stageId, 6); assert.equal(ready.used, 0); assert.equal(ready.limit, 11); assert.equal(ready.currentColor, ready.cells[0]); assert.deepEqual(ready.region, initialRegion(ready.cells, 8));
  const started = startGame(ready); assert.equal(started.phase, 'playing'); assert.equal(started.round, 1); assert.equal(started.token, 1); assert.equal(started.stageId, 6); assert.equal(started.used, 0);
  const next = startGame(started, 7); assert.equal(next.round, 2); assert.equal(next.stageId, 7);
  assert.throws(() => createGame(0), RangeError); assert.throws(() => createGame(16), RangeError);
  const before = JSON.stringify(started); pickColor(started, 1); assert.equal(JSON.stringify(started), before);
});
test('pause/resume: causes, no-ops outside playing, protection upgrade only', () => {
  const s = startGame(createGame(1));
  const manual = pauseGame(s, 'manual'); assert.equal(manual.phase, 'paused'); assert.equal(manual.pauseCause, 'manual'); assert.equal(pauseGame(manual, 'manual'), manual); assert.equal(pauseGame(manual, 'modal'), manual);
  assert.equal(pauseGame(manual, 'protection').pauseCause, 'protection'); assert.equal(pauseGame(pauseGame(s, 'modal'), 'protection').pauseCause, 'protection');
  const resumed = resumeGame(manual); assert.equal(resumed.phase, 'playing'); assert.equal(resumed.pauseCause, null); assert.equal(resumed.used, 0);
  assert.equal(pauseGame(createGame(1), 'manual').phase, 'ready'); assert.equal(resumeGame(s), s);
  const done = [...STAGES[0].path].reduce(pickColor, s); assert.equal(pauseGame(done, 'manual'), done);
});
test('regionEdges and absorbRings (visual helpers)', () => {
  assert.deepEqual(regionEdges(3, [0]), [1 | 2 | 4 | 8, 0, 0, 0, 0, 0, 0, 0, 0]);
  const edges = regionEdges(3, [0, 1, 3, 4]); assert.equal(edges[0], 1 | 8); assert.equal(edges[1], 1 | 2); assert.equal(edges[3], 4 | 8); assert.equal(edges[4], 2 | 4);
  assert.deepEqual(regionEdges(2, [0, 1, 2, 3]), [1 | 8, 1 | 2, 4 | 8, 2 | 4]);
  const rings = absorbRings(3, [0], [0, 1, 2, 5]); assert.equal(rings.get(1), 1); assert.equal(rings.get(2), 2); assert.equal(rings.get(5), 3); assert.equal(rings.size, 3);
  assert.equal(absorbRings(10, [0], Array.from({ length: 10 }, (_, i) => i)).get(9), 8);
});
// ---------- save ----------
const fake = (initial = {}, hooks = {}) => {
  const data = new Map(Object.entries(initial)), calls = { get: 0, set: 0 };
  return { data, calls, getItem: k => { calls.get++; if (hooks.getThrows) throw new Error('get'); return data.has(k) ? data.get(k) : null; }, setItem: (k, v) => { calls.set++; if (hooks.setThrows) throw new Error('quota'); data.set(k, v); } };
};
const win = (record, stageId, used) => settleRecord(record, { stageId, used, score: scoreFor(STAGES[stageId - 1].limit, used) });
test('AC23 defaults and exports', () => {
  const d = defaultRecord(); assert.equal(STORAGE_KEY, 'simplegames.paint-spread.v1'); assert.equal(CAP, 1_000_000); assert.deepEqual([...THEMES], ['paint', 'pastel']);
  assert.deepEqual(d.settings, { theme: 'paint', muted: true }); assert.equal(d.records.completed, 0); assert.equal(d.records.unlocked, 1); assert.equal(d.records.stages.length, 15);
  assert.ok(d.records.stages.every(x => x.clearCount === 0 && x.bestUsed === null && x.bestScore === null)); assert.deepEqual(recoverRecord(d), { record: d, warnings: [] });
});
test('AC23 recoverRecord: top-level garbage, version, settings independence', () => {
  for (const bad of [null, undefined, 1, 'x', true, [], [1], {}, { version: 0 }, { version: 2 }, { version: '1' }]) { const r = recoverRecord(bad); assert.deepEqual(r.record, defaultRecord()); assert.ok(r.warnings.length > 0); }
  const base = win(defaultRecord(), 1, 4).record;
  const badTheme = recoverRecord({ ...base, settings: { theme: 'neon', muted: false } }); assert.equal(badTheme.record.settings.theme, 'paint'); assert.equal(badTheme.record.settings.muted, false); assert.equal(badTheme.record.records.stages[0].clearCount, 1);
  const badMuted = recoverRecord({ ...base, settings: { theme: 'pastel', muted: 'no' } }); assert.equal(badMuted.record.settings.theme, 'pastel'); assert.equal(badMuted.record.settings.muted, true); assert.equal(badMuted.record.records.completed, 1);
  assert.equal(recoverRecord({ ...base, settings: null }).record.records.unlocked, 2);
});
test('AC23 recoverRecord: per-stage independent repair', () => {
  const base = [1, 2, 3].reduce((r, id) => win(r, id, STAGES[id - 1].pathLength + 1).record, defaultRecord());
  const damage = (index, value) => { const copy = structuredClone(base); copy.records.stages[index] = value; return recoverRecord(copy); };
  const good = base.records.stages[0];
  const bads = [null, [], 'x', 5, { ...good, clearCount: NaN }, { ...good, clearCount: Infinity }, { ...good, clearCount: -1 }, { ...good, clearCount: 1.5 }, { ...good, clearCount: '1' }, { ...good, clearCount: 2 ** 53 }, { ...good, clearCount: CAP + 1 },
    { clearCount: 0, bestUsed: 3, bestScore: 400 }, { clearCount: 0, bestUsed: null, bestScore: 0 }, { ...good, bestUsed: null }, { ...good, bestUsed: 0 }, { ...good, bestUsed: STAGES[0].limit + 1, bestScore: -100 }, { ...good, bestUsed: 1.5 }, { ...good, bestUsed: '5' },
    { ...good, bestScore: good.bestScore + 100 }, { ...good, bestScore: null }, { ...good, bestUsed: 2 ** 60, bestScore: 0 }];
  for (const bad of bads) { const r = damage(0, bad); assert.deepEqual(r.record.records.stages[0], { clearCount: 0, bestUsed: null, bestScore: null }, JSON.stringify(bad)); assert.deepEqual(r.record.records.stages[1], base.records.stages[1]); assert.deepEqual(r.record.records.stages[2], base.records.stages[2]); assert.ok(r.warnings.length > 0); assert.equal(r.record.records.completed, 2); assert.equal(r.record.records.unlocked, 4); }
  const short = structuredClone(base); short.records.stages.pop(); const rs = recoverRecord(short); assert.equal(rs.record.records.stages.length, 15); assert.deepEqual(rs.record.records.stages[1], base.records.stages[1]);
  const long = structuredClone(base); long.records.stages.push(good); assert.equal(recoverRecord(long).record.records.stages.length, 15);
  const wrongTotals = structuredClone(base); wrongTotals.records.completed = 99; wrongTotals.records.unlocked = 15; const rt = recoverRecord(wrongTotals); assert.equal(rt.record.records.completed, 3); assert.equal(rt.record.records.unlocked, 4); assert.ok(rt.warnings.length > 0);
  const valid = recoverRecord(base); assert.deepEqual(valid, { record: base, warnings: [] });
});
test('AC23 bestUsed lower bound relaxed to 1; upper bound is the stage limit', () => {
  const stage = STAGES[0]; assert.equal(validStage({ clearCount: 1, bestUsed: 1, bestScore: (stage.limit - 1) * 100 }, 0), true);
  assert.equal(validStage({ clearCount: 1, bestUsed: stage.limit, bestScore: 0 }, 0), true); assert.equal(validStage({ clearCount: 1, bestUsed: stage.limit + 1, bestScore: -100 }, 0), false);
  assert.equal(validStage({ clearCount: 1, bestUsed: 0, bestScore: stage.limit * 100 }, 0), false); assert.equal(validStage({ clearCount: 0, bestUsed: null, bestScore: null }, 99), false);
  const record = { ...defaultRecord() }; record.records.stages[0] = { clearCount: 2, bestUsed: 1, bestScore: 600 }; const r = recoverRecord({ ...record, records: { ...record.records, completed: 2, unlocked: 2 } }); assert.equal(r.record.records.stages[0].bestUsed, 1);
});
test('AC21/26 settleRecord: judge, min/max, unlock, immutability, rejection', () => {
  const start = defaultRecord(), frozen = JSON.stringify(start);
  const a = win(start, 1, 6); assert.equal(a.judge, 'new-best'); assert.notEqual(a.record, start); assert.equal(JSON.stringify(start), frozen);
  assert.deepEqual(a.record.records.stages[0], { clearCount: 1, bestUsed: 6, bestScore: 100 }); assert.equal(a.record.records.completed, 1); assert.equal(a.record.records.unlocked, 2);
  const tie = win(a.record, 1, 6); assert.equal(tie.judge, 'tie'); assert.deepEqual(tie.record.records.stages[0], { clearCount: 2, bestUsed: 6, bestScore: 100 });
  const worse = win(tie.record, 1, 7); assert.equal(worse.judge, 'not-best'); assert.deepEqual(worse.record.records.stages[0], { clearCount: 3, bestUsed: 6, bestScore: 100 });
  const better = win(worse.record, 1, 4); assert.equal(better.judge, 'new-best'); assert.deepEqual(better.record.records.stages[0], { clearCount: 4, bestUsed: 4, bestScore: 300 }); assert.equal(better.record.records.completed, 4);
  const far = win(better.record, 9, 13); assert.equal(far.record.records.unlocked, 10); assert.equal(win(far.record, 2, 5).record.records.unlocked, 10); assert.equal(win(defaultRecord(), 15, 16).record.records.unlocked, 15);
  for (const bad of [null, {}, { stageId: 0, used: 1, score: 600 }, { stageId: 16, used: 1, score: 0 }, { stageId: 1, used: 0, score: 700 }, { stageId: 1, used: 8, score: -100 }, { stageId: 1, used: 4.5, score: 250 }, { stageId: 1, used: 4, score: 200 }, { stageId: 1, used: '4', score: 300 }, { stageId: '1', used: 4, score: 300 }, { stageId: 1, used: NaN, score: NaN }]) {
    const r = settleRecord(start, bad); assert.equal(r.record, start); assert.equal(r.judge, 'rejected');
  }
});
test('AC26 cap: saturation leaves every field untouched; CAP-1 reaches CAP exactly', () => {
  const capped = defaultRecord(); capped.records.stages[0] = { clearCount: CAP, bestUsed: 5, bestScore: 200 }; capped.records.completed = CAP; capped.records.unlocked = 2;
  const same = win(capped, 1, 4); assert.equal(same.record, capped); assert.equal(same.judge, 'capped'); assert.deepEqual(capped.records.stages[0], { clearCount: CAP, bestUsed: 5, bestScore: 200 });
  const totalCap = defaultRecord(); totalCap.records.stages[0] = { clearCount: CAP - 1, bestUsed: 5, bestScore: 200 }; totalCap.records.stages[1] = { clearCount: 1, bestUsed: 6, bestScore: 200 }; totalCap.records.completed = CAP; totalCap.records.unlocked = 3;
  const t = win(totalCap, 4, 7); assert.equal(t.record, totalCap); assert.equal(t.judge, 'capped'); assert.equal(totalCap.records.unlocked, 3);
  const near = defaultRecord(); near.records.stages[0] = { clearCount: CAP - 1, bestUsed: 5, bestScore: 200 }; near.records.completed = CAP - 1; near.records.unlocked = 2;
  const last = win(near, 1, 4); assert.equal(last.record.records.stages[0].clearCount, CAP); assert.equal(last.record.records.completed, CAP); assert.equal(win(last.record, 1, 4).record, last.record);
  assert.deepEqual(recoverRecord(last.record).warnings, []);
  const over = structuredClone(last.record); over.records.stages[1] = { clearCount: 1, bestUsed: 6, bestScore: 200 }; const r = recoverRecord(over); assert.ok(r.warnings.length > 0); assert.ok(r.record.records.completed <= CAP);
});
test('AC24 loadRecord/saveRecord: corrupted JSON, read exceptions, write exceptions, other keys preserved', () => {
  const s0 = fake(); const fresh = loadRecord(() => s0); assert.deepEqual(fresh.record, defaultRecord()); assert.deepEqual(fresh.warnings, []); assert.equal(fresh.mode, 'persistent'); assert.equal(s0.calls.set, 0);
  const s1 = fake({ [STORAGE_KEY]: '{oops' }); const bad = loadRecord(() => s1); assert.deepEqual(bad.record, defaultRecord()); assert.ok(bad.warnings.length > 0); assert.equal(bad.mode, 'persistent'); assert.equal(s1.calls.set, 0);
  const stored = win(defaultRecord(), 3, 7).record; const s2 = fake({ [STORAGE_KEY]: JSON.stringify(stored), 'simplegames.other.v1': 'keep' });
  const ok = loadRecord(() => s2); assert.deepEqual(ok.record, stored); assert.deepEqual(ok.warnings, []);
  const saved = saveRecord(win(ok.record, 3, 5).record, () => s2); assert.deepEqual(saved, { ok: true, warning: null }); assert.equal(s2.data.get('simplegames.other.v1'), 'keep'); assert.equal(JSON.parse(s2.data.get(STORAGE_KEY)).records.stages[2].bestUsed, 5);
  const readFail = loadRecord(() => fake({}, { getThrows: true })); assert.equal(readFail.mode, 'memory'); assert.deepEqual(readFail.record, defaultRecord()); assert.equal(readFail.warnings.length, 1);
  const getterFail = loadRecord(() => { throw new DOMException('denied', 'SecurityError'); }); assert.equal(getterFail.mode, 'memory');
  const writeFail = saveRecord(stored, () => fake({}, { setThrows: true })); assert.equal(writeFail.ok, false); assert.match(writeFail.warning, /저장하지 못했어요/);
  const invalid = fake(); assert.equal(saveRecord({ version: 1, junk: true }, () => invalid).ok, false); assert.equal(invalid.calls.set, 0);
  assert.equal(saveRecord(stored, () => { throw new Error('getter'); }).ok, false);
});
test('AC25 warning/result wording never claims a save the code did not make', () => {
  const sources = ['main.mjs', 'save.mjs'].map(f => fs.readFileSync(new URL(`../../public/games/20-flood/${f}`, import.meta.url), 'utf8')).join('\n');
  assert.ok(!sources.includes('저장했어요') || /resultInfo\.save === 'ok' \? '기록에 저장했어요\.'/.test(sources), 'save claim only on ok');
  assert.equal((sources.match(/저장했어요/g) ?? []).length, 1);
});
// ---------- source guards (the real behaviour is exercised in the browser run) ----------
const read = f => fs.readFileSync(new URL(`../../public/games/20-flood/${f}`, import.meta.url), 'utf8');
test('D2 regression guard: a later successful write upgrades a failed result save; failures never do (browser run: artifacts/g030-builder20-fix/d2.mjs)', () => {
  const main = read('main.mjs'), persist = main.slice(main.indexOf('function persist()'), main.indexOf('for (const stage of STAGES)'));
  assert.ok(/if \(saved\.ok\) \{[^}]*if \(resultInfo\.save === 'failed'\) resultInfo\.save = 'ok'; return 'ok'; \}/.test(persist), 'ok branch upgrades failed');
  assert.equal((persist.match(/resultInfo\.save = 'ok'/g) ?? []).length, 1);
  assert.ok(/warnings\.set\('write', saved\.warning\); return 'failed';/.test(persist), 'failed branch keeps the warning and reports failed');
  assert.ok(/if \(storage\.mode === 'memory'\) return 'memory';/.test(persist), 'memory mode never writes or upgrades');
});
test('source guards: no timers/RAF, no external URL, no unconditional focus guard, snapshot defined read-only, 44px home, 3px focus, reduced motion', () => {
  const main = read('main.mjs'), css = read('styles.css'), html = read('index.html'), engine = read('engine.mjs'), save = read('save.mjs'), audio = read('audio.mjs');
  for (const code of [main, engine, save, audio]) { assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(code)); assert.ok(!/https?:\/\//.test(code)); assert.ok(!/Math\.random|Date\.now/.test(code + '')); }
  assert.ok(!/https?:\/\//.test(css + html.replace(/<html[^>]*>/, ''))); assert.ok(!/@import|url\(/.test(css));
  assert.ok(/e\.detail === 0 && document\.activeElement !== b/.test(main)); assert.ok(!/if \(document\.activeElement !== b\) return/.test(main));
  assert.ok(/Object\.defineProperty\(window, '__g030Snapshot', \{\s*configurable: false, writable: false/.test(main)); assert.ok(/structuredClone/.test(main));
  assert.ok(/#home\{[^}]*min-height:44px/.test(css)); assert.ok(/:focus-visible\{[^}]*outline:3px/.test(css)); assert.ok(/prefers-reduced-motion:reduce/.test(css)); assert.ok(/\.status\{[^}]*min-height:calc\(3 \* 1\.5em\)/.test(css));
  assert.ok(/transition:background-color \.12s linear var\(--d,0ms\)/.test(css)); assert.ok(/\.ring-8\{--d:80ms\}/.test(css));
  for (const id of ['home', 'stage-label', 'remaining', 'used', 'limit', 'region-size', 'status', 'board', 'color-bar', 'start', 'pause', 'resume', 'restart', 'help', 'settings', 'mute', 'modal', 'warning', 'ready-panel', 'pause-panel', 'result-panel', 'next', 'retry', 'choose']) assert.ok(html.includes(`id="${id}"`), id);
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.ok(/localStorage/.test(save) && !/localStorage\.(getItem|setItem)\(['"](?!simplegames\.paint-spread)/.test(save));
});
test('UI text never claims the path or limit is optimal', () => {
  for (const file of ['index.html', 'main.mjs', 'engine.mjs', 'save.mjs', 'styles.css', 'audio.mjs']) { const text = read(file); assert.ok(!/최적|최소 횟수|optimal/i.test(text), file); }
});
test('source files parse as modules with only local imports', () => {
  for (const file of ['main.mjs', 'engine.mjs', 'save.mjs', 'audio.mjs']) for (const m of read(file).matchAll(/from '([^']+)'/g)) assert.ok(m[1].startsWith('./'), `${file}: ${m[1]}`);
});
