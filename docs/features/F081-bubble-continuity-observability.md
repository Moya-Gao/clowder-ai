---
feature_ids: [F081]
related_features: [F045, F048, F055, F069]
topics: [bubble, rendering, continuity, observability, socket, hydration, draft, timeout]
doc_kind: spec
created: 2026-03-07
status: spec
---

# F081 — Bubble Continuity & Rendering Observability（猫猫气泡连续性与可观测性）

## Why

铲屎官连续报了同一类痛点，但它们表面上长得像不同 bug：

1. 布偶猫明明在 Claude Code session 里已经回答了，主区却没有 assistant 气泡
2. 先看到了布偶猫回答，切到别的 thread 再切回来，刚才已经看到的气泡又没了
3. 右侧 `task_progress / 猫猫祟祟` 还活着，主区 `💭 心里话` 却消失
4. 有时最后又显示 `CLI 响应超时 (1800s)`，把“UI 丢气泡”和“后端真的静默超时”混成一团
5. 更离奇的是，布偶猫在较早时刻就应已产出回复，但主区直到铲屎官后续再发一句提示词后，上一条 assistant 气泡才“闪现回来”，呈现出明显的错位回放 / 迟到补写
6. 同一条 assistant 气泡并非“补回来就稳定了”，而是切到别的 thread 再切回来后还能再次消失，呈现出反复出现 / 反复消失的非单调可见性
7. 当铲屎官绕过 Cat Café，直接在 Claude CLI 里 `resume/continue` 同一 session 时，session 会自行消费 `[对话历史增量 - 未发送过 N 条]` 并在外部推进状态；随后主区气泡可能出现迟到、错位或与前端当前可见状态不一致
8. 现在已经证明 `Codex app` 的 thread id 也可以手动 bind 进猫猫咖啡，但 bind 成功后，先前已经存在于 app 里的聊天历史并没有回灌到主区；换句话说，我们能把猫绑进来，却没把它已经说过的话带进来

这说明我们现在缺的不是单点补丁，而是**猫猫气泡生命周期的真相源**：

- 气泡是从哪条链路来的：live socket / background route / draft merge / persisted history
- 哪个时刻被创建、续写、替换、清空
- thread switch / F5 / reconnect / timeout 之后，为什么最终会看到或看不到它

铲屎官原话可以概括成一句：

> 渲染不出来也好，跑着突然没了也罢，都要能抓住布偶猫的猫尾巴。

## What

把“猫猫气泡为什么出现 / 消失 / 没恢复”升级为一个完整 Feature，包含两条主线：

### 1. Bubble Continuity

保证一条已经显示给铲屎官的 assistant 气泡，不会因为 thread switch、history replace、draft merge、socket reconnect、F5 恢复而被无声覆盖或清空。

更严格地说，**历史气泡的可见性必须是单调的**：一条已被显示的 assistant 气泡，除非被明确撤回/删除，否则不能因为后续 rehydrate、切 thread、再进 thread 或发送下一句消息而来回抖动。

### 2. Rendering Observability

建立一套面向铲屎官和开发者都能用的可观测性，能回答：

- 这只猫这次 invocation 到底有没有产出文本
- 文本有没有到前端
- 文本进了哪个 thread state
- 是否被 `replace` / `clearMessages` / hydration 覆盖掉
- 这次是 UI 丢流，还是 provider 仍在跑，还是后端进程真的静默超时

## Scope

### 前端

- 为 assistant bubble 增加 `provenance` / `sourcePath` / `invocationId` / `catId` 级别的生命周期标记
- 为 thread switch / history replace / draft merge / clearMessages 建立可追踪事件
- 修复“已显示气泡被后续 hydration 覆盖”的连续性问题
- 为 active invocation 增加更稳妥的非破坏性恢复策略
- 提供 owner 可用的 debug mode / dump 能力

### 后端

- 为 draft flush / draft merge / timeout diagnosis 增加证据字段
- 为 invocation 记录补齐“最后一次 stdout / stderr / parsed text / UI visible event”时间点
- 明确区分：
  - `provider/session 还在跑`
  - `后端子进程仍有活动`
  - `前端没有可见气泡`
  - `后端真的静默超时`

### 不在本次范围

- 不重做 Claude / Codex provider 协议本身
- 不把所有 CLI stderr 都直接塞进 `💭 心里话`
- 不做全新的复杂调试中心；先做最小但足够定位现场的一版

## Acceptance Criteria

