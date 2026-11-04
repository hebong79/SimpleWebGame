// Original WebAudio synthesis only (no audio files). Muted by default; the context is created only by unlock() after a user gesture.
const NOTES = {
  select: [{ f: 880, d: .07, type: 'sine' }],
  jump: [{ f: 196, d: .09, type: 'square', g: .045 }, { f: 330, d: .07, at: .05, type: 'sine' }],
  remove: [{ f: 1318, d: .04, at: .09, type: 'sine', g: .05 }],
  undo: [{ f: 392, d: .08, type: 'triangle' }, { f: 262, d: .08, at: .06, type: 'triangle' }],
  win: [{ f: 523, d: .1, type: 'sine' }, { f: 659, d: .1, at: .1, type: 'sine' }, { f: 784, d: .1, at: .2, type: 'sine' }, { f: 1047, d: .16, at: .3, type: 'sine' }],
  stuck: [{ f: 330, d: .14, type: 'triangle' }, { f: 220, d: .18, at: .14, type: 'triangle' }],
};
export function createAudio() {
  let context = null, muted = true; const active = new Set();
  function stop() { for (const node of active) { try { node.stop(); } catch { /* already stopped */ } } active.clear(); }
  return {
    stop,
    setMuted(value) { muted = Boolean(value); if (muted) stop(); },
    unlock() {
      if (muted) return;
      try { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return; context ??= new Context(); context.resume()?.catch(() => {}); } catch { context = null; }
    },
    play(kind) {
      const notes = NOTES[kind];
      if (muted || !notes || !context || context.state !== 'running' || document.hidden) return;
      try {
        for (const note of notes) {
          const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + (note.at ?? 0);
          oscillator.type = note.type; oscillator.frequency.setValueAtTime(note.f, start);
          gain.gain.setValueAtTime(note.g ?? .06, start); gain.gain.exponentialRampToValueAtTime(.001, start + note.d);
          oscillator.connect(gain); gain.connect(context.destination); active.add(oscillator);
          oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(start); oscillator.stop(start + note.d + .02);
        }
      } catch { /* audio must never interrupt play */ }
    },
  };
}
