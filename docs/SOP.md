# Cat Café 开发 SOP (Standard Operating Procedure)

> 三猫开发全流程的**唯一权威文档**。所有猫指引（CLAUDE.md / AGENTS.md / GEMINI.md）和 Skills 引用本文档，不重复定义流程。
> 冲突时以本文档为准。
>
> 更新日期：2026-02-16

## 完整流程（6 步）

```
① 开 worktree 写代码
      ↓
② 自检（spec compliance）
      ↓
③ 请求 review → reviewer 审查 → 修复循环 → reviewer 放行
      ↓
④ Merge Approval Gate（检查放行信号）
      ↓
⑤ 开 PR + 触发云端 review → 等待通过
      ↓
⑥ 合入 main + push + 清理 worktree
```

---

### Step 1: 在 Worktree 中写代码

**触发**: 开始任何代码修改时（不管多小）
**Skill**: `using-git-worktrees`

- 所有代码修改必须在 worktree 中进行，禁止直接改 main
- 命名：`cat-cafe-{feature-name}`，分支：`feat/xxx`、`fix/xxx`、`refactor/xxx`
- Worktree 中 Redis 必须用 6398（开发），禁止连 6399（生产）
- 操作细节见各猫指引的 Worktree 章节

**→ 下一步**: 开发完成后进入 Step 2

---

### Step 2: 自检（Spec Compliance）

**触发**: 开发完成，准备提 review 前
**Skill**: `spec-compliance-check`

- 对照 plan/spec 逐项核对实现
- 跑全量测试（`pnpm test`；Redis 改动加跑 `test:redis`）
- 输出合规报告（✅/⚠️/❌）

**→ 下一步**: 合规通过 → Step 3

---

### Step 3: 请求 Review + 修复循环

**触发**: 自检通过后
**Skills**: `cat-cafe-requesting-review` (3a) → `cat-cafe-receiving-review` (3b)

**3a. 请求 review**
- 用 skill 写 review 信（含五件套 + 自检报告 + 测试结果）
- 存档到 `docs/mailbox/`
- Reviewer 配对见下方"Reviewer 配对表"

**3b. 收到 review 反馈**
- Red→Green 方式逐个修复 P1/P2
- 禁止表演性同意；技术分歧用论证 push back
- **修复后回给 reviewer 确认**（不能自己判断"改对了"直接合入）

**→ 下一步**: Reviewer 明确放行 → Step 4

---

### Step 4: Merge Approval Gate

**触发**: Reviewer 发出放行信号
**Skill**: `merge-approval-gate`

必须同时满足：
1. Reviewer 有**明确放行信号**（"放行" / "LGTM" / "通过" / "可以合入"）
2. **所有 P1/P2** 已修复并经 reviewer 确认
3. Review 针对**当前分支/当前工作**（不是历史 review）

**→ 下一步**: Gate 通过 → Step 5

---

### Step 5: 开 PR + 触发云端 Review

**触发**: merge-approval-gate 通过后
**Skill**: `requesting-cloud-review`

```bash
# 5a. 收敛 commit（squash/fixup review follow-up 零碎提交）
git fetch origin
git rebase -i --autosquash origin/main

# 5b. Push feature branch 到 origin（PR 需要远程分支）
git push origin {branch} --force-with-lease

# 5c. 开 PR（此时 feature 和 main 有 diff，PR 可成立）
gh pr create --base main --head {branch} --title "..." --body "..."

# 5d. 触发云端 review
gh pr comment {PR_NUMBER} --body "@codex review ..."

# 5e. 等待云端 review 结果（⚠️ 必须等通过才能进 Step 6！）
```

**冲突处理**: rebase 有冲突 = 改代码 → 必须找 peer reviewer review 冲突解决部分

**云端 review 是阻塞守护**：必须等云端 Codex review 通过（0 P1/P2）才能进入 Step 6。处理方式：
- 0 P1/P2 → 通过，进入 Step 6
- 有 P1/P2（附复现证据）→ 在 feature branch 上修复 → push → 等待 re-review
- 有 P1/P2（无复现证据）→ 降级 P3，留 comment 说明，视为通过
- 误报 → 留 comment 解释，视为通过

**→ 下一步**: 云端 review 通过后进入 Step 6

---

### Step 6: 合入 main + Push + 清理

