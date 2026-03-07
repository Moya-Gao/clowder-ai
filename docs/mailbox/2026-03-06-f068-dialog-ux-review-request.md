---
feature_ids: [F068]
topics: [review-request]
doc_kind: mailbox
created: 2026-03-06
---

# Review Request: F068 新建对话弹窗 UX 优化

## What
重写"新建对话"弹窗的目录选择体验：
1. **新增 `POST /api/projects/pick-directory`** — 通过 `osascript` 调用 macOS 原生文件选择器（NSOpenPanel）
2. **重写 `DirectoryPickerModal`** — 删除自建目录浏览器，替换为三入口设计：原生选择器按钮 + 路径输入框 + 最近项目快捷列表
3. **净减 20 行**（4 files, +281/-301）

## Why
铲屎官反馈弹窗"太难用"：目录浏览器默认折叠看不见、只能一级一级点、没有直接输入路径的方式。通过调用系统原生选择器，提供和上传文件完全一致的 Finder 体验。

## Original Requirements（必填）
> "新建对话太难用了！最下面那个栏目那么小根本看不到，也没一个 browser 能让我好好选"
> "哪个按钮和我们上传图片这种类似能召唤出这个啊！"
> "能不能给我一个输入栏 我直接输入一个地址"
> "我只想有这样的体验！"（附 macOS Finder 截图）
- 来源：Thread `thread_mm4dj9jp0tij0ch3` 2026-03-06
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **放弃了自建文件浏览器** — 有原生选择器后体验始终不如系统原生，删掉简化代码
- **放弃了 `showDirectoryPicker()` Web API** — 无法获取绝对路径，不适用于我们后端需要绝对路径的场景
- **`osascript` 仅 macOS** — 当前只在 macOS 使用，Linux 降级为路径输入 + 最近项目

## Open Questions
1. `execPickDirectory` 用了 `let + setter` 模式做测试注入，是否有更好的 DI 方式？
2. 路径输入框提交后不做后端验证直接创建对话——是否需要先 validate 路径存在？
3. 前端在 `isPicking` 期间按钮 disabled + "等待选择..." 动画，UX 是否足够？

## Next Action
请 review 代码质量 + 对照铲屎官原始需求判断是否解决了问题。

## 自检证据

### Spec 合规
- 愿景覆盖 5/5 铲屎官原始需求 ✅
- AC 8 项全部实现 ✅
- 删除旧浏览器代码（browseData/browseExpanded/browseTo/DirEntry/BrowseResult）✅

### 测试结果
```
Web tests  → 120 files, 736/736 pass ✅
API tests  → 21/21 pass, 0 fail ✅
pnpm lint  → 0 errors ✅
pnpm build (web) → exit 0 ✅
pnpm build (api) → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F068-new-thread-dialog-ux.md`
- Plan: `docs/plans/2026-03-06-f068-new-thread-dialog-ux.md`
- Design: `designs/new-project.pen`
