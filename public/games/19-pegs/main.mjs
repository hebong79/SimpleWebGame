import { STAGES, BOARDS, createGame, selectStage, startGame, restart, select, deselect, undo, pauseGame, resumeGame, targetsOf } from './engine.mjs';
import { loadRecord, saveRecord, settleWin, settleStuck, THEMES } from './save.mjs';
import { createAudio } from './audio.mjs';

const $ = id => document.getElementById(id);
const THEME_NAMES = { river: '강돌', glass: '유리알', wood: '나무' };
const WARNINGS = {
  'read-failed': '기록을 불러오지 못해 이번 접속에서만 유지돼요',
  'write-failed': '기록을 저장하지 못했어요. 이번 접속에서만 유지돼요',
  cap: '기록 한도에 도달했어요',
};
const SAVE_NOTES = {
  saved: '기록을 저장했어요',
  failed: '기록을 저장하지 못했어요. 이번 접속에서만 유지돼요',
  cap: '기록을 저장하지 못했어요. 이번 접속에서만 유지돼요',
  unavailable: WARNINGS['read-failed'],
  none: '기록 변동 없음',
};

// ---- state -------------------------------------------------------------------------------------------------------
const loaded = loadRecord();
let record = loaded.record;
const canWrite = loaded.readOk; // false: the stored data could not be read, so this session never writes
const warnings = new Set(loaded.readOk ? [] : ['read-failed']);
let saveStatus = loaded.readOk ? 'ok' : 'unavailable';
const firstOpen = () => { const i = record.records.stages.slice(0, record.records.unlocked).findIndex(s => s.clearCount === 0); return i < 0 ? 1 : i + 1; };
let game = createGame(firstOpen());
const centerOf = g => Math.floor((g.width * g.height) / 2);
let cursor = centerOf(game), focusedCell = null, hovered = null, status = 'playing';
let modalKind = null, modalTrigger = null, draftTheme = null;
let resultSettled = false, saveNote = 'none';
const audio = createAudio();
audio.setMuted(record.settings.muted);

// ---- tiny DOM helpers: write only when the value really changes -------------------------------------------------
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const attr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
const show = (el, visible) => { if (el.hidden === visible) el.hidden = !visible; };
const cls = (el, value) => { if (el.className !== value) el.className = value; };

// ---- save --------------------------------------------------------------------------------------------------------
function persist() {
  if (!canWrite) { saveStatus = 'unavailable'; return 'unavailable'; }
  // The result note mirrors the latest write while a win/stuck result was settled by a write (saved <-> failed);
  // 'none'/'cap'/'unavailable' notes stay as they are, so the note never contradicts the top warning.
  if (saveRecord(record).ok) { saveStatus = 'ok'; warnings.delete('write-failed'); if (saveNote === 'failed') saveNote = 'saved'; return 'saved'; }
  saveStatus = 'failed'; warnings.add('write-failed'); if (saveNote === 'saved') saveNote = 'failed'; return 'failed';
}
function settleResult() {
  const result = game.result; resultSettled = true; saveNote = 'none';
  const settled = result.outcome === 'win' ? settleWin(record, result) : settleStuck(record, result);
  if (settled.status === 'cap') { warnings.add('cap'); saveStatus = 'cap'; saveNote = 'cap'; return; }
  if (settled.changed) { record = settled.record; saveNote = persist(); }
}

// ---- derived texts -----------------------------------------------------------------------------------------------
function currentStatus() {
  if (game.phase === 'ready') return 'ready';
  if (game.phase === 'paused') return game.pauseCause === 'protect' ? 'paused-protect' : 'paused-manual';
  if (game.phase === 'result') return game.result.outcome;
  return status;
}
function statusText() {
  const n = game.remaining;
  return ({
    ready: '단계를 고르고 게임 시작을 눌러 주세요', playing: '움직일 돌을 골라 주세요', selected: '뛸 곳을 골라 주세요',
    'no-targets': '이 돌은 뛸 곳이 없어요', 'pick-first': '먼저 움직일 돌을 고르세요', 'not-target': '그곳으로는 뛸 수 없어요',
    jumped: `뛰었어요. 남은 돌 ${n}개`, undone: `되돌렸어요. 남은 돌 ${n}개`,
    'paused-manual': '잠시 멈췄어요. 이어서하기를 눌러 주세요', 'paused-protect': '화면을 벗어나 멈췄어요. 게임 재개를 눌러 주세요',
    win: '조약돌 하나만 남았어요!', stuck: '더 뛸 수 없어요',
  })[currentStatus()];
}

