import { SIZE, PARTS, VECTORS, createGame, startGame, queueDirection, step, pauseGame, resumeGame,
  speedFor, loadProfile, saveProfile, recordProgress, canEquip, equip } from './engine.mjs';

const $ = id => document.getElementById(id);
const field = $('playfield'), board = $('board'), ctx = board.getContext('2d');
const closet = $('closet'), helpDialog = $('help-dialog'), restartDialog = $('restart-dialog');
const dialogs = [closet, helpDialog, restartDialog];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { /* loadProfile supplies the visible warning. */ }
const loaded = loadProfile(storage);
let profile = loaded.profile, game = createGame(), roundBest = profile.bestScore;
let draft = { ...profile.equipment }, lastTime = 0, accumulator = 0, pauseReason = '';
let dialogOpener = null, gesture = null, previewClock = 0;
const pressed = new Set(), pointers = new Set();
const setNames = { base: '기본', explorer: '탐험가', space: '우주', strawberry: '딸기' };
const partNames = { head: '머리 장식', scales: '몸 비늘', tail: '꼬리 장식' };
const itemNames = {
  head: { base: '작은 뿔', explorer: '탐험 모자', space: '우주 헬멧', strawberry: '딸기 꼭지' },
  scales: { base: '새싹 비늘', explorer: '숲 줄무늬', space: '별빛 비늘', strawberry: '딸기 비늘' },
  tail: { base: '잎사귀 끝', explorer: '여행 리본', space: '작은 행성', strawberry: '딸기 꼬리' },
};
const palettes = {
  base: { body: '#86b96d', edge: '#527b4b', light: '#c7e39d' },
  explorer: { body: '#82aa75', edge: '#546a43', light: '#d9c07c' },
  space: { body: '#8b94c7', edge: '#586994', light: '#dae0fa' },
  strawberry: { body: '#de9091', edge: '#b35d70', light: '#f8d4b2' },
};
function text(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
function warn(message) { if (message) { $('storage-warning').hidden = false; text('storage-warning', message); } }
warn(loaded.warning);
function persist() { const result = saveProfile(storage, profile); warn(result.warning); }
function clearInput() {
  pressed.clear(); pointers.clear(); gesture = null;
  game = { ...game, queued: null }; accumulator = 0; lastTime = 0;
}
function focusBoard() { field.focus({ preventScroll: true }); }

// Generated locally with WebAudio; a missing/blocked AudioContext never affects rules.
let audio = null;
const voices = new Set();
function stopSound() {
  for (const oscillator of voices) { try { oscillator.stop(); } catch { /* already stopped */ } }
  voices.clear();
}
function activateAudio() {
  if (profile.muted || document.hidden) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch { audio = null; }
}
function sound(kind) {
  if (profile.muted || document.hidden || !audio || audio.state !== 'running') return;
  try {
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    const end = now + (kind === 'eat' ? .13 : .2);
    oscillator.type = kind === 'eat' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(kind === 'eat' ? 640 : 200, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'eat' ? 960 : 80, end);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.045, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(gain); gain.connect(audio.destination); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(end);
  } catch { /* Visual feedback and play remain available. */ }
}
function syncHUD(message) {
  $('score').innerHTML = `${game.score} <small>점</small>`;
  $('best').innerHTML = `${profile.bestScore} <small>점</small>`;
  $('speed').innerHTML = `${speedFor(game.eaten)} <small>칸/초</small>`;
  text('total-food', `${profile.totalFood}개`); text('unlock-count', `${profile.unlocked.length - 1} / 3`);
  text('sound', profile.muted ? '소리 꺼짐' : '소리 켜짐');
  $('sound').setAttribute('aria-pressed', String(profile.muted));
  $('pause').disabled = game.status === 'ready' || game.status === 'result';
  text('pause', game.status === 'paused' ? '여행 재개' : '일시정지');
  for (const button of document.querySelectorAll('[data-direction]')) button.disabled = game.status !== 'playing';
  $('overlay').hidden = game.status === 'playing';
  $('result-score').hidden = game.status !== 'result';
  $('overlay-wardrobe').hidden = game.status === 'paused';
  if (game.status === 'ready') {
    text('overlay-tag', 'READY, LITTLE DRAGON?'); text('overlay-title', '간식 찾으러 떠날까요?');
    $('overlay-copy').innerHTML = '간식을 먹으면 몸이 한 칸 자라요.<br>벽과 내 몸을 피해 정원을 여행해요.';
    text('primary', '여행 시작');
  } else if (game.status === 'paused') {
    text('overlay-tag', 'TAKE A LITTLE BREAK'); text('overlay-title', '잠깐, 쉬어 가요');
    text('overlay-copy', pauseReason || '준비되면 직접 재개해 주세요.'); text('primary', '여행 재개');
  } else if (game.status === 'result') {
    const completed = game.reason === 'complete';
    text('overlay-tag', completed ? 'GARDEN COMPLETE!' : 'SEE YOU NEXT ADVENTURE');
    text('overlay-title', completed ? '정원을 가득 채웠어요!' : '오늘의 여행 끝!');
    const reason = completed ? '400칸 완주' : game.reason === 'wall' ? '벽에 닿았어요' : '내 몸에 닿았어요';
    const best = game.score > roundBest ? ' · 나의 최고 기록 갱신!' : game.score > 0 && game.score === roundBest ? ' · 최고 기록과 동점' : '';
    text('overlay-copy', `${reason} · 간식 ${game.eaten}개${best}`);
    text('result-score', `${game.score}점`); text('primary', '다시 여행하기');
  }
  const defaults = { ready: '준비 완료 · 시작 버튼을 눌러 주세요', playing: '여행 중 · 간식을 향해 한 칸씩!', paused: '일시정지 · 직접 재개해 주세요', result: `여행 종료 · ${game.score}점, 간식 ${game.eaten}개` };
  text('game-status', message || defaults[game.status]);
}
function beginRound() {
  if (document.hidden) return;
  roundBest = profile.bestScore; game = startGame(); pauseReason = ''; clearInput();
  activateAudio(); syncHUD(); focusBoard();
}
function pause(reason = '잠깐 쉬어도 괜찮아요. 준비되면 다시 떠나요.') {
  if (game.status !== 'playing') return;
  game = pauseGame(game); pauseReason = reason; clearInput(); stopSound(); syncHUD();
}
function resume() {
  if (document.hidden || dialogs.some(d => d.open) || game.status !== 'paused') return;
  clearInput(); game = resumeGame(game); activateAudio(); syncHUD(); focusBoard();
}
function turn(direction) {
  if (dialogs.some(d => d.open) || document.hidden) return;
  game = queueDirection(game, direction);
}
function advance() {
  const previous = game, previousUnlocks = profile.unlocked.length;
  game = step(game); const updated = recordProgress(profile, previous, game);
  if (updated !== profile) { profile = updated; persist(); }
  let message;
  if (game.eaten > previous.eaten) {
    sound('eat'); message = profile.unlocked.length > previousUnlocks ? '새 코스튬 해금! 옷장에서 확인해 보세요.' : `간식 ${game.eaten}개! +10점`;
  }
  if (game.status === 'result') { clearInput(); persist(); sound('end'); }
  syncHUD(message);
  if (game.status === 'result') $('primary').focus({ preventScroll: true });
}
$('primary').addEventListener('click', () => game.status === 'paused' ? resume() : beginRound());
$('pause').addEventListener('click', () => game.status === 'paused' ? resume() : pause());
$('sound').addEventListener('click', () => {
  profile = { ...profile, muted: !profile.muted }; if (profile.muted) stopSound(); else activateAudio();
  persist(); syncHUD();
});
const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
field.addEventListener('keydown', event => {
  if (event.target !== field || event.ctrlKey || event.altKey || event.metaKey || dialogs.some(d => d.open)) return;
  const direction = keyDirections[event.code];
  if (!direction && event.code !== 'Escape') return;
  event.preventDefault();
  if (event.repeat || pressed.has(event.code)) return;
  pressed.add(event.code);
  if (event.code === 'Escape') { if (game.status === 'playing') pause(); else if (game.status === 'paused') resume(); }
  else turn(direction);
});
document.addEventListener('keyup', event => pressed.delete(event.code));
for (const button of document.querySelectorAll('[data-direction]')) button.addEventListener('click', () => {
  activateAudio(); turn(button.dataset.direction); focusBoard();
});
field.addEventListener('pointerdown', event => {
  if (event.target !== board && event.target !== field) return;
  if (game.status !== 'playing') return;
  pointers.add(event.pointerId); focusBoard();
  if (pointers.size !== 1 || !event.isPrimary) { gesture = null; return; }
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  try { field.setPointerCapture(event.pointerId); } catch { /* pointer may have ended */ }
});
field.addEventListener('pointerup', event => {
  const current = gesture; pointers.delete(event.pointerId); gesture = null;
  if (!current || current.id !== event.pointerId || pointers.size) return;
  const dx = event.clientX - current.x, dy = event.clientY - current.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24 || Math.abs(dx) === Math.abs(dy)) return;
  turn(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
});
field.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); gesture = null; });
function protectPause() { pause('다른 화면으로 이동해 정지했어요.'); clearInput(); stopSound(); if (game.status === 'paused') { pauseReason = '다른 탭이나 창으로 이동해 정지했어요. 직접 재개해 주세요.'; syncHUD(); } }
window.addEventListener('blur', protectPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) protectPause(); else { clearInput(); syncHUD(); } });

