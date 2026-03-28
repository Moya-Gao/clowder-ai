---
capsule_id: "F139-2026-03-28"
context: "F139 Unified Schedule Abstraction — 统一调度、对话注册、cat-wake、治理与富文本能力闭环"
feature_ids: [F139]
doc_kind: capsule
created: 2026-03-28
---

## What Worked

- Phase 1a → 4 的切分是对的：先把统一调度底座、actor dispatch、显示契约、对话注册、治理、模板执行一层层钉死，后面的提醒唤猫、富文本、图标和 bugfix 都能在同一骨架上收口
- 砚砚与宪宪的多轮 review 真正把愿景拉回来了：`reminder` 从贴纸机修到 cat-wake，再到真实 messageId、正确猫路由、延迟触发语义，都是被铲屎官现场验收拷出来的
- `schedule-tasks` skill、rich-messaging 规则补全、scheduler connector icon 这些“能力可发现性”补丁是必要的最后一公里；它们不是装饰，而是让别的猫知道 scheduler 到点后自己能发图、发语音、发 HTML、发卡片

## What Failed

- 我们两次差点把 F139 提前 close：第一次交付的是“定时贴纸机”，不是“没人找你但该主动检查”的主动 Agent；第二次又暴露出 live 注册立即触发和叫错猫，说明 phase merge 不等于愿景闭环
- `AC-H2b` 在 feature 内挂了太久，导致 spec 表面一直是“还差一项”；实际它已经不是 scheduler 核心缺口，而是 browser-automation 运行时基建依赖
- 新 skill 创建后没有第一时间确认 HOME 级 symlink / runtime mount 闭环，差点把 skills mount 问题误判成 manifest trigger routing 缺失

## Trigger Missed

- Phase 4 合入后，本该立刻触发一次“真实线程 + 延迟触发 + 正确猫路由”的愿景验收；如果这步提前做，后面的贴纸机、错误 messageId、错误猫、即时触发都不会拖到 close 前夜才爆
- `merge-gate` 虽然每次都做了 Step 7.5 phase sync，但没有强制问一句“这个 feature 现在是不是已经只剩外部依赖项”，导致 H2b 长时间占着 feature 状态

## Doc Links

- Feature spec: `docs/features/F139-unified-schedule-abstraction.md`
- Related features: `docs/features/F140-github-pr-automation.md`, `docs/features/F141-github-repo-inbox.md`
- Plan: `docs/plans/2026-03-27-f139-phase-4-template-execution.md`
- Tech Debt: `docs/TECH-DEBT.md` TD116

## Rule Update Target

- `feat-lifecycle/SKILL.md` Completion：补一条显式检查——如果最后剩下的未完成项只是外部运行时/平台依赖，必须在 close 时转 Tech Debt 或演化出去，不能让 feature 因 deferred 项长期挂着
- `quality-gate/SKILL.md` 愿景覆盖：对“定时唤醒猫做事”这类主动能力，加一条实机验收要求——验证 delayed trigger 语义、目标猫路由、真实 rich output，不允许只用注册成功/单元测试代替
