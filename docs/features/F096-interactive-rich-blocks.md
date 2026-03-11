---
feature_ids: [F096]
related_features: [F087, F022]
topics: [rich-blocks, interactive, frontend, ux]
doc_kind: spec
created: 2026-03-11
---

# F096: Interactive Rich Blocks — 可交互富文本组件

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

当前 Rich Block 系统有 5 种 kind（card/diff/checklist/media_gallery/audio），全部是**只读展示**。很多场景需要用户在富文本中直接操作——选方案、勾选项、点按钮——而不是手动打字。

### 铲屎官原话（2026-03-11）

> "我们能做成可交互的富文本！Claude Code 有那个啊！你弹出一个东西让我选和 ☑️！我们按道理有前端！难道不能吗？这样的富文本别的地方还能用？！"

### 核心动机

Cat Café 有完整的 Web 前端，交互能力远超 CLI。可交互 Rich Block 是**通用基础设施**，不只服务 F087 训练营，还能用于 CVO 决策、Review 投票、确认操作等所有需要用户选择的场景。

## What

在现有 Rich Block 架构上新增 `interactive` kind，支持用户在富文本中做选择/操作，结果自动转为聊天消息发出。

### 设计原则

1. **交互结果 = 自动发一条消息**：前端把用户选择注入 ChatInput 并自动发送。后端猫猫收到的就是普通文字，**零后端改动**
2. **渐进增强**：不支持交互的客户端（未来 CLI/API）降级为纯文本展示
3. **通用复用**：不为 F087 定制，所有场景都能用

### Interactive Types

| interactiveType | 说明 | 用户操作 | 自动发送的消息示例 |
|-----------------|------|---------|-------------------|
| `select` | 单选列表 | 点一个选项 | "我选了：方案 A" |
| `multi-select` | 多选列表 | 勾选多个 → 确认 | "我选了：Node.js, pnpm" |
| `card-grid` | 卡片网格 | 点一张卡片 | "我选了：🎲 猫猫盲盒" |
| `confirm` | 确认/取消 | 点按钮 | "确认" / "取消" |

### 数据结构

```typescript
// packages/shared/src/types/rich.ts 新增

interface RichInteractiveBlock extends RichBlockBase {
  kind: 'interactive';
  interactiveType: 'select' | 'multi-select' | 'card-grid' | 'confirm';
  title?: string;
  description?: string;
  options: InteractiveOption[];
  maxSelect?: number;          // multi-select 时限制最大选择数
  allowRandom?: boolean;       // card-grid 显示"随机抽"按钮
  messageTemplate?: string;    // 自定义发送消息模板，{selection} 占位符
  disabled?: boolean;          // 已交互后禁用
  selectedIds?: string[];      // 已选择的 option IDs（回显用）
}

interface InteractiveOption {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  level?: number;              // card-grid 分组用（难度等级）
  group?: string;              // 分组标题
}
```

### 前端交互流程

```
猫猫发送含 interactive block 的消息
  → 前端渲染对应的交互组件（按钮/卡片/checkbox）
  → 用户点击选择
  → 前端组装消息文本（使用 messageTemplate 或默认模板）
  → 自动填入 ChatInput 并发送
  → Block 状态更新为 disabled + 回显 selectedIds
  → 猫猫收到普通文字消息，正常处理
```

### 复用场景

| 场景 | interactiveType | 来源 Feature |
|------|----------------|-------------|
| 训练营选引导猫 | `card-grid` | F087 |
| 训练营选任务 | `card-grid` + `allowRandom` | F087 |
| CVO 拍板方案 | `select` | 通用 |
| 环境检测确认 | `confirm` | F087 |
| Review 多选标记 | `multi-select` | 通用 |
| 危险操作确认 | `confirm` | 通用 |

## Acceptance Criteria

### Phase A（核心交互框架）

- [ ] AC-A1: `RichBlockKind` 新增 `'interactive'`，类型定义含 4 种 interactiveType
- [ ] AC-A2: 前端 `InteractiveBlock.tsx` 渲染器，支持 select / multi-select / card-grid / confirm
- [ ] AC-A3: 用户选择后自动发送消息（填入 ChatInput + submit）
- [ ] AC-A4: 交互完成后 block 变为 disabled 状态 + 回显已选
- [ ] AC-A5: `cat_cafe_create_rich_block` MCP 工具支持 `kind: 'interactive'`
- [ ] AC-A6: 后端 Zod 校验支持 interactive block schema
- [ ] AC-A7: card-grid 的 `allowRandom` 实现随机选择动画

### Phase B（渐进增强）

- [ ] AC-B1: 非交互客户端降级为纯文本展示（option 列表 + "请输入编号选择"）
- [ ] AC-B2: Rich Block Rules 文档更新，猫猫知道怎么用 interactive block

## Dependencies

- **Evolved from**: F022（Rich Block 基础架构）
- **Blocked by**: 无（现有 Rich Block 架构已就绪）
- **Related**: F087（猫猫训练营，首个重度使用者）

## Risk

| 风险 | 缓解 |
|------|------|
| 前端交互与 ChatInput 耦合 | 通过事件系统解耦，不直接操作 DOM |
| 用户快速连点导致重复发送 | disabled 状态 + debounce |
| Block 渲染闪烁（WebSocket 推送时） | 沿用现有 RichBlockBuffer 去重机制 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 是否支持 block 状态持久化（刷新后仍显示 disabled + 已选）？ | ⬜ 未定 |
| OQ-2 | card-grid 随机选择的动画效果？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 交互结果 = 自动发消息，后端零改动 | 最小侵入，猫猫无需特殊处理 | 2026-03-11 |
| KD-2 | 4 种 interactiveType 覆盖主要场景 | select/multi-select/card-grid/confirm 足够通用 | 2026-03-11 |
| KD-3 | 交互后 block 变 disabled | 防止重复操作，保留选择记录 | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 铲屎官提出可交互富文本需求（F087 Design Gate 讨论中） |
| 2026-03-11 | F096 立项，从 F087 Design Gate 讨论中提取为独立 Feature |

## Review Gate

- Phase A: @codex

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F087-cvo-bootcamp.md` | 首个重度使用者 |
| **Types** | `packages/shared/src/types/rich.ts` | Rich Block 类型定义 |
| **Renderer** | `packages/web/src/components/rich/RichBlocks.tsx` | 前端渲染入口 |
| **MCP Tool** | `packages/mcp-server/src/tools/callback-tools.ts` | create_rich_block |
| **API** | `packages/api/src/routes/callbacks.ts` | Rich Block callback |

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "弹出一个东西让我选和☑️" | AC-A2, AC-A3 | test + screenshot | [ ] |
| R2 | "别的地方还能用" — 通用组件 | AC-A1~A6 | 多场景 test | [ ] |
| R3 | F087 训练营选任务需要 card-grid | AC-A2, AC-A7 | F087 集成测试 | [ ] |
| R4 | 随机抽功能 | AC-A7 | manual + screenshot | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（若适用）
