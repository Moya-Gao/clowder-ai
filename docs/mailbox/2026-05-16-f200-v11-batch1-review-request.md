# Review Request: F200 v1.1 Batch 1 — DF-11 text-match ranking + DF-1 global index mtime

Review-Target-ID: f200-v11-batch1
Branch: feat/f200-v11-batch1

## What

两个 P1 导航正确性修复（三猫 dogfood 共识 Batch 1）：

1. **DF-11**: `GraphQueryResolver.searchCandidates()` 排序只看 `weightedEdgeScore`，导致边多但文本匹配弱的节点排在精确匹配前面。新增 `textMatchScore`（anchor=10, title=6, source/summary/keyword=3, content=1）作为主排序键，`weightedEdgeScore` 降为 tiebreaker。
2. **DF-1**: `GlobalIndexBuilder.rebuild()` 给所有 global:memory/skill/ref 条目打同一个 `new Date()` 时间戳，`RecentBrowseResolver` 按 `updatedAt DESC` 排序时全部 global 条目挤到顶部。改为用 `fs.statSync(filePath).mtime` 取实际文件修改时间。

## Why

砚砚冷启动核心洞察："新猫更信第一屏——老猫被喂偏能靠项目记忆纠偏，新猫不行"。Batch 1 修的是**入口第一屏导航正确性**，直接威胁 F165 Guided Overfitting / F152 Expedition Memory 冷启动愿景。

## Original Requirements

> 三猫两轮真实调查任务实测（Round 1 广度 + Round 2 九路 / 冷启动模拟）。
> **核心洞察（砚砚一句话）**：新猫更信"第一屏"——老猫被喂偏能靠项目记忆纠偏，新猫不行。因此优先级按**入口第一屏导航正确性**排，不按工程难度排。
- 来源：`docs/features/F200-memory-recall-eval.md` lines 283-319（v1.1 Dogfooding Backlog）
- **请对照 DF-1 和 DF-11 的根因描述判断修复是否命中问题**

## Tradeoff

- DF-11: `textMatchScore` 用固定分数而非连续相似度。够用——分级（anchor > title > source/keyword > content）区分度足够，不需要 TF-IDF 级别的精确度。
- DF-1: `statSync` 是同步 IO，但 `rebuild()` 本身已是同步遍历文件系统（`readdirSync` + `readFileSync`），多一个 `statSync` 不改变整体模式。
- 调整了 "omits private candidates" 测试的 assertion 从严格顺序 (`deepEqual`) 改为集合比较 (`sort + deepEqual`)，因为 `textMatchScore` 引入后同 collection 内排序语义变了（anchor match > title match）。

## Architecture Ownership

Architecture cell: memory (F188/F102 memory subsystem)
Map delta: none
Why: 只修改现有 GraphQueryResolver 排序逻辑和 GlobalIndexBuilder timestamp 获取方式，不改变 cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding

## Open Questions

### 技术 OQ（给 reviewer）

1. **TEXT_MATCH_SCORES 分值选择**：anchor=10, title=6, source/summary/keyword=3, content=1。设计意图是让 anchor match 不可能被 title match 追平（即使 title match 有很高 edge score）。请判断这个倍率是否合理。
2. **排序稳定性**：当 textMatchScore 和 weightedEdgeScore 都相等时，依赖 V8 的 stable sort 保持插入顺序。这是否足够？

### 价值 OQ（给 CVO）
无

## Next Action

请 review 4 个文件的改动，重点关注：
- `GraphQueryResolver.ts` 的排序逻辑是否正确（text match 优先 + edge score tiebreak）
- `GlobalIndexBuilder.ts` 的 `statSync` 替换是否完整（三个发现方法都改了）
- 测试是否充分覆盖了 bug 场景

## Review Sandbox

纯后端改动，无需启动 dev server。直接 code review 即可。
- Path: `/tmp/cat-cafe-review/f200-v11-batch1/codex`

## 自检证据

### Spec 合规
Quality Gate 通过（见上方报告）。DF-1 和 DF-11 的根因、代码位置、测试覆盖均已验证。

### 测试结果
```
node --test test/memory/graph-query-resolver.test.js test/memory/global-index-builder.test.js
  → 19/19 pass, 0 fail ✅
pnpm lint (tsc --noEmit) → 0 errors ✅
pnpm biome check (4 files) → 0 errors ✅
Artifact hygiene → clean ✅
Hotfix check → false ✅
```

### 如果我判断错了，最可能错在哪
1. `TEXT_MATCH_SCORES` 的分值可能让 edge score 完全失效——边很多但文本匹配差的节点永远排最后，这是否矫枉过正？
2. `statSync` 在某些文件系统上 mtime 精度不同（HFS+ 是秒级，APFS 是纳秒级），是否会导致不同平台行为差异？
3. 修改 "omits private candidates" 测试的顺序断言可能隐藏了真正的 bug（如果排序逻辑有其他问题，set comparison 检测不到）

### 相关文档
- Feature: `docs/features/F200-memory-recall-eval.md`
- Dogfood Backlog: lines 283-319

[宪宪/Opus-46🐾]
