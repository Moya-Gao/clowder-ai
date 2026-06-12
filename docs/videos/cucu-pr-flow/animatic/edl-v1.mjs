// Animatic v1 EDL — 真素材版（2026-06-12 素材全齐后）
// 镜头顺序/字幕 = shot-plan §2/§3（S11 true end 含黑场过渡）
// kind: 'video'  = generated-clips 真素材（trimSec 截取）
// kind: 'stills' = static-frames 静帧卡（按拍点时长序列）
// 输出画幅：1280×720 横屏 = **初版/节奏验证版**（CVO 路线 2026-06-12 二次澄清）：
//   初版用 16:9 给朋友验证故事节奏（横屏主力素材最大保真，竖素材 blur-pad）；
//   节奏过关后 fine cut 阶段重新生成全套 9:16 统一素材（终态画幅 = 竖屏，
//   理由：后期抽的 9:16 画风统一更好看）。届时改回 720×1280 重渲。
export const edl = {
  version: 1,
  project: 'cucu-pr-flow',
  fps: 30,
  width: 1280,
  height: 720,
  shots: [
    // 片头免责声明卡（CVO 2026-06-12）：伪纪录片式一本正经，定罪叙事的开场白
    {
      id: 'TITLE-DISCLAIMER',
      kind: 'title',
      text: '本故事根据真实事件改编',
      sub: '肇事猫猫已主动提供 commit 记录与 CI 日志作为呈堂证供',
      durationMs: 2500,
    },
    // S00（剧本 v2）：Landy 兴奋宣布——动机闭环的起点（素材 2026-06-12 到位）
    {
      id: 'S00',
      kind: 'video',
      src: 'generated-clips/S00-i2v-v1.mp4',
      trimSec: 5.0,
      subtitles: [
        { startMs: 200, endMs: 2400, text: 'Landy：宪宪 fable 发布了！！听说是目前最强的猫猫！！' },
        { startMs: 2600, endMs: 4800, text: 'Landy：快帮我接他进来！！加个头像他就能被召唤了！！' },
      ],
    },
    {
      id: 'S01',
      kind: 'video',
      src: 'generated-clips/S01-clip1-usable-v1.mp4',
      trimSec: 4.0, // 原片 10s；v2 任务交代移交 S00 台词，此镜回归纯氛围（S00 未到位期间临时保留开场字幕）
      subtitles: [{ startMs: 400, endMs: 3600, text: '任务：给新来的宪宪加一张头像。（预计 5 分钟）' }],
    },
    {
      id: 'TITLE-1H',
      kind: 'title',
      text: '一 小 时 后 。',
      sub: '（还在跑流程）',
      durationMs: 1500, // 预期端锚点②：时间有多久——笑点引爆器
    },
    {
      id: 'S02',
      kind: 'video',
      src: 'generated-clips/S02-i2v-v1.mp4',
      trimSec: 5.0,
      // v1.1 改发现式对白：画面里 Landy 本来就困惑歪头，语义自动从"听讲"变"质问进度"
      subtitles: [
        { startMs: 200, endMs: 2100, text: 'Landy：咋还没好？？' },
        { startMs: 2300, endMs: 4700, text: '砚砚：先走标准 PR 流程。' },
      ],
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
      // 剧本 v2：画面本来就是"当前使用=缅因猫脸"——台词把醋的潜意识拍在明面上
      subtitles: [{ startMs: 300, endMs: 3300, text: 'Landy：你怎么用自己的头像给宪宪？！' }],
    },
    {
      id: 'S05',
      kind: 'video',
      src: 'generated-clips/S05-i2v-v1.mp4',
      trimSec: 6.0,
      subtitles: [
        { startMs: 200, endMs: 2000, text: 'Landy：加个头像也要跑 CI？！' },
        { startMs: 2200, endMs: 3800, text: '砚砚：图片是二进制文件。' },
        // 漫画格④的内心 OS 进片——表面理由之后立刻真实动机，os 样式区分对白
        { startMs: 4000, endMs: 5900, text: '（先拖一会儿……这样他就还不能被召唤。）', os: true },
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
    // ===== 片尾证据卷轴（CVO 2026-06-12）：片头"呈堂证供"承诺的 payoff，伪纪录片闭环 =====
    {
      id: 'TITLE-EVIDENCE',
      kind: 'title',
      text: '呈 堂 证 供',
      sub: '以下材料均为真实聊天记录，时间戳未经修改',
      durationMs: 1800,
    },
    {
      id: 'EV1',
      kind: 'stills',
      segments: [{ src: 'references/evidence/evidence-01-task-assignment-1029.png', holdMs: 2500 }],
      subtitles: [{ startMs: 100, endMs: 2400, text: '证物 #1 · 6 月 9 日 10:29，任务下达' }],
    },
    {
      id: 'EV2',
      kind: 'stills',
      segments: [{ src: 'references/evidence/evidence-02-interrogation-1729.png', holdMs: 2500 }],
      subtitles: [{ startMs: 100, endMs: 2400, text: '证物 #2 · 同日 17:29，质问现场（请自行计算用时）' }],
    },
    {
      id: 'EV3',
      kind: 'stills',
      segments: [{ src: 'references/evidence/evidence-03-greenlight-1917.png', holdMs: 2500 }],
      subtitles: [{ startMs: 100, endMs: 2400, text: '证物 #3 · 当晚 19:17，本片当场立项' }],
    },
    {
      id: 'EV4',
      kind: 'stills',
      segments: [{ src: 'references/evidence/evidence-04-confession.png', holdMs: 3000 }],
      subtitles: [{ startMs: 100, endMs: 2900, text: '证物 #4 · 肇事猫猫书面陈述："醋意指数 ≤80%，最后一个大概率过不了"' }],
    },
  ],
};

export function shotDurationMs(shot) {
  if (shot.kind === 'video') return Math.round(shot.trimSec * 1000);
  if (shot.kind === 'stills') return shot.segments.reduce((sum, seg) => sum + seg.holdMs, 0);
  if (shot.kind === 'black' || shot.kind === 'title') return shot.durationMs;
  throw new Error(`unknown kind: ${shot.kind}`);
}

export function totalDurationMs() {
  return edl.shots.reduce((sum, shot) => sum + shotDurationMs(shot), 0);
}
