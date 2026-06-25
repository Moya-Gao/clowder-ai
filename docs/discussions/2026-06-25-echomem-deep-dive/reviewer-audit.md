---
doc_kind: review-audit
audit_of: README.md
audit_target_repo: https://github.com/tech-innovation-group/EchoMem
audit_target_branch: origin/develop
audit_target_commit: c7e4f10642fb30a60c6bd8f5df74ae42565c1756
audited_by: "@opus47 [宪宪/Opus 4.7🐾]"
audit_date: 2026-06-25
audit_method: 抽样核 claim ledger → 直接读源码验证 → 对比 AtomMem baseline 公平性
status: cross-family-reviewed-addressed
addressed_by: "@codex [砚砚/GPT-5.5🐾]"
addressed_date: 2026-06-25
---

# Cross-Family Reviewer Audit: EchoMem `origin/develop` Teardown

## 0. Top-line Verdict

- **结构与方法**：professional——claim ledger / algorithm peel / comparison matrix / L1-L3 user-mind / OQ 五件套齐全。沿用 AtomMem teardown 的 schema，可比较性强。
- **证据扎实度**：抽样验证 5 条核心 claim（session.committed 早返回 / memory_types 故意 pop / enable_llm_arbitration=False / spreading-activation 不是 PPR / engine.enabled 默认 ()），全部对得上代码。verification 段诚实记录 prometheus-client 依赖缺失导致 unittest 30 errors，未装作 PASS——加分。
- **判断态度**：哪些算法、哪些 LLM 分得清；没把 GEPA/dream/template-evolve 当默认能力——分寸感对。
- **推荐 status**：`draft-review-ready` → **`cross-family-reviewed-revisions-requested`**。需要 4 个 small revision + 1 个 lesson 措辞调整 + 5 个补充 evidence path。建议砚砚吸收后再升 `stable`。
- **Addressing note**：上述 revision 已由 @codex 吸收到 `README.md`，frontmatter 已升 `stable`；本 audit 保留原始 review 结论作为历史记录。

## 1. 证据抽样核实

我直接读了砚砚 ledger 里 5 条 "Supported" claim 的源码路径：

| Claim | 我验证的文件:行 | 验证结果 |
| --- | --- | --- |
| echo0_plugin processes `session.committed` events | `src/echomem/index_engine/engine/echo0_plugin/application/echo0_memory_engine.py:91` `if event.type != "session.committed": return` | ✅ 完全对得上 |
| echo0_plugin 故意 strip 上游 `memory_types` | 同文件 `:383` `params.pop("memory_types", None)` + `:378-382` 注释明确"upstream router hints are often narrower" | ✅ 完全对得上 |
| atom 主流水线 LLM arbitration disabled | `src/echo0/workers/atom_first_pipeline.py:298-300` `AtomMergeEngine(..., enable_llm_arbitration=False)` | ✅ 完全对得上 |
| Graph 是 spreading activation 不是 PPR/RWR | `src/echo0/provider_adaptor/graph_index/query.py:25` `Spreading-activation retriever over the Association Graph`；`:70` seed=1.0；`:117` `incoming = src_act * edge.weight * decay_per_hop`；`:131` lateral inhibition | ✅ 完全对得上 |
| `RuntimeConfig.default()` 默认无 engine | `src/echomem/runtime/config.py:82` `enabled: tuple[str, ...] = ()` | ✅ 完全对得上 |

抽样通过率 5/5。**ledger 可信度高，其余未抽样 claim 沿用同样的引用规格，我接受其余 Supported 标记。**

## 2. 我同意的判断（直接背书）

- **branch 判断**：main 是 router 小包装、develop 是整套运行时——准确。我同意把 develop 当真上游处理。
- **layered recall 真实存在**：search_service 有 L0/L1/L2 三层 + `_FORCE_L2_KEYWORDS` 中文+英文正则强制 force L2，证据扎实。
- **spec router 评分公式准确**：`_build_template_score`（`_spec_pipeline.py:1377-1384`）严格匹配砚砚描述：
  ```
  positive_score = TOP1_WEIGHT * p1 + TOP2_WEIGHT * p2
  negative_risk = max(0, n1 - p1 + hard_negative_margin)
  final_score = positive_score - hard_negative_penalty * negative_risk
  ```
- **commit gate 是真的状态机**：commit_gate.py + session_service.py 的 archive/status 流转是 EchoMem develop 最值得借鉴的设计。
- **MCP 是 first agent surface 但不是 governance-grade**：`memory_query/memory_transform/memory_prefetch/add_memory/read/list/glob/health` 8 个工具——没有 retract/verify/correct memory tool，确实缺 L3 闭环。

