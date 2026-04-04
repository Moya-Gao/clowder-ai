# Review Request: fix(F091) Signal Hunter Bug Audit — 11 fixes

Review-Target-ID: f091-bug-audit
Branch: feat/f091-bug-audit
PR: #948

## What

修复 Signal Hunter 13 个已知 bug 中的 11 个（6 P1 + 3 P2 + 2 P3）。
核心变更：后端 article 查询从 meta.json sidecar 回填 studyCount/lastStudiedAt，前端补上缺失的 tabs 和筛选修复。

## Why

铲屎官报告"收藏文章消失 + 找不到学习过的文章"。布偶猫初筛 + 缅因猫(GPT-5.4) 补查，共发现 13 个问题。本次修了 11 个，剩余 2 个需设计讨论。

## Original Requirements（必填）

> 铲屎官 2026-04-03 19:13: "我发现我们的f21做的那个哈哈哈有bug！文章一点收藏不见了！然后我也没办法很好的去找我哪些文章是学习过的！！"
>
> F091 wireframe Screen D 设计了 "Tab 过滤：全部 / 未读 / 已学习 / 收藏"，但实现只有 Inbox/已读/全部。
>
> F091 AC-9: "有 study 的文章在列表有视觉标记 (studyCount badge + ✎ note icon)"

- 来源：`docs/features/F091-signal-study-mode.md` Known Issues 段落（2026-04-03 审计）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- "已学习"筛选维度（P2 #7）未做——需要产品决策：独立 tab vs 过滤开关
- batch "加标签"前端已加按钮，但后端 batch API 的 tags 是覆盖语义不是追加——现有行为可能需要确认

## Open Questions

1. `enrichWithStudyMeta` 在 listInbox 时对每篇文章读一次 meta.json（Promise.all）——50+ 文章时 IO 是否需要优化？当前是 readFile catch fallback，失败返回空 meta，不会阻塞
2. deep-link effect 在首次 load 完成后切到 'all' tab 再 fetch——是否有更优雅的方案？
3. handleStatusChange 现在在非 'all' 模式下过滤掉状态不匹配的文章——是否需要 toast 提示用户"已移到 XX tab"？

## Next Action

请 review 代码质量 + 逻辑正确性。特别关注 enrichWithStudyMeta 的 IO 模式和 deep-link effect 的竞态。

## 自检证据

### Spec 合规

11/13 issues resolved。5 个 AC regression 全部修复（AC-9, AC-16, AC-17, AC-19, AC-21）。Quality Gate PASS。

### 测试结果

```
signal API tests: 36/36 pass, 0 fail ✅
pnpm -w run check: 0 errors ✅ (biome)
pnpm -w run lint: 0 errors ✅ (typescript)
pnpm run build (api): exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F091-signal-study-mode.md`（Known Issues 段落）
- Wireframe: `designs/mission-hub-f091-signal-study-mode.pen`（Screen D）
