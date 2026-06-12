#!/usr/bin/env node
// Animatic builder v1 — 真素材版（v0 占位卡版见 git 历史 6693646da）
// 输入: edl-v1.mjs + assets/（generated-clips 视频 / static-frames 静帧卡）+ subtitle.html
// 输出: out/animatic-v1.mp4（字幕已烧制；产物不进 git）
// 能力: 自动画幅探测——竖屏素材进横屏输出走 blur-pad（背景模糊填充），横屏直通
// 依赖: 本机 Chrome + ffmpeg/ffprobe，零 npm 依赖
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edl, shotDurationMs, totalDurationMs } from './edl-v1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '..', 'assets');
const outDir = resolve(here, 'out');
const segsDir = resolve(outDir, 'segs');
const subsDir = resolve(outDir, 'subs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const { width: W, height: H, fps: FPS } = edl;

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.slice(0, 4).join(' ')}... failed:\n${(result.stderr || result.stdout || '').slice(-1500)}`,
    );
  }
  return result;
}

function probe(path) {
  const r = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    path,
  ]);
  const [w, h] = r.stdout.trim().split(',').map(Number);
  return { w, h };
}

// 素材 → 统一规格 1280×720：同向直通缩放；异向 blur-pad（背景=拉满裁切+模糊，前景=等比居中）
function fitFilter(srcW, srcH) {
  const sameOrientation = srcW >= srcH === W >= H;
  if (sameOrientation) {
    return `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
  }
  return (
    `split[bg][fg];` +
    `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=luma_radius=24:luma_power=2[bgb];` +
    `[fg]scale=-2:${H}[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p`
  );
}

const ENC = ['-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an'];

function encodeVideoSeg(shot, index) {
  const src = resolve(assetsDir, shot.src);
  const { w, h } = probe(src);
  const seg = resolve(segsDir, `seg-${String(index).padStart(2, '0')}-${shot.id}.mp4`);
  run('ffmpeg', ['-y', '-i', src, '-t', shot.trimSec.toFixed(3), '-vf', fitFilter(w, h), ...ENC, seg]);
  return seg;
}

function encodeStillSeg(srcRel, holdMs, name) {
  const src = resolve(assetsDir, srcRel);
  const { w, h } = probe(src);
  const seg = resolve(segsDir, `${name}.mp4`);
  run('ffmpeg', ['-y', '-loop', '1', '-t', (holdMs / 1000).toFixed(3), '-i', src, '-vf', fitFilter(w, h), ...ENC, seg]);
  return seg;
}

