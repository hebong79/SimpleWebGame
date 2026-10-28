import { createGame, start, pause, resume, finish, input, advance } from './engine.js';
import { createStore, settleRecord, equipRecord, owned, PARTS, SETS, SET_NAMES } from './save.js';
import { drawWorld, drawPreview } from './art.js';
const $ = (id) => document.getElementById(id);
const text = (element, value) => { const s = String(value); if (element.textContent !== s) element.textContent = s; };
const store = createStore();
let record = store.read(), state = createGame(), recorded = false;
let lastArrival = performance.now(), pointer = null, focusSerial = 0, confirmAction = null;
let draft = { ...record.equipped }, previewDirection = 0, previewPose = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const world = $('world').getContext('2d'); world.scale(2, 2);
const preview = $('preview').getContext('2d'); preview.scale(2, 2);
const modals = [];
let audioContext = null, audioBroken = false, audioEpoch = 0;
const voices = new Set();
function stopAudio() {
  audioEpoch++;
  for (const voice of voices) { try { voice.stop(); } catch { /* already ended */ } }
  voices.clear();
  try { audioContext?.suspend()?.catch(() => {}); } catch { /* sound never blocks play */ }
}
function audioFailure() {
  audioBroken = true; text($('audio-warning'), '이 브라우저에서는 효과음을 사용할 수 없습니다. 소리 없이 계속 플레이할 수 있어요.');
  $('audio-warning').hidden = false;
}
function sound(kind) {
  if (record.muted || audioBroken || document.hidden) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio unavailable');
    audioContext ??= new Context();
    const context = audioContext;
    const epoch = audioEpoch;
    const play = () => {
      if (epoch !== audioEpoch || record.muted || !['playing', 'result'].includes(state.mode)) return;
      try {
        const voice = context.createOscillator(), gain = context.createGain();
        const t = context.currentTime;
        voice.type = kind === 'collision' ? 'triangle' : 'sine';
        voice.frequency.setValueAtTime(kind === 'collision' ? 190 : 620, t);
        voice.frequency.exponentialRampToValueAtTime(kind === 'collision' ? 65 : 850, t + 0.09);
        gain.gain.setValueAtTime(0.035, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        voice.connect(gain); gain.connect(context.destination); voices.add(voice);
        voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        voice.start(); voice.stop(t + 0.13);
      } catch { audioFailure(); }
    };
    context.resume().then(play).catch(audioFailure);
  } catch { audioFailure(); }
}
function clearInput() { pointer = null; state.queued = null; }
function protectedPause(reason) {
  if (pause(state, reason)) { clearInput(); stopAudio(); }
  lastArrival = performance.now();
  render();
}
function tickArrival(now = performance.now()) {
  const delta = Math.max(0, now - lastArrival); lastArrival = Math.max(lastArrival, now);
  if (state.mode === 'playing') {
    if (delta >= 250) protectedPause('long-frame');
    else advance(state, delta / 1000);
  }
  checkResult();
}
function returnFocus(trigger, serial) {
  const restore = () => {
    if (serial !== focusSerial || !trigger?.isConnected || trigger.closest('dialog')?.open === false) return;
    trigger.focus({ preventScroll: true });
  };
  restore(); requestAnimationFrame(restore); setTimeout(restore, 250);
}
function openModal(dialog, trigger, { result = false } = {}) {
  ++focusSerial;
  if (!result) { tickArrival(); if (state.mode === 'result' && dialog !== $('wardrobe-dialog')) return; }
  if (state.mode === 'playing') pause(state, 'dialog');
  clearInput(); stopAudio(); lastArrival = performance.now();
  modals.push({ dialog, trigger }); dialog.showModal(); render();
  const first = dialog.querySelector('button:not(:disabled)'); first?.focus();
}
function closeModal(dialog, restore = true) {
  const at = modals.findIndex((m) => m.dialog === dialog);
  if (at < 0) return;
  const [{ trigger }] = modals.splice(at, 1);
  dialog.close(); const serial = ++focusSerial;
  clearInput(); lastArrival = performance.now();
  if (restore) returnFocus(trigger, serial);
  render();
}
function render() {
  text($('score'), state.highest); text($('best'), record.bestRows);
  text($('plays'), record.plays); text($('total'), record.totalRows);
  const labels = { ready: '소풍 시작', playing: '잠깐 쉬기', paused: '소풍 재개', result: '결과 보기' };
  text($('primary'), labels[state.mode]);
  text($('mute'), record.muted ? '소리 꺼짐' : '소리 켜짐');
  $('mute').setAttribute('aria-pressed', String(record.muted));
  $('veil').hidden = state.mode === 'playing';
  const reason = { manual: '잠깐 쉬어도 괜찮아요.', dialog: '메뉴를 닫은 뒤 직접 재개해 주세요.', blur: '창을 벗어나 안전하게 멈췄어요.', hidden: '탭을 벗어나 안전하게 멈췄어요.', 'long-frame': '화면 지연을 감지해 안전하게 멈췄어요.' };
  text($('veil-title'), state.mode === 'ready' ? '오늘은 어디까지 갈까요?' : state.mode === 'paused' ? '풀밭에서 잠깐 쉬는 중' : '오늘도 잘 다녀왔어요!');
  text($('veil-copy'), state.mode === 'ready' ? '시작을 누르고, 한 칸씩 앞으로!' : state.mode === 'paused' ? (reason[state.pauseReason] || '소풍 재개 버튼을 눌러 주세요.') : '다음 소풍도 함께해요.');
  const warned = state.mode === 'playing' && state.idleAge >= 8;
  $('idle-warning').hidden = !warned;
  if (warned) text($('idle-warning'), `앞으로 한 걸음! ${Math.max(1, Math.ceil(10 - state.idleAge))}초 뒤 소풍이 끝나요.`);
  $('idle-meter').value = state.idleAge;
  text($('game-status'), state.mode === 'playing' ? (state.hop ? '폴짝! 다음 한 걸음은 한 번만 예약돼요.' : '차량의 빈틈을 보고 앞으로 나아가세요.') : state.mode === 'ready' ? '준비됐어요. 시작 버튼을 눌러 주세요.' : state.mode === 'paused' ? '게임 시간과 차량이 멈췄습니다. 직접 재개해 주세요.' : '완료한 소풍 기록을 정산했습니다.');
  const warning = store.warning(); $('storage-warning').hidden = !warning; if (warning) text($('storage-warning'), warning);
  drawWorld(world, state, record.equipped, reduced.matches);
}
function checkResult() {
  if (state.mode !== 'result' || recorded) return;
  recorded = true; clearInput(); stopAudio();
  const before = record;
  try { record = store.update(settleRecord(record, state.highest)); }
  catch { store.warn('기록의 안전한 정수 한도에 도달해 이번 소풍을 저장하지 못했습니다.'); }
  text($('result-score'), state.highest);
  text($('result-reason'), state.reason === 'collision' ? '차량과 만났어요. 다음에는 조금 더 천천히!' : state.reason === 'idle' ? '한 곳에서 오래 쉬었어요. 다음 길에서 또 만나요.' : '직접 소풍을 마쳤어요. 지금까지의 발걸음을 남깁니다.');
  text($('result-record'), `${state.highest > before.bestRows ? '새로운 개인 최고! · ' : ''}개인 최고 ${record.bestRows}줄 · 누적 ${record.totalRows}줄`);
  const unlocked = SETS.filter((s) => !owned(before, s) && owned(record, s)).map((s) => SET_NAMES[s]);
  text($('result-unlock'), unlocked.length ? `${unlocked.join(', ')} 차림이 열렸어요!` : '한 걸음 한 걸음, 다음 소풍으로 이어져요.');
  openModal($('result-dialog'), $('primary'), { result: true });
  if (state.reason === 'collision') sound('collision');
}
function newRound() {
  ++focusSerial; clearInput(); stopAudio();
  state = createGame(); recorded = false; lastArrival = performance.now(); render(); $('primary').focus();
}
function actPrimary() {
  ++focusSerial;
  const previousMode = state.mode;
  tickArrival();
  // A delayed click intended as "pause" must not double as explicit protected resume.
  if (previousMode === 'playing' && state.mode === 'paused') return;
  if (modals.length) return;
  if (state.mode === 'ready') start(state);
  else if (state.mode === 'playing') { protectedPause('manual'); $('primary').focus(); return; }
  else if (state.mode === 'paused') resume(state);
  else { openModal($('result-dialog'), $('primary'), { result: true }); return; }
  clearInput(); lastArrival = performance.now(); render(); $('arena').focus({ preventScroll: true });
}
function move(direction) {
  ++focusSerial; tickArrival();
  if (modals.length || state.mode !== 'playing') return false;
  const accepted = input(state, direction);
  if (accepted) sound('move'); render(); return accepted;
}
$('primary').addEventListener('click', actPrimary);
function askFinish(action, trigger) {
  tickArrival();
  if (state.mode === 'result') { if (action === 'home') location.assign('/'); else newRound(); return; }
  if (state.mode === 'ready') { if (action === 'home') location.assign('/'); else newRound(); return; }
  confirmAction = action;
  text($('confirm-title'), action === 'home' ? '소풍을 마치고 목록으로 갈까요?' : '지금 소풍을 마치고 다시 준비할까요?');
  text($('confirm-copy'), '마치기를 누르면 현재 기록을 한 번 정산해 결과를 보여드립니다. 취소하면 발걸음과 기록은 그대로이며, 재개를 직접 눌러 주세요.');
  openModal($('confirm-dialog'), trigger);
}
$('restart').addEventListener('click', (e) => askFinish('restart', e.currentTarget));
$('home').addEventListener('click', (e) => askFinish('home', e.currentTarget));
$('confirm-cancel').addEventListener('click', () => { confirmAction = null; closeModal($('confirm-dialog')); });
$('confirm-yes').addEventListener('click', () => {
  if (!confirmAction) return;
  confirmAction = null; closeModal($('confirm-dialog'), false);
  finish(state, 'quit'); checkResult(); render();
});
$('help').addEventListener('click', (e) => openModal($('help-dialog'), e.currentTarget));
$('help-close').addEventListener('click', () => closeModal($('help-dialog')));
$('mute').addEventListener('click', () => {
  ++focusSerial; tickArrival();
  record = store.update({ ...record, muted: !record.muted });
  if (record.muted) stopAudio(); else if (state.mode === 'playing') sound('move');
  render();
});
$('retry').addEventListener('click', () => { closeModal($('result-dialog'), false); newRound(); });
$('result-home').addEventListener('click', () => location.assign('/'));
for (const button of document.querySelectorAll('[data-direction]')) button.addEventListener('click', () => { move(button.dataset.direction); if (state.mode === 'playing') $('arena').focus({ preventScroll: true }); });
const directionNames = ['앞', '오른쪽', '뒤', '왼쪽'];
const directions = ['down', 'right', 'up', 'left'];
const poseNames = ['서기', '점프', '착지', '실패'];
const poses = ['stand', 'hop', 'land', 'fail'];
const partNames = { hat: '모자', top: '상의', backpack: '배낭' };
const setButtons = new Map();
for (const set of SETS) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.set = set;
  const label = document.createElement('span'); label.textContent = SET_NAMES[set];
  const description = document.createElement('small');
  button.append(label, description); $('set-list').append(button); setButtons.set(set, { button, description });
  button.addEventListener('click', () => { draft = Object.fromEntries(PARTS.map((p) => [p, set])); renderWardrobe(); });
}
function renderWardrobe() {
  for (const [set, { button, description }] of setButtons) {
    button.setAttribute('aria-pressed', String(PARTS.every((p) => draft[p] === set)));
    text(description, set === 'basic' ? '항상 함께하는 기본 몸체' : set === 'straw' ? '무료 · 처음부터 내 차림' : set === 'firefighter' ? `누적 300줄 · ${record.totalRows}/300${owned(record, set) ? ' · 보유' : ' · 잠김'}` : `최고 50줄 · ${record.bestRows}/50${owned(record, set) ? ' · 보유' : ' · 잠김'}`);
  }
  for (const p of PARTS) text($(`part-${p}`), `${partNames[p]}: ${SET_NAMES[draft[p]]}${owned(record, draft[p]) ? '' : ' (잠김)'}`);
  const locked = PARTS.some((p) => !owned(record, draft[p]));
  $('wardrobe-apply').disabled = locked;
  text($('wardrobe-info'), locked ? '잠긴 차림은 미리보기만 가능해요. 조건을 달성한 뒤 장착할 수 있습니다.' : '보유한 부위를 자유롭게 섞을 수 있어요. 장착 전에는 게임 차림이 바뀌지 않습니다.');
  text($('preview-direction'), `방향: ${directionNames[previewDirection]}`);
  text($('preview-pose'), `동작: ${poseNames[previewPose]}`);
  $('preview').setAttribute('aria-label', `${directionNames[previewDirection]} 방향 ${poseNames[previewPose]} 동작, 모자 ${SET_NAMES[draft.hat]}, 상의 ${SET_NAMES[draft.top]}, 배낭 ${SET_NAMES[draft.backpack]}`);
  drawPreview(preview, draft, directions[previewDirection], poses[previewPose], 0.5);
}
function wardrobe(trigger) { draft = { ...record.equipped }; previewDirection = 0; previewPose = 0; renderWardrobe(); openModal($('wardrobe-dialog'), trigger, { result: state.mode === 'result' }); }
$('wardrobe').addEventListener('click', (e) => wardrobe(e.currentTarget));
$('result-wardrobe').addEventListener('click', (e) => wardrobe(e.currentTarget));
for (const p of PARTS) $(`part-${p}`).addEventListener('click', () => { draft[p] = SETS[(SETS.indexOf(draft[p]) + 1) % SETS.length]; renderWardrobe(); });
$('preview-direction').addEventListener('click', () => { previewDirection = (previewDirection + 1) % 4; renderWardrobe(); });
$('preview-pose').addEventListener('click', () => { previewPose = (previewPose + 1) % 4; renderWardrobe(); });
$('wardrobe-cancel').addEventListener('click', () => closeModal($('wardrobe-dialog')));
$('wardrobe-apply').addEventListener('click', () => {
  if (!$('wardrobe-dialog').open) return;
  const next = equipRecord(record, draft); if (!next) return;
  record = store.update(next); closeModal($('wardrobe-dialog')); render();
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (dialog.id === 'result-dialog') return;
  if (dialog.id === 'confirm-dialog') confirmAction = null;
  closeModal(dialog);
});
document.addEventListener('keydown', (e) => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; }
  const modal = modals.at(-1)?.dialog;
  if (!modal) return;
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
  const buttons = [...modal.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter((b) => b.getClientRects().length > 0);
  if (!buttons.length) { e.preventDefault(); return; }
  const index = buttons.indexOf(document.activeElement);
  if (e.shiftKey ? index <= 0 : index === buttons.length - 1 || index < 0) {
    e.preventDefault(); buttons[e.shiftKey ? buttons.length - 1 : 0].focus();
  }
}, true);
$('arena').addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || modals.length) return;
  const mapping = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) protectedPause('manual'); $('primary').focus(); return; }
  if (mapping[e.key]) { e.preventDefault(); if (!e.repeat) move(mapping[e.key]); }
});
// Observe every pointer before arena handlers, including a second finger OUTSIDE the arena.
const activePointers = new Set();
document.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  if (activePointers.size > 1 || !e.isPrimary) pointer = null;
}, true);
document.addEventListener('pointerup', (e) => { activePointers.delete(e.pointerId); }, true);
document.addEventListener('pointercancel', (e) => { activePointers.delete(e.pointerId); pointer = null; }, true);
$('arena').addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || e.button !== 0 || activePointers.size > 1 || state.mode !== 'playing' || modals.length) return;
  tickArrival(); if (state.mode !== 'playing') return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; $('arena').focus({ preventScroll: true });
  $('arena').setPointerCapture(e.pointerId);
});
$('arena').addEventListener('pointerup', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y; pointer = null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.max(ax, ay) < 24) move('up');
  else if (ax > ay) move(dx > 0 ? 'right' : 'left');
  else if (ay > ax && dy > 0) move('down');
});
$('arena').addEventListener('lostpointercapture', () => { pointer = null; });
window.addEventListener('blur', () => { activePointers.clear(); clearInput(); stopAudio(); protectedPause('blur'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { activePointers.clear(); clearInput(); stopAudio(); protectedPause('hidden'); } });
// The only observability hook returns a NEW clone; no browser-state mutation API exists.
Object.defineProperty(window, '__simpleGames09Snapshot', { value: () => structuredClone({ ...state,
  record, storageWarning: store.warning(), dialog: modals.at(-1)?.dialog.id ?? null,
  preview: $('wardrobe-dialog').open ? { equipped: draft, direction: directions[previewDirection], pose: poses[previewPose] } : null,
  input: { gesture: pointer !== null, pointerCount: activePointers.size } }), writable: false, configurable: false });
function frame() {
  // Native RAF timestamps can be stale after main-thread stalls: use callback ARRIVAL time.
  tickArrival(performance.now()); render();
  if ($('wardrobe-dialog').open && !reduced.matches && previewPose === 1) {
    drawPreview(preview, draft, directions[previewDirection], poses[previewPose], (performance.now() % 900) / 900);
  }
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
