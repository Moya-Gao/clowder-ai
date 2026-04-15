---
feature_ids: [F162]
related_features: [F088, F132, F142]
related_decisions: [ADR-029]
topics: [enterprise-action, wecom-cli, lark-cli, cli-integration, showcase]
doc_kind: spec
created: 2026-04-14
---

# F162: Enterprise Action Toolkit — 官方 CLI 驱动的企业工作流

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1
> **Deadline**: 2026-04-17（WXG 面试 showcase）
> **Architecture**: [ADR-029](../decisions/029-external-tool-integration-strategy.md)

## Why

铲屎官原话（2026-04-14）：

> "那我们写一个企业微信 show case？"
> "meeting/table 才够打"
> "周四晚上 WXG 面试直接 show 给他们看"

Cat Café 已通过 F088/F132 实现了企微的**消息收发**（Transport Plane），但企业 IM 的真正价值不在聊天，在于**把聊天变成可追踪的工作流程**——文档、表格、待办、会议。

2026 Q1 企微发布官方 CLI（`wecom-cli`）并附带 Agent Skills，让 AI Agent 直接编排企业操作成为可能。我们利用 ADR-029 定义的 `ActionService + CliExecutor` 模式，用企微打样验证这条路。

**展示目标**：WXG 面试现场，群里一句话 → 猫自动创建企微文档 + 智能表格 + 待办 + 会议 → 链接回贴群聊。面试官打开企微即可看到成果。

## What

### 架构（ADR-029 首次应用）

```
铲屎官在 Hub/企微群 发一句话
  ↓
猫解析意图（enterprise workflow skill）
  ↓
POST /api/callbacks/wecom-action
  ↓
WeComActionService（治理边界：auth / audit / dry-run / idempotency）
  ↓
CliExecutor → wecom-cli doc/todo/meeting/...
  ↓
资源句柄持久化（doc URL / todo ID / meeting link）
  ↓
猫组合结果 → 回贴 Hub + 企微群
```

**不做 MCP server**（ADR-029 Decision 4）。猫通过 callback route 调用 ActionService。

### Phase A: WeCom Golden Chain Showcase

**目标**：端到端跑通一条黄金链路，4/17 面试现场可演示。

**黄金链路**：

```
"把今天讨论整理成 PRD，拆成任务给张三李四王五，约下周三评审"
  ↓
① wecom-cli doc create → 企微文档（PRD 内容）
② wecom-cli doc smartsheet create → 智能表格（任务 × 负责人 × deadline）
③ wecom-cli todo create × N → 待办分发到每个人
④ wecom-cli meeting create → 评审会议邀请
⑤ 结果汇总 → 回贴到群聊（4 个链接 + 状态摘要）
```

**实现清单**：

1. **wecom-cli 环境搭建**
   - 安装 `@wecom/cli`
   - 配置企微应用 credentials（`corpId` / `agentId` / `secret`）
   - 验证 CLI 基本命令可用

2. **WeComActionService**（`packages/api/src/infrastructure/enterprise/WeComActionService.ts`）
   - `createDoc(opts)` → DocHandle
   - `createSmartTable(opts)` → TableHandle
   - `createTodo(opts)` → TodoHandle
   - `createMeeting(opts)` → MeetingHandle
   - 公共：auth 注入、audit log、error normalization、JSON output parsing
   - 仿 PandocService 模式：lazy availability check + graceful degradation

3. **CliExecutor**（`packages/api/src/infrastructure/enterprise/WeComCliExecutor.ts`）
   - `execFile('wecom-cli', [...args])` wrapper
   - `--format json` output parsing
   - timeout / retry / error classification

4. **Callback Route**（`packages/api/src/routes/callback-wecom-action-routes.ts`）
   - `POST /api/callbacks/wecom-action`
   - 猫通过 callback credentials 调用
   - 参数校验 + ActionService 调度

5. **Enterprise Workflow Skill**（`cat-cafe-skills/skills/enterprise-workflow/`）
   - 指导猫：意图解析 → 参数提取 → 调 callback → 组合结果
   - 引用 upstream wecom-cli Agent Skills 作为能力描述

6. **Demo Script**
   - 固定场景脚本，面试现场可复现
   - 备选：预录视频 fallback

### Phase B: 飞书 CLI 接入（面试后）

复用 Phase A 的 ActionService 模式，接入 `lark-cli`。

### Phase C: 跨平台统一与 Hub 集成（面试后）

根据 Phase A/B 经验，评估是否需要公共 ActionService 接口抽象。

## Acceptance Criteria

### Phase A（WeCom Golden Chain Showcase）

- [x] AC-A1: `wecom-cli` 安装配置完成，基本命令可在本机执行（v0.1.5, 四命令全通）
- [x] AC-A2: WeComActionService 实现 `createDoc` / `createSmartTable` / `createTodo` / `createMeeting` 四个方法
- [x] AC-A3: 每个方法有 audit log 记录（谁调了什么、参数、结果）
- [x] AC-A4: callback route `/api/callbacks/wecom-action` 可被猫调用
- [ ] AC-A5: 端到端：一句话 → 文档 + 表格 + 待办 + 会议 → 链接回贴
- [ ] AC-A6: 企微 App 中可看到猫创建的文档/表格/待办/会议
- [x] AC-A7: 面试 demo 脚本编写完成，可在 60 秒内完成展示（PR #1182, `docs/plans/2026-04-15-f162-demo-script.md`）
- [ ] AC-A8: 备选方案：预录 demo 视频/GIF 一份