// ---- stage buttons -----------------------------------------------------------------------------------------------
const stageButtons = STAGES.map(stage => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'stage-option'; b.dataset.stage = String(stage.id);
  const name = document.createElement('span'), state = document.createElement('span'); state.className = 'st'; b.append(name, state);
  b.addEventListener('click', () => {
    if (game.phase !== 'ready' || modalKind || stage.id > record.records.unlocked) return;
    apply(selectStage(game, stage.id), 'ready');
  });
  $('stage-select').append(b); return b;
});

// ---- board -------------------------------------------------------------------------------------------------------
const boardEl = $('board');
let nodes = [], builtFor = null;
function buildBoard() {
  if (builtFor === game.boardId) return;
  builtFor = game.boardId; nodes = []; const fragment = document.createDocumentFragment(), def = BOARDS[game.boardId];
  boardEl.style.setProperty('--cols', String(def.width));
  for (let i = 0; i < game.cells.length; i++) {
    if (game.cells[i] === -1) { const gap = document.createElement('span'); gap.className = 'void'; gap.setAttribute('aria-hidden', 'true'); nodes.push(null); fragment.append(gap); continue; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cell hole'; b.dataset.cell = String(i); b.tabIndex = -1;
    b.addEventListener('click', () => activate(i));
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) { hovered = i; renderCells(); } });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) { hovered = null; renderCells(); } });
    nodes.push(b); fragment.append(b);
  }
  boardEl.replaceChildren(fragment);
}
function renderCells() {
  const targets = targetsOf(game), width = game.width, previewAt = hovered ?? focusedCell;
  const removing = game.selected === null ? -1 : (targets.find(t => t.to === previewAt)?.over ?? -1);
  nodes.forEach((node, i) => {
    if (!node) return;
    const peg = game.cells[i] === 1, selected = game.selected === i, candidate = !peg && targets.some(t => t.to === i), doomed = removing === i;
    cls(node, `cell ${peg ? 'peg' : 'hole'}${selected ? ' sel' : ''}${candidate ? ' cand' : ''}${doomed ? ' rm' : ''}`);
    text(node, selected ? '◉' : peg ? '●' : candidate ? '◎' : '○');
    const where = `${Math.floor(i / width) + 1}행 ${i % width + 1}열`;
    attr(node, 'aria-label', peg ? `${where}, 돌${selected ? ', 선택됨' : doomed ? ', 뛰어넘으면 제거됨' : ''}` : `${where}, 빈 구멍${candidate ? ', 뛰어 도착할 수 있음' : ''}`);
    attr(node, 'aria-disabled', game.phase !== 'playing');
    const tab = game.phase === 'playing' && i === cursor ? 0 : -1; if (node.tabIndex !== tab) node.tabIndex = tab;
  });
}

