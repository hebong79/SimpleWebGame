// Original shared UI for the twenty Vol. 4 games. No external runtime assets.
export function el(tag, className = '', text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
export function button(text, fn, className = '') {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', fn);
  return node;
}
export function grid(parent, columns) {
  parent.classList.add('grid');
  parent.style.setProperty('--columns', String(columns));
  return parent;
}
export function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function write(node, value) { const text = String(value); if (node.textContent !== text) node.textContent = text; }
export function mount(config) {
  const storageKey = `simplegames.vol4.${config.id}.v1`;
  const themeThresholds=config.themeThresholds || [0,2,5];
  const themeProgress=()=>{let n;try{n=config.themeProgress?config.themeProgress(record):record.wins;}catch{n=0;}return Number.isFinite(n)&&n>=0?n:0;};
  let storageFailed = false;
  const record = { version: 1, wins: 0, best: 0, theme: 0, muted: true };
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (raw && raw.version === 1 && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw)) {
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) record[key] = value;
      }
      for (const key of ['wins', 'best']) if (!Number.isFinite(record[key]) || record[key] < 0) record[key] = 0;
      record.wins = Math.floor(Math.min(record.wins, 1e9));
      if (![0, 1, 2].includes(record.theme) || (record.theme === 1 && themeProgress() < themeThresholds[1]) || (record.theme === 2 && themeProgress() < themeThresholds[2])) record.theme = 0;
    }
  } catch { storageFailed = true; }
  if (typeof record.muted !== 'boolean') record.muted = true;
  document.title = `${config.title} · 작은 쉼표`;
  document.documentElement.lang = 'ko';
  document.body.dataset.theme = config.theme || 'ink';
  const layout = el('main', 'game-shell');
  const top = el('header', 'topbar');
  const home = el('a', 'home-link', '← 게임 목록'); home.href = '/';
  top.append(home, el('span', 'edition', '작은 쉼표  /  VOL. 04'));
  const heading = el('section', 'heading');
  const titleBlock = el('div');
  const ordinal = location.pathname.match(/\/(\d{2})-/)?.[1] ?? config.id.split('-')[0];
  titleBlock.append(el('p', 'eyebrow', `PLAY / ${ordinal}`), el('h1', '', config.title), el('p', 'subtitle', config.subtitle));
  const best = el('div', 'best-card'); best.append(el('span', '', '나의 최고 기록'), el('strong', '', record.best));
  heading.append(titleBlock, best);
  const scene = el('section', 'scene');
  const playPanel = el('div', 'play-panel');
  const meter = el('div', 'meter');
  const meta = el('span', '', '준비되면 시작하세요'); meta.id = 'meta';
  const score = el('strong', '', '0'); score.id = 'score';
  meter.append(meta, score);
  const boardWrap = el('div', 'board-wrap');
  const board = el('div', 'board'); board.id = 'board'; board.tabIndex = 0;
  board.setAttribute('role', 'group'); board.setAttribute('aria-label', `${config.title} 게임 영역`);
  const cover = el('div', 'board-cover');
  const coverText = el('strong', '', '작은 도전을 시작해 볼까요?');
  const coverStart = button('게임 시작', () => start()); cover.append(coverText, coverStart);
  boardWrap.append(board, cover);
  const tools = el('div', 'tools'); tools.id = 'tools';
  const status = el('p', 'status', '게임 시작을 누르면 새 판이 열립니다.'); status.id = 'status'; status.setAttribute('role', 'status');
  const actions = el('div', 'actions');
  const startButton = button('게임 시작', () => start(), 'primary'); startButton.id = 'start';
  const pauseButton = button('일시정지', () => state === 'paused' ? resume() : pause('잠시 쉬어가요.')); pauseButton.id = 'pause';
  const restartButton = button('다시 시작', () => requestRestart()); restartButton.id = 'restart';
  const undoButton = button('실행 취소', () => { if (active()) { game.undo?.(); board.focus({ preventScroll: true }); } }); undoButton.id = 'undo';
  actions.append(startButton, pauseButton, restartButton, undoButton);
  playPanel.append(meter, boardWrap, tools, status, actions);
  const aside = el('aside', 'side-panel');
  aside.append(el('p', 'eyebrow', 'HOW TO PLAY'), el('h2', '', '오늘의 작은 도전'), el('p', 'instructions', config.help));
  const helpButton = button('조작 안내', () => showHelp()); helpButton.id = 'help';
  const wardrobeButton = button('테마 · 기록', () => showWardrobe()); wardrobeButton.id = 'wardrobe';
  const muteButton = button(record.muted ? '소리 꺼짐' : '소리 켜짐', () => { record.muted = !record.muted; write(muteButton, record.muted ? '소리 꺼짐' : '소리 켜짐'); muteButton.setAttribute('aria-pressed', String(!record.muted)); persist(); if (!record.muted) tone(); });
  muteButton.id = 'mute'; muteButton.setAttribute('aria-pressed', String(!record.muted));
  const auxiliary = el('div', 'auxiliary'); auxiliary.append(helpButton, wardrobeButton, muteButton);
  const progress = el('p', 'progress');
  const note = el('p', 'fine-print', '진행 중인 판은 저장하지 않아요. 기록과 외형은 이 브라우저에 남습니다.');
  aside.append(auxiliary, progress, note);
  scene.append(playPanel, aside);
  const warning = el('p', 'storage-warning'); warning.id = 'storage-warning'; warning.hidden = !storageFailed;
  warning.textContent = '저장 정보를 읽을 수 없어 기본 기록을 사용합니다. 플레이는 계속할 수 있습니다.';
  const footer = el('footer', 'footer', '한 번에 한 판, 천천히 즐기는 작은 쉼표.');
  layout.append(top, heading, scene, warning, footer);
  const dialog = el('dialog', 'modal'); dialog.id = 'modal'; dialog.setAttribute('aria-label', '게임 안내');
  document.body.replaceChildren(layout, dialog);
  let state = 'ready', currentScore = 0, elapsed = 0, game, modalReturn = null, time = 0, audio;
  function tone() {
    if (record.muted || document.hidden) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ??= new Audio();
      if (audio.state === 'suspended') { audio.resume().catch(() => {}); return; }
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.frequency.value = 560; gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.07);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.08);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio support is optional; the visual feedback remains. */ }
  }
  const active = () => state === 'playing' && !dialog.open && !document.hidden;
  function refreshRecord() {
    write(best.querySelector('strong'), record.best);
    write(progress, `완료 ${record.wins}회 · 외형 진행 ${themeProgress()} · 해금 ${themeThresholds[1]} / ${themeThresholds[2]}`);
    document.body.dataset.variant = String(record.theme);
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(record)); storageFailed = false; warning.hidden = true; }
    catch { storageFailed = true; warning.hidden = false; write(warning, '기록을 저장할 수 없습니다. 이번 화면에서 플레이와 기록을 계속 유지합니다.'); }
    refreshRecord();
  }
  const ctx = {
    board, tools, record, persist, active,
    newRound: callback => { if (["ready","won","lost"].includes(state)) { callback(); state="ready"; start(); } else openDialog("문제를 바꿀까요?", node => { node.append(el("p","","현재 판의 진행은 사라지고 완료 기록은 유지됩니다."), button("새 문제 시작", () => { closeDialog(); callback(); state="ready"; start(); }, "primary")); }); },
    status: value => write(status, value),
    score: value => { if (Number.isFinite(value)) { if (value > currentScore && active()) tone(); currentScore = value; write(score, value); } },
    meta: value => write(meta, value),
    win: (text, value = currentScore) => finish(true, text, value),
    lose: (text, value = currentScore) => finish(false, text, value),
  };
  function sync() {
    const running = state === 'playing';
    pauseButton.disabled = !['playing', 'paused'].includes(state);
    write(pauseButton, state === 'paused' ? '게임 재개' : '일시정지');
    startButton.hidden = ['playing', 'paused'].includes(state);
    write(startButton, state === 'ready' ? '게임 시작' : '다시 도전');
    undoButton.hidden = !game?.undo;
    undoButton.disabled = !running;
    board.setAttribute('aria-disabled', String(!running));
    cover.hidden = running;
    coverStart.hidden = false;
    write(coverStart, state === 'paused' ? '게임 재개' : state === 'ready' ? '게임 시작' : '다시 도전');
    if (state === 'ready') write(coverText, '작은 도전을 시작해 볼까요?');
    if (state === 'paused') write(coverText, '잠시 멈췄어요');
    if (state === 'won') write(coverText, '멋지게 완성했어요!');
    if (state === 'lost') write(coverText, '한 번 더 도전해 볼까요?');
  }
  function start() {
    if (dialog.open) return;
    if (state === 'paused') return resume();
    if (state === 'playing') return;
    elapsed = 0; time = 0; state = 'playing'; currentScore = 0; write(score, 0);
    game.reset(); sync(); board.focus({ preventScroll: true });
  }
  function resume() { if (state !== 'paused' || dialog.open || document.hidden) return; state = 'playing'; time = 0; sync(); write(status, '이어서 도전하세요.'); board.focus({ preventScroll: true }); }
  function pause(text) { if (state !== 'playing') return; state = 'paused'; game.pause?.(); time = 0; sync(); write(status, text); }
  function finish(success, text, value) {
    if (state !== 'playing') return;
    state = success ? 'won' : 'lost';
    game.pause?.();
    if (success) record.wins++;
    if (Number.isFinite(value)) record.best = Math.max(record.best, value);
    persist(); sync(); write(status, text);
  }
  function openDialog(title, fill) {
    modalReturn = document.activeElement;
    if (state === 'playing') pause('안내를 닫은 뒤 게임 재개를 눌러 주세요.');
    dialog.replaceChildren(el('h2', '', title)); fill(dialog);
    dialog.append(button('닫기', () => closeDialog(), 'modal-close'));
    dialog.showModal(); dialog.querySelector('button')?.focus();
  }
  function closeDialog() { dialog.close(); if (modalReturn?.isConnected) modalReturn.focus({ preventScroll: true }); }
  function showHelp() { openDialog('조작 안내', node => node.append(el('p', 'instructions', config.help), el('p', 'fine-print', '게임 영역에 초점을 두고 키보드를 사용하세요. Esc 또는 탭 이탈은 일시정지합니다.'))); }
  function showWardrobe() {
    openDialog('테마 · 기록', node => {
      node.append(el('p', '', `완료 ${record.wins}회 · 최고 기록 ${record.best}`));
      (config.themeNames || ['기본', '푸른 종이 · 2회 완료', '별빛 테두리 · 5회 완료']).forEach((name, index) => {
        const required = themeThresholds[index];
        const choice = button(`${record.theme === index ? '✓ 선택 중 · ' : ''}${name}${themeProgress() < required ? ' · 잠김' : ''}`, () => { record.theme = index; persist(); closeDialog(); });
        choice.disabled = themeProgress() < required; node.append(choice);
      });
    });
  }
  function requestRestart() {
    if (state === 'ready' || state === 'won' || state === 'lost') { state = 'ready'; start(); return; }
    openDialog('새 판을 시작할까요?', node => {
      node.append(el('p', '', '현재 판의 진행은 사라지고 기록과 외형은 유지됩니다.'));
      const confirm = button('새 판 시작', () => { closeDialog(); state = 'ready'; start(); }, 'primary'); confirm.id = 'confirm-restart';
      node.append(confirm);
    });
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const stops = [...dialog.querySelectorAll('button:not(:disabled),a[href],input,textarea,[tabindex="0"]')];
    const first = stops[0], last = stops.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('keydown', event => {
    if (event.repeat && (event.target instanceof HTMLButtonElement) && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
    if (dialog.open) return;
    const inBoard = board === document.activeElement || board.contains(document.activeElement);
    if (event.key === 'Escape' && (inBoard || layout.contains(event.target))) { event.preventDefault(); if (state === 'playing') pause('게임을 멈췄어요. 게임 재개를 눌러 주세요.'); return; }
    if (!active() || !inBoard || event.repeat) return;
    game.key?.(event);
  });
  board.addEventListener('pointerdown', event => { if (event.target === board || ['CANVAS', 'svg', 'path', 'line', 'circle'].includes(event.target.tagName)) board.focus({ preventScroll: true }); });
  window.addEventListener('blur', () => pause('창을 벗어나 자동으로 멈췄어요.'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('탭을 벗어나 자동으로 멈췄어요.'); });
  game = config.create(ctx);
  game.reset(); sync(); refreshRecord();
  Object.defineProperty(window, '__vol4', { configurable: true, value: { get state() { return state; }, get elapsed() { return elapsed; }, get score() { return currentScore; }, snapshot: () => game.snapshot?.() ?? null } });
  function frame(timestamp) {
    const dt = time ? Math.max(0, Math.min((timestamp - time) / 1000, 0.05)) : 0;
    time = timestamp;
    if (active()) { elapsed += dt; game.tick?.(dt); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return ctx;
}
