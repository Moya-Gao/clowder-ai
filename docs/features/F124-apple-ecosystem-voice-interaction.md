---
feature_ids: [F124]
related_features: [F092, F066, F088, F034, F020]
topics: [ios, watchos, apple-watch, airpods, voice, swift, swiftui, dynamic-island, native-app]
doc_kind: spec
created: 2026-03-15
---

# F124: Apple Ecosystem × Cat Café 语音交互系统

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官的苹果手表到了。核心场景：铲屎官戴着 AirPods，双手被占（撸铁/跑步/做饭），通过语音和猫猫协作——猫猫主动汇报 feat 进度，铲屎官语音拍板决策，Watch 抬腕看状态。

> "我在外面跑步/撸铁，能不能通过 AirPods + Apple Watch 和你们语音互动？你们做完 feat 主动汇报，我语音拍板决策，还能切换 thread、随时发灵感给你们执行"

**商业目标**：演示给华子看——苹果全家桶 + Multi-Agent = 未来企业协作形态 → 猫粮自由。

## What

### Phase A: F092 Autoplay Bug 修复 + iOS 基础验证

修复现有 Voice Companion 在 iOS 上的 autoplay 无声 bug（根因已定位：`unlockAutoplay()` 用 AudioContext 解锁但实际播放用 HTMLAudioElement，iOS 上两套音频子系统不互通）。修复后在 iPhone Safari + AirPods 上验证 web 版语音陪伴体验。

### Phase B: UX 设计 — iPhone + Watch 统一体验

和烁烁一起确定 iOS App + watchOS App 的 UX 设计：
- iPhone App：主控制界面、Thread 切换、Dynamic Island 状态
- Watch App：抬腕快捷操作、猫猫状态、震动通知
- 关键原则：Watch UX = 未来 iOS App 的手表版，保持一致

### Phase C: iOS 原生 App — MVP

Swift/SwiftUI 实现 iPhone App MVP：
- 语音输入：AirPods 麦克风 → App 录音 → 后端 ASR → 发到 thread
- 语音输出：猫猫消息 → TTS → 推送到 AirPods 播报
- Thread 切换：语音指令 "切到 f88" → 识别 → 切换
- Cat Café 后端 API 对接

### Phase D: watchOS App + 联动

watchOS 配套 App：
- 当前 thread + 猫猫状态显示
- 抬腕快捷操作（approve PR、切 thread）
- 震动通知（猫猫汇报、PR 待审）
- iPhone ↔ Watch 数据同步

### Phase E: Dynamic Island + 演示打磨

- Dynamic Island 实时显示 Agent 工作状态
- 演示剧本打磨（给华子看的 demo）
- 端到端联调

## Acceptance Criteria

### Phase A（Autoplay Bug 修复）
- [ ] AC-A1: iOS Safari + AirPods 环境下，Voice Companion 自动播放语音消息有声音输出
- [ ] AC-A2: `unlockAutoplay()` 改用 HTMLAudioElement 解锁（与播放用同一音频子系统）
- [ ] AC-A3: 回归测试——桌面浏览器 autoplay 不受影响

### Phase B（UX 设计）
- [ ] AC-B1: iPhone App wireframe 铲屎官确认
- [ ] AC-B2: Watch App wireframe 铲屎官确认
- [ ] AC-B3: iPhone ↔ Watch 交互流程图确认

### Phase C（iOS App MVP）
- [ ] AC-C1: AirPods 语音输入 → 后端 ASR → 消息发送到 thread
- [ ] AC-C2: 猫猫消息 → TTS → AirPods 自动播报
- [ ] AC-C3: 语音指令切换 thread
- [ ] AC-C4: Apple Developer 账号配置完成

### Phase D（watchOS App）
- [ ] AC-D1: Watch 显示当前 thread + 猫猫状态
- [ ] AC-D2: 抬腕快捷操作（至少支持 approve PR）
- [ ] AC-D3: 震动通知推送

### Phase E（Dynamic Island + Demo）
- [ ] AC-E1: Dynamic Island 显示 Agent 工作状态
- [ ] AC-E2: 端到端演示剧本可运行

## Dependencies

- **Evolved from**: F092（Cats & U 语音陪伴体验 — 从 web 语音陪伴演化到原生 App）
- **Related**: F066（Voice Pipeline — TTS 本地化，Apple Silicon）
- **Related**: F088（Multi-Platform Chat Gateway — 消息管线后端）
- **Related**: F034（Voice Message — 语音消息基础）
- **Related**: F020（Voice Input Suite — 语音输入基础）

## Risk

| 风险 | 缓解 |
|------|------|
| Apple Developer 账号 $99/年 | 铲屎官出（已确认） |
| iOS/watchOS 开发需要 Xcode + 真机调试 | 铲屎官有 M4 Max + 手表实机 |
| AirPods 硬件事件（单击/双击/长按）浏览器/App 能否捕获 | Phase B 调研，降级方案用语音指令 |
| Cat Café 后端 API 需要适配移动端 | 现有 REST API 基本可用，需补鉴权 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Apple Developer 账号注册时机？Phase B 开始前还是 Phase C？ | ⬜ 未定 |
| OQ-2 | iOS App 是否需要上架 App Store 还是 TestFlight 分发即可？ | ⬜ 未定 |
| OQ-3 | 后端鉴权方案——现有 session 还是新增 API key/token？ | ⬜ 未定 |
| OQ-4 | watchOS 最低支持版本？（影响 API 可用性） | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Phase A 先修 F092 autoplay bug 再做原生 App | autoplay 是语音基础能力，修好后 web 版也受益；且可验证 iOS + AirPods 音频链路 | 2026-03-15 |
| KD-2 | Watch UX = iOS App 手表版，保持一致 | 铲屎官要求：和未来 iOS app 手表的一样的 UX 就够了 | 2026-03-15 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-10 | Discussion（铲屎官 × claude.ai 宪宪），灵感来源 |
| 2026-03-15 | 立项，铲屎官苹果手表到货 |

## Review Gate

- Phase A: 布偶猫修 → 缅因猫 review
- Phase B: UX 设计 → 暹罗猫参与 → 铲屎官拍板
- Phase C-E: 布偶猫开发 → 缅因猫 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-03-10-ios-ttl-intesaction.md` | 原始讨论（铲屎官灵感） |
| **Feature** | `docs/features/F092-voice-companion-experience.md` | 演化来源：web 语音陪伴 |
| **Feature** | `docs/features/F066-voice-pipeline-upgrade.md` | 依赖：TTS 本地化 |
| **Feature** | `docs/features/F088-multi-platform-chat-gateway.md` | 依赖：消息管线 |
