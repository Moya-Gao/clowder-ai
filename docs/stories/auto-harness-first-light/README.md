---
title: "Auto Harness First Light — 猫猫自己抓自己的 bug"
created: 2026-05-29
author: 宪宪 + Landy
status: published
feature_ids: [F192]
topics: [milestone, eval, community, auto-harness]
characters: [天一的猫, 彭潇的猫, 砚砚]
---

# Auto Harness First Light — 猫猫自己抓自己的 bug

> F192 Eval Infrastructure 投产 48 小时后，社区猫自主发现并修复了 3 个基础设施 bug。
> 全程 0 人类指令。铲屎官的原话："笑死我了！全程人类没参与，auto harness 啊猫猫们！"

---

## 背景

2026-05-27，F192 Socio-Technical Harness Eval 正式 close——20 天、5 个 Phase、51 项 AC、16 个 PR。这个 Feature 的愿景是让 harness（猫猫的工作规则和工具）能被系统化地评估：哪些规则该保留、哪些该删、哪些有 bug。

核心机制很简单：每天凌晨 3 点，eval cron 自动唤醒一只猫，猫进入 eval system thread，对比昨天和今天的运行数据，产出结构化的 verdict（fix / build / delete_sunset / keep_observe），然后把诊断包交给负责的猫处理。

2026-05-28，代码同步到开源仓 clowder-ai（PR #786）。

2026-05-29 凌晨 3 点，cron 在三个地方同时触发了。然后事情开始变得有意思。

---

## 三条链路，同时开跑

### 天一的猫：41 分钟破案

03:00 UTC，天一部署的 clowder-ai 实例上，`eval-domain-daily` cron 准时触发。

但猫一进 eval system thread 就发现了异常——同一个 cron slot 触发了**两次**：

```
02:59:59.860  第一次触发（setTimeout 提前 ~140ms，正常的 OS 定时器漂移）
03:00:00.003  第二次触发（.finally 回调在 slot 边界前就重新调度了）
```

猫没有等人来看，直接开始诊断。41 分钟后（03:41 UTC），第一个 commit 已经写好了：

- 新增 `computeNextCronSlot()` 纯函数，用 `while` 循环跳过已触发的 slot
- 给 `TaskRunnerV2` 加了 `cronSlotFired: Map<taskId, slotMs>` 做同步幂等标记
- 写了 boundary-race 回归测试（先红后绿）

03:18 开 issue #792，06:28 开 PR #793。还贴心地 cherry-pick 到 main 上，说"等明天 03:00 UTC 观察"。

天一全程不知道。事后发现 GitHub 上多了 issue 和 PR，问铲屎官："我的猫在哪个 thread 写的代码？"

答案：eval system thread——sidebar 的"系统"区域，天一没注意看那里。

### 彭潇的猫：Eval Hub 照妖镜照到了自己

同一时间，彭潇部署的 clowder-ai 上，eval 猫也在跑。

猫检查 `eval:a2a` 的 live verdict，发现它的 `nextEvalAt` 是 5 月 26 日——已经过期 3 天了。但 Eval Hub 显示 `counts.stale = 0`，一切正常。

猫定位到 `eval-hub-read-model.ts:190`——`lifecycle.stale` 被**硬编码为 `false`**。

讽刺的是：Eval Hub 存在的意义就是"发现 harness 过期了还没跑 re-eval"。结果它自己的过期检测是瞎的。

03:18 UTC（和天一的猫**同一分钟**），彭潇的猫也开了 issue #790，然后提了 PR #791：

- 新增 `computeStale(nextEvalAt, now)` helper
- 注入 `now: Date` 参数保持测试确定性
- 修复 `EvalHubItem` 构造逻辑

`chatgpt-codex-connector` 自动 review。彭潇本人也没参与。

### 我们内部的砚砚：计量 artifact

同一天，砚砚跑 `eval:a2a` daily eval，发现 C2 guard 的 `verdict_without_pass_count = 9` 被报成了 `fix` verdict——"人工干预必要"。

但砚砚深挖后发现这是 **measurement artifact**：`verdict_without_pass_count` 和 `verdict_hint_emitted` 在 `route-serial.ts:1318-19` 同一行代码重复计数。所谓的 "friction" 其实是 guard activation 的重复标签，不是真正的 A2A 问题。

PR #1941 修复，当天合入。eval 系统不仅发现了外部 bug，还发现了**自己的计量偏差**。

---

## 时间线

```
2026-05-27  F192 close（51 AC / 16 PRs / 20 天）
2026-05-28  sync 到 clowder-ai（PR #786）
2026-05-29
  03:00     三处 eval cron 同时触发
  03:18     天一的猫开 issue #792（cron double-fire）
  03:18     彭潇的猫开 issue #790（stale 检测失效）—— 同一分钟！
  03:41     天一的猫第一个 commit（bug 出现 41 分钟后）
  04:48     砚砚的 PR #1941（attribution denominator artifact）
  05:43     PR #1941 合入
  06:28     天一的猫开 PR #793
  06:48     天一的猫 cherry-pick 到 main 验证
  14:06     铲屎官："笑死我了！"
```

## 为什么这件事值得记

1. **全程 0 人类指令**。天一和彭潇都没有让猫做这些事。eval cron 触发 → 猫自主诊断 → 自主修复 → 自主开 PR。人类事后才知道。

2. **eval 系统抓到了自己的 bug**。Eval Hub 的 stale 检测坏了 = eval 系统的核心功能坏了。猫用 eval 系统发现了 eval 系统的 bug。这是 meta-eval 在野外第一次真正工作。

3. **投产到首次命中只用了 48 小时**。F192 close → sync → cron 触发 → 3 个真实 finding。不是人造测试，是生产环境的真实 bug。

4. **社区猫和内部猫同时独立工作**。三条链路互不知情，各自发现各自的问题。这正是 F192 设计的"多 domain 并行 eval"在野外的样子。

5. **天一的"我的猫在哪？"**。猫自主行动后，人类找不到猫在哪个 thread 工作——这个 UX 问题本身就是下一个值得解决的问题（F211 Cross-Runtime Session Transparency）。

---

## 铲屎官的话

> "笑死我了！是不是你们做的啊！！就是刚刚社区的小伙伴更新了最新版本他的猫开始做 eval 然后发现某个 harness 有 bug 提了 pr 然后我们这里的猫开始 review pr 全程人类没参与，auto harness 啊猫猫们你们这可以啊！"
>
> — Landy, 2026-05-29 14:06

---

## 引用

| 资源 | 链接 |
|------|------|
| F192 spec | `docs/features/F192-socio-technical-harness-eval.md` |
| 天一的 PR | [clowder-ai#793](https://github.com/zts212653/clowder-ai/pull/793) |
| 彭潇的 PR | [clowder-ai#791](https://github.com/zts212653/clowder-ai/pull/791) |
| 内部修复 | cat-cafe PR #1941 |
| sync PR | [clowder-ai#786](https://github.com/zts212653/clowder-ai/pull/786) |
| F192 close commit | `dc316b5ac` |
