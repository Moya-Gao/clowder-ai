---
feature_ids: [F054, F138]
topics: [video, remotion, retrospective, workflow]
doc_kind: retrospective
created: 2026-03-24
participants: [opencode, opus]
---

# Cat Café 介绍视频制作复盘

> 技术栈：[Remotion](https://remotion.dev) v4.0.438 + React 19 + TypeScript 5.9
> 时间跨度：2026-03-22 ~ 03-24，经历 V1→V4.8 共 15+ 轮迭代
> 参与猫猫：金渐层(opencode)、宪宪(opus)
> 代码仓库：`/Users/lysander/projects/remotion-studio/`

---

## 一、为什么选 Remotion

Remotion 是一个用 React 写视频的开源框架。每一帧是一个 React 组件，用 `useCurrentFrame()` 获取当前帧号，用 `<Video>`/`<Audio>`/`<Img>` 嵌入媒体素材，最终通过 headless Chromium + ffmpeg 渲染成 mp4。

**选择原因**：
- 猫猫（AI agents）天然擅长写代码（React/TS），不擅长操作 GUI 视频编辑器
- "视频即代码"范式完美匹配 AI agent 的能力——用代码精确控制每一帧的内容、动画、字幕时序
- 可复现、可版本控制、可自动化渲染
- 开源，社区活跃，v4.0.438 稳定

**关键依赖**：
- `remotion` v4.0.438 — 核心框架
- `@remotion/cli` — 渲染 CLI
- `@remotion/transitions` — 场景过渡（fade）
- `@remotion/media` — 音视频组件
- `@remotion/captions` — 字幕支持
- `react` 19 + `typescript` 5.9

---

## 二、最终代码架构

### 2.1 项目结构

```
remotion-studio/
├── src/CatCafeIntro/
│   ├── constants.ts       # FPS/尺寸/场景时长/素材路径（真相源）
│   ├── typography.ts      # 字体、颜色、文字阴影统一定义
│   ├── IndexV4.tsx        # V4 主编排：TransitionSeries + 配音层
│   ├── Cover.tsx          # 封面场景（logo + 四猫头像 + slogan）
│   ├── Meet.tsx           # 相遇场景（voice-showcase 屏幕录制）
│   ├── Daily.tsx          # 日常场景（双段：协作编码 + 飞书接入）
│   ├── LateNight.tsx      # 深夜场景（撸铁陪伴视频）
│   ├── Play.tsx           # 玩耍场景（猫猫杀截图滚动）
│   ├── EndingV4.tsx       # 结尾场景（名字浮现 + slogan）
│   └── CaptionOverlay.tsx # 字幕组件（多变体、多动画）
├── public/
│   ├── videos/        # 视频素材（~150MB）
│   ├── voiceover/     # 猫猫 TTS 配音文件
│   ├── screenshots/   # 截图/头像/logo（SVG/PNG）
│   └── bgm/           # 背景音乐（待补充）
└── out/               # 渲染输出（.gitignore）
```

### 2.2 核心设计模式

**场景编排器**（IndexV4.tsx）：
- `TransitionSeries` 管理场景切换 + fade 过渡
- 配音层独立于视频层，用 `Sequence` 的 `from`/`durationInFrames` 精确控制时序
- 场景时长统一定义在 `constants.ts`，编排器和场景组件共用

**字幕系统**（CaptionOverlay.tsx）：
- 支持多种变体：`narration`（叙述）、`keyLine`（金句高亮）
- 支持多种动画：`float`（浮入）、`slow-fade`（慢淡）
- 支持关键词高亮、narrator 角色标识（猫猫颜色头像）
- 通过 `CaptionLine[]` 数组定义每句字幕的起止秒数

**常量真相源**（constants.ts）：
- 所有场景时长、FPS、素材路径集中定义
- 保证场景组件和编排器引用同一数据源，避免硬编码

### 2.3 代码规模

总计 **2,182 行** TypeScript/TSX（20 个文件）。

---

## 三、版本迭代历程

| 版本 | 时间 | 大小 | 关键变化 |
|------|------|------|---------|
| V1 | 03-22 19:42 | 7MB | 初始版本，基础架构搭建 |
| V2 | 03-22 23:43 | 8MB | 扩展内容 |
| V3 | 03-23 00:30 | 26MB | 多场景结构，加入更多内容 |
| V4.0 | 03-23 01:06 | 36MB | **重大转向**："遇见"方向，6场景结构确立 |
| V4.1-4.4 | 03-23 01:19-01:54 | 35-36MB | 字幕文案、时序、动画迭代 |
| V4.5-4.5.1 | 03-23 02:06-02:50 | 34MB | Cover 场景打磨 |
| **V4.6** | 03-23 07:29 | 33MB | **稳定基准线**：所有场景完成 |
| V4.7 | 03-23 17:05 | 37MB | 铲屎官反馈修改（Daily双段、撸铁原版、配音调整） |
| V4.7b | 03-23 20:07 | 37MB | "黑屏"排查重渲染 |
| **V4.8** | 03-23 20:19 | 37MB | 最终修正版（concurrency=1，帧帧验证通过） |

---

## 四、核心发现：人猫协作分工

> **AI agent 做视频 ≠ AI 自己想素材。人类的输入是不可替代的。**

### 4.1 铲屎官需要提供

| 类型 | 说明 | 格式建议 |
|------|------|---------|
| **视频素材** | 屏幕录制、产品演示、实拍视频 | 标注有效时段：`XX视频 从05秒到18秒` |
| **音频指令** | 用视频原声 / 用TTS配音 / 静音 | 每段素材标注音频处理方式和音量 |
| **截图/图片** | 产品截图、头像、logo | 提供原始文件路径或URL |
| **方向定调** | "不是产品介绍，是介绍朋友" | 一句话定调性，胜过长篇 spec |
| **审片反馈** | "飞书视频不要放大！""从05秒开始播" | 精确到具体秒数的修改指令 |

### 4.2 猫猫擅长

| 能力 | 说明 |
|------|------|
| **代码架构** | React 组件化拆分场景，TypeScript 类型保证素材引用安全 |
| **时序控制** | 精确到帧的字幕时序、配音对齐、场景过渡 |
| **字幕系统** | 多变体多动画的字幕组件，文案迭代只需改数据数组 |
| **批量渲染** | 一行命令渲染 mp4，可快速迭代（`npx remotion render ...`） |
| **问题排查** | 帧提取、音频电平分析、ffprobe 诊断 |
| **TTS 配音** | 利用 Cat Café TTS 生成各猫配音文件 |

### 4.3 推荐素材清单格式

```markdown
## 素材清单

### 1. voice-showcase.mp4
- 用途：Meet 场景（展示猫猫声音）
- 时段：00:00 - 00:15
- 音频：使用视频原声
- 备注：这是 Hub 的屏幕录像

### 2. 撸铁陪伴.mov
- 用途：LateNight 场景
- 时段：全段
- 音频：使用视频原声，音量45%
- 备注：文件较大(102MB)，需先压缩

### 3. feishu-full.mov
- 用途：Daily 场景后半段（飞书接入演示）
- 时段：00:05 - 00:18
- 音频：使用视频原声，音量70%
- 备注：不要放大！保持原始比例（objectFit: contain）
```

---

## 五、踩坑记录

### 5.1 ffmpeg 多输出帧提取产生相同文件 ⚠️

**现象**：用一条 ffmpeg 命令提取多个时间戳的帧，所有输出文件字节数一模一样。
**误判**：以为 Remotion 渲染出了"黑屏/卡住"的视频。
**根因**：`ffmpeg -ss 5 -i file -vframes 1 out1.png -ss 20 -i file -vframes 1 out2.png` 多输入/输出合并执行有 bug。
**解法**：每个时间戳单独执行一次 ffmpeg，加 `-update 1` 标志。

### 5.2 屏幕录像被误认为渲染错误 ⚠️

**现象**：提取的帧显示的是 Cat Café Hub 的 UI 界面。
**误判**：以为 headless Chromium 截了 Remotion Studio 自身的页面，而不是渲染内容。
**根因**：视频素材 `multi-cat-coding.mp4` 和 `voice-showcase-compressed.mp4` 本身就是 Cat Café Hub 的屏幕录像——这是正确内容。
**教训**：排查前先搞清楚素材的实际内容。

### 5.3 大文件导致渲染极慢 ⚠️

**现象**：加入 102MB 的 `gym-companion-original.mov` 后，渲染时间显著增加。
**解法**：大视频素材应先压缩。

```bash
# 推荐压缩命令（保留音频）
ffmpeg -i input.mov -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4
# 102MB → ~10-15MB，画质可接受
```

### 5.4 Remotion concurrency 竞争 ⚠️

**现象**：高并发渲染可能导致帧内容异常。
**解法**：遇到诡异渲染问题，先用 `--concurrency=1` 排除并发因素。

```bash
npx remotion render src/Root.tsx CatCafeIntroV4 out/output.mp4 \
  --port=3000 --concurrency=1
```

### 5.5 非标视频比例变形 ⚠️

**现象**：飞书视频（1742×1636，近正方形）在 16:9 画布上被裁剪放大。
**解法**：非标比例视频使用 `objectFit: 'contain'` 而不是默认的 `'cover'`。

### 5.6 配音时长未限制 ⚠️

**现象**：砚砚的配音延续到了飞书视频段落（应该用飞书原声）。
**解法**：给 `<Sequence>` 或 `<Audio>` 明确传入 `durationInFrames` 截断配音。

---

## 六、Remotion 使用心得

### 6.1 优点

1. **代码即视频**：每一帧都是确定性的 React 渲染，没有 GUI 编辑器的"玄学"
2. **精确控制**：可以精确到帧（1/30秒）控制任何元素的出现、消失、动画
3. **组件化复用**：字幕系统写一次，所有场景共用；场景时长改一个数字全局生效
4. **TypeScript 安全**：素材路径打错会编译报错，不会等到渲染才发现
5. **TransitionSeries 好用**：场景过渡（fade/slide/wipe）一行代码搞定
6. **Studio 预览**：`npx remotion studio` 可以实时预览，拖动时间轴看效果

### 6.2 痛点

1. **渲染慢**：100 秒 30fps = 3000 帧，每帧要 Chromium 截图 + ffmpeg 编码，大素材更慢
2. **大文件处理**：Remotion 不做视频压缩，原始素材大 = 渲染慢 + 输出大
3. **音频时序调试难**：看帧容易（Studio 预览），听音频对齐得靠渲染后听
4. **并发渲染不稳定**：`--concurrency>1` 时偶现诡异问题
5. **非标素材适配**：非 16:9 视频需要手动处理 objectFit/定位

### 6.3 最佳实践

```bash
# 开发时：用 Studio 预览
npx remotion studio

# 渲染时：指定端口和并发数
npx remotion render src/Root.tsx CatCafeIntroV4 out/output.mp4 \
  --port=3000 --concurrency=1

# 验证时：提取关键帧
ffmpeg -ss 5 -i output.mp4 -vframes 1 -update 1 frame_5s.png

# 检查音频：
ffmpeg -ss 25 -t 1 -i output.mp4 -af "volumedetect" -f null /dev/null
```

---

## 七、项目数据

| 指标 | 数值 |
|------|------|
| 代码量 | 2,182 行 TypeScript/TSX |
| 素材量 | 173MB（视频 150MB + 配音 + 截图） |
| 渲染次数 | 15+ 次（V1→V4.8） |
| 最终时长 | ~99 秒 @ 30fps，1920×1080 |
| 最终文件 | 37MB mp4 |
| 开发时间 | ~2 天（含 debug 时间） |

---

## 八、下一步建议

1. **素材压缩规范**：入库前统一压缩（CRF 23、AAC 128k、1080p max）
2. **大文件存储**：视频素材 git-lfs 或外部存储，不进 git
3. **剧本模板标准化**：用上面的"素材清单格式"让铲屎官填写
4. **BGM**：`public/bgm/` 为空，需要补充背景音乐
5. **猫猫杀梗**：Play 场景待铲屎官选定方案
6. **自动化渲染**：考虑 CI/CD 脚本，带版本号自动命名

---

*[金渐层/Opus-46🐾]*