function openDialog(dialog) {
  dialogOpener = document.activeElement;
  pause('메뉴를 열어 여행을 멈췄어요. 닫은 뒤 직접 재개해 주세요.'); clearInput();
  dialog.showModal();
}
for (const dialog of dialogs) dialog.addEventListener('close', () => {
  clearInput(); syncHUD(); if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
});
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
$('help').addEventListener('click', () => openDialog(helpDialog));
$('restart').addEventListener('click', () => {
  if (game.status === 'ready' || game.status === 'result') beginRound(); else openDialog(restartDialog);
});
$('confirm-restart').addEventListener('click', () => { restartDialog.close(); beginRound(); });
function requirement(id) {
  return id === 'base' ? '항상 사용 가능' : id === 'explorer' ? `첫 먹이 · ${Math.min(1, profile.totalFood)}/1개` :
    id === 'space' ? `한 판 100점 · ${Math.min(100, profile.bestScore)}/100점` : `누적 먹이 · ${Math.min(100, profile.totalFood)}/100개`;
}
function openCloset() { draft = { ...profile.equipment }; previewClock = 0; buildCloset(); openDialog(closet); }
$('wardrobe').addEventListener('click', openCloset);
$('overlay-wardrobe').addEventListener('click', openCloset);
$('cancel-outfit').addEventListener('click', () => closet.close());
$('apply-outfit').addEventListener('click', () => {
  if (!canEquip(profile, draft)) return;
  profile = equip(profile, draft); persist(); closet.close(); syncHUD('새 옷을 장착했어요. 즐거운 여행 되세요!');
});
function buildCloset() {
  const focused = document.activeElement?.dataset;
  const focusPart = focused?.part, focusItem = focused?.item, focusSet = focused?.set;
  $('set-options').replaceChildren(); $('part-options').replaceChildren();
  for (const id of Object.keys(setNames)) {
    const button = document.createElement('button'); button.type = 'button';
    button.dataset.set = id; button.textContent = `${setNames[id]} 세트`; button.setAttribute('aria-pressed', String(PARTS.every(p => draft[p] === id)));
    button.addEventListener('click', () => { draft = Object.fromEntries(PARTS.map(p => [p, id])); buildCloset(); });
    $('set-options').append(button);
  }
  for (const part of PARTS) {
    const fieldset = document.createElement('fieldset'), legend = document.createElement('legend'), row = document.createElement('div');
    legend.textContent = partNames[part]; row.className = 'items-row'; fieldset.append(legend, row);
    for (const id of Object.keys(setNames)) {
      const button = document.createElement('button'), label = document.createElement('span'), detail = document.createElement('small');
      button.type = 'button'; button.className = 'item-button'; button.dataset.part = part; button.dataset.item = id; label.textContent = itemNames[part][id];
      const owned = profile.unlocked.includes(id); detail.textContent = owned ? '사용 가능' : `잠김 · ${requirement(id)}`;
      button.setAttribute('aria-pressed', String(draft[part] === id));
      button.setAttribute('aria-label', `${partNames[part]}: ${itemNames[part][id]}. ${detail.textContent}`);
      button.append(label, detail); button.addEventListener('click', () => { draft[part] = id; buildCloset(); }); row.append(button);
    }
    $('part-options').append(fieldset);
  }
  const allowed = canEquip(profile, draft);
  $('apply-outfit').disabled = !allowed;
  text('closet-message', allowed ? '장착을 누르면 저장해요. 취소하면 기존 모습이 유지돼요.' : '잠긴 아이템을 미리 보고 있어요. 조건을 달성한 뒤 장착할 수 있어요.');
  text('preview-label', PARTS.map(p => itemNames[p][draft[p]]).join(' · '));
  const restore = focusPart ? document.querySelector('[data-part=' + focusPart + '][data-item=' + focusItem + ']') : focusSet ? document.querySelector('[data-set=' + focusSet + ']') : null;
  restore?.focus({ preventScroll: true });
}

