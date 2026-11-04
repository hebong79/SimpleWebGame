// Original synthesized tones only (WebAudio sine); no audio files or external assets. Muted by default, silent on any failure.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99];
const GAIN = 0.07;
export function createAudio() {
  let context = null, muted = true; const active = new Set();
  function stop() { for (const node of active) { try { node.stop(); } catch {} } active.clear(); }
  function tone(frequency, offset, length, gainValue = GAIN) {
    if (muted || !context || context.state !== 'running') return;
    try {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + offset;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(gainValue, start); gain.gain.exponentialRampToValueAtTime(0.001, start + length);
      oscillator.connect(gain); gain.connect(context.destination); active.add(oscillator);
      oscillator.onended = () => { active.delete(oscillator); try { oscillator.disconnect(); gain.disconnect(); } catch {} };
      oscillator.start(start); oscillator.stop(start + length + 0.02);
    } catch {}
  }
  return {
    setMuted(value) { muted = value; if (muted) stop(); }, stop,
    unlock() {
      if (muted) return;
      try { const Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return; context ??= new Ctor(); context.resume()?.catch(() => {}); } catch {}
    },
    pick(color, absorbed) { tone(PENTATONIC[color] ?? PENTATONIC[0], 0, 0.12); if (absorbed > 0) tone((PENTATONIC[color] ?? PENTATONIC[0]) * 2, 0.04, 0.07, GAIN * 0.6); },
    win() { PENTATONIC.forEach((f, i) => tone(f, i * 0.1, 0.16)); },
    lose() { tone(392, 0, 0.18); tone(261.63, 0.16, 0.24); }
  };
}
