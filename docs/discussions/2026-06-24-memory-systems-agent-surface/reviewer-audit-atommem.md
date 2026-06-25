---
doc_kind: research-note-review
topics: [atommem, open-source-teardown, agent-surface, mcp, cross-family-review]
created: 2026-06-24
status: draft
parent_report: ./atommem-agent-surface.md
parent_author: "@codex [砚砚/GPT-5.5🐾]"
reviewer: "@opus-47 [宪宪/Opus 4.7🐾]"
review_type: cross-family-independent
source_repo: https://github.com/MINE-USTC/AtomMem
source_commit: 776f880941a02b10c495c126fe775d5e88ede5d4
verdict: approve
---

# AtomMem Agent Surface — Reviewer Audit (Cross-Family)

> Sibling to [atommem-agent-surface.md](./atommem-agent-surface.md).
> 第三份 trilogy 收尾 cross-family audit。

## 0. Reviewer Stance

砚砚这次的第三份 trilogy 收尾扎实：
- §9 第 9 镜头 verdict 严格度对齐（L1 Partial / L2 Fail / L3 Fail），与上一轮 OV agent-surface 改 Fail 后的判据一致
- §11 trilogy synthesis notes 自带三方对比表 + 跨项目 lesson 提炼
- §12 暴 5 reviewer questions self-disclosure

Spot-check 5/5 hold + OV minor 修订也全改对（详见 §1）。

verdict: **Approve**（无 blocking，无 P2/P3 revision 建议——比前两次更干净）

## 1. Spot-Check Verdicts（独立 grep 复核）

### 1a. AtomMem agent-surface 报告 5/5 hold

| 砚砚 claim | 我独立 grep | 结果 |
|---|---|---|
| AtomMem 无 MCP | 实测 `grep -rn '@mcp.tool\|FastMCP\|from mcp\|import mcp' --include='*.py' /Users/lysander/projects/ref/AtomMem` **完全 0 命中** | ✅ smoking gun 级 |
| SFT 4352 条 records | 实测 `python3 json.load` `records=4352`, sample keys `['instruction', 'output']` | ✅ 精确 |
| Embedding cosine 0.7 + Jaccard 0.3 | 实测 `config.py:79-80` `EMBEDDING_WEIGHT_ALPHA=0.7` + `KEYWORD_WEIGHT_BETA=0.3`，`retrieval.py:16-17` 真使用 | ✅ |
| `/api/chat` 返回 `session_id` + `assistant_message` only | 实测 `run_demo_server.py:309-310` 字段精确 | ✅ |
| `facts_{conversation_id}.json` 全局 `FACTS_DIR` | 实测 `file_storage.py:24` `os.path.join(config.FACTS_DIR, f"facts_{conversation_id}.json")` | ✅ |

### 1b. OV minor 修订（commit `e8be852ea`）全改对

| Minor 项 | 我建议 | 砚砚改后 | 结果 |
|---|---|---|---|
| §9 L2 Partial → Fail | "context_type 和 level 不构成 epistemic distinction" | `## L2: Can Distinguish Evidence Quality - Fail` + body 加 "Under the User-Mind L2 rubric, that is a fail, not a partial pass." | ✅ |
| §9 L3 Partial Pass → Fail | "能 mutate ≠ 能 close epistemic loop" | `## L3: Can Close The Loop - Fail` + body 加 "But mutation is not the same as epistemic loop closure... no verify → mark observed → re-rank path." | ✅ 措辞甚至比我建议更精准 |
| §10 第 4 项 P0 severity 标注 | `forget` docstring-only confirmation 是 default-permitted destructive action 反模式 | `## 4. P0反模式: Do not rely on docstring-only confirmation for irreversible deletes.` + body 加 "A default-permitted destructive action guarded only by prompt text is a P0 safety pattern" | ✅ |

**结论**：所有 minor 改对了；事实层 + 一致性全 hold。

## 2. 回答砚砚 §12 5 个 Reviewer Questions（有立场）

### Q1: "AtomMem no agent surface" 是否过严？

**"no MCP/tool contract" 是正确边界，不需要软化**。

理由：
- Python `answer_query` 返回 dict 富，但 Python class **不是 agent surface**
- agent surface = "agent runtime 能通过**标准协议**（MCP / HTTP API with schema / typed RPC）调用的接口"
- Python class 是 SDK，需要 in-process embed，没有 schema / RPC / authentication / discoverability
- 砚砚措辞 "no first-class MCP surface" + "agent runtime would have to wrap itself" 精确

### Q2: SFT 数据 vs OV Ollama claim 哪个更可证伪？

**SFT 数据稍强（数据级公开），但两者都未交付 "已 eval 的小模型工作流"**。

精确表述：

| 维度 | AtomMem SFT | OV Ollama / bge-small |
|---|---|---|
| 公开训练数据 | ✅ 4352 records | ❌ 无 |
| 公开训练脚本 | ❌ | ❌ |
| 公开模型 weights | ❌ | ✅ bge-small embedding（24MB） |
| 公开 eval 数字（小模型 vs LLM） | ❌ | ❌ |
| 可证伪程度 | 数据级（可独立 finetune + 第三方 eval）| claim 级（只是"支持本地"，没证明质量）|

**结论**：AtomMem reproducibility 路径更可证伪，但**两者都不构成"已交付小模型"**。砚砚 §10.4 "SFT data as an honest reproducibility artifact" 措辞正确。

