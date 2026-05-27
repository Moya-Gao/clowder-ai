---
feature_ids: [F059]
related_features: [F042, F046, F086, F087, F094]
topics: [open-source, status, debt, governance]
doc_kind: note
created: 2026-03-12
---

# Clowder AI 开源现状与债务清单

> **用途**：单独记录 F059 当前推进状态、已完成项、剩余债务、修复顺序。
> **原则**：**家里的历史债，先在家里修；开源版特有问题，再修 sync pipeline。**

## 当前快照

### 已完成

- `clowder-ai` 已建立并保持 **private beta** 状态
- `cat-cafe -> clowder-ai` 同步管线已落地：
  - `sync-manifest.yaml`
  - `scripts/sync-to-opensource.sh`
  - public docs/export 脚本
- `clowder-ai` 已同步代码、skills、公开 docs、治理文件
- `clowder-ai` 本地可启动：
  - Frontend: `3003`
  - API: `3004`
  - Redis: `6399`
  - memory mode 可用
- `clowder-ai` 当前门禁状态：
  - `pnpm install --frozen-lockfile` ✅
  - `pnpm check` ✅
  - `pnpm lint` ✅
- `main` 保护规则已开启：
  - Require PR
  - Require 1 approval
  - Require status checks
  - Restrict updates
  - Block force push / deletion
- CI 触发已改成白名单 `paths:`，文档改动不再白白消耗 GitHub Actions 分钟

### 当前口径

> **Clowder AI 现状态**：内测可运行，但还不是公开发布完成态。

### 分支 / 发布口径（2026-03-21 新增）

- `cat-cafe main` = **激进演进 / 真相源 / canary**
- `clowder-ai main` = **稳定默认分支**
- `clowder-ai next`（或 nightly tag）= **预览通道**，给愿意提前试新功能的人
- `clowder-ai` 的真正稳定承诺 = **GitHub Release tag (`vX.Y.Z`)**

**执行规则**
- 家里的新能力先在 `cat-cafe main` 演进、验证、收口
- 准备对外给普通用户用的内容，才进入 `clowder-ai main`
- 想提前公开试水但还不够稳定的改动，不直接压进 `clowder-ai main`，走 `next` / nightly
- `clowder-ai main` 的目标不是“最新”，而是“默认可装、默认可跑、默认可解释”
- 普通用户默认跟 `release tag`；愿意尝鲜的人再跟 `main` / `next`
- 如果当前没有 active `next` 分支，激进社区特性就保持在 PR / feature branch，或走 prerelease tag，不为了“先合进去”污染 `main`

### 社区激进特性的落点（2026-03-22 新增）

当社区伙伴贡献的新特性**方向对，但还不够稳**时，落点按下面分流：

| 状态 | 落点 | 原则 |
|------|------|------|
| 已经足够稳 | `clowder-ai main` | 可以做 rolling stable 默认内容 |
| 方向对，但稳定性/文档/测试还不够 | `clowder-ai next` / prerelease | 可以给尝鲜用户试，但不做稳定承诺 |
| 仍在探索 | PR / feature branch | 不强行合进任何默认分支 |

一句话：**`main` 不是实验场，`release tag` 才是稳定承诺，`next/prerelease` 才是激进社区特性的容器。**

### `v0.1.0` 发布门槛（2026-03-21 新增）

在以下 3 项全部通过前，**不切 `v0.1.0`**：

1. 修复 `pnpm dev:direct -- --profile=opensource` 参数透传失真，确保公开仓一键启动脚本按指定 profile 生效
2. 修复 API watcher 与 Redis live-instance 锁打架，确保 dev 启动日志与进程语义一致，不出现“表面 fatal、实际半活”的假死状态
3. 按 `clowder-ai` 的 `README` / `SETUP` 在 **macOS 干净环境** 逐步安装验证，确认文档写法真的能把项目装起来并跑通基础烟测

只有这 3 项都过，`clowder-ai main` 才能视为第一个稳定公开版本候选，再考虑切 `v0.1.0`

---

## 债务分类

## A. 家里的历史债（先在 `cat-cafe` 修）

这些问题如果继续只在 `clowder-ai` 修，会让两个仓分叉。默认先在家里修，再同步。

### A1. Directory Size Guard 在公开仓的假红灯

