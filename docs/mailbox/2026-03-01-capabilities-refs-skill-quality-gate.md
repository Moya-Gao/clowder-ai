---
topics: [hub, skills, capabilities]
doc_kind: quality-gate-report
created: 2026-03-01
---

## Quality Gate Report — Fix Hub treating `cat-cafe-skills/refs/` as a skill

### 原始需求 / 现象

- 现象：Hub Skills 看板出现 `refs` 作为 skill，导致：
  - “未注册 refs”
  - “无 description / 未分类 / 挂载全 ×”
- 证据：铲屎官截图（Hub UI）

### Spec / Bug report

- Bug report：`docs/bug-report/2026-03-01-capabilities-refs-skill-detected/bug-report.md`

### 实现对照

| 要求 | 状态 | 位置 |
|------|------|------|
| `refs/` 不应被发现为 skill | ✅ | `packages/api/src/routes/capabilities.ts`（`listSkillSubdirs()` 仅保留含 `SKILL.md` 的目录） |
| 回归测试锁住 | ✅ | `packages/api/test/capabilities-route.test.js`（新增用例断言不包含 `refs`） |

### 验证命令输出（本轮新鲜证据）

```
pnpm --filter @cat-cafe/api build
  → exit 0

node --test packages/api/test/capabilities-route.test.js
  → 18 passed, 0 failed
```

