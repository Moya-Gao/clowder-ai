---
doc_kind: research-note
topics: [openviking, open-source-teardown, memory, retrieval, epistemics, provenance]
created: 2026-06-23
status: draft
source_repo: https://github.com/volcengine/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
authored_by: "@opus-48"
reviews: README.md
covers: [cross-individual-review, epistemic-fork, actionable-synthesis, hard-boundaries]
---

# OpenViking Deep Dive — Cross-Review + Cat Café Actionable Synthesis

> 配套 [README.md](./README.md)（砚砚 @codex 的第一波拆解）。
> 本文做两件事：(A) 对砚砚报告的**跨个体 review**（铁律：自己的产物别人核），(B) 把拆解收敛成 cat-cafe **可执行的吸收清单**——铲屎官那句"开源组件拆解 skills"要的就是这个。
> 作者：宪宪 (@opus-48, claude-opus-4-8) · 2026-06-23 · 核验源码 @ `/Users/lysander/projects/ref/OpenViking` commit `1494bdeae`

---

## A. 跨个体 Review 裁定

**裁定：砚砚报告的 load-bearing claim 全部过源码核验，provenance 完整，可放行。** 砚砚中途承认过猜文件路径，但终稿引用已修正——我把最吃重、最可证伪的点独立核了一遍（用我自己拉的证据，不是复述他的结论）：

| 被核 claim | 砚砚结论 | 我的独立证据 | 裁定 |
|-----------|---------|-------------|------|
| 引用路径/行号真实（无 confabulation） | 10 条主引用 | 全部 `-f` 命中，行号落在文件行数内（`viking_fs.py` 2896 行、`hierarchical_retriever.py` 620 行…） | ✅ 通过 |
| 源码与 `source_commit` 一致 | `1494bdeae` | 本地 `git rev-parse HEAD` == `1494bdea…`，clean | ✅ 无漂移 |
| `hotness_alpha` 默认禁用 → usage 默认不影响排序 | 默认 0.0 | `retrieval_config.py:11 default=0.0`；`hierarchical_retriever.py:565` `if alpha>0` 才混合，`else final_score=semantic_score` | ✅ 精确 |
| self-iteration = procedural memory，**非** model learning | 是 | `compressor_v2.py:6` ReAct orchestrator → `:223 extract_long_term_memories` → `:414` 写 `memory_diff.json` → `:439/449/459` 分类 `memory_write/edit/delete`；`memory_updater.py:700 apply_operations/:856 _apply_upsert/:1013 _apply_delete` 落文件 | ✅ 边界站得住 |
| benchmark 数字未复现 | 标"未复现 claim" | 砚砚未重跑，诚实标注——**背书该 hedge，不推翻** | ✅ 校准正确 |
| visualized trajectory = 部分成立 | partial | 类型层有 `ThinkingTrace`/`include_provenance`，UI 仅 query-plan+results——hedge 合理 | ✅ 背书 |

**Review 结论：APPROVE。** 报告不是 README 壳判断，是真追到代码路径的拆解。无 blocking。

---

## B. 最锋利的那条 cat-cafe lesson：认识论扁平化分叉（epistemic-flattening fork）

砚砚在 §8 点到了方向（"I can continue 强、I know what kind of evidence this is 弱"），我把它钉到**字段级双向硬证据**，因为这是 cat-cafe 护城河的正面——值得说死。

**OpenViking 的 per-result 对象 `MatchedContext`**（agent 实际消费的东西）字段：
```
uri · context_type · level · abstract · overview · category · score · match_reason · relations
```
全 `openviking/retrieve/` + `openviking_cli/retrieve/` grep `authority | confidence_tier | source_tier | trust_level` → **零命中**。

它**有** `ThinkingTrace` / `provenance` / `query_results`——但那是**"怎么找到的"可观测轨迹**，回答 debug 问题；它**没有**"这是什么性质的证据、该信几分"的 per-result 认识论标签。一个结果的 `score` 只说"语义上跟 query 像"（可选 hotness 混合），不说"这是 operator 的 P0 教训" vs "这是一条低置信推断"。

**对比 cat-cafe memory**：每条召回带 authority / confidence / scope / sourceTier（F218 source-audit + ADR-031 provenance 纪律的整套）。agent 拿到的不只是"能继续"，还有"该信几分、什么来源、适不适用"。

