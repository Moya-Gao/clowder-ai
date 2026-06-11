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
    {
      id: 'S06',
      title: 'CI Passed -> Review -> Merged',
      durationMs: 4500,
      acceptance: '三连状态卡越来越快的节奏荒谬感成立',
      lane: 'D',
      labels: [
        { id: 's06-ci-card', atMs: 0, durationMs: 1600, cue: 'CI Passed ding' },
        { id: 's06-review-card', atMs: 1600, durationMs: 1300, cue: 'Review approved ding' },
        { id: 's06-merged-card', atMs: 2900, durationMs: 1000, cue: 'Merged ding' },
        { id: 's06-hold', atMs: 3900, durationMs: 600, cue: 'final readable hold' },
      ],
    },
    {
      id: 'S07a',
      title: 'Canceled guard still summons Shuoshuo',
      durationMs: 3000,
      acceptance: '看懂取消了还在召唤',
      lane: 'D',
      labels: [
        { id: 's07a-cancel-stamp', atMs: 0, durationMs: 1000, cue: 'canceled stamp lands' },
        { id: 's07a-comedy-pause', atMs: 1000, durationMs: 500, cue: 'mandatory silent pause' },
        { id: 's07a-shuoshuo-pop', atMs: 1500, durationMs: 560, cue: '@Shuoshuo pops anyway' },
        { id: 's07a-hold', atMs: 2060, durationMs: 940, cue: 'final readable hold' },
      ],
    },
    {
      id: 'S08',
      title: 'Vision guard PASS',
      durationMs: 3000,
      acceptance: 'PASS 对一张头像郑重其事成立',
      lane: 'D',
      labels: [
        { id: 's08-card-in', atMs: 0, durationMs: 600, cue: 'review card enters' },
        { id: 's08-pass-thunk', atMs: 650, durationMs: 500, cue: 'deadpan PASS stamp' },
        { id: 's08-hold', atMs: 1150, durationMs: 1850, cue: 'silent deadpan hold' },
      ],
    },
    {
      id: 'S10',
      title: 'Risk-scaled process end card',
      durationMs: 5000,
      acceptance: '一行主张 + 醋醋喵爪章，可截图传播',
      lane: 'D',
      labels: [
        { id: 's10-main-line-in', atMs: 0, durationMs: 800, cue: 'main claim appears' },
        { id: 's10-paw-stamp', atMs: 900, durationMs: 700, cue: 'Cucu paw stamp lands' },
        { id: 's10-hold', atMs: 1600, durationMs: 3400, cue: 'shareable final hold' },
      ],
    },
  ],
  requiredAcceptanceHooks: [
    'screen-readability',
    'single-shot-duty',
    'timeline-labels',
    'mobile-9x16',
    'stage-only-export',
  ],
};

export function getShot(id) {
  const shot = timelineSpec.shots.find((item) => item.id === id);
  if (!shot) {
    throw new Error(`Unknown shot id: ${id}`);
  }
  return shot;
}
