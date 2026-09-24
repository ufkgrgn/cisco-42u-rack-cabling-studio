/**
 * Procedural Audio Synthesizer (Web Audio API) for 3D Datacenter Studio
 * Fully synchronized with unified window.SoundFX and mute state.
 */
class SoundFX {
  constructor() {
    this.enabled = true;
  }

  get isMuted() {
    if (typeof window !== 'undefined') {
      if (window.SoundFX && typeof window.SoundFX.isMuted === 'boolean') {
        return window.SoundFX.isMuted;
      }
      try {
        return localStorage.getItem('rack-studio-audio-muted') === 'true';
      } catch (_) {}
    }
    return !this.enabled;
  }

  click() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.SoundFX?.playPortClick) {
      window.SoundFX.playPortClick('copper');
    }
  }

  insert() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.SoundFX?.playDeviceMount) {
      window.SoundFX.playDeviceMount();
    }
  }

  plug() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.SoundFX?.playPortClick) {
      window.SoundFX.playPortClick('sfp');
    }
  }

  delete() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.SoundFX?.playCableCut) {
      window.SoundFX.playCableCut();
    }
  }

  toggle() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.SoundFX?.playPortClick) {
      window.SoundFX.playPortClick('copper');
    }
  }
}

const sfx = new SoundFX();

export { SoundFX, sfx };
