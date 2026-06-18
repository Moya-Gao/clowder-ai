---
feature_ids: [F242]
related_features: [F102, F200]
topics: [code-graph, convention-graph, design-gate, schema, spike]
doc_kind: design
created: 2026-06-17
---

# F242 Design Gate — Convention Graph Layer 5 项 schema 钉死

> Design Gate 产出（feat-lifecycle）。两轮 brainstorm（砚砚 + opus-48）+ 铲屎官 eval/F200 challenge 后，把要钉死的 5 项接口/schema 落定，再进 writing-plans 拆实现。CVO GO：铲屎官 2026-06-17「开始 Design Gate 钉 5 项 + 起 worktree 干活，遇问题找砚砚」。
>
> **核心原则（两轮 brainstorm 收敛）**：引擎 domain-agnostic + extractor 是 domain plugin；真正沉淀成 skill 的是建图方法论（discovery protocol），不是具体 extractor。错边比漏边危险 → 每条边带 provenance。

## 1. 引擎 artifact schema（domain-agnostic，SQLite）

学 codegraph 的 node:sqlite 底座（轻/快/零依赖，报告 §18.3），但加 **provenance + scope key + freshness**（codegraph/GitNexus 都没解好的护城河）。

```sql
-- 节点：约定对象（MCP tool / skill / route / 符号 ...）
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,              -- scope key 的 hash（见 §2 identity）
  domain_id TEXT NOT NULL,          -- 哪个 domain plugin 产的（mcp-tool / skill / workflow-callback）
  kind TEXT NOT NULL,               -- plugin 声明的 node kind
  name TEXT NOT NULL,               -- display name（不作 identity！见 §2）
  scope_key TEXT NOT NULL,          -- repo+package+lang+file+kind+domain 复合 key（消歧核心）
  file_path TEXT, start_line INT, end_line INT,   -- source span
  lang TEXT,
  metadata TEXT                     -- JSON，domain 特定
);
-- 边：约定关联（consumes / registers / references ...）
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, target TEXT NOT NULL,
  kind TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  -- provenance（砚砚 OQ-8：错边比漏边危险，每条边可追源）
  extractor TEXT NOT NULL,          -- 哪个 extractor 产的
  extractor_version TEXT NOT NULL,
  source_file TEXT, source_line INT,-- 这条边从哪个 source span 推出来的
  confidence TEXT,                  -- static | heuristic（学 codegraph provenance:'heuristic'）
  FOREIGN KEY(source) REFERENCES nodes(id), FOREIGN KEY(target) REFERENCES nodes(id)
);
-- 新鲜度（freshness，报告 §17）
CREATE TABLE files (
  path TEXT PRIMARY KEY, content_hash TEXT NOT NULL, indexed_at INT NOT NULL, domain_ids TEXT
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);  -- index_commit, schema_version
-- 漏识别（砚砚 OQ-5 / AC-B2：不静默 0 命中）
CREATE TABLE gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id TEXT, reason TEXT,      -- "检测到 FastAPI 但 route extractor 未覆盖 APIRouter 写法"
  file_path TEXT
);
```

存储路径：`.cat-cafe/convention-graph.sqlite`（砚砚 OQ-6，worktree-local；不碰 Redis 6399，不写 memory graph）。

## 2. domain plugin 接口（砚砚收敛钉子）

```typescript
interface ConventionDomainPlugin {
  domainId: string;                    // "mcp-tool" | "skill-manifest" | "workflow-callback"
  nodeKinds: readonly string[];        // e.g. ["mcp_tool", "tool_consumer"]
  edgeKinds: readonly string[];        // e.g. ["consumes", "registers"]
  // scope identity：禁止只靠 display name（砚砚 OQ-2 解 codegraph AuthProvider 跨域混淆）
  scopeKey(node: RawNode): string;     // repo + package + lang + file + kind + domainId
  extractorInputs: ExtractorInput;     // glob / AST 需求（哪些文件、要不要 TS compiler）
  invalidationScope(changedFile: string): boolean;  // 改这个文件要不要重抽本 domain
  negativeFixtures: NegativeFixture[]; // 同名跨域不误连的对抗测试（hard 门禁）
  extract(ctx: ExtractCtx): { nodes: Node[]; edges: EdgeWithProvenance[]; gaps: Gap[] };
}
```

