import { getShot, timelineSpec } from './timeline-spec.mjs';

const stage = document.querySelector('[data-stage]');
const scenes = [...document.querySelectorAll('[data-shot]')];
const clock = document.querySelector('[data-clock]');
const status = document.querySelector('[data-status]');
const controls = document.querySelector('.control-strip');
const params = new URLSearchParams(window.location.search);
const sequence = ['S03', 'S04', 'S06', 'S07a', 'S08', 'S10'];

let activeAnimations = [];
let clockTimer = null;

if (params.get('export') === '1') {
  document.documentElement.classList.add('export-mode');
  stage.dataset.export = '1';
}

function byAnim(name) {
  const el = document.querySelector(`[data-anim="${name}"]`);
  if (!el) {
    throw new Error(`Missing animation target: ${name}`);
  }
  return el;
}

function resetAnimations() {
  for (const animation of activeAnimations) {
    animation.cancel();
  }
  activeAnimations = [];
  clearInterval(clockTimer);
  clockTimer = null;
  clock.value = '00:00';
}

function setActiveShot(shotId) {
  for (const scene of scenes) {
    scene.classList.toggle('is-active', scene.dataset.shot === shotId);
  }
  stage.dataset.activeShot = shotId;
}

function animate(target, keyframes, options) {
  const animation = target.animate(keyframes, {
    fill: 'both',
    easing: 'cubic-bezier(.2,.8,.2,1)',
    ...options,
  });
  activeAnimations.push(animation);
  return animation;
}

function label(shot, id) {
  const item = shot.labels.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`Missing label ${id} for ${shot.id}`);
  }
  return item;
}

function startClock(durationMs) {
  const started = performance.now();
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const elapsed = Math.min(durationMs, performance.now() - started);
    const seconds = Math.floor(elapsed / 1000)
      .toString()
      .padStart(2, '0');
    const frames = Math.floor(((elapsed % 1000) / 1000) * timelineSpec.canvas.fps)
      .toString()
      .padStart(2, '0');
    clock.value = `${seconds}:${frames}`;
    if (elapsed >= durationMs) {
      clearInterval(clockTimer);
    }
  }, 80);
}

function finishStatus(shot, text = `${shot.id} hold`) {
  setTimeout(() => {
    status.textContent = text;
  }, shot.durationMs);
}

