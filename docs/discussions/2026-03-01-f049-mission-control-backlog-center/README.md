---
feature_ids: [F049]
topics: [mission-control, backlog, tasking]
doc_kind: discussion
created: 2026-03-01
---

# F049 Mission Control — Backlog Center（需求摘录与澄清）

## 背景

我们已经用 F040 把 `docs/` 的 BACKLOG/Feature 聚合体系整理成稳定真相源，但铲屎官希望把“全局任务池 + 派发协同”的高频操作搬进产品内（Web/PWA），从而实现跨 thread 的协同作战指挥中心。

## Original Requirements（铲屎官原话摘录）

> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “如果我们产品内 backlog（UI/手机快速收集）你知道这会意味着什么吗？我们有一个全局跨thread的协同作战指挥中心。”  
> “未来你们的能力强了，我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”

## 已确认的事实 / 澄清

- 手机端入口：我们已在手机上通过 **PWA** 高频使用 Cat Café（无需等 F010 iOS 原生 app 才能启动）。
- 与 F037 的关系：F049 是把 F037 里拆出的 “F‑Swarm‑3：Backlog 领取 + 自动开新 Thread” 产品化落地。

## 初步范围（对齐 F049 spec）

- Global Backlog（inbox/调度）在产品内完成：创建/分拣/建议领取/批准/派发/追踪。
- 执行细节仍在 thread 内完成（隔离上下文与并发互踩）。
- 领取权限采用“建议+批准 → 权限棘轮”的演进路线，而不是一开始就 self-claim 放开。

## Open Questions

1. Backlog item 的存储与索引：Redis-first 的具体 key schema 与原子操作接口如何设计？
2. “批准后自动开 thread”的 UI 入口与 API/MCP tool 形态怎么选？
3. 文件级并发控制的最小可行策略是什么（不做过度设计但能防事故）？