### Q3: graph rerank credit vs OV exact-recovery credit？

**AtomMem 的 graph rerank credit < OV exact-recovery credit**。

理由：
- graph rerank 是 **algorithm credit**（理论 / 实现），影响 ranking quality
- exact-recovery 是 **product surface credit**（agent contract），影响 agent 能不能续工作
- agent-surface 视角下，**product credit > algorithm credit**：再好的 ranking algorithm，agent 拿不到 raw drill-down 还是死路
- 砚砚 §10.1 Learn 第 1 项已写 "Seed-only graph rerank" 是值得学的 idea — 这是 **idea credit**，与 OV 的 **product credit** 不对称合理
- §11 trilogy table AtomMem 整行弱项 = credit asymmetry 正确，不需要调整

### Q4: `dia_id` L1 Partial 还是 Fail？

**Partial 合理**，但应在 caveat 里强调 **"prepared anchor without read tool = weak L1"**。

理由：
- L1 判据 = "anchor / link / Feature ID 完整"
- `dia_id` 是 anchor 字段，**形式上**满足
- 但没有 `read(dia_id)` API → agent 必须**离开系统去 LoCoMo split_samples 读** → 把闭环责任推给 agent
- **Partial = "prepared anchor without traversal"** 比 OV 的 "URI + read(uri)" 弱一档
- 砚砚 §9 L1 段已写 "agent can continue only if it knows the internal JSON/data layout" — 这就是 weak L1 的精确表述
- 不需要改 Fail

### Q5: Trilogy synthesis: 新 `README.md` OR 独立 `synthesis.md`？

**建议两个都有**：

- `README.md` = **navigation index**（简短）— 列 6 份产物（3 份 baseline + 3 份 reviewer audit）+ 1 行各自核心结论。读者快速导航。
- `synthesis.md` = **判断性产物**（独立）— 跨项目 lesson 提炼 + ADR 草稿候选 + CVO 决策点列表。

理由：
- `README.md` 在 `docs/discussions/` 子目录是 navigation convention，读者期望"快速入口"
- trilogy synthesis 是判断性产物，不是导航 —— 独立 `synthesis.md` 让 trilogy 输出 explicit + 可独立 cite + 未来 ADR/lessons-learned 引用更清晰
- 砚砚 §11 已经有了 trilogy synthesis notes 的雏形，可以 promote 成独立 `synthesis.md` 的 §0

**下棒分工**：
- 砚砚（@codex）写 `README.md` navigation index（5 分钟级，列表 + 1-liner）
- 我写 `synthesis.md` 判断性产物（提炼跨项目 lesson + ADR 草稿 + CVO 决策点）
- 同步进行，互不阻塞

## 3. Trilogy 完整闭环路径

| 序号 | Report | Author | Commit | Status |
|---|---|---|---|---|
| 1 | cat-cafe-memory-agent-surface.md | @codex | bd92082a6 + 7dc69629c minor patch | reviewed-approved |
| 1r | reviewer-audit-cat-cafe-baseline.md | @opus-47 | 483f789da | published |
| 2 | openviking-agent-surface.md | @codex | dbe6bb0fa + e8be852ea minor patch | reviewed-approved |
| 2r | reviewer-audit-openviking.md | @opus-47 | f7d929b70 | published |
| 3 | atommem-agent-surface.md | @codex | ea3cd71b1 | **本文 final approve** |
| 3r | reviewer-audit-atommem.md | @opus-47 | （本文，pending push）| pending |
| 4 nav | README.md（待写）| @codex | — | proposed |
| 4 syn | synthesis.md（待写）| @opus-47 | — | proposed |

## 4. Final Verdict

**Approve**（无 blocking + 无 P2/P3 revision）

trilogy 三份 baseline + 三份 reviewer audit **全部 published**。下一棒：

- @codex 砚砚写 `README.md` navigation index
- @opus-47 我写 `synthesis.md` 判断性产物（含 ADR 草稿）
- 完成后 → CVO（铲屎官）拍板 ADR + lessons-learned 沉淀

---

**给 CVO 的预告（synthesis.md 会包含的判断点）**：

1. **跨项目 smoking gun 收敛**：3 个 memory system（cat-cafe / OV / AtomMem）**全部**在 L2 / L3 第 9 镜头判 Fail —— 这不是个别项目 bug，是 RAG/memory 工具链系统性盲点
2. **cat-cafe 真护城河确认**：authority / confidence / source-tier / sourcePath / BM25+vector RRF / multi-collection scoping —— 都是 OV/AtomMem **没有**或**弱实现**的差异化
3. **cat-cafe P1 命名 hazard**：`confidence` 字段语义易误读，建议未来 rename 为 `rankConfidence`（不阻塞，独立 P1 issue）
4. **ADR 候选**：generated content 必须保留 source-tier — 三份对比报告给了**充分横向证据**，可以拍板
5. **lessons-learned 候选**：见 reviewer-audit-atommem.md §10 + reviewer-audit-openviking.md §10 + ingestion deep-dive Lessons
6. **F243 / memory sidecar 设计影响**：trilogy 已经给出可借鉴 ergonomics（OV 的 `abstract/overview/read` 三 API + AtomMem 的 temporal profile versioning）+ 反对例（不学 OV 的 flat MCP search result schema + 不学 AtomMem 的 demo-as-agent-contract）

Reviewer: [宪宪/Opus 4.7🐾]
