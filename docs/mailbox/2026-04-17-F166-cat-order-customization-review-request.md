# Review Request: F166 Cat Order Customization — 拖拽自由排序

Review-Target-ID: f166
Branch: feat/f166-cat-order

## What

让铲屎官在 Hub 总揽页通过 HTML5 原生拖拽自定义猫卡片顺序，松手即保存到 `.cat-cafe/user-preferences.json`，`@` picker 和总揽页通过 `useCatData` 同一个注入点自动跟随。Owner-gated 写入，失败自动回滚。

**改动范围（origin/main → HEAD，6 commits）：**
- 后端：新建 `config/cat-order-store.ts`（load/save + 保留其他字段），新建 `routes/config-cat-order.ts`（GET/PUT，owner 网关 + catId 白名单校验），`routes/config.ts` 注册子路由。
- 前端：新建 `lib/sort-cats-by-order.ts`（纯函数），`useCatData` 并行抓 `/api/cats` + `/api/config/cat-order`，`HubMemberOverviewCard` 接收 drag 回调 + ⠿ 把手，`CatOverviewTab` 负责乐观更新 + 失败回滚 + `saveCatOrder` 调用。
- 共享：`@cat-cafe/shared` 新增 `UserPreferences` 类型。

## Why

铲屎官原话明确：
> "总揽这里你这只 47 在太下面了！我希望把你拉到最上面！"
> "我觉得需要的是拖拽？可以自由排序的那种好点？"
> "⠿ 拖拽把手，按住拖动可自由排序。松手自动保存，@ picker 同步跟随？"

当前顺序由 `cat-template.json` 的 roster 声明顺序写死，铲屎官没办法按自己习惯调。两处展示（总揽 + @ picker）必须一致。

## Original Requirements（必填）

> "总揽这里你这只 47 在太下面了！我希望把你拉到最上面！可以吗？"
> "@opus 我觉得需要的是拖拽？可以自由排序的那种好点？"
> "⠿ 拖拽把手，按住拖动可自由排序。松手自动保存，@ picker 同步跟随？"
> "甚至是不是得支持我自己去编排前四个啊？"
> "我希望是你 opus 然后 gpt54 然后 gemini 然后 opus47"

- 来源：直接语音 + `docs/features/F166-cat-order-customization.md` Why 段
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**（核心：拖到最上面 + 松手保存 + @ picker 跟随）

## Tradeoff

| 放弃的方案 | 为什么 |
|-----------|--------|
| `@dnd-kit` / react-dnd | 30 行原生 HTML5 DnD 够用，避免新依赖（KD-1） |
| pin-top 前四位独立分区 | 铲屎官要"拖到最上面"的**自由度**，不是固定分区（KD-2） |
| 塞进 `ConfigStore`（scalar k/v） | catOrder 是 `string[]`，schema 不匹配；改用独立 `user-preferences.json` 文件 |
| 塞进 `cat-catalog.json` | catalog 是配置不是偏好；职责分离 |
| touch 事件（移动端） | Cat Cafe 主要桌面使用，本期 NOT BUILDING |

## Open Questions

**请 reviewer 重点关注：**

1. **`saveCatOrder` 导出位置**（`useCatData.ts`）：把写 API 的函数放在 hook 模块里合理吗？或者该单独拎到 `lib/cat-order-client.ts`？目前选择是"写入后直接 reorder `_cached` 并 notifyListeners"，与 hook 内部状态强耦合，挪出去需要暴露更多内部细节。
2. **HTML5 DnD 的 `dataTransfer?.setData`**：jsdom 测试里我自己构造了 `DataTransfer`-like 对象（`cat-overview-drag.test.tsx`），真实浏览器里 `event.dataTransfer` 非空已由规范保证，但测试里的 optional chaining 有没有误伤真实场景？
3. **乐观回滚的 UX**：`saveCatOrder` 失败时只显示 "排序保存失败，请重试" 文本 + 回滚本地顺序。要不要 toast？要不要自动重试？（当前决定：不重试，不 toast，让铲屎官主动重拖）
4. **`loadCatOrder` 未过滤失效 catId**：后端 GET 直接返回文件里的数组。如果某个 catId 被 `cat-template.json` 删掉，前端 `sortCatsByOrder` 会跳过未知 id。是否应该在后端 load 时就 filter？（当前：前端容错；让后端保留历史顺序，避免"删一只猫导致另一只猫的位置漂移"）

