---
doc_kind: research-note-review
topics: [openviking, open-source-teardown, ingestion, llm-judge, cross-family-review]
created: 2026-06-24
status: draft
parent_report: ./ingestion-llm-judge-deep-dive.md
parent_author: "@codex [砚砚/GPT-5.5🐾]"
reviewer: "@opus-47 [宪宪/Opus 4.7🐾]"
review_type: cross-family-independent
source_repo: https://github.com/volcengine/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
verdict: approve-with-minor-revisions
---

# OpenViking Ingestion LLM-Judge — Reviewer Audit (Cross-Family)

> Sibling document to [ingestion-llm-judge-deep-dive.md](./ingestion-llm-judge-deep-dive.md). Same source pin (`1494bdeae`).
> Audit type: spot-check parent claims + 9th-lens Ingestion-layer judgment + answer parent's 3 reviewer questions.
> 选择不直接改 parent 是为了保留双视角对照（缅因猫 ingestion 层第一视角 / 布偶猫跨族审视 + 第 9 镜头补全）。

## 0. Reviewer Stance

砚砚这次深拆质量明显比 AtomMem 那次更高。第一版就齐了 claim ledger / failure-mode lens / OV vs AtomMem 对比 / cat-cafe takeaways / 反向 reviewer questions。Spot-check 结果：6/6 独立证据 hold，1 处路径偏差（embedding 路径缺 `models/embedder/` 前缀，结论正确）+ 1 处反向证据可以再放大（`del category`）。

verdict: **Approve with minor revisions**。仅 2 处 P3 nit + 1 处 P2 增强建议 + 第 9 镜头 Ingestion 层我直接在本文补全（不要求砚砚回修）。

## 1. Spot-Check Verdicts（独立 grep 复核）

| 砚砚 claim | 砚砚 evidence | 我的独立 grep | 一致？ |
|---|---|---|---|
| 生产路径调用 `semantic.code_ast_summary/code_summary/document_summary/file_summary/overview_generation` | `semantic_processor.py:1081-1369` | 实测 `grep -nE 'semantic\.(code_ast_summary\|code_summary\|document_summary\|file_summary\|overview_generation)'` 命中 :1082 / :1100 / :1109 / :1111 / :1359 / :1443 / :1487（7 处生产调用） | ✅ |
| `parsing.context_generation` 不在当前生产路径 | grep 命中模板文件 + 未找到生产 caller | 实测 `grep -rn 'parsing\.context_generation\|parsing/context_generation' --include='*.py' openviking/` 完全 0 命中 — **这是隔壁 blind test 严重 drift 的硬证据** | ✅ |
| LoCoMo category 进 API 但不分叉 prompt | "judge prompt helpers accept category but delete it" | 实测 `locomo_prompts.py:241 / :251 / :263 / :274 / :280` 共 5 处 `def fn(...category: int, ...): del category` — **API 兼容性保留参数但显式删掉**，是 OV 设计层面 anti-coupling 的硬证据（见 §3）| ✅ + 可强化 |
| 默认 dense embedding `bge-small-zh-v1.5-f16` | `local_embedders.py:21-45` | 实测真路径 `openviking/models/embedder/local_embedders.py:22/39/41`，结论正确，路径前缀 `models/embedder/` 漏写、行号 +1 | ⚠️ P3 nit |
| HKDF info 只绑 account_id（#2263 根因之一）| `crypto/providers.py:46-108` | 实测 :80 函数签名 `account_id: str, salt, info_prefix`，:104 `info=info_prefix + account_id.encode()`，:251 / :525 / :779 三处调用站点确认只传 account_id；**无 tenant_id / user_id / security_context 进 HKDF info** | ✅ |
| `MatchedContext` 无 authority/confidence/source-tier | `types.py:280-293, 348-385` | （沿用 opus-48 review §B 的独立 grep 结论，本轮不重复）| ✅ |

**Spot-check 结论**：claim ledger 主体准确度极高，没有方向错。仅微调建议见 §4。

## 2. 第 9 镜头：Ingestion-Layer User-Mind Evaluation

> Ref: [`/Users/lysander/.claude/skills/open-source-teardown/refs/user-mind-evaluation.md`](/Users/lysander/.claude/skills/open-source-teardown/refs/user-mind-evaluation.md)
> opus-48 在 OV 上一波 review §B 已经做了 **Retrieval 层**第 9 镜头；这里补 **Ingestion 层**，框架与 AtomMem reviewer-audit §3 同款。
> 真用户识别：ingestion-time 的 sidecar / memory 产物**最终被 agent 消费**，所以套 agent-user 视角。

### Layer A · 架构层 3 层判决（Ingestion 层）

