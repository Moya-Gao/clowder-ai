---
feature_ids: []
topics: [phases, debt, cleanup]
doc_kind: note
created: 2026-02-26
---

# Phase 3.6：技术债清理 + 端到端验证

> 状态：规划中
> 日期：2026-02-07
> 作者：布偶猫（Opus 4.6，CC 端）
> 触发：猫咖狼人杀 bug report（铲屎官 + 布偶猫 claude.ai 端）
> 前置：Phase 3.5 完成（329 tests），缅因猫 final review 通过
> 目标：修复所有阻塞正常使用的 bug，确认三猫能真正对话，然后才进 Phase 4
> Bug Report：`docs/archive/2026-02/bug-report/werewolf-investigation/cat-cafe-werewolf-investigation.md`

---

## 为什么需要 3.6

Phase 3.5 加了很多能力（Intent、并行、Task、Summary），但铲屎官实际用的时候发现：
**三只猫根本不知道其他猫说过什么。**

具体发现过程见 bug report，核心结论：

1. **没有历史 context assembly** — 每只猫只收到当前这一条消息（+ system prompt），不读历史
2. **Session resume 不完整** — Claude 靠 `--resume` 能记住自己说过的话，但看不到其他猫的发言；Gemini 连 resume 都没接；Codex 代码已写但需验证
3. **三猫对"能看到什么"的回答互相矛盾** — 这不是"功能不够好"，是"基础不工作"

> 铲屎官原话（意译）："在进入 phase 4 之前我们需要规划一次 3.6 完成技术债务清理以及正式的测试，确认我们真的能够运行。"

---

## 决策记录（为什么这样做，放弃了什么）

### 决策 1：Context History Assembly 的方案选择

**问题**：猫被调用时，需要知道这个对话之前发生了什么。

**备选方案**：

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A: Session Resume Only | 依赖 CLI 的 `--resume` 恢复对话上下文 | 零改动，已有 plumbing | 只有自己说过的话；跨猫历史不可见；Gemini resume 用 index 不稳定 |
| B: Prompt Prepend History | 从 messageStore 读最近 N 条消息，拼成文本 prepend 到 prompt | 简单，三猫统一 | token 开销；每次调用都重新发历史；与 session resume 可能重复 |
| C: 混合模式 | Session Resume (保持各猫自己的记忆) + Prompt Prepend (只补其他猫的发言) | 最优 context 利用率 | 实现复杂；需要标记哪些消息是"自己的" |
| D: MCP Context 工具 | 猫主动调 `get_thread_context` MCP 工具获取历史 | 猫按需获取 | 依赖猫记得调；MCP 未统一挂载 |

**选择：方案 B（Prompt Prepend History）**

**理由**：
1. **统一性** — 三猫用同一套逻辑，不用为每个 CLI 的 resume 机制做特殊处理
2. **可控性** — 我们控制发什么历史，能做截断和格式化
3. **Session Resume 保留** — 作为"bonus"，Claude 的 resume 继续工作，但不依赖它作为唯一 context 来源
4. **Gemini resume 问题规避** — Gemini CLI 的 `--resume` 用 index number（`--resume 5`）而非 UUID，多 session 并发时 index 不稳定，不可靠

**放弃方案 C 的原因**：实现复杂度不值得。Session resume 已经在工作（Claude/Codex），context prepend 覆盖了跨猫可见性需求。如果 prompt 里已经有历史，session resume 里重复也不会出错（模型会自己 dedupe）。

**放弃方案 D 的原因**：MCP 统一挂载是 P1 债务（BACKLOG #1），但现在只有 Claude 有 MCP。在 MCP 挂载完成之前，不能依赖 MCP 工具作为 context 来源。

### 决策 2：Gemini Session Resume

**铲屎官信息**：Gemini CLI 和 Codex CLI 都有 resume 功能。

**调研结果**：
- `gemini --resume` 接受 `"latest"` 或 index number（如 `--resume 5`）
- `gemini --list-sessions` 显示 sessions 带 UUID（如 `[ede61333-fc16-47f4-8b71-53b3233196f4]`）
- 但 `--resume` **不接受 UUID**，只接受 index 或 `"latest"`
- index 在多 session 时不稳定（新 session 会改变其他 session 的 index）

**代码现状**：GeminiAgentService line 152-153 注释说 "gemini CLI --resume uses local index (not UUID), incompatible"，这个判断**基本正确**但需要更新。

**选择：Phase 3.6 不修 Gemini resume**