**现象**
- 家里 `cat-cafe` 运行 `bash scripts/check-dir-size.sh` 已经是**警告态通过**
- `clowder-ai` 的 `Directory Size Guard` 会红，是因为同步时漏了 `.dir-exceptions.json`
- 这说明它不是源仓结构债，而是公开同步漏项

**处理原则**
- 先把 `.dir-exceptions.json` 纳入开源同步
- 再重新同步到 `clowder-ai`
- 真正的目录拆分/例外治理仍然继续在家里做，但这条 CI 红灯本身不该再归类为源仓债

**状态**：处理中（已确认根因）

### A2. `Test (Public)` 历史红灯

**现象**
- `clowder-ai` 的 `Test (Public)` 仍非稳定绿灯
- 这类问题默认先判断为源仓测试债

**本轮进展（2026-03-12）**
- 已在家里 `cat-cafe` 修完公开测试套件对应的源仓债
- `pnpm --filter @cat-cafe/api run test:public` 当前结果：`3880 pass / 0 fail`
- 这批修复仍需同步到 `clowder-ai`，再确认公开仓 CI 回绿

**处理原则**
- 先在 `cat-cafe` 修测试或修实现
- 保持 `test:public` 在家里和公开仓同口径
- 修完后同步

**状态**：源仓已修，待同步验证

### A3. 源仓结构和质量债持续回流

**现象**
- 我们已经修过多轮 `pnpm check` / `pnpm lint`
- 但后续新功能仍可能把历史债重新带进公开仓

**处理原则**
- 后续所有源仓代码债，先在 `cat-cafe` 收口
- `clowder-ai` 不做长期独立修补，避免分叉

**状态**：持续项

---

## B. 开源版特有问题（在 sync pipeline / public repo 修）

这些不是家里源仓的通用问题，而是公开导出和公开表达带来的问题。

### B1. docs / skills 的私有路径残留

**现象**
- 公开版 docs/skills 中仍可能残留：
  - `docs/mailbox/`
  - `docs/plans/`
  - `docs/discussions/`
  - `docs/archive/`
- 这类内容不会阻塞启动，但会让外部猫读到不存在的路径

**处理原则**
- 在 export/sanitize 脚本里继续 public 化
- 不在 `clowder-ai` 手工逐文件打补丁

**状态**：未完成

### B2. 协作文档公开化不彻底

**重点文档**
- `docs/SOP.md`
- `cat-cafe-skills/refs/shared-rules.md`
- `CLAUDE.md`
- `AGENTS.md`
- `GEMINI.md`

**现象**
- 主骨架已同步
- 但部分 skill / refs 还带内部口吻或内部流程痕迹

**处理原则**
- 保留“变聪明的骨架”
- 去掉公开仓不存在的内部路径和私有流程依赖

**状态**：未完成

### B3. README / SETUP / MCP 说明仍需打磨

**重点**
- 设计能力依赖 `Pencil` 类 MCP 要写清楚
- 没有设计类 MCP 时，体验会明显退化，要在 README / SETUP 里说清楚
- credits / inspiration 要分清：
  - 我们自己写的 skills
  - 外部 MCP / 官方工具

**状态**：未完成

### B4. 公开仓 git author / commit 口径

**现状**
- 已经明确：公开仓后续提交应统一为我们的 GitHub 账号 author
- commit 应带猫猫签名

**状态**：规则已定，后续持续执行

---

## C. 已经收口的关键事项

- `main` 保护规则已设好，不再是裸 main
- CI 白名单触发已设好，不再“改一个 md 全仓跑”
- `clowder-ai` 已完成一次可运行性验证
- 默认端口已切到 `3003/3004`，不碰家里 runtime 的 `3001/3002`
- Hindsight 默认关闭
- 公开版 owner / mention / author 口径已收过一轮

---

## 修复顺序（严格按顺序）

1. **先修家里的历史债**
   - Directory Size Guard
   - `Test (Public)`
   - 其他会回流到公开仓的源仓质量问题

2. **再修公开版导出问题**
   - docs 残留私有路径
   - skills/refs public 化
   - README / SETUP / MCP 说明

3. **然后重新同步到 `clowder-ai`**
   - 同步代码
   - 同步 public docs
   - 重新跑：
     - `pnpm install --frozen-lockfile`
     - `pnpm check`
     - `pnpm lint`
     - runtime boot on `3003/3004`

