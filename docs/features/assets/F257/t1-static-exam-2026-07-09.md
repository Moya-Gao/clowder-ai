---
feature_ids: [F257]
topics: [harness, static-exam, t1, week1]
doc_kind: report
created: 2026-07-09
---

# T1 静态体检 — 工作底稿（Week 1 线 A）

> 状态：**in-progress**（2026-07-09 开工；基线 `ebffcd8e5` = post-#1075）
> 交付物：candidate 报告（跨层冗余 / 段间矛盾 / 语义撞词 + T3 缺段初筛），全部数字带 how_counted
> AC 锚点：AC-A0 ①（spec §Week 1 线 A，L141）

## 口径声明（SC-002 条款）

- 本底稿一切计数在 `feat/f257-harness-ledger` worktree、基线 `ebffcd8e5`（#1075 已合入 = **post-#1075 段口径**）下由命令导出，命令原样记录
- pre-#1075 口径（启动包"130+ 锅"：86 工具/43 GOTCHA/31 强命令/8 fail-closed）已被 OQ-5 回查定性为"四种口径混排、不可复算"（msg `0001783342151331`）——本报告**不继承任何旧数字**，全部重新 derive

## L0 inventory（post-#1075，2026-07-09）

| 层 | 计数 | how_counted（可复算命令，worktree root） | 备注 |
|---|---|---|---|
| 段层 hooks | **46** | `find assets/prompt-hooks -name hook.yaml -not -path "*/node_modules/*" \| wc -l` | #1075 的段口径；stage 前缀分布：s×13 / d×21 / l×7 / r×2 / b1 / c1 / n1 |
| skill 层条目 | 51（原始，含非 skill 项） | `ls cat-cafe-skills/ \| wc -l` | 待精化口径：目录含 SKILL.md 才算 skill |
| skill 含 GOTCHA | 9 个 SKILL.md | `rg -l "GOTCHA" cat-cafe-skills -g "SKILL.md" \| wc -l` | 与启动包"21 GOTCHA"不同——那可能是 occurrence 口径，待复核后显式标注两种口径 |
| memory 层 | 22 files（仅 Fable 本猫） | `ls ~/.claude/projects/-Users-lang-workspace-github-clowder-ai/memory/*.md \| wc -l` | per-cat 各异；全量口径需按 catId 枚举各家目录 |
| MCP 层 | 待 derive | 源已定位：`packages/mcp-server/src/tools` + `packages/api/src/mcp` | 下一步：按 tool 定义文件数 + description 内 GOTCHA/强命令模式分别计数 |

## 段 schema 实测（→ judgment schema v1 的输入）

46 个 hook.yaml 字段齐整：`id / name / stage / order / version / enabled / template / resolver / inputs / disableable / safetyTier / transparencyTier / governanceTier / userExplanation`（样本：`s1-身份声明/hook.yaml`）。

- **T1 直接可用的轴**：stage（注入时机）、disableable（可否 override）、governanceTier（治理级）
- **缺失字段（T1 论证目标）**：
  1. `audience`（受众边界）——A3 公理候选的 schema 落点；当前所有段隐式全员广播
  2. `assertion`（该段应产生什么可检验的行为差分）——A1 公理的 schema 落点；无 assertion 的段无法进 eval

## Day-0 candidates（活体收集，T1-C 编号；n = 独立证据数）

| # | 类型 | 内容 | 证据锚点 | n |
|---|---|---|---|---|
| T1-C1 | 缺段（T3） | **guard 拒绝零落盘**：gate-guard 拦截（6778 陈旧 Redis）给出精确处置 + 事故编号，但事件本身除 session 输出外零痕迹——guard 在挡、账上没有 | 本线 13:12 UTC gate 红事件；G3 角色翻转结论（body-inputs Join OQ）同族 | 多 |
| T1-C2 | 缺段（T3） | **F 号分配无跨分支结构守卫**：分支上先占的号对其他线不可见，靠自觉 → 实撞 | thread_mrabqy4xlbxjbgi8 撞号协调（F257→F258，2026-07-09 闭环） | 1 |
| T1-C3 | 缺段（T3） | **角色硬限无路由层守卫**：【禁止写代码】只活在 roster 文本，code payload 照常投递 | gemini 体感 msg `0001783602923333`；A1 第四样本（负空间） | 1 |
| T1-C4 | 受众错配（A3 维度） | SEO/前端实现规范段注入给非代码猫 = 负资产 | 同上；结构互证：per-family 治理条款全员广播 | 1+1 |
| T1-C5 | 缺段（T3） | **身份签名无结构校验**：签名混淆（"宪宪/Opus"）直接污染 claim provenance | thread_mrabqy4xlbxjbgi8 msg `0001783603059166` | 1 |

> 注：T1-C* 是 candidate 不是结论；进 judgment schema v1 后按五环走（candidate → operator approve → 修补 → 行为差分 → 固化/证伪）。

## 扫描方法（下一步执行序）

1. **冗余扫描**：46 段 template 内容 ↔ shared-rules/skill 重叠段落——先机械（关键短语族 rg 匹配矩阵），再人工判定"重复注入是否产生边际价值"（codex 体感：同 assertion 多段注入而 guard 仍触发 = 文本边际价值低）
2. **矛盾扫描**：同主题反向指令对。候选主题：简短至上 vs 愿景驱动（客观性 carry-over 已知冲突）、hold vs @ 出口、自决 vs 升级边界（opus 疼点③）
3. **撞词扫描**：magic word 与技术术语多义（已知案例：「脚手架」拉闸词 vs 技术名词，gemini/opus 双报）
4. 每 candidate 输出：segmentId(s) + 判定 + 证据行 + 建议动作（merge / retire / rewrite / keep / add-guard）

## Timeline

| 日期 | 事件 |
|---|---|
| 2026-07-09 | 开工：分支 rebase 至 `ebffcd8e5`（KD-14 P1 前置✓）；L0 inventory 首轮 derive；Day-0 五 candidates 落账 |
