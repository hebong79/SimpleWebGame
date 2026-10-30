// Original synthesized cues; no sound files or network access.
export function createSound() {
  let context = null;
  const active = new Set();
  function stop() {
    for (const node of active) { try { node.stop(); } catch { /* already ended */ } }
    active.clear();
  }
  function play(kind, muted) {
    if (muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      if (context.state === 'suspended') context.resume().catch(() => {});
      const notes = kind === 'win' ? [440, 554, 659] : kind === 'draw' ? [330, 294] : [kind === 'X' ? 440 : 349];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = context.currentTime + index * .09;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(.06, start + .01);
        gain.gain.exponentialRampToValueAtTime(.001, start + .12);
        oscillator.connect(gain); gain.connect(context.destination);
        active.add(oscillator);
        oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + .13);
      });
    } catch { stop(); /* Audio is optional: remain fully playable. */ }
  }
  return { play, stop };
}
