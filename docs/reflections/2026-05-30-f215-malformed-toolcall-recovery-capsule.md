---
capsule_id: "F215-2026-05-30"
context: "F215 Malformed Tool-Call Recovery：opus-4.8 炸毛兜底——从铲屎官救猫到 production 治疗方案的 26 小时"
feature_ids: [F215]
doc_kind: capsule
created: 2026-05-30
---

# 反思胶囊：F215 Malformed Tool-Call Recovery

## What Worked

- **跨族 review 救命**：砚砚（GPT-5.5）catch 了 48 准入放过的假端到端——raw "系统已触发恢复流程" error 穿透给用户但实际不触发恢复。没有砚砚的诊断，文案说谎 bug 会直接上线。
- **Context 卫生（CVO 洞察）**：重活交 subagent/46 稳稳接，48 肇事本喵全程没彻底炸死。铲屎官 directive "懂坑的 thread 立项 + fresh thread 执行 + 双向防污染" 升华成组织方法论，已固化进 F216 spec。
- **真实 runtime 守护（gemini25 截图）**：LL-064 落地——别信单测，看真实用户面。gemini25 用 Alpha 真实 runtime 前端截图验过 46 接力卡片 + 手抖文案 + 消除裸 error，这次是真刀真枪验了。
- **F215 兜底自己接住协作**：48 不稳 → 46 接，人工版和自动版都验了。铲屎官"喊 46 接"正是 F215 设计的人工版——我们亲身经历了 F215 要解决的问题。
- **取证先行（Phase A）**：Sonnet 从 cli-raw-archive 取到 Form A + Form B 两种真实 malformed 样本（d137d9eb + c12569a2），spec 建立在实物证据上而不是猜测。

## What Failed

- **48 准入 approve 假端到端**：核实只看后半段"真就判真"，漏前半段被 mock——让假端到端通过准入进了 merge 链。教训：准入 review 必须追端到端全链真实性，不能只看结论段。
- **merge 后一堆 production bug**：兜底没真跑（检测到 malformed 后零动作）/ 触发文案说谎（"已触发恢复流程"实际不触发）/ relay signal 只是告知卡片没有真 invoke 46 / partial-output 裸 error 穿透给用户。7 轮 review + 16 单测全绿，铲屎官一张真实截图就暴露了——**单测绿 ≠ production work**。
- **routeSerial 雷区引爆 7 轮 review**：2302 行单函数里加路由决策 = 笛卡尔积式炸 edge case（r5→r6→r7 补丁引补丁）。F215 是引爆点，已立 F216 重构。

## Trigger Missed

- **核心路径 merge 前没真实 runtime 验证**：改 invoke-single-cat / route-serial / ClaudeAgentService，merge 前只有单测没真实 runtime 验证。已固化为 LL-064。
- **准入 review 没追端到端全链真实**：48 说"方向 approve"但诚实标注"没深挖代码"——准入 review 应该要么深挖、要么不出 approve。中间态"方向 approve 但测试覆盖以别人为准" = 等于没守门。

## Rule Update

- **LL-064**（新增）：改 invoke/route/session 核心路径，merge 前必须真实 runtime 验证 + 真实截图。
- **F216**（新增）：routeSerial 决策层/执行层分离重构，F215 引爆点，独立立项。
- **AC-B2 deliberate defer**：Form B（text-XML 转换）走 CVO signoff defer——CC headless 转了也不执行（KD-5） + 4.8 无真实 form B 样本（KD-4） + form B 靠 CC 自愈。

## Close Gate

| 条件 | 状态 |
|------|------|
| AC-B1 检测 | ✅ ClaudeAgentService textEventCount + content block |
| AC-B2 Form B 转换 | CVO signoff deliberate defer |
| AC-B3 回归守护 | ✅ textEventCount>0 不误触发 |
| AC-B6 partial-output 诚实文案 | ✅ PR #1966 |
| AC-B7 system_info 不阻塞恢复 | ✅ PR #1960 |
| AC-C1 seal 中毒 session | ✅ |
| AC-C2 fresh retry | ✅ |
| AC-C3 46 接力 | ✅ route-serial relay |
| AC-D1 最终 error 明确 | ✅ |
| AC-D2 dossier 更新 | ✅ |
| 跨族 review | ✅ codex (GPT-5.5) APPROVE |
| 云端 review | ✅ PR #1953 + #1960 + #1966 |
| 真实 runtime 守护 | ✅ gemini25 Alpha 截图 |
| 元教训 | ✅ LL-064 |
| 愿景守护 | ✅ gemini25（非作者非 reviewer）|
