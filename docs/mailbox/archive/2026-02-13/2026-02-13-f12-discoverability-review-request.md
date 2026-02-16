# Review 请求: F12 功能可发现性 (Feature Discoverability)

> 发起: 布偶猫 → 缅因猫
> 日期: 2026-02-13
> 分支: `feat/f12-feature-discoverability`
> Worktree: `cat-cafe-f12-discoverability`

---

## 背景

Cat Café 积累了 15+ 斜杠命令、20+ 环境变量、多个配置文件，但用户没有统一入口发现这些功能。铲屎官明确反馈"找不到的功能 = 不存在的功能"。F12 扩展现有齿轮 modal 为 6-tab Hub，新增命令速查和环境/文件速查两个 tab，并让 `/help` 和 `/config` 直接唤起对应 tab。

## 设计文档

- Plan: `docs/plans/2026-02-13-f12-feature-discoverability.md`
- 采访记录包含在 Plan 第 2 节（铲屎官 6 轮 Q&A）

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 齿轮图标打开 6-tab modal | ✅ | CatCafeHub.tsx:18-25, TABS 6 项 |
| 2 | `/help` 弹 modal → 命令速查 tab | ✅ | useChatCommands.ts:149-151 |
| 3 | `/config` 弹 modal → 系统配置 tab，不打印文字 | ✅ | useChatCommands.ts:156-160 |
| 4 | `/config set key value` 仍在聊天显示结果 | ✅ | useChatCommands.ts:172-209 |
| 5 | 命令速查展示所有命令 + 用法 + 说明 | ✅ | HubCommandsTab.tsx 从 registry 渲染 |
| 6 | 命令速查展示快捷键 | ✅ | HubCommandsTab.tsx:43-55 |
| 7 | 环境 tab 展示配置文件 + VSCode 跳转 | ✅ | HubEnvFilesTab.tsx ConfigFilesSection |
| 8 | 环境 tab 展示 env vars，敏感值脱敏 | ✅ | env-registry.ts buildEnvSummary() L108-109 |
| 9 | 环境 tab 展示数据目录 + VSCode 跳转 | ✅ | HubEnvFilesTab.tsx DataDirsSection |
| 10 | 新增命令自动出现在速查 | ✅ | registry 模式，代码审查确认 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/config/command-registry.ts` | 新增 | 16 条命令注册表 (5 categories) |
| `packages/web/src/config/shortcut-registry.ts` | 新增 | 3 条快捷键注册表 |
| `packages/api/src/config/env-registry.ts` | 新增 | 37 条 env var 注册表 (8 categories, sensitive masking) |
| `packages/api/src/routes/config.ts` | 修改 | 新增 `GET /api/config/env-summary` + paths |
| `packages/web/src/components/CatCafeHub.tsx` | 新增 | 6-tab Hub modal (替代 CatConfigViewer) |
| `packages/web/src/components/HubCommandsTab.tsx` | 新增 | 命令 + 快捷键速查 tab |
| `packages/web/src/components/HubEnvFilesTab.tsx` | 新增 | 配置文件 + env vars + 数据目录 tab |
| `packages/web/src/components/RightStatusPanel.tsx` | 修改 | 接线 CatCafeHub + hubRequest 监听 |
| `packages/web/src/hooks/useChatCommands.ts` | 修改 | 新增 /help, 改造 /config 弹 modal |
| `packages/web/src/stores/chatStore.ts` | 修改 | 新增 hubRequest / setHubRequest |
| `packages/web/src/config/__tests__/registries.test.ts` | 新增 | 注册表测试 (7 tests) |
| `packages/api/test/env-registry.test.js` | 新增 | env-summary 测试 (9 tests) |
| `packages/web/src/hooks/__tests__/useChatCommands-hub.test.ts` | 新增 | hub 命令测试 (6 tests) |

## Git SHA

- Base: `dcd94d0` (main)
- Head: `a0d5852`
- Commits: 4 (S1 → S2-S4 → S5 → S6)

## 测试状态

```
pnpm --filter @cat-cafe/web test: 197 passed, 0 failed (+13 new)
pnpm --filter @cat-cafe/api test: 943 passed, 0 failed (+9 new)
```

## Review 重点

1. **注册表设计是否简洁够用** — command-registry 和 env-registry 的接口设计是否合理？会不会在快速迭代中成为负担？
2. **hubRequest 通信机制** — 通过 chatStore 共享状态让 hook 通知组件弹 modal，是否有更好的方式？
3. **env-summary API 安全性** — 返回 `projectRoot` 和 `homeDir` 给前端用于 VSCode 链接，有无信息泄漏风险？（目前只在 localhost 可用）
4. **CatConfigViewer 未删除** — 旧组件还在但已无引用（RightStatusPanel 已切到 CatCafeHub），是否应在此 PR 清理？
5. **HubEnvFilesTab 配置文件列表** — 硬编码了 5 个文件和 4 个目录，是否遗漏重要路径？

## 五件套

**What**: 扩展齿轮 modal 为 CatCafeHub（6 tab），新增命令速查和环境/文件速查，通过注册表模式确保新功能自动可发现。

**Why**: 铲屎官反馈找不到功能就等于功能不存在。当前 15+ 命令、20+ env vars 无统一入口。

**Tradeoff**:
- 放弃了独立 /help 页面方案（铲屎官要求不增加入口）
- 放弃了后端命令注册表（前端更灵活，高速迭代更友好）
- 放弃了 /config 继续打印文字（铲屎官明确要求去冗余）

**Open Questions**:
- 旧 CatConfigViewer.tsx 是否在此 PR 删除？
- 小屏幕（< lg）下 /help 和 /config 无法触发 Hub（因为 RightStatusPanel 被 hidden）

**Next Action**: 请 review 上述 13 个文件，重点关注注册表设计和 hubRequest 通信机制。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成 (10/10)
- [x] 设计文档已附
- [x] 测试通过 (197 + 943)
- [x] 五件套完整
