// DOM-free, deterministic simulation. All positions and speeds use logical pixels.
export const RULES = Object.freeze({
  width: 960, height: 540, paddleWidth: 14, paddleHeight: 104,
  playerX: 36, aiX: 910, radius: 8, playerSpeed: 520,
  initialSpeed: 300, maxSpeed: 600, acceleration: 1.03,
  maxAngle: Math.PI / 3, serveDelay: 1, winningScore: 7,
});
export const AI_SPEEDS = Object.freeze({ easy: 220, normal: 300 });
const EPS = 1e-9;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const center = RULES.height / 2;

export function createGame({ difficulty = 'normal' } = {}) {
  if (!Object.hasOwn(AI_SPEEDS, difficulty)) throw new RangeError('Unknown difficulty');
  return {
    status: 'ready', phase: 'serve', difficulty,
    player: { y: center }, ai: { y: center },
    ball: { x: RULES.width / 2, y: center, vx: 0, vy: 0, speed: RULES.initialSpeed },
    score: { player: 0, ai: 0 }, rally: 0, bestRally: 0,
    serveRemaining: RULES.serveDelay, serveDirection: -1, winner: null,
  };
}
export function startGame(state) {
  if (state.status !== 'ready') return false;
  state.status = 'playing';
  return true;
}
export function pauseGame(state) {
  if (state.status !== 'playing') return false;
  state.status = 'paused';
  return true;
}
export function resumeGame(state) {
  if (state.status !== 'paused') return false;
  state.status = 'playing';
  return true;
}
function moveToward(y, target, distance) {
  return y + clamp(target - y, -distance, distance);
}
function movePaddles(state, dt, input) {
  const half = RULES.paddleHeight / 2;
  const axis = Number.isFinite(input.axis) ? clamp(input.axis, -1, 1) : 0;
  state.player.y = Number.isFinite(input.targetY)
    ? moveToward(state.player.y, clamp(input.targetY, half, RULES.height - half), RULES.playerSpeed * dt)
    : state.player.y + axis * RULES.playerSpeed * dt;
  state.player.y = clamp(state.player.y, half, RULES.height - half);
  state.ai.y = clamp(moveToward(state.ai.y, state.ball.y, AI_SPEEDS[state.difficulty] * dt), half, RULES.height - half);
}
function launch(state, events) {
  const angle = ((state.score.player + state.score.ai) % 2 ? 1 : -1) * Math.PI / 12;
  state.ball.vx = state.serveDirection * RULES.initialSpeed * Math.cos(angle);
  state.ball.vy = RULES.initialSpeed * Math.sin(angle);
  state.phase = 'rally';
  events.push({ type: 'serve', direction: state.serveDirection });
}
function awardPoint(state, scorer, events) {
  state.score[scorer] += 1;
  state.bestRally = Math.max(state.bestRally, state.rally);
  events.push({ type: 'score', side: scorer, rally: state.rally });
  state.ball = { x: RULES.width / 2, y: center, vx: 0, vy: 0, speed: RULES.initialSpeed };
  if (state.score[scorer] >= RULES.winningScore) {
    state.status = 'finished';
    state.winner = scorer;
    events.push({ type: 'finish', winner: scorer });
    return;
  }
  state.phase = 'serve';
  state.rally = 0;
  state.serveDirection = scorer === 'player' ? 1 : -1;
  state.serveRemaining = RULES.serveDelay;
}
// Swept time-of-impact against walls, paddle faces and goals: no endpoint tunnelling.
function moveBall(state, dt, events) {
  const ball = state.ball;
  let remaining = dt;
  for (let contacts = 0; remaining > EPS && contacts < 32; contacts += 1) {
    let time = remaining;
    let contact = null;
    const candidate = (t, kind) => {
      if (t >= -EPS && t <= time + EPS) { time = Math.max(0, Math.min(time, t)); contact = kind; }
    };
    if (ball.vy < -EPS) candidate((RULES.radius - ball.y) / ball.vy, 'top');
    if (ball.vy > EPS) candidate((RULES.height - RULES.radius - ball.y) / ball.vy, 'bottom');
    const side = ball.vx < 0 ? 'player' : 'ai';
    const face = side === 'player' ? RULES.playerX + RULES.paddleWidth + RULES.radius : RULES.aiX - RULES.radius;
    if (Math.abs(ball.vx) > EPS) {
      const impact = (face - ball.x) / ball.vx;
      const impactY = ball.y + ball.vy * impact;
      if (impact >= -EPS && Math.abs(impactY - state[side].y) <= RULES.paddleHeight / 2 + RULES.radius) {
        candidate(impact, side);
      }
      const goal = ball.vx < 0 ? -RULES.radius : RULES.width + RULES.radius;
      candidate((goal - ball.x) / ball.vx, 'goal');
    }
    ball.x += ball.vx * time;
    ball.y += ball.vy * time;
    remaining -= time;
    if (!contact) break;
    if (contact === 'goal') {
      awardPoint(state, side === 'player' ? 'ai' : 'player', events);
      return true;
    }
    if (contact === 'top' || contact === 'bottom') {
      ball.y = contact === 'top' ? RULES.radius : RULES.height - RULES.radius;
      ball.vy = -ball.vy;
      events.push({ type: 'wall' });
    } else {
      const ratio = clamp((ball.y - state[contact].y) / (RULES.paddleHeight / 2), -1, 1);
      const angle = ratio * RULES.maxAngle;
      ball.speed = Math.min(RULES.maxSpeed, ball.speed * RULES.acceleration);
      ball.vx = (contact === 'player' ? 1 : -1) * ball.speed * Math.cos(angle);
      ball.vy = ball.speed * Math.sin(angle);
      state.rally += 1;
      state.bestRally = Math.max(state.bestRally, state.rally);
      events.push({ type: 'hit', side: contact, rally: state.rally });
    }
  }
  return false;
}
export function step(state, seconds, input = {}) {
  const events = [];
  if (state.status !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return events;
  let remaining = seconds;
  while (remaining > EPS) {
    let dt = Math.min(remaining, 1 / 120);
    if (state.phase === 'serve') dt = Math.min(dt, state.serveRemaining);
    movePaddles(state, dt, input);
    remaining -= dt;
    if (state.phase === 'serve') {
      state.serveRemaining = Math.max(0, state.serveRemaining - dt);
      if (state.serveRemaining <= EPS) { state.serveRemaining = 0; launch(state, events); }
    } else if (moveBall(state, dt, events)) {
      // A scoring step ends here. Its remaining time cannot score twice or eat the serve delay.
      break;
    }
  }
  return events;
}
