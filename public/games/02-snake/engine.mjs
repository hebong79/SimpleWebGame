export const SIZE = 20;
export const STORAGE_KEY = 'little-dragon.snake.v1';
export const PARTS = Object.freeze(['head', 'scales', 'tail']);
export const SETS = Object.freeze(['base', 'explorer', 'space', 'strawberry']);
export const VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }), down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }), right: Object.freeze({ x: 1, y: 0 }),
});
const same = (a, b) => a != null && b != null && a.x === b.x && a.y === b.y;
const key = ({ x, y }) => `${x},${y}`;
const inside = ({ x, y }) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const speedFor = eaten => Math.min(10, 5 + Math.floor(Math.max(0, eaten) / 5));

/** Finite candidate enumeration: even a full board cannot loop forever. */
export function spawnFood(snake, direction, eaten, rng = Math.random) {
  const occupied = new Set(snake.map(key));
  const free = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!occupied.has(`${x},${y}`)) free.push({ x, y });
  }
  if (!free.length) return null;
  let candidates = free;
  if (eaten < 3) {
    const head = snake[0], vector = VECTORS[direction];
    // Reachability without crossing the body, plus at least two free exits.
    const reachable = new Set([key(head)]), queue = [head];
    for (let i = 0; i < queue.length; i++) for (const v of Object.values(VECTORS)) {
      const p = { x: queue[i].x + v.x, y: queue[i].y + v.y }, id = key(p);
      if (inside(p) && !occupied.has(id) && !reachable.has(id)) {
        reachable.add(id); queue.push(p);
      }
    }
    const front = free.filter(p => {
      const dx = p.x - head.x, dy = p.y - head.y;
      const forward = dx * vector.x + dy * vector.y;
      const side = Math.abs(dx * vector.y - dy * vector.x);
      const exits = Object.values(VECTORS).filter(v => {
        const next = { x: p.x + v.x, y: p.y + v.y };
        return inside(next) && !occupied.has(key(next));
      }).length;
      return forward >= 2 && forward <= 5 && side <= 2 && exits >= 2 && reachable.has(key(p));
    });
    if (front.length) candidates = front;
  }
  const random = rng();
  const unit = Number.isFinite(random) ? Math.max(0, Math.min(1 - Number.EPSILON, random)) : 0;
  return { ...candidates[Math.floor(unit * candidates.length)] };
}

export function createGame(rng = Math.random) {
  const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  return { snake, direction: 'right', queued: null, food: spawnFood(snake, 'right', 0, rng),
    eaten: 0, score: 0, ticks: 0, status: 'ready', reason: null };
}
export function startGame(rng = Math.random) { return { ...createGame(rng), status: 'playing' }; }
export function queueDirection(state, direction) {
  if (state.status !== 'playing' || state.queued || !Object.hasOwn(VECTORS, direction)) return state;
  const current = VECTORS[state.direction], next = VECTORS[direction];
  // A same-direction key must not consume the one available turn slot.
  if (direction === state.direction || (current.x + next.x === 0 && current.y + next.y === 0)) return state;
  return { ...state, queued: direction };
}
export function pauseGame(state) {
  return state.status === 'playing' ? { ...state, status: 'paused', queued: null } : state;
}
export function resumeGame(state) {
  return state.status === 'paused' ? { ...state, status: 'playing', queued: null } : state;
}
export function step(state, rng = Math.random) {
  if (state.status !== 'playing') return state;
  const direction = state.queued ?? state.direction, v = VECTORS[direction];
  const head = { x: state.snake[0].x + v.x, y: state.snake[0].y + v.y };
  const eating = same(head, state.food);
  const body = eating ? state.snake : state.snake.slice(0, -1);
  const reason = !inside(head) ? 'wall' : body.some(p => same(p, head)) ? 'body' : null;
  const base = { ...state, direction, queued: null, ticks: state.ticks + 1 };
  if (reason) return { ...base, status: 'result', reason };
  const snake = [head, ...state.snake];
  if (!eating) snake.pop();
  const eaten = state.eaten + Number(eating), score = eaten * 10;
  const food = eating ? spawnFood(snake, direction, eaten, rng) : state.food;
  const complete = snake.length === SIZE * SIZE;
  return { ...base, snake, eaten, score, food, status: complete ? 'result' : 'playing',
    reason: complete ? 'complete' : null };
}

export function defaultProfile() {
  return { version: 1, bestScore: 0, totalFood: 0, unlocked: ['base'],
    equipment: { head: 'base', scales: 'base', tail: 'base' }, muted: true };
}
export function unlockedFor(bestScore, totalFood) {
  return ['base', ...(totalFood >= 1 ? ['explorer'] : []), ...(bestScore >= 100 ? ['space'] : []),
    ...(totalFood >= 100 ? ['strawberry'] : [])];
}
const count = n => Number.isSafeInteger(n) && n >= 0;
export function normalizeProfile(raw) {
  const fallback = defaultProfile();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) {
    return { profile: fallback, recovered: true };
  }
  const bestScore = count(raw.bestScore) && raw.bestScore % 10 === 0 ? raw.bestScore : 0;
  const totalFood = count(raw.totalFood) ? raw.totalFood : 0;
  const unlocked = unlockedFor(bestScore, totalFood), equipment = {};
  for (const part of PARTS) {
    const id = raw.equipment?.[part];
    equipment[part] = unlocked.includes(id) ? id : 'base';
  }
  const profile = { version: 1, bestScore, totalFood, unlocked, equipment,
    muted: typeof raw.muted === 'boolean' ? raw.muted : true };
  const recovered = raw.bestScore !== bestScore || raw.totalFood !== totalFood ||
    raw.muted !== profile.muted || PARTS.some(p => raw.equipment?.[p] !== equipment[p]) ||
    !Array.isArray(raw.unlocked) || JSON.stringify(raw.unlocked) !== JSON.stringify(unlocked);
  return { profile, recovered };
}
export function loadProfile(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text == null) return { profile: defaultProfile(), warning: '' };
    const result = normalizeProfile(JSON.parse(text));
    return { profile: result.profile, warning: result.recovered ? '저장된 기록 일부를 기본값으로 복구했어요.' : '' };
  } catch {
    return { profile: defaultProfile(), warning: '기록을 읽을 수 없어요. 기본 상태로 플레이합니다.' };
  }
}
export function saveProfile(storage, profile) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(normalizeProfile(profile).profile)); return { ok: true, warning: '' }; }
  catch { return { ok: false, warning: '이 환경에서는 기록이 저장되지 않아요. 현재 화면에서는 계속 플레이할 수 있어요.' }; }
}
export function recordProgress(profile, previous, next) {
  if (previous === next || previous.status !== 'playing') return profile;
  const gained = Math.max(0, next.eaten - previous.eaten);
  const bestScore = Math.max(profile.bestScore, next.score);
  if (!gained && bestScore === profile.bestScore) return profile;
  const totalFood = Math.min(Number.MAX_SAFE_INTEGER, profile.totalFood + gained);
  return { ...profile, bestScore, totalFood, unlocked: unlockedFor(bestScore, totalFood) };
}
export const canEquip = (profile, equipment) => PARTS.every(p => profile.unlocked.includes(equipment?.[p]));
export function equip(profile, equipment) {
  if (!canEquip(profile, equipment)) return profile;
  return { ...profile, equipment: Object.fromEntries(PARTS.map(p => [p, equipment[p]])) };
}