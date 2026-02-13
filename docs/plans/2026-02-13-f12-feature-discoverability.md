# F12 功能可发现性 — 设计与实施计划

> 日期：2026-02-13
> 作者：布偶猫
> 状态：待 review
> BACKLOG：F12
> 前置：铲屎官采访 (2026-02-13)

---

## 1. 背景与动机

### Why

Cat Café 经过 Phase 0→5.2 + 多轮 Feature 开发，已积累大量功能：

- **11 个斜杠命令**：/config, /remember, /recall, /evidence, /reflect, /approve, /archive, /mode (brainstorm/debate/dev-loop/end/status), /tasks extract
- **多个 MCP 工具**：cat_speak, get_context, read_file, search_code, remember, recall, evidence 等
- **散落的 UI 功能**：导出长图、分屏、语音输入、thread 编辑/搜索
- **20+ 环境变量**：REDIS_URL, API_SERVER_PORT, CAT_CODEX_SANDBOX_MODE, HINDSIGHT_URL...
- **多个配置文件**：cat-config.json, .env.local, start-dev.sh

**核心痛点**（铲屎官原话）：

1. "我忘了有什么命令可以用" — 打字时想不起来
2. "我不知道猫猫能帮我做什么" — 新功能上了没人告诉我
3. "配置太分散了" — 想看全貌得翻代码
4. "我都不知道有哪些 env 和 json 需要配置，在哪里" — 系统对用户是黑箱

**找不到的功能 = 不存在的功能。**

### 现状分析

当前唯一的"可发现性"入口是右上角齿轮图标，打开 `CatConfigViewer` modal，展示：
- 三猫模型/预算/Skills/MCP 工具（3 个 tab）
- 系统配置：A2A、记忆、Hindsight、治理（1 个 tab）

**没有覆盖的**：可用命令、快捷键、环境变量、配置文件位置、数据目录。

---

## 2. 采访记录

### Q1: 最痛的场景是什么？
- **全选**：忘了命令、不知道新功能、配置分散、不知道 env/json 在哪里

### Q2: 可发现性入口长什么样？
- **铲屎官决策**：不做新入口，扩展现有齿轮 modal。`/help` 和 `/config` 命令可以呼唤这个界面。

### Q3: 新内容怎么组织到 tab 结构里？
- **铲屎官决策**：新增 2 个 tab（「命令速查」和「环境 & 文件」），modal 整体放大。

### Q4: /help 和 /config 怎么呼唤 modal？
- **铲屎官决策**：`/help` 打开到「命令速查」tab，`/config` 打开到「系统配置」tab。

### Q5: /config 还要打印文字吗？
- **铲屎官决策**：`/config` 只弹 modal，不再在聊天里打印文字。`/config set key value` 不变。

### Q6: 命令列表数据来源？
- **铲屎官决策**：前端命令注册表（不硬编码），新增命令时自动出现在速查里。

---

## 3. 核心决策

| 决策 | 选择 | 放弃的方案 | 理由 |
|------|------|-----------|------|
| 入口 | 扩展现有齿轮 modal | 独立页面 / 多入口 | 不增加认知负担，一个入口搞定 |
| Tab 结构 | 6 tab (原 4 + 命令速查 + 环境&文件) | 单 tab 塞所有 / 塞进系统配置 | 职责清晰，不撑爆现有 tab |
| /config 行为 | 弹 modal，不再打印文字 | 两个都保留 | 去冗余，不必向后兼容 |
| 命令数据源 | 前端 command-registry | 硬编码 / 后端 API | 项目高速迭代，注册表模式新增命令自动同步 |
| 环境变量数据源 | 后端 env-registry + API | 硬编码在前端 | env 是后端读的，后端提供当前值 |
| 文件路径 | VSCode `vscode://file` 链接 | 纯文本显示 | 铲屎官明确要求一键跳转（和审计日志一致） |

---

## 4. 设计概览

### 4.1 Tab 结构

```
布偶猫 | 缅因猫 | 暹罗猫 | 系统配置 | 命令速查 | 环境 & 文件
  (原有 4 tab 不变)          (新增)      (新增)
```

Modal 从 `max-w-2xl` 放大到 `max-w-4xl`。

### 4.2 入口

| 入口 | 行为 |
|------|------|
| 齿轮图标 | 打开 modal，默认 tab |
| `/help` | 打开 modal，定位到「命令速查」tab |
| `/config`（无参数） | 打开 modal，定位到「系统配置」tab |
| `/config set key value` | 不变，仍在聊天里显示更新结果 |