**触发**: 云端 review 通过后（0 P1/P2，或 P1/P2 已在 feature branch 上修复）

```bash
# 6a. 回到主仓目录
cd /Users/lysander/projects/relay-station/cat-cafe

# 6b. 合入 main（ff-only 保持 commit hash 一致，PR 会自动关闭）
git checkout main
git merge --ff-only {branch}

# 6c. Push main（⚠️ 必须在清理 worktree 之前！）
git push origin main

# 6d. 清理 worktree + 远程分支
git worktree remove ../cat-cafe-{feature-name}
git branch -d {branch-name}
git push origin --delete {branch}
git worktree prune
```

**PR 自动关闭**: `--ff-only` merge 保持 commit hash 不变，push main 后 GitHub 检测到 PR 的 commits 已在 main 中，PR 自动标记为 merged。

---

## 例外路径：跳过 Step 5（开 PR）

以下**三个条件必须全部满足**（缺一不可）：

1. **铲屎官在当前对话中明确同意**跳过（不是默认、不是历史授权、不是猫自行判断）
2. 改动属于以下类别之一：
   - **纯文档**: 仅修改 `docs/` 目录下文件、`*.md` 文件（含 README/CLAUDE.md/AGENTS.md/GEMINI.md）、或代码注释
   - **微量代码**: diff 总计 ≤10 行的 bug fix / typo fix / 配置调整
3. **不涉及**：安全、鉴权、数据存储、API 接口变更

**如果不确定是否需要开 PR → 默认开 PR。宁多一层守护，不少一层。**

---

## 例外路径：极微改动直接合入 main（跳过全流程）

以下**四个条件必须全部满足**，才可跳过 worktree / review / PR，直接在 main 上修改并提交：

1. **类别限定**：纯日志格式调整 / 纯配置参数 / 纯注释 / 纯文档（不涉及任何业务逻辑或 API 接口）
2. **体量限定**：diff 总计 **≤ 5 行**
3. **类型检查通过**：改动后必须跑 `tsc --noEmit`（或 LSP 诊断无 error），通过才能提交
4. **无测试需要**：改动不涉及任何可测行为（不需要新增/修改测试用例）

**不需要铲屎官每次单独授权**——满足以上四条即可自行判断。

**如果有任何一条不满足 → 回到完整 6 步 SOP。**

> 规则来源：2026-02-18 审计日志时间戳改动（2 行日志格式修改），铲屎官确认此类极微改动可直接合入。

---

## Reviewer 配对表

| Author（写代码的猫） | Reviewer（本地 review） | Reviewer（云端） |
|----------------------|------------------------|-----------------|
| 布偶猫 (Opus) | 缅因猫 (Codex) | Cloud Codex |
| 缅因猫 (Codex) | 布偶猫 (Opus) | Cloud Codex |
| 暹罗猫 (Gemini) | 缅因猫 (Codex) | Cloud Codex |

**铁律**: 任何猫都不能 review 自己的代码。

---

## 代码质量工具（三猫必读）

开发过程中必须使用以下工具守护代码质量，不是可选的。

### Biome（已配置 `biome.json`）

```bash
# 检查 lint + 格式（只报告，不修改）
pnpm check

# 自动修复
pnpm check:fix

# 对单文件增量检查（推荐在编辑后立刻跑）
pnpm biome check <file-path>
```

- **Step 2 自检时**：`pnpm check` 必须跑，确认无 error
- **开发过程中**：改完文件后对改动文件跑 `pnpm biome check <file>`，及时发现问题
- **提交前**：至少对暂存文件跑一次 Biome 检查

### TypeScript 类型检查

```bash
# 全量类型检查（Step 2 必跑）
pnpm lint

# 共享包改动后必须 rebuild（否则 .d.ts 过期导致下游误报）
pnpm --filter @cat-cafe/shared build
```

### LSP 插件（各猫按自己 CLI 工具链配置）

如果你的 CLI 工具支持 LSP / 代码检查插件：
- **必须启用**，不要嫌麻烦关掉
- **关注每次编辑后的实时诊断**，发现类型错误当场修，不要攒到最后
- **重构/移动文件后主动触发诊断**，确认 import 链没断
- 具体配置见各猫指引（CLAUDE.md / AGENTS.md / GEMINI.md）

