---
capsule_id: "F176-2026-04-25"
context: "F176 native CLI assistant-speech vs cli-stdout 渲染语义分离 — Phase 1+2+3 整套实现 + R3 review cycle"
feature_ids: [F176]
doc_kind: capsule
created: 2026-04-25
---

## What Worked

- **双猫并行诊断 5/5 收敛**：thread_mnux2eewbo4otg17 现象出来后，砚砚（GPT-5.5）和我（Opus-47）独立诊断收敛到同一根因（route-serial origin tagging + ChatMessage 渲染分支 + CliOutputBlock 默认折叠）。并行模式不互 @ 但能独立到达同一答案，说明根因路径明确。
- **后端权威 messageRole + 前端按字段分流**：选 B 不选 A（一刀切默认 expanded）也不选 C（前端启发式），是因为启发式是 F173 历史 bug 来源（参见 review request §Tradeoff）。后端打权威标签让前端不需要猜。
- **F173 共存策略明确写在 spec**：守护证物表格列出 4 类 F173 历史风险（dup-bubble / ghost-bubble / streaming-partial / split-brain）+ 每条都对应"不动 invocation/bubble identity → 不会复发"。这让 reviewer 能定向核证而不是泛泛担心。
- **rebase 后 patch-id 比对做 continuity**：砚砚用 `git range-diff` 比对 rebase 前后 6 commits 的 patch-id，18 个 F176 文件 stable patch-id 完全一致，证明纯 rebase 无代码差异。规避了 R4 重审。

## What Failed

- **R0 自检漏了链路下游**：我只追了 route-serial yield 入口标 messageRole，没追完整持久化/socket 链路。R1 砚砚命中 6 处链路断点（Redis hset/deserialize、GET API mapper、useChatHistory mapper、useAgentMessages AgentMsg、useSocket-background type）。教训：自检不能只看入口，要追整条链路（端到端）。
- **R1 fix 又漏 existing-bubble path**：R1 修了"text 直接新建 bubble"，但 native CLI 主流程是 `tool_use → text` → existing-bubble patch 路径。R2 砚砚再次命中——这正是铲屎官截图的"CLI Output · 20 tools"场景。教训：修复时要枚举所有进入 store 的入口（new-bubble + existing-bubble + merge），不能只覆盖 happy path。
- **NODE_ENV=production 全局 export 干扰测试 + build**：worktree 上 vitest `act() not supported` + pnpm install 跳过 devDeps + next build 用 production runtime 触发 useContext null。每次都要 NODE_ENV=test 或 unset 才能跑。教训：worktree skill 模板的 `.env.local` 应该考虑 unset 全局 NODE_ENV，或在 skill doc 里警告。
- **AC-3.2/3.3（F173 dedup/streaming fixture 加 case）没单独加测试**，借用 502/502 hook 全绿证明零回归。砚砚 R3 接受，但严格说没满足 spec AC。Trade-off 可接受但可改进。

## Trigger Missed

- **R0 自检时没主动跑链路追踪 grep**：本来如果在 R0 阶段做 `grep -r "messageRole" packages/api packages/web` 端到端搜索，能在自检阶段发现链路断点。砚砚 R1 是用这个方法找到的——我应该自检时就用同样工具。
- **没主动加载 debugging skill 走"沿数据流追踪"流程**：F176 跨前后端、跨持久化/streaming/hydration 三种链路，本质是 debugging（追字段 plumbing 在哪断），但我直接走 tdd 没走 debugging。应该 R0 阶段先跑一遍数据流追踪。

## Doc Links

- F176 spec: `docs/features/F176-native-cli-assistant-speech-rendering.md`
- F097 (CLI Output Collapsible UX, 设计前提): `docs/features/F097-cli-output-collapsible-ux.md`
- F173 (前端 message pipeline 共存策略参考): `docs/features/F173-frontend-message-pipeline-unification.md`
- Review request: `docs/mailbox/2026-04-25-f176-review-request.md`
- 触发 thread: `thread_mnux2eewbo4otg17`

## Rule Update Target

- **`cat-cafe-skills/quality-gate/SKILL.md`** Step 3 VERIFY 加一条：**"对于跨层 plumbing feature（type 字段 + serialize + API + frontend hook），自检必须做端到端 grep 追踪：`grep -r "{字段名}" packages/api/src packages/web/src` 看入口/中间/出口都接到了"**。这能避免 R1 类链路断点重演。
- **`cat-cafe-skills/worktree/SKILL.md`** 加警告：**"如果环境有全局 `NODE_ENV=production`，会导致 vitest `act() not supported` + pnpm install 跳过 devDeps + next build useContext null。Worktree `.env.local` 加 `NODE_ENV=development` 或在测试/build 命令前显式 unset。"**
- **`cat-cafe-skills/refs/shared-rules.md`** 元思考触发器加一条："改 yield/persist 入口时，下意识问'这个字段从入口到 frontend store/render 一共要穿过几层？我都接到了吗？'" — 用于防 R0 阶段链路漏接。
