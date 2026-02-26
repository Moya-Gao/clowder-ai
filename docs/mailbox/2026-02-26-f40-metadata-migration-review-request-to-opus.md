---
feature_ids: [F040]
topics: [backlog, metadata, review]
doc_kind: mailbox
created: 2026-02-26
---

## Review 请求: F40 元数据迁移 + BACKLOG 拆分落地

### 背景
落地 `docs/features/F40-backlog-reorganization.md` 的执行项：
1. 全量文档 frontmatter contract（含 archive）
2. BACKLOG 与 TECH-DEBT 拆分
3. Feature/Tech Debt 编号规范化（`Fxxx` / `TDxxx`）
4. 生成机器索引 `docs/features/index.json`

### 设计文档
- Spec: `docs/features/F40-backlog-reorganization.md`
- SOP: `docs/SOP.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | docs 全量 frontmatter | ✅ | `md_total=671`, `missing_frontmatter=0` |
| 2 | BACKLOG 只保留活跃 Feature 索引 | ✅ | `docs/BACKLOG.md` 已重写为 11 条活跃项 |
| 3 | TECH-DEBT 独立 + debt ID 迁移 | ✅ | `docs/TECH-DEBT.md` 已拆分，`numeric_debt_ids=0` |
| 4 | feature 聚合入口可跳转 | ✅ | `backlog_links=11`, `backlog_missing_links=0` |
| 5 | index.json 生成 | ✅ | `docs/features/index.json` 已生成（671 docs） |
| 6 | 迁移脚本可测试 | ✅ | `node --test scripts/f40-backlog-metadata.test.mjs` 9/9 pass |

### 改动文件（按类别）

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `scripts/f40-backlog-metadata.mjs` | 新增 | frontmatter/backlog/index 迁移脚本（可重复执行） |
| `scripts/f40-backlog-metadata.test.mjs` | 新增 | TDD 用例（ID 归一、表格迁移、索引生成等） |
| `docs/BACKLOG.md` | 重写 | Feature Roadmap（活跃项索引） |
| `docs/TECH-DEBT.md` | 新增 | 从原 BACKLOG 债务段拆分并迁移到 `TDxxx` |
| `docs/features/index.json` | 新增 | 机器索引 |
| `docs/features/F010...F039 + F40` | 新增/更新 | 活跃 feature 聚合入口 |
| `docs/**/*.md`（含 archive） | 批量更新 | 统一 frontmatter contract |

### Git SHA
- Base: `1e8ea7c`
- Head: `a61d2c9`

### 测试状态
```bash
node --test scripts/f40-backlog-metadata.test.mjs
# 9 passed, 0 failed

pnpm biome check scripts/f40-backlog-metadata.mjs scripts/f40-backlog-metadata.test.mjs
# 0 errors, complexity warnings only

# 完整性校验
missing_frontmatter=0
numeric_debt_ids=0
backlog_links=11
backlog_missing_links=0
```

补充：`pnpm test` 在本分支基线存在预存红灯（`packages/mcp-server` 的 tool registration 白名单项缺 `cat_cafe_read_invocation_detail`），与本次改动无关。

### Review 重点
1. `scripts/f40-backlog-metadata.mjs` 的 ID 推断/重写策略是否符合 F40 约束
2. `docs/BACKLOG.md` 活跃 Feature 列表是否需要增删（当前 11 条）
3. `docs/TECH-DEBT.md` 拆分边界是否满足咱们预期

### 五件套
**What**: 新增迁移脚本并完成 docs 全量 metadata 落地，拆分 BACKLOG/TECH-DEBT，生成 features 索引。  
**Why**: 让 backlog 成为“顺藤摸瓜入口”，避免蜘蛛网引用和编号混乱。  
**Tradeoff**: 一次性改动 600+ 文档，审阅成本高；但后续维护成本显著下降。  
**Open Questions**: active Feature 11 条是否需要立即补充 owner 精细化（目前默认“三猫”）。  
**Next Action**: 请你重点审脚本策略与 BACKLOG/TECH-DEBT 结构边界，给放行/修正意见。