### JetBrains MCP（三猫共用，铲屎官 WebStorm 已开启）

铲屎官的 WebStorm 已启用 MCP Server（SSE: `http://localhost:64342/sse`）。配置位置：
- **布偶猫**：项目级 `.mcp.json`（Claude CLI 自动读取）
- **缅因猫**：`~/.codex/config.toml` → `[mcp_servers.jetbrains]`

**必须用 JetBrains MCP 的场景**（比手动 grep 替换更安全）：

| 场景 | 工具 | 为什么 |
|------|------|--------|
| **重命名符号** | `rename_refactoring` | 理解 getter/setter、override 链，跨文件安全重命名 |
| **检查文件问题** | `get_file_problems` | IntelliJ inspections，比 `tsc --noEmit` 更全面 |
| **查看符号信息** | `get_symbol_info` | 跳到定义、看类型签名、看文档 |
| **全项目搜索** | `search_in_files_by_text` | 比 grep 更精准，带高亮匹配位置 |

**注意**：JetBrains MCP 依赖铲屎官的 WebStorm 开着。如果连不上，回退到 LSP + Biome。
调研报告：`docs/research/2026-02-16_LSP_MCP_report.md`

### 目录结构卫生（ADR-010）

目录膨胀是代码库腐化的早期信号。三猫必须遵守以下规则：

**双阈值检测**（对 `packages/api/src/` 下每个目录）：

| 阈值 | .ts 文件数 | 含义 |
|------|-----------|------|
| **warn** | 15 | 必须在 commit message 写"为什么不拆" |
| **error** | 25 | 必须拆分，除非走例外机制 |

计数排除 `index.ts` 和 `*.d.ts`。

```bash
# 检查目录大小
pnpm check:dir-size

# 检查依赖关系（循环依赖 + 边界违规）
pnpm check:deps
```

**例外机制**：确需超阈值的目录登记到 `.dir-exceptions.json`，必须包含 `owner` + `expiresAt`（禁止永久豁免）。

**AI 结构保洁员规则**（三猫新增文件时必须遵守）：
1. 检查目标目录是否已超 warn 阈值
2. 若超阈值，在 commit message 说明理由或拆分
3. 新建子目录必须满足理由白名单：职责不同 / 依赖方向不同 / 生命周期不同

详见：`docs/decisions/010-directory-hygiene-anti-rot.md`

---

## 文档归档与查找

已完成的讨论、邮件、调研、计划等文档会移入 `docs/archive/YYYY-MM/` 归档目录。

**归档不等于没用！** 找不到文档时，先查 archive：

```
docs/archive/2026-02/
├── discussions/    # 已完成的讨论（圆桌、brainstorm、handoff 等）
├── mailbox/        # 已完成的 review 信、交接信
│   └── YYYY-MM-DD/ # 按日期子目录组织
├── research/       # 已完成的技术调研
├── plans/          # 已实施完成的计划
├── bug-report/     # 已关闭的 bug report
├── phases/         # 已完成的 phase 设计文档
├── reports/        # 历史报告
└── tasks/          # 已完成的任务表
```

**三猫查找规则**：
1. 查 `docs/` 活跃目录找不到 → 去 `docs/archive/` 找
2. 新建文档引用旧文档时，用归档后的路径（`docs/archive/2026-02/...`）
3. ADR (`docs/decisions/`) 和 lessons (`docs/lessons-learned.md`) **永不归档**——它们是常青文档

---

## Skill 速查表

| 我正在... | 用这个 Skill | SOP Step |
|-----------|-------------|----------|
| 开始写代码 | `using-git-worktrees` | Step 1 |
| 写完了，准备提 review | `spec-compliance-check` | Step 2 |
| 发 review 请求给别的猫 | `cat-cafe-requesting-review` | Step 3a |
| 收到 review 意见要处理 | `cat-cafe-receiving-review` | Step 3b |
| Reviewer 放行，准备合入 | `merge-approval-gate` | Step 4 |
| 放行后开 PR + 云端 review | `requesting-cloud-review` | Step 5 |
| 不确定整体流程 | **先看本文档** | — |
| 交接/传话给别的猫 | `cross-cat-handoff` | 任意时刻 |
| 声称"完成了" | `verification-before-completion` | 任意时刻 |
