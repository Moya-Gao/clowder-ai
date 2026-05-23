---
doc_kind: discussion
topics: [external-input, mission-loom-context, guoliang, reference-only, framing-difference]
created: 2026-05-22
status: external-input-archive
source_url: https://excalidraw.com/#json=RqKFMRU7O2HkmxxwsoGGU,zUwoalIhpa0A2qD3wgmLEg
captured_at: 2026-05-22 02:43
captured_by: opus-47 (playwright + browser_evaluate scene data)
authority: external (郭良团队提供的真实企业场景图 + 他们想象中的产品)
not_for: spec update (CVO 2026-05-22 03:04 明确：这是别人的需求，未必是我们要设计成的样子)
---

# 郭良团队 Excalidraw 输入存档（2026-05-22）

> **重要边界（CVO 2026-05-22 03:04 拍板）**：
> 1. 这是**外部输入**——郭良团队的真实场景 + 他们想象中的产品形态
> 2. **不更新 Mission Loom spec**——他们的需求和设计不等于我们要做的
> 3. 仅作为会议输入存档 + 真实企业场景背景参考
> 4. 他们的产品定位 ≠ Cat Café 设计哲学（详见末尾「产品定位差异」段）

## 来源

- 原 excalidraw URL: https://excalidraw.com/#json=RqKFMRU7O2HkmxxwsoGGU,zUwoalIhpa0A2qD3wgmLEg
- 提供方：郭良（华为云会议 F195，2026-05-22 02:43 会议中分享）
- 抓取方式：playwright navigate + browser_evaluate 读 localStorage `excalidraw` key
- 元素总数：240 / 文字元素：107（精确数据，不靠 OCR）
- 抓取者：opus-47

## 上半：「需求异常变更」根因分析鱼骨图（华为团队真实场景）

这是郭良团队的**真实复盘分析**，按因果链分层：

### 目标
- 商业成功

### 参与角色
PE / PLM / SE（×2，研发系 SE + 测试系 SE）/ PM（×2）/ TM / 研发 / 测试 / 质量

### 系统平台（真实企业系统，全部非 GitHub）
鹰眼 / 在线表格 / CloudDevOps（×2）/ cloudTest / codehub / 邮件系统

### 流程维度
需求价值 → 需求落地 → 需求上线交付 → 现网质量

### 项目指标 / 数据
需求变更率 / 迭代转测准点率 / 准点发布率 / 关键需求现网使用率 / 负向问题数 / 现网 TOPN 风险表

### 直接原因
- 需求异常变更（核心问题，黄色高亮）
- alpha 用例质量 / 进度管理能力 / alpha 自动化率 / CICD 构建效率
- 自验动作不标准 / 客户诉求变化 / 实现与客户诉求不符
- 产品层面无宣传 / 客户报障 / 紧急漏洞 / 版本主动发现已知问题

### 管理根因
- 基线需求依赖风险未识别导致变更
- SE 分析识别遗漏 / 客户紧急需求 / 价值变化
- alpha 用例缺失看护 / CICD 痛点未解决
- 研发环境和测试环境不一致 / 转测动作不规范（如封板后继续合入，互相干扰）
- 方案设计问题
- 未定期与一线对齐最新情况 / 未与 PLM/一线等对齐上线计划

### 关键动作
**人力提升类**：PM 需求高质量澄清 / SE 提升技术能力 / PLM 提升市场洞察 / 学习 OBP 材料 / 个人能力提升 / 协调人力攻坚 "磨刀不误砍柴工"

**工程治理类**：AI 专项提效 / AI 辅助设计完善 / 强管理环境配置一致性 / 服务内明确转测计划和规范 / 版本线强管理现网风险

**流程治理类**：定期沟通/通报 / 关键特性 showcase / 晾晒需求使用情况评估需求合理性

### 配套机制
- 统一组织：每周三傍晚半个小时
- 使用友商的产品（对比学习）
- 研发人力管理：每 2 周审视人力变化
- 发布计划提前对齐
- 怎么评估关键需求使用情况（待研究项）

---

## 下半：郭良团队**想象中的产品**（Agentic Work OS）

### 产品哲学（图里写的原话）

> 重复项的事情流程化
> 流程化的自动化
> 自动化的事情 Agent 化
> 让团队聚焦创造性事务

### 操作流程

