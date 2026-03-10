# Review Request: F058 Phase I — Feature Progress Dashboard + Doc 模板统一

## What

在 Mission Hub 的 FeatureRow 中新增**行内多级展开**的 Feature 进度面板：
- 一级展开：Phase 进度条（从 feature doc 实时解析）+ Timeline/Risk 信息
- 二级展开：点击 Phase 展开 AC checklist（done/pending 状态）
- 新建 feature doc 标准模板，为 parser 提供统一格式
- 补充 3 个活跃 feature docs 的 `related_features`，修复依赖图空数据问题

**新增文件 (3)**：
- `packages/api/src/routes/feature-doc-detail.ts` — GET /api/backlog/feature-doc-detail 端点
- `packages/web/src/hooks/useFeatureDocDetail.ts` — 懒加载 hook
- `packages/web/src/components/mission-control/FeatureProgressPanel.tsx` — Phase 进度条 + AC 展开组件

**修改文件**：
- `packages/shared/src/types/backlog.ts` — FeatureDocDetail 等 4 个类型
- `packages/api/src/routes/backlog-doc-import.ts` — parseFeatureDocPhases/Risks 两个 parser + export parseFeatureDocOwner
- `packages/web/src/components/mission-control/FeatureRowList.tsx` — 集成 hook + 组件
- 3 个 feature docs + test helpers + tests

## Why

铲屎官在 Mission Hub 上看不到 feature 进度详情（只能看到 dispatched/done 状态），也无法一目了然知道每个 Phase 做到哪了。依赖图 tab 一直显示"暂无数据"是因为 feature docs 没有声明依赖关系。

## Original Requirements（必填）

> [02:01 铲屎官] "我发现！有个东西可以做！比如说这里我不知道你们这个feat进度如何了！是不是可以有个怎么样的页面展示出来？让我知道这个feat到底有什么phase！"
> [02:01 铲屎官] "feat互相依赖的可能有点点bug 现在好像看不到有向图"
> [02:26 铲屎官] "下拉展开为什么不能展开完整的呢！？甚至 phases 我点击你还能展开每个 phases 下面的项目？"
> [03:16 铲屎官] "skills/feat 从现在就要开始统一？你可以在skills ref里先建立你需要的模板？"

- 来源：Thread `thread_mm72eyvcbnb7jjbv`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择从 feature doc 实时解析（而非扩展 BacklogItem schema）— 避免 store 迁移，feature doc 作为单一真相源
- 不做独立详情页（KD-7）— 铲屎官明确说行内展开就够了

## Open Questions

1. **Parser 鲁棒性**：目前只匹配 `### Phase X: Name` 和 `AC-{Phase}{N}` 格式。历史 feature docs 格式不统一的部分会显示空 Phase —— 是否需要更宽松的匹配？
2. **AC-I2 和 AC-I6 未实现**：feat-lifecycle 自动复制模板 + 历史 docs 迁移，需铲屎官确认模板后做。这是否可以作为后续 Phase 独立交付？

## Next Action

请做 R1 review，关注：
1. Parser 正则的 edge case 覆盖
2. FeatureProgressPanel 组件结构是否合理
3. API 端点是否有安全/性能隐患（每次展开都读 git）

## 自检证据

### Spec 合规

| # | 要求 | 状态 |
|---|------|------|
| I1 | Feature doc 标准模板 | ✅ `cat-cafe-skills/refs/feature-doc-template.md` |
| I3 | FeatureRow 一级展开 Phase 进度条 | ✅ |
| I4 | Phase 二级展开 AC checklist | ✅ |
| I5 | 依赖图有数据 | ✅ 3 docs updated |
| I2 | feat-lifecycle 自动复制模板 | ⬜ 后续 |
| I6 | 历史 docs 迁移 | ⬜ 后续 |

### 测试结果

```
Parser tests:        5/5 pass ✅
Web tests:           924/926 pass (2 pre-existing fails) ✅
Shared build:        exit 0 ✅
File sizes:          all under 350 lines ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-10-f058-phase-i-progress-dashboard.md`
- Feature: `docs/features/F058-mission-control-enhancements.md`
- Template: `cat-cafe-skills/refs/feature-doc-template.md`
