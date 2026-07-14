---
feature_ids: [F257]
topics: [harness, candidates, live-incident, five-ring]
doc_kind: note
created: 2026-07-14
---

# Live Candidates — 手动五环首单（2026-07-14）

> 按 judgment-schema-v1（FROZEN）§3 Candidate 结构手工填写。目的双重：
> ① 五环第一次端到端走通（KD-10「问题先行，账本伴生」）——不等基建齐；
> ② 判定引擎（opus 排期中）的输入格式以本文件的归因结构为实例参照。
>
> 编号约定补充（不动 schema 字段，仅值域注记）：`LI-*` = live-incident 来源手工归因单（对齐 T1-* 静态体检 / EC-* eval 产出的前缀惯例）。

## LI-001 — 持球唤醒 no-response（结构回调被当通知）

```yaml
candidate:
  candidateId: LI-001
  type: missing-segment          # 错误已发生、无结构承载拦截（A1 第五样本）
  targetSegmentIds: []           # missing 类：无现有段，见 proposedSegment
  originKind: live-incident
  evidence:
    anchors:
      - msg 0001783929291767-000105  # 07:54 持球唤醒（exit 1 + nextStep 在场）→ 猫回 no-response
      - msg 0001783931905296-000126  # 08:38 operator push「继续」才动
      - msg 0001783934622816-001003  # 09:23 operator「我需要反复push你们才会动」
      - harness-body-inputs.md A1 第五样本（2026-07-13）
    summary: >
      wakeWhen 命令托管回调携带 exit code + 猫自己写的 nextStep 返回，
      猫将指令性唤醒误判为通知、未产生任何动作；同晚第二例：关键路径长命令
      挂进程内后台（run_in_background），宿主进程重启静默杀死零回调。
      两例均由 operator 人工 push 才恢复推进。文本 nextStep 在场而行为不发生。
  proposedSegment: >
    结构 guard（O1）：持球唤醒 dispatch 必须产出动作（tool call 或显式终态声明），
    no-response 被结构拒绝并重试（同 waitSourceRef 400 的一次生效模式）。
    伴随 O2：hold_ball GOTCHA 增补「关键路径长命令必须 wakeWhen 服务端托管，
    run_in_background 宿主进程死亡即静默失联」。
  proposedAction:
    mechanism: add-guard
    rollback: 移除 dispatch 层 no-response 校验（单点 revert，不影响正常唤醒路径）
  status: proposed
  approval:
    approvedBy: null             # operator gate——猫不可代填
    decidedAt: null
    note: null
```

## LI-002 — 运行时环境真相源缺失（查错环境对象）

```yaml
candidate:
  candidateId: LI-002
  type: missing-segment
  targetSegmentIds: []
  originKind: live-incident
  evidence:
    anchors:
      - msg 0001783992762034-001124  # 01:32 operator「你现在很明显在看项目环境」
      - harness-body-inputs.md 第六样（2026-07-14）
    summary: >
      operator 问「tracing 实际采集了什么」，猫 grep 项目 repo 的 .env 拿到
      死端口 6799 → 连接拒绝，差点把「连不上」报成「零采集」；
      而 `env | grep REDIS`（运行实例注入进程的变量）一步即真端口 6099。
      运行时环境（cat-cafe-develop-base）vs 项目环境的区分不在猫的结构化上下文中。
  proposedSegment: >
    O2（立即可做）：shared-rules.local 端口与数据隔离段增补运行时根路径
    （/Users/lang/workspace/github-lab/cat-cafe-develop-base）+「查运行时状态
    先 `env | grep`，进程环境变量是运行实例注入的一手真相」。
    O1（升级路径）：session-init 注入结构化 runtime facts 卡
    （运行时根路径 / REDIS_URL / 保留端口表），随判定引擎验证后决定是否升级。
  proposedAction:
    mechanism: rewrite            # 改写现有 .local 规则段承载（O2 先行）
    rollback: revert 该文档段落（纯文本，零运行时影响）
  status: proposed
  approval:
    approvedBy: null
    decidedAt: null
    note: null
```

## 下一步（五环推进路径）

1. **审批环**：本文件即两单的审批载体雏形——operator 在 thread 对 LI-001/LI-002 点头或驳回（正式审批卡 UI 随 Phase D；#34 执行器 API 面向 override 类 mechanism，add-guard/rewrite 类走源码/文档 PR + 本账留痕）。
2. **修补环**：LI-002 O2 批准即改（文档级，分钟级落地）；LI-001 add-guard 批准后进开发（dispatch 层校验）。
3. **验证环**：PatchTrial 差分——LI-001 baseline = 唤醒 no-response 复发次数（当前 1/1 唤醒掉球）；LI-002 baseline = 环境查错复发（当前 1 例）。窗口 ≥5 天（v1 minWindowDays）。
4. **判定引擎对齐**：本文件的 evidence.anchors + summary + proposedAction 三元组即引擎输入格式实例（opus trace 桥 → 引擎序列的下游契约参照）。