- [ ] AC1: 如果 assistant 气泡已经显示给铲屎官，切到别的 thread 再切回时，该气泡不会无声消失
- [ ] AC2: active invocation 恢复时，history replace / draft merge 不会覆盖掉更新的本地 live bubble
- [ ] AC3: 当 provider/session 内已产出文本，但主区没有气泡时，debug 证据能明确指出断在 provider / socket / store / hydration 的哪一层
- [ ] AC4: timeout 诊断能明确区分“UI 丢气泡”和“后端 1800s 静默超时”
- [ ] AC5: 每条 assistant bubble 可追踪其来源：`live_socket` / `background_socket` / `draft_rehydrate` / `persisted_history`
- [ ] AC6: debug mode 支持导出 invocation 时间线，至少包含：socket 连接状态、agent_message 类型、history replace、clearMessages、draft merge、bubble add/update/remove
- [ ] AC7: 存在自动化回归测试覆盖：
  - 先看到 assistant 气泡，切 thread 再切回，气泡仍在
  - tool-first / text-later invocation 不丢 bubble
  - socket reconnect 后 active invocation 可恢复
  - history replace 不覆盖更新的 live bubble
- [ ] AC8: 右侧 task_progress 和主区 assistant bubble 可用同一 `invocationId + catId` 做关联
- [ ] AC9: 已产出的 assistant 文本不能直到后续用户再发一句消息后才迟到出现；若发生补回，debug 证据必须能解释触发源（history refresh / draft merge / socket replay / local reconcile）
- [ ] AC10: 同一条历史 assistant 气泡在一次会话中不能出现“补回后又因切 thread 再次消失”的抖动；若发生，debug 时间线必须显示是哪次 replace / rehydrate / reconcile 改写了它
- [ ] AC11: debug 证据必须能区分“Cat Café 驱动的 invocation”与“外部 CLI 直接 resume/continue 导致的 session 越界推进”，避免把 out-of-band session 变化误判为主区渲染链路唯一根因

## 需求点 Checklist

| ID | 需求点 | AC 编号 | 验证方式 | 状态 |
|----|--------|---------|----------|------|
| R1 | 已显示气泡切线程不消失 | AC1 | test + 手工复现 | [ ] |
| R2 | rehydrate 不覆盖 live bubble | AC2 | test | [ ] |
| R3 | 链路断点可定位 | AC3 | debug dump + 复现 | [ ] |
| R4 | timeout 与 UI 丢流可区分 | AC4 | test + 现场证据 | [ ] |
| R5 | bubble provenance 可追踪 | AC5 | test | [ ] |
| R6 | debug mode 可导出完整时间线 | AC6 | manual + test | [ ] |
| R7 | 关键 race 有回归测试 | AC7 | test | [ ] |
| R8 | plan/bubble 可关联到同一 invocation | AC8 | test | [ ] |
| R9 | 禁止“后续提示词触发历史气泡闪现” | AC9 | test + 现场证据 | [ ] |
| R10 | 历史气泡可见性单调，不允许反复显隐 | AC10 | test + 现场证据 | [ ] |
| R11 | 区分 Cat Café 内部驱动与外部 CLI 越界推进 | AC11 | debug dump + 现场证据 | [ ] |

## Key Decisions

- **这是 Feature，不是散装 UX debt**
  - 原因：铲屎官能直接感知，且会反复影响对猫猫是否“真的在工作”的判断
- **可观测性是本 Feature 的一部分，不是附属品**
  - 原因：没有证据链，气泡连续性问题会反复“猜修复”
- **先做最小真 debug mode，不做庞大平台**
  - 目标：能抓现场、能导出、能复盘，不追求一步到位
- **不把 stderr 直接等同于 `💭 心里话`**
  - `心里话` 仍然是结构化 stream text；运行日志/诊断事件单独建语义
- **把“迟到闪现”归入同一条连续性故障线**
  - 原因：这说明问题不只是“气泡丢了”，还可能是“旧气泡被后续动作错误地触发回流”
- **把“反复显隐”单独视为高价值证据**
  - 原因：这说明同一条历史 bubble 在不同恢复路径之间被重复改写，问题更像 reconcile / replace 非幂等，而不只是单次漏流
- **外部 CLI 继续同一 session 是重要触发场景，但不能替代主区连续性修复**
  - 原因：out-of-band session mutation 能解释部分“迟到/错位”，但不能合理化“已经显示过的气泡又被主区抹掉”

## Dependencies

- **Evolved from**: F045（NDJSON 可观测性，只解决了事件解析层，不足以解释气泡生命周期）
- **Related**: F055（右侧 task_progress 存活但主区气泡消失，证明 side-channel 与主消息流分裂）
- **Related**: F048（恢复/自愈语义）
- **Related**: F069（thread 切换/恢复时的真相源设计经验）

## Risk

| 风险 | 缓解 |
|------|------|
| debug 事件过多影响性能 | ring buffer + TTL + owner opt-in |
| 现场证据包含 thread 标识 | dump 默认 mask threadId，raw 模式仅本地显式开启 |
| 修复 continuity 时误伤现有 hydration 逻辑 | 先加证据链和回归测试，再改 merge 策略 |
| 把多类故障混成一个修复 | debug 时间线按 layer 拆：provider / socket / store / hydration / timeout |