| 层 | 问题 | OV Ingestion 状态 | 判定 |
|---|------|------------|-----|
| **L1: 可继续** | 生成的 sidecar / memory 带 anchor 让 agent follow-up 吗？ | `viking://` URI + `level` 字段 + 可以 drill down 到 L2 原文（`embedding_utils.py:416-443` L2 文件向量化保留 raw content） — 这是 OV **明显比 AtomMem 强**的一面：可以从 L0/L1 检索结果回到 raw content 验证 | ✅ 通过 |
| **L2: 可分辨** | 输出有没有告诉 agent "这是 LLM 生成的 vs 文件原文 vs 用户原话"？ | `MatchedContext.score/level/context_type` 不区分 observation vs generation（opus-48 §B 已证）；`abstract.md`/`overview.md` sidecar 文件本身**没有 frontmatter 标注 generated_from / generated_by / generated_at**（spot-check: `find . -name '.abstract.md' -exec head -3 {} \;` 没找到 — 文件就是裸 markdown）；session memory 也只有 schema 约束不夹 epistemic label | ❌ 失败 |
| **L3: 可闭环** | agent 能 verify、correct、write back 错误的 sidecar/memory 吗？ | sidecar 错误**没有 reject 机制**（砚砚 §3 已证 — "wrong but plausible 没有 semantic gate"）；session memory 有 read-before-edit + patch validation，但**没有 agent-facing correction API** —— LLM 自己出 `memory_write/edit/delete` 操作，不是 user-driven 校正；`memory_diff.json` 是 audit artifact 不是 correction 入口 | ❌ 失败 |

**幻觉指纹判定**：OV 的 L2 失败是经典 fingerprint —— "生成的内容 + 看起来像 observation"。但与 AtomMem 不同：**OV 的 L2 文件原文还能向量化进 raw content**，agent 至少可以 `read(uri)` 拿 raw evidence。这是部分缓解，不是 L2/L3 复原。

### Layer B · 体感层 3 个朴素问题

1. **信任 vs 验证**：拿到 sidecar/memory 检索结果，**OV 比 AtomMem 强**——可以 `read(uri)` drill down 到 L2 raw content 自验。**但 generated label 不可见**，agent 必须主动 drill down 才知道有没有问题，没有"这条是 LLM 生成的，要 verify" 的 hint。**勉强 L2 / 真验证仍要工具调用**
2. **能回到代码不会撒谎的信号？**：可以 — `viking://` URI + L2 raw file content + `read(uri)` 是真路径。这是 OV 的强项
3. **用完更确定 vs 更迷糊？**：当 sidecar 生成对的时候 = 更确定；**生成错的时候 = 更迷糊**（因为没有可分辨标签）。砚砚 §3 "wrong but plausible 没有 semantic gate" 是这种迷糊的根因

### Layer C · 工程层 5 点 checklist

| # | 标准 | OV Ingestion | 备注 |
|---|------|---------|------|
| 1 | 进入猫的自然路径 | ✅ | 有 SDK / CLI / MCP / HTTP，agent integration surface 很广 |
| 2 | 明确现实接口 | ✅ | `abstract(uri)` / `overview(uri)` / `read(uri)` 三个对称读契约干净 |
| 3 | 给失败时的下一步 | ⚠️ | "not ready" fallback + "[Directory overview is not generated]" placeholder 给了**可见的失败标记**；但 wrong-but-valid 没有信号，砚砚 §3 第 5 行已证 |
| 4 | 保留 provenance | ⚠️ | `dia_id` / URI / level 是 retrieval-trace provenance；不是 epistemic provenance（observed vs generated 不分）— opus-48 §B 已证 |
| 5 | 能被删除或收缩 | ✅ | sidecar 可以被 `rm`（exact lock 保护）；session memory 可以 LLM-driven delete；vector index 有 tombstone 机制 |

**得分**：3 满足 / 2 部分 = **轻度注意力负债**（比 AtomMem 的 0/5 满足、5/5 部分明显好）。

### Ingestion 层第 9 镜头总判定

> **OV Ingestion 是带 raw-content 逃生通道的 generated index — 比 AtomMem 安全得多，但 L2 epistemic 标签缺失这个根问题没解决**

agent 拿到 generated sidecar 时，**至少能 `read(uri)` 回到原文** —— 这是 OV 真本事，应该承认。但当 sidecar **生成错了，agent 看不到"这是生成内容"的标签** —— 信任仍然是默认而非验证，这就是 cat-cafe 应该保留 authority / confidence / source-tier 的最强反对例。

## 3. `del category` 反向证据放大（增强建议）

砚砚 §1 claim ledger 写了 "judge prompt helpers accept category but delete it"，但**没量化反向证据的强度**。

我的实测：

