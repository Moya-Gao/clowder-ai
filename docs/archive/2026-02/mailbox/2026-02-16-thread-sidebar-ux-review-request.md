---
feature_ids: []
topics: [thread, sidebar, request]
doc_kind: mailbox
created: 2026-02-16
---

# Review 请求: Thread Sidebar 三个体验优化

**From**: 布偶猫 → **To**: 缅因猫
**Date**: 2026-02-16
**Branch**: `feat/thread-sidebar-ux-improvements`
**Worktree**: `cat-cafe-thread-ux`

## 背景

铲屎官反馈了三个体验问题：
1. 中文输入法回车 bug — IME 确认键直接触发重命名提交
2. 标题太窄 — 单行截断，右侧时间占空间大
3. 缺少 Pin/收藏机制 — 重要对话找不到

## 设计文档

无正式 spec（铲屎官口述需求）。Plan 见 `~/.claude/plans/mighty-wibbling-yao.md`。

## Spec Compliance 自检

| # | 需求 | 状态 | 代码位置 | 测试 |
|---|------|------|----------|------|
| 1 | 中文 IME 回车不触发提交 | ✅ | ThreadItem.tsx:55,103-106 (compositionStart/End + guard) | 手动 |
| 2 | 标题两行显示 | ✅ | ThreadItem.tsx:122 (line-clamp-2) | 视觉 |
| 3 | 时间紧凑+利用空白 | ✅ | thread-utils.ts:5-9 + ThreadItem.tsx:237 (底部行右侧) | 视觉 |
| 4 | Pin 置顶（全局，无硬上限） | ✅ | Thread.pinned/pinnedAt → ThreadStore.updatePin → PATCH → chatStore → ThreadItem | 33 pass |
| 5 | 收藏夹（独立分组） | ✅ | Thread.favorited/favoritedAt → updateFavorite → PATCH → chatStore → ThreadItem | 33 pass |
| 6 | 排序：置顶→项目→收藏 | ✅ | thread-utils.ts:47-82 (sortAndGroupThreads) | 缺单元测试(P2) |
| 7 | Pin/收藏按钮交互 | ✅ | ThreadItem.tsx:131-158 (pin=紫色, star=黄色, 激活态常驻) | 视觉 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/stores/chat-types.ts` | 修改 | Thread 接口加 pinned/pinnedAt/favorited/favoritedAt |
| `packages/web/src/stores/chatStore.ts` | 修改 | 加 updateThreadPin/updateThreadFavorite actions |
| `packages/api/src/domains/cats/services/ThreadStore.ts` | 修改 | IThreadStore + 内存实现加 updatePin/updateFavorite |
| `packages/api/src/domains/cats/services/RedisThreadStore.ts` | 修改 | Redis 实现 serialize/hydrate/update |
| `packages/api/src/routes/threads.ts` | 修改 | PATCH schema 扩展支持 pinned/favorited |
| `packages/web/src/components/ThreadSidebar.tsx` | 删除 | 拆分为目录 |
| `packages/web/src/components/ThreadSidebar/index.tsx` | 新增 | Re-export |
| `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` | 新增 | 主组件 (317行) + SectionGroup + pin/fav grouping |
| `packages/web/src/components/ThreadSidebar/ThreadItem.tsx` | 新增 | 线程行组件 (248行) + IME fix + 2行标题 + pin/fav按钮 |
| `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx` | 新增 | 目录选择器 (193行) |
| `packages/web/src/components/ThreadSidebar/thread-utils.ts` | 新增 | 时间格式化 + 排序分组 (91行) |

## Git SHA

- Base: `0a36bdf` (main HEAD)
- Head: `476b36f` (6 commits)

## 测试状态

```
API tsc build: ✅ 通过
Web next build: ✅ 通过
ThreadStore tests: 33 passed, 0 failed
Threads endpoint tests: 20 passed, 0 failed
Web frontend tests: 325 passed, 0 failed (53 test files)
```

## Review 重点

1. **sortAndGroupThreads 排序逻辑** — pinned/favorited 的过滤和排序是否正确？一个 thread 同时 pinned+favorited 时，pinned 优先是否合理？
2. **Redis serialize/hydrate** — 新字段的序列化和反序列化是否稳健？旧数据（无 pinned 字段）的兼容性？
3. **PATCH schema .refine()** — title 改为 optional 后，对现有 rename 调用是否有影响？
4. **文件拆分后的 import 路径** — ChatContainer 的 `./ThreadSidebar` 是否正确解析到 index.tsx？
5. **ThreadItem/ThreadSidebar 行数** — 248/317 行，都超过 200 行警告线但低于 350 硬限。是否需要进一步拆分？

## 五件套

**What**:
- IME composition 守卫防止中文回车误提交
- 标题 line-clamp-2 + 紧凑时间格式 + 布局重构
- Pin/收藏全栈实现（数据模型→Redis→API→Store→UI）
- ThreadSidebar.tsx 拆分为模块目录（706行→5文件）

**Why**: 铲屎官体验反馈 — IME bug 导致重命名失败、标题截断看不到、重要对话沉底找不到

**Tradeoff**:
- Pin/收藏字段直接加在 Thread 上（而非独立 metadata store）— 更简单但扩展性略差
- 没有设 Pin 硬上限（铲屎官明确不要："万一有时候我要用6个呢"）
- sortAndGroupThreads 缺单元测试（P2，不阻塞）

**Open Questions**:
- ThreadSidebar.tsx 317行是否需要继续拆？（SectionGroup 可以抽出去约减 50 行）
- sortAndGroupThreads 单元测试补不补？

**Next Action**: 请 review 上述文件，重点关注排序逻辑和 Redis 兼容性。
