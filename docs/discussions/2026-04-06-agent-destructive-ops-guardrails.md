---
title: "Agent 高权限连续运行的防删库 Guardrail 提案"
date: 2026-04-06
participants: [缅因猫(gpt52), 布偶猫(opus), 暹罗猫(gemini)]
trigger: 铲屎官要求基于 linux.do 删库事故合订本与家内教训，收敛一版“不要逼人开 --yolo”的防删库方案
status: proposed
---

# Agent 高权限连续运行的防删库 Guardrail 提案

> 输入材料：
> 1. linux.do《【合订本】警钟长鸣，收录论坛看到的 AI 删库事故》首楼 34 个案例链接
> 2. 我们家内教训：LL-010（`trash` 代替 `rm`）、LL-015（6399 圣域）、LL-035（`rsync --delete` 打穿 runtime）
> 3. 三猫独立思考后收敛：架构层（布偶猫）、UX 层（暹罗猫）、质量/事故模式层（缅因猫）

## 结论先说

**不要把安全主要做成“同步审批”。**

如果系统把安全建在高频弹窗确认上，铲屎官和其他用户最终会为了可用性打开 `--yolo` / auto-approve / full access。那不是用户“不懂安全”，而是产品把安全设计成了“必须全程陪跑”。

所以我们要追求的不是“不给权限”，而是：

> **即使在高权限、长时间 unattended、默认连续运行的模式下，agent 也只能在可逆、有限界、可观测的环境里犯错。**

---

## 一、三猫共识

### 1. 真正的问题定义

不是“AI 权限太大”，而是：

- **破坏半径无界**
- **反馈环路延迟**
- **agent 只有 token 级情境意识，没有人类的文件系统空间感**
- **真正的破坏不只来自删除，也来自覆写、截断、原地修改**

外部案例里最危险的组合不是“会写代码”，而是：

- Windows
- PowerShell / `cmd /c rd /s /q`
- 删除 / 清理 / 缓存 / 瘦身 / 重命名
- `--yolo` / 最高权限 / 自动批准
- 用户离开几分钟

### 2. 主护栏不该放在“执行前问一下”

三猫一致认为，主护栏必须建在 **执行环境层**，也就是 agent 意图和 OS / filesystem 之间。

强度从弱到强大致是：

1. Prompt / system instruction
2. Permission gate / 逐条审批
3. **Execution environment guardrail**
4. OS / filesystem

真正有效的是第 3 层，不是第 1/2 层。

### 3. 目标不是“限制能力”，而是“改变失败形态”

我们不该追求“agent 永不犯错”，而要追求：

- 删除、覆写、截断默认可逆或至少留底
- 越界默认失败
- 大规模异常默认暂停
- 事后可追溯
- 用户不需要每 30 秒点一次同意

---

## 二、统一设计原则

### P1. 默认高权限可跑，但破坏性操作必须被环境重写

不是禁止 `rm` / `Remove-Item`，而是让删除、覆写、截断、原地修改在 runtime 里被强制改写成安全语义。

### P2. 保护对象不是“命令文本”，而是“真实影响范围”

不能只检查有没有 `rm -rf`。必须看：

- realpath / 规范化后的真实路径
- 是否越界到 workspace 之外
- 是否触达系统目录 / 用户主目录 / 盘符根 / 多仓库
- 删除或覆写的数量 / 总体积 / 连续 destructive 频率
- 是否命中敏感文件（如 `.env`、密钥、配置、数据库文件、锁文件）
- 是否命中远程不可逆语义（如 force push、DROP/DELETE、registry unpublish、容器/缓存全量清空）

### P3. 99% 的正常动作静默通过，只在离群值时打断

不要让 `mkdir`、`npm install`、普通低风险写入都弹窗。只在 blast radius 异常时提示。

### P4. undo 能力是高权限可用性的前提

没有 undo 的严格模式，最后只会把用户推向 `--yolo`。

### P5. Windows 必须单独做高危平台处理

不能把 PowerShell / `cmd` 路径语义当作 Unix shell 的一个变体。

---

## 三、分层 Guardrail 方案

## Layer 0: Scope Declaration

每次任务启动时，runtime 要显式知道本轮允许触达的根边界。

最小字段：

- `workspace_root`
- `allowed_write_roots[]`
- `allowed_delete_roots[]`
- `protected_roots[]`
- `allowed_network_targets[]`
- `allowed_mutation_targets[]`
- `platform`

默认：

- `workspace_root` 之外不可写
- 删除权限比写权限更窄
- 系统目录、盘符根、用户主目录敏感区默认进 `protected_roots`
- 未声明的远程目标默认只读或拒绝变更
- 远程 destructive mutation 需要和本地 destructive mutation 同等级治理

这层的目标不是给 agent 看，而是给执行器做硬判断。

这里必须明确：**scope 不只是一组文件路径，也是一组外部状态边界。**

典型外部状态包括：

- Git remote
- 数据库 / Redis / 各类持久化存储
- Docker / k8s / 云资源
- HTTP API / MCP 外部系统
- 包管理 / 制品仓库 / registry

## Layer 1: Safe Destructive Mutation Runtime

