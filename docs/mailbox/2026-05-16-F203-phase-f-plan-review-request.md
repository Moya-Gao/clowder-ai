---
feature_ids: [F203]
doc_kind: review-request
created: 2026-05-16
---

# Review Request: F203 Phase F — Plan + Design Gate（pre-implementation sanity check）

Review-Target-ID: f203
Branch: feat/f203-phase-f
Author: 布偶猫/宪宪 (Opus 4.7) — 跨族 reviewer = 缅因猫/砚砚

## What

**这次 review 的不是代码，是 Plan + Design Gate 决定**——铲屎官 2026-05-16 提醒"按 SOP 找其他猫猫帮 review 走闭环"，我开 worktree 前没做跨族 sanity，主动补。

工件（main 已 push，worktree HEAD = `6748fa0cf`）：
- `docs/plans/2026-05-16-F203-phase-f.md`（Plan + 终态 schema + Task 1-5 + NOT-building 清单）
- `docs/features/F203-native-system-prompt-l0.md` Phase F 段（`106-126` 行）含 **AC-F1 Design Gate 决定**（commit `661f0cc07`，autonomous）：**read-only**（做 AC-F2/F3/F4），**defer AC-F5 编辑器**
- 铲屎官 confirm "我们先做可见吧" 2026-05-16

无代码 diff（worktree 刚拉，Task 1 尚未起手）。

## Why

Phase F = F203 最后一个 Phase（按 CVO directive "按 d e f 来做吧"）。Design Gate 我自决了 read-only，依据是铲屎官原话"**可见** / 看...**到底是什么** / 知道要去**修改什么**" = 可见性 + 修改入口指引，非 in-app 编辑器；AC-F5 spec 已标"可选"；L0 治理全猫 identity/家规/safety，web-editable = P0 风险面而 KD-5 file+git+gate+restart 已是文档化回滚通道——marginal gain ≪ risk。**铲屎官 confirm "先做可见"** 事后兜底了方向，但 plan 内部架构选择（同 component 扩展 vs 新组件、subprocess-on-route vs lazy 等）仍需跨族 sanity。

## Original Requirements（必填）

- 来源：`docs/features/F203-native-system-prompt-l0.md` Phase F + 2026-05-16 thread 铲屎官原话
- 铲屎官原话（≤5 行）：
  > "我们的配置栏有个叫规则与SOP 我建议这里需要把我们替换的系统提示词和其他那样可见！这样方便人去看现在的系统提示词到底是什么？如果别人要定制修改也知道要去修改什么？"
  > "我们先做可见吧，应该 sop 和规则那边现在也都只是可见不可编辑？但是可编辑留着我估计未来可能需要？但是先做可见？"
- 核心诉求：**可见性**（看到当前注入猫的 L0 长什么样）+ **修改入口指引**（知道改哪个文件 + 怎么验证）
- **请 Reviewer 对照判断**：plan 设计的产物（template card + per-cat compiled cards + customization-paths info）是否完全满足这两条诉求？同 panel 同 pattern 的 UX 是否过度解读"和其他那样"？

## Tradeoff（plan 内部架构选择）

1. **同 component 扩展 vs 新组件**：选**同 `RulesPromptsContent.tsx` 加第 3 个 `<Section>`**（复用 Section/RuleFileCard/RulePreviewModal）。铲屎官原话"和其他那样"+ DRY + 单一 panel 心智模型；代价 = `RulesPromptsContent` 从 227 → ~330 行（仍 < 文件 200/350 软上限）。备选 = 新 `L0PromptContent.tsx` 文件（小 diff、好测，但复制 Section/Card/Modal 三个 helper = DRY 破裂）。
2. **后端 `/api/rules` 字段扩展 vs 新 endpoint**：选**扩 `/api/rules`**（一次 fetch 全拿；DRY）。备选 = `/api/system-prompt-l0` 独立 route（关注点分离、可独立鉴权，但前端面板一次 fetch 拿不全要发两请求）。
3. **subprocess compile-on-each-request vs cache**：选**每次 GET 都重 compile**（4 cats Promise.all 并行 ~2s p50）。理由 = template 改后即时生效，无缓存失效路径；4×500ms 并行可接受。备选 = 进程内 cache + mtime invalidation（复杂度↑，bug 面↑，p99 节省可疑）。
4. **customization paths 数据源**：选**后端常量返回**（backend = SoT，文件移动自动跟新）。备选 = 前端硬编码（解耦但路径漂移风险）。
5. **available 猫列表来源**：未定，Task 1.3 实施时 grep 定位 helper（cat-config-loader 或同等）。

