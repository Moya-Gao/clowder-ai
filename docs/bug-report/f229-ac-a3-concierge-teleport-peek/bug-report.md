---
feature_ids: [F229]
topics: [concierge, teleport, peek, url-routing, time-bomb, recent-browse-selection]
doc_kind: bug-report
created: 2026-06-14
---

# Bug Report — F229 AC-A3 Concierge Teleport 跳大厅 + 裸 Marker/Peek 缺失

> 报告人：铲屎官 production 验证（concierge thread `thread_mqawamwdxtvem4k5`「前台猫·default-user」）暴露；opus-48 fresh session 调查。
> 状态：调查完成，Bug1 根因铁证 / Bug2 含设计选择。
> 背景：AC-A3 在 spec 已标 `[x]` + Phase A 已 close（愿景守护 opus-47 PASS + sonnet alpha 验收）。但验收链只验"按钮渲染"未验"点击 teleport 真跳对 thread"（盲点见 `feedback_alpha_smoke_happy_path_blindspot`）→ close 早了，reopen 修两个 production bug。

---

## 1. 报告人 / 发现路径

铲屎官在 production concierge thread 跑真实 query（"最近讨论 F229 猫猫球功能"）验收，发现：
- **Bug 1**：点"跳过去"按钮 → 跳到**大厅**（default thread），不是目标讨论 thread。
- **Bug 2**：没有"原地看"（peek）按钮，但烁烁正文写了"您可以点击 `[原地看 R3]` 原地预览…或点击 `[跳过去 R3]` 直接跳转"。

Ground truth（msg `0001781431345142-000075-b9d27943`，catId=gemini35）原文：
> 您好 Landy！已为您找到最近讨论 F229 猫猫球功能的 Thread：
> 您可以点击 `[原地看 R3]` 原地预览讨论的详细上下文，或者点击 `[跳过去 R3]` 直接跳转至该讨论页面进行查看。

---

## 2. 复现步骤（期望 vs 实际）

| | 期望 | 实际 |
|---|---|---|
| Bug1 | 点"跳过去：《xxx讨论》" → 路由切到该 thread | 跳到大厅（default） |
| Bug2-a | 正文干净，按钮是唯一交互入口 | 正文裸露 `[原地看 R3]`/`[跳过去 R3]` 文本 |
| Bug2-b | 烁烁说"点击 [原地看 R3]" → 有对应 peek 按钮，点击 inline 展开 | 无 peek 按钮（承诺落空） |

---

## 3. 根因分析

### Bug 1：前端 teleport 用错 URL 格式（query vs path）— 铁证

数据格式链路其实**全部一致**（交接假设的"threadId mismatch"被证伪）：
- memory anchor `thread-thread_xxx`（`IndexBuilder.ts:449`）→ drillDown.params.threadId `thread_xxx`（`SqliteEvidenceStore.ts:1037-1043`）→ runtime threadId `thread_xxx`（`ids.ts:64`）✓ 三者一致。

真正的 bug 在前端 URL 格式：
- **错误写法**：`CardBlock.tsx:114/118/128` + `ArtifactsPanel.tsx:274` 用 `window.location.href = \`/?threadId=${threadId}\``（**query 参数**格式）。
- **前端路由只认 pathname**：chat 路由 threadId 唯一来源是 `(chat)/layout.tsx:12` → `getThreadIdFromPathname(window.location.pathname)`（`thread-navigation.ts:23-27`），正则 `/^\/thread\/([^/?#]+)/`。
- **铁证**：全 web `searchParams.get('threadId')` **零消费者** → query threadId 加载后完全丢失。
- 结果：`/?threadId=XXX` 的 pathname 是 `/` → `getThreadIdFromPathname('/')` 返回 `'default'` → 跳大厅。

对照：已上线验证的 `useTeleport.ts:91` 用 `pushThreadRouteWithHistory(tid, window)` → `/thread/XXX` path + pushState 软导航 ✓。CardBlock/ArtifactsPanel 是新写的 concierge/artifact teleport，用错了格式。**同型 bug 扩散 4 处**（`feedback_grep_consumers_before_contract_change`）。

