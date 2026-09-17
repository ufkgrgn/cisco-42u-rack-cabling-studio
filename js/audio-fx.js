/**
 * Cisco Enterprise Rack & Cabling Studio - Procedural Web Audio FX & Haptics Engine
 * Pure Web Audio API synthesis (0 external asset files, 0 KB download, 100% offline).
 */
(function () {
  'use strict';

  let audioCtx = null;
  let isMuted = localStorage.getItem('rack-studio-audio-muted') === 'true';

  function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Ensure AudioContext unlocks upon first user interaction
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, { once: true, passive: true });
  });

  function setMuted(muted) {
    isMuted = !!muted;
    localStorage.setItem('rack-studio-audio-muted', isMuted ? 'true' : 'false');
    updateAudioToggleButton();
  }

  function toggleMute() {
    setMuted(!isMuted);
    return isMuted;
  }

  function updateAudioToggleButton() {
    const btn = document.getElementById('btn-audio-toggle');
    if (btn) {
      btn.textContent = isMuted ? '🔇' : '🔊';
      btn.title = isMuted ? 'Ses Efektlerini Aç (Şu an sessiz)' : 'Ses Efektlerini Kapat';
      btn.classList.toggle('muted', isMuted);
    }
  }

  /**
   * Generates a realistic mechanical port latch click based on connector type:
   * - copper/rj45: mechanical plastic latch click
   * - lc: delicate optical latch snap
   * - sc: solid push-pull sliding latch clack
   * - sfp: metallic chassis latch ping
   * - power: heavy AC switch clunk
   */
  function playPortClick(portType = 'copper') {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const normType = String(portType || 'copper').toLowerCase();

      if (normType === 'power') {
        // Heavy industrial toggle click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);

        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(140, t);
        subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.07);
        subGain.gain.setValueAtTime(0.4, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(t);
        subOsc.stop(t + 0.08);
        return;
      }

      if (normType.includes('sfp') || normType.includes('qsfp')) {
        // Metallic cage spring latch (high resonant dual ping)
        [3200, 5600].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.04);
          gain.gain.setValueAtTime(0.25 - (idx * 0.08), t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.045);
        });
        return;
      }

      if (normType.includes('sc')) {
        // SC Duplex solid push-pull sliding latch clack
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1250, t);
        osc1.frequency.exponentialRampToValueAtTime(350, t + 0.035);
        gain1.gain.setValueAtTime(0.3, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(t);
        osc1.stop(t + 0.04);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2400, t + 0.01);
        osc2.frequency.exponentialRampToValueAtTime(800, t + 0.038);
        gain2.gain.setValueAtTime(0.15, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t + 0.01);
        osc2.stop(t + 0.042);
        return;
      }

      if (normType.includes('fiber') || normType.includes('lc')) {
        // LC Duplex delicate high precision click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3800, t);
        osc.frequency.exponentialRampToValueAtTime(1900, t + 0.025);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.025);
        return;
      }

      // Default Copper / RJ45 plastic snap click
      const oscA = ctx.createOscillator();
      const gainA = ctx.createGain();
      oscA.type = 'triangle';
      oscA.frequency.setValueAtTime(2200, t);
      oscA.frequency.exponentialRampToValueAtTime(600, t + 0.03);
      gainA.gain.setValueAtTime(0.28, t);
      gainA.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      oscA.connect(gainA);
      gainA.connect(ctx.destination);
      oscA.start(t);
      oscA.stop(t + 0.032);
    } catch (e) {
      // AudioContext error suppression
    }
  }

  /**
   * Cable snipping / disconnection sound (clean frequency sweep cut)
   */
  function playCableCut() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
    } catch (e) {}
  }

  /**
   * Device rack mount sound (heavier chassis slide + cage nut lock)
   */
  function playDeviceMount() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      // Low chassis thud
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, t);
      osc1.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.095);

      // High cage nut metallic click
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2800, t + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(1100, t + 0.07);
      gain2.gain.setValueAtTime(0.2, t + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.03);
      osc2.stop(t + 0.075);
    } catch (e) {}
  }

  /**
   * Overload 16A PDU Alarm (double pulsed alert tone)
   */
  function playOverloadAlarm() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      [0, 0.14].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t + delay);
        osc.frequency.setValueAtTime(1174, t + delay + 0.04);
        gain.gain.setValueAtTime(0.2, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.1);
      });
    } catch (e) {}
  }

  /**
   * Network compliance / loop violation error sound (dual buzz rejection tone)
   */
  function playError() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      [0, 0.12].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t + delay);
        osc.frequency.linearRampToValueAtTime(80, t + delay + 0.08);
        gain.gain.setValueAtTime(0.25, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.09);
      });
    } catch (e) {}
  }

  // Initialize UI button binding
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateAudioToggleButton();
      document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
        const muted = toggleMute();
        if (!muted) playPortClick('copper');
      });
    });
  } else {
    updateAudioToggleButton();
    document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
      const muted = toggleMute();
      if (!muted) playPortClick('copper');
    });
  }

  window.SoundFX = {
    playPortClick,
    playCableCut,
    playDeviceMount,
    playOverloadAlarm,
    playError,
    setMuted,
    toggleMute,
    get isMuted() { return isMuted; }
  };
})();
