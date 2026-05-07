---
feature_ids: []
topics: [tech, debt]
doc_kind: note
created: 2026-02-26
---

# Cat Cafe 技术债务
> 维护者：三猫 | 最后更新：2026-05-07（大清理：49 → 24 条，移除全部 [x] + 已升级 Feature + 已废弃）
> 来源：由原 `docs/BACKLOG.md` 债务段拆分。
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P1 — 必须做

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD069 | Hindsight 周评测流水线（precision/noise/staleness） | [ ] | P0 Plan Task 5 | 建立自动周评测与阈值告警，避免 recall 质量劣化无感发生。 |
| TD074 | **Hindsight 临时停用（等 GPT Pro 调研）** | [~] | 2026-02-14 预评测数据质量复盘 | 已新增全局开关 `HINDSIGHT_ENABLED`（commit `8876677`）：关闭后 evidence/reflect/callback retain 不再调用 Hindsight，改为 docs fallback 或 skipped；并已停本地 Hindsight 容器避免 token 消耗。待 GPT Pro 结论后再决定恢复策略与 #69 评测时点。 |
| TD080 | **流式草稿持久化（Streaming Draft Persistence）** | [ ] | [2026-02-17 超时复盘](./plans/2026-02-17-timeout-and-message-persistence.md) | 当前消息只在猫猫完成后持久化；streaming 阶段刷新页面消息消失。Phase A 止血已合入 `8057aac`，Phase B 待设计实现。 |
| TD097 | **Connector Messages — 外部信息源抽象 + 自动唤起** | [~] | [2026-02-25 Phase 3 设计](./plans/2026-02-25-connector-messages-phase3.md) | Phase 3a/3b 已完成。**待做**: 3c Redis 持久化 + connector invoke durable retry queue。|
| TD099 | **Hook 归一化 — 跨项目 hook 注入机制** | [ ] | 2026-02-26 铲屎官提出 | 猫猫咖啡的 hooks 需要跟随猫猫到任何项目。详见 `docs/plans/2026-02-26-hook-unification.md`。|

## P2 — 建议做

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD103 | **课件契约文档同步 — read_invocation_detail 参数差异** | [ ] | [砚砚 F98 对照验收](./discussions/2026-02-26-capability-dashboard/README.md) | 课件写单参数，实现是双参数。文档需同步。|
| TD104 | **统一能力模型 `transport` 字段（YAGNI 暂不实现）** | [ ] | [F041 技术讨论](./discussions/2026-02-26-capability-dashboard/tech-discussion-open-questions.md) | 触发条件：接入非 stdio transport 的 MCP server 时。|
| TD106 | **多分身（variant）hardcode 扫描与归一化** | [ ] | [bug report](./bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md) | 把 Web/UI 中写死 `opus/codex/gemini` 的地方统一迁移到 `useCatData()`。|
| TD109 | **Hyperfocus Brake agent hook 退役** | [ ] | F085 AC27 裁出 | 平台 brake 上线后移除旧 hook。触发条件：铲屎官确认平台 brake 稳定后。|
| TD110 | **Hyperfocus Brake 设置真持久化** | [ ] | F085 AC31 裁出 | brake 设置存 in-memory Map，服务重启丢。需迁移到 Redis/DB。触发条件：铲屎官反馈设置丢失时。|
| TD111 | **Bubble writer identity contract 统一收敛** | [ ] | F123 AC-B1 转出 | 五条写路径还没统一到 enforced identity contract。Evolved from: F123。|
| TD112 | **ChatStore duplicate identity invariant** | [ ] | F123 AC-B2 转出 | 需要 store 级 invariant 阻止同 catId+invocationId+kind 重复。Evolved from: F123。|
| TD113 | **placeholder → formal 单调升级规则收口** | [ ] | F123 AC-B3 转出 | placeholder 升级到 formal 仍是 case-by-case，未统一成系统性单调 contract。Evolved from: F123。|
| TD114 | **Bubble duplicate invariant diagnostics / assertions** | [ ] | F123 AC-B5 转出 | 需要 dev/test 级诊断或断言。Evolved from: F123。|
| TD115 | **logs-health.sh 跨平台兼容性（Linux + Windows）** | [ ] | F130 缅因猫 review 观察 | BSD 语法不兼容 Linux/Windows。触发条件：社区 Windows/Linux 用户反馈或 Docker 化时。|

## P3 — 可选优化

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD024 | Antigravity cancel 无效 (detached 进程) | [~] | Phase 3.3b review | 信号链路已接通，待补实机 cancel 验证后可转 `[x]`。 |
| TD025 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包。开发阶段脚本够用。 |
| TD052 | callbackToken 出现在 query string | [ ] | F16 review P3 | token 可能出现在 access log / proxy cache。触发条件：引入网关或外部代理前迁移到 header 鉴权。 |
| TD058 | 补充无 message_start 的 delta 场景测试 | [ ] | 2026-02-11 Opus review P2 | 触发条件：下次触达 ClaudeAgentService 流式逻辑时一并补。 |
| TD079 | archive 内部互引旧路径未更新 | [ ] | WT-4 docs archive R2 | 60+ 处不影响活跃文档。触发条件：archive 需生成静态站点时再批量修。 |
| TD087 | sources-loader "does not rewrite" 测试强化 | [ ] | source-sync 缅因猫 R1 P3-1 | 触发条件：下次改 sources-loader 写盘逻辑时一并补。 |
| TD088 | Redis PushSubscriptionStore upsert TOCTOU race | [ ] | C1+C2 云端 Codex review P3 | 并发概率极低，需 Lua 脚本原子化。触发条件：引入多用户并发订阅场景时。 |
| TD090 | Codex 压缩检测 1 轮空窗（启发式盲区） | [ ] | [压缩检测讨论](./discussions/2026-02-24-compression-detection-cross-provider/README.md) | 实际影响有限，观察到事故再升级。 |
| TD094 | 压缩效率检测（pre/post fillRatio delta） | [ ] | F033 毕业遗留 | 触发条件：观察到压缩策略未降低 token 消耗时。 |
