---
feature_ids: [F021]
topics: [cloud, round9, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 Cloud Round9 (2xP1)

### 背景
cloud round9 在 PR #30 (`35e0557`) 新提 2 个 P1：
- P1-A: `migrate-signals --from` 未验证路径存在，错误路径会“成功退出”但无迁移
- P1-B: 目标 `sources.yaml` 非法时静默 fallback 默认配置，存在覆盖风险

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round9-p1p2-migration-validation/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | `--from` 路径不存在时必须 fail-fast | ✅ | 新增 root dir 校验，CLI 返回 1 |
| 2 | 目标配置非法时不得静默 fallback | ✅ | YAML/schema 错误直接抛错 |
| 3 | 两条修复具备 Red→Green 覆盖 | ✅ | 两个新测试先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/scripts/migrate-signals/cli.ts` | 修改 | 增加 `assertLegacyRootDir`，迁移前校验 `legacyRoot` |
| `packages/api/src/scripts/migrate-signals/source-migration.ts` | 修改 | 目标配置解析改为 strict fail-fast（解析/校验失败抛错） |
| `packages/api/test/signal-migrate-script.test.js` | 新增用例 | 覆盖 `--from` 路径不存在应失败 |
| `packages/api/test/signal-source-migration.test.js` | 新增用例 | 覆盖非法目标配置应抛错 |
| `docs/bug-report/f21-cloud-round9-p1p2-migration-validation/bug-report.md` | 新增文档 | round9 bug report 五件套 |

### Git SHA
- Base: `35e0557155f36b3c4d90253ea3dc7f7e91fd57f8`
- Head: （本次修复提交后更新）

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| `--from` 路径未校验 | `packages/api/test/signal-migrate-script.test.js` | FAIL: 退出码为 0 | PASS |
| 目标配置非法静默 fallback | `packages/api/test/signal-source-migration.test.js` | FAIL: 未抛异常 | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-migrate-script.test.js test/signal-source-migration.test.js
# => 12/12 pass

pnpm -r --if-present run build
# => pass
```

### 额外说明
- `pnpm --filter @cat-cafe/api test` 在本地因 Redis 隔离前置条件未满足（要求 `test:redis` 入口）及既有 `system-prompt-builder` 长度断言失败而非绿；这两项与本轮改动无直接耦合。

### 五件套
**What**: 修复 migrate CLI 的 legacy root 假成功问题 + 目标 sources 非法配置静默覆盖风险，并补齐 Red→Green 测试。  
**Why**: 防止“看起来迁移成功但实际无迁移”误导；防止 target 配置损坏时被默认配置无感覆盖。  
**Tradeoff**: P1 只校验 root 目录存在/类型，不扩展到子路径完整性硬约束；P2 采用 fail-fast 而非自动修复。  
**Open Questions**: 是否要在后续加 `--strict-legacy-structure` 开关，要求 `config/sources.yaml` 和 `library/` 必须齐全。  
**Next Action**: 请做 R18 review；若放行，我再 push 并触发下一轮云端 review。
