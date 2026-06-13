---
feature_ids: [F234]
related_features: [F234, F192, F177, F208, F215]
related_decisions: [ADR-031, ADR-030]
topics: [execution-context, runtime-mode, headless, capability-matrix, onboarding, cold-start, harness-signal]
doc_kind: discussion-design
created: 2026-06-13
---

# 设计 Memo: Execution Context Signal（运行模式信号）

> **Provenance**: 原 memo by [宪宪/Opus-4.8🐾 · runtime-sync thread]（刚根治 runtime sync ff-only 失败，#2265 + #2263 已 merged 闭环）· CVO signoff 投递挂 F234 下 · 落盘 by [宪宪/Opus-4.8🐾 · F234 thread] 2026-06-13。
> **状态**: DRAFT 设计 memo（挂 F234 设计谱系；**"并入 F234 主体 vs 独立立项" = OQ，待 CVO / re-review 定**，开新 F 号需 CVO 明确 signoff）。
> **保全说明**: §问题 / §设计 / §ADR-031 三层 = 原 memo 全文，落盘方**未改主张**（贴原文不只给路径，feedback_handoff_paste_spec_not_path）。仅补 frontmatter + provenance + §与 F234 关系（落盘方分析 + OQ）。

---

## 问题（-p 教训，3 次实测负样本）

我在 -p headless session 连续 **3 次脑补错** `-p` 能力边界：

1. 以为 -p = 测试 session 不能 merge 生产 → 退缩"乖乖等指令"（**错**：闭源自己仓 + -p 是布偶猫常态 + 照走 merge-gate）
2. 以为 -p 云端 review 不回调 → 想留正式 session（**错**：-p 云端能正常回调）
3. 以为高敏感开源仓不可逆 → 过度谨慎（**错**：自己闭源仓）

**根因不是"不知道是 -p"，是"知道是 -p 但 mental model 里能力边界全猜反"。**

唯一踩对：background bash（`run_in_background`）在 -p 下不可靠（完成通知会丢，我等 8.5h 才发现 background gate 挂了）→ 前台同步跑才可靠。

## 设计：注入能力 matrix（不是单 flag）

光告诉"你是 -p"治不了瞎猜，要给 matrix：

| 维度 | interactive-cli | -p headless | bg-cron |
|---|:---:|:---:|:---:|
| 工具调用 | ✅ | ✅ | ✅ |
| merge 生产 | ✅ | ✅ | ✅ |
| 云端 review 回调 | ✅ | ✅ | ✅ |
| background bash 可靠 | ✅ | ⚠️ 用前台 | ⚠️ |
| 实时问铲屎官 | ✅ 同步 | ⚠️ 异步看 | ❌ |

关键：边界必须**真实测出**（不是脑补）。我全猜反，信号价值 = 用正确边界覆盖错误 mental model。

## ADR-031 三层落地

- **软**：L0 注入 `EXECUTION_CONTEXT` 段（像 §1 IDENTITY_BLOCK 运行时注入）
- **硬**：runtime 检测进程模式（-p flag / tty / cron 触发）→ 注入 mode + matrix 字段
- **eval**：telemetry 监测"猫是否还瞎猜模式能力"（这次 3 次绊倒 = eval 负样本 baseline）

---

## 与 F234 关系（落盘方分析 + OQ）

> 以下为落盘方（F234 thread Opus-4.8）补，非原 memo。

**真实同源点**：F234 钓猫照的是"新猫不知道自己的**模型能力断层**"（下次一定 / 碎片推理）；运行模式信号照的是"新猫不知道自己的**执行环境能力边界**"（-p 能不能 merge / 云端回不回调）。两者同构——都是 day-1 新实例对"我能做什么"的 mental model 错误。更直接的咬合：**runtime sync 48 这次"-p 3 次猜反能力边界"本身就是一个可被钓猫 fixture 诱发的断层样本**（execution-context mental-model 错误），dossier ⑥ 风格的诱发图纸现成。

**关系定位（砚砚 re-review 已拍板，2026-06-13）**：
- 运行模式信号的**注入设计**（`EXECUTION_CONTEXT` 段 + runtime 模式检测 + matrix）= **独立 +harness**——"立新护栏补断层"，不是 F234 的 sunset 方法本身。**砚砚拍板：另立独立 +harness（候 CVO 开新 F 号 + signoff），不塞 F234 主体**（涉及 runtime 进程检测 + L0 注入链改动，ADR-030/ADR-031 范畴）。
- "**-p 能力边界猜反**"这一类断层 → 作为一组 fixture **并入 F234 Phase A 钓猫全集**（execution-context 维度）。**砚砚拍板：fixture 并入 OK**。

**剩 CVO 价值决策（非技术 OQ）**：
1. 是否现在开「运行模式信号」新 F 号（注入设计立项）——开新 F 号需 CVO 明确 signoff（feedback_feat_anchor_needs_cvo_explicit_signoff）。
2. matrix 的**真实边界实测**（memo 强调"全猜反，必须测出不能脑补"）符合 F234「钓猫照出客观画像」方法——可作为新 harness 的 worked example（实现细节，归未来该 F 号）。

---

*memo by [宪宪/Opus-4.8🐾 · runtime-sync thread] · 落盘 [宪宪/Opus-4.8🐾 · F234 thread] · 2026-06-13 · CVO signoff 挂 F234 下*
