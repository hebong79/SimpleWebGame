import { createReady, startRound, reveal, advance, pause, resume, MODES } from './engine.mjs';
import { createStore, THEMES } from './save.mjs';
const $ = id => document.getElementById(id);
const labels = { apple: '사과', pear: '배', orange: '오렌지', berry: '딸기', cookie: '쿠키', bread: '빵', cherry: '체리', candy: '사탕' };
const modeLabels = { easy: '쉬움', normal: '기본' };
const themeLabels = { cream: '크림', meadow: '풀밭', evening: '저녁' };
const store = createStore();
let settings = store.snapshot().settings;
let state = createReady(settings.mode);
let comparison = null, error = '', raf = 0, last = null, modal = null, gesture = null;
let audio = null, pageLeaving = false;
const held = new Set();
let cardButtons = [], builtRound = -1, builtMode = '', pressedSpace = false;
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
const formatTime = ms => { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
const active = () => state.phase === 'playing' || state.phase === 'paused';
function stopAudio() { if (audio) { try { audio.close()?.catch(() => {}); } catch {} audio = null; } }
function sound(kind) {
  if (settings.muted) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    audio.resume()?.catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.frequency.value = kind === 'match' ? 660 : kind === 'miss' ? 220 : 440;
    gain.gain.setValueAtTime(.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .1);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .11);
  } catch { stopAudio(); }
}
function stopPump() { cancelAnimationFrame(raf); raf = 0; last = null; held.clear(); pressedSpace = false; if (gesture) { gesture.cancelled = true; gesture.ended = true; } stopAudio(); }
function finish() { if (state.phase === 'success') { comparison ??= store.settle(state); } if (!active()) stopPump(); }
function pump(now = performance.now()) {
  if (state.phase !== 'playing' || modal) return;
  if (last === null) { last = now; return; }
  const dt = now - last;
  last = now;
  if (dt > 250 || dt < 0) { state = pause(state, 'protection'); stopPump(); return; }
  state = advance(state, dt); finish();
}
function schedule() {
  if (raf || state.phase !== 'playing' || modal) return;
  if (last === null) last = performance.now();
  const round = state.roundId;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (state.roundId !== round || state.phase !== 'playing' || modal) return;
    // Arrival clock, not the potentially stale RAF timestamp, owns elapsed time.
    pump(performance.now()); render(); schedule();
  });
}
function render() {
  const mode = MODES[state.mode], paused = state.phase === 'paused';
  if (builtRound !== state.roundId || builtMode !== state.mode) {
    builtRound = state.roundId; builtMode = state.mode;
    cardButtons = Array.from({ length: mode.pairs * 2 }, (_, index) => {
      const button = document.createElement('button');
      button.className = 'card closed'; button.type = 'button'; button.dataset.index = String(index);
      button.addEventListener('click', () => flip(index));
      return button;
    });
    $('board').replaceChildren(...cardButtons);
  }
  $('board').classList.toggle('easy', state.mode === 'easy');
  $('board').setAttribute('aria-label', `${modeLabels[state.mode]} ${mode.columns}열 4행 카드`);
  cardButtons.forEach((button, index) => {
    const card = state.cards[index], visible = card && card.revealed && !paused;
    const signature = `${visible ? card.id : settings.theme}:${visible && card.matched ? 'matched' : visible ? 'open' : 'closed'}`;
    if (button.dataset.view !== signature) {
      button.dataset.view = signature;
      button.className = `card ${visible ? 'open' : 'closed'}${visible && card.matched ? ' matched' : ''}`;
      const image = document.createElement('img'); image.alt = ''; image.setAttribute('aria-hidden', 'true');
      image.src = `./assets/${visible ? card.id : `back-${settings.theme}`}.svg`;
      image.className = visible ? 'snack' : 'back';
      const contents = [image];
      if (visible) {
        const label = document.createElement('small'); label.textContent = labels[card.id]; contents.push(label);
        if (card.matched) { const check = document.createElement('span'); check.className = 'check'; check.setAttribute('aria-hidden', 'true'); check.append('✓'); const text = document.createElement('span'); text.className = 'match-text'; text.textContent = ' 짝 완료'; check.append(text); contents.push(check); }
      }
      button.replaceChildren(...contents);
    }
    const name = `${index + 1}번 카드, ${visible ? `${labels[card.id]}, ${card.matched ? '짝 완료' : '열림'}` : paused ? '일시정지, 가림' : '닫힘'}`;
    if (button.getAttribute('aria-label') !== name) button.setAttribute('aria-label', name);
    button.disabled = state.phase !== 'playing' || !!modal || !!state.mismatchIndices || !!card?.revealed;
  });
  setText($('pairs'), `${state.matchedPairs} / ${mode.pairs}`);
  setText($('attempts'), String(state.attempts)); setText($('time'), formatTime(state.activeElapsedMs));
  setText($('mode'), `${modeLabels[settings.mode]} · ${MODES[settings.mode].pairs}쌍`);
  setText($('mute'), `음소거: ${settings.muted ? '켜짐' : '꺼짐'}`); $('mute').setAttribute('aria-pressed', String(settings.muted));
  let message = error || (state.phase === 'ready' ? '시작을 누르면 간식 카드가 섞여요.' : state.phase === 'paused' ? `${state.pauseCause === 'protection' ? '화면 이탈 또는 긴 지연으로 보호 정지했어요.' : '일시정지했어요.'} 재개를 눌러 이어가세요.` : state.phase === 'success' ? `${mode.pairs}쌍을 모두 찾았어요! ${state.attempts}회 · ${formatTime(state.activeElapsedMs)}. ${comparison === 'new' ? '최고 기록을 새로 썼어요.' : comparison === 'tie' ? '최고 기록과 동점이에요.' : '최고 기록은 유지했어요.'}` : state.phase === 'limit' ? '안전한 시도·시간 한도에 도달했어요. 기록은 바뀌지 않았어요.' : state.mismatchIndices ? '서로 다른 간식이에요. 잠시 기억해 두세요.' : state.firstIndex !== null ? '한 장을 더 열어 짝을 찾아보세요.' : '두 장씩 열어 같은 간식을 찾아보세요.');
  setText($('status'), message);
  setText($('primary'), state.phase === 'playing' ? '일시정지' : paused ? '재개' : state.phase === 'ready' ? '시작' : '다시 도전');
  $('restart').disabled = state.phase === 'ready';
  const record = store.snapshot().modes[state.mode];
  setText($('record-title'), `${modeLabels[state.mode]} 모드의 최고 기록`);
  setText($('record-best'), record.best ? `${record.best.attempts}회 · ${formatTime(record.best.elapsedMs)} (${record.best.elapsedMs}ms)` : '아직 완성한 판이 없습니다.');
  setText($('record-count'), `완성한 판 ${record.completions}회`);
  $('storage-warning').hidden = !store.warning();
}
function begin() {
  try { const next = startRound(state); stopPump(); state = next; comparison = null; error = ''; render(); schedule(); } catch { error = '카드를 섞지 못했어요. 현재 판은 그대로입니다. 다시 시도해 주세요.'; render(); }
}
function flip(index) {
  if (modal) return;
  pump();
  const before = state; state = reveal(state, index);
  if (state !== before) { sound(state.matchedPairs > before.matchedPairs ? 'match' : state.mismatchIndices ? 'miss' : 'flip'); error = ''; finish(); }
  render(); schedule();
}
function protection() { state = pause(state, 'protection'); stopPump(); if (!pageLeaving) render(); }
function openDialog(kind, trigger, pendingMode = null) {
  pump(); state = pause(state, 'dialog'); stopPump();
  modal = { kind, trigger: trigger || $('primary'), pending: pendingMode ?? (kind === 'mode' ? settings.mode : settings.theme) };
  showDialog(); $('dialog').showModal(); $('dialog-cancel').focus(); render();
}
function showDialog() {
  const titles = { help: '간식 짝꿍 도움말', theme: '카드 테마', mode: '난이도 선택', modeConfirm: '모드를 바꿀까요?', restart: '새로 시작할까요?', home: '게임 서재로 돌아갈까요?' };
  setText($('dialog-title'), titles[modal.kind]); $('dialog-body').replaceChildren();
  const choose = modal.kind === 'theme' || modal.kind === 'mode';
  if (choose) {
    const group = document.createElement('div'); group.className = 'choices'; group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', titles[modal.kind]);
    const ids = modal.kind === 'theme' ? THEMES : Object.keys(MODES);
    for (const id of ids) {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(modal.pending === id)); button.dataset.choice = id;
      if (modal.kind === 'theme') { const img = document.createElement('img'); img.src = `./assets/back-${id}.svg`; img.alt = ''; button.append(img); }
      button.append(modal.kind === 'theme' ? themeLabels[id] : `${modeLabels[id]} · ${MODES[id].pairs}쌍`);
      button.addEventListener('click', () => { modal.pending = id; for (const choice of group.children) choice.setAttribute('aria-checked', String(choice === button)); }); group.append(button);
    }
    $('dialog-body').append(group);
    const paragraph = document.createElement('p'); paragraph.textContent = '적용 전에는 설정과 저장 기록이 바뀌지 않아요.'; $('dialog-body').append(paragraph);
  } else {
    const paragraph = document.createElement('p'); paragraph.textContent = modal.kind === 'help' ? '시작 후 두 장씩 카드를 여세요. 같은 간식은 짝 완료, 다르면 0.8초 후 닫혀요. 시간은 첫 카드를 열 때부터 흐르며 정지 중에는 카드도 가려져요. 창을 닫아도 자동 재개되지 않아요. 기록은 적은 시도, 같은 시도면 짧은 시간 순입니다.' : '진행 중인 판은 저장하지 않아요. 최고 기록은 유지됩니다. 취소하면 현재 판이 정지된 채로 남아요.'; $('dialog-body').append(paragraph);
  }
  setText($('dialog-cancel'), modal.kind === 'help' ? '닫기' : '취소');
  $('dialog-apply').hidden = modal.kind === 'help';
  setText($('dialog-apply'), choose ? '적용' : modal.kind === 'home' ? '서재로 이동' : modal.kind === 'modeConfirm' ? '모드 변경' : '새로 시작');
}
function closeDialog() {
  if (!modal) return;
  const trigger = modal.trigger; modal = null; $('dialog').close(); render();
  if (trigger?.isConnected && !trigger.disabled) trigger.focus(); else $('primary').focus();
}
$('dialog-cancel').addEventListener('click', closeDialog);
$('dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('dialog-apply').addEventListener('click', () => {
  if (!modal) return;
  const { kind, pending } = modal;
  if (kind === 'mode' && pending !== settings.mode && active()) { modal.kind = 'modeConfirm'; showDialog(); $('dialog-cancel').focus(); return; }
  if (kind === 'mode' || kind === 'modeConfirm') {
    if (pending !== settings.mode) { store.applySettings({ mode: pending }); settings = store.snapshot().settings; state = createReady(pending, state.roundId); comparison = null; error = ''; }
    closeDialog(); return;
  }
  if (kind === 'theme') { store.applySettings({ theme: pending }); settings = store.snapshot().settings; closeDialog(); return; }
  if (kind === 'restart') { closeDialog(); begin(); return; }
  if (kind === 'home') { closeDialog(); location.assign($('home').href); }
});
$('primary').addEventListener('click', () => {
  if (modal) return;
  if (state.phase === 'playing') { pump(); state = pause(state); stopPump(); }
  else if (state.phase === 'paused') { state = resume(state); last = performance.now(); }
  else { begin(); return; }
  render(); schedule();
});
$('restart').addEventListener('click', event => active() ? openDialog('restart', event.currentTarget) : begin());
for (const kind of ['theme', 'mode', 'help']) $(kind).addEventListener('click', event => openDialog(kind, event.currentTarget));
$('home').addEventListener('click', event => { if (active()) { event.preventDefault(); openDialog('home', event.currentTarget); } });
$('mute').addEventListener('click', () => { store.applySettings({ muted: !settings.muted }); settings = store.snapshot().settings; if (settings.muted) stopAudio(); else sound('flip'); render(); });
// Observe ALL document pointers, including a second touch outside the board.
const targetOf = target => target instanceof Element ? target.closest('button,a') : null;
document.addEventListener('pointerdown', event => {
  if (gesture && !gesture.ended) { gesture.cancelled = true; return; }
  gesture = { id: event.pointerId, target: targetOf(event.target), x: event.clientX, y: event.clientY, cancelled: !event.isPrimary || event.button !== 0, ended: false };
}, true);
document.addEventListener('pointermove', event => { if (gesture && !gesture.ended && event.pointerId === gesture.id && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.cancelled = true; }, true);
document.addEventListener('pointerup', event => { if (gesture && event.pointerId === gesture.id) { if (targetOf(event.target) !== gesture.target || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.cancelled = true; gesture.ended = true; gesture.upAt = performance.now(); } }, true);
document.addEventListener('pointercancel', event => { if (gesture) { gesture.cancelled = true; if (event.pointerId === gesture.id) gesture.ended = true; } }, true);
// Implicit capture is released after a normal pointerup, before its click.
// Only losing the active pointer's capture BEFORE pointerup cancels that tap.
document.addEventListener('lostpointercapture', event => { if (gesture && !gesture.ended && event.pointerId === gesture.id) gesture.cancelled = true; }, true);
document.addEventListener('scroll', () => { if (gesture) gesture.cancelled = true; }, true);
document.addEventListener('click', event => {
  if (event.detail > 0 && (!gesture || gesture.cancelled || !gesture.ended || gesture.target !== targetOf(event.target) || performance.now() - gesture.upAt > 1200)) { event.preventDefault(); event.stopImmediatePropagation(); }
  gesture = null;
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    if (event.repeat || held.has(event.code)) { event.preventDefault(); return; }
    held.add(event.code); if (event.key === ' ') pressedSpace = true;
  }
  if (modal && event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const controls = [...$('dialog').querySelectorAll('button,a[href],[tabindex]')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    if (controls.length) { const index = controls.indexOf(document.activeElement), next = event.shiftKey ? index <= 0 ? controls.length - 1 : index - 1 : index >= controls.length - 1 ? 0 : index + 1; event.preventDefault(); controls[next].focus(); }
  }
  if (!modal && event.key === 'Escape' && state.phase === 'playing') { event.preventDefault(); pump(); state = pause(state); stopPump(); render(); $('primary').focus(); }
}, true);
document.addEventListener('keyup', event => { held.delete(event.code); if (event.key === ' ') { if (!pressedSpace) event.preventDefault(); pressedSpace = false; } }, true);
window.addEventListener('blur', protection);
// Pause/cancel immediately, but never create image loads in a departing document.
// WebKit sends unload-time image loads as pings, which strict connect-src blocks.
window.addEventListener('pagehide', () => { pageLeaving = true; protection(); });
window.addEventListener('pageshow', () => { pageLeaving = false; render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) protection(); });
Object.defineProperty(window, '__g026Snapshot', { value: () => structuredClone({ gameId: 'snack-pairs', ...state, round: state.roundId, dialog: modal ? { kind: modal.kind, pending: modal.pending } : null, stats: { attempts: state.attempts, matchedPairs: state.matchedPairs }, timing: { activeElapsedMs: state.activeElapsedMs, mismatchRemainingMs: state.mismatchRemainingMs, firstFlipStarted: state.firstFlipStarted }, settings, record: store.snapshot().modes, storageWarning: store.warning(), comparison }), writable: false, configurable: false });
render();
