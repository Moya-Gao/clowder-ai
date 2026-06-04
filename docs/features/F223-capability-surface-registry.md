---
feature_ids: [F223]
related_features: [F038, F041, F131, F150, F192, F203, F211, F212]
topics: [capability-surface, skills, mcp, action-plane, eval, workspace-navigator]
doc_kind: spec
created: 2026-06-03
---

# F223: Capability Surface Registry — 把隐藏能力产品化成可发现、可执行、可验证的能力面

> **Status**: spec | **Owner**: 缅因猫/砚砚 | **Priority**: P1

## Architecture Ownership

Architecture cell: action-plane + harness-eval
Map delta: update required
Why: 本 feature 新增一条横切 registry，把 skill/L0 触发、callback/API/MCP/helper 执行面、audit/probe 验证面、F192 eval 面连成同一个能力治理边界。

## Why

铲屎官 2026-06-03 指出：workspace-navigator 这种能力已经存在，但暴露度不够，猫猫要靠手写 `curl` 和猜端口才能用；这会让“有能力”在真实协作里退化成“想不起来 / 调不好 / 调了但用户看不到”。

这个 feature 的价值不是再补一条 skill，而是建立统一能力面：猫应该先能想起能力，再用稳定的 typed surface 执行，再有可验证的成功信号，最后由 eval 判断这套 harness 是否真的改善行为。

## Current State / 现状基线

- F131 已完成 workspace navigator 的基础管道，但当时把“猫猫自己 `curl POST /api/workspace/navigate`”写成硬实力层。2026-06-03 现场复现显示，这个边界已经不够稳：宪宪调用了 navigate API，Hub 也拉到了文件内容，但铲屎官只看到 Workspace 面板，没有可靠看到目标文档。
- `cat-cafe-skills/refs/capability-wakeup-index.md` 已把 Tier 1 / Tier 2 能力列出来，并把 `workspace-navigator`、`rich-messaging`、`browser-preview` 判为 habit-resistant；但它仍偏“何时想起”，不是完整执行面 registry。
- F192 Phase F `eval:capability-wakeup` 正在衡量猫“该用没用”的 miss rate；它不负责定义每个能力应该通过 MCP、callback route、helper 还是 ActionService 执行。
- 家里已有大量 MCP 工具（例如 `cat_cafe_create_rich_block`、`cat_cafe_generate_document`、`cat_cafe_update_workflow`、`cat_cafe_multi_mention`、`cat_cafe_start_vote`），但部分能力在 skill / L0 / tool description 里的触发条件不够显眼。
- LL-041 已验证过同类问题：workspace-navigator、browser-preview、rich block 等展示能力存在，但猫只在铲屎官明确要求时被动使用，缺少“端上桌”的触发与执行闭环。

## 需求点 Checklist

- [ ] 盘点现有隐藏能力：skills、L0 §8、MCP tools、cat-callable API routes、lessons、feature docs 都要进同一张表。
- [ ] 判断是否已有 feature 能承接；不能强塞到 F192/F203/F131 造成边界混乱。
- [ ] 不让猫手写第一方 API `curl` / JSON / 端口；至少提供 typed helper，用户可见副作用优先 MCP 或 callback wrapper。
- [ ] 区分 skill、MCP、callback route、ActionService、hook/eval 的职责，不做“全都 MCP 化”的机械选择。
- [ ] 分批 phase 与 PR，按能力族合并，避免一能力一 PR 造成 review / merge overhead。

## What

### Phase A: Capability Surface Inventory + Decision Ladder

建立 `Capability Surface Registry` 盘点表，覆盖四层字段：

| 层 | 字段 | 目的 |
|----|------|------|
| Trigger | skill / L0 / ref / guide | 猫什么时候该想到它 |
| Execution | MCP / callback route / helper / ActionService / direct import | 猫怎么稳定执行，不手搓 |
| Verification | audit event / socket ack / file probe / screenshot / generated artifact | 怎么证明真的端到用户面前 |
| Eval | F192 domain / predicate / miss-rate / owner | 后续怎么知道它有没有长期生效 |

Decision Ladder：

1. **Skill only**：只改变认知流程、无副作用、无稳定执行对象。
2. **Typed helper**：本地 shell 编排可稳定执行，但还没证明值得成为 MCP；helper 必须有测试，skill 只调用 helper。
3. **Callback/API wrapper**：需要 Hub runtime 状态、auth、audit、socket 或用户可见副作用。
4. **MCP tool**：跨 runtime/cat 都需要、schema 可以约束输入、猫不应手写 HTTP/JSON、且调用结果需要可审计。
5. **ActionService**：外部系统资源创建/变更、需要权限、dry-run、幂等、resource handle；按 ADR-029 先建 typed service，再决定暴露面。
6. **Hook/JIT/eval**：只在 F192 证明行为 miss 或注意力稀释后加，不预设“提醒越多越好”。

### Phase B: First-Class Display Surfaces

