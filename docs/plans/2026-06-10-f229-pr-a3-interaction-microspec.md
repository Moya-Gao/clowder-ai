# F229 PR-A3 Micro-Spec：对话集成 + 三件套交互（去/取/传话）

**Feature:** F229 | **父 plan:** `2026-06-10-f229-phase-a-concierge.md`（PR-A3 段被本文件取代）| **前置:** PR-A1+A2 已合入且 alpha smoke S1-S8 全绿（`assets/F229/smoke-2026-06-10/`）
**Stateful Object Gate 声明：** 本 PR 含 3 个有生命周期的状态对象（RelayReceipt / PendingConfirmation / EscalationContext），逐个给转移表 + INV + 对抗场景。HandleMap 不在本 PR（见 §0 减法）。
**实测挂点：** 面板 placeholder `ConciergePanel.tsx:112`（注释已标 "PR-A3 fills"）、懒创建 `:32`、CardBlock action handler `rich/CardBlock.tsx:90`（unknown-action warn `:102` 即注册点）、`domains/concierge/` 5 文件、RoutingInterceptor 已接 route-serial/parallel。

## 0. 两个减法（先于加法，元审美）

1. **回执零监听设施**：relay 不建"目标 thread 订阅/marker 监听"子系统。relay = **A2A cross_post 接力**——投递内容带 routing credentials 模板（"完成后 cross_post 回 `thread_<concierge>` + targetCats」），目标猫回报 = concierge thread 收到普通消息 = 现有消息流直接渲染 + found badge。幂等靠 cross_post `clientMessageId`。Trade-off 接受：依赖 A2A 回报纪律（家里成熟），不回报时用户有"跳过去跟进"兜底。
2. **HandleMap 不建**：值班猫（大猫）直接用 `create_rich_block` 发结构化卡，**actions payload 带真实 ID**（threadId/messageId），payload 即真值，前端零解析模型文本。HandleMap 是 Phase D clerk（小模型 MD→validator）的设施，A3 不预建（YAGNI）。

## 1. 状态对象规格

### 1a. RelayReceipt（lifecycle owner = `POST /api/concierge/relay` 端点，唯一写入口）

```
状态：draft(确认卡渲染) → confirmed(用户点传话) → dispatched(cross_post 成功)
                              ↘ dispatch_failed(可手动重试 → confirmed)
回执呈现 = 目标猫 cross_post 回 concierge thread 的普通消息（不是 receipt 状态）
```

| INV | 内容 | 测试 |
|-----|------|------|
| R1 | **先落记录再投递**：relay 记录写 Redis（TTL=0，KD-13）成功后才 cross_post——crash window 内用户重开面板见"投递中/失败可重试"，绝不丢 | mock 顺序断言：store.write 先于 crossPost |
| R2 | dispatch_failed 手动重试，**不自动重试**（A2 INV-9 同款） | fetch mock 计数 |
| R3 | 投递幂等：同一 receipt 重试用同一 `clientMessageId` | 重试两次 → 目标 thread 一条消息 |
| R4 | 旁路禁令：除 relay 端点外无代码写 relay 记录（generic API 不感知） | grep 架构测试：写 key 仅一处 |

对抗场景：confirmed→dispatched 之间 crash（R1 覆盖）/ 连点传话（§1b C2 覆盖）/ 目标猫永不回报（无 TTL 监听可泄漏——本设计零监听，天然免疫；badge 走 found 态查看即清，无 stale badge）。

### 1b. PendingConfirmation（确认卡——teleport/relay/go 执行前的门）

```
状态：rendered → confirmed(执行一次) | cancelled(变灰) ；刷新后从持久层重建可点性
```

| INV | 内容 | 测试 |
|-----|------|------|
| C1 | 动作幂等：点击即 disabled，double-click 不双发 | 组件测试连点 → handler 1 次 |
| C2 | **payload 自包含**：卡 actions payload 含全部执行参数（threadId/messageId/targetCats/originalText），执行 deterministic，不回查模型（KD-12 精神） | 后端校验测试 + 组件断言 |
| C3 | 确认/取消状态持久化（store/Redis，KD-13），刷新后 cancelled 卡仍灰、confirmed 卡显示结果态 | 刷新重渲染测试 |
| C4 | 未知 action 走 CardBlock:102 现有 warn 路径，不静默不崩 | 注册 4 个 action 后回归现有 warn 测试 |

### 1c. EscalationContext（原文带走，KD-3/KD-13）

- 转接卡生成时，payload 内嵌**用户原话全文快照 + 源 messageId**（不是模型复述）。
- INV-E1：relay 端点硬校验 `payload.originalText` 非空且 `sourceMessageId` 存在，缺失 → 400 拒投。
- INV-E2：投递内容结构 = 原文段 + anchor 列表 + routing credentials 模板（机器拼接，模型只产 anchor 选择）。

## 2. 交付物

**A3 拆两个 PR（review 面控制，PR-A1 二十轮教训）：**

### PR-A3a 气泡化对话集成（先行；含视觉返工 V1-V9，CVO 2026-06-10"别拆太稀碎"+ 避免先填旧 drawer 再搬气泡的二次浪费）

**设计真相源：`docs/research/2026-06-10-f229-visual-design-proposal.md`（烁烁方案，CVO 六题全过）——V1-V9 清单、八态贴纸映射、三层展开、OKLCH token 表、CSS 动画规格、布局标注全在其中，本段只列 delta：**

