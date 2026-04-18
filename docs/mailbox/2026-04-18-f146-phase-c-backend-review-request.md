---
doc_kind: review-request
created: 2026-04-18
feature_ids: [F146]
---

# Review Request: F146 Phase C — Install Governance + Security Gate (Backend)

Review-Target-ID: f146-phase-c
Branch: feat/f146-phase-c

## What

F146 Phase C 后端核心模块（Tasks 1-8 of 10），覆盖 12 个 AC：

1. **Install Policy Engine** (AC-C1/C5) — `evaluateInstallPolicy()` 阻止 community 一键安装 + 拒绝 install-time scripts
2. **Version Lock** (AC-C2) — `buildLockVersion()` 安装后写入版本锁记录（source/version/channel）
3. **Probe State Persistence** (AC-C3/C4/C6) — `buildProbeState()` + `computeToolDiff()` 持久化探测结果，声明态与实测态不一致时阻断 ready
4. **Content Scanner** (AC-C7) — `scanSkillContent()` 8 条 regex 模式检测 prompt injection
5. **Security Store** (AC-C9/C10) — `SkillSecurityStore` quarantine 状态机 + SHA-256 不可变指纹 + 运行前校验
6. **Permission Isolation** (AC-C8/C11) — `getSkillPermissions()` + `checkToolPermission()` 外来 skill 权限隔离
7. **Revoke API** (AC-C12) — `revokeCapability()` 一键禁用 + 审计 + 阻断 cat-cafe 源

新增文件 7 个（实现）+ 7 个（测试），修改 shared types 3 个文件。

## Why

Phase B 做了 marketplace search → install plan 的"发现+安装"路径。Phase C 在安装写路径上加治理——让安装不再是"无条件写入"，而是经过策略 → 指纹 → 扫描 → 权限 → 审计的完整安全链。

## Original Requirements（必填）

> "我想问你，我们搞设计有什么 MCP？到时候你就可以直接去 Claude 官方的 Hub 市场……一搜——哎，把官方推荐的、最不容易被下毒、最可靠的那些东西拉回来。"
> "以后我要新增一个 MCP，是跟你讲我想要一个怎么样的 MCP，然后你接入之后我能看到——不需要我人类自己去编辑。"

- 来源：`docs/features/F146-mcp-marketplace-control-plane.md` 铲屎官愿景段
- **请对照上面的摘录判断：Phase C 的安全治理是否让"不容易被下毒、最可靠"落地**

## Tradeoff

- 选择 in-memory `SkillSecurityStore` 而非 Redis 持久化——Phase C 优先验证状态机逻辑，D 阶段再接 Redis
- Content scanner 用静态 regex 而非 LLM 分析——足够检出 8 种常见 prompt injection 模式，后续可扩展
- Permission isolation 基于 internal/external 二分而非 RBAC——符合当前"cat-cafe 内置 vs 外部安装"的实际场景

## Open Questions

1. **Integration wiring (Task 9)**: `content-scanner` + `security-store` 需接入 `capabilities-mcp-write.ts` 的安装路径——这次提交的是独立模块，接线在 Task 9 做。Reviewer 是否认为应该一起交？
2. **Frontend (Task 10)**: Policy 确认对话框 + probe 状态 badge + revoke 按钮。Phase B 已有 `.pen` 设计稿（`designs/F146-marketplace-phase-b-ux.pen`），Phase C 前端可复用布局。
3. **Fingerprint drift**: 当前 `verifyFingerprint` 在校验失败时自动 quarantine。是否需要 grace period 或 warning 阶段？

## Next Action

请 review 后端 8 个模块的 API 设计 + 状态机逻辑 + 测试覆盖。重点关注：
- `SkillSecurityStore` 的状态转换是否完备
- `scanSkillContent` 的 8 条 regex 是否有漏检/误报
- `checkToolPermission` 的 risk classification 是否合理

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f146-phase-c/codex`
- Start Command: `pnpm review:start`
- Ports: 后端纯逻辑模块，无需起服务。直接在沙盒跑 `node --test test/install-policy.test.js test/version-lock.test.js test/probe-state.test.js test/skill-content-scanner.test.js test/skill-security-store.test.js test/skill-permissions.test.js test/capability-revoke.test.js`

## 自检证据

### Spec 合规

| # | AC | 状态 | 实现位置 | 测试覆盖 |
|---|-----|------|---------|---------|
| C1 | 默认策略阻止 community 一键安装 | ✅ | install-policy.ts | install-policy.test.js (9 tests) |
| C2 | 安装后写入版本锁 | ✅ | version-lock.ts | version-lock.test.js (5 tests) |
| C3 | mcp:doctor 显示未就绪原因 | ✅ | probe-state.ts | probe-state.test.js (11 tests) |
| C4 | 未通过 probe 禁止 ready | ✅ | probe-state.ts | probe-state.test.js |
| C5 | 禁止 install-time scripts | ✅ | install-policy.ts | install-policy.test.js |
| C6 | 声明态 vs 实测态 diff 告警 | ✅ | probe-state.ts (computeToolDiff) | probe-state.test.js |
| C7 | SKILL.md 内容安全扫描 | ✅ | content-scanner.ts | skill-content-scanner.test.js (10 tests) |
| C8 | 外来 skill 权限隔离 | ✅ | skill-permissions.ts | skill-permissions.test.js (11 tests) |
| C9 | quarantined 须显式 approve | ✅ | skill-security-store.ts | skill-security-store.test.js (12 tests) |
| C10 | 不可变指纹 + 运行前校验 | ✅ | skill-security-store.ts | skill-security-store.test.js |
| C11 | 首次运行最小权限 | ✅ | skill-permissions.ts | skill-permissions.test.js |
| C12 | 一键 revoke | ✅ | capability-revoke.ts | capability-revoke.test.js (6 tests) |

### 测试结果（2026-04-18 本次运行）

```
F146 专项测试: 64 tests, 9 suites, 64 pass, 0 fail
全量 API 测试: 8512 pass, 14 fail (pre-existing Redis isolation guard, non-F146)
pnpm check:    0 errors ✅
pnpm lint:     0 errors (warnings only, pre-existing hardcoded-colors) ✅
pnpm build:    exit 0 ✅
```

### 根目录工件闸门

```
工作树:     无 ✅
已提交差异: 无 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-18-f146-phase-c-install-governance.md`
- Feature: `docs/features/F146-mcp-marketplace-control-plane.md`
- Phase B PR: #1244 (merged)
