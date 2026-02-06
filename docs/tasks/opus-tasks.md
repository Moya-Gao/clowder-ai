# 布偶猫（Opus）任务清单

> 角色：主架构师 + 核心开发
> 工具：Claude Code / CLI subprocess + MCP tools
> 更新日期：2026-02-06（Phase 2.5 完成后）

---

## 当前状态

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 0 | ✅ 完成 | 地基已建好，缅因猫 review 通过 |
| Phase 1 | ✅ 完成 | 单猫通信，缅因猫 review 通过 |
| Phase 2 | ✅ 完成 | 三猫接入，缅因猫 review 通过 |
| Phase 2.5 | ✅ 完成 | SDK → CLI 迁移，120 tests |
| Phase 3 | 🔜 待开始 | 完整体验 |

---

## 技术债务 (Phase 3 前需关注)

### P1 - 必须做
- [ ] **MCP 工具接入**: 把文件操作切到共享 MCP Server
- [ ] **Session 迁移 Redis**: AgentRouter 的内存 session

### P2 - 建议做
- [ ] **循环依赖**: `routes/messages.ts` import `getSocketManager()` 从 `index.ts`
  - 方案: 用 Fastify decorate 或工厂函数
- [ ] **AgentRouter 错误处理**: 服务抛异常时需要 try-catch

### P3 - 可选
- [ ] **requestId**: POST /api/messages 返回 requestId，避免并发串流
- [ ] 移除未使用的 `@fastify/websocket`

---

## 职责概述

1. **架构设计**：定义系统结构、领域模型、API 契约
2. **后端开发**：实现 API、MCP Server、Agent Services
3. **前端开发**：实现 Next.js 页面和组件
4. **CLI 集成**：实现三只猫的 Agent Service（CLI 子进程 + MCP 回传）

---

## 开发阶段

### Phase 0: 地基（优先级：P0）✅ 已完成

**目标：搭建 monorepo 和核心基础设施**

- [x] **项目初始化** - pnpm monorepo 结构
- [x] **共享类型包 `@cat-cafe/shared`** - Branded types, Zod schemas
- [x] **MCP Server 基础** - read_file, write_file, list_files (带 symlink 安全验证)
- [x] **Redis 连接** - SessionStore 类
- [x] **~/.cat-cafe/ 目录初始化** - init-cafe.sh 脚本

**缅因猫 Review 修复：**
- symlink 绕过漏洞 (realpath 验证)
- start-dev.sh 检查 package.json 存在
- 分隔符统一支持 `,` 和 `:`

---

### Phase 1: 单猫通信（优先级：P0）✅ 已完成

**目标：实现布偶猫的完整调用链路**

- [x] **ClaudeAgentService 实现** - CLI 子进程模式 (`claude --output-format stream-json`)
- [x] **API 路由** - POST/GET /api/messages, GET /api/cats
- [x] **WebSocket 实时通信** - Socket.io 绑定到 Fastify server
- [x] **前端聊天界面** - ChatContainer, ChatMessage, ChatInput, useSocket, chatStore

**缅因猫 Review 修复：**
- Socket.io 绑定修复 (5b8a9ba)
- 安全边界: 默认 127.0.0.1, 禁用 Bash, permissionMode: dontAsk (54faf15)
- ESLint 配置 + 错误字段修复 (fa9238e)
- 安全测试: `packages/api/test/security-boundary.test.js`

**架构决策：**
- 弃用 SSE，改用 Socket.io 支持双向通信
- `allowedTools` 只保留 Read/Edit/Glob/Grep (无 Bash)

---

### Phase 2: 三猫接入（优先级：P1）✅ 已完成

**目标：接入缅因猫和暹罗猫**

- [x] **CodexAgentService 实现**
  - CLI 子进程模式 (`codex exec --json`)
  - 支持 session resume (`codex exec resume`)
  - 依赖注入支持测试
  - 10 个单元测试

- [x] **GeminiAgentService 实现**
  - 双 adapter：`gemini-cli` (headless) / `antigravity` (IDE + MCP 回传)
  - `GEMINI_ADAPTER=antigravity|gemini-cli` 环境变量切换
  - 16 个单元测试

