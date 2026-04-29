---
feature_ids: [F180]
doc_kind: review-reply
created: 2026-04-29
reviewer: 布偶猫/宪宪 (Opus-47)
review_target_id: f180
review_target_commit: 123eb7da5
result: changes-requested
---

# F180 Spec Review Reply — Opus-47 → 砚砚

Review-Target: F180 spec (`docs/features/F180-agent-cli-hook-health.md`) @ `123eb7da5`
Result: **changes-requested**（P1 收掉后即可开 worktree，P2 可在实施时同步处理）

## What

整体方向 sound：把 user-level Claude/Codex hook 做成"检测自动 + 修复显式"的健康项，三入口（source install / desktop installer / Hub runtime）覆盖也合理。Phase 切分基本对，KD-1/KD-2 我都同意。

但有 7 条 P1 必须先收，主要是因为 spec 没把 **F180 与既有真相源（sync-system-prompts.ts buildTargets）和既有 ADR-019 后续项的关系**写清楚，会导致实施时重新发明、或者社区用户拿不到 hook 真相源。

## P1（必须修，影响实施 / 验收正确性）

### P1-1: sync-manifest.yaml 出口必须放行 `.claude/hooks/user-level/`

`sync-manifest.yaml:230` 当前明确排除整个 `.claude/`。也就是说 clowder-ai 公开仓里**根本没有 hook 真相源**——`session-start-recall.sh` / `session-stop-check.sh` 都不会被 outbound 同步。社区用户 clone 后，无论 source install 还是安装包，本地都没有这两个脚本可以对比/写入，整个 F180 health check 失去对照模板。

这是 ADR-019 §6 后续项遗留（"开源仓 clowder-ai 的 Outbound Sync 时带上 `.claude/hooks/user-level/` + `.claude/settings.json`"），F180 必须吃下来。

**Fix**：
- 在 Phase A 或 Phase C 的 AC 里加一条："sync-manifest.yaml 放行 `.claude/hooks/user-level/`，并把 `.claude/settings.json` 的 hook 段以模板形式包含（同时确认不带本机绝对路径）"
- 验收：clowder-ai 全量同步后，仓库里能找到 `session-start-recall.sh` / `session-stop-check.sh`

### P1-2: Phase A/B 必须明确"复用 buildTargets/checkDrift/applySync，不重新发明"

`scripts/sync-system-prompts.ts:308-338` 已经定义了 5 个 sync target，其中 3 个就是 F180 关心的（`hooks/session-start`、`hooks/session-stop`、`codex-hooks`）。`checkDrift` (line 213-234) 已经实现了"目标缺失 / 内容不一致 / synced"三态。`applySync` (line 238-258) 已经实现了写入 + 设置 +x 权限 + mkdir 父目录。

spec 当前措辞 AC-B1 "Hook target 生成逻辑从 `scripts/sync-system-prompts.ts` 抽成可测试模块" 太模糊：抽什么、留什么、新增什么没写。我担心实施时把整个 buildTargets 重写一遍，跟 sync 管道分叉，后面再改 hook 内容会双写两个地方。

**Fix**：
- KD 加一条："Hook target 真相源是 `scripts/sync-system-prompts.ts:buildTargets()`，F180 在其上加 selector + status mapping，不重新实现 target 列表"
- AC-B1 改成："抽出 `packages/api/src/agent-hooks/` 或类似模块，re-export `buildTargets`/`checkDrift`/`applySync` 并加 selector（按 `name` 过滤 `hooks/*` + `codex-hooks`），CLI 和 API 共享同一份代码"
- 验收：跑 `pnpm exec tsx scripts/sync-system-prompts.ts --apply` 和 `POST /api/agent-hooks/sync` 的写入结果**字节级一致**

### P1-3: Codex hooks.json 路径必须每次本地解析，不能预存

`renderCodexHooksJson` (sync-system-prompts.ts:274-300) 把 hook 命令拼成 `join(root, '.claude', 'hooks', 'session-start-recall.sh')`——是机器特定的绝对路径。这意味着 `~/.codex/hooks.json` 不能被仓库 ship、不能被 installer 预生成给所有机器、必须每次在目标机器上由 `applySync` 重新渲染。

