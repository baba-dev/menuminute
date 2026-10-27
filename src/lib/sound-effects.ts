"use client";

/**
 * MenuMinute Sound of Service — Lightweight Web Audio Synthesizer.
 * Zero external audio files, zero network latency, 100% opt-in.
 * Muted by default to respect quiet environments and browser autoplay policies.
 */

const AUDIO_STORAGE_KEY = "mm_sound_of_service_enabled";
export type AudioScope = "orders" | "kitchen" | "tactile";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Keep the existing service and kitchen opt-in settings authoritative. */
export function isAudioEnabled(scope: AudioScope = "tactile"): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (scope === "orders") return localStorage.getItem("menuminute.orders.sound") === "enabled";
    if (scope === "kitchen") return localStorage.getItem("menuminute.kitchen.sound") === "true";
    return localStorage.getItem(AUDIO_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Authentic Brass Kitchen Bell Chime ("Ding!")
 * Dual harmonic sine waves with exponential decay mimicking a physical service counter bell.
 */
export function playKitchenBell(scope: "orders" | "kitchen" = "orders"): void {
  if (!isAudioEnabled(scope)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Fundamental chime frequency (approx 1760Hz - A6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1760, now);
    osc1.frequency.exponentialRampToValueAtTime(1750, now + 0.8);

    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Overtone harmonic (approx 3520Hz - A7) for metallic brass sparkle
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(3520, now);

    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 0.6);
  } catch {
    // Gracefully ignore audio errors
  }
}

/**
 * Physical Receipt Paper Tear sound
 * Short shaped burst of pink-ish noise simulating tearing ticket off the printer/rail.
 */
export function playTicketTear(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const bufferSize = ctx.sampleRate * 0.12; // 120ms burst
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // White noise with high-frequency attenuation
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Soft wooden block tap for tactile button press feedback
 */
export function playWoodenTap(scope: AudioScope = "tactile"): void {
  if (!isAudioEnabled(scope)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Ignore audio errors
  }
}
