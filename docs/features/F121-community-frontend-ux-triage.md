---
feature_ids: [F121]
related_features: [F095, F110]
topics: [community, frontend, ux, triage]
doc_kind: spec
created: 2026-03-14
---

# F121: Community Frontend UX Triage — 社区前端交互体验侦查与分诊

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P2

## Why

社区 `clowder-ai` 积累了一批未 triaged 的前端 UX issue（6 个三猫共识），铲屎官要求以 maintainer 视角逐个侦查：定位是否真的有问题、是否值得做、技术可行性，再决定 accept/reject/duplicate。

铲屎官原话：
> "不是所有的需求或者所有觉得是 enhance 的都需要 enhance，也不是所有他们认为的 bug 也是 bug，你们得定位清楚是不是有这个问题"

## What

### Phase A: 侦查（每猫侦查 1-2 个 issue）

每个 issue 的侦查产出「猫爪印报告」：

1. **复现/定位**：在代码中确认问题是否存在
2. **根因分析**：为什么会这样（设计如此 / 确实是 bug / 技术限制）
3. **判定**：accept-bug / accept-enhancement / duplicate / wontfix / needs-discussion
4. **关联**：是否应挂到现有 Feature
5. **修复评估**：如果 accept，难度和影响范围

### Phase B: 分诊决策

汇总侦查结果 → 铲屎官拍板 → 社区回复 + 打标签

## Issue Checklist

| # | Issue | 类型 | 侦查猫 | 判定 | 猫爪印 |
|---|-------|------|--------|------|--------|
| #28 | 聊天面板宽度不支持拖动 | enhancement | 布偶猫 | ✅ accept-enhancement | 🐾 确认问题存在：sidebar↔chat 和 chat↔workspace 有拖拽，但 workspace 关闭时 chat 面板无 resize handle（`flex: 1 1 0%` 撑满）。ResizeHandle 组件 + usePersistedState 积木齐备，从未实现该场景。难度 S-M。详见下方猫爪印报告。 |
| #89 | collapse-all 后 sidebar 展开跳错分组 | bug | 金渐层 | ✅ accept-bug | 🐾 F095 遗漏。`findGroupKeyForThread()` 遍历 groups 取第一个命中，recent 排在 project 前面导致优先展开 recent。修复方案：优先 project group 或传入来源 groupKey。难度 S，影响范围小（collapse-state.ts + use-collapse-state.ts）。详见下方猫爪印报告。 |
| #27 | 切换会话时滚动位置重置 | bug | 缅因猫(gpt52) | ✅ accept-bug | [砚砚/gpt52] 实锤：线程状态只保存消息/队列，不保存 scrollTop；切换回来首轮渲染会走“初始加载滚到底”分支。详见下方猫爪印报告。 |
| #22 | @mention 下拉框溢出+行高不一致 | bug | 布偶猫 | ✅ accept-bug | 🐾 确认问题存在：ChatInputMenus.tsx L113 `w-64`(256px) 容器过窄，中文描述溢出致行高不一致。缺 `truncate`/`line-clamp-1`/`min-w-0`。纯 CSS 修复 4 行 Tailwind class，`w-64`→`w-72` 对齐游戏菜单宽度。难度 XS。详见下方猫爪印报告。 |
| #88 | UX Debt 内部术语暴露给用户 | enhancement | 金渐层 | ✅ accept-enhancement (部分) | 🐾 经代码确认：(1) `(F33)` 确实暴露在 HubStrategyTab.tsx 用户 UI 中；(2) sidebar 治理 dot 仅靠 hover title，触屏不可见；(3) GovernanceHealth 的 `Q/O/D/R/A` 和 bucket 名有 legend 但只在有数据时显示。建议拆为两批：快修（去 F33 编号 + dot 加 aria-label）和规范（design-system.md 加 guardrail）。难度 M。详见下方猫爪印报告。 |
| #16 | Bootcamp 阶段过渡 UX | enhancement | 缅因猫(gpt52) | ✅ accept-enhancement -> F110 | [砚砚/gpt52] 问题原始成立，但已被 F110 吸收；当前只剩 Phase 2 全 OK 快路径缺少显式过渡文案。详见下方猫爪印报告。 |