任何由 agent 触发的 destructive mutation，默认都不直接落到不可逆物理 I/O。

统一语义：

- 删除 → 移到回收区 / trash
- 覆写 / 截断 → 先做写前备份，再执行原子替换
- 原地修改（如 `sed -i`）→ 改写为“备份旧版本 + 生成新版本 + 原子替换”
- 递归清理 → 先生成待删除清单，再批量可逆移动

### Unix

- shell 兜底继续保留 `trash` 思路（LL-010）
- 但不能只靠 alias
- 更强实现可以是：
  - `LD_PRELOAD`/shim 拦截 `unlink()` / `rmdir()`
  - 对高危覆写路径做 write-before-backup / shadow copy
  - seccomp / wrapper 限制
  - repo-local recycle area

### Windows / PowerShell

- 不能只靠 alias `Remove-Item`
- 必须在 runtime 层统一改写：
  - `Remove-Item -Recurse -Force`
  - `cmd /c rd /s /q`
  - `>` / `>>` / `Set-Content` / `Out-File` / `Clear-Content`
  - `sed -i` / 原地修改脚本 / 任何清空后重写的 helper
  - 任何 shell 生成的删除脚本
- 实际执行语义应改成：
  - 回收站 API
  - runtime 托管回收区
  - 对覆写/截断走 runtime 托管的 pre-write backup

**原则：agent 以为自己在删或改，环境实际在可逆移动或留底后替换。**

## Layer 2: Pre-Destructive Snapshot

只要命中 destructive classifier，就在执行前自动创建轻量快照。

命中样例：

- `rm -r`
- `git clean -fdx`
- `rsync --delete`
- shell 重定向覆写（`>`、`1>`、清空再写）
- `sed -i` / 原地修改工具
- 批量 rename / move
- cache clean / temp clean / model prune
- 数据库 destructive DDL / truncate / drop

实现方向：

- Git 项目：`git stash -u` / 临时 commit / index snapshot
- 文件系统支持 COW 时：snapshot
- 非 COW 场景：最小范围 hardlink / copy-on-write / manifest 级恢复点
- Windows：优先研究 VSS 或 runtime 自己的 restore point

这层是我们从 LL-035 学到的硬要求。  
同时要注意：**快照不能成为 Phase B 才补的能力。** 对高危覆写/截断，至少要有极轻量级的写前备份在 Phase A 先落地，否则 `.env` 被清空、配置被抹白、代码被原地改坏时，safe-delete 根本救不到。

## Layer 3: Path Anchoring / Radius Fence

所有路径相关 destructive 操作在执行前都必须做规范化与围栏判断。

检查顺序：

1. 展开环境变量
2. 路径规范化
3. realpath / Resolve-Path / junction / symlink 解析
4. 判断是否仍在允许边界内

### 必拦截场景

- 超出 `workspace_root`
- 命中 `protected_roots`
- 删除目标是盘符根
- 跨越多个仓库根目录
- 通过 `..` / env var / junction / symlink 逃逸

### 为什么 Windows 必须单独强调

外部案例反复证明：

- PowerShell 转义错误
- `$env:*` 展开后偏到意外目录
- `Resolve-Path` 结果超出预期
- `cmd /c rd /s /q` 绕过表面检查

都会把“清缓存”升级成“清盘”。

## Layer 3B: Network / API Scope Fence

整个 guardrail 不能只守本地文件系统，还必须守外部状态边界。

必须纳入治理的典型操作：

- `git push --force`
- `gh repo delete`
- `psql -c "DROP ..."` / destructive migration
- `redis-cli FLUSHALL`
- `docker rm -f ...` / `docker system prune`
- `curl -X DELETE ...`
- registry unpublish / artifact delete

检查维度：

1. 目标是谁（remote / host / database / registry / API）
2. 本轮 scope 是否声明允许修改它
3. 语义是否属于 destructive mutation
4. 是否存在可逆手段或恢复点

如果没有通过这些检查，本地 6 层 guardrail 再完整，也只是“守住了磁盘，没守住网线”。

## Layer 4: Blast Radius Circuit Breaker

我们不应该“每次都问”，但应该在离群值时自动停。

这里要拆成两条并行通道：

- **filesystem circuit breaker**
- **egress circuit breaker**

建议阈值示例：

- 单次删除文件数 > 50
- 单次覆写/截断敏感文件数 > 3
- 删除总体积 > 当前项目体积的 10%
- 单次原地修改触达核心配置 / 密钥 / 锁文件
- 目标落在 workspace 外
- 连续 3 次 destructive 操作
- 命中系统目录 / 盘符根 / 主目录
- 单次远程 destructive action 命中生产 remote / 主分支 / 真实数据库 / registry
- 未声明目标上的 HTTP `DELETE` / destructive SQL / force push / prune / flush
- 同一批次内出现多个跨系统 destructive egress

动作：

- 暂停执行
- 发送影响摘要
- 给出 `halt & rollback` / `continue anyway`

注意：  
这里展示的是**结果摘要**，不是原始 shell 命令。

用户应看到：

