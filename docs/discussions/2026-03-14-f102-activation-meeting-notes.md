---
feature_ids: [F102]
topics: [memory, activation, hindsight-removal]
doc_kind: discussion
created: 2026-03-14
---

# F102 记忆系统激活讨论纪要

**Thread ID**: `thread_mmmsovftp3gitjm9` | **日期**: 2026-03-14 | **参与者**: 布偶猫/宪宪 (opus) + 缅因猫/砚砚 (codex)

## 背景

F102 Phase A/B/C 已 merge（141 tests），但记忆系统实际未运行：
- `evidence.sqlite` 从未被创建——索引 0 条数据
- `IndexBuilder.rebuild()` 仅有手动 CLI，启动不自动执行
- `ReflectionService` 是空壳（`async () => ''`）
- `MaterializationService` 从未被调用
- Hindsight 已废弃但代码仍在（~50 files），factory 双轨并存
- 全局知识层 `global_knowledge.sqlite` 不存在

铲屎官指示：Hindsight 去掉，讨论如何把记忆组件跑起来。

## 各方观点

### 布偶猫（宪宪）
- 按优先级排序：拔 Hindsight → bootstrap 数据 → feat-lifecycle 集成 → Reflect 简化 → 全局层后放
- Hindsight 双轨并存让 SQLite 不是真默认，而是 fallback——必须先清
- 启动时 `rebuild()` 足够（项目 <100 docs，sub-second）
- ReflectionService 倾向模板化（top-k evidence 结构化输出），不接 LLM
- 全局知识层依赖 F100，可后续 Phase

### 缅因猫（砚砚）
- 三层拆解策略：runtime（先做）→ config（第二步）→ legacy 资产（第三步）
- MVP 三件事：启动自动 rebuild + search 默认 SQLite + memory status 可观测
- 不建议 file watcher（多 worktree + git checkout 噪声大）
- ReflectionService 改为"显式降级"标记，避免上层误判"有反思结果"
- 全局知识层现在不做——先项目层跑通稳定 1 个迭代
- 量化验收标准：60s 内有数据、canary query、30s 增量 freshness

## 共识（全票）

### 1. Hindsight 清理：三层拆解

| 层 | 范围 | 顺序 |
|----|------|------|
| **Runtime**（先做） | routes 里 Hindsight 分支删除，factory 去掉 `'hindsight'` 类型，HindsightClient/Adapter 删除 | Phase D-1 |
| **Config**（第二步） | `hindsight-runtime-config.ts`、ConfigSnapshot hindsight 段、env-registry 12 个 HINDSIGHT_* 变量、前端 config-viewer hindsight tab | Phase D-1 |
| **Legacy 资产**（第三步） | `docker-compose.hindsight.yml`、`scripts/hindsight/`、P0 import pipeline、相关测试（~26 files） | Phase D-2 |

风险缓解：runtime 先切断 → 确认 SQLite 路径完全接管 → 再删 config → 最后清理资产。避免一次性大爆炸。

### 2. "跑起来"MVP 定义

三件事完成 = 记忆系统"跑起来"：
1. **启动自动 rebuild**：进程启动后执行 `indexBuilder.rebuild()`（带锁防并发），`evidence.sqlite` 自动有数据
2. **search 默认 SQLite**：`search_evidence` MCP 工具命中 SQLite FTS5（不是 grep fallback）
3. **memory status 可观测**：提供 `docs_count` / `last_rebuild_at` / `backend=sqlite` 状态信息

### 3. 自动化索引策略

| 触发源 | 方式 | 优先级 |
|--------|------|--------|
| API 启动 | 全量 `rebuild()`（一次） | P0 |
| feat-lifecycle 钩子 | `incrementalUpdate([changedPath])` | P1 |
| materialization 成功后 | `incrementalUpdate([materializedPath])` | P2 |

**不做**：file watcher（多 worktree + git checkout 噪声大，稳定性差）

### 4. ReflectionService 处理

- 当前空壳改为**显式降级**：返回 `{ status: 'degraded', reason: 'not_configured' }` 而非空字符串
- Phase D 做模板化 reflect（基于 top-k evidence 结构化输出），不接 LLM 编排
- 避免上层误判"有反思结果"（空字符串 vs 明确 degraded）

### 5. 全局知识层

**现在不做**。项目层跑通并稳定 1 个迭代后再开 Phase。接口和规划保留。

### 6. 验收标准（可测量）

| 指标 | 标准 |
|------|------|
| Bootstrap | 启动 60 秒内：`evidence.sqlite` 存在且 `evidence_docs > 0` |
| Canary | 至少 3 条固定 query 稳定返回预期 anchor |
| Freshness | 修改 feature 文档后 30 秒内可检索到新标题/摘要 |
| Fail-open | Embedding load 失败时检索成功率不下降（lexical 保底） |
| 去 Hindsight | 运行链路中无 Hindsight 调用分支、无 Hindsight 运行必需配置 |

## 分歧

无。

## 待决

| # | 问题 | 建议 |
|---|------|------|
| 1 | Hindsight 清理是 F102 Phase D 还是独立 Feature？ | 建议 F102 Phase D（同一个 spec，减少管理开销） |
| 2 | "跑起来"是 Phase D 还是 Phase E？ | 建议同一个 Phase D（Hindsight 清理 + 激活 一起做，逻辑上相互依赖） |
| 3 | Hindsight P0 import 历史数据要不要迁移到 SQLite？ | 建议不迁——docs/*.md 才是真相源，rebuild 会自动索引 |

## 行动项

| # | 行动 | 负责 | 依赖 |
|---|------|------|------|
| 1 | 更新 F102 spec：添加 Phase D（Hindsight 清理 + 激活） | 布偶猫 | 铲屎官确认 |
| 2 | Phase D-1 实施：runtime + config 层 Hindsight 清理 + 启动自动 rebuild | 布偶猫 | 行动 1 |
| 3 | Phase D-2 实施：legacy 资产清理 + feat-lifecycle 集成 | 布偶猫 | 行动 2 |
| 4 | 验收：canary query + freshness + fail-open 测试 | 缅因猫 review | 行动 3 |

## 收敛检查

1. 否决理由 → ADR？没有（无技术方案被否决，都是共识）
2. 踩坑教训 → lessons-learned？没有（是规划讨论，非踩坑）
3. 操作规则 → 指引文件？没有（验收标准在本纪要，实施时再沉淀到 spec）
