---
feature_ids: [F062]
related_features: [F041]
topics: [hub, anthropic, profile, api-key, security]
doc_kind: spec
created: 2026-03-05
---

# F062: 布偶猫账号配置中枢（订阅 / 赞助 API 切换）

## Status: in-review

## Why

我们当前在 Hub 能管理 MCP/Skills，但不能在 Cat Cafe 内统一管理“布偶猫走订阅”与“布偶猫走赞助 API”两种通道。铲屎官要的是：

1. 在 Cat Cafe 里录入赞助方提供的 `BASE_URL + API Key`
2. 在配置中枢一键切换“自有订阅”或“赞助 API”
3. 切换后马上对布偶猫生效，不用手改外部脚本

## What

新增布偶猫 Provider Profile 管理能力（Hub + API + Runtime）：

1. 配置档管理：支持 `subscription` 与 `api_key` 两种 profile
2. 运行时切换：active profile 变更后，下一次布偶猫调用按该 profile 启动
3. 安全存储分层：
   - 非敏感信息（profile 元数据、active 指针）写入项目态
   - 密钥写入本地 secrets 文件（`.cat-cafe/*secrets*.local.json`），不进 Git
4. 连通性自检：支持 profile 级“测试”操作，避免切换到坏配置

## Acceptance Criteria

- [x] AC-1: Hub 可新增/编辑/删除布偶猫 profile，并显示当前 active
- [x] AC-2: Hub 可在 `subscription` 与 `api_key` profile 间切换
- [x] AC-3: `api_key` profile 的 `baseUrl/apiKey` 能被布偶猫调用链读取并应用
- [x] AC-4: secrets 不出现在常规 GET 响应中，界面只显示掩码状态
- [x] AC-5: 提供 profile 测试接口，切换前可验证配置有效性
- [x] AC-6: 至少有 API + Web + provider 层回归测试覆盖

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | “做一个布偶猫的这个管理” | AC-1 | web test + manual | [x] |
| R2 | “把他们赞助的 url 和 api key 放进去” | AC-3, AC-4 | api/provider test | [x] |
| R3 | “config hub 里选择我们订阅还是他们赞助的 api key” | AC-2 | web test + manual | [x] |
| R4 | “不要 mvp，直接做到我们的猫猫咖啡里这个能力” | AC-1~AC-6 | checklist + test suite | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（若适用）

## Links

- Discussion: `docs/discussions/2026-03-05-f062-ragdoll-provider-profile-hub/README.md`
- Related: `docs/features/F041-capability-dashboard.md`

## Key Decisions

- **KD-1 (2026-03-05)**: 首版范围限定为布偶猫/Anthropic，不把 Codex/Gemini 一次性打包进来。理由：用户当前痛点是布偶猫账号切换，先做最短价值链，再复用结构扩展多 provider。
- **KD-2 (2026-03-05)**: profile 元信息与 secrets 分文件存储，避免明文 key 混入普通配置回读接口。
- **KD-3 (2026-03-05)**: secrets 持久化采用本机落盘 `.cat-cafe/*secrets*.local.json`（铲屎官拍板）。

## Dependencies

- `Evolved from`: F041（Hub/配置中枢基础）
- `Related`: F061（已存在，不复用编号）

## Risk

- 中：切换失败导致布偶猫不可用（需要可观测错误 + 手动切回）
- 中：密钥泄露风险（必须做响应脱敏 + 本地 secrets 文件隔离）
- 低：兼容现有 Claude CLI auth 行为（subscription 模式不应被 API key 污染）

## Open Questions

1. profile 测试接口采用何种“最小真实调用”最稳妥（当前倾向 `GET /v1/models`）
2. 后续跨 provider 扩展时，是否统一到通用 profile schema（本轮不阻塞）

## Review Gate

- Reviewer: 跨家族优先（布偶猫）
- 验收: 铲屎官在 Hub 完成“新增赞助 profile → 测试 → 切换 → 实际调用”完整链路

## Timeline

- 2026-03-05: Kickoff + 采访结论落盘
- 2026-03-05: 进入实现（API + Web + Provider runtime）
- 2026-03-05: 定向测试与 lint 通过，进入 review
