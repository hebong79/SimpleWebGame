import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, LOCK_MS, affected, toggle, makeBoard, solve, starsFor, createGame, startGame, pressCell, undo, pauseGame, resumeGame, tick } from '../../public/games/17-flip/engine.mjs';
import { CAP, STORAGE_KEY, defaultRecord, recoverRecord, validStage, loadRecord, saveRecord, settleRecord } from '../../public/games/17-flip/save.mjs';
// Independent subset-DP oracle builds its own cross masks, without engine helpers.
function oracle(board, size) {
  const n = size * size, full = (1 << n) - 1;
  const start = board.reduce((v, x, i) => v + x * 2 ** i, 0), effects = new Uint32Array(1 << n), count = new Uint8Array(1 << n);
  const cross = Array.from({ length: n }, (_, i) => {
    let mask = 0; for (let j = 0; j < n; j++) if (Math.abs(Math.floor(i / size) - Math.floor(j / size)) + Math.abs(i % size - j % size) <= 1) mask += 2 ** j; return mask;
  });
  let target = Infinity;
  for (let subset = 1; subset <= full; subset++) {
    const low = subset & -subset, rest = subset ^ low;
    effects[subset] = effects[rest] ^ cross[Math.log2(low)]; count[subset] = count[rest] + 1;
    if ((effects[subset] ^ start) === full) target = Math.min(target, count[subset]);
  }
  return target;
}
test('cross corner, edge, center, invalid and no wrap', () => {
  assert.deepEqual(affected(3, 0), [0, 3, 1]); assert.deepEqual(affected(3, 1), [1, 4, 0, 2]);
  assert.deepEqual(new Set(affected(3, 4)), new Set([1, 3, 4, 5, 7])); assert.deepEqual(affected(4, 3), [3, 7, 2]);
  for (const i of [-1, 16, .5, NaN]) assert.deepEqual(affected(4, i), []); assert.deepEqual(affected(2, 0), []);
});
for (const size of [3, 4]) test(`${size}x${size} double toggles restore every cell`, () => {
  const board = Array.from({ length: size * size }, (_, i) => i % 2);
  for (let i = 0; i < size * size; i++) assert.deepEqual(toggle(toggle(board, size, i), size, i), board);
});
test('15 unique fixed nonempty incomplete stages; data immutable', () => {
  assert.equal(STAGES.length, 15); const unique = new Set();
  for (const stage of STAGES) {
    assert.equal(stage.size, stage.id <= 5 ? 3 : 4); assert.equal(new Set(stage.scramble).size, stage.scramble.length);
    const board = makeBoard(stage.size, stage.scramble); assert.ok(board.some(Boolean)); assert.ok(board.some(v => !v)); unique.add(`${stage.size}:${board.join('')}`);
    assert.ok(Object.isFrozen(stage)); assert.ok(Object.isFrozen(stage.scramble));
  } assert.equal(unique.size, 15);
});
for (const stage of STAGES) {
  test(`stage ${stage.id} target optimal by exhaustive independent oracle`, () => {
    const board = makeBoard(stage.size, stage.scramble); assert.equal(oracle(board, stage.size), stage.target);
    const answer = solve(board, stage.size); assert.equal(answer.length, stage.target);
    assert.ok(answer.reduce((b, i) => toggle(b, stage.size, i), board).every(Boolean));
    assert.ok(stage.scramble.reduce((b, i) => toggle(b, stage.size, i), board).every(Boolean));
  });
  test(`stage ${stage.id} atomic completion and immutable input`, () => {
    let game = startGame(createGame(stage.id)); const original = structuredClone(game);
    for (const cell of solve(game.board, game.size)) { game = pressCell(game, cell); if (game.phase === 'playing') game = tick(game, LOCK_MS); }
    assert.equal(game.phase, 'result'); assert.deepEqual(game.result, { stage: stage.id, moves: stage.target, stars: 3 });
    assert.equal(game.remaining, 0); assert.equal(pressCell(game, 0), game); assert.equal(undo(game), game); assert.equal(pauseGame(game), game);
    assert.equal(original.moves, 0); assert.notDeepEqual(original.board, game.board);
  });
}
test('stars exact boundaries', () => { for (let target = 1; target <= 7; target++) { assert.equal(starsFor(target, target), 3); assert.equal(starsFor(target + 1, target), 2); assert.equal(starsFor(target + 2, target), 2); assert.equal(starsFor(target + 3, target), 1); } });
test('ready input, undo, locked input are no-ops', () => { const ready = createGame(); assert.equal(pressCell(ready, 1), ready); assert.equal(undo(ready), ready); const game = startGame(ready); assert.equal(undo(game), game); const pressed = pressCell(game, 1); assert.equal(pressCell(pressed, 2), pressed); assert.equal(undo(pressed), pressed); });
test('undo restores board, history and moves; restart uses same fixed board', () => {
  const initial = startGame(createGame(4)), moved = tick(pressCell(initial, 4), 120), undone = undo(moved);
  assert.deepEqual(undone.board, initial.board); assert.equal(undone.moves, 0); assert.deepEqual(undone.history, []);
  const reset = startGame(moved); assert.deepEqual(reset.board, initial.board); assert.equal(reset.moves, 0); assert.equal(reset.round, moved.round + 1); assert.ok(reset.token > moved.token);
});
test('paused lock freezes, resume continues, protection upgrades manual', () => {
  let game = tick(pressCell(startGame(createGame(2)), 0), 40); assert.equal(game.remaining, 80);
  game = pauseGame(game); assert.equal(tick(game, 100), game); assert.equal(game.remaining, 80); game = pauseGame(game, 'protection'); assert.equal(game.pauseCause, 'protection');
  game = tick(resumeGame(game), 80); assert.equal(game.subphase, 'input'); assert.equal(game.remaining, 0);
});
test('long frames protect; stale tokens and invalid deltas no-op', () => {
  const game = pressCell(startGame(createGame(2)), 0); assert.equal(tick(game, 251).phase, 'paused'); assert.equal(tick(game, 100, game.token - 1), game);
  for (const delta of [-1, NaN, Infinity]) assert.equal(tick(game, delta), game); assert.equal(tick(game, 0).remaining, 120);
});
test('invalid engine input is rejected and clamp responsibility remains in UI', () => { const game = startGame(createGame()); for (const i of [-1, 9, .5, NaN]) assert.equal(pressCell(game, i), game); assert.throws(() => createGame(16), RangeError); });
test('default save round trips without write on read', () => {
  const record = defaultRecord(); assert.deepEqual(recoverRecord(record), { record, warnings: [] }); let writes = 0;
  const storage = { getItem: () => JSON.stringify(record), setItem: () => writes++ }; assert.deepEqual(loadRecord(() => storage).record, record); assert.equal(writes, 0);
});
test('completed stage min moves, max stars, count and next unlock', () => {
  let record = settleRecord(defaultRecord(), { stage: 1, moves: 5, stars: 1 }); assert.equal(record.records.unlocked, 2);
  record = settleRecord(record, { stage: 1, moves: 1, stars: 3 }); record = settleRecord(record, { stage: 1, moves: 3, stars: 2 });
  assert.deepEqual(record.records.stages[0], { clearCount: 3, bestMoves: 1, bestStars: 3 }); assert.equal(record.records.completed, 3); assert.equal(recoverRecord(record).warnings.length, 0);
});
test('last stage clamps unlock at 15', () => { const record = settleRecord(defaultRecord(), { stage: 15, moves: 7, stars: 3 }); assert.equal(record.records.unlocked, 15); assert.equal(recoverRecord(record).warnings.length, 0); });
test('bad settings preserve good completed records', () => {
  const saved = settleRecord(defaultRecord(), { stage: 4, moves: 4, stars: 3 }); saved.settings = { theme: 'bad', muted: 'yes' };
  const recovered = recoverRecord(saved); assert.deepEqual(recovered.record.records, saved.records); assert.deepEqual(recovered.record.settings, defaultRecord().settings); assert.ok(recovered.warnings.length);
});
test('valid setting independently survives other bad field', () => { const saved = defaultRecord(); saved.settings = { theme: 'paper', muted: null }; assert.deepEqual(recoverRecord(saved).record.settings, { theme: 'paper', muted: true }); saved.settings = { theme: [], muted: false }; assert.deepEqual(recoverRecord(saved).record.settings, { theme: 'night', muted: false }); });
test('one corrupted stage preserves other stages and derives relations', () => {
  let saved = settleRecord(defaultRecord(), { stage: 1, moves: 1, stars: 3 }); saved = settleRecord(saved, { stage: 2, moves: 2, stars: 3 }); saved.records.stages[0].bestStars = 9; saved.records.completed = 999;
  const result = recoverRecord(saved); assert.deepEqual(result.record.records.stages[0], { clearCount: 0, bestMoves: null, bestStars: 0 }); assert.equal(result.record.records.stages[1].clearCount, 1); assert.equal(result.record.records.completed, 1); assert.equal(result.record.records.unlocked, 3);
});
for (const bad of [null, true, [], 4, 'x', { version: 2 }]) test(`malformed top-level ${JSON.stringify(bad)} uses defaults`, () => { assert.deepEqual(recoverRecord(bad).record, defaultRecord()); assert.ok(recoverRecord(bad).warnings.length); });
test('stage validation rejects finite/range/relationship corruption', () => {
  for (const item of [null, [], { bestMoves: null, bestStars: 0, clearCount: -1 }, { bestMoves: Infinity, bestStars: 3, clearCount: 1 }, { bestMoves: .5, bestStars: 3, clearCount: 1 }, { bestMoves: 0, bestStars: 3, clearCount: 1 }, { bestMoves: 1, bestStars: 1, clearCount: 1 }, { bestMoves: 1, bestStars: 3, clearCount: CAP + 1 }]) assert.equal(validStage(item, 0), false);
});
test('saturated cumulative count prevents all related changes atomically', () => {
  const record = defaultRecord(); record.records.completed = CAP; record.records.unlocked = 2; record.records.stages[0] = { clearCount: CAP, bestMoves: 5, bestStars: 1 };
  assert.equal(settleRecord(record, { stage: 2, moves: 2, stars: 3 }), record); assert.equal(settleRecord(record, { stage: 1, moves: 1, stars: 3 }), record); assert.equal(recoverRecord(record).warnings.length, 0);
});
test('cap boundary increments exactly once to cap', () => {
  const record = defaultRecord(); record.records.completed = CAP - 1; record.records.unlocked = 2; record.records.stages[0] = { clearCount: CAP - 1, bestMoves: 1, bestStars: 3 };
  const next = settleRecord(record, { stage: 2, moves: 2, stars: 3 }); assert.equal(next.records.completed, CAP); assert.equal(next.records.unlocked, 3); assert.equal(recoverRecord(next).warnings.length, 0);
});
test('invalid completion no-op', () => { const r = defaultRecord(); for (const result of [null, [], { stage: 0 }, { stage: 16 }, { stage: 1, moves: 0, stars: 3 }, { stage: 1, moves: 1, stars: 1 }]) assert.equal(settleRecord(r, result), r); });
test('storage getter, getItem, parse and setItem exceptions recover safely', () => {
  for (const getter of [() => { throw Error('getter'); }, () => ({ getItem() { throw Error('read'); } }), () => ({ getItem() { return '{'; } })]) { const result = loadRecord(getter); assert.deepEqual(result.record, defaultRecord()); assert.ok(result.warnings.length); }
  assert.equal(saveRecord(defaultRecord(), () => { throw Error('getter'); }).ok, false); assert.equal(saveRecord(defaultRecord(), () => ({ setItem() { throw Error('full'); } })).ok, false);
});
test('writes only exact dedicated key; no other keys touched', () => {
  const map = new Map([['other-game', 'preserve']]), storage = { setItem: (k, v) => map.set(k, v) };
  assert.equal(saveRecord(defaultRecord(), () => storage).ok, true); assert.equal(map.get('other-game'), 'preserve'); assert.equal(map.size, 2); assert.deepEqual(JSON.parse(map.get(STORAGE_KEY)), defaultRecord());
  const bad = defaultRecord(); bad.settings.theme = 'bad'; assert.equal(saveRecord(bad, () => storage).ok, false);
});
// G029-FIX17 regression (source-level guards; real WebKit/Chromium behaviour is covered by artifacts/g029-builder17-fix/verify-fix.mjs).
const fixSource = async name => (await import('node:fs')).readFileSync(new URL(`../../public/games/17-flip/${name}`, import.meta.url), 'utf8');
test('D1: cell click handler does not require activeElement for pointer clicks (WebKit does not focus clicked buttons)', async () => {
  const main = await fixSource('main.mjs'), start = main.indexOf("b.addEventListener('click', e => {"), end = main.indexOf('cells.push(b)', start);
  assert.ok(start > 0 && end > start, 'cell click handler found'); const handler = main.slice(start, end);
  assert.doesNotMatch(handler, /document\.activeElement\s*!==\s*b\s*\|\|\s*state\.phase/, 'no unconditional activeElement gate');
  assert.match(handler, /e\.detail\s*===\s*0\s*&&\s*document\.activeElement\s*!==\s*b/, 'only keyboard-synthesised clicks need focus');
  for (const guard of ['modalKind', 'document.hidden', "state.phase !== 'playing'"]) assert.ok(handler.includes(guard), `${guard} guard kept`);
});
test('D1: pointer gesture validation and key repeat guards are still present', async () => {
  const main = await fixSource('main.mjs');
  for (const part of ['> 8', "addEventListener('scroll'", 'e.detail > 0', 'e.stopImmediatePropagation()', 'held.has(e.code)', "pointercancel", 'pointers.size !== 1']) assert.ok(main.includes(part), part);
});
test('D2: header home link has a 44px touch target', async () => {
  const css = await fixSource('styles.css'); assert.match(css, /#home\{[^}]*min-height:44px/); assert.match(css, /#home\{[^}]*display:inline-flex/);
});
test('G031-FIX17 INT-1: narrow screens reserve two status lines so the board does not jump (source guard; browser proof in artifacts/g031-fix)', async () => {
  const css = await fixSource('styles.css'); assert.match(css, /@media\(max-width:400px\)\{\.status\{min-height:62px\}\}/);
});
