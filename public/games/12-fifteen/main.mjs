import {createGame, start, pause, resume, beginPreview, endPreview, moveTile, moveDirection, undo, elapsed} from './engine.mjs';
import {PUZZLES, MODE_IDS, goalBoard} from './puzzles.mjs';
import {THEMES, loadSave, writeSave, settleRecord} from './save.mjs';

const $ = id => document.getElementById(id);
const setText = (node, text) => { if (node.textContent !== String(text)) node.textContent = String(text); };
const now = () => performance.now();
const loaded = loadSave(() => window.localStorage);
let save = loaded.save, storageBlocked = loaded.blocked, recovered = loaded.recovered;
let state = createGame(), settled = false, improved = false;
let tiles = [], goalTiles = [], drawnSize = 0;
let gesture = null, goalPointer = null, goalKey = null;
const pointers = new Set(), keys = new Set();
let modalType = null, modalTrigger = null, pendingMode = state.modeId, pendingTheme = save.theme;
let audio = null;
const tones = new Set();
const themeNames = {cream: '크림 엽서', meadow: '초원 엽서', evening: '저녁 엽서'};

function persist() {
  if (!writeSave(() => window.localStorage, save)) storageBlocked = true;
  recovered = false;
}
function stopSound() {
  for (const oscillator of tones) { try { oscillator.stop(); } catch { /* already stopped */ } }
  tones.clear();
  if (audio?.state === 'running') void audio.suspend().catch(() => {});
}
function sound(won = false) {
  if (save.muted) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    const t = audio.currentTime;
    oscillator.frequency.setValueAtTime(won ? 660 : 330, t);
    gain.gain.setValueAtTime(0.035, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    tones.add(oscillator); oscillator.onended = () => tones.delete(oscillator);
    oscillator.start(t); oscillator.stop(t + 0.1);
  } catch { /* Sound is optional. Visual/text feedback is authoritative. */ }
}
function commit(next, withSound = false) {
  if (next === state) return;
  state = next;
  if (state.status === 'won' && !settled) {
    settled = true;
    const result = settleRecord(save, state.modeId, state.moveCount, state.elapsedMs);
    save = result.save; improved = result.improved; persist();
  }
  if (withSound) sound(state.status === 'won');
  render();
}
function reset(modeId = state.modeId) {
  cancelInputs(); stopSound(); state = createGame(modeId); settled = false; improved = false; render();
}
function releaseGoal() {
  goalPointer = null; goalKey = null;
  commit(endPreview(state, now()));
}
function cancelInputs() {
  gesture = null; pointers.clear(); keys.clear(); releaseGoal();
}
function protect() {
  // Pause first: releasing a held preview must never auto-resume after a blur.
  state = pause(state, now(), 'protection');
  cancelInputs(); stopSound(); render();
}
function active() { return state.status === 'playing' && !state.preview && !$('modal').open; }
function forward(index) { if (active()) commit(moveTile(state, index, now()), true); }
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
function buildBoard() {
  if (drawnSize === state.size) return;
  drawnSize = state.size;
  $('board').replaceChildren(); $('goal-board').replaceChildren(); tiles = []; goalTiles = [];
  for (let i = 0; i < state.size * state.size; i++) {
    const tile = document.createElement('button');
    tile.className = 'tile'; tile.dataset.index = String(i); tile.type = 'button';
    tile.addEventListener('click', event => {
      // Pointer movement commits only on the validated pointerup path.
      if (event.detail === 0 && !gesture && !goalKey && !goalPointer) forward(i);
    });
    $('board').append(tile); tiles.push(tile);
    const goal = document.createElement('div'); goal.className = 'tile'; $('goal-board').append(goal); goalTiles.push(goal);
  }
  $('board').classList.toggle('three', state.size === 3);
  $('goal-board').classList.toggle('three', state.size === 3);
  goalBoard(state.size).forEach((value, i) => { setText(goalTiles[i], value || '빈칸'); goalTiles[i].classList.toggle('blank', !value); });
}
function render() {
  buildBoard();
  document.body.dataset.theme = modalType === 'theme' ? pendingTheme : save.theme;
  const locked = !active();
  $('board').dataset.locked = String(locked); $('board').setAttribute('aria-disabled', String(locked));
  state.board.forEach((value, i) => {
    const tile = tiles[i];
    setText(tile, value || '빈칸');
    tile.setAttribute('aria-label', value ? `${value}번 편지, ${Math.floor(i / state.size) + 1}행 ${i % state.size + 1}열` : '빈칸');
    tile.classList.toggle('blank', value === 0);
    const adjacent = Math.abs(Math.floor(i / state.size) - Math.floor(state.blank / state.size)) + Math.abs(i % state.size - state.blank % state.size) === 1;
    tile.classList.toggle('adjacent', adjacent && !locked);
    tile.setAttribute('aria-disabled', String(locked || !adjacent));
  });
  setText($('puzzle-label'), PUZZLES[state.modeId].label);
  setText($('mode'), state.size === 3 ? '입문 3×3' : `고정 퍼즐 ${PUZZLES[state.modeId].steps}`);
  setText($('moves'), state.moveCount);
  setText($('timer'), formatTime(elapsed(state, now())));
  setText($('blank-position'), `${Math.floor(state.blank / state.size) + 1}, ${state.blank % state.size + 1}`);
  setText($('undo-count'), `되돌리기 ${state.undoCount}회 · 이동 수에는 되돌린 이동도 포함됩니다.`);
  $('start').hidden = state.status !== 'ready';
  $('pause').hidden = !['playing', 'paused'].includes(state.status);
  setText($('pause'), state.status === 'paused' ? '재개' : '일시정지');
  $('undo').disabled = locked || !state.history.length;
  $('goal').disabled = state.status === 'won';
  $('goal').setAttribute('aria-pressed', String(state.preview));
  $('goal-overlay').hidden = !state.preview;
  $('result').hidden = state.status !== 'won';
  const messages = {ready: '시작을 누르면 편지 정리를 시작합니다.', playing: state.started ? '빈칸 옆 편지를 한 장씩 정리하세요.' : '첫 유효 이동부터 시간이 흐릅니다.', paused: state.pauseReason === 'protection' ? '화면을 벗어나 보호 정지했습니다. 재개를 눌러 주세요.' : '정지 중입니다. 재개를 눌러 계속하세요.', won: '모든 편지가 제자리에 도착했습니다!'};
  setText($('state-message'), state.preview ? '목표 미리보기 — 진행은 유지됩니다' : messages[state.status]);
  if (state.status === 'won') setText($('result-detail'), `${state.moveCount}회 이동 · ${formatTime(state.elapsedMs)} (${state.elapsedMs}ms) · 되돌리기 ${state.undoCount}회${improved ? ' · 새 개인 최고 기록!' : ' · 완료 기록을 남겼습니다.'}`);
  const record = save.records[state.modeId];
  setText($('record'), record.wins ? `완성 ${record.wins}회 · 최고 ${record.bestMoves}회 이동 / ${formatTime(record.bestMs)} (${record.bestMs}ms). 이동 수 우선, 같은 이동 수에서 시간 우선입니다.` : '아직 완성한 엽서가 없습니다.');
  setText($('mute'), `음소거: ${save.muted ? '켜짐' : '꺼짐'}`); $('mute').setAttribute('aria-pressed', String(save.muted));
  $('storage-warning').hidden = !storageBlocked && !recovered;
  setText($('storage-warning'), storageBlocked ? '저장소를 사용할 수 없습니다. 이번 화면에서는 계속 플레이할 수 있지만 기록과 설정이 기기에 남지 않을 수 있습니다.' : '일부 저장값을 확인할 수 없어 안전한 기본값으로 복구했습니다. 다른 게임의 기록은 변경하지 않았습니다.');
}

