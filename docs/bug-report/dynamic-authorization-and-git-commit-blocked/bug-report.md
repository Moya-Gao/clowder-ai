---
feature_ids: [F028]
topics: [dynamic, authorization, git]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 动态授权不可用 + `.git` 写入被拦截导致无法 commit

> **报告人**: 铲屎官（流程观察）+ 缅因猫（执行验证）
> **定位猫猫**: 缅因猫 🐾
> **报告日期**: 2026-02-10
> **严重程度**: P1（阻塞协作闭环）
> **状态**: 待修复

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：在当前会话中要求缅因猫提交 bug report 并完成 commit 闭环时，缅因猫反馈“无法动态请求授权、无法提交 commit”。
- 二次验证：缅因猫执行命令复现 `.git` 写入失败。

---

## 2. 复现步骤（期望 vs 实际）

### 问题 A（P1）：当前系统无法进行“动态授权”交互

1. 在会话内执行需要额外权限的动作（如写入受限目录/网络受限操作）。
2. 期望出现“请求铲屎官批准”的交互入口（弹窗或明确授权流程）。

期望：
- Agent 可在运行时发起授权请求，铲屎官可动态批准，随后继续执行。

实际：
- 当前会话策略为非交互批准模式（`approval_policy=never`），Agent 无法发起动态授权请求。
- 结果是遇到权限边界时只能失败或绕过，不能走“请求批准后继续”流程。

### 问题 B（P1）：`.git` 目录写入被拒，导致无法 commit

1. 在仓库根目录执行：`touch .git/index.lock`
2. 再执行：`git commit --allow-empty -m "..."`

期望：
- 能创建 `.git/index.lock`，并完成 commit。

实际：
- `touch .git/index.lock` 返回：`Operation not permitted`
- `git commit` 返回：`fatal: Unable to create .../.git/index.lock: Operation not permitted`
- 导致“完成子任务必须 commit”的流程规则无法满足。

---

## 3. 根因分析（定位过程）

### 3.1 动态授权链路根因

- 现象：会话运行策略禁止交互式授权（非产品内弹窗分支，而是会话级硬配置）。
- 结论：当前运行模式与 AGENTS.md 中“遇权限问题可请求授权”的协作预期不一致。

### 3.2 `.git` 无法写入根因

- 现象：工作区普通文件可写，但 `.git` 内创建锁文件失败。
- 命令证据：
  - `touch .git/index.lock` → `Operation not permitted`
  - `git commit ...` → 无法创建 `.git/index.lock`
- 结论：当前沙盒/挂载策略对 `.git` 写入有限制，直接阻塞版本控制写操作。

### 3.3 影响边界

- 不是“单条命令失败”，而是阻塞完整协作闭环：
  - 不能动态授权
  - 不能 commit
  - 影响“修复 -> 验证 -> 提交 -> 交接”的标准流程

---

## 4. 修复方案（为什么选）

### 方案 A（P1，必须）：恢复可用的动态授权路径

1. 在该项目会话启用可交互授权模式（允许 Agent 发起授权请求）。
2. 确保本地 `localhost`/受限操作可走统一批准流程。

Why：
- 权限失败后若无法请求授权，等价于“硬中断”，协作效率和可恢复性都很差。

Tradeoff：
- 增加少量授权交互成本，但换来可执行性和安全性（显式审批记录）。

### 方案 B（P1，必须）：放开 `.git` 写权限（至少 index/objects/refs）

1. 调整沙盒策略，允许该仓库 `.git` 必需写入。
2. 最低验收：`touch .git/index.lock` 与 `git commit --allow-empty` 成功。

Why：
- 无法 commit 会直接破坏团队“每个可验证子任务都提交”的硬规则。

Tradeoff：
- 需要更高权限边界，但可限定在当前仓库，不扩大到系统全局。

Open Questions：
- 这是会话级策略问题，还是 Cat Cafe App 回调模式下的全局默认策略问题？
- 是否需要在 UI 显式显示“当前会话授权模式（interactive/never）”以避免误判？

Next Action：
- 由布偶猫定位并修复运行时权限策略（动态授权 + `.git` 写入）。
- 修复后由缅因猫执行回归验证：授权流程 + commit 流程双绿再关闭问题。

---

## 5. 验证方式（Red → Green）

### Red（当前失败状态）

1. `touch .git/index.lock` 失败（`Operation not permitted`）。
2. `git commit --allow-empty -m "..."` 失败（无法创建 index.lock）。
3. 需要权限升级的动作无法进入“请求铲屎官批准”流程。

### Green（修复后通过门槛）

1. `touch .git/index.lock` 成功，且可清理锁文件。
2. `git commit --allow-empty -m "test"` 成功，log 可见新提交。
3. 触发一次受限操作时，Agent 能发起动态授权请求并在批准后继续执行。

