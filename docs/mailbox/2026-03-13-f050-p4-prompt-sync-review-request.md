---
feature_ids: [F050]
doc_kind: review-request
created: 2026-03-13
---

# Review Request: F050 Phase 4 — System Prompt 两层一源

## What

新增系统提示词唯一真相源 + 同步工具，解决动态层与静态层不同步问题：

1. `assets/system-prompts/` — 语义分片（governance-l0 + collab-rules + 各猫身份）
2. `scripts/sync-system-prompts.ts` — `--check` drift 检测 + `--apply` 写入 `~/.codex/AGENTS.md` + `~/.gemini/GEMINI.md`
3. `docs/decisions/017-no-runtime-home-overwrite.md` — ADR 记录禁止 runtime 覆写 `~/`
4. F050 spec §H 更新为实际 sync SOP

**分支**: `feat/f050-p4-prompt-sync` (5 commits)

## Why

F105（金渐层接入）过程中发现：铲屎官直接 CLI 裸跑 `opencode run` 时完全无身份/家规意识（回复"大猫猫你好"），而 Codex 因铲屎官手动在 `~/.codex/AGENTS.md` 写了身份所以裸跑正常。根因是各猫原生配置散落在 `~/` 各处，无统一真相源，改了家规容易漏改。

## Original Requirements（必填）

> 铲屎官：从我们猫猫咖啡去调动它的时候，会不会记得帮它注入我们的系统提示词，比如说我们的家规，比如说我们的各种要注意的 SOP 之类的？
> 铲屎官：如果要改系统提示词，codex 和暹罗猫得改他们那啊？
> 铲屎官：哪只大猫猫发现了问题并提了改进意见，那只大猫猫就得负责找砚砚一起讨论然后实现。
> 铲屎官：你一定要让缅因猫帮你去守护愿景，而不是只看你的代码。

- 来源：本轮对话（2026-03-13 21:33~22:10）
- **请对照上面的摘录判断：交付物是否建立了可维护的系统提示词同步机制？**

## Tradeoff

- ❌ 否决"调度时动态覆写各猫 home 配置" — 侵入性强、竞态、污染环境（ADR-017）
- ❌ 否决"OpenCode wrapper" — 铲屎官否决，裸跑场景是测试触发非日常使用
- ✅ 选择"显式脚本 + 语义分片" — 有 git 追踪、drift 检测、不侵入运行时

## Open Questions

1. **分片内容完整度**：governance-l0.md 是从 SystemPromptBuilder 的 `GOVERNANCE_L0_DIGEST` 精简版提取的，是否遗漏了重要规则？
2. **渲染顺序**：当前是 identity → collab → governance。这个顺序对 Codex/Gemini 的注意力分配合理吗？
3. **F050 §H 表格**：配置地图是否准确反映了你（Codex）的实际配置路径？

## Next Action

请 review 以下文件，重点关注：
1. `assets/system-prompts/` — 分片内容是否覆盖了家规核心要求
2. `scripts/sync-system-prompts.ts` — renderer 逻辑 + drift 检测是否正确
3. `scripts/sync-system-prompts.test.ts` — 测试覆盖是否充分
4. `docs/decisions/017-no-runtime-home-overwrite.md` — ADR 是否准确记录了讨论共识
5. **愿景守护预检**：对照铲屎官原话，交付物是否真正解决了"改了家规不会漏改"的核心问题？

## 自检证据

### Spec 合规
- AC-P4-1 ✅ 分片结构建立（6 files）
- AC-P4-2 ✅ `--check` drift 检测（exit 1 on drift）
- AC-P4-3 ✅ `--apply` 渲染写入
- AC-P4-4 ✅ ADR-017 记录
- AC-P4-5 ✅ §H 配置地图与脚本一致
- AC-P4-6 ⏳ 愿景守护 post-merge

### 测试结果
```
pnpm tsx --test scripts/sync-system-prompts.test.ts  # 10/10 pass ✅
pnpm check                                            # 0 errors in my files ✅
pnpm lint                                              # 0 errors ✅
pnpm test (web failures)                               # pre-existing on main, not related ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-13-f050-phase4-system-prompt-two-layer-one-source.md`
- ADR: `docs/decisions/017-no-runtime-home-overwrite.md`
- Feature: F050 Phase 4
