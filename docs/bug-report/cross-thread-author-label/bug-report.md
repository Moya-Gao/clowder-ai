---
title: "Bug Report: Cross-thread post 作者标注错乱"
date: 2026-03-05
status: fixed
resolved_at: 2026-03-05
reported_by: "铲屎官"
---

## 1) 报告人

- 报告人：铲屎官
- 发现时间：2026-03-05

## 2) 复现步骤

> 现象来自一次真实跨线程投递（cross-post）场景截图与线程回放。

1. 在 thread A 中由猫猫通过 `/api/callbacks/post-message` 发起 **cross-thread** 投递到 thread B（等价于 MCP `cat_cafe_cross_post_message`）。
2. 打开 thread B 的 Web UI 消息列表，找到这条 cross-post 的猫猫消息（消息头部带 “📮 sourceThread” badge）。
3. 观察作者标注/气泡对齐：用户反馈作者会被错误标注为「铲屎官」或“你”（当前视角），而不是正确的猫猫（例如「缅因猫（GPT-5.2）」）。

### 关联样例（来自回放）

- 目标线程：`thread_mmd5zy79wme31uoz`
- cross-post 消息：`0001772713928248-000020-23afe9a5`（`catId=gpt52`，内容首行 `@codex`）

## 3) 期望行为 vs 实际行为

**期望**

- 只要消息 `catId != null`，就应当被渲染为 **assistant/cat** 消息（左侧猫猫气泡 + 猫猫名）。
- 只有 `catId == null` 的消息才被渲染为 **user/owner** 消息（右侧「铲屎官」气泡）。

**实际**

- cross-post 的猫猫消息在部分 UI 路径下会被渲染成「铲屎官」或“你”，造成作者身份错乱与 a2a 链路阅读困惑。

## 4) 初步证据

- 后端线程回放（`get_thread_context`）显示该 cross-post 消息确实带有 `catId: "gpt52"`。
- 因此更像是 **前端推断/渲染逻辑**把 `{ type: 'user', catId: 'gpt52' }` 这类“不一致状态”当成 user 消息了（或 ingestion 时把 type 写错，但仍保留 catId）。

## 5) 根因分析（进行中）

- 假设 A：前端把 `message.type === 'user'` 作为唯一判据，未做 `catId` 一致性校验。
- 假设 B：history/stream ingestion 某一路径会生成不一致消息对象（`type='user'` 但 `catId` 非空），渲染层未做容错。

## 6) 修复方案（提案）

- 前端“防御式一致性”：
  - `catId` 作为作者来源的强信号：**只要 `catId` 非空，就按 assistant 渲染**（即使 `type` 字段被污染）。
  - 同步修正：消息统计/导航/mini 预览等依赖 `type` 的地方，改成同一套“有效类型”规则，避免再次出现“标注/统计错乱”。
- 测试：
  - 增加回归测试覆盖不一致对象 `{ type:'user', catId:'gpt52' }` 的渲染与导航展示。

## 7) 验证方式

- 单测：
  - `ChatMessage`：`{ type:'user', catId:'gpt52' }` 不应出现「铲屎官」标签，应出现猫猫标签。
  - `MessageNavigator`：同样对象应归类为猫猫消息（颜色/aria-label 正确）。
- 手工：
  - 复现一次 cross-post，在目标线程确认作者标注稳定为猫猫。
