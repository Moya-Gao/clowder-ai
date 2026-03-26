---
doc_kind: review-request
created: 2026-03-26
---

# Review Request: F129 Pack System Phase A — Pack Format + Loader + Compiler

Review-Target-ID: f129-pack-phase-a
Branch: feat/f129-pack-phase-a

## What

F129 Phase A 完整实现：Pack 格式定义 + 安全校验 + 编译 + SystemPromptBuilder 注入 + 知识隔离 + REST API。

7 commits, 19 new files, ~1800 lines new code, 140 tests 全绿。

核心改动：
- `@cat-cafe/shared`: Pack 类型定义 + Zod schemas (`.strict()` fail-closed)
- `packages/api/src/domains/packs/`: PackStore, PackSecurityGuard, PackCompiler, PackLoader, PackKnowledgeScope
- `packages/api/src/routes/packs.ts`: POST/GET/DELETE /api/packs
- `SystemPromptBuilder.ts`: Pack block 注入（5 个注入点，按 ADR-021 优先级排列）
- `packages/api/src/domains/memory/schema.ts`: V6 migration (pack_id column)

## Why

让用户能 `cafe pack add <path>` 安装一个 Pack，编译为 canonical prompt blocks 注入 SystemPromptBuilder，双轨信任边界生效。Phase A 不做 git clone、不做前端 UI、不做 RAG 检索——只做 Pack 格式的终态基座。

## Original Requirements（必填）

> "如果我是一个金融从业者，我用你们如何构建一套金融的猫猫协作？如何分享？如果我是一个喜欢 AI 恋爱的玩家我要怎么样？如果我是一个跑团爱好者？如果我是律师？……me & world & cats，我可以是任何身份的我。"
> — 铲屎官，2026-03-19

> "好像无意间搞出了团队 skills 或者说 multi-agent 的 skills 体系，和单 agent 的差别在于 shared-rules.md"
> — 铲屎官，2026-03-19

- 来源：`docs/features/F129-pack-system-multi-agent-mod.md` lines 15-19
- **请对照上面的摘录判断：Phase A 基座是否为用户的"任意身份组合"奠定了可行的格式和安全边界**

## Tradeoff

- 选择 `.strict()` fail-closed（未知字段直接拒绝），而非 `.passthrough()` + warn。理由：AC-A8 + 砚砚 R2 review 明确要求 fail-closed
- knowledge/ 只做 scope 隔离基座（evidence_docs.pack_id），不做检索实现。理由：spec 明确 "知识按需检索，不进静态 prompt"
- world-driver.yaml 只编译只读摘要，不做运行时执行。理由：运行时需要 F093 引擎支持（Phase B 依赖）

## Open Questions

1. **PackSecurityGuard 的 INJECTION_PATTERNS**: 10 个正则够不够？有没有遗漏的常见 prompt injection 模式？
2. **IMMUTABLE_FIELDS**: `Set(['catId', 'family', 'provider', 'displayName', 'breedId'])` — `name` 故意不在里面（mask 自己的名字是合法的）。这个边界对不对？
3. **SystemPromptBuilder 注入顺序**: Identity > Masks > A2A > Governance L0 > Pack Guardrails > Pack Defaults > World Driver。顺序合理吗？
4. **Schema V6 migration**: ALTER TABLE + try/catch 处理部分迁移。这个迁移安全性够不够？

## Next Action

请 @codex 做 R1 code review，重点关注：
- 安全边界（injection patterns, immutable fields, fail-closed schema）
- 注入优先级顺序
- Schema migration 安全性
- 测试覆盖完整性

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|-----|------|----------|----------|
| 1 | AC-A1: pack.yaml schema | ✅ | `shared/src/schemas/pack.ts` | pack-schema.test.js (26 tests) |
| 2 | AC-A2: Directory Convention | ✅ | `test/__fixtures__/valid-packs/quant-cats/` | Integration test |
| 3 | AC-A3: Pack Compiler | ✅ | `packs/PackCompiler.ts` | pack-core.test.js (3 tests) |
| 4 | AC-A4: cafe pack add | ✅ | `packs/PackLoader.ts` + `routes/packs.ts` | pack-core + pack-routes (4+2 tests) |
| 5 | AC-A5: list / remove | ✅ | `packs/PackStore.ts` + `routes/packs.ts` | pack-core + pack-routes (6+3 tests) |
| 6 | AC-A6: 双轨信任边界 | ✅ | `SystemPromptBuilder.ts` injection order | pack-integration.test.js (priority assertion) |
| 7 | AC-A7: Malicious Pack 测试 | ✅ | `packs/PackSecurityGuard.ts` | pack-core.test.js (5 malicious fixtures) |
| 8 | AC-A8: fail-closed schema | ✅ | `.strict()` on all schemas | pack-schema.test.js (unknown fields tests) |
| 9 | AC-A9: capabilities/ reject | ✅ | `PackSecurityGuard.checkCapabilities` | pack-core + integration (2 tests) |
| 10 | AC-A10: knowledge scoped | ✅ | `PackKnowledgeScope.ts` + schema V6 | pack-knowledge-scope.test.js (8 tests) |

### 测试结果

```
pnpm --filter @cat-cafe/api build         # exit 0
node --test pack-*.test.js spb.test.js    # 140 passed, 0 failed
pnpm biome check . --diagnostic-level=error  # 0 errors
pnpm lint                                 # 0 errors (warnings are pre-existing)
```

### 设计稿对照
glob designs/**/*.pen 匹配结果: 无匹配
对照状态: ➖ 无 UI 改动（Phase A 纯后端）

### Artifact Hygiene
仓库根目录未跟踪媒体文件: 无 ✅

### 相关文档
- Plan: `docs/plans/2026-03-25-f129-phase-a-pack-format-loader-compiler.md`
- ADR: `docs/decisions/021-f129-pack-system-architecture.md`
- Feature: `docs/features/F129-pack-system-multi-agent-mod.md`
