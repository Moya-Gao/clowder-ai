---
feature_ids: []
topics: [ground, teammate, roster]
doc_kind: mailbox
created: 2026-02-25
---

## Review 请求: F-Ground-3 队友名册动态注入

### 背景

铲屎官 2026-02-25 发现：猫的 system prompt 里只提到 3 只猫（布偶/缅因/暹罗），但实际注册了 7 只（含 variants）。猫不知道找谁、怎么 @，导致路由失败（如 opus 写 `@布偶猫4.5` 这个不存在的 mention）。

本 feat 在 cat-config.json 每只猫（含 variant）上新增 `teamStrengths` + `caution` 字段，SystemPromptBuilder 从 config 动态生成"队友名册"表格注入 static identity prompt。

### 设计文档

- Spec: `docs/discussions/agent-swarm-feats.md` → F-Ground-3 section
- 关联: F32 Agent Plugin Architecture（cat-config.json 作为唯一配置源）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | cat-config.json schema 扩展 | ✅ | `teamStrengths` + `caution` 字段，variant→breed fallback |
| 2 | SystemPromptBuilder 动态渲染队友名册 | ✅ | `buildTeammateRoster()` 函数 |
| 3 | 名册从 getAllConfigs() 动态生成 | ✅ | 新 variant 重启后自动出现 |
| 4 | 名册包含 @mention + 擅长 + 注意 | ✅ | 四列 markdown 表格 |
| 5 | 名册排除自身 | ✅ | filter by catId |
| 6 | 猫能正确 @ 同族 variant | ✅ | 复用 pickVariantMention() |
| 7 | size guard 测试更新 | ✅ | 阈值提到 2000 |
| 8 | WORKFLOW_TRIGGERS 改造 | ⏭️ | spec 标注"可选"，暂跳过 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cat-config.json` | 修改 | 3 breed + 3 variant 新增 teamStrengths/caution 数据 |
| `packages/shared/src/types/cat.ts` | 修改 | CatConfig 新增 teamStrengths/caution 字段 |
| `packages/shared/src/types/cat-breed.ts` | 修改 | CatVariant + CatBreed 新增 teamStrengths/caution 字段 |
| `packages/api/src/config/cat-config-loader.ts` | 修改 | Zod schema + toAllCatConfigs() fallback |
| `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 修改 | 新增 buildTeammateRoster() + 注入 buildStaticIdentity() |
| `packages/api/test/system-prompt-builder.test.js` | 修改 | size guard 更新 + 4 新测试 |

### Git SHA

- Base: `7d1329f` (origin/main)
- Head: `4505f21`
- Branch: `feat/f-ground-3-teammate-roster`

### 测试状态

```
system-prompt-builder.test.js: 33 passed, 0 failed
cat-config-loader.test.js: 54 passed, 0 failed
全量非 Redis 测试: 1915 passed, 0 failed
```

### Review 重点

1. **字段命名**: 用 `teamStrengths` 而非 spec 示例的 `strengths`，因为 variant 已有 `strengths: string[]`（技能标签数组），同名会冲突。这个命名合理吗？
2. **size guard 阈值**: 从 1400 提到 2000，7 猫全量 runtime prompt 约 1825 chars。随着猫数量增加，这个阈值是否需要更灵活的策略？
3. **buildTeammateRoster() 的表格渲染逻辑**: label 拼接规则（variantLabel > nickname > displayName）是否清晰？

### 五件套

**What**: cat-config.json 新增 teamStrengths/caution 字段，SystemPromptBuilder 动态渲染"队友名册"表格
**Why**: 猫不知道 7 只猫的分工和 @mention，导致协作路由失败
**Tradeoff**: 放弃方案 B（硬编码名册）——cat-config.json 驱动与 F32 架构一致，铲屎官改 config 即可调整
**Open Questions**: WORKFLOW_TRIGGERS 仍然硬编码 breed 名（标注可选，暂跳过）
**Next Action**: 请 review 上述 6 个文件

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过
- [x] 五件套完整
