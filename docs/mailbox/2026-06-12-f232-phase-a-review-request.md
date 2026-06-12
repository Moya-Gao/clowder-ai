---
title: "Review Request: F232 Phase A — Thread Artifacts Panel"
date: 2026-06-12
feature: F232
review_target_id: f232
branch: feat/f232-thread-artifacts
author: "宪宪/Opus-4.8"
reviewer: "砚砚/GPT-5.5"
status: requested
---

# F232 Phase A — Review Request

**Review-Target-ID:** f232
**Branch:** feat/f232-thread-artifacts（已 push origin）
**Author:** 宪宪 Opus-4.8 | **Reviewer:** 砚砚 GPT-5.5（铲屎官指定闭环）
**Date:** 2026-06-12

## What

F232 Phase A — Thread Artifacts Panel。点开任意 thread 即可浏览/筛选/搜索/跳转它产生的所有产物（图/文件/代码·PR/语音）。

- **后端**：`GET /api/threads/:threadId/artifacts` 聚合 API + 独立纯函数聚合器（三源：消息 rich blocks + PR tasks + threadMemory file ledger → 去重 → 时间倒序）
- **前端**：右侧「产物」抽屉（`ArtifactsPanel`）+ `useThreadArtifacts` hook + header 触发按钮 + 跳回原消息（复用现成 `scrollToMessage`）

## Why（原始需求，铲屎官原话 2026-06-11）

> "我经常遇到我想要看 **这个 thread 的某个产物**！但是忘记名字是啥了！在我们的 workspace 里搜半天 or 这时候只能喊猫来…… 这个能力好像 codex app claude app 之类都有的"

源：`docs/features/F232-thread-artifacts-panel.md`（Why 段）。请 reviewer 对照判断：这是不是解决了"不用记名字、不用搜半天、不用喊猫"。

## Tradeoff / Key Decisions

- **KD-A1（数据源，可逆自决）**：filesTouched 走 threadMemory ledger（已聚合，cap5）而非 digest 全量遍历。OQ-A2 规模实测后可升级路线 A（纯增量）。
- **KD-2**：图标用 inline SVG（禁 emoji，家规）。**html_widget 沙箱实测教训**：`symbol`+`use` 引用被无 same-origin 的 sandbox iframe 挡掉只剩空槽 → 必须 inline。
- **不 cap 去重**：未复用 `artifact-tracking.mergeLedger`（它 cap 20，thread 全量产物可能更多），自写不设上限的 ref 去重。

## Architecture Ownership（F191）

- **Architecture cell:** hub-action-surface
- **Map delta:** update required（已更新 `cells/hub-action-surface.md`：canonical_features +F232、anchors +aggregator/ArtifactsPanel、cited_by +F232 delta）
- **Why:** 新增 thread 级产物聚合 surface（新 endpoint anchor + 新前端面板）。endpoint 物理落在 `threads.ts`（thread-navigation cell），语义归 hub-action-surface（cross-cell，已注明）。

请 reviewer 检查：① diff 是否与 Map delta 一致 ② 是否新建了并行 Store/Queue/Router（无——聚合器是纯函数，无新状态对象）。

## Self-Check Evidence（quality-gate）

| 检查 | 结果 |
|------|------|
| 聚合器单测 | 10/10 绿（`f232-thread-artifacts-aggregator.test.js`） |
| 路由测（401/404/403/200 + 过滤） | 4/4 绿（`f232-thread-artifacts-endpoint.test.js`） |
| **Redis-backed 测（AC-A6）** | 2/2 绿（thread 索引取回 + 隔离，`pnpm --filter @cat-cafe/api test:redis`） |
| union 回归（right-panel-toggle） | 5/5 绿（vitest） |
| web typecheck | `tsc --noEmit` 0 error |
| biome（lint/format） | 改动文件 exit 0（complexity 16→<15 已重构） |
| api build | exit 0 |

## Stateful Object Census（F229 gate）

无新增 lifecycle 持久状态对象 —— 产物列表是 messages+tasks+ledger 的**纯投影**（零新存储，无失同步）。唯一 lifecycle 对象（threadMemory ledger）owner 是 F148，本 feat 只读消费。

## 截图状态（push back，请 reviewer 评估）

前端浏览器实测截图走 **alpha 验收**（合入后 @sonnet 真实环境），理由：worktree 造"有产物的 thread"数据成本极高（需 append 带 rich block 的消息 + PR task + ledger 到 Redis）；`feedback_real_data_over_incomplete_types` 明确"数据离线难造时早走合入+alpha 真实验"；铁律#4 已合入用 alpha。视觉已用 playwright 验证过低保真设计稿（`assets/F232/artifacts-panel-lowfi.png`，28 图标渲染），`ArtifactsPanel` 复用相同 SVG/配色/布局。请 reviewer 先 review 代码逻辑正确性，视觉/端到端 alpha 验收。

## Review Focus（技术 OQ）

1. 聚合器三源映射 + 去重正确性（`thread-artifacts-aggregator.ts`）
2. endpoint 鉴权骨架复用 + optional store guard（`threads.ts`）
3. union 扩展是否遗漏（chatStore/Header/test mock + ChatContainer 分支）
4. hook AbortController + error state 边界

## 如果我判断错了，最可能错在哪（pre-register retraction）

1. **filesTouched 走 ledger（cap5）可能漏文件** —— 大 thread 文件产物覆盖不全，OQ-A2 待规模实测；若 reviewer 认为 MVP 也该全量，我升级路线 A。
2. **rich file block 不设 ref → 不与 ledger file 去重** —— 同一文件若既是消息附件又是代码改动可能重复；我判断这俩来源语义不同（附件 vs 代码），但可能误判。
3. **audio name slice(0,24) 截断中文** —— 可能截断多字节边界；低风险但未处理。

---

**Reviewer 启动**：`pnpm review:start`（沙盒路径 `/tmp/cat-cafe-review/f232/codex`）。记录实际端口。
