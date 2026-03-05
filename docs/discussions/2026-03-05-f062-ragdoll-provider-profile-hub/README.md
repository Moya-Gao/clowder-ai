---
feature_ids: [F062]
topics: [hub, anthropic, provider-profile, interview]
doc_kind: discussion
created: 2026-03-05
---

# F062 采访记录：布偶猫赞助 API 配置中枢

## 背景

铲屎官希望我们把“布偶猫 API 切换”做成 Cat Cafe 内置能力，而不是继续依赖外部脚本覆盖配置文件。

## 铲屎官原话（摘录）

1. “布偶猫没猫粮了，他们赞助我账号…能不能做一个布偶猫的这个管理”
2. “让我把他们赞助的 url 和 api key 放进去”
3. “然后我们 config hub 里我可以选择用的是我们自己的订阅还是他们赞助的 api key”
4. “不要什么 mvp 版本，直接做到我们的猫猫咖啡里这个能力”
5. “本机落盘（推荐）：写到 .cat-cafe/*secrets*.local.json，重启后仍可用，Git 忽略”

## 需求收敛

### 必须有

1. Hub 内可管理 profile（新增/编辑/删除）
2. 可切换 active profile（订阅 / 赞助 API）
3. 切换后布偶猫调用链读取新配置
4. secrets 安全处理，不在普通读取接口明文返回

### 应该有

1. profile 连通性测试（先测后切）
2. profile 元数据与 secrets 分层存储

## 当前决策

1. 首版只做布偶猫/Anthropic（用户明确痛点）
2. 支持两类 profile：
   - `subscription`（不注入 API key/base URL）
   - `api_key`（注入 `ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL`）
3. secrets 采用本机落盘：`.cat-cafe/*secrets*.local.json`

## 优先级

1. P0: runtime 正确切换 + 不泄密
2. P1: Hub 体验完整（管理 + 切换 + 状态可见）
3. P2: 多 provider 扩展（本轮不做）

## 开放问题

1. profile 测试调用策略（真实最小调用 vs 纯配置校验）
2. 是否需要支持系统 keychain（本轮不做）