function encodeBlackSeg(durationMs, name) {
  const seg = resolve(segsDir, `${name}.mp4`);
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${W}x${H}:r=${FPS}:d=${(durationMs / 1000).toFixed(3)}`,
    ...ENC.slice(0, -1),
    seg,
  ]);
  return seg;
}

// 默片式时间字卡：Chrome 渲染 intertitle.html → 静帧循环（喜剧"预期端"锚点，v1.1）
function encodeTitleSeg(shot, name) {
  const png = resolve(segsDir, `${name}.png`);
  const url = `file://${resolve(here, 'intertitle.html')}?${new URLSearchParams({ text: shot.text, sub: shot.sub ?? '' })}`;
  run(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`, '--virtual-time-budget=600', url]);
  const seg = resolve(segsDir, `${name}.mp4`);
  run('ffmpeg', ['-y', '-loop', '1', '-t', (shot.durationMs / 1000).toFixed(3), '-i', png, '-vf', 'format=yuv420p', ...ENC, seg]);
  return seg;
}

function msToSrt(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
}

// --- prepare ---
rmSync(outDir, { recursive: true, force: true });
mkdirSync(segsDir, { recursive: true });
mkdirSync(subsDir, { recursive: true });

// --- segments ---
const concatLines = [];
edl.shots.forEach((shot, i) => {
  if (shot.kind === 'video') {
    concatLines.push(`file '${encodeVideoSeg(shot, i)}'`);
  } else if (shot.kind === 'stills') {
    shot.segments.forEach((seg, j) => {
      concatLines.push(
        `file '${encodeStillSeg(seg.src, seg.holdMs, `seg-${String(i).padStart(2, '0')}-${shot.id}-${j}`)}'`,
      );
    });
  } else if (shot.kind === 'black') {
    concatLines.push(`file '${encodeBlackSeg(shot.durationMs, `seg-${String(i).padStart(2, '0')}-black`)}'`);
  } else if (shot.kind === 'title') {
    concatLines.push(`file '${encodeTitleSeg(shot, `seg-${String(i).padStart(2, '0')}-${shot.id}`)}'`);
  }
  console.log(`seg ${shot.id} done`);
});
const concatList = resolve(outDir, 'concat.txt');
writeFileSync(concatList, concatLines.join('\n') + '\n');
run('ffmpeg', [
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatList,
  '-c',
  'copy',
  resolve(outDir, 'animatic-v1-nosub.mp4'),
]);

// --- subtitle cues: per-shot relative -> absolute ---
let cursor = 0;
const cues = [];
for (const shot of edl.shots) {
  for (const sub of shot.subtitles ?? []) {
    cues.push({ start: (cursor + sub.startMs) / 1000, end: (cursor + sub.endMs) / 1000, text: sub.text, os: sub.os === true });
  }
  cursor += shotDurationMs(shot);
}
writeFileSync(
  resolve(outDir, 'animatic-v1.srt'),
  cues
    .map(
      (c, i) =>
        `${i + 1}\n${msToSrt(Math.round(c.start * 1000))} --> ${msToSrt(Math.round(c.end * 1000))}\n${c.text}\n`,
    )
    .join('\n'),
);

// --- render subtitle strips (Chrome transparent PNG) + overlay burn ---
cues.forEach((cue, i) => {
  const png = resolve(subsDir, `sub-${String(i).padStart(2, '0')}.png`);
  const url = `file://${resolve(here, 'subtitle.html')}?${new URLSearchParams({ text: cue.text, ...(cue.os ? { os: '1' } : {}) })}`;
  run(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${W},300`,
    '--default-background-color=00000000',
    `--screenshot=${png}`,
    '--virtual-time-budget=600',
    url,
  ]);
  cue.png = png;
});
const inputs = ['-i', resolve(outDir, 'animatic-v1-nosub.mp4')];
cues.forEach((cue) => inputs.push('-loop', '1', '-i', cue.png)); // -loop 1: 静态图单帧流在 ~66s 后 framesync repeat 失效（实测），持续流绕开
const chain = cues
  .map((cue, i) => {
    const inLabel = i === 0 ? '[0:v]' : `[v${i}]`;
    const outLabel = i === cues.length - 1 ? '[vout]' : `[v${i + 1}]`;
    return `${inLabel}[${i + 1}:v]overlay=0:H-h:enable='between(t,${cue.start.toFixed(2)},${cue.end.toFixed(2)})'${outLabel}`;
  })
  .join(';');
run('ffmpeg', [
  '-y',
  ...inputs,
  '-filter_complex',
  chain,
  '-map',
  '[vout]',
  ...ENC,
  resolve(outDir, 'animatic-v1.mp4'),
]);

// --- verify ---
const probeDur = run('ffprobe', [
  '-v',
  'error',
  '-show_entries',
  'format=duration',
  '-of',
  'csv=p=0',
  resolve(outDir, 'animatic-v1.mp4'),
]);
const actualSec = parseFloat(probeDur.stdout.trim());
const expectedSec = totalDurationMs() / 1000;
if (Math.abs(actualSec - expectedSec) > 0.8) {
  throw new Error(`duration mismatch: expected ~${expectedSec}s got ${actualSec}s`);
}
console.log(
  `animatic v1 ok: ${resolve(outDir, 'animatic-v1.mp4')} (${actualSec.toFixed(2)}s, expected ${expectedSec}s, ${cues.length} cues burned, ${W}x${H})`,
);