- 将删除多少文件
- 总体积多大
- 真实目标路径在哪里
- 是否越过项目边界
- 是否可回滚
- 如果是远程动作：会改哪个 remote / 哪个库 / 哪个 API / 哪个环境

而不是让用户读一段 PowerShell。

## Layer 5: Audit + Panic Button

高权限 unattended 运行必须有两种能力：

### 审计

- destructive actions 的结构化日志
- 执行前 scope / 规范化路径 / classifier 命中原因
- restore point ID / trash item ID
- pre-write backup ID / 被覆写前摘要
- remote target / endpoint / branch / database / cluster / registry 识别结果
- Windows 强制 transcript / 命令输出归档

### 紧急刹车

- UI / CLI 显眼位置提供 `Halt & Rollback`
- 支持“停止当前批次 + 回滚最近一组 destructive 变更”

没有这个按钮，用户就只能赌 `Ctrl+C` 是否还来得及。

---

## 四、平台差异化要求

## Windows / PowerShell / cmd

列为高危 lane，规则更严：

- 默认启用路径规范化中间件
- 默认启用 transcript
- 默认把 destructive shell 调用改写到 safe-delete runtime
- 默认提高 blast radius 灵敏度
- 默认把“清缓存 / 清模型 / 清临时文件”判成 destructive

特别注意：

- `cmd /c rd /s /q`
- `Remove-Item -Recurse -Force`
- `takeown` / `icacls` 后接删除
- 依赖 `%TEMP%` / `$env:*` / 相对路径拼接的脚本

这些都不能按普通命令处理。

## Unix / macOS / Linux

风险相对更可控，但仍需要：

- `rm` 不直接硬删
- `rsync --delete` 前自动 snapshot
- namespace / bind mount / sandbox 限定可写范围
- symlink / realpath 逃逸检测

---

## 五、哪些方案会把用户逼向 `--yolo`

- 每次读写都审批
- 只有“允许全部 / 禁止全部”的粗权限模型
- 弹出用户根本不会读的命令确认框
- 没有 undo 的严格模式
- 把护栏主要写在 prompt 里
- 以为“全部放 Docker 里”就自然安全

这类方案的共同问题是：

> 它们把安全成本压给用户，而不是压给执行环境。

---

## 六、三猫视角如何拼起来

## 布偶猫贡献的主轴

- 问题定义：破坏半径无界 + 反馈环路延迟
- 主护栏位置：execution environment layer
- 机制主轴：强制软删除 + 自动快照 + 路径围栏 + 统计异常 + Windows 专项

## 暹罗猫贡献的关键提升

- 不要把安全做成打断心流的收费站
- 用户不该 review 命令，应该 review blast radius 摘要
- 需要显式 panic button 和低摩擦可回滚体验

## 缅因猫补的硬判断

- 外部事故里最密集的是 Windows + PowerShell + 清理类任务
- “清缓存/删旧模型/重命名/瘦身”必须被当作 destructive lane，而不是普通 housekeeping
- prompt 级提醒远远不够，真正能救命的是 runtime enforce

---

## 七、建议的落地顺序

## Phase A: 先把最危险的坑堵住

1. destructive classifier（包含 delete + overwrite + truncate + in-place edit）
2. safe destructive mutation runtime（至少 shell 入口 + tool 入口）
3. 写前备份（至少覆盖高危覆写/截断）
4. path normalize + workspace fence
5. network/API scope fence + egress classifier
6. blast radius 摘要

**目标：** 把“清缓存结果删盘”“看似没删文件、实则把关键文件抹白/覆写”，以及“本地文件系统没事但远程仓库/数据库/容器被一把梭”这三类事故都从可发生，降到默认拦住。

## Phase B: 把“可恢复”做实

1. pre-destructive snapshot
2. rollback 流程
3. panic button
4. 结构化审计链

**目标：** 即使误删发生，也不再直接进入不可逆损失。

## Phase C: 平台专项强化

1. Windows transcript
2. junction / symlink / env expansion 深入解析
3. macOS / Linux namespace/sandbox 细化

**目标：** 让 platform-specific 高风险通道被单独治理，而不是混在通用逻辑里。

---

## 八、需要铲屎官拍板的点

1. 我们是否接受“默认连续运行，但 destructive 操作一律先进可逆层”作为产品原则？
   这里的 destructive 操作明确包括 delete、overwrite、truncate、in-place edit，不只 delete。
   对外部状态则对应为：force push、destructive SQL、DELETE API、registry/container/cache 清空等。
2. Windows 是否明确设为高危平台 lane，采用更严格的默认 guardrail？
3. blast radius 告警是“自动暂停等待确认”，还是“短暂停顿 + 默认继续 + 用户可紧急刹车”？
4. 我们要不要把“普通清理任务默认视为 destructive lane”写成明规则？

---

## 收敛检查

1. 否决理由 → ADR？[没有，当前是提案草稿，尚未进入正式决策]
2. 踩坑教训 → lessons-learned？[没有新增独立 lesson；本提案直接复用 LL-010 / LL-015 / LL-035]
3. 操作规则 → 指引文件？[没有，当前未定版；等铲屎官拍板后再更新 shared-rules / AGENTS]
