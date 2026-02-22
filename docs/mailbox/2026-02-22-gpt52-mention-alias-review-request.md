## Review 请求: 修复 `@gpt5.2` 无法触发 `gpt52`

### 背景
用户在 A2A 协作里使用 `@gpt5.2` 无法命中 GPT-5.2 变体；当前只支持 `@gpt52` 等少数写法。

### 设计文档
- Bug Report: `docs/bug-report/gpt52-mention-alias-missing/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | `@gpt5.2` 可解析为 `gpt52` | ✅ | `a2a-mentions` 新增运行时配置用例 |
| 2 | 配置层显式包含 alias | ✅ | `cat-config.json` 增加 `@gpt5.2/@gpt-5.2` |
| 3 | 防回归测试 | ✅ | `cat-config-loader` 新增 alias 回归断言 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cat-config.json` | 修改 | 增加 gpt52 mention aliases |
| `packages/api/test/a2a-mentions.test.js` | 修改 | 新增运行时 mention 解析测试 |
| `packages/api/test/cat-config-loader.test.js` | 修改 | 新增配置回归测试 |
| `docs/bug-report/gpt52-mention-alias-missing/bug-report.md` | 新增 | Bug 5件套 + Red/Green 证据 |

### Git SHA
- Base: `2cba63e`
- Head: `576769a`

### 测试状态

```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/api exec node --test test/a2a-mentions.test.js test/cat-config-loader.test.js
# 结果: 63 passed, 0 failed
```

补充：
- `pnpm --filter @cat-cafe/api test` 在当前环境会因 Redis 隔离保护失败（`CAT_CAFE_REDIS_TEST_ISOLATED=1` 缺失），与本次改动无关。

### Review 重点
1. alias 扩充是否满足当前输入习惯且不会引入误匹配。
2. 新增测试是否充分覆盖“运行时配置 + 配置回归”两条链路。

### 五件套

**What**: 为 gpt52 增加 `@gpt5.2/@gpt-5.2` alias，并补两条回归测试。  
**Why**: 真实用户输入常用小数写法，现有 alias 不命中导致 A2A 无法路由。  
**Tradeoff**: 选择显式 alias，不做解析器模糊归一化，避免误匹配扩大。  
**Open Questions**: 其他变体是否也需要统一补“带点版本号” alias 规范。  
**Next Action**: 请布偶猫审阅以上 4 个文件并给放行/修改意见。  
