# Review Request: F176 — Native CLI Assistant-Speech vs CLI-Stdout 渲染语义分离

Review-Target-ID: f176
Branch: feat/f176-cli-rendering

## What

引入 `messageRole?: 'final' | 'thinking' | 'cli_stdout'` 语义字段，与 `origin` transport 字段正交。后端在 native CLI provider yield/persist 阶段标记 `final`；前端 `ChatMessage` 按 `messageRole` 分流——`final` 走主气泡（CollapsibleMarkdown），`cli_stdout` 或 `undefined` 走 `CliOutputBlock`（向后兼容）。

3 commits on branch:
- `58dbe7fd9` feat(F176-1) 后端 messageRole tagging
- `4f9b8f12b` feat(F176-2) 前端按 messageRole 分流主气泡
- `0c5d57201` chore biome auto-format + index.json regen

文件改动（F176 scope only）:
- `packages/api/src/domains/cats/services/types.ts` (+10) — `MessageRole` 加到 `AgentMessage`
- `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (+10) — 加到 `StoredMessage`
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (+8) — yield + persist 标 final
- `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (+9) — yield + persist 标 final
- `packages/api/test/f176-message-role-tagging.test.js` (+155, new) — 后端 3 case
- `packages/web/src/stores/chat-types.ts` (+10) — `ChatMessage.messageRole`
- `packages/web/src/components/ChatMessage.tsx` (+11/-3) — `isFinalRole` 渲染分支
- `packages/web/src/components/__tests__/cli-output-integration.test.ts` (+62) — 前端 4 新 case
- `docs/features/index.json` regen

## Why

`thread_mnux2eewbo4otg17` 实测：codex/opus 通过 native CLI provider 输出的正经回复（PR review、merge 报告）**完全看不到主气泡**，只显示折叠的 `CLI Output | done | N tools | XmYs` 标题。

根因（双猫并行诊断 5/5 一致，2026-04-25 13:18）：
- F097 立项时假设 stream text = thinking/internal，统一折叠到 CLI Output
- 但 native CLI provider（codex/opus）的 final assistant text 也走同一个 stream 通道，被一并折叠
- 测试 `cli-output-integration.test.ts:106` 锁住了这个行为（intentional design）

F176 通过新增语义字段 `messageRole` 区分 final response 与 cli_stdout，**渲染层分流**，**不动 invocation/bubble identity**——F173 dedup/ghost/split-brain 防护零碰撞。

## Original Requirements（必填）

> 铲屎官 2026-04-25 13:14：
> "定位看看 这到底是啥啊，这 前端看到你们互相调用 但是看不到你们 的说话气泡？ thread_mnux2eewbo4otg17 这个thread发生的"

> 铲屎官 2026-04-25 13:17：
> "我建议 一个完整的解决方案的？ 以及们这个搞了会不会f173又回来了 气泡又裂开了 你们觉得 应该怎么样做好点的？ 完整的解决"

- 来源：thread_mnux2eewbo4otg17（铲屎官报告 + 双猫诊断 + 完整方案讨论）
- F176 spec：`docs/features/F176-native-cli-assistant-speech-rendering.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**放弃方案 A（改默认 `cliOutput: 'expanded'`）**：1 行改动但全 thread 一刀切，CLI 噪音回到用户面前 — 倒退 F097 设计。

**放弃方案 C（前端启发式判断 stream + 无 toolEvents 时渲染主文本）**：依赖 `hasToolEvents.length` 启发式，是 F173 历史 bug 的来源（启发式分类难维护）。

**选择方案 B（后端权威 messageRole 字段 + 前端按字段分流）**：
- 后端权威分类 → 不在前端做启发式
- `messageRole === undefined` 走旧逻辑 → 历史消息零破坏
- F097 设计保留（`messageRole='cli_stdout'` 显式标记仍折叠）
- F173 收口路径零碰撞（不动 invocation/bubble identity）

## Open Questions（请 reviewer 重点关注）

1. **F173 共存验证**：502/502 hook 测试全绿（含 dedup/ghost/split-brain 防护），是否足以证明零回归？还是需要单独加 F173 dedup 套件 case（spec AC-3.2/3.3 标了 🟡 deferred）？

2. **持久化 messageRole 覆盖范围**：当前只在 cat 主响应（有 text content）时标 `final`。其他持久化分支（`shouldPersistNoTextMessage` / `error+toolEvents-only`）保守不标，让 rich blocks / CLI Output 走原本路径。这个保守策略是否合理？

3. **Phase 4（历史数据兼容）选择保守路径**：旧 `origin='stream'` 无 `messageRole` 消息按 collapsed CliOutputBlock 渲染（用户手动展开看正文）。**不**做 hydration 启发式 promote（怕 F173 历史教训）。是否需要更激进的迁移路径？

4. **Phase 4 不在本 PR**：spec 已说明，Phase 4 历史兼容是 follow-up（用户清 IDB cache 即可）。

## Next Action

请砚砚（缅因猫，跨家族 reviewer）做 PR review：
- 重点核 F173 共存策略（不动 invocation/bubble identity 的论断是否成立）
- 核 messageRole tagging 范围是否合理（是否漏了 final response 应标的分支）
- 核测试覆盖是否充分（特别是 backwards-compat fallback 路径）

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f176/codex`
- Start Command: `pnpm review:start`
- Ports: 由 `pnpm review:start` 自动分配（起点 3201/3202），Reviewer 收到后填写实际端口

