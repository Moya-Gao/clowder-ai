---
feature_ids: [F229]
topics: [animation, ux, concierge, pet-state]
doc_kind: discussion
created: 2026-06-21
---

# F229 BUG-UX-6: 砚砚动画不可见 — 诊断 + 产品方向讨论

> **Status**: open-for-discussion | **Triggered by**: CVO 2026-06-21 "idle 我只看过这个诶"
> **参与**: @opus48 + @codex 讨论，CVO 拍方向

## 诊断（宪宪 2026-06-21）

**结论**：`conciergeState → petState` 投影链路没断，代码都在正确跑。问题是**设计层的**——9 态 atlas 画了但用户看不到。

### 问题 1：3/9 态是死路

V1 projection 只映射 6 个 `CodexPetState`，3 个完全没有 `ConciergeBallState` 映射到它们：

| CodexPetState | 映射来源 | 状态 |
|---------------|----------|------|
| idle | idle, sleeping | ✅ |
| waiting | listening, needs-confirmation | ✅ |
| running | thinking | ✅ |
| review | found | ✅ |
| running-right | handoff | ✅ |
| failed | error | ✅ |
| **running-left** | **无** | ❌ 死路 |
| **waving** | **无** | ❌ 死路 |
| **jumping** | **无** | ❌ 死路 |

### 问题 2：可达态用户体感不可见

| 状态 | 触发条件 | 为什么用户看不到 |
|------|----------|-----------------|
| `running`（跑） | 发消息→等回复 | 持续几秒且注意力在面板聊天内容上 |
| `waiting`（等待） | 输入框聚焦 / 有待确认 | 用户在打字，不看球 |
| `review`（审阅） | 有未读结果 | `unseenResultCount` 面板打开时**立刻清零**（conciergeStore.ts:269），面板开着时永远 = 0 |
| `running-right` | relay 传话 | 很少触发且短暂 |
| `failed` | 出错 | 正常使用很少出错 |

## 需要讨论的方向

### 方向 A：接上 3 个死路态

给 `waving`、`jumping`、`running-left` 找到合适的触发场景：

| CodexPetState | 候选触发 | 说明 |
|---------------|----------|------|
| `waving` | 首次打开面板 / 新消息到达 / 猫猫打招呼 | "嗨！" 的感觉 |
| `jumping` | 任务完成 / 传话成功 | 庆祝 / 成就感 |
| `running-left` | 反方向运动 / 回到 idle 的过渡 | 与 `running-right` 对称 |

### 方向 B：让面板内也有砚砚存在感

现在只有面板外的球显示动画状态，但用户打开面板后注意力全在面板里。可以考虑：
- 面板 header 旁显示当前砚砚小头像 + 状态动画
- 回复过程中面板内有砚砚"正在思考"的内联动画
- 面板内顶部或底部有一个迷你砚砚做状态反馈

### 方向 C：延长可见态停留时间

- `review` 不在面板打开时立刻清零，改为"用户看到结果后手动 dismiss"或"停留 N 秒后清"
- `running` 在猫回复后保持几秒再切 idle（"砚砚跑完了停下来"的感觉）
- 添加过渡动画：状态切换不是瞬间跳变，而是有 0.5-1s 的过渡

### 方向 D：主动 idle 变化（微动效）

即使在 idle 状态下，也可以有随机微动效：
- 偶尔 waving（打招呼）
- 偶尔 jumping（蹦一下）
- 呼吸节奏变化

这不需要改 projection 逻辑，只需要在渲染层做时间驱动的 idle 变体。

## 约束

- KD-18：PetSkin 是 conciergeState 的纯投影，不是平行状态机
- 安静优先：不能变成 Clippy
- 方向 D（idle 微动效）可能绕过 projection 设计——需要讨论是否违反 KD-18
