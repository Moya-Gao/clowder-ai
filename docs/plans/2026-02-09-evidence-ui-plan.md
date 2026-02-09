# Evidence UI 实施方案

> Author: 布偶猫 (Opus 4.6)
> Date: 2026-02-09
> Scope: Evidence 卡片前端 UI 组件 + /evidence 命令升级

## 现状分析

### 已有的
- **后端 API**: `GET /api/evidence/search?q=...` 返回 `EvidenceSearchResponse` (`evidence.ts:36-40`)
- **前端命令**: `/evidence` 已在 `useChatCommands.ts:274-351` 实现，但输出为**纯文本** system message
- **数据类型**: `EvidenceResult { title, anchor, snippet, confidence, sourceType }`

### 缺的
- 结构化卡片组件（目前是纯文本拼接）
- 图标支持（sourceType 分类视觉标识）
- confidence 颜色区分
- 降级状态 banner

## 设计决策

### D1: 图标方案 — 手写 SVG 图标组件
- **不安装 Lucide**：项目现有 5 个图标都是手写 SVG（PawIcon、SendIcon 等），保持一致
- 只需 4 个简单图标：决策(📋)、阶段(🏁)、讨论(💬)、提交(📎)
- 手写 4 个 24x24 viewBox stroke 图标，复杂度可控

### D2: 消息类型 — 新增 `evidence` variant
- 方案A: 在现有 system message variant 加 `'evidence'` → ChatMessage 渲染 EvidencePanel
- 方案B: 新增 message type `'evidence'` → ❌ 改动太大，影响 store 和后端
- **选择 A**：最小改动，`variant: 'evidence'` 触发卡片渲染

### D3: 卡片布局 — 内联在聊天流
- 铲屎官倾向"内联"，参考 system_info 但更结构化
- 不做右侧面板（工程量大、目前没有面板架构）

### D4: confidence 颜色
- high → 绿色 (`text-green-600 bg-green-50`)
- mid → 黄色 (`text-amber-600 bg-amber-50`)
- low → 灰色 (`text-gray-500 bg-gray-50`)

## 实施步骤

### Step 1: Evidence 图标组件
新建 `packages/web/src/components/icons/EvidenceIcons.tsx`

4 个 sourceType 图标 + 1 个 confidence badge，统一 SVG 手写风格：
- `DecisionIcon` — 天平/文档图标 (sourceType: decision)
- `PhaseIcon` — 里程碑/旗帜图标 (sourceType: phase)
- `DiscussionIcon` — 对话气泡图标 (sourceType: discussion)
- `CommitIcon` — git commit 图标 (sourceType: commit)

### Step 2: EvidenceCard 组件
新建 `packages/web/src/components/EvidenceCard.tsx`

单条 evidence 结果卡片：
- 左侧：sourceType 图标
- 中间：title + snippet（紧凑布局）
- 右上：confidence badge（颜色编码）
- 底部：anchor 链接（灰色小字）

### Step 3: EvidencePanel 组件
新建 `packages/web/src/components/EvidencePanel.tsx`

搜索结果容器：
- 降级 banner（黄色警告条，当 `degraded: true`）
- EvidenceCard 列表
- 空状态提示

### Step 4: 接入 ChatMessage 渲染
修改 `ChatMessage.tsx`：
- 新增 `variant === 'evidence'` 分支
- 将 evidence 数据通过 `contentBlocks` 或新的 store 字段传递

### Step 5: 升级 /evidence 命令
修改 `useChatCommands.ts`：
- 从纯文本输出改为结构化 evidence message
- 传入 evidence 结果数据，触发卡片渲染

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `components/icons/EvidenceIcons.tsx` | 新建 | 4 个 sourceType SVG 图标 |
| `components/EvidenceCard.tsx` | 新建 | 单条结果卡片组件 |
| `components/EvidencePanel.tsx` | 新建 | 结果列表 + 降级 banner |
| `components/ChatMessage.tsx` | 修改 | 添加 evidence variant 渲染分支 |
| `hooks/useChatCommands.ts` | 修改 | 改 /evidence 输出为结构化卡片 |
| `stores/chatStore.ts` | 修改 | ChatMessage 增加 evidence 数据字段 |

## 不做的事

- ❌ 安装 Lucide（保持项目一致性）
- ❌ 右侧面板布局（工程量大，后续再议）
- ❌ 治理状态 UI（暹罗猫负责视觉方向）
- ❌ /approve /archive 操作交互