function playS03() {
  resetAnimations();
  setActiveShot('S03');
  status.textContent = 'S03 playing';
  const shot = getShot('S03');
  startClock(shot.durationMs);

  const avatar = label(shot, 's03-avatar-in');
  const pr = label(shot, 's03-pr-in');
  const ci = label(shot, 's03-ci-in');
  const review = label(shot, 's03-review-in');
  const tap = label(shot, 's03-paw-tap-pr');

  const nodes = [
    ['s03-avatar', avatar],
    ['s03-pr', pr],
    ['s03-ci', ci],
    ['s03-review', review],
  ];

  for (const [target, timing] of nodes) {
    animate(
      byAnim(target),
      [
        { opacity: 0, transform: 'translateY(20px) scale(.96)' },
        { opacity: 1, transform: 'translateY(0) scale(1.04)', offset: 0.72 },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { delay: timing.atMs, duration: timing.durationMs },
    );
  }

  animate(byAnim('s03-arrow-1'), [{ opacity: 0 }, { opacity: 1 }], {
    delay: pr.atMs - 110,
    duration: 180,
  });
  animate(byAnim('s03-arrow-2'), [{ opacity: 0 }, { opacity: 1 }], {
    delay: ci.atMs - 110,
    duration: 180,
  });
  animate(byAnim('s03-arrow-3'), [{ opacity: 0 }, { opacity: 1 }], {
    delay: review.atMs - 110,
    duration: 180,
  });
  animate(
    byAnim('s03-paw'),
    [
      { opacity: 0, transform: 'translate(-18px, 26px) rotate(-12deg) scale(.8)' },
      { opacity: 1, transform: 'translate(0, 0) rotate(-12deg) scale(1.05)', offset: 0.42 },
      { opacity: 1, transform: 'translate(10px, 10px) rotate(-18deg) scale(.92)', offset: 0.62 },
      { opacity: 1, transform: 'translate(12px, 12px) rotate(-12deg) scale(1)' },
    ],
    { delay: tap.atMs, duration: tap.durationMs },
  );

  finishStatus(shot);
}

function playS04() {
  resetAnimations();
  setActiveShot('S04');
  status.textContent = 'S04 playing';
  const shot = getShot('S04');
  startClock(shot.durationMs);

  const left = label(shot, 's04-left-in');
  const right = label(shot, 's04-right-in');
  const redX = label(shot, 's04-red-x-duang');

  animate(
    byAnim('s04-left'),
    [
      { opacity: 0, transform: 'translateY(24px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { delay: left.atMs, duration: left.durationMs },
  );
  animate(
    byAnim('s04-right'),
    [
      { opacity: 0, transform: 'translateY(24px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { delay: right.atMs, duration: right.durationMs },
  );
  animate(
    byAnim('s04-red-x'),
    [
      { opacity: 0, transform: 'scale(.55) rotate(-12deg)' },
      { opacity: 1, transform: 'scale(1.18) rotate(-8deg)', offset: 0.38 },
      { opacity: 1, transform: 'scale(.98) rotate(-14deg)', offset: 0.56 },
      { opacity: 1, transform: 'scale(1) rotate(-12deg)' },
    ],
    { delay: redX.atMs, duration: redX.durationMs, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  animate(
    document.querySelector('.evidence-board'),
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)', offset: 0.22 },
      { transform: 'translateX(7px)', offset: 0.44 },
      { transform: 'translateX(-4px)', offset: 0.62 },
      { transform: 'translateX(0)' },
    ],
    { delay: redX.atMs + 80, duration: 360 },
  );

  finishStatus(shot);
}

function playS06() {
  resetAnimations();
  setActiveShot('S06');
  status.textContent = 'S06 playing';
  const shot = getShot('S06');
  startClock(shot.durationMs);

  const ci = label(shot, 's06-ci-card');
  const review = label(shot, 's06-review-card');
  const merged = label(shot, 's06-merged-card');

  for (const [target, timing] of [
    ['s06-ci', ci],
    ['s06-review', review],
    ['s06-merged', merged],
  ]) {
    animate(
      byAnim(target),
      [
        { opacity: 0, transform: 'translateX(-22px) scale(.98)' },
        { opacity: 1, transform: 'translateX(0) scale(1.035)', offset: 0.48 },
        { opacity: 1, transform: 'translateX(0) scale(1)' },
      ],
      { delay: timing.atMs, duration: 320 },
    );
  }

  for (const [target, timing] of [
    ['s06-pulse-1', ci],
    ['s06-pulse-2', review],
    ['s06-pulse-3', merged],
  ]) {
    animate(
      byAnim(target),
      [
        { opacity: 0, transform: 'translateX(-50%) scale(.6)' },
        { opacity: 1, transform: 'translateX(-50%) scale(1.22)', offset: 0.45 },
        { opacity: 0.8, transform: 'translateX(-50%) scale(1)' },
      ],
      { delay: timing.atMs + 120, duration: 380 },
    );
  }

  finishStatus(shot);
}

function playS07a() {
  resetAnimations();
  setActiveShot('S07a');
  status.textContent = 'S07a playing';
  const shot = getShot('S07a');
  startClock(shot.durationMs);

  const cancel = label(shot, 's07a-cancel-stamp');
  const pause = label(shot, 's07a-comedy-pause');
  const mention = label(shot, 's07a-shuoshuo-pop');

  animate(
    byAnim('s07a-card'),
    [
      { opacity: 0, transform: 'translateY(26px) rotate(-1deg)' },
      { opacity: 1, transform: 'translateY(0) rotate(-1deg)', offset: 0.52 },
      { opacity: 1, transform: 'translateY(0) rotate(0deg)' },
    ],
    { delay: cancel.atMs, duration: cancel.durationMs },
  );
  animate(
    byAnim('s07a-pause'),
    [
      { opacity: 0 },
      { opacity: 0.7, offset: 0.18 },
      { opacity: 0.7, offset: 0.82 },
      { opacity: 0 },
    ],
    { delay: pause.atMs, duration: pause.durationMs },
  );
  animate(
    byAnim('s07a-mention'),
    [
      { opacity: 0, transform: 'scale(.55) rotate(8deg)' },
      { opacity: 1, transform: 'scale(1.18) rotate(-3deg)', offset: 0.48 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)' },
    ],
    { delay: mention.atMs, duration: mention.durationMs, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  animate(byAnim('s07a-note'), [{ opacity: 0 }, { opacity: 1 }], {
    delay: mention.atMs + 280,
    duration: 240,
  });

  finishStatus(shot);
}

function playS08() {
  resetAnimations();
  setActiveShot('S08');
  status.textContent = 'S08 playing';
  const shot = getShot('S08');
  startClock(shot.durationMs);

  const card = label(shot, 's08-card-in');
  const stamp = label(shot, 's08-pass-thunk');

  animate(
    byAnim('s08-card'),
    [
      { opacity: 0, transform: 'translateY(22px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { delay: card.atMs, duration: card.durationMs },
  );
  animate(
    byAnim('s08-pass'),
    [
      { opacity: 0, transform: 'scale(.7) rotate(-5deg)' },
      { opacity: 1, transform: 'scale(1.16) rotate(-7deg)', offset: 0.48 },
      { opacity: 1, transform: 'scale(1) rotate(-5deg)' },
    ],
    { delay: stamp.atMs, duration: stamp.durationMs, easing: 'cubic-bezier(.16,1,.3,1)' },
  );

  finishStatus(shot);
}

function playS10() {
  resetAnimations();
  setActiveShot('S10');
  status.textContent = 'S10 playing';
  const shot = getShot('S10');
  startClock(shot.durationMs);

  const line = label(shot, 's10-main-line-in');
  const stamp = label(shot, 's10-paw-stamp');

  animate(
    byAnim('s10-line'),
    [
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { delay: line.atMs, duration: line.durationMs },
  );
  animate(
    byAnim('s10-stamp'),
    [
      { opacity: 0, transform: 'scale(.58) rotate(-12deg)' },
      { opacity: 1, transform: 'scale(1.14) rotate(-8deg)', offset: 0.46 },
      { opacity: 1, transform: 'scale(1) rotate(-12deg)' },
    ],
    { delay: stamp.atMs, duration: stamp.durationMs, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  animate(byAnim('s10-subline'), [{ opacity: 0 }, { opacity: 1 }], {
    delay: stamp.atMs + 320,
    duration: 320,
  });

  finishStatus(shot);
}

async function playAll() {
  for (const [index, shotId] of sequence.entries()) {
    playById(shotId);
    if (index < sequence.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, getShot(shotId).durationMs + 450));
    }
  }
}

const playMap = {
  S03: playS03,
  S04: playS04,
  S06: playS06,
  S07a: playS07a,
  S08: playS08,
  S10: playS10,
};

function normalizeShotId(value) {
  return sequence.find((shotId) => shotId.toLowerCase() === value?.toLowerCase());
}

function playById(shotId) {
  const play = playMap[shotId];
  if (!play) {
    throw new Error(`No player for shot: ${shotId}`);
  }
  play();
}

controls.addEventListener('click', (event) => {
  const action = event.target?.dataset?.action;
  if (action === 'play-all') {
    void playAll();
  }
  if (action === 'play-s03') {
    playS03();
  }
  if (action === 'play-s04') {
    playS04();
  }
  if (action === 'play-s06') {
    playS06();
  }
  if (action === 'play-s07a') {
    playS07a();
  }
  if (action === 'play-s08') {
    playS08();
  }
  if (action === 'play-s10') {
    playS10();
  }
});

const requestedShot = normalizeShotId(params.get('shot'));
if (requestedShot) {
  playById(requestedShot);
} else {
  playAll();
}