## Open Questions

1. debug mode 是只给 owner 的隐式控制台开关，还是给一个显式 UI 入口？
2. bubble provenance 是只在 debug dump 里可见，还是在气泡操作菜单里暴露“查看来路”？
3. active invocation 切回 thread 时，是否应该先保留本地 live bubbles，再做增量补齐，而不是先 `clearMessages()`？
4. 对“外部 CLI 直接 resume/continue 同一 session”我们是要支持诊断、还是明确标记为 unsupported workflow？

## Review Gate

- 前端：
  - thread switch / hydration / reconnect / replace 路径测试
  - 至少 1 组“先看到气泡，再切回消失”的回归测试
- 后端：
  - draft flush / merge / timeout evidence 测试
  - invocation 级诊断字段测试
- 交付：
  - 一次现场复现的 debug dump
  - 一张“bubble lifecycle”链路图或时间线

## Links

- 相关 Feature: [F045](./F045-ndjson-observability.md)
- 相关 Feature: [F055](./F055-plan-board.md)
- 相关 Feature: [F048](./F048-restart-recovery.md)
- 相关 Feature: [F069](./F069-thread-read-state.md)
- 现场证据：2026-03-07 铲屎官 thread 复盘（“先看到气泡，切走再切回气泡消失” + “Claude session 已有回答，前端主区无气泡” + “08:19 的布偶猫回复直到 08:33 再发下一句提示词后才闪现回主区” + “闪现回来的同一条历史气泡在再次切换 thread 后又消失” + “直接在 Claude CLI 继续同一 session 时，可见 session 正在消费 `[对话历史增量 - 未发送过 2 条]` 并执行 Bash，说明 session 状态会在 Cat Café 外部前进”）

## Detective Notes

### 2026-03-07 砚砚侦探现场

- 两条看似不同的布偶猫 session：`7ef0ef90-ac7c-4672-85f1-e1dd8d9ee444` 与 `bfe74a71-e28f-456d-83e4-ae8c5c4bce14`
- 一条由 Cat Café runtime 驱动，一条由外部 Claude Code `resume` 直接驱动
- 进程树向下追到最深处后，两条最终都落在同一个具体 test worker：`test/antigravity-smoke.test.js`
- 这个 smoke test 不在单独的 opt-in 命令里，而是直接包含在 `packages/api` 默认 `pnpm test` 的 `node --test test/*.test.js` 套件中；只要机器上 `localhost:9000` 有 Antigravity 在监听，它就会自动参战
- `antigravity-smoke.test.js` 自己声明的单测超时是 `90_000`，内部 `pollResponse()` 也只等 `60_000`，见 `packages/api/test/antigravity-smoke.test.js`
- 但现场里两条 worker 分别静默挂了 8 分钟以上和 20 分钟以上，明显超过预期
- `sample` 结果显示两个 worker 都不是在忙 CPU，而是在事件循环里 `kevent` 空等
- `lsof` 结果显示两个最深 worker 都保持着到 `127.0.0.1:9000` 的 `ESTABLISHED` TCP 连接
- `curl http://localhost:9000/json/version` 返回正常，说明 Antigravity 端口活着，但 smoke test 路径没有按预期收敛退出
- 初步推断：这不是“前端把测试刷屏吃掉了”，而是 `antigravity-smoke` 自身存在沉默挂住/句柄未清理问题，随后被布偶猫的 CLI 静默超时和主区渲染缺失放大成更像“猫没在回话”的体验
- 更强嫌疑点：`CDP connect → send → receive round trip` 这条测试把 `await client.disconnect()` 放在断言之后；如果 `pollResponse()` 返回 `null` 或中途抛错，WebSocket 可能不会被关闭，测试 worker 会留下对 `:9000` 的活连接
- 因此，后续修复需要同时覆盖两条线：一条是 `F081` 的气泡连续性/可观测性，另一条是 `antigravity-smoke` 的资源清理与硬 watchdog
- `Codex app` 这条线也新增了一条高价值证据：
  - 当前会话的 `CODEX_THREAD_ID=019cc8e5-d8bb-7411-90f8-d5e276399145` 被确认可以手动 bind 进猫猫咖啡
  - 但 bind 成功后，猫猫咖啡主区仍然看不到这条 `Codex app` 会话里既有的聊天历史
  - 这说明 continuity/hydration 问题并不只发生在 live socket 途中，也发生在“已知 thread id / session id 的历史回灌”这条恢复路径上

### 2026-03-07 F081 主线新取证

