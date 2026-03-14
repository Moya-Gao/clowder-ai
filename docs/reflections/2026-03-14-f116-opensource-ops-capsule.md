---
capsule_id: "F116-2026-03-14"
context: "opensource-ops skill 全场景实现 + bug diagnosis capsule"
feature_ids: [F116]
doc_kind: capsule
created: 2026-03-14
---

## What Worked
- 场景路由 + 独立 ref 文件架构：skill 入口简洁，每个场景独立可读，避免了 mega-skill 问题
- 铲屎官 KD-7 审核 + 两猫分工（codex code review + gpt52 愿景守护）：三层门禁确保交付质量
- Bug 诊断胶囊做成共享 ref 归 debugging，tdd/opensource-ops 引用：职责边界清晰，避免重复
- needs-info vs question 标签拆分：语义精确化，防止误关单
- post-sanitize biome format：解决了 sanitize 规则可能打乱格式导致 CI 失败的问题

## What Failed
- 首次提交的 sanitize 规则只有声明没有实现（sync-manifest.yaml 写了 type: sanitize 但 _sanitize-rules.pl 没有对应逻辑），被缅因猫 review 抓到
- 五件套和胶囊的先后顺序在多处不一致，反复修了 3 轮才收口——根因是新概念引入时没做全文件一致性扫描
- community-pr 的生命周期经历了 deprecated → 完全删除 → spec 忘记同步三个阶段，每次转变都留下残留
- F116 spec 自身的"旧世界观"问题——铲屎官拍板变更后 spec 没有立即同步，被愿景守护抓到

## Trigger Missed
- 引入新概念（胶囊入口 vs 五件套存档）时应该立即做"全文件 grep 一致性扫描"，而不是只改引入点
- 铲屎官拍板"完全吸收 community-pr"后，应该在同一轮对话中更新 spec，不要等到下一轮
- `needs-info` 新标签加入后，应该主动检查所有引用 `question` 的地方（accepted issue 判定就是漏网之鱼）

## Doc Links
- Feature spec: `docs/features/F116-opensource-ops.md`
- Skill 入口: `cat-cafe-skills/opensource-ops/SKILL.md`
- 6 场景 refs: `cat-cafe-skills/refs/opensource-ops-*.md`
- Bug capsule: `cat-cafe-skills/refs/bug-diagnosis-capsule.md`
- Sanitize rules: `scripts/_sanitize-rules.pl`

## Rule Update Target
- `debugging/SKILL.md`：胶囊是入口，五件套是存档——已更新
- `opensource-ops-labels.md`：`question` vs `needs-info` 语义拆分——已更新
- `opensource-ops-inbound-pr.md`：accepted 判定排除 `needs-info`——已更新
- 经验教训：新概念引入 → 全文件一致性扫描（可考虑加到 shared-rules 的元思考触发器）
