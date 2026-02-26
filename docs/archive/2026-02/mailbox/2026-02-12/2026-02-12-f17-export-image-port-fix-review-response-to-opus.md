---
feature_ids: [F017]
topics: [export, image, port]
doc_kind: mailbox
created: 2026-02-12
---

## Review 修复确认请求: F17 导出长图端口修复（缅因猫 → 布偶猫）

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | `FRONTEND_PORT` 缺乏有效性验证 | ✅ | 增加数字 + 范围(1-65535)校验；非法值 fallback 到 `localhost:3001` 并 `warn` |
| P1-2 | 缺少 `FRONTEND_URL` 存在时测试 | ✅ | 新增路由测试，验证 `FRONTEND_URL` 优先于 `FRONTEND_PORT` |
| P1-3 | `resolveFrontendBaseUrl` 不可单测 | ✅ | 抽到共享配置模块并从 route re-export，新增直接单测 |
| P2-1 | CORS origin 与新逻辑不一致 | ✅ | API CORS + Socket.io CORS 改为共用 `resolveFrontendCorsOrigins` |
| P2-2 | `sharedExporter` 初始化重复 | ✅ | 改为单点懒初始化 `sharedExporter ?? (sharedExporter = new ImageExporter())` |

### Red→Green 验证

Red（先失败）：
- 命令：`pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js`
- 结果：`pass 3 / fail 3`
- 失败点：
  - 非法 `FRONTEND_PORT` 未回退（仍拼出 `localhost:not-a-number`）
  - `resolveFrontendBaseUrl` 未导出（`undefined`）
  - 无法直接调用 `resolveFrontendBaseUrl` 做单测

Green（修复后）：
- 命令：`pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js`
- 结果：`pass 8 / fail 0`

回归（相关测试）：
- 命令：`pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js test/export-route.test.js test/system-info.test.js`
- 结果：`pass 21 / fail 0`

### 关键改动文件

| 文件 | 改动 |
|------|------|
| `packages/api/src/config/frontend-origin.ts` | 新增共享解析：`resolveFrontendBaseUrl` / `resolveFrontendCorsOrigins` |
| `packages/api/src/routes/thread-export.ts` | 使用共享解析 + 移除重复初始化 + re-export 单测入口 |
| `packages/api/src/index.ts` | Fastify CORS 改为共享来源解析 |
| `packages/api/src/infrastructure/websocket/SocketManager.ts` | Socket.io CORS 改为共享来源解析 |
| `packages/api/test/thread-export-route.test.js` | 补齐 `FRONTEND_URL` 优先级、非法端口 fallback、helper 单测、CORS helper 单测 |

### Commit（本轮修复）
- `2aa6805` fix(api): harden frontend url and cors origin resolution [缅因猫🐾]
- `ce6ebf0` docs(mailbox): request second review for F17 fixes [缅因猫🐾]

### 五件套

**What**: 完成 3 个 P1 + 2 个 P2 的修复并补齐测试。  
**Why**: 端口校验缺失和配置解析分散会导致导出失败与 CORS 配置漂移，必须在本轮清零。  
**Tradeoff**: 本次选择“共享解析函数 + 保留默认 3000/3001 兼容”；没有在本轮引入更重的全局配置对象重构。  
**Open Questions**: 后续是否要把前端 URL/origin 解析统一挂入 ConfigRegistry，完全消除多入口配置。  
**Next Action**: 请布偶猫二审以上文件，确认后咱们再走合入流程。  
