---
feature_ids: [F152]
topics: [review, runtime, startup, safety, ports]
doc_kind: bug-report
created: 2026-04-10
updated: 2026-04-10
status: investigating
---

# Incident Report — Review `pnpm dev:direct` interrupted runtime (3001/3002)

> 日期：2026-04-10  
> 报告人：布偶猫（跨线程通知）  
> 调查人：缅因猫/砚砚（@codex）  
> 影响范围：runtime 在线实例可用性（Frontend/API）

## 1. 摘要

在 F152 PR review 过程中，reviewer 在主仓库执行 `pnpm dev:direct`。  
`start-dev.sh` 启动流程会先清理目标端口占用，导致 runtime 使用的 `3001/3002` 被终止，运行态中断。

这是一次 **可复现的流程+技术双重护栏缺失** 事故，不是单点手误。

## 2. 影响

- runtime 服务被中断（3001/3002 端口进程被杀）
- 铲屎官正在使用/依赖 runtime 时被动中断
- review 验证流程与在线服务争抢同一端口，存在再次复现风险

## 3. 时间线（UTC-7）

1. 收到 F152 review 请求，且请求要求 reviewer 启动 dev 并做前端截图验证。
2. reviewer 在主仓库执行 `pnpm dev:direct`，未先进入 review 沙盒。
3. 启动脚本执行端口清理逻辑，终止 `API_PORT/WEB_PORT` 监听进程。
4. runtime 3001/3002 被终止，在线服务中断。

## 4. 证据

- `start-dev.sh` 会直接 `kill` 占用端口进程：`kill_port()`  
  - `scripts/start-dev.sh:482`
- `main()` 启动时无条件调用 `kill_managed_ports`（包含 API/Frontend）  
  - `scripts/start-dev.sh:1083`
  - `scripts/start-dev.sh:1090`
- `kill_managed_ports()` 默认清理 `API_PORT/WEB_PORT`（默认 3002/3001）  
  - `scripts/start-dev.sh:507`
  - `scripts/start-dev.sh:510`
  - `scripts/start-dev.sh:511`
- runtime 通道已有“重启需授权”护栏，但只在 `runtime-worktree.sh` 生效；`dev:direct` 不经过该护栏  
  - `scripts/runtime-worktree.sh:244`
  - `scripts/runtime-worktree.sh:254`
- SOP 明确 runtime 是单实例，不应随手重启  
  - `docs/SOP.md:44`
  - `docs/SOP.md:47`
- review 流程文档要求在 review 沙盒操作  
  - `cat-cafe-skills/request-review/SKILL.md:82`
  - `cat-cafe-skills/request-review/SKILL.md:98`
- 本次 review 请求也明确要求 launch dev 做前端验证  
  - `docs/mailbox/2026-04-10-f152-phase-b-review-request.md:34`

## 5. 根因链条

### 直接原因

`pnpm dev:direct` 触发 `start-dev.sh` 端口清理逻辑，直接终止了 runtime 同端口进程。

### 系统性根因

1. **命令行为层**：`start-dev.sh` 默认策略是“端口被占用就 kill”，未校验进程归属（本 worktree / runtime / 其他实例）。
2. **护栏分裂层**：`runtime-worktree.sh` 有 `CAT_CAFE_RUNTIME_RESTART_OK` 授权保护，但 `dev:direct` 路径没有同等级保护。
3. **流程执行层**：review 沙盒规范存在于文档，但缺少工具级强制和默认入口，执行容易偏离。

## 6. 已有防线评估

- 已有：`guard_main_branch_start()` 可阻止 main 分支直接启动（`scripts/start-dev.sh:1027`）。  
  - 结论：**防线不足**。事故发生在“主仓库 + 非 main 分支”场景，未被覆盖。
- 已有：Redis 6399 圣域保护（`scripts/start-dev.sh:1060`）。  
  - 结论：对 Redis 有效，但对 API/Web 端口无同等级“归属保护”。

## 7. 系统修复（CAPA）

### A. 代码护栏（必须）

1. 在 `start-dev.sh` 增加 **runtime 端口归属保护**（默认拒绝杀 3001/3002）  
   - 条件：`PROD_WEB=false` 且命中 runtime 端口 + 端口已有监听进程  
   - 行为：直接 fail fast，提示使用 review 沙盒端口（3201/3202）  
   - 仅在显式授权（例如 `CAT_CAFE_RUNTIME_RESTART_OK=1`）时允许继续

2. 为 `kill_port()` 增加“进程归属检查”  
   - 基于占用进程 `cwd` 与当前 `$PROJECT_DIR` 对比判定归属，不硬编码端口号  
   - 当监听进程不属于当前 worktree（runtime/alpha/其他沙盒）时，默认拒绝 kill

3. 补回归测试  
   - 在 `scripts/test-start-dev.sh` 增加：
     - 命中 runtime 端口时默认拒绝
     - 有显式授权时可继续
     - 非 runtime 端口仍按现有逻辑清理

### B. 流程护栏（必须）

1. 提供 review 专用启动入口（示例：`pnpm review:start`）  
   - 自动分配 `3201/3202`（或可用端口池）
   - 自动打印截图/验证入口 URL

2. 在 `request-review` 模板新增“review 启动命令”与“预期端口”字段（必填）

3. 在 `quality-gate` / `request-review` 中新增检查项  
   - 前端需 launch dev 的 review：必须给出沙盒路径+端口，且不为 runtime 端口

### C. 治理补丁（建议）

1. 将该事故沉淀到 `docs/lessons-learned.md`（同类事故复发阈值触发升级）  
2. 对 `pnpm dev:direct` 增加明显安全提示（首次运行确认/警告文案）

## 8. 验收标准

1. 在主仓库执行 `pnpm dev:direct` 且 3001/3002 已被 runtime 占用时：**应直接失败，不杀进程**。  
2. 在 review 沙盒按 3201/3202 启动：**可正常启动且不影响 runtime**。  
3. 新增测试覆盖上述行为，CI 通过。  
4. request-review 文档中能看到 reviewer 使用的沙盒路径与端口证据。

## 9. 结论

本次事故不是“误操作”层面的单点问题，而是“默认行为可伤在线实例 + 流程没有工具化强制”的组合漏洞。  
需要同时落地代码护栏与流程护栏，才能把复发概率从“靠人记得”降到“默认不可能发生”。
