// Original immediate-mode vector art, authored for G024. No imported images or fonts.
const ellipse = (c, x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
const round = (c, x, y, w, h, r, color) => { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
export function drawChick(c, x, y, equipment, direction = 'up', pose = 'stand', progress = 0) {
  c.save(); c.translate(x, y);
  const lift = pose === 'hop' ? Math.sin(progress * Math.PI) * 7 : 0;
  ellipse(c, 0, 14, 12 - lift / 3, 4, '#263e3c36');
  c.translate(0, -lift);
  if (pose === 'fail') c.rotate(-0.3);
  if (pose === 'land') c.scale(1.07, 0.91);
  const back = equipment.backpack;
  if (back !== 'basic') {
    const colors = { straw: '#b97642', firefighter: '#a44234', frog: '#43846b' };
    round(c, direction === 'left' ? 7 : -13, -5, 13, 19, 4, colors[back]);
    round(c, direction === 'left' ? 10 : -10, 0, 7, 7, 2, '#fff2bd');
  }
  ellipse(c, -6, 14, 5, 3, '#df8c3f'); ellipse(c, 6, 14, 5, 3, '#df8c3f');
  ellipse(c, 0, 0, 14, 14, '#efb638'); ellipse(c, 0, -2, 12.5, 12.5, '#ffdc62');
  ellipse(c, direction === 'right' ? -9 : 9, 5, 5, 7, '#edb23c');
  const top = equipment.top;
  if (top !== 'basic') {
    round(c, -11, 3, 22, 9, 4, { straw: '#f2f0d1', firefighter: '#c95542', frog: '#63ab72' }[top]);
    round(c, -11, 7, 22, 3, 0, top === 'firefighter' ? '#f4d765' : '#ffffff55');
  }
  if (direction !== 'up') {
    const shift = direction === 'left' ? -5 : direction === 'right' ? 5 : 0;
    ellipse(c, shift - 4, -4, 1.8, 2.2, '#303d3b');
    if (direction === 'down') ellipse(c, shift + 4, -4, 1.8, 2.2, '#303d3b');
    c.fillStyle = '#e88835'; c.beginPath(); c.moveTo(shift - 3, 0); c.lineTo(shift + 4, 0); c.lineTo(shift, 4); c.fill();
    if (pose === 'fail') { c.strokeStyle = '#8b4e38'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -6); c.lineTo(-2, -2); c.moveTo(-2, -6); c.lineTo(-6, -2); c.stroke(); }
  } else { ellipse(c, -6, -7, 2, 3, '#ffe68d'); ellipse(c, 6, -7, 2, 3, '#ffe68d'); }
  const hat = equipment.hat;
  if (hat === 'straw') { ellipse(c, 0, -11, 17, 4, '#be8c46'); ellipse(c, 0, -14, 11, 6, '#efcb76'); round(c, -11, -12, 22, 3, 1, '#be7046'); }
  if (hat === 'firefighter') { round(c, -12, -19, 24, 11, 8, '#cb5641'); round(c, -16, -10, 32, 4, 2, '#943c32'); round(c, -3, -17, 6, 7, 2, '#ffe294'); }
  if (hat === 'frog') { ellipse(c, 0, -11, 15, 7, '#68ae74'); ellipse(c, -8, -17, 5, 5, '#81c184'); ellipse(c, 8, -17, 5, 5, '#81c184'); ellipse(c, -8, -18, 2, 2, '#284b3e'); ellipse(c, 8, -18, 2, 2, '#284b3e'); }
  c.restore();
}
export function drawWorld(c, state, equipped, reduced = false) {
  c.clearRect(0, 0, 360, 440);
  const base = Math.max(0, state.highest - 2);
  const screenY = (row) => 420 - (row - base) * 40;
  for (const lane of state.lanes) {
    const y = screenY(lane.row);
    if (y < -40 || y > 480) continue;
    c.fillStyle = lane.type === 'road' ? '#52646b' : (lane.row % 2 ? '#a8cda0' : '#b9d8a6');
    c.fillRect(0, y - 20, 360, 40);
    if (lane.type === 'road') {
      c.fillStyle = '#f5e7b17a';
      for (let x = 7; x < 360; x += 40) c.fillRect(x, y - 1, 17, 2);
      c.fillStyle = '#314c4938'; c.fillRect(0, y + 17, 360, 3);
      const delta = lane.period;
      for (let k = -2; k < Math.ceil(360 / delta) + 1; k++) {
        const x = lane.phase + k * delta - lane.width / 2;
        if (x > 360 || x + lane.width < 0) continue;
        round(c, x + 1, y - 10, lane.width, 27, 7, '#203e464d');
        round(c, x, y - 14, lane.width, 28, 7, lane.width === 56 ? '#ecba74' : '#d18e81');
        round(c, x + 13, y - 11, lane.width - 26, 22, 5, '#f7dfb0');
        round(c, x + (lane.direction > 0 ? lane.width - 21 : 10), y - 9, 11, 18, 3, '#557a87');
        round(c, x + (lane.direction > 0 ? 8 : lane.width - 16), y - 8, 8, 16, 2, '#7396a0');
        c.fillStyle = '#fff1c7'; c.fillRect(x + (lane.direction > 0 ? lane.width - 3 : 1), y - 9, 2, 5); c.fillRect(x + (lane.direction > 0 ? lane.width - 3 : 1), y + 5, 2, 5);
      }
    } else {
      for (let x = 0; x < 360; x += 40) {
        const n = (lane.row * 19 + x * 7) % 29;
        if (n < 9) { ellipse(c, x + 12, y + 6, 2, 2, '#faf0bc'); ellipse(c, x + 14, y + 3, 2, 2, '#f6e6ab'); }
        else { c.strokeStyle = '#7ba77966'; c.beginPath(); c.moveTo(x + 24, y + 7); c.lineTo(x + 22, y + 3); c.moveTo(x + 24, y + 7); c.lineTo(x + 27, y + 2); c.stroke(); }
      }
      if (lane.row % 5 === 0) { round(c, 5, y - 14, 25, 23, 4, '#ffffff66'); c.fillStyle = '#51764f'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText(String(lane.row), 17, y + 2); }
    }
  }
  const worldRow = (state.y - 20) / 40;
  const pose = state.reason === 'collision' ? 'fail' : state.hop && !reduced ? 'hop' : 'stand';
  drawChick(c, state.x, screenY(worldRow), equipped, state.facing, pose, state.hop ? state.hop.age / 0.12 : 0);
  c.strokeStyle = '#365e4b35'; c.lineWidth = 2; c.strokeRect(1, 1, 358, 438);
}
export function drawPreview(c, equipped, direction, pose, progress) {
  c.clearRect(0, 0, 240, 130);
  round(c, 0, 0, 240, 130, 18, '#e5efd7');
  c.strokeStyle = '#bdcfb0'; c.beginPath(); c.ellipse(120, 101, 69, 15, 0, 0, Math.PI * 2); c.stroke();
  c.save(); c.translate(120, 77); c.scale(2.3, 2.3);
  drawChick(c, 0, 0, equipped, direction, pose, progress); c.restore();
}