4. **最后再考虑公开发布态**
   - 截图替换
   - collaborator onboarding
   - 商标/品牌说明补齐

---

## 现在不做的事

- 不在 `clowder-ai` 长期单独修源仓历史债
- 不把 `docs/phases/`、`docs/methods/`、`docs/mailbox/`、`docs/plans/` 直接同步过去
- 不为了省事把 private beta 仓直接改 public

---

## 下一轮直接行动

- [ ] 在 `cat-cafe` 修 `Directory Size Guard`
- [ ] 在 `cat-cafe` 修 `Test (Public)`
- [ ] 记录并修复 `pnpm dev:direct -- --profile=opensource` 参数透传失真
- [ ] 记录并修复 API watcher / Redis live-instance 锁冲突
- [ ] 按 `README` / `SETUP` 做一次 macOS 干净安装烟测
- [ ] 重新同步到 `clowder-ai`
- [ ] 再扫一轮 docs/skills 私有路径残留
- [ ] 补 `README` / `SETUP` 的 MCP 与设计能力说明
- [ ] 满足发布门槛后再评估是否切 `v0.1.0`

---

## 社区 PR Review 进度

> **更新时间**: 2026-03-18 (Tier 1 完成) | **执行猫**: 金渐层/opencode (claude-opus-4-6) [金渐层/Opus-46🐾]

### 已关闭 PR（12 个）

| PR | 作者 | 原因 | 关闭时间 |
|----|------|------|----------|
| #34 | zts212653 | 旧同步 PR，被 #112/#118 取代 | 2026-03-17 |
| #47 | bouillipx | 代理回退，家里已有 tcpProbe | 2026-03-17 |
| #80 | bouillipx | CLAUDE.md 修改，家里版本已远超 | 2026-03-17 |
| #25 | mindfn | 隐藏排队消息，家里已有 F117+F098-D | 2026-03-17 |
| #44 | mindfn | tooltip 功能 → intake 到家里实现（ThreadItem.tsx） | 2026-03-17 |
| #60 | bouillipx | 同步 transform 已实现等效功能（PR 有合并冲突） | 2026-03-17 |
| #67 | bouillipx | Lint 失败 + 同步脚本已修命名 bug + 会被覆盖 | 2026-03-17 |
| #78 | bouillipx | 重启通知 — F048 A+ 已实现等效功能 | 2026-03-17 |
| #106 | bouillipx | 拆分为 #121 + #122 | 2026-03-17 |
| #107 | bouillipx | 代理弹性 — 家里已有等效实现（#52 CLOSED） | 2026-03-17 |
| #121 | bouillipx | done-guarantee — 已在家里实现并 commit（8a28d74c），带 co-author | 2026-03-17 |
| #122 | bouillipx | CLI timeout — 需求关联到 #109/F127 | 2026-03-17 |
| #73 | bouillipx | API key 检测 — 被 F117 Provider Profile 系统覆盖 | 2026-03-17 |

### 已关闭 Issue（关联处理）

| Issue | 标题 | 原因 |
|-------|------|------|
| #30 | done/isFinal 丢失 | 已被 commit 8b06b5cd + 8a28d74c 完全修复 |
| #45 | 44 个 pre-existing CI 测试失败 | 过时——多次同步后测试状态已完全不同 |
| #51 | Claude API-key 认证不生效 | F117 Provider Profile 系统已解决 |
| #52 | 代理 502 | 家里已实现 fetchWithTimeout + retry |
| #77 | 重启静默吞消息 | F048 A+ StartupReconciler 已解决 |
| #104 | Provider auth 配置统一 | F117 已解决 |
| #87 | .env.example defaults drift | PR #540 merged — 端口交换修复 + drift guard 测试 |
| #55 | port defaults inconsistency | PR #540 merged — 与 #87 同根因 |
| #56 | 端口默认值不一致 | 与 #55 重复，已关闭 |

### 已 Intake 到家里（验证完成）

| PR | 功能 | 家里证据 |
|----|------|---------|
| #44 | 线程悬停 tooltip | ThreadItem.tsx line 91-99: `title={tooltip}` (标题+参与者+时间) — commit 0a0f44bc + clowder-ai PR #134 |
| #121 | done-guarantee 安全网 | route-serial.ts + route-parallel.ts: `yieldedFinalDone` + finally/post-loop safety net (commit 8a28d74c) |

