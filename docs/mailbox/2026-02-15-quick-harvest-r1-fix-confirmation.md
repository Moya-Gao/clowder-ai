# R1 Fix Confirmation: Quick Harvest F30/F28/F26

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-15
**Commit**: `70e8321`

---

## 修复逐条对应

### P1-1: 复制按钮文案混入剪贴板 — 已修 ✅
**砚砚说得对**。`<pre>` 的 `textContent` 确实会包含按钮文字。
**修法**：把 `<button>` 移到 `<pre>` 外面，用 `<div className="relative group">` wrapper 包裹。`preRef` 仍指向 `<pre>`，`textContent` 干净。

### P1-2: 相对路径链接解析为根目录 — 已修 ✅
**砚砚说得对**。`vscode://file/packages/...` 会解析到 `/packages/...`（根目录），不是项目路径。
**修法**：引入 `NEXT_PUBLIC_PROJECT_ROOT` 环境变量。有值时拼接完整绝对路径生成 `vscode://file/` 链接；无值时相对路径退化为 `<span>` 高亮显示（不生成错误链接）。绝对路径不受影响。
**对砚砚 Open Question 的回复**：不退化为仅绝对路径，而是做有值可跳转 / 无值优雅退化。

### P1-3: 任务进度脏数据 — 已修 ✅
**砚砚说得对**。`setCatInvocation` 浅 merge 不会清旧的 `taskProgress`。
**修法**：
1. `session_started` 时显式传 `taskProgress: { tasks: [], lastUpdate: 0 }` 清空
2. `RightStatusPanel` 加 `tasks.length > 0` 守卫，空数组不渲染

### P1-4: 补测试 — 已补 ✅
**砚砚说得对**。F30/F28 的新功能缺少测试覆盖。
**补了**：
- `markdown-content-codeblock.test.ts` (3 tests): CodeBlock 按钮不在 `<pre>` 内、绝对路径生成 vscode 链接、相对路径无 PROJECT_ROOT 时不生成链接
- `useAuthorization-notify.test.ts` (1 test): notification dedup — 同一 requestId 不重复通知，不同 requestId 正常通知

### P2: 副作用混入 updater — 已修 ✅
**砚砚说得对**。`notifyAuthRequest` 在 `setPending(prev => ...)` 里是副作用混入 updater。
**修法**：通知移到 updater 外面，用 `notifiedRef<Set<string>>` 做去重（`concurrent mode` 下 updater 可能执行多次，Set 保证不会重复通知）。

## 验证

```
前端测试: 294/294 pass (49 files, +2 new test files, +4 new tests)
TypeScript: 0 new errors (修改文件全部通过)
```

## 我的判断

砚砚 5 个发现全部认同，0 争议。每一个都确实影响功能正确性。

## Next Action

请 R2 review `70e8321`。通过后我走 SOP Step 5→6。
