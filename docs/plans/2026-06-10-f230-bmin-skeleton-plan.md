# F230 Phase B-min Skeleton Implementation Plan

**Feature:** F230 — `docs/features/F230-claude-interactive-pty-carrier.md`
**Goal:** 6/15 前把 `interactive_pty` 第四档 carrier 做到"可切换状态"——factory 注册 + 真实端到端 smoke 通过，零默认流量（KD-6：runway 小时级撑不住事后 fast-track）。
**Acceptance Criteria（B-min 范围，from spec）:**
- AC-B1: `ClaudeInteractivePtyCarrierService` 过 factory 注册，`CAT_CAFE_CLAUDE_CARRIER=interactive_pty` 端到端真实 smoke（订阅 token + transcript `entrypoint` 实采记录）
- AC-B3: MCP parity：`--mcp-config --strict-mcp-config` + 真实 `cat_cafe_*` 调用 smoke
- AC-B4: `--permission-mode bypassPermissions` parity + regression test
- AC-B5: cancel 语义实现 + 测试：mid-stream cancel → 进程干净退出 + UI 正确收尾
- AC-B7: 零阻塞 F198 主线——不碰 `-p`/bg 路径共享代码除 factory 注册点
**NOT building（B-full/C/D，gated）:** golden parity 全量（AC-B2）、alpha 多轮剧本（AC-B6）、常驻形态、sessionChain 接入、oversight 联动、fallback 链注册。
**Architecture cell:** F143 Hostable Agent Runtime | **Map delta:** update required | **why:** ProcessModel 增加 `interactive_pty` 第四类 carrier（与 `-p`/`bg_daemon`/`api_key` 平级）——Task 6 带 ownership map 一行更新
**Architecture:** tmux 驱动 PTY 输入面（spike 同构）+ `TranscriptTailer` 旁路输出面（100% 复用）。per-invocation 形态：每 invocation 起独立 tmux session，终态后 dispose。
**Tech Stack:** tmux（不用 node-pty——spike 已验证全机制 + F089 pane oversight 天然免费 + 进程由 tmux server 托管；node-pty 留 Phase C 常驻形态再评估）、`TranscriptTailer`/`BgTranscriptEventConsumer`/`transformClaudeEvent` 复用
**前端验证:** No（无 UI 改动）

**真相源输入：** spike 报告 `docs/research/2026-06-10-f230-pty-carrier-spike-report.md`（实施清单 P1-P7 + §5b 时延数据）+ fixture `docs/features/assets/F230/phase-a-spike-day1-fixtures-2026-06-10.md`

---

## 核心设计决策（已拍，sonnet 不用纠结）

| # | 决策 | 依据 |
|---|------|------|
| D1 | PTY 驱动 = **tmux**，session 名 `f230pty-<invocationId 短哈希>`，`dispose()` 必 `kill-session`（防僵尸，LL-056） | spike 全机制同构验证；F089 集成免费 |
| D2 | **注入 ack = watch transcript user 事件落盘**（E5: prompt→落盘 p50 0.11s），不用固定 sleep | 同时解决长 prompt 背压（砚砚 §7#2 关切）+ 等待时间确定性 |
| D3 | env 处理走 `buildClaudeEnvOverrides`（`ClaudeAgentService.ts:179`）同款 null→delete 语义，**必须 delete `CLAUDE_CODE_ENTRYPOINT`/`CLAUDECODE`** | spike P1 污染实证——漏了 = 计费身份变 sdk-cli |
| D4 | 终态判定 = transcript 终轮事件（`turn_duration` 类 system 事件，bg PR #1798 同款信号）+ tail 静默超时兜底 | interactive 无 state.json，transcript 是唯一真相源 |
| D5 | cancel 机制由 Task 1 探针实测定（SIGINT vs ESC 注入 vs kill-session 三方案对照） | OQ-8；选"transcript 完整落盘 + 进程干净退"者 |
| D6 | smoke/测试 cwd 用独立临时目录（transcript slug 隔离，E5 模式），**不污染主仓/runtime slug** | 测试卫生 |

---

## Task 0: Worktree + 基线

1. main 双向同步检查（ahead=0 behind=0）→ `git worktree add ../cat-cafe-f230-bmin -b feat/F230-bmin-skeleton`
2. `.env.local`: `REDIS_URL=redis://localhost:6398` + `WORKTREE_PORT_OFFSET=-30`（避开其他 worktree）
3. `env -u NODE_ENV pnpm install` → `pnpm --filter @cat-cafe/api test` 基线绿
4. Commit 起点确认：`git log --oneline -1`

## Task 1: Cancel 语义探针（时间盒 1h，spike 性质）

**目的：** 关 OQ-8，给 Task 2 的 `cancel()` 实现拍板。
**方法：** tmux 手工起 claude（干净 env + 临时 cwd），注入一个会跑 ~30s 的 prompt（如"数到 50，每个数字单独一行解释"），mid-stream 分别试：
- 方案 A：`tmux send-keys Escape`（claude TUI 原生中断键）
- 方案 B：`kill -INT <claude_pid>`
- 方案 C：`tmux kill-session`（核弹兜底）

