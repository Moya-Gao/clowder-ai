#!/usr/bin/env node
// Builds the EP01 scratch sound bed: Cat Cafe TTS voice cues + procedural BGM/SFX.
// Generated audio lives under animatic/out/audio and is intentionally not committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { audioPlan } from './audio-plan-v0.1.mjs';
import { edl, shotDurationMs } from '../edl-v1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '..', '..', 'assets');
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

function hasAudioStream(filePath) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', filePath],
    { encoding: 'utf8' },
  );
  return result.status === 0 && result.stdout.trim().length > 0;
}

function sourceAudioPolicyFor(shot) {
  const policy = audioPlan.sourceAudioPolicies?.[shot.id] ?? {};
  return typeof policy === 'string' ? { mode: policy } : policy;
}

function collectSourceAudioCues() {
  let cursorSec = 0;
  const cues = [];
  for (const shot of edl.shots) {
    const durationSec = shotDurationMs(shot) / 1000;
    if (shot.kind === 'video') {
      const policy = sourceAudioPolicyFor(shot);
      if (policy.mode === 'skip') {
        cursorSec += durationSec;
        continue;
      }
      const src = resolve(assetsDir, shot.src);
      if (hasAudioStream(src)) {
        const sourceDurationSec = Math.min(Number(shot.trimSec), durationSec);
        if (!Number.isFinite(sourceDurationSec) || sourceDurationSec <= 0) {
          throw new Error(
            `video shot ${shot.id} has invalid source audio duration: trimSec=${shot.trimSec}, timelineDurationSec=${durationSec.toFixed(3)}`,
          );
        }
        const volume = Number(policy.volume ?? audioPlan.sourceAudioBedVolume);
        if (!Number.isFinite(volume) || volume < 0) {
          throw new Error(`video shot ${shot.id} has invalid source audio volume: ${policy.volume}`);
        }
        cues.push({
          id: shot.id,
          src,
          startSec: cursorSec,
          durationSec: sourceDurationSec,
          volume,
        });
      }
    }
    cursorSec += durationSec;
  }
  return cues;
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

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function addFilteredNoise(samples, sampleRate, startSec, durationSec, amp, opts = {}) {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(samples.length, Math.floor((startSec + durationSec) * sampleRate));
  const attack = opts.attackSec ?? 0.05;
  const release = opts.releaseSec ?? 0.12;
  const smoothing = opts.smoothing ?? 0.92;
  const rng = seededRandom(opts.seed ?? 1);
  let state = 0;
  for (let i = start; i < end; i += 1) {
    const local = (i - start) / sampleRate;
    const remain = (end - i) / sampleRate;
    const env = Math.max(0, Math.min(1, local / attack, remain / release));
    state = state * smoothing + (rng() * 2 - 1) * (1 - smoothing);
    samples[i] += amp * env * state;
  }
}

function addKeyboardBed(samples, sampleRate, startSec, durationSec, seed = 0xc0ffee) {
  const rng = seededRandom(seed);
  const endSec = startSec + durationSec;
  let t = startSec;
  while (t < endSec) {
    t += 0.08 + rng() * 0.19;
    if (t >= endSec) break;
    const freq = 1450 + rng() * 850;
    addTone(samples, sampleRate, t, 0.028 + rng() * 0.018, freq, 0.014 + rng() * 0.01, {
      attackSec: 0.001,
      releaseSec: 0.025,
      decay: 34,
      harmonic: true,
    });
    addFilteredNoise(samples, sampleRate, t, 0.035, 0.012, {
      attackSec: 0.001,
      releaseSec: 0.026,
      smoothing: 0.72,
      seed: Math.floor(rng() * 0xffffffff),
    });
    if (rng() < 0.2) t += 0.16 + rng() * 0.22;
  }
}

function makeBgm() {
  const sr = audioPlan.sampleRate;
  const samples = new Float32Array(Math.ceil(audioPlan.durationSec * sr));
  const chords = [
    [196.0, 261.63, 329.63],
    [174.61, 261.63, 349.23],
    [196.0, 246.94, 329.63],
    [220.0, 261.63, 329.63],
  ];
  for (let start = 0, chord = 0; start < audioPlan.durationSec; start += 6, chord += 1) {
    for (const freq of chords[chord % chords.length]) {
      addTone(samples, sr, start, 6.4, freq, 0.0045, { attackSec: 0.55, releaseSec: 1.0 });
    }
  }
  const motif = [392.0, 523.25, 659.25];
  for (let phrase = 0; phrase * 8 < audioPlan.durationSec; phrase += 1) {
    const base = phrase * 8 + 1.2;
    const amp = base >= 49 && base <= 56 ? 0.003 : 0.005;
    motif.forEach((freq, i) => {
      addTone(samples, sr, base + i * 0.72, 0.28, freq, amp, {
        attackSec: 0.012,
        releaseSec: 0.22,
        decay: 7,
        harmonic: true,
      });
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
    } else if (cue.kind === 'roomTone') {
      addFilteredNoise(samples, sr, cue.startSec, cue.durationSec, 0.018, {
        attackSec: 0.8,
        releaseSec: 1.1,
        smoothing: 0.985,
        seed: 0x515151,
      });
      addTone(samples, sr, cue.startSec, cue.durationSec, 96, 0.004, { attackSec: 1.2, releaseSec: 1.4 });
    } else if (cue.kind === 'keyboardBed') {
      addKeyboardBed(samples, sr, cue.startSec, cue.durationSec);
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
const sourceAudioCues = collectSourceAudioCues();

const args = ['-y', '-i', bgmPath, '-i', sfxPath];
for (const path of voicePaths) args.push('-i', path);
for (const cue of sourceAudioCues) args.push('-i', cue.src);
const filters = [`[0:a]volume=${audioPlan.bgmVolume}[bgm]`, `[1:a]volume=${audioPlan.sfxVolume}[sfx]`];
audioPlan.voiceCues.forEach((cue, i) => {
  const inputIndex = i + 2;
  const delayMs = Math.round(cue.startSec * 1000);
  filters.push(
    `[${inputIndex}:a]aresample=${audioPlan.sampleRate},adelay=${delayMs}:all=1,volume=${audioPlan.voiceVolume}[v${i}]`,
  );
});
sourceAudioCues.forEach((cue, i) => {
  const inputIndex = i + 2 + voicePaths.length;
  const delayMs = Math.round(cue.startSec * 1000);
  const trim = cue.durationSec.toFixed(3);
  filters.push(
    `[${inputIndex}:a]atrim=0:${trim},asetpts=PTS-STARTPTS,aresample=${audioPlan.sampleRate},` +
      `adelay=${delayMs}:all=1,volume=${cue.volume}[src${i}]`,
  );
});
const labels = [
  '[bgm]',
  '[sfx]',
  ...audioPlan.voiceCues.map((_, i) => `[v${i}]`),
  ...sourceAudioCues.map((_, i) => `[src${i}]`),
].join('');
filters.push(
  `${labels}amix=inputs=${audioPlan.voiceCues.length + sourceAudioCues.length + 2}:duration=first:normalize=0,alimiter=limit=0.95[out]`,
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

console.log(
  `audio ok: ${mixPath} (${audioPlan.voiceCues.length} codex cues, ${audioPlan.sfxCues.length} sfx cues, ${sourceAudioCues.length} source beds)`,
);