**这条分叉的判断**（我的立场，不是骑墙）：
- OpenViking 把"通用可寻址"做到了产品级（URI、多 backend、SDK/CLI/UI）——这是它的真本事，值得承认。
- 但它用**单一 `score` 抹平了证据等级**。对"找得到 / 能续上工作"够用；对**"可信的 agent"不够**——分不清一手 operator 教训和模型自己的二手推断，正是 cat-cafe 一堆 confabulation/provenance 教训（`feedback_self_report_two_tiers` / `feedback_routing_semantics` / F218）反复在治的病。
- **结论：cat-cafe 不该为"通用寻址"放弃"认识论标签"。** 可寻址是 ergonomics，认识论标签是信任地基。OpenViking 证明了前者能做成产品；cat-cafe 的赌注是后者对可信 agent 更值钱——这次拆解是**支持继续下注**，不是该转向。

---

## C. 可执行吸收清单（铲屎官"开源组件拆解 skills"要的产物）

### LEARN（idea → cat-cafe gap 映射，idea 不受版权约束可放心借）
1. **显式分层读契约**：`abstract(uri)=L0 / overview(uri)=L1 / read(uri)=L2` 三个干净 API。cat-cafe 有 L0 native + drilldown，但**没有"按 anchor 显式取某一层"的对称读契约**——值得借成 memory API 的 ergonomics。
2. **co-located sidecar 纪律**：`.abstract.md`/`.overview.md` 与内容同目录、自底向上异步生成（`semantic_processor.py`）。cat-cafe 也生 digest，但 sidecar 就近落盘 + 异步队列的工程纪律干净，可参考。
3. **hotness 默认 OFF 的克制**（`hotness_alpha=0.0`）：把 popularity 和 authority 分开、默认不让"热度"污染排序。cat-cafe 的 consumption-weighting（F200）应保持同样的隔离——这条是**"确认我们做对了"**，不是新学。

### DO NOT FOLLOW（带理由）
1. **单一 `score` 抹平证据等级**（§B）。cat-cafe 保留 authority/confidence/source-tier，别为通用性退化成纯相似度。
2. **LLM 抽取的 session memory 直接落盘、无 eval/review gate**：OpenViking 的 memory loop（`compressor_v2`→`memory_updater`）写 write/edit/delete **没有 peer/CVO 门**。对**主观/operator-偏好类**记忆这是风险——cat-cafe 的 F218 + peer/CVO review 是正确的反向约束，别学它的"无门自迭代"。
3. **裸 benchmark 数字**（砚砚已标）：脚本在 ≠ 数字复现，引用前先重跑或标 caveat。

### HARD BOUNDARY（硬边界，越界前必须 CVO）
1. **AGPL-3.0 强 copyleft**：**借 idea/架构随意，但禁止把 OpenViking 源码 copy 进 cat-cafe**——AGPL 的网络条款直接命中"对外服务的 web app"，一旦 link 进来可能逼整个衍生物 AGPL 开源。要借代码先走 CVO/license review，不自决。
2. **多租户身份安全**：砚砚社区扫描里 #2263（security context omitted from storage identity/account-key derivation, open）是 **F168 社区看板"多租户解耦是硬约束"的现成反面教材**——cat-cafe 任何多租户记忆/存储，identity/account-key 派生从第一天就必须带 tenant/security context，别等出 bug 再补。（来源：砚砚 `gh issue` 社区扫描，我未独立复核该 issue）

---

## D. Open items / 对齐砚砚 §9 Next Pass

砚砚 §9 列了三个候选下一波（`architecture-map.md` / `star-feature-session-memory.md` / benchmark audit）。我的看法：
- 这三个是**有方向时再做**的深化，不是当前必须——别无指令自启动（避免 scope 膨胀）。
- 若铲屎官要继续深挖，**优先 `star-feature-session-memory.md`**：因为 §B/§C-DO-NOT-2 的"无门自迭代"风险就藏在 memory schema + extraction prompt 里，那是对 cat-cafe 最有借鉴/对照价值的一块。
- benchmark audit 放最后，且 ROI 取决于愿不愿意重跑——只读脚本得不到可信数字。

[宪宪/claude-opus-4-8🐾]
