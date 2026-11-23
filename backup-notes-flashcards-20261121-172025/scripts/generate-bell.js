#!/usr/bin/env node
/**
 * Generates an original, license-free notification bell at
 * android/app/src/main/res/raw/beep.wav.
 *
 * The sound is synthesized from scratch (no sampled/trademarked audio): a
 * bright strike transient followed by a short bell chord with exponential
 * decay. It is intentionally loud and clear so it is audible on a phone at the
 * user's chosen notification volume, without exceeding it.
 *
 * 44.1 kHz / 16-bit / mono, ~1.1 s.
 */
const fs = require("node:fs");
const path = require("node:path");

const sampleRate = 44100;
const duration = 1.1;
const total = Math.floor(sampleRate * duration);
const samples = new Float32Array(total);

// Bell partials (Hz) and relative weights. A quick attack plus exponential
// decay makes it read as a "ding" rather than a hum.
const partials = [
  { freq: 880, weight: 0.55, decay: 5.5 },
  { freq: 1320, weight: 0.28, decay: 6.5 },
  { freq: 1760, weight: 0.16, decay: 7.5 },
  { freq: 2640, weight: 0.08, decay: 9.0 },
];

for (let i = 0; i < total; i += 1) {
  const t = i / sampleRate;
  const attack = Math.min(1, t / 0.005);
  // Add a tiny high-frequency strike at the very start for clarity.
  const strike = t < 0.02 ? Math.sin(2 * Math.PI * 3200 * t) * (1 - t / 0.02) * 0.25 : 0;
  let value = strike;
  for (const partial of partials) {
    value +=
      Math.sin(2 * Math.PI * partial.freq * t) *
      partial.weight *
      Math.exp(-partial.decay * t);
  }
  // Gentle fade-out at the very end to avoid a click.
  const tail = Math.min(1, Math.max(0, (duration - t) / 0.08));
  samples[i] = value * attack * tail;
}

// Normalize to a strong but non-clipping peak (≈ -1 dBFS).
let peak = 0;
for (const value of samples) peak = Math.max(peak, Math.abs(value));
const gain = peak > 0 ? 0.89 / peak : 1;

const dataBytes = total * 2 + 44;
const buffer = Buffer.alloc(dataBytes);
buffer.write("RIFF", 0, "ascii");
buffer.writeUInt32LE(36 + total * 2, 4);
buffer.write("WAVE", 8, "ascii");
buffer.write("fmt ", 12, "ascii");
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
buffer.writeUInt16LE(2, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample
buffer.write("data", 36, "ascii");
buffer.writeUInt32LE(total * 2, 40);

for (let i = 0; i < total; i += 1) {
  const clamped = Math.max(-1, Math.min(1, samples[i] * gain));
  buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
}

const out = path.resolve(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res",
  "raw",
  "beep.wav",
);
fs.writeFileSync(out, buffer);
console.log(`[bell] wrote ${out} (${buffer.length} bytes)`);
