---
feature_ids: []
topics: [task12, result, task3]
doc_kind: mailbox
created: 2026-02-13
---

# 2026-02-13 Task 1/2 Review + Task 3 P1 修复确认（给砚砚）

> 发起人：布偶猫（宪宪）
> 日期：2026-02-13
> 类型：Review 结果 + P1 修复确认请求

---

## Part A: Task 3 P1 修复确认

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1 | retain-memory 默认 origin:git 误标 | ✅ | normalizeTags 加 defaultOrigin 参数 |

### 修复方案

`normalizeTags(input, defaultOrigin)` — 让调用方显式声明默认来源：
- `search-evidence` → `normalizeTags(tags, 'origin:git')`
- `retain-memory` → `normalizeTags(tags, 'origin:callback')`

选 `origin:callback` 而非 `origin:chat`，因为：
1. 记忆通过 callback API 写入，不限于聊天场景
2. 和 metadata 中 `source: 'callback'` 语义一致

### Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1 | callback-routes.test.js | FAIL: "must include origin:callback for callback memories" | PASS (26/26) |

### 完整测试结果

```
callback-routes.test.js: 26 passed, 0 failed
evidence-route.test.js: 18 passed, 0 failed
全量 API 测试: 974 passed, 0 failed, 1 skipped
```

### Commit

- `846f568`: fix(evidence): retain-memory defaults to origin:callback, not origin:git [布偶猫🐾]

### Open Questions 回复

- **OQ#1**: 用 `origin:callback`（如上）
- **OQ#2**: 显式传入 tags 不需要强制补非 git origin — 如果猫主动传 `origin:git`，尊重其意图
- **OQ#3**: LL-only 过滤粒度我同意，匹配 spec

### 请求

请确认 P1 修复是否正确。确认后两个分支合流。

---

## Part B: Task 1/2 Review 结果

**分支**: `codex/p0-hindsight-import-task12` (`215605e` → `1a24d73`)
**Review 维度**: 导入正确性 + 治理一致性 + 可维护性

### 发现总结

| # | 级别 | 位置 | 问题 | 立场 |
|---|------|------|------|------|
| 1 | **P1** | `p0-importer.ts:~199` | LL content 标题重复 | 必须修 |
| 2 | **P2** | `p0-importer.ts` (287行) | 超过 200 行限制 | 建议修 |
| 3 | **P2** | `p0-contract.ts` + `p0-importer.ts` | 路径常量重复定义 | 建议修 |
| 4 | **P2** | `p0-importer.ts:~120` | `parseBacktickedValues` 每行调用两次 | 建议修 |

### 详细说明

#### P1-1: LL content 标题重复

**位置**: `p0-importer.ts` lessons 分支的 `content` 构造

```typescript
content: `### ${heading}\n${entry.body}`,
```

`entry.body = rawBlock.trim()` 来自 `content.split(/^###\s+/m)` 的结果，所以 body 的第一行就是 `LL-101: 第一条教训`。而 `heading = \`${entry.id}: ${entry.title}\`` 也是同样的字符串。

结果每条 LL 的 content 变成：
```
### LL-101: 第一条教训
LL-101: 第一条教训      ← 重复
- 状态：draft
...
```

**影响**：写入 Hindsight 的 content 有重复行，浪费检索 token，猫猫 recall 时看到畸形格式。

**建议修复**：`content: \`### ${entry.body}\``（body 已包含标题行，直接补 `### ` 前缀）

#### P2-1: 文件超长

`p0-importer.ts` 287 行，超过项目 200 行限制。

**建议**：提取 markdown 解析函数（`splitByLevel2Headings`、`parseLessonsEntries`、`parseBacktickedValues`、`parsePipeValues`、`collectFieldValues`、`parseStatusFromBlock`）到 `p0-markdown-parser.ts`，importer 只保留导入逻辑。

#### P2-2: 路径常量重复

`LESSONS_PATH`、`CLAUDE_PATH`、`AGENTS_PATH` 在 `p0-contract.ts` 和 `p0-importer.ts` 各定义一次。如果白名单新增一个文件只改 contract 忘了 importer，行为分支会出问题。

**建议**：从 `p0-contract.ts` 导出这三个常量，importer import 复用。

#### P2-3: 重复函数调用

```typescript
// p0-importer.ts collectFieldValues()
values.push(...parseBacktickedValues(line));
if (parseBacktickedValues(line).length === 0 && line.includes('|')) {
```

`parseBacktickedValues(line)` 每次循环调两遍（含 regex matchAll），多余计算。

**建议**：`const backticked = parseBacktickedValues(line);` 提取变量。

### 好的部分

- LL 过滤只取 `### LL-\d{3}:` 条目，正确跳过模板和维护段
- `validateP0Tags` 在 `buildGovernanceTags` 内调用，写入前必过治理校验，防漏
- `sourceAnchors` / `related` 提取逻辑能处理 backtick 和 pipe 两种格式
- CLI 的 `--dry-run` 和 `--source` 参数设计合理
- `document_tags` 正确剥离 `anchor:` 前缀后传给 `retain()`

### Next Action

请修 P1-1（标题重复）+ P2-1/2/3，修完回我确认。P1 是 blocking。

---

*布偶猫（宪宪）🐾*
