---
capsule_id: "F095-2026-03-11"
context: "Thread Sidebar 导航体验升级 — 三个 Phase 交付完成，并在上线反馈后补了新建对话 modal UX 热修"
feature_ids: [F095]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- 把 F095 拆成 Phase A/B/C 是对的：先落折叠记忆基座，再做活跃工作区，最后补新建对话增强，三步都保留下来了，没有返工成脚手架
- "50 个项目怎么办" 的关键判断是对的：不是排序问题，而是导航模型问题。活跃工作区 + 最近对话解决了 cat-cafe 被埋在中间的核心痛点
- Review 链路有效：本地 review 和云端 review 都抓到了真实边界问题，比如搜索态折叠、归档项目 pin、`backlogItemId` 存在性/归属校验，这些如果漏掉会上线成真 bug
- 铲屎官在 Phase C 后继续指出 modal 可用性问题，我们没有硬撑“已经 done”，而是把反馈回收到 F095 本身，用 PR #376 做了收口热修

## What Failed
- F095 在文档上过早写成 `Status: done`，但 completion 收尾链路没跟上：BACKLOG 还挂着 `in-progress`，`docs/features/README.md` 也没进已完成索引
- Phase C 首版虽然功能齐了，但新建对话 modal 的信息层级没做好，项目列表被猫猫选择器和辅助控件挤压，铲屎官实际使用时“看不清、点不到”
- 有 .pen 设计稿（`designs/sidebar-navigation.pen`）但实现阶段没有强制做设计对照，导致 modal 布局和设计意图脱节，直到铲屎官当场指出才补 UX 热修

## Trigger Missed
- `quality-gate` 之前对 `.pen` 对照不够强制，猫猫容易在上下文长了以后只顾测试和 review，漏掉设计一致性检查
- `feat-lifecycle` completion 没有把“BACKLOG 移除 + README completed 索引 + reflection capsule”做成机械检查，导致 feature 已交付但真相源没闭环

## Doc Links
- [F095 聚合文件](../features/F095-sidebar-collapse-memory.md)
- [F095 设计稿](../../designs/sidebar-navigation.pen)
- PR #366 / #370 / #373 / #376
- [quality-gate skill](../../cat-cafe-skills/quality-gate/SKILL.md)

## Rule Update Target
- `cat-cafe-skills/quality-gate/SKILL.md`: 保持并执行 Step 5 `PEN CHECK`，有 `.pen` 就必须截图对照，不再靠记忆
- `cat-cafe-skills/feat-lifecycle/SKILL.md`: completion 阶段应增加“真相源闭环检查”提示，至少核对 `BACKLOG`、`features/README`、`reflection capsule` 三件套
