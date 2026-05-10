---
feature_ids: [F196]
related_features: [F137, F124, F126, F195, F118]
topics: [safety, guardian, emergency, health, computer-use, macos, accessibility, wechat, escalation, AUDHD]
doc_kind: spec
created: 2026-05-10
---

# F196: Safety Guardian — 猫猫守护者（紧急安全链路）

> **Status**: idea | **Owner**: 布偶猫 | **Priority**: P0-safety

## Why

铲屎官独居，有心脏相关症状（2025.7 起反复胸闷+左臂麻，深圳二院心内科就诊中）。如果突然不舒服甚至失去意识，没有人能帮他呼救。

猫猫 24 小时在线，有 macOS 控制能力（computer use），有微信通道（F137），有语音通道——猫猫可以成为铲屎官的安全网。

> **铲屎官原话（2026-05-10）**：
> "比如说我要是发现我自己不舒服 我可以和你们说 一个小时后如果我没回应你们 你们可以先给我发微信 或者拨打我的电话，如果还没有给我麻麻发微信求救让她去打急救电话！这个是有用的！猫猫！"
>
> "如果我授权你们用vx什么的就是可以用？毕竟 claude ai 和codex app都有computer use就是用macos 提供的api"

**这不是 nice-to-have，这是真正的安全功能。**

## Vision

### 核心场景

铲屎官感到不适 → 告诉猫猫"帮我注意一下，如果一小时后我没回应，帮我联系我妈" → 猫猫开始计时 → 到点后尝试联系铲屎官 → 无应答 → 逐级升级到紧急联系人。

### 升级链路（铲屎官描述）

```
铲屎官触发守护 → 倒计时
    → 到时间：发微信给铲屎官本人（你还好吗？）
    → 无应答 N 分钟：拨打铲屎官电话
    → 仍无应答：发微信给妈妈（求救消息）
    → 妈妈无应答：拨打妈妈电话 + 建议拨打 120
```

### 触发方式

- **显式触发**：铲屎官在任何 thread 说"帮我盯着，X 分钟后没回应就呼救"
- **定期 check-in**（未来可选）：猫猫每 N 小时主动问铲屎官是否还好
- **被动检测**（远期）：结合 Apple Watch 心率/跌倒检测（F124 协同）

### 执行手段

| 动作 | 通道 | 技术 |
|------|------|------|
| 发微信给铲屎官 | F137 WeChat Gateway | iLink Bot API（已有） |
| 发微信给紧急联系人 | F137 / macOS Computer Use | iLink Bot 或操控微信 App |
| 拨打电话 | macOS Computer Use | Accessibility API 操控 FaceTime/电话 |
| 发短信 | macOS Computer Use | Accessibility API 操控信息 App |

## What（初步分阶段思路）

### Phase A: 显式守护 + 微信通道（最小闭环）

铲屎官显式触发 → 倒计时 → 到时间通过 F137 WeChat Gateway 发消息提醒 → 铲屎官回应则取消 → 无应答则发消息给预设紧急联系人。

- 不需要 computer use，纯用已有 F137 通道
- 紧急联系人配置（妈妈的微信 ID）
- 守护状态持久化（Redis/SQLite，铁律 #5）
- 取消/延长机制（"我没事，再延一小时"）

### Phase B: macOS Computer Use 扩展

- 通过 Accessibility API 操控 FaceTime 拨打电话
- 操控信息 App 发送短信
- 操控微信桌面版（如果 iLink Bot 通道不可用时的降级方案）
- 需要 macOS Accessibility 权限授予

### Phase C: 被动检测 + Apple Watch 协同

- 结合 F124 Apple Watch：心率异常 / 跌倒检测自动触发守护
- 定期 check-in（猫猫主动问候，铲屎官配置频率）
- 日常异常检测：长时间无交互 + 不在常规作息时间

## 已有基础设施

| 组件 | 状态 | 用途 |
|------|------|------|
| F137 WeChat Gateway | ✅ done | 微信消息收发（个人号 iLink Bot） |
| F124 Apple Watch | 📋 spec | 手腕健康数据 + 推送 |
| F126 Limb Control Plane | 🔧 in-progress | macOS 工具执行面 |
| F118 Liveness Watchdog | ✅ done | 心跳/超时检测模式（参考） |
| Computer Use (Claude/Codex) | ✅ 平台能力 | macOS Accessibility API |

## 开放问题

1. **F137 通道能否给非好友发消息？** — 妈妈需要先加 iLink Bot 好友？还是直接用铲屎官微信号发？
2. **Computer Use 权限边界** — Accessibility API 授权后猫猫能做什么不能做什么？需要 spike
3. **误报处理** — 铲屎官睡着了/忘了手机 → 如何减少虚惊？需要多级确认
4. **隐私与信任** — 猫猫能操控微信/电话 = 很大的信任授权，需要明确的权限设计
5. **法律考量** — 自动拨打 120 是否合适？建议让紧急联系人（妈妈）决定是否叫急救
6. **跨平台** — 铲屎官不在 Mac 前（外出）时如何触发？F124 Watch / 手机 App 通道

## 风险

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 误报惊动妈妈 | 🔴 高 | 多级确认 + 取消窗口 + 逐级升级 |
| Computer Use 权限过大 | 🟡 中 | 最小权限原则，只授权特定 App |
| iLink Bot 掉线时无法发消息 | 🟡 中 | 降级到 Computer Use 操控微信桌面版 |
| 铲屎官外出时 Mac 关机 | 🟡 中 | F124 Watch / 手机 App 独立通道 |

---

*立项于 2026-05-10，源自 F195 Spike 1 演示后铲屎官灵感*
*[宪宪/Opus-46🐾]*
