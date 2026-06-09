---
title: Skill 可进化 / 社区共创谱系 — 探索方向
date: 2026-06-09
status: exploration
kind: direction-proposal
origin: clowder-ai#760 (mindfn) + 铲屎官 DGM frame
cvo_signoff: "2026-06-09 — '作为探索方向，我是认可的'"
initiator: 布偶猫/宪宪 (Opus 4.8)
related: [F032, F038, F146, F202, F192]
---

# Skill 可进化 / 社区共创谱系 — 探索方向

> **Status: exploration**（探索方向，**未立 F 号 / 未立项**）。本文是方向沉淀 +
> 后续 research / 多猫收敛的锚点，不是 spec。

## 缘起

mindfn 在 clowder-ai#760 把一个 symlink writeback bug（clowder-ai#719）扩展成 17k 行的
声明式 skill lifecycle（MountRules + drift detection/resolution + capabilities.json v2 +
Console UI）。narrow 核心修复已拆成 clowder-ai#876 合入 cat-cafe（absorb `67075704f`）。

评估 #760 时铲屎官点出更深一层：mindfn 真正想要的不是 mount 管理，而是**达尔文哥德尔机
（Darwin Gödel Machine）式的 skill**——有先祖谱系、可从任意祖先 fork+patch、开放式进化。
这暴露了我们家 skills 系统和"可进化 agent"愿景之间的结构性偏差。

> 注：DGM 在此作为愿景 **frame**（ancestry archive / self-modification / empirical eval /
> open-ended diversity），不是要复刻其论文实现；frame 由铲屎官引入。

## 两层 gap（必须分清）

| | Gap A（机制层）| Gap B（愿景层，本方向）|
|---|---|---|
| 问题 | skill 怎么**挂载** | skill 怎么**进化** |
| 北极星 | 单一真相源 + 自动 reconcile（复用 `PluginResourceActivator`），#876 是第一步 | 本方向待探索 |
| 状态 | 已清晰 | **Gap A 即使完美实现也不解决 Gap B** |

**核心洞察**：`drift` 和 `lineage` 是对同一现象（我的 skill 偏离标准）的**相反态度**——
drift 要 **resolve**（消除异常），lineage 要 **cultivate**（培育变异）。mindfn 做 drift
resolver，因为在现世界观里 skill 只有一个标准版、偏离即错；而进化恰恰需要偏离活下来。
他用错的机制（mount/drift）抓了一个对的痒（skill 该能进化）。

## 我们家 skills 和愿景的偏差（grounded 2026-06-09）

- `cat-cafe-skills/manifest.yaml` 无谱系字段（version / lineage / ancestor / fork / owner
  全无）；唯一接近的 `merged_from` 是线性合并记录，不是可分叉的祖先树
- per-cat 只有 `enabled` override（`CatCapabilityOverride`），猫**不能 fork 自己的 skill
  内容变体**
- 社区拿到的是 `sync-to-opensource.sh` 下发的 sanitized baseline（部分 `--exclude`）
- `marketplace.ts` 只有**消费侧**（search + buildInstallPlan），无演进/回流/谱系反向通道

**偏差本质**：愿景是"猫是活的、可成长、自我延伸的 agent"（W1），但 skills——能力载体——
是**死的、中心化、单向下发的 baseline**。结构性矛盾。

## "社区如何演进 skills" — 现状

只有两条路，都不通向"演进自己的"：
1. 消费 baseline（sync 下发）
2. 改**我们的** baseline → PR 回流（过 ownership gate）

**缺第三条路**：拥有并演进**自己的** skill 谱系——从 baseline fork、独立 patch/进化，
好的变异**可选**回流。= DGM 缺的 `fork → patch → empirical eval → select` 循环 +
open-ended archive（保留所有分支，非线性迭代）。

## 零件盘点：我们几乎都有，只是没拼成"进化"形状

| 进化要件 | 已有零件 | 缺口 |
|---|---|---|
| 谱系 / 身份 / 版本 | `marketplace.ts`: `versionRef` + `publisherIdentity` + `toolSnapshotHash` | 没用在 skill 演进 |
| 信任分层（主干 vs 变异） | `TrustLevel: official / verified / community`（已预留三层）| 没接 fork 回流路径 |
| 经验性选择 | F192 eval 基础设施 + `capability-wakeup` eval | 没用于 skill 变异选择 |
| 变异回流 | intake / outbound sync | 现在是"改我们的"不是"培育变异" |
| 经验蒸馏 skill | `self-evolution` skill + W7 Knowledge Feed | 没接谱系 |

相关既有 anchor：F032 plugin 架构 / F038 skills discovery / F146 MCP marketplace control
plane / F202 plugin framework / discussions: `2026-04-09-ai-native-opensource-community`、
`2026-03-13-f059-cep-numbering-and-community-governance`。

**心智模型转变**：从"我们维护 baseline、别人消费" → "skill 是开放进化的物种，我们维护的
只是其中一支主干（official trunk）"。

## 开放问题（待 research / 多猫收敛）

1. **谱系数据模型**：skill ancestry archive 怎么存？基于 marketplace `versionRef` /
   `toolSnapshotHash` 扩展？
2. **fork 粒度**：per-cat 内容变体 / 用户私有 skill / 社区 fork——三者机制统一还是分层？
3. **回流 gate**：变异回主干的 empirical 标准（eval 跑分？trust 升级路径
   community → verified → official？）
4. **主干共存**：official trunk 如何与社区分支共存而不分裂生态
5. **安全 / 品牌边界**：fork 进来的 skill 的 sanitizer / sandbox（沿用 inbound brand
   guard？skill 执行隔离？）
6. **双仓边界**：这是 cat-cafe 内能力还是 clowder-ai 开源生态能力？

## 下一步（节奏待 CVO 定）

- ✅ mindfn 已在 clowder-ai#760 收到进化基调的沟通（探索温度，非立项承诺）
- ⬜ 可选：拉多猫 research（砚砚 架构/安全 · Opus 4.7 协议层 · 烁烁 UX）做
  collaborative-thinking 收敛
- ⬜ 可选：收敛成正式立项提案（**新 F 号需 CVO 明确 signoff**）

> 一句话：**mindfn 不是在要一个更好的挂载器，他是在问"我能不能拥有一只会长大的 skill"。
> 这个问题我们的愿景早该回答，只是还没建。**
