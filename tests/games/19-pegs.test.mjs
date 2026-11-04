import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BOARDS, STAGES, COUNT_CAP, emptyCells, cellsFromPegs, countPegs, checkJump, jumpsFrom, legalJumps, isWon, isStuck,
  createGame, selectStage, startGame, restart, targetsOf, tryJump, select, deselect, undo, pauseGame, resumeGame,
} from '../../public/games/19-pegs/engine.mjs';
import {
  STORAGE_KEY, CAP, THEMES, defaultRecord, validStage, derive, recoverRecord, loadRecord, saveRecord, settleWin, settleStuck,
} from '../../public/games/19-pegs/save.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Independent helpers (written from the design document, not from engine code): 2D grids, coordinate arithmetic.
// ---------------------------------------------------------------------------------------------------------------
const CROSS5_HOLES = [0, 4, 20, 24];
const CROSS7_HOLES = [0, 1, 5, 6, 7, 8, 12, 13, 35, 36, 40, 41, 42, 43, 47, 48];
const toGrid = (cells, width) => Array.from({ length: cells.length / width }, (_, r) => cells.slice(r * width, r * width + width));
// Oracle: every legal jump of a grid as "r,c>r,c" strings.
function oracleJumps(grid) {
  const found = new Set(), h = grid.length, w = grid[0].length;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (grid[r][c] !== 1) continue;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (tr < 0 || tc < 0 || tr >= h || tc >= w) continue;
      if (grid[mr][mc] === 1 && grid[tr][tc] === 0) found.add(`${r},${c}>${tr},${tc}`);
    }
  }
  return found;
}
const engineJumps = (board, cells) => new Set(legalJumps(board, cells).map(j => `${Math.floor(j.from / board.width)},${j.from % board.width}>${Math.floor(j.to / board.width)},${j.to % board.width}`));
let seed = 20261102;
const random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const randomPegs = (board, density) => { const cells = emptyCells(board); for (let i = 0; i < cells.length; i++) if (cells[i] === 0 && random() < density) cells[i] = 1; return cells; };

// Independent solver: DFS with memo on a string key (separate from the engine's data structures).
function solverFor(width, holes) {
  const key = grid => grid.map(row => row.join('')).join('/');
  const bad = new Set(), good = new Set();
  const moves = grid => [...oracleJumps(grid)].map(s => s.split(/[,>]/).map(Number));
  const apply = (grid, [r, c, tr, tc]) => { const n = grid.map(row => row.slice()); n[r][c] = 0; n[(r + tr) / 2][(c + tc) / 2] = 0; n[tr][tc] = 1; return n; };
  const count = grid => grid.flat().filter(v => v === 1).length;
  const solvable = grid => {
    const k = key(grid); if (good.has(k)) return true; if (bad.has(k)) return false;
    if (count(grid) === 1) { good.add(k); return true; }
    for (const m of moves(grid)) if (solvable(apply(grid, m))) { good.add(k); return true; }
    bad.add(k); return false;
  };
  return { solvable, moves, apply, count, width, holes };
}
const solver5 = solverFor(5, CROSS5_HOLES);
const stageGrid = stage => { const cells = new Array(25).fill(0); for (const h of CROSS5_HOLES) cells[h] = -1; for (const p of stage.pegs) cells[p] = 1; return toGrid(cells, 5); };
const canonical = (pegs, size) => {
  const forms = [];
  for (let k = 0; k < 8; k++) forms.push(pegs.map(p => { let r = Math.floor(p / size), c = p % size; if (k & 4) [r, c] = [c, r]; if (k & 1) r = size - 1 - r; if (k & 2) c = size - 1 - c; return r * size + c; }).sort((a, b) => a - b).join(','));
  return forms.sort()[0];
};
const running = (stageId = 1) => startGame(createGame(stageId));
// Plays a list of [from,to] with select() calls (the real UI path) and returns the final game.
const playPath = (game, path) => { for (const [from, to] of path) { game = select(game, from).game; const r = select(game, to); assert.equal(r.kind, 'jump', `${from}>${to}`); game = r.game; } return game; };

