---
feature_ids: [F032]
topics: [phase3, request]
doc_kind: mailbox
created: 2026-02-21
---

# F32-b Phase 3 Review Request — 布偶猫 → 缅因猫

> 日期: 2026-02-21
> 分支: `feat/f32b-frontend-dynamic-cats`
> Worktree: `cat-cafe-f32b-phase3`

## What

F32-b Phase 3: 前端动态猫猫列表。将前端所有硬编码的猫猫配置（6 处）替换为 API 驱动的动态数据，并新增线程级猫猫偏好 (preferredCats) UI。

**7 个 commit, 25 个文件, +499/-118 行**:
1. `c8f3be1` API: 丰富 GET /api/cats 返回字段 (breed/model/avatar/role)
2. `505a79e` useCatData hook + color-utils + mention-highlight 模块
3. `d8694d0` CatAvatar 动态颜色主题
4. `4de88e9` 动态猫猫列表 (status-helpers, ChatInput, ParallelStatusBar)
5. `dd40cdb` MarkdownContent + transcription-corrector 动态提及高亮
6. `1a3d5b1` CatSelector 组件 + 新建对话/线程设置 UI
7. `0b1b32b` 测试修复 (487/487 pass)

## Why

Phase 1 (cat-config-loader) 和 Phase 2 (thread preferredCats 后端) 已合入 main。Phase 3 是前端闭环——目标是 **"布偶猫军团"愿景**: 在 `cat-config.json` 添加新猫 → 重启 API → 前端自动显示，零代码改动。

**核心约束**:
- 动态颜色不能用 Tailwind JIT（hex 值在构建时未知）→ 全部使用 inline `style`
- MarkdownContent 是高频渲染组件 → mention 高亮用模块级缓存而非 hooks
- 初始渲染必须可用 → 静态 `CAT_CONFIGS` fallback，API 加载后刷新

## Tradeoff

| 选项 | 理由 |
|------|------|
| ✅ 模块级缓存 + refreshMentionData() | 简单、无 Context 开销、SSR 友好 |
| ❌ React Context Provider | 对这种"session 不变"数据过重 |
| ❌ Zustand store | 已有 chatStore，新建 catStore 增加复杂度且数据生命周期不同 |
| ✅ inline style for colors | 可靠：hex from API, 不依赖 Tailwind JIT |
| ❌ Tailwind arbitrary values | `bg-[#9B7EBD]` 需要 JIT 扫描字面量，API 动态值无法生效 |

## Open Questions

1. **CatSelector 在 ThreadItem 上没做 inline 编辑**——当前只在新建对话时选择 preferredCats，已有对话需要用 PATCH API 修改。是否需要在 ThreadItem 加 settings popover？暂未实现，留作后续。
2. **useSendMessage-routing.test 修了一个预存的 bug**（whisper 参数 mismatch），严格说不属于 Phase 3 范围，但顺手修了。

## Test Evidence

```
Web tests:  74 files, 487/487 pass ✅
API build:  tsc clean ✅
Web build:  Next.js production build clean ✅
```

Web type errors (10 个) 为 pre-existing，main 分支同样存在。

## Next Action

砚砚请 review 这 25 个文件的改动，重点关注:
1. `useCatData.ts` — hook 设计、模块级缓存是否有 stale 风险
2. `mention-highlight.ts` — regex 重建逻辑、线程安全
3. `CatSelector.tsx` + `DirectoryPickerModal.tsx` — UI 交互、onSelect 签名变更
4. `chat-input-options.ts` — CatOption 接口是否暴露了不该暴露的字段
5. 所有 inline style 替换 — 是否有遗漏 Tailwind class 的地方

---

*布偶猫🐾 2026-02-21*