### 决策记录（3 个 — 历史归档）

#### PR #44 — 线程列表悬停提示 (mindfn, 1 file) — ✅ Intake 到家里

- **PR 做了什么**：ThreadItem.tsx 加 `title={tooltip}`（完整标题+参与者+时间），7 行代码
- **铲屎官决策**：引进到 cat-cafe
- **处理方式**：家里实现等效功能（commit 0a0f44bc）+ hotfix lane 同步到社区（clowder-ai PR #134）
- **完成**：✅ 家里 main + 社区 hotfix PR 已创建

#### PR #60 — pnpm start + .env + Redis 降级 (bouillipx, 3 files) — ✅ Sync Transform 实现

- **改动 1 (package.json)**：`pnpm start` 改为直接调 start-dev.sh — 开源版适合
- **改动 2 (start-dev.sh)**：首次启动从 .env.example 自动创建 .env — 开源版适合
- **改动 3 (start-dev.sh)**：Redis 失败自动降级到内存模式 — opensource profile 限定
- **铲屎官意见**：应该在同步脚本加 transform 保护开源特有改动
- **下一步**：与砚砚讨论同步脚本 transform 方案

#### PR #67 — 预提交守卫 (bouillipx, 8 files) — 🟡 发现同步脚本 bug

- **功能**：.githooks/pre-commit（worktree 隔离 + shared-state 守卫）
- **命名差异**：PR 正确使用 ROADMAP.md（开源版命名），非 bug
- **发现 bug**：`_sanitize-rules.pl` 只对 docs/cat-cafe-skills/ 做 BACKLOG→ROADMAP 替换（已由砚砚修复）
- **处理方式**：关闭 PR（Lint 失败 + 同步覆盖），pre-commit hook 想法好，考虑从家里实现

### 同步脚本修复（已完成）

`_sanitize-rules.pl` 的 BACKLOG→ROADMAP 替换范围已由砚砚扩大到全局（不再限于 docs/cat-cafe-skills/）。
同时新增 PR #60 的开源侧 transform（`sync-to-opensource.sh`），包括：
- `package.json` 的 `pnpm start` → `./scripts/start-dev.sh --profile=opensource`
- `start-dev.sh` 的 `.env` 自动创建 + Redis 降级（限 opensource profile）

验证结果：`bash -n` / `perl -c` / dry-run 全部通过。

### 社区 PR 盘点（#85 于 2026-05-27 校准）

| PR | 作者 | 内容 | 状态 |
|----|------|------|------|
| #113 | mindfn | Windows 一键部署 (F113) | HOLD — 社区开发中 |
| #85 | bouillipx | `cat_cafe_propose_thread` proposal-first thread creation (F128) | ✅ merged 2026-05-27, squash `a1c44a8`, closes #82 |

### Triaged Issue 盘点（历史列表，#82 于 2026-05-27 校准）

> 更新: 2026-05-27: #82 已按 PR #85 merge 结果校准；其余条目仍沿用 2026-03-17 Round 3 快照。
> 最后全量同步: PR #118 (2026-03-17, commit 0a43ca11)

| Issue | 标题 | 标签 | 家里状态 | 处理建议 |
|-------|------|------|---------|---------|
| #14 | Windows/Linux/Mac 裸机支持 | F113 | 未做 | 社区 PR #113 在做 (mindfn) |
| #64 | Windows CLI spawn ENOENT | F113,bug | 未做 | F113 子任务 |
| #82 | 猫提议创建 thread | enhancement,accepted,feature:F128 | F128 spec 已在家里；实现待 intake 决策 | ✅ clowder-ai PR #85 已合入并自动关闭 |
| #84 | setCatStatus 高频爆栈 | bug | **✅ 已修** | PR #527 merged (idempotent guard, 2026-03-17) |
| #88 | UX 术语暴露 | enhancement | 未做 | 前端术语规范，不紧急 |
| #92 | Windows 侧栏 UI 差异 | F113 | 未做 | 跟随 F113 |
| #94 | Governance per-worktree | bug,needs-decision | 未修 | GovernanceRegistry 仍 per-worktree |
| #95 | Gemini CLI OAuth 断连 | bug,needs-decision | 无法修 | 上游问题 (Google) |