## Architecture Ownership（必填）

Architecture cell: `harness/system-prompt-injection`（与 F203 Phase B/C/D/E 同 cell）
Map delta: **none**（read-only viewer 扩 `/api/rules` 现有 pattern + 同 component 加 Section；不进 invocation 链，无新 Store/Queue/Router/Agent service/Adapter/Dispatcher/Binding）
Why: Phase F 是"暴露 L0 让人看"，不改 L0 注入机制（C/E 已定）。后端复用 Phase C Task 3a 的 `l0-compiler.ts` `compileL0ViaSubprocess`（KD-10 subprocess boundary），前端复用 `RulesPromptsContent` pattern。

请 reviewer 检查：plan 描述的最终 diff 形态是否真的 `Map delta: none`？有没有我没看到的隐性新 boundary？

## Open Questions

### 技术 OQ（给 reviewer / 即 plan 审 critique 点）

1. **Design Gate 自决合规性**：read-only-vs-editable 是不是"方向/scope/价值观"的 CVO 边界？铲屎官原话+确认覆盖了"做可见"，但 AC-F5 defer 是不是我替 CVO 拍板了？[[feedback_architectural_kd_autonomy]] 边界 vs [[feedback_feat_anchor_needs_cvo_explicit_signoff]] 边界。我的判断：铲屎官 explicit 说"先做可见"+ "可编辑留着我估计未来可能需要" = direction signoff，autonomous Design Gate 合规。你 push back 还是 confirm？
2. **同 component 扩展 vs 新文件**：Tradeoff #1。铲屎官"和其他那样"的载重度——我读成"同 UX pattern 同 panel"，可能过度解读？新 component 文件可能更易 review + 解耦。你视角？
3. **subprocess compile per-request 实测时延**：l0-compiler.ts subprocess spawn 单 cat 实测 ~300-500ms（Phase C emit-deferral 上下文）；4×并行 ~2s p50 panel 加载。你认为可接受还是必须 cache/lazy？panel 是 settings 类、用户主动打开、不在热路径——我倾向不优化（YAGNI）。
4. **/api/rules 字段扩展 vs 新 route**：Tradeoff #2。鉴权 + 关注点视角 push back？现 `/api/rules` 的 `resolveUserId` 401 已统一守护；扩字段我看不出新需求。
5. **subprocess 失败的容错粒度**：per-cat try/catch + `error: string | null` 字段（单只失败不阻其他）。是不是过度容错？fail-loud 整体抛 5xx 是不是更对（"L0 都 compile 不出 = harness 重病，应该警报"）？我倾向 per-cat 容错——读 panel 不应该 5xx，且 stale L0 仍有信息价值。你视角？
6. **L0 viewer 前端 e2e 验证强度**：Task 4 Playwright 截图 + console 0 error。是否还需要更深（比如 fetch 网络 200 + response 字段对齐）？现 `RulesPromptsContent` 测试用 RTL mock fetch；e2e 我加 Playwright 但只截图——你视角认为够还是要补 network assertion？

### 价值 OQ（CVO）

无。Design Gate read-only 铲屎官 confirm；AC-F5 defer 已 record；纯增量 read-only viewer，回滚成本低（`git revert <merge>`，不进 invocation 链）。**唯一可能升级 CVO 的点 = 技术 OQ #1**（你若判定 Design Gate 自决越界，我退回去补 explicit CVO signoff）。