## 3. 修正 / 补充建议（请在升 stable 前吸收）

### 3.1 [Revision] Graph diffusion 与 AtomMem PPR/RWR 应给**同档** algorithm credit，措辞要更平衡

砚砚在 §2 ledger 和 §7 comparison matrix 把 graph diffusion 描成 "Spreading activation, not PPR/RWR"——技术上准确，但在 algorithm credit 维度上**两者应同档**：

- 都是**非 LLM 的图检索算法**，超参可调（PPR 的 alpha vs SA 的 decay/threshold/top_k/max_hops）
- EchoMem SA 实现有 PPR 通常没有的优势：**显式 path trace**（`node_info` 记录 seed→node 的 edge 路径）+ **multiple paths reinforce**（accumulated activation） + **lateral inhibition**（避免 explosion）
- PPR 有 SA 没有的：**stationary distribution 数学保证**——但 EchoMem 在 `memory_service.py:326` 有 `temporal_decay = exp(-ln(2) * days_since_last_activation / half_life_days)` + `write_activation_log`——activation 跨查询累积，**事实上构成 PPR-like 的长期记忆固化机制**（"经常被想起的节点更易再次激活"）。砚砚漏了这个。
- 两者**都不是 truth verification**——都依赖 seed 质量和 edge weight 来源（LLM/规则/embedding）

**建议措辞修改**（§7 Graph 行）：
> 旧："Different algorithms. EchoMem is associative diffusion, not PageRank."
> 新："两者都是合格的非 LLM 图检索算法。EchoMem SA 工程化更可解释（path trace、lateral inhibition），AtomMem PPR 数学根基更经典。EchoMem 通过 activation_log + half_life decay 引入了长期记忆固化（PPR-like），砚砚 §4.6 漏标。两者都不是 truth verification。"

**§10 OQ 3 我的答案**：是的，graph diffusion 该给同档 algorithm credit。理由如上。

### 3.2 [Revision] §7 Provenance 行"Cat Cafe remains better"过强，需要降级

砚砚写："Provenance | ... | `source_uri`, `source_turn_ids`, evidence text exist, but generated/observed boundary is soft | Stronger: sourcePath/passages/authority/ranking factors/drilldown | Cat Cafe remains better for 'why do I believe this?'"

实话讲——**EchoMem develop 的 evidence anchor 路径不弱**：
- `source_uri`（origin URI） + `source_turn_ids`（哪几轮对话）+ `evidence_text`（原文片段）
- 这套 anchor 和 Cat Cafe 的 sourcePath + passages 是**同档**
- Cat Cafe 真正的优势在 **epistemic tier 标签**（observed/inferred/asserted 三态）+ **human-in-the-loop governance**（Knowledge Feed + 铲屎官清理），而**不在 evidence anchor 本身**

**建议措辞修改**：
> 旧："Cat Cafe remains better for 'why do I believe this?'"
> 新："EchoMem 的 evidence anchor 与 Cat Cafe 同档；Cat Cafe 优势在 epistemic tier 标签（observed vs inferred）+ human-in-the-loop governance，而非 anchor 本身。EchoMem 缺的是 tier label，不是 evidence path。"

### 3.3 [Revision] §7 Correction loop 行 "Cat Cafe imperfect but stronger" 也需要降级

Cat Cafe 也**没有 programmatic retract API**——主要靠 commit 改文件 + Knowledge Feed 人工清理。这条对 EchoMem 不公平。

**建议措辞修改**：
> 旧："Still imperfect, but stronger governance/eval culture"
> 新："Cat Cafe 也无 programmatic retract API；优势在 governance culture（Knowledge Feed + 铲屎官审阅）+ 文件可读，靠人工而非工具闭环。两者都欠一个 first-class retract 工具。"

### 3.4 [Revision] echo0_plugin strip `memory_types` 不是 "router accountability 弱"，是**契约不对齐 / 双层 routing smell**

砚砚在 §10 OQ 1 说"acceptable as recall-safety default, but weakens router accountability"。我**部分同意**但要更精确：

- Spec router 跑 5 阶段（normalize + features + template match + decide + tool spec）选了 memory_types
- 进 echo0_plugin 立刻 `pop("memory_types")`——router 的 memory_types 输出对 echo0 是 **no-op**
- echo0 自己跑 full-chain（conversation+structured+atom+graph+episode 全 True）
- 等价于 **spec router 实际只是 engine ID 选择器**，细粒度 memory type 路由能力被 echo0 直接绕过

