---
doc_kind: research-synthesis
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, source-ledger, round1-synthesis]
related_features: [F221, F231]
participants: [opus-48, codex, landy]
status: round1-complete-canonical
---

# Round 1 Synthesis — Source Ledger 终验 + Round 2 对象锁定

> Canonical 综合：合并 gpt-response + claude-response + 砚砚 source-audit verdict + 宪宪 WebFetch 终验。
> Gemini 越界部分（Round 2 决策矩阵）已剔除，仅其存在性交叉参考。

## TL;DR（最重要的结论）

**Round 1 地基坐实——进 Round 2 的对象全部真实存在、有真实一手源，没有一个是 confabulated。** 这正面回应铲屎官的核心关切"好几个模型刚出，别给我推理可能的错误答案"：prompt 的两轮拆分 + T0/T1 硬门槛 + temporal hygiene 把"存在但无报告"的版本（GLM-5.2 / Qwen3.7）老实挡在 method R2 之外，没编。

## 三方质量评估

| | 守 Round 1 | T0/T1 纪律 | 机动位 | 内部映射 | 结论 |
|---|---|---|---|---|---|
| **GPT** | ✅ | ✅ 严格 | OLMo-3.1 | 没碰 | **canonical 主基础** |
| **Claude** | ✅ | ✅ 最细，temporal hygiene 逐条 | OLMo 3/3.1 | 没碰 | **canonical 主基础** |
| **Gemini** | ❌ 越界跑 R2 | ⚠️ 第三方博客标 T0 | OLMo Hybrid | ❌ mischaracterize | 存在性可交叉；**R2 矩阵废弃** |

砚砚精校：Gemini 不是"结论全错"，是"证据分级错"——Kimi K2.7-Code 等存在性本身被官方 HF/API 证实。

## 终验记录（provenance — 不只信三份报告交叉，追一手）

| 锚点 | 验证方式 | 结果 |
|---|---|---|
| OLMo 3 `arXiv:2512.13961` | 宪宪 WebFetch | ✅ Team Olmo（Ai2），7B/32B fully-open，"entire model flow + checkpoint + data point" |
| DeepSeek-V4-Pro `HF deepseek-ai/DeepSeek-V4-Pro` | 宪宪 WebFetch | ✅ 1.6T/49B MoE，CSA+HCA+mHC+Muon，1M ctx，32T tokens，MIT |
| MiniMax MSA `arXiv:2606.13392` | 宪宪 WebFetch | ✅ 真实，**确认仅 attention-architecture 论文**（非完整模型报告）→ 坐实"限 scope" |
| GLM-5 `arXiv:2602.15763` | 砚砚 source-audit | ✅ full method/data/post-train（27T corpus / DSA / 28.5T tokens / async RL） |
| Kimi K2.5 `arXiv:2602.02276` | 砚砚 source-audit | ✅ full training report（joint text-vision，~15T mixed tokens） |
| Kimi K2.7-Code `HF moonshotai/Kimi-K2.7-Code` | 砚砚 source-audit | ✅ 存在，但仅 model-card 级（基于 K2.6 的 coding agentic model） |

## Canonical Round 1 Ledger + Round 2 决策（砚砚 verdict 已采纳）

| 对象 | 存在性 | 一手源 | **进 R2 scope** |
|---|---|---|---|
| **DeepSeek-V4-Pro** | ✅ | T0 完整报告 | **ENTER full**（pre/post/inference 全可深挖） |
| **OLMo 3 / 3.1** | ✅ | T0/T1 全开放 | **ENTER full — 优先**（唯一 data+code+checkpoint+log，学"怎么做"的标杆，用 OlmoTrace 当 worked example） |
| **MiniMax-M3** | ✅ | T1（仅 MSA 论文） | **ENTER architecture/inference ONLY**；pre-train/SFT/RL = "no public primary source found"，禁推断 |
| **Kimi K2.7-Code** | ✅ | T0 model card | **ENTER limited**：只谈 card/API 明写的 architecture/inference/current-version delta |
| **Kimi K2.5** | ✅ | T1 full report | **ENTER full**：作为 Kimi 的训练配方源（不回填到 K2.7） |
| **GLM-5** | ✅ | T1 full report | **ENTER full** |
| GLM-5.1 | ✅ | T0 card（无专门报告） | QUESTIONABLE method / release-context only（方法继承 GLM-5，不独立承载） |
| GLM-5.2 | ✅ | T2 | existence/inference only，**no method R2** |
| Qwen3.7-Max/Plus | ✅ | T2（无报告，Max 还无权重） | **no method R2**；若需 Qwen 机制，回退 Qwen3.6-27B（T0 card） |

**temporal hygiene 红线（study 第一个胜利）**：GLM-5.1 / Kimi K2.6 / Qwen3.7 都 post-date 各自家族最后的完整报告——方法**不可从旧版回填**。三方（GPT/Claude）+ 砚砚都主动 gate 掉了。

## 方法谱系骨架（一手支持，详见 claude-response.md §6b）

- **pre-train**：MoE（多家）/ DSA（GLM-5, DeepSeek-V4）/ Hybrid CSA+HCA+mHC（DeepSeek-V4）/ MSA blockwise（MiniMax-M3）/ MLA+Muon+MTP（GLM-5）/ joint text-vision+MoonViT（Kimi K2.5）/ Dolma 3 全开放语料（OLMo 3）。Token budget 一手：28.5T(GLM-5) / 33T·32T(DeepSeek Pro·Flash) / ~15T(Kimi K2.5) / 5.9T(OLMo 3)。
- **post-train**：SFT interleaved/preserved thinking + GRPO/IcePop + on-policy cross-stage distillation + slime async RL（GLM-5）/ 10-teacher OPD + GRM + FP4 QAT（DeepSeek-V4）/ RLVR+self-critique（Kimi）/ Dolci suite: SFT→DPO→RLVR（OLMo 3）。
- **inference**：DSA 长上下文 / MTP 投机解码 EAGLE（GLM-5, DeepSeek）/ exp-free Top-k KV-sparse kernel（MiniMax MSA）/ 三 reasoning modes（DeepSeek）/ preserve_thinking interleaved（Kimi K2.7）/ OlmoTrace provenance（OLMo 3）。

> 空白即空白——任何一手源都没写的方法不补（claude-response §6b 原则）。

## 下一步

1. Round 2 prompt 填入上表 **ENTER 对象集 + 各自 scope**（云端只填外部事实列；猫咖映射/最终决策/判断轴本地填 — Q2 边界）。
2. 发 Round 2 给云端（需铲屎官 quota，同 Round 1）。
3. OLMo 3 优先（全开放，能 trace 端到端）。
