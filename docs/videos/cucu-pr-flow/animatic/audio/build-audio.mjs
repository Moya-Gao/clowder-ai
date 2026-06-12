#!/usr/bin/env node
// Builds the EP01 scratch sound bed: Cat Cafe TTS voice cues + procedural BGM/SFX.
// Generated audio lives under animatic/out/audio and is intentionally not committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { audioPlan } from './audio-plan-v0.1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'out', 'audio');
const voiceDir = resolve(outDir, 'voice');
mkdirSync(voiceDir, { recursive: true });

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.slice(0, 4).join(' ')}... failed:\n${(result.stderr || result.stdout || '').slice(-1500)}`,
    );
  }
  return result;
}

function writeWavMono16(filePath, samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  writeFileSync(filePath, buf);
}

function addTone(samples, sampleRate, startSec, durationSec, freq, amp, opts = {}) {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(samples.length, Math.floor((startSec + durationSec) * sampleRate));
  const attack = opts.attackSec ?? 0.01;
  const release = opts.releaseSec ?? 0.08;
  for (let i = start; i < end; i += 1) {
    const local = (i - start) / sampleRate;
    const remain = (end - i) / sampleRate;
    const a = Math.min(1, local / attack, remain / release);
    const env = Math.max(0, a) * Math.exp(-local * (opts.decay ?? 0));
    const phase = 2 * Math.PI * freq * local;
    const wave = Math.sin(phase) + (opts.harmonic ? 0.35 * Math.sin(phase * 2) : 0);
    samples[i] += amp * env * wave;
  }
}

function makeBgm() {
  const sr = audioPlan.sampleRate;
  const samples = new Float32Array(Math.ceil(audioPlan.durationSec * sr));
  const chords = [
    [196.0, 261.63, 329.63, 392.0],
    [174.61, 261.63, 349.23, 440.0],
    [196.0, 246.94, 329.63, 392.0],
    [220.0, 261.63, 329.63, 440.0],
  ];
  for (let start = 0, chord = 0; start < audioPlan.durationSec; start += 4, chord += 1) {
    for (const freq of chords[chord % chords.length]) {
      addTone(samples, sr, start, 4.2, freq, 0.006, { attackSec: 0.18, releaseSec: 0.5 });
    }
  }
  const melody = [523.25, 659.25, 587.33, 783.99, 659.25, 523.25, 440.0, 493.88];
  for (let i = 0; i * 0.5 < audioPlan.durationSec; i += 1) {
    const t = i * 0.5;
    const amp = t >= 48.6 && t <= 55.6 ? 0.012 : 0.018;
    addTone(samples, sr, t, 0.16, melody[i % melody.length], amp, {
      attackSec: 0.004,
      releaseSec: 0.13,
      decay: 10,
      harmonic: true,
    });
  }
  return samples;
}

function makeSfx() {
  const sr = audioPlan.sampleRate;
  const samples = new Float32Array(Math.ceil(audioPlan.durationSec * sr));
  for (const cue of audioPlan.sfxCues) {
    if (cue.kind === 'ding') {
      addTone(samples, sr, cue.startSec, 0.85, 1046.5, 0.07, { releaseSec: 0.55, decay: 2, harmonic: true });
      addTone(samples, sr, cue.startSec + 0.08, 0.7, 1318.5, 0.04, { releaseSec: 0.45, decay: 3 });
    } else if (cue.kind === 'thump') {
      addTone(samples, sr, cue.startSec, 0.34, 88, 0.18, { attackSec: 0.002, releaseSec: 0.22, decay: 7 });
      addTone(samples, sr, cue.startSec + 0.02, 0.18, 176, 0.08, { attackSec: 0.002, releaseSec: 0.12, decay: 9 });
    } else if (cue.kind === 'machineTicks') {
      for (let i = 0; i < cue.count; i += 1) {
        addTone(samples, sr, cue.startSec + i * cue.intervalSec, 0.055, 920 + (i % 3) * 80, 0.055, {
          attackSec: 0.002,
          releaseSec: 0.045,
          decay: 18,
          harmonic: true,
        });
      }
    } else if (cue.kind === 'pop') {
      addTone(samples, sr, cue.startSec, 0.12, 740, 0.08, { attackSec: 0.002, releaseSec: 0.09, decay: 13 });
      addTone(samples, sr, cue.startSec + 0.03, 0.09, 1180, 0.035, { attackSec: 0.001, releaseSec: 0.07, decay: 14 });
    } else if (cue.kind === 'purr') {
      for (let t = cue.startSec; t < cue.startSec + cue.durationSec; t += 0.18) {
        addTone(samples, sr, t, 0.2, 54, 0.028, { attackSec: 0.04, releaseSec: 0.11 });
        addTone(samples, sr, t, 0.2, 108, 0.018, { attackSec: 0.04, releaseSec: 0.11 });
      }
    }
  }
  return samples;
}

async function synthesizeVoiceCue(cue) {
  const res = await fetch(`${audioPlan.apiUrl}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cat-Cafe-User': audioPlan.userId,
    },
    body: JSON.stringify({ text: cue.text, catId: audioPlan.voiceCatId }),
  });
  if (!res.ok) throw new Error(`TTS synthesize failed for ${cue.id}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json.audioUrl) throw new Error(`TTS synthesize returned no audioUrl for ${cue.id}`);
  const audio = await fetch(`${audioPlan.apiUrl}${json.audioUrl}`, {
    headers: { 'X-Cat-Cafe-User': audioPlan.userId },
  });
  if (!audio.ok) throw new Error(`TTS audio download failed for ${cue.id}: HTTP ${audio.status}`);
  const out = resolve(voiceDir, `${cue.id}.wav`);
  writeFileSync(out, Buffer.from(await audio.arrayBuffer()));
  return out;
}

const bgmPath = resolve(outDir, 'bgm-procedural-v0.wav');
const sfxPath = resolve(outDir, 'sfx-procedural-v0.wav');
const mixPath = resolve(outDir, 'cucu-audio-v0.wav');
writeWavMono16(bgmPath, makeBgm(), audioPlan.sampleRate);
writeWavMono16(sfxPath, makeSfx(), audioPlan.sampleRate);

const voicePaths = [];
for (const cue of audioPlan.voiceCues) {
  voicePaths.push(await synthesizeVoiceCue(cue));
}

const args = ['-y', '-i', bgmPath, '-i', sfxPath];
for (const path of voicePaths) args.push('-i', path);
const filters = ['[0:a]volume=0.70[bgm]', '[1:a]volume=0.95[sfx]'];
audioPlan.voiceCues.forEach((cue, i) => {
  const inputIndex = i + 2;
  const delayMs = Math.round(cue.startSec * 1000);
  filters.push(
    `[${inputIndex}:a]aresample=${audioPlan.sampleRate},adelay=${delayMs}:all=1,volume=1.08[v${i}]`,
  );
});
const labels = ['[bgm]', '[sfx]', ...audioPlan.voiceCues.map((_, i) => `[v${i}]`)].join('');
filters.push(
  `${labels}amix=inputs=${audioPlan.voiceCues.length + 2}:duration=first:normalize=0,alimiter=limit=0.95[out]`,
);
run('ffmpeg', [
  ...args,
  '-filter_complex',
  filters.join(';'),
  '-map',
  '[out]',
  '-ar',
  String(audioPlan.sampleRate),
  '-ac',
  '2',
  '-c:a',
  'pcm_s16le',
  mixPath,
]);

console.log(`audio ok: ${mixPath} (${audioPlan.voiceCues.length} codex cues, ${audioPlan.sfxCues.length} sfx cues)`);
