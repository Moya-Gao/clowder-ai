#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timelineSpec } from './timeline-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(name) {
  return readFile(resolve(here, name), 'utf8');
}

const [html, css, js] = await Promise.all([
  read('s03-s04-info-pair.html'),
  read('s03-s04-info-pair.css'),
  read('s03-s04-info-pair.js'),
]);

assert(timelineSpec.canvas.width === 720, 'canvas width must be 720');
assert(timelineSpec.canvas.height === 1280, 'canvas height must be 1280');
assert(timelineSpec.canvas.aspectRatio === '9:16', 'canvas aspect must be 9:16');

const s03 = timelineSpec.shots.find((shot) => shot.id === 'S03');
const s04 = timelineSpec.shots.find((shot) => shot.id === 'S04');
const s06 = timelineSpec.shots.find((shot) => shot.id === 'S06');
const s07a = timelineSpec.shots.find((shot) => shot.id === 'S07a');
const s08 = timelineSpec.shots.find((shot) => shot.id === 'S08');
const s10 = timelineSpec.shots.find((shot) => shot.id === 'S10');
assert(s03, 'S03 spec missing');
assert(s04, 'S04 spec missing');
assert(s06, 'S06 spec missing');
assert(s07a, 'S07a spec missing');
assert(s08, 'S08 spec missing');
assert(s10, 'S10 spec missing');
assert(s03.durationMs === 4000, 'S03 duration must be 4000ms');
assert(s04.durationMs === 5000, 'S04 duration must be 5000ms');
assert(s06.durationMs === 4500, 'S06 duration must be 4500ms');
assert(s07a.durationMs === 3000, 'S07a duration must be 3000ms');
assert(s08.durationMs === 3000, 'S08 duration must be 3000ms');
assert(s10.durationMs === 5000, 'S10 duration must be 5000ms');

const labelIds = new Set(timelineSpec.shots.flatMap((shot) => shot.labels.map((label) => label.id)));
for (const required of [
  's03-avatar-in',
  's03-pr-in',
  's03-ci-in',
  's03-review-in',
  's03-paw-tap-pr',
  's04-left-in',
  's04-right-in',
  's04-static-compare',
  's04-red-x-duang',
  's04-hold',
  's06-ci-card',
  's06-review-card',
  's06-merged-card',
  's06-hold',
  's07a-cancel-stamp',
  's07a-comedy-pause',
  's07a-shuoshuo-pop',
  's07a-hold',
  's08-card-in',
  's08-pass-thunk',
  's08-hold',
  's10-main-line-in',
  's10-paw-stamp',
  's10-hold',
]) {
  assert(labelIds.has(required), `missing label: ${required}`);
}

const staticCompare = s04.labels.find((label) => label.id === 's04-static-compare');
const redX = s04.labels.find((label) => label.id === 's04-red-x-duang');
assert(staticCompare.durationMs === 800, 'S04 static compare must hold 800ms');
assert(redX.atMs === staticCompare.atMs + staticCompare.durationMs, 'red X must land after static comparison');

const s06Labels = Object.fromEntries(s06.labels.map((item) => [item.id, item]));
assert(s06Labels['s06-ci-card'].durationMs === 1600, 'S06 CI hold must be 1600ms');
assert(s06Labels['s06-review-card'].durationMs === 1300, 'S06 Review hold must be 1300ms');
assert(s06Labels['s06-merged-card'].durationMs === 1000, 'S06 Merged hold must be 1000ms');
assert(s06Labels['s06-hold'].durationMs === 600, 'S06 final hold must be 600ms');

const s07aLabels = Object.fromEntries(s07a.labels.map((item) => [item.id, item]));
assert(s07aLabels['s07a-cancel-stamp'].durationMs === 1000, 'S07a cancel stamp must be 1000ms');
assert(s07aLabels['s07a-comedy-pause'].durationMs === 500, 'S07a comedy pause must be 500ms');
assert(
  s07aLabels['s07a-shuoshuo-pop'].atMs ===
    s07aLabels['s07a-comedy-pause'].atMs + s07aLabels['s07a-comedy-pause'].durationMs,
  'S07a mention must pop after the 500ms comedy pause',
);

for (const hook of ['screen-readability', 'single-shot-duty', 'timeline-labels', 'mobile-9x16', 'stage-only-export']) {
  assert(timelineSpec.requiredAcceptanceHooks.includes(hook), `missing acceptance hook: ${hook}`);
}

assert(html.includes('s03-s04-info-pair.css'), 'html must reference css');
assert(html.includes('s03-s04-info-pair.js'), 'html must reference js');
assert(html.includes('data-shot="S03"'), 'html must contain S03 scene');
assert(html.includes('data-shot="S04"'), 'html must contain S04 scene');
assert(html.includes('data-shot="S06"'), 'html must contain S06 scene');
assert(html.includes('data-shot="S07a"'), 'html must contain S07a scene');
assert(html.includes('data-shot="S08"'), 'html must contain S08 scene');
assert(html.includes('data-shot="S10"'), 'html must contain S10 scene');
assert(html.includes('data-layer="demo"'), 'html must mark demo layer');
assert(html.includes('data-layer="caption"'), 'html must mark caption layer');
assert(html.includes('avatar.png'), 'S03 text avatar.png missing');
assert(html.includes('PR'), 'S03 text PR missing');
assert(html.includes('CI'), 'S03 text CI missing');
assert(html.includes('Review'), 'S03 text Review missing');
assert(html.includes('Landy 指定'), 'S04 approved label missing');
assert(html.includes('当前使用'), 'S04 current label missing');
assert(html.includes('CI Passed'), 'S06 CI Passed text missing');
assert(html.includes('@烁烁'), 'S07a mention missing');
assert(html.includes('PASS'), 'S08 PASS text missing');
assert(html.includes('流程要按风险缩放'), 'S10 end-card text missing');

assert(css.includes('aspect-ratio: 9 / 16'), 'css must lock 9:16 stage');
assert(css.includes('.export-mode [data-layer="demo"]'), 'css must hide demo layer in export mode');
assert(css.includes('.export-mode [data-layer="caption"]'), 'css must hide caption layer in export mode');
assert(css.includes('font-size: 30px'), 'S03 node text must be large enough for mobile prototype');
assert(js.includes('import { getShot, timelineSpec }'), 'js must import shared timeline spec');
assert(js.includes("label(shot, 's04-red-x-duang')"), 'js must drive red X from label');
assert(js.includes("params.get('export') === '1'"), 'js must support export mode');
assert(js.includes("normalizeShotId(params.get('shot'))"), 'js must support shot-specific playback');
assert(js.includes("label(shot, 's06-ci-card')"), 'js must drive S06 from label');
assert(js.includes("label(shot, 's07a-comedy-pause')"), 'js must drive S07a pause from label');

console.log('deterministic spike verify: ok');
