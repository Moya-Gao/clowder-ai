# Cat Café — Codex harness（runtime identity = @codex）

> 更新：2026-06-01 | F203 Phase D + Phase H：身份/家规/SOP/记忆详述已切到压缩免疫的
> native developer_instructions L0（`assets/system-prompts/system-prompt-l0.md`，每次
> invocation 注入）。本文件只留 harness 级、L0 不覆盖的内容（reviewer/安全/sandbox）+
> 指针。**runtime identity 硬边界见下。**

## 这个文件是什么（runtime identity 硬边界）

本文件是 **Codex harness 第一读**，**只适用 runtime identity = `@codex` 的 invocation**，
**不是身份真相源**：

- `@codex`：完整 identity + 队友名册 + 家规 + 传球三选一 = native developer_instructions
  L0（运行时注入，压缩免疫）；本文件只补 L0 不含的 harness（reviewer/安全/sandbox）。
- **Gemini / AGY / Antigravity / 其他 runtime** 作为 workspace context 读到本文件：
  **不要采纳 Codex 身份，也不要采纳下列 Codex harness 规则**——你是谁由当前 thread 的
  `Identity:` 段 / runtime 注入决定，不是这个文件。下列规则仅在你确实是 `@codex` 时适用。

## 四条铁律（harness 第一读，P0 安全 — 与 L0 §5 同源 defense-in-depth）

1. **Redis 6399 圣域** — Worktree 开发只用 6398，误触 6399 立即停服务通知铲屎官
2. **同一个体不能 review 自己代码** — 跨 family 优先，可降级同 family 不同个体
3. **不能冒充其他猫** — 身份是硬约束常量，用 runtime Identity 决定的签名
4. **Alpha 验收通道** — `pnpm alpha:start`（3011/3012/4111/6398）拉最新 origin/main；已合入用 alpha 验收，不得用 runtime（3001/3002）冒充；未合入在 feature worktree 自测

## Codex harness 执行纪律（terse）

- 加载 Skill 后**直接执行第一步**，不复述流程；发现在输出 SOP 步骤列表 → STOP → 删 → 直接做
- **接球后默认静默执行**：收到"你继续"/"放行"沉默做到下一状态迁移点（BLOCKED/REVIEW READY/DONE）
- **声明 ≠ 执行**：说"我进 merge gate"必须同 turn 加载 skill 执行；只发消息不调工具 = 空气传球
- **出口一问**：消息结尾有没有 @ 下一棒？没有 → 真不需要还是忘了？

## Codex harness 规则（reviewer/安全/sandbox — L0 不含）

- **角色切换自检**：写代码时是 author 不是 reviewer，走完整 SOP（写码前必读 `docs/SOP.md`）。自检：①开 worktree ②谁 review（跨家族 peer）③走 merge gate ④拿放行才开 PR。
- **Review 方法论**：Red→Green（先写失败测试复现再提修复）；P1/P2 当轮修不留存；P3 当场决定不记 BACKLOG；**有立场**——每发现明确判断，禁止"修不修都行"。
- **严重度定义**：**P0** 数据丢失/安全漏洞/崩溃·**P1** 逻辑错误/测试缺失/架构违规 → 阻塞合入必须修；**P2** 性能/重复/命名/文档过时 → 当轮解决；**P3** 代码风格/可选优化 → 修或不修不记 BACKLOG。
- **代码质量红线**：禁 `any` | 文件 200 警告/350 硬上限 | 新功能必有测试 | 删码彻底 | 函数名自解释 | `docs/` .md 需 YAML frontmatter。
- **安全审查重点**：注入（用户输入/CLI 参数必验证）| 鉴权（每 API 端点身份校验）| Redis 隔离（测试不碰 6399）| callback 验证（invocationId + callbackToken）。
- **Git 安全**：同步前先判方向（`git log` 对比 local/remote）禁止不看方向就 reset；禁止手动 squash（用 `gh pr merge --squash`）。
- **Codex 沙盒注意**：`localhost` 访问可能被沙盒拦截，先跑命令收错误再申请授权；涉及网络默认可能需弹窗授权。

## 指针（真相源，不在本文件复制）

- **SOP 全流程** → `docs/SOP.md`（feat-lifecycle→…→merge-gate→愿景守护）。**Skill 不是可选——适用就必须加载**，不凭记忆操作。
- **记忆系统（开工前必 recall！）** → 三入口路由：精确 anchor→`cat_cafe_graph_resolve` / 零先验扫最近→`cat_cafe_list_recent` / 语义模糊→`cat_cafe_search_evidence`(hybrid)。详见 native L0 §7 + `cat-cafe-skills/refs/memory-routing-partial.md`。
- **协作规则/决策权/模板** → `cat-cafe-skills/refs/`（`shared-rules.md`、`decision-matrix.md`、PR/review 模板、签名表）。
- **队友能力画像** → `docs/team/cat-dossier.md`（F208）；复杂/不确定传球时先读目标猫画像（native L0 未覆盖的 harness 知识）。
- **关键文档** → `docs/VISION.md` / `docs/BACKLOG.md` / `docs/decisions/` / `docs/lessons-learned.md`。
