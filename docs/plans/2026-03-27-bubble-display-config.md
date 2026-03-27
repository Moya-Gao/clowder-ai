---
doc_kind: plan
topics: [config, ui, bubble-display]
created: 2026-03-27
owner: 布偶猫
status: open
---

# 气泡展开/折叠 — 全局默认 + Thread 覆盖

## 背景

当前 Thinking 展开/折叠只有一个全局 localStorage 开关，CLI Output 气泡硬编码为默认折叠，没有 thread 级覆盖能力。

铲屎官需求：Coding thread 希望全折叠（减少噪音），贴贴 thread 希望全展开（看猫猫怎么想的）。

## 关键区分

| 概念 | 控制什么 | 感知方 |
|------|---------|--------|
| 心里话 (debug/play) | thinking 内容是否发给其他猫 | 后端路由，猫感知 |
| Thinking 展开/折叠 | thinking 气泡默认展开还是折叠 | 纯前端，人类感知 |
| CLI 气泡展开/折叠 | CLI output 气泡默认展开还是折叠 | 纯前端，人类感知 |

后两个是纯 UI 显示偏好，本次改动目标。

## 设计

### 1. Config Hub → 系统配置（全局默认）

新增「气泡显示」section，两个开关：

- Thinking 默认: 折叠 / 展开
- CLI 气泡默认: 折叠 / 展开

存储：走 `PATCH /api/config`（ConfigStore），key：
- `ui.bubble.thinking` → `'collapsed' | 'expanded'`，默认 `collapsed`
- `ui.bubble.cliOutput` → `'collapsed' | 'expanded'`，默认 `collapsed`

### 2. Thread 右侧状态栏（覆盖全局）

现有 Thinking 二态按钮改为三态，新增 CLI 气泡控制：

- Thinking: 跟随全局 / 展开 / 折叠
- CLI 气泡: 跟随全局 / 展开 / 折叠

Thread 级存储：`PATCH /api/threads/:id`
- `bubbleThinking?: 'global' | 'expanded' | 'collapsed'`（默认 `global`）
- `bubbleCli?: 'global' | 'expanded' | 'collapsed'`（默认 `global`）

### 3. 解析优先级

```
thread 设了非 global → 用 thread 的
否则 → 用 Config Hub 全局的
全局也没设 → fallback collapsed
```

## 改动范围

**后端 (packages/api)**：
- ConfigStore：注册 `ui.bubble.thinking` + `ui.bubble.cliOutput` 两个 key
- Thread schema：加 `bubbleThinking` + `bubbleCli` 可选字段
- `GET /api/config` snapshot 包含新 key

**前端 (packages/web)**：
- `config-viewer-tabs.tsx` SystemTab：新增「气泡显示」section
- `RightStatusPanel.tsx`：Thinking 改三态 + 新增 CLI 气泡三态
- `chatStore.ts`：迁移 `uiThinkingExpandedByDefault` → 从 config API 读取
- `ChatMessage.tsx`：解析逻辑（thread override > global > fallback）
- `ThinkingContent.tsx`：`defaultExpanded` 走新解析逻辑
- `CliOutputBlock.tsx`：`defaultExpanded` 走新解析逻辑

**兼容**：旧 localStorage key `catcafe.ui.thinkingExpandedByDefault` 读一次迁移后废弃。
