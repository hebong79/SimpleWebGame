import { createGame, transition, SAFE_COUNT } from './engine.mjs';
import { createStorage, settleRecord, THEMES, LIMIT } from './save.mjs';
import { createTimer } from './timer.mjs';
const $ = id => document.getElementById(id);
const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };
const storage = createStorage();
let record = storage.load(), game = createGame(), mode = false, settled = false;
let pauseReason = '', dialogKind = null, returnFocus = null, preview = record.theme, resultNote = '';
let gesture = null, holdTimer = null, lastHold = null, roving = 0;
const pointers = new Set(), pressed = new Set(), timer = createTimer();
const grid = $('grid'), dialog = $('dialog'), cells = [];
let audio = null, audioEpoch = 0;
const voices = new Set();
function stopAudio() {
  audioEpoch++;
  for (const voice of voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
  voices.clear();
  if (audio?.state === 'running') audio.suspend().catch(() => {});
}
function sound(kind) {
  if (record.muted || document.hidden) return;
  const Constructor = window.AudioContext || window.webkitAudioContext;
  if (!Constructor) return;
  const epoch = audioEpoch;
  try {
    audio ??= new Constructor();
    Promise.resolve(audio.resume()).then(() => {
      if (epoch !== audioEpoch || record.muted || document.hidden) return;
      try {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const t = audio.currentTime;
        oscillator.type = kind === 'lost' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(kind === 'won' ? 660 : kind === 'lost' ? 160 : 440, t);
        oscillator.frequency.exponentialRampToValueAtTime(kind === 'won' ? 990 : kind === 'lost' ? 65 : 540, t + .12);
        gain.gain.setValueAtTime(.045, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .16);
        oscillator.connect(gain); gain.connect(audio.destination);
        voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(t); oscillator.stop(t + .17);
      } catch { /* Audio is optional; visual feedback remains. */ }
    }).catch(() => {});
  } catch { /* Unavailable or denied audio is silent. */ }
}
function warning() {
  const label = storage.blocked ? '저장할 수 없습니다. 이 창에서는 플레이할 수 있지만 기록·설정은 창을 닫으면 사라질 수 있습니다.' : storage.recovered ? '이전 기록의 형식을 복구했습니다. 유효하지 않은 값은 기본값으로 돌아갑니다.' : '';
  $('storage-warning').hidden = !label;
  text($('storage-warning'), label);
}
function persist() { storage.save(record); warning(); }
function cancelGesture() {
  clearTimeout(holdTimer); holdTimer = null;
  if (gesture) gesture.canceled = true;
}
function clearInputs() { cancelGesture(); pointers.clear(); pressed.clear(); stopAudio(); }
function formatTime(ms, precise = false) {
  const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}${precise ? `.${String(ms % 1000).padStart(3, '0')}` : ''}`;
}
function focusCell(index, focus = true) {
  cells[roving].tabIndex = -1; roving = index; cells[roving].tabIndex = 0;
  if (focus) cells[roving].focus({ preventScroll: false });
}
for (let row = 0; row < 9; row++) {
  const line = document.createElement('div'); line.className = 'grid-row'; line.setAttribute('role', 'row');
  for (let col = 0; col < 9; col++) {
    const index = row * 9 + col, cell = document.createElement('button');
    cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = String(index);
    cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-rowindex', String(row + 1)); cell.setAttribute('aria-colindex', String(col + 1));
    cell.tabIndex = index === 0 ? 0 : -1;
    cell.addEventListener('focus', () => focusCell(index, false));
    line.append(cell); cells.push(cell);
  }
  grid.append(line);
}
function render() {
  const terminal = game.status === 'won' || game.status === 'lost';
  const playing = game.status === 'playing';
  grid.inert = !playing;
  for (let i = 0; i < 81; i++) {
    const cell = cells[i], open = game.opened[i], flag = game.flagged[i];
    const danger = terminal && game.mines[i], wrong = game.status === 'lost' && flag && !game.mines[i];
    const label = wrong ? '잘못된 깃발' : danger ? game.status === 'won' ? '위험한 바위 · 탐사 완료' : '위험한 바위' : open ? game.adjacent[i] === 0 ? '열린 빈 땅' : `열린 숫자 ${game.adjacent[i]}` : flag ? '깃발' : '닫힌 땅';
    const classes = `cell${open ? ' opened' : ''}${flag ? ' flagged' : ''}${danger ? ' danger' : ''}${wrong ? ' wrong' : ''}${game.exploded === i ? ' exploded' : ''}`;
    if (cell.className !== classes) cell.className = classes;
    text(cell, wrong ? '×' : danger ? '◆' : flag ? '⚑' : open ? game.adjacent[i] === 0 ? '·' : String(game.adjacent[i]) : '');
    const aria = `${Math.floor(i / 9) + 1}행 ${i % 9 + 1}열 · ${label}`;
    if (cell.getAttribute('aria-label') !== aria) cell.setAttribute('aria-label', aria);
    // Hidden cells never carry adjacency or mine metadata.
    if (open) cell.dataset.number = String(game.adjacent[i]); else delete cell.dataset.number;
  }
  text($('remaining'), String(10 - game.flagCount).padStart(2, '0'));
  text($('opened'), `${game.openedCount} / ${SAFE_COUNT}`);
  text($('time'), formatTime(timer.read()));
  text($('mode'), `깃발 모드: ${mode ? '켜짐' : '꺼짐'}`); $('mode').setAttribute('aria-pressed', String(mode));
  text($('mute'), `음소거: ${record.muted ? '켜짐' : '꺼짐'}`); $('mute').setAttribute('aria-pressed', String(record.muted));
  $('mode').disabled = !playing;
  $('pause').disabled = !playing;
  $('board-cover').hidden = playing || terminal;
  text($('cover-note'), game.status === 'ready' ? '첫 선택은 안전한 빈 땅입니다.' : `${pauseReason === 'manual' ? '탐사를 잠시 멈췄습니다.' : '지도를 보호하기 위해 멈췄습니다.'} 준비되면 직접 재개하세요.`);
  text($('start'), game.status === 'ready' ? '탐사 시작' : '탐사 재개');
  const status = game.status === 'ready' ? '준비 · 안전한 71칸을 찾아보세요.' : game.status === 'paused' ? '정지 · 시간과 지도는 그대로입니다.' : game.status === 'won' ? '탐사 완료 · 안전한 71칸을 모두 찾았습니다.' : game.status === 'lost' ? '탐사 실패 · 위험한 바위를 열었습니다.' : !game.armed ? '탐사 중 · 첫 칸을 열면 시간이 흐릅니다.' : mode ? '깃발 모드 · 누른 칸의 표식만 바꿉니다.' : '탐사 중 · 숫자를 살펴 안전한 땅을 여세요.';
  text($('status'), status);
  $('result').hidden = !terminal;
  $('limit-notice').hidden = record.finished < LIMIT;
  if (terminal) {
    text($('result-title'), game.status === 'won' ? '◇ 지도 한 장, 탐사 완료' : '◆ 여기에는 위험한 바위가 있었습니다');
    text($('result-detail'), `${formatTime(timer.read(), true)} · 안전칸 ${game.openedCount} / 71 · ${resultNote}`);
  }
  text($('best'), `최고 기록 · ${record.bestMs === null ? '아직 없음' : formatTime(record.bestMs, true)}`);
  text($('totals'), `완료 ${record.finished} · 성공 ${record.wins} · 실패 ${record.losses}`);
  warning();
}
function act(command, index) {
  if (dialog.open) return;
  const before = game, next = transition(game, command, index);
  if (next === before) return;
  if (command === 'reveal' && !before.armed && next.armed) timer.start();
  game = next;
  if ((game.status === 'won' || game.status === 'lost') && !settled) {
    settled = true; const elapsed = timer.finish();
    resultNote = record.finished >= LIMIT ? '기록 한도에 도달하여 이번 결과는 누적·최고 기록에 반영하지 않습니다.' : game.status === 'lost' ? '실패 시간은 성공 최고 기록을 덮지 않습니다.' : record.bestMs === null || elapsed < record.bestMs ? '개인 최고 기록을 갱신했습니다.' : elapsed === record.bestMs ? '개인 최고 기록과 동점입니다.' : '안전한 길을 모두 밝혔습니다.';
    record = settleRecord(record, game.status, elapsed); persist(); clearInputs(); sound(game.status);
  } else if (command === 'reveal') sound('open');
  render();
}
function pause(reason) {
  clearInputs();
  if (game.status !== 'playing') return;
  timer.pause(); game = transition(game, 'pause'); pauseReason = reason; render();
}
function newRound() {
  clearInputs(); gesture = null; lastHold = null; game = transition(createGame(), 'start');
  settled = false; mode = false; pauseReason = ''; timer.reset(); focusCell(0, false); render(); cells[0].focus();
}
function begin() {
  if (dialog.open) return;
  clearInputs(); gesture = null;
  if (game.status === 'ready') game = transition(game, 'start');
  else if (game.status === 'paused') { game = transition(game, 'resume'); if (game.armed) timer.start(); }
  render(); cells[roving].focus();
}
function openDialog(kind, trigger) {
  if (dialog.open) return;
  pause('modal'); clearInputs(); returnFocus = trigger; dialogKind = kind; preview = record.theme;
  $('help-panel').hidden = kind !== 'help'; $('theme-panel').hidden = kind !== 'theme';
  $('confirm-panel').hidden = kind !== 'restart' && kind !== 'home';
  $('dialog-apply').hidden = kind === 'help';
  text($('dialog-title'), kind === 'help' ? '탐사 안내' : kind === 'theme' ? '지도 테마' : kind === 'restart' ? '새 지도를 펼칠까요?' : '게임 서재로 돌아갈까요?');
  text($('confirm-panel'), kind === 'restart' ? '진행 중인 탐사는 종료합니다. 개인 기록·지도 테마·음소거 설정은 유지합니다. 취소하면 현재 지도와 정지 상태를 보존합니다.' : '현재 탐사는 저장하지 않습니다. 완료한 탐사 기록과 설정은 유지합니다.');
  text($('dialog-apply'), kind === 'theme' ? '적용' : kind === 'restart' ? '새 탐사 시작' : '서재로 돌아가기');
  text($('dialog-close'), kind === 'help' ? '닫기' : '취소');
  updateThemeButtons(); dialog.showModal();
  // The actual pointer trigger is stored, including on WebKit.
  (kind === 'theme' ? dialog.querySelector('[data-theme-choice]') : $('dialog-close')).focus();
}
function updateThemeButtons() {
  for (const button of dialog.querySelectorAll('[data-theme-choice]')) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preview));
}
function closeDialog(apply = false) {
  const kind = dialogKind, target = returnFocus;
  clearInputs();
  if (kind === 'theme' && apply) { record = { ...record, theme: preview }; persist(); }
  document.body.dataset.theme = record.theme;
  dialogKind = null; dialog.close();
  if (apply && kind === 'restart') { newRound(); return; }
  if (apply && kind === 'home') { window.location.assign('/'); return; }
  render();
  if (target?.isConnected && !target.disabled) target.focus({ preventScroll: true });
}
$('start').addEventListener('click', begin);
$('pause').addEventListener('click', () => { pause('manual'); $('start').focus(); });
$('mode').addEventListener('click', () => { cancelGesture(); if (game.status === 'playing') { mode = !mode; render(); } });
$('mute').addEventListener('click', () => { record = { ...record, muted: !record.muted }; if (record.muted) stopAudio(); else sound('open'); persist(); render(); });
$('help').addEventListener('click', event => openDialog('help', event.currentTarget));
$('theme').addEventListener('click', event => openDialog('theme', event.currentTarget));
$('restart').addEventListener('click', event => game.status === 'ready' || settled ? newRound() : openDialog('restart', event.currentTarget));
$('retry').addEventListener('click', newRound);
$('home').addEventListener('click', event => { if (game.status === 'playing' || game.status === 'paused') { event.preventDefault(); openDialog('home', event.currentTarget); } });
$('dialog-close').addEventListener('click', () => closeDialog());
$('dialog-apply').addEventListener('click', () => closeDialog(true));
for (const button of dialog.querySelectorAll('[data-theme-choice]')) button.addEventListener('click', () => {
  if (dialogKind !== 'theme' || !THEMES.includes(button.dataset.themeChoice)) return;
  preview = button.dataset.themeChoice; document.body.dataset.theme = preview; updateThemeButtons();
});
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
  const buttons = [...dialog.querySelectorAll('button,a[href],[tabindex]')].filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest('[hidden]'));
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
});
function cellFrom(target) { return target instanceof Element ? target.closest('.cell') : null; }
document.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') { pointers.add(event.pointerId); if (pointers.size > 1) cancelGesture(); }
}, true);
grid.addEventListener('pointerdown', event => {
  const cell = cellFrom(event.target);
  if (cell && event.pointerType === 'mouse' && event.button === 2) { cancelGesture(); gesture = null; lastHold = null; return; }
  if (!cell || event.button !== 0 || !event.isPrimary || game.status !== 'playing' || dialog.open || pointers.size > 1) return;
  cancelGesture();
  const index = Number(cell.dataset.index);
  gesture = { id: event.pointerId, index, x: event.clientX, y: event.clientY, held: false, canceled: false, ended: false };
  // Mouse uses right click for flags; holding a mouse button is still a normal click.
  if (event.pointerType !== 'mouse') holdTimer = setTimeout(() => {
    if (!gesture || gesture.canceled || gesture.ended || game.status !== 'playing' || dialog.open) return;
    gesture.held = true; lastHold = { index, until: performance.now() + 1200 }; act('flag', index);
  }, 450);
});
document.addEventListener('pointermove', event => { if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) cancelGesture(); }, true);
document.addEventListener('pointerup', event => {
  pointers.delete(event.pointerId);
  if (gesture?.id === event.pointerId) { clearTimeout(holdTimer); holdTimer = null; gesture.ended = true; }
}, true);
document.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); if (gesture?.id === event.pointerId) cancelGesture(); }, true);
grid.addEventListener('lostpointercapture', event => {
  // Touch implicit capture ends after a normal pointerup, before native click.
  // Only losing capture during an active hold cancels the gesture.
  if (gesture?.id === event.pointerId && !gesture.ended) cancelGesture();
});
$('map-window').addEventListener('scroll', cancelGesture, { passive: true });
window.addEventListener('scroll', cancelGesture, { passive: true });
grid.addEventListener('click', event => {
  const cell = cellFrom(event.target); if (!cell) return;
  const index = Number(cell.dataset.index), previous = gesture; gesture = null; clearTimeout(holdTimer);
  if (previous?.index === index && (previous.canceled || previous.held)) return;
  if (event.detail !== 0 && (!previous || previous.index !== index || !previous.ended)) return;
  act(mode ? 'flag' : 'reveal', index);
});
grid.addEventListener('contextmenu', event => {
  const cell = cellFrom(event.target); if (!cell) return;
  event.preventDefault(); const index = Number(cell.dataset.index);
  if (lastHold?.index === index && performance.now() < lastHold.until) return;
  if (gesture?.canceled && gesture.index === index) return;
  cancelGesture(); act('flag', index);
});
grid.addEventListener('keydown', event => {
  const cell = cellFrom(event.target);
  if (!cell || dialog.open || game.status !== 'playing' || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key, index = Number(cell.dataset.index);
  const arrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  const flag = key === 'f' || key === 'F' || (key === 'F10' && event.shiftKey);
  if (!arrow && !flag && key !== 'Enter' && key !== ' ' && key !== 'Escape') return;
  event.preventDefault();
  if (event.repeat || pressed.has(event.code || key)) return;
  pressed.add(event.code || key); cancelGesture();
  if (key === 'Escape') { pause('protect'); $('start').focus(); return; }
  if (arrow) {
    const row = Math.floor(index / 9), col = index % 9;
    const next = key === 'ArrowLeft' ? (col ? index - 1 : index) : key === 'ArrowRight' ? (col < 8 ? index + 1 : index) : key === 'ArrowUp' ? (row ? index - 9 : index) : row < 8 ? index + 9 : index;
    focusCell(next); return;
  }
  act(flag ? 'flag' : 'reveal', index);
});
document.addEventListener('keyup', event => pressed.delete(event.code || event.key), true);
// Prevent auto-repeating native button activation without changing the first press.
document.addEventListener('keydown', event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) event.preventDefault(); }, true);
window.addEventListener('blur', () => pause('protect'));
window.addEventListener('pagehide', () => pause('protect'));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause('protect'); });
Object.defineProperty(window, '__g025Snapshot', { value: () => structuredClone({ game, record, mode, elapsedMs: timer.read(), settled, pauseReason, dialog: dialogKind, preview, storageBlocked: storage.blocked }), writable: false, configurable: false });
document.body.dataset.theme = record.theme; render();
function frame() { text($('time'), formatTime(timer.read())); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
