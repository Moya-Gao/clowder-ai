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

### 数据双轨（feat doc Line 93-95 已钉）

- **事件流轨（≥ Phase B 上线时刻 = 2026-06-15 PR #2301 merge）**：直接读 `BallCustodyEventLog` → trajectory projector 投影成 feat 维度
- **历史回填轨（< Phase B 上线时刻）**：stitched 拼接 (feat_index + feature doc Timeline + git log + thread keyword + F192 verdict 流)，每条标 provenance + 置信度，**明示考古拼接而非账本**

### Projector 设计

```ts
interface FeatTrajectoryEntry {
  featId: string;          // F192 / F229 / ...
  at: number;
  kind: 'launched' | 'phase_transition' | 'pr_merged' | 'verdict' | 'thread_split' | 'thread_merge' | 'closed' | 'reopened' | 'historical_stitched';
  source: 'event-stream' | 'historical-stitched';
  provenance?: {
    confidence: 'high' | 'medium' | 'low';
    derivedFrom: string[];  // ['feat_index', 'git log', 'thread:thread_xxx']
    note?: string;
  };
  payload: Record<string, unknown>;
}
```

`FeatTrajectoryProjector` 从 ball-custody event stream + feat 元数据 join 投影。historical stitch 是一次性脚本（不进 projector，避免双写），跑完落 `FeatTrajectoryStore` 同一 key space，read 时同读双源。

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
| C2a | `FeatTrajectoryProjector` + Store + 读 ball-custody event → feat 维度投影 | AC-C2 数据层 | 1 PR |
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

---

## §M Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F233-ball-custody-observability.md` | F233 主真相源 |
| **Plan** | `docs/plans/2026-06-12-f233-phase-a-duty-briefing.md` | Phase A 历史 |
| **Plan** | `docs/plans/2026-06-14-f233-phase-b-ball-custody-event-stream.md` | Phase B 历史 |
| **Lessons** | `docs/lessons-learned.md` LL-082 | dirty-diff ledger 硬层（Phase B PR #2392 lineage）|