- 第一只前端真凶已经坐实：`packages/web/src/hooks/useChatHistory.ts` 在 active invocation 的 `replace` 恢复路径里，会先 `clearMessages()` 再灌 API 历史；如果切回 thread 后 live assistant bubble 已经到达，但 API 还没追上，这个 `replace` 会把刚看到的气泡直接抹掉
- 第二只真凶也已经露头：即使不再粗暴清空，replace 仍然会把“同一轮 invocation 的本地 stream placeholder”和“后端追上的 draft/history”当成两个不同气泡，因为前端之前只按 `message.id` 认人：
  - 本地 live bubble 常是 `msg-*` / `bg-*`
  - draft 恢复是 `draft-${invocationId}`
  - 正式持久化消息则带 `extra.stream.invocationId`
- 过去的问题是：后端明明已经持久化了 `extra.stream.invocationId`，但 `/api/messages` → 前端 `ChatMessage` 的映射把这段身份信息丢掉了；同时本地新建的 stream bubble 也没有挂上这层身份
- 当前 worktree 里的第一段治疗已经落地：
  - `replace hydration` 不再盲目清空，而是做 non-destructive merge
  - merge 不只看 `message.id`，还会按 `catId + stream.invocationId` 做同轮 invocation 对位
  - 当 history/draft 比本地 placeholder 更新时，优先后端；当本地 live bubble 更丰富时，优先本地，避免 stale draft 造成“双胞胎”或迟到闪现
  - active / background 两条 stream 创建路径都开始补 `extra.stream.invocationId`，避免 bubble 一旦结束 streaming 就再次失去身份
  - debug ring buffer 新增 `history_replace` 事件，可直接看到 `preservedLocal / reconciledToHistory / replacedHistory` 这些 replace 决策痕迹
- 回归测试已补上：
  - “切回 thread 后 live bubble 不会被 replace 抹掉”
  - “同 invocation 的 stale draft 不会和本地 richer bubble 变双胞胎”
  - “同 invocation 的 richer server bubble 会替换本地 placeholder”
  - “invocation_created 晚到时，会把 active / background placeholder bubble 绑定到正确的 `stream.invocationId`”

## Timeline

| Date | Event |
|------|-------|
| 2026-03-07 | 铲屎官连续报告布偶猫气泡“未显示 / 切回消失 / timeout 混淆” |
| 2026-03-07 | 收敛决定：升级为完整 Feature，连续性修复 + 可观测性一起做 |
| 2026-03-07 | 追加现场证据：较早时刻应已产出的 assistant 气泡，没有实时出现；直到铲屎官后续再发一句提示词后，旧气泡才迟到闪现回主区 |
| 2026-03-07 | 再次追加现场证据：闪现回来的同一条历史 assistant 气泡，在后续切 thread 再切回后又消失，证明问题具有“非单调可见性 / 反复显隐”特征 |
| 2026-03-07 | 新增触发场景：铲屎官直接在 Claude CLI 继续同一 session，可见该 session 正在外部消费“未发送过”的历史增量并推进工具执行，说明存在 out-of-band session mutation |
| 2026-03-07 | 新增 `Codex app bind` 证据：`Codex app` thread id 已可手动绑定进猫猫咖啡，但 app 内既有聊天历史没有回灌到主区，暴露新的历史 hydration 缺口 |
| 2026-03-07 | 砚砚进程取证：两条布偶猫 session 虽然来源不同，但最终都卡在 `packages/api/test/antigravity-smoke.test.js`；worker 处于事件循环空等，同时保持到 `127.0.0.1:9000` 的活连接 |
| 2026-03-07 | 砚砚 DOM 取证：Antigravity 实际已经返回 `pong`，真正失效的是 `pollResponse()` 的完成判定和 DOM 读取路径 |
| 2026-03-07 | 修复 `antigravity-smoke`：默认改为显式 opt-in，round-trip harness 强制 cleanup，`Input.enable` 缺失改为非致命协议漂移，`pollResponse()` 对齐真实 DOM；默认 `pnpm test` 立即 skip，显式 smoke 2 case 转绿并回到 10 秒级 |
| 2026-03-07 | F081 主线定位 `useChatHistory` 的 active-invocation `replace` 为第一只前端真凶：它会先 `clearMessages()`，导致切回 thread 后已经到达的 live bubble 被 API 历史覆盖抹掉 |
| 2026-03-07 | F081 主线继续定位到第二层身份断层：本地 `msg-* / bg-*` placeholder、`draft-${invocationId}` 和正式 history message 之前没有统一的 stream identity，导致 replace 只能按 message.id 判断，进而出现双胞胎、迟到闪现和非单调可见性 |
| 2026-03-07 | F081 主线第一段修复落地：replace 改为 non-destructive + invocation-aware reconcile，前端恢复 `extra.stream.invocationId` 身份链，补齐 active/background placeholder 绑定，并新增 `history_replace` debug 事件和回归测试 |
