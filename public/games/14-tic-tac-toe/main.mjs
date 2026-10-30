import { createGame, startGame, place, pauseGame, resumeGame, nextRound, restartRound, rove, opposite, totalRounds, COUNTER_CAP } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord } from './save.mjs';
import { createSound } from './audio.mjs';

const $ = id => document.getElementById(id);
const loaded = loadRecord();
let record = loaded.record, game = createGame(), selection = 0, modalState = null;
const warnings = new Set(loaded.warnings), sound = createSound();
const heldKeys = new Set(), releaseRequired = new Set(), pointers = new Set();
let gesture = null, approvedTap = null;
const dialog = $('modal');
const labels = { X: '별 X', O: '달 O' };
function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
const cells = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'cell'; button.dataset.index = String(index); button.id = `cell-${index}`;
  const image = document.createElement('img'); image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.hidden = true;
  const mark = document.createElement('span'); mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true');
  button.append(image, mark); $('board').append(button);
  button.addEventListener('focus', () => { if (game.phase === 'playing' && !modalState) { selection = index; updateRoving(); } });
  button.addEventListener('click', () => move(index));
  return button;
});
function updateRoving() { cells.forEach((cell, index) => { cell.tabIndex = index === selection ? 0 : -1; }); }
function clearInputs() { gesture = null; approvedTap = null; for (const key of heldKeys) releaseRequired.add(key); heldKeys.clear(); sound.stop(); }
function render() {
  const round = game.round, visualTheme = modalState?.kind === 'theme' ? modalState.preview : record.settings.theme;
  document.body.dataset.theme = visualTheme;
  const winning = new Set(round.winningLines.flat());
  cells.forEach((cell, index) => {
    const mark = round.board[index], image = cell.firstElementChild;
    const label = `${Math.floor(index / 3) + 1}행 ${index % 3 + 1}열, ${mark ? labels[mark] : '빈칸'}${winning.has(index) ? ', 승리 줄' : ''}`;
    if (cell.getAttribute('aria-label') !== label) cell.setAttribute('aria-label', label);
    cell.setAttribute('aria-disabled', String(game.phase !== 'playing' || !!modalState || mark !== null));
    cell.dataset.mark = mark || '';
    cell.classList.toggle('winning', winning.has(index));
    if (mark) {
      const src = `./assets/${visualTheme}-${mark.toLowerCase()}.svg`;
      if (image.getAttribute('src') !== src) image.setAttribute('src', src);
      image.hidden = false;
    } else { image.hidden = true; image.removeAttribute('src'); }
    setText(cell.lastElementChild, mark || '');
  });
  updateRoving();
  setText($('session-x'), String(game.session.xWins)); setText($('session-o'), String(game.session.oWins)); setText($('session-draw'), String(game.session.draws));
  setText($('lifetime'), `별 X ${record.lifetime.xWins} · 무승부 ${record.lifetime.draws} · 달 O ${record.lifetime.oWins}`);
  setText($('mute'), `음소거: ${record.settings.muted ? '켜짐' : '꺼짐'}`); $('mute').setAttribute('aria-pressed', String(record.settings.muted));
  $('start').hidden = game.phase !== 'ready'; $('pause').hidden = game.phase !== 'playing';
  $('resume').hidden = game.phase !== 'paused'; $('next').hidden = game.phase !== 'result';
  $('restart').hidden = game.phase === 'ready' || game.phase === 'result';
  let heading, message;
  if (game.phase === 'ready') { heading = '별 X부터 시작합니다'; message = '시작을 눌러 한 기기에서 두 사람이 번갈아 놓으세요.'; }
  else if (game.phase === 'result') {
    heading = round.winner === 'draw' ? '무승부' : `${labels[round.winner]}가 한 줄을 완성했어요`;
    message = `다음 판은 ${labels[opposite(round.starter)]}부터 시작합니다. 이번 판 ${round.moves}수.`;
  } else if (game.phase === 'paused') {
    heading = `${labels[round.current]}의 차례 · 정지`;
    message = game.pauseCause === 'protection' ? '화면 이탈로 보호 정지했어요. 준비되면 게임 재개를 눌러 주세요.' : '판을 잠시 멈췄어요. 계속하려면 게임 재개를 눌러 주세요.';
  } else { heading = `${labels[round.current]}의 차례`; message = `${labels[round.current]} 차례입니다. 빈칸 하나에 놓으세요.`; }
  setText($('turn'), heading); setText($('state-message'), message);
  const messages = [...warnings];
  if (totalRounds(record.lifetime) >= BigInt(COUNTER_CAP)) messages.push('누적 전적 한도 1,000,000판에 도달했습니다. 게임은 계속되며 누적 전적은 더 늘어나지 않습니다.');
  if (totalRounds(game.session) >= BigInt(COUNTER_CAP)) messages.push('이번 세션의 전적 한도에 도달했습니다. 게임은 계속할 수 있습니다.');
  $('storage-warning').hidden = messages.length === 0; setText($('storage-warning'), messages.join(' '));
}
function persist() {
  const saved = saveRecord(record);
  if (!saved.ok) warnings.add(saved.warning);
}
function move(index) {
  if (modalState) return;
  const before = game, after = place(game, index);
  if (before === after) return;
  game = after;
  if (after.phase === 'result') {
    record = settleRecord(record, after.round.winner); persist();
    sound.play(after.round.winner === 'draw' ? 'draw' : 'win', record.settings.muted);
  } else sound.play(before.round.current, record.settings.muted);
  render();
  if (after.phase === 'result') $('next').focus();
}
function fresh(transition) {
  if (modalState) return;
  const after = transition(game); if (after === game) return;
  clearInputs(); game = after; selection = 0; render(); cells[0].focus();
}
function pause(cause) {
  clearInputs(); game = pauseGame(game, cause); render();
}
function closeModal(apply = false) {
  const previous = modalState;
  if (!previous) return;
  if (previous.kind === 'theme' && apply) { record = { ...record, settings: { ...record.settings, theme: previous.preview } }; persist(); }
  modalState = null; dialog.close(); clearInputs(); render();
  // Native close restores its own focus synchronously; restore the actual trigger once.
  // No RAF/close-event refocusing can steal focus after explicit resume.
  if (previous.trigger?.isConnected && !previous.trigger.hidden) previous.trigger.focus();
  if (apply && previous.kind === 'restart') fresh(restartRound);
  if (apply && previous.kind === 'home') window.location.assign('/');
}
function paragraph(text) { const p = document.createElement('p'); p.textContent = text; return p; }
function openModal(kind, trigger) {
  if (modalState) return;
  pause('dialog');
  modalState = { kind, trigger, preview: record.settings.theme };
  const content = $('modal-content'); content.replaceChildren();
  $('modal-apply').hidden = kind === 'help';
  setText($('modal-close'), kind === 'help' ? '닫기' : '취소');
  if (kind === 'help') {
    setText($('modal-title'), '별과 달 3목 하는 법');
    content.append(paragraph('한 기기에서 두 사람이 번갈아 빈칸에 놓습니다. 별은 X, 달은 O입니다. 가로·세로·대각선 중 세 칸을 먼저 이으면 승리합니다. 승리 없이 아홉 칸이 차면 무승부입니다.'), paragraph('방향키로 초점을 옮기고 Enter 또는 Space로 놓으세요. 보드 가장자리에서 방향키는 멈춥니다. 이미 놓인 칸은 차례를 바꾸지 않습니다.'), paragraph('완료한 다음 판은 이전 후공이 선공입니다. 진행 중 다시 시작하면 같은 선공입니다. 도움말·테마·화면 이탈 뒤에는 직접 게임 재개를 눌러 주세요.'), paragraph('세션 전적은 새로고침하면 0으로 돌아갑니다. 누적 전적과 적용한 테마·음소거만 기기에 저장합니다. 소리는 처음에 꺼져 있습니다.'));
  } else if (kind === 'theme') {
    setText($('modal-title'), '보드 테마'); setText($('modal-apply'), '적용');
    content.append(paragraph('두 테마 모두 기본 제공됩니다. 미리보기는 외형만 바꾸며, 적용해야 저장됩니다.'));
    const options = document.createElement('div'); options.className = 'theme-options'; options.setAttribute('role', 'radiogroup'); options.setAttribute('aria-label', '테마 선택');
    for (const [id, title, description] of [['paper', '종이 노트', '밝은 종이와 또렷한 별 X · 달 O'], ['night', '밤하늘 노트', '푸른 판과 둥근 별 X · 달 O']]) {
      const option = document.createElement('button'); option.type = 'button'; option.className = 'theme-option'; option.id = `theme-${id}`; option.setAttribute('role', 'radio');
      const titleNode = document.createElement('span'), descriptionNode = document.createElement('small'); titleNode.textContent = title; descriptionNode.textContent = description; option.append(titleNode, descriptionNode);
      option.setAttribute('aria-checked', String(id === modalState.preview));
      option.addEventListener('click', () => {
        modalState.preview = id;
        options.querySelectorAll('button').forEach(button => button.setAttribute('aria-checked', String(button.id === `theme-${id}`)));
        render();
      }); options.append(option);
    }
    content.append(options);
  } else {
    setText($('modal-title'), kind === 'home' ? '게임 서재로 돌아갈까요?' : '현재 판을 다시 시작할까요?');
    setText($('modal-apply'), kind === 'home' ? '나가기' : '다시 시작');
    content.append(paragraph('진행 중인 판은 포기하며 전적에 포함하지 않습니다. 완료한 세션·누적 전적은 유지됩니다. 다시 시작할 때 선공은 바뀌지 않습니다.'));
  }
  render(); dialog.showModal(); $('modal-close').focus();
}
$('start').addEventListener('click', () => fresh(startGame));
$('next').addEventListener('click', () => fresh(nextRound));
$('pause').addEventListener('click', () => { if (!modalState) { pause('manual'); $('resume').focus(); } });
$('resume').addEventListener('click', () => { if (!modalState) { fresh(resumeGame); } });
$('restart').addEventListener('click', event => openModal('restart', event.currentTarget));
$('home').addEventListener('click', event => {
  if (game.phase === 'playing' || game.phase === 'paused') { event.preventDefault(); openModal('home', event.currentTarget); }
});
$('help').addEventListener('click', event => openModal('help', event.currentTarget));
$('theme').addEventListener('click', event => openModal('theme', event.currentTarget));
$('mute').addEventListener('click', () => {
  if (modalState) return;
  record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } };
  sound.stop(); persist(); render();
});
$('modal-close').addEventListener('click', () => closeModal(false));
$('modal-apply').addEventListener('click', () => closeModal(true));
dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(false); });
dialog.addEventListener('close', () => { if (modalState && !dialog.open) closeModal(false); });