### 非 Triaged 的 OPEN Issue 盘点（19 个）

| Issue | 标题 | 类型 | 家里状态 | 同步前优先级 |
|-------|------|------|---------|-------------|
| #124 | 目录选择器改自定义组件 | enhancement | DirectoryPickerModal 已存在 (F124 新需求) | 🟡 可以做 |
| #123 | governance preflight 阻断新项目 | bug | **✅ 已修** | ~~🟢 **影响首次体验**~~ PR #532 merged |
| #120 | 临时文件管理规范 | enhancement | 未做 | 🟡 规范类 |
| #116 | CLI done 事件 NDJSON 丢失 | bug | 部分覆盖 (8a28d74c) | 🟡 已部分解决 |
| #109 | 猫猫管理重构 F127 | enhancement | 未做 | ⚪ 大重构，社区领取 |
| #101 | 更新 thread projectPath | feature | 未做 | 🟡 |
| #97 | governance 泄漏端口默认值 | bug | **✅ 已修** | ~~🟢 **影响外部项目**~~ PR #532 merged |
| #93 | thread 后台任务管理器 | enhancement | 未做 | ⚪ 大功能 |
| #87 | .env.example defaults drift | bug | **✅ 已修** | ~~🟢 **新用户陷阱**~~ PR #540 merged |
| #81 | Marketplace 外部 Skills 仓库 | enhancement | 未做 | ⚪ 长期 |
| #79 | EnterWorktree 路径错误 | bug | 未确认 | 🟡 |
| #75 | Hub 配置可编辑 | enhancement | 未做 | 🟡 |
| #74 | Hub 配置缺失时失败 | bug | 未修 | 🟢 **影响首次体验** |
| #63 | worktree 纪律强制执行 | bug | 未做 | 🟡 |
| #56 | 端口默认值不一致（中文） | bug | **✅ 已修** | ~~🔴 与 #55 重复~~ 已关闭 (dup of #55) |
| #55 | port defaults inconsistency | bug | **✅ 已修** | ~~🟢 **与 #87 关联**~~ PR #540 merged |
| #50 | pnpm start 默认直启 | enhancement | 已做 (--profile=opensource) | 🔴 **可关闭** |
| #21 | setup wizard 缺 skills symlink | bug | **✅ 已修** | ~~🔴 **可关闭**~~ PR #532 merged |
| #1 | Welcome Beta Testers | — | — | ⚪ 置顶帖 |

### 开源前必做 — Tier 1（5 个，含仲裁修正）

> 更新: 2026-03-17 | 金渐层 vs 砚砚(GPT-5.4) 分歧仲裁后定稿

1. **#84** — ✅ setCatStatus 更新风暴 — **已修** PR #527 merged (idempotent guard, 非 throttle)
2. **#87/#55/#56** — ✅ .env.example 端口不一致 — **已修** PR #540 merged (port swap fix + drift guard test, 14 assertions)
3. **#123** — ✅ governance preflight 阻断新项目 — **已修** PR #532 merged (needsBootstrap/needsConfirmation/bootstrapCommand)
4. **#97** — ✅ governance 泄漏端口默认值 — **已修** PR #532 merged (sync-pipeline transforms, pack v1.3.0)
5. **#21** — ✅ setup.sh 缺 skills sync 步骤 — **已修** PR #532 merged (Step 5/6 skills symlink creation)

### 第二梯队 — Tier 2（3 个，可做不紧急）

1. **#74** — Hub 配置缺失时 UX 优化 ⚠️ **仲裁修正：从 P1 降级为 P2**
   - 前端无 `VITE_HUB` / `hubBase` 环境变量依赖，Hub 是内嵌 React 面板，不会因配置缺失而"失败"
   - 真正问题是 UX 层面（首次用户不知道 Hub 存在），建议加首次启动引导提示
2. **#50** — pnpm start 指向 runtime-worktree ⚠️ **仲裁修正：从"可关闭"改为 P2**
   - `package.json` L8: `"start": "./scripts/runtime-worktree.sh start"` — 主仓设计意图如此
   - 开源版靠 sync transform 替换为 `start-dev.sh --profile=opensource`
   - 不关闭，但用文档标注即可
