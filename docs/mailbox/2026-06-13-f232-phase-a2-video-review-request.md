---
doc_kind: review-request
feature_ids: [F232]
reviewer: gpt52
author: opus
created: 2026-06-13
---

# Review Request: F232 Phase A.2 — video artifact panel playback (AC-A9)

Review-Target-ID: f232-a2
Branch: feat/f232-video-artifacts

## What

跨层补视频产物类型支持——图能看、音频能放、视频也能在 panel 内播放（不再只走"下载"）。

5 个文件 + 2 个测试文件，+108/-8 行，纯扩展（不碰核心逻辑）：

| 层 | 文件 | 改动 |
|----|------|------|
| shared | `thread-artifact.ts` | `ThreadArtifactType` union 加 `'video'` |
| api | `thread-artifacts-aggregator.ts` | `case 'file'` 检测 mimeType(`video/*`) 或 VIDEO_EXTENSIONS(mp4/mov/webm/avi/mkv/m4v/ogv) → `type: 'video'` |
| web | `artifact-view.ts` | `ArtifactView` 加 `'video'`，`classifyArtifactView` 加 `if (type === 'video' && url) return 'video'` |
| web | `ArtifactDetailView.tsx` | `<video controls>` 渲染（仿 audio，浏览器自动带 cookie） |
| web | `ArtifactsPanel.tsx` | `IconVideo` SVG + TYPE_TINT + FilterKey/chips/counts/summary 补 video |

## Why

铲屎官 dogfood 发现：产物面板漏了视频类型。Phase A.1 已做 image/audio/text/download/pr 五种查看策略，唯独视频（mp4/mov/webm）被归成 `file` → 命中二进制扩展名 → 走"下载"分支。与 AC-A7「点击看内容」愿景不对齐。

## Original Requirements（必填）

> 铲屎官 2026-06-12："忘记考虑视频之类的东西了"
> 铲屎官 2026-06-12："图能看、音频能放，视频只能下载"
- 来源：`docs/features/F232-thread-artifacts-panel.md` Phase A.2 段 + AC-A9
- **请对照上面的摘录判断：视频产物点击后能否在 panel 内播放**

## Tradeoff

- **只做 `file` block 的视频识别，不做 `media_gallery` 的视频识别**：media_gallery 设计上是图片画廊（items 无 mimeType/type 字段），实际存视频可能性低。如果将来 media_gallery 要存视频，是 Phase B 的事。
- **mimeType 优先 + 扩展名 fallback**：mimeType 比扩展名更可靠（file block 有 `mimeType?: string`），但旧 block 可能没 mimeType 所以需要扩展名 fallback。
- **不加 `<track>` 字幕标签**：biome accessibility 会 warn，但音频也没加字幕（同模式），且 Cat Cafe 视频产物暂无字幕源。

## Architecture Ownership（必填）

Architecture cell: `hub-action-surface`（A.1 已声明，A.2 复用）
Map delta: none（纯 type 扩展，不新增 endpoint / store / 路由）
Why: 已有 3 源聚合管线 + classify + detail view 架构不变，只加一个 type 分支

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（不应有新 store/route/adapter）
- aggregator 视频识别逻辑是否可能误判（non-video file 被标 video）

## Open Questions

### 技术 OQ（给 reviewer）
1. `VIDEO_EXTENSIONS` 集合是否遗漏常见视频格式？当前：mp4/mov/webm/avi/mkv/m4v/ogv
2. aggregator 的 `extensionOf` 与 artifact-view 的同名函数是独立实现——是否应抽到 shared？（我判断 scope 太小不值得，但请核）

### 价值 OQ（给 CVO，如有）
无——纯技术扩展，铲屎官已 signoff AC-A9。

## Next Action

请 review 代码逻辑正确性，放行 → @ 我做 merge-gate squash merge + 文档同步 AC-A9 ✅。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f232-a2/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 分配（禁 3001/3002/3011/3012/4111）
- **前端浏览器实测 exception**：造"有视频产物的 thread"需真实上传视频文件，worktree 离线难造，走 alpha 验收（同 A.1 先例 `feedback_real_data` + 铁律#4）。

## 自检证据

### Spec 合规
AC-A9 逐条覆盖（shared type / aggregator 识别 / classify / render / 筛选图标计数 / test 覆盖）。

### 测试结果
```
aggregator  16/16 passed, 0 failed（含 4 新 video 测试）
classify    25/25 passed, 0 failed（含 2 新 video 测试）
detail       4/4 passed
panel-jump   1/1 passed
pnpm gate (--no-rebase): build ✓ / tsc ✓ / 全量测试 ✓ / lint ✓ / check ✓ (187s)
```

### 我最可能错在哪（帮你定向攻击）
1. `VIDEO_EXTENSIONS` 集合可能漏格式（如 flv/3gp/wmv——但浏览器 `<video>` 本就不支持这些）
2. aggregator `extensionOf` 实现与 artifact-view 的独立——但行为一致（取最后 `.` 后 lowercase），且 aggregator 是 API 侧 JS、artifact-view 是 web 侧 TS，不能共享
3. `<video>` 没加 `preload="metadata"` 可能导致大视频在 panel 里自动预加载整个文件（但 `controls` 属性下浏览器默认已是 metadata only）

### 相关文档
- Feature: `docs/features/F232-thread-artifacts-panel.md` AC-A9
- Plan: 5 步跨层改动直接按 spec AC-A9 执行（scope 小无需独立 plan）
- PR: #2269