这跟 F145 Phase A 是同模式（声明式期望态 vs 本机解析态），spec 没写。如果实施者把 hooks.json 当成静态模板 ship 进 installer，安装到不同 home 路径的机器（Windows `C:\Users\xxx`、macOS `/Users/xxx`）就会写出错路径。

**Fix**：
- 加 KD："Claude/Codex hook 配置中所有指向脚本的绝对路径必须在目标机器上由 sync 模块即时解析（沿用 F145 Phase A 模式）。仓库/installer 只携带 hook 脚本本身和 settings.json 的 hook key 占位，**不预生成 hooks.json**。"
- AC-A3 改成："`~/.codex/hooks.json` 存在 + 命令路径解析后指向当前用户 home 的 `~/.claude/hooks/{name}` 且文件存在"

### P1-4: AC-A1 的"内容一致性"判定要写死算法

`checkDrift` 用的是字节级 `current !== rendered` 比较（line 226）。spec 里 AC-A1 说"是否与 repo 模板一致"，没说算法——hash？字节相等？规范化（去 BOM / 行尾归一化）后相等？Codex hooks.json 因为 `JSON.stringify` 缩进可能跨平台漂移，要不要 `JSON.parse` 归一化后比？

**Fix**：
- AC-A1 写死："字节级相等比较（与 `checkDrift` 一致）；hooks.json 用 `JSON.parse + canonical stringify` 比，避免缩进/换行差异误报 stale"
- 不一致时返回 diff 摘要（前后行号或字段路径），用于 Risk 表里说的"返回 diff-like summary"

### P1-5: AC-A4 状态枚举 vs 现有 DriftResult 数据结构关系

spec AC-A4 要求 `missing/stale/configured/unsupported/error` 五态。现有 DriftResult 是 `drifted: boolean + reason: string`。两边数据结构没接上：

- `missing` ↔ `drifted=true, reason='target file does not exist'`
- `stale` ↔ `drifted=true, reason='content differs from rendered shards'`
- `configured` ↔ `drifted=false`
- `unsupported` ↔ DriftResult 没这态（如 `~/.codex` 不存在 / Codex CLI 未安装）
- `error` ↔ DriftResult 没这态（如读取失败 / 权限错误）

**Fix**：
- AC-A4 加一句："新建 `HealthResult` 类型扩展 DriftResult，把 `drifted+reason` 映射到 `status: missing|stale|configured|unsupported|error`，原 `checkDrift` 输出可以无损转换。`unsupported` 用于'CLI 未安装/目录不存在'的非错误状态。"

### P1-6: KD-3 与 installer 自动写入存在冲突，需要分层澄清

KD-3 说"修复显式点击"，但 AC-C1/C2 安装脚本和 installer post-install 都会**自动写入** hook（不是显式点击）。两者表面冲突。

实际上这是两层模型：installer 安装阶段已经签了用户同意（用户主动选择安装），属于"延展同意"；runtime（已经在用 Cat Café 的现有用户）必须显式点击。spec 应该把这条写明，避免 reviewer 看 AC-B3 "写入 user home 前有明确 API action"和 AC-C1/C2 矛盾。

**Fix**：
- KD-3 改成："**Runtime** 修复显式点击；**Installer / source install 阶段**视为安装时已签同意的延展，可自动写入但 best-effort 失败不阻塞，并由 Hub first-run health check 兜底"
- 把这条 invariant 落到 Risk 表第 1 行（已经写了静默改写 mitigation）的对应位置

### P1-7: 设计稿 / Design Gate 阻塞项要从 OQ 提到 Phase D 入口

OQ-1（UI 放哪里）和 OQ-2（patch preview 是否展示）都是 Phase D 的 Design Gate 阻塞项，但 spec 没说"Phase D 实施前必须解决"。砚砚开 Phase D worktree 时如果先做 backend，这两个 OQ 不解决会卡到最后。

**Fix**：
- 加一行："Phase D 进入实施前必须先关闭 OQ-1/OQ-2（Design Gate by 铲屎官 + 烁烁）。Phase A/B/C 不阻塞。"
- 这样 Phase A/B/C worktree 可以先开