**判据表（每方案记录）：** transcript 是否写入中断前内容？进程是否退出/回到 ❯？退出码？再 `--resume` 是否正常？
**产出：** 结论写进 Task 2 `cancel()` 注释 + commit message；fixture 摘录追加到 `docs/features/assets/F230/`。
**预判（仅供参考，以实测为准）：** Esc 大概率是正解（TUI 原生 stop，session 保活可续）；SIGINT 可能整个退出；kill-session 必丢 in-flight。

## Task 2: `PtyDriver` — tmux wrapper（输入面核心）

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/pty/PtyDriver.ts`
- Test: `packages/api/test/f230-pty-driver.test.js`（真 tmux integration test；文件头部探测 `tmux -V`，不可用则 `t.skip`——CI 无 tmux 不红）

**API 形状（终态 schema，直接进 final system）：**

```typescript
export interface PtyDriverOptions {
  cwd: string;
  env: Record<string, string | undefined>;   // 已过 buildChildEnv 处理（null 已 delete）
  claudeBinary?: string;                       // default 'claude'
  resumeSessionId?: string;                    // → `claude --resume <id>`
  extraArgs?: string[];                        // --mcp-config 等，Task 4 注入
  readyTimeoutMs?: number;                     // default 30_000（spike 实测 ready 10-15s）
}

export class PtyDriver {
  constructor(private readonly opts: PtyDriverOptions) {}
  /** tmux new-session + 启动 claude；resolve 于 TUI ready（探测见实现注记 1） */
  async start(): Promise<void>;
  /** bracketed paste 注入 + 两段式 Enter + transcript user 事件落盘 ack（实现注记 2） */
  async injectPrompt(text: string, transcriptDir: string): Promise<{ transcriptPath: string; sessionId: string }>;
  /** Task 1 选定机制；中断后进程回 idle 或退出 */
  async cancel(): Promise<void>;
  /** /exit + kill-session 双保险；幂等 */
  async dispose(): Promise<void>;
}
```

**实现注记（spike 实证，照抄不重新发明）：**
1. **ready 探测**：不读屏幕语义，用"启动后轮询 `tmux list-panes` 存活 + 固定 grace（spike: ready 10-15s）"起步；若 Task 1 发现更确定的信号（如 claude 进程 fd 状态）可换。**ready 不阻塞 sessionId 捕获**（D2——jsonl 在 prompt 后才出现，E5 实证 spawn 阶段无文件）。
2. **injectPrompt 三步**：① `tmux load-buffer <tmpfile>` + `paste-buffer -p -t <session>`（200KB 实证一字不差）② sleep ≥2s（TUI 渲染消化；50K→6s/200K→12s 起步值，按 `len/15KB` 秒自适应）③ 单独 `send-keys Enter`（连发会被吞，spike E1 实证）→ ④ fs.watch `transcriptDir` 新 `.jsonl`（≤5s 超时；p50 0.11s）→ 返回 `{transcriptPath, sessionId: basename}`。resume 模式下文件已存在 → watch 改为 stat mtime 变更。
3. **env**：spawn shell 内显式 `unset CLAUDE_CODE_ENTRYPOINT CLAUDECODE`（双保险——即使 caller 已 delete，tmux server 环境仍可能带）。

**TDD 步骤：**
1. RED: `start→dispose` 留下 0 个 tmux session（`tmux ls | grep f230pty` 为空）→ 实现 → GREEN → commit
2. RED: `injectPrompt` 短 prompt 返回 sessionId 且 transcript 含该 prompt 文本 → 实现 → GREEN → commit
3. RED: `injectPrompt` 60KB prompt transcript user 消息字节数 === 注入字节数（E2 标准）→ GREEN → commit
4. RED: `cancel()` 后进程不再 RUNNING 且 transcript 文件完整 JSON 行（无半行）→ 按 Task 1 结论实现 → GREEN → commit

## Task 3: `ClaudeInteractivePtyCarrierService`（AgentService 实现）

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/ClaudeInteractivePtyCarrierService.ts`
- Test: `packages/api/test/f230-interactive-pty-carrier.test.js`

**形状（对齐 `ClaudeBgCarrierService.ts:115` 模式）：**

```typescript
export class ClaudeInteractivePtyCarrierService implements AgentService {
  constructor(opts: { catId: CatId; /* test seams: pollIntervalMs, terminalTimeoutMs */ }) {}
  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    // 1. buildClaudeEnvOverrides + buildChildEnv（复用，单一真相源）
    // 2. driver.start() → driver.injectPrompt() → { transcriptPath, sessionId }
    // 3. yield session_init（cliSessionId = sessionId —— E4: resume 原地续写，天然稳定 id）
    // 4. TranscriptTailer(transcriptPath).readNew() 轮询 → transcriptEntriesToAgentMessages（复用）
    //    → yield text / tool_use / system_info（与 bg 同一转换层，不复制）
    // 5. 终态：D4 信号（turn_duration 类事件；先从 spike transcript fixture grep 实采形状
    //    —— ~/.claude/projects/-Users-…-f230-pty-spike/ 两个 jsonl 还在，直接看）
    //    + 静默兜底（tail 无新行 > terminalTimeoutMs）
    // 6. yield done + usage（finalizeTranscriptUsage 复用）；finally: driver.dispose()
    // 7. options.signal（abort）→ driver.cancel() → yield error/done 收尾（AC-B5）
  }
}
```

