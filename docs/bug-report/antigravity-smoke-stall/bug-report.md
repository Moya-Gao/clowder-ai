---
feature_ids: [F081]
topics: [antigravity, smoke-test, timeout, observability, cli]
doc_kind: bug-report
created: 2026-03-07
---

# Bug Report — Antigravity Smoke Test Stall

## 1) 报告人
- 报告来源：铲屎官在 Cat Café runtime 与 Claude Code 双线观察布偶猫 session
- 触发方式：布偶猫执行 `packages/api` 测试时，CLI 长时间无刷屏输出，表现为“像卡住”
- 相关 session：
  - `7ef0ef90-ac7c-4672-85f1-e1dd8d9ee444`（Cat Café runtime 驱动）
  - `bfe74a71-e28f-456d-83e4-ae8c5c4bce14`（外部 Claude Code `resume` 驱动）

## 2) 复现步骤（期望 vs 实际）

### 场景 A：默认 `packages/api` 测试
- 前置：本机 `localhost:9000` 上已有 Antigravity 在监听
- 操作：在 `packages/api` 下运行 `pnpm test`
- 期望：默认测试套件快速推进；即使 smoke test 失败，也应在声明的超时窗口内结束并回收资源
- 实际：测试链进入 `test/antigravity-smoke.test.js` 后，CLI 长时间沉默；Node test worker 能存活 8 分钟到 20 多分钟，远超 smoke test 自己标记的 90 秒

### 场景 B：同一现象影响不同来源的布偶猫
- 前置：一条 session 由 Cat Café runtime 拉起，另一条由外部 `claude --resume` 拉起
- 操作：两条 session 都执行 `packages/api` 测试
- 期望：若卡住是会话来源问题，至少不应稳定落在同一个测试 worker
- 实际：两条 session 最终都卡在 `test/antigravity-smoke.test.js`

## 3) 根因分析

### 现场证据
- `packages/api/package.json` 把 `antigravity-smoke.test.js` 直接包含在默认 `pnpm test` 的 `node --test test/*.test.js` 里
- `curl http://localhost:9000/json/version` 正常返回，说明 Antigravity 端口存活
- `lsof` 显示两个最深 test worker 都保持着到 `127.0.0.1:9000` 的 `ESTABLISHED` TCP 连接
- `sample` 显示 test worker 并未忙 CPU，而是在事件循环里 `kevent` 空等
- live DOM 勘验显示：消息已经成功发进 Antigravity，且 `antigravity-agent-side-panel` 里确实出现了 assistant 回复文本，包含 `pong`
- 但当前 `pollResponse()` 的 DOM 假设和页面真实结构不一致：它盯的是旧的 `.group -> nextElementSibling` 路径，而当前 Antigravity 把 user / assistant turn 放在同一消息线程根节点下的相邻块中
- 另外 `.codicon-loading` 在页面里常驻于 status bar；把它当作全局“仍在生成”信号，会把已经生成好的回复误判成未完成

### 最终根因
1. `antigravity-smoke.test.js` 只要探测到 `:9000` 有 Antigravity，就会自动参战，导致任何默认 `pnpm test` 都可能踩到它
2. 第一条 smoke test 在断言全部通过后才执行 `await client.disconnect()`；如果 `pollResponse()` 返回 `null` 或中途抛错，连接清理不会进入
3. `pollResponse()` 在 `sendMessage()` 之后才记录 user message count，却要求后续 `userMsgCount > baselineCount` 才算“新一轮完成”；单次 round trip 里这个条件天然不成立
4. `pollResponse()` 同时依赖了两个过时前提：
   - 把全局 `.codicon-loading` 当成 chat 内 loading，实际它经常只是 status bar 的常驻转圈
   - 通过“最后一条用户消息 `.group` 的下一个 sibling”去读 assistant 回复，实际当前 Antigravity DOM 已经换成同一线程容器下的并列 turn block
5. 结果是：Antigravity 实际已经回复，但 smoke test 读不到；再叠加 cleanup 缺失时，就会留下 CDP/WebSocket 活句柄，把 worker 变成“沉默活口”，再被布偶猫 CLI 侧看成“卡住不动”

## 4) 修复方案与取舍
- 方案 A（采用）
  - 把 `antigravity-smoke` 改成显式 opt-in：默认 `pnpm test` 只会快速 skip，不再自动参战
  - 将 round-trip smoke harness 改成 `try/finally`，确保无论成功、超时、断言失败还是中途抛错，`disconnect()` 都会执行
  - 修正 `pollResponse()` 的完成判定与 DOM 读取逻辑：
    - 以“当前已可见的 user message count”作为期望值，而不是要求后续必须再增长一次
    - 改为从 `antigravity-agent-side-panel` 的真实 turn thread 中提取 assistant 文本
    - 只观察 chat turn 内部的 loading 状态，不再被全局 status bar spinner 误导
  - 为显式运行提供单独脚本，保留我们手动验收 Antigravity 的能力
- 放弃方案
  - 仅增加日志，不做隔离：能帮助观察，但不能阻止它继续绊倒所有默认测试
  - 只依赖 Node test timeout：现场已证明测试自身的 90 秒超时不足以保证 worker 退出

## 5) 验证方式
- Red→Green
  - 新增测试锁定 smoke gate：未显式开启时返回 skip reason，显式开启且端口可达时才运行
  - 新增测试锁定 harness cleanup：成功与失败路径都必须调用 `disconnect()`
  - 新增测试锁定 `pollResponse()`：当前 user message count 不再要求额外增长一次，inline loading 清除后可稳定返回文本
- 回归
  - 运行新的单测文件
  - 运行 `packages/api` 相关的 Antigravity 单测集合
  - 验证默认 `pnpm test` 不再因本机 `:9000` 活着而自动把 smoke test 拉进来
  - 验证显式 `RUN_ANTIGRAVITY_SMOKE=true node --test test/antigravity-smoke.test.js` 现在 2 case 绿，并在 10 秒级窗口内完成 round trip，而不是几十分钟装死