### 4.3 「命令速查」tab 内容

两个 section：

**斜杠命令**：从 `command-registry.ts` 读取，每个命令展示 name + usage + description。

**快捷键**：从 `shortcut-registry.ts` 读取，每个快捷键展示 keys + description + context。

注册表模式：新增命令/快捷键 = 往 registry 加一个对象，速查 tab 和命令处理逻辑都自动同步。

### 4.4 「环境 & 文件」tab 内容

三个 section：

**配置文件**：文件名 + 绝对路径 + 说明 + VSCode 跳转链接。

**环境变量**：按分类折叠（服务器 / 存储 / 猫猫预算 / CLI / Hindsight / 前端）。每个变量展示 name + 默认值 + 当前值 + 说明。敏感变量（密码类）脱敏显示。数据从后端 `GET /api/config/env-summary` 拉取。

**数据目录**：`~/.cat-cafe/` 系列目录 + VSCode 跳转链接。

---

## 5. 阶段划分

| 阶段 | 名称 | 主要交付 |
|------|------|---------|
| S1 | 注册表基建 | command-registry + shortcut-registry + env-registry + API |
| S2 | Modal 扩展 | CatConfigViewer → CatCafeHub, 6 tab, 放大 modal |
| S3 | 命令速查 tab | HubCommandsTab 组件，从 registry 渲染 |
| S4 | 环境 & 文件 tab | HubEnvFilesTab 组件，调 API + VSCode 链接 |
| S5 | /help + /config 改造 | useChatCommands 新增 /help，改造 /config 弹 modal |
| S6 | 测试 + 收尾 | 单元测试 + 手动验证 |

---

## 6. S1: 注册表基建

### S1.1 command-registry.ts

```typescript
// packages/web/src/config/command-registry.ts

interface CommandDefinition {
  name: string;        // e.g. '/help'
  usage: string;       // e.g. '/help'
  description: string; // e.g. '打开功能速查面板'
  category: 'general' | 'memory' | 'knowledge' | 'mode' | 'task';
}

// 所有命令在此注册，useChatCommands 和 HubCommandsTab 共用
export const COMMANDS: CommandDefinition[] = [
  { name: '/help', usage: '/help', description: '打开功能速查面板', category: 'general' },
  { name: '/config', usage: '/config', description: '打开系统配置面板', category: 'general' },
  { name: '/config set', usage: '/config set <key> <value>', description: '热更新运行时配置', category: 'general' },
  // ... 所有现有命令
];
```

### S1.2 shortcut-registry.ts

```typescript
// packages/web/src/config/shortcut-registry.ts

interface ShortcutDefinition {
  keys: string;        // e.g. '⌥V'
  description: string; // e.g. '切换语音录入'
  context: string;     // e.g. '全局' | '分屏模式'
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { keys: '⌥V (Option+V)', description: '切换语音录入', context: '全局' },
  { keys: '⌘\\ (Cmd+\\)', description: '切换单屏/分屏', context: '全局' },
  { keys: '⌘1/2/3/4', description: '选择分屏窗格', context: '分屏模式' },
];
```

### S1.3 env-registry.ts (后端)

```typescript
// packages/api/src/config/env-registry.ts

interface EnvDefinition {
  name: string;
  defaultValue: string;
  description: string;
  category: 'server' | 'storage' | 'budget' | 'cli' | 'hindsight' | 'frontend' | 'codex' | 'gemini';
  sensitive: boolean;  // true → 当前值显示 '***'
}

// 所有用户可配的 env 在此注册
export const ENV_VARS: EnvDefinition[] = [
  { name: 'REDIS_URL', defaultValue: '(未设置，回落内存)', description: 'Redis 连接地址', category: 'storage', sensitive: false },
  { name: 'API_SERVER_PORT', defaultValue: '3002', description: 'API 服务端口', category: 'server', sensitive: false },
  // ... 所有用户可配 env
];
```

### S1.4 GET /api/config/env-summary

新增轻量 API，遍历 env-registry，读取 `process.env[name]`，sensitive 的脱敏，返回给前端。

---

## 7. S2: Modal 扩展

- `CatConfigViewer.tsx` → 重命名为 `CatCafeHub.tsx`
- 新增 `defaultTab` prop（支持 `/help` 和 `/config` 指定初始 tab）
- modal `max-w-2xl` → `max-w-4xl`
- tab 列表从 4 个扩展到 6 个

