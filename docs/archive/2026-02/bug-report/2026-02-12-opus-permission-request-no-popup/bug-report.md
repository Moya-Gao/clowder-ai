# Bug Report: 布偶猫权限申请未触发前端弹窗（授权事件未到达）

> 报告人：铲屎官（现象反馈）+ 缅因猫（定位修复）
> 报告日期：2026-02-12
> 严重程度：P1
> 状态：已修复

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：实际使用中观察到“布偶猫发起不了权限申请，前端没收到弹窗”。
- 复核人：缅因猫（代码链路 + 测试验证）

## 2. 复现步骤（期望 vs 实际）

1. 启动开发环境，向布偶猫下达需要敏感操作（例如 `git_commit`）的任务。
2. 布偶猫应调用 `cat_cafe_request_permission`，后端写入 pending 并通过 Socket.IO 推送 `authorization:request`。
3. 前端应显示 `AuthorizationCard` 授权卡片。

期望：
- 前端在同 thread 下收到授权请求并可批准/拒绝。

实际：
- 布偶猫侧无法稳定触发 `cat_cafe_request_permission`，前端无授权弹窗。

## 3. 根因分析（定位过程）

### 3.1 MCP 工具链未就绪

- `ClaudeAgentService` 只有在存在 `mcpServerPath` 时才注入 `--mcp-config`。
- 运行链路中没有默认设置 `CAT_CAFE_MCP_SERVER_PATH`。
- `scripts/start-dev.sh` 仅构建 `shared + api`，没有构建 `packages/mcp-server`，导致 `dist/index.js` 常态缺失。

### 3.2 结果

- 布偶猫进程无法拿到 Cat Café MCP callback 工具集合（含 `cat_cafe_request_permission`）。
- 没有权限请求调用，就不会进入 `/api/callbacks/request-permission`，自然前端收不到 `authorization:request`。

## 4. 修复方案（Why / Tradeoff）

### 4.1 实施项

1. `ClaudeAgentService` 新增默认 MCP 路径解析：在未显式配置时，自动从常见 cwd 布局解析 `packages/mcp-server/dist/index.js`。
2. `scripts/start-dev.sh` 增加 `packages/mcp-server` 构建步骤。
3. `scripts/start-dev.sh` 显式导出 `CAT_CAFE_MCP_SERVER_PATH`，并在路径缺失时打印告警。

### 4.2 Why

- 让布偶猫默认就有可用的 MCP callback 工具，不依赖人工补环境变量。

### 4.3 Tradeoff

- 启动时多一次 mcp-server 构建，换来授权链路稳定性和可预测性。

## 5. 验证方式（Red → Green）

### Red（修复前）

- `test/claude-agent-service.test.js`：新增 `resolveDefaultClaudeMcpServerPath` 测试报错（函数不存在）。
- `test/start-dev-script.test.js`：断言 `start-dev.sh` 未构建 mcp-server 且未导出 `CAT_CAFE_MCP_SERVER_PATH`。

### Green（修复后）

已通过：

- `node --test test/claude-agent-service.test.js test/start-dev-script.test.js`
- `node --test test/authorization-routes.test.js test/security-boundary.test.js`

结论：
- MCP 路径解析 + 启动脚本构建/导出链路已打通，布偶猫权限申请可进入后端授权流程，前端具备收到事件的前置条件。
