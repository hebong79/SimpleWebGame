import { LEVELS } from './levels.mjs';

export const DIRECTIONS = Object.freeze({ U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] });
const frozen = value => Object.freeze(value);

/** Static terrain never shares a mutable array with moving objects. */
export function parseLevel(definition) {
  const rows = definition.rows;
  if (!Array.isArray(rows) || rows.length < 3 || rows.length > 8) throw new Error('Invalid level height');
  const width = rows[0]?.length;
  if (!Number.isInteger(width) || width < 3 || width > 8 || rows.some(r => typeof r !== 'string' || r.length !== width || /[^# .$@+*]/u.test(r))) throw new Error('Invalid level rectangle');
  const walls = [], goals = [], boxes = [], players = [];
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const cell = y * width + x;
    if ((x === 0 || y === 0 || x === width - 1 || y === rows.length - 1) && tile !== '#') throw new Error('Open boundary');
    if (tile === '#') walls.push(cell);
    if ('.+*'.includes(tile)) goals.push(cell);
    if ('$*'.includes(tile)) boxes.push(cell);
    if ('@+'.includes(tile)) players.push(cell);
  }));
  if (players.length !== 1 || boxes.length < 1 || boxes.length !== goals.length || boxes.every(p => goals.includes(p))) throw new Error('Invalid level objects');
  const walkable = new Set();
  const queue = [players[0]];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (walkable.has(p) || walls.includes(p)) continue;
    walkable.add(p);
    for (const [dx, dy] of Object.values(DIRECTIONS)) {
      const q = p + dy * width + dx;
      if (q >= 0 && q < width * rows.length && !walkable.has(q) && !walls.includes(q)) queue.push(q);
    }
  }
  if ([...goals, ...boxes].some(p => !walkable.has(p))) throw new Error('Disconnected objects');
  return frozen({ id: definition.id, name: definition.name, hint: definition.hint, width, height: rows.length,
    walls: frozen(walls), goals: frozen(goals), initialBoxes: frozen(boxes), initialPlayer: players[0] });
}
export const BOARDS = frozen(LEVELS.map(parseLevel));
const seal = state => frozen({ ...state, boxes: frozen([...state.boxes]), history: frozen([...state.history]) });
export function createGame(level = 1) {
  const board = typeof level === 'number' ? BOARDS[level - 1] : parseLevel(level);
  if (!board) throw new Error('Unknown level');
  return seal({ board, player: board.initialPlayer, boxes: board.initialBoxes, moves: 0, pushes: 0, won: false, history: [] });
}
export function move(state, direction) {
  if (typeof direction !== 'string' || !Object.hasOwn(DIRECTIONS, direction)) return state;
  const delta = DIRECTIONS[direction];
  if (!delta || state.won || state.moves === Number.MAX_SAFE_INTEGER) return state;
  const [dx, dy] = delta;
  const step = dy * state.board.width + dx;
  const target = state.player + step;
  if (state.board.walls.includes(target)) return state;
  const index = state.boxes.indexOf(target);
  const boxes = [...state.boxes];
  if (index !== -1) {
    const beyond = target + step;
    if (state.board.walls.includes(beyond) || boxes.includes(beyond)) return state;
    boxes[index] = beyond;
  }
  const before = frozen({ player: state.player, boxes: state.boxes, moves: state.moves, pushes: state.pushes });
  return seal({ ...state, player: target, boxes, moves: state.moves + 1, pushes: state.pushes + Number(index !== -1),
    won: boxes.every(p => state.board.goals.includes(p)), history: [...state.history, before] });
}
export function undo(state) {
  if (state.won || !state.history.length) return state;
  const before = state.history[state.history.length - 1];
  return seal({ ...state, ...before, history: state.history.slice(0, -1), won: false });
}
export function cornerDeadlocks(state) {
  const { walls, goals, width } = state.board;
  return state.boxes.filter(p => !goals.includes(p) && (walls.includes(p - 1) || walls.includes(p + 1)) && (walls.includes(p - width) || walls.includes(p + width)));
}
/** Clone includes full undo history for exact read-only verification; never a setter. */
export function snapshot(state) { return structuredClone(state); }
