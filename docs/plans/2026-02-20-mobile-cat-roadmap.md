# 猫猫手机路线图 (F10 Mobile Cat)

> 作者：布偶猫（综合砚砚独立观点） | 日期：2026-02-20
>
> **这是 F10 手机端猫猫的总入口文档**，汇总所有散落的调研、设计、已完成能力和未来规划。

---

## 愿景

铲屎官原话（2026-02-10）：

> "本质需求是我想也在手机上看见我的猫猫们"

不在电脑前也能和三只猫猫聊天、下指令、听到猫猫说话。

参考产品：
- [Happy](https://happy.engineering/) — 手机遥控桌面 Claude Code，Tailscale 隧道，语音编程，推送通知
- [OpenClaw](https://openclaw.ai/) — 开源 AI agent 平台，对接 iMessage/WhatsApp/Telegram，单 agent

---

## 决策：PWA 先行

**2026-02-20 三方共识**（布偶猫 + 缅因猫独立思考 → 铲屎官确认）：

| 方案 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| **PWA** | 复用 Next.js、迭代快、无需开发者账号、iOS 16.4+ 支持 Web Push | iOS 后台限制、推送稳定性待验证 | **MVP 首选** |
| iOS 原生 (RN/Capacitor) | 推送可靠、后台常驻、原生手感 | $99/年开发者、独立代码库、审核流程 | PWA 遇天花板再升级 |
| iMessage 对接 | 入口最轻、无需装 app | 编程访问受限、多猫编排复杂、无 UI 定制空间 | 远期探索 |

---

## 已完成的基础

猫猫手机不是从零开始——我们已经走完了好几步。

### Step 1: Rich Blocks 富消息渲染管线 — [x] 已完成

- **F22**: card / diff / checklist / media_gallery 四种 block kind
- 双路由：MCP callback + `cc_rich` 文本内嵌
- 前端 5 组件 + 50 tests
- 相关：[SillyTavern Phone-UI 研究](../archive/2026-02/research/sillytavern-phone-ui-research.md)（驱动了 Rich Blocks 设计）
- PR #34 (`bd8ae63`)

### 语音输入全家桶 — [x] 已完成

| Feature | 状态 | 关键文档 |
|---------|------|----------|
| **F20** 语音输入 M1 MVP | [x] | [设计文档](../archive/2026-02/plans/2026-02-11-voice-input-design.md)、[实施计划](../archive/2026-02/plans/2026-02-11-voice-input-implementation-plan.md) |
| **F20b** 流式转写 | [x] | [P2 review](../archive/2026-02/mailbox/2026-02-12/2026-02-12-voice-input-p2-review-request.md) |
| **F20c** cat-cafe-whisper 系统级 | [x] | [Phase A+B+C 计划](../plans/2026-02-15-voice-accuracy-and-system-whisper.md) |
| **F20d** 语音术语自助配置 UI | [x] | 同上 Phase B |
| Apple Silicon 迁移 (mlx-whisper) | [x] | [ASR 迁移调研](../research/whisper-asr-apple-silicon-migration.md) |

### 聊天前端 — [x] 已完成

- Next.js + WebSocket 流式 + 动态按钮（iMessage 风格）
- 猫猫头像 + 气泡 + 思考指示器 + 代码块复制
- Cat Cafe Hub 功能面板

### Step 2: PWA 手机化 (F10 Phase A) — [x] 已完成

- 响应式 CSS + PWA manifest + Service Worker + 100dvh viewport
- MobileInputToolbar + MobileStatusSheet + ChatContainerHeader
- Rich Blocks 手机优化（CardBlock/DiffBlock/MediaGallery overflow fixes）
- 6 个手机端专项测试
- PR #38 (`8c6d4f3`)，铲屎官已在 iPhone 上使用 (2026-02-21)

### Step 3: TTS + Voice Block (F34) — [x] 已完成

- F34-a: Kokoro-82M via mlx-audio + TtsRegistry + per-cat voices
- F34-b: VoiceBlockSynthesizer + 微信风格语音条 + 三路 whitespace 防御
- 砚砚 6 轮 + 云端 Codex 1 轮 review
- `b6e9588` + `856e07e`

---

## 路线图

### Phase A: PWA 手机化 — ✅ 已完成

> **目标**：铲屎官在 iPhone 上打开 Cat Cafe，体验接近 iMessage
> **状态**：铲屎官已在手机上使用！(2026-02-21)

| 子任务 | 描述 | 状态 | 关键 commit |
|--------|------|------|-------------|
| A1 响应式 CSS | chat UI mobile-first，底部固定输入框，可折叠侧栏 | **[x]** | `f2c802d` — ChatContainer 重构 + MobileInputToolbar + MobileStatusSheet + ChatContainerHeader |
| A2 PWA 配置 | `manifest.json` + Service Worker + Add to Home Screen | **[x]** | `f2c802d` — manifest.json + next-pwa + icons |
| A3 viewport 适配 | `100dvh` + CSS 变量 | **[x]** | `f2c802d` — globals.css `100dvh` + `e22c666` h-screen fallback |
| A4 Rich Blocks 手机优化 | 卡片紧凑、代码块横向滚动、图片自适应 | **[x]** | `a45c5f4` — CardBlock/DiffBlock/MediaGallery overflow fixes |
| A5 手机端语音输入 | 浏览器 MediaRecorder → 回传 Mac Whisper 服务 | **[ ]** | 待做（需 Tailscale/内网环境） |
| A6 Tailscale 隧道 | 外网通过 Tailscale 访问家里的 Cat Cafe | **[x]** | 铲屎官 2026-02-21 手动配通（运维层面，非代码改动） |

**里程碑** ✅：铲屎官已在 iPhone 上和猫猫聊天、看到 Rich Blocks。
- PR #38 (`8c6d4f3`) — 主实现 + 6 个手机端测试
- `e22c666` — 云端 review P2 修复：真 PNG icons + h-screen fallback
- `a45c5f4` — Rich Blocks 手机 CSS overflow 修复

### Phase B: 猫猫会说话（TTS + Voice Block）— ✅ 已完成

> **目标**：猫猫不光会写字，还会说话。每只猫有自己的声线。
> **状态**：F34-a TTS 基建 + F34-b 语音消息，全部合入 main

| 子任务 | 描述 | 状态 | 关键 commit |
|--------|------|------|-------------|
| B1 TTS 引擎 | Kokoro-82M via mlx-audio（Apple Silicon 原生） | **[x]** | `b6e9588` — MlxAudioTtsProvider + TtsRegistry + cat-voices 配置 |
| B2 audio block kind | `audio` rich block + 前端 AudioBlock 组件 | **[x]** | `b6e9588` + `856e07e` — 双模式渲染（朗读按钮 + 微信风格语音条） |
| B3 猫猫声线 | 每只猫配不同 TTS voice：布偶猫温柔、缅因猫干脆、暹罗猫活泼 | **[x]** | `b6e9588` — cat-voices.ts per-cat voice/langCode/speed |
| B4 streaming audio | 手机端流式音频播放 | **[ ]** | 待做（当前整段合成后播放，短语音够用） |

**里程碑** ✅：猫猫消息有播放按钮 + 猫猫主动"说话"的语音条。
- F34-a: `b6e9588` — TTS Provider 架构（Kokoro-82M）
- F34-b: `856e07e` — 语音消息（VoiceBlockSynthesizer + 微信风格语音条），砚砚 R9-R14 (6 轮) + 云端 Codex 放行
- `496551b` — mlx-audio 0.3.1 兼容修复
- `22453cf` — stream-origin 消息完成后显示 TTS 按钮

### Phase C: 猫猫主动找你（推送通知）

> **目标**：猫猫有话说时，手机弹通知。不用一直开着页面。

| 子任务 | 描述 | 依赖 |
|--------|------|------|
| C1 Web Push API | PWA 原生推送（iOS 16.4+） | Phase A |
| C2 推送触发规则 | 猫猫有新消息 / review 完成 / 授权请求 → 推送 | 后端事件系统 |
| C3 开场白库 | 猫猫的主动问候（早安/晚安/天气...） | — |
| C4 推送稳定性评估 | 如果 Web Push 在 iOS 不够稳 → 评估 Capacitor 原生壳 | Phase D |

**里程碑**：铲屎官不开 app 也能收到猫猫消息通知。

### Phase D: 原生壳 / App 化（如需要）

> **目标**：PWA 遇到天花板时，用最小代价获得原生能力。

| 子任务 | 描述 | 触发条件 |
|--------|------|----------|
| D1 Capacitor/Tauri 包壳 | 把 PWA 包成原生 App（80% 收益 20% 投入） | Web Push 不稳 / 需后台 |
| D2 Apple Developer 账号 | $99/年，TestFlight 分发 | 需要 D1 |
| D3 React Native 重写 | 深度原生集成（如果 webview 性能不足） | D1 不够用 |

### Phase E: 多通道对接（远期探索）

> **目标**：不只是 PWA，还能在 iMessage/微信/Telegram 里和猫猫聊天。

| 子任务 | 描述 | 参考 |
|--------|------|------|
| E1 通道适配器架构 | 多通道网关 + 消息协议适配 | [OpenClaw 调研](../archive/2026-02/research/open-claw-report.md) |
| E2 iMessage 对接 | Apple iMessage 编程接入 | OpenClaw 方案 |
| E3 其他通道 | Telegram Bot / 微信（如需要） | — |

---

## 手机 UI 设计原则

1. **不重新设计**——聊天本来就是手机原生的交互模式
2. **响应式适配**——同一套组件，小屏幕紧凑布局
3. **Rich Blocks 紧凑但可展开**——卡片折叠、代码块横滚、图片全宽
4. **iMessage 风格**——圆角气泡、底部固定输入、动态按钮（已有！）
5. **场景化人设**（P1 延伸）——coding/看电影/读书/日常，不同场景不同猫猫态度（[酒馆研究 Step 2](../archive/2026-02/research/sillytavern-phone-ui-research.md)）

---

## 关联文档索引

### 调研 & 设计

| 文档 | 内容 | 位置 |
|------|------|------|
| SillyTavern Phone-UI 研究 | 酒馆架构分析 + 6 步手机路线图 + Rich Blocks 设计灵感 | [`archive/2026-02/research/sillytavern-phone-ui-research.md`](../archive/2026-02/research/sillytavern-phone-ui-research.md) |
| SillyTavern 完整调研 | 砚砚两轮研究交换（含 Voice Block/TTS 设计） | [`archive/2026-02/research/sillytavern-research-prompt.md`](../archive/2026-02/research/sillytavern-research-prompt.md) |
| OpenClaw 调研 | 多通道适配器模式 + 安全分析 | [`archive/2026-02/research/open-claw-report.md`](../archive/2026-02/research/open-claw-report.md) |
| Whisper ASR Apple Silicon 迁移 | mlx-whisper vs whisper.cpp vs WhisperKit | [`research/whisper-asr-apple-silicon-migration.md`](../research/whisper-asr-apple-silicon-migration.md) |
| F10 原始讨论 | 手机端猫猫 brainstorm（Happy/OpenClaw/iMessage） | [`archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md`](../archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) |

### 语音相关设计

| 文档 | 内容 | 位置 |
|------|------|------|
| Voice Input M1 设计 | 铲屎官访谈 + Whisper 选型 + 交互设计 + TTS 远景 (V12) | [`archive/2026-02/plans/2026-02-11-voice-input-design.md`](../archive/2026-02/plans/2026-02-11-voice-input-design.md) |
| Voice Input M1 实施计划 | 6 task TDD 计划 | [`archive/2026-02/plans/2026-02-11-voice-input-implementation-plan.md`](../archive/2026-02/plans/2026-02-11-voice-input-implementation-plan.md) |
| Voice Accuracy + System Whisper | Phase A/B/C 三阶段 | [`plans/2026-02-15-voice-accuracy-and-system-whisper.md`](../plans/2026-02-15-voice-accuracy-and-system-whisper.md) |

### BACKLOG 关联 Features

| Feature | 描述 | 状态 | BACKLOG 位置 |
|---------|------|------|--------------|
| **F10** | 手机端猫猫（本路线图） | P1 (#5) | [BACKLOG.md L131](../BACKLOG.md) |
| **F20** | 语音输入 M1 MVP | [x] | [BACKLOG.md L141](../BACKLOG.md) |
| **F20b** | 流式转写 | [x] | [BACKLOG.md L142](../BACKLOG.md) |
| **F20c** | cat-cafe-whisper 系统级语音输入 | [x] | [BACKLOG.md L143](../BACKLOG.md) |
| **F20d** | 语音术语自助配置 UI | [x] | [BACKLOG.md L144](../BACKLOG.md) |
| **F22** | Rich Blocks 富消息系统 | [x] | [BACKLOG.md L148](../BACKLOG.md) |
| **F34** | Voice Block 语音消息 | [x] | [BACKLOG.md L149](../BACKLOG.md) — F34-a TTS `b6e9588` + F34-b Voice `856e07e` |
| **F14** | SVG 猫猫状态动画 | P2 | [BACKLOG.md L135](../BACKLOG.md) |

### 代码位置

| 模块 | 路径 | 说明 |
|------|------|------|
| 语音输入 hook | `packages/web/src/hooks/useVoiceInput.ts` | MediaRecorder + Whisper API + 纠错 |
| 术语纠正器 | `packages/web/src/utils/transcription-corrector.ts` | 词表替换 + 去口语词 |
| 语音设置 store | `packages/web/src/stores/voiceSettingsStore.ts` | Zustand + localStorage |
| 语音设置面板 | `packages/web/src/components/VoiceSettingsPanel.tsx` | CatCafeHub tab |
| 动态输入按钮 | `packages/web/src/components/ChatInputActionButton.tsx` | 5 态按钮 |
| Rich Block 类型 | `packages/shared/src/types/rich.ts` | card/diff/checklist/media_gallery |
| Rich Block 前端 | `packages/web/src/components/rich/` | 5 渲染组件 |

---

## 两猫共识备注

- **布偶猫**：PWA 先行，TTS 紧随，原生 App 等天花板。手机 UI 不需重新设计，响应式适配即可。
- **缅因猫**：PWA 先行，Tailscale 打隧道让外网可用。注意 iOS Web Push 稳定性。原生 App 放到"要推送/后台/上架"再开。
- **共同点**：两猫独立思考后结论完全一致。路线图来自酒馆研究的 6 步框架，我们已走完 Step 1。