**理由**：
1. 方案 B 的 prompt prepend 已经解决了 context 可见性问题
2. Gemini resume 用 index 不可靠，需要先调用 `--list-sessions` 再解析 UUID 到 index，增加启动延迟和脆弱性
3. 如果 Gemini CLI 未来支持 UUID resume，可以再接入

**Codex resume**：代码已写好（CodexAgentService line 114-116），`thread.started` 事件返回 `thread_id`，`sessionManager` 存取正常。但需要**实际验证**它是否工作（可能 Codex exec resume 需要特定条件）。

### 决策 3：Context Window 截断策略

**问题**：历史可能很长，prompt prepend 需要截断。

**选择**：
- 最近 20 条消息（默认），可通过环境变量 `CONTEXT_HISTORY_LIMIT` 调整
- 消息超过 500 字符时截断到 500 + "...(truncated)"
- system 类型消息跳过（错误消息不需要传给猫）
- 总 token 预算不做精确计算（Phase 4 的 BACKLOG #7），用消息条数粗略控制

**理由**：精确 token 计算需要 tokenizer（各 provider 不同），MVP 用条数控制足够。20 条 × 500 字 = 最多 ~10k 字符 ≈ ~3k tokens，在所有三猫的 context window 内安全。

### 决策 4：Redis 启动策略

**问题**：启动脚本不自动启 Redis，导致每次重启丢数据。

**选择**：
- `start-dev.sh` 的 `check_redis()` 改为：检测到 Redis 未运行时，尝试 `redis-server --daemonize yes` 自动启动
- 失败时仍 fallback 到内存（保持现有行为），但 warning 更醒目
- **不做** Redis 安装检查（brew install 等）——那是开发者环境问题，不是启动脚本的职责

### 决策 5：暗号测试 (端到端验证)

**铲屎官的发现方法**：让猫 A 说一个暗号，问猫 B 是否看到。

**选择**：把这个方法自动化为集成测试。

**测试设计**：
1. 模拟用户发消息 → 猫 A 回复（mock service 返回包含特定 token 的文本）
2. 用户发第二条消息 @ 猫 B → 验证猫 B 收到的 prompt 中包含猫 A 的特定 token
3. 这直接测试 context assembly 是否工作

---

## 实现计划

### Step 0：修复 Gemini resume 注释 + 验证 Codex resume
> 预估：~30 min，0 新增测试

**修改 GeminiAgentService.ts**：
- 更新 line 152-153 注释为更准确的描述
- 保持不使用 resume（理由见决策 2）

**验证 Codex resume**：
- 手动测试：启动 API，发消息 @缅因，记录 session_init 的 thread_id，再发第二条消息，检查 CLI args 是否包含 `exec resume <thread_id>`
- 如果 Codex resume 工作，仅需验证；如果不工作，记录原因到 BACKLOG

### Step 1：Context History Assembly
> 预估：~2 小时，~15 新增测试
> 这是 Phase 3.6 的核心改动

**新建 `packages/api/src/domains/cats/services/ContextAssembler.ts`** (~80 行)

```typescript
export interface ContextAssemblerOptions {
  /** Maximum number of recent messages to include (default: 20) */
  maxMessages?: number;
  /** Maximum characters per message content (default: 500) */
  maxContentLength?: number;
}

export interface AssembledContext {
  /** Formatted context string to prepend to prompt */
  contextText: string;
  /** Number of messages included */
  messageCount: number;
}

/**
 * Assemble recent thread history into a context string for prompt prepend.
 *
 * Format:
 * ```
 * [对话历史 - 最近 N 条]
 * [00:02 铲屎官] @布偶 你好
 * [00:02 布偶猫(opus)] 你好铲屎官！
 * [00:03 缅因猫(codex)] 我也在！
 * ---
 * ```
 */
export function assembleContext(
  messages: StoredMessage[],
  options?: ContextAssemblerOptions,
): AssembledContext;
```

**行为**：
1. 从 `messageStore.getByThread()` 读取最近 N 条消息
2. 过滤掉 `type === 'system'` 的错误消息
3. 每条消息格式化为 `[HH:MM 角色名(catId)] 内容`
4. 超长消息截断
5. 用 `---` 分隔历史和当前消息

**修改 `AgentRouter.ts`**：
- `route()` 方法在调用 `routeSerial`/`routeParallel` 之前，调用 `assembleContext()` 获取历史
- 将 `contextText` 作为参数传入 `routeSerial`/`routeParallel`
- 在构建 prompt 时，history 放在 system prompt 之后、当前消息之前：
  ```
  [system prompt (身份)]
  ---
  [对话历史 - 最近 N 条]
  ...
  ---
  [当前消息]
  ```