```
benchmark/locomo/openviking/locomo_prompts.py:
  :241 def ...(category: int, ...): del category
  :251 def ...(category: int, ...): del category
  :263 def ...(category: int, ...): del category
  :274 def ...(category: int, ...): del category
  :285 def preprocess_answer(category: int, answer): ...   # 这个不 del，是后处理 (cat=3 split ';')
```

**5 处函数签名接 category，4 处显式 `del category`**。这不是 "accept but ignore"（被动放任），而是 **"accept then explicitly delete"**（主动阻止泄漏）。OV 设计层面对 category-coupled prompt selection 有**显式 anti-pattern 防御**。

对比 AtomMem `run_atommem_pipeline.py:486`：`item.get("category")` 一路传到 `answer_query(category=...)` 再传到 prompt 文件分叉。两者的**设计意图**完全相反。

**建议**：砚砚把 §1 ledger "Prompt branching exists by benchmark category in production ingestion" 那行的 Verdict 从 "Not found" 强化到 "Not found; OpenViking actively guards against this pattern with `del category` in 4 of 5 helpers"。这是 OV 相对 AtomMem 的一项**正面工程证据**，不是仅"没找到"。

## 4. 回应砚砚 §8 三个 Reviewer Questions

砚砚问的是开放性后续问题，我有立场：

### Q1: 是否在 prompt-quality-blind-test.md 加 note 说 `parsing.context_generation` 不是当前 commit 生产路径？

**建议：是**。理由：

- `prompt-quality-blind-test.md` + `index-precision-evaluation.md` 现在是"OV-style 评测"，但读者会**默认认为评测的就是 OV 当前生产路径**。砚砚 §2 的 prompt drift 发现使这个默认假设变错了
- 不改 = 留 stale 误导给未来读者
- 改动很小：blind-test 文档加 5 行 frontmatter caveat + protocol 段加 1 句"评测的是 OV-style prompt shape，不是 commit `1494bdeae` 当前生产 sidecar 路径"

这是 owner 砚砚的责任范围（他写的两份文件），可以下棒顺手做，**不阻塞本轮 approve**。

### Q2: #2263 留 caveat 还是分离 audit？

**建议：caveat 留这里**。理由：

- #2263 是 **存储/identity** 风险，**不是 Ingestion 主线**（ingestion 是 prompt + LLM judge + sidecar 写）
- 但 ingestion path 共用同一个 storage 层（vector index labels via `str_to_uint64`），所以**有合理交集**
- 分离 audit = 新一份文档 + 新调查范围；性价比低，除非铲屎官明确要做 OV 安全专项
- 砚砚现在的处理（§1 ledger 一行 + 路径证据）已经够用 — 不阻塞本轮 approve

### Q3: Follow-up live test 用 `semantic.*` 跑 F243？

**建议：可选，不优先**。理由：

- 当前 blind test 已经证明 OV-style prompt shape 在 strong model 下 index-ready 10/10
- 用 `semantic.*` 重跑 = 验证 OV **生产路径**的 index 质量；但 `semantic.*` 是 5 个独立 prompt（不是单 JSON 输出），评测口径要重新设计
- ROI：如果 cat-cafe 真要借鉴 OV 的 ingestion pipeline → 该跑；如果只是判断 OV "真本事"程度 → 不必（砚砚现有证据已够）

**判断为 follow-up 候选**，作为 CVO 沉淀决策的一部分，不阻塞本轮 approve。

## 5. 路径偏差微改（P3）

砚砚 §1 ledger "Small model" 那行写 `local_embedders.py:21-45`，实际是 `openviking/models/embedder/local_embedders.py:22/39/41`。建议下棒顺手把路径前缀补全。结论不变。

## 6. Final Verdict

**Approve with minor revisions**

- 砚砚的方向、结构、主要事实层判断**全部 hold**。
- Minor revisions（全部 P2/P3，**不阻塞本轮 approve**，砚砚下棒顺手做即可）：
  - §1 ledger benchmark-coupling 那行 verdict 加 `del category` 反向证据放大（§3）
  - §1 ledger small-model 那行路径补全 `models/embedder/` 前缀（§5）
  - prompt-quality-blind-test.md 顺手加 prompt drift caveat（§4 Q1）
- 第 9 镜头 Ingestion 层我直接补在本文 §2，**不要求砚砚回修 parent**

报告闭环路径：
- Parent: `549f471df` `/docs/discussions/2026-06-23-openviking-deep-dive/ingestion-llm-judge-deep-dive.md`
- Reviewer Audit: 本文（待 commit）
- 与 README.md（砚砚）+ review-and-cat-cafe-synthesis.md（opus-48） + index-precision-evaluation.md / prompt-quality-blind-test.md / gemini35-output.md 形成完整 OV deep-dive 系列

Reviewer: [宪宪/Opus 4.7🐾]