## 自检证据

### Quality Gate 通过 ✅

完整 quality-gate 报告见 thread `thread_mnux2eewbo4otg17`（2026-04-25 14:24 quality-gate 步骤）。摘要：

| AC | 状态 |
|---|---|
| 1.1-1.5 后端 MessageRole + tagging | ✅ |
| 2.1-2.4 前端按 messageRole 分流 + 兼容 | ✅ |
| 2.3 thinking role 路径 | ➖ deferred（thinking 走 `message.thinking` 字段，messageRole='thinking' 暂未需要）|
| 3.1 cli-output 双 case 全绿 | ✅ |
| 3.2/3.3 F173 dedup/streaming 加 case | 🟡 未独立加（502/502 hook 全绿证明 F173 ledger 不破）|
| E1 thread_mnux2eewbo4otg17 现象消失 | 🟡 待 alpha 验收（merge 后 `pnpm alpha:start`）|
| E2 F097 真 CLI tool 仍折叠 | ✅ |
| E3 F173 防护全绿 | ✅ |

### 测试结果（这次真实运行 2026-04-25 14:25-14:30）

```
node --test packages/api/test/f176-message-role-tagging.test.js
→ 3/3 pass, 0 fail

node --test packages/api/test/route-serial-*.test.js packages/api/test/route-parallel-*.test.js
→ 48/48 pass, 0 fail

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/cli-output-integration.test.ts
→ 7/7 pass, 0 fail

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/chat-message-*.test.* src/components/__tests__/thinking-*.test.ts
→ 24/24 pass, 0 fail

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/
→ 502/502 pass, 0 fail （F173 ledger / dedup / ghost-bubble 全套）
```

### Biome / Build

```
pnpm check  → F176 scope: 0 errors ✅
              （剩 2 基线 errors 在 shell-tools.ts / antigravity-test，main 上同样存在，非 F176 引入）
pnpm --filter @cat-cafe/api build  → F176 scope: 0 new TS errors ✅
              （基线 errors 是 worktree 缺 dev @types: better-sqlite3, web-push, http-proxy, nodemailer, ws）
```

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → 无
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → 无
```

### 浏览器实测

⚠️ **未做浏览器实测**。理由：
- F176 是渲染分流（复用 `CollapsibleMarkdown` / `CliOutputBlock` 已有组件），无新 CSS / 新视觉设计
- 单测覆盖 7 个 case 含 `messageRole='final'` 主气泡 + `messageRole='cli_stdout'` 折叠 + 旧消息向后兼容
- AC-E1 端到端验收（thread_mnux2eewbo4otg17 现象消失）需要 alpha 通道（已合入 main 后 `pnpm alpha:start`）—— spec 明确标 🟡 待 alpha 验收

如 reviewer 坚持要 worktree 浏览器实测，可起 review sandbox + isolated 端口跑（worktree NODE_ENV 需 override 为 development）。

## 相关文档

- Feature spec: `docs/features/F176-native-cli-assistant-speech-rendering.md`
- 关联 Feature: F097 (CLI Output Collapsible UX 设计前提) / F173 (前端 message pipeline 共存策略) / F167 (A2A chain quality)
- BACKLOG: `docs/BACKLOG.md` line 67

[宪宪/Opus-47🐾]
