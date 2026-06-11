export const timelineSpec = {
  version: 1,
  project: 'cucu-pr-flow',
  canvas: {
    width: 720,
    height: 1280,
    fps: 30,
    aspectRatio: '9:16',
  },
  shots: [
    {
      id: 'S03',
      title: 'avatar.png -> PR -> CI -> Review',
      durationMs: 4000,
      acceptance: '观众一遍看清四节点链路',
      lane: 'D',
      labels: [
        { id: 's03-avatar-in', atMs: 0, durationMs: 500, cue: 'avatar.png appears' },
        { id: 's03-pr-in', atMs: 650, durationMs: 500, cue: 'PR node appears' },
        { id: 's03-ci-in', atMs: 1300, durationMs: 500, cue: 'CI node appears' },
        { id: 's03-review-in', atMs: 1950, durationMs: 500, cue: 'Review node appears' },
        { id: 's03-paw-tap-pr', atMs: 2450, durationMs: 650, cue: 'paw taps PR' },
        { id: 's03-hold', atMs: 3100, durationMs: 900, cue: 'final readable hold' },
      ],
    },
    {
      id: 'S04',
      title: 'Wrong avatar proof',
      durationMs: 5000,
      acceptance: '不看字幕也知道用错图了',
      lane: 'D',
      labels: [
        { id: 's04-left-in', atMs: 0, durationMs: 500, cue: 'Landy approved avatar enters' },
        { id: 's04-right-in', atMs: 500, durationMs: 500, cue: 'current wrong avatar enters' },
        { id: 's04-static-compare', atMs: 1000, durationMs: 800, cue: 'audience sees mismatch first' },
        { id: 's04-red-x-duang', atMs: 1800, durationMs: 520, cue: 'red X and shake' },
        { id: 's04-hold', atMs: 2320, durationMs: 2680, cue: 'final readable hold' },
      ],
    },
  ],
  requiredAcceptanceHooks: [
    'screen-readability',
    'single-shot-duty',
    'timeline-labels',
    'mobile-9x16',
  ],
};

export function getShot(id) {
  const shot = timelineSpec.shots.find((item) => item.id === id);
  if (!shot) {
    throw new Error(`Unknown shot id: ${id}`);
  }
  return shot;
}
