import { STAGES, STAGE_COUNT, absorbRings, boardColors, createGame, pauseGame, pickColor, regionEdges, resumeGame, startGame } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord } from './save.mjs';
import { createAudio } from './audio.mjs';
const $ = id => document.getElementById(id);
const COLORS = [{ name: '주홍', shape: '원' }, { name: '파랑', shape: '사각' }, { name: '노랑', shape: '삼각' }, { name: '초록', shape: '마름모' }];
const THEME_NAMES = { paint: '물감 팔레트', pastel: '파스텔 팔레트' };
const loaded = loadRecord();
let record = loaded.record, state = createGame(1), modalKind = null, modalTrigger = null, draftTheme = null, pendingProtection = false;
let settledRound = -1, resultInfo = { judge: null, save: 'none' }, rings = new Map(), lastColor = 0, boardSize = 0;
const storage = { mode: loaded.mode, writeCount: 0, lastWriteOk: null };
// Warning keys: 'read' (memory mode, never cleared), 'write' (cleared by the next successful write), 'recover-*' (cleared by the next successful write).
const warnings = new Map(loaded.mode === 'memory' ? [['read', loaded.warnings[0]]] : loaded.warnings.map((w, i) => [`recover-${i}`, w]));
const audio = createAudio(), cellEls = [], stageButtons = [], colorButtons = [];
audio.setMuted(record.settings.muted);
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const attr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
const visible = (el, show) => { if (el.hidden === show) el.hidden = !show; };
const disabled = (el, value) => { if (el.disabled !== value) el.disabled = value; };
function persist() {
  if (storage.mode === 'memory') return 'memory';
  storage.writeCount++; const saved = saveRecord(record); storage.lastWriteOk = saved.ok;
  // A later successful write stores the whole in-memory record, including a win whose own write failed, so the result line becomes true.
  if (saved.ok) { for (const key of [...warnings.keys()]) if (key !== 'read') warnings.delete(key); if (resultInfo.save === 'failed') resultInfo.save = 'ok'; return 'ok'; }
  warnings.set('write', saved.warning); return 'failed';
}
for (const stage of STAGES) {
  const b = document.createElement('button'); b.className = 'stage-option'; b.type = 'button'; b.dataset.stage = stage.id;
  b.addEventListener('click', () => {
    if (state.phase !== 'ready' || stage.id > record.records.unlocked || modalKind) return;
    rings = new Map(); setState(createGame(stage.id, state.round, state.token + 1));
  });
  stageButtons.push(b); $('stage-select').append(b);
}
COLORS.forEach((info, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'color-btn'; b.dataset.color = i; b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', `${i + 1}번 ${info.name} ${info.shape}, 선택하면 내 영역이 ${info.name}색으로 바뀌어요`);
  b.innerHTML = `<span class="glyph" data-color="${i}" aria-hidden="true"></span><span class="num" aria-hidden="true">${i + 1}</span><span class="now" aria-hidden="true">지금 색</span>`;
  b.addEventListener('click', e => {
    // Pointer clicks (detail > 0) already passed the capture-phase gesture gate and WebKit never focuses a clicked button,
    // so only keyboard / scripted clicks (detail 0) need the button to hold focus.
    if (e.detail === 0 && document.activeElement !== b) return;
    choose(i);
  });
  colorButtons.push(b); $('color-bar').append(b);
});
function buildBoard() {
  if (boardSize === state.size) return;
  boardSize = state.size; cellEls.length = 0; const fragment = document.createDocumentFragment();
  for (let r = 0; r < boardSize; r++) {
    const row = document.createElement('div'); row.setAttribute('role', 'row');
    for (let c = 0; c < boardSize; c++) {
      const cell = document.createElement('div'); cell.setAttribute('role', 'gridcell'); cell.dataset.cell = r * boardSize + c; cell.className = 'cell';
      cellEls.push(cell); row.append(cell);
    }
    fragment.append(row);
  }
  $('board').replaceChildren(fragment); $('board').className = `board size-${boardSize}`;
}
function renderBoard() {
  buildBoard();
  const colors = boardColors(state.cells, state.region, state.currentColor), edges = regionEdges(state.size, state.region), inside = new Set(state.region);
  for (let i = 0; i < cellEls.length; i++) {
    const el = cellEls[i], inn = inside.has(i), e = edges[i], ring = rings.get(i), info = COLORS[colors[i]];
    const cls = `cell${inn ? ' in' : ''}${e & 1 ? ' e-t' : ''}${e & 2 ? ' e-r' : ''}${e & 4 ? ' e-b' : ''}${e & 8 ? ' e-l' : ''}${ring ? ` ring-${ring}` : ''}`;
    if (el.className !== cls) el.className = cls;
    attr(el, 'data-color', colors[i]);
    attr(el, 'aria-label', `${Math.floor(i / boardSize) + 1}행 ${i % boardSize + 1}열 ${info.name} ${info.shape} · ${inn ? '내 영역' : '영역 밖'}`);
  }
}
function statusText() {
  const s = state, name = COLORS[s.currentColor].name, e = s.lastEvent, left = s.limit - s.used;
  if (s.phase === 'ready') return `${s.stageId}단계를 골랐어요. 게임 시작을 눌러 주세요.`;
  if (s.phase === 'paused') return '일시정지 · 판과 남은 횟수를 그대로 보존했어요.';
  if (s.phase === 'result') return s.outcome === 'win' ? `전부 번졌어요! 남은 횟수 ${s.result.remaining}` : `횟수를 모두 썼어요. 영역 밖에 ${s.result.uncovered}칸이 남았어요.`;
  if (e.kind === 'same-color') return `이미 ${name}이에요. 횟수는 그대로예요.`;
  if (e.kind === 'move') return e.absorbed > 0 ? `${name}으로 번졌어요. 영역 ${s.region.length}칸 · 남은 횟수 ${left}` : `${name}으로 바꿨어요. 새 칸은 없어요. 영역 ${s.region.length}칸 · 남은 횟수 ${left}`;
  return '색 버튼이나 숫자 1~4 키로 물감을 번지게 해요.';
}
function judgeText(best) {
  if (resultInfo.judge === 'new-best') return '새 최고 기록이에요!';
  if (resultInfo.judge === 'tie') return '최고 기록과 같아요.';
  if (resultInfo.judge === 'not-best') return `최고 기록은 사용 ${best.bestUsed}번이에요.`;
  return '';
}
function renderResult(best) {
  const r = state.result; if (!r) return;
  const win = r.outcome === 'win', canNext = win && r.stageId < STAGE_COUNT && r.stageId + 1 <= record.records.unlocked;
  text($('result-title'), win ? '전부 번졌어요!' : '횟수를 모두 썼어요');
  text($('result-detail'), win ? `점수 ${r.score}점 · 사용 ${r.used} / 제한 ${r.limit} · 남은 횟수 ${r.remaining}` : `사용 ${r.used} / 제한 ${r.limit} · 영역 밖 ${r.uncovered}칸 남음`);
  text($('result-record'), win ? `${judgeText(best)} ${best.clearCount ? `단계 최고 사용 ${best.bestUsed}번 · ${best.bestScore}점` : ''}`.trim() : '');
  text($('result-save'), !win ? '' : resultInfo.save === 'ok' ? '기록에 저장했어요.' : resultInfo.save === 'capped' ? '기록 한도에 도달해 이번 결과는 기록에 더하지 않았어요.' : resultInfo.save === 'none' ? '' : '이번 페이지에서만 유지돼요.');
  visible($('result-final'), win && r.stageId === STAGE_COUNT); visible($('next'), canNext);
}
function render() {
  buildBoard(); attr(document.body, 'data-theme', draftTheme ?? record.settings.theme);
  const s = state, best = record.records.stages[s.stageId - 1], left = s.limit - s.used;
  text($('stage-label'), `${s.stageId} / ${STAGE_COUNT}`); text($('tier-label'), `${s.tier === 'intro' ? '입문' : '기본'} ${s.size}×${s.size}·${s.colors}색`);
  text($('remaining'), String(left)); text($('remaining-note'), s.phase === 'playing' && left === 1 ? '마지막 한 번' : '');
  text($('used'), String(s.used)); text($('limit'), String(s.limit)); text($('region-size'), String(s.region.length)); text($('total-cells'), String(s.size * s.size));
  text($('status'), statusText());
  visible($('ready-panel'), s.phase === 'ready'); visible($('pause-panel'), s.phase === 'paused'); visible($('result-panel'), s.phase === 'result');
  text($('resume'), s.pauseCause === 'manual' ? '이어서하기' : '게임 재개');
  text($('pause-note'), s.pauseCause === 'protection' ? '화면을 벗어나서 멈췄어요. 준비되면 직접 재개해 주세요.' : '판과 남은 횟수는 그대로예요. 준비되면 재개해 주세요.');
  renderResult(best);
  text($('stage-best'), best.clearCount ? `이 단계 최고: 사용 ${best.bestUsed}번 · ${best.bestScore}점 · ${best.clearCount}회 완료` : `${s.stageId}단계는 아직 완성하지 않았어요.`);
  text($('lifetime'), `누적 ${record.records.completed}회 완료 · ${record.records.unlocked} / ${STAGE_COUNT}단계 해금`);
  text($('theme-name'), THEME_NAMES[record.settings.theme]); text($('mute'), record.settings.muted ? '소리 켜기' : '소리 끄기'); attr($('mute'), 'aria-pressed', record.settings.muted);
  visible($('warning'), warnings.size > 0); text($('warning'), [...warnings.values()].join(' '));
  disabled($('pause'), s.phase !== 'playing'); disabled($('restart'), s.phase === 'ready');
  const bar = $('color-bar'), barClass = `color-bar${s.colors === 3 ? ' colors-3' : ''}`; if (bar.className !== barClass) bar.className = barClass;
  colorButtons.forEach((b, i) => { visible(b, i < s.colors); disabled(b, s.phase !== 'playing'); attr(b, 'aria-pressed', i === s.currentColor); });
  for (let i = 0; i < STAGE_COUNT; i++) {
    const locked = i + 1 > record.records.unlocked, def = STAGES[i];
    disabled(stageButtons[i], locked); text(stageButtons[i], locked ? `${i + 1} 잠김` : `${i + 1}단계`); attr(stageButtons[i], 'aria-pressed', s.stageId === i + 1);
    attr(stageButtons[i], 'aria-label', locked ? `${i + 1}단계 잠김` : `${i + 1}단계, ${def.size} 곱하기 ${def.size}, 색 ${def.colors}가지, 제한 ${def.limit}회`);
  }
  renderBoard();
}
function settle() {
  settledRound = state.round; resultInfo = { judge: null, save: 'none' };
  if (state.outcome !== 'win') return;
  const { used, score, stageId } = state.result, outcome = settleRecord(record, { stageId, used, score });
  resultInfo.judge = outcome.judge;
  if (outcome.record !== record) { record = outcome.record; resultInfo.save = persist(); }
  else if (outcome.judge === 'capped') resultInfo.save = 'capped';
}
function setState(next) {
  if (next === state) return;
  const prev = state; state = next;
  if (next.phase !== prev.phase || next.round !== prev.round || next.token !== prev.token) {
    if (next.phase === 'result' && prev.phase !== 'result') blocked = new Set(held); else if (next.phase !== 'result') blocked.clear();
    clearInput(); if (next.phase !== 'paused') pendingProtection = false;
  }
  if (next.phase !== 'result') resultInfo = { judge: null, save: 'none' };
  if (next.phase === 'result' && prev.phase !== 'result') {
    audio.stop(); if (settledRound !== next.round) settle();
    if (next.outcome === 'win') audio.win(); else audio.lose();
  }
  render();
  if (next.phase === 'result' && prev.phase !== 'result') ($('next').hidden ? $('retry') : $('next')).focus();
}
function choose(color) {
  if (modalKind || document.hidden || state.phase !== 'playing') return;
  const next = pickColor(state, color); if (next === state) return;
  audio.unlock();
  if (next.lastEvent.kind === 'move') { rings = absorbRings(state.size, state.region, next.region); audio.stop(); audio.pick(color, next.lastEvent.absorbed); }
  setState(next);
}
function focusColor(index = lastColor) {
  const target = !colorButtons[index]?.hidden && !colorButtons[index]?.disabled ? colorButtons[index] : colorButtons.find(b => !b.hidden && !b.disabled);
  target?.focus({ preventScroll: true });
}
function start(stageId = state.stageId) {
  clearInput(); audio.stop(); audio.unlock(); rings = new Map(); lastColor = 0;
  setState(startGame(state, stageId)); focusColor(0);
}
function pause(cause = 'manual') { clearInput(); audio.stop(); setState(pauseGame(state, cause)); }
function protect() {
  clearInput(true); blocked.clear(); audio.stop();
  if (modalKind) { if (state.phase === 'paused') pendingProtection = true; return; }
  if (state.phase === 'playing') pause('protection');
}
$('start').addEventListener('click', () => start());
$('retry').addEventListener('click', () => { if (state.phase === 'result') start(); });
$('next').addEventListener('click', () => { if (state.phase === 'result' && state.outcome === 'win' && state.stageId < STAGE_COUNT && state.stageId + 1 <= record.records.unlocked) start(state.stageId + 1); });
$('choose').addEventListener('click', () => { if (state.phase !== 'result') return; rings = new Map(); setState(createGame(state.stageId, state.round, state.token + 1)); $('start').focus(); });
$('pause').addEventListener('click', () => { if (state.phase !== 'playing') return; pause(); $('resume').focus(); });
$('resume').addEventListener('click', () => {
  if (modalKind || document.hidden || state.phase !== 'paused') return;
  clearInput(); audio.unlock(); rings = new Map(); pendingProtection = false; setState(resumeGame(state)); focusColor();
});
$('mute').addEventListener('click', () => {
  record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } }; audio.setMuted(record.settings.muted); audio.unlock(); persist(); render();
});
function openModal(kind, trigger) {
  pause('modal'); modalKind = kind; modalTrigger = trigger; draftTheme = kind === 'settings' ? record.settings.theme : null; pendingProtection = false;
  const body = $('modal-body'), actions = $('modal-actions'); body.replaceChildren(); actions.replaceChildren();
  const paragraph = value => { const p = document.createElement('p'); p.textContent = value; body.append(p); };
  const action = (id, label, handler, primary = false) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; if (primary) b.className = 'primary'; b.addEventListener('click', handler); actions.append(b); };
  if (kind === 'help') {
    text($('modal-title'), '물감 번지기, 이렇게 해요');
    paragraph('왼쪽 위 칸과 이어진 같은 색이 내 영역이에요. 아래 색 버튼(또는 숫자 1~4 키)을 누르면 내 영역 전체가 그 색으로 바뀌고, 위·아래·왼쪽·오른쪽으로 닿은 같은 색 칸이 이어서 합쳐져요. 대각선은 닿은 것이 아니에요.');
    paragraph('판 전체가 내 영역이 되면 완성이에요. 정해진 횟수를 다 쓰고도 남은 칸이 있으면 아쉽게 끝나요. 마지막 한 번에 완성해도 성공이에요.');
    paragraph('지금 색을 다시 고르면 횟수는 줄지 않아요. 다른 색을 고르면 영역이 커지지 않아도 1회로 세요.');
    paragraph('점수는 남은 횟수 × 100점이에요. 같은 단계에서는 적게 쓴 기록이 우선이고, 완성하면 다음 단계가 열려요.');
    paragraph('이 창을 닫아도 게임은 멈춰 있어요. 완료 기록·해금·설정만 저장하고 진행 중인 판은 저장하지 않아요.');
    action('modal-close', '닫기', closeModal, true);
  } else if (kind === 'settings') {
    text($('modal-title'), '팔레트 고르기'); paragraph('팔레트는 칸과 버튼의 색만 바꿔요. 모양과 숫자, 규칙, 기록은 그대로예요.');
    const choices = document.createElement('div'); choices.className = 'theme-choices'; body.append(choices);
    for (const value of Object.keys(THEME_NAMES)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-option'; b.dataset.theme = value; b.textContent = THEME_NAMES[value]; attr(b, 'aria-pressed', value === draftTheme);
      b.addEventListener('click', () => { draftTheme = value; for (const option of choices.children) attr(option, 'aria-pressed', option.dataset.theme === value); render(); }); choices.append(b);
    }
    action('settings-apply', '적용', () => {
      const changed = draftTheme !== record.settings.theme;
      if (changed) { record = { ...record, settings: { ...record.settings, theme: draftTheme } }; persist(); }
      closeModal();
    }, true);
    action('modal-close', '취소', closeModal);
  } else {
    text($('modal-title'), kind === 'home' ? '게임 목록으로 갈까요?' : '현재 단계를 처음부터 할까요?');
    paragraph('진행 중인 판은 기록에 더하지 않아요. 취소하면 멈춘 상태로 돌아가요.');
    action('modal-confirm', kind === 'home' ? '게임 목록으로' : '처음부터 시작', () => { const home = modalKind === 'home'; closeModal(); if (home) location.assign('/'); else start(); }, true);
    action('modal-close', '취소', closeModal);
  }
  $('modal').showModal(); $('modal').querySelector('button')?.focus();
}
function closeModal() {
  if (!modalKind) return;
  const trigger = modalTrigger, promote = pendingProtection; modalKind = null; draftTheme = null; modalTrigger = null; pendingProtection = false;
  $('modal').close(); clearInput(); rings = new Map();
  if (promote && state.phase === 'paused') setState(pauseGame(state, 'protection')); else render();
  if (trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
  else if (state.phase === 'paused') $('resume').focus();
}
$('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
$('help').addEventListener('click', e => openModal('help', e.currentTarget)); $('settings').addEventListener('click', e => openModal('settings', e.currentTarget));
$('restart').addEventListener('click', e => { if (state.phase === 'result') start(); else if (state.phase !== 'ready') openModal('restart', e.currentTarget); });
$('home').addEventListener('click', e => { if (state.phase === 'playing' || state.phase === 'paused') { e.preventDefault(); openModal('home', e.currentTarget); } });
// ---- input: complete-gesture validation in the capture phase (no timers; suppression is time-compared and always reset) ----
const pointers = new Map(), held = new Set(); let blocked = new Set(), gesture = null, tap = null, cancelUntil = 0, activationKeyAt = -Infinity;
const control = target => target instanceof Element ? target.closest('button,a') : null;
function clearInput(reset = false) { gesture = null; tap = null; cancelUntil = 0; held.clear(); if (reset) pointers.clear(); }
document.addEventListener('pointerdown', e => {
  const stamp = performance.now(); for (const [id, at] of pointers) if (stamp - at > 5000) pointers.delete(id);
  pointers.set(e.pointerId, stamp); tap = null; cancelUntil = 0;
  if (pointers.size !== 1 || !e.isPrimary || e.button !== 0) { gesture = null; cancelUntil = performance.now() + 300; return; }
  gesture = { id: e.pointerId, target: control(e.target), x: e.clientX, y: e.clientY, cancelled: false };
}, true);
document.addEventListener('pointermove', e => { if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture.cancelled = true; }, true);
document.addEventListener('pointerup', e => {
  const now = performance.now();
  if (gesture?.id === e.pointerId && !gesture.cancelled && pointers.size === 1 && gesture.target && control(e.target) === gesture.target && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= 8) tap = { target: gesture.target, time: now };
  else cancelUntil = now + 300;
  pointers.delete(e.pointerId); gesture = null;
}, true);
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; tap = null; cancelUntil = performance.now() + 300; }, true);
document.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); gesture = null; tap = null; cancelUntil = performance.now() + 300; } }, true);
document.addEventListener('scroll', () => { if (gesture || pointers.size) { cancelUntil = performance.now() + 300; if (gesture) gesture.cancelled = true; tap = null; } }, true);
document.addEventListener('click', e => {
  const now = performance.now(), target = control(e.target);
  if (e.detail > 0) {
    const ok = tap && tap.target === target && now - tap.time <= 700; tap = null;
    if (!ok) { e.preventDefault(); e.stopImmediatePropagation(); }
  } else if (now < cancelUntil && now - activationKeyAt > 1000) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
function modalFocusables() { return [...$('modal').querySelectorAll('button,a[href],[tabindex]')].filter(el => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden],[inert]') && el.getClientRects().length > 0 && !['hidden', 'collapse'].includes(getComputedStyle(el).visibility)); }
document.addEventListener('focusin', e => {
  if (modalKind && !$('modal').contains(e.target)) modalFocusables()[0]?.focus();
  const index = colorButtons.indexOf(e.target.closest?.('.color-btn')); if (index >= 0) lastColor = index;
}, true);
function gameFocus() {
  const a = document.activeElement; if (!a || a === document.body) return true;
  return !a.matches('input,textarea,select,[contenteditable]') && Boolean(a.closest('main,header'));
}
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && modalKind && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const items = modalFocusables(), first = items[0], last = items.at(-1), active = document.activeElement;
    if (!first) { e.preventDefault(); $('modal').focus(); }
    else if (!items.includes(active) || (e.shiftKey ? active === first : active === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && control(e.target)) {
    activationKeyAt = performance.now();
    if (e.repeat || held.has(e.code) || blocked.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    held.add(e.code);
  }
  if (e.key === 'Escape') {
    if (modalKind) { e.preventDefault(); closeModal(); }
    else if (state.phase === 'playing' && gameFocus()) { e.preventDefault(); pause(); $('resume').focus(); }
    return;
  }
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (!e.shiftKey && /^[1-4]$/.test(e.key)) {
    const color = Number(e.key) - 1;
    if (modalKind || document.hidden || state.phase !== 'playing' || color >= state.colors || !gameFocus()) return;
    e.preventDefault(); if (e.repeat || held.has(e.code) || blocked.has(e.code)) return;
    held.add(e.code); choose(color); return;
  }
  const button = e.target instanceof Element ? e.target.closest('.color-btn') : null;
  if (button && !modalKind && !e.shiftKey && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const list = colorButtons.filter(b => !b.hidden && !b.disabled), at = list.indexOf(button);
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, at + (e.key === 'ArrowLeft' ? -1 : 1)));
    list[to]?.focus({ preventScroll: true });
  }
}, true);
document.addEventListener('keyup', e => { held.delete(e.code); blocked.delete(e.code); }, true);
window.addEventListener('blur', protect); window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); });
Object.defineProperty(window, '__g030Snapshot', {
  configurable: false, writable: false,
  value: () => {
    const s = state, total = s.size * s.size, focus = colorButtons.indexOf(document.activeElement);
    return structuredClone({
      game: 'paint-spread', version: 1, phase: s.phase, pauseCause: s.pauseCause, pendingProtection, round: s.round, token: s.token,
      stageId: s.stageId, stageCount: STAGE_COUNT, tier: s.tier, size: s.size, colors: s.colors, cells: s.cells, board: boardColors(s.cells, s.region, s.currentColor),
      region: s.region, regionSize: s.region.length, totalCells: total, currentColor: s.currentColor, used: s.used, limit: s.limit, remaining: s.limit - s.used, pathLength: s.pathLength,
      history: s.history, lastEvent: s.lastEvent, outcome: s.outcome, result: s.result ? { ...s.result, judge: resultInfo.judge, save: resultInfo.save } : null,
      settledRound, modal: modalKind, draftTheme, focusColor: focus, records: record.records, settings: record.settings, storage: { ...storage }, warnings: [...warnings.values()]
    });
  }
});
render();
