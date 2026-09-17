/**
 * Procedural Audio Synthesizer (Web Audio API)
 */
// --- AUDIO SYNTHESIZER (Web Audio API - No external assets) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }
    init() {
      if (!this.ctx && typeof AudioContext !== 'undefined') {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    }
    playTone(freq, duration, type = 'sine', gainVal = 0.08) {
      if (!this.enabled) return;
      try {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }
    click() { this.playTone(800, 0.04, 'square', 0.03); }
    insert() {
      this.playTone(180, 0.12, 'sawtooth', 0.07);
      setTimeout(() => this.playTone(320, 0.08, 'sine', 0.05), 80);
    }
    plug() {
      this.playTone(520, 0.06, 'triangle', 0.06);
      setTimeout(() => this.playTone(880, 0.09, 'sine', 0.05), 50);
    }
    delete() { this.playTone(220, 0.15, 'sawtooth', 0.08); }
    toggle() { this.playTone(600, 0.05, 'sine', 0.04); }
  }

  const sfx = new SoundFX();

export { SoundFX, sfx };
