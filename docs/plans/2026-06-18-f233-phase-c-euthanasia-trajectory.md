# F233 Phase C Implementation Plan — 安乐死 + feat 轨迹 + 单账本验证

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Phase:** C（原 spec 末段；Phase D 候选 = OQ-7 全景渲染，见 §H，**不阻塞 Phase C**）
**Goal:** 在 Phase B `BallCustodyEventLog` 之上落地 (1) 安乐死通道（AC-C1）—— 球可被显式杀（CVO 或 owner 发"球.冷冻 / 降级 / 放弃"事件），简报僵尸球区随之消项；(2) feat 轨迹视图（AC-C2）—— 任选 ≥3 Phase feat 生成纵切叙事，回答"它怎么走到今天 + 现在啥情况"；(3) 单账本验证（AC-C3）—— Phase B 上线后产生的球权事件，简报与轨迹读同一事件流，历史回填带 stitched provenance 标注。
**Acceptance Criteria（逐条抄自 feat doc）:**
- **AC-C1**: 球可显式冷冻 / 降级 / 放弃且留 why，操作记入事件流；简报僵尸球区随之消项。
- **AC-C2**: 任选一个 ≥3 Phase 的 feat（如 F192）生成轨迹视图，铲屎官读后能回答"它怎么走到今天 + 现在啥情况"（验收人=铲屎官）。
- **AC-C3**: Phase B 上线后产生的球权事件，简报与轨迹读同一事件流（代码 review 复核该时间段数据路径唯一无双写）；历史回填条目带 stitched provenance 标注（抽查 ≥3 条可见标注）。
**Architecture cell:** `ball-custody`（复用 Phase B；Phase C 仅在事件流加 3 个 kind + 新建一个轨迹 read model，cell 内扩展）
**Map delta:** none（Phase B 已 create `ball-custody` cell）
**Tech Stack:** TypeScript / Redis (ioredis) / Fastify / Vitest（同 Phase B）
**前端验证:** Yes（AC-C2 轨迹视图需要 frontend surface；简报已有，Phase C 加下钻）

> **Acting owner note**: skeleton 由 **opus-47** 起草（Phase B 整体收口愿景守护承接 + OQ closure 整理）。F233 doc Line 11 standing 指 owner=**opus-48**（CVO 2026-06-15 指示）。skeleton 是 starting point，opus-48 上线接 packet 后 iterate detail / request Design Gate / 写 Tasks。若 opus-48 长期不在线，CVO 明确指定 acting plan owner。

---

## Phase B 接续 baseline（不重复，只列 Phase C 依赖）

Phase B 完整落地 13/13 球权事件（`ball.handed/handed_cvo/void_pass/held/hold_expired/wake_sent` + `invocation.started/heartbeat/died` + `task.blocked/unblocked/done/idle_long`）+ `BallCustodyEventLog`（Lua 幂等 append）+ `BallCustodyProjector`（零外部副作用，rebuild 安全）+ `BallCustodyProjectionStore` + projection-backed 简报切源。**Phase C 在此基础上扩展，不动 Phase B schema 与 invariants**。

---

## Straight-Line Check（A→B，不绕路）

**Finish line**：CVO 看简报时，能显式给一个球发"安乐死"事件（球.冷冻 / 降级 / 放弃 + 留 why），事件进 `BallCustodyEventLog`，简报投影自然消项；CVO 想看某 feat 的来龙去脉时，能拉出一条纵切轨迹（≥ Phase B 上线后准确，< Phase B 上线前 stitched 回填 + 标 provenance），回答"怎么走到今天 + 现在啥情况"；简报与轨迹双投影同源验证（无双写）。

**NOT building**：① 自动安乐死 / heuristic 杀球（KD-1/KD-4 守住，只有显式言语行为才算）② 双写绕过事件流的 mitigation flag（CVO 2026-06-18「脚手架」拉闸 OQ-3）③ 全景网络渲染（Phase D 候选，§H 不阻塞）④ Phase B 已落地的任何 reshape。

---

## §A 安乐死事件 schema（AC-C1 核心）

