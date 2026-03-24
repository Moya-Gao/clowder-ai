---
feature_ids: [F138]
related_features: [F054, F093]
topics: [video, remotion, waoowaoo, bilibili, tutorial, content-pipeline]
doc_kind: spec
created: 2026-03-24
---

# F138: Cat Café Video Studio — AI 视频制作管线

> **Status**: spec | **Owner**: 金渐层 | **Priority**: P1

## Why

> "来吧猫猫 立项吧！link waoowaoo 和 Remotion，我们的第一个目标就是把我们的做出我们的 bilibili 的视频？比如先把我们的教程做成视频？"
> — 铲屎官，2026-03-24

Cat Café 需要**系统化的视频制作能力**，不再是一次性手搓 Remotion 代码。目标：

1. **把教程做成 B 站视频**——Cat Café 的 setup guide、bootcamp 流程、功能演示都应该有视频版
2. **重构现有介绍视频**——V4.8 是手动分镜 + 手写代码，学习 waoowaoo 后应该能更自动化
3. **建立可复用的视频制作管线**——铲屎官给素材+脚本，猫猫自动排版渲染

### 现状

- **已有**：`/Users/lysander/projects/remotion-studio/` — 2,182 行 Remotion 代码，15+ 轮迭代经验
- **已有**：`docs/videos/cat-cafe-intro/` — 分镜脚本 + 素材索引 + 制作复盘
- **已有**：猫猫 TTS 声线（宪宪/砚砚/烁烁，F066/F103）
- **缺失**：没有自动化流水线，每次做视频都是从零手写场景组件
- **缺失**：没有 AI 辅助分镜/图片生成/角色一致性
- **缺失**：没有 BGM 管理、没有 B 站发布能力

### 参考项目

**[waoowaoo](https://github.com/saturndec/waoowaoo)**（10.2k stars）— AI 影视全流程生产平台：
- 技术栈：Next.js 15 + Remotion v4 + BullMQ + Prisma + fal.ai
- 核心流程：文本 → AI 分镜 → AI 图片生成 → AI 配音 → Remotion 视频合成
- 我们可学习的：Prompt 工程（角色一致性）、BullMQ 任务编排、video-editor 前端组件
- ⚠️ 无 License，只能作为参考架构，不能直接复制代码

## What

### Phase A: 学习 + 基础设施（调研 + 工具链搭建）

1. **深度调研 waoowaoo**
   - 分析 `lib/prompts/` 的提示词工程（角色一致性、分镜生成）
   - 分析 `src/features/video-editor/` 的前端编辑器模式
   - 分析 BullMQ 任务编排模式
   - 输出：调研报告 `docs/research/waoowaoo-deep-dive.md`

2. **素材管理规范化**
   - 建立素材压缩标准（CRF 23、AAC 128k、1080p max）
   - 大文件存储方案（git-lfs 或 external）
   - 素材清单模板标准化

3. **Remotion 项目重构**
   - 从"一次性 demo"重构为"可复用模板库"
   - 场景组件抽象化（Cover/Content/Transition/Ending 模板）
   - 字幕系统完善（支持从 SRT/JSON 导入）

### Phase B: 教程视频制作

1. **确定教程目录**
   - Cat Café 安装教程
   - 猫猫训练营流程演示
   - 功能亮点 showcase（语音、狼人杀、协作编码等）

2. **分镜脚本模板**
   - 标准化"素材清单"格式（铲屎官填写 → 猫猫解析）
   - 每个教程一个 `storyboard.json`

3. **批量渲染 + B 站发布**
   - 渲染脚本自动化（版本号、分辨率、压缩）
   - B 站 MCP 调研（关联 F054 Phase 1）

### Phase C: AI 辅助升级（参考 waoowaoo）

1. **AI 分镜生成**
   - 从文本描述自动生成 `storyboard.json`
   - 参考 waoowaoo 的 prompt 模板

2. **AI 图片生成**（如需要）
   - 角色一致性图片生成
   - 场景插画生成

3. **自动化管线**
   - 铲屎官给素材包 + 一段话描述 → 猫猫自动出视频
   - 可选：BullMQ 异步任务队列

## Acceptance Criteria

### Phase A（学习 + 基础设施）
- [ ] AC-A1: waoowaoo 深度调研报告完成，含可借鉴点和不适用点分析
- [ ] AC-A2: 素材管理规范文档 + 压缩脚本可用
- [ ] AC-A3: Remotion 项目重构为模板库，至少 3 个可复用场景模板
- [ ] AC-A4: 字幕系统支持从 JSON 数据导入

### Phase B（教程视频制作）
- [ ] AC-B1: 至少 1 个 Cat Café 教程视频上传 B 站
- [ ] AC-B2: 分镜脚本模板 + 素材清单模板可用
- [ ] AC-B3: 渲染脚本一行命令输出带版本号的 mp4

### Phase C（AI 辅助升级）
- [ ] AC-C1: 从文本描述生成分镜脚本（JSON 格式）
- [ ] AC-C2: 端到端演示：一段话描述 → 自动视频

## Dependencies

- **Evolved from**: F054（HCI 预热基础设施 — B 站 MCP 调研在 F054 Phase 1）
- **Related**: F093（Cats & U 世界引擎 — 介绍视频的创意方向）
- **Related**: F066/F103（Voice Pipeline / Per-Cat Voice Identity — TTS 配音能力）
- **External**: [waoowaoo](https://github.com/saturndec/waoowaoo)（参考架构，无 License，仅学习）

## Risk

| 风险 | 缓解 |
|------|------|
| waoowaoo 无 License，代码不能直接用 | 只学习架构思路和 prompt 模板，自己实现 |
| 大视频素材导致 git 仓库膨胀 | Phase A 就解决存储方案（git-lfs / external） |
| B 站 API 限制 | Phase B 先手动上传，后续 MCP 自动化 |
| AI 生成图片质量不稳定 | Phase C 为可选，教程视频优先用屏幕录制 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Remotion 项目放在 cat-cafe monorepo 里还是独立仓库？ | ⬜ 未定 |
| OQ-2 | B 站账号用铲屎官个人号还是新建？ | ⬜ 未定 |
| OQ-3 | 教程视频用中文还是中英双语？ | ⬜ 未定 |
| OQ-4 | 是否需要 BGM 生成能力（AI Music）？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | waoowaoo 仅作参考架构，不 fork/复制代码 | 无 License = all rights reserved | 2026-03-24 |
| KD-2 | Phase A 先重构现有 Remotion 代码，再考虑 AI 辅助 | 基础不牢地动山摇 | 2026-03-24 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-22 | 介绍视频 V1 首次制作（Remotion 从零搭建） |
| 2026-03-24 | 介绍视频 V4.8 完成 + 制作复盘 |
| 2026-03-24 | waoowaoo 调研完成 |
| 2026-03-24 | F138 立项 |

## Links

- [介绍视频分镜脚本](../videos/cat-cafe-intro/storyboard.md)
- [介绍视频制作复盘](../videos/cat-cafe-intro/retrospective.md)
- [介绍视频素材索引](../videos/cat-cafe-intro/references.md)
- [waoowaoo GitHub](https://github.com/saturndec/waoowaoo)
- [F054 HCI 预热基础设施](./F054-hci-preheat-infra.md)
- [F093 Cats & U 世界引擎](./F093-cats-and-u-world-engine.md)
- [Remotion 官方文档](https://www.remotion.dev/docs)
