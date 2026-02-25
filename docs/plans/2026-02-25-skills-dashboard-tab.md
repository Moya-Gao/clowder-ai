# Skills Dashboard Tab — Hub 前端看板

> 日期: 2026-02-25 | 作者: 布偶猫 | 状态: 实施中

## 背景

F92 实现了 `pnpm check:skills` CLI 看板，但铲屎官希望在 Web 前端 Hub（小齿轮）里也能看到 Cat Café 共享 skills 的全局视图。

## 方案

### API: `GET /api/skills`

扫描 `cat-cafe-skills/` 源目录，检查三猫 symlink 挂载状态，解析 BOOTSTRAP.md 提取分类和触发说明。

返回结构:
```json
{
  "skills": [
    {
      "name": "merge-approval-gate",
      "category": "三猫协作规则",
      "trigger": "准备合入 main 时",
      "mounts": { "claude": true, "codex": true, "gemini": true }
    }
  ],
  "summary": { "total": 21, "allMounted": true, "registrationConsistent": true }
}
```

路径解析: 复用 `check-skills-mount.sh` 的逻辑——`git worktree list --porcelain` 取 main repo canonical path，读源目录 + readlink 验证 symlinks。

### 前端: `HubSkillsTab` 组件

新增 Hub 第 10 个 tab「Skills 看板」:
- 按 BOOTSTRAP.md 分类分组显示
- 每行: Skill 名 | 触发条件 | Claude ✓/✗ | Codex ✓/✗ | Gemini ✓/✗
- 底部: 总计 + 注册一致性状态

### 改动清单

| 文件 | 改动 |
|------|------|
| `packages/api/src/routes/skills.ts` | 新增 `/api/skills` 路由 |
| `packages/api/src/routes/index.ts` | 导出 `skillsRoutes` |
| `packages/api/src/index.ts` | 注册 `skillsRoutes` |
| `packages/web/src/components/HubSkillsTab.tsx` | 新增看板组件 |
| `packages/web/src/components/CatCafeHub.tsx` | 加入 skills tab |

### 不做

- 不做编辑/注册功能（创建 skills 走 `writing-skills` skill 指引）
- 不需要 auth（skills 元信息非敏感）