**铁律**：跨 domain 边必须来自**显式约定锚点**（tool name / callback id / skill name）或 typed import，**禁止 name-only 跨语言合并**（砚砚 OQ-2）。引擎不认 plugin 没声明 provenance 的边。

## 3. cat-cafe 三类 extractor（首批 domain plugin，dogfood domain 非方法论本体）

| domainId | 抽取源 | nodes | edges |
|---|---|---|---|
| `mcp-tool` | `packages/mcp-server/src/server-toolsets.ts`、`tools/*.ts` | tool name + schema + readonly/write 权限面 | `consumes`（谁调用 tool）、`registers`（callback route 注册）|
| `skill-manifest` | `cat-cafe-skills/*/SKILL.md` | name + Use when + Not for + triggers + 引用 SOP/refs | `triggers`（skill→skill 唤醒链）、`references`（skill→ref doc）|
| `workflow-callback` | `tools/callback-tools.ts`、`packages/api/src/routes/*callback*.ts` | callback/invocation token + route + consumer | `routes-to`（token→handler）、`consumed-by` |

dogfood 首场景（AC-A5）：改 `cat_cafe_post_message` schema → `code_consumers` 列全部消费方（含 grep 漏的 callback 注册 / dynamic dispatch），对比 grep。

## 4. discovery protocol skill 骨架（方法论本体）

这才是"画约定图"沉淀成 skill 的核心（不是上面 3 个 extractor）：

```
when: 猫进一个（陌生）repo，第一步要建该 repo 的约定图
how:
  1. 扫 repo（配置/入口/依赖/目录/README）→ candidate convention map + unknowns
     （GitNexus community 聚类可在此做候选边界提示，离线辅助、不进 authoritative edge）
  2. 对每个 candidate domain：写/复用 ConventionDomainPlugin（§2 接口）
  3. 接引擎（§1）跑 extract → 出带 provenance/freshness 的图
  4. 漏识别显式报 gap（gaps 表，AC-B2），禁止静默 0 命中
output: .cat-cafe/convention-graph.sqlite + 查询工具（code_consumers / code_impact / code_context）
```

Phase B 验证：带此 skill 进 deer-flow，复用引擎 + 写 FastAPI route extractor，对比 codegraph 的 route 0/105。

## 5. Architecture cell

```
Architecture cell: code-intelligence（NEW cell）
  └─ convention-graph（首个子域，本 spike）
Map delta: new cell required
边界（非目标）：不替代 LSP / 不并入 memory graph（KD-1）/ 不接管 skills / 不写 CLAUDE.md
            只提供 code/convention evidence
```

## 6. Design Gate 门禁自检

- **架构归属**：new cell `code-intelligence`，map delta = new cell required ✅
- **Eval Contract（F192）**：spec 已含 4 项 + 对齐 F200 行为闭环（KD-3）✅
- **软+硬+eval 三层（ADR-031）**：spec 已含（Soft=skill+L0 §8 / Hard=extractor test+negative fixture+provenance snapshot / Eval=fixture+F200 闭环）✅
- **元审美**：引擎/extractor 分层 = 坐标变换（domain 正交化），不是堆 extractor 补丁 ✅
- **现场可感知性**：查询结果自带 provenance + freshness banner（错边可追、stale 必标）✅

## 7. 下一步：writing-plans

5 项钉死，进 writing-plans 拆 Phase A 实现任务（TDD）：① 引擎 schema + DB 层 → ② plugin 接口 + 1 个 extractor（mcp-tool 先行）→ ③ 查询工具 code_consumers → ④ negative fixture + provenance + freshness → ⑤ 第 2/3 extractor → ⑥ discovery skill 骨架。然后起 spike worktree 实现。

---

*Design Gate by opus-48（宪宪），两轮 brainstorm（砚砚 + opus-48）+ 铲屎官 eval/F200 challenge 收敛。[宪宪/Opus-4.8🐾]*