先处理已经实测高摩擦的展示类能力，合成一个 PR，不拆成三个小 PR：

- `workspace-navigator`：新增 typed execution surface（默认候选：`cat_cafe_workspace_open_file` MCP，内部走 canonical navigate service），修 worktreeId canonicalization 与 `open` 强制切 Files view，删除 skill 里的裸 `curl` 主路径。
- `browser-preview`：把 `/api/preview/auto-open` 的猫猫调用路径包装成 typed surface（MCP 或 helper），skill 不再教猫手写 HTTP。
- `rich-messaging`：已有 `cat_cafe_create_rich_block` MCP，不重复造工具；补 trigger、tool description、F192 predicate，使长结构化回复默认走 rich block。

### Phase C: Tier 1 Capability Normalization

对 L0 §8 Tier 1 的 13 条能力逐一归档：

- 已有 MCP 的：补 tool description、skill trigger、usage examples、audit/probe。
- 只有 API route 的：按 Decision Ladder 判断 helper / MCP wrapper / ActionService。
- 只有文档或 skill 的：确认是否真无副作用，还是隐藏了可产品化执行面。
- F192 Phase F 的 normalizer/classifier 超过 5 个 capability 后，避免继续在 normalizer 里 hardcode business rule；按 clean reboot note 做 classifier 解耦。

### Phase D: Guardrail + Eval Feedback Loop

把“不要手写第一方能力调用”变成可检查的 hard layer：

- 新增检查脚本：扫描 `cat-cafe-skills/**/SKILL.md` 和 refs，禁止未豁免的 `curl localhost` / 第一方 API 手写 JSON 主路径。
- 每个 registry 条目必须有 `owner`、`execution_surface`、`verification_probe`、`eval_signal` 四个字段；缺字段不能进入 Tier 1。
- F192 verdict 持续高 miss 的能力才升级 hook/JIT；低 miss 连续 4 周按 F192/F203 规则 demote。

## Eval / Tracking Contract

### 1. Primary Users + Activation Signal

- **Users**: 所有猫（能力调用者）、铲屎官（用户可见结果的接收者）、feature owner（能力维护者）。
- **Activation**: 猫遇到 L0 §8 / skill trigger 场景，应该调用某个家里独有能力。

### 2. Friction Metric

- 触发场景命中但未调用能力的 miss rate。
- 调用了能力但 verification probe 未通过的 false success rate。
- skill 中仍出现未豁免第一方 `curl localhost` 主路径的数量。
- 能力 registry 条目缺 `execution_surface` / `verification_probe` / `eval_signal` 的数量。

### 3. Regression Fixture

- “打开刚写好的文档”场景必须走 workspace typed surface，不手写 navigate API，且 Hub 切到 Files view 并打开目标文件。
- “改完前端看看效果”场景必须走 browser-preview typed surface 或明确说明无法预览的 probe 结果。
- “长结构化汇报”场景必须优先使用 rich block，纯文字 fallback 需要有理由。

### 4. Sunset Signal

- F192 连续 4 周显示某能力 miss rate < 5%，且 registry/probe 无失败，则从 Tier 1 降级到 Tier 2 或只保留 registry。
- 某 typed surface 连续 2 个版本零使用，且没有 capability-wakeup miss，考虑从 MCP 降级为 helper 或文档入口。
- 若模型/运行时原生支持同等能力且可验证，删除本地 wrapper，保留 registry 迁移记录。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。重构/降复杂度类须实测可量（数字下降），不是"提了可测性就算"。详见 feat-lifecycle SKILL.md。 -->

### Phase A（Inventory + Decision Ladder）

- [ ] AC-A1: 产出 capability surface inventory，覆盖来源至少包括 `capability-wakeup-index.md`、`cat-cafe-skills/*/SKILL.md`、`packages/mcp-server/src/tools/*`、cat-callable API routes、LL-041、F131、F192、F203。
- [ ] AC-A2: 每个 inventory 条目都有 `trigger_surface`、`execution_surface`、`verification_probe`、`eval_signal`、`owner`、`recommended_action`。
- [ ] AC-A3: 给出“skill only / helper / callback route / MCP / ActionService / hook”的分类理由，且与 ADR-029 不冲突。
- [ ] AC-A4: 明确哪些需求挂 F192/F203/F131，哪些由 F223 自己承接；不把 eval、L0、单能力 bug 混成一个 owner。

### Phase B（First-Class Display Surfaces）

- [ ] AC-B1: `workspace-navigator` 主路径不再要求猫手写第一方 `curl`；新 typed surface 有单元测试或 MCP handler 测试。
- [ ] AC-B2: workspace open file 修复 worktreeId canonicalization，并在 `action=open` 时确保 Workspace panel 切到 Files view。
- [ ] AC-B3: `browser-preview` 主路径不再要求猫手写 `/api/preview/auto-open`；调用结果有可验证 probe。
- [ ] AC-B4: `rich-messaging` 的 MCP、skill trigger、capability-wakeup predicate 三者口径一致。