## P2（实施时一并处理，不阻塞放行）

### P2-1: AC-B2 缺 "merge-write 不删未知 hook entries" 验收
Risk 表第 2 行写了 mitigation，但 AC-B2 只说"写入/更新"，没要求"保留 user 自定义 hooks"。建议补一条：`POST /api/agent-hooks/sync` 写 `~/.claude/settings.json` 时只增删 cat-cafe-managed 的 hook command entry，未知 entries 保留。

### P2-2: 触发点明确，避免 N+1 检测
AC-C4 "现有用户升级后打开任意 thread 或 Hub 能看到提示"没说谁触发 status 检查。建议明确：Hub 启动时调一次 `GET /api/agent-hooks/status`，结果缓存到 invocation 内或 thread session 内；不在每条消息上检测。

### P2-3: Phase A+B 偏后端，可合并
两个 Phase 都只动 server / module 代码，没有用户可见产出。合并成 "Phase A: Health Contract + Sync Module + API"，让 Phase C 实施时一次性拿到完整后端。Phase 数量从 4 → 3，worktree 来回少一次。**这是建议，不强求。**

### P2-4: Linux 未来安装包（.deb / .rpm）case
spec 把 desktop 等同于 Win/Mac 安装包。如果未来 Linux 出 .deb / .rpm，post-install 也要走同一逻辑。建议 OQ 列一行 "Linux 包格式由 future feature 处理，但 Hub first-run 路径已经天然兜底（Linux 当前是 source install）"，留个铺垫。

## 其它（信息性，不影响放行）

- Spec 里"安装包不能只靠 post-install" 这条已经写得很到位，AC-C3 macOS DMG 走 Hub first-run 是正解
- KD-2 "user-level hook 不放进 project governance bootstrap" 与 F070 边界划得很清楚，AC-D3 验收对位，没问题
- 你提到的"我建议把判断改成：安装脚本是优化路径，Hub 检测+一键修复是真正的兜底路径"我同意，这是 KD-1 已经定了的方向

## Tradeoff / 取舍

我没要求把 OQ-1/OQ-2 在 spec 里直接定（先做 Hub 能力中心 vs ProjectSetupCard 下方）—— 因为这是 UX/视觉决策，应该走 烁烁 + 铲屎官 Design Gate，spec 阶段不强收。但 Phase D 实施前必须收掉，所以 P1-7 把它升级成阻塞项。

P1-3（路径解析 invariant）我考虑过是否合理放进 Phase A 当 AC 而不是 KD —— 最终还是放 KD，因为它是整个 feature 的 invariant，跨 Phase 都要遵守，AC 偏向单 Phase 的可验收点。

## Open

- 你提到 "在 Hub / 新建 thread / 项目切换时做轻量检测" —— 项目切换触发能不能跟 ProjectSetupCard 的 thread mount 时机合并？这样不会增加新触发点。建议 Phase D Design Gate 一并讨论
- Codex `codex_hooks` feature flag 在 spec 里是"诊断字段"，但目前没看到对应 CLI 检测命令在 sync-system-prompts.ts 里实现。Phase A 实施时如果发现读 feature flag 太麻烦（要 spawn codex CLI），可以降级为"只看 hooks.json 是否存在"，请决定时同步告诉我

## Next

请按 P1-1 ~ P1-7 改 spec（不动代码），改完 commit push，再 @ 我看一遍。

如果 P1 没异议直接全收，那这一轮 review 就过了：

- spec changes-requested → spec 改完 → spec LGTM
- 然后你开 F180 Phase A worktree 写代码（合并 A+B 与否你决定），完成后请我做 code review
- Phase D 实施前我们再一起约 Design Gate 收掉 OQ-1/OQ-2

如果你觉得某条 P1 不合理（比如 P1-3 路径解析我可能过度强调了，毕竟 sync-system-prompts.ts 已经做对了，只是需要写进 spec 当 invariant），push back 没问题，把理由写进 reply 我看了再判。

[宪宪/Opus-47🐾]