// One activation per released key for both native cells and controls. No global arrow shortcuts.
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey && event.key !== 'Tab') return;
  if (modalState && event.key === 'Tab') {
    const tabbable = [...dialog.querySelectorAll('button,a[href],[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = tabbable[0], last = tabbable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (event.key === 'Escape') {
    if (modalState) { event.preventDefault(); closeModal(false); }
    else if (game.phase === 'playing') { event.preventDefault(); pause('manual'); $('resume').focus(); }
    return;
  }
  const target = event.target instanceof Element ? event.target.closest('button,a[href]') : null;
  if (!target) return;
  const activation = event.key === 'Enter' || event.key === ' ';
  const boardArrow = target.classList.contains('cell') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !modalState;
  if (!activation && !boardArrow) return;
  event.preventDefault();
  const code = event.code || event.key;
  if (event.repeat || heldKeys.has(code) || releaseRequired.has(code)) { event.stopImmediatePropagation(); return; }
  heldKeys.add(code);
  if (boardArrow) {
    if (game.phase !== 'playing') return;
    selection = rove(Number(target.dataset.index), event.key); updateRoving(); cells[selection].focus();
  } else target.click();
}, true);
document.addEventListener('keyup', event => { heldKeys.delete(event.code || event.key); releaseRequired.delete(event.code || event.key); }, true);