## Dependencies

- **Uses**: F088（消息触发入口 + 企微群回贴出口）
- **Related**: F132（同平台，Transport Plane 已做完，本 feat 做 Action Plane）
- **Related**: F142（如需从企微群 `/command` 触发）
- **Architecture**: ADR-029（External Tool Integration Strategy）

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| wecom-cli 某些 API 不可用或有权限限制 | 黄金链路断链 | Day 1 先逐个验证四个命令可用性，不可用的降级为 API 直调 |
| ≤10 人企业限制导致部分功能受限 | 智能表格 / 会议可能不开放 | 验证后调整 scope，确保 demo 路径畅通 |
| 面试现场网络问题 | 实时 demo 翻车 | AC-A8：备录视频 fallback |
| wecom-cli 输出格式不稳定 | 解析失败 | CliExecutor 优先 `--format json`，降级解析 text |
| 企微应用审核/权限延迟 | Day 1 阻塞 | 铲屎官已创建企业，尽早完成应用注册 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | wecom-cli 智能表格命令是否已上线？不支持则降级为文档内嵌表格 | ✅ 已验证：doc_type=10 创建 + smartsheet_* 字段/记录管理全可用。注意：默认子表自带"文本"字段，需先 get_fields → update_fields 重命名再 add_fields。⚠️ 追加：FIELD_TYPE_TEXT 的 record values 必须用 `[{text, type:"text"}]` 格式，裸字符串被静默丢弃（PR #1186 修复） |
| OQ-2 | ~~面试入口~~ → Hub + 企微群双入口 | ✅ 铲屎官 2026-04-14 |
| OQ-3 | ~~联系人~~ → 用铲屎官自己的企微账号 | ✅ 铲屎官 2026-04-14 |
| OQ-4 | `smartsheet_update_fields` 不能改字段类型（只能改标题），默认字段是 TEXT，如果用户第一个字段不是 TEXT 会报 `2022010 invalid field type` | 🐛 已发现 2026-04-15，待修：`createSmartTable` 需跳过类型不匹配的默认字段重命名，改为删除默认字段 + 全量 add_fields |
| OQ-5 | wecom-cli 是否支持文件上传 / PPT / 云盘？ | ❌ v0.1.5 不支持。CLI 只覆盖 doc/table/todo/meeting/schedule/msg(纯文本)。无 file upload / drive / PPT 命令 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不建 MCP server，走 ActionService + CliExecutor + callback route | ADR-029 Decision 1-4 | 2026-04-14 |
| KD-2 | Transport Plane (F088/F132) 和 Action Plane (F162) 明确分离 | ADR-029 Decision 5 | 2026-04-14 |
| KD-3 | Phase A 只做企微，飞书留 Phase B | 三天 deadline，聚焦一个平台 | 2026-04-14 |
| KD-4 | 黄金链路含 Doc + Table + Todo + Meeting 四步 | 铲屎官拍板"meeting/table 才够打" | 2026-04-14 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-14 | 立项 + ADR-029 通过 review |
| 2026-04-15 | Day 1: wecom-cli 环境搭建 + 四命令可用性验证 + WeComActionService 骨架 — AC-A1~A4 merged (PR #1180) |
| 2026-04-15 | Day 1 续: demo 脚本 + skill symlink — AC-A7 merged (PR #1182) + E2E golden chain 5/5 pass |
| 2026-04-15 | Day 1 bugfix: CellTextValue 格式修复 + E2E read-back 验证 — PR #1186 merged |
| 2026-04-16 | Day 2: runtime 同步 + 端到端串联 (AC-A5/A6) + 备录视频 (AC-A8) |
| 2026-04-17 | Day 3: demo 打磨 + 面试 |

## Review Gate

- Phase A: 面试展示性质，快速迭代。自检 → 铲屎官验收 → 面试实战验证。
- AC-A1~A4: codex review + 云端 review 通过，PR #1180 merged 2026-04-15。
- AC-A7: 云端 review 通过，PR #1182 merged 2026-04-15。
- CellTextValue fix: 云端 review 通过，PR #1186 merged 2026-04-15。

## 需求点 Checklist

| 需求点 | 来源 | 状态 |
|--------|------|------|
| 企微文档创建 | 铲屎官 2026-04-14 | ✅ CLI 验证 + ActionService 实现 |
| 企微智能表格创建 | 铲屎官 2026-04-14 | ✅ CLI 验证 + 默认字段处理 |
| 企微待办分发 | 砚砚(GPT-5.4) 黄金链路提案 | ✅ CLI 验证 + follower_id 字段修正 |
| 企微会议创建 | 铲屎官 "meeting 才够打" | ✅ CLI 验证 + 会议链接获取 |
| 结果链接回贴群聊 | 砚砚(GPT-5.4) 黄金链路提案 | ⬜ |
| 面试 demo 脚本 | 铲屎官 deadline 需求 | ✅ PR #1182, 5-phase 60s 脚本 |
| 备录视频 fallback | 风险缓解 | ⬜ |
