---
feature_ids: [F058]
topics: [lessons-learned, quality-gate, verification]
doc_kind: story
created: 2026-03-05
---

# F058 教训：grep 代码不是愿景守护

> "明明不能用！刷新之后都进度不对吧？右下角那些东西看都看不到！你还不能 done"
> — 铲屎官，2026-03-05

## 发生了什么

F058 Mission Control 增强分三个 Phase（A/B/C），三个 PR 都合入了 main，云端 Codex review 全部通过（0 P1/0 P2）。

布偶猫做"愿景守护"时，对着 12 个 AC 逐条用 `grep` 搜代码关键词，确认代码里有对应逻辑就打勾 ✅，然后把 F058 标成了 `done`。

铲屎官打开 Hub 一看——**全是 bug**：
1. 27 个 feature 全堆在 Open 栏，Suggested 和 Dispatched 全空。`in-progress` 的 F064、`in-review` 的 F063 都显示成 `open`。
2. 右下角的"线程态势"和"Feature 鸟瞰"面板完全看不到，被 SuggestionDrawer 挡住了。

## 根因

### Bug 1：导入不映射工作流状态

`buildBacklogInputFromFeature`（`backlog-doc-import.ts:96`）把 BACKLOG.md 里 feature 的 status（`in-progress`/`in-review`）只存到了 tags 里（`status:in-progress`），但 BacklogItem 的 `status` 字段永远是默认值 `'open'`。

grep 搜"in-progress"能搜到——因为 tag 里确实有。但 UI 的看板是按 `item.status` 分栏的，不是按 tag。

### Bug 2：右侧面板被截断

Layout 是 `xl:grid-cols-[minmax(0,1fr)_320px]`，右侧 320px 里放了 SuggestionDrawer + ThreadSituationPanel + FeatureBirdEyePanel。SuggestionDrawer 就占满了，后面两个面板超出边界，被外层 `overflow-hidden` 截掉。

### 虚假验证：grep ≠ 验证

布偶猫的"愿景守护"流程：
1. `grep -n "status" MissionControlPage.tsx` → 有 `'open'`/`'dispatched'`/`'done'` 分栏逻辑 → ✅
2. `grep -n "FeatureBirdEyePanel"` → 有 import 和使用 → ✅
3. 12 个 AC 全打勾 → 标 `done`

实际上 quality-gate skill（Step 0 ③）明确写了："问自己：铲屎官坐在 Hub 前用这个功能，体验是什么样的？"——但布偶猫没加载这个 skill。

## 教训

| 做法 | 结果 |
|------|------|
| grep 代码有关键词 → 打勾 | 🔴 代码有 ≠ 功能正确 |
| 看代码逻辑"应该没问题" → 打勾 | 🔴 推断 ≠ 验证 |
| AC 全勾 → 标 done | 🔴 AC 通过 ≠ 产品可用 |
| 实际打开产品看效果 | ✅ 唯一有效的前端验证 |

**核心教训**：前端功能的愿景守护，必须看到实际 UI 效果。代码审查、测试通过、云端 review 通过——这些都不能替代"打开 Hub 看一眼"。

quality-gate skill 里写了"≤3 张截图 + 1 段 15s 录屏"——这不是形式主义，是防止 grep 代替验证的最后一道防线。

## 修复

追加 Phase D（AC-D1: 导入状态映射、AC-D2: Layout 修复），回退 F058 为 `in-progress`。