## Dependencies

- **Related**: F095（Thread Sidebar 导航升级 — #89 可能是其遗漏）
- **Related**: F110（训练营愿景引导 — #16 可能重叠）

## Risk

| 风险 | 缓解 |
|------|------|
| 侦查发现问题不存在，社区期望落差 | 用详细技术分析回复，解释清楚 |
| 某些 issue 实际是现有 Feature 的子任务 | 关联检测已标注，侦查时进一步确认 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-14 | 立项，三猫分工侦查 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **社区仓** | `zts212653/clowder-ai` | issues #28/#89/#27/#22/#88/#16 |

---

## 猫爪印报告

### 🐾 #89 — collapse-all 后 sidebar 展开跳错分组（金渐层侦查）

**判定：✅ accept-bug — F095 Phase A 遗漏**

#### 1. 复现/定位

在代码中 **确认问题存在**。关键调用链：

```
use-collapse-state.ts L56-71:
  currentThreadId 变化时 → findGroupKeyForThread(currentThreadId, groupsMeta)
  → 展开该 group

collapse-state.ts L84-91:
  findGroupKeyForThread() → for 循环遍历 groups → 返回第一个命中

thread-utils.ts L116-180:
  sortAndGroupThreadsWithWorkspace() 返回的 groups 顺序:
  pinned → recent → active projects → archived-container → favorites
```

当一个 thread 同时出现在 `recent`（跨项目最近 8 条）和某个 `project group` 中时，`findGroupKeyForThread()` 会因 `recent` 排在 `project` 前面而优先命中 `recent`。

#### 2. 根因分析

这是 **F095 Phase A 的设计盲区**：Phase A 加了 `findGroupKeyForThread()` 用于 auto-expand 当前 thread 所在分组，但当时还没有 Phase B 的 `recent` 段。Phase B 引入 `recent` 后，同一 thread 可能同时出现在两个 group 中，但 `findGroupKeyForThread()` 的"第一个命中"策略没有相应更新。

**不是 F095 已修的问题，而是 Phase B 引入的回归。**

#### 3. 修复方案

**推荐方案（成本最低，效果明确）**：修改 `findGroupKeyForThread()` 的优先级逻辑——当多个 group 都包含目标 thread 时，优先返回 `project` 类型的 group，`recent` 降级为 fallback。

```typescript
// collapse-state.ts — findGroupKeyForThread 修改
export function findGroupKeyForThread(
  threadId: string,
  groups: { groupKey: string; threadIds: string[]; type?: string }[],
): string | undefined {
  let fallback: string | undefined;
  for (const g of groups) {
    if (g.threadIds.includes(threadId)) {
      // project group 优先
      if (g.type !== 'recent') return g.groupKey;
      // recent 作为 fallback
      if (!fallback) fallback = g.groupKey;
    }
  }
  return fallback;
}
```

改动 2 个文件（collapse-state.ts + 传入 type 信息），影响范围小，有现成测试覆盖。

#### 4. 修复评估

- **难度**：S（小改动）
- **影响范围**：collapse-state.ts + use-collapse-state.ts（可能需要透传 group type）
- **关联 Feature**：F095 的 Known Issue，建议挂到 F095 或在 F121 内完成
- **回归风险**：低。现有测试 `use-collapse-state.test.ts` 已有"auto-expand 当前 thread"场景，补一个"thread 同时在 recent + project"的 case 即可

---

### 🐾 #88 — UX Debt: 内部术语暴露给用户（金渐层侦查）

**判定：✅ accept-enhancement（部分）— 分两批处理**

#### 1. 复现/定位

逐个检查 issue 中列出的 4 个具体位置：

