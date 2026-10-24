import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, STORAGE_KEY, PARTS, createGame, startGame, queueDirection, step, pauseGame, resumeGame,
  spawnFood, speedFor, defaultProfile, normalizeProfile, loadProfile, saveProfile, recordProgress,
  unlockedFor, canEquip, equip } from '../../public/games/02-snake/engine.mjs';
const rng = () => 0;
const withFood = (food, extra = {}) => ({ ...startGame(rng), food, ...extra });
const memory = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), values };
};
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

test('20×20, ready state, length three, initial speed and safe food', () => {
  const g = createGame(rng);
  assert.equal(SIZE, 20); assert.equal(g.status, 'ready'); assert.equal(g.snake.length, 3);
  assert.equal(g.score, 0); assert.equal(speedFor(g.eaten), 5); assert.equal(g.direction, 'right');
  assert.ok(g.food.x >= 12 && g.food.x <= 15); assert.ok(Math.abs(g.food.y - 10) <= 2);
});
test('normal movement shifts exactly one cell without growing or mutating input', () => {
  const g = deepFreeze(withFood({ x: 1, y: 1 }));
  const next = step(g, rng);
  assert.deepEqual(next.snake, [{ x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }]);
  assert.equal(next.score, 0); assert.equal(next.ticks, 1); assert.deepEqual(g.snake[0], { x: 10, y: 10 });
});
test('food adds one segment, ten points and one food count', () => {
  const g = deepFreeze(withFood({ x: 11, y: 10 })); const next = step(g, rng);
  assert.equal(next.snake.length, 4); assert.equal(next.eaten, 1); assert.equal(next.score, 10);
  assert.ok(!next.snake.some(p => p.x === next.food.x && p.y === next.food.y));
});
test('no random number is consumed for a non-eating movement', () => {
  step(withFood({ x: 0, y: 0 }), () => { throw Error('unexpected RNG'); });
});
for (const [direction, opposite] of [['right', 'left'], ['left', 'right'], ['up', 'down'], ['down', 'up']]) {
  test(`rejects reverse direction ${direction} → ${opposite}`, () => {
    const g = { ...startGame(rng), direction }; assert.equal(queueDirection(g, opposite), g);
  });
}
test('one reserved turn prevents right → up → left from becoming a 180-degree reversal', () => {
  const g = startGame(rng), first = queueDirection(g, 'up');
  assert.equal(queueDirection(first, 'left'), first);
  assert.equal(step(first, rng).direction, 'up'); assert.equal(step(first, rng).queued, null);
});
test('same-direction and unknown keys do not occupy a turn slot', () => {
  const g = startGame(rng); assert.equal(queueDirection(g, 'right'), g);
  assert.equal(queueDirection(g, '__proto__'), g); assert.equal(queueDirection(g, 'diagonal'), g);
  assert.equal(queueDirection(g, 'up').queued, 'up');
});
test('after a tick the next perpendicular turn is allowed', () => {
  const first = step(queueDirection(startGame(rng), 'up'), rng);
  assert.equal(queueDirection(first, 'left').queued, 'left');
});
test('moving into a vacating tail cell is legal', () => {
  const g = withFood({ x: 19, y: 19 }, { snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], direction: 'up' });
  const next = step(queueDirection(g, 'left'), rng);
  assert.equal(next.status, 'playing'); assert.deepEqual(next.snake[0], { x: 4, y: 5 });
  assert.equal(next.snake.length, 4);
});
test('the tail is not vacated on an eating move', () => {
  const g = withFood({ x: 4, y: 5 }, { snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], direction: 'up' });
  const next = step(queueDirection(g, 'left'), rng); assert.equal(next.reason, 'body'); assert.equal(next.score, 0);
});
test('non-tail body collision ends the round without growing', () => {
  const g = withFood({ x: 19, y: 19 }, { snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], direction: 'right' });
  const next = step(queueDirection(g, 'down'), rng); assert.equal(next.status, 'result');
  assert.equal(next.reason, 'body'); assert.deepEqual(next.snake, g.snake);
});
for (const [direction, head] of [['up', { x: 10, y: 0 }], ['down', { x: 10, y: 19 }], ['left', { x: 0, y: 10 }], ['right', { x: 19, y: 10 }]]) {
  test(`wall collision at ${direction} edge`, () => {
    const g = withFood({ x: 1, y: 1 }, { direction, snake: [head, { x: 7, y: 7 }, { x: 7, y: 8 }] });
    const next = step(g, rng); assert.equal(next.status, 'result'); assert.equal(next.reason, 'wall');
  });
}
test('full board spawn terminates without invoking RNG', () => {
  const all = Array.from({ length: 400 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) }));
  assert.equal(spawnFood(all, 'right', 100, () => { throw Error('not needed'); }), null);
});
test('eating the final free cell completes the round', () => {
  const path = [];
  for (let y = 0; y < 20; y++) for (let i = 0; i < 20; i++) path.push({ x: y % 2 ? 19 - i : i, y });
  const g = withFood(path[399], { snake: path.slice(0, -1).reverse(), direction: 'left', eaten: 396, score: 3960 });
  const next = step(g, () => { throw Error('full board must not use RNG'); });
  assert.equal(next.snake.length, 400); assert.equal(next.status, 'result');
  assert.equal(next.reason, 'complete'); assert.equal(next.food, null); assert.equal(next.score, 3970);
});
test('all food selections avoid the body and remain in bounds', () => {
  const g = createGame(rng);
  for (const eaten of [0, 1, 2, 3, 30]) for (let i = 0; i <= 100; i++) {
    const p = spawnFood(g.snake, 'right', eaten, () => i / 100);
    assert.ok(p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20);
    assert.ok(!g.snake.some(s => s.x === p.x && s.y === p.y));
  }
});
test('first three foods prefer the safe forward band', () => {
  for (let eaten = 0; eaten < 3; eaten++) for (let i = 0; i < 30; i++) {
    const p = spawnFood(createGame(rng).snake, 'right', eaten, () => i / 30);
    assert.ok(p.x >= 12 && p.x <= 15); assert.ok(Math.abs(p.y - 10) <= 2);
  }
});
test('safe-forward selection falls back when facing a wall', () => {
  const snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }];
  assert.deepEqual(spawnFood(snake, 'right', 0, rng), { x: 0, y: 0 });
});
test('single empty cell is selected and invalid RNG cannot index outside candidates', () => {
  const all = Array.from({ length: 400 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) }));
  const snake = all.filter(p => p.x !== 0 || p.y !== 0);
  for (const value of [-100, 0, 1, 5, NaN]) assert.deepEqual(spawnFood(snake, 'right', 3, () => value), { x: 0, y: 0 });
});
test('speed increases every five foods and is capped at ten', () => {
  for (const [n, speed] of [[0, 5], [4, 5], [5, 6], [9, 6], [10, 7], [24, 9], [25, 10], [397, 10]]) assert.equal(speedFor(n), speed);
});
test('ready, paused and ended games are immutable to steps and direction inputs', () => {
  for (const status of ['ready', 'paused', 'result']) {
    const g = deepFreeze({ ...startGame(rng), status });
    assert.equal(step(g, () => { throw Error('must not advance'); }), g);
    assert.equal(queueDirection(g, 'up'), g);
  }
});
test('pause and explicit resume discard queued input', () => {
  const g = queueDirection(startGame(rng), 'up'), paused = pauseGame(g);
  assert.equal(paused.status, 'paused'); assert.equal(paused.queued, null);
  assert.equal(resumeGame(paused).status, 'playing'); assert.equal(resumeGame(paused).queued, null);
  assert.equal(resumeGame(g), g);
});
test('first food updates highest score, lifetime food and explorer unlock', () => {
  const before = withFood({ x: 11, y: 10 }), after = step(before, rng);
  const profile = recordProgress(deepFreeze(defaultProfile()), before, after);
  assert.equal(profile.totalFood, 1); assert.equal(profile.bestScore, 10);
  assert.deepEqual(profile.unlocked, ['base', 'explorer']);
});
test('achievement thresholds are exact and all parts unlock as a set', () => {
  assert.deepEqual(unlockedFor(90, 99), ['base', 'explorer']);
  assert.deepEqual(unlockedFor(100, 100), ['base', 'explorer', 'space', 'strawberry']);
});
test('round end and repeated result checks do not double-count food', () => {
  const before = withFood({ x: 0, y: 0 }, { snake: [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }] });
  const result = step(before, rng), profile = recordProgress(defaultProfile(), before, result);
  assert.equal(profile.totalFood, 0); assert.equal(recordProgress(profile, result, result), profile);
});
test('retry creates only a new board and leaves profile unchanged', () => {
  const profile = deepFreeze({ ...defaultProfile(), bestScore: 100, totalFood: 100, unlocked: unlockedFor(100, 100) });
  const copy = JSON.stringify(profile); const g = startGame(rng);
  assert.equal(g.score, 0); assert.equal(g.snake.length, 3); assert.equal(JSON.stringify(profile), copy);
});
test('per-part outfit combinations save independently without mutating the draft', () => {
  const p = { ...defaultProfile(), bestScore: 100, totalFood: 100, unlocked: unlockedFor(100, 100) };
  const draft = { head: 'explorer', scales: 'strawberry', tail: 'space' };
  assert.ok(canEquip(p, draft)); const next = equip(p, draft); draft.head = 'base';
  assert.equal(next.equipment.head, 'explorer'); assert.equal(p.equipment.head, 'base');
});
test('locked, unknown and incomplete equipment cannot be applied', () => {
  const p = defaultProfile();
  for (const draft of [{ head: 'space', scales: 'base', tail: 'base' }, { head: 'unknown', scales: 'base', tail: 'base' }, {}]) {
    assert.equal(canEquip(p, draft), false); assert.equal(equip(p, draft), p);
  }
});
test('outfits do not change movement, food, speed, collision or points', () => {
  const inputs = ['up', 'left', 'down', 'right', 'up', 'left']; let reference;
  for (const id of ['base', 'explorer', 'space', 'strawberry']) {
    const profile = equip({ ...defaultProfile(), bestScore: 100, totalFood: 100, unlocked: unlockedFor(100, 100) }, Object.fromEntries(PARTS.map(p => [p, id])));
    let g = withFood({ x: 10, y: 9 });
    for (const direction of inputs) g = step(queueDirection(g, direction), rng);
    assert.equal(profile.equipment.head, id);
    if (!reference) reference = g; else assert.deepEqual(g, reference);
  }
});
test('new storage is silent and versioned round-trip retains records, outfits and mute', () => {
  const store = memory(); assert.equal(loadProfile(store).warning, '');
  const p = equip({ ...defaultProfile(), bestScore: 100, totalFood: 100, unlocked: unlockedFor(100, 100), muted: false }, { head: 'space', scales: 'strawberry', tail: 'explorer' });
  assert.equal(saveProfile(store, p).ok, true); assert.ok(store.values.has(STORAGE_KEY));
  assert.deepEqual(loadProfile(store), { profile: p, warning: '' });
});
test('malformed JSON, unknown versions and non-object storage recover safely', () => {
  for (const raw of ['{broken', 'null', '[]', '{"version":0}', '{"version":99}']) {
    const store = memory(); store.setItem(STORAGE_KEY, raw); const loaded = loadProfile(store);
    assert.deepEqual(loaded.profile, defaultProfile()); assert.ok(loaded.warning);
  }
});
test('bad numeric fields and unknown equipment recover without unlocking locked items', () => {
  const loaded = normalizeProfile({ version: 1, bestScore: -10, totalFood: Infinity,
    unlocked: ['base', 'space'], equipment: { head: 'space', scales: 'missing', tail: 'base' }, muted: 'false' });
  assert.deepEqual(loaded.profile, defaultProfile()); assert.equal(loaded.recovered, true);
});
test('valid records survive a damaged equipment field; forged ownership is ignored', () => {
  const loaded = normalizeProfile({ ...defaultProfile(), bestScore: 100, totalFood: 10,
    unlocked: ['base', 'explorer', 'space', 'strawberry'], equipment: { head: 'space', scales: 'strawberry', tail: 'bad' } });
  assert.equal(loaded.profile.bestScore, 100); assert.equal(loaded.profile.totalFood, 10);
  assert.deepEqual(loaded.profile.equipment, { head: 'space', scales: 'base', tail: 'base' });
});
test('blocked or full storage returns a warning while retaining in-memory profile', () => {
  const store = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  assert.ok(loadProfile(store).warning); const p = defaultProfile();
  assert.equal(saveProfile(store, p).ok, false); assert.ok(saveProfile(store, p).warning);
  assert.deepEqual(p, defaultProfile());
});