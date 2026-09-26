/**
 * Cisco Enterprise Rack & Cabling Studio - Procedural Web Audio FX & Haptics Engine
 * Pure Web Audio API synthesis (0 external asset files, 0 KB download, 100% offline).
 * Includes DC-offset pop prevention, DynamicsCompressor master limiter, instant gesture unlock,
 * and unified mute synchronization.
 */
(function () {
  'use strict';

  let audioCtx = null;
  let masterGain = null;
  let dynamicsCompressor = null;
  let isMuted = false;
  try {
    isMuted = localStorage.getItem('rack-studio-audio-muted') === 'true';
  } catch (_) {}

  // Startup grace period prevents sound bursting during page load & initial preset setup
  let isStartupGrace = true;
  setTimeout(() => { isStartupGrace = false; }, 1200);

  let isBatchMuted = false;
  let lastSoundTime = 0;

  function throttleSound(minIntervalMs = 20) {
    const now = performance.now();
    if (now - lastSoundTime < minIntervalMs) return false;
    lastSoundTime = now;
    return true;
  }

  function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      // Master limiter to prevent clipping, popping & audio bursts
      dynamicsCompressor = audioCtx.createDynamicsCompressor();
      dynamicsCompressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
      dynamicsCompressor.knee.setValueAtTime(10, audioCtx.currentTime);
      dynamicsCompressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      dynamicsCompressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
      dynamicsCompressor.release.setValueAtTime(0.1, audioCtx.currentTime);

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.8, audioCtx.currentTime);

      masterGain.connect(dynamicsCompressor);
      dynamicsCompressor.connect(audioCtx.destination);
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Synchronously unlock AudioContext on first user gesture to prevent desync & audio lag
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {}
  };
  ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  function setMuted(muted) {
    isMuted = !!muted;
    try {
      localStorage.setItem('rack-studio-audio-muted', isMuted ? 'true' : 'false');
    } catch (_) {}
    if (masterGain && audioCtx) {
      try {
        masterGain.gain.setValueAtTime(isMuted ? 0 : 0.8, audioCtx.currentTime);
      } catch (_) {}
    }
    updateAudioToggleButton();
  }

  function toggleMute() {
    setMuted(!isMuted);
    return isMuted;
  }

  function updateAudioToggleButton() {
    const btn = document.getElementById('btn-audio-toggle');
    if (btn) {
      btn.textContent = isMuted ? 'Ses: Kapalı' : 'Ses: Açık';
      btn.title = isMuted ? 'Ses Efektlerini Aç (Şu an sessiz)' : 'Ses Efektlerini Kapat (Şu an aktif)';
      btn.classList.toggle('muted', isMuted);
      btn.classList.toggle('active', !isMuted);
    }
  }

  // Smooth pop-free attack and release envelope helper
  function applyEnvelope(gainNode, ctx, startTime, peakGain, attackSec, releaseSec) {
    const startT = Math.max(startTime, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.0001, startT);
    gainNode.gain.linearRampToValueAtTime(peakGain, startT + attackSec);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startT + attackSec + releaseSec);
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
    if (isMuted || isStartupGrace || isBatchMuted) return;
    if (!throttleSound(15)) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

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
        applyEnvelope(gain, ctx, t, 0.25, 0.003, 0.045);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.05);

        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(140, t);
        subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.07);
        applyEnvelope(subGain, ctx, t, 0.3, 0.003, 0.075);
        subOsc.connect(subGain);
        subGain.connect(masterGain);
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
          applyEnvelope(gain, ctx, t, 0.2 - (idx * 0.06), 0.002, 0.042);
          osc.connect(gain);
          gain.connect(masterGain);
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
        applyEnvelope(gain1, ctx, t, 0.25, 0.003, 0.035);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(t);
        osc1.stop(t + 0.04);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2400, t + 0.01);
        osc2.frequency.exponentialRampToValueAtTime(800, t + 0.038);
        applyEnvelope(gain2, ctx, t + 0.01, 0.12, 0.002, 0.03);
        osc2.connect(gain2);
        gain2.connect(masterGain);
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
        applyEnvelope(gain, ctx, t, 0.18, 0.002, 0.023);
        osc.connect(gain);
        gain.connect(masterGain);
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
      applyEnvelope(gainA, ctx, t, 0.22, 0.002, 0.028);
      oscA.connect(gainA);
      gainA.connect(masterGain);
      oscA.start(t);
      oscA.stop(t + 0.032);
    } catch (_) {}
  }

  /**
   * Cable snipping / disconnection sound (clean frequency sweep cut)
   */
  function playCableCut() {
    if (isMuted || isStartupGrace || isBatchMuted) return;
    if (!throttleSound(20)) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      applyEnvelope(gain, ctx, t, 0.18, 0.003, 0.06);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.065);
    } catch (_) {}
  }

  /**
   * Device rack mount sound (chassis slide + cage nut lock)
   */
  function playDeviceMount() {
    if (isMuted || isStartupGrace || isBatchMuted) return;
    if (!throttleSound(40)) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    try {
      const t = ctx.currentTime;
      // Low chassis thud
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, t);
      osc1.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      applyEnvelope(gain1, ctx, t, 0.25, 0.004, 0.085);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(t);
      osc1.stop(t + 0.095);

      // High cage nut metallic click
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2800, t + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(1100, t + 0.07);
      applyEnvelope(gain2, ctx, t + 0.03, 0.15, 0.003, 0.045);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(t + 0.03);
      osc2.stop(t + 0.075);
    } catch (_) {}
  }

  /**
   * Overload 16A PDU Alarm (double pulsed alert tone)
   */
  function playOverloadAlarm() {
    if (isMuted || isStartupGrace || isBatchMuted) return;
    if (!throttleSound(200)) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    try {
      const t = ctx.currentTime;
      [0, 0.14].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t + delay);
        osc.frequency.setValueAtTime(1174, t + delay + 0.04);
        applyEnvelope(gain, ctx, t + delay, 0.15, 0.004, 0.095);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.1);
      });
    } catch (_) {}
  }

  /**
   * Network compliance / loop violation error sound (dual buzz rejection tone)
   */
  function playError() {
    if (isMuted || isStartupGrace || isBatchMuted) return;
    if (!throttleSound(50)) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    try {
      const t = ctx.currentTime;
      [0, 0.12].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t + delay);
        osc.frequency.linearRampToValueAtTime(80, t + delay + 0.08);
        applyEnvelope(gain, ctx, t + delay, 0.18, 0.004, 0.085);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.09);
      });
    } catch (_) {}
  }

  function bindAudioButton() {
    updateAudioToggleButton();
    const btn = document.getElementById('btn-audio-toggle');
    if (btn && !btn.dataset.boundAudio) {
      btn.dataset.boundAudio = 'true';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const muted = toggleMute();
        if (!muted) {
          playPortClick('copper');
        }
        const toast = document.getElementById('studio-toast');
        if (toast) {
          toast.textContent = muted ? 'Ses kapatıldı' : 'Ses açıldı';
          toast.className = 'show';
          setTimeout(() => { toast.className = ''; }, 2500);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAudioButton);
  } else {
    bindAudioButton();
  }

  window.SoundFX = {
    playPortClick,
    playCableCut,
    playDeviceMount,
    playOverloadAlarm,
    playError,
    setMuted,
    toggleMute,
    get isMuted() { return isMuted; },
    get isBatchMuted() { return isBatchMuted; },
    set isBatchMuted(val) { isBatchMuted = Boolean(val); }
  };
})();
