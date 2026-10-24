import { RULES as R, createGame, startGame, pauseGame, resumeGame, step } from './engine.mjs';
import { loadSave, writeSave } from './save.mjs';

const $ = id => document.getElementById(id);
const arena = $('arena');
const canvas = $('court');
const ctx = canvas.getContext('2d');
let storage;
try { storage = window.localStorage; } catch { /* Storage can be blocked independently of gameplay. */ }
const loaded = loadSave(storage);
let saved = loaded.data;
let game = createGame({ difficulty: saved.difficulty });
let savedResult = false;
let keys = new Set();
let drag = null;
let lastTime = null;
let overlayState = '';
let pauseReason = '';
let soundContext;
let trail = [];

function clearInput() {
  keys.clear();
  if (drag !== null && arena.hasPointerCapture?.(drag.id)) arena.releasePointerCapture(drag.id);
  drag = null;
}
function persist() {
  const ok = writeSave(storage, saved);
  $('save-status').textContent = ok ? '기록과 설정은 이 브라우저에 저장됩니다.' : '저장을 사용할 수 없어 이번 탭에서만 기록을 유지합니다.';
}
if (!loaded.available) $('save-status').textContent = '저장값을 읽지 못해 기본 설정으로 시작합니다. 게임은 계속할 수 있어요.';

// Audio is created only after a user gesture. Failure is intentionally non-blocking.
function unlockSound() {
  if (saved.muted) return;
  try {
    if (!soundContext) { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) soundContext = new Audio(); }
    const resumed = soundContext?.resume();
    resumed?.catch(() => {});
  } catch { /* No audio support: visual feedback is sufficient. */ }
}
function sound(type) {
  if (saved.muted || !soundContext || soundContext.state !== 'running') return;
  try {
    const now = soundContext.currentTime;
    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();
    const frequencies = { hit: 520, wall: 290, score: 760, finish: 990, serve: 410 };
    oscillator.type = type === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[type] || 440, now);
    oscillator.frequency.exponentialRampToValueAtTime((frequencies[type] || 440) * 0.65, now + 0.12);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    oscillator.connect(gain); gain.connect(soundContext.destination);
    oscillator.start(now); oscillator.stop(now + 0.16);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* A suspended or unavailable audio device must not stop play. */ }
}
function selectValue(id, value) {
  for (const button of $(id).querySelectorAll('button[data-value]')) button.setAttribute('aria-pressed', String(button.dataset.value === value));
}
function bindChoice(id, change) {
  $(id).addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (button && $(id).contains(button) && !$(id).disabled) change(button.dataset.value);
  });
}
function records() {
  const stats = saved.stats[saved.difficulty];
  $('wins').textContent = stats.wins;
  $('best').textContent = stats.bestRally;
  selectValue('difficulty', saved.difficulty);
  $('ai-level').textContent = saved.difficulty === 'easy' ? 'AI / EASY' : 'AI / NORMAL';
  $('mute').textContent = saved.muted ? '소리 꺼짐' : '소리 켜짐';
  $('mute').setAttribute('aria-pressed', String(saved.muted));
  for (const part of ['paddle', 'ball', 'court']) selectValue(`${part}-theme`, saved.themes[part]);
}
function freshMatch(start = false) {
  clearInput();
  game = createGame({ difficulty: saved.difficulty });
  savedResult = false;
  trail = [];
  pauseReason = '';
  lastTime = null;
  if (start) {
    unlockSound(); startGame(game); arena.focus({ preventScroll: true });
    document.querySelector('.match').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  renderUI(); draw();
}
function setPaused(reason = '') {
  clearInput();
  if (pauseGame(game)) {
    pauseReason = reason;
    $('announcement').textContent = reason || '경기가 일시정지되었습니다.';
    renderUI(); draw();
  }
}
function continueMatch() {
  if (document.hidden) return;
  clearInput();
  unlockSound();
  if (resumeGame(game)) { lastTime = null; pauseReason = ''; arena.focus({ preventScroll: true }); renderUI(); }
}
function togglePause() {
  if (game.status === 'playing') setPaused();
  else if (game.status === 'paused') continueMatch();
}
$('primary-action').addEventListener('click', () => {
  if (game.status === 'paused') continueMatch();
  else freshMatch(true);
});
$('pause').addEventListener('click', togglePause);
$('restart').addEventListener('click', () => freshMatch());
$('mute').addEventListener('click', () => { saved.muted = !saved.muted; unlockSound(); records(); persist(); });
bindChoice('difficulty', value => {
  if (game.status === 'playing' || game.status === 'paused') return;
  saved.difficulty = value === 'easy' ? 'easy' : 'normal';
  records(); persist(); freshMatch();
});
for (const part of ['paddle', 'ball', 'court']) {
  bindChoice(`${part}-theme`, value => { saved.themes[part] = value; trail = []; records(); persist(); draw(); });
}
const movementKeys = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown']);
arena.addEventListener('keydown', event => {
  if (event.target !== arena || event.ctrlKey || event.altKey || event.metaKey) return;
  if (movementKeys.has(event.code)) {
    event.preventDefault();
    if (game.status === 'playing') keys.add(event.code);
  } else if (event.code === 'KeyP' || event.code === 'Escape') {
    if (game.status === 'playing' || game.status === 'paused') event.preventDefault();
    if (!event.repeat) togglePause();
  }
});
// Releasing a key after focus has moved must still clear its held state.
window.addEventListener('keyup', event => keys.delete(event.code));
arena.addEventListener('blur', clearInput);
window.addEventListener('blur', () => setPaused('다른 창으로 이동해 경기를 멈췄어요. 준비되면 재개하세요.'));
document.addEventListener('visibilitychange', () => {
  clearInput(); lastTime = null;
  if (document.hidden) setPaused('탭을 떠나 경기를 멈췄어요. 준비되면 재개하세요.');
});
window.addEventListener('pagehide', () => setPaused('경기를 멈췄어요. 준비되면 재개하세요.'));
function logicalPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * R.width / rect.width, y: (event.clientY - rect.top) * R.height / rect.height };
}
arena.addEventListener('pointerdown', event => {
  if (game.status !== 'playing' || drag !== null || event.button !== 0 || event.target.closest('button')) return;
  const point = logicalPoint(event);
  if (point.x > R.width * 0.48) return;
  event.preventDefault();
  arena.focus({ preventScroll: true }); unlockSound();
  drag = { id: event.pointerId, targetY: point.y };
  arena.setPointerCapture(event.pointerId);
});
arena.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  event.preventDefault();
  drag.targetY = logicalPoint(event).y;
});
function endDrag(event) {
  if (drag?.id === event.pointerId) { const id = drag.id; drag = null; if (arena.hasPointerCapture(id)) arena.releasePointerCapture(id); }
}
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) arena.addEventListener(eventName, endDrag);

