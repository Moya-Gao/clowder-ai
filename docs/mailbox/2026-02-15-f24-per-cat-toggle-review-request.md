## Review 请求: F24 Per-cat Session Chain Feature Toggle

### 背景

Gemini 的 token 统计不准确（`totalTokens` 回退值是累计值，不是 context 填充量），导致 fillRatio 算出 147.6%（物理不可能），F24 seal 被误触发。需要 per-cat 开关让铲屎官可以对 token 统计不准的猫关闭 F24 session chain 功能。

详见 bug report: `docs/bug-report/2026-02-15-f24-gemini-seal-misfire/bug-report.md`

### 设计文档

- Bug Report: `docs/bug-report/2026-02-15-f24-gemini-seal-misfire/bug-report.md`
- 现有 F24 设计: PR #1 中的 Phase B-E 实现

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | CatFeatures 类型定义 | ✅ | `shared/types/cat-breed.ts` — `CatFeatures.sessionChain?: boolean` |
| 2 | cat-config.json gemini 关闭 | ✅ | `features: { sessionChain: false }` |
| 3 | Zod schema 验证 | ✅ | `catFeaturesSchema` in `cat-config-loader.ts` |
| 4 | isSessionChainEnabled 工具函数 | ✅ | 默认 true，仅显式 false 时关闭 |
| 5 | invoke-single-cat 6 处 guard | ✅ | read-side/session_init/sessionSeq/health/seal/transcript |
| 6 | route-strategies 2 处 guard | ✅ | serial bootstrap + parallel bootstrap |
| 7 | 测试覆盖 | ✅ | 6 config tests + 2 invoke behavior tests |
| 8 | 向后兼容 | ✅ | 无 features 字段 = 全部启用 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/cat-breed.ts` | 修改 | 添加 `CatFeatures` 接口 + `CatBreed.features` 字段 |
| `packages/shared/src/types/index.ts` | 修改 | 导出 `CatFeatures` 类型 |
| `cat-config.json` | 修改 | gemini 添加 `features.sessionChain: false` |
| `packages/api/src/config/cat-config-loader.ts` | 修改 | Zod schema + `isSessionChainEnabled()` + 缓存 |
| `packages/api/src/domains/cats/services/invoke-single-cat.ts` | 修改 | 6 处 F24 guard 加 `sessionChainActive` 检查 |
| `packages/api/src/domains/cats/services/route-strategies.ts` | 修改 | 2 处 bootstrap guard 加 `isSessionChainEnabled()` 检查 |
| `packages/api/test/cat-config-loader.test.js` | 修改 | 6 个 isSessionChainEnabled 测试 |
| `packages/api/test/invoke-single-cat.test.js` | 修改 | 2 个 toggle 行为测试 |

### Git SHA

- Base: `32abd87` (main HEAD)
- Head: `bd2e75c` (feat commit)
- Bug report: `8a39eec`

### 测试状态

```
F24 相关测试: 115 passed, 0 failed
全量非 Redis 测试: 1206 passed, 6 failed (6 个是 pre-existing)
```

### Review 重点

1. **`isSessionChainEnabled` 的缓存策略** — 用了模块级 `_cachedConfig` 单例，热更新 cat-config.json 需要重启。是否需要 TTL 或 watcher？
2. **6 处 guard 是否遗漏** — `invoke-single-cat.ts` 中所有 `deps.sessionChainStore` 和 `deps.sessionSealer` 检查前都加了 `sessionChainActive`，但 context_health system_info 消息仍会发给前端（只是不存 SessionRecord 也不触发 seal）。这样前端能看到 context 使用情况但不会误触发 seal，是否合理？
3. **route-strategies 中 bootstrap 跳过** — 对 disabled 猫不注入 bootstrap context，但 `sessionChainStore`/`transcriptWriter`/`transcriptReader` 仍被注入到 `invocationDeps`。这些依赖对 disabled 猫是无害空间开销，还是应该也跳过注入？

### 五件套

**What**: 8 个文件改动，为 F24 session chain 添加 per-cat feature toggle，gemini 默认关闭
**Why**: Gemini token 统计不准（`source: 'approx'`，fillRatio 可达 147.6%），误触发 seal 导致 session 被封存但新 session 可能未正常工作
**Tradeoff**: 放弃了"根治 Gemini token 统计"方案（需 Gemini CLI 支持精确 token 返回，不在我们控制范围内），选择了降级开关作为快速止血
**Open Questions**: `source === 'approx'` 时是否还应该做更多限制（如禁止自动 seal 只允许手动 seal）
**Next Action**: 请 review 上述文件

---

*布偶猫/宪宪 2026-02-15*