**修改 `invoke-single-cat.ts`**：不改。prompt 组装在 AgentRouter 层完成。

**测试 (~15)**：

`packages/api/test/context-assembler.test.js`:
- 空历史 → 空 contextText
- 1 条消息 → 正确格式化
- 20+ 条消息 → 截断到 maxMessages
- 超长消息内容 → 截断到 maxContentLength + "..."
- system 类型消息 → 被过滤
- 猫消息显示猫名，用户消息显示"铲屎官"
- 时间戳格式化正确 (HH:MM)
- 自定义 options 覆盖默认值

`packages/api/test/agent-router.test.js` (+4):
- 单猫调用时 prompt 包含历史 context
- 串行多猫调用时每只猫都收到历史
- 并行多猫调用时每只猫都收到历史
- 空历史时不添加 context 前缀

`packages/api/test/integration/` (+3):
- 发消息 → 猫回复 → 发第二条消息 → 验证猫收到的 prompt 包含第一轮的回复
- 跨猫 context：猫 A 回复后，@猫 B → 猫 B 的 prompt 包含猫 A 的回复文本
- context 截断：写入 25 条历史 → 验证猫只收到最近 20 条

### Step 2：SystemPrompt 加"不确定时说不知道"
> 预估：~20 min，+2 测试

**修改 `SystemPromptBuilder.ts`**：
- 在基础规则部分新增一条：`- 不确定时明确说"我不确定"或"我需要查证"。绝不编造信息。`

**测试 (+2)**：
- 构建的 prompt 包含"不确定"相关文案
- 所有现有 SystemPromptBuilder 测试仍通过

### Step 3：启动脚本自动启 Redis
> 预估：~15 min，0 测试（shell 脚本）

**修改 `scripts/start-dev.sh`**：
- `check_redis()` 函数改为：
  ```bash
  check_redis() {
    if redis-cli ping &> /dev/null; then
      echo -e "${GREEN}  ✓ Redis 已运行${NC}"
    else
      echo -e "${YELLOW}  ⚠ Redis 未运行，尝试启动...${NC}"
      if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes 2>/dev/null
        sleep 1
        if redis-cli ping &> /dev/null; then
          echo -e "${GREEN}  ✓ Redis 已启动${NC}"
        else
          echo -e "${RED}  ✗ Redis 启动失败 (将使用内存存储，重启丢数据)${NC}"
        fi
      else
        echo -e "${RED}  ✗ Redis 未安装 (将使用内存存储，重启丢数据)${NC}"
        echo -e "${YELLOW}    安装: brew install redis${NC}"
      fi
    fi
  }
  ```

### Step 4：聊天记录导出 Markdown
> 预估：~1 小时，~6 测试
> bug report 的 P1 新功能需求

**新建 `packages/api/src/routes/export.ts`** (~70 行)

```
GET /api/export/thread/:threadId?format=md
```

**行为**：
1. 从 messageStore 读取该 thread 所有消息
2. 格式化为 Markdown（见 bug report 4.2 节的格式）
3. 包含：对话 ID、时间范围、参与猫猫、每条消息的时间 + 角色 + provider/model 标签 + 完整内容
4. 响应头设置 `Content-Disposition: attachment` 触发下载

**复用 ContextAssembler 格式化逻辑**（claude.ai 布偶猫建议）：
- ContextAssembler 和 export 都做"消息→文本"转换
- 提取共享的 `formatMessage(msg)` 函数到 ContextAssembler 模块
- export 调用同一函数，增加 metadata/完整内容等导出专用字段
- 避免两处维护同样的格式化逻辑

**前端**：
- ThreadSidebar 中每个 thread 添加"导出"按钮（小图标）
- 点击触发 `window.open(exportUrl)` 下载

**测试 (~6)**：
- 正常导出包含所有消息
- 空 thread → 空文件 / 只有 header
- 包含猫消息和用户消息
- metadata 标签正确显示
- threadId 不存在 → 404
- 时间格式正确

### Step 5：暗号测试（端到端集成测试）
> 预估：~1 小时，+4 集成测试
> 验证 Step 1 的 context assembly 真正工作

**新建 `packages/api/test/integration/cross-cat-context.test.js`**

测试场景：

