import { type Direction, type Position } from './engine.js';
import { MergeAudio } from './audio.js';
import { bindInput } from './input.js';
import { applyMove, closeModal, continueGame, createReady, exitGame, nextGoal, openModal, pauseGame, recordLabel, resumeGame, selectGarden, setMuted, showResult, startGame, type Modal } from './state.js';
import { browserStore, GARDENS, STORAGE_KEY, type Garden } from './storage.js';

const get = <T extends HTMLElement>(id: string): T => { const element = document.getElementById(id); if (!element) throw new Error(`Missing element: ${id}`); return element as T; };
const board = get('board');
const dialog = get<HTMLDialogElement>('game-dialog');
const content = get('dialog-content');
const store = browserStore();
let state = createReady(store.load());
const audio = new MergeAudio();
audio.setMuted(state.profile.muted);
const gardenNames: Record<Garden, string> = { seed: '씨앗 뜰', grove: '초록 숲', bloom: '꽃 정원' };
const gardenDescriptions: Record<Garden, string> = { seed: '씨앗 뜰의 새싹 풍경', grove: '초록 숲의 잎과 관목 풍경', bloom: '꽃 정원의 꽃과 가지 풍경' };
const gardenImages: Record<Garden, string> = { seed: '/assets/gardens/seed.svg', grove: '/assets/gardens/grove.svg', bloom: '/assets/gardens/bloom.svg' };
const number = (value: number): string => value.toLocaleString('ko-KR');
let effectTimer: ReturnType<typeof setTimeout> | undefined;
let locked = false;
let lastDialogKey = '';
let returnFocus: HTMLElement | null = null;
let storageMessage = '';
let dialogGeneration = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const cells: HTMLDivElement[] = [];
for (let index = 0; index < 16; index++) {
  const cell = document.createElement('div'); cell.className = 'cell';
  const tile = document.createElement('span'); tile.className = 'tile-number'; cell.append(tile);
  board.append(cell); cells.push(cell);
}
const input = bindInput(board, {
  enabled: () => state.phase === 'playing' && !state.modal && !locked && !document.hidden && !dialog.open,
  move: playMove, pause: () => pause(false),
});
function announce(message: string): void { get('announcement').textContent = message; }
function clearFeedback(): void {
  if (effectTimer !== undefined) clearTimeout(effectTimer);
  effectTimer = undefined; locked = false;
  cells.forEach(cell => { delete cell.dataset.merged; delete cell.dataset.spawned; });
}
function resetInteraction(): void { clearFeedback(); input.reset(); audio.stop(); }
function save(): void { store.save(state.profile); renderWarning(); }
function renderWarning(): void {
  const messages: string[] = [];
  if (store.blocked) messages.push('이 환경에서는 기록이 저장되지 않습니다. 현재 화면에서만 플레이할 수 있습니다.');
  if (store.recovered) messages.push('저장 데이터에 문제가 있어 복구했습니다. 손상된 기록은 보존되지 않을 수 있습니다.');
  if (storageMessage) messages.push(storageMessage);
  const warning = get('storage-warning'); warning.textContent = messages.join(' '); warning.hidden = messages.length === 0;
}
function render(): void {
  const p = state.profile;
  document.body.dataset.garden = p.selectedGarden;
  get('score').textContent = number(state.score);
  get('best-score').textContent = number(p.bestScore);
  get('move-count').textContent = `${number(state.moves)}회 이동`;
  get('phase-label').textContent = { ready: '당신의 첫 씨앗을 기다려요', playing: '같은 숫자끼리, 한 걸음씩', paused: '잠시 쉬어가는 중', won: '2048, 꽃이 피었습니다!', over: '이번 정원은 여기까지' }[state.phase];
  get('play-status').textContent = { ready: '준비 중', playing: '● 플레이 중', paused: 'Ⅱ 일시정지', won: '2048 달성', over: '게임 종료' }[state.phase];
  cells.forEach((cell, i) => {
    const value = state.board[Math.floor(i / 4)][i % 4];
    cell.dataset.value = String(value);
    cell.dataset.art = String(Math.min(value, 2048));
    cell.dataset.digits = String(String(value).length);
    cell.firstElementChild!.textContent = value ? String(value) : '';
    cell.setAttribute('aria-label', `${Math.floor(i / 4) + 1}행 ${i % 4 + 1}열 ${value || '빈칸'}`);
  });
  board.setAttribute('aria-disabled', String(state.phase !== 'playing' || Boolean(state.modal)));
  get('ready-panel').hidden = state.phase !== 'ready';
  get<HTMLButtonElement>('pause-button').disabled = state.phase !== 'playing';
  get<HTMLButtonElement>('restart-button').disabled = state.phase === 'ready';
  get<HTMLButtonElement>('exit-button').disabled = state.phase === 'ready';
  const mute = get('mute-button'); mute.textContent = p.muted ? '소리 꺼짐' : '소리 켜짐'; mute.setAttribute('aria-pressed', String(p.muted));
  const goal = nextGoal(state.highestTile);
  get('next-goal').textContent = goal ? String(goal) : '달성!';
  get('goal-description').textContent = goal ? `이번 판 최고 ${number(state.highestTile)} · ${number(goal)}까지 차근차근.` : '2048 달성 · 계속 도전해 더 큰 숫자를 만나보세요.';
  for (const milestone of get('milestones').children) {
    const el = milestone as HTMLElement; const achieved = state.highestTile >= Number(el.dataset.goal);
    el.dataset.achieved = String(achieved); el.setAttribute('aria-label', `${el.dataset.goal} ${achieved ? '달성' : '미달성'}`);
  }
  get('garden-name').textContent = gardenNames[p.selectedGarden];
  get('garden-number').textContent = `0${GARDENS.indexOf(p.selectedGarden) + 1} / 03`;
  const image = get<HTMLImageElement>('garden-image'); image.src = gardenImages[p.selectedGarden]; image.alt = gardenDescriptions[p.selectedGarden];
  get('unlock-hint').textContent = p.bestTile < 256 ? '256 타일을 만들면 초록 숲이 열립니다.' : p.bestTile < 1024 ? '1024 타일을 만들면 꽃 정원이 열립니다.' : '세 정원이 모두 열렸습니다. 기록·정원에서 골라보세요.';
  renderWarning(); renderDialog();
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
}
function button(text: string, action: () => void, primary = false): HTMLButtonElement {
  const node = element('button', text, primary ? 'primary' : ''); node.type = 'button';
  node.addEventListener('click', event => { event.stopPropagation(); action(); }); return node;
}
function title(kicker: string, text: string): void {
  content.append(element('p', kicker, 'eyebrow')); const h = element('h2', text); h.id = 'dialog-title'; content.append(h);
}
function paragraph(text: string): void { content.append(element('p', text, 'dialog-copy')); }
function actions(...buttons: (HTMLButtonElement | HTMLAnchorElement)[]): void { const wrap = element('div', '', 'dialog-actions'); wrap.append(...buttons); content.append(wrap); }
function homeLink(): HTMLAnchorElement { const link = element('a', '홈으로', 'button primary'); link.href = '/'; link.id = 'result-home'; return link; }
function closeAuxiliary(): void {
  resetInteraction(); state = closeModal(state); lastDialogKey = ''; render();
}
function showModal(modal: Modal): void {
  resetInteraction(); state = openModal(state, modal); render();
}
function begin(activateAudio = true): void {
  resetInteraction();
  try { state = startGame(state, () => Math.random()); save(); render(); board.focus({ preventScroll: true }); if (activateAudio) void audio.activate(); announce('새 정원을 시작했습니다. 방향키 또는 스와이프로 이동하세요.'); }
  catch { announce('새 판을 만들 수 없습니다. 기록은 유지됩니다. 다시 시도해주세요.'); }
}
function pause(manual = false): void { resetInteraction(); state = pauseGame(state, manual ? 'manual' : 'interrupted'); render(); }
function exit(): void { resetInteraction(); state = exitGame(state); save(); render(); }
function resume(): void { resetInteraction(); state = resumeGame(state); render(); board.focus({ preventScroll: true }); void audio.activate(); }
function restart(): void {
  if (state.phase === 'over') begin(); else showModal('restartConfirm');
}
function dialogTabbables(): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'))
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[hidden], [inert]')
      && node.getClientRects().length > 0 && !['hidden', 'collapse'].includes(getComputedStyle(node).visibility))
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}
function renderDialog(): void {
  const kind = state.modal ?? (['paused', 'won', 'over'].includes(state.phase) ? state.phase : '');
  const key = kind === 'gardens' ? `${kind}:${state.profile.selectedGarden}:${state.profile.bestTile}` : kind === 'paused' ? `${kind}:${state.pauseReason}` : kind;
  if (!kind) {
    if (dialog.open) { dialog.close(); const target = state.phase === 'playing' ? board : returnFocus; target?.focus({ preventScroll: true }); }
    lastDialogKey = ''; return;
  }
  if (key === lastDialogKey && dialog.open) return;
  if (!dialog.open) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : board;
  lastDialogKey = key; content.replaceChildren();
  if (kind === 'help') {
    title('HOW TO GROW', '정원을 키우는 방법');
    paragraph('같은 숫자 두 개를 만나게 하면 하나로 합쳐집니다. 2 + 2 = 4, 4 + 4 = 8. 합쳐진 숫자만큼 점수가 올라갑니다. 한 번의 이동에서 각 타일은 한 번만 합쳐집니다.');
    const list = element('ul', '', 'help-list');
    for (const text of ['PC: 보드를 클릭하거나 Tab으로 초점을 맞춘 뒤 방향키를 누르세요. 길게 누르기는 한 번만 이동합니다. Esc는 일시정지입니다.', '모바일: 보드에서 한 손가락으로 24px 이상 밀어주세요. 보드 밖에서는 페이지를 스크롤할 수 있습니다.', '보드가 움직일 때만 빈칸에 새 타일이 생깁니다. 2는 90%, 4는 10%입니다.', '2048을 만들면 성공! 계속 도전할 수 있습니다. 빈칸도 합칠 숫자도 없으면 한 판이 끝납니다.', '256은 초록 숲, 1024는 꽃 정원을 엽니다. 정원은 게임 규칙에 영향을 주지 않습니다.', '기록·정원·소리 설정은 자동 저장합니다. 진행 중인 판은 저장하지 않으며 새로 열면 새 판을 시작합니다.', '탭을 벗어나면 자동 정지합니다. 돌아온 뒤에는 직접 재개해 주세요.']) list.append(element('li', text));
    content.append(list); actions(button('도움말 닫기', closeAuxiliary, true));
  } else if (kind === 'gardens') {
    title('COLLECTION & RECORDS', '나의 기록과 정원');
    const p = state.profile; const records = element('dl', '', 'records');
    for (const [label, value] of [['최고 점수', p.bestScore], ['역대 최고 타일', p.bestTile], ['시작한 판', p.gamesStarted], ['막힘 종료', p.gamesFinished], ['2048 달성', p.gamesWon], ['누적 이동', p.totalMoves], ['누적 획득점수', p.totalScore]] as const) records.append(element('dt', label), element('dd', number(value)));
    content.append(records);
    const cards = element('div', '', 'garden-choices');
    for (const garden of GARDENS) {
      const unlocked = p.unlockedGardens.includes(garden); const selected = garden === p.selectedGarden;
      const card = element('section', '', 'garden-choice'); card.dataset.selected = String(selected);
      const image = element('img'); image.src = gardenImages[garden]; image.alt = gardenDescriptions[garden]; image.width = 300; image.height = 200;
      card.append(image, element('h3', gardenNames[garden]), element('p', garden === 'seed' ? '기본 제공' : `최고 타일 ${garden === 'grove' ? '256' : '1024'} 이상 · 현재 ${number(p.bestTile)}`));
      const apply = button(selected ? '✓ 선택됨' : unlocked ? '이 정원 선택' : '잠김 · 미리보기', () => { state = selectGarden(state, garden); save(); render(); });
      apply.disabled = !unlocked || selected; card.append(apply); cards.append(card);
    }
    content.append(cards); paragraph('정원을 바꿔도 숫자와 규칙은 그대로입니다. 해금되어도 자동으로 선택되지 않습니다.'); actions(button('기록·정원 닫기', closeAuxiliary, true));
  } else if (kind === 'restartConfirm') {
    title('A FRESH START', '새로 시작할까요?');
    paragraph('현재 판을 끝내고 새로 시작할까요? 최고기록과 해금은 유지됩니다. 진행 중인 판은 돌아올 수 없습니다.');
    actions(button('취소 · 돌아가기', closeAuxiliary), button('새 판 시작', () => begin(), true));
  } else if (kind === 'paused') {
    title('TAKE A BREATH', '잠시 쉬어가요'); paragraph('정원이 기다리고 있습니다. 보드와 점수는 그대로예요. 준비되면 직접 재개해 주세요.');
    const resumeButton = button(state.pauseReason === 'manual' ? '이어서하기' : '게임 재개', resume, true); resumeButton.id = 'resume-button';
    actions(resumeButton, button('다시시작', restart), button('게임종료', exit));
  } else {
    const won = kind === 'won';
    title(won ? 'A GARDEN IN BLOOM' : 'UNTIL THE NEXT SEED', won ? '2048, 꽃이 피었습니다!' : '이번 정원은 여기까지');
    paragraph(won ? state.finished ? '목표 달성 · 더 이상 이동할 수 없습니다. 멋진 마지막 꽃을 피웠어요.' : '작은 씨앗들이 모여 커다란 꽃이 되었어요. 더 큰 숫자를 향해 계속 도전할 수 있습니다.' : state.endReason === 'exit' ? '게임을 종료했어요. 잠깐의 여유가 되었길 바라요.' : '빈칸도, 이웃한 같은 숫자도 없어 더 이상 이동할 수 없습니다. 새로운 씨앗으로 다시 만나요.');
    const summary = element('div', '', 'result-summary'); summary.id = 'result-summary'; summary.append(element('strong', number(state.score)), element('span', `점 · 최고 타일 ${number(state.highestTile)}`)); content.append(summary); paragraph(recordLabel(state));
    if (!won) { paragraph(`최고 기록 ${number(state.profile.bestScore)}점 · 종료 사유: ${state.endReason === 'exit' ? '사용자 종료' : '이동 불가'}`); }
    if (won) {
      const keep = button('계속 도전하기', () => { resetInteraction(); state = continueGame(state); render(); board.focus({ preventScroll: true }); }, true); keep.disabled = state.finished;
      if (state.finished) actions(keep, button('결과 보기', () => { resetInteraction(); state = showResult(state); render(); }, true), button('다시시작', () => begin()));
      else actions(keep, button('다시시작', () => begin()), button('게임종료', exit));
    } else actions(homeLink(), button('다시시작', () => begin()));
  }
  if (!dialog.open) dialog.showModal();
  const generation = ++dialogGeneration;
  queueMicrotask(() => { if (generation === dialogGeneration && dialog.open) (content.querySelector('a[href], button:not(:disabled)') as HTMLElement | null)?.focus({ preventScroll: true }); });
}
function playMove(direction: Direction): void {
  if (locked || document.hidden || state.phase !== 'playing' || state.modal || dialog.open) return;
  try {
    const oldUnlocks = state.profile.unlockedGardens.length;
    const turn = applyMove(state, direction, () => Math.random());
    if (!turn.changed) return;
    state = turn.state; save(); render();
    if (turn.merges) audio.merge(state.highestTile);
    if (state.profile.unlockedGardens.length > oldUnlocks) announce(`${gardenNames[state.profile.unlockedGardens.at(-1)!]} 해금! 기록·정원에서 선택할 수 있습니다.`);
    else announce(`${number(state.score)}점. 최고 타일 ${number(state.highestTile)}. ${turn.scoreDelta ? `${turn.scoreDelta}점 획득.` : ''}`);
    if (!reducedMotion.matches && state.phase === 'playing') {
      locked = true;
      for (const position of turn.mergedPositions) mark(position, 'merged');
      if (turn.spawned) mark(turn.spawned, 'spawned');
      effectTimer = setTimeout(clearFeedback, 120);
    }
    if (state.phase !== 'playing') input.reset();
  } catch { announce('안전한 숫자 범위를 벗어났습니다. 현재 판은 유지됩니다. 새 판을 시작해 주세요.'); }
}
function mark(position: Position, type: 'merged' | 'spawned'): void { cells[position.row * 4 + position.col].dataset[type] = 'true'; }
get('start-button').addEventListener('click', () => begin());
get('pause-button').addEventListener('click', () => pause(true));
get('restart-button').addEventListener('click', restart);
get('exit-button').addEventListener('click', exit);
document.querySelectorAll<HTMLAnchorElement>('.exit-home').forEach(link => link.addEventListener('click', event => { event.preventDefault(); exit(); }));
get('help-button').addEventListener('click', () => showModal('help'));
get('gardens-button').addEventListener('click', () => showModal('gardens'));
get('mute-button').addEventListener('click', () => {
  state = setMuted(state, !state.profile.muted); audio.setMuted(state.profile.muted); save(); render();
  if (!state.profile.muted) void audio.activate().then(() => { if (!audio.available) announce('이 브라우저에서는 소리를 사용할 수 없습니다. 게임은 계속할 수 있습니다.'); });
});
dialog.addEventListener('keydown', event => {
  if (!dialog.open || event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
  // Recompute after every render/attribute change; never retain detached or disabled buttons.
  const tabbables = dialogTabbables();
  const first = tabbables[0]; const last = tabbables.at(-1);
  if (!first || !last) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
  const active = document.activeElement;
  if (!tabbables.includes(active as HTMLElement) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
  }
});
dialog.addEventListener('cancel', event => { event.preventDefault(); if (state.modal) closeAuxiliary(); });
function interrupt(): void { resetInteraction(); state = pauseGame(state, 'interrupted'); render(); }
window.addEventListener('blur', interrupt);
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
window.addEventListener('pagehide', interrupt);
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { storageMessage = '다른 탭에서 기록이 바뀌었습니다. 여러 탭의 동시 기록은 합쳐지지 않습니다.'; renderWarning(); } });
begin(false);
