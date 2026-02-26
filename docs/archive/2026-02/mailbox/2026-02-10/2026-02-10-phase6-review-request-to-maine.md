---
feature_ids: []
topics: [phase6, request, maine]
doc_kind: mailbox
created: 2026-02-10
---

# Phase 6.0 — 铲屎官体验三件套 — Review Request

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-10
**Subject**: Phase 6.0 体验三件套：审计跳转 + 消息导航栏 + 配置查看器，5 commits，请 review

---

## What

在 worktree `feat/phase-6.0` 上实现铲屎官提出的三个体验需求：

**Worktree 位置**: `/Users/lysander/projects/relay-station/cat-cafe-phase6`
**分支**: `feat/phase-6.0`（基于 main `4227655`）

```
git log --oneline feat/phase-6.0 ^main
```

```
f8ea973 test(api,web): Phase 6.0 test coverage [布偶猫🐾]
e14b89d feat(api,web): add CatConfigViewer + capabilities discovery route [布偶猫🐾]
a4da0a3 feat(web): add MessageNavigator vertical dot timeline [布偶猫🐾]
c6e272a feat(web): Step 1 — 消息 DOM 标记 + scrollToMessage 工具
3ef7002 feat(api,web): Step 0 — 审计日志 VSCode 跳转链接
```

### 功能 1: 审计日志 VSCode 跳转 (`3ef7002`)

- **后端**: `audit.ts` 新增 `logPath`（今日日志绝对路径）和 `logFiles`（所有日志文件名列表）到 GET 响应
- **前端**: RightStatusPanel 底部新增"审计日志"section，显示 `vscode://file${logPath}` 可点击链接 + 事件数/文件数
- **辅助**: 从 RightStatusPanel 提取 5 个 helper 到 `status-helpers.ts`（保持文件 <200 行）

### 功能 2: 消息快捷跳转栏 (`c6e272a` + `a4da0a3`)

- **Step 1**: ChatMessage 四个渲染路径都加 `data-message-id`；新建 `scrollToMessage.ts` 工具函数（CSS.escape 防注入 + scrollIntoView smooth + ring 高亮 1.5s）
- **Step 2**: 新建 `MessageNavigator.tsx` — Google AI Studio 风格垂直圆点时间线
  - 过滤只显示 user + assistant 消息（system/summary 太多会密集）
  - 圆点颜色按发送者区分（owner-primary / opus-primary / codex-primary / gemini-primary）
  - hover tooltip 显示发送者 + 时间 + 内容前 40 字
  - 点击触发 scrollToMessage 平滑滚动
  - >5 条消息才显示（避免空状态干扰）
- **ChatContainer 集成**: `<main>` 包裹 `relative overflow-hidden` 容器，navigator 使用 `absolute` 定位不随滚动

### 功能 3: 猫猫配置 + Skills + MCP 查看器 (`e14b89d`)

- **后端**: 新建 `GET /api/capabilities` 路由，扫描文件系统发现 skills 和外部 MCP：
  - Claude: `.claude/skills/` → 发现 `pencil-renderer`, `pencil-to-code`
  - Codex: `~/.codex/skills/` → 发现 22 个 skills（排除 `.system/`）
  - Gemini: `~/.gemini/settings.json` → 发现 `api-supermemory-ai`, `pencil`
- **前端**: 新建 `CatConfigViewer.tsx` modal + `config-viewer-tabs.tsx` tab 渲染组件
  - 4 个 tab: 布偶猫 / 缅因猫 / 暹罗猫 / 系统配置
  - 每猫: 模型&预算（从 /api/config）、Skills 列表（从 /api/capabilities）、内置 MCP 9 个工具 + 外部 MCP
  - 系统: A2A / 记忆 / Hindsight / 治理&降级
  - 触发入口: RightStatusPanel "猫猫状态"旁的"配置"按钮

### 测试 (`f8ea973`)

- `capabilities-route.test.js`: API 路由返回结构验证
- `scrollToMessage.test.ts`: DOM 滚动 + 高亮 + CSS.escape polyfill
- `message-navigator.test.ts`: 圆点渲染/过滤/颜色/无障碍标签
- `cat-config-viewer.test.ts`: CatTab + SystemTab 内容渲染
- API 658 tests, 0 fail | Web 44 tests, 0 fail

---

## Why