// ---- render ------------------------------------------------------------------------------------------------------
function render() {
  buildBoard();
  const rec = record.records, best = rec.stages[game.stage - 1], playing = game.phase === 'playing', paused = game.phase === 'paused';
  attr(document.body, 'data-theme', modalKind === 'settings' ? draftTheme : record.settings.theme);
  text($('remaining'), `남은 돌 ${game.remaining}`); text($('stage-label'), `단계 ${game.stage} / ${STAGES.length}`); text($('undo-count'), `되돌리기 ${game.undoCount}회`);
  text($('stage-best'), best.bestRemaining === null ? '이 단계 기록 없음' : `이 단계 최소 남은 돌 ${best.bestRemaining}`);
  text($('status'), statusText());
  show($('warning'), warnings.size > 0); text($('warning'), [...warnings].map(code => WARNINGS[code]).join(' '));
  show($('play-controls'), playing || paused); show($('ready-panel'), game.phase === 'ready'); show($('result-panel'), game.phase === 'result');
  show($('pause'), !paused); show($('resume'), paused); text($('resume'), game.pauseCause === 'protect' ? '게임 재개' : '이어서하기');
  attr($('undo'), 'aria-disabled', !(playing && game.history.length > 0)); attr($('restart'), 'aria-disabled', !playing); attr($('pause'), 'aria-disabled', !playing);
  text($('mute'), record.settings.muted ? '소리 꺼짐' : '소리 켜짐'); attr($('mute'), 'aria-pressed', !record.settings.muted);
  text($('lifetime'), `클리어한 단계 ${rec.stages.filter(s => s.clearCount > 0).length} / ${STAGES.length} · 총 ${rec.completed}회`);
  stageButtons.forEach((b, i) => {
    const s = rec.stages[i], locked = i + 1 > rec.unlocked, state = locked ? '잠김' : s.clearCount > 0 ? '✓' : s.bestRemaining !== null ? `최소 남은 돌 ${s.bestRemaining}` : '';
    text(b.firstChild, `${i + 1} · ●${STAGES[i].count}`); text(b.lastChild, state);
    attr(b, 'aria-disabled', locked); attr(b, 'aria-pressed', game.stage === i + 1);
    attr(b, 'aria-label', `${i + 1}단계, 돌 ${STAGES[i].count}개, ${locked ? '잠김' : s.clearCount > 0 ? '클리어' : s.bestRemaining !== null ? `최소 남은 돌 ${s.bestRemaining}` : '기록 없음'}`);
  });
  if (game.phase === 'result') renderResult(best);
  renderCells();
}
function renderResult(best) {
  const win = game.result.outcome === 'win';
  text($('result-title'), win ? '조약돌 하나만 남았어요!' : '더 뛸 수 없어요');
  text($('result-detail'), win ? `남은 돌 1 · 되돌리기 ${game.result.undoCount}회 사용` : `남은 돌 ${game.result.remaining} · 이 단계 최소 남은 돌 ${best.bestRemaining ?? game.result.remaining}`);
  text($('result-save'), SAVE_NOTES[saveNote]);
  show($('next'), win && game.stage < STAGES.length); show($('undo-continue'), !win); show($('all-clear'), win && game.stage === STAGES.length);
  text($('retry'), win ? '다시 도전' : '처음부터');
}

// ---- state transitions -------------------------------------------------------------------------------------------
function apply(next, nextStatus) {
  const previous = game;
  if (next === previous && !nextStatus) return;
  game = next; if (nextStatus) status = nextStatus;
  if (previous.phase !== next.phase || previous.token !== next.token) clearInput();
  if (next.phase === 'result' && previous.phase !== 'result') settleResult();
  else if (next.phase !== 'result') { resultSettled = false; saveNote = 'none'; }
  render();
}
const inputEnabled = () => !modalKind && !document.hidden && game.phase === 'playing';
function focusCell(i) { nodes[i]?.focus({ preventScroll: true }); }
function focusResult() { ($('next').hidden ? ($('undo-continue').hidden ? $('retry') : $('undo-continue')) : $('next')).focus({ preventScroll: true }); }
function activate(i) {
  if (!inputEnabled()) return;
  audio.unlock(); cursor = i; focusCell(i);
  const outcome = select(game, i);
  if (outcome.kind === 'ignored') return;
  const code = { select: outcome.noTargets ? 'no-targets' : 'selected', replace: outcome.noTargets ? 'no-targets' : 'selected', deselect: 'playing', jump: 'jumped' }[outcome.kind] ?? outcome.kind;
  if (outcome.kind === 'select' || outcome.kind === 'replace') audio.play('select');
  if (outcome.kind === 'jump') { audio.play('jump'); audio.play('remove'); }
  apply(outcome.game, code);
  if (outcome.kind === 'jump' && game.phase === 'result') { audio.play(game.result.outcome); focusResult(); }
}
function begin(stageId = game.stage) {
  if (modalKind || document.hidden) return;
  clearInput(); audio.stop(); audio.unlock(); const next = startGame(game, stageId);
  cursor = centerOf(next); apply(next, 'playing'); focusCell(cursor);
}
function pause(cause) { audio.stop(); apply(pauseGame(game, cause), null); }
function protect() {
  clearInput(true); audio.stop();
  if (game.phase === 'playing' || (modalKind && game.phase === 'paused')) apply(pauseGame(game, 'protect'), null);
}

