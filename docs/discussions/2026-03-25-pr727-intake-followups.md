---
feature_ids: []
topics: [intake, debt-paydown, provider-profiles, capabilities]
doc_kind: discussion
created: 2026-03-25
---

# PR727 Intake Follow-ups 需求记录

**Thread**: 当前协作线程 | **日期**: 2026-03-25 | **参与者**: 铲屎官、布偶猫(opus)、缅因猫(gpt52)

## 背景

`#727` 合入 `main` 后，我们在 review 中确认还剩两条 P2 结构债：

1. capability dedup 逻辑在 `capability-orchestrator` 和 `capabilities` route 重复
2. `provider-profiles.ts` 的 sync/async 迁移实现分叉

布偶猫原本建议“开 issue 跟踪”，铲屎官明确否决，要求这一轮直接修掉。

## 铲屎官原话

> “剩余 follow-up：我们 review 中达成共识的两个 P2 结构债还需要开 issue 跟踪：
> Dedup 逻辑抽 helper（capability-orchestrator + capabilities route）
> Sync/async 迁移收口（provider-profiles.ts 两套实现） 这个！ 别留债务！”

## 收敛后的执行目标

- 不开 follow-up issue，直接在家里修掉两条结构债
- 保持现有行为不变，用回归测试锁住 transport 优先级与 provider-profile migration 语义
- 修完后按正常 SOP 走自检、request-review，不停在“本地看起来没问题”
