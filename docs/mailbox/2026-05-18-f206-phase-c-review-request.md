# Review Request: F206 Phase C — Signals styling + Mission Hub dedup

Review-Target-ID: f206-phase-c
Branch: feat/f206-phase-c

## What

3 个 AC，4 个文件，-57 净行：

1. **AC-C1 Signals 列表样式对齐开源**：从卡片式布局改为紧凑行布局（source 首字母图标 + 标题/source/日期 + 右侧 tier badge + 操作按钮）。Tier badge 加 `shrink-0 whitespace-nowrap text-[11px]` 修复圆形溢出。保留我们的 note indicator（✎）和 study count（学N）功能。
2. **AC-C2 Mission Hub 去重**：删除对话侧栏顶部的 Mission Hub 卡片（左侧 ActivityBar 已有入口）。测试更新为验证该元素不存在。
3. **AC-C3 侧栏图标 tooltip**：已有——ActivityBar 所有 nav button 都有 `title={item.label}`，无需改动。

## Why

铲屎官重启 runtime 后对比开源发现 Signals 页 Tier badge 溢出成圆形、布局比开源松散。同时发现 Mission Hub 有重复入口。CVO directive："我们的 signal 可以学开源的样式吗？搬回来那边的好看多了？记得功能别丢样式学他们的。"

## Original Requirements（必填）

> "我们的 signal 可以学开源的样式吗？搬回来那边的好看多了？记得功能别丢样式学他们的"
> "字体不统一？还是什么？或者太大了，导致比如 tier1 那些圆形超过了或者说换行了 很丑"
> "Mission Hub 重复入口——对话侧栏顶部的 Mission Hub 卡片和左侧导航栏第二个图标（品字形）是同一个入口。对话侧栏那个可以去掉"

- 来源：CVO 实时消息 2026-05-18，F206 spec Phase C 章节
- **请对照上面的摘录判断：样式是否更紧凑、功能是否保留、重复入口是否清除**

## Tradeoff

- 采用开源的紧凑行布局替代我们原先的卡片式，牺牲了卡片边框的视觉分隔感，换来更高的信息密度
- `onStatusChange` 从 `Promise<void> | undefined` 改为始终存在（action 按钮不条件渲染），与我们 always-available 的 API 一致

## Architecture Ownership（必填）

Architecture cell: web/signals
Map delta: none
Why: 纯 UI 样式迁移，无新 Store/Router/Adapter，信号领域模型和 API 不变

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `onStatusChange` 的类型签名从 optional (`?:`) 保持为 required（与我们现有类型一致），开源版改成了 optional。确认这不会导致调用方 type error。
2. empty state 改用了开源的 SVG 图标 + 双行文案，确认视觉合理。

### 价值 OQ（给 CVO，如有）

无。

## Next Action

请 review 代码 + 起 dev server 浏览器实测 Signals 列表页，确认：
- Tier badge 不再溢出成圆形
- 列表项紧凑度接近开源
- note indicator（✎）和 study count（学N）功能保留
- Mission Hub 在对话侧栏不再出现

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f206-phase-c/codex`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202（review:start 默认）

## 自检证据

### Spec 合规

- AC-C1: ✅ 布局对齐开源，Tier badge `text-[11px]` + `shrink-0 whitespace-nowrap`，note/study-count 保留
- AC-C2: ✅ ThreadSidebar.tsx Mission Hub 按钮块删除，test 改为验证不存在
- AC-C3: ✅ 已有 `title={item.label}` 在 ActivityBar 所有 nav button 上

### 测试结果

```
pnpm --filter @cat-cafe/web test    # 3098 passed, 0 failed
pnpm lint                           # 只有 pre-existing warnings
```

### 根目录工件闸门

```
工作树媒体文件: clean
已提交差异媒体文件: clean
```

### 相关文档

- Feature: `docs/features/F206-settings-ui-convergence.md` Phase C
- 开源参考: `clowder-ai/packages/web/src/components/signals/SignalArticleList.tsx`

### 如果判断错了我最可能错在哪

1. `onStatusChange` 类型 required vs optional 可能让开源版调用方编译不过（但我们版本从未用过 optional）
2. empty state SVG 可能和我们的设计语言不完全匹配
3. source initial icon 没有 fallback 颜色区分（开源也没有，但我们的 cat avatar 体系可能期望更多）