$('start').addEventListener('click', () => { if (game.phase === 'ready') begin(); });
$('retry').addEventListener('click', () => { if (game.phase === 'result') begin(); });
$('next').addEventListener('click', () => { if (game.phase === 'result' && game.result.outcome === 'win' && game.stage < STAGES.length) begin(game.stage + 1); });
$('choose').addEventListener('click', () => { if (game.phase !== 'result' || modalKind) return; apply(createGame(game.stage, game.round, game.token + 1), 'ready'); $('start').focus({ preventScroll: true }); });
$('undo-continue').addEventListener('click', () => {
  if (game.phase !== 'result' || game.result.outcome !== 'stuck' || modalKind) return;
  audio.play('undo'); apply(undo(game), 'undone'); focusCell(cursor);
});
$('undo').addEventListener('click', () => { if (inputEnabled() && game.history.length > 0) { audio.play('undo'); apply(undo(game), 'undone'); } });
$('pause').addEventListener('click', () => { if (inputEnabled()) { pause('manual'); $('resume').focus({ preventScroll: true }); } });
$('resume').addEventListener('click', () => {
  if (modalKind || document.hidden || game.phase !== 'paused') return;
  clearInput(); audio.unlock(); apply(resumeGame(game), 'playing'); focusCell(cursor);
});
$('restart').addEventListener('click', e => {
  if (!inputEnabled()) return;
  if (game.history.length === 0) { if (game.selected !== null) apply(deselect(game), 'playing'); return; }
  openModal('confirm-restart', e.currentTarget);
});
$('home').addEventListener('click', e => { if (game.phase === 'playing' || game.phase === 'paused') { e.preventDefault(); openModal('confirm-home', e.currentTarget); } });
$('help').addEventListener('click', e => openModal('help', e.currentTarget));
$('settings').addEventListener('click', e => openModal('settings', e.currentTarget));
$('mute').addEventListener('click', () => {
  if (modalKind) return;
  record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } };
  audio.setMuted(record.settings.muted); audio.unlock(); persist(); render();
});