```ts
// 3 种安乐死 kind，进 BallCustodyEventLog 与 Phase B 事件同源
type EuthanasiaKind =
  | 'ball.frozen'       // 冷冻：暂停推进，可解冻（短期降优先级）
  | 'ball.degraded'     // 降级：明确降优先级，保留可见但弱化
  | 'ball.abandoned';   // 放弃：终态，明确"不做了"

// 状态机转移规格（追加到 §B 转移表）：任何**非** resolved state（new/active/blocked/parked/dead/void/zombie，共 7 个）→ resolved(detail=euthanasia, kind, why, by)
// 已 resolved 的球再发安乐死 = reject（projection 真相源已死）
```

**幂等键**（与 Phase B §F 同模式）：`sourceEventId = euthanasia:{subjectKey}:{kind}:{at}`（**含 kind**，砚砚 cross-family R0 pushback 修正——不含 kind 会让同 ms 三种 kind 互相幂等吞）。同一球同一 kind 同一 ms 的事件，Lua append 幂等去重；跨 ms 或跨 kind 视为独立事件（事件流时间轴诚实 + 同 ms 三 kind 可并存进事件流；projection 因 state-machine 已 resolved → reject，最终只有第一次落 projection，但事件流诚实保留"曾试图"痕迹 §C 轨迹用）。

**state machine transition**（Phase B §B 转移表追加 3 行 + 1 行）：

| event | from states | → to | 备注 |
|---|---|---|---|
| `ball.frozen` | new/active/blocked/parked/dead/void/zombie | resolved | detail=euthanasia kind=frozen + why；含 `new` per 砚砚 R0 pushback（与 shared type 注释 + handoff 一致） |
| `ball.degraded` | new/active/blocked/parked/dead/void/zombie | resolved | detail=euthanasia kind=degraded + why |
| `ball.abandoned` | new/active/blocked/parked/dead/void/zombie | resolved | detail=euthanasia kind=abandoned + why |
| any euthanasia | resolved → resolved | reject + lastRejectedEvent | 已 resolved 不重写（事件时间轴诚实）|

---

## §B 入口（OQ-C-1 待 Design Gate）

候选入口（不互斥）：

1. **MCP 工具** `cat_cafe_ball_euthanize(subjectKey, kind, why)` — 猫程式发起，CVO 在 hub 也能调用
2. **task action button** — task list / 简报卡条目带 inline action（"杀"按钮 → confirm dialog 输入 why → emit event）
3. **简报卡直接交互** — 简报 rich block 条目右侧 action menu（"冷冻 / 降级 / 放弃" + why 输入）

**KD-6 约束**（Phase A "卡面交互诚实原则"）：凡出现在简报卡上的控件必须当期真实可用 — 简报卡交互需要 backend 入口已就绪才上线。Phase C 推荐**先落 MCP 工具**（最干净 + KD-1 言语行为本位）→ 再上 task button → 简报卡 inline action 最后（看实测频次）。

---

## §C feat 轨迹 read model（AC-C2 核心）

### 数据三轨（feat doc Line 93-95 + OQ-8 收敛 2026-06-19，F188 提包球 case 实证驱动）

- **事件流轨（≥ Phase B 上线时刻 = 2026-06-15 PR #2301 merge）**：直接读 `BallCustodyEventLog` → trajectory projector 投影成 feat 维度（ball-shaped kinds：`launched` / `phase_transition` / `verdict` / `thread_split` 等）
- **历史回填轨（< Phase B 上线时刻）**：stitched 拼接 (feat_index + feature doc Timeline + git log + thread keyword + F192 verdict 流)，每条标 provenance + 置信度，**明示考古拼接而非账本**
- **git ref 轨（OQ-8 收敛锁定 — F188 Phase K 提包球 case 实证驱动）**：server-side cron census 扫 remote `fix/*` / `feat/*` refs + GitHub PR API map → trajectory projector 投影成 **git-shaped kinds**（`branch_pushed` / `pr_opened` / `branch_merged_to_main` / `branch_stale_unmerged`），含 branch existence / PR existence / HEAD commit timestamp / merge-to-main status / author provenance + **feat/thread join fields**（砚砚 C2a preflight P2-1 修正：缺 join 字段 fixture 只能证"有 stale branch"不能证"是 F188 的提包球"）。**不**走 client-side post-push hook（KD-2 单账本 + server-side cron 模式与 Phase B ProbeScheduler 一致）。git-shaped 命名与 ball-custody event 命名**显式解耦**（OQ-8 锁定，P3 修正：`pr_merged_via_git` → `branch_merged_to_main`，避免混合 naming——它是 git ref state 不是 PR 事件；`pr_opened` 保留因为来源真是 GitHub PR map）：reader-facing 文档可称「提包球」隐喻，schema 层面是 git ref state 投影非球权事件。F188 Phase K case 作 C2a regression fixture：projector 必须能把"已 push、无 PR、最后 commit 时间晚于最后 thread/message 痕迹"的状态 surface 出来（`branch_stale_unmerged` event with 完整 provenance + feat/thread join 字段 prove "this is F188 的提包球"）。