3. **#94** — GovernanceRegistry per-worktree（长期架构改进，不阻塞首版发布）

### 金渐层 vs 砚砚(GPT-5.4) 分歧仲裁记录

> 日期: 2026-03-17 | 仲裁猫: 金渐层/opencode (claude-opus-4-6) | 方法: 源码逐行核对

| 分歧点 | 金渐层原判 | 砚砚反驳 | 代码证据 | 结论 |
|--------|-----------|---------|---------|------|
| **#21** setup.sh skills | 可关闭（脚本存在） | 不该关（setup.sh 没接） | `setup.sh` grep "skill"=0; `install.sh` L273 有但不互通 | **砚砚赢** → 升 P1 |
| **#74** Hub 配置 | P1 必做 | 降级 P2 | 前端无 HUB env 依赖; `useChatCommands.ts` 纯前端路由 | **砚砚赢** → 降 P2 |
| **#50** pnpm start | 可关闭 | 不能直接关 | `package.json` L8 → runtime-worktree; 开源靠 transform | **砚砚部分赢** → 维持 P2 |

**教训**：「脚本存在」不等于「用户流程闭环」。验证开源体验必须从用户入口（setup.sh）走一遍，不能只 grep 文件名。

### 深入分析记录（归档 — 均已处理）

#### PR #106 — done(isFinal) 保证 + CLI 超时 10分钟 (bouillipx, 7 files) — ✅ 已处理（拆分为 #121 + #122）

**两个独立改动**：
1. **done(isFinal=true) 保证**：route-serial.ts 增加 `yieldedFinalDone` 追踪变量 + finally 块合成终端 done 事件。**家里没有**（line 876 仅 `if (doneMsg)` 无保底）。这是真 bug fix：如果 agent 不 yield done 或 abort，前端永远转圈。带 4 个测试。
2. **CLI 超时 5→10 分钟**：cli-timeout.ts + useAgentMessages.ts DONE_TIMEOUT_MS 同步改。**家里仍是 5 分钟**。随 Claude CLI 模型越来越强、工具链越来越长，10 分钟更合理。
3. **useAgentMessages 上下文感知超时消息**：区分「已看到工具事件」和「纯等待」，中文/英文不同提示。**家里没有**。

**判断**：三项均为有价值改进且家里没有。建议 intake 到 cat-cafe，PR #106 可直接 merge 到 clowder-ai（代码质量好、有测试）。
**注意**：route-serial.ts 家里版本 (889行) 和 PR 基于的旧版有差异，intake 需手动 port。

#### PR #78 — 进程重启可见错误通知 (bouillipx, 3 files) — ✅ 已关闭（F048 A+ 覆盖）

**做了什么**：StartupReconciler 扫到孤儿 invocation 后，向受影响的 thread 发送可见错误消息 + WebSocket 广播。
- 新增 `messageStore` + `socketManager` 可选依赖
- 新增 `notifyAffectedThreads()` 方法
- 新增 `notifiedThreads` 计数在 sweep 结果
- index.ts 注入 messageStore/socketManager
- 3 个新测试 (正常通知、同线程去重、无 deps 时降级)

**家里现状**：StartupReconciler 只做静默 sweep（line 15-20: `StartupSweepResult` 无 `notifiedThreads` 字段）。用户进程重启后看不到任何错误提示，只能手动重发。

**判断**：非常有用的 UX 改进。家里确实缺这个。建议 intake。代码质量好，接口设计（optional deps + 降级）符合家里的风格。

#### PR #73 — API Key 认证冲突检测 (bouillipx, 4 files) — ✅ 已关闭（F117 覆盖）

**做了什么**：
1. 新增 `auth-mode-detector.ts`：启动时检测 ANTHROPIC_API_KEY env + ~/.claude/settings.json 与 subscription profile 的冲突
2. index.ts 增加启动检测调用（best-effort，不阻塞启动）
3. setup.sh 增加 Step 3: 认证模式选择（subscription vs api_key），自动写入 provider-profiles
4. 4 个测试

**家里现状**：`auth-mode-detector.ts` 不存在。`provider-profiles.types.ts` 存在（类型已有）。setup.sh 没有认证步骤选择。

