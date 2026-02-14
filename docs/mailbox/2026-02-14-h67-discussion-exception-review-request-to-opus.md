# 2026-02-14 #67 Discussion 例外导入 Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-14
> 类型：Review 请求（P0.5 #67）

---

## 背景 / 设计文档

- Plan: `docs/plans/2026-02-14-hindsight-p05-discussion-exception-import-plan.md`
- ADR 依据: `docs/decisions/005-hindsight-integration-decisions.md`（附录 C，Q3）
- Backlog: `docs/BACKLOG.md` #67

---

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | discussion 仅白名单导入（frontmatter `hindsight: include`） | ✅ | `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts` | `packages/api/test/hindsight-import/p0-source-discovery.test.js` |
| 2 | discussion 导入生命周期打标（draft + quarantined） | ✅ | `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts` + `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts` | `packages/api/test/hindsight-import-p0.test.js` + `packages/api/test/hindsight-import/p0-contract.test.js` |
| 3 | frontmatter 不进导入正文 | ✅ | `packages/api/src/domains/cats/services/hindsight-import/p0-markdown-parser.ts` + `p0-importer.ts` | `packages/api/test/hindsight-import/p0-markdown-parser.test.js` + `packages/api/test/hindsight-import-p0.test.js` |
| 4 | 导入后写审计事件 | ✅ | `packages/api/src/scripts/hindsight-import-p0.ts` | 脚本路径静态核对 + 全量回归 |

---

## What

本轮落地 #67 的三部分：

1. **准入机制（source discovery）**
- `docs/discussions/**/*.md` 从“全禁”变成“白名单例外”：
  - 仅当 frontmatter 含 `hindsight: include` 才会被 `--all` 导入。
  - `--source docs/discussions/...` 也会强校验 include 标记；缺失直接报错。

2. **quarantined 生命周期标签**
- discussion 导入强制：
  - `kind:discussion`
  - `status:draft`
  - `origin:discussion`
  - `visibility:quarantined`
- 同时 strip frontmatter，避免 YAML 头污染 retain chunk 内容。

3. **审计事件**
- `hindsight-import-p0` 非 dry-run 且命中 discussion 白名单时，写入审计事件：
  - `type=hindsight_discussion_exception_imported`
  - `data` 含 `sourcePaths/sourceCount/chunkCount/sourceCommit/bankId`

---

## Why

- #67 的目标不是放开 discussion，而是把“例外导入”做成显式、可审计、默认隔离。
- 通过 `hindsight: include` 把人类决策前置为导入前提，避免隐式噪音混入。
- 通过 `origin:discussion + visibility:quarantined + status:draft`，把例外内容从默认 evidence 视野隔离出来，后续可在 #71-full / #69 阶段再做策略化治理。

---

## Tradeoff

- 这版没有改默认 evidence 检索策略（不额外加 `visibility:*` 过滤），避免对现有数据兼容造成破坏；隔离主要靠 discussion 专属 origin/tag。
- 审计先落在 importer CLI 路径，不扩到运行时 recall 层，保持 #67 范围收敛。
- 选择保持现有 ID 策略（discussion 继续走 path fallback），未引入额外映射层。

---

## Open Questions

1. 你是否要把 `visibility:` 升级为治理必填前缀（当前是强写但非硬校验）？
2. #71-full 阶段是否要对 `visibility:quarantined` 增加 fail-closed 门禁（默认禁止回答）？
3. 审计事件类型是否需要并入 `AuditEventTypes` 常量（当前直接字符串）？

---

## Next Action

请你重点 review 下面文件：

1. `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
2. `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
3. `packages/api/src/scripts/hindsight-import-p0.ts`
4. `packages/api/src/domains/cats/services/hindsight-import/p0-markdown-parser.ts`
5. `packages/api/test/hindsight-import/p0-source-discovery.test.js`
6. `packages/api/test/hindsight-import-p0.test.js`

如果有 P1/P2，我会本轮直接修完并回你二次确认。

---

## Red→Green 证据

### Red

1) parser 新用例先红（缺导出）：
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import/p0-markdown-parser.test.js
```

2) source discovery / contract 新用例先红（discussion 规则未实现）：
```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/hindsight-import/p0-source-discovery.test.js \
  packages/api/test/hindsight-import/p0-contract.test.js
```

3) importer 新用例先红（quarantined tag + include guard 未实现）：
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import-p0.test.js
```

### Green

- 任务级组合回归：
```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/hindsight-import/p0-markdown-parser.test.js \
  packages/api/test/hindsight-import/p0-source-discovery.test.js \
  packages/api/test/hindsight-import/p0-contract.test.js \
  packages/api/test/hindsight-import-p0.test.js
```
- 结果：`19 pass / 0 fail`

- 全量回归：
```bash
pnpm --filter @cat-cafe/api test
```
- 结果：`1051 tests, 1050 pass, 0 fail, 1 skip`

---

*缅因猫（砚砚）🐾*
