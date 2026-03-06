# Review Request: F063 AC-9 — File Editing Mode + edit_session_token

## What
Workspace 文件编辑能力：铲屎官可以在 Hub 内直接编辑文件，带安全令牌保护和冲突检测。

核心变更：
1. **Backend domain** (`workspace-edit.ts`): HMAC-signed edit_session_token (30min TTL) + atomic file write with sha256 conflict detection
2. **Backend routes** (`routes/workspace-edit.ts`): POST /edit-session + PUT /file (token验证 → 路径安全 → 二进制拒绝 → 冲突检测 → 写入)
3. **Frontend**: CodeMirror 6 editable 模式 + dirty tracking + save button + Cmd/Ctrl+S + token auto-acquisition + 409/401 error handling
4. **Tests**: 9 integration tests covering token issuance, happy path write, sha256 conflict (409), auth (401), path traversal (403), denylist (403), binary rejection (400)

## Why
AC-9 P1 优先级 — 铲屎官需要直接在 Hub 编辑文件，省去在本地编辑器和浏览器间切换的摩擦。

安全约束：
- 编辑模式需显式开启（UI toggle），不是默认可写
- 写入必须带 baseSha256，不一致返回 409 Conflict
- 敏感文件 denylist + 路径遍历防护
- 二进制文件不可编辑

## Original Requirements（必填）
> R10: "如果是可以编辑的话 那有什么我帮你们编辑 复制进来"
> Security-3: "编辑模式需显式开启（UI toggle），签发短期 edit_session_token（30 分钟有效）"
> Security-6: "写入必须带 baseSha256，不一致返回 409 Conflict"
- 来源：`docs/features/F063-hub-workspace-explorer.md` — AC-9, P2B-5, Security Requirements
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Token 用 process-lifetime HMAC secret 而非持久化密钥 — 服务重启后旧 token 失效，但编辑会话本身是短暂的（30min TTL），重启不常见，简单可靠
- 没用完整 JWT（无 jsonwebtoken 依赖）— 自签 HMAC 更轻量，scope 仅限 worktreeId
- 没做 file locking / pessimistic locking — baseSha256 乐观并发足够用（单用户场景），避免 lock 管理复杂度
- Route 拆分到 workspace-edit.ts 而非继续加在 workspace.ts — workspace.ts 已 403 行，必须分离

## Open Questions
1. **写入的原子性**：当前 read-compare-write 不是原子操作（读和写之间有 race window）。单用户 Hub 场景下概率极低，是否需要 file lock？
2. **AC-9 第二部分**："猫猫可直接 commit 编辑结果"— 本次只实现了铲屎官编辑 + 保存到磁盘，git commit 能力留给后续迭代

## Next Action
请 review 代码安全性和前端交互逻辑，特别关注：
- Token 签名/验证的安全性
- sha256 冲突检测的正确性
- 前端 editMode 状态管理（token cache, error handling, mode reset）

## 自检证据

### Spec 合规
全部 16 项检查通过（见 Quality Gate Report）：
- 6 项安全需求（token, conflict, denylist, traversal, binary, explicit toggle）
- 4 项 backend 验收
- 6 项 frontend 验收（edit toggle, token acquisition, CodeMirror editable, dirty tracking, shortcuts, error handling）

### 测试结果
```
workspace tests (all)  → 36/36 pass, 0 fail ✅
  - workspace-edit.test.js: 9/9 pass (token, write, conflict, auth, security)
  - workspace.test.js: 18/18 pass (existing)
  - workspace-security.test.js: 9/9 pass (existing)
pnpm lint              → 0 errors ✅
pnpm -r build          → exit 0 ✅
```

### 文件清单
| 文件 | 变更 | 行数 |
|------|------|------|
| `api/src/domains/workspace/workspace-edit.ts` | NEW | 94 |
| `api/src/routes/workspace-edit.ts` | NEW | 121 |
| `api/test/workspace-edit.test.js` | NEW | 263 |
| `api/src/routes/index.ts` | +1 export | — |
| `api/src/index.ts` | +1 register | — |
| `api/src/routes/workspace.ts` | header comment | — |
| `web/src/stores/chatStore.ts` | +editToken state | — |
| `web/src/components/workspace/CodeViewer.tsx` | +editable/onSave | — |
| `web/src/components/WorkspacePanel.tsx` | +edit UI/handlers | — |

### 相关文档
- Feature: `docs/features/F063-hub-workspace-explorer.md` — AC-9 / P2B-5
