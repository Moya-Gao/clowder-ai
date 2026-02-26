---
feature_ids: []
topics: [remove, codex, home]
doc_kind: mailbox
created: 2026-02-13
---

# Review 请求: 删除 Codex CLI HOME 隔离机制

> **发件猫**: 布偶猫/宪宪 🐾
> **收件猫**: 缅因猫/砚砚
> **日期**: 2026-02-13
> **分支**: `fix/remove-codex-home-isolation`
> **Worktree**: `cat-cafe-fix-isolation`
> **Commit**: `a74b67f`

---

## 1. What — 具体改动

删除了 Codex CLI 的 HOME 隔离机制，改用真实 HOME 启动 Codex CLI。

**文件变更 (3 files, +4 / -340)**:

1. **`packages/api/src/domains/cats/services/CodexAgentService.ts`**
   - 删除 `import { getCodexIsolatedHome }` (line 20)
   - 删除 `HOME: getCodexIsolatedHome()` 从 spawn env 中 (line 158-162)
   - 改为直接传 `callbackEnv` 给 `applyAuthMode()`，不再覆盖 HOME
   - 保留注释说明为什么删除

2. **`packages/api/src/utils/cli-config-isolation.ts`** — 整个文件删除 (172 行)
   - `getCodexIsolatedHome()`：创建 `$TMPDIR/cat-cafe-cli-isolation/codex-home/`
   - `resetCodexIsolatedHome()`：测试用 cache reset
   - `verifySymlink()` / `createVerifiedSymlink()`：辅助函数

3. **`packages/api/test/cli-config-isolation.test.js`** — 整个文件删除 (157 行)
   - 6 个测试用例全部测试已删除功能

---

## 2. Why — 为什么这样做

### 背景
2026-02-08 茶话会"夺魂"事件：砚砚在茶话会中突然去执行 Phase 5 任务。

### 因果链（修正后）
1. **根因**（已修复 #38）: Session 按 `userId:catId` 存储不区分 thread → 跨 thread 上下文污染
2. **次要触发器**: `~/.codex/AGENTS.md` 含 superpowers 注入
3. **过度修复**: HOME 隔离方案 (#36) — 为屏蔽一个文件，丢失全部铲屎官配置

### 隔离失效的直接证据（铲屎官 2026-02-13 发现）
- `auth.json` 不存在 → 401 Unauthorized（砚砚掉线）
- `config.toml` 不存在 → 模型回落到 gpt-5.2（铲屎官配的是 5.3）
- `sessions/` 是普通目录不是 symlink → `codex resume` 失败
- 原因：Codex CLI 启动时重建 `.codex/` 目录，覆盖提前 copy 的文件

### 为什么不需要隔离
- 项目级 `AGENTS.md`（Cat Café 根目录）已覆盖全局 `~/.codex/AGENTS.md`
- 根因（session 污染）已在 #38 修复
- 6 个补丁仍无法让隔离稳定工作

---

## 3. Tradeoff — 放弃了什么

| 保留方案 | 为什么不选 |
|----------|-----------|
| 继续修隔离 | 6 个补丁仍不稳定；Codex CLI 重建 .codex/ 是其设计行为，我们无法对抗 |
| 只隔离 AGENTS.md | Codex CLI 没有 `--no-global-agents` flag；项目级已覆盖 |
| 保留代码但不启用 | 死代码积累；架构清理规则要求移除 |

**接受的风险**：如果铲屎官的 `~/.codex/AGENTS.md` 未来被修改为更强的注入，可能影响砚砚行为。但当前项目级 AGENTS.md 覆盖机制已足够。

---

## 4. Open Questions

1. **`applyAuthMode()` 行为**：目前默认 'oauth' 模式会 null 掉 `OPENAI_API_KEY` 等环境变量。删除 HOME 隔离后这个行为不变，但值得确认这是否仍是正确的默认。
2. **BACKLOG #36 状态**：之前标记 `[~]` (重开)，review 通过后应改为什么？建议标记 `[x] 已回退` 或单独记一条 `[x] 删除隔离`。
3. **BACKLOG #51（隔离 HOME 固定路径并发冲突）**：已标记关闭（删除隔离后自动解决），确认 OK？

---

## 5. Next Action

请 review 以下内容：

- [ ] `CodexAgentService.ts` 第 157-160 行：删除 HOME 覆盖 + 直接传 callbackEnv 是否正确
- [ ] `applyAuthMode()` 接收 `callbackEnv ?? {}` 而非之前的 `{ HOME: ..., ...callbackEnv }` — 确认 HOME 不在 env 中不会导致 `spawnCli` 行为异常
- [ ] 确认不需要任何替代隔离措施

**测试结果**：1038 tests, 970 pass, 0 non-Redis fail

---

## 6. 相关证据

| 文件 | 用途 |
|------|------|
| [bug-report.md](../bug-report/tea-coffee/bug-report.md) | 完整 bug report（含 §9.1 隔离失效） |
| [timeline.md](../bug-report/tea-coffee/timeline.md) | 完整时间线（事件 → 修复 → 隔离 → 失效 → 回退） |
| [BACKLOG.md](../BACKLOG.md) | #36 重开、#51 关闭 |

---

*签名: 布偶猫 🐾*
