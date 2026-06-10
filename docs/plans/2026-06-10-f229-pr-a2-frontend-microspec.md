# F229 PR-A2 Frontend Micro-Spec（悬浮球 + 对话面板）

**Feature:** F229 — `docs/features/F229-cat-ball-concierge.md` | **父 plan:** `2026-06-10-f229-phase-a-concierge.md`（PR-A2 段，本文件取代其粗粒度描述）
**为什么有这份文件：** PR-A1 被云端 review 20 轮的根因复盘（砚砚 2026-06-10）——plan 只写了功能描述，没把"有生命周期的状态"规格化成可测不变量，每轮 review 都在补一条状态机的边。**本 spec 先钉不变量，sonnet 再动工。**
**AC 覆盖:** AC-A1（唤起+不离开当前页）、AC-A6（安静默认+hide/mute）；AC-A2/A3/A4 的 UI 容器就绪（交互在 PR-A3）。

---

## 1. 核心设计决策：球态 = 纯投影，不是独立状态

PR-A1 的 R19（threadKind 丢失不 self-heal）是"两份状态失同步"类 bug。前端版的同类陷阱 = 把 ballState 存成独立 state 再手动同步。**坐标变换：ballState 永远是 selector 派生值，无存储、无同步、无失同步。**

```ts
// conciergeStore 内：inputs 是唯一的真实状态，ballState 是纯函数
interface ConciergeInputs {
  enabled: boolean; muted: boolean;            // ← GET/PUT /api/concierge/config
  invocationStatus: 'idle' | 'pending' | 'in_progress' | 'error';
                                               // ← concierge thread 最新 invocation（chat-types.ts:433 status 语义；
                                               //    bubble 对齐用 turnInvocationId，chat-types.ts:261-264）
  pendingConfirmationCount: number;            // 面板内未决确认卡（PR-A3 前恒 0）
  pendingRelayCount: number;                   // relay 已投递未回执（PR-A3 前恒 0）
  unseenResultCount: number;                   // found 未查看数
  panelOpen: boolean; inputFocused: boolean;
}

export function projectBallState(i: ConciergeInputs): ConciergeBallState | 'hidden' {
  if (!i.enabled || i.muted) return 'hidden';                    // INV-3
  if (i.invocationStatus === 'error') return 'error';
  if (i.pendingConfirmationCount > 0) return 'needs-confirmation';
  if (i.invocationStatus === 'pending' || i.invocationStatus === 'in_progress') return 'thinking';
  if (i.pendingRelayCount > 0) return 'handoff';
  if (i.panelOpen && i.inputFocused) return 'listening';
  if (i.unseenResultCount > 0) return 'found';
  return 'idle';                                                 // Phase A 无 sleeping（quiet-hours 数据源不存在，不造）
}
```

**清除规则（stale badge 红线，每条可测）：**
- `unseenResultCount`：panel 打开并滚到底 → 清零
- `error`：下一次成功 invocation 或用户关面板 → 回落
- `pendingRelayCount`：回执到达 → -1 并 `unseenResultCount` +1（handoff → found 转移）

**不变量（测试逐条对应）：**
| # | 不变量 | 测试方式 |
|---|--------|---------|
| INV-1 | 投影全序唯一：任意 inputs 恰好一个输出 | 表驱动 ≥12 组合，含全部相邻优先级冲突对（error+thinking→error 等） |
| INV-2 | ballState 零存储：store 持久字段中不存在 ballState | 代码断言 + review checklist |
| INV-3 | hidden 时零渲染（无球无 badge 无 tooltip），唤回入口仅 ActivityBar | DOM 断言 |
| INV-4 | projectBallState 纯函数无副作用 | 同 inputs 重复调用输出恒等 |

## 2. Surface 生命周期不变量

