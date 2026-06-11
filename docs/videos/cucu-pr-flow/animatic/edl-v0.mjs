// Animatic v0 EDL — E lane 真相源（节奏验证用，非最终 EDL schema）
// 镜头顺序/时长 = shot-plan-v0.1.md §2；字幕 = §3（相对本镜头起点的 ms 偏移）
// D 镜头帧从 deterministic-spike export 模式抓取（virtualTimeMs = 抓帧虚拟时间点）
// V 镜头用 placeholder.html 灰卡占位，待 Wave V 素材替换
export const edl = {
  version: 0,
  project: 'cucu-pr-flow',
  fps: 30,
  width: 720,
  height: 1280,
  shots: [
    {
      id: 'S01',
      kind: 'placeholder',
      durationMs: 6000,
      lane: 'V·T1',
      beat: '宪宪门口望眼欲穿 · 复用 Clip 1（待 Landy 提供文件）',
    },
    {
      id: 'S02',
      kind: 'placeholder',
      durationMs: 6000,
      lane: 'V·T3',
      beat: '砚砚向 Landy 开讲标准 PR 流程 · 气场反差',
      subtitles: [{ startMs: 300, endMs: 5700, text: '砚砚：先走标准 PR 流程。' }],
    },
    {
      id: 'S03',
      kind: 'frames',
      durationMs: 4000,
      segments: [
        { virtualTimeMs: 2000, holdMs: 2000 },
        { virtualTimeMs: 3900, holdMs: 2000 },
      ],
    },
    {
      id: 'S04',
      kind: 'frames',
      durationMs: 5000,
      segments: [
        { virtualTimeMs: 600, holdMs: 1000 },
        { virtualTimeMs: 1700, holdMs: 800 },
        { virtualTimeMs: 4500, holdMs: 3200 },
      ],
    },
    {
      id: 'S05',
      kind: 'placeholder',
      durationMs: 6000,
      lane: 'V·半自由',
      beat: 'Landy 笑翻 vs 砚砚僵住转身敲键盘',
      subtitles: [
        { startMs: 200, endMs: 2900, text: 'Landy：加个头像也要跑 CI？！' },
        { startMs: 3100, endMs: 5800, text: '砚砚：图片是二进制文件。' },
      ],
    },
    {
      id: 'S06',
      kind: 'frames',
      durationMs: 4500,
      segments: [
        { virtualTimeMs: 1500, holdMs: 1600 },
        { virtualTimeMs: 2800, holdMs: 1300 },
        { virtualTimeMs: 4400, holdMs: 1600 },
      ],
    },
    {
      id: 'S07a',
      kind: 'frames',
      durationMs: 3000,
      segments: [
        { virtualTimeMs: 1300, holdMs: 1500 },
        { virtualTimeMs: 2900, holdMs: 1500 },
      ],
      subtitles: [{ startMs: 200, endMs: 2800, text: '砚砚（画外）：召唤烁烁喵，视觉验收喵。' }],
    },
    {
      id: 'S07b',
      kind: 'placeholder',
      durationMs: 4500,
      lane: 'V·T1',
      beat: '烁烁优雅登场，认真验收一张头像',
    },
    {
      id: 'S08',
      kind: 'frames',
      durationMs: 3000,
      segments: [
        { virtualTimeMs: 500, holdMs: 650 },
        { virtualTimeMs: 2800, holdMs: 2350 },
      ],
    },
    {
      id: 'S09',
      kind: 'placeholder',
      durationMs: 7000,
      lane: 'V·T3',
      beat: 'Landy 定罪定名醋醋喵，砚砚认栽',
      subtitles: [
        { startMs: 300, endMs: 3200, text: 'Landy：你确定不是醋醋喵？' },
        { startMs: 3500, endMs: 6800, text: '砚砚：证据链很不利于我。' },
      ],
    },
    {
      id: 'S10',
      kind: 'frames',
      durationMs: 5000,
      segments: [
        { virtualTimeMs: 700, holdMs: 900 },
        { virtualTimeMs: 4300, holdMs: 4100 },
      ],
    },
  ],
};

export function totalDurationMs() {
  return edl.shots.reduce((sum, shot) => sum + shot.durationMs, 0);
}