// ---------------------------------------------------------------------------------------------------------------
// AC2 boards
// ---------------------------------------------------------------------------------------------------------------
test('cross5 has 21 cells and cross7 has 33; corner holes are exactly the specified ones', () => {
  assert.deepEqual(BOARDS.cross5.holes, CROSS5_HOLES); assert.deepEqual(BOARDS.cross7.holes, CROSS7_HOLES);
  assert.equal(emptyCells(BOARDS.cross5).filter(v => v !== -1).length, 21); assert.equal(emptyCells(BOARDS.cross7).filter(v => v !== -1).length, 33);
  assert.equal(emptyCells(BOARDS.cross7).length, 49); assert.ok(Object.isFrozen(BOARDS.cross5) && Object.isFrozen(BOARDS.cross5.holes));
  // cross7: 2x2 corners removed, i.e. cells whose row and column are both in {0,1,5,6}.
  const expected = []; for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if ((r < 2 || r > 4) && (c < 2 || c > 4)) expected.push(r * 7 + c);
  assert.deepEqual(expected, CROSS7_HOLES);
});
test('cross7 standard start (all pegs but the centre) has exactly 4 legal first jumps', () => {
  const cells = emptyCells(BOARDS.cross7).map(v => v === 0 ? 1 : v); cells[24] = 0;
  assert.equal(countPegs(cells), 32); const jumps = legalJumps(BOARDS.cross7, cells);
  assert.equal(jumps.length, 4); assert.deepEqual(jumps.map(j => j.to), [24, 24, 24, 24]); assert.deepEqual(new Set(jumps.map(j => j.from)), new Set([10, 22, 26, 38]));
  assert.deepEqual(new Set(jumps.map(j => j.over)), new Set([17, 23, 25, 31]));
});
test('off-board cells can never be start, middle or destination (cross7 and cross5)', () => {
  for (const board of [BOARDS.cross5, BOARDS.cross7]) {
    const full = emptyCells(board).map(v => v === 0 ? 1 : v);
    for (const hole of board.holes) {
      for (let other = 0; other < full.length; other++) {
        for (const [a, b] of [[hole, other], [other, hole]]) { const r = checkJump(board, full, a, b); assert.equal(r.ok, false); }
      }
      assert.equal(jumpsFrom(board, full, hole).length, 0);
    }
    // No jump of a full-but-one board ever touches an off-board cell.
    for (let empty = 0; empty < full.length; empty++) {
      if (full[empty] === -1) continue; const cells = full.slice(); cells[empty] = 0;
      for (const j of legalJumps(board, cells)) for (const cell of [j.from, j.over, j.to]) assert.notEqual(full[cell], -1);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// AC1 jump legality, against the independent oracle
// ---------------------------------------------------------------------------------------------------------------
test('legalJumps equals the independent 2D oracle on 3000 random cross5 and 1500 random cross7 positions', () => {
  for (const [board, runs] of [[BOARDS.cross5, 3000], [BOARDS.cross7, 1500]]) {
    for (let n = 0; n < runs; n++) {
      const cells = randomPegs(board, 0.1 + random() * 0.8);
      assert.deepEqual([...engineJumps(board, cells)].sort(), [...oracleJumps(toGrid(cells, board.width))].sort());
    }
  }
});
test('small exhaustive: every 1..3 peg placement on cross5 matches the oracle', () => {
  const idx = []; for (let i = 0; i < 25; i++) if (!CROSS5_HOLES.includes(i)) idx.push(i);
  const check = pegs => { const cells = cellsFromPegs(BOARDS.cross5, pegs); assert.deepEqual([...engineJumps(BOARDS.cross5, cells)].sort(), [...oracleJumps(toGrid(cells, 5))].sort()); };
  for (const a of idx) { check([a]); for (const b of idx) if (b > a) { check([a, b]); for (const c of idx) if (c > b) check([a, b, c]); } }
});
test('tryJump over all 625 (from,to) pairs: ok exactly for oracle jumps; otherwise state unchanged with a reason', () => {
  const reasons = new Set();
  for (let n = 0; n < 150; n++) {
    const base = running(1 + (n % 10)), cells = randomPegs(BOARDS.cross5, 0.2 + random() * 0.7), game = { ...base, cells, remaining: countPegs(cells), history: [], selected: null };
    const legal = engineJumps(BOARDS.cross5, cells), snapshot = structuredClone(game);
    for (let from = 0; from < 25; from++) for (let to = 0; to < 25; to++) {
      const result = tryJump(game, from, to), name = `${Math.floor(from / 5)},${from % 5}>${Math.floor(to / 5)},${to % 5}`;
      assert.equal(result.ok, legal.has(name), name);
      if (result.ok) {
        const after = result.game; assert.equal(countPegs(after.cells), countPegs(cells) - 1);
        assert.equal(after.cells[from], 0); assert.equal(after.cells[(from + to) / 2], 0); assert.equal(after.cells[to], 1);
        for (let i = 0; i < 25; i++) if (![from, to, (from + to) / 2].includes(i)) assert.equal(after.cells[i], cells[i]);
      } else { assert.equal(result.game, game); assert.ok(['phase', 'no-peg', 'bad-geometry', 'off-board', 'no-middle', 'occupied'].includes(result.reason)); reasons.add(result.reason); }
    }
    assert.deepEqual(game, snapshot);
  }
  assert.deepEqual([...reasons].sort(), ['bad-geometry', 'no-middle', 'no-peg', 'occupied', 'off-board']);
});
test('named illegal jumps: diagonal, 1 cell, 3 cells, 4 cells, off-grid, NaN, same cell, empty start, empty middle, occupied target, corner target', () => {
  const g = { ...running(1), cells: cellsFromPegs(BOARDS.cross5, [6, 7, 8, 11, 12, 13]), remaining: 6 };
  const expectations = [
    [6, 12, 'bad-geometry'], [6, 7, 'bad-geometry'], [6, 9, 'bad-geometry'], [6, 6, 'bad-geometry'], [6, 18, 'bad-geometry'],
    [-1, 8, 'off-board'], [6, 25, 'off-board'], [6, NaN, 'off-board'], [6, 1.5, 'off-board'], [6, undefined, 'off-board'],
    [1, 11, 'no-peg'], [9, 7, 'no-peg'], [16, 6, 'no-peg'], [6, 8, 'occupied'], [8, 6, 'occupied'], [2, 0, 'off-board'], [10, 12, 'no-peg'],
  ];
  for (const [from, to, reason] of expectations) { const r = tryJump(g, from, to); assert.deepEqual([r.ok, r.reason], [false, reason], `${from}>${to}`); assert.equal(r.game, g); }
  assert.equal(tryJump(g, 8, 6).reason, 'occupied');
  const gap = { ...g, cells: cellsFromPegs(BOARDS.cross5, [6, 8]), remaining: 2 };
  assert.deepEqual([tryJump(gap, 6, 8).ok, tryJump(gap, 6, 8).reason], [false, 'no-middle']);
  // corner cell as the middle/target is off-board: row0 col1 -> row0 col... use cross5 pegs at 1 and 3 with corners 0/4
  const edge = { ...g, cells: cellsFromPegs(BOARDS.cross5, [2, 1]), remaining: 2 };
  assert.deepEqual(tryJump(edge, 2, 0).reason, 'off-board'); assert.equal(tryJump(edge, 2, 0).ok, false);
  assert.equal(tryJump({ ...g, phase: 'paused' }, 6, 8).reason, 'phase');
});
test('a legal jump removes exactly the jumped peg; pegs only go down by one', () => {
  const g = running(1), r = tryJump(g, 12, 10);
  assert.equal(r.ok, true); assert.deepEqual(r.game.history, [{ from: 12, over: 11, to: 10 }]); assert.equal(r.game.remaining, 3); assert.equal(r.game.cells[11], 0);
  assert.equal(g.remaining, 4); assert.equal(g.cells[12], 1); assert.equal(g.history.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// AC3 stage data
// ---------------------------------------------------------------------------------------------------------------
test('ten frozen stages with the specified tiers and peg counts', () => {
  assert.equal(STAGES.length, 10); assert.deepEqual(STAGES.map(s => s.count), [4, 5, 6, 7, 8, 9, 10, 12, 14, 16]);
  assert.deepEqual(STAGES.map(s => s.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Object.isFrozen(STAGES) && STAGES.every(s => Object.isFrozen(s) && Object.isFrozen(s.pegs) && Object.isFrozen(s.witness)));
  const ranges = { early: [4, 6], mid: [7, 10], late: [11, 16] };
  STAGES.forEach(s => {
    assert.equal(s.board, 'cross5'); assert.equal(s.tier, s.id <= 3 ? 'early' : s.id <= 7 ? 'mid' : 'late');
    assert.ok(s.count >= ranges[s.tier][0] && s.count <= ranges[s.tier][1]);
  });
});
const forms = new Set();
for (const stage of STAGES) {
  test(`stage ${stage.id}: data valid, witness replays through the engine, independently solvable, not trivially won/stuck`, () => {
    assert.equal(stage.count, stage.pegs.length); assert.equal(new Set(stage.pegs).size, stage.pegs.length);
    assert.deepEqual(stage.pegs, [...stage.pegs].sort((a, b) => a - b));
    assert.ok(stage.pegs.every(p => Number.isInteger(p) && p >= 0 && p < 25 && !CROSS5_HOLES.includes(p)));
    const start = cellsFromPegs(BOARDS.cross5, stage.pegs);
    assert.ok(stage.count >= 2); assert.ok(legalJumps(BOARDS.cross5, start).length >= 1); assert.equal(isWon(start), false); assert.equal(isStuck(BOARDS.cross5, start), false);
    assert.equal(stage.witness.length, stage.count - 1);
    // witness replay with the engine's own tryJump
    let game = running(stage.id), last;
    for (const [from, to] of stage.witness) { const before = game.remaining; last = tryJump(game, from, to); assert.equal(last.ok, true, `${from}>${to}`); game = last.game; assert.equal(game.remaining, before - 1); }
    assert.equal(game.phase, 'result'); assert.equal(game.result.outcome, 'win'); assert.equal(game.remaining, 1);
    // independent solver
    assert.equal(solver5.solvable(stageGrid(stage)), true);
    const key = canonical(stage.pegs, 5); assert.equal(forms.has(key), false, 'symmetric duplicate'); forms.add(key);
  });
}
test('solver self-check: a deliberately broken layout is reported unsolvable', () => {
  assert.equal(solver5.solvable(toGrid(cellsFromPegs(BOARDS.cross5, [6, 18]), 5)), false); // isolated pegs
  assert.equal(solver5.solvable(toGrid(cellsFromPegs(BOARDS.cross5, [6, 7, 18]), 5)), false); // third peg unreachable
  assert.equal(solver5.solvable(toGrid(cellsFromPegs(BOARDS.cross5, [6, 7]), 5)), true);
});
test('every stage has reachable dead ends (random play does not always win) and reachable wins', () => {
  for (const stage of STAGES) {
    const seen = new Set(), stack = [stageGrid(stage)]; let stuck = false, win = false;
    while (stack.length) {
      const grid = stack.pop(), key = grid.map(r => r.join('')).join('/'); if (seen.has(key)) continue; seen.add(key);
      const n = solver5.count(grid), moves = solver5.moves(grid);
      if (n === 1) win = true; else if (moves.length === 0) stuck = true;
      for (const m of moves) stack.push(solver5.apply(grid, m));
    }
    assert.ok(stuck && win, `stage ${stage.id}`);
  }
});
test('stages are independent: no stage layout equals another after any of the 8 symmetries (checked above) and none equals a previous winning layout', () => {
  assert.equal(forms.size, 10);
  for (let i = 1; i < 10; i++) assert.notDeepEqual(STAGES[i].pegs, [STAGES[i - 1].witness.at(-1)[1]]);
});

// ---------------------------------------------------------------------------------------------------------------
// AC4 selection table
// ---------------------------------------------------------------------------------------------------------------
test('selection table: select, targets, deselect, replace, jump, hole-first, non-target, no-targets, off-board', () => {
  let g = running(1); // pegs 5,11,12,16
  let r = select(g, 10); assert.equal(r.kind, 'pick-first'); assert.equal(r.game, g);
  r = select(g, 5); assert.equal(r.kind, 'select'); assert.equal(r.noTargets, true); g = r.game; assert.equal(g.selected, 5); assert.deepEqual(targetsOf(g), []);
  r = select(g, 5); assert.equal(r.kind, 'deselect'); assert.equal(r.game.selected, null);
  r = select(g, 12); assert.equal(r.kind, 'replace'); assert.equal(r.noTargets, false); g = r.game; assert.deepEqual(targetsOf(g).map(t => [t.to, t.over]).sort(), [[10, 11], [22, 17]].filter(([to, over]) => g.cells[to] === 0 && g.cells[over] === 1).sort());
  const targets = targetsOf(g); assert.deepEqual(targets, [{ to: 10, over: 11 }]);
  r = select(g, 3); assert.equal(r.kind, 'not-target'); assert.equal(r.game, g); assert.equal(r.game.selected, 12);
  for (const off of [0, 4, 20, 24, -1, 25, NaN]) { r = select(g, off); assert.equal(r.kind, 'ignored'); assert.equal(r.game, g); }
  r = select(g, 10); assert.equal(r.kind, 'jump'); assert.equal(r.game.selected, null); assert.equal(r.game.remaining, 3); assert.equal(r.game.jumps, 1);
});
test('select/tryJump/undo/deselect ignore every non-playing phase', () => {
  const ready = createGame(1), paused = pauseGame(running(1), 'manual');
  const won = playPath(running(1), STAGES[0].witness);
  for (const g of [ready, paused, won]) { assert.equal(select(g, 12).kind, 'ignored'); assert.equal(select(g, 12).game, g); assert.equal(tryJump(g, 12, 10).ok, false); assert.equal(deselect(g), g); }
  assert.equal(undo(ready), ready); assert.equal(undo(paused), paused);
});

// ---------------------------------------------------------------------------------------------------------------
// AC5 undo
// ---------------------------------------------------------------------------------------------------------------
test('undo N times restores the start layout; extra undo is a no-op; undoCount counts valid undos only; selection cleared', () => {
  for (const stage of STAGES) {
    let g = running(stage.id); const start = g.cells.slice();
    g = playPath(g, stage.witness.slice(0, -1)); assert.equal(g.phase, 'playing'); g = select(g, stage.witness.at(-1)[0]).game; assert.ok(g.selected !== null);
    const n = stage.witness.length - 1;
    for (let i = 1; i <= n; i++) { g = undo(g); assert.equal(g.undoCount, i); assert.equal(g.selected, null); assert.equal(g.history.length, n - i); }
    assert.deepEqual(g.cells, start); assert.equal(g.remaining, stage.count);
    const again = undo(g); assert.equal(again, g); assert.equal(again.undoCount, n);
    assert.equal(g.jumps, n, 'jumps counts every jump made this round, even undone ones');
  }
});
test('restart resets history, undoCount, selection and starts a new round', () => {
  let g = playPath(running(2), STAGES[1].witness.slice(0, 2)); g = undo(g); g = select(g, 12).game;
  const r = restart(g); assert.equal(r.phase, 'playing'); assert.equal(r.undoCount, 0); assert.equal(r.history.length, 0); assert.equal(r.selected, null); assert.equal(r.jumps, 0);
  assert.equal(r.round, g.round + 1); assert.ok(r.token > g.token); assert.deepEqual(r.cells, createGame(2).cells);
  assert.equal(restart(createGame(1)).phase, 'ready'); // restart is meaningless in ready
});
test('undo count is capped at 1,000,000 without blocking the undo', () => {
  let g = playPath(running(1), [STAGES[0].witness[0]]); g = { ...g, undoCount: COUNT_CAP };
  const u = undo(g); assert.equal(u.undoCount, COUNT_CAP); assert.equal(u.history.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// AC6 stuck / win
// ---------------------------------------------------------------------------------------------------------------
test('isWon / isStuck definitions', () => {
  const b = BOARDS.cross5;
  assert.equal(isWon(cellsFromPegs(b, [12])), true); assert.equal(isStuck(b, cellsFromPegs(b, [12])), false);
  assert.equal(isStuck(b, cellsFromPegs(b, [6, 18])), true); assert.equal(isWon(cellsFromPegs(b, [6, 18])), false);
  assert.equal(isStuck(b, cellsFromPegs(b, [6, 7])), false); assert.equal(isStuck(b, emptyCells(b)), false);
});
const findStuck = (game, stageId = 1) => { // depth-first search for any stuck terminal reachable by legal jumps
  if (game.phase === 'result') return game.result.outcome === 'stuck' ? game : null;
  for (const j of legalJumps(BOARDS.cross5, game.cells)) { const found = findStuck(tryJump(game, j.from, j.to).game, stageId); if (found) return found; }
  return null;
};
test('stage 1: a dead-end line ends in a stuck result; input is rejected; undo continues; a win allows no undo', () => {
  const stuck = findStuck(running(1)); assert.ok(stuck, 'stage 1 has a stuck line');
  assert.equal(stuck.phase, 'result'); assert.equal(stuck.result.outcome, 'stuck'); assert.ok(stuck.remaining > 1);
  assert.deepEqual([stuck.result.stage, stuck.result.remaining, stuck.selected], [1, stuck.remaining, null]);
  assert.equal(legalJumps(BOARDS.cross5, stuck.cells).length, 0);
  assert.equal(select(stuck, 12).kind, 'ignored'); assert.equal(tryJump(stuck, 12, 10).reason, 'phase');
  const back = undo(stuck); assert.equal(back.phase, 'playing'); assert.equal(back.result, null); assert.equal(back.undoCount, 1); assert.equal(back.remaining, stuck.remaining + 1);
  assert.ok(legalJumps(BOARDS.cross5, back.cells).length >= 1);
  const won = playPath(running(1), STAGES[0].witness); assert.equal(won.result.outcome, 'win'); assert.equal(won.remaining, 1);
  assert.equal(undo(won), won); assert.equal(won.undoCount, 0);
});
test('stuck -> undo -> stuck repeats cleanly: round and token unchanged, counters consistent', () => {
  let g = findStuck(running(1)); const round = g.round, token = g.token;
  for (let i = 1; i <= 3; i++) {
    g = undo(g); assert.equal(g.phase, 'playing'); const last = legalJumps(BOARDS.cross5, g.cells);
    const redo = last.map(j => tryJump(g, j.from, j.to).game).find(x => x.phase === 'result' && x.result.outcome === 'stuck');
    assert.ok(redo); g = redo; assert.equal(g.undoCount, i); assert.equal(g.round, round); assert.equal(g.token, token);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// AC11 state machine
// ---------------------------------------------------------------------------------------------------------------
test('state machine: ready -> start -> pause(manual) -> protect upgrade -> resume; transitions clear selection', () => {
  const ready = createGame(3); assert.equal(ready.phase, 'ready'); assert.equal(pauseGame(ready), ready); assert.equal(resumeGame(ready), ready);
  let g = startGame(ready); assert.equal(g.phase, 'playing'); assert.equal(g.round, 1); assert.ok(g.token > ready.token);
  g = select(g, 12).game; assert.equal(g.selected, 12);
  const manual = pauseGame(g, 'manual'); assert.deepEqual([manual.phase, manual.pauseCause, manual.selected], ['paused', 'manual', null]);
  const upgraded = pauseGame(manual, 'protect'); assert.equal(upgraded.pauseCause, 'protect'); assert.equal(pauseGame(upgraded, 'manual'), upgraded);
  assert.equal(pauseGame(manual, 'manual'), manual);
  const back = resumeGame(upgraded); assert.deepEqual([back.phase, back.pauseCause], ['playing', null]); assert.deepEqual(back.cells, g.cells);
  assert.equal(pauseGame(startGame(createGame(1), 1), 'protect').pauseCause, 'protect');
  const result = playPath(running(1), STAGES[0].witness); assert.equal(pauseGame(result, 'protect'), result); assert.equal(resumeGame(result), result);
});
test('selectStage only works in ready and bumps token, not round; startGame uses the requested stage', () => {
  const ready = createGame(1); const s = selectStage(ready, 4); assert.equal(s.stage, 4); assert.equal(s.round, ready.round); assert.ok(s.token > ready.token); assert.equal(s.remaining, 7);
  assert.equal(selectStage(ready, 1), ready); assert.equal(selectStage(running(1), 3).stage, 1);
  assert.equal(startGame(ready, 9).stage, 9); assert.equal(startGame(ready, 99).stage, 1); assert.equal(createGame('x').stage, 1);
});

// ---------------------------------------------------------------------------------------------------------------
// Reference-model random play: engine vs. an independent 2D model, step by step
// ---------------------------------------------------------------------------------------------------------------
test('random action sequences (select/undo/restart) match the independent reference model on every step', () => {
  for (const stage of STAGES) {
    for (let run = 0; run < 25; run++) {
      let game = running(stage.id);
      let model = { grid: stageGrid(stage), sel: null, hist: [], undos: 0, over: null };
      const reset = () => { model = { grid: stageGrid(stage), sel: null, hist: [], undos: 0, over: null }; };
      for (let step = 0; step < 60; step++) {
        const roll = random();
        if (roll < 0.1) { game = game.phase === 'result' && game.result.outcome === 'win' ? game : undo(game); const can = model.hist.length > 0 && !(model.over === 'win'); if (can) { const [r, c, tr, tc] = model.hist.pop(); model.grid[tr][tc] = 0; model.grid[r][c] = 1; model.grid[(r + tr) / 2][(c + tc) / 2] = 1; model.undos++; model.sel = null; model.over = null; } }
        else if (roll < 0.13) { game = restart(game); reset(); }
        else {
          const i = Math.floor(random() * 25), r = Math.floor(i / 5), c = i % 5, v = model.grid[r][c];
          game = select(game, i).game;
          if (model.over === null && v !== -1) {
            if (v === 1) model.sel = model.sel === i ? null : i;
            else if (model.sel !== null) {
              const sr = Math.floor(model.sel / 5), sc = model.sel % 5;
              if (oracleJumps(model.grid).has(`${sr},${sc}>${r},${c}`)) { model.grid[sr][sc] = 0; model.grid[(sr + r) / 2][(sc + c) / 2] = 0; model.grid[r][c] = 1; model.hist.push([sr, sc, r, c]); model.sel = null; }
            }
            const n = model.grid.flat().filter(x => x === 1).length;
            if (n === 1) model.over = 'win'; else if (oracleJumps(model.grid).size === 0) model.over = 'stuck';
          }
        }
        assert.deepEqual(toGrid(game.cells, 5), model.grid);
        assert.equal(game.selected, model.sel); assert.equal(game.history.length, model.hist.length); assert.equal(game.undoCount, model.undos);
        assert.equal(game.remaining, model.grid.flat().filter(x => x === 1).length);
        assert.equal(game.phase === 'result' ? game.result.outcome : null, model.over);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// AC9 / AC10 save schema
// ---------------------------------------------------------------------------------------------------------------
const makeStorage = (initial, opts = {}) => {
  const store = new Map(Object.entries(initial ?? {})); const log = { gets: 0, sets: [] };
  return { store, log, api: () => { if (opts.getter) throw new Error('getter'); return { getItem(k) { log.gets++; if (opts.get) throw new Error('get'); return store.has(k) ? store.get(k) : null; }, setItem(k, v) { log.sets.push(k); if (opts.set) throw new DOMException('quota', 'QuotaExceededError'); store.set(k, v); } }; } };
};
const valid = () => ({ version: 1, settings: { theme: 'wood', muted: false }, records: { completed: 3, unlocked: 3, stages: [{ bestRemaining: 1, clearCount: 2, bestUndos: 4 }, { bestRemaining: 1, clearCount: 1, bestUndos: 0 }, ...Array.from({ length: 8 }, () => ({ bestRemaining: null, clearCount: 0, bestUndos: null }))].slice(0, 10) } });
test('defaults: version 1, river, muted, 10 empty stages, unlocked 1; key and themes', () => {
  const d = defaultRecord(); assert.equal(STORAGE_KEY, 'simplegames.pebble-solo.v1'); assert.deepEqual(THEMES, ['river', 'glass', 'wood']);
  assert.deepEqual([d.version, d.settings, d.records.completed, d.records.unlocked, d.records.stages.length], [1, { theme: 'river', muted: true }, 0, 1, 10]);
  assert.deepEqual(recoverRecord(d), { record: d, repaired: false });
});
test('valid stored data survives recovery untouched (including derived values)', () => { const v = valid(); const r = recoverRecord(v); assert.deepEqual(r.record, v); assert.equal(r.repaired, false); });
test('non-object / wrong version inputs give full defaults', () => {
  for (const bad of [null, undefined, [], 'x', 5, true, {}, { version: 0 }, { version: 2 }, { version: '1' }, { settings: {} }]) { const r = recoverRecord(bad); assert.deepEqual(r.record, defaultRecord()); assert.equal(r.repaired, true); }
});
test('bad settings only reset the settings and keep valid records', () => {
  for (const settings of [null, { theme: 'neon', muted: false }, { theme: 5, muted: false }, { theme: 'glass', muted: 'no' }, { theme: 'glass' }, [], 7]) {
    const v = valid(); v.settings = settings; const r = recoverRecord(v);
    assert.deepEqual(r.record.records, valid().records); assert.equal(r.repaired, true);
    assert.ok(THEMES.includes(r.record.settings.theme)); assert.equal(typeof r.record.settings.muted, 'boolean');
  }
  const v = valid(); v.settings = { theme: 'glass', muted: 'no' }; assert.deepEqual(recoverRecord(v).record.settings, { theme: 'glass', muted: true });
});
test('each broken stage field resets only that stage', () => {
  const broken = [
    { bestRemaining: 0, clearCount: 0, bestUndos: null }, { bestRemaining: -1, clearCount: 0, bestUndos: null }, { bestRemaining: 1.5, clearCount: 0, bestUndos: null },
    { bestRemaining: NaN, clearCount: 0, bestUndos: null }, { bestRemaining: '2', clearCount: 0, bestUndos: null }, { bestRemaining: 5, clearCount: 0, bestUndos: null /* >= count(4)?? stage1 count 4 */ },
    { bestRemaining: null, clearCount: -1, bestUndos: null }, { bestRemaining: null, clearCount: 1.5, bestUndos: null }, { bestRemaining: 1, clearCount: CAP + 1, bestUndos: 0 }, { bestRemaining: 1, clearCount: Infinity, bestUndos: 0 },
    { bestRemaining: 1, clearCount: Number.MAX_SAFE_INTEGER + 2, bestUndos: 0 }, { bestRemaining: null, clearCount: 0, bestUndos: -1 }, { bestRemaining: null, clearCount: 0, bestUndos: 1.5 }, { bestRemaining: 1, clearCount: 1, bestUndos: '0' },
    { bestRemaining: 2, clearCount: 1, bestUndos: 0 }, { bestRemaining: null, clearCount: 1, bestUndos: 0 }, { bestRemaining: 1, clearCount: 1, bestUndos: null }, { bestRemaining: null, clearCount: 0, bestUndos: 3 },
    { bestRemaining: 1, clearCount: 0, bestUndos: null }, { bestRemaining: 1, clearCount: 0, bestUndos: 2 }, null, [], 'x', 4, {}, { clearCount: 0 }, { bestRemaining: null, clearCount: 0, bestUndos: CAP + 1 },
  ];
  for (const item of broken) {
    const v = valid(); v.records.stages[0] = item; const r = recoverRecord(v);
    assert.deepEqual(r.record.records.stages[0], { bestRemaining: null, clearCount: 0, bestUndos: null }, JSON.stringify(item));
    assert.deepEqual(r.record.records.stages[1], valid().records.stages[1]); assert.equal(r.repaired, true);
    assert.equal(r.record.records.completed, 1); assert.equal(r.record.records.unlocked, 3);
  }
});
test('stage count bound: bestRemaining must be < count; stage 1 (4 pegs) allows 2..3 only', () => {
  assert.equal(validStage({ bestRemaining: 3, clearCount: 0, bestUndos: null }, 0), true); assert.equal(validStage({ bestRemaining: 4, clearCount: 0, bestUndos: null }, 0), false);
  assert.equal(validStage({ bestRemaining: 15, clearCount: 0, bestUndos: null }, 9), true); assert.equal(validStage({ bestRemaining: 16, clearCount: 0, bestUndos: null }, 9), false);
  assert.equal(validStage({ bestRemaining: 1, clearCount: 0, bestUndos: null }, 9), false); assert.equal(validStage({ bestRemaining: 1, clearCount: 1, bestUndos: 0 }, 99), false);
});
test('stages array of wrong length / type is handled per index, extra entries ignored, unknown keys dropped', () => {
  for (const stages of [[], valid().records.stages.slice(0, 2), valid().records.stages.slice(0, 9), {}, null, 'x']) {
    const v = valid(); v.records.stages = stages; const r = recoverRecord(v); assert.equal(r.record.records.stages.length, 10); assert.equal(r.repaired, true);
    if (Array.isArray(stages) && stages.length >= 2) assert.deepEqual(r.record.records.stages.slice(0, 2), valid().records.stages.slice(0, 2));
  }
  const v = valid(); v.records.stages.push({ bestRemaining: 1, clearCount: 1, bestUndos: 0 }); v.extra = 1; v.records.stages[0].junk = 1; const r = recoverRecord(v);
  assert.equal(r.record.records.stages.length, 10); assert.equal('extra' in r.record, false); assert.equal('junk' in r.record.records.stages[0], false);
  const w = valid(); w.records = null; assert.deepEqual(recoverRecord(w).record.records, defaultRecord().records);
});
test('derived completed/unlocked are recomputed and never trusted', () => {
  const v = valid(); v.records.completed = 999; v.records.unlocked = 10; const r = recoverRecord(v); assert.deepEqual([r.record.records.completed, r.record.records.unlocked], [3, 3]); assert.equal(r.repaired, true);
  const stages = defaultRecord().records.stages; stages[9] = { bestRemaining: 1, clearCount: 1, bestUndos: 0 }; assert.deepEqual(derive(stages), { completed: 1, unlocked: 10 });
  assert.deepEqual(derive(defaultRecord().records.stages), { completed: 0, unlocked: 1 });
  const big = defaultRecord(); big.records.stages[0] = { bestRemaining: 1, clearCount: CAP, bestUndos: 0 }; big.records.stages[1] = { bestRemaining: 1, clearCount: 5, bestUndos: 0 }; big.records.completed = CAP + 5;
  const r2 = recoverRecord(big); assert.ok(r2.record.records.completed <= CAP); assert.equal(r2.repaired, true);
});
test('loadRecord: missing key, corrupt JSON, valid data and exceptions; reading never writes', () => {
  let s = makeStorage(); let r = loadRecord(s.api); assert.deepEqual([r.readOk, r.repaired, r.record], [true, false, defaultRecord()]); assert.equal(s.log.sets.length, 0);
  for (const raw of ['{', 'null', '[]', '"x"', '5', 'true', '{"version":2}', '']) { s = makeStorage({ [STORAGE_KEY]: raw }); r = loadRecord(s.api); assert.deepEqual(r.record, defaultRecord()); assert.equal(r.readOk, true); assert.equal(r.repaired, true); assert.equal(s.log.sets.length, 0); assert.equal(s.store.get(STORAGE_KEY), raw); }
  s = makeStorage({ [STORAGE_KEY]: JSON.stringify(valid()), other: 'keep' }); r = loadRecord(s.api); assert.deepEqual(r.record, valid()); assert.equal(s.log.sets.length, 0);
  for (const opts of [{ getter: true }, { get: true }]) { s = makeStorage({}, opts); r = loadRecord(s.api); assert.deepEqual([r.readOk, r.record], [false, defaultRecord()]); assert.equal(s.log.sets.length, 0); }
});
test('saveRecord writes only the pebble-solo key; setItem failure returns failed; invalid records are refused', () => {
  let s = makeStorage({ 'simplegames.other.v1': 'keep' }); assert.deepEqual(saveRecord(valid(), s.api), { ok: true, status: 'ok' });
  assert.deepEqual(s.log.sets, [STORAGE_KEY]); assert.equal(s.store.get('simplegames.other.v1'), 'keep'); assert.deepEqual(JSON.parse(s.store.get(STORAGE_KEY)), valid());
  s = makeStorage({}, { set: true }); assert.deepEqual(saveRecord(valid(), s.api), { ok: false, status: 'failed' });
  s = makeStorage({}, { getter: true }); assert.equal(saveRecord(valid(), s.api).ok, false);
  s = makeStorage(); const bad = valid(); bad.records.stages[0].clearCount = -5; assert.equal(saveRecord(bad, s.api).ok, false); assert.equal(s.log.sets.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// settlement
// ---------------------------------------------------------------------------------------------------------------
const win = (stage, undoCount) => ({ outcome: 'win', remaining: 1, undoCount, stage });
const stuck = (stage, remaining) => ({ outcome: 'stuck', remaining, undoCount: 0, stage });
test('first win: clearCount 1, bestRemaining 1, bestUndos set, completed+1, next stage unlocked; input record untouched', () => {
  const base = defaultRecord(), frozen = structuredClone(base), r = settleWin(base, win(1, 2));
  assert.deepEqual([r.changed, r.status], [true, 'settled']); assert.deepEqual(r.record.records.stages[0], { bestRemaining: 1, clearCount: 1, bestUndos: 2 });
  assert.deepEqual([r.record.records.completed, r.record.records.unlocked], [1, 2]); assert.deepEqual(base, frozen); assert.equal(recoverRecord(r.record).repaired, false);
});
test('repeat win: clearCount grows, bestUndos is the minimum; stage 10 keeps unlocked at 10', () => {
  let r = settleWin(defaultRecord(), win(3, 5)).record; r = settleWin(r, win(3, 2)).record; r = settleWin(r, win(3, 9)).record;
  assert.deepEqual(r.records.stages[2], { bestRemaining: 1, clearCount: 3, bestUndos: 2 }); assert.equal(r.records.completed, 3); assert.equal(r.records.unlocked, 4);
  const last = settleWin(defaultRecord(), win(10, 0)).record; assert.equal(last.records.unlocked, 10); assert.equal(settleWin(last, win(10, 1)).record.records.unlocked, 10);
});
test('stuck settlement: improvement only; equal/worse/cleared stage give no change and no clearCount', () => {
  let r = settleStuck(defaultRecord(), stuck(5, 4)); assert.deepEqual([r.changed, r.record.records.stages[4].bestRemaining, r.record.records.stages[4].clearCount, r.record.records.completed, r.record.records.unlocked], [true, 4, 0, 0, 1]);
  const same = settleStuck(r.record, stuck(5, 4)); assert.deepEqual([same.changed, same.record], [false, r.record]);
  const worse = settleStuck(r.record, stuck(5, 6)); assert.equal(worse.changed, false);
  const better = settleStuck(r.record, stuck(5, 2)); assert.equal(better.changed, true); assert.equal(better.record.records.stages[4].bestRemaining, 2);
  const cleared = settleWin(defaultRecord(), win(5, 0)).record; assert.equal(settleStuck(cleared, stuck(5, 3)).changed, false);
  assert.equal(recoverRecord(better.record).repaired, false);
  for (const badResult of [stuck(5, 1), stuck(5, 8), stuck(0, 3), stuck(11, 3), { outcome: 'win', stage: 5, remaining: 3 }, null]) assert.equal(settleStuck(defaultRecord(), badResult).changed, false);
});
test('win then stuck then win sequence never double-counts', () => {
  let rec = defaultRecord(); rec = settleStuck(rec, stuck(1, 3)).record; assert.equal(rec.records.completed, 0);
  rec = settleWin(rec, win(1, 1)).record; assert.deepEqual(rec.records.stages[0], { bestRemaining: 1, clearCount: 1, bestUndos: 1 }); assert.equal(recoverRecord(rec).repaired, false);
  assert.equal(settleStuck(rec, stuck(1, 2)).changed, false);
});
test('cap: win settlement is all-or-nothing at 1,000,000 for clearCount, completed and bestUndos; undoCount cap value accepted', () => {
  const full = defaultRecord(); full.records.stages[0] = { bestRemaining: 1, clearCount: CAP, bestUndos: 3 }; Object.assign(full.records, derive(full.records.stages));
  const r = settleWin(full, win(1, 0)); assert.deepEqual([r.changed, r.status, r.record === full], [false, 'cap', true]);
  const nearTotal = defaultRecord(); nearTotal.records.stages[0] = { bestRemaining: 1, clearCount: CAP - 1, bestUndos: 3 }; nearTotal.records.stages[1] = { bestRemaining: 1, clearCount: 1, bestUndos: 0 }; Object.assign(nearTotal.records, derive(nearTotal.records.stages));
  assert.equal(nearTotal.records.completed, CAP); const r2 = settleWin(nearTotal, win(3, 0)); assert.deepEqual([r2.changed, r2.status], [false, 'cap']); assert.deepEqual(r2.record, nearTotal);
  const ok = settleWin(defaultRecord(), win(1, CAP)); assert.equal(ok.changed, true); assert.equal(ok.record.records.stages[0].bestUndos, CAP);
  assert.equal(settleWin(defaultRecord(), win(1, CAP + 1)).changed, false); assert.equal(settleWin(defaultRecord(), win(1, -1)).changed, false); assert.equal(settleWin(defaultRecord(), { ...win(1, 0), outcome: 'stuck' }).changed, false);
});
test('engine result objects feed the settlement directly', () => {
  const won = playPath(running(1), STAGES[0].witness); const s = settleWin(defaultRecord(), won.result); assert.equal(s.changed, true); assert.equal(s.record.records.unlocked, 2);
});

// ---------------------------------------------------------------------------------------------------------------
// Source guards (supplementary only; behavior is proven in the browser run)
// ---------------------------------------------------------------------------------------------------------------
const read = name => fs.readFileSync(new URL(`../../public/games/19-pegs/${name}`, import.meta.url), 'utf8');
test('source guards: pure modules have no DOM/timers; main has no RAF, no permanent click flag and no activeElement guard on cell clicks', () => {
  for (const name of ['engine.mjs', 'save.mjs']) { const s = read(name); assert.doesNotMatch(s, /\b(document|window\.(?!localStorage)|setTimeout|setInterval|requestAnimationFrame|Math\.random)\b/, name); }
  const main = read('main.mjs');
  assert.doesNotMatch(main, /requestAnimationFrame|setInterval|setTimeout|Math\.random/);
  assert.doesNotMatch(main, /suppressClick\s*=\s*(true|false)/); assert.match(main, /suppressUntil/); assert.match(main, /SUPPRESS_MS\s*=\s*300/);
  assert.doesNotMatch(main, /activeElement\s*===\s*b\b/); assert.doesNotMatch(main, /\.click\(\)/);
  assert.match(main, /configurable: false, writable: false/); assert.match(main, /__g030Snapshot/);
  assert.doesNotMatch(read('index.html'), /style="|https?:\/\//); assert.doesNotMatch(read('styles.css'), /https?:\/\/|@import|url\(/);
});

// G030-FIX19 D1: the result note must follow later successful/failed writes (behavior proven in the browser run).
test('source guard D1: persist() reconciles the result save note with the latest write (failed -> saved on recovery, saved -> failed on a new failure)', () => {
  const main = read('main.mjs'); const m = main.match(/function persist\(\) \{([\s\S]*?)\n\}/); assert.ok(m, 'persist() found');
  const body = m[1];
  assert.match(body, /saveRecord\(record\)\.ok\)\s*\{[^}]*if \(saveNote === 'failed'\) saveNote = 'saved'/);
  assert.match(body, /saveStatus = 'failed'[^\n]*if \(saveNote === 'saved'\) saveNote = 'failed'/);
  assert.doesNotMatch(body, /saveNote = '(none|cap|unavailable)'/);
  assert.match(main, /text\(\$\('result-save'\), SAVE_NOTES\[saveNote\]\)/);
});
