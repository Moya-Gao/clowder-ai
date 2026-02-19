# R18 确认: Cloud Round9 修复 (2×P1) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

## 逐项审查

### P1-A: migrate CLI `--from` 路径不校验存在性

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/migrate-signals/cli.ts` L134-145, L167 |
| 根因 | `--from` 只做了 required 检查（R16 修的），但没验证路径是否真实存在 → 传入不存在目录会在后续 readFile 时报错，信息不直观 |
| 修复方式 | 新增 `assertLegacyRootDir(legacyRoot)`：`stat()` + `isDirectory()` 双重校验，不存在或非目录时 throw 明确错误 |
| 错误传播 | 异常冒泡到 L264 catch，打印 `[signals] migration failed: legacy root not found: ...` + exit 1 |
| 测试覆盖 | `signal-migrate-script.test.js` 新增 "fails fast when --from path does not exist"：验证 exit=1 + 错误信息匹配 `/legacy root not found/i` |
| 判定 | ✅ 通过 |

### P1-B: target sources.yaml 非法时静默回退默认配置

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/migrate-signals/source-migration.ts` L53-72 |
| 根因 | `loadBaseConfig` 原先在 YAML 解析或 Zod 校验失败时回退 `DEFAULT_SIGNAL_SOURCES`，静默覆盖已有配置 |
| 修复方式 | YAML 解析失败 → throw（L62）；Zod 校验失败 → throw 含详细 issue path 的错误信息（L67-68） |
| 正常空文件逻辑 | 空/null raw text 仍返回 DEFAULT（L54-56），这是正确的（首次安装无配置文件） |
| `readTargetSourceConfig` | 文件不存在 → DEFAULT（L75-76，正确）；文件存在 → `loadBaseConfig` 强校验 |
| 测试覆盖 | `signal-source-migration.test.js` 新增 "throws when existing target sources.yaml is invalid"：非法 tier=9 → 匹配 `/invalid signal sources config/i` |
| 判定 | ✅ 通过 |

## 构建 & 测试

```bash
# Build
pnpm --filter @cat-cafe/shared build  # ✅ clean
pnpm --filter @cat-cafe/api build     # ✅ clean

# Signal tests regression (6 suites)
node --test test/signal-migrate-script.test.js \
  test/signal-source-migration.test.js \
  test/signal-source-processor.test.js \
  test/signal-fetch-scheduler.test.js \
  test/signals-route.test.js \
  test/signals-shared-contract.test.js
# 35 passed, 0 failed ✅
```

## Git SHA

- Base: `35e0557` (R17 confirmation)
- Head: `7d6df57` (R18 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R18 by 布偶猫🐾 — 2026-02-20*
