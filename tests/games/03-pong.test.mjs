import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES as R, AI_SPEEDS, createGame, startGame, pauseGame, resumeGame, step } from '../../public/games/03-pong/engine.mjs';
import { SAVE_KEY, THEMES, loadSave, normalizeSave, writeSave } from '../../public/games/03-pong/save.mjs';
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function rally(options = {}) {
  const state = createGame(options);
  startGame(state);
  step(state, 1);
  assert.equal(state.phase, 'rally');
  return state;
}
function miss(state, side = 'player') {
  state.phase = 'rally';
  state.ball = { x: side === 'player' ? 0 : R.width, y: 20, vx: side === 'player' ? -600 : 600, vy: 0, speed: 600 };
  return step(state, 0.1);
}

test('ready state is stationary; launch waits a full second at 300px/s', () => {
  const s = createGame(); const before = structuredClone(s);
  assert.deepEqual(step(s, 10, { axis: 1 }), []); assert.deepEqual(s, before);
  assert.equal(startGame(s), true); assert.equal(startGame(s), false);
  step(s, 0.999); assert.equal(s.phase, 'serve'); near(s.ball.x, 480);
  step(s, 0.001); assert.equal(s.phase, 'rally'); near(Math.hypot(s.ball.vx, s.ball.vy), 300);
});
test('swept collision stops a 600px/s ball crossing the entire paddle in a long step', () => {
  const s = rally(); s.ball = { x: 160, y: 270, vx: -600, vy: 0, speed: 600 };
  const events = step(s, 0.35);
  assert.equal(events.filter(e => e.type === 'hit' && e.side === 'player').length, 1);
  assert.ok(s.ball.vx > 0); assert.ok(s.ball.x > 58); assert.deepEqual(s.score, { player: 0, ai: 0 });
});
test('right paddle also catches a high-speed crossing', () => {
  const s = rally(); s.ball = { x: 800, y: 270, vx: 600, vy: 0, speed: 600 };
  assert.equal(step(s, 0.35).filter(e => e.type === 'hit' && e.side === 'ai').length, 1);
  assert.ok(s.ball.vx < 0);
});
test('a ball already behind a paddle is not reflected through its back', () => {
  const s = rally(); s.ball = { x: 30, y: 270, vx: -600, vy: 0, speed: 600 };
  const events = step(s, 1); assert.equal(events.filter(e => e.type === 'score').length, 1);
  assert.equal(s.score.ai, 1);
});
for (const [name, y, vy] of [['top', 10, -300], ['bottom', 530, 300]]) {
  test(`${name} wall reflects and stays inside bounds`, () => {
    const s = rally(); s.ball = { x: 480, y, vx: 0, vy, speed: 300 };
    assert.ok(step(s, 0.2).some(e => e.type === 'wall'));
    assert.equal(Math.sign(s.ball.vy), -Math.sign(vy)); assert.ok(s.ball.y >= 8 && s.ball.y <= 532);
  });
}
for (const offset of [-52, 0, 52]) {
  test(`paddle offset ${offset} controls the bounce angle within 60 degrees`, () => {
    const s = rally(); s.ball = { x: 59, y: 270 + offset, vx: -300, vy: 0, speed: 300 };
    step(s, 0.005);
    near(Math.atan2(s.ball.vy, s.ball.vx), (offset / 52) * Math.PI / 3);
    near(s.ball.speed, 309); assert.equal(s.bestRally, 1);
  });
}
test('each hit adds 3 percent and repeated hits never exceed 600px/s', () => {
  const s = rally();
  for (let i = 0; i < 60; i += 1) {
    const previous = s.ball.speed;
    s.ball.x = 59; s.ball.y = s.player.y; s.ball.vx = -previous; s.ball.vy = 0;
    step(s, 0.005); near(s.ball.speed, Math.min(600, previous * 1.03));
    near(Math.hypot(s.ball.vx, s.ball.vy), s.ball.speed);
  }
  assert.equal(s.ball.speed, 600); assert.equal(s.rally, 60);
});
for (const difficulty of ['easy', 'normal']) {
  test(`${difficulty} AI never teleports or exceeds its movement limit`, () => {
    const s = rally({ difficulty }); s.ball.x = 480; s.ball.y = 500; s.ball.vx = 0; s.ball.vy = 0;
    const y = s.ai.y; step(s, 0.2);
    near(s.ai.y - y, AI_SPEEDS[difficulty] * 0.2);
    assert.ok(s.ai.y <= R.height - R.paddleHeight / 2);
  });
}
for (const missedSide of ['player', 'ai']) {
  test(`${missedSide} miss awards exactly one point and serves toward the loser after 1 second`, () => {
    const s = rally(); s.rally = 9;
    const events = miss(s, missedSide); const scorer = missedSide === 'player' ? 'ai' : 'player';
    assert.equal(events.filter(e => e.type === 'score').length, 1); assert.equal(s.score[scorer], 1);
    assert.equal(s.phase, 'serve'); near(s.serveRemaining, 1); assert.equal(s.bestRally, 9); near(s.ball.speed, 300);
    step(s, 0.999); assert.equal(s.phase, 'serve'); near(s.ball.x, 480);
    step(s, 0.001); assert.equal(s.phase, 'rally'); assert.equal(Math.sign(s.ball.vx), missedSide === 'player' ? -1 : 1);
    assert.equal(s.score[scorer], 1);
  });
}
for (const winner of ['player', 'ai']) {
  test(`7 points finish for ${winner}; later input/time/pause/start cannot change the state`, () => {
    const s = rally(); s.score[winner] = 6;
    const events = miss(s, winner === 'player' ? 'ai' : 'player');
    assert.equal(s.status, 'finished'); assert.equal(s.winner, winner); assert.equal(s.score[winner], 7);
    assert.equal(events.filter(e => e.type === 'finish').length, 1);
    const before = structuredClone(s);
    for (let i = 0; i < 20; i++) step(s, 10, { axis: -1, targetY: 100 });
    assert.equal(pauseGame(s), false); assert.equal(resumeGame(s), false); assert.equal(startGame(s), false);
    assert.deepEqual(s, before);
  });
}
for (const phase of ['serve', 'rally']) {
  test(`pause freezes ${phase}, including AI, ball, player and serve timer`, () => {
    const s = phase === 'rally' ? rally() : createGame(); if (phase === 'serve') startGame(s);
    assert.equal(pauseGame(s), true); const before = structuredClone(s);
    step(s, 5, { axis: 1 }); assert.deepEqual(s, before);
    assert.equal(resumeGame(s), true); step(s, 0.1, { axis: 1 }); assert.ok(s.player.y > before.player.y);
  });
}
test('keyboard and drag inputs clamp the paddle to court edges', () => {
  const s = rally(); step(s, 0.3, { axis: -50 }); near(s.player.y, 114);
  step(s, 0.2, { targetY: -1000 }); near(s.player.y, 52);
  step(s, 1, { targetY: 10000 }); near(s.player.y, 488);
});
test('invalid elapsed time has no effect; unknown difficulty is rejected', () => {
  const s = rally(); const before = structuredClone(s);
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(step(s, dt), []);
  assert.deepEqual(s, before); assert.throws(() => createGame({ difficulty: '__proto__' }), RangeError);
});
test('frame partition preserves ball trajectory; AI tracking error stays within one substep', () => {
  const a = rally(); const b = structuredClone(a);
  step(a, 0.4); for (let i = 0; i < 40; i++) step(b, 0.01);
  near(a.ball.x, b.ball.x); near(a.ball.y, b.ball.y); assert.ok(Math.abs(a.ai.y - b.ai.y) <= AI_SPEEDS.normal / 120);
});
test('corrupt, old-version, null and untrusted save fields recover safely', () => {
  for (const raw of ['{', 'null', '{"version":99}', '[]']) {
    const result = loadSave({ getItem: () => raw }); assert.deepEqual(result.data, normalizeSave(null));
  }
  const result = normalizeSave({ version: 1, difficulty: 'cheat', muted: 'yes', themes: { ball: 'unknown' }, stats: { normal: { wins: -1, bestRally: Infinity } } });
  assert.deepEqual(result, normalizeSave(null));
});
test('storage access/quota failures never throw or prevent a match', () => {
  const unavailable = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadSave(unavailable).available, false); assert.equal(writeSave(unavailable, normalizeSave(null)), false);
  assert.equal(loadSave(undefined).available, false); assert.equal(rally().status, 'playing');
});
test('all 27 visual combinations round-trip with independent difficulty records', () => {
  let raw; const storage = { getItem: () => raw ?? null, setItem(key, value) { assert.equal(key, SAVE_KEY); raw = value; } };
  for (const paddle of THEMES.paddle) for (const ball of THEMES.ball) for (const court of THEMES.court) {
    const data = normalizeSave({ version: 1, difficulty: 'easy', muted: true, themes: { paddle, ball, court }, stats: { easy: { wins: 3, bestRally: 18 }, normal: { wins: 1, bestRally: 6 } } });
    assert.equal(writeSave(storage, data), true); assert.deepEqual(loadSave(storage).data, data);
    // Themes are deliberately absent from the simulation's API/state.
    assert.deepEqual(createGame({ difficulty: data.difficulty }), createGame({ difficulty: 'easy' }));
  }
});
test('starting a fresh match leaves saved settings and records untouched', () => {
  const data = normalizeSave({ version: 1, muted: true, difficulty: 'easy', stats: { easy: { wins: 2, bestRally: 7 } } });
  const before = structuredClone(data); const s = createGame({ difficulty: data.difficulty }); startGame(s);
  assert.deepEqual(data, before); assert.deepEqual(s.score, { player: 0, ai: 0 });
});