### Bug 2：裸 marker + peek 缺失 — 含设计选择

- **2-a 裸 marker**：validator（`concierge-reply-validator.ts` `extractConciergeActions`/`buildConciergeActions`）只**提取** actions，**从不修改 replyText**；`route-serial.ts:2194` 存 `content: storedContent`（原文）→ 正文裸露 marker。
- **2-b 烁烁把 marker 当 inline 控件**：production 正文"您可以点击 `[原地看 R3]`"——烁烁（gemini）把内部协议 marker 当成用户可点的行内按钮来引导，但系统设计是注入**独立 card 按钮**（正文下方），二者脱节。
- **2-c peek 缺 messageId**：peek 按钮设计（`CardBlock.tsx:189-193` handleConciergePeek）需要 messageId，无则 no-op；`shouldSkipAction`（validator:59）在 anchor 无 messageId 时 skip peek（fail-closed 正确）。production R3 召回走 thread-digest 分支（`SqliteEvidenceStore.ts:1037`，只给 threadId）而非 passage 分支（:1025，带 messageId）→ 无 messageId → peek 永远 skip。**为什么 `depth:raw` 没产生带 `msg-` passage 的 messageId，待 worktree 测试实证**（messageId 来源 `SqliteEvidenceStore.ts:954`：`passageId.startsWith('msg-') ? slice : undefined`）。

---

## 4. 修复方案

### Bug 1（确定，自决）
4 个点（`CardBlock.tsx:114/118/128` + `ArtifactsPanel.tsx:274`）从 `window.location.href = /?threadId=XXX` 改用 `pushThreadRouteWithHistory(threadId, window)`（path 格式 + 软导航，对齐 `useTeleport`）。软导航保留 pending teleport，messageId 的 scroll resolve 继续工作。

### Bug 2（含 UX 设计选择 → Decision Packet 给 CVO）
- **方向 X（推荐，inline 按钮）**：前端把正文 `[跳过去 Rn]`/`[原地看 Rn]` 渲染成 inline 可点击按钮 → 所见即所点，顺应烁烁/gemini 的自然表达（不依赖模型遵从度，符合 KD-19 精神）。
- **方向 Y（strip + 独立区）**：validator strip 正文 marker + 改写引导语；问题：strip 后引导句残缺（"点击  原地预览"），且依赖烁烁输出格式（gemini 不可控）。
- peek messageId 召回（2-c）无论哪个方向都要解决——待实证根因后定。

---

## 5. 验证方式

### Bug1（已验证 ✅）
- 单测：`CardBlock-concierge-teleport.test.tsx`（3 场景：点击 teleport±messageId / go → pushState `/thread/X`）+ `artifacts-panel-jump.test.ts`（跨 thread）。回归 51 绿。
- **浏览器端到端对比验证**（worktree dev `:5112`，真实 thread）：
  - ❌ query `/?threadId=thread_mpdrmp33ws4zvq8e` → `pathname='/'` → `derivedThreadId='default'` → 渲染「Cat Café 大厅」（复现旧 bug）
  - ✅ path `/thread/thread_mpdrmp33ws4zvq8e` → `derivedThreadId='thread_mpdrmp...'` → `isLobby=false` → 渲染「微信 IM Hub」（修复后跳对 thread）
  - 证据：`assets/f229-bug1-path-format-loads-thread-b.png`
- 证据链：单测（点击→生成 path 导航，是**行为验证非渲染**）+ 浏览器（path→跳对 thread / query→大厅）= 端到端覆盖 gotcha②「真点 teleport 跳对 thread」，避开"只验渲染"盲点。

### Bug2（待 CVO 方向 + production 数据）
- 按 CVO 定的呈现方向（A inline 按钮 / B strip+独立区）；peek 召回需 alpha/runtime 真实数据实测定断点。
- 修后 alpha 真点 peek 确认 inline 展开。

---

## 6. Self-Evolution 候选

AC 验收标准应强制含**端到端交互验证**（点击真工作）而非仅"按钮渲染"——本 bug 根因是验收链盲点（sonnet alpha + opus-47 守护都只验渲染）。→ self-evolution 提案。

[宪宪/opus-4.8🐾]
