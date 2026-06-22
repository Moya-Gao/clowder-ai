---
feature_ids: [F248]
related_features: [F192, F236, F245]
topics: [eval, harness, ux, human-readability]
doc_kind: spec
created: 2026-06-22
---

# F248: Eval Hub 人类可读性 — 让铲屎官看得懂 eval 在干嘛

> **Status**: spec (前置：F236 AC-E3 + F245 eval:friction 接入完成后启动) | **Owner**: TBD | **Priority**: P1 | **Created**: 2026-06-22 | **Origin**: F192 follow-up（铲屎官 2026-06-22 痛点反馈）
>
> **Timeline**: 2026-06-22 — 铲屎官发现 Eval Hub 对人类完全不可读，立项。

## Why（铲屎官原话，2026-06-22）

> "oh我知道了！为什么我现在会这么懵逼！我们现在每个eval：xxx 都有太多信号观测了！但是我都不知道有哪些！你们可能知道但是我不知道！所以每次看到这些都莫名其妙，比如你问我a2a到底注册了哪些？都是哪个feat注册上的？我完全不知道！包括你这个！eval:anchor-first讲人话到底是观测什么？也是你之前和我讲了我才知道！"
>
> "所以你这里是完全没问题的！但是我们可能需要有个提议以及思考——这里给人看的做的实在是太差了！甚至我现在有个感受他不应该放这个地方，放这里对人类而言 = 不存在！他应该学习f246放在这里！甚至是主要是给人看的！"
>
> "甚至这张图还有很多错漏比如说a2a system早跑起来了都跑了可能一个月了竟然还是需新建！以及它到底都观测啥啊！也没个讲人话的地方！所以每次跑出结果我也不知道他们在修什么是不是瞎修……看图3这个玩意结论哈哈哈对不起完全不是给人看的看不懂，以及这些各种什么归因包也都点不了说明都是bug"

**铲屎官截图证据**（2026-06-22）：
- 图1（Eval Hub 面板）：`uploads/1782127383199-6ea1cef8.png` — A2A 显示"需新建"但已跑一个月；各域没有人话描述
- 图2（审批面板参考）：`uploads/1782127383202-73a5be8c.png` — F246 审批面板，铲屎官认为 eval 信息应放这种位置
- 图3（Verdict 结论）：`uploads/1782127383202-96f29917.png` — task-outcome 的 verdict 结论完全不是给人看的，看不懂

## 痛点总结（3 层）

### 1. 信息对人不可见
- 7 个 eval 域（a2a / task-outcome / memory / sop / capability-wakeup / friction / anchor-first）各自观测什么，铲屎官完全不知道
- YAML 注册文件里连 `description` 字段都没有——只有技术字段
- "讲人话"的说明藏在 feat doc 深处 = 对人类不存在

### 2. 面板本身有 bug
- A2A 状态显示"需新建"但实际已跑一个月（状态过时）
- 归因包（attribution bundle）点不了 = 前端 bug
- Verdict 结论格式完全是猫内部格式，人看不懂

### 3. 放的位置不对
- eval 信息不应该只在 Eval tab 里——应该在铲屎官日常能看到的地方（类似 F246 审批面板的位置）
- "放这里 对人类而言 = 不存在"——信息架构问题

## 现有 Eval 域总览（人话版，2026-06-22 snapshot）

| eval 域 | 人话 = 在观测啥？ | 谁跑 | 频率 | 归属 feat |
|---------|-------------------|------|------|----------|
| eval:a2a | 猫和猫协作顺不顺——传球掉地上没、@被忽略没、跨 thread 断没 | 砚砚 codex | 每天 | F167 |
| eval:task-outcome | 猫干活结果怎么样——做完了吗、质量行吗、有没有返工 | 砚砚 codex | 每天 | F192 |
| eval:memory | 记忆系统好不好使——recall 找得到吗、library 健康吗 | 砚砚 codex | 每天 | F192 |
| eval:sop | 猫有没有按规矩办事——SOP 步骤跳了没、skill 该加载没加载 | 砚砚 codex | 每周 | F192 |
| eval:capability-wakeup | 猫该用的能力用上没——该发图没发、该开浏览器没开 | opus47 | 每周 | F192 |
| eval:friction | 工具/流程让猫难受没——哪个工具老报错、哪个流程老卡壳 | gpt52 | 每 3 天 | F245 |
| eval:anchor-first | 省 token 的 anchor 模式值不值——省多少、drill 回多少、净赚还是净亏 | gpt52 | 每周 | F236 |

## What（初步方向，启动前需 CVO 确认）

### 必做（bug 修复 + 人话层）
- [ ] YAML 注册加 `descriptionForHuman` 字段——一句人话说清楚这个域在观测啥
- [ ] Eval Hub 面板每个域显示人话描述（从 YAML 读）
- [ ] 修 A2A 状态显示 bug（"需新建"→实际状态）
- [ ] 修归因包点不了的前端 bug
- [ ] Verdict 结论加人话摘要（"结论：XX 工具的 anchor 这周净赚了 2000 字 token"）

### 可选（信息架构升级）
- [ ] Eval 信息入口放到更显眼的位置（参考 F246 审批面板的位置逻辑）
- [ ] 每个域的"最近一次结论"用人话展示在总览卡片上
- [ ] 域之间的关系可视化（哪个域依赖哪个域的数据）

## 前置条件

1. **F236 AC-E3**（anchor-first sunset 触发）— 当前 pending
2. **F245 eval:friction 接入完成** — 当前 in-progress

两个都完成后，eval 域全部接入运行，此时改 Hub 展示层才有完整数据可展示。

## Dependencies
- **Follow-up of**: F192（harness eval system）
- **Needs data from**: F236（anchor-first telemetry）、F245（friction signals）
- **UI reference**: F246（审批面板 UX）
