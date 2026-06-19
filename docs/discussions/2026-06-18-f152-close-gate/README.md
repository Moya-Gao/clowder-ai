---
feature_ids: [F152]
related_features: [F070, F102, F076]
topics: [memory, bootstrap, distillation, close-gate, vision-guardian]
doc_kind: proof
created: 2026-06-18
---

# F152 Close Gate Evidence (2026-06-18 rerun)

2026-04-15 的愿景守护只把“现在还不能 close”写回了 spec，没有把
`CloseGateReport`、`User Visibility Disclosure`、反思胶囊这三件套真正落盘。
这次 rerun 的目标不是重写 F152 历史，而是把 close 流程补齐，并重新核实
“现在还能不能宣布 done”。

## Verification Summary

| Check | Result | Evidence |
|---|---|---|
| 主链 merge 事实 | ✅ code chain intact | `git log --grep` 命中 Phase 0/ A/ B/ C 与 hotfix/bridge 链：#1032 / #1043 / #1067 / #1070 / #1073 / #1088 / #1115 / #1125 / #1131 / #1146 / #1152 / #1653 |
| API build | ✅ pass | `pnpm --filter @cat-cafe/api build` |
| Memory / bootstrap / distillation 定向测试 | ✅ 160 tests pass | `generic-repo-scanner` / `index-builder` / `expedition-bootstrap-service` / `expedition-bootstrap` / `bootstrap-wiring-guard` / `deidentification-service` / `distillation-service` / `distillation-integration` / `distillation-routes` / `bootstrap-collection-bridge` / `projects-bootstrap-route` |
| Web bootstrap surface 定向测试 | ✅ 31 tests pass | `bootstrap-components.test.tsx` + `bootstrap-orchestrator.test.tsx` |
| Close 证物完整性 | ✅ now present | 本目录 `README.md` + `close-gate-report.md` + `docs/reflections/2026-06-18-f152-expedition-memory-capsule.md` |
| 最终 close blocker | ❌ still blocked | AC-C5 没有铲屎官亲手走完“出征→冷启动→干活→经验回流”的正式验收记录 |

## Vision Three Questions

1. **铲屎官最初要解决的核心问题是什么？**
   不是“给 cat-cafe 多扫几个目录”，而是让猫去外部已有项目时，既能冷启动理解业务，又能把可泛化经验带回家。
2. **当前交付物解决了吗？**
   代码链解决了 90% 的问题：外部 repo 扫描、bootstrap、项目摘要、项目集合入库、generalizable 标记、脱敏、候选回流都在。缺的不是实现链路，而是最后一轮铲屎官亲手 dogfood 的终验。
3. **铲屎官现在用这个功能的体验如何？**
   从代码和测试真相看，进入外部项目时用户已经能看到提示卡、进度药丸、摘要卡和检索结果，也能走经验回流 API/MCP 路径；但我们还没有一条被记录下来的“真实外部项目全链路体验”来证明这一切串起来真的顺手。

## Guardian Evidence Table

| 铲屎官原话（逐字引用） | 当前实际状态（2026-06-18 复核） | 匹配？ |
|---|---|---|
| “社区小伙伴使用你们，大概率不是开发你们，而是用你们开发其他项目。别人是让你们去做他们自己的项目，甚至别人的项目未必从零开始。这才是他们的痛点。” | `GenericRepoScanner` + `IndexBuilder` auto-select + `ensureProjectCollection` 现已把非 cat-cafe 仓库文档真正接进 F102 evidence store。定向测试覆盖扫描、自动选 scanner、provenance、bridge、index-state route。 | ✅ |
| “很多企业都完成信息化，但是信息化如何和 AI 结合？未必有探索。” | F152 已把“进项目先理解现状”落成产品面：bootstrap prompt / progress pill / summary card / projects-bootstrap routes / structural summary / 搜索入口都在，web 定向测试 31 条全绿。 | ✅ |
| “打开某个外部 project 你们这能用吗？怎么提示？” | 当前会通过 `missing/stale/building/ready/failed` 五态状态机决定提示卡、自动 notice、进度药丸和摘要卡；后端 route 与前端 orchestrator 都有回归测试。 | ✅ |
| “这些小猫可以变为 Palantir 概念里面的 FDE，指导和完成业务系统的开发。” | `knowledge-engineering` skill、bootstrap、项目集合入库、distillation / deidentification / MCP tools 组成的 AI FDE 底链都在；但还缺一条铲屎官亲手走通的全链路体验记录来证明“指导+干活+回流”整体好用。 | ⚠️ code-side yes, human-side not yet closed |
| “铲屎官亲手体验一轮完整的‘出征→冷启动→干活→经验回流’链路” (AC-C5) | 仓库和现有 thread 真相源里都没有这条终验记录，也没有删除/降级 AC-C5 的 CVO signoff。 | ❌ |

## User Visibility Disclosure

| Surface | 用户能做什么（达成态） | 用户实际能做什么（本次 close rerun 时） | 缺失/退化 | 处置 |
|---|---|---|---|---|
| Guided 路径 | 猫先指导外部项目补文档骨架，再建立更高质量记忆 | `knowledge-engineering` skill 已存在，spec/skill/doc 链完整 | 本次未重跑真人演示 | code/doc side met |
| 现有项目冷启动提示 | 打开旧项目时知道“能不能扫、多久、稍后再说” | `BootstrapPromptCard` / `BootstrapOrchestrator` / index-state routes 全在，31 条 web 测试覆盖 missing/stale/failed/building/ready 场景 | 无已知功能缺口 | met |
| 扫描过程可见性 | 看到阶段化进度而不是卡死 | `BootstrapProgressPill` + progress callbacks + WebSocket 路径已有定向测试 | 本次未做真人录屏复核 | code-side met |
| 扫描后可用性 | 外部项目文档真正进入 F102 检索面，可搜索、可统计覆盖度 | `ensureProjectCollection` bridge test、scanner/index-builder/provenance/search tests 都通过 | 无已知功能缺口 | met |
| 经验回流 | 把 lesson/decision 标记为 generalizable，脱敏后提名进全局层 | distillation routes / service / integration / deidentification tests 通过，MCP tools 仍在注册 | 本次未做真实项目手工回流演示 | code-side met |
| 全链路体验 | 铲屎官亲手跑完“出征→冷启动→干活→经验回流”，确认不是纸面闭环 | 还没有这条正式终验记录 | **唯一 blocker** | blocked by AC-C5 |

## Rerun Verdict

这次 rerun 证明了两件事：

1. **F152 不是代码没做完**。主链与 hotfix/bridge 链都还成立，191 条定向测试（API 160 + Web 31）足以证明当前实现不是假闭环。
2. **F152 也还不能 declare done**。唯一没有被满足的仍然是 AC-C5，而且它是产品级终验，不是 author 自己能用“follow-up”糊过去的尾巴。

所以这次 close rerun 的结论是：**流程缺口已经补齐，feature 真实状态仍是 `in-progress / blocked by AC-C5`。**
