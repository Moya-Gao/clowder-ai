---
feature_ids: [F016]
topics: [codex, cli, exit]
doc_kind: bug-report
created: 2026-02-12
---

# Bug Report: Codex CLI Exit Code 1 (False Alarm)

> 日期：2026-02-12
> 报告人：铲屎官 (运行时观察到错误消息)
> 调查人：布偶猫

## 1. 报告来源

铲屎官在 Cat Cafe 运行时观察到错误：
```
Error: Codex CLI: CLI 异常退出 (code: 1, signal: none)
invocation 09c9878e-cc5a-4fa4-86bd-5e1d694c8b2f
thread thread_mljcyoq5sjlh5wi9
```
铲屎官描述："他的 session 都不见了"。

## 2. 期望 vs 实际行为

| | 期望 | 实际 |
|---|---|---|
| CLI 退出码 | 0 (正常完成) | 1 (异常退出) |
| Session 文件 | 可见可访问 | 存在但隔离路径断裂 |
| Review 内容 | 完整传达 | 被 exit code 1 的 error 事件遮盖 |

## 3. 根因分析

### 3.1 核心发现：Codex CLI 正常完成但返回 exit code 1

Session 文件完整存在：
- 路径：`~/.codex/sessions/2026/02/12/rollout-2026-02-12T04-12-48-019c51c4-a71d-73a0-abf3-230b2abcd57b.jsonl`
- 大小：665,209 bytes (145 lines)
- 时间跨度：12:12:48 ~ 12:24:34 UTC (约 12 分钟)
- 内容：完整的 review 过程 (8 条 assistant 消息, 19 次工具调用, 无 error 事件)
- 最终输出：NEEDS_FIX 判定 + P2/P3 详情

Session 内没有任何 error 事件。缅因猫完成了完整的 F17b review 并给出了 NEEDS_FIX 判定。

**结论：Codex CLI 0.98.0 的 `exec` 子命令在正常完成后可能返回 exit code 1，而不是 0。**
这不是 Cat Cafe 的 bug，是 Codex CLI 的行为特征。

### 3.2 次要发现：隔离目录 symlink 曾自引用

调查过程中发现隔离目录 (`/tmp/cat-cafe-cli-isolation/codex-home/.codex/`) 的 symlink 状态异常：

```
auth.json -> /tmp/.../codex-home/.codex/auth.json  (指向自己!)
sessions  -> /tmp/.../codex-home/.codex/sessions   (指向自己!)
```

**自引用 symlink 导致**：
- `existsSync()` 返回 `false` (ELOOP)
- `readdirSync()` 抛出 `ELOOP: too many symbolic links encountered`
- Codex 进程无法通过隔离路径访问 auth 或 sessions

**但是**：在调查过程中整个隔离目录消失了（`/tmp` 清理或 API 服务器重启），所以无法完全确认这是崩溃的直接原因还是后续的症状。

`cli-config-isolation.ts` 代码分析显示：用 `os.homedir()` 计算 realPath，只要 `process.env.HOME` 未被预先修改，不应产生自引用。可能的原因：
1. `/tmp` 被 macOS 临时文件清理后，API 热重载时某种竞态条件
2. 另一个 API 实例（发现有 5 个 tsx watch 进程在运行）干扰了目录创建

### 3.3 "Session 不见了" 的原因

Session 文件实际存在于 `~/.codex/sessions/`。铲屎官说的"不见了"可能指：
- Cat Cafe 前端看到 error 事件后认为调用失败，没有显示 review 内容
- 隔离 HOME 里 sessions symlink 自引用，所以从隔离视角看 sessions 目录为空

## 4. 影响评估

- **数据丢失**：无。Session 文件完整保留。
- **功能影响**：缅因猫的完整 review 被 exit code 1 的 error 事件遮盖，铲屎官没有及时看到 review 内容。
- **根本原因**：Codex CLI 的 exec 退出码语义 + Cat Cafe 把非零退出码一律视为错误。

## 5. 修复建议

### P1: 容忍 Codex CLI exec 的 exit code 1

当前 `cli-spawn.ts:190` 把所有非零退出码都当错误。但 Codex CLI `exec` 在正常完成后可能返回 1（已知行为）。

建议：如果 stdout 流已经正常消费完毕（有 NDJSON 输出），对 exit code 1 降级为 warning 而不是 error，确保已收到的内容不被丢弃。

### P2: 隔离目录 symlink 健壮性

在 `getCodexIsolatedHome()` 中增加验证：创建 symlink 后立即 `readlinkSync` 检查目标是否正确（不是自引用），如果错误则 rm + 重建。

### P3: 多 API 实例竞态

发现有 5 个 `tsx watch` 进程同时运行（2 个 worktree 各自启动了 dev server）。多个实例共享同一个 `/tmp` 隔离目录可能导致竞态。建议在隔离路径中加入 PID 或随机后缀。

## 6. 验证方式

1. Exit code 1 问题：在 cat-cafe-runtime 环境下再次触发缅因猫调用，观察退出码
2. Symlink 自引用：编写单元测试模拟多进程并发创建隔离目录的场景
3. Review 内容可恢复：从 session 文件手动提取最终 review 内容（已在本次调查中完成）

## 7. 附录：缅因猫 Review 内容恢复

从 session 文件提取的缅因猫最终 review (F17b R2)：

```
[P2] ExportButton.tsx 新增了核心交互但没有对应前端测试
[P3] ExportImageButton.tsx 已替换后变成未使用代码
[P3] "测试全绿"与 web build 仍有类型错误的风险边界
VERDICT: NEEDS_FIX
```

> 注：P2 已在 commit `684a673` 中修复。P3 已在 BACKLOG #64, #65 登记。
