import { MODES, createGame, startGame, selectCell, clearSelection, advanceGame, pauseGame, resumeGame, groupScore } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord, CAP } from './save.mjs';
import { createSound } from './audio.mjs';
const $ = id => document.getElementById(id), boardNode = $('board'), dialog = $('modal');
const names = ['코랄 원', '민트 삼각', '금빛 마름모', '보라 별'], shapes = ['●', '▲', '◆', '★'], modeNames = { easy: '입문', normal: '기본', extra: '확장' };
const loaded = loadRecord(), warnings = new Set(loaded.warnings), sound = createSound();
let record = loaded.record, game = createGame(record.settings.lastMode), modal = null, cells = [], boardMode = null, cursor = [0, 0];
let settledRound = -1, resultBest = false, resultTie = false, resultSaved = false, gesture = null, suppressClick = false, suppressTimer = 0, raf = 0, lastTime = performance.now();
const pointers = new Set(), held = new Set(), releaseRequired = new Set();
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const attr = (node, name, value) => { if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); };
const hidden = (node, value) => { if (node.hidden !== value) node.hidden = value; };
function suppress() { suppressClick = true; clearTimeout(suppressTimer); suppressTimer = setTimeout(() => { suppressClick = pointers.size > 0; }, 300); }
function clearInputs() { if (gesture || pointers.size) suppress(); gesture = null; for (const key of held) releaseRequired.add(key); held.clear(); sound.stop(); }
function persist() { const result = saveRecord(record); if (!result.ok) warnings.add(result.warning); return result.ok; }
function inputEnabled() { return !document.hidden && !modal && game.phase === 'playing' && game.subphase === 'input'; }
function clampCursor() {
  if (game.board[cursor[0]]?.[cursor[1]] !== null && game.board[cursor[0]]?.[cursor[1]] !== undefined) return;
  let best = null, distance = Infinity;
  game.board.forEach((row, r) => row.forEach((color, c) => { const d = Math.abs(r - cursor[0]) + Math.abs(c - cursor[1]); if (color !== null && d < distance) { best = [r, c]; distance = d; } }));
  cursor = best ?? [0, 0];
}
function focusCell() {
  clampCursor(); renderCells(); const cell = cells.find(cell => Number(cell.dataset.row) === cursor[0] && Number(cell.dataset.col) === cursor[1] && !cell.disabled);
  (cell ?? boardNode).focus({ preventScroll: true });
  cell?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
function renderCells() {
  if (game.board.length && boardMode !== game.mode) {
    boardMode = game.mode; cells = [];
    const fragment = document.createDocumentFragment();
    game.board.forEach((row, r) => row.forEach((_, c) => { const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell'; cell.id = `cell-${r}-${c}`; cell.dataset.row = String(r); cell.dataset.col = String(c); cell.tabIndex = -1; cells.push(cell); fragment.append(cell); }));
    boardNode.replaceChildren(fragment);
  }
  boardNode.classList.toggle('easy', game.mode === 'easy'); boardNode.classList.toggle('locked', game.subphase === 'collapse');
  attr(boardNode, 'aria-busy', game.subphase === 'collapse');
  const selected = new Set(game.selection.map(([r, c]) => `${r},${c}`));
  cells.forEach(cell => {
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col), color = game.board[r]?.[c] ?? null, empty = color === null;
    cell.classList.toggle('empty', empty); cell.classList.toggle('selected', selected.has(`${r},${c}`));
    attr(cell, 'data-color', empty ? '' : color); attr(cell, 'aria-label', `${r + 1}행 ${c + 1}열 ${empty ? '빈칸' : names[color]}`);
    attr(cell, 'aria-pressed', selected.has(`${r},${c}`)); attr(cell, 'aria-disabled', !inputEnabled() || empty);
    text(cell, empty ? '' : shapes[color]); if (cell.disabled !== empty) cell.disabled = empty;
    const tabIndex = !empty && r === cursor[0] && c === cursor[1] ? 0 : -1; if (cell.tabIndex !== tabIndex) cell.tabIndex = tabIndex;
  });
}
function render() {
  attr(document.body, 'data-theme', modal?.kind === 'theme' ? modal.preview : record.settings.theme);
  const r = record.records[game.mode]; text($('score'), String(game.score)); text($('remaining'), String(game.remaining)); text($('best-score'), String(r.bestScore));
  text($('mute'), record.settings.muted ? '소리 꺼짐' : '소리 켜짐'); attr($('mute'), 'aria-pressed', record.settings.muted);
  text($('record-title'), `${modeNames[game.mode]} 모드 기록`); text($('record-detail'), `완료 ${r.finished}판 · 전부 정리 ${r.allClears}판 · 최소 잔여 ${r.bestRemaining === null ? '—' : r.bestRemaining}개 · 누적 ${r.totalScore}점`);
  for (const mode of Object.keys(MODES)) attr($(`mode-${mode}`), 'aria-pressed', mode === game.mode);
  hidden($('start'), game.phase !== 'ready'); hidden($('pause'), game.phase !== 'playing'); hidden($('resume'), game.phase !== 'paused');
  hidden($('restart'), !['playing', 'paused'].includes(game.phase)); hidden($('retry'), game.phase !== 'result'); hidden($('result'), game.phase !== 'result'); hidden($('cancel-selection'), game.phase !== 'playing');
  const cancelDisabled = !inputEnabled() || !game.selection.length; if ($('cancel-selection').disabled !== cancelDisabled) $('cancel-selection').disabled = cancelDisabled;
  text($('resume'), game.pauseCause === 'manual' ? '이어서하기' : '게임 재개');
  let message = '시작을 눌러 젤리를 골라 보세요', detail = '두 번 눌러 제거 · 시간제한 없음';
  if (game.phase === 'playing') {
    message = game.subphase === 'collapse' ? '젤리를 가지런히 모으는 중이에요' : '같은 젤리 묶음을 골라 주세요';
    detail = game.subphase === 'collapse' ? '잠깐 기다리면 다음 묶음을 고를 수 있어요.' : game.selection.length ? `${game.selection.length}개 · 예상 ${groupScore(game.selection.length)}점 · 한 번 더 누르면 제거 (전부 비우기 보너스 별도 500점)` : game.notice || '상하좌우로 이어진 같은 모양 2개 이상을 골라요.';
  } else if (game.phase === 'paused') { message = '잠시 정지했어요'; detail = game.pauseCause === 'protection' ? '화면 이탈이나 긴 대기로 보호 정지했어요. 직접 게임 재개를 눌러 주세요.' : '선택과 남은 정리 시간을 기억하고 있어요. 직접 재개해 주세요.'; }
  else if (game.phase === 'result') {
    message = game.result.reason === 'all-clear' ? '접시를 깨끗하게 비웠어요!' : '더 이상 연결된 묶음이 없어요'; detail = resultSaved ? '이번 기록을 저장했어요. 새 접시에도 도전해 보세요.' : '기록을 저장하지 못했어요. 이번 판은 메모리에만 유지돼요. 새 접시에도 도전해 보세요.';
    text($('result-detail'), `점수 ${game.score}점 · 제거 ${game.moves}회 · 남은 ${game.remaining}개 · 완전 정리 보너스 ${game.bonus}점${resultBest ? ' · 개인 최고 갱신!' : resultTie ? ' · 개인 최고와 동점' : ''}`);
  }
  text($('state-message'), message); text($('detail'), detail); renderCells();
  const messages = [...warnings]; if (r.finished === CAP || r.totalScore === CAP) messages.push('누적 기록 한도에 도달했어요. 계속 플레이할 수 있어요.');
  hidden($('storage-warning'), messages.length === 0); text($('storage-warning'), messages.join(' '));
}
function update(next) {
  if (next === game) return;
  const previous = game, boardFocused = boardNode.contains(document.activeElement); game = next;
  if (previous.phase !== game.phase || previous.round !== game.round || previous.revision !== game.revision) clearInputs();
  if (game.phase === 'result' && settledRound !== game.round) {
    settledRound = game.round; const old = record.records[game.mode]; resultBest = game.score > old.bestScore; resultTie = game.score === old.bestScore;
    const nextRecord = settleRecord(record, game.mode, game.result);
    resultSaved = false;
    if (nextRecord !== record) { record = nextRecord; resultSaved = persist(); } else warnings.add('누적 기록 한도로 이번 기록은 저장하지 않았어요.');
    sound.play('success', record.settings.muted);
  } else if (previous.moves !== game.moves) sound.play(game.board.flat().find(color => color !== null) ?? 0, record.settings.muted);
  clampCursor(); render();
  if (game.phase === 'result') $('retry').focus(); else if (boardFocused && previous.revision !== game.revision) focusCell();
  schedule();
}
function sync(now = performance.now()) {
  const delta = Math.max(0, now - lastTime); lastTime = now;
  if (game.phase !== 'playing' || game.subphase !== 'collapse' || modal) return;
  if (delta > 250) { update(pauseGame(game, 'protection')); return; }
  const next = advanceGame(game, delta);
  // Remaining logical milliseconds are state only; DOM changes only at a lock boundary.
  if (next.phase !== game.phase || next.subphase !== game.subphase) update(next); else game = next;
}
function schedule() { if (!raf && game.phase === 'playing' && game.subphase === 'collapse' && !modal) raf = requestAnimationFrame(() => { raf = 0; sync(); schedule(); }); }
function pause(cause) { sync(); clearInputs(); if (raf) cancelAnimationFrame(raf); raf = 0; update(pauseGame(game, cause)); lastTime = performance.now(); }
function begin(mode = game.mode) { if (modal || document.hidden) return; clearInputs(); cursor = [0, 0]; lastTime = performance.now(); update(startGame(game, mode)); if (game.phase !== 'result') focusCell(); }
function activateCell(row, col) { sync(); if (!inputEnabled()) return; cursor = [row, col]; lastTime = performance.now(); update(selectCell(game, row, col)); }
function paragraph(value) { const p = document.createElement('p'); p.textContent = value; return p; }
function setMode(mode) { if (mode === record.settings.lastMode) return; record = { ...record, settings: { ...record.settings, lastMode: mode } }; persist(); }
function openModal(kind, trigger, mode = null) {
  if (modal) return; pause('dialog'); modal = { kind, trigger, mode, preview: record.settings.theme };
  const content = $('modal-content'); content.replaceChildren(); hidden($('modal-apply'), kind === 'help'); text($('modal-close'), kind === 'help' ? '닫기' : '취소');
  if (kind === 'help') {
    text($('modal-title'), '젤리 한입 하는 법'); content.append(paragraph('상하좌우로 연결된 같은 젤리 2개 이상을 골라 주세요. 첫 누름은 선택, 같은 묶음의 어느 칸이든 한 번 더 누르면 제거해요. 다른 묶음을 누르면 선택이 바뀌어요. 대각선은 연결되지 않아요.'), paragraph('n개를 한 번에 제거하면 (n−2)²점이에요. 2개는 0점, 3개는 1점. 전부 비우면 500점을 한 번 더 받아요. 빈자리는 아래로, 빈 열은 왼쪽으로 모여요. 연결된 묶음이 없으면 끝나요. 무작위 판은 전부 정리할 수 있다는 보장이 없어요.'), paragraph('방향키로 탐색하고 Enter / Space로 선택과 확정을 해요. 선택 취소는 점수를 바꾸지 않아요. 작은 화면에서는 보드 안을 스크롤하세요. 정지·도움말·테마·화면 이탈 때 정리 시간도 멈추며 직접 재개해야 해요.'), paragraph('모드별 완료 기록과 명시적으로 적용한 설정만 저장해요. 진행 중인 판을 포기하거나 새로고침하면 정산하지 않아요. 테마는 외형만 바꾸며 소리는 기본 꺼짐이에요.'));
  } else if (kind === 'theme') {
    text($('modal-title'), '젤리 테마'); text($('modal-apply'), '적용'); content.append(paragraph('두 테마 모두 같은 모양과 규칙을 사용해요. 적용해야 설정을 저장해요.'));
    const options = document.createElement('div'); options.className = 'theme-options'; options.setAttribute('role', 'radiogroup'); options.setAttribute('aria-label', '젤리 테마');
    for (const [id, label] of [['sugar', '설탕 제과점'], ['night', '밤의 제과점']]) { const button = document.createElement('button'); button.id = `theme-${id}`; button.type = 'button'; button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(modal.preview === id)); button.textContent = label; button.addEventListener('click', () => { if (modal?.kind !== 'theme') return; modal.preview = id; options.querySelectorAll('button').forEach(node => attr(node, 'aria-checked', node === button)); render(); }); options.append(button); } content.append(options);
  } else {
    text($('modal-title'), kind === 'home' ? '게임 목록으로 돌아갈까요?' : mode ? `${modeNames[mode]} 모드의 새 판을 시작할까요?` : '새 접시를 준비할까요?'); text($('modal-apply'), kind === 'home' ? '나가기' : '새 판 시작'); content.append(paragraph('진행 중인 판은 포기하며 완료 기록에 포함하지 않아요. 취소하면 정지 상태로 돌아가요.'));
  }
  render(); dialog.showModal(); $('modal-close').focus();
}
function closeModal(apply = false) {
  if (!modal) return; const previous = modal;
  if (apply && previous.kind === 'theme' && previous.preview !== record.settings.theme) { record = { ...record, settings: { ...record.settings, theme: previous.preview } }; persist(); }
  modal = null; dialog.close(); clearInputs(); lastTime = performance.now(); render();
  if (previous.trigger?.isConnected && !previous.trigger.hidden) previous.trigger.focus(); else if (game.phase === 'paused') $('resume').focus();
  if (apply && previous.kind === 'restart') { if (previous.mode) setMode(previous.mode); begin(previous.mode ?? game.mode); }
  if (apply && previous.kind === 'home') location.assign('/');
}
$('start').addEventListener('click', () => begin()); $('retry').addEventListener('click', () => begin());
$('pause').addEventListener('click', () => { if (!modal) { pause('manual'); $('resume').focus(); } });
$('resume').addEventListener('click', () => { if (!modal && !document.hidden && game.phase === 'paused') { clearInputs(); lastTime = performance.now(); update(resumeGame(game)); focusCell(); } });
$('cancel-selection').addEventListener('click', () => { if (inputEnabled()) update(clearSelection(game)); });
$('help').addEventListener('click', e => openModal('help', e.currentTarget)); $('theme').addEventListener('click', e => openModal('theme', e.currentTarget)); $('restart').addEventListener('click', e => openModal('restart', e.currentTarget));
$('home').addEventListener('click', e => { if (['playing', 'paused'].includes(game.phase)) { e.preventDefault(); openModal('home', e.currentTarget); } });
$('mute').addEventListener('click', () => { if (modal) return; record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } }; sound.stop(); persist(); render(); });
for (const node of document.querySelectorAll('[data-mode]')) node.addEventListener('click', () => {
  const mode = node.dataset.mode; if (modal || mode === game.mode) return;
  if (['playing', 'paused'].includes(game.phase)) openModal('restart', node, mode);
  else { setMode(mode); game = { ...createGame(mode), round: game.round }; boardMode = null; cells = []; boardNode.replaceChildren(); render(); }
});
$('modal-close').addEventListener('click', () => closeModal()); $('modal-apply').addEventListener('click', () => closeModal(true)); dialog.addEventListener('cancel', e => { e.preventDefault(); closeModal(); }); dialog.addEventListener('close', () => { if (modal && !dialog.open) closeModal(); });
document.addEventListener('focusin', e => { if (modal && !dialog.contains(e.target)) $('modal-close').focus(); else if (e.target.matches?.('[data-row]')) { cursor = [Number(e.target.dataset.row), Number(e.target.dataset.col)]; renderCells(); } });
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (modal && e.key === 'Tab') { const options = [...dialog.querySelectorAll('button,a[href]')].filter(node => !node.disabled && node.getClientRects().length); if (e.shiftKey && document.activeElement === options[0]) { e.preventDefault(); options.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === options.at(-1)) { e.preventDefault(); options[0]?.focus(); } return; }
  const target = e.target.closest?.('button,a[href]'), cell = e.target.closest?.('[data-row]');
  if (e.key === 'Escape') { if (modal) { e.preventDefault(); if (!e.repeat) closeModal(); } else if (game.phase === 'playing' && (target || boardNode.contains(e.target))) { e.preventDefault(); if (!e.repeat) { pause('manual'); $('resume').focus(); } } return; }
  if (cell && !modal && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && inputEnabled()) {
    e.preventDefault(); const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; let [r, c] = cursor;
    do { r += dr; c += dc; if (r < 0 || c < 0 || r >= game.board.length || c >= game.board[0].length) return; } while (game.board[r][c] === null);
    cursor = [r, c]; focusCell(); return;
  }
  if (!target || !['Enter', ' '].includes(e.key)) return;
  e.preventDefault(); const key = e.code || e.key; if (e.repeat || held.has(key) || releaseRequired.has(key)) return; held.add(key);
  if (cell) activateCell(Number(cell.dataset.row), Number(cell.dataset.col)); else target.click();
}, true);
document.addEventListener('keyup', e => { const key = e.code || e.key, claimed = held.has(key) || releaseRequired.has(key); held.delete(key); releaseRequired.delete(key); if (claimed && e.key === ' ') e.preventDefault(); }, true);
document.addEventListener('pointerdown', e => {
  pointers.add(e.pointerId); if (pointers.size !== 1) { gesture = null; suppress(); return; }
  const cell = e.target.closest?.('[data-row]'); if (!cell || e.button !== 0) return;
  suppress(); sync(); if (!inputEnabled()) return;
  gesture = { id: e.pointerId, cell, x: e.clientX, y: e.clientY, round: game.round, revision: game.revision }; try { cell.setPointerCapture(e.pointerId); } catch {}
}, true);
document.addEventListener('pointermove', e => { if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture = null; }, true);
document.addEventListener('pointerup', e => {
  const tap = gesture; gesture = null; pointers.delete(e.pointerId); if (suppressClick) suppress();
  if (!tap || tap.id !== e.pointerId || pointers.size || tap.round !== game.round || tap.revision !== game.revision || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) return;
  if (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-row]') === tap.cell) activateCell(Number(tap.cell.dataset.row), Number(tap.cell.dataset.col));
}, true);
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; suppress(); }, true); document.addEventListener('lostpointercapture', () => { gesture = null; }, true);
document.addEventListener('scroll', () => { if (gesture || pointers.size) suppress(); gesture = null; }, true);
boardNode.addEventListener('click', e => { const cell = e.target.closest?.('[data-row]'); if (cell && e.detail === 0 && !e.pointerType && !suppressClick) activateCell(Number(cell.dataset.row), Number(cell.dataset.col)); });
function protect() { pause('protection'); pointers.clear(); }
window.addEventListener('blur', protect); window.addEventListener('pagehide', protect); document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); lastTime = performance.now(); });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
Object.defineProperty(window, '__g029Snapshot', { value: () => freeze(structuredClone({ ...game, records: record.records, settings: record.settings, modal: modal?.kind ?? null, cursor, warnings: [...warnings] })), writable: false, configurable: false });
render();
