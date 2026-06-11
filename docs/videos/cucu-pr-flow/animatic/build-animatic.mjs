#!/usr/bin/env node
// Animatic v0 builder — E lane 可复现脚本
// 输入: edl-v0.mjs（节奏真相源）+ deterministic-spike export 模式（D 帧）+ placeholder.html（V 占位）
// 输出: out/animatic-v0.mp4（silent + 烧字幕；产物不进 git，见 .gitignore）
// 依赖: 本机 Chrome + ffmpeg/ffprobe + python3（http.server），零 npm 依赖
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edl, totalDurationMs } from './edl-v0.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const spikeDir = resolve(here, '../deterministic-spike');
const outDir = resolve(here, 'out');
const framesDir = resolve(outDir, 'frames');
const segsDir = resolve(outDir, 'segs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8123;

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.slice(0, 3).join(' ')}... failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function capture(url, pngPath, virtualTimeMs) {
  run(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--window-size=720,1280',
    `--screenshot=${pngPath}`,
    `--virtual-time-budget=${virtualTimeMs}`,
    url,
  ]);
}

function msToSrt(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const milli = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
}

// --- prepare dirs ---
rmSync(outDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(segsDir, { recursive: true });

// --- start static server for spike (ES module needs http, not file://) ---
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: spikeDir,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1200));

const stills = []; // { png, holdMs }
try {
  for (const shot of edl.shots) {
    if (shot.kind === 'frames') {
      shot.segments.forEach((seg, i) => {
        const png = resolve(framesDir, `${shot.id}-f${i + 1}.png`);
        capture(
          `http://127.0.0.1:${PORT}/s03-s04-info-pair.html?export=1&shot=${shot.id}`,
          png,
          seg.virtualTimeMs,
        );
        stills.push({ png, holdMs: seg.holdMs });
        console.log(`frame ${shot.id}-f${i + 1} @${seg.virtualTimeMs}ms`);
      });
    } else {
      const png = resolve(framesDir, `${shot.id}-placeholder.png`);
      const query = new URLSearchParams({
        shot: shot.id,
        lane: shot.lane ?? 'V',
        beat: shot.beat ?? '',
        dur: (shot.durationMs / 1000).toString(),
        subs: (shot.subtitles ?? []).map((sub) => sub.text).join('|'),
      });
      capture(`file://${resolve(here, 'placeholder.html')}?${query}`, png, 800);
      stills.push({ png, holdMs: shot.durationMs });
      console.log(`placeholder ${shot.id}`);
    }
  }
} finally {
  server.kill();
}

// --- stills -> segments -> concat ---
const concatLines = [];
stills.forEach((item, i) => {
  const seg = resolve(segsDir, `seg-${String(i).padStart(2, '0')}.mp4`);
  run('ffmpeg', [
    '-y', '-loop', '1', '-t', (item.holdMs / 1000).toFixed(3), '-i', item.png,
    '-r', String(edl.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    seg,
  ]);
  concatLines.push(`file '${seg}'`);
});
const concatList = resolve(outDir, 'concat.txt');
writeFileSync(concatList, concatLines.join('\n') + '\n');
run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', resolve(outDir, 'animatic-v0-silent.mp4')]);

// --- subtitles: per-shot relative -> absolute SRT ---
let cursorMs = 0;
const cues = [];
for (const shot of edl.shots) {
  for (const sub of shot.subtitles ?? []) {
    cues.push({ start: cursorMs + sub.startMs, end: cursorMs + sub.endMs, text: sub.text });
  }
  cursorMs += shot.durationMs;
}
const srt = cues
  .map((cue, i) => `${i + 1}\n${msToSrt(cue.start)} --> ${msToSrt(cue.end)}\n${cue.text}\n`)
  .join('\n');
writeFileSync(resolve(outDir, 'animatic-v0.srt'), srt);

// 本机 ffmpeg 无 libass/freetype（无 subtitles/drawtext 滤镜）——
// 对白已烤进占位卡（Chrome 渲染），SRT 以 mov_text 软字幕流 mux（原生 encoder 零依赖）
run('ffmpeg', [
  '-y', '-i', 'animatic-v0-silent.mp4', '-i', 'animatic-v0.srt',
  '-map', '0:v', '-map', '1:0',
  '-c:v', 'copy', '-c:s', 'mov_text',
  '-metadata:s:s:0', 'language=zho',
  'animatic-v0.mp4',
], { cwd: outDir });

// --- verify duration ---
const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(outDir, 'animatic-v0.mp4')]);
const actualSec = parseFloat(probe.stdout.trim());
const expectedSec = totalDurationMs() / 1000;
if (Math.abs(actualSec - expectedSec) > 0.8) {
  throw new Error(`duration mismatch: expected ~${expectedSec}s got ${actualSec}s`);
}
console.log(`animatic ok: ${resolve(outDir, 'animatic-v0.mp4')} (${actualSec.toFixed(2)}s, expected ${expectedSec}s, ${cues.length} subtitle cues)`);
