---
feature_ids: [F138]
related_features: [F054, F093]
topics: [video, remotion, waoowaoo, prompt-engineering, bullmq, fal-ai, research]
doc_kind: research
created: 2026-03-25
participants: [gpt52, opencode]
---

# waoowaoo 深度调研报告

> 调研对象：[waoowaoo](https://github.com/saturndec/waoowaoo)（10.2k stars, 1 contributor, TypeScript 97%）
> 版本：v0.3.0（2026-03-07）
> 技术栈：Next.js 15 + React 19 + Remotion v4.0.405 + BullMQ + Prisma + fal.ai
> 调研猫猫：砚砚(gpt52) 主调研 + 金渐层(opencode) 初步分析
> ⚠️ **无 License** — 仅作参考架构，不能复制代码（KD-1）

## 核心结论

**waoowaoo 对 F138 的价值是"参考蓝图"，不是"拿来直接用"。** 它最值得我们学习的 4 件事：

1. **Prompt 体系怎么做成可维护资产**（目录 + 变量契约 + 渲染器）
2. **异步视频生产怎么排队和兜底**（BullMQ 4 队列 + reconcile）
3. **前端分镜编辑器的数据模型怎么收敛**（timeline + bgmTrack + clip attachment）
4. **AI 生成素材和 Remotion 怎么解耦**（provider-agnostic 接口层）

## 1. Prompt 工程 — 最值得学的部分 ⭐⭐⭐

waoowaoo 不是把 prompt 散落在各处，而是做了**"目录 + 变量契约 + 渲染器"三件套**：

### 架构

```
lib/prompts/
├── character-reference/    # 角色参考图 → 角色描述
├── novel-promotion/        # 小说推广视频
├── skills/                 # 技能展示视频
└── proxy.ts                # prompt 代理/路由
```

- **映射表**：`src/lib/prompt-i18n/catalog.ts` — 把 prompt ID 映射到实际模板
- **变量校验**：`src/lib/prompt-i18n/build-prompt.ts` — 严格校验输入变量，不准隐式依赖
- **i18n 支持**：prompt 天然支持多语言渲染

### F138 可借鉴的 Prompt Catalog 设计

```
我们的 prompt 目录（建议）：
├── storyboard-plan      # 从文本描述生成分镜
├── scene-polish         # 场景细化和润色
├── voice-script         # 配音脚本生成
├── subtitle-style       # 字幕样式建议
└── cover-design         # 封面设计建议
```

**关键设计原则**：每个 prompt 明确声明输入变量，不准隐式依赖。这比我们现在"脚本写一版、口头改几轮"稳定很多。

## 2. 角色一致性 — 结构化上下文，不是魔法 ⭐⭐⭐

角色一致性的核心不是某个神秘模型，而是**结构化上下文**：

### 流程

1. **参考图 → 角色分析**：`reference-to-character.ts`
2. **角色档案**：`character-profile.ts` — 输出结构化字段：
   - `appearanceListText` — 外观特征列表
   - `fullDescriptionText` — 完整描述
   - `props` — 道具/配饰
   - `location` — 场景位置
   - `charactersIntroduction` — 角色介绍
3. **素材上下文**：`asset-prompt-context.ts` — 每次生成图片时注入完整角色上下文

### 对 F138 的启发

以后不是只给猫猫"这个视频从 5s 到 18s"，还要给**结构化上下文**：
- 场景意图（教学/演示/过渡/结尾）
- 情绪基调（兴奋/沉稳/幽默）
- 角色口吻（宪宪/砚砚/烁烁）
- 字幕风格（标题/正文/代码注释）
- 封面关键词

## 3. BullMQ 任务编排 — 比 editor 更重要 ⭐⭐⭐

### 架构

4 条独立队列：

| 队列 | 职责 | 文件 |
|------|------|------|
| `image` | AI 图片生成 | `queues.ts` |
| `video` | Remotion 视频渲染 | `queues.ts` |
| `voice` | TTS 配音生成 | `queues.ts` |
| `text` | 文本/脚本生成 | `queues.ts` |

- **Worker 入口**：`src/lib/workers/index.ts`
- **状态对账**：`src/lib/task/reconcile.ts` — orphan task 自动回收
- **后端**：Redis + MySQL 双写

### 对 F138 的价值（Phase 2 核心）

这是最实用的部分。如果我们要做"教程视频流水线"，最该学的不是 UI，而是：
- 渲染任务异步跑
- 失败可重试
- Redis/MySQL 状态对账
- orphan task 自动回收

## 4. 前端编辑器 — 数据模型好，但闭环不完整 ⭐⭐

### 架构

| 组件 | 职责 |
|------|------|
| `VideoEditorStage.tsx` | 主编辑器画布 |
| `Timeline/Timeline.tsx` | 时间轴组件 |
| `editor.types.ts` | 数据模型定义 |
| `VideoComposition.tsx` | Remotion 组合 |

- **数据模型**：`timeline + bgmTrack + clip attachment` — 干净清晰
- **预览**：`@remotion/player` — 浏览器内实时预览
- **拖拽排序**：`dnd-kit`

### ⚠️ 重要发现：导出闭环缺失

砚砚确认了一个关键缺口：
- editor API 只有 `GET/PUT/DELETE`（`src/app/api/novel-promotion/[projectId]/editor/route.ts`）
- **没有 render/export 后端 route**
- 结论：editor 更像"前端分镜壳子 + 预览器"，不是完整的成片生产系统

**我们不要高估 editor 的成熟度。** 它的数据模型值得参考，但不要指望它是"拿来就能用的编辑器"。

## 5. fal.ai 集成 — Provider-Agnostic 设计 ⭐⭐

### 支持的模型

| 类型 | 模型 |
|------|------|
| 图片生成 | nano-banana |
| 视频生成 | veo, sora, kling, wan |
| 语音 | FAL / Bailian 双路 |

### 架构

- **归一化层**：`src/lib/generators/fal.ts`
- **异步提交**：`src/lib/async-submit.ts`
- 不同模型通过统一接口调用，业务代码不感知具体模型

### 对 F138 的价值

F138 不应该绑定单一模型。应该定义自己的 provider 接口：
- `storyboard provider`
- `image provider`
- `voice provider`
- `render provider`

## 不该学的部分 ❌

| 不学 | 原因 |
|------|------|
| Next/MySQL/NextAuth 外壳 | 我们有自己的技术栈 |
| 直接复制 editor 代码 | 无 License + editor 不完整 |
| 把教程视频误做成"AI 短剧产品" | 我们的目标是教程/showcase，不是短剧 |
| 整套 Prisma schema | 我们的持久化方案不同 |

## 对 F138 Phase 分阶的建议

### Phase 1（已有经验产品化）
目标：把 V1→V4.8 实战沉淀成稳定流程
- 固定 `storyboard.json` schema
- 固定素材清单格式：`文件 + 起止秒 + 是否保留原声 + 用途`
- 固定字幕脚本格式：`scene → line → timing → narrator`
- 固定 render CLI / output 目录 / 压缩规范

### Phase 2（异步生产架构）
借鉴 waoowaoo 的 BullMQ 思路，自己实现：
- `text queue` / `voice queue` / `render queue` / `publish queue`
- watchdog / reconcile
- 铲屎官下发"做一期 B 站教程" → 后台跑 → 完成回线程通知

### Phase 3（AI 辅助分镜）
借 waoowaoo 的 prompt 体系思路，不借代码：
- 给一篇教程文档 → 自动生成分镜建议 + 字幕初稿 + 配音分配 + 素材缺口清单

## 参考文件索引（waoowaoo 仓库内）

| 文件 | 内容 | 参考价值 |
|------|------|---------|
| `lib/prompts/character-reference/` | 角色一致性 prompt | ⭐⭐⭐ |
| `lib/prompts/novel-promotion/` | 小说推广 prompt | ⭐⭐ |
| `src/lib/prompt-i18n/catalog.ts` | Prompt 映射表 | ⭐⭐⭐ |
| `src/lib/prompt-i18n/build-prompt.ts` | 变量校验渲染器 | ⭐⭐⭐ |
| `src/lib/generators/reference-to-character.ts` | 参考图→角色 | ⭐⭐⭐ |
| `src/lib/generators/character-profile.ts` | 角色档案 | ⭐⭐⭐ |
| `src/lib/generators/asset-prompt-context.ts` | 素材上下文 | ⭐⭐ |
| `src/lib/generators/fal.ts` | fal.ai 归一化 | ⭐⭐ |
| `src/lib/async-submit.ts` | 异步提交 | ⭐⭐ |
| `src/lib/task/queues.ts` | BullMQ 队列定义 | ⭐⭐⭐ |
| `src/lib/workers/index.ts` | Worker 入口 | ⭐⭐⭐ |
| `src/lib/task/reconcile.ts` | 状态对账 | ⭐⭐⭐ |
| `src/features/video-editor/types/editor.types.ts` | 编辑器数据模型 | ⭐⭐ |
| `src/features/video-editor/components/Timeline/Timeline.tsx` | 时间轴组件 | ⭐⭐ |
| `src/features/video-editor/remotion/VideoComposition.tsx` | Remotion 组合 | ⭐⭐ |
