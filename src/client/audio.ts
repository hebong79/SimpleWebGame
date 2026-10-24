export class MergeAudio {
  private context?: AudioContext;
  private active = new Set<OscillatorNode>();
  private muted = true;
  available = true;
  setMuted(muted: boolean): void { this.muted = muted; if (muted) this.stop(); }
  async activate(): Promise<void> {
    if (this.muted || !this.available) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { this.available = false; }
  }
  merge(highestTile: number): void {
    if (this.muted || !this.available || !this.context || this.context.state !== 'running') return;
    try {
      const ctx = this.context;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220 + Math.min(Math.log2(highestTile), 11) * 28, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      oscillator.connect(gain); gain.connect(ctx.destination);
      this.active.add(oscillator);
      oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.11);
    } catch { this.available = false; this.stop(); }
  }
  stop(): void { for (const node of this.active) { try { node.stop(); node.disconnect(); } catch { /* Ended node. */ } } this.active.clear(); }
}