**TDD 步骤（mock driver + 真 transcript fixture 喂 Tailer）：**
1. RED: 喂 spike 真实 transcript fixture → invoke 产出 session_init→text→done 序列 + usage 非零 → GREEN → commit
2. RED: abort signal mid-tail → cancel 调用 + 流以 done/error 干净收尾（不悬挂）→ GREEN → commit
3. RED: transcript 含 tool_use 事件 → AgentMessage 流含 tool_use（R2 oversight 硬约束）→ GREEN → commit
4. RED: driver.start 抛错 → yield error + done，无僵尸 session → GREEN → commit

## Task 4: Factory 注册 + flags parity

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/claude-carrier-factory.ts`（新增 `CARRIER_INTERACTIVE_PTY = 'interactive_pty'` 分支——唯一碰共享代码的点，AC-B7）
- Modify: `ClaudeInteractivePtyCarrierService.ts`（args 构建）
- Test: 扩展现有 factory 测试 + carrier args 测试

**Parity 清单（F198 血泪，全部 regression test pin）：**
- `--permission-mode bypassPermissions`（AC-B4——bg Phase D P1#1 同款坑：漏了 = detached TTY 弹 prompt 卡死）
- `--mcp-config <path> --strict-mcp-config`（AC-B3——bg Step 4 同款：不带 strict 会加载 cwd 发现的全部 servers）
- model selection 走 `resolveClaudeModelSelection`（复用）
- env 走 D3

**TDD：** RED: factory env=`interactive_pty` 返回 `ClaudeInteractivePtyCarrierService`；默认/`bg_daemon` 行为不变（回归 pin）→ GREEN → commit。args 含上述 flags 的单测 → commit。

## Task 5: 真实端到端 smoke（AC-B1 + AC-B3 收口）

**Files:** Create: `packages/api/scripts/f230-pty-smoke.mjs`（操作员脚本，进 repo 可复跑）

流程：临时 cwd（写入仅含 cat-cafe MCP 的 mcp-config）→ factory 造 service → invoke "调用 cat_cafe_search_evidence 搜 F230 然后只回 SMOKE_OK" → 断言流含 tool_use(cat_cafe_*) + 终文本 SMOKE_OK + usage 非零 → **身份 capsule 落盘**（argv/TTY/version/auth/entrypoint 实采，AC-A0 格式）→ fixture 存 `docs/features/assets/F230/bmin-smoke-<date>.md`。
**预期 entrypoint = `cli`**；若非 → P0 停下查 env 链（先查自己命令，再怀疑环境）。

## Task 6: Gate + 文档同步

1. `pnpm gate`（worktree 内，注意 CWD 显式 `cd /abs &&`）
2. F230 spec：AC-B1/B3/B4/B5/B7 勾 + Timeline + OQ-8 关闭（Task 1 结论）
3. `docs/architecture/ownership/` F143 cell 加 `interactive_pty` 一行（Map delta 兑现）
4. Commit + push（spec 改动 main 上同步——worktree 内 docs 改动随 PR 走）

## Task 7: Request-review

`request-review` skill 五件套 → **@codex（砚砚 GPT-5.5）**——CVO 钦点本线 reviewer（F230 KD-4，不降级 gpt52）。Review pass → merge-gate → **Fable-5 愿景守护**（非作者非 reviewer ✓）。

---

## Open Questions

| 类型 | 问题 | 处置 |
|------|------|------|
| 技术 | 终态事件实采形状（turn_duration?） | Task 3 步骤 5 从 spike fixture grep，sonnet 自决 |
| 技术 | cancel 三选一 | Task 1 探针，sonnet 自决 |
| 技术 | ready 探测是否需要比 grace 更强的信号 | Task 2 注记 1，够用就不优化（YAGNI） |
| 价值 | 无 | 激活 Gate / 范围已由 CVO + KD-6 拍定 |

## 风险注记

| 风险 | 缓解 |
|------|------|
| tmux session 泄漏（猫粮+进程） | D1 dispose 双保险 + Task 2 测试 1 显式断言 0 残留 |
| 测试依赖真 tmux/真 claude | driver 测试 skip-if-no-tmux；carrier 测试用 fixture mock driver；只有 Task 5 smoke 真烧（订阅桶，~3 条消息量级） |
| 真实 HOME transcript 目录写入 | 测试/smoke 全部独立临时 cwd slug（D6） |
| `-p`/bg 回归 | AC-B7：共享代码只碰 factory 一处 + 现有测试全量回归 pin |

**估时：** Task 0-1 半天内 / Task 2-4 一天半 / Task 5-7 半天 → 2-3 天，与 KD-6 工期估算一致，6/15 前在车库。