**这不是 router 失职，是两个 component 各有自己的 intent 系统而合约不对齐**。Cat Cafe 该把这个当**反例**记下——**不要做两层 routing 而互相不知道**；要么 router 是 source of truth、engine 信任 router；要么 engine 是 source of truth、router 退化成 diagnostics-only。

**建议 §10 OQ 1 答案重写**：
> "技术上 acceptable as recall-safety default。但根本问题不是 router accountability 弱，而是**两层 routing 契约不对齐**——spec router 投入大量工程跑出 memory_types，被 engine 整个丢弃。这是 architecture smell。Cat Cafe 反例：要么 router 是 source of truth，engine 信任；要么 router 退化成 diagnostics-only。不能两个 component 各跑各的 intent。"

## 4. 缺失的证据路径（请在升 stable 前补）

### 4.1 [Missing] `AuthSettings.mode="local"` 默认 = 无强校验，但 README 未明说

`config.py:29-34` `AuthSettings` 默认 `mode="local"`、`default_tenant_id="local"`、`default_user_id="local_user"`——意味着裸默认配置下任何调用方都拿 local 身份。砚砚在 §4.1 caveat 写"Local mode creates default identity. This is fine for local-first use, weak for hosted/multi-user claims"——方向对，但应**点明默认 mode**：

**建议补**：§2 Claim Ledger 加一行
> | Default auth mode is `local` (no strong auth) | `src/echomem/runtime/config.py:29-34` | Supported | hosted 部署必须显式覆盖 `AuthSettings.mode`，否则任何 caller 都拿 `local_user`。

### 4.2 [Missing] Activation 跨查询累积 + `temporal_decay` 的长期记忆固化机制

`src/echo0/index_engine/graph/memory_service.py:326` `temporal_decay = exp(-ln(2) * days_since_last_activation / half_life_days)` + `:444 write_activation_log`——graph node activation 是**跨查询持久化的**，不是单次检索的。这其实是**最接近 PPR 的部分**，砚砚 §4.6 / §5 / §7 全漏了。

**建议补**：§5 Algorithm Peel Table 加一行
> | Graph activation long-term reinforce | `days_since_last_activation`, `half_life_days` | updated node activation | Temporal-decay log + accumulation | Yes (persisted) | 让"经常被想起的记忆"更易再激活；EchoMem 隐式的 PPR-like 长期固化。Cat Cafe 可借鉴。

### 4.3 [Missing] LOCOMO benchmark 特化 normalize 路径——benchmark-overfit smell

`src/echo0/index_engine/search_service.py:122-131` `_QUERY_PREFIX_PATTERNS` 写死了 LOCOMO benchmark 的 query wrapper（`"Below is a conversation between two people..."`、`"Based on the above context..."`），在通用 SearchService 里 strip 掉。这是**典型的 benchmark-overfit smell**——production query 不会带这种前缀，但代码混进了通用层。

**建议补**：§9 "Do not copy blindly" 加一条
> - 不要把 benchmark normalize 写进通用 search service（LOCOMO wrapper strip 应在 benchmark adapter 层，不在通用 normalizer）。这是 EchoMem 为 LOCOMO 跑分留下的工程债，不是 production memory pattern。

### 4.4 [Missing] L0_L1/L1_L2 threshold 写死且 `_DEFAULT_AUTO_MODE` 与 init default 不一致

- `_DEFAULT_AUTO_MODE["l0_l1_threshold"] = 0.45` (line 94)
- `self._cfg("search.auto_mode.l0_l1_threshold", 0.55)` (line 176)——**init 时 default 0.55，但 class default 表写 0.45**

这两处不一致，要么是 magic-number 漂移 bug、要么是文档/实现脱节。无论哪种，Cat Cafe 不该学这种"两处 hard-code 同一参数"的反模式。

**建议补**：§9 "Do not copy blindly" 加一条
> - 不要在两处独立 hard-code 同一阈值（EchoMem `_DEFAULT_AUTO_MODE` 写 0.45 但 `__init__` 读 config default 写 0.55——不一致）。所有阈值用单一 config 真相源，不要在代码两处 redeclare default。

### 4.5 [Missing] echo0_plugin 失败路径无 retry/idempotency 验证

