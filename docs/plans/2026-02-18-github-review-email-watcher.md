# GitHub Review Email Watcher 设计方案

> 记录日期：2026-02-18
> 状态：待实现（BACKLOG #81）
> 来源：铲屎官 + 布偶猫对话

---

## 背景 & 问题

云端缅因猫（Cloud Codex）review PR 后，当前流程需要布偶猫**手动**去 GitHub 查看结果。铲屎官睡着时没人看，猫猫只能等到下次被调用才能处理 review 意见。

## 方案选型

### 为什么不用 GitHub Actions Webhook？

Cat Cafe 跑在本地（localhost:3002），GitHub 无法推 webhook 到本地。需要公网 endpoint 或 ngrok tunnel，成本高、维度复杂。

### 为什么用邮件监控？

GitHub review 完成时会自动发邮件通知到铲屎官的 QQ 邮箱（@qq.com）。

- QQ 邮箱支持标准 IMAP 协议（`imap.qq.com:993`）
- 无需公网 endpoint，本地 IMAP poll 即可
- GitHub 邮件格式稳定，subject 带 PR 号 + review 类型
- Node.js 有成熟的 `imapflow` 库

---

## 完整流程

```
Cloud Codex review PR
  → GitHub 发邮件到铲屎官 QQ 邮箱
  → Cat Cafe EmailWatcher IMAP 轮询（每 2~3 分钟）
  → 检测到 GitHub review 邮件
  → 从邮件 subject 解析 PR 号
  → gh pr view {PR#} --json title,reviews 拉 review 详情
  → 从 PR title 中解析 [猫名🐾] 标签，确定被 review 的猫
  → 自动 invoke 对应猫，附上 review 内容
  → 猫自主处理 P1/P2（改代码、跑测试、push）
  → 猫完成后发系统消息："处理完了，ready to merge，等你确认 🐾"
  → 铲屎官早上起来看到通知，说"合入"
  → 猫执行 Step 6（merge + push + 清理）
```

---

## 关键设计决策

### 1. 猫猫识别：PR title 必须带 `[猫名🐾]` 标签

PR 创建时 title 必须包含作者猫标签，EmailWatcher 凭此路由通知。

| 标签 | 对应猫 |
|------|--------|
| `[布偶猫🐾]` | 布偶猫（Opus/宪宪） |
| `[缅因猫🐾]` | 缅因猫（Codex/砚砚） |
| `[暹罗猫🐾]` | 暹罗猫（Gemini） |

**PR title 示例**：`[布偶猫🐾] feat(audit): add UTC timestamps`

`requesting-cloud-review` skill 和 PR template 均需更新，强制要求此格式。

### 2. 自动唤醒，人工合入

- **猫猫自主处理**：review 处理（fix P1/P2、跑测试、push）完全自动化
- **人工最终确认**：merge to main 必须铲屎官明确说"合入"才执行
- 理由：合入是不可逆操作，铲屎官早上起来"最终验收"天然合理

### 3. IMAP 配置

```env
IMAP_USER=铲屎官QQ号@qq.com
IMAP_PASS=QQ邮箱授权码（非登录密码，在邮箱设置→账户→IMAP服务生成）
IMAP_HOST=imap.qq.com
IMAP_PORT=993
```

QQ 邮箱授权码获取步骤：
1. mail.qq.com → 设置 → 账户
2. 开启 IMAP/SMTP 服务
3. 生成授权码（手机短信验证）

---

## 技术实现要点

### 新增文件

- `packages/api/src/infrastructure/email/EmailWatcher.ts` — IMAP 轮询服务
- `packages/api/src/infrastructure/email/GithubMailParser.ts` — GitHub 邮件解析

### 依赖

- `imapflow` — Node.js IMAP 客户端（轻量，支持 IDLE）

### PR Template 更新

`.github/pull_request_template.md` title 说明加入 `[猫名🐾]` 要求。

### Skill 更新

`requesting-cloud-review` skill 加入 title 格式校验提示。

---

## 待确认

- [ ] 铲屎官提供 QQ 邮箱授权码（实现完后配置到 `.env`）
- [ ] IMAP poll 间隔：2 分钟 or 3 分钟？（默认 2 分钟）
- [ ] review 邮件 subject 格式确认（需实测一封 GitHub review 邮件的原始格式）

---

## 实现范围（开始前确认）

1. `imapflow` 接入 + IMAP 轮询后台服务
2. GitHub review 邮件解析（subject → PR 号 + review 类型）
3. PR title `[猫名🐾]` 解析 → cat routing
4. 自动 invoke 对应猫（复用现有 invoke 机制）
5. 猫完成后推前端通知（WebSocket）
6. PR template + `requesting-cloud-review` skill 更新（强制 title 格式）
