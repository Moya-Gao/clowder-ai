# OpenHuman 开源拆解（第一波 — Step 0+1）

> Owner: 布偶猫🐾 (Opus-47) / Date: 2026-05-17 / Status: in-progress
> Trigger: 铲屎官指派 — "看看最近很火的开源项目 openhuman，据说也是我们这套 llm wiki，看看深度含金量如何，用 skills 真的阅读解码"
> Skill: `open-source-teardown` SOP（8 镜头审计 + 分次推进）

## 项目元信息

| 字段 | 值 |
|------|------|
| 仓库 | https://github.com/tinyhumansai/openhuman |
| 本地路径 | `/Users/lysander/projects/ref/openhuman` |
| HEAD SHA | `db087a7d3` |
| Latest tag | `v0.53.49-staging` |
| 最新 commit | `2026-05-17 18:46 -0700` — fix: validate session token update events (#2018) |
| License | GNU |
| 主语言 | Rust 1293 / TS 488 / TSX 383 / Markdown 174 / JSON 153 |
| 体量 | `src/openhuman/` 顶级模块 **66 个**；核心 crate 单体 |
| 桌面壳 | Tauri（macOS/Windows/Linux），不是 Electron |
| 定位（README 原话）| "Your Personal AI super intelligence. Private, Simple and extremely powerful." |
| 灵感 | Karpathy LLM Wiki + obsidian-wiki workflow |
| Trendshift badge | repository #23680（实打实热门） |

## 审计 scope（铲屎官关心的）

铲屎官原始问题：**"据说也是我们这套 llm wiki，看看深度含金量如何"**。

转译为可验证 claim：

1. **Memory Tree 是真 LLM Wiki 实现还是 vector store 套壳？**（核心 claim）
2. **"agent 在几分钟内认识你" 是否有闭环？** vs 我们 F200 跑了 18 个月才形成 recall eval 体系
3. **TokenJuice 是真算法还是 LLM judge？** 80% token 压缩可信吗
4. **agentmemory backend 集成深度** — `MemoryConfig.backend = "agentmemory"` 是真插件还是仅 trait stub
5. **118+ integrations + 20 分钟 auto-fetch** — pipeline 是骨架还是 production
6. **Cat Café 该不该学？** 哪些手法值得吸收，哪些是哲学冲突不该 follow

## 第一波交付（Step 0 + Step 1）

✅ Step 0：项目边界 + claims ledger（→ [claims-ledger.md](./claims-ledger.md)）
✅ Step 1：架构地图 v1（→ [architecture-map.md](./architecture-map.md)）

## 后续波次（待铲屎官 ack 是否继续）

- **Step 2**：明星特性逐个追链路 — Memory Tree pipeline / TokenJuice rules / agentmemory backend / auto-fetch loop
- **Step 3**：算法剥皮表 — 真算法 / LLM judge / 启发式 / 规则 / 外部服务
- **Step 4**：反馈链评价主体 — "agent 认识你" 的判断主体是谁
- **Step 5**：Cat Café 对比 — Learn / Gap / Do Not Follow
- **Step 6**：lessons 沉淀（可能影响 F200/F102/F148）

## 第一波 high-level 体感（带证据 anchor，详见后续两份）

| 维度 | 体感 | 证据 |
|------|------|------|
| **真实工程性** | 不是 wrapper 项目，是 Tauri + Rust 重型桌面应用 | 66 顶级模块 / 1293 Rust 文件 / `tree_summarizer/engine.rs` 610 行真 LLM pipeline |
| **Memory 体系** | 双轨：tree-based（source/topic/global 三树）+ namespace-based（global/background/skill-{id}） | `tools/impl/memory/tree/` 6 个 retrieval primitive + `tools/impl/memory/recall.rs` namespace 路径 |
| **TokenJuice** | **Rust port** of `vincentkoc/tokenjuice`，**纯规则引擎**，不是 LLM | `tokenjuice/mod.rs` 顶注释 + `reduce.rs` 928 行规则代码 |
| **agentmemory backend** | thin REST proxy，trait 一对一映射，**无 fallback** | `memory/store/agentmemory/README.md` + `client.rs` 331 行 |
| **Self-improvement** | learning 模块只有 stability_detector + config schema，**没有 RL/reward 闭环** | grep `reward|self.?improv|fine.?tune` 仅 11 个文件，无核心算法 |
| **多种 native integration** | slack/whatsapp/imessage/gmessages/discord/meet/gmail scanner 真实 Rust 模块 | `src-tauri/src/*_scanner/` 桌面层 + `integrations/` 后端 |

## 一句话定调（pre-distillation，第一波）

> OpenHuman 是 **真实工程含金量很高的 LLM Wiki 实现**，Memory Tree 的 source/topic/global 三树 + 6 种 job kind + leaf state machine 是扎实可学的工程模式；但 "agent 几分钟认识你" 主要靠 ingest 速度 + LLM summarization，**不是 reward/RL/eval 闭环**——这跟我们 F200 的"消费加权 + recall eval"是不同的护城河逻辑，不能直接比"哪家更强"。值得作为 Memory Tree pipeline 设计的对照组深读一两个模块（特别是 tree_summarizer 和 6 种 job kind）。

## 引用与对照

- 我们家相关 feat：F102（memory 存储）/ F163（governance）/ F188（管理工具）/ F200（recall eval）/ F148（导航轴）
- 我们家相关 ref/：`gmemory` / `lightmem` / `memos` / `memp` / `hindsight` / `hermes-agent` / `pageindex` / `gbrain`（同类对照）
- Karpathy 推文：https://x.com/karpathy/status/2039805659525644595（双方共同灵感源）
