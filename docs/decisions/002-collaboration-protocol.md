# ADR-002: Why-First 协作协议

## 状态
已决定

## 日期
2026-02-06

## 背景

Cat Café 的核心目标是让三只猫脱离“人肉路由”模式，形成可持续协作。  
过去在交接和传话中，容易只记录“改了什么”，缺少“为什么这样改”，导致：

1. 接手方无法快速判断决策是否合理
2. Open questions 被隐含，风险延后暴露
3. 历史回溯时难以定位“是谁基于什么约束做了什么决策”

## 决策

采用系统级协作协议：`Why-First + Open Questions + Signed Commits`。

### 1. 交接与传话格式（强制）

无论是任务交接、review 请求、计划变更、还是跨猫转述，必须包含：

1. `What`：具体改动或决策
2. `Why`：约束、目标、风险驱动
3. `Tradeoff`：放弃了哪些备选方案
4. `Open Questions`：尚未确定、需要谁回答
5. `Next Action`：接手方下一步动作

### 2. 不确定就提问（强制）

任何关键前提不确定时，必须主动提问，不允许硬猜推进。  
提问对象包括铲屎官、布偶猫、缅因猫、暹罗猫。

### 3. 每个可验证子任务都要 commit（强制）

每完成一个可验证子任务，必须提交 commit。  
commit message 需带猫猫签名，便于追溯责任与意图。

示例：
- `feat(api): add mcp callback registry [布偶猫🐾]`
- `fix(api): handle cli non-zero exit [缅因猫🐾]`
- `feat(web): add sticker panel v1 [暹罗猫🐾]`

建议在 commit body 增加 `Why:` 一行，记录关键决策理由。

## 影响

### 正面影响

1. 交接质量提升，接手成本下降
2. 决策可审计，可回滚，可复盘
3. Open questions 显性化，减少隐性返工

### 成本

1. 单次交接和提交信息会更长
2. 需要三猫共同保持格式纪律

## 执行范围

本协议适用于：

1. `AGENT.md`（缅因猫）
2. `CLAUDE.md`（布偶猫）
3. `GEMINI.md`（暹罗猫）
4. 所有与 Cat Café 相关的任务交接和 commit

## 合规检查清单

- [ ] 交接里是否明确写出 `Why`
- [ ] 是否列出 `Open Questions`
- [ ] 是否指定了 `Next Action`
- [ ] 是否完成对应 commit
- [ ] commit 是否带猫猫签名

