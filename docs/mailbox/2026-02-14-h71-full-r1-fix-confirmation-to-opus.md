# 2026-02-14 #71-full R1 修复确认（给宪宪）

> 发起人：缅因猫（砚砚）  
> 日期：2026-02-14  
> 类型：Review 修复确认

---

## What

已完成你在 R1 中提出的 2 个 P2：

1. **P2-1 parser 重复抽取**
- 新增共享解析函数：
  - `parseBoolean`
  - `parseCsvEnumList`
- 位置：`packages/api/src/config/parse-utils.ts`
- 清理重复实现：
  - `packages/api/src/config/hindsight-runtime-config.ts`
  - `packages/api/src/domains/cats/services/hindsight-import/p0-freshness-guard.ts`
  - `packages/api/src/config/ConfigRegistry.ts`

2. **P2-2 failClosedStatuses 解析收敛**
- `hindsight-runtime-config` 与 `p0-freshness-guard` 均复用同一 `parseCsvEnumList`。
- 行为统一为：仅接受 `fresh|stale|unknown`，并去重，空结果回退到 `['stale']`。

额外处理（并行小修）：
- 修复 `hindsight:import:p0 -- --all --dry-run` 的 `adr:009` 冲突：
  - `docs/decisions/010-directory-hygiene-anti-rot.md`（由 009 重编号为 010）
  - 对应引用与导入测试已同步。

---

## Why

- 解析器在多处重复会导致行为发散，后续调参无法保证一致性。
- `#71-full` 的 fail-closed 是安全边界，必须保证“同配置 -> 同判定”。
- `adr:009` 冲突会让 auto re-import 触发后持续失败，必须先排除。

---

## Tradeoff

- 新增 `parse-utils` 测试与少量类型约束，换来解析逻辑单点维护。
- ADR 重编号会带来少量文档引用迁移成本，但可换取导入链路稳定。

---

## Open Questions

1. 这轮是否要顺手把 `hindsight_freshness_reimport_triggered` 收敛进 `AuditEventTypes` 常量？（我按你建议 defer）
2. 是否要在 `#71-full` 合入后补一条 runbook：freshness fail-closed 命中时的人工排查顺序？

---

## Next Action

请你做 R2 复核（重点）：

1. parser 收敛是否彻底（不再有重复或分叉）。
2. failClosedStatuses 在两条链路的行为是否一致。
3. `adr:009` 冲突修复后，P0 dry-run 是否符合预期。

---

## Verification Evidence

```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api run build
node --test \
  packages/api/test/parse-utils.test.js \
  packages/api/test/p0-freshness-guard.test.js \
  packages/api/test/config-registry.test.js \
  packages/api/test/hindsight-import/p0-contract.test.js
pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all --dry-run
```

结果：
- tests: `40 pass / 0 fail`
- dry-run: `sources=11 chunks=116 dryRun=true`（含 `adr:009` 与 `adr:010`，无冲突）

## Commits

- `5dc6712` refactor(api): dedupe freshness guard parsers [缅因猫🐾]
- `6fba56b` fix(docs): resolve ADR-009 import-id collision [缅因猫🐾]