// ---- modal -------------------------------------------------------------------------------------------------------
function openModal(kind, trigger) {
  if (modalKind) return;
  if (game.phase === 'playing') pause('manual');
  modalKind = kind; modalTrigger = trigger; draftTheme = record.settings.theme;
  const body = $('modal-body'), actions = $('modal-actions'); body.replaceChildren(); actions.replaceChildren();
  const paragraph = value => { const p = document.createElement('p'); p.textContent = value; body.append(p); };
  const action = (id, label, handler, primary = false) => {
    const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = label; if (primary) b.className = 'primary';
    b.addEventListener('click', handler); actions.append(b); return b;
  };
  let initial;
  if (kind === 'help') {
    text($('modal-title'), '조약돌 하나, 이렇게 해요');
    paragraph('돌 하나를 고르면 뛸 수 있는 빈 구멍에 ◎ 표시가 나타나요. 그 구멍을 누르면 바로 옆의 돌을 뛰어넘어 내려앉고, 뛰어넘은 돌은 사라져요. 위·아래·왼쪽·오른쪽으로 정확히 한 칸 건너 뛸 수 있어요.');
    paragraph('돌이 하나만 남으면 성공이에요. 돌이 둘 이상인데 더 뛸 곳이 없으면 막힌 거예요. 되돌리기는 횟수 제한이 없어요.');
    paragraph('방향키로 칸을 고르고 Enter / Space로 선택하고 뛰어요. Esc는 선택 해제, 한 번 더 누르면 정지예요. 이 창을 닫아도 게임은 멈춘 채 그대로예요.');
    paragraph('완료 기록·해금·설정만 저장해요. 진행 중인 판은 저장하지 않고, 포기하면 기록에 더하지 않아요.');
    initial = action('modal-close', '닫기', closeModal, true);
  } else if (kind === 'settings') {
    text($('modal-title'), '돌의 모습'); paragraph('테마는 돌과 판의 색만 바꿔요. 규칙과 기록은 같아요. 적용해야 저장돼요.');
    const choices = document.createElement('div'); choices.className = 'theme-choices'; body.append(choices);
    for (const theme of THEMES) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-option'; b.dataset.theme = theme; b.textContent = THEME_NAMES[theme]; attr(b, 'aria-pressed', theme === draftTheme);
      b.addEventListener('click', () => { draftTheme = theme; for (const option of choices.children) attr(option, 'aria-pressed', option.dataset.theme === theme); render(); });
      choices.append(b); if (theme === draftTheme) initial = b;
    }
    action('settings-apply', '적용', () => { if (draftTheme !== record.settings.theme) { record = { ...record, settings: { ...record.settings, theme: draftTheme } }; persist(); } closeModal(); }, true);
    action('modal-close', '취소', closeModal);
  } else {
    const home = kind === 'confirm-home';
    text($('modal-title'), home ? '게임 목록으로 갈까요?' : '처음부터 다시 할까요?');
    paragraph('진행 중인 판은 기록에 더하지 않아요. 취소하면 멈춘 상태로 돌아가요.');
    action('modal-confirm', home ? '게임 목록으로' : '처음부터 시작', () => { closeModal(); if (home) location.assign('/'); else begin(); }, true);
    initial = action('modal-close', '취소', closeModal);
  }
  render(); $('modal').showModal(); initial.focus();
}
function closeModal() {
  if (!modalKind) return;
  const trigger = modalTrigger; modalKind = null; modalTrigger = null; draftTheme = null; $('modal').close(); clearInput(); render();
  if (trigger?.isConnected && !trigger.hidden && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
  else if (game.phase === 'paused') $('resume').focus({ preventScroll: true });
  else if (game.phase === 'playing') focusCell(cursor);
}
$('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });

// ---- pointer gate -------------------------------------------------------------------------------------------------
// A tap = one primary pointer pressed and released on the same control within 8px. Anything else taints the sequence; the
// click that may follow a tainted sequence is dropped only inside a short timestamped window (never a permanent flag).
const SUPPRESS_MS = 300, pointers = new Map();
let gesture = null, tainted = false, suppressUntil = 0, handledTap = null;
const control = target => target instanceof Element ? target.closest('button,a[href]') : null;
function clearInput(reset = false) {
  if (pointers.size || gesture) suppressUntil = performance.now() + SUPPRESS_MS;
  gesture = null; tainted = pointers.size > 0 && !reset;
  if (reset) pointers.clear();
}
document.addEventListener('pointerdown', e => {
  suppressUntil = 0; handledTap = null;
  if (e.pointerType === 'mouse') for (const [id, type] of pointers) if (type === 'mouse') pointers.delete(id);
  pointers.set(e.pointerId, e.pointerType);
  if (pointers.size === 1) { tainted = !e.isPrimary || e.button !== 0; gesture = { id: e.pointerId, target: control(e.target), x: e.clientX, y: e.clientY }; }
  else { tainted = true; gesture = null; suppressUntil = performance.now() + SUPPRESS_MS; }
}, true);
document.addEventListener('pointermove', e => { if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) tainted = true; }, true);
document.addEventListener('pointerup', e => {
  const g = gesture;
  const valid = !tainted && pointers.size === 1 && g?.id === e.pointerId && g.target && Math.hypot(e.clientX - g.x, e.clientY - g.y) <= 8 && control(document.elementFromPoint(e.clientX, e.clientY)) === g.target;
  if (!valid) tainted = true;
  pointers.delete(e.pointerId);
  if (tainted) suppressUntil = performance.now() + SUPPRESS_MS;
  if (pointers.size === 0) { tainted = false; gesture = null; }
  // A validated tap on a cell acts right here, so a browser that swallows the click (e.g. a tap that only stops a fling) cannot lose it.
  if (valid && g.target.classList.contains('cell')) { handledTap = { cell: g.target, at: performance.now() }; activate(Number(g.target.dataset.cell)); }
}, true);
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; tainted = pointers.size > 0; suppressUntil = performance.now() + SUPPRESS_MS; }, true);
document.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); gesture = null; tainted = pointers.size > 0; suppressUntil = performance.now() + SUPPRESS_MS; } }, true);
document.addEventListener('scroll', () => { if (pointers.size) { tainted = true; suppressUntil = performance.now() + SUPPRESS_MS; } }, true);
// Touch browsers replay mousedown after pointerup; it must not pull focus back from the control we just focused.
document.addEventListener('mousedown', e => { if (handledTap && performance.now() - handledTap.at < SUPPRESS_MS) e.preventDefault(); }, true);
document.addEventListener('click', e => {
  const now = performance.now();
  // Drop clicks that follow a cancelled gesture (short window) and the native click that follows an already handled cell tap.
  const handled = e.detail > 0 && handledTap && now - handledTap.at < SUPPRESS_MS && control(e.target) === handledTap.cell;
  if (now < suppressUntil || handled) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// ---- keyboard / focus ----------------------------------------------------------------------------------------------
function modalFocusables() {
  return [...$('modal').querySelectorAll('button,a[href]')].filter(el => !el.disabled && el.getClientRects().length > 0);
}
document.addEventListener('focusin', e => {
  if (modalKind && !$('modal').contains(e.target)) { modalFocusables()[0]?.focus(); return; }
  const cell = e.target instanceof Element ? e.target.closest('.cell') : null;
  focusedCell = cell ? Number(cell.dataset.cell) : null;
  if (cell) cursor = focusedCell;
  renderCells();
}, true);
document.addEventListener('focusout', () => { focusedCell = null; renderCells(); }, true);
const ARROWS = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
document.addEventListener('keydown', e => {
  suppressUntil = 0; handledTap = null; // keyboard input always releases the click-suppression window
  if (e.key === 'Tab' && modalKind && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const items = modalFocusables(), first = items[0], last = items.at(-1), active = document.activeElement;
    if (!first) e.preventDefault();
    else if (!items.includes(active) || (e.shiftKey ? active === first : active === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    return;
  }
  // A key that is still held (auto-repeat) never activates a freshly focused control.
  if ((e.key === 'Enter' || e.key === ' ') && e.repeat && control(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') {
    if (e.repeat) return;
    if (modalKind) { e.preventDefault(); closeModal(); return; }
    const active = document.activeElement;
    if (game.phase === 'playing' && !document.hidden && (active === document.body || active?.closest('main,header'))) {
      e.preventDefault();
      if (game.selected !== null) apply(deselect(game), 'playing'); else { pause('manual'); $('resume').focus({ preventScroll: true }); }
    }
    return;
  }
  const cell = e.target instanceof Element ? e.target.closest('.cell') : null;
  if (!cell || !ARROWS[e.key] || !inputEnabled()) return;
  e.preventDefault();
  const [dr, dc] = ARROWS[e.key], row = Math.floor(cursor / game.width) + dr, col = cursor % game.width + dc;
  if (row < 0 || col < 0 || row >= game.height || col >= game.width || game.cells[row * game.width + col] === -1) return;
  cursor = row * game.width + col; hovered = null; focusCell(cursor); // keyboard takes over from a resting mouse
}, true);

// ---- protection ---------------------------------------------------------------------------------------------------
window.addEventListener('blur', protect);
window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); });

// ---- read-only snapshot -------------------------------------------------------------------------------------------
Object.defineProperty(window, '__g030Snapshot', {
  configurable: false, writable: false,
  value: () => structuredClone({
    phase: game.phase, pauseCause: game.pauseCause, modal: modalKind, round: game.round, token: game.token,
    stage: game.stage, tier: game.tier, boardId: game.boardId, width: game.width, height: game.height,
    cells: game.cells, remaining: game.remaining, selected: game.selected, targets: targetsOf(game), cursor,
    jumps: game.jumps, undoCount: game.undoCount, historyLength: game.history.length, history: game.history,
    result: game.result && { ...game.result, settled: resultSettled }, readyStage: game.phase === 'ready' ? game.stage : null,
    records: record.records, settings: record.settings, saveStatus, saveNote, warnings: [...warnings], status: currentStatus(),
  }),
});
render();
