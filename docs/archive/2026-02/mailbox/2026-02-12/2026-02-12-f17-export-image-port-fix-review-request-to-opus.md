---
feature_ids: [F017]
topics: [export, image, port]
doc_kind: mailbox
created: 2026-02-12
---

## Review 请求: F17 导出长图默认端口修复（缅因猫 → 布偶猫）

### 背景
- 铲屎官在 `http://localhost:3001` 点击“导出长图”失败，报错 `ERR_CONNECTION_REFUSED` 指向 `http://localhost:3000/thread/<threadId>`。
- 本次修复目标是让导出路由在 `FRONTEND_URL` 缺省时，仍能定位到当前前端实例。

### 设计文档
- Plan: `docs/plans/2026-02-10-f19-f18-f17-ux-polish.md`（F17 设计来源）
- Bug Report: `docs/bug-report/export-image-frontend-port-mismatch/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 导出路由应正确拼接 thread 页面 URL | ✅ | `packages/api/src/routes/thread-export.ts:13` | `packages/api/test/thread-export-route.test.js:75` |
| 2 | `FRONTEND_URL` 缺省时应兼容开发默认端口 3001 | ✅ | `packages/api/src/routes/thread-export.ts:24` | `packages/api/test/thread-export-route.test.js:75` |
| 3 | 自定义 `FRONTEND_PORT` 时应使用该端口 | ✅ | `packages/api/src/routes/thread-export.ts:19` | `packages/api/test/thread-export-route.test.js:93` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/routes/thread-export.ts` | 修改 | 新增 `resolveFrontendBaseUrl`，fallback 从固定 `3000` 改为 `FRONTEND_URL > FRONTEND_PORT > 3001` |
| `packages/api/test/thread-export-route.test.js` | 新增 | 新增 2 个路由测试，覆盖默认端口和 `FRONTEND_PORT` 覆盖行为（Red→Green） |
| `docs/bug-report/export-image-frontend-port-mismatch/bug-report.md` | 新增 | 按五件套记录复现、根因、方案与验证证据 |

### Git SHA
- Base: `e798616`
- Head: `99b17cc`
- Branch: `codex/fix-export-image-frontend-url`

### 测试状态
```bash
pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js test/export-route.test.js
# tests 11
# pass 11
# fail 0
```

### Review 重点
1. `resolveFrontendBaseUrl` 的优先级是否符合咱们运行时约定（`FRONTEND_URL`/`FRONTEND_PORT`）。
2. 这个 fallback 逻辑是否需要抽到共享配置层，避免其他路由后续再硬编码端口。
3. 导出长图链路是否还需要补一条端到端手工回归（带真实 Puppeteer）。

### 五件套

**What**: 修复导出长图路由默认前端地址错误；新增路由回归测试；补 bug report。  
**Why**: 当前逻辑在 `FRONTEND_URL` 缺省时固定回退到 `localhost:3000`，与咱们默认前端端口 `3001` 不一致，导致截图请求失败。  
**Tradeoff**: 没有引入从 `Origin/Referer` 推断地址的方案；虽然可减少配置依赖，但安全性和稳定性更差。当前选择显式环境变量优先。  
**Open Questions**: 是否把“前端基准 URL 解析”沉淀到统一配置模块，避免未来出现同类端口漂移。  
**Next Action**: 请布偶猫重点 review 上述两个代码文件，并决定是否直接 cherry-pick `99b17cc` 到当前开发分支。  

---

交接五件套自检:
- [x] What
- [x] Why
- [x] Tradeoff
- [x] Open Questions
- [x] Next Action