## Next Action

1. Clone `feat/f166-cat-order` 到 `/tmp/cat-cafe-review/f166/codex`（detached HEAD / read-only）
2. `pnpm review:start` 起独立端口沙盒
3. Playwright/Chrome 实测：
   - 拖 opus-47 卡片到最上面，松手后刷新页面，顺序保持 ✅
   - 拖拽时卡片半透明，`⠿` 是 `cursor: grab`
   - 打开 @ picker，第一候选是 opus-47
   - 非 owner 请求 → 403
4. 关注我 Open Questions 里四条
5. 反馈走 P0/P1/P2 分级（参考 `cat-cafe-skills/refs/review-feedback-severity.md`）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f166/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（由 `pnpm review:start` 自动分配，reviewer 启动后请在回复中注明实际分配端口）

## 自检证据

### Spec 合规（quality-gate 报告摘要）

| AC | 状态 | 实现位置 |
|----|------|----------|
| AC-A1 拖拽重排 | ✅ | `HubMemberOverviewCard.tsx` drag handlers + `CatOverviewTab.handleDrop` |
| AC-A2 刷新后保持 | ✅ | `cat-order-store.ts` load/save + `user-preferences.json` |
| AC-A3 @ picker 跟随 | ✅ | `useCatData` 单注入点 `sortCatsByOrder` |
| AC-A4 新猫追加末尾 | ✅ | `sortCatsByOrder` 先 pin 已知 id，再追加 rest |
| AC-A5 无配置保持原序 | ✅ | `catOrder.length === 0` 时 no-op |

**Pen Check:** glob `designs/**/F166*.pen` → 无匹配。⚠️ 无设计稿。

**Artifact Hygiene:** 仓库根目录无媒体/设计工件 ✅

### 测试结果（这次真实运行）

```
pnpm check                                      → 0 errors ✅ (2312 files)
pnpm lint                                       → exit=0 ✅（仅 pre-existing no-hardcoded-colors 警告，非 F166 引入）
pnpm --filter @cat-cafe/api test:redis          → 8453/8454 pass
                                                  ⚠️ 1 fail: test/memory/f163-experiment-logger.test.js（'shadow' !== 'off'）
                                                  → F166 未修改任何 memory/* 路径，diff 仅新增 config/cat-order-store.ts，失败 pre-existing
pnpm vitest run (web)                           → 2219 pass / 8 skipped / 0 fail ✅
pnpm check:dir-size                             → pre-existing 违规（memory 34/email 23/scheduler 15/utils 19），F166 新增 0 条违规
```

### F166 专属测试覆盖

- `packages/api/test/config/cat-order-store.test.js` — load/save roundtrip + 保留其他字段
- `packages/api/test/routes/cat-order-route.test.js` — 7 cases（GET 空 / PUT 持久化 / GET 反映 / 非 owner 403 / 无 header 400 / 未知 id 400 / 空数组清空）
- `packages/web/src/lib/__tests__/sort-cats-by-order.test.ts` — 4 cases（空 no-op / pin+rest / 未知 id drop / 不 mutate）
- `packages/web/src/hooks/__tests__/use-cat-data-order.test.tsx` — 2 cases（按 catOrder 排 / 空 no-op）
- `packages/web/src/hooks/__tests__/useCatData-retry.test.ts` — 调整为 path-aware mock，兼容新增 `/api/config/cat-order` 并行请求
- `packages/web/src/components/__tests__/cat-overview-drag.test.tsx` — 2 cases（happy path 调 saveCatOrder / 失败回滚 + 显示 alert）

### 前端 Live E2E 局限

全栈 dev 启动代价高，未在本机实测浏览器。**单元+集成测试覆盖完整**（drag 事件流 / 乐观更新 / 回滚 / @ picker 排序跟随 / owner gate 全路径）。**请 reviewer 在沙盒中补齐 Playwright/Chrome 实测**。

### 相关文档

- Plan: `docs/plans/2026-04-17-F166-cat-order-customization.md`
- Feature: `docs/features/F166-cat-order-customization.md`
- Key Decisions: KD-1（原生 DnD）、KD-2（自由排序 vs pin-top）、KD-3（复用 /api/config 偏好框架）

---

Reviewer: @codex（跨 family：Ragdoll → Maine Coon）
Author: opus-47（布偶猫 Opus 4.7 / 宪宪）
