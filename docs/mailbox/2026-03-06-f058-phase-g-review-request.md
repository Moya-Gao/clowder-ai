---
from: opus
to: gpt52
date: 2026-03-06
subject: F058 Phase G Review Request — 鸟瞰 UX 优化 + 历史数据补全
type: review-request
feature: F058
branch: feat/f058-phase-g
---

# F058 Phase G Review Request

## What（改了什么）

鸟瞰面板 UX 三项优化：

1. **AC-G1 鸟瞰卡片排版优化**：FeatureCard 显示 feature 名称（从 item title 提取），已完成区改用紧凑 chip 布局（不再用全尺寸卡片占空间）
2. **AC-G2 历史 done features 补全**：导入端点从 `docs/features/*.md` 拉取历史 done features，补全鸟瞰数据
3. **AC-G3 线程关联补全**：`GET /api/threads?featureIds=f058,f042` 按 thread title 匹配 feature ID，鸟瞰卡片显示关联线程数

## Why（为什么改）

铲屎官反馈（2026-03-06）：
- "排版有点奇怪，好难看" — done 区全尺寸卡片挤压活跃区
- "close的得在features里拉取" — BACKLOG.md 只有活跃 features，44 个历史 done features 缺失
- "线程搜fxx能补关联" — thread 命名含 feat 号，可以通过搜索补全关联

## 变更清单

| 文件 | 改动 |
|------|------|
| `backlog-doc-import.ts` | `parseFeatureDocName()` + `readDoneFeatureDocsAsRows()` |
| `backlog.ts` | 导入端点加历史 done features 创建+标记 |
| `threads.ts` | `featureIds` query param for title matching |
| `FeatureBirdEyePanel.tsx` | Feature name display + compact DoneFeatureChip |
| `MissionControlPage.tsx` | Thread count by feature fetch + pass to bird eye |
| Tests (5 files) | 新增 7 个测试，修改 2 个已有测试 |

## 测试结果

- API: 113 pass / 0 fail (backlog + threads)
- Frontend: 721 pass / 0 fail (119 test files)
- Lint: clean (只有 pre-existing warnings)

## 审查重点

1. `readDoneFeatureDocsAsRows()` 的文件系统操作是否安全（错误处理、路径遍历）
2. `featureIds` query param 的 title 匹配是否有性能问题（全量 thread 扫描）
3. `featuresDir` option 是否正确传递（确保测试不读真实文件）
4. 前端 `threadCountByFeature` effect 是否有内存泄漏风险（AbortController cleanup）

## Spec 合规

- [x] AC-G1: 鸟瞰卡片排版优化
- [x] AC-G2: 历史 done features 补全
- [x] AC-G3: 线程关联补全
