import { createGame, startRound, drop, tick, pause, resume } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord } from './save.mjs';
import { createAudio } from './audio.mjs';
const $ = id => document.getElementById(id);
const loaded = loadRecord(); let record = loaded.record, state = createGame(), selected = 0, settledRound = -1;
let modalKind = null, modalTrigger = null, draftTheme = null, lastFrame = performance.now();
const audio = createAudio(), warnings = new Set(loaded.warnings);
audio.setMuted(record.settings.muted);
const names = { sun: '햇빛 ○', sea: '바다 △' };
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const attr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
const visible = (el, show) => { if (el.hidden === show) el.hidden = !show; };
const columns = [], cells = [];
for (let col = 0; col < 7; col++) {
  const button = document.createElement('button'); button.className = 'column'; button.dataset.column = col;
  button.type = 'button'; button.setAttribute('aria-label', `${col + 1}열에 놓기`); button.tabIndex = col ? -1 : 0;
  const label = document.createElement('span'); label.className = 'column-label'; label.textContent = `${col + 1} ↓`; button.append(label);
  const columnCells = [];
  for (let row = 0; row < 6; row++) {
    const cell = document.createElement('span'); cell.className = 'cell'; cell.dataset.row = row; cell.dataset.col = col;
    cell.setAttribute('aria-hidden', 'true'); button.append(cell); columnCells.push(cell);
  }
  const fill = document.createElement('span'); fill.className = 'column-fill'; fill.id = `fill-${col}`;
  button.setAttribute('aria-describedby', fill.id); button.append(fill); $('board').append(button);
  columns.push(button); cells.push(columnCells);
  button.addEventListener('focus', () => selectColumn(col));
  button.addEventListener('click', () => { selectColumn(col); place(col); });
}
function selectColumn(col, focus = false) {
  selected = col;
  for (let i = 0; i < 7; i++) if (columns[i].tabIndex !== (i === col ? 0 : -1)) columns[i].tabIndex = i === col ? 0 : -1;
  if (focus) columns[col].focus({ preventScroll: true });
  if (focus || document.activeElement === columns[col]) columns[col].scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function persist() {
  const saved = saveRecord(record); if (!saved.ok) warnings.add(saved.warning);
}
function settle() {
  if (state.phase === 'result' && settledRound !== state.round) {
    settledRound = state.round; record = settleRecord(record, state.outcome); persist();
    audio.play(state.outcome === 'draw' ? 'land' : 'win');
  }
}
function render() {
  settle();
  attr(document.body, 'data-theme', record.settings.theme);
  text($('sun-score'), `${state.session.sunWins}승`); text($('sea-score'), `${state.session.seaWins}승`); text($('draw-score'), String(state.session.draws));
  text($('lifetime'), `햇빛 ${record.records.sunWins}승 · 바다 ${record.records.seaWins}승 · 무승부 ${record.records.draws}`);
  text($('theme-name'), record.settings.theme === 'coast' ? '해변 테마' : '저녁 테마');
  text($('mute'), record.settings.muted ? '소리 켜기' : '소리 끄기'); attr($('mute'), 'aria-pressed', record.settings.muted);
  visible($('warning'), warnings.size > 0); text($('warning'), [...warnings].join(' '));
  visible($('ready-panel'), state.phase === 'ready'); visible($('pause-panel'), state.phase === 'paused'); visible($('result-panel'), state.phase === 'result');
  const protectedPause = state.pauseReason === 'protect';
  text($('resume'), state.pauseReason === 'manual' ? '이어서하기' : '게임 재개');
  text($('pause-note'), protectedPause ? '화면을 벗어나거나 긴 멈춤이 감지되어 안전하게 멈췄어요. 직접 재개해 주세요.' : '보드와 남은 낙하 시간은 그대로예요. 준비되면 재개해 주세요.');
  const result = state.outcome === 'draw' ? '무승부예요' : state.outcome ? `${names[state.outcome]} 승리!` : '';
  const status = state.phase === 'ready' ? '함께 앉아 시작을 눌러 주세요.' : state.phase === 'paused' ? '일시정지 · 원반과 차례를 보존했어요.' : state.phase === 'result' ? result : `${names[state.current]} 차례 · ${state.subphase === 'dropping' ? '원반이 내려오고 있어요' : '열을 골라 주세요'}`;
  text($('status'), status); text($('turn'), state.phase === 'result' ? result : `${names[state.current]} ${state.phase === 'ready' ? '선공' : '차례'}`);
  text($('move-count'), `착수 ${state.moves} / 42`); text($('result-title'), result);
  text($('result-detail'), `이번 판 ${state.moves}수 · 다음 판은 ${names[state.starter === 'sun' ? 'sea' : 'sun']} 선공이에요.`);
  $('pause').disabled = state.phase !== 'playing'; $('restart').disabled = state.phase === 'ready';
  const winners = new Set(state.winningCells.map(cell => cell.join(',')));
  for (let col = 0; col < 7; col++) {
    const count = state.board.reduce((n, row) => n + (row[col] !== null ? 1 : 0), 0);
    text($(`fill-${col}`), count === 6 ? '가득 참' : `${count}/6`);
    attr(columns[col], 'aria-disabled', state.phase !== 'playing' || state.subphase !== 'choosing' || count === 6);
    for (let row = 0; row < 6; row++) {
      const cell = cells[col][row], owner = state.board[row][col];
      const last = state.lastMove?.row === row && state.lastMove?.col === col;
      const classes = ['cell', owner, winners.has(`${row},${col}`) ? 'winning' : '', last ? 'last' : '', last && state.phase === 'playing' && state.subphase === 'dropping' ? 'dropping' : ''].filter(Boolean).join(' ');
      if (cell.className !== classes) cell.className = classes;
      text(cell, owner === 'sun' ? '○' : owner === 'sea' ? '△' : '');
    }
    attr(columns[col], 'title', `${col + 1}열 · ${state.board.map((line, row) => `${row + 1}행 ${line[col] ? names[line[col]] : '빈칸'}`).join(', ')}`);
  }
}
function setState(next) {
  if (next === state) return;
  const changedPhase = next.phase !== state.phase; state = next;
  if (changedPhase) clearPointers();
  render();
}
function place(col) {
  if (modalKind || document.hidden) return;
  audio.unlock(); const next = drop(state, col);
  if (next !== state) { lastFrame = performance.now(); setState(next); }
}
function newRound() {
  clearPointers(); audio.stop(); audio.unlock(); lastFrame = performance.now(); setState(startRound(state)); selectColumn(0, true);
}
function protect() {
  clearPointers(true); audio.stop(); lastFrame = performance.now(); setState(pause(state, 'protect'));
}
function pauseGame(reason = 'manual') {
  clearPointers(); audio.stop(); setState(pause(state, reason));
}
$('start').addEventListener('click', newRound); $('next').addEventListener('click', newRound);
$('pause').addEventListener('click', () => { pauseGame(); $('resume').focus(); });
$('resume').addEventListener('click', () => { if (modalKind || document.hidden) return; clearPointers(); lastFrame = performance.now(); audio.unlock(); setState(resume(state)); selectColumn(selected, true); });
$('mute').addEventListener('click', () => { record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } }; audio.setMuted(record.settings.muted); audio.unlock(); persist(); render(); });
function openModal(kind, trigger) {
  pauseGame('modal'); clearPointers(); modalKind = kind; modalTrigger = trigger; draftTheme = record.settings.theme;
  const title = $('modal-title'), body = $('modal-body'), actions = $('modal-actions'); body.replaceChildren(); actions.replaceChildren();
  const paragraph = value => { const p = document.createElement('p'); p.textContent = value; body.append(p); };
  const action = (id, label, handler, primary = false) => { const b = document.createElement('button'); b.id = id; b.textContent = label; if (primary) b.className = 'primary'; b.addEventListener('click', handler); actions.append(b); return b; };
  if (kind === 'help') {
    text(title, '햇빛과 바다 4목, 함께 놓아요');
    paragraph('같은 화면에서 두 사람이 번갈아 열을 골라요. 원반은 가장 아래 빈칸에 놓이며 같은 문양 네 개 이상을 가로·세로·대각선으로 이으면 승리해요.');
    paragraph('햇빛은 ○, 바다는 △예요. 가득 찬 열은 차례를 넘기지 않아요. 원반이 내려오는 200ms 동안 다음 입력은 기다려 주세요.');
    paragraph('열 클릭/탭 또는 ← →, Home / End로 선택 후 Enter / Space로 놓아요. Esc는 정지하거나 창을 닫아요. 다음 판의 선공은 교대하고 진행 중 새 판은 선공을 유지해요.');
    paragraph('창을 닫아도 게임은 멈춰 있어요. 완료한 판의 누적 전적과 테마·음소거만 저장하고 진행 중인 판은 저장하지 않아요.');
    action('modal-close', '닫기', closeModal, true);
  } else if (kind === 'settings') {
    text(title, '보드 테마'); paragraph('두 테마 모두 바로 사용할 수 있어요. 문양과 규칙은 같아요. 적용할 테마를 골라 주세요.');
    const choices = document.createElement('div'); choices.className = 'theme-choices'; body.append(choices);
    for (const [value, label] of [['coast', '해변'], ['evening', '저녁']]) {
      const b = document.createElement('button'); b.className = 'theme-option'; b.dataset.theme = value; b.textContent = label; attr(b, 'aria-pressed', draftTheme === value);
      b.addEventListener('click', () => { draftTheme = value; for (const item of choices.children) attr(item, 'aria-pressed', item.dataset.theme === value); }); choices.append(b);
    }
    action('settings-apply', '적용', () => { if (draftTheme !== record.settings.theme) { record = { ...record, settings: { ...record.settings, theme: draftTheme } }; persist(); } closeModal(); }, true);
    action('modal-close', '취소', closeModal);
  } else {
    text(title, kind === 'home' ? '게임 목록으로 갈까요?' : '현재 판을 끝내고 새로 시작할까요?');
    paragraph('진행 중인 판은 전적에 더하지 않아요. 누적 전적과 설정은 유지돼요. 취소하면 멈춘 상태로 돌아가요.');
    action('modal-confirm', kind === 'home' ? '게임 목록으로' : '새 판 시작', () => { const goHome = modalKind === 'home'; closeModal(); if (goHome) location.assign('/'); else newRound(); }, true);
    action('modal-close', '취소', closeModal);
  }
  $('modal').showModal(); $('modal').querySelector('button')?.focus();
}
function closeModal() {
  if (!modalKind) return;
  const trigger = modalTrigger; modalKind = null; draftTheme = null; $('modal').close(); clearPointers(); lastFrame = performance.now(); render();
  if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
}
$('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
$('help').addEventListener('click', e => openModal('help', e.currentTarget));
$('settings').addEventListener('click', e => openModal('settings', e.currentTarget));
$('restart').addEventListener('click', e => { if (state.phase === 'result') newRound(); else if (state.phase !== 'ready') openModal('restart', e.currentTarget); });
$('home').addEventListener('click', e => { if (['playing', 'paused'].includes(state.phase)) { e.preventDefault(); openModal('home', e.currentTarget); } });
// Stable native buttons: validate pointer gestures without replacing a held target.
const pointers = new Map(); let gesture = null, validClick = null;
function clearPointers(reset = false) { if (reset) pointers.clear(); gesture = null; validClick = null; }
const control = target => target instanceof Element ? target.closest('button,a') : null;
document.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, true); validClick = null;
  if (pointers.size !== 1 || !e.isPrimary || e.button !== 0) { gesture = null; return; }
  gesture = { id: e.pointerId, target: control(e.target), x: e.clientX, y: e.clientY, cancelled: false };
}, true);
document.addEventListener('pointermove', e => { if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture.cancelled = true; }, true);
document.addEventListener('pointerup', e => {
  if (gesture?.id === e.pointerId && !gesture.cancelled && pointers.size === 1 && gesture.target && control(e.target) === gesture.target && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= 8) validClick = { target: gesture.target, time: performance.now() };
  pointers.delete(e.pointerId); gesture = null;
}, true);
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); clearPointers(); }, true);
document.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); clearPointers(); } }, true);
document.addEventListener('click', e => {
  if (e.detail > 0) {
    const valid = validClick && validClick.target === control(e.target) && performance.now() - validClick.time < 700;
    validClick = null;
    if (!valid) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
const held = new Set();
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && $('modal').open) {
    const focusable = [...$('modal').querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el =>
      el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden],[inert]') && el.getClientRects().length > 0 &&
      !['hidden', 'collapse'].includes(getComputedStyle(el).visibility));
    const first = focusable[0], last = focusable.at(-1), active = document.activeElement;
    if (!first) { e.preventDefault(); $('modal').focus(); return; }
    if (!focusable.includes(active) || (e.shiftKey ? active === first : active === last)) {
      e.preventDefault(); (e.shiftKey ? last : first).focus();
    }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && control(e.target)) {
    if (e.repeat || held.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    held.add(e.code);
  }
  if (e.key === 'Escape') {
    if (modalKind) { e.preventDefault(); closeModal(); }
    else if (document.activeElement?.closest('main,header') && state.phase === 'playing') { e.preventDefault(); pauseGame(); $('resume').focus(); }
    return;
  }
  const col = e.target instanceof Element ? e.target.closest('.column') : null;
  if (!col || modalKind || document.hidden || state.phase !== 'playing' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault(); if (e.repeat) return;
    selectColumn(e.key === 'Home' ? 0 : e.key === 'End' ? 6 : Math.max(0, Math.min(6, selected + (e.key === 'ArrowLeft' ? -1 : 1))), true);
  }
}, true);
document.addEventListener('keyup', e => { held.delete(e.code); }, true);
window.addEventListener('blur', () => { held.clear(); protect(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); protect(); } else lastFrame = performance.now(); });
window.addEventListener('pagehide', () => { held.clear(); protect(); });
function frame() {
  const now = performance.now();
  const delta = Math.max(0, now - lastFrame); lastFrame = now;
  if (!document.hidden && !modalKind && state.phase === 'playing') {
    const before = state; setState(tick(state, delta));
    if (before.subphase === 'dropping' && state.subphase === 'choosing' && state.phase === 'playing') audio.play('land');
    if (state.phase === 'paused') audio.stop();
  }
  requestAnimationFrame(frame);
}
Object.defineProperty(window, '__g028Snapshot', { configurable: false, writable: false, value: () => structuredClone({ ...state, records: record.records, settings: record.settings, selectedColumn: selected, modal: modalKind, warnings: [...warnings] }) });
render(); requestAnimationFrame(frame);
