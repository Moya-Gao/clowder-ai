---
feature_ids: [F068]
related_features: [F063]
topics: [hub, ux, directory-picker, new-thread]
doc_kind: spec
created: 2026-03-06
---

# F068 — 新建对话弹窗 UX 优化

## Why

铲屎官反馈"新建对话"弹窗**太难用**：
- 项目目录选择栏太小，底部根本看不到
- 没有文件系统浏览器（Finder 风格），只能在当前目录层级选
- 无法快速跳转到上级或任意目录
- 整体界面不够美观

## What

重新设计"新建对话"弹窗，用**三种入口**覆盖所有场景：

1. **系统原生文件选择器** — 后端通过 `osascript` 调用 macOS 原生 NSOpenPanel（Finder 风格），用户体验与上传文件完全一致
2. **路径输入框** — 常驻输入框，直接粘贴/输入完整路径（如 `/Users/lysander/projects/freelance/studio-flow`）
3. **最近项目快捷入口** — 底部显示历史项目 + 大厅，一键直达

**删除**自建目录浏览器 — 有原生选择器后不再需要。

## Acceptance Criteria

- [ ] 系统原生选择器：点击「选择文件夹」按钮，弹出 macOS 原生目录选择器（NSOpenPanel），选中后返回绝对路径
- [ ] 后端 API：`POST /api/projects/pick-directory`，通过 `osascript -e 'POSIX path of (choose folder)'` 实现
- [ ] 路径输入框：常驻显示，支持粘贴完整路径 + 回车/箭头按钮跳转
- [ ] 最近项目列表：显示已有项目 + 大厅入口，一键创建对话
- [ ] 删除自建目录浏览器（`browseExpanded` 折叠面板等）
- [ ] 猫猫选择器保留（现有 CatSelector 组件）
- [ ] 移动端仍可用（响应式，移动端降级为路径输入 + 最近项目）
- [ ] 视觉设计经铲屎官确认

## 需求点 Checklist

| # | 需求 | AC 映射 | 状态 |
|---|------|---------|------|
| R1 | 系统原生文件选择器（osascript） | AC-1, AC-2 | 🔴 |
| R2 | 路径输入框（常驻） | AC-3 | 🔴 |
| R3 | 最近项目快捷入口 | AC-4 | 🔴 |
| R4 | 删除自建目录浏览器 | AC-5 | 🔴 |
| R5 | 移动端响应式降级 | AC-7 | 🔴 |
| R6 | 视觉设计确认 | AC-8 | 🔴 |

## Links

- 铲屎官反馈截图: Thread `thread_mm4dj9jp0tij0ch3` 2026-03-06
- 设计稿: `designs/new-project.pen`（Pencil 文件）
- 现有组件: `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`
- API 端点: `packages/api/src/routes/projects.ts`

## Key Decisions

1. **用 `osascript` 调用系统原生选择器** — 因为我们是本地应用（localhost），可以通过后端执行 `osascript -e 'POSIX path of (choose folder)'` 弹出 macOS 原生 NSOpenPanel。Web API (`showDirectoryPicker()`) 无法获取绝对路径，不适用。
2. **删除自建目录浏览器** — 有原生选择器后，自建浏览器体验始终不如系统原生，删掉简化代码。
3. **三入口设计** — 原生选择器（浏览）+ 路径输入（精准）+ 最近项目（快捷），覆盖所有使用场景。

## Dependencies

- Evolved from: F063 (Hub Workspace Explorer)

## Risk

- Low — 改动集中在一个弹窗组件 + 一个新 API 端点
- `osascript` 仅 macOS 可用，Linux/Windows 部署需降级方案（保留路径输入 + 最近项目）
- 原生选择器是阻塞调用，用户取消时 API 需正确处理超时

## Open Questions

- Linux 部署时是否需要 `zenity` / `kdialog` 替代 `osascript`？（当前仅 macOS 使用，暂不考虑）

## Review Gate

- 视觉设计：铲屎官确认
- Code review：跨家族 peer review

## Timeline

| Date | Event |
|------|-------|
| 2026-03-06 | Kickoff — 铲屎官反馈 + 立项 |
| 2026-03-06 | 设计迭代 — 从自建浏览器 → 系统原生选择器方案收敛 |
| 2026-03-06 | 设计稿完成 — `designs/new-project.pen`，铲屎官确认方向 |
