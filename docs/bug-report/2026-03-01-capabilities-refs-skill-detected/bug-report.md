---
topics: [hub, skills, capabilities, f042]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: Hub 把 `cat-cafe-skills/refs/` 当成 Skill（注册不一致/未挂载/无描述）

## 1) 报告人

- 报告人：铲屎官
- 时间：2026-03-01
- 影响范围：Cat Cafe Hub（Skills 看板）/ `GET /api/capabilities`

## 2) 复现步骤（期望 vs 实际）

### 复现

1. 打开 Cat Cafe Hub → Skills / Capabilities 页面
2. 选择项目（例如 `cat-cafe-runtime`）
3. 观察 skills 列表与 health summary

### 期望

- `cat-cafe-skills/refs/` 只是参考文件目录，不应出现在 skills 列表里
- health summary 的 `unregistered/phantom` 不应出现 `refs`

### 实际

- skills 列表出现 `refs`（无 description、未分类、挂载全是 ×）
- health summary 出现 “未注册: refs”

## 3) 根因分析

- `GET /api/capabilities` 会扫描 `<projectRoot>/cat-cafe-skills/` 的所有子目录并同步到 `.cat-cafe/capabilities.json`
- 扫描逻辑使用 `listSubdirs()`，它不会验证子目录是否真的是 skill（是否存在 `SKILL.md`）
- 因此 `cat-cafe-skills/refs/` 被误认为 skill：进入 capabilities.json → Hub UI 展示 → mount/description/category 全缺失

## 4) 修复方案

- 新增 `listSkillSubdirs()`：仅返回包含可读 `SKILL.md` 的子目录
- 用它替代 capabilities route 内对 `cat-cafe-skills/` 与 mountSourceNames 的原始 `listSubdirs()` 扫描
- 添加回归测试：断言 `/api/capabilities` 返回的 cat-cafe skill 列表与 `skillHealth.unregistered` 都不包含 `refs`

## 5) 验证方式

- UT：`packages/api/test/capabilities-route.test.js` 新增用例：
  - `does not treat cat-cafe-skills/refs as a skill`
- 手工：Hub UI 刷新后不再出现 `refs`，且 health summary 不再报告 `refs`