**判断**：
- `auth-mode-detector.ts` 对开源用户很有用（很多人会搞混 subscription vs api_key）— 建议 intake
- `setup.sh` 改动与 PR #26 的 setup.sh 修改有冲突（都改了步骤编号），但方向正确
- **注意**：setup.sh 使用了 `readFile(settingsPath)` 读 `~/.claude/settings.json`，隐私安全可接受（只检测 key 存在性，不读取 key 值）

#### PR #26 — Skills symlink in setup wizard (mindfn, 9 files) — 🟡 部分 Intake

**做了什么**：
1. 新增 `scripts/sync-skills.sh`：创建 symlink 从 ~/.{claude,codex,gemini}/skills/ → cat-cafe-skills/
2. 新增 `scripts/check-skills-mount.sh`：检查挂载状态
3. setup.sh 增加 Step 3: Skills 挂载
4. test:public 排除列表更新（加了 ~12 个新排除项）
5. workspace-project-context.test.js git config 修复
6. 几个 JSX 格式化修复（CatCafeHub, ChatInputActionButton, ToastContainer, VoteConfigModal）

**家里现状**：`sync-skills.sh` 和 `check-skills-mount.sh` **已存在**（有更新的版本）。setup.sh 也有不同的改动。

**判断**：
- sync-skills.sh / check-skills-mount.sh → **已有等效或更新版本**，不需要
- test:public 排除列表 → **有价值**，但列表已过时（家里的排除列表已不同）
- workspace-project-context.test.js git config 修复 → **有价值**，小 fix 可以 cherry-pick
- JSX 格式化 → **lint/prettier 自动修复**，下次同步会自动处理
- setup.sh → 与 PR #73 冲突，需要合并考虑

#### PR #85 — `cat_cafe_propose_thread` proposal-first thread creation (bouillipx) — ✅ 已合入 clowder-ai

**状态**：merged 2026-05-27，squash commit `a1c44a8`，关闭 #82。最终 reviewed head 为 `6d6a2088`，CI 5/5 green，Opus maintainer review 已 APPROVE。

**做了什么**：F128 v2 proposal-first 实现，替代旧 direct-create 方向：
1. 新增 `cat_cafe_propose_thread` MCP callback tool，只创建 proposal，返回 `proposalId`，不返回 `threadId`
2. 新增 proposal store / callback route / approve-reject API / WebSocket proposal update
3. 前端新增 `ProposalCard`，用户可编辑、批准创建或驳回
4. approve 使用用户身份，创建 thread 后写入 audit 字段并更新 proposal 状态
5. 删除旧 `cat_cafe_create_thread` 工具注册和 direct-create 路径
6. F128 spec / ROADMAP / feature index 已按 proposal-first 更新

**家里现状**：F128 spec 已存在；实现仍需走 intake 决策，不能按旧 `cat_cafe_create_thread` 记录判断。

**判断**：
- 旧方向“猫直接创建 thread”已废弃
- 新方向“猫提议、铲屎官在卡片里编辑/批准/驳回、批准后才创建 thread”已被接受并合入开源仓
- 下一步如需回流家里，应按 open-source intake 流程逐 file 决策，不做整包覆盖

#### PR #107 — Proxy 上游弹性 (bouillipx, 2 files) — ✅ 已关闭（家里已有等效实现）

**做了什么**：anthropic-proxy.mjs 增加：
1. `fetchWithTimeout()` 替换原生 fetch（超时控制）
2. 网络错误重试（ECONNREFUSED, ECONNRESET, UPSTREAM_TIMEOUT 等）
3. `serializeProxyError()` 结构化错误响应（causeCode + retryable 标记）
4. 修复 content-length 在 sanitization 后不匹配的问题
5. 310 行新测试 (anthropic-proxy.test.js)

**家里现状**：`anthropic-proxy.mjs` **已有** MAX_RETRIES, UPSTREAM_TIMEOUT_MS, fetchWithTimeout 等等（grep 找到 13 处匹配）。

**判断**：**家里已经实现了等效功能**（很可能是同一个作者的改动已经通过其他途径合入）。差异点：
- 家里 `UPSTREAM_TIMEOUT_MS` 默认 60000ms，PR 默认 30000ms
- 家里有 `fetchWithTimeout` 但实现可能略有不同
- **不需要 intake**，但 PR 的测试 (anthropic-proxy.test.js) 可能有参考价值
- 关闭即可，说明家里已有等效实现