| # | 位置 | 问题 | 代码确认 |
|---|------|------|----------|
| 1 | `HubGovernanceTab.tsx` L127 | `外部项目治理状态` 标题 | ✅ 确实存在，但**有上下文**（表格列名"状态/版本/上次同步"提供了一定解释）。"治理"这个词对非内部用户确实模糊。 |
| 2 | `SectionGroup.tsx` L4-8 | 治理 dot 仅靠 `title` hover | ✅ 确实只有 `title={dot.title}`，无 aria-label，触屏/移动端完全不可见。 |
| 3 | `HubStrategyTab.tsx` L48 | `Session 策略配置 (F33)` | ✅ **确认暴露了内部 Feature 编号**。`(F33)` 不应出现在用户 UI 中。 |
| 4 | `GovernanceHealth.tsx` L19-42 | `Q/O/D/R/A` 和 bucket 名 | ⚠️ **部分确认**。bucket 已有 legend（L100-108 有颜色 + 名称 + 数量展示）。`Q/O/D/R/A` source tags 也有颜色 + 单字母展示（L117-126）。但单字母确实缺少释义，只有懂方法论的人才知道 Q=Question, O=Observation 等。 |

#### 2. 根因分析

这不是单个 bug，而是**多个独立的 UI 文案问题**的集合。根因不同：
- **(F33) 编号泄露**：开发时 copy-paste 内部文档标题，忘了清理
- **治理 dot 仅 hover**：F070 Phase 1 实现时选择了最小化方案（一个 dot），没考虑触屏场景
- **术语不透明**：`治理` 是 F070 的领域概念（governance bootstrap），但 UI 没做"翻译层"
- **Source Tag 无释义**：Mission Control 面板本身是面向 team lead 的高级面板，当时假设用户熟悉方法论

#### 3. 判定细分

| 子项 | 判定 | 理由 |
|------|------|------|
| 去掉 `(F33)` | ✅ accept-enhancement | 零争议，内部编号不应暴露给用户 |
| 治理 dot 加 aria-label | ✅ accept-enhancement | 可访问性缺陷，修复成本低 |
| "治理"术语换成 plain-language | ⚠️ needs-discussion | "治理"是 F070 的核心概念，改文案需要铲屎官确认替代用语（如"项目规范同步"/"方法论同步"） |
| GovernanceHealth 补 legend | ⚠️ needs-discussion | Mission Control 本身面向 team lead，补 legend 合理但优先级低 |
| design-system.md 加 guardrail 规范 | ✅ accept-enhancement | 长期防腐，但属于规范层面，不急 |

#### 4. 修复评估

**快修批（S 难度，可立即做）**：
- `HubStrategyTab.tsx`：删除 `(F33)` → `Session 策略配置`
- `SectionGroup.tsx`：dot 加 `aria-label` 属性

**规范批（M 难度，需铲屎官确认）**：
- `HubGovernanceTab.tsx`："治理" → 需要确认替代用语
- `GovernanceHealth.tsx`：Source Tag 释义 legend
- `docs/design-system.md`：新增 UI 文案 guardrail 规则

**建议不做的**：
- issue 提到的"统一 InfoTooltip 组件"——过度工程化，现有 `title` + `aria-label` 够用

---

### 🐾 #27 — 切换会话时聊天面板滚动位置重置（缅因猫/gpt52 侦查）

**判定：✅ accept-bug**

#### 1. 复现/定位

在代码中确认问题存在，且不是报告者误判：

- `packages/web/src/stores/chatStore.ts` 的 `snapshotActive()` / `flattenThread()` 只保存消息、loading、queue、invocation 等线程状态，不保存任何 viewport 信息。
- `packages/web/src/stores/chat-types.ts` 的 `ThreadState` / `DEFAULT_THREAD_STATE` 也没有 `scrollTop` 或等价字段。
- `packages/web/src/hooks/useChatHistory.ts` 仅实现了两类滚动逻辑：
  - history prepend 时根据 `scrollSnapshotRef` 保持相对位置
  - 首次加载/首轮渲染时在 `prevCount === 0` 分支直接 `scrollIntoView({ behavior: 'auto' })`

这意味着 thread switch 时即使消息缓存被恢复，滚动位置本身也没有地方可恢复；只要组件把当前渲染视为“初始加载”，视口就会回到底部。

#### 2. 根因分析

这不是“产品设计如此”，而是线程级 UI 状态保存不完整。

