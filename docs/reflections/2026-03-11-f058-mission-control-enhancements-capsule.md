---
capsule_id: "F058-2026-03-11"
context: "Mission Control 从能用到好用：10 Phase 迭代 + 依赖 DAG 拓扑图"
feature_ids: [F058]
doc_kind: capsule
created: 2026-03-11
---

## What Worked

- **迭代式交付**：10 个 Phase（A~J）逐步推进，每次铲屎官实测后快速响应调整，而非一次性大爆炸
- **四猫 UX 大讨论后收敛**：Phase H 四猫独立思考（两 Tab / 搜索优先 / 三模式 / Feature 行），最终收敛成清晰的两 Tab 方案（功能列表 + 依赖全景）
- **独立思考被采纳**：Phase J 我提出"默认仅有依赖"比砚砚的"默认活跃"更符合场景——铲屎官拍板采纳
- **跨猫 review 有效拦截问题**：砚砚发现 `connected` scope 用声明判断会保留孤立节点、frontmatter `F32-b` 脏值等 P1

## What Failed

- **愿景守护只看代码不看产品**：Phase A~C 代码审查全绿、云端 review 全通过，但铲屎官截图发现"27 个 item 全在 Open 栏"+"右侧面板截断看不到"。grep 代码打勾 ≠ 愿景守护
- **Phase J 第一版没有 DAG 拓扑**：实现时只做了平铺卡片网格 + 文本列表，没有引入图形库。铲屎官截图指出"不是愿景里的样子"才返工
- **数据层被忽略**：Redis 里 backlog items 缺少 `dependencies` 字段（历史导入）、parser 没读正文 `**Related**`，导致 DAG 图只有节点没有边

## Trigger Missed

- **Phase A~C 应该触发"产品视角验证"**：测试通过 + review 通过后，应该在真实环境截图验证 UI 效果，而非直接标 done
- **Phase J 应该在实现前核对设计稿**：Phase H 设计稿评审明确要求 DAG 拓扑（KD-4/KD-5），实现时没回看这个约束
- **数据层调查应该更早**：边画不出来时，应该先查 Redis 数据再怀疑代码。我是反过来做的

## Doc Links

- [F058 Spec](../features/F058-mission-control-enhancements.md)
- [Phase H 设计稿](../../designs/mission-hub-坏猫采访.pen)
- Thread `thread_mmlngz8l35kir108`（Phase J DAG 讨论 + 四猫收敛）

## Rule Update Target

- `quality-gate` skill：愿景守护 Step 0 必须包含产品效果验证（截图/录屏），不能只 grep 代码
- `MEMORY.md`：补"图谱 UI 不要直接消费导入快照当真相源"经验（砚砚在讨论中建议）
- `shared-rules.md §质量覆盖`：补"实现前回看 Key Decisions"检查点