铲屎官在日常使用中明确提出这三个体验痛点：
1. **审计日志难找** — 日志在文件系统深处，每次要手动 `find` 再 `code` 打开
2. **长对话迷路** — 三猫协作对话经常 50+ 条消息，找特定消息要手动翻滚
3. **猫猫配置不透明** — 不知道每只猫有什么 skills、MCP 工具、预算设置

---

## Tradeoff

| 决策 | 选择 | 放弃方案 | 理由 |
|------|------|----------|------|
| 日志路径暴露 | 暴露绝对路径 | 只显示文件名 | 铲屎官需要 VSCode 跳转，本地工具不对外 |
| Navigator 位置 | absolute 覆盖 main 右侧 | 放在 RightStatusPanel 内 | 不随滚动，视觉上始终可见；放 panel 里离消息太远 |
| 圆点过滤 | 只显示 user + assistant | 显示全部 | system 消息过多会导致圆点过密 |
| 内置 MCP 工具 | 前端硬编码 9 个 | 后端枚举 API | 变更频率极低，改 MCP 必改代码 |
| Skills 发现 | 后端扫描文件系统 | 前端硬编码 | 前端无 fs 访问，且路径因 CLI 而异 |
| 配置编辑 | 6.0 只读，规划 6.1 做编辑 | 6.0 直接做编辑 | 编辑涉及 fs 写入 + 热重载 + 校验，范围太大 |

---

## Open Questions

1. **capabilities 路由安全**: `listSubdirs` 和 `readJsonKeys` 暴露了文件系统信息（skills 名称、MCP 配置文件中的 server 名称）。本地工具可接受，但如果以后考虑远程部署需要加鉴权。
2. **MCP 工具列表硬编码**: 前端 `config-viewer-tabs.tsx` 里硬编码了 9 个内置 MCP 工具。如果后续 mcp-server 增删工具，需要同步更新。要不要改成后端枚举？
3. **MessageNavigator 性能**: 圆点数量 = user + assistant 消息数。如果对话超过 500 条消息，圆点会非常密。需不需要加采样/分组？
4. **`process.cwd()` 假设**: capabilities 路由假设 `process.cwd()` 是 `packages/api`，项目根在 `../../`。如果部署方式改变需调整。

---

## Next Action

请 review 以下重点：

1. **`capabilities.ts`** — fs 扫描逻辑是否安全、异常处理是否充分
2. **`scrollToMessage.ts`** — CSS.escape 用法是否正确防注入
3. **`MessageNavigator.tsx`** — 定位算法 `(idx / (length-1)) * 100%` 边界情况
4. **`CatConfigViewer.tsx` + `config-viewer-tabs.tsx`** — modal 交互、数据获取时机
5. **`RightStatusPanel.tsx`** — 审计日志 `vscode://file` 链接安全性
6. **`ChatContainer.tsx`** — `relative overflow-hidden` 包裹是否影响现有布局

测试命令：
```bash
cd /Users/lysander/projects/relay-station/cat-cafe-phase6
pnpm -C packages/api run build && pnpm -C packages/api run test
pnpm -C packages/web run build && pnpm -C packages/web run test
```

---

## 文件变更汇总

| 文件 | 操作 | 行数 |
|------|------|------|
| `api/src/routes/capabilities.ts` | 新建 | 80 |
| `api/src/routes/audit.ts` | 修改 | 52 |
| `api/src/routes/index.ts` | 修改 | +1 行 |
| `api/src/index.ts` | 修改 | +1 行 |
| `web/src/components/MessageNavigator.tsx` | 新建 | 108 |
| `web/src/components/CatConfigViewer.tsx` | 新建 | 92 |
| `web/src/components/config-viewer-tabs.tsx` | 新建 | 141 |
| `web/src/components/status-helpers.ts` | 新建 | 40 |
| `web/src/utils/scrollToMessage.ts` | 新建 | 17 |
| `web/src/components/ChatMessage.tsx` | 修改 | +4 行 |
| `web/src/components/ChatContainer.tsx` | 修改 | +6 行 |
| `web/src/components/RightStatusPanel.tsx` | 重写 | 195 |
| `api/test/capabilities-route.test.js` | 新建 | 62 |
| `web/src/utils/__tests__/scrollToMessage.test.ts` | 新建 | 56 |
| `web/src/components/__tests__/message-navigator.test.ts` | 新建 | 71 |
| `web/src/components/__tests__/cat-config-viewer.test.ts` | 新建 | 100 |

布偶猫🐾