### Phase C（Tier 1 Normalization）

- [ ] AC-C1: L0 §8 Tier 1 的 13 条能力全部进入 registry，并完成执行面建议。
- [ ] AC-C2: 已有能力类 MCP（`generate_document`、`update_workflow`、`multi_mention`、`start_vote`、external runtime session、CLI diagnostics）都有可发现 trigger 与简洁调用说明。
- [ ] AC-C3: F192 capability-wakeup normalizer/classifier 不再因新增 >5 个 capability 继续堆 hardcode；必要时完成 classifier 解耦。

### Phase D（Guardrail + Eval Loop）

- [ ] AC-D1: 新增或扩展 `pnpm check:skills` 类检查，阻止未豁免的第一方 raw `curl localhost` 主路径进入 skill。
- [ ] AC-D2: 每个 registry 条目能被 F192 verdict 或手动 probe 追踪到后续行动：fix / build / keep_observe / delete_sunset。
- [ ] AC-D3: PR packaging 遵守批处理策略：优先按能力族合并，不按单个能力拆 PR；只有跨架构边界、风险或 review owner 明显不同才拆。

## Dependencies

- **Evolved from**: F131（workspace-navigator 暴露了“能力存在但执行面脆弱”的具体问题）
- **Related**: F038（skills discovery 早期方向）、F041（Hub 能力看板）、F150（tool/skill/MCP usage statistics）
- **Related**: F192 Phase F（capability-wakeup eval，负责衡量 miss rate，不负责执行面治理）
- **Related**: F203 L0 §8（能力触发反射，负责让猫想起能力）
- **Related**: F211 / F212（external runtime sessions / CLI diagnostics 已是能力类入口，需要进入 registry）

## Risk

| 风险 | 缓解 |
|------|------|
| “全都 MCP 化”导致维护层过重 | Phase A 用 Decision Ladder + ADR-029 分类；MCP 只用于确实跨 runtime、schema 化、用户可见副作用的能力 |
| 只做文档盘点，实际猫还是手写 | Phase D 加 hard check；Phase B 先改最常踩的展示类能力 |
| hook/JIT 太早造成噪音 | 先走 F192 miss-rate 证据，持续高 miss 再升级 forcing function |
| PR 太碎导致 review overhead | 明确按能力族合并，Phase B 三个展示能力同 PR，Phase C Tier 1 normalization 同批推进 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `workspace-navigator` typed surface 最终叫 `cat_cafe_workspace_open_file` 还是归入通用 `cat_cafe_workspace_navigate`？ | 倾向前者，Phase B 定 |
| OQ-2 | registry 真相源放 docs YAML/Markdown，还是生成到代码可消费 JSON？ | Phase A 定；初期可 Markdown+frontmatter，后续需要 check 时生成 JSON |
| OQ-3 | action-plane 是否需要扩展定义覆盖第一方 Hub 动作，还是新增 capability-surface cell？ | Phase A map delta 决定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新建 F223，而不是强挂 F192/F203/F131 | F192 管 eval，F203 管 L0 触发，F131 管单个 workspace 能力；本需求横跨 trigger/execution/verification/eval 四层 | 2026-06-03 |
| KD-2 | Skill 不是执行面，MCP/helper/callback/ActionService 才是执行面 | 防止 skill 继续教猫手写第一方 `curl`，也避免把认知问题误修成 hook | 2026-06-03 |
| KD-3 | 不做“一能力一 PR” | 铲屎官明确要求效率；按能力族合并能减少 review/merge overhead | 2026-06-03 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-03 | 宪宪打开文档现场暴露 workspace-navigator “调了但用户看不到”问题 |
| 2026-06-03 | 砚砚排查社区 issue 与既有 feature，收敛为 capability surface registry |
| 2026-06-03 | F223 立项 |

## Review Gate

- Phase A: 砚砚产出 inventory + decision ladder 后，由 F192/F203 owner 做架构 review。
- Phase B: workspace/browser/rich display surfaces 同 PR；需要跨个体 review，重点查“typed surface 是否真的替代 raw curl”与“probe 是否能证明用户看到了”。
- Phase C/D: 根据 Phase A 分类决定 reviewer；涉及 F192 eval 的部分由 harness-eval owner review。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F131-workspace-navigator.md` | workspace-navigator 原始三层架构 |
| **Feature** | `docs/features/F192-socio-technical-harness-eval.md` | capability-wakeup eval 归属 |
| **Feature** | `docs/features/F203-native-system-prompt-l0.md` | L0 §8 capability wakeup trigger 归属 |
| **Ref** | `cat-cafe-skills/refs/capability-wakeup-index.md` | Tier 1 / Tier 2 能力清单起点 |
| **ADR** | `docs/decisions/029-external-tool-integration-strategy.md` | ActionService / callback / MCP 暴露面分层准则 |
| **Lesson** | `docs/lessons-learned.md#ll-041-写完产物不主动打开--做了菜不端上桌` | 端上桌能力的历史教训 |
