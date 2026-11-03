import { STAGES, affected, createGame, startGame, pressCell, undo, pauseGame, resumeGame, tick } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord } from './save.mjs';
import { createAudio } from './audio.mjs';
const $ = id => document.getElementById(id);
const loaded = loadRecord(); let record = loaded.record, state = createGame(), selected = 0, hovered = null, settledRound = -1;
let modalKind = null, modalTrigger = null, draftTheme = null, raf = null, lastFrame = 0;
const warnings = new Set(loaded.warnings), audio = createAudio(), cells = [], stageButtons = [];
audio.setMuted(record.settings.muted);
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const attr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
const visible = (el, show) => { if (el.hidden === show) el.hidden = !show; };
const disabled = (el, value) => { if (el.disabled !== value) el.disabled = value; };
function persist() { const saved = saveRecord(record); if (!saved.ok) warnings.add(saved.warning); }
for (const stage of STAGES) {
  const b = document.createElement('button'); b.className = 'stage-option'; b.type = 'button'; b.dataset.stage = stage.id;
  b.addEventListener('click', () => {
    if (state.phase !== 'ready' || stage.id > record.records.unlocked || modalKind) return;
    selected = 0; hovered = null; setState({ ...createGame(stage.id), round: state.round, token: state.token + 1 });
  }); stageButtons.push(b); $('stage-select').append(b);
}
function buildBoard() {
  if (cells.length === state.board.length) return;
  cells.length = 0; const fragment = document.createDocumentFragment();
  for (let i = 0; i < state.board.length; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'star'; b.dataset.cell = i;
    b.addEventListener('focus', () => { selected = i; preview(); });
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) { hovered = i; preview(); } });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) { hovered = null; preview(); } });
    b.addEventListener('click', e => {
      if (modalKind || document.hidden || state.phase !== 'playing') return;
      // Pointer clicks (detail > 0) are already gesture-validated by the capture gate; WebKit never focuses a clicked button,
      // so only keyboard-synthesised clicks (detail 0) need the cell to hold focus.
      if (e.detail === 0 && document.activeElement !== b) return;
      if (document.activeElement !== b) selectCell(i);
      audio.unlock(); const next = pressCell(state, i); if (next !== state) { audio.play(next.phase === 'result'); setState(next); }
    }); cells.push(b); fragment.append(b);
  }
  $('board').replaceChildren(fragment);
}
function preview() {
  const index = hovered ?? (cells.includes(document.activeElement) ? selected : null);
  const impacted = new Set(index === null ? [] : affected(state.size, index));
  for (let i = 0; i < cells.length; i++) {
    const classes = `star${state.board[i] ? ' on' : ''}${impacted.has(i) ? ' preview' : ''}`;
    if (cells[i].className !== classes) cells[i].className = classes;
    const tab = i === selected ? 0 : -1; if (cells[i].tabIndex !== tab) cells[i].tabIndex = tab;
  }
}
function selectCell(index, focus = true) { selected = index; if (focus) cells[index].focus({ preventScroll: true }); preview(); }
function settle() {
  if (state.phase !== 'result' || settledRound === state.round) return;
  settledRound = state.round; const updated = settleRecord(record, state.result);
  if (updated !== record) { record = updated; persist(); }
}
function render() {
  settle(); buildBoard(); attr(document.body, 'data-theme', record.settings.theme);
  const stage = STAGES[state.stage - 1], best = record.records.stages[state.stage - 1];
  text($('stage-label'), `${state.stage} / 15`); text($('moves'), String(state.moves)); text($('target'), `${stage.target}수`);
  text($('status'), state.phase === 'ready' ? '단계를 고르고 밤하늘을 밝혀 보세요.' : state.phase === 'paused' ? '일시정지 · 별판과 이동 수를 보존했어요.' : state.phase === 'result' ? '모든 별이 빛나요!' : state.remaining > 0 ? '별빛이 바뀌고 있어요.' : '별 하나를 골라 십자로 뒤집어 보세요.');
  visible($('ready-panel'), state.phase === 'ready'); visible($('pause-panel'), state.phase === 'paused'); visible($('result-panel'), state.phase === 'result');
  text($('resume'), state.pauseCause === 'manual' ? '이어서하기' : '게임 재개');
  text($('pause-note'), state.pauseCause === 'protection' ? '화면을 벗어나거나 긴 멈춤이 감지되었어요. 직접 재개해 주세요.' : '별판과 남은 반전 시간은 그대로예요. 준비되면 재개해 주세요.');
  text($('result-title'), state.stage === 15 ? '열다섯 밤하늘을 모두 만났어요!' : `${state.stage}단계, 별빛 완성!`);
  text($('result-detail'), state.result ? `이번 ${state.moves}수 · ${'★'.repeat(state.result.stars)}${'☆'.repeat(3 - state.result.stars)} · 최고 ${best.bestMoves}수 / ${best.bestStars}별` : '');
  visible($('next'), state.stage < 15); text($('stage-best'), best.clearCount ? `이 단계 최고 ${best.bestMoves}수 · ${best.bestStars}별 · ${best.clearCount}회 완료` : '이 단계의 첫 별빛을 기다리고 있어요.');
  text($('lifetime'), `누적 ${record.records.completed}회 완료 · ${record.records.unlocked} / 15단계 해금`);
  text($('theme-name'), record.settings.theme === 'night' ? '밤하늘 테마' : '종이별 테마');
  text($('mute'), record.settings.muted ? '소리 켜기' : '소리 끄기'); attr($('mute'), 'aria-pressed', record.settings.muted);
  visible($('warning'), warnings.size > 0); text($('warning'), [...warnings].join(' '));
  disabled($('pause'), state.phase !== 'playing'); disabled($('undo'), state.phase !== 'playing' || state.remaining > 0 || state.history.length === 0); disabled($('restart'), state.phase === 'ready');
  for (let i = 0; i < 15; i++) {
    const locked = i + 1 > record.records.unlocked; disabled(stageButtons[i], locked);
    text(stageButtons[i], locked ? `${i + 1} 잠김` : `${i + 1}단계`); attr(stageButtons[i], 'aria-pressed', state.stage === i + 1); attr(stageButtons[i], 'aria-label', `${i + 1}단계${locked ? ' 잠김' : `, ${STAGES[i].size} 곱하기 ${STAGES[i].size}, 3별 목표 ${STAGES[i].target}수`}`);
  }
  const boardClass = `board size-${state.size}`; if ($('board').className !== boardClass) $('board').className = boardClass;
  attr($('board'), 'aria-label', `${state.size} 곱하기 ${state.size} 별빛 보드`);
  for (let i = 0; i < cells.length; i++) {
    text(cells[i], state.board[i] ? '★' : '☆'); attr(cells[i], 'aria-label', `${Math.floor(i / state.size) + 1}행 ${i % state.size + 1}열 ${state.board[i] ? '켜짐' : '꺼짐'}`);
    attr(cells[i], 'aria-pressed', Boolean(state.board[i])); attr(cells[i], 'aria-disabled', state.phase !== 'playing' || state.remaining > 0);
  }
  preview();
}
function stopFrame() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
function schedule() {
  if (raf !== null || state.phase !== 'playing' || state.remaining <= 0 || modalKind || document.hidden) return;
  lastFrame = performance.now(); const token = state.token;
  const frame = now => {
    raf = null; if (state.phase !== 'playing' || modalKind || document.hidden || token !== state.token) return;
    const before = state, next = tick(state, now - lastFrame, token); lastFrame = now; state = next;
    if (next.phase !== before.phase) { clearInput(true); audio.stop(); render(); }
    else if (next.subphase !== before.subphase) render();
    if (state.phase === 'playing' && state.remaining > 0) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function setState(next) {
  if (next === state) return;
  if (next.phase !== state.phase || next.token !== state.token) { clearInput(); stopFrame(); }
  state = next; render(); schedule();
}
function start(stage = state.stage) { clearInput(); audio.stop(); audio.unlock(); selected = 0; hovered = null; setState(startGame(state, stage)); selectCell(0); }
function pause(cause = 'manual') { clearInput(); stopFrame(); audio.stop(); setState(pauseGame(state, cause)); }
function protect() { clearInput(true); pause('protection'); }
$('start').addEventListener('click', () => start()); $('retry').addEventListener('click', () => start());
$('next').addEventListener('click', () => { if (state.phase === 'result' && state.stage < 15) start(state.stage + 1); });
$('choose').addEventListener('click', () => { if (state.phase !== 'result') return; selected = 0; hovered = null; setState({ ...createGame(state.stage), round: state.round, token: state.token + 1 }); $('start').focus(); });
$('pause').addEventListener('click', () => { pause(); $('resume').focus(); });
$('resume').addEventListener('click', () => { if (modalKind || document.hidden || state.phase !== 'paused') return; clearInput(); audio.unlock(); setState(resumeGame(state)); selectCell(selected); });
$('undo').addEventListener('click', () => { if (!modalKind && !document.hidden) setState(undo(state)); });
$('mute').addEventListener('click', () => { record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } }; audio.setMuted(record.settings.muted); audio.unlock(); persist(); render(); });
function openModal(kind, trigger) {
  pause('modal'); modalKind = kind; modalTrigger = trigger; draftTheme = record.settings.theme;
  const body = $('modal-body'), actions = $('modal-actions'); body.replaceChildren(); actions.replaceChildren();
  const paragraph = value => { const p = document.createElement('p'); p.textContent = value; body.append(p); };
  const action = (id, label, handler, primary = false) => { const b = document.createElement('button'); b.id = id; b.textContent = label; if (primary) b.className = 'primary'; b.addEventListener('click', handler); actions.append(b); };
  if (kind === 'help') {
    text($('modal-title'), '별빛 스위치, 한 수씩 밝혀요');
    paragraph('선택한 별과 바로 상하좌우의 별이 함께 켜지거나 꺼져요. 모든 별을 켜면 완료해요. 같은 별을 두 번 누르면 원래 모습으로 돌아와요.');
    paragraph('방향키로 칸을 고르고 Enter / Space로 한 번 반전해요. 클릭이나 탭도 같아요. 반전 후 120ms 동안 다음 수를 기다려 주세요. 되돌리기는 마지막 수를 취소하며 성공 후에는 사용할 수 없어요.');
    paragraph('목표 수 이하면 3별, 목표보다 2수 이내면 2별, 그 이상이면 1별이에요. 시간 제한은 없어요. 완료하면 다음 단계가 열려요.');
    paragraph('이 창을 닫아도 게임은 멈춰 있어요. 완료 기록·해금·설정만 저장하며 진행 중인 별판은 저장하지 않아요.');
    action('modal-close', '닫기', closeModal, true);
  } else if (kind === 'settings') {
    text($('modal-title'), '밤하늘의 모습'); paragraph('테마는 별판의 색만 바꿔요. 규칙과 기록은 같아요.');
    const choices = document.createElement('div'); choices.className = 'theme-choices'; body.append(choices);
    for (const [value, label] of [['night', '밤하늘'], ['paper', '종이별']]) {
      const b = document.createElement('button'); b.className = 'theme-option'; b.dataset.theme = value; b.textContent = label; attr(b, 'aria-pressed', value === draftTheme);
      b.addEventListener('click', () => { draftTheme = value; for (const option of choices.children) attr(option, 'aria-pressed', option.dataset.theme === value); }); choices.append(b);
    }
    action('settings-apply', '적용', () => { if (draftTheme !== record.settings.theme) { record = { ...record, settings: { ...record.settings, theme: draftTheme } }; persist(); } closeModal(); }, true);
    action('modal-close', '취소', closeModal);
  } else {
    text($('modal-title'), kind === 'home' ? '게임 목록으로 갈까요?' : '현재 단계를 처음부터 할까요?');
    paragraph('진행 중인 판은 완료 기록에 더하지 않아요. 취소하면 멈춘 상태로 돌아가요.');
    action('modal-confirm', kind === 'home' ? '게임 목록으로' : '처음부터 시작', () => { const home = modalKind === 'home'; closeModal(); if (home) location.assign('/'); else start(); }, true);
    action('modal-close', '취소', closeModal);
  }
  $('modal').showModal(); $('modal').querySelector('button')?.focus();
}
function closeModal() {
  if (!modalKind) return;
  const trigger = modalTrigger; modalKind = null; draftTheme = null; $('modal').close(); clearInput(); render();
  if (trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
  else if (state.phase === 'paused') $('resume').focus();
}
$('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
$('help').addEventListener('click', e => openModal('help', e.currentTarget)); $('settings').addEventListener('click', e => openModal('settings', e.currentTarget));
$('restart').addEventListener('click', e => { if (state.phase === 'result') start(); else if (state.phase !== 'ready') openModal('restart', e.currentTarget); });
$('home').addEventListener('click', e => { if (['playing', 'paused'].includes(state.phase)) { e.preventDefault(); openModal('home', e.currentTarget); } });
// Validate complete gestures in capture phase; keep native keyboard button activation.
const pointers = new Map(), held = new Set(); let gesture = null, validClick = null;
const control = target => target instanceof Element ? target.closest('button,a') : null;
function clearInput(reset = false) { gesture = null; validClick = null; held.clear(); if (reset) pointers.clear(); }
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
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); clearInput(); }, true);
document.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); clearInput(); } }, true);
document.addEventListener('scroll', () => { if (gesture) gesture.cancelled = true; validClick = null; }, true);
document.addEventListener('click', e => {
  if (e.detail > 0) { const valid = validClick && validClick.target === control(e.target) && performance.now() - validClick.time < 700; validClick = null; if (!valid) { e.preventDefault(); e.stopImmediatePropagation(); } }
}, true);
function modalFocusables() { return [...$('modal').querySelectorAll('button,a[href],[tabindex]')].filter(el => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden],[inert]') && el.getClientRects().length > 0 && !['hidden', 'collapse'].includes(getComputedStyle(el).visibility)); }
document.addEventListener('focusin', e => { if (modalKind && !$('modal').contains(e.target)) modalFocusables()[0]?.focus(); preview(); }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && modalKind && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const items = modalFocusables(), first = items[0], last = items.at(-1), active = document.activeElement;
    if (!first) { e.preventDefault(); $('modal').focus(); }
    else if (!items.includes(active) || (e.shiftKey ? active === first : active === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); } return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && control(e.target)) {
    if (e.repeat || held.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); return; } held.add(e.code);
  }
  if (e.key === 'Escape') { if (modalKind) { e.preventDefault(); closeModal(); } else if (document.activeElement?.closest('main,header') && state.phase === 'playing') { e.preventDefault(); pause(); $('resume').focus(); } return; }
  const cell = e.target instanceof Element ? e.target.closest('.star') : null;
  if (!cell || modalKind || document.hidden || state.phase !== 'playing' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault(); if (e.repeat) return;
    const row = Math.floor(selected / state.size), col = selected % state.size;
    const r = Math.max(0, Math.min(state.size - 1, row + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0)));
    const c = Math.max(0, Math.min(state.size - 1, col + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)));
    selectCell(r * state.size + c);
  }
}, true);
document.addEventListener('keyup', e => held.delete(e.code), true);
window.addEventListener('blur', protect); window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); });
Object.defineProperty(window, '__g029Snapshot', { configurable: false, writable: false, value: () => structuredClone({ ...state, selected, hovered, modal: modalKind, records: record.records, settings: record.settings, warnings: [...warnings] }) });
render();