---

## 8. S3: 命令速查 tab

`HubCommandsTab.tsx` 组件：
- 从 command-registry 读取命令列表，按 category 分组渲染
- 从 shortcut-registry 读取快捷键列表渲染
- 纯前端，无 API 调用

---

## 9. S4: 环境 & 文件 tab

`HubEnvFilesTab.tsx` 组件：
- **配置文件 section**：硬编码文件列表（路径从 API /api/config 获取项目根目录拼接），每个带 `vscode://file` 链接
- **环境变量 section**：调用 `GET /api/config/env-summary`，按 category 折叠展示
- **数据目录 section**：从 API 获取目录路径，每个带 VSCode 链接

---

## 10. S5: /help + /config 改造

### /help 命令
- 新增到 useChatCommands
- 触发：通过 store 或回调通知 CatCafeHub 打开，defaultTab = 'commands'

### /config 改造
- `/config`（无参数）：不再打印文字，改为触发 CatCafeHub 打开，defaultTab = 'system'
- `/config set key value`：逻辑不变，仍在聊天里显示结果

### 通信机制
useChatCommands 需要通知 modal 打开。方案：通过 chatStore 新增 `hubState: { open: boolean; tab: TabId } | null`，命令设置 store → RightStatusPanel 监听 → 弹 modal。

---

## 11. 验收标准

### 功能验收

| # | 验收项 | 验证方式 |
|---|--------|---------|
| 1 | 齿轮图标点击打开 6-tab modal | 手动验证 |
| 2 | `/help` 在聊天框输入后弹出 modal，定位到「命令速查」tab | 手动验证 |
| 3 | `/config` 弹出 modal 定位到「系统配置」tab，不在聊天里打印文字 | 手动验证 |
| 4 | `/config set cli.timeoutMs 120000` 仍在聊天里显示更新结果 | 手动验证 |
| 5 | 「命令速查」tab 展示所有斜杠命令 + 用法 + 说明 | 手动验证 |
| 6 | 「命令速查」tab 展示所有快捷键 | 手动验证 |
| 7 | 「环境 & 文件」tab 展示配置文件 + VSCode 跳转可点击 | 手动验证 |
| 8 | 「环境 & 文件」tab 展示环境变量当前值，敏感值脱敏 | 手动验证 |
| 9 | 「环境 & 文件」tab 展示数据目录 + VSCode 跳转可点击 | 手动验证 |
| 10 | 新增命令到 command-registry 后，速查 tab 自动显示 | 代码审查 |

### 测试验收

| # | 测试 | 类型 |
|---|------|------|
| 1 | command-registry 导出所有命令且无重复 name | 单元测试 |
| 2 | shortcut-registry 导出所有快捷键 | 单元测试 |
| 3 | GET /api/config/env-summary 返回正确结构 | 单元测试 |
| 4 | env-summary 脱敏 sensitive 变量 | 单元测试 |
| 5 | /help 命令被 useChatCommands 识别 | 单元测试 |
| 6 | /config（无参数）不再添加文字消息 | 单元测试 |
| 7 | /config set 仍然添加文字消息 | 单元测试 (回归) |
| 8 | 现有前端测试全绿 | 回归 |

### 不做的（YAGNI）

- 不做命令搜索/过滤（命令不到 20 个，不需要）
- 不做 env 变量在线编辑（安全风险，用 /config set 或手动改 .env）
- 不做 MCP 工具速查（已在三猫 tab 里展示）
- 不做国际化（Cat Café 是中文项目）

---

## 12. 风险与缓解

| 风险 | 缓解 |
|------|------|
| useChatCommands 从 registry 重构幅度大 | S1 只加 registry，S5 才改 useChatCommands 的 /config 逻辑，逐步推进 |
| modal 弹出通信：useChatCommands (hook) → CatCafeHub (组件) | 通过 chatStore 共享状态，避免 prop drilling |
| env-summary API 暴露敏感信息 | sensitive 字段脱敏，且 API 只在 localhost 可用 |

---

## 13. Review 检查点

| 阶段 | Review 重点 |
|------|------------|
| S1 | 注册表设计是否简洁够用、env-registry 是否覆盖全 |
| S2-S4 | 组件拆分合理性、modal UX |
| S5 | /help + /config 改造的通信机制 |
| S6 | 测试覆盖、回归无破坏 |