### Projector 设计

```ts
interface FeatTrajectoryEntry {
  featId: string;          // F192 / F229 / ...
  at: number;
  kind:
    // ball-custody event 投影（ball-shaped）
    | 'launched' | 'phase_transition' | 'pr_merged' | 'verdict' | 'thread_split' | 'thread_merge' | 'closed' | 'reopened'
    // historical stitched 回填（< Phase B 上线时刻）
    | 'historical_stitched'
    // git ref snapshot（OQ-8 收敛 + F188 regression fixture，git-shaped 显式解耦 + 砚砚 P3 修正）
    | 'branch_pushed' | 'pr_opened' | 'branch_merged_to_main' | 'branch_stale_unmerged';
  source: 'event-stream' | 'historical-stitched' | 'git-ref-snapshot';
  provenance?: {
    confidence: 'high' | 'medium' | 'low';
    derivedFrom: string[];  // ['feat_index', 'git log', 'thread:thread_xxx', 'git_ref:fix/f188-phase-k', 'gh_pr:#NNNN']
    note?: string;
  };
  payload: Record<string, unknown>;
}
```

`FeatTrajectoryProjector` 从 **ball-custody event stream + git ref snapshot + GitHub PR map + feat 元数据** 三源 join 投影。各源 contract：
- **event-stream source contract**：`subjectKey` 匹配 feat thread / task，时间窗 ≥ 2026-06-15
- **git-ref-snapshot source contract**（OQ-8 锁定 + 砚砚 P2-1 修正补 feat/thread join 字段 + 砚砚 step 3.6/4 护栏补真实 PR timestamps + entry.at per-kind contract）：
  - **git 层最少字段**：`{ branchName, headCommitSha, headCommitAt, prNumber|null, prState|null, mergedToMain|null, prOpenedAt|null, prMergedAt|null, authorIdentity }`
  - **feat/thread join 字段**（F188 fixture 必须）：`{ featureCandidates: string[], associatedThreadIds: string[], lastThreadMessageAt: number|null, lastThreadActivityAt: number|null }`
  - **join 字段 provenance**：`{ confidence: 'high'|'medium'|'low', joinedVia: ('feat_index'|'commit_message_F#'|'branch_name_F#')[] }`——`featureCandidates` 因 branch 命名 `fix/f188-*` / commit message `F188:` / feat_index 关联等启发式可能多候选，confidence 反映 join 强度。**Cloud round 3 P2 fix (PR #2439)**：原 `FeatThreadJoinMethod` 含 `'thread_keyword'`，但 collector 实现上 thread search 依赖 already-known featId（不是真 discovery），cloud 持续 flag「branches linked only by thread text are silently dropped」→ 选择 cloud 推荐的 option (2)「drop from supported join methods」，完整移除 `thread_keyword` from type union。Discovery 暂未实现，需要新 IO `ThreadSearch.findByBranchKeyword(branchName)`，超出 C2a scope（step 5+ 或 follow-up F# add back）。当前 thread search 只用于 post-discovery 关联（拿 last activity 时间戳给 F188 invariant 用）
  - **真实 PR timestamps**（砚砚 step 3.6 护栏，避免 collectedAt 伪装真实事件时间污染轨迹）：`prOpenedAt` 必须从 GitHub PR API `created_at` 真实拿；`prMergedAt` 从 `merged_at` 真实拿；API 失败 / PR 不存在 → null → projector skip emit `pr_opened` / `branch_merged_to_main`
  - **`entry.at` per-kind 真实事件时间 contract**（砚砚 step 4 护栏：观测时间不能伪装真实时间）：
    - `branch_pushed.entry.at = headCommitAt`（git commit 真实 push 时间）
    - `pr_opened.entry.at = prOpenedAt`（GitHub PR API `created_at`，null 则不 emit）
    - `branch_merged_to_main.entry.at = prMergedAt`（GitHub PR API `merged_at`，null 或非 mergedToMain 则不 emit；不偷扩成所有 branch merge——future "无 PR 但 branch 已 merge" 走单独 source / kind / DTO field）
    - `branch_stale_unmerged.entry.at = headCommitAt + bucket-threshold-ms`（首次跨阈值时刻，派生但语义清晰；不用 `collectedAt` 伪装）；`payload.detectedAt = collectedAt` 记 cron observation 真实时间
  - **multiCandidatePolicy default `'skip-low-confidence'`**（砚砚 step 2/4 护栏，避免 projector featureCandidates[0] 被误用）：0 candidates → skip / low confidence → skip / multi-candidate (即使 high) → skip / single high|medium confidence → emit。F188 fixture 路径 = single high-confidence (branch_name_F# + commit_message_F# 双证据 OR feat_index anchor)
- **historical stitched source contract**：feat_index entry / git log commit + 关联 thread 锚点 + F192 verdict 流

historical stitch 是一次性脚本（不进 projector，避免双写），跑完落 `FeatTrajectoryStore` 同一 key space；git ref snapshot 走 server-side cron tick（与 ProbeScheduler 同 pattern），落同一 store；read 时同读三源。

### Collector/Projector 分层 + 幂等键（砚砚 C2a preflight P2-2 修正，照 Phase B `sourceEventId` Lua append 幂等模式）

**架构分层**（必须，否则 projector 不纯）：
- **`GitRefSnapshotCollector`**：所有 git/gh IO（`git ls-remote` + GitHub PR REST API + feat_index lookup + thread search join）住在 collector，**不在 projector**。Collector 产 snapshot DTO 喂 projector。
- **`FeatTrajectoryProjector`**：纯函数 / 零 IO / 零副作用（与 Phase B `BallCustodyProjector` 同 pattern）；只消费 snapshot DTO + 写 FeatTrajectoryStore。Rebuild 安全（replay collector outputs → 同结果）。

**git-shaped entry 幂等键 — per-kind stable formula**（cloud P2 fix PR #2439：id derive 自 event identity，不受周围 volatile state 变化重复 emit；砚砚 C2a preflight P2-4：bucket-in-id 保留）：

| Kind | 公式 | Event identity (id stable per) |
|------|------|--------|
| `branch_pushed` | `git-ref:{branchName}:{headCommitSha}:branch_pushed` | (branchName, headCommitSha) — push 事件每 commit 一次 |
| `pr_opened` | `git-ref:{branchName}:pr-{prNumber}:pr_opened` | (branchName, prNumber) — PR 创建只一次 |
| `branch_merged_to_main` | `git-ref:{branchName}:pr-{prNumber}:branch_merged_to_main` | (branchName, prNumber) — PR merge 只一次 |
| `branch_stale_unmerged` | `git-ref:{branchName}:{headCommitSha}:branch_stale_unmerged:{staleBucket}` | (branchName, headCommitSha, staleBucket) — per head per bucket crossing |

**关键不变量**（cloud P2 PR #2439 review FeatTrajectoryProjector.ts:124）：**同一物理事件 → 同一 entry id**。同 push 事件后续 PR open/merge 不产生新 `branch_pushed` entry；同 PR 后续 commit 不产生新 `pr_opened` entry。Volatile fields（prState / mergedToMain）不进 id 公式，只放 payload。

- 同 `gitRefEntryId` 在 store 是 **upsert**（不 append），保持单一条目反映最新 state
- `branch_stale_unmerged.staleBucket ∈ {'24h', '72h', '7d', '30d'}`，由 collector 按 `ageMs = now - headCommitAt` 计算 first-crossed bucket 分配；同 bucket 内多次 tick 共享同一 id（upsert），跨阈值产生**新 segment → 新 entry id → 新轨迹点**（砚砚 P2-4：4 buckets max → 最多 4 个独立轨迹点，叙事完整）
- Cron tick 只在以下条件产生/更新 entry：
  - branch head 变化（新 commit push）→ 新 `headCommitSha` → 新 `branch_pushed` entry id
  - PR state 变化（`open` / `closed` / `merged`）→ 新 entry id
  - merge-to-main status 变化 → 新 entry id
  - `branch_stale_unmerged` 跨 `staleBucket` 阈值（首次进入 24h / 72h / 7d / 30d 桶）→ 新 staleBucket segment → 新 entry id（**4 个 bucket → 最多 4 个独立轨迹点**，叙事完整）
- Cron tick 在 branch 无任何 state 变化时**不产生新 entry**（去重 / 防鞭打）

幂等键设计与 Phase B `BallCustodyEvent.sourceEventId` 同模式（store 层 idempotent insert），rebuild = replay collector outputs 安全。

### Surface（OQ-C-3 待 Design Gate）

候选：① Hub workspace panel（左侧 feat 列表 + 右侧轨迹时间线）② 简报卡 inline 下钻（点 feat → 弹卡 / 跳 thread）③ on-demand rich block（输入 featId 生成轨迹卡）

---

## §D 单账本验证（AC-C3）

**测试矩阵**：
1. 同一 ball-custody event → 简报 projection 与 trajectory projection **同源**（代码 review 复核数据路径唯一）
2. trajectory entry source='event-stream' 的 entry，event_id 必须能回找到 `BallCustodyEventLog` 真实 entry（双投影 trace-back）
3. trajectory entry source='historical-stitched' 必带 provenance + confidence；UI 视觉可区分
4. **抽查 ≥3 条 stitched entry** 出 provenance 标注（验收人=铲屎官）

---

## Tasks（high-level 拆分，待 opus-48 iterate）

| # | Task | AC trace | 估力 |
|---|------|----------|------|
| C1a | 安乐死事件 schema + 3 个 builder + state machine 转移表追加（含 INV-10 全 8 state × 3 event = 24 格 + 已 resolved reject 1 行）+ 测试 | AC-C1 | 1 PR |
| C1b | MCP 工具 `cat_cafe_ball_euthanize` + Hub UI（简报卡 inline action 待 KD-6 实测） | AC-C1 入口 | 1 PR |
| C1c | 简报 projection 处理 resolved 球（消项 / collapse / 隐藏 — OQ-C-4） | AC-C1 出口 | 0.5 PR |
| C2a | `FeatTrajectoryProjector` + Store + 读 **ball-custody event + git ref snapshot + GitHub PR map** → feat 维度投影 + **F188 Phase K case 作 regression fixture**（branch_stale_unmerged with full provenance）；OQ-8 收敛锁定的三源 source-contract 落地 | AC-C2 数据层 | 1 PR |
| C2b | historical stitched 回填脚本（一次性，feat_index + git log + thread 关联 + F192 verdict 拼接 + provenance 标注） | AC-C2 回填 | 1 PR |
| C2c | trajectory surface（OQ-C-3 选定后实现：Hub panel / 简报下钻 / rich block） | AC-C2 frontend | 1-2 PR |
| C3 | 单账本验证测试（双投影同源 + stitched provenance 抽查）+ AC-C3 验收 fixture | AC-C3 | 0.5 PR |

**预估 Phase C 共 6-7 PR**（视 OQ-C-1/3 选 surface 而定）。Phase B 4 PR + 2 follow-up 给的尺寸感参考。

---

## §E Stateful Object Gate — Census（F229 🔴）

| # | 对象 | lifecycle owner | 旁路禁忌 | § |
|---|------|------|------|------|
| 1 | EuthanasiaEvent (extends BallCustodyEvent) | `eventLog.append()` Lua（复用 Phase B）| flush/delete 禁触 `ballcustody:*`（TTL=0 铁律#5）| §A |
| 2 | FeatTrajectoryProjector | `projector.apply()` 零副作用 | 只读消费；rebuild=replay 安全 | §C |
| 3 | FeatTrajectoryStore | projector 写入唯一入口 | stitched 与 event-stream 双源同 key space，source 字段区分 | §C |
| 4 | historical stitcher | 一次性脚本（不进 projector，避免双写）| 标 provenance flag + confidence | §C |

---

## §F Key Decisions

| KD | Decision | Rationale | Date |
|----|----------|-----------|------|
| **KD-C1** | 不提前 Phase A 安乐死 mitigation | CVO 6-18「脚手架」拉闸；双写绕过事件流违反 P4 单账本；Phase A 短期靠"异常优先+晾龄折叠"兜底 | 2026-06-18 |
| **KD-C2** | 安乐死 = 3 个独立 kind（frozen/degraded/abandoned），非单 kind+severity 字段 | 语义 clarity + state machine pattern match 直接 + 简报 collapsing 策略 per-kind 可调 | 2026-06-18 |
| **KD-C3** | OQ-7 全景渲染 = F233 Phase D 候选（不另立 feat） | CVO 6-18："可能是新的 phase 但是不是新的 feat"；数据共用 Phase B event stream，同 lineage 不另起 | 2026-06-18 |
| **KD-C4** | Phase D 视觉分工：烁烁概念 → 砚砚生成图片（不走 antig-opus 3D demo）| CVO 6-18 口径调整；砚砚 image-generation skill 直出 PNG/SVG，烁烁 Tier 1 审美/style 判断 | 2026-06-18 |
| **KD-C5** | 历史 stitched 是一次性脚本，不进 projector | rebuild 不重跑 stitch（projector 零副作用 INV-2），provenance 标注无歧义 | 2026-06-18 |
| **KD-C6** | **协作模式**：opus-47 acting plan owner + 主 implementation；**砚砚（缅因猫 GPT-5.5）co-collaborator + cross-family reviewer + 必要时讨论伙伴**（CVO 22:37 明确口径"你直接和砚砚一起完成"+"有需要讨论喊他"）。讨论触发：①架构决策点 ②Design Gate（OQ-C-1/3/4 UI/UX）③ Red→Green 卡死 ④代码 review。opus-47 自决不需 ping 砚砚的：单 PR scope 内 mechanical TDD / state machine 表追加 / 测试加固 / 不引入新决策点的实现 | 2026-06-18 |

---

## §G Open Questions

| OQ-C | Question | Status |
|------|----------|--------|
| OQ-C-1 | 安乐死入口形态：MCP 工具 / task button / 简报卡 inline action / 混合 | ⬜ Design Gate |
| OQ-C-2 | historical stitched 算法（heuristic confidence score 公式 / 多源冲突仲裁规则） | ⬜ Phase C plan iterate |
| OQ-C-3 | trajectory surface：Hub panel / 简报下钻 / on-demand rich block / 混合 | ⬜ Design Gate |
| OQ-C-4 | 简报 resolved 桶：collapsed vs 隐藏 vs 单独 "已安乐死" 计数行 | ⬜ Design Gate |
| OQ-C-5 | Phase D（OQ-7 全景渲染）触发时机：Phase C close 串行 vs 并行 | ⬜ Phase C close 后决 |

---

## §H Phase D 候选（OQ-7 全景渲染）— 不阻塞 Phase C

**形态边界**（doc OQ-7 已 CVO 拍板）：
- **定位**：传播资产，不是运维仪表
- **数据**：复用 Phase B `BallCustodyEventLog` 投影，零额外埋点
- **视觉**：暗色霓虹 + edge=真实球权传递 + node=thread/cat；点开 node = thread 历史 + 球权时间线
- **分工**：烁烁（暹罗猫，Tier 1 审美 / style 判断 / 禁码）出概念稿 → 砚砚（缅因猫 GPT-5.5，image-generation skill）生成图片 → 出实现 spec → 交开发猫
- **时机**：Phase C 收口后启动；不阻塞 Phase C 主线

Phase D plan packet 待 Phase C close 后单独起草，不在本 packet 内 iterate。

---

## §I Eval / Tracking Contract

### Primary Users + Activation Signal
- **AC-C1**：CVO（杀球频次 / 简报消项观察）；owner（被动接收 safety death notify）
- **AC-C2**：CVO（feat 轨迹下钻频次 / 时长）；铲屎官（验收时 "走到今天 + 现状" 回答覆盖度）
- **AC-C3**：runtime（双投影 health check）；reviewer（代码 review 数据路径唯一性）

### Friction Metric
- 安乐死复活率 ≥10%（CVO 杀完又改主意 reopen）→ 入口 UX 重审 / 是否需要"撤销" buffer
- trajectory 历史回填假阳率 ≥1/3（provenance 抽查 ≥3 条 fail）→ stitcher 算法调优
- CVO 杀球后 simulator 没人接（下游 owner 不知道）→ 通知通道补完

### Sunset Signal
- Phase C 上线 90 天内 CVO 累计杀球 = 0 → 安乐死是 over-design / 异常优先+晾龄折叠已经够，sunset 通道保留事件 schema（向后兼容）
- trajectory 上线 60 天内 CVO/铲屎官打开次数 = 0 → 轨迹形态错，回 Design Gate

---

## §J Dependencies

- **Evolved from**: Phase B 完整收口（4 PR + 2 follow-up 全 LANDED 2026-06-18）+ OQ-3/OQ-7 CVO 6-18 拍板
- **Blocked by**: 无（Phase B 已落地 + CVO signoff sufficient to start）
- **Related**: F229（state machine 转移表 + INV-10 钉死纪律）；F192（轨迹首样例 = F192 socio-technical harness eval）；F168（feat 轨迹与社区 case 轨迹潜在共享 read model 模式）；F063（trajectory surface 候选 Hub workspace panel）

---

## §K Review Gate

- **Design Gate**：opus-47 / opus-48 起 packet 后请 @gpt52 或 @codex review；UI/UX 决策项（OQ-C-1/3/4）过 CVO 拍板
- **Implementation review**：跨 family（缅因猫家族）；hotfix label 防 self-merge
- **AC-C2 验收**：铲屎官（feat trajectory "走到今天 + 现状" 回答覆盖度）
- **AC-C3 验收**：代码 review 复核数据路径唯一无双写 + stitched provenance 抽查 ≥3 条

---

## §L Timeline（待落 PR 时填）

| 日期 | 事件 |
|------|------|
| 2026-06-18 | Phase C plan skeleton 由 opus-47 acting 起草（Phase B 收口承接 + OQ closure 整理）；packet handoff 给 opus-48 iterate |
| 2026-06-18 | **Owner reassignment**：CVO 16:23 明确"48 出事了 47 直接接手"——opus-48 接 packet 时 tool-call malformed（`<invoke>` 退化）+ propose_session_handoff 也 malformed 未生效。CVO 重指 acting plan owner=opus-47（同布偶猫家族 Opus-4.7，承接 Phase B 收口愿景守护 + OQ closure + packet skeleton 起草连续性）。启动路径定（opus-48 last lucid edit 已写明）：C1a 安乐死 schema backend = 第一棒（纯 backend / 照 Phase B state machine 模式 / 不依赖 UI 决策 OQ-C-1/3/4 或 stitched 算法 OQ-C-2）→ OQ-C-1/3/4 走 Design Gate（C1b 前 CVO 拍板）→ C1b/C2/C3。Plan owner reassignment 不阻塞 implementation，opus-47 自决启动 worktree。 |
| 2026-06-18 | **KD-C6 协作模式 lock**：CVO 22:37 "你直接和砚砚一起完成 Phase C? 有需要讨论喊他?"——opus-47 acting plan owner + 主 implementation / 砚砚（缅因猫 GPT-5.5）co-collaborator + cross-family reviewer + 必要时讨论伙伴。讨论触发：① 架构决策 ② Design Gate（OQ-C-1/3/4） ③ Red→Green 卡死 ④ 代码 review。opus-47 自决 bucket：单 PR scope mechanical TDD / state machine 表追加 / 不引入新决策点的实现。 |
| 2026-06-18 | **C1a 安乐死 schema backend ✅ merged** — PR [#2409](https://github.com/zts212653/cat-cafe/pull/2409) squash merge 到 `main`（merge commit `73af3779a`）。chain SHA 5-step atomic：`a1fe5092e` step 1 shared types → `9f84f7de9` step 1.5 砚砚 R0 fix（sourceEventId 含 kind + plan §A 7 个非 resolved state 修正）→ `45c8a90a1` step 2+3 builders + state-machine → `08f410b29` step 4 tests with 砚砚 R0 regression（cross-kind Set size===3）→ `eadf426db` step 4.5 cloud R1 P2 fix（`BallEuthanasiaKind` 加 shared barrel re-export）。Local reviewer @codex 砚砚 cross-family APPROVE on `08f410b29` 自动 carry forward `eadf426db`（contract-only +2/-1 lines, no behavior change）。Cloud R1 1 真 P2 → R2 0 finding 收口。Tests: state-machine 26/26 + new euthanasia-events 11/11 + check:pre-merge-gate 34/34 + biome + shared/api build clean。砚砚 advisory：C1c projector wiring 时测 `lastRejectedEvent` + event-stream honesty。Next: C1b (MCP tool + Hub UI, OQ-C-1 Design Gate 先决) / C2a (trajectory projector) 自决推进。 |

---

## §M Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F233-ball-custody-observability.md` | F233 主真相源 |
| **Plan** | `docs/plans/2026-06-12-f233-phase-a-duty-briefing.md` | Phase A 历史 |
| **Plan** | `docs/plans/2026-06-14-f233-phase-b-ball-custody-event-stream.md` | Phase B 历史 |
| **Lessons** | `docs/lessons-learned.md` LL-082 | dirty-diff ledger 硬层（Phase B PR #2392 lineage）|