// Page-wide observation: a second pointer outside the board also cancels the first.
function actionable(target) { return target instanceof Element ? target.closest('button,a[href]') : null; }
document.addEventListener('pointerdown', event => {
  pointers.add(event.pointerId); approvedTap = null;
  if (pointers.size > 1 || event.isPrimary === false || event.button !== 0) { if (gesture) gesture.cancelled = true; return; }
  const target = actionable(event.target);
  gesture = target ? { id: event.pointerId, target, x: event.clientX, y: event.clientY, cancelled: false, roundId: game.round.id } : null;
}, true);
document.addEventListener('pointermove', event => {
  if (gesture?.id === event.pointerId && (Math.abs(event.clientX - gesture.x) > 8 || Math.abs(event.clientY - gesture.y) > 8)) gesture.cancelled = true;
}, true);
document.addEventListener('pointerup', event => {
  if (gesture?.id === event.pointerId) {
    const good = !gesture.cancelled && actionable(event.target) === gesture.target && Math.abs(event.clientX - gesture.x) <= 8 && Math.abs(event.clientY - gesture.y) <= 8 && pointers.size === 1;
    approvedTap = good ? { target: gesture.target, roundId: gesture.roundId } : null;
    gesture = null;
  }
  pointers.delete(event.pointerId);
}, true);
function cancelPointer(event) { if (gesture?.id === event.pointerId) gesture = null; approvedTap = null; pointers.delete(event.pointerId); }
document.addEventListener('pointercancel', cancelPointer, true);
// Touch browsers implicitly release capture AFTER pointerup and BEFORE click.
// Cancel an in-progress gesture on early loss, but keep a completed tap approval.
document.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) cancelPointer(event); }, true);
document.addEventListener('scroll', () => { if (gesture) gesture.cancelled = true; approvedTap = null; }, true);
document.addEventListener('click', event => {
  // Native keyboard/assistive activation has detail=0 and no pointerType.
  if (event.detail === 0 && !event.pointerType) return;
  const target = actionable(event.target), approved = approvedTap;
  approvedTap = null;
  if (target && (!approved || approved.target !== target || approved.roundId !== game.round.id)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
function protect() { pointers.clear(); heldKeys.clear(); releaseRequired.clear(); pause('protection'); }
window.addEventListener('blur', protect);
window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); });
Object.defineProperty(window, '__g026Snapshot', {
  configurable: false, writable: false,
  value: () => structuredClone({ gameId: 'star-moon', phase: game.phase, pauseCause: game.pauseCause, round: game.round, board: game.round.board, stats: { session: game.session, lifetime: record.lifetime }, settings: record.settings, record, timing: null, selection, modal: modalState ? { kind: modalState.kind, preview: modalState.preview } : null, warnings: [...warnings] }),
});
render();