function renderUI() {
  $('player-score').textContent = game.score.player;
  $('ai-score').textContent = game.score.ai;
  $('rally').textContent = game.rally;
  $('speed').firstChild.textContent = `${Math.round(game.ball.speed)} `;
  const active = game.status === 'playing';
  const paused = game.status === 'paused';
  arena.classList.toggle('playing', active);
  $('pause').disabled = !active && !paused;
  $('pause').textContent = paused ? '▷ 경기 재개' : 'Ⅱ 일시정지';
  $('difficulty').disabled = active || paused;
  $('difficulty-help').textContent = active || paused ? '난이도는 새 경기에서 변경할 수 있어요.' : '경기 시작 전에 선택할 수 있어요.';
  $('status-label').textContent = paused ? '일시정지' : game.status === 'finished' ? '경기 종료' : active ? (game.phase === 'serve' ? '서브 준비' : '경기 중') : '경기 준비';
  $('countdown').hidden = !active || game.phase !== 'serve';
  $('serve-label').textContent = game.score.player + game.score.ai === 0 ? '첫 서브' : game.serveDirection < 0 ? '플레이어에게 서브' : '컴퓨터에게 서브';
  $('overlay').hidden = active;
  const signature = `${game.status}:${pauseReason}:${game.winner}`;
  if (signature === overlayState) return;
  overlayState = signature;
  if (paused) {
    $('overlay-kicker').textContent = 'TAKE A BREATHER';
    $('overlay-title').innerHTML = '잠시, 숨 고르기.';
    $('overlay-copy').textContent = pauseReason || '준비되면 이어서 플레이하세요. 공과 서브 시간은 그대로 기다리고 있어요.';
    $('primary-action').innerHTML = '경기 재개 <span>▷</span>';
    $('overlay-hint').textContent = '버튼 또는 경기장에 초점을 두고 P';
  } else if (game.status === 'finished') {
    const won = game.winner === 'player';
    const stats = saved.stats[game.difficulty];
    $('overlay-kicker').textContent = won ? 'VICTORY / WELL PLAYED' : 'NEXT RALLY IS YOURS';
    $('overlay-title').textContent = won ? '당신의 승리!' : '다음 경기를 노려요.';
    $('overlay-copy').textContent = `${game.score.player} : ${game.score.ai} · ${won ? '7점 선취 성공' : '컴퓨터가 먼저 7점 도달'} · 최장 랠리 ${game.bestRally}회`;
    $('primary-action').innerHTML = '다시 도전 <span>↗</span>';
    $('overlay-hint').textContent = game.bestRally > 0 && game.bestRally >= stats.bestRally ? '이번 경기에서 개인 최장 랠리를 달성했어요!' : `이 난이도 기록 · ${stats.wins}승 / 최장 ${stats.bestRally}회`;
  } else {
    $('overlay-kicker').textContent = 'READY TO RALLY';
    $('overlay-title').innerHTML = '당신의 코트를 <br>지켜주세요.';
    $('overlay-copy').innerHTML = '왼쪽 패들로 공을 받아내세요.<br>먼저 7점을 얻으면 승리합니다.';
    $('primary-action').innerHTML = '경기 시작 <span>↗</span>';
    $('overlay-hint').textContent = 'W / S · ↑ / ↓ · 왼쪽 영역 드래그';
  }
}
function roundedRect(x, y, width, height, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill();
}
function drawPaddle(x, y, color, isPlayer) {
  const top = y - R.paddleHeight / 2;
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  const theme = saved.themes.paddle;
  if (theme === 'prism') {
    for (let i = 0; i < 4; i++) roundedRect(x, top + i * 26, R.paddleWidth, 23, 2);
  } else {
    if (theme === 'mono') ctx.fillStyle = '#e9f4ff';
    roundedRect(x, top, R.paddleWidth, R.paddleHeight, theme === 'pulse' ? 6 : 1);
  }
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff90';
  if (theme === 'mono') {
    ctx.fillStyle = color; for (let i = 0; i < 7; i++) ctx.fillRect(x + 2, top + 6 + i * 14, R.paddleWidth - 4, 3);
  } else ctx.fillRect(isPlayer ? x + 3 : x + 9, top + 8, 2, R.paddleHeight - 16);
  ctx.restore();
}
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, R.width, R.height);
  const background = ctx.createLinearGradient(0, 0, R.width, R.height);
  background.addColorStop(0, '#0b1d2a'); background.addColorStop(0.48, '#0d1729'); background.addColorStop(1, '#231729');
  ctx.fillStyle = background; ctx.fillRect(0, 0, R.width, R.height);
  ctx.save();
  ctx.strokeStyle = '#7697c00d'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (saved.themes.court === 'grid') {
    for (let x = 0; x < R.width; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, R.height); }
    for (let y = 0; y < R.height; y += 45) { ctx.moveTo(0, y); ctx.lineTo(R.width, y); }
  } else if (saved.themes.court === 'orbit') {
    for (let radius = 90; radius <= 530; radius += 65) { ctx.moveTo(480 + radius, 270); ctx.arc(480, 270, radius, 0, Math.PI * 2); }
  } else {
    for (let x = -540; x < 960; x += 70) { ctx.moveTo(x, 0); ctx.lineTo(x + 540, 540); }
  }
  ctx.stroke();
  ctx.strokeStyle = '#7598c326'; ctx.lineWidth = 2;
  ctx.strokeRect(22, 18, 916, 504);
  ctx.setLineDash([8, 12]); ctx.beginPath(); ctx.moveTo(480, 18); ctx.lineTo(480, 522); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(480, 270, 72, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#8cacc53b'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.fillText('PLAYER ZONE', 76, 44);
  ctx.textAlign = 'right'; ctx.fillText('COMPUTER ZONE', 884, 44);
  ctx.strokeStyle = '#65f5cf80'; ctx.lineWidth = 3;
  for (const [x, y, dx, dy] of [[22, 18, 1, 1], [22, 522, 1, -1], [938, 18, -1, 1], [938, 522, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + 20 * dy); ctx.lineTo(x, y); ctx.lineTo(x + 20 * dx, y); ctx.stroke();
  }
  ctx.restore();
  drawPaddle(R.playerX, game.player.y, '#65f5cf', true);
  drawPaddle(R.aiX, game.ai.y, '#ff759d', false);
  const ball = game.ball;
  if (saved.themes.ball === 'comet') {
    trail.forEach((point, index) => { ctx.beginPath(); ctx.fillStyle = `rgba(165,228,255,${(index + 1) / trail.length * 0.25})`; ctx.arc(point.x, point.y, R.radius * (index + 1) / trail.length, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.save(); ctx.fillStyle = '#f4faff'; ctx.shadowColor = '#baf5ff'; ctx.shadowBlur = 22;
  ctx.translate(ball.x, ball.y);
  if (saved.themes.ball === 'diamond') { ctx.rotate(Math.PI / 4); ctx.fillRect(-5.65, -5.65, 11.3, 11.3); }
  else { ctx.beginPath(); ctx.arc(0, 0, R.radius, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function handleEvents(events) {
  for (const event of events) {
    sound(event.type);
    if (event.type === 'score') { trail = []; $('announcement').textContent = `${event.side === 'player' ? '플레이어' : '컴퓨터'} 득점. ${game.score.player} 대 ${game.score.ai}`; }
    if (event.type === 'serve') trail = [];
    if (event.type === 'finish' && !savedResult) {
      savedResult = true;
      clearInput();
      const stats = saved.stats[game.difficulty];
      if (game.winner === 'player') stats.wins += 1;
      stats.bestRally = Math.max(stats.bestRally, game.bestRally);
      persist(); records();
      $('announcement').textContent = `${game.winner === 'player' ? '플레이어 승리' : '컴퓨터 승리'}. ${game.score.player} 대 ${game.score.ai}. 최장 랠리 ${game.bestRally}회.`;
    }
  }
}
function frame(now) {
  const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const axis = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (game.status === 'playing') {
    handleEvents(step(game, dt, { axis, targetY: drag?.targetY }));
    if (game.phase === 'rally' && saved.themes.ball === 'comet') { trail.push({ x: game.ball.x, y: game.ball.y }); if (trail.length > 8) trail.shift(); }
  }
  renderUI(); draw();
  requestAnimationFrame(frame);
}
records(); renderUI(); draw(); requestAnimationFrame(frame);
