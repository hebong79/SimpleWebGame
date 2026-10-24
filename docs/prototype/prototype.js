/* Clickable screen prototype. No storage, gameplay engine, or external requests.
   Upcoming titles are fictional concepts. Garden/tile SVG assets were authored for this project. */
'use strict';
if (document.body.dataset.page === 'game') {
  let board = [2, 4, 8, 0, 16, 32, 4, 0, 8, 64, 128, 2, 4, 16, 256, 8];
  let score = 2480;
  let restartFrom = 'playing';
  const boardEl = document.getElementById('board');
  const pauseDialog = document.getElementById('pause-dialog');
  const restartDialog = document.getElementById('restart-dialog');
  const resultDialog = document.getElementById('result-dialog');
  [pauseDialog, restartDialog, resultDialog].forEach((dialog) => {
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('a[href], button:not([disabled])')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
  });
  const status = document.querySelector('.play-status');
  const format = (value) => value.toLocaleString('ko-KR');
  const highest = () => Math.max(...board);
  function render() {
    boardEl.replaceChildren();
    board.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'tile'; cell.dataset.value = String(value);
      cell.setAttribute('aria-label', `${Math.floor(index / 4) + 1}행 ${index % 4 + 1}열 ${value || '빈칸'}`);
      if (value) {
        cell.style.backgroundImage = `url('../../public/assets/tiles/tile-${value}.svg')`;
        const number = document.createElement('span'); number.className = 'tile-number'; number.textContent = String(value); cell.append(number);
      }
      boardEl.append(cell);
    });
    document.getElementById('score').textContent = format(score);
    document.getElementById('current-tile').textContent = `현재 최고 타일 ${highest()}`;
    const target = highest() < 128 ? 128 : highest() * 2;
    document.getElementById('next-goal').textContent = String(target);
    document.querySelector('.goal-values > span:last-child').textContent = String(target);
    document.querySelector('.goal-progress > span').style.width = `${Math.min(100, highest() / target * 100)}%`;
  }
  function playing() { status.replaceChildren(); status.append(document.createElement('i'), document.createTextNode(' 플레이 중')); }
  function startFresh() {
    [pauseDialog, restartDialog, resultDialog].forEach((dialog) => { if (dialog.open) dialog.close(); });
    board = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]; score = 0;
    render(); playing(); document.getElementById('pause-button').focus();
  }
  function showPause() {
    document.getElementById('paused-score').textContent = format(score);
    document.getElementById('paused-tile').textContent = String(highest());
    status.textContent = 'Ⅱ 일시정지'; pauseDialog.showModal();
  }
  function requestRestart(from) { restartFrom = from; if (pauseDialog.open) pauseDialog.close(); restartDialog.showModal(); }
  function cancelRestart() { restartDialog.close(); if (restartFrom === 'paused') showPause(); else document.getElementById('restart-button').focus(); }
  function showResult(reason = 'exit') {
    if (pauseDialog.open) pauseDialog.close();
    document.getElementById('result-score').textContent = format(score);
    document.getElementById('result-tile').textContent = String(highest());
    document.getElementById('result-reason').textContent = reason === 'blocked' ? '더 이상 이동할 수 없어요. 멋진 정원을 가꾸셨네요.' : '게임을 종료했어요. 잠깐의 여유가 되었길 바라요.';
    status.textContent = '게임 종료'; resultDialog.showModal();
  }
  document.getElementById('pause-button').addEventListener('click', showPause);
  document.getElementById('resume-button').addEventListener('click', () => { pauseDialog.close(); playing(); document.getElementById('pause-button').focus(); });
  pauseDialog.addEventListener('cancel', () => { playing(); });
  document.getElementById('restart-button').addEventListener('click', () => requestRestart('playing'));
  document.getElementById('pause-restart').addEventListener('click', () => requestRestart('paused'));
  document.getElementById('confirm-restart').addEventListener('click', startFresh);
  document.getElementById('cancel-restart').addEventListener('click', cancelRestart);
  restartDialog.addEventListener('cancel', (event) => { event.preventDefault(); cancelRestart(); });
  document.getElementById('exit-button').addEventListener('click', () => showResult());
  document.getElementById('pause-exit').addEventListener('click', () => showResult());
  document.getElementById('preview-result').addEventListener('click', () => showResult('blocked'));
  document.getElementById('result-restart').addEventListener('click', startFresh);
  document.querySelectorAll('.exit-home').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showResult(); }));
  resultDialog.addEventListener('cancel', (event) => event.preventDefault());
  render();
  if (new URLSearchParams(location.search).get('preview') === 'result') showResult('blocked');
}
