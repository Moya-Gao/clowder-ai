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
assert(s03, 'S03 spec missing');
assert(s04, 'S04 spec missing');
assert(s03.durationMs === 4000, 'S03 duration must be 4000ms');
assert(s04.durationMs === 5000, 'S04 duration must be 5000ms');

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
]) {
  assert(labelIds.has(required), `missing label: ${required}`);
}

const staticCompare = s04.labels.find((label) => label.id === 's04-static-compare');
const redX = s04.labels.find((label) => label.id === 's04-red-x-duang');
assert(staticCompare.durationMs === 800, 'S04 static compare must hold 800ms');
assert(redX.atMs === staticCompare.atMs + staticCompare.durationMs, 'red X must land after static comparison');

for (const hook of ['screen-readability', 'single-shot-duty', 'timeline-labels', 'mobile-9x16']) {
  assert(timelineSpec.requiredAcceptanceHooks.includes(hook), `missing acceptance hook: ${hook}`);
}

assert(html.includes('s03-s04-info-pair.css'), 'html must reference css');
assert(html.includes('s03-s04-info-pair.js'), 'html must reference js');
assert(html.includes('data-shot="S03"'), 'html must contain S03 scene');
assert(html.includes('data-shot="S04"'), 'html must contain S04 scene');
assert(html.includes('avatar.png'), 'S03 text avatar.png missing');
assert(html.includes('PR'), 'S03 text PR missing');
assert(html.includes('CI'), 'S03 text CI missing');
assert(html.includes('Review'), 'S03 text Review missing');
assert(html.includes('Landy 指定'), 'S04 approved label missing');
assert(html.includes('当前使用'), 'S04 current label missing');

assert(css.includes('aspect-ratio: 9 / 16'), 'css must lock 9:16 stage');
assert(css.includes('font-size: 30px'), 'S03 node text must be large enough for mobile prototype');
assert(js.includes("import { getShot, timelineSpec }"), 'js must import shared timeline spec');
assert(js.includes("label(shot, 's04-red-x-duang')"), 'js must drive red X from label');

console.log('deterministic spike verify: ok');
