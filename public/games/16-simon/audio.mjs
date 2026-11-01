// Locally synthesized tones; no audio files or third-party assets.
export function createSound() {
  let context = null, generation = 0;
  const voices = new Set();
  function stop() { generation++; for (const voice of voices) { try { voice.stop(); } catch {} } voices.clear(); }
  async function play(kind, muted) {
    if (muted) return;
    const token = generation;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      await context.resume();
      if (generation !== token || document.hidden) return;
      const voice = context.createOscillator(), gain = context.createGain();
      voice.type = 'sine'; voice.frequency.value = typeof kind === 'number' ? [262, 330, 392, 523][kind] : kind === 'success' ? 660 : 155;
      const now = context.currentTime, duration = kind === 'wrong' ? 0.18 : 0.11;
      gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      voice.connect(gain); gain.connect(context.destination); voices.add(voice);
      voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
      voice.start(now); voice.stop(now + duration);
    } catch { /* Unsupported/blocked audio must never interrupt gameplay. */ }
  }
  return { play, stop };
}
