import { createGame, startGame, pauseGame, resumeGame, advanceGame, inputPad, activePad } from './engine.mjs';
import { loadRecord, saveRecord, settleRecord, PLAY_CAP } from './save.mjs';
import { createSound } from './audio.mjs';

const $ = id => document.getElementById(id);
const pads = [...document.querySelectorAll('[data-pad]')], dialog = $('modal');
const loaded = loadRecord(), warnings = new Set(loaded.warnings), sound = createSound();
let record = loaded.record, game = createGame(), modal = null, lastTime = performance.now();
let settledToken = -1, resultBest = false, gesture = null;
const pointers = new Set(), held = new Set(), releaseRequired = new Set();
const padNames = ['햇빛 원', '바다 삼각', '노을 마름모', '밤하늘 별'];
function text(node, value) { if (node.textContent !== value) node.textContent = value; }
function attribute(node, name, value) { if (node.getAttribute(name) !== value) node.setAttribute(name, value); }
function clearInputs() {
  gesture = null;
  for (const key of held) releaseRequired.add(key);
  held.clear(); sound.stop();
}
function persist() { const saved = saveRecord(record); if (!saved.ok) warnings.add(saved.warning); }
function update(next) {
  const before = game;
  if (before === next) return;
  game = next;
  if (before.phase !== game.phase || before.token !== game.token || before.subphase !== game.subphase) clearInputs();
  if (game.phase === 'result' && settledToken !== game.token) {
    settledToken = game.token; resultBest = record.records.plays < PLAY_CAP && game.completedLength > record.records.bestLength;
    record = settleRecord(record, game.completedLength); persist();
    sound.play(game.result.reason === 'complete' ? 'success' : 'wrong', record.settings.muted);
  } else if (game.phase === 'playing' && game.subphase === 'demo-on'
    && (before.subphase !== 'demo-on' || before.cursor !== game.cursor || before.token !== game.token)) sound.play(game.sequence[game.cursor], record.settings.muted);
  else if (game.phase === 'playing' && game.subphase === 'success' && before.subphase !== 'success') sound.play('success', record.settings.muted);
  render();
  if (before.phase !== 'result' && game.phase === 'result') $('retry').focus();
}
// Every event settles real elapsed time before it can act. A stalled frame protects the player.
function sync(now = performance.now()) {
  const delta = Math.max(0, now - lastTime); lastTime = now;
  if (game.phase !== 'playing' || modal) return;
  if (delta > 250) { update(pauseGame(game, 'protection')); return; }
  update(advanceGame(game, delta));
}
function render() {
  document.body.dataset.theme = modal?.kind === 'theme' ? modal.preview : record.settings.theme;
  text($('current-length'), String(game.sequence.length)); text($('completed-length'), String(game.completedLength));
  text($('best-length'), String(record.records.bestLength));
  text($('record-detail'), `완료 ${record.records.plays}판 · 누적 완성 ${record.records.totalCompleted}개`);
  text($('mute'), record.settings.muted ? '소리 꺼짐' : '소리 켜짐');
  attribute($('mute'), 'aria-pressed', String(record.settings.muted));
  $('start').hidden = game.phase !== 'ready'; $('pause').hidden = game.phase !== 'playing';
  $('resume').hidden = game.phase !== 'paused'; $('restart').hidden = game.phase === 'ready' || game.phase === 'result';
  $('retry').hidden = game.phase !== 'result'; $('result').hidden = game.phase !== 'result';
  text($('resume'), game.pauseCause === 'manual' ? '이어서하기' : '게임 재개');
  let status = '시작을 눌러 별의 노래를 들어 보세요', detail = '보기 → 잠깐 준비 → 따라 하기';
  if (game.phase === 'paused') {
    status = '잠시 정지했어요';
    detail = game.pauseCause === 'protection' ? '화면 이탈이나 긴 대기로 보호 정지했어요. 게임 재개를 눌러 주세요.' : '남은 시간과 순서를 그대로 기억하고 있어요. 직접 재개해 주세요.';
  } else if (game.phase === 'playing') {
    switch (game.subphase) {
      case 'prepare': status = '첫 별을 보여드릴게요'; detail = '잠깐 준비 · 시범 중에는 입력을 받지 않아요.'; break;
      case 'demo-on': status = `보기 · ${game.cursor + 1} / ${game.sequence.length}`; detail = `${game.sequence[game.cursor] + 1}번 ${padNames[game.sequence[game.cursor]]} · 순서를 기억하세요.`; break;
      case 'demo-gap': status = `보기 · ${game.cursor + 1} / ${game.sequence.length}`; detail = '다음 별을 기다려 주세요.'; break;
      case 'demo-tail': status = '잠깐 준비'; detail = '시범이 끝났어요. 곧 따라 하기 시작!'; break;
      case 'input': status = `따라 하기 · ${game.cursor + 1} / ${game.sequence.length}`; detail = '같은 순서로 눌러 주세요. 입력마다 5초예요.'; break;
      case 'success': status = `${game.completedLength}개 기억 성공!`; detail = '별 하나를 더해 다음 노래를 보여드릴게요.'; break;
    }
  } else if (game.phase === 'result') {
    status = game.result.reason === 'complete' ? '1000개 기억 완성' : game.result.reason === 'timeout' ? '입력 시간이 끝났어요' : '다른 별을 눌렀어요';
    detail = `완성 길이 ${game.completedLength} · 다시 한 곡 도전해 보세요.`;
    text($('result-detail'), `점수 ${game.completedLength} · 도전 길이 ${game.result.failedLength} · 입력 위치 ${Math.min(game.result.position, game.result.failedLength)} / ${game.result.failedLength} · ${game.result.reason === 'complete' ? '기억 완성' : game.result.reason === 'timeout' ? '5초 시간 초과' : '순서 틀림'}${resultBest ? ' · 최고 기록 갱신!' : game.completedLength === record.records.bestLength && game.completedLength > 0 ? ' · 최고 기록과 동점' : ''}`);
  }
  text($('state-message'), status); text($('detail'), detail);
  const lit = modal ? null : activePad(game), enabled = game.phase === 'playing' && game.subphase === 'input' && !modal;
  pads.forEach((pad, i) => { pad.classList.toggle('lit', lit === i); attribute(pad, 'aria-disabled', String(!enabled)); });
  const input = game.subphase === 'input' && (game.phase === 'playing' || game.phase === 'paused');
  text($('timer-text'), input ? `${game.phase === 'paused' ? '정지 · ' : ''}남은 시간 ${Math.ceil(game.remaining / 1000)}초` : '따라 하기에서 입력마다 5초');
  const meter = input ? Math.ceil(game.remaining / 100) * 100 : 5000;
  if ($('input-timer').value !== meter) $('input-timer').value = meter;
  const messages = [...warnings];
  if (record.records.plays >= PLAY_CAP) messages.push('완료 기록 1,000,000판 한도입니다. 계속 플레이할 수 있으며 누적 기록은 유지됩니다.');
  $('storage-warning').hidden = messages.length === 0; text($('storage-warning'), messages.join(' '));
}
function focusPads() {
  pads[0].focus({ preventScroll: true });
  const group = $('pads'), bounds = group.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
    group.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }
}
function begin() {
  if (modal) return;
  clearInputs(); lastTime = performance.now(); update(startGame(game)); focusPads();
}
function pause(cause) { sync(); clearInputs(); update(pauseGame(game, cause)); lastTime = performance.now(); render(); }
function enterPad(index) {
  sync();
  if (modal || document.hidden) return;
  const before = game, next = inputPad(game, index);
  if (next === before) return;
  if (next.phase === 'playing' && next.subphase === 'input') sound.play(index, record.settings.muted);
  update(next);
}
function paragraph(value) { const p = document.createElement('p'); p.textContent = value; return p; }
function openModal(kind, trigger) {
  if (modal) return;
  pause('dialog'); modal = { kind, trigger, preview: record.settings.theme };
  const content = $('modal-content'); content.replaceChildren();
  $('modal-apply').hidden = kind === 'help'; text($('modal-close'), kind === 'help' ? '닫기' : '취소');
  if (kind === 'help') {
    text($('modal-title'), '네 별의 노래 하는 법');
    content.append(paragraph('빛나는 별의 순서를 보고 같은 순서로 누르세요. 숫자 1·2·3·4는 패드에 초점이 있을 때만 동작합니다. 각 패드는 Enter / Space, 클릭과 터치로도 누를 수 있어요.'), paragraph('처음에는 별 하나, 성공하면 기존 순서 뒤에 별 하나가 더해져요. 같은 별이 연속으로 나올 수 있어요. 보기와 준비 중 입력은 무시해요. 따라 하기에서는 정답을 누를 때마다 5초를 새로 드려요.'), paragraph('한 번 틀리거나 시간이 끝나면 종료합니다. 기록은 완전히 맞힌 길이만 인정해요. 일시정지·도움말·테마·화면 이탈 때는 시간과 순서를 멈추며 직접 재개해야 합니다.'), paragraph('기록과 적용한 설정만 이 기기에 저장합니다. 미완료 판은 저장하지 않아요. 두 테마는 외형만 다르며 규칙과 음은 같아요. 소리는 기본 꺼짐입니다.'));
  } else if (kind === 'theme') {
    text($('modal-title'), '패드 테마'); text($('modal-apply'), '적용');
    content.append(paragraph('미리보기는 외형만 바꿔요. 적용해야 설정이 저장됩니다.'));
    const options = document.createElement('div'); options.className = 'theme-options'; options.setAttribute('role', 'radiogroup'); options.setAttribute('aria-label', '테마');
    for (const [id, name] of [['night', '밤하늘'], ['dawn', '새벽']]) {
      const button = document.createElement('button'); button.id = `theme-${id}`; button.type = 'button'; button.setAttribute('role', 'radio');
      text(button, name); attribute(button, 'aria-checked', String(id === modal.preview));
      button.addEventListener('click', () => { if (!modal || modal.kind !== 'theme') return; modal.preview = id; options.querySelectorAll('button').forEach(b => attribute(b, 'aria-checked', String(b === button))); render(); }); options.append(button);
    }
    content.append(options);
  } else {
    text($('modal-title'), kind === 'home' ? '게임 목록으로 돌아갈까요?' : '새 노래를 시작할까요?');
    text($('modal-apply'), kind === 'home' ? '나가기' : '다시 시작');
    content.append(paragraph('현재 순서는 포기하며 완료 기록에 포함하지 않습니다. 최고 기록과 적용한 설정은 유지해요. 취소하면 정지 상태로 돌아갑니다.'));
  }
  render(); dialog.showModal(); $('modal-close').focus();
}
function closeModal(apply = false) {
  if (!modal) return;
  const previous = modal;
  if (apply && previous.kind === 'theme' && record.settings.theme !== previous.preview) { record = { ...record, settings: { ...record.settings, theme: previous.preview } }; persist(); }
  modal = null; dialog.close(); clearInputs(); lastTime = performance.now(); render();
  if (previous.trigger?.isConnected && !previous.trigger.hidden) previous.trigger.focus();
  else if (game.phase === 'paused') $('resume').focus();
  if (apply && previous.kind === 'restart') begin();
  if (apply && previous.kind === 'home') location.assign('/');
}
$('start').addEventListener('click', begin); $('retry').addEventListener('click', begin);
$('pause').addEventListener('click', () => { if (!modal) { pause('manual'); if (game.phase === 'paused') $('resume').focus(); } });
$('resume').addEventListener('click', () => { if (!modal && game.phase === 'paused' && !document.hidden) { clearInputs(); lastTime = performance.now(); update(resumeGame(game)); focusPads(); } });
$('help').addEventListener('click', e => openModal('help', e.currentTarget));
$('theme').addEventListener('click', e => openModal('theme', e.currentTarget));
$('restart').addEventListener('click', e => openModal('restart', e.currentTarget));
$('home').addEventListener('click', e => { if (game.phase === 'playing' || game.phase === 'paused') { e.preventDefault(); openModal('home', e.currentTarget); } });
$('mute').addEventListener('click', () => { if (!modal) { record = { ...record, settings: { ...record.settings, muted: !record.settings.muted } }; sound.stop(); persist(); render(); } });
$('modal-close').addEventListener('click', () => closeModal()); $('modal-apply').addEventListener('click', () => closeModal(true));
dialog.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
dialog.addEventListener('close', () => { if (modal && !dialog.open) closeModal(); });