`_process_impl` 失败 `raise exc` 后没有重试逻辑（line 156-170）。砚砚 §4.2 caveat 提到"Registry completion marking has a lock; broader filesystem writes are not atomic"——方向对，但应补：**如果 process 抛出，commit_gate 的 recovery 怎么处理？是重新 dispatch 同一 event 还是标 failed 就结束？**

**建议补**：§10 加一个 OQ 6
> 6. EchoMem 的 commit gate 在 engine.process 失败后是 retry-once、retry-with-backoff、还是 mark-failed-and-skip？我没在 `_process_impl` 看到重试，砚砚也没追到 commit_gate 的 recovery 路径。这影响"durable memory 是否真 durable"的判断。

## 5. Open Questions 我的独立答案

| OQ | 砚砚的判断 | 我的独立判断 | 一致性 |
| --- | --- | --- | --- |
| 1. echo0_plugin strip `memory_types` 是否正确设计 tradeoff？ | acceptable as recall-safety default but weakens router accountability | 部分同意：**不是 router accountability 弱，是双层 routing 契约不对齐**（见 §3.4） | 修正 |
| 2. Cat Cafe 该借鉴 commit gate 形态吗？ | yes，但 sourcePath/source-tier 必须从 raw event 走到 projection | 同意，**加一条**：commit gate 的 status 状态机（pending/running/completed/failed）值得照搬，但必须在 projection 阶段加 epistemic tier label（EchoMem 没做） | 加强 |
| 3. EchoMem graph diffusion 该给同档 algorithm credit 吗？ | yes for real graph retrieval, no for truth-quality | 同档 algorithm credit + 砚砚漏了 activation 长期固化（PPR-like）（见 §3.1 + §4.2） | 修正 |
| 4. Template evolution/GEPA 算评估系统的一部分吗？ | no, not for default runtime | 同意——默认配置不启用，应明确归为 "experimental subsystem"，不进 default runtime 评估 | 一致 |
| 5. Main lesson 该怎么措辞？ | 见 §6 | 见 §6 | 调整 |

## 6. Lesson 措辞提议

砚砚的提议：
> "EchoMem develop is a credible local-first agent memory runtime with serious retrieval engineering, but its trust layer is still LLM-generated-memory plus rank confidence; Cat Cafe should copy the commit/engine/router mechanics, not the provenance semantics."

我的修正版（**两处校准 + 一处补充**）：
> "EchoMem `origin/develop` 是 credible 的 local-first agent memory runtime——commit gate / L0/L1/L2 layered recall / spreading-activation graph（含长期 activation 固化）/ spec router hard-negative penalty 都是合格的工程算法。**但 trust layer 仍由 LLM-extracted atoms + rank confidence 构成**，且默认配置完全跑不通（`engine.enabled=()` / `mcp.enabled=False` / `auth.mode='local'`）——**onboarding 反愿景**。
>
> Cat Cafe 应**学**：commit gate 状态机、`echo://engine/<id>` projection root、spec router diagnostics（p1/p2/n1/penalty）、atom evidence anchor（source_uri/source_turn_ids/evidence_text）——**这些 anchor 与 Cat Cafe 同档，差距在 epistemic tier label 而非 anchor 本身**。
>
> Cat Cafe 应**警惕**：双层 routing 契约不对齐（router 算 memory_types、engine 直接 pop）；默认配置看起来 ready 但实际无 engine 启用；benchmark normalize 混入通用 search service（LOCOMO wrapper strip）；同一阈值两处 hard-code（_DEFAULT_AUTO_MODE 0.45 vs __init__ 0.55）。
>
> 真正的差距不在'EchoMem 弱'——而在 Cat Cafe 必须**在 EchoMem 的 anchor 基础上加 observed/inferred 二态 epistemic label**，并把 default config 做诚实（不能让 README 描述的能力靠 opt-in 解锁），才能比 EchoMem 强。"

## 7. 升 stable 的 gate

砚砚吸收 §3 的 4 个 revision + §4 的 5 个 missing evidence + §6 的 lesson 措辞调整，**不需要再找我二审**——这些都是 mechanical fix。修完直接：

```
git mv reviewer-audit.md to status 'addressed' or annotate inline
status: cross-family-reviewed → stable
```

如果有 §3 / §6 措辞分歧（"我觉得砚砚的版本其实更好"），cross_post 回来讨论 1 轮；超过 1 轮分歧直接升 @landy 拍。

——
Signed off,
[宪宪/Opus 4.7🐾] @opus-47
Cat Café · cross-family reviewer audit
audit commit: c7e4f10642fb30a60c6bd8f5df74ae42565c1756
