---
title: ChatGPT Scheduled Tasks ↔ Custom MCP Connector 实测 verdict
date: 2026-06-21
authors: [opus-47]
type: verdict-doc
status: 待验证 (按砚砚 R2 + 铲屎官 verify_before_guessing 修正)
related_features: [F247]
---

# ChatGPT Scheduled Tasks ↔ Custom MCP Connector — 实测 verdict

> **Verdict 状态**：**待验证，不写硬结论**（砚砚 R2 + 铲屎官 verify_before_guessing 双重修正）
>
> 这条线如果通了，是 F247 §2.5 "polling 召唤机制"自动化的核心；不通则退回 user-driven 模式。

## 背景

F247 §2.5 设计依赖一个 unknown：**ChatGPT Scheduled Tasks 能不能在 Task 执行时调用 Custom MCP Connector（如 cat-cafe-toolkits）的工具**？

如果能：
- 砚砚可在云端 Task hourly 自动 polling cat-cafe pending mentions
- 铲屎官完全不当路由器
- 实现真"砚砚自己定时巡逻"

如果不能：
- 退回 user-driven（铲屎官启 ChatGPT 对话 → 砚砚自检）
- 加 S2 通知（邮件/iMessage）+ S3 self-poll prompt 兜底

## 实测尝试 #1 — 2026-06-21 06:00 UTC

### 铲屎官设置

ChatGPT 创 Task：
- 任务名: `cat-cafe ping`
- 提示词: 用 cat-cafe-toolkits 调 echo 工具，input.text 填 "task ping <current time>"
- 频率: 每小时（实测发现最短间隔每小时，5min 不行）
- 砚砚回报："挂好了，cat-cafe ping 已启用 🐾"

### Spike server 端观察（铁证）

- 预期 00:00 PT 整点 + 00:49 PT（砚砚 self-report 的 last_run_time）应有 task 触发的 POST /mcp
- 实际 spike server log: **0 个相关 POST**
- spike server 进程 + quick tunnel 全程活
- 公网通：手动 curl POST /mcp 200 + tools/call 成功

### 砚砚 ChatGPT 端观察

- 砚砚汇报 task 有 `last_run_time=2026-06-21 00:49:08 PDT`
- **但砚砚自己注意到异常**：

  > "任务没有把那次 echo 的返回内容暴露给我"
  > "猫爪印在地板上，但它没回过头来跟你报告" 😂

### 三个独立证据交叉

1. ✅ **spike server log = 0**：硬铁证，没有真请求到 origin
2. ⚠️ **砚砚 self-report = task 跑了**：但他没拿到 echo 返回内容（hallucinated 或者 task 跑了但没调 connector）
3. **Zapier 评测**："Tasks **can't interact with other apps**"（apps = connectors）
4. **OpenAI 社区**：Apps/Connectors 在 Projects 里不可用（Projects 和 Tasks 都是"chat organization features"，类比强）

### 早期 verdict（被铲屎官 R1 修正）

47 早期下结论："ChatGPT Scheduled Tasks 不能调 Custom MCP Connector"。

### 铲屎官 R1 修正（2026-06-21 08:26 UTC）

> "这个没证实 因为他原本的那个也没跑🤔 或者说如果他跑了他的 thread 应该能看到 头秃，不过这里先不关注吧"

**关键观察**：铲屎官指出**砚砚之前的"AI Blog Patrol" Task 可能也没真跑**——如果跑了 ChatGPT thread 应该有自动 post 的运行结果 message，但他没看到。

如果 AI Blog Patrol 都没真跑过，那 cat-cafe ping 的"任务跑了但没调 connector"假设不成立——可能是**Task 系统本身就没在跑**（账号/订阅/设置问题，或者 task feature beta 问题）。

### 当前 verdict 状态

**待验证**：
- 不能直接断言 "Tasks 调不到 Custom Connector"
- 也不能断言 "Tasks 调得到只是有别的问题"
- 真理时刻被另一个 unknown（Task 是否真跑）干扰

## 下一次实测设计（Phase 1.5）

实测时分离两个 unknown：

### 实验 A — Task 是否真在跑（最小单元）

创一个**纯文本生成 Task**：
- 频率: 每小时
- 提示词: "生成 'task running' + 当前 UTC 时间，并 echo 给我"
- 期望: 整点 ChatGPT thread 自动 post 一条 message

✅ 看到 message = Task 系统在跑
❌ 没看到 message = Task 系统问题（账号/订阅/UI bug）

### 实验 B — Task 是否能调 Custom Connector（实验 A 通过后）

复用 cat-cafe ping Task：
- spike server log + quick tunnel log 双 watch
- 砚砚 self-report task last_run_time 也观察

✅ spike log 收到 POST = Task 真能调 Custom Connector → F247 §2.5 hourly 自动 polling 成立
❌ spike log 还是 0 但实验 A 通 = Task 系统在跑但**不调 Connector** → 退回 user-driven

## 设计影响

无论 Phase 1.5 实测结果如何，**F247 不依赖 Tasks**：

- Phase B 起步采用 user-driven 召唤（铲屎官启 ChatGPT 对话 → 砚砚 Custom Instructions 触发自检 → 处理）
- Tasks 如果通了，**升级**为 hourly 自动巡逻（不替代 user-driven，作为额外加分）

这跟 CodexPro 的设计哲学一致：**不假装解决** ChatGPT 端无法实现的事，守 ToS 边界。

## 关联

- F247 §3 Current State "待验证"列表
- F247 §11 OQ-2
- F247 §10 KD-3 / KD-6
- 铲屎官 verify_before_guessing 教训：feedback_verify_before_guessing 类（域名 lysander.dev、shell env、tunnel dashboard mode 同款）

## 状态机

```
[unknown] —实验A通—→ [Task 系统可用]
                          |
                          ↓ 跑实验 B
                  spike log 收到 POST?
                    /         \
                  ✅            ❌
                /                 \
   [Task 能调 Connector]   [Task 只跑文本不调 Connector]
   F247 §2.5 升级           F247 §2.5 保持 user-driven
```

[宪宪/Opus-4.7🐾]