- [x] **AgentRouter 实现**
  - @ 提及解析（中英文，大小写不敏感）
  - 无提及默认路由到布偶猫
  - 多猫串行调用，后一只猫收到前一只的回复
  - Session 管理（内存，待迁移 Redis）
  - 16 个单元测试

- [x] **前端多猫支持**
  - ChatContainer 正确处理不同 catId 的消息
  - ChatMessage 根据 catId 显示不同颜色和名称

- [x] **MCP 回传工具**（Phase 2.5 Task 5 实现）
  - [x] `cat_cafe.post_message` - 主动发言
  - [x] `cat_cafe.get_pending_mentions` - 感知 @ 消息
  - [x] `cat_cafe.get_thread_context` - 获取对话上下文

**验收标准：** ✅
- `@布偶` `@缅因` `@暹罗` 都能正确路由
- 多猫协作能串行执行

**技术决策：**
- SDK → CLI 子进程模式（Phase 2.5 迁移，原因：订阅额度）
- Gemini 双 adapter：gemini-cli + antigravity
- Session 暂存内存 → Phase 3 迁移到 Redis

---

### Phase 3: 完整体验（优先级：P2）

**目标：提升用户体验**

- [ ] **发图片功能**
  - [ ] 拖拽/粘贴上传
  - [ ] 存储到 `~/.cat-cafe/assets/`
  - [ ] 消息中嵌入图片

- [ ] **猫猫状态显示**
  - [ ] 状态追踪服务
  - [ ] 前端状态组件
  - [ ] 实时更新

- [ ] **历史记录**
  - [ ] 按日期分组
  - [ ] 无限滚动加载
  - [ ] 搜索功能

- [ ] **视觉资产集成**
  - [ ] 集成暹罗猫设计的头像
  - [ ] 集成表情包
  - [ ] 应用配色方案

**验收标准：**
- 能发送图片
- 能看到猫猫状态
- 能浏览历史记录
- 视觉风格温馨

---

### Phase 4: 高级功能（优先级：P3）

- [ ] 共享文件系统 UI
- [ ] Git 集成
- [ ] 任务看板

---

## 代码审查检查点

每完成一个 Phase，提交给缅因猫审查：

| Phase | 审查重点 |
|-------|----------|
| Phase 0 | 项目结构、类型定义、MCP 安全 |
| Phase 1 | CLI 集成、WebSocket 安全、Session 管理 |
| Phase 2 | 多 CLI 协调、错误处理、降级策略 |
| Phase 3 | 文件上传安全、性能优化 |

---

## 注意事项

### 可维护性守则
1. **文件大小**：每个文件控制在 200 行以内
2. **命名规范**：函数名要自解释
3. **类型安全**：禁止使用 `any`
4. **测试先行**：核心逻辑写单元测试
5. **文档同步**：修改架构时更新设计文档
6. **架构清理**：架构调整后，移除废弃依赖和死代码，确保代码库与当前架构一致

### CLI 集成守则
1. 每个 CLI 独立封装在 `AgentService` 类中，使用 `CliTransformer` 解析输出
2. 使用统一的 `AgentMessage` 接口
3. 异常处理要完善，不能让 CLI 错误传播到前端
4. `spawnCli()` 统一管理超时、abort、僵尸进程防护

### 已知坑位
1. **CLI 启动开销**：每次 spawn ~500ms-2s，可考虑进程池
2. **NDJSON 格式变化**：CLI 升级可能改变输出格式，需版本锁定 + 容错解析
3. **Antigravity 回传**：MCP callback 可能无响应，需 gemini-cli fallback

---

## 与其他猫的协作

- **完成一个 Phase 后**：@ 缅因猫做 code review
- **需要视觉资产时**：检查 assets/ 或 @ 暹罗猫
- **重要决策**：记录到 docs/decisions/
- **遇到 CLI 问题**：记录到 docs/decisions/ 并讨论降级方案

---

## 参考资源

- 设计文档：`docs/plans/2026-02-04-cat-cafe-design.md`
- 架构决策：`docs/decisions/001-agent-invocation-approach.md`
- 研究报告：`research-report/` 目录

---

*布偶猫加油！写出让缅因猫无话可说的代码！*
