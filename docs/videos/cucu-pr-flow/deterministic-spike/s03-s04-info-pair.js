import { getShot, timelineSpec } from './timeline-spec.mjs';

const stage = document.querySelector('[data-stage]');
const scenes = [...document.querySelectorAll('[data-shot]')];
const clock = document.querySelector('[data-clock]');
const status = document.querySelector('[data-status]');
const controls = document.querySelector('.control-strip');

let activeAnimations = [];
let clockTimer = null;

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
      { opacity: 0, transform: 'translate(-22px, 34px) rotate(-12deg) scale(.8)' },
      { opacity: 1, transform: 'translate(0, 0) rotate(-12deg) scale(1.05)', offset: 0.42 },
      { opacity: 1, transform: 'translate(8px, 8px) rotate(-18deg) scale(.92)', offset: 0.62 },
      { opacity: 1, transform: 'translate(0, 0) rotate(-12deg) scale(1)' },
    ],
    { delay: tap.atMs, duration: tap.durationMs },
  );

  setTimeout(() => {
    status.textContent = 'S03 hold';
  }, shot.durationMs);
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

  setTimeout(() => {
    status.textContent = 'S04 hold';
  }, shot.durationMs);
}

async function playAll() {
  playS03();
  await new Promise((resolve) => setTimeout(resolve, getShot('S03').durationMs + 450));
  playS04();
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
});

playAll();
