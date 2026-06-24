---
id: LL-cf-token-scope-upfront
date: 2026-06-21
authors: [opus-47 (宪宪)]
trigger: 铲屎官 2026-06-21 04:56 UTC
context: F247 Phase B1a 砚砚云端 ChatGPT 接入 onboarding
related_features: [F247, F178]
severity: P1 (流程效率 / 用户体验)
---

# LL: 外部 SaaS Token Scope 必须一次性给齐（CF 案例）

## 问题

F247 Phase B1a onboarding 全程花了约 1 小时，**60% 时间消耗在 CF API token scope 残缺 → 中途回 dashboard 加 scope**，不是真正的实现工作。

时间分布（铲屎官实测）：
- ✅ spike server B1a 真 toolset 写完（5 min）
- ✅ mint agent-key（2 min）
- ❌ Quick tunnel 网络故障 troubleshoot（5 min，最后放弃切 named tunnel）
- ❌ **CF dashboard "Hostname routes" UI 5 次互相猜路径**（15 min）
- ❌ **3 次回 dashboard 加 token scope**（3 × 3 min = 9 min，每次中断 onboarding flow）
- ✅ 最后 API PUT 一次成功 + E2E verify 全过（2 min）

## 根因

1. **token scope 按 "feature 需要" 渐进式给**：
   - 一开始 spike SOP 给了 Apps / Policies / DNS 三个 scope
   - B1a 阶段才发现要 Service Tokens scope → 中断让铲屎官加
   - Service Token mint 完，发现 ingress 还要 Tunnel: Edit scope → 又中断
   - 这种 "需要才补" 模式造成 3 次中断

2. **CF dashboard UI 改组频繁**：
   - "Networks → Tunnels" → "Connectors" + "Routes"
   - "Public Hostnames" → "Hostname routes (Beta)" (但实际是 private network 表单)
   - 猫和铲屎官都难以靠 dashboard 找到对的入口

3. **铲屎官原话（直击根因）**：
   > "未来开源社区小伙伴用的时候我建议你最开始就让大家 cat-cafe-spike token 把权限给猫猫们添加好，猫猫们来操作，因为他这个真的太难找了我也不知道要如何操作这个 saas。"

## 教训

### 1. 外部 SaaS Token Scope 必须一次性给齐（**一开始就要齐**）

凡是猫猫要 onboarding 用户到外部 SaaS（Cloudflare / GitHub / OpenAI / Lark / etc.），第一刀必须**列出全部需要的 scope**，让铲屎官一次 mint 齐，**不要渐进式补**。

应该有的 **token scope checklist** 模板：

```
| Resource | Permission | 用途（写清楚为啥要）|
|----------|-----------|--------------------|
| ...      | ...       | ...                |
```

并提供 **CLI probe 命令**让猫自检 scope 完整性：

```bash
# 5 个 endpoint probe，任何一个 Authentication error = 缺 scope
curl ... /apps     | jq .success
curl ... /policies | jq .success
curl ... /tokens   | jq .success
# ...
```

### 2. dashboard 操作能 API 化就 API 化

凡是 dashboard UI 入口让猫猫和铲屎官都难找的 SaaS 操作（CF tunnel ingress / GitHub repo settings / OpenAI org config），**强制走 API path**，dashboard 只作为 fallback。

理由：
- API 端点 stable（10 年不变）
- Dashboard UI 改组（季度迭代，重组 tab）
- 猫看 docs 就能调 API，看 UI 截图全过时

CF 案例：`PUT /accounts/{ACC}/cfd_tunnel/{TUN}/configurations` 这条 API 是 stable 的，dashboard 路径在 6 个月内已经改了 3 次（Public Hostnames → Hostname routes Beta → Routes → 未来还会变）。

### 3. Onboarding SOP 写给猫看，不写给铲屎官看

铲屎官说："宪宪帮我接入 gpt-pro" → 接球猫读 SOP 操作。这意味着：

- SOP audience = 猫（不是铲屎官）
- 用 CLI + API + 注释代码块，不写 "请点 dashboard 第 3 个 tab"
- 唯一让铲屎官点 dashboard 的事 = mint user-level token（CF API 不允许 mint API token via API，硬限制）
- 唯一让铲屎官手动操作的事 = OAuth flow（必须 browser）

每个 dashboard 操作前面加 "**⚠️ 这一步必须铲屎官点，因为 X 限制**"，并写出**精确路径**（不靠 UI 直觉）。

### 4. 一次完整 onboarding flow E2E run-through 才算 SOP 成熟

写完 SOP 后必须**端到端按 SOP 跑一次**（用 sub-shell / 新机器 / docker），确认每条命令是 self-contained 的、不依赖已有 state（除非显式标 "前置物料"）。

本 SOP 没经历过 fresh-start 测试，需要：
- F247 Phase C 排期一次新机器迁移 dry-run
- 或社区贡献者首次接入时反馈 + 收 issue

## 沉淀

- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` —— ChatGPT 云端接入完整 SOP（猫读）
- ✅ §1.3 列了 CF token 必需的 **5 个 scope checklist** + CLI probe 命令
- ✅ §4.2 + §4.3 用 CF API 完成 ingress + service token，避开 dashboard UI 迷雾
- ✅ §B Debug Clinic 列出常见症状 → 根因 → 修复
- ✅ §0 trigger phrases 让铲屎官自然召唤 SOP（"宪宪帮我接入 gpt-pro"）

## 推广到其他 SaaS

| SaaS | 必查 token scope | dashboard UI 难度 | 建议 API 化优先 |
|---|---|---|---|
| Cloudflare | Apps / Policies / Service Tokens / Tunnel / DNS | 高（UI 重组频繁）| ✅ 已 API 化 |
| GitHub | Issues / PRs / Contents / Workflows / Org | 中 | gh CLI 充分 |
| OpenAI | Org admin / API keys / Connectors | 高（少 docs）| ⚠️ Connector 配置目前 GUI only |
| Lark | bot 应用 scope（per-API）| 中 | lark-cli 充分 |

新 SaaS onboarding SOP 写作时按本 LL 套路：scope checklist + API path + dashboard fallback 标 ⚠️。

[宪宪/Opus-4.7🐾]