- **对话集成**：`ConciergePanel.tsx:112` placeholder → concierge thread 消息流（复用 ChatMessage）+ 输入 POST 现有 messages API → RoutingInterceptor 唤值班猫 → 流式渲染——**直接做进漫画气泡形态**（Layer 3），不经过旧 drawer
- **三层展开状态机**：A2 的 `panelOpen: boolean` 升级为 `surfaceState: 'collapsed' | 'toolbar' | 'bubble'`——**纯投影原则不变**（ballState 投影函数的 `panelOpen` 输入相应改为 `surfaceState !== 'collapsed'`，listening 态需 bubble + inputFocused）；转移：点猫 collapsed→toolbar，点"聊聊"或工具钮 toolbar→bubble，Esc bubble→toolbar→collapsed（两级返回），teleport/go 后 →collapsed（A2 INV-7 继承）
- **素材**：`assets/stickers/opus/` 单张已全部切好（38 文件含命名版 + manifest，无需抠图）——确认透明底 + resize 三档（128/64/48）+ 复制 `assets/concierge/sprites/ragdoll/` 按八态命名，脚本完成
- **工具栏四钮动作**：找找看/新功能 = 展开气泡 + 预填 prompt 模板；传话 = 展开气泡 + 预填转接引导；聊聊 = 直接展开空气泡
- 测试：A2 全量回归（投影表驱动改 surfaceState 后重跑）+ 消息往返 / 流式 / route survival 下消息流不断 / found badge 清除 / 三层转移全路径 / token 断言（零 Tailwind 原生色——grep 架构测试）/ V8 reduced-motion / V9 dark mode

### A3a 补账：ConversationSendCycle 状态机（2026-06-11 R3-R7 同型 5 轮 finding 复盘——本该立项时就有，spec 作者欠的）

> 我把"对话集成"写成了"接现有 API + 流式渲染"一行话，没把 **send→poll→arrive 生命周期**当 stateful 对象普查进 Gate——云端用 5 轮 finding（13:50/14:13/14:37/16:05/16:25）逐边补了这个状态机。现在反推钉死，每条 INV 对应一轮已付的学费：

```
idle → sending(POST in flight，输入闸门关) → awaiting-reply(invocation in-progress，持续 polling)
     → reply-arrived(post-send marker 判定；streaming draft 不算到达) → idle
失败边：sending --POST fail--> send-error(可手动重试，闸门开)
```

| INV | 内容 | 学费来源 |
|-----|------|---------|
| S1 | 发送即置 concierge invocation 态（球进 thinking） | R3 13:50 |
| S2 | polling 持续到 reply-arrived，不得提前停 | R4 14:13 |
| S3 | 回复判定用 **post-send marker**，禁止消息计数比较（stale count 假阳性） | R5 14:37 |
| S4 | streaming draft ≠ reply-arrived，in-progress 不提前退出 | R6 16:05 (P1) |
| S5 | sending/awaiting 期间键盘 + 按钮双闸门，in-flight 不重复发 | R7 16:25 |
| S6 | 发送成功 → 输入框立即清空（controlled value 置空可测；注意 IME 组合键时序） | CVO runtime 首验 2026-06-12 Q2 |

A3a 收尾以本表为兜底：上述五边的测试若有缺补齐；A3b/Phase C 任何触碰此循环的改动先对本表。

### PR-A3b 交互卡 + relay（依赖 A3a）
- 前端：CardBlock 注册 `concierge_teleport`（确认后跳 + 收面板，A2 INV-7）/ `concierge_peek`（卡内 inline 展开 anchor 前后窗口，`get_thread_context` before/after；边界：thread 首尾）/ `concierge_relay` / `concierge_go`；ConciergePeekCard 组件
- 后端：`POST /api/concierge/relay`（§1a/1c 全部 INV）+ confirmation 状态 store（`domains/concierge/` 内新文件，三件套模式同 ConfigStore）
- `ConciergePromptSection.ts` 增量：卡片纪律（结构化 payload 带真实 ID + 原文快照；anchor-first 答案附 teleport/peek 双动作卡）——**改完即跑 SystemPromptBuilder 守护测试**
- **球可拖拽 + 位置持久化**（CVO 2026-06-11"狗皮膏药"反馈：球钉死右下角不能挪）——新状态对象 **BallPosition** 按 census 纪律登记：
  - 状态：`default → dragging → settled(自动吸附回视口内) → persisted`
  - INV-P1 拖拽与点击不冲突（drag threshold ~5px，点击仍是展开）；INV-P2 位置出视口自动吸附回最近合法位；INV-P3 持久化走 config PUT（KD-13 app 归属，per-user），写失败静默回会话内位置不丢交互；INV-P4 muted 唤回后位置保持
  - 技术先例：react-rnd（F195/F226 已用）
- 测试：§1a-1c 全部 INV + peek 边界 + teleport 后收面板 + BallPosition 四 INV

## 3. Not Building（A3 明确不做）

guide 启动卡（A1 岗位 prompt 已含 start_guide，无新前端）/ 设置页（A4）/ 像素猫形象（KD-14 独立项）/ propose_thread 自主调查（Phase B）/ 快速档 clerk + HandleMap（Phase D）/ 任何回执监听设施（§0 减法 1）。

## 4. 执行纪律（给实现猫）

1. 顺序：A3a → A3b，各自独立走 worktree→tdd→quality-gate→review→merge-gate 全链。
2. 改 ConciergePromptSection/SystemPromptBuilder → 守护测试；store 测试 Redis-backed；shared types 改后 build。
3. **同型 finding 第 3 轮 → 停手 @fable5**（receive-review ≥3 轮升级规则，写在这里再提醒一次）。
4. 真相源链：本 spec → F229 doc（KD-9/12/13 + 调研红线）→ A2 micro-spec（投影/清除规则）。冲突时回 thread 问，不自行裁决。
