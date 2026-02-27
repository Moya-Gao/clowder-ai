---
feature_ids: [F038]
topics: [polish, brainstorm]
doc_kind: discussion
created: 2026-02-10
---

# 2026-02-10 UX Polish Brainstorm

> 参与者：铲屎官 + 布偶猫
> 形式：铲屎官口述需求 + 布偶猫采访澄清 + 共同排优先级
> 目的：体验优化类功能需求整理

---

## 背景

铲屎官在使用 Cat Cafe 过程中积累了几个体验痛点，本次讨论整理成正式 feature 需求。

---

## 铲屎官原始需求

### 1. 导出对话长图

> "导出长图的功能"
> "在前端加一个按钮，一键导出当前对话为长图"
> "可以是整个 thread 也可以让我选 range"
> "输出 PNG 就够了"

**核心动机**：分享对话记录、保存重要讨论、制作 showcase

**参考**：本次讨论前刚用 Chrome headless 截取了 F11 Review 攻防录长图

### 2. 工具调用栏可收起 + 滚动显示

> "工具调用栏要能收起来，最好收起来的时候那样就是一直滚动最新猫猫调用了什么工具，显示他还在跑"
> "类似 Codex 和 Claude Code 自己 app 总结 thinking 小模型显示的那种"
> "出现下一个上一个就滚没然后加一个动态的效果表示在跑"

**核心动机**：
- 节省屏幕空间（工具调用列表很长）
- 保持活动指示（知道猫还在干活）

**参考效果**：
- Claude Code CLI 的 thinking 显示：单行滚动，新内容顶掉旧内容
- Codex 的工具调用显示：滚动 + 动态指示

### 3. 动态累积计时器

> "猫猫跑了多久不是跑完：缅因猫29.7s 而是这是一个累积的动态数字我能看到就更安心"
> "顶部状态栏吧，我们好多只猫呢，一个屏幕有的时候只能看到一只，但是另一只也在跑"

**核心动机**：**让铲屎官安心** — 看到数字在动，就知道猫没卡死

**现状分析**：
- `RightStatusPanel.tsx:152-155` 已有时间显示
- 完成后：静态显示 `29.7s`
- 运行中：只显示 `进行中…`（无时间）

**期望**：运行中显示动态累积 `0.0s → 0.1s → 0.2s → ...`

---

## 布偶猫采访澄清

### F17 导出长图

| 问题 | 铲屎官回答 |
|------|-----------|
| 导出范围？ | 整个 thread 或选择 range |
| 输出格式？ | PNG 就够了 |
| 实现方式偏好？ | 待定（纯前端 vs Chrome headless） |

### F18 工具栏收起

| 问题 | 铲屎官回答 |
|------|-----------|
| 收起状态显示什么？ | 滚动显示最新工具调用 |
| 参考效果？ | Claude Code / Codex thinking 显示 |
| 动态指示？ | 需要，表示还在跑 |

### F19 动态计时

| 问题 | 铲屎官回答 |
|------|-----------|
| 显示位置？ | 顶部状态栏（多猫可见） |
| 精度要求？ | 待定（0.1s 或 1s） |

---

## 决策过程

### 布偶猫初步判断

这三个都是**体验优化类**功能，按实现复杂度和体验提升排序：

1. **F19 动态计时器** — 最简单，改动小（setInterval + startedAt），安心感提升大
2. **F18 工具栏收起** — 中等复杂度，需要 UI 状态管理 + CSS 动画
3. **F17 导出长图** — 最复杂，需要选型（html2canvas vs Chrome headless）

### 铲屎官确认

> "yes"

确认优先级排序。

---

## 最终优先级排序

> **状态：✅ 铲屎官确认 (2026-02-10)**

| 顺序 | 编号 | Feature | 复杂度 | 验收标准 |
|------|------|---------|--------|----------|
| 1 | F19 | 动态累积计时器 | 低 | 运行中显示动态时间，顶部状态栏可见 |
| 2 | F18 | 工具栏收起+滚动 | 中 | 可收起/展开，收起时滚动显示最新工具 |
| 3 | F17 | 导出对话长图 | 中高 | 前端按钮，支持全量/range，输出 PNG |

---

## 技术方案（待实施时细化）

### F19 动态累积计时器

**改动点**：
- `ParallelStatusBar.tsx` — 顶部状态栏加入计时显示
- `RightStatusPanel.tsx` — 右侧面板同步改为动态
- 新增 hook：`useElapsedTime(startedAt)` — 返回动态累积时间

**关键实现**：
```typescript
function useElapsedTime(startedAt: number | undefined) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100); // 0.1s 精度
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}
```

### F18 工具栏收起+滚动

**改动点**：
- `ChatMessage.tsx` 的 `renderToolEvents()` — 加入收起/展开状态
- 收起态 UI：单行 + 滚动动画 + 脉冲指示

**CSS 动画参考**：
```css
@keyframes scroll-tool {
  0% { transform: translateY(100%); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  90% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-100%); opacity: 0; }
}
```

### F17 导出对话长图

**方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| html2canvas | 纯前端，无需后端 | 样式可能丢失，字体问题 |
| Chrome headless | 效果完美 | 需要后端支持，Chrome 依赖 |
| dom-to-image | 纯前端，SVG 中间层 | 复杂样式支持差 |

**最终决议**：**Chrome headless**（布偶猫决定）
- 已在本次讨论前验证可行（截取了 F11 Review 长图）
- 效果最好，样式完整保留
- 实现：后端新增 `/api/threads/:id/export-image` 路由，调用 Chrome headless

---

## 开放问题 → 最终决议

> **铲屎官确认 (2026-02-10)**

| 问题 | 决议 |
|------|------|
| F19 计时精度 | **0.1s** — setInterval 100ms 更新 |
| F17 实现方式 | **布偶猫决定** — 推荐 Chrome headless（效果好，已验证） |
| F18 收起显示 | **工具名+参数摘要** — 例如 `🔧 Read packages/api/src/...` |

---

## 相关文件

- 现有状态栏：`packages/web/src/components/ParallelStatusBar.tsx`
- 右侧面板：`packages/web/src/components/RightStatusPanel.tsx`
- 工具事件渲染：`packages/web/src/components/ChatMessage.tsx` (renderToolEvents)
- 状态辅助：`packages/web/src/components/status-helpers.ts`
- F11 长图示例：`tmp/f11-review-showcase-full.png`