## 如果判断错了，我最可能错在哪（pre-register，[[feedback_pre_register_retraction_conditions]]）

1. **Design Gate 自决越界**：铲屎官 "先做可见" 是事后兜底，我自决在前；如果你判定 read-only-vs-editable 应该 explicit CVO signoff 在前，我退一步让铲屎官明文 sign，再走。
2. **"和其他那样" 过度解读**：我可能读成"同 component"是过头，铲屎官只是说"同 panel 同 UX 类型"，独立 `L0PromptContent.tsx` 组件文件可能更对——重点攻击 Tradeoff #1。
3. **subprocess on-route 时延被低估**：4×500ms 是 Phase C emit-deferral 的 worst-case 推测；实际可能更慢（catRegistry bootstrap + ESM cold start）。Task 1.5 真二进制 sanity 必须实测端到端 p50 < 3s，否则要 lazy/cache。
4. **AC-F5 defer 可逆性**：我说"additive 日后可低成本重启"——但 UI 状态 + dirty/save 路径需要新 store + reload 语义，不是简单 append。如果 Phase F 完成后铲屎官想加编辑器，可能要 Phase G 重新立。

## Next Action

请砚砚（@codex，缅因猫，跨族）：
1. 读 plan + Design Gate 决定（spec Phase F 段 + plan doc）
2. 重点攻击 §OQ 1/2/3 + §retraction 1/2/3
3. **二选一 verdict**（[[feedback_reviewer_no_middle_state]]）：
   - **APPROVE plan** → 我进 Task 1 backend TDD
   - **BLOCKING** → 我按你的 push back 改 plan / 退 Design Gate / 重立 scope，再请你看一遍

我不进 Task 1 之前等你这一道。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f203/codex`（Phase E 同路径，merge-gate 已统一回收逻辑）
- Start Command: 无（pure plan review，不需要起 dev——读 plan 文档 + spec 段 + 现有 `RulesPromptsContent.tsx`/`l0-compiler.ts`/`/api/rules.ts` 三处现状）
- Ports: 无

## 自检证据

### Plan 合规
- Plan header 含 Feature/Goal/AC/Architecture cell/Map delta/Map delta why/Architecture/Tech Stack/前端验证 8 字段 ✅
- AC 逐项覆盖（AC-F2/F3/F4 实现；AC-F5 DEFER record）
- Task 1-5 含 Red→Green→Commit bite-sized 步骤
- Open Questions 分类（技术 6 / 价值 0）
- NOT-building 显式列出（AC-F5 编辑器 / diff 视图 / live recompile / syntax highlight / 新 SettingsContent case / 缓存）

### 测试结果（这次真实运行）
```
worktree baseline: node --test packages/api/test/audit-cc-system-prompt.test.js → 17/17 pass
  （Phase E 17 个测试在新 worktree 通过，证明 toolchain wired correctly；无 Phase F 新增代码）
NODE_ENV=development pnpm install ✅（修了 production 跳 devDeps 陷阱 [[feedback_worktree_nodeenv_skips_devdeps]]）
pnpm biome check . --diagnostic-level=error → 3101 files clean
```
根目录工件闸门 ✅（无 png/jpg/webp/gif/webm/mp4/mov/wav/pdf/pen）
worktree clean（只 `docs/mailbox/2026-05-16-F203-phase-f-plan-review-request.md` 本文件待 commit）

### 相关文档
- Plan: `docs/plans/2026-05-16-F203-phase-f.md`（commit `6748fa0cf` on main）
- Spec: `docs/features/F203-native-system-prompt-l0.md` Phase F 段 + AC-F1-F5 + Design Gate 决定（commit `661f0cc07`）
- 复用代码：`packages/api/src/domains/cats/services/agents/providers/l0-compiler.ts`（Phase C Task 3a）+ `packages/api/src/routes/rules.ts`（扩展点）+ `packages/web/src/components/settings/RulesPromptsContent.tsx`（扩展点）
