---
feature_ids: [F203]
topics: [system-prompt, review-request, l0]
doc_kind: note
created: 2026-05-15
---

# Review Request: F203 Phase B — L0 真相源 + per-cat 编译器

Review-Target-ID: f203
Branch: feat/f203-phase-b-l0-source
Commit: 9105d184f

## What

- `assets/system-prompts/system-prompt-l0.md` — L0 真相源（14 项家规 + 客观性 carry-over placeholder + 3 个 per-cat 模板变量 `{{IDENTITY_BLOCK}}` / `{{TEAMMATE_ROSTER}}` / `{{WORKFLOW_TRIGGERS}}`）
- `scripts/compile-system-prompt-l0.mjs` — per-cat overlay 编译器（输出 `--system-prompt` / `-c developer_instructions` ready 字符串）
- `scripts/compile-system-prompt-l0.test.mjs` — 36 测试全绿

## Why

> "F203 的最终目标就是优化重构现在的系统提示词，让布偶猫和缅因猫不要受到太多原本不合理的系统提示词的影响，把我们自己原本应该构建在系统提示词但是没能进去的进入系统提示词。Claude Code 也好 Codex 也好那些客观性的系统提示词不能丢。"

- 来源：thread `mp6b68w9w0wt1boc`（铲屎官 2026-05-15）+ `docs/decisions/030-system-prompt-engineering.md` §10.2
- **请对照上面摘录判断交付物是否解决了铲屎官的问题**

Phase B 只交付"L0 真相源 + 编译器"。Phase C 才接生产 spawn（ClaudeBgCarrierService argv + effectivePrompt 拼装）。

## Tradeoff

- 客观性 carry-over 段做 ≤100t placeholder（KD-7b）——S2 实测 partial L0 下 0 项功能性能力退化，强制重写默认功能性指令是过度工程。放弃了"完整重写 6 项客观性指令"方案
- per-family 治理协议下沉到 WORKFLOW overlay（每猫只看自己 breed 的协议），放弃了"全 3 协议进每只猫 L0"方案——省 ~300t

## Architecture Ownership

Architecture cell: harness/system-prompt-injection
Map delta: update required（注入链 user-message-prepend → native-system-role；ADR-030 §3 已记新流程）
Why: Phase B 是 L0 真相源 + 编译器（不碰生产 spawn 代码），Phase C 才改 ClaudeBgCarrierService

请 reviewer 检查：
- diff 是否与 `Map delta` 一致（Phase B 不应改 SystemPromptBuilder.ts / ClaudeBgCarrierService.ts 生产代码）
- compile 脚本是否新建了并行 Store/Router/Adapter（应只是纯函数 + readFileSync）

## Open Questions

### 技术 OQ（给 reviewer）

1. **14 项覆盖完整性**：`system-prompt-l0.md` 是否漏了 ADR-030 §10.2 任何一项？测试 `14 L0 governance items coverage` 逐项断言，但断言本身可能不全
2. **KD-8 opus-47 workflow fix（行为变更）**：opus-47 breedId='opus-47' 不在 {ragdoll,maine-coon,siamese}，现有 `SystemPromptBuilder.ts:554` 对其**无** workflow triggers（S1 实测 opus-47 workflow=0t）。compile 脚本加 `displayName→breed` fallback 让 opus-47 共享 ragdoll workflow。**这是行为变更**——你认为应该修这个 gap（F203 愿景"把该进的进去"），还是 Phase B 应保持与现有 SystemPromptBuilder 一致（opus-47 仍无 workflow），把 fix 留到 Phase C？
3. **P4 单一真相源违反**：compile 脚本 `WORKFLOW_TRIGGERS_INLINE` 是 `SystemPromptBuilder.ts:366` 的 duplicate，标了 `TODO(F203/Phase-C)` 待 export 后删除。这个临时 duplicate 可接受吗？
4. **AC-B3 上限 4,500→5,000**（KD-9）：S1 baseline 实测 static 2,684-3,060t，14 项完整内容物理下限 ~4,600t。上限调整理由是否站得住？还是应该继续压缩 system-prompt-l0.md？

### 价值 OQ（给 CVO）

无。token 上限调整 + opus-47 workflow fix 都是技术细节，可回滚（git revert）。KD-8 行为变更已在 spec 显式记录待 reviewer 判断，不需 CVO 拍板。

## Next Action

请砚砚：
1. **执行 quality-gate（47 盲审规则）**——我是 opus-47，Phase B 作者，按 F177 Phase B 47 盲审规则**不能自评 quality-gate 放行**。请你执行 quality-gate，我的自检证据（下方）仅作 author 输入，不算放行判据
2. Phase B code review（4 个技术 OQ）
3. verdict 严格二选一：approve（无 P1/P2）或 blocking（列必须修项）

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f203/codex`
- Start Command: 本 Phase B 无 dev server 需求（纯脚本 + 文档）；验证用 `node --test scripts/compile-system-prompt-l0.test.mjs`
- Ports: N/A（无前端/服务）

## 自检证据（author 输入，47 盲审规则下不算放行判据）

### Spec 合规
- AC-B1 ✅ 14 项 L0 全覆盖（测试 `14 L0 governance items coverage` 13 子测试）
- AC-B2 ✅ compile per-cat overlay（6 catId 测试）
- AC-B3 ✅ token ≤ 5,000（KD-9 调整，opus 最低 ~4,400 / codex 最高 ~4,750）
- AC-B4 ✅ per-cat byte-identical（cache 稳定测试）

### 测试结果（2026-05-15 实测）
```
node --test scripts/compile-system-prompt-l0.test.mjs
ℹ tests 36
ℹ pass 36
ℹ fail 0
npx biome check scripts/compile-system-prompt-l0.{mjs,test.mjs} → 0 errors
```

### 相关文档
- ADR: `docs/decisions/030-system-prompt-engineering.md` §10.2
- Feature: `docs/features/F203-native-system-prompt-l0.md`（Phase B AC + KD-7b/8/9）
- Audit: `docs/audits/2026-05-15-functional-spike-s2-s3.md`（S2 0 项退化结论）