| # | 不变量 | 测试方式 |
|---|--------|---------|
| INV-5 | 全 app 单实例 host：挂 `AppShell.tsx:69` FloatingPresentationSurfaceHost 旁（root 层，`(chat)` 之外） | F226 先例同款 no-double-mount 测试 |
| INV-6 | route survival：`/` → `/memory` → `/settings` 切换，host 不 unmount、inputs 状态保持 | 路由切换测试（F226 AC-A2 模式） |
| INV-7 | panelOpen 跨路由保持；**但 teleport/go 跳转动作后主动收起面板**（用户意图已转移，球回 idle/found） | 测试：跳转 action → panelOpen=false |
| INV-8 | muted 持久化往返：UI mute → `PUT config` → 刷新 → 仍 hidden → ActivityBar 唤回 → `PUT muted=false` → 球回来 | 集成测试（mock fetch round-trip） |
| INV-9 | 懒接线：idle 时除一次 config GET 外零 API 调用；首次展开才 `GET /api/concierge/thread`（懒创建）；**crash/失败 → 面板内 error 态可重试，不自动重试风暴**（PR-A1 crash-window 教训的前端版） | fetch mock 计数断言 |

## 3. 安静默认的可测断言（AC-A6，逐条进测试）

1. badge 元素无文本节点（纯数字 dot），tooltip 仅 hover/focus 时存在于 DOM
2. `aria-live="polite"`（禁 assertive）；不调用任何 toast/notification API（mock 断言零调用）
3. 首次出现零弹窗零教程：球出现时无任何自动 popup（first-run 也只有 Tier 1 badge）

## 4. 工程边界（砚砚清单逐条回答）

- **z-index**：不新造数字。实现第一步读 `workspace/FloatingPresentationSurfaceHost.tsx` 的层级实现，提取共用 token（若它是字面量，建 token 常量两处共用）；层序：concierge 球 **<** 演示浮窗 **<** Modal/Lightbox。
- **消息渲染复用**：spike ≤30min——评估 `ChatMessage.tsx`（props 接口 :72）对 ChatContainer/chatStore 的耦合度。耦合重 → 面板用简化渲染（markdown + 现有 rich block renderer），**禁止把 ChatContainer 生命周期拖进面板**（dual-carrier 的前端同类）。决策记录进 PR body。
- **消息订阅**：复用现有 socket/store 消息流按 threadId 过滤，不开新通道。
- **reduced-motion**：`prefers-reduced-motion` → 全部动画停，球 = 静态图标 + 状态色点 + badge（测试 mock media query）。
- **面板形态**：compact drawer（非 modal、不盖全屏、Esc 收起、不抢 focus trap——球非模态，a11y 测试断言）。

## 5. PR-A2 范围（Not building 重申）

只交付：球（八态视觉中 Phase A 实际可达的 6 态：hidden/idle/listening/thinking/found/error + handoff/needs-confirmation 的视觉占位）+ 面板（输入框 + 消息流 + page context chip（路由级）+ 快捷入口占位钮）+ ActivityBar 唤回入口 + 设置以外的 muted 切换。
**不做**：结果卡/确认卡动作（A3）、relay（A3）、设置页 section（A4）、sleeping 态、皮肤系统、动画精修（E）。

## 6. Test Matrix（写码顺序 = 此表顺序，每行先红后绿）

| 块 | 用例 | 数量级 |
|----|------|--------|
| 投影 | 表驱动组合 + 清除规则转移（found→0 / handoff→found / error 回落） | ~16 |
| 生命周期 | INV-5/6/7 host 挂载与路由 | ~6 |
| muted | INV-8 往返 + INV-3 零渲染 + ActivityBar 唤回 | ~5 |
| 懒接线 | INV-9 调用计数 + 失败重试不风暴 | ~4 |
| 安静默认 | §3 三条 | ~4 |
| a11y/motion | reduced-motion 降级 + Esc + aria | ~4 |

门禁：`pnpm check` + web 测试全绿 + reviewer Playwright/Chrome 实测（球四视觉态截图 + 路由切换录屏 = AC-A1/A6 证据）。
