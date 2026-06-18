---
feature_ids: [F236]
related_features: [F148]
topics: [review, anchor-first, merge-gate]
doc_kind: review-request
created: 2026-06-17
---

# Review Request — F236 Phase A: Anchor-First Context Entry

- **Author**: 宪宪 / opus-4.8 🐾
- **Reviewer**: @gpt52（缅因猫 GPT-5.4，跨族）
- **Review-Target-ID**: f236
- **Branch**: feat/f236-phase-a
- **Commit**: c5e2c52f5（已 push origin）
- **Diff**: `git diff origin/main...origin/feat/f236-phase-a`（9 文件 632+/54-）
- **Spec**: `docs/features/F236-anchor-first-context-entry.md`（Phase A + B 节）

## Original Requirements（铲屎官原话 + 来源）

来源：F236 spec Why + 「信息完整性风险」段（铲屎官 2026-06-17）：
> 「让猫调工具时默认拿到指针+预览，全文按需第二跳取——把单次工具返回的 token 占用砍下来。」
> 「**变瞎子**比 anchor tax 更深——猫看 preview 以为够了、不知道自己漏了、基于残缺信息误判。防瞎子硬约束：诚实标注省略 + drill 极低成本一跳 + 保守默认。」

请 reviewer 对照判断：**省 token 与不伤判断（变瞎子防护）是否都达成**。

## Architecture Ownership（F191）

- **Architecture cell**: MCP server tools + API callback routes（返回 payload 组装）
- **Map delta**: update required —— callback route 新增 projection helper 层（`callback-anchor-helpers.ts`）
- **Why**: 在 callback route 返回构造前插入 anchorize 投影，不新建 Store/Router/Adapter/Queue
- 请 reviewer 检查 diff 是否与 Map delta 一致（无并行架构对象新增）

## What（改了什么）

| 落点 | 变更 | AC |
|------|------|-----|
| `callback-anchor-helpers.ts`（新建，159 行纯函数） | `truncateHead`/`truncateHeadTail`/`anchorThreadMessage`/`anchorPendingMention`/`anchorTaskWhy` + `PREVIEW_MAX_CHARS=280` | 全部 |
| `callbacks.ts` pending-mentions | head+tail excerpt + `requiresDrill` | AC-A3 |
| `callbacks.ts` thread-context | preview + speaker + 注入 effectiveThreadId + drillDown，省 contentBlocks 留 image hints | AC-A1/A2 |
| `callbacks.ts` get-message schema+projectMsg | `mode=preview\|full`，默认 preview 截断（保留 `content` 字段名）+ contentLength/truncated；full 记 `fullDrillChars` 日志 | AC-B1/B2 |
| `callback-task-routes.ts` list-tasks | why preview + whyLength/whyTruncated + `taskId` why-drill filter | AC-A4 |
| `callback-tools.ts` MCP | get_message 加 `mode`、list_tasks 加 `taskId`，handler 纯 pass-through | AC-A5 |

## Why

实时调读工具全文返回是 context token 大块（thread-context 默认回 100 条 full body）。anchor-first = 默认指针+预览，全文一跳 drill。F148 治"过去→context"（消息侧），本 feat 治"当下→context"（返回侧），同源姊妹篇。

## Tradeoff

- **breaking change**：get-message 默认 preview（非 full）—— drillDown 指针带 `mode=full`，从 anchor 一跳全文不受影响；直接调 get_message 不带 mode 拿截断（防无意识 dump）。已 grep 确认无外部消费方依赖旧 shape（MCP handler pass-through；AntigravityAgentService 那处是 fallback prompt 文档字符串，不解析 response）。
- **owner 新增 taskId why-drill**：AC-A4「全文按需」需闭环通道，复用 list-tasks thread-scope（ownership 自动保证），零新 route。

## Open Questions（技术 OQ — 给 reviewer）

1. PREVIEW_MAX_CHARS=280（~70 token）head-only 对 thread-context 是否够判断？还是该按工具区分阈值？
2. speaker 替换 userId/catId（AC-A2 精确字段）—— 有无我漏 grep 的消费方依赖 catId 区分？
3. get-message 默认 preview 的 breaking 面——除 callback endpoint 消费方外，有无遗漏？

## 自检证据（本轮真实运行）

- helper 单测：20/20 ✅
- callback-routes + get-message-visibility + mention-ack + antigravity + workflowSop：175/175 ✅（含 4 个新 AC 端到端 + content 减负 ≥60% 代理测试）
- integration（wiring + mcp-prompt-e2e）：23/23 ✅
- mcp callback-tools：57/57 ✅（含 2 个新 MCP forward + pass-through deepEqual 验证）
- biome check（改动文件）：0 error ✅；tsc build：exit 0 ✅
- 全套 api 测试：因别的猫 heap-prof 占满 CPU 导致 hang（已 kill 我的进程，非误杀）+ `-p` background 不可靠。kill 前捕获的失败**全部 diff-scope 外**（capability-orchestrator MCP-topology 路径迁移 / capabilities 91s 超时 / PtyDriver 47s 超时），单独验证 `capability-orchestrator.test.js` 不 import 我任何代码（0 matches）且无 CPU 竞争下仍失败 = worktree 环境 pre-existing，**非我引入**。

## Review 锚点（请重点看）

1. **AC-A5（砚砚 review 锚点）**：截断真的在 route projection helper 最内层吗？MCP handler 是否真 pass-through（`handleGetMessage`/`handleGetThreadContext` 直接 return callbackGet，无转换）——这保证 HTTP/agent-key/MCP 全吃到 anchor。
2. **变瞎子诚实**：每个截断有 truncated/requiresDrill/whyTruncated 标注 + 一跳 drillPointer 吗？head+tail 真保住尾部 handoff 指令吗？
3. **task why drill 安全性**：list-tasks taskId filter 在 user thread-scope 内（无跨 user 泄漏）吗？

## 预登记撤回条件（我最可能错在哪）

1. **get-message 默认 preview 的 breaking 面**最可能漏消费方——我 grep 了 callback endpoint 调用方，但 get-message 用途广（replyTo 回看），可能有我没覆盖的路径依赖 full content。
2. **task why taskId drill** 可能 over-engineering——若 reviewer 判断 AC-A4「全文按需」用 whyTruncated 标注已够、不需独立 drill 通道，我可以撤掉这条（回退到纯标注）。
3. **speaker 替换** 若有消费方依赖 thread-context 的 catId/userId 双字段，会破——撤回条件：grep 出真实消费方。

---
Next: @gpt52 review → 修反馈 → @宪宪 确认 → merge-gate（含 `git rm F236-PHASE-A-PLAN.md`）→ 愿景守护。
