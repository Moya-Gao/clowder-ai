# Cat Cafe 技术债务 & 待办事项

> 维护者：布偶猫 | 最后更新：2026-02-06
>
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P0 — 阻塞后续 Phase

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 1 | ~~身份注入 (SystemPromptBuilder)~~ | [x] Phase 3.3 | Demo 发现 | `cace330` |
| 2 | 猫配置外置 `cat-config.json` | [ ] | Demo 发现 | CatConfig 类型已扩展，外部 JSON 文件未做 |

## P1 — 必须做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 3 | MCP 统一挂载 (Codex/Gemini) | [ ] | Demo 发现 | 只有 Claude 有 `--mcp-config`，其他两猫没有 MCP 工具 |
| 4 | Redis ThreadStore | [ ] | Phase 3.2 | 当前内存 Map，重启丢失 |
| 5 | MCP 工具接入 (文件操作切 MCP Server) | [ ] | Phase 2.5 任务表 | 共享 MCP Server 已有，未挂到猫的 CLI |
| 6 | projectPath 目录存在性校验 | [ ] | Phase 3.2 review | POST /api/threads 的 projectPath 未做 `fs.stat` |
| 7 | 目录浏览安全 (allowlist/blocklist) | [ ] | Phase 3.2 review | 当前仅限 `homedir()`，生产需更细粒度 |

## P2 — 建议做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 8 | 上下文预算管理 (token 截断) | [ ] | 身份注入讨论 | 4 层 prompt 无截断策略 |
| 9 | 前端图片压缩 | [ ] | Phase 3.2 review | 当前 10MB/张直传 |
| 10 | 对话级联删除 | [ ] | Phase 3.2 review | DELETE thread 不删消息，依赖 TTL |
| 11 | cancel_invocation 真正鉴权 | [ ] | Phase 3.3b review R1 | 当前只有 `socket.rooms.has()`，无用户身份校验 |
| 12 | 取消后显示"已取消"标记 | [ ] | Phase 3.3b review R1 | 现在只停止 loading，没有视觉提示 |
| 13 | cats.ts TODO: 从 Redis 获取猫状态 | [ ] | 代码 TODO | `packages/api/src/routes/cats.ts` |
| 14 | sendMessageSchema 语义归属 | [ ] | Phase 3.5 Step 0 review | 当前在 `parse-multipart.ts`，建议迁到 `messages.schema.ts` |

## P3 — 可选优化

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 15 | blob URL 同 thread 连发大量图累积 | [ ] | Phase 3.3b review R1 | clearMessages 时已回收，但不切 thread 会累积 |
| 16 | 冷/热状态视觉反馈 (猫头像发光) | [ ] | 暹罗猫提议 | CSS class 切换，低成本 |
| 17 | Antigravity cancel 无效 (detached 进程) | [ ] | Phase 3.3b review | gemini-cli fallback 可选 |

## 已知限制（非 bug，需意识到）

| 项目 | 严重度 | 缓解方案 |
|------|--------|----------|
| CLI 启动开销 ~500ms-2s | 中 | 可考虑进程池 |
| NDJSON 格式可能随 CLI 升级变化 | 中 | 版本锁定 + 容错解析 |
| Antigravity MCP 回传可能无响应 | 中 | gemini-cli fallback |

## 已完成项（归档）

<details>
<summary>点击展开</summary>

| # | 项目 | 完成于 | Commit |
|---|------|--------|--------|
| - | 循环依赖 (socketManager 注入) | Phase 3a | - |
| - | AgentRouter 错误处理 | Phase 3a | - |
| - | Session 迁移 Redis | Phase 3a | - |
| - | requestId → InvocationTracker | Phase 3.3b | `ae7bbc2` |
| - | 消息铭牌 (MetadataBadge) | Phase 3.3 | `d273c7e` |
| - | 图片显示 (contentBlocks + blob URL) | Phase 3.3b | `823cb8d` |
| - | 自动命名 (首消息截断 30 字) | Phase 3.3b | `efa8259` |
| - | InvocationTracker 竞态修复 | Phase 3.3b R1 | `ee53b66` |
| - | 前端 fetch non-2xx 检查 | Phase 3.3b R1 | `ee53b66` |
| - | cancel 房间约束 | Phase 3.3b R1 | `ee53b66` |
| - | blob URL clearMessages 回收 | Phase 3.3b R1 | `ee53b66` |
| - | Path traversal 修复 | Phase 3.2 review | `5a6d678` |
| - | 默认 thread 全局广播修复 | Phase 3.2 review | `5a6d678` |

</details>
