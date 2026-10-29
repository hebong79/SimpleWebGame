// Original deterministic content. Routes describe BLANK movement, not tile movement.
export const DIRECTIONS = Object.freeze({up: Object.freeze([-1, 0]), down: Object.freeze([1, 0]), left: Object.freeze([0, -1]), right: Object.freeze([0, 1])});
export const OPPOSITE = Object.freeze({up: 'down', down: 'up', left: 'right', right: 'left'});
export const validDirection = value => typeof value === 'string' && Object.hasOwn(DIRECTIONS, value);
export const goalBoard = size => Array.from({length: size * size}, (_, i) => (i + 1) % (size * size));
export function targetIndex(blank, size, direction) {
  if (!validDirection(direction)) return -1;
  const [dr, dc] = DIRECTIONS[direction];
  const r = Math.floor(blank / size) + dr, c = blank % size + dc;
  return r >= 0 && r < size && c >= 0 && c < size ? r * size + c : -1;
}
export const isGoal = board => Array.isArray(board) && [9, 16].includes(board.length) && Array.from(board).every((v, i) => v === (i + 1) % board.length);
export function shuffle(size, steps, seed) {
  if (![3, 4].includes(size) || !Number.isSafeInteger(steps) || steps < 1 || steps > 10000 || !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new RangeError('Invalid shuffle parameters');
  for (let attempt = 0; attempt < 32; attempt++) {
    const finalSeed = (seed + attempt) >>> 0;
    if (!finalSeed) continue;
    let rng = finalSeed, blank = size * size - 1, previous = -1;
    const board = goalBoard(size), route = [];
    for (let n = 0; n < steps; n++) {
      const choices = Object.keys(DIRECTIONS).filter(d => { const t = targetIndex(blank, size, d); return t >= 0 && t !== previous; });
      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0;
      const direction = choices[rng % choices.length], next = targetIndex(blank, size, direction);
      [board[blank], board[next]] = [board[next], board[blank]];
      previous = blank; blank = next; route.push(direction);
    }
    if (!isGoal(board)) return Object.freeze({size, steps, seed: finalSeed, board: Object.freeze(board), route: Object.freeze(route)});
  }
  throw new Error('Could not generate a non-goal puzzle within 32 seeds');
}
const definitions = [
  ['practice-v1', '입문 3×3 · 섞기 8회', 3, 8, 24011],
  ['post-20-v1', '엽서 4×4 · 섞기 20회', 4, 20, 24012],
  ['post-60-v1', '엽서 4×4 · 섞기 60회', 4, 60, 24013],
  ['post-120-v1', '엽서 4×4 · 섞기 120회', 4, 120, 24014],
];
export const PUZZLES = Object.freeze(Object.fromEntries(definitions.map(([id, label, size, steps, seed]) => [id, Object.freeze({id, label, ...shuffle(size, steps, seed)})])));
export const MODE_IDS = Object.freeze(definitions.map(d => d[0]));
export const validMode = value => typeof value === 'string' && Object.hasOwn(PUZZLES, value);
export const DEFAULT_MODE = 'post-20-v1';