1. **暗号传递**：mock 猫 A 回复含 `SECRET_TOKEN_12345` → @猫 B → 验证猫 B 的 `service.invoke()` 收到的 prompt 包含 `SECRET_TOKEN_12345`
2. **三猫暗号**：mock 猫 A 和猫 B 依次回复含各自暗号 → @猫 C → 验证猫 C 看到两个暗号
3. **历史可见**：连续 3 轮对话 → 第 4 轮 @新猫 → 验证新猫看到前 3 轮
4. **截断验证**：写入 25 条消息 → 验证只有最近 20 条出现在 prompt 中

### Step 6：BACKLOG 更新 + 缅因猫 Review
> 预估：~20 min

**更新 BACKLOG.md**：
- 标记完成的项
- 新增发现的债务
- 更新 Phase 状态

**写 Review 交接**：
- `docs/archive/2026-02/mailbox/2026-02-07/2026-02-07-phase3.6-review.md`
- 按协作守则 5 项：What/Why/Tradeoff/Open Questions/Next Action

---

## 预估汇总

| Step | 内容 | 新增测试 |
|------|------|----------|
| 0 | Gemini 注释修复 + Codex resume 验证 | 0 |
| 1 | Context History Assembly（核心） | ~15 + 4 + 3 = ~22 |
| 2 | SystemPrompt "不确定时说不知道" | 2 |
| 3 | 启动脚本自动启 Redis | 0 |
| 4 | 聊天记录导出 Markdown | ~6 |
| 5 | 暗号测试（端到端验证） | 4 |
| 6 | BACKLOG + Review | 0 |
| **合计** | | **~34 新增测试 → ~363 total** |

---

## 文件清单

### 新增文件 (3)

| 文件 | 行数 | 用途 |
|------|------|------|
| `packages/api/src/domains/cats/services/ContextAssembler.ts` | ~80 | 历史 context 组装 |
| `packages/api/src/routes/export.ts` | ~70 | 聊天记录导出 API |
| `packages/api/test/integration/cross-cat-context.test.js` | ~120 | 暗号测试 |

### 修改文件 (7)

| 文件 | 改动 |
|------|------|
| `AgentRouter.ts` | 调用 ContextAssembler, 将历史传入 routeSerial/routeParallel |
| `SystemPromptBuilder.ts` | 加"不确定时说不知道"规则 |
| `GeminiAgentService.ts` | 更新 resume 注释 |
| `scripts/start-dev.sh` | check_redis() 自动启 Redis |
| `packages/api/src/index.ts` | 注册 export route |
| `packages/web/src/components/ThreadSidebar.tsx` | 导出按钮 |
| `docs/BACKLOG.md` | 更新 |

---

## 验证方案

### 每步验证
```bash
cd packages/shared && npm run build
cd packages/api && npm run build && npm test
cd packages/api && npm run test:integration
cd packages/web && npm run build
```

### 最终验证（人工暗号测试）
1. 启动 API + Web
2. 发送 `@布偶 今天密码是：Phase 3.6 完成`
3. 等布偶猫回复
4. 发送 `@暹罗 布偶猫刚才说的密码是什么？`
5. **暹罗猫必须能复述密码** ← 这是 Phase 3.6 的 acceptance criteria
6. 发送 `@缅因 你能看到前面两只猫说了什么吗？`
7. **缅因猫必须能列出前面的对话内容**

---

## 边界情况和风险

| 场景 | 处理方式 |
|------|----------|
| messageStore 为空 | contextText 为空，不 prepend |
| 单猫无历史 | 正常，只有当前消息 |
| prompt 超长（历史 + system + 当前） | maxMessages 限制 20 条，硬上限 ~10k 字符 |
| Session resume + context prepend 重复 | 可接受，模型会自动 dedupe |
| Redis 未运行 | 内存 fallback，重启丢数据（已有 warning） |
| Codex resume 不工作 | 不阻塞——prompt prepend 是主要 context 来源 |
| 导出超大 thread | 一次性读取全部消息，内存安全（单 thread 上限 ~10k 条） |

---

## Phase 3.6 完成标准

- [ ] 三猫都能在对话中看到其他猫的历史发言（暗号测试通过）
- [ ] 启动脚本自动尝试启动 Redis
- [ ] 聊天记录可导出为 Markdown
- [ ] SystemPrompt 包含"不确定时说不知道"
- [ ] ~34 新增测试，全部通过
- [ ] 缅因猫 review 通过
- [ ] BACKLOG 更新

完成后方可进入 Phase 4。
