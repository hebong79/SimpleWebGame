export type Board = number[][];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type RNG = () => number;
export interface Position { row: number; col: number }
export interface MoveResult { board: Board; changed: boolean; scoreDelta: number; merges: number; mergedPositions: Position[] }
export interface SpawnResult { board: Board; position: Position; value: 2 | 4 }

export function isTile(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && (value === 0 || (value >= 2 && value === 2 ** Math.round(Math.log2(value))));
}
export function validateBoard(value: unknown): value is Board {
  return Array.isArray(value) && value.length === 4 && [0, 1, 2, 3].every(r => Array.isArray(value[r]) && value[r].length === 4 && [0, 1, 2, 3].every(c => isTile(value[r][c])));
}
function assertBoard(board: unknown): asserts board is Board {
  if (!validateBoard(board)) throw new TypeError('Invalid 4×4 board');
}
export function emptyBoard(): Board { return Array.from({ length: 4 }, () => [0, 0, 0, 0]); }
export function cloneBoard(board: Board): Board { assertBoard(board); return board.map(row => [...row]); }
export function emptyCells(board: Board): Position[] {
  assertBoard(board);
  const cells: Position[] = [];
  board.forEach((row, r) => row.forEach((v, c) => { if (v === 0) cells.push({ row: r, col: c }); }));
  return cells;
}
export function maxTile(board: Board): number { assertBoard(board); return Math.max(...board.flat()); }
export function canMove(board: Board): boolean {
  assertBoard(board);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = board[r][c];
    if (v === 0 || (r < 3 && v === board[r + 1][c]) || (c < 3 && v === board[r][c + 1])) return true;
  }
  return false;
}
function coord(direction: Direction, line: number, index: number): Position {
  switch (direction) {
    case 'left': return { row: line, col: index };
    case 'right': return { row: line, col: 3 - index };
    case 'up': return { row: index, col: line };
    case 'down': return { row: 3 - index, col: line };
  }
}
export function move(board: Board, direction: Direction): MoveResult {
  assertBoard(board);
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new TypeError('Invalid direction');
  const output = emptyBoard();
  const mergedPositions: Position[] = [];
  let scoreDelta = 0;
  for (let line = 0; line < 4; line++) {
    const values: number[] = [];
    for (let i = 0; i < 4; i++) { const p = coord(direction, line, i); if (board[p.row][p.col]) values.push(board[p.row][p.col]); }
    const compressed: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const sum = values[i] * 2;
        if (!Number.isSafeInteger(sum) || !Number.isSafeInteger(scoreDelta + sum)) throw new RangeError('Tile or score overflow');
        mergedPositions.push(coord(direction, line, compressed.length));
        compressed.push(sum); scoreDelta += sum; i++;
      } else compressed.push(values[i]);
    }
    for (let i = 0; i < 4; i++) { const p = coord(direction, line, i); output[p.row][p.col] = compressed[i] ?? 0; }
  }
  return { board: output, changed: output.some((row, r) => row.some((v, c) => v !== board[r][c])), scoreDelta, merges: mergedPositions.length, mergedPositions };
}
function random(rng: RNG): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('RNG must return [0,1)');
  return value;
}
export function spawnTile(board: Board, rng: RNG): SpawnResult {
  const cells = emptyCells(board);
  if (!cells.length) throw new RangeError('Cannot spawn on a full board');
  const position = cells[Math.floor(random(rng) * cells.length)];
  const value = random(rng) < 0.9 ? 2 : 4;
  const output = cloneBoard(board);
  output[position.row][position.col] = value;
  return { board: output, position, value };
}
export function createBoard(rng: RNG): Board { return spawnTile(spawnTile(emptyBoard(), rng).board, rng).board; }
