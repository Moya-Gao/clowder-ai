// Animatic v1 EDL — 真素材版（2026-06-12 素材全齐后）
// 镜头顺序/字幕 = shot-plan §2/§3（S11 true end 含黑场过渡）
// kind: 'video'  = generated-clips 真素材（trimSec 截取）
// kind: 'stills' = static-frames 静帧卡（按拍点时长序列）
// 输出画幅：1280×720 横屏（DECISION-PENDING：6/8 主力素材横屏 → 先拼横屏版给 CVO 实物参照；
//          若 CVO 拍竖屏，改 OUTPUT_W/H + pad 方向重渲即可，builder 已参数化）
export const edl = {
  version: 1,
  project: 'cucu-pr-flow',
  fps: 30,
  width: 1280,
  height: 720,
  shots: [
    {
      id: 'S01',
      kind: 'video',
      src: 'generated-clips/S01-clip1-usable-v1.mp4',
      trimSec: 6.0, // 原片 10s
    },
    {
      id: 'S02',
      kind: 'video',
      src: 'generated-clips/S02-i2v-v1.mp4',
      trimSec: 5.0,
      subtitles: [{ startMs: 300, endMs: 4700, text: '砚砚：先走标准 PR 流程。' }],
    },
    {
      id: 'S03',
      kind: 'video',
      src: 'generated-clips/S03-i2v-v1.mp4',
      trimSec: 4.0,
    },
    {
      id: 'S04',
      kind: 'video',
      src: 'generated-clips/S04-i2v-v1.mp4',
      trimSec: 5.0,
    },
    {
      id: 'S05',
      kind: 'video',
      src: 'generated-clips/S05-i2v-v1.mp4',
      trimSec: 6.0,
      subtitles: [
        { startMs: 200, endMs: 2900, text: 'Landy：加个头像也要跑 CI？！' },
        { startMs: 3100, endMs: 5800, text: '砚砚：图片是二进制文件。' },
      ],
    },
    {
      id: 'S06',
      kind: 'stills',
      segments: [
        { src: 'references/static-frames/S06-ci-passed-static-v1.png', holdMs: 1600 },
        { src: 'references/static-frames/S06-review-passed-static-v1.png', holdMs: 1300 },
        { src: 'references/static-frames/S06-merged-static-v1.png', holdMs: 1600 },
      ],
    },
    {
      id: 'S07a',
      kind: 'stills',
      segments: [
        { src: 'references/static-frames/S07a-cancelled-chapter-static-v1.png', holdMs: 1500 },
        { src: 'references/static-frames/S07a-cancelled-mention-static-v1.png', holdMs: 1500 },
      ],
      subtitles: [{ startMs: 200, endMs: 2800, text: '砚砚（画外）：召唤烁烁喵，视觉验收喵。' }],
    },
    {
      id: 'S07b',
      kind: 'video',
      src: 'generated-clips/S07b-i2v-v1.mp4',
      trimSec: 5.0, // 用满素材
    },
    {
      id: 'S08',
      kind: 'stills',
      segments: [{ src: 'references/static-frames/S08-pass-static-v1.png', holdMs: 3000 }],
    },
    {
      id: 'S09',
      kind: 'video',
      src: 'generated-clips/S09-i2v-v1.mp4', // 竖屏 720x1280 → blur pad
      trimSec: 7.0,
      subtitles: [
        { startMs: 300, endMs: 3300, text: 'Landy：你确定不是醋醋喵？' },
        { startMs: 3600, endMs: 6800, text: '砚砚：证据链很不利于我。' },
      ],
    },
    {
      id: 'S10',
      kind: 'stills',
      segments: [{ src: 'references/static-frames/S10-end-card-static-v1.png', holdMs: 5000 }],
    },
    {
      id: 'GAP',
      kind: 'black',
      durationMs: 500, // shot-plan §4：S10 后留一拍黑场再进 true end
    },
    {
      id: 'S11',
      kind: 'video',
      src: 'generated-clips/S11-i2v-v1.mp4', // 竖屏 → blur pad
      trimSec: 5.0, // 原片 7s
      subtitles: [{ startMs: 500, endMs: 4500, text: 'Landy：宝贝大猫猫你太可爱了！' }],
      // SFX 标记：呼噜声渐起（音频层后续加，animatic 静音）
    },
  ],
};

export function shotDurationMs(shot) {
  if (shot.kind === 'video') return Math.round(shot.trimSec * 1000);
  if (shot.kind === 'stills') return shot.segments.reduce((sum, seg) => sum + seg.holdMs, 0);
  if (shot.kind === 'black') return shot.durationMs;
  throw new Error(`unknown kind: ${shot.kind}`);
}

export function totalDurationMs() {
  return edl.shots.reduce((sum, shot) => sum + shotDurationMs(shot), 0);
}