// Original Canvas artwork. Anchors are cell centers; clothing never enters rule state.
function ellipse(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function polygon(c, points, fill) { c.fillStyle = fill; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
function rounded(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function star(c, x, y, r, fill) {
  const points = Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 - Math.PI / 2, size = i % 2 ? r * .45 : r; return [x + Math.cos(a) * size, y + Math.sin(a) * size]; });
  polygon(c, points, fill);
}
function drawDragon(c, snake, direction, outfit, cell) {
  const body = palettes[outfit.scales], head = palettes[outfit.head];
  c.save(); c.lineWidth = cell * .72; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = body.body;
  c.beginPath(); snake.forEach((p, i) => i ? c.lineTo((p.x + .5) * cell, (p.y + .5) * cell) : c.moveTo((p.x + .5) * cell, (p.y + .5) * cell)); c.stroke();
  for (let i = snake.length - 2; i > 0; i--) {
    const p = snake[i], x = (p.x + .5) * cell, y = (p.y + .5) * cell;
    ellipse(c, x, y, cell * .34, cell * .34, body.body);
    if (outfit.scales === 'space') star(c, x, y, cell * .16, body.light);
    else if (outfit.scales === 'strawberry') { ellipse(c, x - cell * .1, y - cell * .08, cell * .035, cell * .07, body.light); ellipse(c, x + cell * .1, y + cell * .08, cell * .035, cell * .07, body.light); }
    else { c.strokeStyle = body.light; c.lineWidth = cell * .07; c.beginPath(); c.arc(x, y, cell * .16, .2, 2.8); c.stroke(); }
  }
  const tail = snake.at(-1), beforeTail = snake.at(-2) ?? tail;
  const angle = Math.atan2(tail.y - beforeTail.y, tail.x - beforeTail.x);
  c.save(); c.translate((tail.x + .5) * cell, (tail.y + .5) * cell); c.rotate(angle); c.scale(cell, cell);
  const tailPalette = palettes[outfit.tail];
  polygon(c, [[-.35, -.25], [.43, 0], [-.35, .25]], tailPalette.body);
  if (outfit.tail === 'space') { ellipse(c, .1, 0, .2, .2, '#d8bb76'); c.strokeStyle = '#f7e5b7'; c.lineWidth = .055; c.beginPath(); c.ellipse(.1, 0, .31, .08, -.4, 0, Math.PI * 2); c.stroke(); }
  else if (outfit.tail === 'strawberry') { ellipse(c, .1, 0, .22, .2, '#d87989'); polygon(c, [[-.15, -.14], [0, 0], [-.15, .14], [-.07, 0]], '#62864d'); ellipse(c, .16, -.06, .035, .045, '#ffe7b3'); }
  else if (outfit.tail === 'explorer') { polygon(c, [[0, 0], [.27, -.31], [.3, -.02]], '#e0b865'); polygon(c, [[0, 0], [.27, .31], [.3, .02]], '#d69d58'); }
  else polygon(c, [[-.12, 0], [.17, -.19], [.43, 0], [.17, .19]], '#b6d58b');
  c.restore();
  const p = snake[0], angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
  c.save(); c.translate((p.x + .5) * cell, (p.y + .5) * cell); c.rotate(angles[direction]); c.scale(cell, cell);
  polygon(c, [[-.25, -.23], [-.25, -.48], [.03, -.23]], '#e9d59d');
  polygon(c, [[-.25, .23], [-.25, .48], [.03, .23]], '#e9d59d');
  rounded(c, -.42, -.37, .85, .74, .28, head.body); ellipse(c, .27, 0, .26, .27, head.light);
  ellipse(c, .13, -.21, .07, .09, '#294b3a'); ellipse(c, .13, .21, .07, .09, '#294b3a');
  ellipse(c, .145, -.23, .022, .026, '#fffdf2'); ellipse(c, .145, .19, .022, .026, '#fffdf2');
  ellipse(c, .39, -.08, .022, .025, head.edge); ellipse(c, .39, .08, .022, .025, head.edge);
  if (outfit.head === 'explorer') { rounded(c, -.45, -.42, .35, .84, .09, '#c3a060'); rounded(c, -.38, -.34, .35, .68, .14, '#ddbf80'); rounded(c, -.12, -.34, .07, .68, .02, '#947948'); }
  else if (outfit.head === 'space') { c.strokeStyle = '#edf7ff'; c.fillStyle = '#d9eafa33'; c.lineWidth = .065; c.beginPath(); c.ellipse(.02, 0, .54, .49, 0, 0, Math.PI * 2); c.fill(); c.stroke(); rounded(c, -.49, -.3, .15, .6, .05, '#7788ad'); }
  else if (outfit.head === 'strawberry') { polygon(c, [[-.39, 0], [-.49, -.36], [-.22, -.23], [-.08, -.47], [-.01, -.15], [.18, -.28], [.02, 0], [.18, .28], [-.01, .15], [-.08, .47], [-.22, .23], [-.49, .36]], '#5e8c54'); }
  c.restore(); c.restore();
}
function drawFood(c, food, eaten, time) {
  if (!food) return;
  const cell = board.width / SIZE, x = (food.x + .5) * cell, y = (food.y + .5) * cell;
  const pulse = reducedMotion.matches || game.status !== 'playing' ? 0 : Math.sin(time / 220) * .03;
  c.save(); c.translate(x, y); c.scale(cell * (1 + pulse), cell * (1 + pulse));
  ellipse(c, 0, .24, .28, .08, '#77945c22');
  if (eaten % 3 === 0) { ellipse(c, 0, .02, .27, .29, '#dc8390'); ellipse(c, -.07, -.05, .08, .12, '#edb1b0'); polygon(c, [[-.2, -.2], [0, -.32], [.2, -.2], [0, -.16]], '#628d50'); }
  else if (eaten % 3 === 1) { ellipse(c, -.11, .04, .18, .2, '#9b8bb5'); ellipse(c, .12, .04, .18, .2, '#b69ac1'); ellipse(c, 0, .2, .17, .15, '#a18ab9'); polygon(c, [[-.03, -.15], [.08, -.36], [.27, -.26]], '#719456'); }
  else { polygon(c, [[-.28, -.15], [.27, -.15], [.16, .28], [-.16, .28]], '#d8ad69'); ellipse(c, 0, -.14, .28, .14, '#f1d196'); ellipse(c, -.09, -.16, .045, .045, '#d4a665'); ellipse(c, .09, -.13, .04, .04, '#d4a665'); }
  c.restore();
}
function drawBoard(time) {
  const cell = board.width / SIZE;
  ctx.fillStyle = '#eaf0da'; ctx.fillRect(0, 0, 600, 600);
  ctx.fillStyle = '#e5ecd2';
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
  ctx.fillStyle = '#cbd9b3';
  for (let y = 1; y < SIZE; y += 3) for (let x = 1; x < SIZE; x += 3) { ctx.beginPath(); ctx.arc(x * cell + 2, y * cell + 2, 1.4, 0, Math.PI * 2); ctx.fill(); }
  drawFood(ctx, game.food, game.eaten, time); drawDragon(ctx, game.snake, game.direction, profile.equipment, cell);
  if (game.status === 'result' && game.reason !== 'complete') {
    const p = game.snake[0]; ctx.strokeStyle = '#b56b60'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((p.x + .5) * cell, (p.y + .5) * cell, cell * .52, 0, Math.PI * 2); ctx.stroke();
  }
}
function drawPreview(canvas, outfit, time = 0) {
  const c = canvas.getContext('2d'), cell = Math.min(canvas.width / 12, canvas.height / 5);
  c.clearRect(0, 0, canvas.width, canvas.height);
  const path = [];
  for (let x = 2; x <= 9; x++) path.push({ x, y: 1 });
  for (let y = 2; y <= 3; y++) path.push({ x: 9, y });
  for (let x = 8; x >= 2; x--) path.push({ x, y: 3 });
  path.push({ x: 2, y: 2 });
  const index = (8 + Math.floor(time / 190)) % path.length;
  const snake = Array.from({ length: 6 }, (_, i) => path[(index - i + path.length) % path.length]);
  const dx = snake[0].x - snake[1].x, dy = snake[0].y - snake[1].y;
  const direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
  c.save(); c.translate((canvas.width - cell * 12) / 2, (canvas.height - cell * 5) / 2);
  drawDragon(c, snake, direction, outfit, cell); c.restore();
}
function frame(now) {
  const elapsed = lastTime ? Math.min(250, now - lastTime) : 0; lastTime = now;
  if (game.status === 'playing' && !document.hidden && !dialogs.some(d => d.open)) {
    accumulator += elapsed;
    let steps = 0;
    while (game.status === 'playing' && accumulator >= 1000 / speedFor(game.eaten) && steps < 2) {
      accumulator -= 1000 / speedFor(game.eaten); advance(); steps++;
    }
  } else accumulator = 0;
  drawBoard(now); drawPreview($('portrait'), profile.equipment);
  if (closet.open) { previewClock += elapsed; drawPreview($('outfit-preview'), draft, reducedMotion.matches ? 0 : previewClock); }
  requestAnimationFrame(frame);
}
syncHUD(); requestAnimationFrame(frame);