// Use one explicit native-button activation per released key. Space never leaks on keyup.
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (modal && e.key === 'Tab') {
    const buttons = [...dialog.querySelectorAll('button,a[href]')].filter(b => !b.disabled && b.getClientRects().length);
    if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0]?.focus(); }
    return;
  }
  const target = e.target instanceof Element ? e.target.closest('button,a[href]') : null;
  if (e.key === 'Escape') {
    if (modal) { e.preventDefault(); if (!e.repeat) closeModal(); }
    else if (target && game.phase === 'playing') { e.preventDefault(); if (!e.repeat) { pause('manual'); $('resume').focus(); } }
    return;
  }
  const number = /^[1-4]$/.test(e.key) && target?.matches('[data-pad]') && !modal;
  const activation = target && (e.key === 'Enter' || e.key === ' ');
  if (!number && !activation) return;
  e.preventDefault();
  const key = e.code || e.key;
  if (e.repeat || held.has(key) || releaseRequired.has(key)) { e.stopImmediatePropagation(); return; }
  held.add(key);
  if (number) enterPad(Number(e.key) - 1);
  else target.click();
}, true);
document.addEventListener('keyup', e => { const key = e.code || e.key; held.delete(key); releaseRequired.delete(key); if (e.key === ' ') e.preventDefault(); }, true);
// Document-wide contact tracking includes a second finger that starts outside the pads.
document.addEventListener('pointerdown', e => {
  pointers.add(e.pointerId);
  if (pointers.size !== 1) { gesture = null; return; }
  const pad = e.target instanceof Element ? e.target.closest('[data-pad]') : null;
  if (!pad || e.button !== 0 || modal || document.hidden) return;
  sync();
  if (game.phase !== 'playing' || game.subphase !== 'input') return;
  gesture = { id: e.pointerId, pad, x: e.clientX, y: e.clientY, token: game.token };
  try { pad.setPointerCapture(e.pointerId); } catch {}
}, true);
document.addEventListener('pointermove', e => { if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture = null; }, true);
document.addEventListener('pointerup', e => {
  const tap = gesture; gesture = null; pointers.delete(e.pointerId);
  if (!tap || tap.id !== e.pointerId || pointers.size || tap.token !== game.token || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) return;
  const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pad]');
  if (hit === tap.pad) enterPad(Number(tap.pad.dataset.pad));
}, true);
document.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; }, true);
document.addEventListener('lostpointercapture', () => { gesture = null; }, true);
pads.forEach(pad => pad.addEventListener('click', e => { if (e.detail === 0 && !e.pointerType) enterPad(Number(pad.dataset.pad)); }));
function protect() { pause('protection'); pointers.clear(); }
window.addEventListener('blur', protect); window.addEventListener('pagehide', protect);
document.addEventListener('visibilitychange', () => { if (document.hidden) protect(); lastTime = performance.now(); });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
Object.defineProperty(window, '__g028Snapshot', { value: () => freeze(structuredClone({ ...game, records: record.records, settings: record.settings, modal: modal?.kind ?? null, activePad: modal ? null : activePad(game) })), writable: false, configurable: false });
// RAF's supplied timestamp can be stale after a long task; use actual arrival time.
function frame() { sync(); requestAnimationFrame(frame); }
render(); requestAnimationFrame(frame);