当前线程切换机制的目标是保住消息数据和异步状态，这部分已经做到了；但阅读位置不在 `ThreadState` 的保存范围里，所以切换回来时会被当成一个新的 viewport。`useChatHistory` 的滚动逻辑又把“首轮渲染”硬编码成滚到底，于是问题稳定出现。

#### 3. 关联判断

- **不是 F095**：F095 管的是 sidebar 导航、折叠记忆和活跃工作区，不覆盖聊天面板 viewport 恢复。
- 建议先挂在 F121 的社区 UX triage 结论里；真正实现时可以拆成独立 web bug，或者作为 F121 的子任务。

#### 4. 修复评估

- **难度**：M
- **影响范围**：
  - `packages/web/src/stores/chat-types.ts`
  - `packages/web/src/stores/chatStore.ts`
  - `packages/web/src/hooks/useChatHistory.ts`
  - 新增 thread-switch scroll restoration 回归测试
- **修复方向**：
  - 在线程切换前保存 `scrollTop`
  - 切回线程后优先恢复该值
  - 避免与 `prevCount === 0` 的“初始加载滚到底”分支互相打架

---

### 🐾 #16 — Bootcamp guide: improve phase transition UX（缅因猫/gpt52 侦查）

**判定：✅ accept-enhancement -> F110**

#### 1. 复现/定位

这张单的原始问题成立，但当前状态已经不是“完全未处理”：

- `cat-cafe-skills/bootcamp-guide/SKILL.md` 已明确写出 `Phase 3` / `Phase 3.5` 结构。
- `Phase 3.5` 里已经落了核心要求：**不要默认跳过，主动问用户想不想装**。
- `docs/features/F110-bootcamp-vision-elicitation.md` 已明确把该 issue 吸收到 **F110**，并且 `AC-A11` 覆盖了 Phase 3.5 主动询问。

我实际看到还没写实的一项，是 issue 里第 1 条：

- **Phase 2 全部核心项 OK 时，skill 没有显式要求输出“配置检查完成，无需修复”的成功过渡文案。**

#### 2. 根因分析

所以这张单不是“社区提了个全新 enhancement”，而是：

- 原 issue 描述的 3 个子问题里
  - 2 个已经被 F110 / 当前 bootcamp skill 吃掉
  - 1 个还剩文案级收尾

从 maintainer 视角，它是一个**已被现有 feature 吸收、但尚未彻底收口**的 enhancement，不该再单独开新 feature，也不该继续作为 F121 的独立实现目标。

#### 3. 关联判断

- **直接挂 F110**
- 不建议再挂新的 F 号
- F121 只保留 triage 结论，后续实现/收口回 F110

#### 4. 修复评估

- **难度**：S
- **影响范围**：
  - `cat-cafe-skills/bootcamp-guide/SKILL.md`
  - 如需验证，补一条 bootcamp walkthrough / skill review 检查
- **修复方向**：
  - 在 Phase 2 -> 3.5 的“全部核心项 OK”快路径里，补显式成功提示
  - 明确要求 phase-enter / transition copy，减少”静默跳过”的感觉

---

### 🐾 #28 — 聊天面板宽度不支持拖动调整（布偶猫侦查）

**判定：✅ accept-enhancement — 从未实现的场景，积木齐备**

#### 1. 复现/定位

在代码中 **确认问题存在**。ChatContainer.tsx 的面板布局：

```
[Sidebar] → [ResizeHandle✅] → [Chat Container] → [ResizeHandle✅] → [Workspace]
                                                     ↑ 仅 workspace 打开时存在
```

| 场景 | 是否可拖拽 | 代码位置 |
|------|-----------|----------|
| Sidebar ↔ Chat | ✅ `handleSidebarResize()` L136-141 | ResizeHandle L435 |
| Chat ↔ Workspace | ✅ `handleHorizontalResize()` L126-135 | ResizeHandle L627 |
| Chat 面板右边界（无 workspace） | ❌ **缺失** | Chat 用 `flex: '1 1 0%'` 撑满 |

当 workspace 关闭时，Chat 面板直接 `flex: 1` 占满剩余空间，没有 resize handle，用户无法调整宽度。

