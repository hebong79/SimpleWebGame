/** Self-authored oscillator effects, no external recording. */
export function createAudio() {
  let context, enabled = false; const voices = new Set();
  const stop = () => { for (const voice of voices) { try { voice.stop(); } catch {} } voices.clear(); };
  const unlock = () => {
    if (!enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      const promise = context.resume(); promise?.catch(() => {});
    } catch { context = null; }
  };
  return { unlock, stop, setMuted(muted) { enabled = !muted; if (muted) stop(); },
    play(kind) {
      if (!enabled || !context || context.state !== 'running') return;
      try {
        const voice = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
        voice.type = 'sine'; voice.frequency.setValueAtTime(kind === 'win' ? 660 : 330, now);
        gain.gain.setValueAtTime(0.045, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        voice.connect(gain); gain.connect(context.destination); voices.add(voice);
        voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        voice.start(); voice.stop(now + 0.14);
      } catch {}
    } };
}
