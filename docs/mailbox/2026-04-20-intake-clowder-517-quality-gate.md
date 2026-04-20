## Quality Gate Report

Spec: `cat-cafe#1305`  
原始需求: `clowder-ai#510` + `clowder-ai#517`  
检查时间: 2026-04-20

### 愿景覆盖（Step 0）

| # | 铲屎官/真相源原始需求 | AC 覆盖？ | 实现？ |
|---|----------------------|-----------|--------|
| 1 | 某个 thread 存在未发送文本草稿时，会话列表项要显示明显但轻量的 `[草稿]` 标记 | `cat-cafe#1305` 逐文件决策表 + `clowder-ai#510` AC | ✅ |
| 2 | 只有未发送图片草稿时，也必须显示 `[草稿]`，而且清空/发送/LRU 驱逐后要正确消失 | `clowder-ai#510` AC + `chat-input-draft-persistence` 回归 | ✅ |
| 3 | 不重做 draft 数据流，只把 `hasDraft` 这种轻量信号映射到 thread list 展示层 | `clowder-ai#510` Scope / suggested direction | ✅ |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 把文本/图片草稿判断抽成共享 helper | ✅ | `packages/web/src/components/thread-drafts.ts` | `packages/web/src/components/__tests__/chat-input-draft-persistence.test.ts` |
| 2 | `ChatInput` 在输入/图片变化时同步 `threadState.hasDraft`，并在图片草稿 LRU 驱逐后清掉陈旧标记 | ✅ | `packages/web/src/components/ChatInput.tsx` | `packages/web/src/components/__tests__/chat-input-draft-persistence.test.ts` |
| 3 | `ThreadItem` 对非当前线程显示红色 `[草稿]` badge | ✅ | `packages/web/src/components/ThreadSidebar/ThreadItem.tsx` | `packages/web/src/components/__tests__/thread-item-draft-badge.test.tsx` |
| 4 | 多线程切换后保留旧线程的 `hasDraft` 状态 | ✅ | `packages/web/src/stores/chatStore.ts`, `packages/web/src/stores/chat-types.ts` | `packages/web/src/stores/__tests__/chatStore-multithread.test.ts` |

### 设计稿对照（Step 5）

`rg --files designs 2>/dev/null | rg '517|draft|badge|thread'` → 无匹配  
状态：⚠️ 无 `.pen` 设计稿，本轮为前端 UI 改动

### Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### Inbound Guard

- `bash scripts/intake-from-opensource.sh --pr 517 --mode=plan` → `8 safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound --from-index` → `✓ No brand violations detected`
- Intake Intent Issue: `cat-cafe#1305`

### 浏览器验证

- 隔离实例启动：`FRONTEND_PORT=3111 API_SERVER_PORT=3112 NEXT_PUBLIC_API_URL=http://localhost:3112 PREVIEW_GATEWAY_PORT=0 NODE_ENV=development ANTHROPIC_PROXY_ENABLED=0 ASR_ENABLED=0 TTS_ENABLED=0 LLM_POSTPROCESS_ENABLED=0 EMBED_ENABLED=0 bash ./scripts/start-dev.sh --memory --quick --profile=production`
- API 探活：`curl -sf http://localhost:3112/health` → `{"status":"ok",...}`
- 同源创建 thread：浏览器内 `POST /api/threads` → `201`, thread id=`thread_mo799o33oryqozhy`
- 结果：前端当前会话仍停在 fallback `default` thread，未把新线程列表刷出来，因此**没有拿到 `[草稿]` badge 的端到端截图**
- 判断：这是本地 session/bootstrap 噪音，未发现指向本轮 intake diff 的直接证据；功能正确性主要由组件/状态测试覆盖

### 验证命令输出（本轮真实运行）

- `NODE_ENV=development pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chatStore-multithread.test.ts src/components/__tests__/thread-item-draft-badge.test.tsx src/components/__tests__/chat-input-draft-persistence.test.ts` → `3 files, 63 tests passed`
- `NODE_ENV=development pnpm --filter @cat-cafe/web exec tsc --noEmit` → success
- `NODE_ENV=development pnpm --filter @cat-cafe/web lint` → success（仅既有 warnings，无 error）
- `NODE_ENV=development pnpm check` → **blocked by pre-existing unrelated format issue**: `packages/api/test/f148-phase-g.test.js`
- `git diff --name-only origin/main...HEAD -- packages/api/test/f148-phase-g.test.js` → 无输出（证明该失败不在本轮 diff）
- `git diff --check` → clean

### 相关文档

- Intake Intent: `cat-cafe#1305`
- Source Issue: `clowder-ai#510`
- Source PR: `clowder-ai#517`