function button(text, onClick) {
  const node = document.createElement('button'); node.type = 'button'; setText(node, text); node.addEventListener('click', onClick); return node;
}
function paragraph(text) { const p = document.createElement('p'); setText(p, text); return p; }
function openModal(type, trigger) {
  if ($('modal').open) return;
  state = pause(state, now(), 'modal'); cancelInputs(); stopSound();
  modalType = type; modalTrigger = trigger; pendingMode = state.modeId; pendingTheme = save.theme;
  $('modal-content').replaceChildren(); $('modal-apply').hidden = false;
  setText($('modal-close'), '취소');
  if (type === 'help') {
    setText($('modal-title'), '편지 정리 안내'); $('modal-apply').hidden = true; setText($('modal-close'), '닫기');
    $('modal-content').append(paragraph('빈칸과 상하좌우로 붙은 편지 한 장만 움직입니다. 대각선이나 멀리 있는 편지는 움직이지 않습니다.'), paragraph('숫자를 왼쪽 위부터 순서대로 놓고 오른쪽 아래를 비우면 완성입니다. 판에 초점을 둔 상태에서 방향키는 빈칸 방향, U는 되돌리기입니다.'), paragraph('목표 보기는 누르는 동안만 보입니다. 목표 보기·정지·화면 이탈 중 시간은 흐르지 않습니다. 첫 유효 이동부터 시간을 잽니다.'), paragraph('되돌려도 이동 수는 줄지 않습니다. 섞기 8/20/60/120회는 최단해 길이가 아닙니다. 퍼즐과 기록은 모드별로 나뉩니다. 모달을 닫은 뒤에는 재개를 눌러 주세요.'));
  } else if (type === 'mode' || type === 'theme') {
    setText($('modal-title'), type === 'mode' ? '정리할 엽서 선택' : '엽서 테마');
    setText($('modal-apply'), type === 'mode' ? '이 퍼즐로 새로 시작' : '테마 적용');
    const choices = document.createElement('div'); choices.className = 'choices';
    const ids = type === 'mode' ? MODE_IDS : THEMES;
    for (const id of ids) {
      const choice = button(type === 'mode' ? PUZZLES[id].label : themeNames[id], () => {
        if (type === 'mode') pendingMode = id; else pendingTheme = id;
        for (const node of choices.children) node.setAttribute('aria-pressed', String(node.dataset.id === id));
        render();
      });
      choice.dataset.id = id; choice.setAttribute('aria-pressed', String(id === (type === 'mode' ? pendingMode : pendingTheme)));
      if (type === 'theme') { const swatch = document.createElement('span'); swatch.className = `swatch ${id}`; swatch.setAttribute('aria-hidden', 'true'); choice.append(swatch); }
      choices.append(choice);
    }
    $('modal-content').append(choices, paragraph(type === 'mode' ? '적용하면 진행 중인 판은 사라집니다. 취소하면 배열과 이력은 유지되며, 재개가 필요합니다. 같은 ID는 언제나 같은 배열입니다.' : '미리보기는 외형만 바꿉니다. 취소하면 이전 테마로 돌아갑니다. 기록과 퍼즐은 그대로입니다.'));
  } else {
    setText($('modal-title'), type === 'home' ? '게임 서재로 돌아갈까요?' : '같은 엽서를 다시 정리할까요?');
    setText($('modal-apply'), type === 'home' ? '서재로 돌아가기' : '다시 시작');
    $('modal-content').append(paragraph('현재 판의 진행은 사라지지만 기록과 테마는 유지됩니다. 취소하면 배열·이력·정지 상태를 유지합니다.'));
  }
  $('modal').showModal(); render();
  $('modal-content').querySelector('button')?.focus();
}
function closeModal(apply = false) {
  if (!$('modal').open) return;
  const type = modalType, trigger = modalTrigger;
  // Clear transient input before dialog close to prevent click/key delivery to tiles.
  cancelInputs(); modalType = null; modalTrigger = null;
  if (apply && type === 'theme') { save = {...save, theme: pendingTheme}; persist(); }
  if (apply && type === 'mode') reset(pendingMode);
  if (apply && type === 'restart') reset();
  $('modal').close(); render();
  if (trigger?.isConnected && !trigger.hidden && !trigger.disabled) trigger.focus();
  if (apply && type === 'home') window.location.assign('/');
}
$('modal-close').addEventListener('click', () => closeModal());
$('modal-apply').addEventListener('click', () => closeModal(true));
$('modal').addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
$('modal').addEventListener('keydown', event => {
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
  const nodes = [...$('modal').querySelectorAll('button,a[href],[tabindex]')].filter(n => !n.disabled && n.tabIndex >= 0 && n.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (!nodes.length) return;
  if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
});
for (const [id, type] of [['mode', 'mode'], ['theme', 'theme'], ['help', 'help'], ['restart', 'restart']]) $(id).addEventListener('click', event => openModal(type, event.currentTarget));
$('home').addEventListener('click', event => { if (state.status !== 'ready' && state.status !== 'won') { event.preventDefault(); openModal('home', event.currentTarget); } });
$('start').addEventListener('click', () => { cancelInputs(); commit(start(state)); $('board').focus(); });
$('pause').addEventListener('click', () => {
  const wasPaused = state.status === 'paused'; cancelInputs(); stopSound();
  commit(wasPaused ? resume(state, now()) : pause(state, now()));
  if (wasPaused) $('board').focus();
});
$('undo').addEventListener('click', () => { if (active()) commit(undo(state)); });
$('retry').addEventListener('click', () => reset());
$('mute').addEventListener('click', () => { save = {...save, muted: !save.muted}; if (save.muted) stopSound(); else sound(); persist(); render(); });

// Document capture sees an additional finger even outside the board.
document.addEventListener('pointerdown', event => {
  pointers.add(event.pointerId);
  if (pointers.size > 1 || !event.isPrimary) { gesture = null; releaseGoal(); return; }
  if (event.button !== 0 || $('modal').open) return;
  if (event.target.closest('#goal') && !event.target.disabled) {
    goalPointer = event.pointerId; gesture = null; commit(beginPreview(state, now()));
    try { $('goal').setPointerCapture(event.pointerId); } catch { /* document release remains active */ }
    return;
  }
  const tile = event.target.closest('#board .tile');
  if (tile && active()) {
    gesture = {id: event.pointerId, index: Number(tile.dataset.index), x: event.clientX, y: event.clientY};
    try { tile.setPointerCapture(event.pointerId); } catch { /* document release remains active */ }
  }
}, true);
document.addEventListener('pointermove', event => {
  if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture = null;
}, true);
document.addEventListener('pointerup', event => {
  const candidate = gesture;
  gesture = null; pointers.delete(event.pointerId);
  if (goalPointer === event.pointerId) { releaseGoal(); return; }
  if (!candidate || candidate.id !== event.pointerId || !event.isPrimary || pointers.size || !active()) return;
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('#board .tile');
  if (hit && Number(hit.dataset.index) === candidate.index && Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= 8) forward(candidate.index);
}, true);
for (const type of ['pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
  if (gesture?.id === event.pointerId) gesture = null;
  pointers.delete(event.pointerId);
  if (goalPointer === event.pointerId) releaseGoal();
}, true);
$('goal').addEventListener('click', event => event.preventDefault());
$('goal').addEventListener('keydown', event => {
  if (![' ', 'Enter'].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || $('modal').open) return;
  event.preventDefault();
  if (event.repeat || keys.has(event.code) || goalKey) return;
  keys.add(event.code); goalKey = event.code; commit(beginPreview(state, now()));
});
$('goal').addEventListener('blur', () => { if (goalKey) releaseGoal(); });
const arrows = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'};
$('board').addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !active()) return;
  if (['Enter', ' '].includes(event.key) && event.target.closest('#board .tile')) {
    event.preventDefault();
    if (event.repeat || keys.has(event.code)) return;
    keys.add(event.code); gesture = null;
    forward(Number(event.target.closest('#board .tile').dataset.index));
    return;
  }
  const direction = Object.hasOwn(arrows, event.key) ? arrows[event.key] : null;
  if (!direction && event.key.toLowerCase() !== 'u') return;
  event.preventDefault();
  if (event.repeat || keys.has(event.code)) return;
  keys.add(event.code); gesture = null;
  commit(direction ? moveDirection(state, direction, now()) : undo(state), Boolean(direction));
});
document.addEventListener('keyup', event => { keys.delete(event.code); if (goalKey === event.code) releaseGoal(); }, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && goalKey) releaseGoal();
  const target = event.target.closest('button');
  if (!target || target.id === 'goal' || target.closest('#board') || ![' ', 'Enter'].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.repeat || keys.has(event.code)) event.preventDefault();
  else keys.add(event.code);
}, true);
window.addEventListener('blur', protect);
window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); });
Object.defineProperty(window, '__g025Snapshot', {value: () => JSON.parse(JSON.stringify({game: {...state, elapsedMs: elapsed(state, now())}, save, storageBlocked, recovered, settled, improved, modal: modalType})), writable: false, configurable: false});
render();
function tick() {
  // Never replace button or child text in the animation loop (WebKit held-click safety).
  setText($('timer'), formatTime(elapsed(state, now())));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
