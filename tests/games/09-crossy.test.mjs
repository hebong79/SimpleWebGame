import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../public/games/09-crossy/engine.js';
import * as S from '../../public/games/09-crossy/save.js';
const grass = () => E.createGame(() => 0);
const run = (s, ticks, rng = () => 0) => { for (let i = 0; i < ticks; i++) E.advance(s, E.STEP, rng); };
const road = (row, extra = {}) => ({ row, type: 'road', width: 56, height: 26, gap: 160, period: 216, phase: 180, direction: 1, baseSpeed: 80, ...extra });
const raw = (p, b, t) => ({ ...S.defaults(), plays: p, bestRows: b, totalRows: t });

test('seeded RNG and generated game are deterministic', () => {
  assert.deepEqual(E.createGame(E.makeRng(48)), E.createGame(E.makeRng(48)));
  assert.notDeepEqual(E.createGame(E.makeRng(48)), E.createGame(E.makeRng(49)));
});
test('initial 9-column world has two safe rows, ready mode and fixed body', () => {
  const s = grass(); assert.equal(s.mode, 'ready'); assert.equal(s.col, 4); assert.equal(s.row, 0);
  assert.equal(E.WIDTH, 9 * E.CELL); assert.equal(E.BODY, 28); assert.equal(E.HOP_SECONDS, 0.12);
  assert.ok(s.lanes.slice(0, 2).every((l) => l.type === 'grass'));
});
test('30,000 generated lanes preserve seam gaps, speed bounds and <=3 road runs', () => {
  for (let seed = 0; seed < 30; seed++) {
    const rng = E.makeRng(seed), s = E.createGame(rng); E.ensureLanes(s, 1000, rng);
    let roads = 0;
    for (const l of s.lanes) {
      roads = l.type === 'road' ? roads + 1 : 0; assert.ok(roads <= 3);
      if (l.type !== 'road') continue;
      assert.ok(l.baseSpeed >= 80 && l.baseSpeed <= 140); assert.ok([-1, 1].includes(l.direction));
      assert.ok(l.gap >= 120); assert.equal(l.period - l.width, l.gap);
      const centers = E.carCenters(l);
      for (let i = 1; i < centers.length; i++) assert.ok(centers[i] - centers[i - 1] - l.width >= 120 - 1e-9);
      assert.ok((l.gap - E.BODY) / 180 > E.HOP_SECONDS);
    }
  }
});
test('difficulty grows per 20 highest rows and caps at 180', () => {
  const lane = road(2, { baseSpeed: 140 });
  assert.deepEqual([0, 19, 20, 39, 40, 80, 500].map((r) => E.laneSpeed(lane, r)), [140, 140, 150, 150, 160, 180, 180]);
});
test('invalid RNG is rejected rather than silently repaired', () => {
  for (const n of [-0.1, 1, NaN, Infinity]) assert.throws(() => E.createGame(() => n), RangeError);
});
test('ready inputs and advance cannot change world', () => {
  const s = grass(), before = structuredClone(s); assert.equal(E.input(s, 'up'), false); run(s, 30); assert.deepEqual(s, before);
});
test('hop interpolates, takes 120ms internally and awards maximum only at landing', () => {
  const s = grass(); E.start(s); E.input(s, 'up'); run(s, 7);
  assert.ok(s.y > 20 && s.y < 60); assert.equal(s.highest, 0); assert.equal(s.row, 0);
  run(s, 8); assert.equal(s.row, 1); assert.equal(s.y, 60); assert.equal(s.highest, 1); assert.equal(s.hop, null);
});
test('one valid command can be queued; all subsequent commands are ignored', () => {
  const s = grass(); E.start(s); assert.equal(E.input(s, 'up'), true); assert.equal(E.input(s, 'right'), true);
  const before = structuredClone(s); assert.equal(E.input(s, 'left'), false); assert.deepEqual(s, before);
  run(s, 29); assert.equal(s.row, 1); assert.equal(s.col, 5); assert.equal(s.hops, 2); assert.equal(s.queued, null);
});
test('edge no-op consumes no RNG, cooldown or score, even while reserving', () => {
  const s = grass(); s.col = 8; s.x = 340; E.start(s); const before = structuredClone(s);
  const noRng = () => { throw new Error('RNG consumed'); };
  assert.equal(E.input(s, 'right', noRng), false); assert.deepEqual(s, before);
  E.input(s, 'up', noRng); assert.equal(E.input(s, 'right', noRng), false); assert.equal(s.queued, null);
  assert.equal(E.input(s, 'left', noRng), true);
});
test('backtracking cannot farm progress or reset idle age', () => {
  const s = grass(); E.start(s); E.input(s, 'up'); run(s, 15); const idle = s.idleAge;
  E.input(s, 'down'); run(s, 15); E.input(s, 'up'); run(s, 15);
  assert.equal(s.highest, 1); assert.ok(s.idleAge > idle + 0.2);
});
test('camera lower boundary rejects offscreen movement without changing world', () => {
  const s = grass(); E.start(s); s.highest = 10; s.row = 8; s.y = 340;
  const before = structuredClone(s); assert.equal(E.input(s, 'down'), false); assert.deepEqual(s, before);
});
test('swept overlap catches endpoints-outside tunneling and relative movement', () => {
  assert.equal(E.sweptOverlap(0, 0, 100, 0, 50, 0, 50, 0, 5, 5), true);
  assert.equal(E.sweptOverlap(0, 0, 100, 0, 100, 0, 0, 0, 5, 5), true);
  assert.equal(E.sweptOverlap(0, 20, 100, 20, 50, 0, 50, 0, 5, 5), false);
});
test('closed boundaries collide; infinitesimal separation does not', () => {
  assert.equal(E.sweptOverlap(0, 0, 0, 0, 42, 27, 42, 27, 42, 27), true);
  assert.equal(E.sweptOverlap(0, 0, 0, 0, 42.00001, 27, 42.00001, 27, 42, 27), false);
});
test('collision during hop is detected before landing and before score', () => {
  const s = grass(); s.lanes[1] = road(1); E.start(s); E.input(s, 'up'); run(s, 12);
  assert.equal(s.mode, 'result'); assert.equal(s.reason, 'collision'); assert.equal(s.highest, 0); assert.ok(s.y < 60);
});
test('collision exactly at landing beats same-tick progress', () => {
  const s = grass(); E.start(s); E.input(s, 'up');
  s.hop.age = 0.115; s.y = 20 + 40 * (0.115 / 0.12);
  // At t=.005: player reaches y=60, car reaches the horizontal closed boundary x=222.
  s.lanes[1] = road(1, { direction: -1, phase: 222.4, baseSpeed: 80 });
  E.advance(s, E.STEP); assert.equal(s.reason, 'collision'); assert.equal(s.highest, 0);
});
test('seam wrapping uses continuous car motion and keeps exact empty gap', () => {
  const s = grass(); s.lanes[0] = road(0, { phase: 215.8 }); s.col = 0; s.x = 20; E.start(s);
  E.advance(s, E.STEP); assert.equal(s.reason, 'collision'); assert.ok(s.lanes[0].phase < 1);
});
test('idle warning boundary at 8 and once-only loss at 10 seconds', () => {
  const s = grass(); E.start(s); run(s, 960); assert.equal(s.mode, 'playing'); assert.ok(Math.abs(s.idleAge - 8) < 1e-9);
  run(s, 240); assert.equal(s.mode, 'result'); assert.equal(s.reason, 'idle');
  const before = structuredClone(s); run(s, 50); assert.deepEqual(s, before); assert.equal(E.finish(s, 'quit'), false);
});
test('new maximum resets idle timer, not lateral movement', () => {
  const s = grass(); E.start(s); run(s, 950); E.input(s, 'up'); run(s, 15);
  assert.equal(s.highest, 1); assert.ok(s.idleAge < 0.01); E.input(s, 'right'); run(s, 15); assert.ok(s.idleAge > 0.12);
});
test('pause freezes time/cars/hop and clears only queued input; explicit resume', () => {
  const s = E.createGame(E.makeRng(5)); E.start(s); E.input(s, 'up'); E.input(s, 'up'); run(s, 3);
  const hop = structuredClone(s.hop); E.pause(s, 'blur'); assert.equal(s.queued, null);
  const before = structuredClone(s); run(s, 50); assert.deepEqual(s, before); assert.equal(E.input(s, 'left'), false);
  assert.equal(E.resume(s), true); assert.deepEqual(s.hop, hop); run(s, 20); assert.equal(s.hops, 1);
});
test('250ms stall protects without a single game tick or reserved command', () => {
  const s = grass(); E.start(s); E.input(s, 'up'); E.input(s, 'right'); const before = structuredClone(s);
  E.advance(s, 0.25); assert.equal(s.mode, 'paused'); assert.equal(s.pauseReason, 'long-frame'); assert.equal(s.queued, null);
  assert.equal(s.elapsed, before.elapsed); assert.equal(s.y, before.y); assert.deepEqual(s.hop, before.hop);
});
test('finish settles only an active round once; quit includes paused rounds', () => {
  const s = grass(); assert.equal(E.finish(s, 'quit'), false); E.start(s); E.pause(s);
  assert.equal(E.finish(s, 'quit'), true); assert.equal(E.finish(s, 'quit'), false); assert.equal(E.resume(s), false);
});
test('all cosmetic combinations leave deterministic gameplay identical', () => {
  const baseline = E.createGame(E.makeRng(9));
  for (const hat of S.SETS) for (const top of S.SETS) for (const backpack of S.SETS) {
    const s = structuredClone(baseline); s.equipped = { hat, top, backpack }; const b = structuredClone(baseline);
    for (const state of [s, b]) { E.start(state); for (const d of ['up', 'right', 'up', 'left']) { E.input(state, d, () => 0); run(state, 15); } }
    delete s.equipped; assert.deepEqual(s, b);
  }
});
test('record defaults, private key, version and zero-score completed rounds', () => {
  assert.equal(S.STORAGE_KEY, 'simple-games:chick-picnic:v1'); assert.ok(S.validRecord(S.defaults()));
  const r = S.settleRecord(S.defaults(), 0); assert.equal(r.plays, 1); assert.ok(S.validRecord(r));
  assert.equal(S.validRecord({ ...r, version: 2 }), false);
});
test('record aggregates exactly match all small possible completed histories', () => {
  let histories = [[]]; const possible = new Set();
  for (let p = 0; p <= 4; p++) {
    for (const h of histories) possible.add(`${p}/${Math.max(0, ...h)}/${h.reduce((a, b) => a + b, 0)}`);
    histories = histories.flatMap((h) => [0, 1, 2, 3, 4].map((v) => [...h, v]));
  }
  let checks = 0;
  for (let p = 0; p <= 4; p++) for (let b = 0; b <= 4; b++) for (let t = 0; t <= 18; t++) {
    assert.equal(S.validRecord(raw(p, b, t)), possible.has(`${p}/${b}/${t}`), `${p}/${b}/${t}`); checks++;
  }
  assert.equal(checks, 475);
});
test('impossible records and unsafe, negative, fractional, nonnumeric counters rejected', () => {
  for (const r of [raw(0, 1, 1), raw(1, 2, 1), raw(1, 2, 3), raw(2, 5, 4), raw(2, 5, 11)]) assert.equal(S.validRecord(r), false);
  for (const field of ['plays', 'bestRows', 'totalRows']) for (const v of [-1, 0.1, NaN, Infinity, '1', null, Number.MAX_SAFE_INTEGER + 1]) assert.equal(S.validRecord({ ...S.defaults(), [field]: v }), false);
});
test('BigInt cross-field validation accepts realizable safe-integer edge aggregates', () => {
  const n = Number.MAX_SAFE_INTEGER;
  assert.equal(S.validRecord(raw(n, n, n)), true); assert.equal(S.validRecord(raw(1, n, n)), true);
  assert.throws(() => S.settleRecord(raw(n, 1, n), 0), RangeError);
  assert.throws(() => S.settleRecord(raw(1, n, n), 1), RangeError);
});
test('unlock thresholds are independent exact 299/300 and 49/50 truth tables', () => {
  for (const [best, total, fire, frog] of [[0, 0, false, false], [49, 299, false, false], [49, 300, true, false], [50, 299, false, true], [50, 300, true, true]]) {
    const r = raw(10, best, total); assert.equal(S.owned(r, 'firefighter'), fire); assert.equal(S.owned(r, 'frog'), frog);
    assert.equal(S.owned(r, 'basic'), true); assert.equal(S.owned(r, 'straw'), true);
  }
});
test('mixed parts, full sets, locked equip rejection and immutable transaction', () => {
  const r = S.settleRecord(S.defaults(), 50), before = structuredClone(r);
  const e = { hat: 'frog', top: 'basic', backpack: 'straw' }; const next = S.equipRecord(r, e);
  assert.deepEqual(next.equipped, e); assert.deepEqual(r, before); e.hat = 'firefighter'; assert.equal(next.equipped.hat, 'frog');
  assert.equal(S.equipRecord(r, e), null); assert.equal(S.equipRecord(r, { ...e, hat: 'unknown' }), null);
  assert.equal(S.validRecord({ ...r, equipped: e }), false);
});
test('parse rejects corrupt JSON, old versions, locked and malformed equipment without saving', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ ...S.defaults(), version: 0 }), JSON.stringify({ ...S.defaults(), equipped: { hat: 'frog' } })]) {
    const parsed = S.parseRecord(raw); assert.equal(parsed.recovered, true); assert.deepEqual(parsed.record, S.defaults());
  }
  assert.equal(S.parseRecord(null).recovered, false);
});
test('valid result->save->reload roundtrip preserves record, mixed parts and mute', () => {
  const saved = new Map(), writes = [];
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => { writes.push(key); saved.set(key, value); }, removeItem: () => assert.fail('must never delete') };
  const store = S.createStore(() => storage); assert.equal(writes.length, 0);
  let r = S.settleRecord(store.read(), 50); r = S.equipRecord(r, { hat: 'frog', top: 'straw', backpack: 'basic' }); r.muted = false; store.update(r);
  const reloaded = S.createStore(() => storage); assert.deepEqual(reloaded.read(), r); assert.deepEqual(writes, [S.STORAGE_KEY]);
  const clone = store.read(); clone.bestRows = 999; assert.equal(store.read().bestRows, 50);
});
test('storage getter, getItem and setItem failures each degrade to warning + memory play', () => {
  const stores = [S.createStore(() => { throw new Error('getter'); }), S.createStore(() => ({ getItem() { throw new Error('read'); } })), S.createStore(() => ({ getItem: () => null, setItem() { throw new Error('write'); } }))];
  for (const store of stores) { const r = S.settleRecord(store.read(), 2); store.update(r); assert.equal(store.read().plays, 1); assert.equal(store.read().totalRows, 2); assert.ok(store.warning()); }
});
test('recovery never writes/deletes automatically and warnings persist', () => {
  const writes = []; const store = S.createStore(() => ({ getItem: () => '{', setItem: (...args) => writes.push(args), removeItem: () => assert.fail() }));
  assert.ok(store.warning()); assert.deepEqual(writes, []); store.update(S.settleRecord(store.read(), 1)); assert.equal(writes.length, 1); assert.ok(store.warning());
});