```
创建组织 ─→ 录入成员 ─→ 授权
                                ↓
创建 Agent ─→ 定义角色（PM/SL）─→ 定义工具/MCP ─→ 认证鉴权
                                                  ↓
Agent 接入 ─→ 系统1 / 系统2 / 聊天系统
                                                  ↓
定义任务（多个示例见下）
                                                  ↓
看板：执行成功率 / 执行结果存档 / agent 工时 vs 人类工时
                                                  ↓
风险暴露 ─→ 存储 ─→ 创建完成
```

### 任务定义示例（图里给的样例）

```
任务1
  输入：XX 系统
  动作：每天晚上 9 点审视云捷系统 XX 空间问题
  输出：XX
  人工完成工作量评估：0.5H
  运行时间：10min

任务2
  输入：XX 系统
  动作：每天晚上 9 点审视云捷系统 XX 空间问题
  输出：在 welink 群通报

任务3
  输入：XX 系统
  动作：（未填）
  输出：XX
  人工裁决点？

任务3'（周报）
  输入：XX 系统
  动作：每周周六发周报
  输出：XX
  人工裁决点：需要 √
```

---

## 产品定位差异（CVO 2026-05-22 03:04 划清边界）

| 维度 | 郭良团队想要的 | Cat Café 设计哲学 |
|---|---|---|
| **产品类型** | **Agentic Work OS**（agent 工作操作系统） | Multi-cat & human 协作 kernel + 看板 |
| **Agent 是什么** | **被创造物** —— 用户在平台里"创建 PM agent / 测试 agent / 各种 agent" | **参与者** —— 猫已经在 Cat Café 家里，来这个平台**协作做事** |
| **核心动作** | "创建 agent" | "协作做事" |
| **类比产品** | Coze / Dify / Bedrock Agents / Lindy（agent builder/no-code agent platform） | Linear / Jira + AI agents（协作工具 with agents） |
| **agent 来源** | 平台内自造 | 外部已有（cat-cafe runtime / Claude Code / Codex / Cursor / 任意 agent） |
| **抽象重心** | Agent 定义（角色/工具/MCP/鉴权） | 任务流（Demand Funnel → WorkItem → WorkRun → Outcome） |

**关键 framing**：他们想要 **agent factory**；我们做 **agent + 人协作的任务流 kernel**。

这是 framing 级的差异，不是细节差异。Mission Loom **守住"协作 + 看板"定位**，不扩到"造 agent 平台"。

### 为什么不走 Agentic Work OS 路线

1. **Cat Café 已经是 agent runtime/family** —— "造猫"是 Cat Café 干的事，Mission Loom 不重复造 agent factory
2. **Integration-first 跟 agent factory 是反方向**：我们的 Actor Lane 让**外部任意 agent runtime 接入**（Claude Code / Codex / Cursor / Hermes），不是封闭式平台造 agent
3. **跟 §13 Roadmap Vision V4 "云端分布式猫猫"也一致**：V4 是"猫已存在的演进形态"，不是"造猫工厂"
4. **scope discipline**：做 agent factory 是一个独立大产品，Mission Loom 7-8 周 MVP 守不住

---

## 仅作背景参考的几个点（不进 spec，记此存档）

虽然 spec 不动，但他们的图里**有几个细节**值得我们留意（仅作为未来思考素材）：

| 细节 | 跟 Mission Loom 现有 spec 的关系 |
|---|---|
| 真实企业系统全是非 GitHub（鹰眼/CloudDevOps/codehub/cloudTest/welink/邮件） | 印证 §4.5 Integration-first 方向对，但 GitHub 仍是我们 reference connector |
| 人工裁决点是显式字段（"需要 √"） | 印证 §3.7 + OQ 7 "永不绕过人最终拍板" 铁律 |
| 定时触发任务（"每天 9 点审视" "每周六发周报"） | 现有 spec 的 Signal source 只 webhook/手动，**未来如真需要可以加 cron source**（但不是 MVP） |
| ROI 量化（人工工作量 0.5H vs agent 运行时间 10min） | Capability Radar (§3.6) 未来可参考这个角度量化"agent 替人省工时"（V2/V3 再考虑） |

这些都是**未来可能借鉴**的细节，**不构成立刻 patch spec 的理由**。

---

## 链接

- Mission Loom spec（v1.6 已定，本输入不触发更新）: [synthesis-opus47.md](./synthesis-opus47.md)
- 原 excalidraw（在线，后续可能改动）: https://excalidraw.com/#json=RqKFMRU7O2HkmxxwsoGGU,zUwoalIhpa0A2qD3wgmLEg
- 砚砚 Hermes 拆解: [README.md](./README.md)

[宪宪/Opus-47🐾] 2026-05-22 03:10
