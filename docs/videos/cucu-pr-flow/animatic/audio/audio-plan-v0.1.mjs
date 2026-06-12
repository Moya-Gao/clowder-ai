import { totalDurationMs } from '../edl-v1.mjs';

export const audioPlan = {
  version: 'v0.1',
  sampleRate: 48000,
  durationSec: totalDurationMs() / 1000,
  apiUrl: process.env.CAT_CAFE_API_URL ?? 'http://localhost:3002',
  userId: process.env.CAT_CAFE_USER_ID ?? 'default-user',
  voiceCatId: 'codex',
  voiceCues: [
    {
      id: 'yy-01-not-jealous',
      startSec: 23.05,
      text: '我没有吃醋。我只是严格遵守流程。',
    },
    {
      id: 'yy-02-process-justice',
      startSec: 33.42,
      text: '流程正义，必须完整。',
    },
    {
      id: 'yy-03-still-confirm',
      startSec: 38.15,
      text: '取消了，也要确认。',
    },
    {
      id: 'yy-04-evidence-chain',
      startSec: 56.25,
      text: '证据链，不能这样解释。',
    },
  ],
  sfxCues: [
    { id: 'opening-ding', kind: 'ding', startSec: 2.6 },
    { id: 'red-cross-duang', kind: 'thump', startSec: 22.92 },
    { id: 'review-burst', kind: 'machineTicks', startSec: 33.25, count: 12, intervalSec: 0.22 },
    { id: 'cancel-pop', kind: 'pop', startSec: 38.62 },
    { id: 'summon-pop', kind: 'pop', startSec: 40.05 },
    { id: 'verdict-hit', kind: 'thump', startSec: 49.08 },
    { id: 'true-end-purr', kind: 'purr', startSec: 61.55, durationSec: 4.25 },
  ],
};