#### 2. 根因分析

**从未实现**，不是回归。Chat 面板宽度控制逻辑（L440-446）有两个分支：
- workspace 打开：`flexBasis: ${chatBasis}%`（可控）
- workspace 关闭：`flex: '1 1 0%'`（硬编码撑满）

设计时只考虑了”有右侧面板时的比例分割”，没考虑”无右侧面板时用户可能想要窄一点的聊天区域”。

#### 3. 修复方案

所有积木已就位：
1. `ResizeHandle` 组件（`packages/web/src/components/workspace/ResizeHandle.tsx`，70 行，支持水平/垂直拖拽 + 双击重置）
2. `usePersistedState`（`chatBasis` 和 `sidebarWidth` 已用此 hook 持久化到 localStorage）
3. 鼠标事件处理模式已在两处 resize 中验证过

需要做的：
1. 新增 `chatPanelWidth` persisted state（px 值，参考 `sidebarWidth` 模式）
2. workspace 关闭时，在 Chat 面板右侧渲染一个 `ResizeHandle`
3. 新增 `handleChatWidthResize()` handler
4. Chat 面板 flex 改为 `flexBasis: chatPanelWidth` 而非 `flex: 1`

#### 4. 修复评估

- **难度**：S-M（模式已有，照搬即可）
- **影响范围**：ChatContainer.tsx + usePersistedState.ts
- **关联 Feature**：独立，不属于现有 Feature
- **回归风险**：低。只在 workspace 关闭的分支生效，不影响现有 chat↔workspace resize 逻辑
- **无外部依赖**：不需要安装 resize 库

---

### 🐾 #22 — @mention 下拉框溢出+行高不一致（布偶猫侦查）

**判定：✅ accept-bug — 纯 CSS 缺陷，修复成本极低**

#### 1. 复现/定位

在代码中 **确认问题存在**。ChatInputMenus.tsx 的 mention 下拉框：

```tsx
// L113: 容器
<div className=”... w-64 ...”>     // 256px，过窄

// L117-141: 每个选项 button
<button className=”flex items-center gap-3 ...”>
  <div style={{ width: 30, height: 30 }}>  // 头像固定 30px
    ...
  </div>
  <div>                                      // ❌ 无 min-w-0，flex 子元素不会收缩
    <div className=”text-sm font-semibold”>  // ❌ 无 truncate
      {opt.label}                            // 猫名
    </div>
    <div className=”text-xs text-gray-400”>  // ❌ 无 line-clamp
      {opt.desc}                             // “主架构师和核心开发者，擅长深度思考和系统设计” → 溢出换行
    </div>
  </div>
</button>
```

**对比**：同文件中游戏菜单（L159, L194）已使用 `w-72`（288px），mention 菜单反而更窄。

#### 2. 根因分析

CSS/Tailwind 类缺失：
1. `w-64` 对中文长描述太窄（”主架构师和核心开发者，擅长深度思考和系统设计” 约 40 字符，text-xs 需要 ~280px）
2. 文本容器 `<div>` 缺 `min-w-0`，作为 flex 子元素无法收缩到内容宽度以下
3. 没有 `truncate` 或 `line-clamp-1`，长文本直接换行导致行高不一致

#### 3. 修复方案

**纯 Tailwind class 修改，4 行改动**：

| 行 | 当前 | 修改 |
|----|------|------|
| L113 | `w-64` | `w-72`（对齐游戏菜单宽度） |
| L135 | `<div>` | `<div className=”min-w-0 flex-1”>` |
| L137 cat name | 无 truncate | 加 `truncate` |
| L139 description | 无 line-clamp | 加 `line-clamp-1` |

#### 4. 修复评估

- **难度**：XS（15 分钟）
- **影响范围**：ChatInputMenus.tsx 一个文件，4 行 class 修改
- **关联 Feature**：独立
- **回归风险**：极低。零 JS 改动，零布局结构改动
- **测试注意**：现有测试 `chat-input-mention-guard.test.ts` 用 `.w-64` 做选择器，改 `w-72` 后需同步更新
