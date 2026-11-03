// Original synthesized tones; no audio files or external assets.
export function createAudio() {
  let context = null, muted = true; const active = new Set();
  function stop() { for (const node of active) { try { node.stop(); } catch {} } active.clear(); }
  return {
    setMuted(value) { muted = value; if (muted) stop(); }, stop,
    unlock() { if (muted) return; try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; context ??= new Audio(); context.resume()?.catch(() => {}); } catch {} },
    play(win = false) {
      if (muted || !context || context.state !== 'running') return;
      try { const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime; oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(win ? 660 : 440, now); oscillator.frequency.exponentialRampToValueAtTime(win ? 990 : 550, now + .09); gain.gain.setValueAtTime(.07, now); gain.gain.exponentialRampToValueAtTime(.001, now + .15); oscillator.connect(gain); gain.connect(context.destination); active.add(oscillator); oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }; oscillator.start(now); oscillator.stop(now + .16); } catch {}
    }
  };
}
